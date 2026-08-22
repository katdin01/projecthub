import { getDb } from '../index'
import type { TaskTemplate, TaskTemplateInput } from '@shared/types'

export function listTaskTemplates(): TaskTemplate[] {
  return getDb().prepare('SELECT * FROM task_templates ORDER BY sort_order').all() as TaskTemplate[]
}

export function createTaskTemplate(input: TaskTemplateInput): TaskTemplate {
  const db = getDb()
  const result = db
    .prepare(
      'INSERT INTO task_templates (name, category, delivery_type, sort_order) VALUES (@name, @category, @delivery_type, @sort_order)'
    )
    .run(input)
  return db.prepare('SELECT * FROM task_templates WHERE id = ?').get(result.lastInsertRowid) as TaskTemplate
}

export function updateTaskTemplate(id: number, input: Partial<TaskTemplateInput>): TaskTemplate {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM task_templates WHERE id = ?').get(id) as TaskTemplate
  const merged = { ...existing, ...input, id }
  db.prepare(
    'UPDATE task_templates SET name=@name, category=@category, delivery_type=@delivery_type, sort_order=@sort_order WHERE id=@id'
  ).run(merged)
  return db.prepare('SELECT * FROM task_templates WHERE id = ?').get(id) as TaskTemplate
}

export function deleteTaskTemplate(id: number): void {
  getDb().prepare('DELETE FROM task_templates WHERE id = ?').run(id)
}
