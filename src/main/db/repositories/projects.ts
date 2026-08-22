import { getDb } from '../index'
import type { Project, ProjectInput, JiraProjectSyncInput } from '@shared/types'

const DEFAULT_TASK_CATEGORIES = ['Data Conversion', 'Client Follow-up', 'General To-Do']

function deriveProjectName(siteId: string | null, clientName: string): string {
  return siteId && siteId.trim() ? `${siteId.trim()} - ${clientName}` : clientName
}

// Phase is no longer user-entered — it's derived as the "furthest completed
// milestone".
//
// Enterprise projects run the standard template checklist, so their completed
// tasks map to task_templates and the milestone order is the template's
// sort_order. Prescriptive projects instead get their tasks from an imported
// PDF/Excel schedule with their own names (no template match), where the
// sequence is the schedule timeline — i.e. due date. So:
//   1. If any completed task matches a template, use the furthest one by
//      sort_order (enterprise).
//   2. Otherwise fall back to the completed task furthest along the schedule
//      (latest due date; then most recently completed) so prescriptive and any
//      ad-hoc projects still get a phase.
// Returns null only when the project has no completed tasks at all.
export function deriveProjectPhase(projectId: number): string | null {
  const db = getDb()

  const templateMatch = db
    .prepare(
      `SELECT tt.name AS name
       FROM task_templates tt
       JOIN tasks t ON LOWER(TRIM(t.title)) = LOWER(TRIM(tt.name))
       WHERE t.project_id = ? AND t.status = 'done'
       ORDER BY tt.sort_order DESC
       LIMIT 1`
    )
    .get(projectId) as { name: string } | undefined
  if (templateMatch) return templateMatch.name

  const scheduleMatch = db
    .prepare(
      `SELECT title
       FROM tasks
       WHERE project_id = ? AND status = 'done'
       ORDER BY due_date IS NULL, due_date DESC, completed_at DESC, id DESC
       LIMIT 1`
    )
    .get(projectId) as { title: string } | undefined
  return scheduleMatch?.title ?? null
}

export function listProjects(includeArchived = false): Project[] {
  const db = getDb()
  const sql = includeArchived
    ? "SELECT * FROM projects ORDER BY status = 'completed', status = 'cancelled', target_go_live IS NULL, target_go_live"
    : 'SELECT * FROM projects WHERE archived_at IS NULL ORDER BY target_go_live IS NULL, target_go_live'
  const rows = db.prepare(sql).all() as Project[]
  return rows.map((p) => ({ ...p, phase: deriveProjectPhase(p.id) }))
}

export function getProject(id: number): Project | undefined {
  const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined
  if (row) row.phase = deriveProjectPhase(id)
  return row
}

export function createProject(input: ProjectInput): Project {
  const db = getDb()
  const insert = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO projects (client_name, site_id, project_name, status, project_type, phase, start_date, target_go_live, pm_name, business_consultant_name, source, client_location, client_time_zone)
         VALUES (@client_name, @site_id, @project_name, @status, @project_type, @phase, @start_date, @target_go_live, @pm_name, @business_consultant_name, @source, @client_location, @client_time_zone)`
      )
      .run({ ...input, project_name: deriveProjectName(input.site_id, input.client_name) })
    const projectId = result.lastInsertRowid as number

    const insertCategory = db.prepare(
      'INSERT INTO task_categories (project_id, name, sort_order) VALUES (?, ?, ?)'
    )
    DEFAULT_TASK_CATEGORIES.forEach((name, idx) => insertCategory.run(projectId, name, idx))

    return projectId
  })
  const id = insert()
  return getProject(id)!
}

export function updateProject(id: number, input: Partial<ProjectInput>): Project {
  const db = getDb()
  const existing = getProject(id)
  if (!existing) throw new Error(`Project ${id} not found`)
  const merged = { ...existing, ...input }
  db.prepare(
    `UPDATE projects SET client_name=@client_name, site_id=@site_id, project_name=@project_name,
     status=@status, project_type=@project_type, phase=@phase, start_date=@start_date, target_go_live=@target_go_live,
     pm_name=@pm_name, business_consultant_name=@business_consultant_name,
     source=@source, client_location=@client_location, client_time_zone=@client_time_zone,
     updated_at=datetime('now') WHERE id=@id`
  ).run({ ...merged, id, project_name: deriveProjectName(merged.site_id, merged.client_name) })
  return getProject(id)!
}

export function listProjectsWithJiraAutoSync(): Project[] {
  return getDb()
    .prepare(
      `SELECT * FROM projects
       WHERE archived_at IS NULL AND jira_auto_sync = 1
       AND jira_connection_id IS NOT NULL
       AND jira_jql IS NOT NULL AND TRIM(jira_jql) != ''`
    )
    .all() as Project[]
}

export function updateProjectJiraSync(id: number, input: JiraProjectSyncInput): Project {
  getDb()
    .prepare(
      'UPDATE projects SET jira_connection_id=@jira_connection_id, jira_jql=@jira_jql, jira_auto_sync=@jira_auto_sync WHERE id=@id'
    )
    .run({
      id,
      jira_connection_id: input.jira_connection_id,
      jira_jql: input.jira_jql,
      jira_auto_sync: input.jira_auto_sync ? 1 : 0
    })
  return getProject(id)!
}

// Called when a named Jira connection is removed in Settings, so no project
// is left silently pointing at a connection id that no longer exists.
export function clearProjectsJiraConnection(connectionId: string): void {
  getDb()
    .prepare('UPDATE projects SET jira_connection_id=NULL WHERE jira_connection_id=?')
    .run(connectionId)
}

export function recordJiraSyncResult(id: number, error: string | null): void {
  if (error) {
    getDb().prepare('UPDATE projects SET jira_last_sync_error=? WHERE id=?').run(error, id)
  } else {
    getDb()
      .prepare("UPDATE projects SET jira_last_synced_at=datetime('now'), jira_last_sync_error=NULL WHERE id=?")
      .run(id)
  }
}

export function archiveProject(id: number): void {
  const db = getDb()
  const existing = db.prepare('SELECT status FROM projects WHERE id = ?').get(id) as { status: string } | undefined
  if (!existing) throw new Error(`Project ${id} not found`)
  db.prepare(
    "UPDATE projects SET status = 'archived', status_before_archive = ?, archived_at = datetime('now') WHERE id = ?"
  ).run(existing.status, id)
}

export function unarchiveProject(id: number): void {
  const db = getDb()
  const existing = db.prepare('SELECT status_before_archive FROM projects WHERE id = ?').get(id) as
    | { status_before_archive: string | null }
    | undefined
  if (!existing) throw new Error(`Project ${id} not found`)
  db.prepare(
    "UPDATE projects SET status = ?, status_before_archive = NULL, archived_at = NULL WHERE id = ?"
  ).run(existing.status_before_archive ?? 'active', id)
}
