-- Health status removed. project_name is now derived server-side from
-- site_id + client_name rather than entered manually (see projects.ts),
-- so the column stays but is no longer user-editable.
ALTER TABLE projects DROP COLUMN health;
