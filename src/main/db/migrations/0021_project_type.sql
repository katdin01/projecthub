-- Projects now pick a type at creation. 'enterprise' is the existing
-- template (unchanged). 'prescriptive' is a new, lighter template for
-- standardized RE NXT implementations — same tabs, but the Jira tab is
-- relabeled "Change Logs" and schedules are typically imported from a PDF
-- project plan instead of an Excel workbook.
ALTER TABLE projects ADD COLUMN project_type TEXT NOT NULL DEFAULT 'enterprise';
