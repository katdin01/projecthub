-- Conversion mapping metadata on a Jira ticket: the target (destination) table
-- and field to complement the existing source_table/source_field, plus a free
-- SQL/code field (for the ticket's conversion logic, MSSQL-formattable in the UI).
-- All are ProjectHub-local — never synced to or written back to Jira.
ALTER TABLE jira_items ADD COLUMN target_table TEXT;
ALTER TABLE jira_items ADD COLUMN target_field TEXT;
ALTER TABLE jira_items ADD COLUMN sql_code TEXT;
