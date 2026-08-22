import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Note, NoteType, ProjectTask, TaskCategory, TaskPriority } from '@shared/types'
import { Button, Card, Field, Input, Modal, Select, EmptyState, Badge } from '../../components/ui'
import { RichTextEditor } from '../../components/RichTextEditor'
import { formatDate } from '../../lib/format'

const typeLabels: Record<NoteType, string> = {
  general: 'General',
  meeting: 'Meeting',
  decision: 'Decision',
  lesson_learned: 'Lesson Learned'
}

const emptyTaskFromNoteForm = {
  title: '',
  category_id: null as number | null,
  due_date: '',
  priority: '' as TaskPriority | ''
}

export function NotesTab({
  projectId,
  openNoteId,
  onOpenNoteConsumed
}: {
  projectId: number
  openNoteId?: number | null
  onOpenNoteConsumed?: () => void
}): React.JSX.Element {
  const [notes, setNotes] = useState<Note[]>([])
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [taskCategories, setTaskCategories] = useState<TaskCategory[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [noteType, setNoteType] = useState<NoteType>('general')
  const [contentJson, setContentJson] = useState('')
  const [contentText, setContentText] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [taskForm, setTaskForm] = useState(emptyTaskFromNoteForm)
  const [taskSourceNoteId, setTaskSourceNoteId] = useState<number | null>(null)
  const [taskCreated, setTaskCreated] = useState(false)

  function refresh(): void {
    api.notes.list({ projectId }).then((ns) => {
      setNotes(ns)
      // Deep-link support for "From note" links on tasks — only acts on the
      // load that first carries openNoteId; consuming it clears the URL
      // param so later refreshes (after save/archive) don't reopen it.
      if (openNoteId) {
        const note = ns.find((n) => n.id === openNoteId)
        if (note) openEdit(note)
        onOpenNoteConsumed?.()
      }
    })
    api.taskCategories.list(projectId).then(setTaskCategories)
    api.tasks.list(projectId).then(setTasks)
  }
  useEffect(refresh, [projectId])

  function openTaskFromNote(note: Note): void {
    setTaskForm({ ...emptyTaskFromNoteForm, title: note.title })
    setTaskSourceNoteId(note.id)
    setTaskCreated(false)
    setTaskModalOpen(true)
  }

  async function saveTaskFromNote(): Promise<void> {
    if (!taskForm.title.trim()) return
    await api.tasks.create({
      project_id: projectId,
      category_id: taskForm.category_id,
      title: taskForm.title,
      status: 'open',
      priority: taskForm.priority || null,
      owner: null,
      due_date: taskForm.due_date || null,
      delivery_type: null,
      notes: null,
      source_note_id: taskSourceNoteId
    })
    setTaskCreated(true)
    refresh()
  }

  function openNew(): void {
    setEditing(null)
    setTitle('')
    setNoteType('general')
    setContentJson('')
    setContentText('')
    setTagsInput('')
    setModalOpen(true)
  }

  function openEdit(note: Note): void {
    setEditing(note)
    setTitle(note.title)
    setNoteType(note.note_type)
    setContentJson(note.content_json)
    setContentText(note.content_text)
    setTagsInput((note.tags ?? []).join(', '))
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

  const linkedTasks = editing ? tasks.filter((t) => t.source_note_id === editing.id) : []

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openNew}>+ New note</Button>
      </div>

      {notes.length === 0 ? (
        <EmptyState>No notes for this project yet.</EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {notes.map((n) => {
            const noteTaskCount = tasks.filter((t) => t.source_note_id === n.id).length
            return (
            <Card key={n.id} className="cursor-pointer" >
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
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
                {noteTaskCount > 0 ? (
                  <Badge tone="orange">
                    {noteTaskCount} linked task{noteTaskCount === 1 ? '' : 's'}
                  </Badge>
                ) : (
                  <span />
                )}
                <button
                  className="text-xs text-slate-400 hover:text-slate-700"
                  onClick={(e) => {
                    e.stopPropagation()
                    openTaskFromNote(n)
                  }}
                >
                  + Create task
                </button>
              </div>
            </Card>
            )
          })}
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
          <Field label="Tags (comma separated)">
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="client-call, mapping" />
          </Field>
          <Field label="Content">
            <RichTextEditor contentJson={contentJson} onChange={(json, text) => { setContentJson(json); setContentText(text) }} />
          </Field>
          {linkedTasks.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-400">Tasks created from this note</p>
              <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                {linkedTasks.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={`?tab=tasks&task=${t.id}`}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm hover:bg-slate-50"
                    >
                      <span className="truncate">{t.title}</span>
                      <Badge
                        tone={
                          t.status === 'done' ? 'green' : t.status === 'blocked' ? 'red' : t.status === 'in_progress' ? 'yellow' : 'slate'
                        }
                      >
                        {t.status.replace('_', ' ')}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
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

      <Modal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        title="Create task from note"
      >
        {taskCreated ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">Task created. Find it on this project&apos;s Tasks tab.</p>
            <div className="flex justify-end">
              <Button onClick={() => setTaskModalOpen(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Title">
              <Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <Select
                  value={taskForm.category_id ?? ''}
                  onChange={(e) => setTaskForm({ ...taskForm, category_id: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">(none)</option>
                  {taskCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Priority">
                <Select
                  value={taskForm.priority}
                  onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as TaskPriority | '' })}
                >
                  <option value="">(none)</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </Select>
              </Field>
            </div>
            <Field label="Due date">
              <Input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} />
            </Field>
            <div className="flex justify-end">
              <Button onClick={saveTaskFromNote}>Create task</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
