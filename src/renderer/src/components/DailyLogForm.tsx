import { useState } from 'react'
import { api } from '../lib/api'
import type { Project } from '@shared/types'
import { Button, Field, Input, Select, Textarea } from './ui'
import { todayIso } from '../lib/format'

const emptyForm = {
  project_id: null as number | null,
  log_date: todayIso(),
  work_completed: '',
  hours_spent: 0,
  notes: '',
  decisions_made: '',
  open_questions: '',
  next_steps: '',
  risks: '',
  blockers: ''
}

export function DailyLogForm({
  fixedProjectId,
  projects,
  onSaved
}: {
  fixedProjectId?: number
  projects?: Project[]
  onSaved: () => void
}): React.JSX.Element {
  const [form, setForm] = useState({ ...emptyForm, project_id: fixedProjectId ?? null })

  async function save(): Promise<void> {
    await api.dailyLogs.create(form)
    setForm({ ...emptyForm, project_id: fixedProjectId ?? null })
    onSaved()
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {!fixedProjectId && (
          <Field label="Project">
            <Select
              value={form.project_id ?? ''}
              onChange={(e) => setForm({ ...form, project_id: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">General / Admin</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Date">
          <Input type="date" value={form.log_date} onChange={(e) => setForm({ ...form, log_date: e.target.value })} />
        </Field>
        <Field label="Hours spent">
          <Input type="number" step="0.25" value={form.hours_spent} onChange={(e) => setForm({ ...form, hours_spent: Number(e.target.value) })} />
        </Field>
      </div>
      <Field label="Work completed">
        <Textarea rows={2} value={form.work_completed} onChange={(e) => setForm({ ...form, work_completed: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Notes">
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <Field label="Decisions made">
          <Textarea rows={2} value={form.decisions_made} onChange={(e) => setForm({ ...form, decisions_made: e.target.value })} />
        </Field>
        <Field label="Open questions">
          <Textarea rows={2} value={form.open_questions} onChange={(e) => setForm({ ...form, open_questions: e.target.value })} />
        </Field>
        <Field label="Next steps">
          <Textarea rows={2} value={form.next_steps} onChange={(e) => setForm({ ...form, next_steps: e.target.value })} />
        </Field>
        <Field label="Risks">
          <Textarea rows={2} value={form.risks} onChange={(e) => setForm({ ...form, risks: e.target.value })} />
        </Field>
        <Field label="Blockers">
          <Textarea rows={2} value={form.blockers} onChange={(e) => setForm({ ...form, blockers: e.target.value })} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button onClick={save}>Save entry</Button>
      </div>
    </div>
  )
}
