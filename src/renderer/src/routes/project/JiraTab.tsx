import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../../lib/api'
import type { JiraItem, ExcelPreview, Project, JiraConnectionSummary, JiraInternalStatus } from '@shared/types'
import { JIRA_INTERNAL_STATUSES } from '@shared/types'
import { Badge, Button, Card, Field, Input, Modal, Select, EmptyState } from '../../components/ui'
import { formatDate, isJiraExternallyResolved } from '../../lib/format'

const internalStatusTone: Record<JiraInternalStatus, 'slate' | 'green' | 'yellow' | 'blue' | 'purple' | 'orange'> = {
  Open: 'slate',
  'Looked at - No Questions': 'blue',
  'Looked at - Questions': 'yellow',
  'Coded for': 'purple',
  'Internally QA-ed': 'orange',
  'Assigned Externally': 'green'
}

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

// Split a Jira key like "CORD-123" into prefix + number so tickets sort
// numerically (CORD-2 before CORD-10) rather than lexically.
function parseTicketNumber(id: string): { prefix: string; num: number } {
  const m = id.match(/^(.*?)(\d+)\s*$/)
  return m ? { prefix: m[1].toLowerCase(), num: parseInt(m[2], 10) } : { prefix: id.toLowerCase(), num: 0 }
}

const hasQuestions = (item: JiraItem): boolean => !!(item.questions && item.questions.trim())

const emptyForm = {
  jira_url: '',
  issue_id: '',
  issue_name: '',
  description: '',
  external_status: '',
  internal_status: 'Open' as JiraInternalStatus,
  priority: 'medium',
  assignee: '',
  source_table: '',
  source_field: '',
  target_table: '',
  target_field: ''
}

export function JiraTab({
  project,
  onProjectChange
}: {
  project: Project
  onProjectChange: () => void
}): React.JSX.Element {
  const projectId = project.id
  const label = project.project_type === 'prescriptive' ? 'Change Log' : 'Jira'
  const navigate = useNavigate()
  const [items, setItems] = useState<JiraItem[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [importOpen, setImportOpen] = useState(false)

  const [search, setSearch] = useState('')
  const [externalStatusFilter, setExternalStatusFilter] = useState('all')
  const [internalStatusFilter, setInternalStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [sourceTableFilter, setSourceTableFilter] = useState('all')
  const [questionsFilter, setQuestionsFilter] = useState('all')
  const [sortBy, setSortBy] = useState('updated')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [connections, setConnections] = useState<JiraConnectionSummary[] | null>(null)
  const [jqlDraft, setJqlDraft] = useState(project.jira_jql ?? '')
  const [syncBusy, setSyncBusy] = useState(false)

  function refresh(): void {
    api.jira.list(projectId).then(setItems)
  }
  useEffect(refresh, [projectId])
  useEffect(() => {
    api.jira.listConnections().then(setConnections)
  }, [])

  async function changeConnection(connectionId: string): Promise<void> {
    await api.jira.updateProjectSync(projectId, {
      jira_connection_id: connectionId || null,
      jira_jql: project.jira_jql,
      jira_auto_sync: project.jira_auto_sync
    })
    onProjectChange()
  }

  async function saveJql(): Promise<void> {
    await api.jira.updateProjectSync(projectId, {
      jira_connection_id: project.jira_connection_id,
      jira_jql: jqlDraft || null,
      jira_auto_sync: project.jira_auto_sync
    })
    onProjectChange()
  }

  async function toggleAutoSync(): Promise<void> {
    await api.jira.updateProjectSync(projectId, {
      jira_connection_id: project.jira_connection_id,
      jira_jql: project.jira_jql,
      jira_auto_sync: !project.jira_auto_sync
    })
    onProjectChange()
  }

  async function syncNow(): Promise<void> {
    setSyncBusy(true)
    try {
      await api.jira.syncNow(projectId)
      onProjectChange()
      refresh()
    } finally {
      setSyncBusy(false)
    }
  }

  function openNew(): void {
    setForm(emptyForm)
    setModalOpen(true)
  }

  async function create(): Promise<void> {
    if (!form.issue_id.trim() || !form.issue_name.trim()) return
    const created = await api.jira.create({
      project_id: projectId,
      ...form,
      internal_notes: null,
      technical_notes: null,
      questions: null,
      decisions: null,
      dependencies: null,
      blockers: null,
      resolution_details: null,
      sql_code: null
    })
    setModalOpen(false)
    navigate(`/projects/${projectId}/jira/${created.id}`)
  }

  const assignees = useMemo(
    () => Array.from(new Set(items.map((i) => i.assignee).filter((a): a is string => !!a))).sort(),
    [items]
  )
  const sourceTables = useMemo(
    () => Array.from(new Set(items.map((i) => i.source_table).filter((s): s is string => !!s))).sort(),
    [items]
  )
  // Raw Jira status text varies per workbook/site, so the filter options are
  // built from whatever's actually present rather than a fixed vocabulary.
  const externalStatuses = useMemo(
    () => Array.from(new Set(items.map((i) => i.external_status).filter((s): s is string => !!s))).sort(),
    [items]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (externalStatusFilter !== 'all' && item.external_status !== externalStatusFilter) return false
      if (internalStatusFilter !== 'all' && item.internal_status !== internalStatusFilter) return false
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) return false
      if (assigneeFilter !== 'all') {
        if (assigneeFilter === 'unassigned' ? item.assignee : item.assignee !== assigneeFilter) return false
      }
      if (sourceTableFilter !== 'all' && item.source_table !== sourceTableFilter) return false
      if (questionsFilter === 'yes' && !hasQuestions(item)) return false
      if (questionsFilter === 'no' && hasQuestions(item)) return false
      if (q && !`${item.issue_id} ${item.issue_name}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, search, externalStatusFilter, internalStatusFilter, priorityFilter, assigneeFilter, sourceTableFilter, questionsFilter])

  // Sorting is applied after filtering. "updated" keeps the server's order
  // (unresolved first, then most recently updated).
  const sorted = useMemo(() => {
    const arr = [...filtered]
    if (sortBy === 'priority') {
      arr.sort(
        (a, b) =>
          (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99) ||
          b.updated_at.localeCompare(a.updated_at)
      )
    } else if (sortBy === 'ticket') {
      arr.sort((a, b) => {
        const pa = parseTicketNumber(a.issue_id)
        const pb = parseTicketNumber(b.issue_id)
        return pa.prefix.localeCompare(pb.prefix) || pa.num - pb.num
      })
    }
    return arr
  }, [filtered, sortBy])

  const activeFilters = [
    search !== '',
    externalStatusFilter !== 'all',
    internalStatusFilter !== 'all',
    priorityFilter !== 'all',
    assigneeFilter !== 'all',
    sourceTableFilter !== 'all',
    questionsFilter !== 'all'
  ].filter(Boolean).length

  function clearFilters(): void {
    setSearch('')
    setExternalStatusFilter('all')
    setInternalStatusFilter('all')
    setPriorityFilter('all')
    setAssigneeFilter('all')
    setSourceTableFilter('all')
    setQuestionsFilter('all')
  }

  return (
    <div className="space-y-3">
      {connections !== null && connections.length === 0 ? (
        <Card className="bg-slate-50 text-sm text-slate-500">
          Add a Jira Cloud connection in{' '}
          <Link to="/settings" className="underline">
            Settings
          </Link>{' '}
          to enable automatic background sync for this project.
        </Card>
      ) : connections !== null ? (
        <Card>
          <div className="flex items-end gap-2">
            <Field label="Jira connection">
              <Select value={project.jira_connection_id ?? ''} onChange={(e) => changeConnection(e.target.value)}>
                <option value="">(none selected)</option>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex-1">
              <Field label="Auto-sync JQL query">
                <Input
                  disabled={!project.jira_connection_id}
                  placeholder='e.g. project = ABC AND fixVersion = "2026.3"'
                  value={jqlDraft}
                  onChange={(e) => setJqlDraft(e.target.value)}
                  onBlur={saveJql}
                />
              </Field>
            </div>
            <label className="mb-2 flex items-center gap-1.5 whitespace-nowrap text-sm">
              <input
                type="checkbox"
                checked={project.jira_auto_sync}
                disabled={!project.jira_connection_id}
                onChange={toggleAutoSync}
              />
              Auto-sync
            </label>
            <Button variant="secondary" disabled={syncBusy || !project.jira_connection_id || !project.jira_jql} onClick={syncNow}>
              {syncBusy ? 'Syncing…' : 'Sync now'}
            </Button>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {project.jira_last_sync_error ? (
              <span className="text-red-600">Last sync failed: {project.jira_last_sync_error}</span>
            ) : project.jira_last_synced_at ? (
              <>Last synced {formatDate(project.jira_last_synced_at)}</>
            ) : (
              'Not synced yet.'
            )}
            {' Runs automatically every 20 minutes while the app is open.'}
          </div>
        </Card>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setImportOpen(true)}>
          Import from {label} export
        </Button>
        <Button onClick={openNew}>+ Add {label} item</Button>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setFiltersOpen((o) => !o)}>
              {filtersOpen ? '▾' : '▸'} Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}
            </Button>
            {activeFilters > 0 && (
              <button className="text-xs text-slate-400 hover:text-slate-600" onClick={clearFilters}>
                Clear
              </button>
            )}
            <Select className="!w-52" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="updated">Sort: recently updated</option>
              <option value="priority">Sort: priority (high → low)</option>
              <option value="ticket">Sort: ticket number</option>
            </Select>
            <span className="ml-auto text-xs text-slate-400">
              {filtered.length} of {items.length}
            </span>
          </div>

          {filtersOpen && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
              <Input
                className="!w-56"
                placeholder="Search issue key or title…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select className="!w-44" value={externalStatusFilter} onChange={(e) => setExternalStatusFilter(e.target.value)}>
                <option value="all">Any Jira status</option>
                {externalStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Select className="!w-48" value={internalStatusFilter} onChange={(e) => setInternalStatusFilter(e.target.value)}>
                <option value="all">All internal statuses</option>
                {JIRA_INTERNAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Select className="!w-40" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                <option value="all">All priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
              <Select className="!w-48" value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
                <option value="all">All assignees</option>
                <option value="unassigned">Unassigned</option>
                {assignees.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
              {sourceTables.length > 0 && (
                <Select className="!w-48" value={sourceTableFilter} onChange={(e) => setSourceTableFilter(e.target.value)}>
                  <option value="all">All source tables</option>
                  {sourceTables.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              )}
              <Select className="!w-40" value={questionsFilter} onChange={(e) => setQuestionsFilter(e.target.value)}>
                <option value="all">Questions: any</option>
                <option value="yes">Has questions</option>
                <option value="no">No questions</option>
              </Select>
            </div>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState>No {label} items tracked yet.</EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState>No {label} items match these filters.</EmptyState>
      ) : (
        <div className="space-y-2">
          {sorted.map((item) => (
            <Card key={item.id} className="cursor-pointer">
              <div onClick={() => navigate(`/projects/${projectId}/jira/${item.id}`)} className="flex items-start justify-between">
                <div>
                  <div className="font-medium">
                    {item.issue_id} — {item.issue_name}
                  </div>
                  <div className="mt-1 flex gap-2 text-xs text-slate-400">
                    {item.external_status && (
                      <Badge tone={isJiraExternallyResolved(item.external_status) ? 'green' : 'slate'}>
                        {item.external_status}
                      </Badge>
                    )}
                    <Badge tone={internalStatusTone[item.internal_status]}>{item.internal_status}</Badge>
                    <Badge tone={item.priority === 'critical' || item.priority === 'high' ? 'red' : 'blue'}>{item.priority}</Badge>
                    {item.assignee ? <span>{item.assignee}</span> : <Badge tone="yellow">unassigned</Badge>}
                    {item.blockers && <Badge tone="red">blocked</Badge>}
                    {hasQuestions(item) && <Badge tone="yellow">questions</Badge>}
                  </div>
                  {(item.source_table || item.target_table) && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
                      {item.source_table && (
                        <span>
                          <span className="text-slate-400">Source:</span>{' '}
                          <span className="font-mono">
                            {item.source_table}
                            {item.source_field ? `.${item.source_field}` : ''}
                          </span>
                        </span>
                      )}
                      {item.target_table && (
                        <span>
                          <span className="text-slate-400">→ Target:</span>{' '}
                          <span className="font-mono">
                            {item.target_table}
                            {item.target_field ? `.${item.target_field}` : ''}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-xs text-slate-400">{formatDate(item.updated_at)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`New ${label} Item`} wide>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue ID">
              <Input value={form.issue_id} onChange={(e) => setForm({ ...form, issue_id: e.target.value })} placeholder="ABC-123" />
            </Field>
            <Field label="Jira URL">
              <Input value={form.jira_url} onChange={(e) => setForm({ ...form, jira_url: e.target.value })} />
            </Field>
          </div>
          <Field label="Issue name">
            <Input value={form.issue_name} onChange={(e) => setForm({ ...form, issue_name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="External status (from the ticket)">
              <Input
                value={form.external_status}
                onChange={(e) => setForm({ ...form, external_status: e.target.value })}
                placeholder="e.g. In Review"
              />
            </Field>
            <Field label="Internal status">
              <Select
                value={form.internal_status}
                onChange={(e) => setForm({ ...form, internal_status: e.target.value as JiraInternalStatus })}
              >
                {JIRA_INTERNAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
            </Field>
            <Field label="Assignee">
              <Input value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Source table">
              <Input
                value={form.source_table}
                onChange={(e) => setForm({ ...form, source_table: e.target.value })}
                placeholder="e.g. ActivityPointerBase"
              />
            </Field>
            <Field label="Source field">
              <Input
                value={form.source_field}
                onChange={(e) => setForm({ ...form, source_field: e.target.value })}
                placeholder="e.g. ActivityTypeCode"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target table">
              <Input
                value={form.target_table}
                onChange={(e) => setForm({ ...form, target_table: e.target.value })}
                placeholder="e.g. CONSTITUENT"
              />
            </Field>
            <Field label="Target field">
              <Input
                value={form.target_field}
                onChange={(e) => setForm({ ...form, target_field: e.target.value })}
                placeholder="e.g. LOOKUPID"
              />
            </Field>
          </div>
          <p className="text-xs text-slate-400">
            Notes, questions, decisions, dependencies, blockers, and resolution details can be filled in on the
            ticket's own page after creating it.
          </p>
          <div className="flex justify-end">
            <Button onClick={create}>Create</Button>
          </div>
        </div>
      </Modal>

      <JiraImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        projectId={projectId}
        label={label}
        onImported={refresh}
      />
    </div>
  )
}

const JIRA_FIELD_LABELS: {
  key: 'issue_name' | 'description' | 'external_status' | 'priority' | 'assignee' | 'jira_url'
  label: string
}[] = [
  { key: 'issue_name', label: 'Summary / issue name' },
  { key: 'external_status', label: 'External status' },
  { key: 'priority', label: 'Priority' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'jira_url', label: 'URL' },
  { key: 'description', label: 'Description' }
]

function JiraImportModal({
  open,
  onClose,
  projectId,
  label,
  onImported
}: {
  open: boolean
  onClose: () => void
  projectId: number
  label: string
  onImported: () => void
}): React.JSX.Element {
  const [filePath, setFilePath] = useState<string | null>(null)
  const [preview, setPreview] = useState<ExcelPreview | null>(null)
  const [issueIdCol, setIssueIdCol] = useState('')
  const [cols, setCols] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{ inserted: number; updated: number } | null>(null)
  const [busy, setBusy] = useState(false)

  function reset(): void {
    setFilePath(null)
    setPreview(null)
    setIssueIdCol('')
    setCols({})
    setResult(null)
  }

  function guessColumn(headers: string[], candidates: string[]): string {
    const lower = headers.map((h) => h.toLowerCase())
    for (const c of candidates) {
      const idx = lower.indexOf(c)
      if (idx !== -1) return headers[idx]
    }
    return ''
  }

  async function pickFile(): Promise<void> {
    const path = await api.files.pickJiraExportFile()
    if (!path) return
    setFilePath(path)
    const p = await api.excel.preview(path)
    setPreview(p)
    setIssueIdCol(guessColumn(p.headers, ['issue key', 'key']) || p.headers[0] || '')
    setCols({
      issue_name: guessColumn(p.headers, ['summary']),
      external_status: guessColumn(p.headers, ['status']),
      priority: guessColumn(p.headers, ['priority']),
      assignee: guessColumn(p.headers, ['assignee']),
      jira_url: guessColumn(p.headers, ['url', 'issue url']),
      description: guessColumn(p.headers, ['description'])
    })
  }

  async function changeSheet(sheetName: string): Promise<void> {
    if (!filePath) return
    const p = await api.excel.preview(filePath, sheetName)
    setPreview(p)
    setIssueIdCol(guessColumn(p.headers, ['issue key', 'key']) || p.headers[0] || '')
    setCols({})
  }

  async function doImport(): Promise<void> {
    if (!filePath || !preview || !issueIdCol) return
    setBusy(true)
    try {
      const columnMap = {
        issue_id: issueIdCol,
        issue_name: cols.issue_name || undefined,
        description: cols.description || undefined,
        external_status: cols.external_status || undefined,
        priority: cols.priority || undefined,
        assignee: cols.assignee || undefined,
        jira_url: cols.jira_url || undefined
      }
      const r = await api.excel.importJira(projectId, filePath, preview.activeSheet, columnMap)
      setResult({ inserted: r.inserted, updated: r.updated })
      onImported()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title={`Import from ${label} export`}
      wide
    >
      {result ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Import complete: <strong>{result.inserted}</strong> new issue{result.inserted === 1 ? '' : 's'} added,{' '}
            <strong>{result.updated}</strong> existing issue{result.updated === 1 ? '' : 's'} updated. Fields you manually
            fill in on the ProjectHub side (notes, questions, decisions, dependencies, blockers, resolution) are never
            touched by an import.
          </p>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                reset()
                onClose()
              }}
            >
              Done
            </Button>
          </div>
        </div>
      ) : !preview ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Pick a CSV (or Excel) file exported from a filtered Jira search. Matches are made on issue key (e.g.
            SMC-123): existing tickets are updated, new ones are added. Only columns you map below are synced —
            anything left unmapped won't overwrite existing data.
          </p>
          <Button onClick={pickFile}>Choose file…</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {preview.sheetNames.length > 1 && (
            <Field label="Sheet">
              <Select value={preview.activeSheet} onChange={(e) => changeSheet(e.target.value)}>
                {preview.sheetNames.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Issue key (required)">
              <Select value={issueIdCol} onChange={(e) => setIssueIdCol(e.target.value)}>
                <option value="">(select column)</option>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </Field>
            {JIRA_FIELD_LABELS.map((f) => (
              <Field key={f.key} label={f.label}>
                <Select value={cols[f.key] ?? ''} onChange={(e) => setCols({ ...cols, [f.key]: e.target.value })}>
                  <option value="">(don't sync)</option>
                  {preview.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
          <div className="max-h-56 overflow-auto rounded border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50">
                  {preview.headers.map((h) => (
                    <th key={h} className="px-2 py-1 text-left font-medium text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 8).map((row, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {row.map((cell, j) => (
                      <td key={j} className="px-2 py-1">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Back
            </Button>
            <Button disabled={!issueIdCol || busy} onClick={doImport}>
              {busy ? 'Importing…' : 'Import'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
