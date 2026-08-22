import { getDb } from '../index'
import type { DocReference, DocReferenceInput } from '@shared/types'

export function listDocReferences(projectId: number): DocReference[] {
  const rows = getDb()
    .prepare('SELECT * FROM doc_references WHERE project_id = ? ORDER BY category, label')
    .all(projectId) as (Omit<DocReference, 'is_folder'> & { is_folder: number })[]
  return rows.map((r) => ({ ...r, is_folder: !!r.is_folder }))
}

export function addDocReference(input: DocReferenceInput): DocReference {
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO doc_references (project_id, category, label, path, is_folder, notes)
       VALUES (@project_id, @category, @label, @path, @is_folder, @notes)`
    )
    .run({ ...input, is_folder: input.is_folder ? 1 : 0 })
  const row = db.prepare('SELECT * FROM doc_references WHERE id = ?').get(result.lastInsertRowid) as Omit<
    DocReference,
    'is_folder'
  > & { is_folder: number }
  return { ...row, is_folder: !!row.is_folder }
}

export function removeDocReference(id: number): void {
  getDb().prepare('DELETE FROM doc_references WHERE id = ?').run(id)
}
