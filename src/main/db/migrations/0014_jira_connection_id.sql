-- Each client typically runs its own separate Jira Cloud site, so a project
-- now picks which named connection (stored outside SQLite — see
-- src/main/jira/credentials.ts) it auto-syncs against.
ALTER TABLE projects ADD COLUMN jira_connection_id TEXT;
