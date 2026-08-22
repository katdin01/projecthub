import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { Project, ProjectInput, ProjectStatus, ProjectType } from '@shared/types'
import { Badge, Button, Card, Field, Input, Modal, Select } from '../components/ui'
import { formatDate } from '../lib/format'

const statusTone: Record<ProjectStatus, 'slate' | 'green' | 'yellow' | 'red' | 'blue' | 'purple'> = {
  active: 'green',
  at_risk: 'red',
  on_hold: 'yellow',
  completed: 'blue',
  cancelled: 'slate',
  archived: 'purple'
}

const projectTypeTone: Record<ProjectType, 'slate' | 'orange'> = {
  enterprise: 'slate',
  prescriptive: 'orange'
}

const projectTypeLabel: Record<ProjectType, string> = {
  enterprise: 'Enterprise',
  prescriptive: 'Prescriptive'
}

type SortKey = 'project_name' | 'status' | 'phase' | 'source' | 'target_go_live' | 'hours_consumed'

const emptyForm: ProjectInput = {
  client_name: '',
  site_id: '',
  status: 'active',
  project_type: 'enterprise',
  phase: null,
  start_date: '',
  target_go_live: '',
  pm_name: '',
  business_consultant_name: '',
  source: '',
  client_location: '',
  client_time_zone: ''
}

export function ProjectsList(): React.JSX.Element {
  const [projects, setProjects] = useState<Project[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<ProjectInput>(emptyForm)
  const [sortKey, setSortKey] = useState<SortKey>('target_go_live')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function refresh(): void {
    api.projects.list(showArchived).then(setProjects)
  }

  useEffect(refresh, [showArchived])

  function toggleSort(key: SortKey): void {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    return [...projects].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const dir = sortDir === 'asc' ? 1 : -1
      if (av === null || av === undefined) return bv === null || bv === undefined ? 0 : 1
      if (bv === null || bv === undefined) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }, [projects, sortKey, sortDir])

  async function submit(): Promise<void> {
    if (!form.client_name.trim()) return
    await api.projects.create(form)
    setForm(emptyForm)
    setModalOpen(false)
    refresh()
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-slate-500">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived
          </label>
          <Button onClick={() => setModalOpen(true)}>+ New Project</Button>
        </div>
      </div>

      <Card className="!p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
              {(
                [
                  ['project_name', 'Client / Project'],
                  ['status', 'Status'],
                  ['phase', 'Phase'],
                  ['source', 'Source'],
                  ['target_go_live', 'Go-live'],
                  ['hours_consumed', 'Hours']
                ] as [SortKey, string][]
              ).map(([key, label]) => (
                <th key={key} className="px-4 py-2">
                  <button
                    className={'flex items-center gap-1 hover:text-slate-700 ' + (sortKey === key ? 'text-slate-700' : '')}
                    onClick={() => toggleSort(key)}
                  >
                    {label}
                    {sortKey === key && <span>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr
                key={p.id}
                className={'border-b border-slate-100 last:border-0 hover:bg-slate-50' + (p.archived_at ? ' opacity-60' : '')}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <Link to={`/projects/${p.id}`} className="font-medium hover:underline">
                      {p.project_name}
                    </Link>
                    <Badge tone={projectTypeTone[p.project_type]}>{projectTypeLabel[p.project_type]}</Badge>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <Badge tone={statusTone[p.status]}>{p.status.replace('_', ' ')}</Badge>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{p.phase || '—'}</td>
                <td className="px-4 py-2.5 text-slate-500">{p.source || '—'}</td>
                <td className="px-4 py-2.5 text-slate-500">{formatDate(p.target_go_live)}</td>
                <td className="px-4 py-2.5 text-slate-500">
                  {p.hours_consumed.toFixed(0)} / {p.hours_budgeted.toFixed(0)}h
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No projects yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Project" wide>
        <div className="mb-3">
          <Field label="Project type">
            <Select
              value={form.project_type}
              onChange={(e) => setForm({ ...form, project_type: e.target.value as ProjectType })}
            >
              <option value="enterprise">Enterprise</option>
              <option value="prescriptive">Prescriptive</option>
            </Select>
          </Field>
          <p className="mt-1 text-xs text-slate-400">
            {form.project_type === 'prescriptive'
              ? 'Same tabs as Enterprise, but Jira is labeled "Change Logs" and schedules are typically imported from a PDF project plan.'
              : 'The standard template — Jira ticket tracking, Excel schedule import.'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client name">
            <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
          </Field>
          <Field label="Site ID">
            <Input value={form.site_id ?? ''} onChange={(e) => setForm({ ...form, site_id: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}>
              <option value="active">Active</option>
              <option value="at_risk">At risk</option>
              <option value="on_hold">On hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
          <Field label="Start date">
            <Input type="date" value={form.start_date ?? ''} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </Field>
          <Field label="Target go-live">
            <Input
              type="date"
              value={form.target_go_live ?? ''}
              onChange={(e) => setForm({ ...form, target_go_live: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Create project</Button>
        </div>
      </Modal>
    </div>
  )
}
