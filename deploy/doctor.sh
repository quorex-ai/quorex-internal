#!/usr/bin/env bash
# Diagnostic complet de quorex-internal, en une seule commande :
#
#   bash deploy/doctor.sh
#
# Ne modifie rien. Chaque section est indépendante : le script va toujours
# jusqu'au bout, et termine par un verdict avec les commandes de correction.

set +e
cd "$(dirname "$0")/.." || exit 1

PROBLEMES=()
signaler() { PROBLEMES+=("$1"); }

# Couleurs seulement sur un vrai terminal : la sortie doit rester lisible
# quand on la colle dans une conversation ou qu'on la redirige.
if [ -t 1 ]; then
  GRAS=$'\033[1m'; ROUGE=$'\033[31m'; VERT=$'\033[32m'; FIN=$'\033[0m'
else
  GRAS=''; ROUGE=''; VERT=''; FIN=''
fi

titre() { printf '\n%s== %s ==%s\n' "$GRAS" "$1" "$FIN"; }

# Docker utilisable, plugin compose compris ?
docker_pret() { command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; }

DATA_ROOT=/var/lib/quorex-internal

printf '%squorex-internal — diagnostic%s\n' "$GRAS" "$FIN"
printf 'dossier : %s\n' "$PWD"
printf 'date    : %s\n' "$(date '+%Y-%m-%d %H:%M:%S')"

# ---------------------------------------------------------------- 1. config
titre "1. Configuration (.env)"
if [ ! -f .env ]; then
  echo "FICHIER ABSENT"
  signaler "Le fichier .env n'existe pas → cp .env.example .env puis renseigner SESSION_SECRET"
else
  while IFS='=' read -r cle valeur; do
    case "$cle" in
      SESSION_SECRET)
        longueur=${#valeur}
        if [ "$longueur" -lt 32 ]; then
          printf '%-16s %s\n' "$cle" "trop court ($longueur caractères, 32 minimum)"
          signaler "SESSION_SECRET trop court → le regénérer (voir README)"
        else
          printf '%-16s %s\n' "$cle" "rempli ($longueur caractères)"
        fi
        ;;
      PORT|DATABASE_PATH|DOCUMENTS_DIR|BACKUP_DIR|NODE_ENV|TRUST_PROXY)
        printf '%-16s %s\n' "$cle" "${valeur:-<vide>}"
        [ -z "$valeur" ] && signaler "$cle est vide dans .env"
        ;;
    esac
  done < <(grep -E '^[A-Z_]+=' .env)
fi

# --------------------------------------------------------------- 2. stockage
titre "2. Stockage sur l'hôte"
if [ ! -d "$DATA_ROOT" ]; then
  echo "$DATA_ROOT : absent (il sera créé au démarrage)"
else
  ls -ld "$DATA_ROOT" "$DATA_ROOT"/* 2>/dev/null
  proprietaire=$(stat -c '%u:%g' "$DATA_ROOT" 2>/dev/null || stat -f '%u:%g' "$DATA_ROOT" 2>/dev/null)
  echo "propriétaire de $DATA_ROOT : $proprietaire (attendu 1000:1000)"
  if [ -n "$proprietaire" ] && [ "$proprietaire" != "1000:1000" ]; then
    signaler "Dossiers de données mal attribués → chown -R 1000:1000 $DATA_ROOT"
  fi
  base=$(grep -E '^DATABASE_PATH=' .env 2>/dev/null | cut -d= -f2)
  if [ -n "$base" ] && [ -f "$base" ]; then
    echo "base : $(ls -l "$base" | awk '{print $5" octets, "$3":"$4}')"
  fi
fi
echo "espace disque :"
if [ -d "$DATA_ROOT" ]; then df -h "$DATA_ROOT" | tail -1; else df -h . | tail -1; fi

# -------------------------------------------------------------- 3. conteneur
titre "3. Conteneur"
if ! docker_pret; then
  echo "docker ou le plugin compose n'est pas disponible ici — sections 3 et 4 ignorées"
else
  docker compose ps 2>&1
  etat=$(docker compose ps --format '{{.State}}' 2>/dev/null | head -1)
  case "$etat" in
    running) echo "→ le conteneur tourne" ;;
    restarting) signaler "Le conteneur reboucle → lire la sonde de démarrage, section 4" ;;
    '') signaler "Aucun conteneur → docker compose up -d --build" ;;
    *) signaler "Conteneur en état « $etat »" ;;
  esac
  echo
  echo "--- 30 dernières lignes de log ---"
  docker compose logs --tail=30 app 2>&1 | sed 's/^/   /'
fi

# ----------------------------------------------------------- 4. sonde démarrage
titre "4. Sonde de démarrage (dans le conteneur)"
if docker_pret; then
  echo "Chaque étape est annoncée avant d'être exécutée :"
  echo "la dernière ligne affichée est celle qui pose problème."
  docker compose run --rm --no-deps -v "$PWD/deploy:/probe:ro" app node /probe/probe.mjs 2>&1 \
    | grep -vE '^(Container|\[\+\])'
  if [ "${PIPESTATUS[0]}" -ne 0 ]; then
    signaler "La sonde de démarrage échoue → voir l'étape en échec ci-dessus"
  fi
else
  echo "ignorée (docker indisponible)"
fi

# ----------------------------------------------------------------- 5. réseau
titre "5. Réseau"
port=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2)
port=${port:-4317}
reponse=$(curl -s --max-time 5 "http://127.0.0.1:$port/api/health")
if [ -n "$reponse" ]; then
  echo "/api/health : $reponse"
else
  echo "/api/health : aucune réponse sur le port $port"
  signaler "L'application ne répond pas sur 127.0.0.1:$port"
fi
echo "ports 80 et 443 :"
occupation=$( (ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null) | grep -E ':80 |:443 ' )
if [ -n "$occupation" ]; then echo "$occupation" | sed 's/^/   /'; else echo "   (personne n'écoute)"; fi

# ---------------------------------------------------------------- 6. verdict
titre "6. Verdict"
if [ ${#PROBLEMES[@]} -eq 0 ]; then
  printf '%sRien à signaler.%s\n' "$VERT" "$FIN"
else
  printf '%s%d problème(s) :%s\n' "$ROUGE" "${#PROBLEMES[@]}" "$FIN"
  for probleme in "${PROBLEMES[@]}"; do
    printf '  • %s\n' "$probleme"
  done
fi
echo
