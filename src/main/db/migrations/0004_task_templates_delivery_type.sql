-- New task-level classification, orthogonal to category.
ALTER TABLE tasks ADD COLUMN delivery_type TEXT;

-- Reusable, app-wide checklist of standard task names. Used to prepopulate a
-- project's task list; due dates are filled in by matching each template name
-- against that project's imported schedule item names.
CREATE TABLE task_templates (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL,
  category       TEXT,
  delivery_type  TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0
);

INSERT INTO task_templates (name, category, delivery_type, sort_order) VALUES
  ('Resource Assignments & Project Orientation', 'Data Conversion', NULL, 0),
  ('Project Kickoff Meeting', 'Data Conversion', 'meeting', 1),
  ('Initial Data Extract', 'Data Conversion', NULL, 2),
  ('Confirm Conversion Environment Setup Complete', 'Data Conversion', NULL, 3),
  ('Run Test Run 0', 'Data Conversion', NULL, 4),
  ('Deliver Test Run 0 to Hosting', 'Data Conversion', NULL, 5),
  ('Deliver Initial Data Map for Consultant Feedback', 'Data Conversion', NULL, 6),
  ('Deliver Data Mapping Feedback to Data Analyst', 'Data Conversion', NULL, 7),
  ('Deliver Initial Data Map', 'Data Conversion', NULL, 8),
  ('Data Map Review Meeting', 'Data Conversion', 'meeting', 9),
  ('Data Map Q&A Meeting', 'Data Conversion', 'meeting', 10),
  ('Deliver Revised Data Map', 'Data Conversion', NULL, 11),
  ('Deliver Translation Tables', 'Data Conversion', NULL, 12),
  ('Deliverable Acceptance: RE NXT Data Map', 'Data Conversion', NULL, 13),
  ('Deliver Completed Translation Tables', 'Data Conversion', NULL, 14),
  ('Test Run 1 Data Extract', 'Data Conversion', NULL, 15),
  ('Program Test Run 1', 'Data Conversion', NULL, 16),
  ('Test Run 1 Quality Assurance', 'Data Conversion', NULL, 17),
  ('Deliver Test Run 1 to Hosting', 'Data Conversion', NULL, 18),
  ('Deliver Test Run 1 Database', 'Data Conversion', NULL, 19),
  ('Deliver Test Run 1 Exceptions List to Business Consultant', 'Data Conversion', NULL, 20),
  ('Checkpoint; Test Run 1 Run time - Internal Reporting', 'Data Conversion', NULL, 21),
  ('Test Run 1 Data Validation Session #1 & Exceptions Review', 'Data Conversion', NULL, 22),
  ('Test Run 1 Data Validation Check-in', 'Data Conversion', NULL, 23),
  ('Due Date for Test Run 1 Data Validation JIRA Issues', 'Data Conversion', NULL, 24),
  ('Meeting to Review Test Run 1 Data Validation Issues', 'Data Conversion', 'meeting', 25),
  ('Test Run 2 Data Extract', 'Data Conversion', NULL, 26),
  ('Deliver Updated Translation Tables', 'Data Conversion', NULL, 27),
  ('Program Test Run 2', 'Data Conversion', NULL, 28),
  ('Test Run 2 Quality Assurance', 'Data Conversion', NULL, 29),
  ('Deliver Test Run 2 to Hosting', 'Data Conversion', NULL, 30),
  ('Deliver Test Run 2 Database', 'Data Conversion', NULL, 31),
  ('Deliver Test Run 2 Exceptions List to Business Consultant', 'Data Conversion', NULL, 32),
  ('Checkpoint; Test Run 2 Run time - Internal Reporting', 'Data Conversion', NULL, 33),
  ('Test Run 2 Data Validation Session #1 & Exceptions Review', 'Data Conversion', NULL, 34),
  ('Due Date for Test Run 2 Data Validation & User Acceptance Testing JIRA Issues', 'Data Conversion', NULL, 35),
  ('Meeting to Review Test Run 2 Data Validation Issues', 'Data Conversion', 'meeting', 36),
  ('Review/Revise Test Run 2 Changes List', 'Data Conversion', NULL, 37),
  ('Final Data Extract', 'Data Conversion', NULL, 38),
  ('Final Run Execution', 'Data Conversion', NULL, 39),
  ('Final Run Quality Assurance', 'Data Conversion', NULL, 40),
  ('Deliver Final Run to Hosting', 'Data Conversion', NULL, 41),
  ('Deliver Final Run', 'Data Conversion', NULL, 42),
  ('Deliver Final Run Exceptions List to Business Consultant', 'Data Conversion', NULL, 43),
  ('Deliverable Acceptance: Final Run Database', 'Data Conversion', NULL, 44),
  ('Post-Go Live Support', 'Data Conversion', NULL, 45),
  ('Remove Client Data from Conversion Server', 'Data Conversion', NULL, 46);
