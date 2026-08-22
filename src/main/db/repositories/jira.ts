import { getDb } from '../index'
import type { JiraColumnMap, JiraComment, JiraImportResult, JiraItem, JiraItemInput, JiraLinkedIssue } from '@shared/types'

type JiraItemRow = Omit<JiraItem, 'linked_issues'> & { linked_issues: string | null }

function toJiraItem(row: JiraItemRow): JiraItem {
  return { ...row, linked_issues: row.linked_issues ? JSON.parse(row.linked_issues) : [] }
}

export interface JiraImportRow {
  issue_id: string
  issue_name: string
  description?: string
  external_status?: string
  priority?: string
  assignee?: string
  jira_url?: string
  fix_versions?: string
  affects_versions?: string
  // Only ever set by API sync — CSV import has no equivalent source data.
  linked_issues?: JiraLinkedIssue[]
}

// Jira workflows vary a lot; fold common raw status text down to a fixed
// priority vocabulary. Status itself is no longer bucketed — external_status
// now stores whatever Jira literally says — but "is this ticket done" is
// still needed for dashboard/attention queries, so this SQL fragment
// approximates it from the raw text instead. NULL (no status known yet)
// counts as unresolved.
function unresolvedStatusSql(column: string): string {
  return `(${column} IS NULL OR (
    LOWER(${column}) NOT LIKE '%done%' AND
    LOWER(${column}) NOT LIKE '%closed%' AND
    LOWER(${column}) NOT LIKE '%resolved%'
  ))`
}

function normalizePriority(raw: string): string {
  const s = raw.trim().toLowerCase()
  if (!s) return 'medium'
  if (/(highest|critical|blocker)/.test(s)) return 'critical'
  if (/high/.test(s)) return 'high'
  if (/low/.test(s)) return 'low'
  return 'medium'
}

export function listJiraItems(projectId: number): JiraItem[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM jira_items WHERE project_id = ?
       ORDER BY ${unresolvedStatusSql('external_status')} DESC, updated_at DESC`
    )
    .all(projectId) as JiraItemRow[]
  return rows.map(toJiraItem)
}

export function getJiraItem(id: number): JiraItem | undefined {
  const row = getDb().prepare('SELECT * FROM jira_items WHERE id = ?').get(id) as JiraItemRow | undefined
  return row ? toJiraItem(row) : undefined
}

export function createJiraItem(input: JiraItemInput): JiraItem {
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO jira_items (project_id, jira_url, issue_id, issue_name, description, external_status,
       internal_status, priority, assignee, source_table, source_field, internal_notes, technical_notes,
       questions, decisions, dependencies, blockers, resolution_details, fix_versions, affects_versions)
       VALUES (@project_id, @jira_url, @issue_id, @issue_name, @description, @external_status,
       @internal_status, @priority, @assignee, @source_table, @source_field, @internal_notes, @technical_notes,
       @questions, @decisions, @dependencies, @blockers, @resolution_details, @fix_versions, @affects_versions)`
    )
    .run({ fix_versions: null, affects_versions: null, ...input })
  return getJiraItem(result.lastInsertRowid as number)!
}

export function updateJiraItem(id: number, input: Partial<JiraItemInput>): JiraItem {
  const db = getDb()
  const existing = getJiraItem(id)
  if (!existing) throw new Error(`Jira item ${id} not found`)
  const merged = { ...existing, ...input, id }
  db.prepare(
    `UPDATE jira_items SET jira_url=@jira_url, issue_id=@issue_id, issue_name=@issue_name, description=@description,
     external_status=@external_status, internal_status=@internal_status, priority=@priority, assignee=@assignee,
     source_table=@source_table, source_field=@source_field, internal_notes=@internal_notes,
     technical_notes=@technical_notes, questions=@questions, decisions=@decisions,
     dependencies=@dependencies, blockers=@blockers, resolution_details=@resolution_details,
     fix_versions=@fix_versions, affects_versions=@affects_versions,
     updated_at=datetime('now') WHERE id=@id`
  ).run(merged)
  return getJiraItem(id)!
}

export function listJiraComments(jiraItemId: number): JiraComment[] {
  return getDb()
    .prepare('SELECT * FROM jira_comments WHERE jira_item_id = ? ORDER BY created_at DESC')
    .all(jiraItemId) as JiraComment[]
}

export function addJiraComment(jiraItemId: number, commentText: string): JiraComment {
  const db = getDb()
  const result = db
    .prepare('INSERT INTO jira_comments (jira_item_id, comment_text) VALUES (?, ?)')
    .run(jiraItemId, commentText)
  return db.prepare('SELECT * FROM jira_comments WHERE id = ?').get(result.lastInsertRowid) as JiraComment
}

export function deleteJiraComment(id: number): void {
  getDb().prepare('DELETE FROM jira_comments WHERE id = ?').run(id)
}

export function deleteJiraItem(id: number): void {
  getDb().prepare('DELETE FROM jira_items WHERE id = ?').run(id)
}

export function bulkUpsertJiraItems(
  projectId: number,
  filePath: string,
  columnMap: JiraColumnMap,
  items: JiraImportRow[]
): JiraImportResult {
  const db = getDb()

  // Only Jira-sourced fields are ever touched on update; manually-curated
  // fields (internal_notes, technical_notes, questions, decisions,
  // dependencies, blockers, resolution_details) and the manually-set
  // internal_status are never overwritten by an import.
  const updatableFields: { key: keyof JiraImportRow; col: string }[] = [
    { key: 'issue_name', col: 'issue_name' },
    { key: 'description', col: 'description' },
    { key: 'external_status', col: 'external_status' },
    { key: 'priority', col: 'priority' },
    { key: 'assignee', col: 'assignee' },
    { key: 'jira_url', col: 'jira_url' },
    { key: 'fix_versions', col: 'fix_versions' },
    { key: 'affects_versions', col: 'affects_versions' },
    { key: 'linked_issues', col: 'linked_issues' }
  ]
  const updatable = updatableFields.filter((f) => columnMap[f.key as keyof JiraColumnMap])

  const updateStmt = updatable.length
    ? db.prepare(
        `UPDATE jira_items SET ${updatable.map((f) => `${f.col}=@${f.key}`).join(', ')}, updated_at=datetime('now') WHERE id=@id`
      )
    : null
  const findExisting = db.prepare('SELECT id FROM jira_items WHERE project_id = ? AND issue_id = ?')
  const insertStmt = db.prepare(
    `INSERT INTO jira_items (project_id, jira_url, issue_id, issue_name, description, external_status, priority, assignee, fix_versions, affects_versions, linked_issues)
     VALUES (@project_id, @jira_url, @issue_id, @issue_name, @description, @external_status, @priority, @assignee, @fix_versions, @affects_versions, @linked_issues)`
  )

  const tx = db.transaction(() => {
    const batchResult = db
      .prepare('INSERT INTO excel_imports (project_id, file_path, column_map, row_count) VALUES (?, ?, ?, ?)')
      .run(projectId, filePath, JSON.stringify(columnMap), items.length)
    const batchId = batchResult.lastInsertRowid as number

    let inserted = 0
    let updated = 0
    for (const item of items) {
      const priority = item.priority !== undefined ? normalizePriority(item.priority) : undefined
      const existing = findExisting.get(projectId, item.issue_id) as { id: number } | undefined
      if (!existing) {
        insertStmt.run({
          project_id: projectId,
          jira_url: item.jira_url || null,
          issue_id: item.issue_id,
          issue_name: item.issue_name,
          description: item.description || null,
          external_status: item.external_status || null,
          priority: priority ?? 'medium',
          assignee: item.assignee || null,
          fix_versions: item.fix_versions || null,
          affects_versions: item.affects_versions || null,
          linked_issues: JSON.stringify(item.linked_issues ?? [])
        })
        inserted++
      } else if (updateStmt) {
        updateStmt.run({
          id: existing.id,
          issue_name: item.issue_name,
          description: item.description || null,
          external_status: item.external_status || null,
          priority,
          assignee: item.assignee || null,
          jira_url: item.jira_url || null,
          fix_versions: item.fix_versions || null,
          affects_versions: item.affects_versions || null,
          linked_issues: item.linked_issues !== undefined ? JSON.stringify(item.linked_issues) : undefined
        })
        updated++
      }
    }
    return { batchId, inserted, updated }
  })

  return tx()
}

// Every field the Jira API returns is always considered "Jira-sourced" (unlike
// CSV import, where the user picks which columns to sync) — so this always
// updates the same fixed set, while still never touching the manually-curated
// ones (internal_notes, questions, decisions, internal_status, etc.),
// matching bulkUpsertJiraItems's guarantee.
const API_SYNC_COLUMN_MAP: JiraColumnMap = {
  issue_id: 'key',
  issue_name: 'summary',
  description: 'description',
  external_status: 'status',
  priority: 'priority',
  assignee: 'assignee',
  jira_url: 'url',
  fix_versions: 'fixVersions',
  affects_versions: 'versions',
  linked_issues: 'issuelinks'
}

export function upsertJiraItemsFromApiSync(
  projectId: number,
  siteUrl: string,
  items: JiraImportRow[]
): JiraImportResult {
  return bulkUpsertJiraItems(projectId, `jira-api-sync:${siteUrl}`, API_SYNC_COLUMN_MAP, items)
}

export { unresolvedStatusSql }
