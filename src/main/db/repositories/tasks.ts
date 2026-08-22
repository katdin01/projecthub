import { getDb } from '../index'
import type { GenerateTasksResult, ProjectTask, ProjectTaskInput, TaskCategory, TaskCategoryInput, TaskTemplate } from '@shared/types'

export function listTaskCategories(projectId: number): TaskCategory[] {
  return getDb()
    .prepare('SELECT * FROM task_categories WHERE project_id = ? ORDER BY sort_order')
    .all(projectId) as TaskCategory[]
}

export function addTaskCategory(input: TaskCategoryInput): TaskCategory {
  const db = getDb()
  const result = db
    .prepare('INSERT INTO task_categories (project_id, name, sort_order) VALUES (@project_id, @name, @sort_order)')
    .run(input)
  return db.prepare('SELECT * FROM task_categories WHERE id = ?').get(result.lastInsertRowid) as TaskCategory
}

export function deleteTaskCategory(id: number): void {
  // Tasks in this category are not deleted — category_id has ON DELETE SET NULL,
  // so they simply fall back to Uncategorized.
  getDb().prepare('DELETE FROM task_categories WHERE id = ?').run(id)
}

const SELECT_TASK_WITH_SOURCE_NOTE = `SELECT t.*, n.title AS source_note_title FROM tasks t
   LEFT JOIN notes n ON n.id = t.source_note_id`

export function listTasks(projectId: number): ProjectTask[] {
  return getDb()
    .prepare(
      `${SELECT_TASK_WITH_SOURCE_NOTE} WHERE t.project_id = ?
       ORDER BY t.status = 'done', t.due_date IS NULL, t.due_date DESC, t.priority = 'low'`
    )
    .all(projectId) as ProjectTask[]
}

export function getTask(id: number): ProjectTask | undefined {
  return getDb()
    .prepare(`${SELECT_TASK_WITH_SOURCE_NOTE} WHERE t.id = ?`)
    .get(id) as ProjectTask | undefined
}

export function createTask(input: ProjectTaskInput): ProjectTask {
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO tasks (project_id, category_id, title, status, priority, owner, due_date, delivery_type, notes, source_note_id)
       VALUES (@project_id, @category_id, @title, @status, @priority, @owner, @due_date, @delivery_type, @notes, @source_note_id)`
    )
    .run(input)
  return getTask(result.lastInsertRowid as number)!
}

export function updateTask(id: number, input: Partial<ProjectTaskInput>): ProjectTask {
  const db = getDb()
  const existing = getTask(id)
  if (!existing) throw new Error(`Task ${id} not found`)
  const merged = { ...existing, ...input, id }
  const completedAt = merged.status === 'done' ? (existing.completed_at ?? new Date().toISOString()) : null
  db.prepare(
    `UPDATE tasks SET category_id=@category_id, title=@title, status=@status, priority=@priority,
     owner=@owner, due_date=@due_date, delivery_type=@delivery_type, notes=@notes,
     source_note_id=@source_note_id, completed_at=@completed_at, updated_at=datetime('now') WHERE id=@id`
  ).run({ ...merged, completed_at: completedAt })
  return getTask(id)!
}

export function deleteTask(id: number): void {
  getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id)
}

export function generateTasksFromTemplates(projectId: number): GenerateTasksResult {
  const db = getDb()
  const templates = db.prepare('SELECT * FROM task_templates ORDER BY sort_order').all() as TaskTemplate[]

  const scheduleRows = db
    .prepare('SELECT name, due_date FROM schedule_items WHERE project_id = ?')
    .all(projectId) as { name: string; due_date: string | null }[]
  const dueDateByName = new Map<string, string | null>()
  for (const s of scheduleRows) {
    const key = s.name.trim().toLowerCase()
    if (!dueDateByName.has(key)) dueDateByName.set(key, s.due_date)
  }

  const existingTitles = new Set(
    (db.prepare('SELECT title FROM tasks WHERE project_id = ?').all(projectId) as { title: string }[]).map((t) =>
      t.title.trim().toLowerCase()
    )
  )

  const categories = db.prepare('SELECT * FROM task_categories WHERE project_id = ?').all(projectId) as TaskCategory[]
  const categoryIdByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]))

  const insert = db.prepare(
    `INSERT INTO tasks (project_id, category_id, title, status, priority, due_date, delivery_type)
     VALUES (?, ?, ?, 'open', 'medium', ?, ?)`
  )

  const tx = db.transaction(() => {
    let created = 0
    let withDueDate = 0
    let skippedExisting = 0
    for (const t of templates) {
      const key = t.name.trim().toLowerCase()
      if (existingTitles.has(key)) {
        skippedExisting++
        continue
      }
      const dueDate = dueDateByName.get(key) ?? null
      if (dueDate) withDueDate++
      const categoryId = t.category ? (categoryIdByName.get(t.category.toLowerCase()) ?? null) : null
      insert.run(projectId, categoryId, t.name, dueDate, t.delivery_type)
      created++
    }
    return { created, withDueDate, skippedExisting }
  })

  return tx()
}

export function listAllOpenTasksAcrossProjects(): (ProjectTask & { project_name: string })[] {
  return getDb()
    .prepare(
      `SELECT t.*, p.project_name, n.title AS source_note_title FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN notes n ON n.id = t.source_note_id
       WHERE t.status != 'done' AND p.archived_at IS NULL
       ORDER BY t.due_date IS NULL, t.due_date`
    )
    .all() as (ProjectTask & { project_name: string })[]
}
