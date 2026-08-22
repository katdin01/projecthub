import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type {
  JiraItem,
  JiraComment,
  JiraExternalComment,
  JiraInternalStatus,
  JiraTransition,
  Project
} from '@shared/types'
import { JIRA_INTERNAL_STATUSES } from '@shared/types'
import { Badge, Button, Field, Input, Select, Textarea } from '../components/ui'
import { formatDate, isJiraExternallyResolved } from '../lib/format'

const internalStatusTone: Record<JiraInternalStatus, 'slate' | 'green' | 'yellow' | 'blue' | 'purple' | 'orange'> = {
  Open: 'slate',
  'Looked at - No Questions': 'blue',
  'Looked at - Questions': 'yellow',
  'Coded for': 'purple',
  'Internally QA-ed': 'orange',
  'Assigned Externally': 'green'
}

export function JiraDetailPage(): React.JSX.Element {
  const { id, jiraId } = useParams()
  const projectId = Number(id)
  const itemId = Number(jiraId)
  const navigate = useNavigate()

  const [item, setItem] = useState<JiraItem | null>(null)
  const [project, setProject] = useState<Project | null>(null)

  // Local ("ProjectHub only") comments live in the app's own table.
  const [localComments, setLocalComments] = useState<JiraComment[]>([])
  const [newComment, setNewComment] = useState('')

  // Jira comments are read live from the ticket, not stored locally.
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [jiraComments, setJiraComments] = useState<JiraExternalComment[] | null>(null)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState<string | null>(null)

  // Write-to-Jira UI state (shared status/error banner + workflow transitions).
  const [jiraMsg, setJiraMsg] = useState<string | null>(null)
  const [jiraErr, setJiraErr] = useState<string | null>(null)
  const [jiraBusy, setJiraBusy] = useState(false)
  const [transitions, setTransitions] = useState<JiraTransition[] | null>(null)
  const [selectedTransition, setSelectedTransition] = useState('')

  function refresh(): void {
    Promise.all([api.jira.get(itemId), api.jira.listComments(itemId), api.projects.get(projectId)]).then(
      ([i, c, p]) => {
        setItem(i ?? null)
        setLocalComments(c)
        setProject(p ?? null)
      }
    )
  }
  useEffect(refresh, [itemId, projectId])

  const label = project?.project_type === 'prescriptive' ? 'Change Log' : 'Jira'

  // ---- Local (ProjectHub-only) actions ----
  async function save(): Promise<void> {
    if (!item || !item.issue_id.trim() || !item.issue_name.trim()) return
    await api.jira.update(itemId, item)
    refresh()
  }

  async function remove(): Promise<void> {
    await api.jira.delete(itemId)
    navigate(`/projects/${projectId}?tab=jira`)
  }

  async function postLocalComment(): Promise<void> {
    if (!newComment.trim()) return
    await api.jira.addComment(itemId, newComment.trim())
    setNewComment('')
    setLocalComments(await api.jira.listComments(itemId))
  }

  async function removeLocalComment(commentId: number): Promise<void> {
    await api.jira.deleteComment(commentId)
    setLocalComments(await api.jira.listComments(itemId))
  }

  // ---- Live Jira reads/writes ----
  async function loadJiraComments(): Promise<void> {
    setCommentsLoading(true)
    setCommentsError(null)
    try {
      setJiraComments(await api.jira.fetchComments(itemId))
    } catch (e) {
      setCommentsError(e instanceof Error ? e.message : 'Could not load Jira comments.')
    } finally {
      setCommentsLoading(false)
    }
  }

  function toggleComments(): void {
    const next = !commentsOpen
    setCommentsOpen(next)
    if (next && jiraComments === null && !commentsLoading) void loadJiraComments()
  }

  // All write-to-Jira actions share one busy flag and one success/error banner.
  async function runJira(action: () => Promise<string>): Promise<void> {
    setJiraBusy(true)
    setJiraErr(null)
    setJiraMsg(null)
    try {
      setJiraMsg(await action())
    } catch (e) {
      setJiraErr(e instanceof Error ? e.message : 'Jira request failed.')
    } finally {
      setJiraBusy(false)
    }
  }

  async function postCommentToJira(): Promise<void> {
    if (!newComment.trim()) return
    await runJira(async () => {
      await api.jira.postToJira(itemId, newComment.trim())
      setNewComment('')
      setCommentsOpen(true)
      await loadJiraComments()
      return 'Comment posted to Jira.'
    })
  }

  async function loadTransitions(): Promise<void> {
    await runJira(async () => {
      const t = await api.jira.listTransitions(itemId)
      setTransitions(t)
      setSelectedTransition(t[0]?.id ?? '')
      return t.length ? 'Pick a status below, then Apply.' : 'No status changes are available for this ticket.'
    })
  }

  async function applyTransition(): Promise<void> {
    if (!selectedTransition) return
    await runJira(async () => {
      const updated = await api.jira.applyTransition(itemId, selectedTransition)
      setItem(updated)
      setTransitions(null)
      setSelectedTransition('')
      return `Status changed to "${updated.external_status ?? ''}" in Jira.`
    })
  }

  async function pushFields(): Promise<void> {
    if (!item) return
    if (
      !confirm(
        "Overwrite this Jira ticket's Summary, Description, Priority, Assignee, Fix Version/s and Affects " +
          'Version/s with the values shown here? Blank fields will be cleared in Jira.'
      )
    )
      return
    await runJira(async () => {
      await api.jira.pushFields(itemId, {
        summary: item.issue_name,
        description: item.description ?? '',
        priority: item.priority,
        assignee: item.assignee ?? '',
        fixVersions: item.fix_versions ?? '',
        affectsVersions: item.affects_versions ?? ''
      })
      return 'Pushed Summary, Description, Priority, Assignee, Fix Version/s and Affects Version/s to Jira.'
    })
  }

  if (!item) return <div className="p-8 text-sm text-slate-400">Loading…</div>

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-8">
      <Link to={`/projects/${projectId}?tab=jira`} className="text-sm text-slate-500 hover:underline">
        ← Back to {label}
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {item.issue_id} — {item.issue_name}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            {item.external_status && (
              <Badge tone={isJiraExternallyResolved(item.external_status) ? 'green' : 'slate'}>
                {item.external_status}
              </Badge>
            )}
            <Badge tone={internalStatusTone[item.internal_status]}>{item.internal_status}</Badge>
            <Badge tone={item.priority === 'critical' || item.priority === 'high' ? 'red' : 'blue'}>{item.priority}</Badge>
            <span>Updated {formatDate(item.updated_at)}</span>
          </div>
        </div>
        <Button variant="danger" onClick={remove}>
          Delete
        </Button>
      </div>

      {/* ============ JIRA FIELDS (mirror the ticket; can be written back) ============ */}
      <div className="space-y-3 rounded-lg border border-sky-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase text-slate-400">Jira ticket fields</p>
          <Badge tone="blue">Syncs with Jira</Badge>
        </div>

        {jiraErr && <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{jiraErr}</div>}
        {jiraMsg && <div className="rounded-md bg-emerald-50 p-2 text-sm text-emerald-700">{jiraMsg}</div>}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Issue ID (Jira key)">
            <Input value={item.issue_id} onChange={(e) => setItem({ ...item, issue_id: e.target.value })} placeholder="ABC-123" />
          </Field>
          <Field label="Jira URL">
            <Input value={item.jira_url ?? ''} onChange={(e) => setItem({ ...item, jira_url: e.target.value })} />
          </Field>
        </div>
        <Field label="Summary">
          <Input value={item.issue_name} onChange={(e) => setItem({ ...item, issue_name: e.target.value })} />
        </Field>
        <Field label="Description">
          <Textarea rows={3} value={item.description ?? ''} onChange={(e) => setItem({ ...item, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <Select value={item.priority} onChange={(e) => setItem({ ...item, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
          </Field>
          <Field label="Assignee">
            <Input value={item.assignee ?? ''} onChange={(e) => setItem({ ...item, assignee: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fix Version/s (comma-separated)">
            <Input
              value={item.fix_versions ?? ''}
              onChange={(e) => setItem({ ...item, fix_versions: e.target.value })}
              placeholder="e.g. 1.2.0, 1.3.0"
            />
          </Field>
          <Field label="Affects Version/s (comma-separated)">
            <Input
              value={item.affects_versions ?? ''}
              onChange={(e) => setItem({ ...item, affects_versions: e.target.value })}
              placeholder="e.g. 1.1.0"
            />
          </Field>
        </div>

        <Field label="Status">
          <div className="space-y-2">
            <Input
              value={item.external_status ?? ''}
              onChange={(e) => setItem({ ...item, external_status: e.target.value })}
              placeholder="e.g. In Review"
            />
            {transitions === null ? (
              <Button variant="secondary" onClick={loadTransitions} disabled={jiraBusy}>
                Change status in Jira…
              </Button>
            ) : transitions.length === 0 ? (
              <p className="text-sm text-slate-500">No status changes are available for this ticket right now.</p>
            ) : (
              <div className="flex items-center gap-2">
                <Select value={selectedTransition} onChange={(e) => setSelectedTransition(e.target.value)} className="flex-1">
                  {transitions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} → {t.to}
                    </option>
                  ))}
                </Select>
                <Button onClick={applyTransition} disabled={jiraBusy || !selectedTransition}>
                  Apply
                </Button>
                <Button variant="ghost" onClick={() => setTransitions(null)} disabled={jiraBusy}>
                  Cancel
                </Button>
              </div>
            )}
            <p className="text-xs text-slate-400">
              Editing the box above only changes ProjectHub's copy. Use "Change status in Jira" to move the ticket
              through its real Jira workflow.
            </p>
          </div>
        </Field>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="secondary" onClick={save}>
            Save locally
          </Button>
          <Button onClick={pushFields} disabled={jiraBusy}>
            Push to Jira →
          </Button>
        </div>
        <p className="text-right text-xs text-slate-400">
          "Push to Jira" writes Summary, Description, Priority, Assignee &amp; Version fields to the real ticket
          (Status uses the workflow control above).
        </p>
      </div>

      {/* ============ PROJECTHUB-ONLY FIELDS (never sent to Jira) ============ */}
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase text-slate-400">ProjectHub notes</p>
          <Badge tone="slate">Private — never sent to Jira</Badge>
        </div>

        <Field label="Internal status">
          <Select
            value={item.internal_status}
            onChange={(e) => setItem({ ...item, internal_status: e.target.value as JiraInternalStatus })}
          >
            {JIRA_INTERNAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Source table">
            <Input
              value={item.source_table ?? ''}
              onChange={(e) => setItem({ ...item, source_table: e.target.value })}
              placeholder="e.g. ActivityPointerBase"
            />
          </Field>
          <Field label="Source field">
            <Input
              value={item.source_field ?? ''}
              onChange={(e) => setItem({ ...item, source_field: e.target.value })}
              placeholder="e.g. ActivityTypeCode"
            />
          </Field>
        </div>
        <Field label="Internal notes">
          <Textarea rows={3} value={item.internal_notes ?? ''} onChange={(e) => setItem({ ...item, internal_notes: e.target.value })} />
        </Field>
        <Field label="Technical notes">
          <Textarea rows={3} value={item.technical_notes ?? ''} onChange={(e) => setItem({ ...item, technical_notes: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Questions">
            <Textarea rows={2} value={item.questions ?? ''} onChange={(e) => setItem({ ...item, questions: e.target.value })} />
          </Field>
          <Field label="Decisions">
            <Textarea rows={2} value={item.decisions ?? ''} onChange={(e) => setItem({ ...item, decisions: e.target.value })} />
          </Field>
          <Field label="Dependencies">
            <Textarea rows={2} value={item.dependencies ?? ''} onChange={(e) => setItem({ ...item, dependencies: e.target.value })} />
          </Field>
          <Field label="Blockers">
            <Textarea rows={2} value={item.blockers ?? ''} onChange={(e) => setItem({ ...item, blockers: e.target.value })} />
          </Field>
        </div>
        <Field label="Resolution details">
          <Textarea rows={2} value={item.resolution_details ?? ''} onChange={(e) => setItem({ ...item, resolution_details: e.target.value })} />
        </Field>
        <div className="flex justify-end border-t border-slate-100 pt-3">
          <Button variant="secondary" onClick={save}>
            Save locally
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-medium uppercase text-slate-400">Linked {label} issues</p>
        {item.linked_issues.length === 0 ? (
          <p className="text-xs text-slate-400">
            No linked issues. This only populates for tickets synced via the Jira API connection (Settings →
            Jira connections), not CSV import or manually-added tickets.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {item.linked_issues.map((li) => (
              <li key={li.key} className="flex items-center justify-between gap-2 py-1.5">
                <div className="min-w-0">
                  <span className="text-xs uppercase text-slate-400">{li.linkType}</span>{' '}
                  <a href={li.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                    {li.key}
                  </a>{' '}
                  <span className="text-slate-500">{li.summary}</span>
                </div>
                {li.status && (
                  <Badge tone={li.status.toLowerCase().includes('resolved') || li.status.toLowerCase().includes('done') ? 'green' : 'slate'}>
                    {li.status}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ============ COMMENTS (collapsible: live Jira + local) ============ */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <button
          onClick={toggleComments}
          className="flex w-full items-center justify-between text-left text-xs font-medium uppercase text-slate-400 hover:text-slate-600"
        >
          <span>
            Comments{jiraComments ? ` (${jiraComments.length} in Jira, ${localComments.length} local)` : ''}
          </span>
          <span className="text-sm">{commentsOpen ? '▾' : '▸'}</span>
        </button>

        {commentsOpen && (
          <div className="mt-3 space-y-4">
            <div className="flex flex-col gap-2">
              <Textarea
                rows={2}
                placeholder="Write a comment…"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={postLocalComment}>
                  Save locally
                </Button>
                <Button variant="secondary" onClick={postCommentToJira} disabled={jiraBusy}>
                  Post to Jira
                </Button>
              </div>
            </div>

            {/* Jira comments (live) */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-sky-600">From Jira</p>
                <button onClick={loadJiraComments} className="text-xs text-slate-400 hover:text-slate-600" disabled={commentsLoading}>
                  {commentsLoading ? 'Loading…' : 'Refresh'}
                </button>
              </div>
              {commentsError ? (
                <p className="text-xs text-red-600">{commentsError}</p>
              ) : commentsLoading && jiraComments === null ? (
                <p className="text-xs text-slate-400">Loading Jira comments…</p>
              ) : jiraComments && jiraComments.length > 0 ? (
                <div className="space-y-3">
                  {jiraComments.map((c) => (
                    <div key={c.id} className="border-t border-slate-100 pt-2 first:border-t-0 first:pt-0">
                      <p className="text-xs font-medium text-slate-500">
                        {c.author ?? 'Unknown'} · {formatDate(c.created)}
                      </p>
                      <p className="whitespace-pre-wrap text-sm text-slate-700">{c.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No comments on the Jira ticket.</p>
              )}
            </div>

            {/* Local (ProjectHub-only) comments */}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Local only (not in Jira)</p>
              {localComments.length === 0 ? (
                <p className="text-xs text-slate-400">No local comments.</p>
              ) : (
                <div className="space-y-3">
                  {localComments.map((c) => (
                    <div key={c.id} className="border-t border-slate-100 pt-2 first:border-t-0 first:pt-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="whitespace-pre-wrap text-sm text-slate-700">{c.comment_text}</p>
                        <button
                          onClick={() => removeLocalComment(c.id)}
                          className="shrink-0 text-xs text-slate-400 hover:text-red-500"
                        >
                          Delete
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{formatDate(c.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
