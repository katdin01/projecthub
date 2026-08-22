export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  if (isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateWithWeekday(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  if (isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function isOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false
  return dueDate < todayIso()
}

export function daysUntilDue(dueDate: string | null | undefined): string {
  if (!dueDate) return '—'
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`)
  const today = new Date(`${todayIso()}T00:00:00`)
  if (isNaN(due.getTime())) return '—'
  const days = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days > 0) return `in ${days} day${days === 1 ? '' : 's'}`
  return `${-days} day${days === -1 ? '' : 's'} ago`
}

// A non-watched schedule item whose due date has passed is treated as done
// everywhere in the UI, without ever writing that assumption back to the
// database — it's recomputed live from the current date on every render.
export function isEffectivelyDone(item: { status: string; due_date: string | null; watched: boolean }): boolean {
  if (item.status === 'done') return true
  if (item.watched) return false
  return isOverdue(item.due_date)
}

// external_status now holds Jira's raw status text as-is (no more fixed
// open/in_progress/blocked/resolved vocabulary), so "is this done" is
// approximated from the text itself — mirrors the same heuristic used
// server-side for dashboard/attention queries (see jira.ts's unresolvedStatusSql).
export function isJiraExternallyResolved(externalStatus: string | null): boolean {
  if (!externalStatus) return false
  const s = externalStatus.toLowerCase()
  return s.includes('done') || s.includes('closed') || s.includes('resolved')
}
