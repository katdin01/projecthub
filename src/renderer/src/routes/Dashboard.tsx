import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { DashboardData, ProjectType, GeneralTask, GeneralTaskStatus } from '@shared/types'
import { Badge, Button, Card, Field, Input, Modal, SectionTitle, Textarea, EmptyState } from '../components/ui'
import { formatDate, isOverdue } from '../lib/format'

const projectTypeTone: Record<ProjectType, 'slate' | 'orange'> = {
  enterprise: 'slate',
  prescriptive: 'orange'
}

const projectTypeLabel: Record<ProjectType, string> = {
  enterprise: 'Enterprise',
  prescriptive: 'Prescriptive'
}

type BlockId = 'hoursSummary' | 'upcoming' | 'blockers' | 'questions'
const DEFAULT_ORDER: BlockId[] = ['hoursSummary', 'upcoming', 'blockers', 'questions']
const ORDER_STORAGE_KEY = 'dashboard-block-order'

// Local-only UI preference (not project data), so plain localStorage is
// enough — no need for a DB migration just to remember card order.
function loadBlockOrder(): BlockId[] {
  try {
    const stored = JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY) ?? '[]') as string[]
    const known = stored.filter((id): id is BlockId => (DEFAULT_ORDER as string[]).includes(id))
    const missing = DEFAULT_ORDER.filter((id) => !known.includes(id))
    return known.length > 0 ? [...known, ...missing] : DEFAULT_ORDER
  } catch {
    return DEFAULT_ORDER
  }
}

function BlockCard({
  id,
  title,
  draggedId,
  onDragStart,
  onDragEnd,
  onDrop,
  children
}: {
  id: BlockId
  title: React.ReactNode
  draggedId: BlockId | null
  onDragStart: (id: BlockId) => void
  onDragEnd: () => void
  onDrop: (id: BlockId) => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className={'mb-4 break-inside-avoid' + (draggedId === id ? ' opacity-40' : '')}>
      <Card>
        <div
          draggable
          onDragStart={() => onDragStart(id)}
          onDragEnd={onDragEnd}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            onDrop(id)
          }}
          title="Drag to reorder"
          className="mb-2 flex cursor-grab select-none items-center gap-1.5 active:cursor-grabbing"
        >
          <span className="text-slate-300">⠿</span>
          {title}
        </div>
        {children}
      </Card>
    </div>
  )
}

export function Dashboard(): React.JSX.Element {
  const [data, setData] = useState<DashboardData | null>(null)
  const [order, setOrder] = useState<BlockId[]>(loadBlockOrder)
  const [draggedId, setDraggedId] = useState<BlockId | null>(null)

  useEffect(() => {
    api.dashboard.get().then(setData)
  }, [])

  function handleDrop(targetId: BlockId): void {
    if (!draggedId || draggedId === targetId) return
    setOrder((prev) => {
      const next = prev.filter((id) => id !== draggedId)
      next.splice(next.indexOf(targetId), 0, draggedId)
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  if (!data) return <div className="p-8 text-sm text-slate-400">Loading…</div>

  const { activeProjects, upcoming, blockers, questions, recentActivity, hoursSummary } = data
  const pctConsumed = hoursSummary.budgeted > 0 ? Math.round((hoursSummary.consumed / hoursSummary.budgeted) * 100) : 0

  const blocks: Record<BlockId, React.ReactNode> = {
    hoursSummary: (
      <BlockCard
        id="hoursSummary"
        title={<SectionTitle>Hours Summary (active projects)</SectionTitle>}
        draggedId={draggedId}
        onDragStart={setDraggedId}
        onDragEnd={() => setDraggedId(null)}
        onDrop={handleDrop}
      >
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Budgeted</span>
            <span className="font-medium">{hoursSummary.budgeted.toFixed(1)}h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Consumed</span>
            <span className="font-medium">{hoursSummary.consumed.toFixed(1)}h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Remaining</span>
            <span className="font-medium">{hoursSummary.remaining.toFixed(1)}h</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={pctConsumed > 90 ? 'h-full bg-red-500' : 'h-full bg-slate-700'}
              style={{ width: `${Math.min(pctConsumed, 100)}%` }}
            />
          </div>
        </div>

        {activeProjects.length > 0 && (
          <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto border-t border-slate-100 pt-2 text-sm">
            {activeProjects.map((p) => {
              const pct = p.hours_budgeted > 0 ? Math.round((p.hours_consumed / p.hours_budgeted) * 100) : 0
              return (
                <li key={p.id}>
                  <Link
                    to={`/projects/${p.id}`}
                    className="flex items-center justify-between rounded px-1.5 py-1 hover:bg-slate-50"
                  >
                    <span className="truncate">{p.project_name}</span>
                    <span className="shrink-0 pl-2 text-xs text-slate-400">
                      {p.hours_consumed.toFixed(0)}/{p.hours_budgeted.toFixed(0)}h
                      {p.hours_budgeted > 0 && ` (${pct}%)`}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </BlockCard>
    ),
    upcoming: (
      <BlockCard
        id="upcoming"
        title={<SectionTitle>Upcoming Tasks (next 14 days)</SectionTitle>}
        draggedId={draggedId}
        onDragStart={setDraggedId}
        onDragEnd={() => setDraggedId(null)}
        onDrop={handleDrop}
      >
        {upcoming.length === 0 ? (
          <EmptyState>Nothing due soon.</EmptyState>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {upcoming.slice(0, 8).map((u, i) => (
              <li key={i} className="flex items-center justify-between">
                <Link to={`/projects/${u.project_id}`} className="hover:underline">
                  {formatDate(u.due_date)} — {u.project_name}: {u.name}
                </Link>
                {u.overdue && <Badge tone="red">overdue</Badge>}
              </li>
            ))}
          </ul>
        )}
      </BlockCard>
    ),
    blockers: (
      <BlockCard
        id="blockers"
        title={<SectionTitle>Open Blockers</SectionTitle>}
        draggedId={draggedId}
        onDragStart={setDraggedId}
        onDragEnd={() => setDraggedId(null)}
        onDrop={handleDrop}
      >
        {blockers.length === 0 ? (
          <EmptyState>No open blockers. 🎉</EmptyState>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {blockers.slice(0, 8).map((b, i) => (
              <li key={i}>
                <Link to={`/projects/${b.project_id}`} className="hover:underline">
                  <span className="font-medium">{b.project_name}:</span> {b.text}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </BlockCard>
    ),
    questions: (
      <BlockCard
        id="questions"
        title={<SectionTitle>Outstanding Questions</SectionTitle>}
        draggedId={draggedId}
        onDragStart={setDraggedId}
        onDragEnd={() => setDraggedId(null)}
        onDrop={handleDrop}
      >
        {questions.length === 0 ? (
          <EmptyState>No open questions.</EmptyState>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {questions.slice(0, 8).map((q, i) => (
              <li key={i}>
                <Link to={`/projects/${q.project_id}`} className="hover:underline">
                  <span className="font-medium">{q.project_name}:</span> {q.text}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </BlockCard>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link to="/projects" className="text-sm font-medium text-slate-600 hover:underline">
          View all projects →
        </Link>
      </div>

      {/* Active Projects — full width, one row per project */}
      <Card>
        <SectionTitle>Active Projects ({activeProjects.length})</SectionTitle>
        {activeProjects.length === 0 ? (
          <EmptyState>No active projects yet. Create one to get started.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2 font-medium">Project</th>
                  <th className="px-3 py-2 font-medium">Project Type</th>
                  <th className="px-3 py-2 font-medium">Phase</th>
                  <th className="px-3 py-2 font-medium">Business Consultant</th>
                  <th className="px-3 py-2 font-medium">Project Manager</th>
                </tr>
              </thead>
              <tbody>
                {activeProjects.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link to={`/projects/${p.id}`} className="font-medium hover:underline">
                        {p.project_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={projectTypeTone[p.project_type]}>{projectTypeLabel[p.project_type]}</Badge>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{p.phase || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{p.business_consultant_name || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{p.pm_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <GeneralTasksCard />

      <div className="columns-1 gap-4 md:columns-2">{order.map((id) => <div key={id}>{blocks[id]}</div>)}</div>

      <Card>
        <SectionTitle>Recent Activity</SectionTitle>
        {recentActivity.length === 0 ? (
          <EmptyState>No hours log entries yet.</EmptyState>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {recentActivity.map((r) => (
              <li key={r.id} className="flex justify-between">
                <Link to={r.project_id ? `/projects/${r.project_id}?tab=daily-log` : '/daily-log'} className="hover:underline">
                  {formatDate(r.log_date)} — {r.project_name ?? 'General'}: {r.work_completed?.slice(0, 80) || '(no summary)'}
                </Link>
                <span className="shrink-0 pl-2 text-xs text-slate-400">{r.hours_spent}h</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

const emptyGeneralForm = { title: '', due_date: '', notes: '', status: 'open' as GeneralTaskStatus }

// Non-project to-dos, managed right on the dashboard: title, due date, notes.
function GeneralTasksCard(): React.JSX.Element {
  const [tasks, setTasks] = useState<GeneralTask[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyGeneralForm)

  function refresh(): void {
    api.generalTasks.list().then(setTasks)
  }
  useEffect(refresh, [])

  function openNew(): void {
    setForm(emptyGeneralForm)
    setEditingId(null)
    setModalOpen(true)
  }
  function openEdit(t: GeneralTask): void {
    setForm({ title: t.title, due_date: t.due_date ?? '', notes: t.notes ?? '', status: t.status })
    setEditingId(t.id)
    setModalOpen(true)
  }
  async function save(): Promise<void> {
    if (!form.title.trim()) return
    const payload = {
      title: form.title.trim(),
      due_date: form.due_date || null,
      notes: form.notes || null,
      status: form.status
    }
    if (editingId) await api.generalTasks.update(editingId, payload)
    else await api.generalTasks.create(payload)
    setModalOpen(false)
    refresh()
  }
  async function toggleDone(t: GeneralTask): Promise<void> {
    await api.generalTasks.update(t.id, { status: t.status === 'done' ? 'open' : 'done' })
    refresh()
  }
  async function remove(id: number): Promise<void> {
    if (!confirm('Delete this to-do?')) return
    await api.generalTasks.delete(id)
    refresh()
  }

  const openCount = tasks.filter((t) => t.status !== 'done').length

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <SectionTitle>General To-Dos{openCount > 0 ? ` (${openCount} open)` : ''}</SectionTitle>
        <Button onClick={openNew}>+ Add</Button>
      </div>
      {tasks.length === 0 ? (
        <EmptyState>No general to-dos yet. Add one that isn&apos;t tied to a project.</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start gap-2 py-2">
              <input type="checkbox" className="mt-1" checked={t.status === 'done'} onChange={() => toggleDone(t)} />
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => openEdit(t)}
                  className={'text-left text-sm hover:underline ' + (t.status === 'done' ? 'text-slate-400 line-through' : '')}
                >
                  {t.title}
                </button>
                {t.notes && <div className="mt-0.5 whitespace-pre-wrap text-xs text-slate-400">{t.notes}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {t.due_date && (
                  <span className="flex items-center gap-1 whitespace-nowrap text-xs text-slate-500">
                    {formatDate(t.due_date)}
                    {t.status !== 'done' && isOverdue(t.due_date) && <Badge tone="red">overdue</Badge>}
                  </span>
                )}
                <button onClick={() => remove(t.id)} className="text-xs text-slate-300 hover:text-red-500" title="Delete">
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit to-do' : 'New to-do'}>
        <div className="space-y-3">
          <Field label="Task">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs doing?" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date">
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </Field>
            <Field label="Status">
              <label className="flex items-center gap-2 pt-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.status === 'done'}
                  onChange={(e) => setForm({ ...form, status: e.target.checked ? 'done' : 'open' })}
                />
                Done
              </label>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="flex justify-end">
            <Button onClick={save}>{editingId ? 'Save' : 'Add'}</Button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
