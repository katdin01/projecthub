import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Project, ProjectPerson, ProjectSku, ProjectTask, DailyLog, JiraItem } from '@shared/types'
import { Badge, Button, Card, Field, Input, Modal, SectionTitle, Textarea, EmptyState } from '../../components/ui'
import { DailyLogHistory } from '../../components/DailyLogHistory'
import { formatDate, daysUntilDue, isJiraExternallyResolved } from '../../lib/format'

const emptyClientForm = { name: '', role: '', email: '', is_primary_contact: false }
const emptySkuForm = { sku: '', hours: '', notes: '' }

type BlockId = 'clientTeam' | 'hours' | 'upcomingTasks' | 'skus' | 'blockers'
const DEFAULT_BLOCK_ORDER: BlockId[] = ['clientTeam', 'hours', 'upcomingTasks', 'skus', 'blockers']
const BLOCK_ORDER_STORAGE_KEY = 'project-overview-block-order'

// Local-only UI preference (shared across all projects, like the Dashboard's
// card order), so plain localStorage is enough — no DB migration needed.
function loadBlockOrder(): BlockId[] {
  try {
    const stored = JSON.parse(localStorage.getItem(BLOCK_ORDER_STORAGE_KEY) ?? '[]') as string[]
    const known = stored.filter((id): id is BlockId => (DEFAULT_BLOCK_ORDER as string[]).includes(id))
    const missing = DEFAULT_BLOCK_ORDER.filter((id) => !known.includes(id))
    return known.length > 0 ? [...known, ...missing] : DEFAULT_BLOCK_ORDER
  } catch {
    return DEFAULT_BLOCK_ORDER
  }
}

function BlockCard({
  id,
  header,
  draggedId,
  onDragStart,
  onDragEnd,
  onDrop,
  children
}: {
  id: BlockId
  header: React.ReactNode
  draggedId: BlockId | null
  onDragStart: (id: BlockId) => void
  onDragEnd: () => void
  onDrop: (id: BlockId) => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      className={'mb-4 break-inside-avoid' + (draggedId === id ? ' opacity-40' : '')}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        onDrop(id)
      }}
    >
      <Card>
        <div className="mb-2 flex items-center gap-1.5">
          <span
            draggable
            onDragStart={() => onDragStart(id)}
            onDragEnd={onDragEnd}
            title="Drag to reorder"
            className="shrink-0 cursor-grab select-none text-slate-300 active:cursor-grabbing"
          >
            ⠿
          </span>
          <div className="min-w-0 flex-1">{header}</div>
        </div>
        {children}
      </Card>
    </div>
  )
}

export function OverviewTab({ project }: { project: Project; onChange: () => void }): React.JSX.Element {
  const [people, setPeople] = useState<ProjectPerson[]>([])
  const [skus, setSkus] = useState<ProjectSku[]>([])
  const [tasks, setTasks] = useState<ProjectTask[]>([])
  const [dailyLogs, setDailyLogs] = useState<(DailyLog & { project_name: string | null })[]>([])
  const [jiraItems, setJiraItems] = useState<JiraItem[]>([])
  const [clientTeamOpen, setClientTeamOpen] = useState(true)
  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [editingClientId, setEditingClientId] = useState<number | null>(null)
  const [clientForm, setClientForm] = useState(emptyClientForm)
  const [skuModalOpen, setSkuModalOpen] = useState(false)
  const [editingSkuId, setEditingSkuId] = useState<number | null>(null)
  const [skuForm, setSkuForm] = useState(emptySkuForm)
  const [blockOrder, setBlockOrder] = useState<BlockId[]>(loadBlockOrder)
  const [draggedBlockId, setDraggedBlockId] = useState<BlockId | null>(null)

  function handleBlockDrop(targetId: BlockId): void {
    if (!draggedBlockId || draggedBlockId === targetId) return
    setBlockOrder((prev) => {
      const next = prev.filter((id) => id !== draggedBlockId)
      next.splice(next.indexOf(targetId), 0, draggedBlockId)
      localStorage.setItem(BLOCK_ORDER_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  function refresh(): void {
    api.people.list(project.id).then(setPeople)
    api.skus.list(project.id).then(setSkus)
    api.tasks.list(project.id).then(setTasks)
    api.dailyLogs.list({ projectId: project.id, limit: 8 }).then(setDailyLogs)
    api.jira.list(project.id).then(setJiraItems)
  }

  useEffect(refresh, [project.id])

  function openNewClient(): void {
    setEditingClientId(null)
    setClientForm(emptyClientForm)
    setClientModalOpen(true)
  }

  function openEditClient(p: ProjectPerson): void {
    setEditingClientId(p.id)
    setClientForm({ name: p.name, role: p.role, email: p.email ?? '', is_primary_contact: p.is_primary_contact })
    setClientModalOpen(true)
  }

  async function saveClient(): Promise<void> {
    if (!clientForm.name.trim()) return
    const payload = {
      project_id: project.id,
      team: 'client' as const,
      role: clientForm.role,
      name: clientForm.name,
      email: clientForm.email || null,
      is_primary_contact: clientForm.is_primary_contact,
      notes: null
    }
    if (editingClientId) {
      await api.people.update(editingClientId, payload)
    } else {
      await api.people.add(payload)
    }
    setClientModalOpen(false)
    refresh()
  }

  function openNewSku(): void {
    setEditingSkuId(null)
    setSkuForm(emptySkuForm)
    setSkuModalOpen(true)
  }

  function openEditSku(s: ProjectSku): void {
    setEditingSkuId(s.id)
    setSkuForm({ sku: s.sku, hours: s.hours?.toString() ?? '', notes: s.notes ?? '' })
    setSkuModalOpen(true)
  }

  async function saveSku(): Promise<void> {
    if (!skuForm.sku.trim()) return
    const payload = {
      project_id: project.id,
      sku: skuForm.sku,
      hours: skuForm.hours ? Number(skuForm.hours) : null,
      notes: skuForm.notes || null,
      sort_order: editingSkuId ? (skus.find((s) => s.id === editingSkuId)?.sort_order ?? 0) : skus.length
    }
    if (editingSkuId) {
      await api.skus.update(editingSkuId, payload)
    } else {
      await api.skus.create(payload)
    }
    setSkuModalOpen(false)
    refresh()
  }

  const clientPeople = people.filter((p) => p.team === 'client')

  // Includes tasks from every category — not just Data Conversion.
  const upcomingTasks = tasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    .slice(0, 5)

  const totalSkuHours = skus.reduce((sum, s) => sum + (s.hours ?? 0), 0)

  const latestLog = dailyLogs[0]
  const jiraBlockers = jiraItems.filter((j) => !isJiraExternallyResolved(j.external_status) && j.blockers && j.blockers.trim())
  const hasRisk = (latestLog?.blockers && latestLog.blockers.trim()) || (latestLog?.open_questions && latestLog.open_questions.trim()) || jiraBlockers.length > 0

  const blockCardProps = {
    draggedId: draggedBlockId,
    onDragStart: setDraggedBlockId,
    onDragEnd: () => setDraggedBlockId(null),
    onDrop: handleBlockDrop
  }

  const blocks: Record<BlockId, React.ReactNode> = {
    clientTeam: (
      <BlockCard
        id="clientTeam"
        {...blockCardProps}
        header={
          <button
            className="flex w-full items-center justify-between text-left"
            onClick={() => setClientTeamOpen((o) => !o)}
          >
            <SectionTitle>
              Client Team {!clientTeamOpen && clientPeople.length > 0 && `(${clientPeople.length})`}
            </SectionTitle>
            <span className="text-xs text-slate-400">{clientTeamOpen ? '▾ Collapse' : '▸ Expand'}</span>
          </button>
        }
      >
        {clientTeamOpen && (
          <>
            <div className="mb-2 flex justify-end">
              <Button variant="ghost" onClick={openNewClient}>
                + Add
              </Button>
            </div>
            {clientPeople.length === 0 ? (
              <EmptyState>No client contacts added yet.</EmptyState>
            ) : (
              <ul className="space-y-2 text-sm">
                {clientPeople.map((p) => (
                  <li key={p.id}>
                    <button className="w-full text-left hover:underline" onClick={() => openEditClient(p)}>
                      <div className="flex items-center gap-1.5 font-medium">
                        {p.name}
                        {p.is_primary_contact && <Badge tone="blue">primary</Badge>}
                      </div>
                      <div className="text-xs text-slate-400">
                        {p.role}
                        {p.email ? ` · ${p.email}` : ''}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </BlockCard>
    ),
    hours: (
      <BlockCard
        id="hours"
        {...blockCardProps}
        header={
          <div className="flex items-center justify-between">
            <SectionTitle>Hours</SectionTitle>
            <Link to="/daily-log" className="text-xs text-slate-400 hover:text-slate-700">
              View all →
            </Link>
          </div>
        }
      >
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Budgeted</span>
            <span className="font-medium">{project.hours_budgeted.toFixed(1)}h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Consumed</span>
            <span className="font-medium">{project.hours_consumed.toFixed(1)}h</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Remaining</span>
            <span className="font-medium">{(project.hours_budgeted - project.hours_consumed).toFixed(1)}h</span>
          </div>
        </div>
        <div className="mt-3 border-t border-slate-100 pt-3">
          <DailyLogHistory logs={dailyLogs} onChanged={refresh} />
        </div>
      </BlockCard>
    ),
    upcomingTasks: (
      <BlockCard id="upcomingTasks" {...blockCardProps} header={<SectionTitle>Upcoming Tasks</SectionTitle>}>
        {upcomingTasks.length === 0 ? (
          <EmptyState>Nothing upcoming.</EmptyState>
        ) : (
          <ul className="space-y-1 text-sm">
            {upcomingTasks.map((t) => (
              <li key={t.id}>
                <Link to={`?tab=tasks&task=${t.id}`} className="flex justify-between gap-2 hover:underline">
                  <span>
                    {formatDate(t.due_date)} — {t.title}
                  </span>
                  <span className="shrink-0 text-slate-400">{daysUntilDue(t.due_date)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </BlockCard>
    ),
    skus: (
      <BlockCard
        id="skus"
        {...blockCardProps}
        header={
          <div className="flex items-center justify-between">
            <SectionTitle>SKUs &amp; Hours {totalSkuHours > 0 && `(${totalSkuHours.toFixed(1)}h total)`}</SectionTitle>
            <Button variant="ghost" onClick={openNewSku}>
              + Add
            </Button>
          </div>
        }
      >
        {skus.length === 0 ? (
          <EmptyState>No SKUs added yet.</EmptyState>
        ) : (
          <ul className="space-y-2 text-sm">
            {skus.map((s) => (
              <li key={s.id} className="flex items-start justify-between">
                <button className="text-left hover:underline" onClick={() => openEditSku(s)}>
                  <div className="font-medium">
                    {s.sku}
                    {s.hours !== null && <span className="ml-2 text-xs text-slate-400">{s.hours}h</span>}
                  </div>
                  {s.notes && <div className="mt-0.5 max-w-xs text-xs text-slate-400">{s.notes}</div>}
                </button>
                <button
                  onClick={() => api.skus.delete(s.id).then(refresh)}
                  className="text-xs text-slate-400 hover:text-red-500"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </BlockCard>
    ),
    blockers: (
      <BlockCard id="blockers" {...blockCardProps} header={<SectionTitle>Blockers &amp; Open Questions</SectionTitle>}>
        {!hasRisk ? (
          <EmptyState>Nothing flagged.</EmptyState>
        ) : (
          <ul className="space-y-2 text-sm">
            {latestLog?.blockers && latestLog.blockers.trim() && (
              <li>
                <Badge tone="red">blocker</Badge> <span className="text-slate-500">({formatDate(latestLog.log_date)})</span>
                <div>{latestLog.blockers}</div>
              </li>
            )}
            {latestLog?.open_questions && latestLog.open_questions.trim() && (
              <li>
                <Badge tone="yellow">question</Badge> <span className="text-slate-500">({formatDate(latestLog.log_date)})</span>
                <div>{latestLog.open_questions}</div>
              </li>
            )}
            {jiraBlockers.map((j) => (
              <li key={j.id}>
                <Badge tone="red">blocker</Badge> <span className="text-slate-500">({j.issue_id})</span>
                <div>{j.blockers}</div>
              </li>
            ))}
          </ul>
        )}
      </BlockCard>
    )
  }

  return (
    <div className="columns-1 gap-4 md:columns-2">
      {blockOrder.map((id) => (
        <div key={id}>{blocks[id]}</div>
      ))}

      <Modal
        open={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        title={editingClientId ? 'Edit Client Contact' : 'Add Client Contact'}
      >
        <div className="space-y-3">
          <Field label="Name">
            <Input value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} />
          </Field>
          <Field label="Role">
            <Input
              value={clientForm.role}
              onChange={(e) => setClientForm({ ...clientForm, role: e.target.value })}
              placeholder="e.g. VP of Advancement"
            />
          </Field>
          <Field label="Email">
            <Input value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={clientForm.is_primary_contact}
              onChange={(e) => setClientForm({ ...clientForm, is_primary_contact: e.target.checked })}
            />
            Primary point of contact
          </label>
          <div className="flex justify-between">
            {editingClientId && (
              <Button
                variant="danger"
                onClick={() => api.people.remove(editingClientId).then(() => { setClientModalOpen(false); refresh() })}
              >
                Remove
              </Button>
            )}
            <Button onClick={saveClient} className="ml-auto">
              {editingClientId ? 'Save' : 'Add'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={skuModalOpen} onClose={() => setSkuModalOpen(false)} title={editingSkuId ? 'Edit SKU' : 'Add SKU'}>
        <div className="space-y-3">
          <Field label="SKU">
            <Input value={skuForm.sku} onChange={(e) => setSkuForm({ ...skuForm, sku: e.target.value })} />
          </Field>
          <Field label="Hours">
            <Input
              type="number"
              step="0.25"
              value={skuForm.hours}
              onChange={(e) => setSkuForm({ ...skuForm, hours: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <Textarea rows={3} value={skuForm.notes} onChange={(e) => setSkuForm({ ...skuForm, notes: e.target.value })} />
          </Field>
          <div className="flex justify-between">
            {editingSkuId && (
              <Button
                variant="danger"
                onClick={() => api.skus.delete(editingSkuId).then(() => { setSkuModalOpen(false); refresh() })}
              >
                Delete
              </Button>
            )}
            <Button onClick={saveSku} className="ml-auto">
              {editingSkuId ? 'Save' : 'Add'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
