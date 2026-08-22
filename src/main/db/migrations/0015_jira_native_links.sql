-- Replaces the manual "link this ticket to a ProjectHub task/note" feature
-- with Jira's own linked-issue data (blocks/relates to/etc.), which comes
-- through automatically via API sync — nothing left to maintain by hand.
DROP TABLE jira_links;

-- JSON array of { key, summary, status, linkType, url }, fully Jira-sourced —
-- only ever set by API sync, never hand-edited, so a JSON column (like
-- excel_imports.column_map) is simpler here than a join table.
ALTER TABLE jira_items ADD COLUMN linked_issues TEXT;
