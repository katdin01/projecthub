import { useState } from 'react'
import type { DailyLog } from '@shared/types'
import { formatDate } from '../lib/format'
import { api } from '../lib/api'

const fields: { key: keyof DailyLog; label: string }[] = [
  { key: 'notes', label: 'Notes' },
  { key: 'decisions_made', label: 'Decisions' },
  { key: 'open_questions', label: 'Open questions' },
  { key: 'next_steps', label: 'Next steps' },
  { key: 'risks', label: 'Risks' },
  { key: 'blockers', label: 'Blockers' }
]

export function DailyLogHistory({
  logs,
  showProject,
  onChanged
}: {
  logs: (DailyLog & { project_name: string | null })[]
  showProject?: boolean
  onChanged: () => void
}): React.JSX.Element {
  const [expanded, setExpanded] = useState<number | null>(null)

  if (logs.length === 0) {
    return <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">No entries yet.</p>
  }

  return (
    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {logs.map((log) => (
        <div key={log.id} className="p-3">
          <button className="flex w-full items-center justify-between text-left" onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
            <span className="text-sm font-medium">
              {formatDate(log.log_date)}
              {showProject ? ` — ${log.project_name ?? 'General'}` : ''}
              {log.work_completed ? `: ${log.work_completed.slice(0, 90)}` : ''}
            </span>
            <span className="shrink-0 pl-2 text-xs text-slate-400">{log.hours_spent}h</span>
          </button>
          {expanded === log.id && (
            <div className="mt-2 space-y-1.5 text-sm">
              {fields.map(
                ({ key, label }) =>
                  log[key] && (
                    <div key={key}>
                      <span className="text-xs font-medium uppercase text-slate-400">{label}: </span>
                      {String(log[key])}
                    </div>
                  )
              )}
              <div className="pt-1">
                <button
                  onClick={() => api.dailyLogs.delete(log.id).then(onChanged)}
                  className="text-xs text-slate-400 hover:text-red-500"
                >
                  Delete entry
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
