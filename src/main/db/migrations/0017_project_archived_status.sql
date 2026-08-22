-- Archiving now also sets status='archived' (so archived projects are
-- visually distinguishable and sortable in "show archived" views, not just
-- hidden by archived_at). status_before_archive remembers what the status
-- was so unarchiving can restore it instead of guessing.
ALTER TABLE projects ADD COLUMN status_before_archive TEXT;

-- Backfill: projects archived before this migration existed still have their
-- old (pre-archive) status — bring them in line with the new behavior.
UPDATE projects
SET status_before_archive = status, status = 'archived'
WHERE archived_at IS NOT NULL AND status != 'archived';
