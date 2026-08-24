-- Non-project (global) to-do items shown on the main dashboard, with due dates
-- and notes. Separate from project tasks (which require a project_id).
CREATE TABLE IF NOT EXISTS general_tasks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open',
  due_date     TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
