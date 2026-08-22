-- projects.hours_budgeted is now derived from the sum of its SKUs' hours,
-- the same way hours_consumed is derived from daily_logs.
CREATE TRIGGER trg_project_skus_ai AFTER INSERT ON project_skus
BEGIN
  UPDATE projects SET hours_budgeted = (
    SELECT COALESCE(SUM(hours), 0) FROM project_skus WHERE project_id = NEW.project_id
  ) WHERE id = NEW.project_id;
END;

CREATE TRIGGER trg_project_skus_au AFTER UPDATE ON project_skus
BEGIN
  UPDATE projects SET hours_budgeted = (
    SELECT COALESCE(SUM(hours), 0) FROM project_skus WHERE project_id = OLD.project_id
  ) WHERE id = OLD.project_id;
  UPDATE projects SET hours_budgeted = (
    SELECT COALESCE(SUM(hours), 0) FROM project_skus WHERE project_id = NEW.project_id
  ) WHERE id = NEW.project_id;
END;

CREATE TRIGGER trg_project_skus_ad AFTER DELETE ON project_skus
BEGIN
  UPDATE projects SET hours_budgeted = (
    SELECT COALESCE(SUM(hours), 0) FROM project_skus WHERE project_id = OLD.project_id
  ) WHERE id = OLD.project_id;
END;

-- Backfill for any SKUs that already exist.
UPDATE projects SET hours_budgeted = (
  SELECT COALESCE(SUM(hours), 0) FROM project_skus WHERE project_id = projects.id
);
