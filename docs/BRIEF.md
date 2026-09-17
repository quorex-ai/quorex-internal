# quorex-internal : dashboard interne de pilotage QUOREX

## Contexte

Outil interne pour deux personnes (Clément et Samy) qui construisent QUOREX, un moteur de mémoire pour agents IA. Il sert à piloter les jalons du produit, tenir le journal du point hebdo, et stocker les documents administratifs (contrats, devis, factures). Il tourne sur `internal.quorex.fr`, derrière un reverse proxy HTTPS, sur un VPS. Il n'a aucun lien avec le code ou les données du produit QUOREX.

Le périmètre est fermé. Tu construis exactement ce qui est listé, rien de plus. Si tu penses qu'une fonctionnalité manque, tu la notes dans `docs/IDEES.md` et tu ne la construis pas.

## Stack imposée

- Frontend : React 18 + TypeScript, Vite, Tailwind CSS, lucide-react pour les icônes, framer-motion pour les transitions (sobres : fondu, glissement court, rien qui distrait).
- Backend : Node 20, Express, TypeScript, SQLite via `better-sqlite3`, migrations SQL versionnées dans `server/migrations/` appliquées au démarrage.
- Monorepo : `client/`, `server/`, `docs/`. Un seul `npm run dev` lance les deux, un seul `npm run build` produit `server/dist/` qui sert le front compilé et l'API sur le même port.
- Validation des entrées : `zod`, partagé entre client et serveur dans `shared/`.
- Pas d'ORM, pas de Prisma. SQL écrit à la main, lisible.
- Pas de dépendance non listée sans justification écrite dans le README.

## Référence de design

La référence est la capture `design-ref.png` placée à la racine du dépôt. Reproduis-la fidèlement : même structure, mêmes proportions, même densité, même style de composants. Ce n'est pas une inspiration, c'est le cahier des charges visuel. Voici sa description précise, à respecter même sans regarder l'image.

### Structure de page

- Fond de page gris très clair (`#F6F7F9`). L'application entière est une grande carte blanche à coins arrondis (16 px) avec une marge de 16 px autour, sur ce fond gris.
- Sidebar fixe à gauche, 310 px, fond blanc, séparée du contenu par une bordure fine (`#ECEEF2`).
- En haut du contenu : une barre de 100 px de haut avec une barre de recherche à gauche (champ arrondi en pilule, fond `#F3F4F6`, icône loupe, placeholder « Rechercher ou taper une commande », raccourci `⌘ K` affiché dans un badge blanc à droite du champ), et à droite un bouton d'action principal bleu, une icône cloche avec un point de notification, un avatar rond.
- Sous la barre : date du jour en gris moyen (18 px), puis un grand titre d'accueil en 44 px demi-gras (« Bonsoir Clément, » selon l'heure), et à droite du titre deux boutons blancs bordés à coins arrondis.
- Puis une rangée de statistiques dans une pilule blanche bordée : trois indicateurs séparés par des barres verticales fines, chacun avec une icône fine, un chiffre en gras 24 px, et un libellé en gris. Pour nous : jalons fermés / total, tâches en cours, jours avant le prochain jalon.
- Puis le contenu en cartes blanches bordées (`1px #E5E7EB`), coins arrondis 16 px, ombre nulle ou quasi nulle. Une carte pleine largeur en haut, puis deux cartes côte à côte en dessous (ratio 55 / 45).

### Sidebar

- Logo texte en haut à gauche, police serif (Georgia ou une serif Google Fonts proche de la référence, type Instrument Serif), 32 px : « quorex » en minuscules, puis « internal » en gris petit dessous.
- Navigation : items de 52 px de haut, icône lucide 20 px à gauche, libellé 17 px, coins arrondis 12 px. Item actif : fond bleu (`#3B6EF6`), texte et icône blancs. Items inactifs : texte gris foncé (`#374151`), survol fond gris très clair.
- Séparateur fin, puis une section « Jalons » avec un titre et un bouton « + » à droite, et sous ce titre la liste des jalons en cours, chacun avec un petit carré de couleur pastel arrondi (8 px) à gauche du nom. Cette couleur est propre à chaque jalon et réutilisée partout où le jalon apparaît (barre latérale des lignes de planning, pastilles).
- Tout en bas : « Paramètres » et « Aide » avec icônes, le second avec un badge vert clair à droite.

### Composants

- Cartes : en-tête avec icône lucide fine 22 px, titre 22 px demi-gras, un sélecteur en pilule bordée à droite du titre le cas échéant (« Cette semaine ▾ »), et un bouton gris clair arrondi tout à droite (« Tout voir »).
- Tableaux : en-tête de colonnes sur fond `#F9FAFB` avec icône fine + libellé, séparateurs de colonnes verticaux fins, lignes de 64 px, bordures horizontales fines. Première colonne : icône de la tâche en gris + nom, puis de petits compteurs gris avec icônes (commentaires, liens) alignés à droite de la cellule. Colonne assigné : avatar rond 28 px + nom. Colonne statut : pilule.
- Pilules de statut : coins totalement arrondis, texte 15 px, fond pastel, texte foncé de la même teinte. Vert clair `#C8F3C2` / texte `#1B5E20` pour « En cours », rose clair `#F5C6EC` / texte `#7A1F5C` pour « À faire », bleu clair `#BFD4FF` / texte `#1E3A8A` pour « Terminé », gris clair pour « En revue ». Le texte porte toujours le statut, la couleur ne fait que l'appuyer.
- Bouton principal : bleu `#3B6EF6`, texte blanc, coins arrondis 10 px, icône « + » à gauche, avec un second segment à droite pour un menu déroulant (bordure blanche semi-transparente entre les deux).
- Boutons secondaires : fond blanc, bordure `#E5E7EB`, texte gris foncé, icône à gauche, coins arrondis 10 px.
- Planning hebdo (carte « Hebdo » ou frise) : une ligne de sept jours avec initiale du jour sur le numéro, le jour courant dans un carré rose pastel arrondi ; en dessous des lignes d'éléments avec une barre verticale colorée à gauche (couleur du jalon), icône, titre 17 px, sous-titre gris 14 px, et à droite des avatars empilés puis un bouton « ⋯ ».
- Listes de notes (compte rendu hebdo, critères d'acceptation) : cercle de coche à gauche (vide, ou plein rose avec coche blanche quand fait), titre 17 px demi-gras barré quand fait, texte secondaire gris 15 px sur deux lignes max, séparateurs en pointillés fins entre les éléments.
- Avatars : ronds, 28 à 32 px, bordure blanche 2 px quand empilés. Deux utilisateurs seulement : initiales sur fond de couleur si pas d'image.

### Typographie et espacement

- Police de l'interface : Inter (Google Fonts), fallback système. Poids 400 pour le texte, 500 pour les libellés, 600 pour les titres.
- Tailles : 44 px titre d'accueil, 22 px titres de carte, 17 px texte principal, 15 px secondaire, 14 px légendes.
- Espacements généreux : 32 px de marge intérieure des cartes, 24 px entre les cartes, 16 px entre les éléments d'une liste.
- Couleur texte principal `#111827`, secondaire `#6B7280`.

### Ce que tu adaptes sans changer le style

La référence est un outil générique. Tu appliques exactement ce langage visuel aux huit sections de quorex-internal : le tableau d'accueil montre les tâches en cours au lieu des « projets », la carte « Planning » devient la vue hebdo avec le journal automatique, la carte « Notes » devient les critères d'acceptation du jalon en cours. Le kanban, la frise, le coffre et le journal reprennent les mêmes cartes, pilules, boutons et tableaux. Rien d'autre n'est inventé.

Mode sombre : même structure, fond de page `#0F1115`, carte d'application `#15181E`, cartes `#1B1F27`, bordures `#2A2F3A`, texte `#E5E7EB`, pilules pastel assombries avec texte clair. Bascule dans « Paramètres », mémorisée.

## Authentification

- Deux comptes, créés par un script `npm run seed:users` qui demande login et mot de passe en ligne de commande. Pas de page d'inscription, pas de "mot de passe oublié".
- Mots de passe hachés avec argon2id.
- Session en cookie `httpOnly`, `secure`, `sameSite=strict`, stockée en SQLite, expirée à 30 jours glissants.
- Rate limit sur `/api/auth/login` : 5 tentatives par 15 minutes par IP.
- Toute route `/api/*` hors login exige une session valide. Le front redirige vers `/login` sur 401.

## Modèle de données

Toutes les tables ont `id` (UUID v7, généré côté serveur), `created_at`, `updated_at`.

- `users` : login, password_hash, display_name.
- `milestones` : title, description, target_date, status (`upcoming`, `in_progress`, `closed`), position (ordre).
- `acceptance_criteria` : milestone_id, label, checked (bool), checked_at, checked_by.
- `tasks` : milestone_id (obligatoire, non null), title, assignee_id (nullable), status (`todo`, `in_progress`, `review`, `done`), external_url (lien PR ou issue, nullable), position.
- `journal` : entity_type (`milestone`, `task`, `criterion`, `document`), entity_id, field, old_value, new_value, actor_id, at. Rempli automatiquement par le serveur à chaque mutation, jamais par le client.
- `weekly_reports` : week_start (lundi, unique), closed_text, in_progress_text, blocked_text, author_id.
- `links` : label, url, position.
- `documents` : title, type (`contract`, `quote`, `invoice`, `admin`, `other`), parties (texte), doc_date, tags (JSON array), milestone_id (nullable), original_filename, stored_filename (UUID + extension), mime_type, size_bytes, uploaded_by.

Règle métier unique, appliquée côté serveur et reflétée côté client : un jalon ne peut passer à `closed` que si tous ses critères d'acceptation sont cochés. Sinon 409 avec la liste des critères manquants.

## Données initiales

Un script `npm run seed:milestones` crée les sept jalons suivants, dans cet ordre, statut `upcoming`, sans date :

1. Stockage et modèle de données (schéma, migrations, FactStore Postgres, isolation par tenant)
2. remember structuré et contradiction niveau (a)
3. recall avec as_of, et diff
4. Démo enregistrée (fait remplacé, time travel, diff, en deux minutes)
5. Embeddings et contradiction niveau (b), mesure des seuils
6. Extraction LLM et niveau (c)
7. API complète avec grille d'erreurs, README, exemples curl

Le script est idempotent.

## Les huit sections

1. **Tableau de bord** (page d'accueil) : les jalons en colonnes ou en liste selon la largeur, chaque jalon avec sa date cible, son statut, le compte de critères cochés sur total, et ses tâches en cours. Ce qui est en retard (date cible dépassée et statut non fermé) est signalé.
2. **Jalons** : liste, fiche jalon avec description, date, statut, critères d'acceptation cochables, tâches liées. Création, édition, réordonnancement par glisser-déposer. Passage à `closed` bloqué tant qu'un critère n'est pas coché, avec message explicite.
3. **Tâches** : vue kanban à quatre colonnes par statut, filtre par jalon et par assigné. Glisser-déposer entre colonnes. Création rapide en une ligne (titre + jalon). Lien externe cliquable s'il existe.
4. **Journal** : liste chronologique inversée de toutes les mutations, filtrable par entité et par personne, avec pagination. Lecture seule.
5. **Hebdo** : une page par semaine (lundi à dimanche). En haut, généré automatiquement depuis le journal : jalons fermés, tâches fermées, tâches passées en cours, dates modifiées, éléments en retard. En dessous, le compte rendu saisi à la main en trois champs : fermé, en cours, bloqué. Navigation semaine précédente / suivante. Une semaine sans compte rendu affiche un formulaire vide.
6. **Frise** : les jalons sur un axe horizontal avec leur date cible, un marqueur "aujourd'hui", les jalons en retard marqués. Pas de Gantt, pas de dépendances, une seule ligne.
7. **Liens** : liste de liens éditables et réordonnables. Préchargés : dépôt quorex, docs/architecture.md, tableau de prospection, drive (URLs vides à remplir).
8. **Coffre** : liste des documents filtrable par type, date, tag, jalon, avec recherche sur titre, parties et tags. Upload par glisser-déposer ou bouton (PDF, docx, xlsx, png, jpg ; 25 Mo max), formulaire de métadonnées, téléchargement, suppression avec confirmation. Pas d'aperçu intégré : le fichier s'ouvre dans un nouvel onglet ou se télécharge.

## Coffre : contraintes de sécurité, non négociables

- Les fichiers sont écrits dans un dossier hors du dépôt et hors de la racine web, chemin lu depuis `DOCUMENTS_DIR` en variable d'environnement. Le dossier est créé au démarrage avec permissions 700 si absent.
- Nom de fichier sur disque : UUID v7 + extension normalisée en minuscules. Le nom d'origine ne touche jamais le disque.
- Le type MIME est vérifié côté serveur sur le contenu (magic bytes), pas sur l'extension ni sur l'en-tête envoyé par le client.
- Téléchargement uniquement via `/api/documents/:id/download` avec session valide, en-tête `Content-Disposition` avec le nom d'origine nettoyé, jamais par une URL directe vers le fichier.
- Aucune route ne liste le contenu de `DOCUMENTS_DIR`.
- La suppression supprime la ligne et le fichier, dans cet ordre, et le note dans le journal.

## Sauvegarde

Un script `npm run backup` qui produit une archive tar.gz horodatée contenant la base SQLite (copie via l'API de backup de SQLite, pas un `cp` à chaud) et le dossier `DOCUMENTS_DIR`, dans un dossier `BACKUP_DIR`. Un exemple de ligne cron quotidienne dans le README, avec la commande de restauration testée.

## Déploiement

- `.env.example` avec toutes les variables, valeurs vides : `PORT`, `DATABASE_PATH`, `DOCUMENTS_DIR`, `BACKUP_DIR`, `SESSION_SECRET`, `NODE_ENV`.
- Un fichier `deploy/quorex-internal.service` pour systemd, et un exemple de bloc Caddy ou nginx pour `internal.quorex.fr` en HTTPS.
- `robots.txt` qui interdit tout. En-têtes de sécurité via `helmet`.
- Le serveur refuse de démarrer si `SESSION_SECRET` est vide ou fait moins de 32 caractères.

## Qualité

- TypeScript strict des deux côtés, zéro `any`.
- Tests côté serveur avec `vitest` sur : la règle de fermeture des jalons, l'écriture du journal sur chaque mutation, l'auth (login, rate limit, 401), la vérification MIME du coffre, l'impossibilité d'accéder à un fichier sans session.
- Gestion d'erreurs uniforme : toute erreur API renvoie `{ error: { code, message, details? } }`. Le client affiche le message, jamais une stack.
- Un `README.md` qui permet d'installer, seed, lancer, déployer et restaurer en suivant les commandes sans réfléchir.

## Ordre de construction

Tu livres dans cet ordre, et à chaque étape l'application démarre et est utilisable pour ce qui est fait. Tu t'arrêtes après chaque étape et tu attends validation.

1. Squelette monorepo, migrations, auth complète, sidebar avec les huit sections vides, déploiement (`.env.example`, service systemd, build unique). Vérifie que `npm run build && node server/dist/index.js` sert le front et répond sur `/api/health`.
2. Jalons avec critères d'acceptation et règle de fermeture, seed des sept jalons, journal automatique. Tableau de bord.
3. Tâches avec kanban et glisser-déposer.
4. Coffre complet avec toutes les contraintes de sécurité et le script de sauvegarde.
5. Hebdo (partie automatique puis compte rendu), Journal, Frise, Liens.
6. Tests, README, passe de polish visuel selon la référence de design, mode sombre.

Commence par l'étape 1.
