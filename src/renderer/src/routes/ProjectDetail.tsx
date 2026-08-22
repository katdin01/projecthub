import { useEffect, useState, useCallback } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Project, ProjectStatus } from '@shared/types'
import { Badge, Button, Field, Input, Select } from '../components/ui'
import { formatDate } from '../lib/format'
import { guessTimeZoneFromLocation } from '../lib/timezone'
import { OverviewTab } from './project/OverviewTab'
import { ScheduleTab } from './project/ScheduleTab'
import { TasksTab } from './project/TasksTab'
import { JiraTab } from './project/JiraTab'
import { NotesTab } from './project/NotesTab'
import { DocsTab } from './project/DocsTab'

function getTabs(project: Project): { key: string; label: string }[] {
  const jiraLabel = project.project_type === 'prescriptive' ? 'Change Logs' : 'Jira'
  return [
    { key: 'overview', label: 'Overview' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'jira', label: jiraLabel },
    { key: 'notes', label: 'Notes' },
    { key: 'docs', label: 'Docs' }
  ]
}

const statusTone: Record<ProjectStatus, 'slate' | 'green' | 'yellow' | 'red' | 'blue' | 'purple'> = {
  active: 'green',
  at_risk: 'red',
  on_hold: 'yellow',
  completed: 'blue',
  cancelled: 'slate',
  archived: 'purple'
}

export function ProjectDetail(): React.JSX.Element {
  const { id } = useParams()
  const projectId = Number(id)
  const [project, setProject] = useState<Project | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  const tab = searchParams.get('tab') ?? 'overview'

  const refresh = useCallback((): void => {
    api.projects.get(projectId).then((p) => setProject(p ?? null))
  }, [projectId])

  useEffect(refresh, [refresh])

  if (!project) return <div className="p-8 text-sm text-slate-400">Loading…</div>

  const pctConsumed = project.hours_budgeted > 0 ? Math.round((project.hours_consumed / project.hours_budgeted) * 100) : 0

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-8">
      <Link to="/projects" className="text-sm text-slate-500 hover:underline">
        ← Projects
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.project_name}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
            {project.phase && <span>Phase: {project.phase}</span>}
            <span>Go-live: {formatDate(project.target_go_live)}</span>
            <span>
              Hours: {project.hours_consumed.toFixed(0)}/{project.hours_budgeted.toFixed(0)}h ({pctConsumed}%)
            </span>
            {project.pm_name && <span>PM: {project.pm_name}</span>}
            {project.business_consultant_name && <span>BC: {project.business_consultant_name}</span>}
            {project.source && <span>Source: {project.source}</span>}
            {project.client_location && <span>Location: {project.client_location}</span>}
            {project.client_time_zone && <span>Time zone: {project.client_time_zone}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={statusTone[project.status]}>{project.status.replace('_', ' ')}</Badge>
          <Button variant="secondary" onClick={() => setEditing((e) => !e)}>
            {editing ? 'Close' : 'Edit'}
          </Button>
          {project.archived_at ? (
            <Button variant="secondary" onClick={() => api.projects.unarchive(project.id).then(refresh)}>
              Unarchive
            </Button>
          ) : (
            <Button variant="danger" onClick={() => api.projects.archive(project.id).then(refresh)}>
              Archive
            </Button>
          )}
        </div>
      </div>

      {editing && <EditForm project={project} onSaved={() => { setEditing(false); refresh() }} />}

      <div className="flex gap-1 border-b border-slate-200">
        {getTabs(project).map((t) => (
          <button
            key={t.key}
            onClick={() => setSearchParams({ tab: t.key })}
            className={
              'border-b-2 px-3 py-2 text-sm font-medium ' +
              (tab === t.key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'overview' && <OverviewTab project={project} onChange={refresh} />}
        {tab === 'schedule' && <ScheduleTab projectId={project.id} />}
        {tab === 'tasks' && (
          <TasksTab
            projectId={project.id}
            openTaskId={searchParams.get('task') ? Number(searchParams.get('task')) : null}
            onOpenTaskConsumed={() => {
              searchParams.delete('task')
              setSearchParams(searchParams, { replace: true })
            }}
          />
        )}
        {tab === 'jira' && <JiraTab key={project.id} project={project} onProjectChange={refresh} />}
        {tab === 'notes' && (
          <NotesTab
            projectId={project.id}
            openNoteId={searchParams.get('note') ? Number(searchParams.get('note')) : null}
            onOpenNoteConsumed={() => {
              searchParams.delete('note')
              setSearchParams(searchParams, { replace: true })
            }}
          />
        )}
        {tab === 'docs' && <DocsTab projectId={project.id} />}
      </div>
    </div>
  )
}

function EditForm({ project, onSaved }: { project: Project; onSaved: () => void }): React.JSX.Element {
  const [form, setForm] = useState(project)

  async function save(): Promise<void> {
    await api.projects.update(project.id, form)
    onSaved()
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Client name">
          <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
        </Field>
        <Field label="Site ID">
          <Input value={form.site_id ?? ''} onChange={(e) => setForm({ ...form, site_id: e.target.value })} />
        </Field>
        <Field label="Status">
          {form.archived_at ? (
            <Input value="Archived" disabled title="Use Unarchive to change status." />
          ) : (
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}>
              <option value="active">Active</option>
              <option value="at_risk">At risk</option>
              <option value="on_hold">On hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          )}
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
        <Field label="Project Manager">
          <Input value={form.pm_name ?? ''} onChange={(e) => setForm({ ...form, pm_name: e.target.value })} />
        </Field>
        <Field label="Business Consultant">
          <Input
            value={form.business_consultant_name ?? ''}
            onChange={(e) => setForm({ ...form, business_consultant_name: e.target.value })}
          />
        </Field>
        <Field label="Source">
          <Input value={form.source ?? ''} onChange={(e) => setForm({ ...form, source: e.target.value })} />
        </Field>
        <Field label="Client location">
          <Input
            value={form.client_location ?? ''}
            placeholder="City, State"
            onChange={(e) => setForm({ ...form, client_location: e.target.value })}
            onBlur={() => {
              if (form.client_time_zone) return
              const guess = form.client_location ? guessTimeZoneFromLocation(form.client_location) : null
              if (guess) setForm((f) => ({ ...f, client_time_zone: guess }))
            }}
          />
        </Field>
        <Field label="Client time zone">
          <Input
            value={form.client_time_zone ?? ''}
            placeholder="e.g. Eastern"
            onChange={(e) => setForm({ ...form, client_time_zone: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-3 flex justify-end">
        <Button onClick={save}>Save changes</Button>
      </div>
    </div>
  )
}
