import { getDb } from '../index'
import type { Note, NoteInput } from '@shared/types'

function attachTags(note: Note): Note {
  const db = getDb()
  const tags = db
    .prepare('SELECT t.name FROM tags t JOIN note_tags nt ON nt.tag_id = t.id WHERE nt.note_id = ? ORDER BY t.name')
    .all(note.id)
    .map((r) => (r as { name: string }).name)
  return { ...note, tags }
}

export function listNotes(filter: { projectId?: number | null; global?: boolean } = {}): Note[] {
  const db = getDb()
  let sql = 'SELECT * FROM notes WHERE archived_at IS NULL'
  const params: unknown[] = []
  if (filter.global) {
    sql += ' AND project_id IS NULL'
  } else if (filter.projectId !== undefined && filter.projectId !== null) {
    sql += ' AND project_id = ?'
    params.push(filter.projectId)
  }
  sql += ' ORDER BY updated_at DESC'
  const rows = db.prepare(sql).all(...params) as Note[]
  return rows.map(attachTags)
}

export function getNote(id: number): Note | undefined {
  const note = getDb().prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note | undefined
  return note ? attachTags(note) : undefined
}

function syncTags(db: import('better-sqlite3').Database, noteId: number, tagNames: string[]): void {
  db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId)
  const getOrCreateTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)')
  const findTag = db.prepare('SELECT id FROM tags WHERE name = ?')
  const link = db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)')
  for (const raw of tagNames) {
    const name = raw.trim().toLowerCase()
    if (!name) continue
    getOrCreateTag.run(name)
    const tag = findTag.get(name) as { id: number }
    link.run(noteId, tag.id)
  }
}

export function createNote(input: NoteInput): Note {
  const db = getDb()
  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO notes (project_id, note_type, title, content_json, content_text)
         VALUES (@project_id, @note_type, @title, @content_json, @content_text)`
      )
      .run(input)
    const id = result.lastInsertRowid as number
    syncTags(db, id, input.tags)
    return id
  })
  return getNote(tx())!
}

export function updateNote(id: number, input: Partial<NoteInput>): Note {
  const db = getDb()
  const existing = getNote(id)
  if (!existing) throw new Error(`Note ${id} not found`)
  const merged = { ...existing, ...input, id }
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE notes SET project_id=@project_id, note_type=@note_type, title=@title,
       content_json=@content_json, content_text=@content_text, updated_at=datetime('now') WHERE id=@id`
    ).run(merged)
    if (input.tags) syncTags(db, id, input.tags)
  })
  tx()
  return getNote(id)!
}

export function archiveNote(id: number): void {
  getDb().prepare("UPDATE notes SET archived_at = datetime('now') WHERE id = ?").run(id)
}

export function listAllTags(): string[] {
  return getDb()
    .prepare('SELECT name FROM tags ORDER BY name')
    .all()
    .map((r) => (r as { name: string }).name)
}
