import { getDb } from '../index'
import type { ProjectSku, ProjectSkuInput } from '@shared/types'

export function listSkus(projectId: number): ProjectSku[] {
  return getDb()
    .prepare('SELECT * FROM project_skus WHERE project_id = ? ORDER BY sort_order, id')
    .all(projectId) as ProjectSku[]
}

export function createSku(input: ProjectSkuInput): ProjectSku {
  const db = getDb()
  const result = db
    .prepare(
      'INSERT INTO project_skus (project_id, sku, hours, notes, sort_order) VALUES (@project_id, @sku, @hours, @notes, @sort_order)'
    )
    .run(input)
  return db.prepare('SELECT * FROM project_skus WHERE id = ?').get(result.lastInsertRowid) as ProjectSku
}

export function updateSku(id: number, input: Partial<ProjectSkuInput>): ProjectSku {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM project_skus WHERE id = ?').get(id) as ProjectSku
  const merged = { ...existing, ...input, id }
  db.prepare(
    "UPDATE project_skus SET sku=@sku, hours=@hours, notes=@notes, sort_order=@sort_order, updated_at=datetime('now') WHERE id=@id"
  ).run(merged)
  return db.prepare('SELECT * FROM project_skus WHERE id = ?').get(id) as ProjectSku
}

export function deleteSku(id: number): void {
  getDb().prepare('DELETE FROM project_skus WHERE id = ?').run(id)
}
