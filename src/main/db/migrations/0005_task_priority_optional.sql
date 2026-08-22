-- Allow task priority to be left unset. SQLite has no ALTER COLUMN DROP NOT NULL,
-- so rebuild the table; triggers on the table are dropped along with it and must
-- be recreated (the tasks_fts virtual table itself is untouched).
CREATE TABLE tasks_new (
  id            INTEGER PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category_id   INTEGER REFERENCES task_categories(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open',
  priority      TEXT,
  owner         TEXT,
  due_date      TEXT,
  delivery_type TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT
);

INSERT INTO tasks_new (id, project_id, category_id, title, status, priority, owner, due_date, delivery_type, notes, created_at, updated_at, completed_at)
  SELECT id, project_id, category_id, title, status, priority, owner, due_date, delivery_type, notes, created_at, updated_at, completed_at FROM tasks;

DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;

CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_due ON tasks(due_date);

CREATE TRIGGER trg_tasks_ai AFTER INSERT ON tasks BEGIN
  INSERT INTO tasks_fts(rowid, title, notes) VALUES (new.id, new.title, new.notes);
END;
CREATE TRIGGER trg_tasks_ad AFTER DELETE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, title, notes) VALUES('delete', old.id, old.title, old.notes);
END;
CREATE TRIGGER trg_tasks_au AFTER UPDATE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, title, notes) VALUES('delete', old.id, old.title, old.notes);
  INSERT INTO tasks_fts(rowid, title, notes) VALUES (new.id, new.title, new.notes);
END;
