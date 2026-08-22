-- Jira: structured source-system fields for data-mapping tickets, plus a running comment log.
ALTER TABLE jira_items ADD COLUMN source_table TEXT;
ALTER TABLE jira_items ADD COLUMN source_field TEXT;

CREATE TABLE jira_comments (
  id            INTEGER PRIMARY KEY,
  jira_item_id  INTEGER NOT NULL REFERENCES jira_items(id) ON DELETE CASCADE,
  comment_text  TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_jira_comments_item ON jira_comments(jira_item_id);

-- Schedule: a manual "watch" flag. Overdue, non-watched items are treated as
-- done wherever due-date status is displayed (computed live, not stored).
ALTER TABLE schedule_items ADD COLUMN watched INTEGER NOT NULL DEFAULT 0;
