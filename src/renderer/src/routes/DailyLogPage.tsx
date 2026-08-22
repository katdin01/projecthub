import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { DailyLog, Project } from '@shared/types'
import { DailyLogForm } from '../components/DailyLogForm'
import { DailyLogHistory } from '../components/DailyLogHistory'
import { Button, Field, Input, Modal, Select } from '../components/ui'

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

export function DailyLogPage(): React.JSX.Element {
  const [logs, setLogs] = useState<(DailyLog & { project_name: string | null })[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [filterProject, setFilterProject] = useState<number | 'all'>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [newEntryOpen, setNewEntryOpen] = useState(false)

  function refresh(): void {
    api.dailyLogs
      .list({
        ...(filterProject === 'all' ? {} : { projectId: filterProject }),
        ...(fromDate ? { fromDate } : {}),
        ...(toDate ? { toDate } : {})
      })
      .then(setLogs)
  }

  useEffect(() => {
    api.projects.list().then(setProjects)
  }, [])
  useEffect(refresh, [filterProject, fromDate, toDate])

  function applyThisWeek(): void {
    const now = new Date()
    const monday = startOfWeek(now)
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

  function clearDateFilters(): void {
    setFromDate('')
    setToDate('')
  }

  const totalHours = useMemo(() => logs.reduce((sum, l) => sum + l.hours_spent, 0), [logs])

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hours Log</h1>
        <Button onClick={() => setNewEntryOpen(true)}>+ New Entry</Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <Field label="Client / Project">
          <Select
            className="!w-56"
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From">
          <Input type="date" className="!w-40" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" className="!w-40" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </Field>
        <Button variant="secondary" onClick={applyThisWeek}>
          This week
        </Button>
        <Button variant="secondary" onClick={applyThisMonth}>
          This month
        </Button>
        {(fromDate || toDate || filterProject !== 'all') && (
          <button
            className="text-xs text-slate-400 hover:text-slate-600"
            onClick={() => {
              clearDateFilters()
              setFilterProject('all')
            }}
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-sm text-slate-500">
          {logs.length} {logs.length === 1 ? 'entry' : 'entries'} · <span className="font-medium text-slate-700">{totalHours}h total</span>
        </span>
      </div>

      <DailyLogHistory logs={logs} showProject onChanged={refresh} />

      <Modal open={newEntryOpen} onClose={() => setNewEntryOpen(false)} title="New Hours Log Entry" wide>
        <DailyLogForm
          projects={projects}
          onSaved={() => {
            setNewEntryOpen(false)
            refresh()
          }}
        />
      </Modal>
    </div>
  )
}
