import { getDb } from '../index'
import type { SearchResult } from '@shared/types'

function ftsQuery(raw: string): string {
  // Treat the user's input as a set of prefix terms so partial words still match,
  // and escape double quotes to keep the FTS5 query syntax valid.
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term.replace(/"/g, '""')}"*`)
    .join(' ')
}

export function globalSearch(query: string, limit = 50): SearchResult[] {
  if (!query.trim()) return []
  const db = getDb()
  const q = ftsQuery(query)

  const notes = db
    .prepare(
      `SELECT n.id, n.project_id, n.title, snippet(notes_fts, -1, '<b>', '</b>', '…', 12) AS snippet, n.updated_at
       FROM notes_fts JOIN notes n ON n.id = notes_fts.rowid
       WHERE notes_fts MATCH ? AND n.archived_at IS NULL
       ORDER BY rank LIMIT ?`
    )
    .all(q, limit) as { id: number; project_id: number | null; title: string; snippet: string; updated_at: string }[]

  const tasks = db
    .prepare(
      `SELECT t.id, t.project_id, t.title, snippet(tasks_fts, -1, '<b>', '</b>', '…', 12) AS snippet, t.updated_at
       FROM tasks_fts JOIN tasks t ON t.id = tasks_fts.rowid
       WHERE tasks_fts MATCH ? ORDER BY rank LIMIT ?`
    )
    .all(q, limit) as { id: number; project_id: number; title: string; snippet: string; updated_at: string }[]

  const jira = db
    .prepare(
      `SELECT j.id, j.project_id, (j.issue_id || ' — ' || j.issue_name) AS title,
       snippet(jira_fts, -1, '<b>', '</b>', '…', 12) AS snippet, j.updated_at
       FROM jira_fts JOIN jira_items j ON j.id = jira_fts.rowid
       WHERE jira_fts MATCH ? ORDER BY rank LIMIT ?`
    )
    .all(q, limit) as { id: number; project_id: number; title: string; snippet: string; updated_at: string }[]

  const dailyLogs = db
    .prepare(
      `SELECT d.id, d.project_id, ('Hours log — ' || d.log_date) AS title,
       snippet(daily_logs_fts, -1, '<b>', '</b>', '…', 12) AS snippet, d.updated_at
       FROM daily_logs_fts JOIN daily_logs d ON d.id = daily_logs_fts.rowid
       WHERE daily_logs_fts MATCH ? ORDER BY rank LIMIT ?`
    )
    .all(q, limit) as { id: number; project_id: number | null; title: string; snippet: string; updated_at: string }[]

  const results: SearchResult[] = [
    ...notes.map((r) => ({ ...r, entity: 'note' as const })),
    ...tasks.map((r) => ({ ...r, entity: 'task' as const })),
    ...jira.map((r) => ({ ...r, entity: 'jira' as const })),
    ...dailyLogs.map((r) => ({ ...r, entity: 'daily_log' as const }))
  ]

  return results.sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, limit)
}
