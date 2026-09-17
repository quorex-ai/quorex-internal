-- 001_init : schema complet de quorex-internal.
-- Toutes les tables ont id (UUID v7 genere par le serveur), created_at, updated_at (ISO-8601 UTC).

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  login         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Le cookie porte un jeton aleatoire ; la base ne stocke que son HMAC-SHA256.
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE milestones (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  target_date TEXT,
  status      TEXT NOT NULL CHECK (status IN ('upcoming', 'in_progress', 'closed')),
  position    INTEGER NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX idx_milestones_position ON milestones(position);

CREATE TABLE acceptance_criteria (
  id           TEXT PRIMARY KEY,
  milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  checked      INTEGER NOT NULL DEFAULT 0 CHECK (checked IN (0, 1)),
  checked_at   TEXT,
  checked_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX idx_acceptance_criteria_milestone_id ON acceptance_criteria(milestone_id);

CREATE TABLE tasks (
  id           TEXT PRIMARY KEY,
  milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE RESTRICT,
  title        TEXT NOT NULL,
  assignee_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  status       TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  external_url TEXT,
  position     INTEGER NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX idx_tasks_milestone_id ON tasks(milestone_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);

-- Rempli uniquement par le serveur, a chaque mutation. Jamais ecrit par le client.
CREATE TABLE journal (
  id          TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('milestone', 'task', 'criterion', 'document')),
  entity_id   TEXT NOT NULL,
  field       TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  actor_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  at          TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX idx_journal_at ON journal(at DESC);
CREATE INDEX idx_journal_entity ON journal(entity_type, entity_id);
CREATE INDEX idx_journal_actor_id ON journal(actor_id);

CREATE TABLE weekly_reports (
  id               TEXT PRIMARY KEY,
  week_start       TEXT NOT NULL UNIQUE,
  closed_text      TEXT NOT NULL DEFAULT '',
  in_progress_text TEXT NOT NULL DEFAULT '',
  blocked_text     TEXT NOT NULL DEFAULT '',
  author_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE links (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  url        TEXT NOT NULL DEFAULT '',
  position   INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_links_position ON links(position);

CREATE TABLE documents (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('contract', 'quote', 'invoice', 'admin', 'other')),
  parties           TEXT NOT NULL DEFAULT '',
  doc_date          TEXT,
  tags              TEXT NOT NULL DEFAULT '[]',
  milestone_id      TEXT REFERENCES milestones(id) ON DELETE SET NULL,
  original_filename TEXT NOT NULL,
  stored_filename   TEXT NOT NULL UNIQUE,
  mime_type         TEXT NOT NULL,
  size_bytes        INTEGER NOT NULL,
  uploaded_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE INDEX idx_documents_type ON documents(type);
CREATE INDEX idx_documents_doc_date ON documents(doc_date);
CREATE INDEX idx_documents_milestone_id ON documents(milestone_id);
