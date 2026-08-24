import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import type { ScheduleItem, ScheduleStatus, ExcelPreview, PdfScheduleRow } from '@shared/types'
import { Badge, Button, Card, Field, Input, Modal, Select, Textarea, EmptyState } from '../../components/ui'
import { formatDate, isOverdue, isEffectivelyDone } from '../../lib/format'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday as the start of the week
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  return monday
}

type SortKey = 'name' | 'due_date' | 'start_date' | 'resource_names' | 'notes' | 'status'
type ColKey = 'status' | 'name' | 'da_item' | 'start_date' | 'due_date' | 'resource_names' | 'notes'

const DEFAULT_COL_WIDTHS: Record<ColKey, number> = {
  status: 120,
  name: 260,
  da_item: 90,
  start_date: 110,
  due_date: 140,
  resource_names: 200,
  notes: 240
}

const COLUMN_LABELS: { key: ColKey; label: string; sortKey?: SortKey }[] = [
  { key: 'status', label: 'Status', sortKey: 'status' },
  { key: 'name', label: 'Name', sortKey: 'name' },
  { key: 'da_item', label: 'DA Item' },
  { key: 'start_date', label: 'Start', sortKey: 'start_date' },
  { key: 'due_date', label: 'Due', sortKey: 'due_date' },
  { key: 'resource_names', label: 'Resources', sortKey: 'resource_names' },
  { key: 'notes', label: 'Notes', sortKey: 'notes' }
]

export function ScheduleTab({ projectId }: { projectId: number }): React.JSX.Element {
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [pdfImportOpen, setPdfImportOpen] = useState(false)
  const [form, setForm] = useState({ name: '', due_date: '' })
  const [notesItem, setNotesItem] = useState<ScheduleItem | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [blockerDraft, setBlockerDraft] = useState('')

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | ScheduleStatus>('all')
  const [filterDaItem, setFilterDaItem] = useState<'all' | 'yes' | 'no'>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [colWidths, setColWidths] = useState<Record<ColKey, number>>(DEFAULT_COL_WIDTHS)
  const [sortKey, setSortKey] = useState<SortKey>('due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function applyThisWeek(): void {
    const monday = startOfWeek(new Date())
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    setFromDate(toIso(monday))
    setToDate(toIso(sunday))
  }

  function applyNextWeek(): void {
    const monday = startOfWeek(new Date())
    monday.setDate(monday.getDate() + 7)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    setFromDate(toIso(monday))
    setToDate(toIso(sunday))
  }

  function applyThisMonth(): void {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setFromDate(toIso(first))
    setToDate(toIso(last))
  }

  function refresh(): void {
    api.schedule.list(projectId).then(setItems)
  }
  useEffect(refresh, [projectId])

  async function addItem(): Promise<void> {
    if (!form.name.trim()) return
    await api.schedule.create({
      project_id: projectId,
      name: form.name,
      due_date: form.due_date || null,
      status: 'not_started',
      sort_order: items.length,
      watched: false,
      start_date: null,
      resource_names: null,
      notes: null,
      blocker: null,
      is_da_item: false
    })
    setForm({ name: '', due_date: '' })
    setAddOpen(false)
    refresh()
  }

  async function cycleStatus(item: ScheduleItem): Promise<void> {
    const next = item.status === 'not_started' ? 'in_progress' : item.status === 'in_progress' ? 'done' : 'not_started'
    await api.schedule.update(item.id, { status: next })
    refresh()
  }

  async function toggleWatch(item: ScheduleItem): Promise<void> {
    await api.schedule.update(item.id, { watched: !item.watched })
    refresh()
  }

  function openNotes(item: ScheduleItem): void {
    setNotesItem(item)
    setNotesDraft(item.notes ?? '')
    setBlockerDraft(item.blocker ?? '')
  }

  async function saveNotes(): Promise<void> {
    if (!notesItem) return
    await api.schedule.update(notesItem.id, { notes: notesDraft || null, blocker: blockerDraft || null })
    setNotesItem(null)
    refresh()
  }

  function toggleSort(key: SortKey): void {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function startResize(col: ColKey) {
    return (e: React.MouseEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startWidth = colWidths[col]
      function onMove(ev: MouseEvent): void {
        const next = Math.max(60, Math.min(700, startWidth + (ev.clientX - startX)))
        setColWidths((w) => ({ ...w, [col]: next }))
      }
      function onUp(): void {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    }
  }

  function ResizeHandle({ col }: { col: ColKey }): React.JSX.Element {
    return (
      <div
        onMouseDown={startResize(col)}
        title="Drag to resize"
        className="absolute -right-2 top-0 z-10 flex h-full w-4 cursor-col-resize select-none justify-center normal-case"
      >
        <div className="h-full w-1 rounded bg-slate-200 hover:bg-slate-400" />
      </div>
    )
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let result = items.filter((item) => {
      if (filterStatus !== 'all' && item.status !== filterStatus) return false
      if (filterDaItem === 'yes' && !item.is_da_item) return false
      if (filterDaItem === 'no' && item.is_da_item) return false
      if (fromDate && (!item.due_date || item.due_date < fromDate)) return false
      if (toDate && (!item.due_date || item.due_date > toDate)) return false
      if (q) {
        const haystack = `${item.name} ${item.notes ?? ''} ${item.resource_names ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
    result = [...result].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const dir = sortDir === 'asc' ? 1 : -1
      if (av === null || av === undefined) return bv === null || bv === undefined ? 0 : 1
      if (bv === null || bv === undefined) return -1
      return String(av).localeCompare(String(bv)) * dir
    })
    return result
  }, [items, search, filterStatus, filterDaItem, fromDate, toDate, sortKey, sortDir])

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setImportOpen(true)}>
          Import from Excel
        </Button>
        <Button variant="secondary" onClick={() => setPdfImportOpen(true)}>
          Import from PDF
        </Button>
        <Button onClick={() => setAddOpen(true)}>+ Add schedule item</Button>
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Input className="!w-56" placeholder="Search name, notes, resources…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select className="!w-40" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | ScheduleStatus)}>
            <option value="all">All statuses</option>
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </Select>
          <Select className="!w-36" value={filterDaItem} onChange={(e) => setFilterDaItem(e.target.value as 'all' | 'yes' | 'no')}>
            <option value="all">All items</option>
            <option value="yes">DA Item only</option>
            <option value="no">Non-DA Item</option>
          </Select>
          <Input
            type="date"
            title="Due from"
            className="!w-40"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <Input
            type="date"
            title="Due to"
            className="!w-40"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={applyThisWeek}>
              This week
            </Button>
            <Button variant="secondary" onClick={applyNextWeek}>
              Next week
            </Button>
            <Button variant="secondary" onClick={applyThisMonth}>
              This month
            </Button>
          </div>
          {(search || filterStatus !== 'all' || filterDaItem !== 'all' || fromDate || toDate) && (
            <button
              className="text-xs text-slate-400 hover:text-slate-600"
              onClick={() => {
                setSearch('')
                setFilterStatus('all')
                setFilterDaItem('all')
                setFromDate('')
                setToDate('')
              }}
            >
              Clear filters
            </button>
          )}
          <span className="ml-auto text-xs text-slate-400">
            {filtered.length} of {items.length}
          </span>
        </div>
      )}

      <Card className="!p-0 w-fit max-w-full overflow-x-auto">
        {items.length === 0 ? (
          <div className="p-6">
            <EmptyState>No schedule items yet.</EmptyState>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState>No schedule items match these filters.</EmptyState>
          </div>
        ) : (
          <table className="text-sm" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 32 }} />
              {COLUMN_LABELS.map((c) => (
                <col key={c.key} style={{ width: colWidths[c.key] }} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                <th className="px-3 py-2"></th>
                {COLUMN_LABELS.map((c) => (
                  <th key={c.key} className="relative px-3 py-2">
                    {c.sortKey ? (
                      <button
                        className={'flex items-center gap-1 hover:text-slate-700 ' + (sortKey === c.sortKey ? 'text-slate-700' : '')}
                        onClick={() => toggleSort(c.sortKey!)}
                      >
                        {c.label}
                        {sortKey === c.sortKey && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                      </button>
                    ) : (
                      c.label
                    )}
                    <ResizeHandle col={c.key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const autoCompleted = item.status !== 'done' && isEffectivelyDone(item)
                return (
                  <tr key={item.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 align-top">
                      <button
                        onClick={() => toggleWatch(item)}
                        title={item.watched ? 'Watched — won\'t auto-complete when overdue' : 'Watch this item'}
                        className={item.watched ? 'text-amber-500' : 'text-slate-300 hover:text-slate-400'}
                      >
                        ★
                      </button>
                    </td>
                    <td className="whitespace-normal break-words px-3 py-2 align-top">
                      {autoCompleted ? (
                        <span title="Overdue and not watched, so treated as done. Star this item to track its real status.">
                          <Badge tone="slate">done (auto)</Badge>
                        </span>
                      ) : (
                        <button onClick={() => cycleStatus(item)}>
                          <Badge tone={item.status === 'done' ? 'green' : item.status === 'in_progress' ? 'yellow' : 'slate'}>
                            {item.status.replace('_', ' ')}
                          </Badge>
                        </button>
                      )}
                    </td>
                    <td className="whitespace-normal break-words px-3 py-2 align-top">{item.name}</td>
                    <td className="whitespace-normal break-words px-3 py-2 align-top">
                      {item.is_da_item && <Badge tone="blue">DA Item</Badge>}
                    </td>
                    <td className="whitespace-normal break-words px-3 py-2 align-top text-slate-500">
                      {formatDate(item.start_date)}
                    </td>
                    <td className="whitespace-normal break-words px-3 py-2 align-top">
                      {formatDate(item.due_date)}
                      {isOverdue(item.due_date) && !isEffectivelyDone(item) && <Badge tone="red">overdue</Badge>}
                    </td>
                    <td className="whitespace-normal break-words px-3 py-2 align-top text-slate-500">
                      {item.resource_names || '—'}
                    </td>
                    <td className="whitespace-normal break-words px-3 py-2 align-top text-slate-500">
                      <button className="w-full whitespace-normal break-words text-left hover:underline" onClick={() => openNotes(item)}>
                        {item.notes || '+ add notes'}
                      </button>
                      {item.blocker && (
                        <div className="mt-0.5 whitespace-normal break-words text-xs text-red-500" title={item.blocker}>
                          ⚠ {item.blocker}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add schedule item">
        <div className="space-y-3">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Due date">
            <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </Field>
          <div className="flex justify-end">
            <Button onClick={addItem}>Add</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!notesItem} onClose={() => setNotesItem(null)} title={notesItem ? `Notes & blocker — ${notesItem.name}` : 'Notes'}>
        <div className="space-y-3">
          <Field label="Notes">
            <Textarea rows={4} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder="Add your own notes…" />
          </Field>
          <Field label="Blocker">
            <Textarea
              rows={2}
              value={blockerDraft}
              onChange={(e) => setBlockerDraft(e.target.value)}
              placeholder="What's blocking this item? Leave blank if nothing."
            />
          </Field>
          <div className="flex justify-end">
            <Button onClick={saveNotes}>Save</Button>
          </div>
        </div>
      </Modal>

      <ExcelImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        projectId={projectId}
        existingCount={items.length}
        onImported={refresh}
      />

      <PdfImportModal
        open={pdfImportOpen}
        onClose={() => setPdfImportOpen(false)}
        projectId={projectId}
        existingCount={items.length}
        onImported={refresh}
      />
    </div>
  )
}

function ExcelImportModal({
  open,
  onClose,
  projectId,
  existingCount,
  onImported
}: {
  open: boolean
  onClose: () => void
  projectId: number
  existingCount: number
  onImported: () => void
}): React.JSX.Element {
  const [filePath, setFilePath] = useState<string | null>(null)
  const [preview, setPreview] = useState<ExcelPreview | null>(null)
  const [nameCol, setNameCol] = useState('')
  const [dueCol, setDueCol] = useState('')
  const [startCol, setStartCol] = useState('')
  const [resourceCol, setResourceCol] = useState('')
  const [flagCol, setFlagCol] = useState('')
  const [taskTitleCol, setTaskTitleCol] = useState('')
  const [taskDeliveryCol, setTaskDeliveryCol] = useState('')
  const [replaceExisting, setReplaceExisting] = useState(existingCount > 0)
  const [result, setResult] = useState<{ count: number; tasksCreated: number } | null>(null)
  const [busy, setBusy] = useState(false)

  function reset(): void {
    setFilePath(null)
    setPreview(null)
    setNameCol('')
    setDueCol('')
    setStartCol('')
    setResourceCol('')
    setFlagCol('')
    setTaskTitleCol('')
    setTaskDeliveryCol('')
    setReplaceExisting(existingCount > 0)
    setResult(null)
  }

  function guessColumn(headers: string[], candidates: string[]): string {
    const lower = headers.map((h) => h.toLowerCase().trim())
    for (const c of candidates) {
      const idx = lower.indexOf(c)
      if (idx !== -1) return headers[idx]
    }
    return ''
  }

  function applyGuesses(headers: string[]): void {
    setNameCol(guessColumn(headers, ['task name', 'name', 'title']) || headers[0] || '')
    setDueCol(guessColumn(headers, ['finish', 'due date', 'due', 'end date', 'finishdate']))
    setStartCol(guessColumn(headers, ['start', 'start date', 'startdate']))
    setResourceCol(guessColumn(headers, ['resource names', 'resources']))
    setFlagCol(guessColumn(headers, ['kd notes', 'flag', 'flag notes']))
    setTaskTitleCol(guessColumn(headers, ['task']))
    setTaskDeliveryCol(guessColumn(headers, ['delivery type', 'delivery']))
  }

  async function pickFile(): Promise<void> {
    const path = await api.files.pickExcelFile()
    if (!path) return
    setFilePath(path)
    const p = await api.excel.preview(path)
    setPreview(p)
    applyGuesses(p.headers)
  }

  async function changeSheet(sheetName: string): Promise<void> {
    if (!filePath) return
    const p = await api.excel.preview(filePath, sheetName)
    setPreview(p)
    applyGuesses(p.headers)
  }

  async function doImport(): Promise<void> {
    if (!filePath || !preview || !nameCol) return
    setBusy(true)
    try {
      const r = await api.excel.import(
        projectId,
        filePath,
        preview.activeSheet,
        {
          name: nameCol,
          due_date: dueCol || undefined,
          start_date: startCol || undefined,
          resource_names: resourceCol || undefined,
          flag_notes: flagCol || undefined,
          task_title: taskTitleCol || undefined,
          task_delivery_type: taskDeliveryCol || undefined
        },
        replaceExisting
      )
      setResult({ count: r.count, tasksCreated: r.tasksCreated })
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
      title="Import schedule from Excel"
      wide
    >
      {result ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Imported <strong>{result.count}</strong> schedule item{result.count === 1 ? '' : 's'}
            {result.tasksCreated > 0 && (
              <>
                {' '}
                and created <strong>{result.tasksCreated}</strong> task{result.tasksCreated === 1 ? '' : 's'}
              </>
            )}
            .
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
            Pick an .xlsx file with your project schedule. You'll map which columns are the name and due date next.
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
          {!dueCol && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              No due date column was detected on this sheet — double check you picked the right sheet (a metadata or
              summary tab won't have task dates). You can still import without one, but items won't show up on
              deadline/overdue views.
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Name column">
              <Select value={nameCol} onChange={(e) => setNameCol(e.target.value)}>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Due date column">
              <Select value={dueCol} onChange={(e) => setDueCol(e.target.value)}>
                <option value="">(none)</option>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Start date column">
              <Select value={startCol} onChange={(e) => setStartCol(e.target.value)}>
                <option value="">(none)</option>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Resource names column">
              <Select value={resourceCol} onChange={(e) => setResourceCol(e.target.value)}>
                <option value="">(none)</option>
                {preview.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="rounded-md border border-slate-200 p-3">
            <p className="mb-2 text-xs font-medium uppercase text-slate-400">
              Optional: flag rows &amp; generate tasks from this same file
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Flag column (e.g. your own notes column)">
                <Select value={flagCol} onChange={(e) => setFlagCol(e.target.value)}>
                  <option value="">(none)</option>
                  {preview.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Task title column">
                <Select value={taskTitleCol} onChange={(e) => setTaskTitleCol(e.target.value)}>
                  <option value="">(none)</option>
                  {preview.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Task delivery type column">
                <Select value={taskDeliveryCol} onChange={(e) => setTaskDeliveryCol(e.target.value)}>
                  <option value="">(none)</option>
                  {preview.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Rows with a non-empty value in the flag column are marked watched and shown as a "DA Item" on the
              schedule. A task is only created for rows that also have a value in the task title column — its due
              date always matches the schedule row's due date, and the delivery type column maps onto that task.
            </p>
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
          {existingCount > 0 && (
            <label className="flex items-start gap-2 rounded-md border border-slate-200 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
              />
              <span>
                Replace this project&apos;s existing {existingCount} schedule item{existingCount === 1 ? '' : 's'} with
                this import.
                {replaceExisting ? (
                  <span className="block text-red-600">
                    The existing items will be deleted first — any manual status, notes, or watch flags on them will be
                    lost.
                  </span>
                ) : (
                  <span className="block text-slate-400">
                    Unchecked, this import adds new rows alongside the existing ones instead of replacing them.
                  </span>
                )}
              </span>
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPreview(null)}>
              Back
            </Button>
            <Button disabled={!nameCol || busy} onClick={doImport}>
              {busy ? 'Importing…' : 'Import'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function PdfImportModal({
  open,
  onClose,
  projectId,
  existingCount,
  onImported
}: {
  open: boolean
  onClose: () => void
  projectId: number
  existingCount: number
  onImported: () => void
}): React.JSX.Element {
  const [filePath, setFilePath] = useState<string | null>(null)
  const [rows, setRows] = useState<PdfScheduleRow[] | null>(null)
  const [flagged, setFlagged] = useState<boolean[]>([])
  const [replaceExisting, setReplaceExisting] = useState(existingCount > 0)
  const [result, setResult] = useState<{ count: number; tasksCreated: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset(): void {
    setFilePath(null)
    setRows(null)
    setFlagged([])
    setReplaceExisting(existingCount > 0)
    setResult(null)
    setError(null)
  }

  async function pickFile(): Promise<void> {
    const path = await api.files.pickPdfFile()
    if (!path) return
    setBusy(true)
    setError(null)
    try {
      setFilePath(path)
      const extracted = await api.pdf.previewSchedule(path)
      if (extracted.length === 0) {
        setError(
          "Couldn't find a recognizable schedule table in this PDF (expects an \"Action/Deadline\", \"Date\", \"Notes\" style table, like the standard Prescriptive project plan). You can still add these manually, or try Import from Excel if you have a spreadsheet version."
        )
        return
      }
      setRows(extracted)
      setFlagged(extracted.map(() => false))
    } finally {
      setBusy(false)
    }
  }

  function toggleAll(value: boolean): void {
    setFlagged((f) => f.map(() => value))
  }

  async function doImport(): Promise<void> {
    if (!filePath || !rows) return
    setBusy(true)
    try {
      const payload = rows.map((r, i) => ({ ...r, flagged: flagged[i] }))
      const r = await api.pdf.importSchedule(projectId, filePath, payload, replaceExisting)
      setResult({ count: r.count, tasksCreated: r.tasksCreated })
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
      title="Import schedule from PDF"
      wide
    >
      {result ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Imported <strong>{result.count}</strong> schedule item{result.count === 1 ? '' : 's'}
            {result.tasksCreated > 0 && (
              <>
                {' '}
                and created <strong>{result.tasksCreated}</strong> task{result.tasksCreated === 1 ? '' : 's'}
              </>
            )}
            .
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
      ) : !rows ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Pick a PDF project plan (like the standard Prescriptive template). The Action/Deadline, Date, and Notes
            table is extracted automatically — no column mapping needed, since a PDF isn&apos;t a real spreadsheet grid.
          </p>
          {error && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">{error}</p>}
          <Button disabled={busy} onClick={pickFile}>
            {busy ? 'Reading…' : 'Choose file…'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Found {rows.length} row{rows.length === 1 ? '' : 's'}. Check which ones should also generate a task.
            </p>
            <div className="flex gap-2 text-xs">
              <button className="text-slate-400 hover:text-slate-700" onClick={() => toggleAll(true)}>
                Select all
              </button>
              <button className="text-slate-400 hover:text-slate-700" onClick={() => toggleAll(false)}>
                Select none
              </button>
            </div>
          </div>
          <div className="max-h-72 overflow-auto rounded border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-2 py-1 text-left font-medium text-slate-500">Task?</th>
                  <th className="px-2 py-1 text-left font-medium text-slate-500">Name</th>
                  <th className="px-2 py-1 text-left font-medium text-slate-500">Date</th>
                  <th className="px-2 py-1 text-left font-medium text-slate-500">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        checked={flagged[i] ?? false}
                        onChange={(e) =>
                          setFlagged((f) => f.map((v, idx) => (idx === i ? e.target.checked : v)))
                        }
                      />
                    </td>
                    <td className="px-2 py-1">{r.name}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{r.due_date ? formatDate(r.due_date) : '—'}</td>
                    <td className="px-2 py-1">{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {existingCount > 0 && (
            <label className="flex items-start gap-2 rounded-md border border-slate-200 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
              />
              <span>
                Replace this project&apos;s existing {existingCount} schedule item{existingCount === 1 ? '' : 's'} with
                this import.
                {replaceExisting ? (
                  <span className="block text-red-600">
                    The existing items will be deleted first — any manual status, notes, or watch flags on them will be
                    lost.
                  </span>
                ) : (
                  <span className="block text-slate-400">
                    Unchecked, this import adds new rows alongside the existing ones instead of replacing them.
                  </span>
                )}
              </span>
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRows(null)}>
              Back
            </Button>
            <Button disabled={busy} onClick={doImport}>
              {busy ? 'Importing…' : 'Import'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
