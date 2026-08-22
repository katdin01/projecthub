-- Per-project config for automatic Jira Cloud sync via JQL (in addition to
-- the existing manual CSV export import, which is unaffected).
ALTER TABLE projects ADD COLUMN jira_jql TEXT;
ALTER TABLE projects ADD COLUMN jira_auto_sync INTEGER NOT NULL DEFAULT 1;
ALTER TABLE projects ADD COLUMN jira_last_synced_at TEXT;
ALTER TABLE projects ADD COLUMN jira_last_sync_error TEXT;
