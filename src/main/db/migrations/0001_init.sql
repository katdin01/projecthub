-- ===================== CORE: PROJECTS =====================
CREATE TABLE projects (
  id              INTEGER PRIMARY KEY,
  client_name     TEXT NOT NULL,
  site_id         TEXT,
  project_name    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  phase           TEXT,
  start_date      TEXT,
  target_go_live  TEXT,
  hours_budgeted  REAL NOT NULL DEFAULT 0,
  hours_consumed  REAL NOT NULL DEFAULT 0,
  health          TEXT NOT NULL DEFAULT 'green',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at     TEXT
);

CREATE TABLE project_people (
  id          INTEGER PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  name        TEXT NOT NULL,
  email       TEXT,
  notes       TEXT
);
CREATE INDEX idx_project_people_project ON project_people(project_id);

-- ===================== SCHEDULE / MILESTONES =====================
CREATE TABLE excel_imports (
  id            INTEGER PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path     TEXT NOT NULL,
  column_map    TEXT NOT NULL,
  imported_at   TEXT NOT NULL DEFAULT (datetime('now')),
  row_count     INTEGER
);

CREATE TABLE schedule_items (
  id              INTEGER PRIMARY KEY,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  item_type       TEXT NOT NULL DEFAULT 'task',
  due_date        TEXT,
  status          TEXT NOT NULL DEFAULT 'not_started',
  source          TEXT NOT NULL DEFAULT 'manual',
  import_batch_id INTEGER REFERENCES excel_imports(id),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_schedule_items_project ON schedule_items(project_id);
CREATE INDEX idx_schedule_items_due ON schedule_items(due_date);

-- ===================== DOCUMENT REFERENCES =====================
CREATE TABLE doc_references (
  id            INTEGER PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  label         TEXT NOT NULL,
  path          TEXT NOT NULL,
  is_folder     INTEGER NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_doc_references_project ON doc_references(project_id);

-- ===================== DAILY ACTIVITY LOG =====================
CREATE TABLE daily_logs (
  id              INTEGER PRIMARY KEY,
  project_id      INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  log_date        TEXT NOT NULL,
  work_completed  TEXT,
  hours_spent     REAL NOT NULL DEFAULT 0,
  notes           TEXT,
  decisions_made  TEXT,
  open_questions  TEXT,
  next_steps      TEXT,
  risks           TEXT,
  blockers        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_daily_logs_date ON daily_logs(log_date);
CREATE INDEX idx_daily_logs_project ON daily_logs(project_id);

-- keep projects.hours_consumed in sync with the sum of daily_logs.hours_spent
CREATE TRIGGER trg_daily_logs_ai AFTER INSERT ON daily_logs WHEN NEW.project_id IS NOT NULL
BEGIN
  UPDATE projects SET hours_consumed = (
    SELECT COALESCE(SUM(hours_spent), 0) FROM daily_logs WHERE project_id = NEW.project_id
  ) WHERE id = NEW.project_id;
END;

CREATE TRIGGER trg_daily_logs_au AFTER UPDATE ON daily_logs
BEGIN
  UPDATE projects SET hours_consumed = (
    SELECT COALESCE(SUM(hours_spent), 0) FROM daily_logs WHERE project_id = OLD.project_id
  ) WHERE id = OLD.project_id AND OLD.project_id IS NOT NULL;
  UPDATE projects SET hours_consumed = (
    SELECT COALESCE(SUM(hours_spent), 0) FROM daily_logs WHERE project_id = NEW.project_id
  ) WHERE id = NEW.project_id AND NEW.project_id IS NOT NULL;
END;

CREATE TRIGGER trg_daily_logs_ad AFTER DELETE ON daily_logs WHEN OLD.project_id IS NOT NULL
BEGIN
  UPDATE projects SET hours_consumed = (
    SELECT COALESCE(SUM(hours_spent), 0) FROM daily_logs WHERE project_id = OLD.project_id
  ) WHERE id = OLD.project_id;
END;

-- ===================== TASKS / CHECKLISTS =====================
CREATE TABLE task_categories (
  id          INTEGER PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_task_categories_project ON task_categories(project_id);

CREATE TABLE tasks (
  id            INTEGER PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category_id   INTEGER REFERENCES task_categories(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'open',
  priority      TEXT NOT NULL DEFAULT 'medium',
  owner         TEXT,
  due_date      TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT
);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_due ON tasks(due_date);

CREATE VIRTUAL TABLE tasks_fts USING fts5(title, notes, content='tasks', content_rowid='id');
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

-- ===================== JIRA (MANUAL TRACKING) =====================
CREATE TABLE jira_items (
  id                  INTEGER PRIMARY KEY,
  project_id          INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  jira_url            TEXT,
  issue_id            TEXT NOT NULL,
  issue_name          TEXT NOT NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'open',
  priority            TEXT NOT NULL DEFAULT 'medium',
  assignee            TEXT,
  internal_notes      TEXT,
  technical_notes     TEXT,
  questions           TEXT,
  decisions           TEXT,
  dependencies        TEXT,
  blockers            TEXT,
  resolution_details  TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_jira_issue_id ON jira_items(project_id, issue_id);

CREATE TABLE jira_links (
  id            INTEGER PRIMARY KEY,
  jira_item_id  INTEGER NOT NULL REFERENCES jira_items(id) ON DELETE CASCADE,
  linked_type   TEXT NOT NULL,
  linked_id     INTEGER NOT NULL
);
CREATE INDEX idx_jira_links_item ON jira_links(jira_item_id);

CREATE VIRTUAL TABLE jira_fts USING fts5(
  issue_id, issue_name, description, internal_notes, technical_notes, questions,
  content='jira_items', content_rowid='id'
);
CREATE TRIGGER trg_jira_ai AFTER INSERT ON jira_items BEGIN
  INSERT INTO jira_fts(rowid, issue_id, issue_name, description, internal_notes, technical_notes, questions)
  VALUES (new.id, new.issue_id, new.issue_name, new.description, new.internal_notes, new.technical_notes, new.questions);
END;
CREATE TRIGGER trg_jira_ad AFTER DELETE ON jira_items BEGIN
  INSERT INTO jira_fts(jira_fts, rowid, issue_id, issue_name, description, internal_notes, technical_notes, questions)
  VALUES('delete', old.id, old.issue_id, old.issue_name, old.description, old.internal_notes, old.technical_notes, old.questions);
END;
CREATE TRIGGER trg_jira_au AFTER UPDATE ON jira_items BEGIN
  INSERT INTO jira_fts(jira_fts, rowid, issue_id, issue_name, description, internal_notes, technical_notes, questions)
  VALUES('delete', old.id, old.issue_id, old.issue_name, old.description, old.internal_notes, old.technical_notes, old.questions);
  INSERT INTO jira_fts(rowid, issue_id, issue_name, description, internal_notes, technical_notes, questions)
  VALUES (new.id, new.issue_id, new.issue_name, new.description, new.internal_notes, new.technical_notes, new.questions);
END;

-- ===================== NOTES (rich text) =====================
CREATE TABLE notes (
  id            INTEGER PRIMARY KEY,
  project_id    INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  note_type     TEXT NOT NULL DEFAULT 'general',
  title         TEXT NOT NULL,
  content_json  TEXT NOT NULL,
  content_text  TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at   TEXT
);
CREATE INDEX idx_notes_project ON notes(project_id);

CREATE TABLE tags (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE note_tags (
  note_id  INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

CREATE VIRTUAL TABLE notes_fts USING fts5(title, content_text, content='notes', content_rowid='id');
CREATE TRIGGER trg_notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, content_text) VALUES (new.id, new.title, new.content_text);
END;
CREATE TRIGGER trg_notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content_text) VALUES('delete', old.id, old.title, old.content_text);
END;
CREATE TRIGGER trg_notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content_text) VALUES('delete', old.id, old.title, old.content_text);
  INSERT INTO notes_fts(rowid, title, content_text) VALUES (new.id, new.title, new.content_text);
END;

CREATE VIRTUAL TABLE daily_logs_fts USING fts5(
  work_completed, notes, decisions_made, open_questions, blockers,
  content='daily_logs', content_rowid='id'
);
CREATE TRIGGER trg_daily_logs_fts_ai AFTER INSERT ON daily_logs BEGIN
  INSERT INTO daily_logs_fts(rowid, work_completed, notes, decisions_made, open_questions, blockers)
  VALUES (new.id, new.work_completed, new.notes, new.decisions_made, new.open_questions, new.blockers);
END;
CREATE TRIGGER trg_daily_logs_fts_ad AFTER DELETE ON daily_logs BEGIN
  INSERT INTO daily_logs_fts(daily_logs_fts, rowid, work_completed, notes, decisions_made, open_questions, blockers)
  VALUES('delete', old.id, old.work_completed, old.notes, old.decisions_made, old.open_questions, old.blockers);
END;
CREATE TRIGGER trg_daily_logs_fts_au AFTER UPDATE ON daily_logs BEGIN
  INSERT INTO daily_logs_fts(daily_logs_fts, rowid, work_completed, notes, decisions_made, open_questions, blockers)
  VALUES('delete', old.id, old.work_completed, old.notes, old.decisions_made, old.open_questions, old.blockers);
  INSERT INTO daily_logs_fts(rowid, work_completed, notes, decisions_made, open_questions, blockers)
  VALUES (new.id, new.work_completed, new.notes, new.decisions_made, new.open_questions, new.blockers);
END;

-- ===================== SETTINGS =====================
CREATE TABLE app_settings (
  key    TEXT PRIMARY KEY,
  value  TEXT
);
