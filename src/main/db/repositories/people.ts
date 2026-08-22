import { getDb } from '../index'
import type { ProjectPerson, ProjectPersonInput } from '@shared/types'

type ProjectPersonRow = Omit<ProjectPerson, 'is_primary_contact'> & { is_primary_contact: number }

function toProjectPerson(row: ProjectPersonRow): ProjectPerson {
  return { ...row, is_primary_contact: !!row.is_primary_contact }
}

export function listPeople(projectId: number): ProjectPerson[] {
  const rows = getDb()
    .prepare('SELECT * FROM project_people WHERE project_id = ? ORDER BY team, is_primary_contact DESC, name')
    .all(projectId) as ProjectPersonRow[]
  return rows.map(toProjectPerson)
}

export function addPerson(input: ProjectPersonInput): ProjectPerson {
  const db = getDb()
  const result = db
    .prepare(
      `INSERT INTO project_people (project_id, team, role, name, email, is_primary_contact, notes)
       VALUES (@project_id, @team, @role, @name, @email, @is_primary_contact, @notes)`
    )
    .run({ ...input, is_primary_contact: input.is_primary_contact ? 1 : 0 })
  return toProjectPerson(
    db.prepare('SELECT * FROM project_people WHERE id = ?').get(result.lastInsertRowid) as ProjectPersonRow
  )
}

export function updatePerson(id: number, input: Partial<ProjectPersonInput>): ProjectPerson {
  const db = getDb()
  const existing = toProjectPerson(db.prepare('SELECT * FROM project_people WHERE id = ?').get(id) as ProjectPersonRow)
  const merged = {
    ...existing,
    ...input,
    id,
    is_primary_contact: (input.is_primary_contact ?? existing.is_primary_contact) ? 1 : 0
  }
  db.prepare(
    'UPDATE project_people SET team=@team, role=@role, name=@name, email=@email, is_primary_contact=@is_primary_contact, notes=@notes WHERE id=@id'
  ).run(merged)
  return toProjectPerson(db.prepare('SELECT * FROM project_people WHERE id = ?').get(id) as ProjectPersonRow)
}

export function removePerson(id: number): void {
  getDb().prepare('DELETE FROM project_people WHERE id = ?').run(id)
}
