import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import type { ProjectTask, TaskCategory, TaskStatus, TaskPriority, DeliveryType, GenerateTasksResult } from '@shared/types'
import { Badge, Button, Card, Field, Input, Modal, Select, Textarea, EmptyState } from '../../components/ui'
import { formatDateWithWeekday, isOverdue, daysUntilDue } from '../../lib/format'

const priorityTone: Record<TaskPriority, 'slate' | 'green' | 'yellow' | 'red' | 'blue'> = {
  low: 'slate',
  medium: 'blue',
  high: 'yellow',
  critical: 'red'
}

const deliveryTypeLabels: Record<DeliveryType, string> = {
  internal_delivery: 'Internal delivery',
  external_delivery: 'External delivery',
  soft_internal_delivery: 'Soft internal delivery',
  meeting: 'Meeting',
  client_due_date: 'Client due date'
}

const deliveryTypeTone: Record<DeliveryType, 'slate' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'orange'> = {
  internal_delivery: 'orange',
  external_delivery: 'red',
  soft_internal_delivery: 'green',
  meeting: 'blue',
  client_due_date: 'purple'
}

const emptyForm = {
  category_id: null as number | null,
  title: '',
  status: 'open' as TaskStatus,
  priority: '' as TaskPriority | '',
  owner: '',
  due_date: '',
  delivery_type: '' as DeliveryType | '',
  notes: '',
  source_note_id: null as number | null
}

export function TasksTab({
  projectId,
  openTaskId,
  onOpenTaskConsumed
}: {
  projectId: number
  openTaskId?: number | null
  onOpenTaskConsumed?: () => void
}): React.JSX.Element {
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [filterCategory, setFilterCategory] = useState<number | 'all'>('all')
  const [filterDeliveryType, setFilterDeliveryType] = useState<DeliveryType | 'all'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [genResult, setGenResult] = useState<GenerateTasksResult | null>(null)
  const [generating, setGenerating] = useState(false)

  function refresh(): void {
    api.taskCategories.list(projectId).then(setCategories)
    api.tasks.list(projectId).then((ts) => {
      setTasks(ts)
      // Deep-link support for "From note" navigation — only acts on the load
      // that first carries openTaskId; consuming it clears the URL param so
      // later refreshes (after save/delete) don't reopen it.
      if (openTaskId) {
        const t = ts.find((task) => task.id === openTaskId)
        if (t) openEdit(t)
        onOpenTaskConsumed?.()
      }
    })
  }
  useEffect(refresh, [projectId])

  function openNew(categoryId: number | null): void {
    setForm({ ...emptyForm, category_id: categoryId })
    setEditingId(null)
    setModalOpen(true)
  }

  function openEdit(t: ProjectTask): void {
    setForm({
      category_id: t.category_id,
      title: t.title,
      status: t.status,
      priority: t.priority ?? '',
      owner: t.owner ?? '',
      due_date: t.due_date ?? '',
      delivery_type: t.delivery_type ?? '',
      notes: t.notes ?? '',
      source_note_id: t.source_note_id
    })
    setEditingId(t.id)
    setModalOpen(true)
  }

  async function save(): Promise<void> {
    if (!form.title.trim()) return
    const payload = {
      project_id: projectId,
      category_id: form.category_id,
      title: form.title,
      status: form.status,
      priority: form.priority || null,
      owner: form.owner || null,
      due_date: form.due_date || null,
      delivery_type: form.delivery_type || null,
      notes: form.notes || null,
      source_note_id: form.source_note_id
    }
    if (editingId) {
      await api.tasks.update(editingId, payload)
    } else {
      await api.tasks.create(payload)
    }
    setModalOpen(false)
    refresh()
  }

  async function cycleStatus(t: ProjectTask): Promise<void> {
    const order: TaskStatus[] = ['open', 'in_progress', 'blocked', 'done']
    const next = order[(order.indexOf(t.status) + 1) % order.length]
    await api.tasks.update(t.id, { status: next })
    refresh()
  }

  async function generateFromSchedule(): Promise<void> {
    setGenerating(true)
    try {
      const result = await api.tasks.generateFromSchedule(projectId)
      setGenResult(result)
      refresh()
    } finally {
      setGenerating(false)
    }
  }

  const deliveryFiltered = filterDeliveryType === 'all' ? tasks : tasks.filter((t) => t.delivery_type === filterDeliveryType)
  const filtered = filterCategory === 'all' ? deliveryFiltered : deliveryFiltered.filter((t) => t.category_id === filterCategory)
  const grouped = categories.map((c) => ({ category: c, tasks: filtered.filter((t) => t.category_id === c.id) }))
  const uncategorized = filtered.filter((t) => t.category_id === null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select className="!w-56" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            className="!w-48"
            value={filterDeliveryType}
            onChange={(e) => setFilterDeliveryType(e.target.value as DeliveryType | 'all')}
          >
            <option value="all">All delivery types</option>
            {Object.entries(deliveryTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={generating} onClick={generateFromSchedule}>
            {generating ? 'Generating…' : 'Generate from schedule'}
          </Button>
          <Button onClick={() => openNew(null)}>+ Add task</Button>
        </div>
      </div>

      {genResult && (
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {genResult.created} task{genResult.created === 1 ? '' : 's'} created from the standard checklist
          {genResult.withDueDate > 0 && <> — {genResult.withDueDate} with due dates pulled from the schedule</>}
          {genResult.skippedExisting > 0 && (
            <> ({genResult.skippedExisting} already existed and were skipped)</>
          )}
          .
          <button className="ml-2 text-xs underline" onClick={() => setGenResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {grouped.map(({ category, tasks: catTasks }) => (
        <Card key={category.id}>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{category.name}</h3>
              <button
                onClick={() => {
                  if (
                    catTasks.length > 0 &&
                    !confirm(`Delete "${category.name}"? Its ${catTasks.length} task(s) will become uncategorized.`)
                  ) {
                    return
                  }
                  api.taskCategories.delete(category.id).then(refresh)
                }}
                title="Delete category"
                className="text-xs text-slate-300 hover:text-red-500"
              >
                ✕
              </button>
            </div>
            <button onClick={() => openNew(category.id)} className="text-xs text-slate-400 hover:text-slate-700">
              + add here
            </button>
          </div>
          {catTasks.length === 0 ? (
            <p className="text-xs text-slate-400">No tasks.</p>
          ) : (
            <TaskTable tasks={catTasks} onCycle={cycleStatus} onEdit={openEdit} onDelete={(id) => api.tasks.delete(id).then(refresh)} />
          )}
        </Card>
      ))}

      {uncategorized.length > 0 && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold">Uncategorized</h3>
          <TaskTable tasks={uncategorized} onCycle={cycleStatus} onEdit={openEdit} onDelete={(id) => api.tasks.delete(id).then(refresh)} />
        </Card>
      )}

      {tasks.length === 0 && <EmptyState>No tasks yet across any category.</EmptyState>}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit task' : 'New task'} wide>
        <div className="space-y-3">
          <Field label="Title">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select
                value={form.category_id ?? ''}
                onChange={(e) => setForm({ ...form, category_id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Owner">
              <Input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority | '' })}>
                <option value="">(none)</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
            </Field>
            <Field label="Due date">
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </Field>
            <Field label="Delivery type">
              <Select
                value={form.delivery_type}
                onChange={(e) => setForm({ ...form, delivery_type: e.target.value as DeliveryType | '' })}
              >
                <option value="">(none)</option>
                {Object.entries(deliveryTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="flex justify-end">
            <Button onClick={save}>{editingId ? 'Save' : 'Create'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function TaskTable({
  tasks,
  onCycle,
  onEdit,
  onDelete
}: {
  tasks: ProjectTask[]
  onCycle: (t: ProjectTask) => void
  onEdit: (t: ProjectTask) => void
  onDelete: (id: number) => void
}): React.JSX.Element {
  const [menu, setMenu] = useState<{ taskId: number; x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    function onDocClick(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null)
    }
    function onEscape(e: KeyboardEvent): void {
      if (e.key === 'Escape') setMenu(null)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEscape)
    }
  }, [menu])

  return (
    <>
      <table className="w-full text-sm">
        <tbody>
          {tasks.map((t) => (
          <tr
            key={t.id}
            className="border-t border-slate-100 first:border-0"
            onContextMenu={(e) => {
              e.preventDefault()
              setMenu({ taskId: t.id, x: e.clientX, y: e.clientY })
            }}
          >
            <td className="py-1.5 pr-2 align-top">
              <button onClick={() => onCycle(t)}>
                <Badge tone={t.status === 'done' ? 'green' : t.status === 'blocked' ? 'red' : t.status === 'in_progress' ? 'yellow' : 'slate'}>
                  {t.status.replace('_', ' ')}
                </Badge>
              </button>
            </td>
            <td className="py-1.5 pr-2 align-top">
              <button onClick={() => onEdit(t)} className="text-left hover:underline">
                {t.title}
              </button>
              {t.notes && <div className="mt-0.5 max-w-xs truncate text-xs text-slate-400">{t.notes}</div>}
              {t.source_note_title && (
                <Link
                  to={`?tab=notes&note=${t.source_note_id}`}
                  className="mt-0.5 block truncate text-xs text-blue-500 hover:underline"
                >
                  From note: {t.source_note_title}
                </Link>
              )}
            </td>
            <td className="py-1.5 pr-2 align-top">
              {t.priority && <Badge tone={priorityTone[t.priority]}>{t.priority}</Badge>}
            </td>
            <td className="py-1.5 pr-2 align-top">
              {t.delivery_type && <Badge tone={deliveryTypeTone[t.delivery_type]}>{deliveryTypeLabels[t.delivery_type]}</Badge>}
            </td>
            <td className="py-1.5 pr-2 align-top text-slate-500">{t.owner || '—'}</td>
            <td className="py-1.5 pr-2 align-top whitespace-nowrap text-slate-500">
              {formatDateWithWeekday(t.due_date)}
              {t.status !== 'done' && isOverdue(t.due_date) && <Badge tone="red">overdue</Badge>}
            </td>
            <td className="py-1.5 pl-2 align-top whitespace-nowrap text-right text-slate-500">
              {daysUntilDue(t.due_date)}
            </td>
          </tr>
          ))}
        </tbody>
      </table>
      {menu && (
        <div
          ref={menuRef}
          className="fixed z-50 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          style={{ top: menu.y, left: menu.x }}
        >
          <button
            onClick={() => {
              onDelete(menu.taskId)
              setMenu(null)
            }}
            className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Delete task
          </button>
        </div>
      )}
    </>
  )
}
