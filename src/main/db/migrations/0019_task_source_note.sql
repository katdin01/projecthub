-- Tracks which note (if any) a task was generated from, so the task can
-- link back to it. ON DELETE SET NULL since notes are only ever soft-archived
-- in the app, but this keeps the column safe if a note row is ever removed.
ALTER TABLE tasks ADD COLUMN source_note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL;
