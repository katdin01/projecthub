-- Jira "Fix Version/s" and "Affects Version/s", stored as comma-separated
-- version names. Read from Jira via API sync and writable back to the ticket.
ALTER TABLE jira_items ADD COLUMN fix_versions TEXT;
ALTER TABLE jira_items ADD COLUMN affects_versions TEXT;
