-- Project Manager / Business Consultant become fixed fields on the project
-- itself rather than entries in the team list (each project has exactly one
-- of each, so a list was more structure than needed).
ALTER TABLE projects ADD COLUMN pm_name TEXT;
ALTER TABLE projects ADD COLUMN business_consultant_name TEXT;

UPDATE projects SET pm_name = (
  SELECT name FROM project_people
  WHERE project_people.project_id = projects.id AND team = 'internal' AND role = 'project_manager'
  ORDER BY id DESC LIMIT 1
);
UPDATE projects SET business_consultant_name = (
  SELECT name FROM project_people
  WHERE project_people.project_id = projects.id AND team = 'internal' AND role = 'business_consultant'
  ORDER BY id DESC LIMIT 1
);
DELETE FROM project_people WHERE team = 'internal';

CREATE TABLE project_skus (
  id          INTEGER PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sku         TEXT NOT NULL,
  hours       REAL,
  notes       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_project_skus_project ON project_skus(project_id);
