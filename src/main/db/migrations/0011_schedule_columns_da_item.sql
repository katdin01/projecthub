-- Retain the full source plan (minus Duration, which carries no value here)
-- so the Schedule tab can show and sort/filter on it, and mark rows the
-- user flagged via their own "KD Notes" annotation column as DA Items.
ALTER TABLE schedule_items ADD COLUMN start_date TEXT;
ALTER TABLE schedule_items ADD COLUMN pct_complete INTEGER;
ALTER TABLE schedule_items ADD COLUMN predecessors TEXT;
ALTER TABLE schedule_items ADD COLUMN resource_names TEXT;
ALTER TABLE schedule_items ADD COLUMN notes TEXT;
ALTER TABLE schedule_items ADD COLUMN is_da_item INTEGER NOT NULL DEFAULT 0;
