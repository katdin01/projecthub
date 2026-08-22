-- Splits the old normalized status bucket into two fields that match the
-- real workflow: external_status mirrors Jira's raw ticket status text as-is
-- (whatever Jira literally shows — no more collapsing to a fixed
-- open/in_progress/blocked/resolved vocabulary), and internal_status is a
-- new, manually-set marker for this team's own review process — never
-- touched by CSV import or API sync, same as internal_notes etc.
ALTER TABLE jira_items ADD COLUMN external_status TEXT;
UPDATE jira_items SET external_status = status;
ALTER TABLE jira_items DROP COLUMN status;
ALTER TABLE jira_items ADD COLUMN internal_status TEXT NOT NULL DEFAULT 'Open';
