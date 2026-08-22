UPDATE projects SET project_name = CASE
  WHEN site_id IS NOT NULL AND TRIM(site_id) != '' THEN TRIM(site_id) || ' - ' || client_name
  ELSE client_name
END;
