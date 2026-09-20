# quorex-internal

Dashboard interne de pilotage QUOREX : jalons, tâches, journal, point hebdo, frise, liens et coffre
documentaire. Outil privé à deux comptes, servi sur `internal.quorex.fr`. Aucun lien avec le code ou
les données du produit QUOREX.

Les huit sections du brief (`docs/BRIEF.md`) sont construites.

## Prérequis

- **Node 22 ou plus récent** (LTS), npm 10 ou plus récent. `better-sqlite3` exige Node 22 ;
  une version inférieure fait désormais échouer l'installation (`engine-strict`) plutôt que
  produire un binaire natif qui s'écroule au premier appel.
- Une chaîne de compilation C++ pour `better-sqlite3` et `argon2` (`build-essential` et `python3` sur
  Debian/Ubuntu).
- `tar` (présent sur toute distribution Linux et sur macOS) pour le script de sauvegarde.

## Installation

```bash
git clone <depot> quorex-internal
cd quorex-internal
npm install
cp .env.example .env
```

Remplir `.env` :

```bash
# secret de session : le serveur refuse de démarrer en dessous de 32 caractères
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

| Variable         | Rôle                                                                |
| ---------------- | ------------------------------------------------------------------- |
| `PORT`           | Port HTTP du serveur (API + front, même port). Défaut `4317`.        |
| `DATABASE_PATH`  | Fichier SQLite. Créé au démarrage, dossier parent compris.           |
| `DOCUMENTS_DIR`  | Dossier des documents du coffre, hors dépôt et hors racine web (700).|
| `BACKUP_DIR`     | Dossier des archives de sauvegarde.                                  |
| `SESSION_SECRET` | Secret de signature des sessions, 32 caractères minimum.             |
| `NODE_ENV`       | `development`, `production` ou `test`.                               |

## Données de départ

```bash
npm run seed:users        # crée ou met à jour les deux comptes, en ligne de commande
npm run seed:milestones   # crée les sept jalons du brief, idempotent
```

`seed:users` demande login, nom affiché et mot de passe (12 caractères minimum, saisie masquée), puis
propose d'enchaîner sur le second compte. Il n'y a pas de page d'inscription : c'est le seul chemin de
création. Relancé sur un login existant, il remplace le mot de passe et révoque les sessions ouvertes
de ce compte. Le hachage est argon2id.

`seed:milestones` peut être relancé sans risque : un jalon déjà présent n'est ni dupliqué ni modifié.

## Développement

```bash
npm run dev
```

Trois processus : compilation continue de `shared/`, serveur API sur `PORT` (via `tsx`), et Vite sur
<http://localhost:5173>, qui relaie `/api` vers le serveur.

```bash
npm run typecheck   # TypeScript strict sur les trois espaces de travail
npm run test        # tests serveur (vitest)
npm run build       # shared -> server/dist -> front dans server/dist/public
npm start           # sert le front compilé et l'API sur le même port
```

Vérification de bout en bout :

```bash
npm run build && node server/dist/index.js
curl -s http://127.0.0.1:4317/api/health   # {"status":"ok","database":"ok","time":"..."}
```

## Les huit sections

| Section         | Ce qu'elle fait                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Tableau de bord | Les jalons avec date cible, statut, critères cochés, tâches ouvertes, retards signalés ; tâches en cours et critères du jalon courant. |
| Jalons          | Liste réordonnable par glisser-déposer, fiche éditable, critères d'acceptation cochables, tâches liées. |
| Tâches          | Kanban à quatre colonnes, glisser-déposer entre colonnes, filtres par jalon et par assigné, création rapide. |
| Journal         | Toutes les mutations en ordre chronologique inverse, filtrables par entité et par personne, paginées, en lecture seule. |
| Hebdo           | Synthèse automatique tirée du journal de la semaine, puis compte rendu en trois champs, navigation de semaine en semaine. |
| Frise           | Les jalons sur un axe horizontal, repère « aujourd'hui », retards marqués ; les jalons sans date sont listés à part. |
| Liens           | Liens de travail éditables et réordonnables, préchargés à la première migration.                 |
| Coffre          | Dossiers (création, renommage, déplacement par glisser-déposer), dépôt de documents, édition des métadonnées, filtres et recherche, regroupement par type / jalon / tag, téléchargement, suppression confirmée. |

Règle métier unique, appliquée par le serveur et reflétée par le client : **un jalon ne passe à
`closed` que si tous ses critères d'acceptation sont cochés**. Sinon le serveur répond `409` avec la
liste des critères manquants, que la fiche affiche.

## Confort d'usage

- **Recherche ⌘K.** `⌘K` (ou `Ctrl+K`, ou un clic sur la barre de recherche) ouvre une palette qui
  cherche dans les sections, les jalons, les tâches et les documents. Flèches pour se déplacer, Entrée
  pour ouvrir, Échap pour fermer. Elle amène directement sur l'élément : le jalon sélectionné, la tâche
  surlignée dans sa colonne, le document dans son dossier.
- **Enregistrement automatique.** La fiche d'un jalon, les liens, le compte rendu hebdo et l'édition
  d'une tâche s'enregistrent en sortant du champ, avec un état « Enregistrement… / Enregistré » à côté
  du titre de la carte. Pas de bouton à chercher, pas de modification perdue. Le seul refus possible
  est la fermeture d'un jalon dont les critères ne sont pas tous cochés : le champ revient alors à sa
  valeur précédente et la liste de ce qui manque s'affiche.
- **Retours d'action.** Les actions ponctuelles (création, suppression, déplacement) affichent une
  confirmation brève en bas à droite.

## Coffre : dossiers

Les documents se rangent dans une arborescence de dossiers, en plus de leurs métadonnées.

- Création, renommage et suppression depuis la vue dossiers ; un dossier non vide ne se supprime pas.
- Un document se range en le glissant sur un dossier, sur le fil d'Ariane pour remonter, ou via le
  champ « Dossier » de sa fiche. Un dossier se déplace de la même façon ; un dossier ne peut pas être
  rangé dans lui-même ou dans l'un de ses descendants.
- Le sélecteur en haut à droite bascule entre la vue dossiers et un regroupement par type, par jalon ou
  par tag — un même document apparaît alors dans chacun de ses tags.
- Dès qu'un filtre ou une recherche est actif, la recherche porte sur tout le coffre, dossiers
  confondus, et chaque ligne indique son dossier.

Les dossiers ne sont pas journalisés (le journal du brief ne connaît que jalons, tâches, critères et
documents), mais **le déplacement d'un document l'est**, comme tout changement de métadonnée.

## Base de données

SQLite via `better-sqlite3`, sans ORM, SQL écrit à la main. Les migrations sont des fichiers SQL
numérotés dans `server/migrations/`, appliquées au démarrage dans l'ordre alphabétique et notées dans
`schema_migrations` ; une migration déjà appliquée n'est jamais rejouée. Toutes les tables ont `id`
(UUID v7 généré côté serveur), `created_at` et `updated_at` en ISO-8601 UTC.

Le journal (`journal`) est écrit uniquement par le serveur, à chaque mutation, avec son auteur. Aucune
route ne permet d'y écrire ou d'en effacer une ligne.

## Authentification

- Session en cookie `httpOnly`, `sameSite=strict`, `secure` dès que `NODE_ENV=production` (en
  développement le cookie doit pouvoir circuler sur `http://localhost`), durée 30 jours glissants.
- La base ne stocke jamais le jeton du cookie, seulement son HMAC-SHA256 calculé avec `SESSION_SECRET`.
- `POST /api/auth/login` est limité à 5 tentatives par tranche de 15 minutes et par IP ; une connexion
  réussie rend ses tentatives à l'IP.
- Toute route `/api/*` hors `/api/health` et `/api/auth/login|logout` exige une session valide et
  répond `401` sinon ; le front redirige alors vers `/login`.
- Format d'erreur unique : `{ "error": { "code", "message", "details"? } }`. Aucune stack ne sort vers
  le client.

## Coffre : ce qui est garanti

- Les fichiers sont écrits dans `DOCUMENTS_DIR`, hors dépôt et hors racine web, créé au démarrage en
  `700` ; chaque fichier est écrit en `600`.
- Le nom sur disque est un UUID v7 suivi de l'extension normalisée. Le nom d'origine ne touche jamais
  le disque : il est conservé en base et nettoyé avant d'entrer dans `Content-Disposition`.
- Le type est déduit du **contenu** (octets de signature), jamais de l'extension ni de l'en-tête envoyé
  par le client. Formats acceptés : PDF, docx, xlsx, png, jpg ; 25 Mo maximum.
- Le téléchargement passe uniquement par `/api/documents/:id/download`, avec session valide. Aucune
  route ne sert le dossier ni son contenu, et aucune ne le liste.
- La suppression efface la ligne, puis le fichier, et le note au journal.

## Si l'application ne démarre pas

Une seule commande, elle ne modifie rien :

```bash
bash deploy/doctor.sh
```

Elle inspecte la configuration, les dossiers de données et leurs permissions, l'état du
conteneur, ses derniers logs, puis **rejoue les étapes du démarrage une par une dans le
conteneur** en annonçant chaque étape avant de l'exécuter. Elle termine par un verdict : un
problème par ligne, avec la commande qui le corrige.

C'est utile même quand le processus meurt sans rien écrire : la dernière étape affichée est
celle qui a échoué. Le serveur lui-même trace désormais son démarrage de la même façon
(`[demarrage] …`), donc `docker compose logs app` suffit souvent.

## Sauvegarde et restauration

```bash
npm run backup
# -> BACKUP_DIR/quorex-internal-AAAAMMJJ-HHMMSS.tar.gz (base + documents)
```

La base est copiée par l'API de backup de SQLite, pas par un `cp` à chaud : l'archive est cohérente
même si le serveur écrit pendant l'opération.

Ligne cron quotidienne (3 h 15, en tant qu'utilisateur `quorex`) :

```cron
15 3 * * * cd /opt/quorex-internal && /usr/bin/npm run backup >> /var/log/quorex-backup.log 2>&1
```

Restauration, testée :

```bash
sudo systemctl stop quorex-internal

# 1. extraire l'archive dans un dossier de travail
mkdir -p /tmp/restore && tar -xzf /var/lib/quorex-internal/backups/quorex-internal-20260917-181837.tar.gz -C /tmp/restore
ls /tmp/restore                       # database.db  documents/

# 2. remettre la base et les documents en place
install -o quorex -g quorex -m 600 /tmp/restore/database.db /var/lib/quorex-internal/quorex-internal.db
rm -f /var/lib/quorex-internal/quorex-internal.db-wal /var/lib/quorex-internal/quorex-internal.db-shm
rm -rf /var/lib/quorex-internal/documents
cp -a /tmp/restore/documents /var/lib/quorex-internal/documents
chown -R quorex:quorex /var/lib/quorex-internal/documents
chmod 700 /var/lib/quorex-internal/documents

# 3. redémarrer et vérifier
sudo systemctl start quorex-internal
curl -s http://127.0.0.1:4317/api/health
rm -rf /tmp/restore
```

## Déploiement

L'application est un seul processus Node derrière un reverse proxy HTTPS.

```bash
# sur le VPS, en tant qu'utilisateur quorex
cd /opt/quorex-internal
npm ci
npm run build
npm run seed:users
npm run seed:milestones

sudo install -o quorex -g quorex -d -m 700 /var/lib/quorex-internal
sudo cp deploy/quorex-internal.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now quorex-internal
sudo systemctl status quorex-internal
```

`DATABASE_PATH`, `DOCUMENTS_DIR` et `BACKUP_DIR` doivent pointer sous `/var/lib/quorex-internal` : le
service systemd n'a le droit d'écrire que là (`ReadWritePaths`).

Le bloc de reverse proxy est dans `deploy/Caddyfile.example` (`internal.quorex.fr`, certificat
automatique, proxy vers `127.0.0.1:PORT`). Le serveur Node n'est jamais exposé directement. En-têtes de
sécurité posés par `helmet`, `robots.txt` interdisant tout le site, et `trust proxy` limité à la boucle
locale pour que la limitation par IP voie l'adresse réelle.

## Organisation du dépôt

```
client/     front React 18 + Vite + Tailwind, compilé dans server/dist/public
server/     API Express + SQLite, migrations SQL, scripts, tests
shared/     schémas zod partagés entre client et serveur
deploy/     unité systemd et exemple de reverse proxy
docs/       brief, référence de design, idées mises de côté
```

## Tests

```bash
npm test
```

Couverture demandée par le brief : la règle de fermeture des jalons (refus détaillé, puis acceptation
une fois les critères cochés), l'écriture du journal à chaque mutation (et l'absence d'écriture quand
rien ne change), l'authentification (login, réponses identiques pour mot de passe faux et compte
inconnu, rate limit, `401` sur les routes protégées, secret de session trop faible), la vérification du
type des fichiers du coffre par leur contenu, et l'impossibilité de télécharger un document sans
session valide.

S'y ajoutent : la monotonie des UUID v7 (deux écritures dans la même milliseconde se relisent dans
l'ordre), les mises à jour partielles (envoyer un seul champ ne doit jamais réinitialiser les autres —
`.partial()` de zod conserve les `.default()`, d'où des schémas de mise à jour écrits explicitement),
et les dossiers du coffre (suppression refusée si le dossier n'est pas vide, cycle refusé, doublon de
nom refusé).

## Design

La référence visuelle est `docs/design-ref.png`, décrite en détail dans `docs/BRIEF.md`. Les jetons
(couleurs, tailles de texte, rayons) sont dans `client/src/index.css` et ne sont redéfinis nulle part
ailleurs.

Deux points à connaître :

- **Mise à l'échelle.** La référence fixe des tailles absolues (titre 44 px, sidebar 310 px, lignes
  64 px) dessinées sur un canevas large. En dessous de 1800 px de large, toute l'interface est remise à
  l'échelle (`--app-zoom` dans `index.css`) : les proportions de la référence sont conservées, la
  densité reste juste sur un écran de portable.
- **Mode sombre.** Même structure, mêmes proportions ; seules les surfaces changent. La bascule est
  dans « Paramètres » (clair, sombre, système) et le choix est mémorisé dans le navigateur.

## Dépendances

La règle du brief : aucune dépendance non listée sans justification écrite ici.

Imposées par le brief : `react`, `react-dom`, `vite`, `tailwindcss`, `lucide-react`, `framer-motion`,
`express`, `better-sqlite3`, `zod`, `typescript`, `vitest`.

Ajouts, et pourquoi :

| Paquet                 | Justification                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `argon2`               | Hachage argon2id des mots de passe, exigé par le brief.                              |
| `helmet`               | En-têtes de sécurité, exigés par le brief.                                           |
| `multer`               | Lecture du multipart du coffre, en mémoire ; c'est le serveur qui écrit sur disque.  |
| `cookie-parser`        | Lecture du cookie de session ; Express 5 ne lit plus les cookies seul.                |
| `dotenv`               | Chargement du `.env` décrit dans le brief.                                            |
| `react-router-dom`     | Navigation entre les huit sections sans rechargement.                                 |
| `@tailwindcss/vite`    | Greffon officiel Tailwind 4 pour Vite (remplace la chaîne postcss + autoprefixer).    |
| `@vitejs/plugin-react` | Support JSX de Vite.                                                                  |
| `tsx`                  | Exécution TypeScript en développement et pour les scripts (dev).                      |
| `concurrently`         | Lance shared, serveur et client avec un seul `npm run dev`.                            |
| `supertest`            | Tests HTTP de l'API (dev).                                                            |
| `@types/*`             | Types des paquets ci-dessus (dev).                                                    |

Pas d'ORM, pas de bibliothèque de rate limit, pas de générateur d'UUID, pas de bibliothèque de
glisser-déposer, pas de client HTTP : la limitation par IP, l'UUID v7, la détection de type par octets
de signature, le glisser-déposer (HTML5 natif) et la couche d'appel API sont écrits à la main.
