import type { JiraCredentials } from './credentials'
import type { JiraConnectionTestResult, JiraLinkedIssue } from '@shared/types'
import type { JiraImportRow } from '../db/repositories/jira'

// Jira Cloud and Server/Data Center diverge in auth, API version, and search
// pagination:
//  - Cloud: Basic auth (email:apiToken), /rest/api/3, and the legacy GET
//    /rest/api/3/search was removed by Atlassian — /rest/api/3/search/jql
//    (cursor-paginated via nextPageToken) is the current replacement.
//  - Server/Data Center: Bearer auth (a Personal Access Token, no email),
//    /rest/api/2, and the classic /rest/api/2/search with startAt/total
//    pagination (the Cloud-only cursor endpoint doesn't exist there).
// issuelinks has the same shape on both.
const SEARCH_FIELDS = [
  'summary',
  'description',
  'status',
  'priority',
  'assignee',
  'issuelinks',
  'fixVersions',
  'versions'
]
const PAGE_SIZE = 100
const MAX_PAGES = 50 // safety cap in case pagination misbehaves

function apiBase(creds: Pick<JiraCredentials, 'type'>): string {
  return creds.type === 'cloud' ? '/rest/api/3' : '/rest/api/2'
}

function authHeader(creds: JiraCredentials): string {
  if (creds.type === 'cloud') {
    return 'Basic ' + Buffer.from(`${creds.email ?? ''}:${creds.apiToken}`).toString('base64')
  }
  return `Bearer ${creds.apiToken}`
}

export async function testJiraConnection(creds: JiraCredentials): Promise<JiraConnectionTestResult> {
  try {
    const res = await fetch(`${creds.siteUrl}${apiBase(creds)}/myself`, {
      headers: { Authorization: authHeader(creds), Accept: 'application/json' }
    })
    if (!res.ok) {
      if (res.status === 401) {
        return {
          ok: false,
          error:
            creds.type === 'cloud'
              ? 'Invalid email or API token.'
              : 'Invalid Personal Access Token, or it lacks permission.'
        }
      }
      // Jira Server/Data Center returns 403 (not 401) both for real permission
      // problems and for its anti-bruteforce CAPTCHA lockout after failed
      // logins — the two look identical otherwise, so surface every signal
      // Jira gives us instead of guessing.
      if (res.status === 403) {
        const captchaReason = res.headers.get('X-Authentication-Denied-Reason')
        if (captchaReason?.includes('CAPTCHA')) {
          return {
            ok: false,
            error:
              'Jira is requiring a CAPTCHA before it will accept further login attempts (this happens after a few failed attempts). ' +
              'Log into the Jira site in a browser, solve the CAPTCHA if prompted, then try again here.'
          }
        }
        const body = await res.text().catch(() => '')
        return {
          ok: false,
          error:
            `Jira returned 403 Forbidden${body ? `: ${body.slice(0, 300)}` : ''}. ` +
            'This usually means the token is valid but lacks permission, or a network proxy/firewall between this ' +
            'machine and the site is blocking the request rather than Jira itself.'
        }
      }
      const body = await res.text().catch(() => '')
      return { ok: false, error: `Jira returned ${res.status} ${res.statusText}${body ? `: ${body.slice(0, 300)}` : ''}.` }
    }
    const data = (await res.json()) as { displayName?: string }
    return { ok: true, displayName: data.displayName }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not reach Jira.' }
  }
}

// Flattens Atlassian Document Format — the object shape Jira Cloud returns for
// rich-text fields like description. Server/Data Center's v2 API returns
// plain wiki-markup strings instead, so this only kicks in for object values.
function adfToText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as { type?: string; text?: string; content?: unknown[] }
  if (typeof n.text === 'string') return n.text
  const childText = (n.content ?? []).map(adfToText).join('')
  return n.type === 'paragraph' || n.type === 'heading' ? childText + '\n' : childText
}

function extractDescription(raw: unknown): string | undefined {
  if (raw == null) return undefined
  if (typeof raw === 'string') return raw.trim() || undefined
  return adfToText(raw).trim() || undefined
}

interface RawJiraIssueLink {
  type?: { inward?: string; outward?: string }
  inwardIssue?: RawLinkedIssueRef
  outwardIssue?: RawLinkedIssueRef
}

interface RawLinkedIssueRef {
  key: string
  fields?: { summary?: string; status?: { name?: string } }
}

interface RawJiraIssue {
  key: string
  fields: {
    summary?: string
    description?: unknown
    status?: { name?: string }
    priority?: { name?: string }
    assignee?: { displayName?: string }
    issuelinks?: RawJiraIssueLink[]
    fixVersions?: { name?: string }[]
    versions?: { name?: string }[]
  }
}

function versionNames(versions: { name?: string }[] | undefined): string | undefined {
  if (!versions || versions.length === 0) return undefined
  const names = versions.map((v) => v.name).filter((n): n is string => !!n)
  return names.length ? names.join(', ') : undefined
}

function extractLinkedIssues(creds: JiraCredentials, rawLinks: RawJiraIssueLink[] | undefined): JiraLinkedIssue[] {
  if (!rawLinks) return []
  const result: JiraLinkedIssue[] = []
  for (const link of rawLinks) {
    // Each link object carries exactly one of inwardIssue/outwardIssue — the
    // verb phrase (type.inward vs type.outward) describes this issue's
    // relationship to whichever side is present.
    const ref = link.outwardIssue ?? link.inwardIssue
    if (!ref) continue
    const linkType = (link.outwardIssue ? link.type?.outward : link.type?.inward) ?? 'relates to'
    result.push({
      key: ref.key,
      summary: ref.fields?.summary ?? ref.key,
      status: ref.fields?.status?.name ?? null,
      linkType,
      url: `${creds.siteUrl}/browse/${ref.key}`
    })
  }
  return result
}

function toImportRow(creds: JiraCredentials, issue: RawJiraIssue): JiraImportRow {
  return {
    issue_id: issue.key,
    issue_name: issue.fields.summary ?? issue.key,
    description: extractDescription(issue.fields.description),
    external_status: issue.fields.status?.name,
    priority: issue.fields.priority?.name,
    assignee: issue.fields.assignee?.displayName,
    jira_url: `${creds.siteUrl}/browse/${issue.key}`,
    fix_versions: versionNames(issue.fields.fixVersions),
    affects_versions: versionNames(issue.fields.versions),
    linked_issues: extractLinkedIssues(creds, issue.fields.issuelinks)
  }
}

async function searchJiraIssuesCloud(creds: JiraCredentials, jql: string): Promise<JiraImportRow[]> {
  const items: JiraImportRow[] = []
  let nextPageToken: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(`${creds.siteUrl}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(creds),
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jql,
        maxResults: PAGE_SIZE,
        fields: SEARCH_FIELDS,
        ...(nextPageToken ? { nextPageToken } : {})
      })
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Jira search failed (${res.status}): ${text.slice(0, 300)}`)
    }
    const data = (await res.json()) as { issues?: RawJiraIssue[]; nextPageToken?: string }
    const issues = data.issues ?? []
    items.push(...issues.map((issue) => toImportRow(creds, issue)))
    if (!data.nextPageToken || issues.length === 0) break
    nextPageToken = data.nextPageToken
  }
  return items
}

async function searchJiraIssuesServer(creds: JiraCredentials, jql: string): Promise<JiraImportRow[]> {
  const items: JiraImportRow[] = []
  let startAt = 0
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(`${creds.siteUrl}/rest/api/2/search`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(creds),
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ jql, startAt, maxResults: PAGE_SIZE, fields: SEARCH_FIELDS })
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Jira search failed (${res.status}): ${text.slice(0, 300)}`)
    }
    const data = (await res.json()) as { issues?: RawJiraIssue[]; startAt?: number; total?: number }
    const issues = data.issues ?? []
    items.push(...issues.map((issue) => toImportRow(creds, issue)))
    startAt += issues.length
    if (issues.length === 0 || (data.total !== undefined && startAt >= data.total)) break
  }
  return items
}

export async function searchJiraIssues(creds: JiraCredentials, jql: string): Promise<JiraImportRow[]> {
  return creds.type === 'cloud' ? searchJiraIssuesCloud(creds, jql) : searchJiraIssuesServer(creds, jql)
}

// ---------------------------------------------------------------------------
// Writes to Jira (comments, status transitions, field edits).
//
// All of these use the same auth/apiBase split as the reads above. Cloud (v3)
// wants rich text as Atlassian Document Format objects; Server/DC (v2) wants
// plain strings — that's the main per-flavour difference below.
// ---------------------------------------------------------------------------

const jsonHeaders = (creds: JiraCredentials): Record<string, string> => ({
  Authorization: authHeader(creds),
  Accept: 'application/json',
  'Content-Type': 'application/json'
})

// Jira's error bodies are `{ errorMessages: [], errors: { field: msg } }` — pull
// out whatever it gives us so the UI shows the real reason, not just a status.
async function throwJiraError(res: Response, action: string): Promise<never> {
  const text = await res.text().catch(() => '')
  let detail = text
  try {
    const j = JSON.parse(text) as { errorMessages?: string[]; errors?: Record<string, string> }
    const msgs = [...(j.errorMessages ?? []), ...Object.values(j.errors ?? {})]
    if (msgs.length) detail = msgs.join('; ')
  } catch {
    /* leave detail as raw text */
  }
  throw new Error(`${action} failed (${res.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`)
}

// Cloud rich-text fields (comment body, description) must be ADF, not a string.
// Preserve line breaks by turning each line into its own paragraph.
function textToAdf(text: string): unknown {
  const content = text.split('\n').map((line) =>
    line.length ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' }
  )
  return { type: 'doc', version: 1, content: content.length ? content : [{ type: 'paragraph' }] }
}

export interface JiraExternalCommentResult {
  id: string
  author: string | null
  body: string
  created: string | null
}

// Read the ticket's comments live from Jira. Cloud returns comment bodies as
// ADF objects; Server/DC returns wiki-markup strings — extractDescription /
// adfToText handles both.
export async function fetchJiraComments(creds: JiraCredentials, issueKey: string): Promise<JiraExternalCommentResult[]> {
  const res = await fetch(
    `${creds.siteUrl}${apiBase(creds)}/issue/${encodeURIComponent(issueKey)}/comment?orderBy=created`,
    { headers: { Authorization: authHeader(creds), Accept: 'application/json' } }
  )
  if (!res.ok) await throwJiraError(res, 'Loading Jira comments')
  const data = (await res.json()) as {
    comments?: { id: string; author?: { displayName?: string }; body?: unknown; created?: string }[]
  }
  return (data.comments ?? []).map((c) => ({
    id: c.id,
    author: c.author?.displayName ?? null,
    body: extractDescription(c.body) ?? '',
    created: c.created ?? null
  }))
}

export async function postJiraComment(creds: JiraCredentials, issueKey: string, text: string): Promise<void> {
  const body = creds.type === 'cloud' ? { body: textToAdf(text) } : { body: text }
  const res = await fetch(`${creds.siteUrl}${apiBase(creds)}/issue/${encodeURIComponent(issueKey)}/comment`, {
    method: 'POST',
    headers: jsonHeaders(creds),
    body: JSON.stringify(body)
  })
  if (!res.ok) await throwJiraError(res, 'Posting comment to Jira')
}

export interface JiraTransitionOption {
  id: string
  name: string
  to: string
}

// The transitions available FROM the issue's current status (this is workflow-
// and permission-specific, so it's read live each time).
export async function listJiraTransitions(creds: JiraCredentials, issueKey: string): Promise<JiraTransitionOption[]> {
  const res = await fetch(`${creds.siteUrl}${apiBase(creds)}/issue/${encodeURIComponent(issueKey)}/transitions`, {
    headers: { Authorization: authHeader(creds), Accept: 'application/json' }
  })
  if (!res.ok) await throwJiraError(res, 'Loading Jira statuses')
  const data = (await res.json()) as { transitions?: { id: string; name: string; to?: { name?: string } }[] }
  return (data.transitions ?? []).map((t) => ({ id: t.id, name: t.name, to: t.to?.name ?? t.name }))
}

export async function transitionJiraIssue(creds: JiraCredentials, issueKey: string, transitionId: string): Promise<void> {
  const res = await fetch(`${creds.siteUrl}${apiBase(creds)}/issue/${encodeURIComponent(issueKey)}/transitions`, {
    method: 'POST',
    headers: jsonHeaders(creds),
    body: JSON.stringify({ transition: { id: transitionId } })
  })
  if (!res.ok) await throwJiraError(res, 'Changing Jira status')
}

// Resolve a display name to a Cloud accountId (Cloud can't assign by name).
// Empty name means "unassign". Ambiguous matches are surfaced as an error
// rather than guessed.
async function resolveCloudAccountId(creds: JiraCredentials, name: string): Promise<string | null> {
  if (!name || !name.trim()) return null
  const res = await fetch(`${creds.siteUrl}/rest/api/3/user/search?query=${encodeURIComponent(name.trim())}`, {
    headers: { Authorization: authHeader(creds), Accept: 'application/json' }
  })
  if (!res.ok) await throwJiraError(res, 'Looking up Jira user')
  const users = (await res.json()) as { accountId: string; displayName: string }[]
  if (users.length === 0) throw new Error(`No Jira user matches "${name}".`)
  const exact = users.filter((u) => u.displayName.toLowerCase() === name.trim().toLowerCase())
  if (exact.length === 1) return exact[0].accountId
  if (users.length === 1) return users[0].accountId
  throw new Error(`"${name}" matches multiple Jira users — use an exact display name.`)
}

export interface JiraFieldUpdate {
  summary?: string
  description?: string
  priority?: string
  assignee?: string
  // Comma-separated version names, e.g. "1.2.0, 1.3.0". Empty string clears.
  fixVersions?: string
  affectsVersions?: string
}

// "1.2.0, 1.3.0" -> [{ name: '1.2.0' }, { name: '1.3.0' }]. Jira matches
// versions by name here; names that don't exist on the project make the PUT
// fail with a clear message (surfaced to the user).
function versionsPayload(csv: string): { name: string }[] {
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((name) => ({ name }))
}

// ProjectHub's normalized priority vocabulary → typical Jira priority names.
// If a site uses a different scheme, the PUT returns 400 and the real message
// is surfaced so the user knows to adjust.
const APP_PRIORITY_TO_JIRA: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Highest'
}

export async function updateJiraIssueFields(
  creds: JiraCredentials,
  issueKey: string,
  fields: JiraFieldUpdate
): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (fields.summary !== undefined) payload.summary = fields.summary
  if (fields.description !== undefined) {
    payload.description = creds.type === 'cloud' ? textToAdf(fields.description) : fields.description
  }
  if (fields.priority !== undefined) {
    payload.priority = { name: APP_PRIORITY_TO_JIRA[fields.priority.toLowerCase()] ?? fields.priority }
  }
  if (fields.assignee !== undefined) {
    if (creds.type === 'cloud') {
      payload.assignee = { accountId: await resolveCloudAccountId(creds, fields.assignee) }
    } else {
      payload.assignee = { name: fields.assignee?.trim() ? fields.assignee.trim() : null }
    }
  }
  if (fields.fixVersions !== undefined) payload.fixVersions = versionsPayload(fields.fixVersions)
  if (fields.affectsVersions !== undefined) payload.versions = versionsPayload(fields.affectsVersions)
  if (Object.keys(payload).length === 0) return
  const res = await fetch(`${creds.siteUrl}${apiBase(creds)}/issue/${encodeURIComponent(issueKey)}`, {
    method: 'PUT',
    headers: jsonHeaders(creds),
    body: JSON.stringify({ fields: payload })
  })
  if (!res.ok) await throwJiraError(res, 'Updating Jira fields')
}
