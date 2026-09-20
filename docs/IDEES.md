# Idées mises de côté

Le périmètre de `docs/BRIEF.md` est fermé. Ce fichier note ce qui a été envisagé pendant la
construction et volontairement **non** construit. Rien d'ici n'est développé sans décision explicite.

## Construit hors brief, sur décision explicite

Ces trois points sortent du périmètre fermé du brief et ont été construits après validation orale :

- **Dossiers du coffre** (migration `003_folders.sql`, table `folders`, colonne `documents.folder_id`).
- **Édition des métadonnées d'un document** après dépôt, et **édition d'une tâche** (titre, lien,
  jalon) depuis le kanban.
- **Recherche ⌘K** et **enregistrement automatique** avec retour visuel.

## Écarts assumés au brief

- **Node 22 au lieu de Node 20.** Le brief impose Node 20, mais `better-sqlite3` exige Node 22
  depuis sa version 13, et Node 20 est sorti de maintenance au printemps 2026. Garder Node 20
  aurait demandé de figer la bibliothèque en 12.x sur un serveur exposé. `engines` et
  `engine-strict` verrouillent maintenant la contrainte.

## Interface

- **Notifications.** La cloche et sa pastille viennent de la référence de design. Aucune source
  d'événements n'est prévue au brief ; le bouton est inerte.
- **Bouton « Nouveau » de la barre haute.** Il faudrait choisir ce qu'il crée et depuis quelle page ;
  chaque section a déjà son bouton de création. Laissé inerte.
- **Dépôt de plusieurs fichiers d'un coup.** Le formulaire de métadonnées est par document ; un dépôt
  groupé demanderait de décider ce qui est commun et ce qui ne l'est pas.
- **Journalisation des dossiers.** Le type d'entité `folder` n'existe pas dans le journal du brief.
  Le déplacement d'un document, lui, est bien tracé.

## Données

- **Suppression d'un jalon.** Le brief prévoit création, édition et réordonnancement, pas la
  suppression. La contrainte SQL est posée en `RESTRICT` : un jalon portant des tâches ne pourra pas
  être supprimé sans décision sur le sort de ses tâches.
- **Historique des comptes rendus hebdo dans le journal.** Le journal du brief ne connaît que jalons,
  tâches, critères et documents ; les comptes rendus hebdomadaires n'y laissent donc pas de trace.
- **Restauration d'un document supprimé.** La suppression efface la ligne et le fichier. Une corbeille
  demanderait une durée de rétention et un nettoyage, hors périmètre.

## Exploitation

- **Rotation des archives de sauvegarde.** `npm run backup` écrit une archive horodatée et n'efface
  rien. La purge des vieilles archives reste à la main de la ligne cron.
- **Supervision au-delà de `/api/health`.** Pas de métriques, pas d'alerte : un seul processus et deux
  utilisateurs.
