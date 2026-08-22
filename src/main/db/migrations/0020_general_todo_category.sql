-- New projects now get a "General To-Do" task category by default alongside
-- Data Conversion and Client Follow-up. Backfill it for existing projects
-- that don't already have one (e.g. if the user happened to create one by hand).
INSERT INTO task_categories (project_id, name, sort_order)
SELECT p.id, 'General To-Do',
  COALESCE((SELECT MAX(sort_order) + 1 FROM task_categories tc WHERE tc.project_id = p.id), 0)
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM task_categories tc WHERE tc.project_id = p.id AND tc.name = 'General To-Do'
);
