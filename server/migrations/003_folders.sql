-- 003_folders : rangement du coffre en dossiers.
-- Ajout hors brief, decide explicitement apres la livraison (voir docs/IDEES.md).

CREATE TABLE folders (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  parent_id  TEXT REFERENCES folders(id) ON DELETE RESTRICT,
  position   INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_folders_parent_id ON folders(parent_id);

-- Un document vit dans un dossier, ou a la racine (folder_id NULL).
ALTER TABLE documents ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL;

CREATE INDEX idx_documents_folder_id ON documents(folder_id);
