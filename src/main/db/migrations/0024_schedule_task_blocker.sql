-- A free-text "blocker" field on schedule items and tasks (what's blocking it),
-- complementing the existing notes field. User-entered; never set by imports.
ALTER TABLE schedule_items ADD COLUMN blocker TEXT;
ALTER TABLE tasks ADD COLUMN blocker TEXT;
