-- Split project_people into "my team" (internal, fixed role vocabulary) and
-- "client team" (free-text role, can mark multiple people as primary contact).
ALTER TABLE project_people ADD COLUMN team TEXT NOT NULL DEFAULT 'client';
ALTER TABLE project_people ADD COLUMN is_primary_contact INTEGER NOT NULL DEFAULT 0;

UPDATE project_people SET team = 'internal', role = 'project_manager' WHERE role = 'project_manager';
UPDATE project_people SET team = 'internal', role = 'business_consultant' WHERE role IN ('team_member', 'internal_contact');
UPDATE project_people SET team = 'client', role = 'Stakeholder' WHERE role = 'client_stakeholder';
