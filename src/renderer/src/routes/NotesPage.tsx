import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Note, NoteType, Project } from '@shared/types'
import { Badge, Button, Card, Field, Input, Modal, Select, EmptyState } from '../components/ui'
import { RichTextEditor } from '../components/RichTextEditor'
import { formatDate } from '../lib/format'

const typeLabels: Record<NoteType, string> = {
  general: 'General',
  meeting: 'Meeting',
  decision: 'Decision',
  lesson_learned: 'Lesson Learned'
}

export function NotesPage(): React.JSX.Element {
  const [notes, setNotes] = useState<Note[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [noteType, setNoteType] = useState<NoteType>('general')
  const [contentJson, setContentJson] = useState('')
  const [contentText, setContentText] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [projectId, setProjectId] = useState<number | null>(null)

  function refresh(): void {
    api.notes.list({ global: true }).then(setNotes)
    api.notes.listAllTags().then(setAllTags)
    api.projects.list().then(setProjects)
  }
  useEffect(refresh, [])

  function openNew(): void {
    setEditing(null)
    setTitle('')
    setNoteType('general')
    setContentJson('')
    setContentText('')
    setTagsInput('')
    setProjectId(null)
    setModalOpen(true)
  }

  function openEdit(note: Note): void {
    setEditing(note)
    setTitle(note.title)
    setNoteType(note.note_type)
    setContentJson(note.content_json)
    setContentText(note.content_text)
    setTagsInput((note.tags ?? []).join(', '))
    setProjectId(note.project_id)
    setModalOpen(true)
  }

  async function save(): Promise<void> {
    if (!title.trim()) return
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
    const payload = { project_id: projectId, note_type: noteType, title, content_json: contentJson, content_text: contentText, tags }
    if (editing) {
      await api.notes.update(editing.id, payload)
    } else {
      await api.notes.create(payload)
    }
    setModalOpen(false)
    refresh()
  }

  const filtered = tagFilter ? notes.filter((n) => (n.tags ?? []).includes(tagFilter)) : notes

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Global Notes</h1>
        <Button onClick={openNew}>+ New note</Button>
      </div>
      <p className="text-sm text-slate-500">
        Notes not tied to a specific project — general knowledge, cross-project decisions, lessons learned. For
        project-specific notes, open a project and use its Notes tab.
      </p>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setTagFilter(null)}>
            <Badge tone={tagFilter === null ? 'blue' : 'slate'}>all</Badge>
          </button>
          {allTags.map((t) => (
            <button key={t} onClick={() => setTagFilter(t)}>
              <Badge tone={tagFilter === t ? 'blue' : 'slate'}>#{t}</Badge>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState>No global notes yet.</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((n) => (
            <Card key={n.id} className="cursor-pointer">
              <div onClick={() => openEdit(n)}>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{n.title}</h3>
                  <Badge tone="blue">{typeLabels[n.note_type]}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{n.content_text}</p>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {(n.tags ?? []).map((t) => (
                      <Badge key={t}>#{t}</Badge>
                    ))}
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(n.updated_at)}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit note' : 'New note'} wide>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Title">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
            </div>
            <Field label="Type">
              <Select value={noteType} onChange={(e) => setNoteType(e.target.value as NoteType)}>
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Tie to project (optional)">
            <Select
              value={projectId ?? ''}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">(none — stays on this global page)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name}
                </option>
              ))}
            </Select>
            {projectId !== null && (
              <p className="mt-1 text-xs text-slate-400">
                Saving will move this note to that project&apos;s Notes tab — it won&apos;t show here anymore.
              </p>
            )}
          </Field>
          <Field label="Tags (comma separated)">
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
          </Field>
          <Field label="Content">
            <RichTextEditor contentJson={contentJson} onChange={(json, text) => { setContentJson(json); setContentText(text) }} />
          </Field>
          <div className="flex justify-between">
            {editing && (
              <Button variant="danger" onClick={() => api.notes.archive(editing.id).then(() => { setModalOpen(false); refresh() })}>
                Archive
              </Button>
            )}
            <Button onClick={save} className="ml-auto">
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
