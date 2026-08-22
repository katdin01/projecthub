import { getDb } from '../index'
import type { DailyLog, DailyLogInput, DailyLogFilter } from '@shared/types'

export function listDailyLogs(filter: DailyLogFilter = {}): (DailyLog & { project_name: string | null })[] {
  const db = getDb()
  const clauses: string[] = []
  const params: Record<string, unknown> = {}

  if (filter.projectId) {
    clauses.push('d.project_id = @projectId')
    params.projectId = filter.projectId
  }
  if (filter.fromDate) {
    clauses.push('d.log_date >= @fromDate')
    params.fromDate = filter.fromDate
  }
  if (filter.toDate) {
    clauses.push('d.log_date <= @toDate')
    params.toDate = filter.toDate
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const limit = filter.limit ? `LIMIT ${Number(filter.limit)}` : ''

  return db
    .prepare(
      `SELECT d.*, p.project_name FROM daily_logs d
       LEFT JOIN projects p ON p.id = d.project_id
       ${where}
       ORDER BY d.log_date DESC, d.created_at DESC
       ${limit}`
    )
    .all(params) as (DailyLog & { project_name: string | null })[]
}

export function getDailyLog(id: number): DailyLog | undefined {
  return getDb().prepare('SELECT * FROM daily_logs WHERE id = ?').get(id) as DailyLog | undefined
}

export function createDailyLog(input: DailyLogInput): DailyLog {
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO daily_logs (project_id, log_date, work_completed, hours_spent, notes, decisions_made, open_questions, next_steps, risks, blockers)
       VALUES (@project_id, @log_date, @work_completed, @hours_spent, @notes, @decisions_made, @open_questions, @next_steps, @risks, @blockers)`
    )
    .run(input)
  return getDailyLog(result.lastInsertRowid as number)!
}

export function updateDailyLog(id: number, input: Partial<DailyLogInput>): DailyLog {
  const db = getDb()
  const existing = getDailyLog(id)
  if (!existing) throw new Error(`Daily log ${id} not found`)
  const merged = { ...existing, ...input, id }
  db.prepare(
    `UPDATE daily_logs SET project_id=@project_id, log_date=@log_date, work_completed=@work_completed,
     hours_spent=@hours_spent, notes=@notes, decisions_made=@decisions_made, open_questions=@open_questions,
     next_steps=@next_steps, risks=@risks, blockers=@blockers, updated_at=datetime('now') WHERE id=@id`
  ).run(merged)
  return getDailyLog(id)!
}

export function deleteDailyLog(id: number): void {
  getDb().prepare('DELETE FROM daily_logs WHERE id = ?').run(id)
}
