import { getDb } from '../index'
import type { GeneralTask, GeneralTaskInput } from '@shared/types'

// Non-project to-do items for the dashboard. Ordered like project tasks: open
// first, then by due date (nulls last).
export function listGeneralTasks(): GeneralTask[] {
  return getDb()
    .prepare(
      `SELECT * FROM general_tasks
       ORDER BY status = 'done', due_date IS NULL, due_date, created_at`
    )
    .all() as GeneralTask[]
}

export function createGeneralTask(input: GeneralTaskInput): GeneralTask {
  const db = getDb()
  const result = db
    .prepare('INSERT INTO general_tasks (title, status, due_date, notes) VALUES (@title, @status, @due_date, @notes)')
    .run(input)
  return db.prepare('SELECT * FROM general_tasks WHERE id = ?').get(result.lastInsertRowid) as GeneralTask
}

export function updateGeneralTask(id: number, input: Partial<GeneralTaskInput>): GeneralTask {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM general_tasks WHERE id = ?').get(id) as GeneralTask
  if (!existing) throw new Error(`General task ${id} not found`)
  const merged = { ...existing, ...input, id }
  const completedAt = merged.status === 'done' ? (existing.completed_at ?? new Date().toISOString()) : null
  db.prepare(
    `UPDATE general_tasks SET title=@title, status=@status, due_date=@due_date, notes=@notes,
     completed_at=@completed_at, updated_at=datetime('now') WHERE id=@id`
  ).run({ ...merged, completed_at: completedAt })
  return db.prepare('SELECT * FROM general_tasks WHERE id = ?').get(id) as GeneralTask
}

export function deleteGeneralTask(id: number): void {
  getDb().prepare('DELETE FROM general_tasks WHERE id = ?').run(id)
}
