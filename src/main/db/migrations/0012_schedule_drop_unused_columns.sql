-- Type (milestone/task), % Complete, and Predecessors carry no value for this
-- user's workflow. Notes-from-Excel is dropped too — schedule notes are now
-- a manually-editable field instead of an imported one.
ALTER TABLE schedule_items DROP COLUMN item_type;
ALTER TABLE schedule_items DROP COLUMN pct_complete;
ALTER TABLE schedule_items DROP COLUMN predecessors;
