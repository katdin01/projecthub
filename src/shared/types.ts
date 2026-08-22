// Types shared between the Electron main process and the React renderer.
// Kept dependency-free (no Node/DOM imports) so it can be used on both sides.

export type ProjectStatus = 'active' | 'on_hold' | 'at_risk' | 'completed' | 'cancelled' | 'archived'

// Picked once at creation. 'enterprise' is the original template. 'prescriptive'
// is a lighter, standardized RE NXT template — same tabs, but Jira is labeled
// "Change Logs" and schedules are typically imported from a PDF project plan.
export type ProjectType = 'enterprise' | 'prescriptive'

export interface Project {
  id: number
  client_name: string
  site_id: string | null
  // Derived server-side from site_id + client_name — never set directly by the UI.
  project_name: string
  status: ProjectStatus
  project_type: ProjectType
  phase: string | null
  start_date: string | null
  target_go_live: string | null
  hours_budgeted: number
  hours_consumed: number
  pm_name: string | null
  business_consultant_name: string | null
  source: string | null
  client_location: string | null
  client_time_zone: string | null
  // Jira Cloud auto-sync config — managed via its own dedicated API, not the
  // general project edit form. See jira:updateProjectSync. jira_connection_id
  // points at one of the named connections in src/main/jira/credentials.ts —
  // each client typically runs its own separate Jira site.
  jira_connection_id: string | null
  jira_jql: string | null
  jira_auto_sync: boolean
  jira_last_synced_at: string | null
  jira_last_sync_error: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export type ProjectInput = Omit<
  Project,
  | 'id'
  | 'project_name'
  | 'hours_budgeted'
  | 'hours_consumed'
  | 'jira_connection_id'
  | 'jira_jql'
  | 'jira_auto_sync'
  | 'jira_last_synced_at'
  | 'jira_last_sync_error'
  | 'created_at'
  | 'updated_at'
  | 'archived_at'
>

export interface ProjectSku {
  id: number
  project_id: number
  sku: string
  hours: number | null
  notes: string | null
  sort_order: number
}

export type ProjectSkuInput = Omit<ProjectSku, 'id'>

export type PersonTeam = 'internal' | 'client'
export type InternalRole = 'project_manager' | 'business_consultant'

export interface ProjectPerson {
  id: number
  project_id: number
  team: PersonTeam
  // Constrained to InternalRole when team is 'internal'; free text when team is 'client'.
  role: string
  name: string
  email: string | null
  is_primary_contact: boolean
  notes: string | null
}

export type ProjectPersonInput = Omit<ProjectPerson, 'id'>

export type ScheduleStatus = 'not_started' | 'in_progress' | 'done'

export interface ScheduleItem {
  id: number
  project_id: number
  name: string
  due_date: string | null
  status: ScheduleStatus
  source: 'manual' | 'excel_import'
  import_batch_id: number | null
  sort_order: number
  watched: boolean
  start_date: string | null
  resource_names: string | null
  // User-entered only — never populated from an Excel import.
  notes: string | null
  // Flagged via the source workbook's own "KD Notes"-style annotation column at import time.
  is_da_item: boolean
  created_at: string
  updated_at: string
}

export type ScheduleItemInput = Omit<
  ScheduleItem,
  'id' | 'created_at' | 'updated_at' | 'source' | 'import_batch_id'
>

export type DocCategory =
  | 'scope_of_work'
  | 'project_plan'
  | 'mapping'
  | 'qa_qc'
  | 'meeting_notes'
  | 'technical_doc'
  | 'other'

export interface DocReference {
  id: number
  project_id: number
  category: DocCategory
  label: string
  path: string
  is_folder: boolean
  notes: string | null
  created_at: string
}

export type DocReferenceInput = Omit<DocReference, 'id' | 'created_at'>

export interface DailyLog {
  id: number
  project_id: number | null
  log_date: string
  work_completed: string | null
  hours_spent: number
  notes: string | null
  decisions_made: string | null
  open_questions: string | null
  next_steps: string | null
  risks: string | null
  blockers: string | null
  created_at: string
  updated_at: string
}

export type DailyLogInput = Omit<DailyLog, 'id' | 'created_at' | 'updated_at'>

export interface TaskCategory {
  id: number
  project_id: number
  name: string
  sort_order: number
}

export type TaskCategoryInput = Omit<TaskCategory, 'id'>

export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'
export type DeliveryType =
  | 'internal_delivery'
  | 'external_delivery'
  | 'soft_internal_delivery'
  | 'meeting'
  | 'client_due_date'

export interface ProjectTask {
  id: number
  project_id: number
  category_id: number | null
  title: string
  status: TaskStatus
  priority: TaskPriority | null
  owner: string | null
  due_date: string | null
  delivery_type: DeliveryType | null
  notes: string | null
  // Set when this task was generated from a note's "+ Create task" button.
  source_note_id: number | null
  // Joined in for display only — the note's title at read time (null if
  // there's no source note). Never written back on create/update.
  source_note_title: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export type ProjectTaskInput = Omit<
  ProjectTask,
  'id' | 'created_at' | 'updated_at' | 'completed_at' | 'source_note_title'
>

export interface TaskTemplate {
  id: number
  name: string
  category: string | null
  delivery_type: DeliveryType | null
  sort_order: number
}

export type TaskTemplateInput = Omit<TaskTemplate, 'id'>

export interface GenerateTasksResult {
  created: number
  withDueDate: number
  skippedExisting: number
}

// A fixed set of stages for this team's own review process on a ticket —
// entirely separate from whatever Jira's own workflow says (external_status).
export type JiraInternalStatus =
  | 'Open'
  | 'Looked at - No Questions'
  | 'Looked at - Questions'
  | 'Coded for'
  | 'Internally QA-ed'
  | 'Assigned Externally'

export const JIRA_INTERNAL_STATUSES: JiraInternalStatus[] = [
  'Open',
  'Looked at - No Questions',
  'Looked at - Questions',
  'Coded for',
  'Internally QA-ed',
  'Assigned Externally'
]

// A workflow transition available on a Jira ticket (id to apply, name to show,
// and the status name it moves the ticket TO).
export interface JiraTransition {
  id: string
  name: string
  to: string
}

// Fields ProjectHub can push back to a Jira ticket. Version fields are
// comma-separated names (e.g. "1.2.0, 1.3.0").
export interface JiraFieldPush {
  summary?: string
  description?: string
  priority?: string
  assignee?: string
  fixVersions?: string
  affectsVersions?: string
}

// A comment read live from the Jira ticket (distinct from ProjectHub's own
// local-only comments in JiraComment).
export interface JiraExternalComment {
  id: string
  author: string | null
  body: string
  created: string | null
}

export interface JiraItem {
  id: number
  project_id: number
  jira_url: string | null
  issue_id: string
  issue_name: string
  description: string | null
  // Mirrors Jira's raw ticket status text as-is (whatever the ticket
  // literally says) — set by CSV import or API sync, or left blank for
  // manually-created tickets.
  external_status: string | null
  // This team's own review-process marker — never touched by import/sync.
  internal_status: JiraInternalStatus
  priority: string
  assignee: string | null
  source_table: string | null
  source_field: string | null
  internal_notes: string | null
  technical_notes: string | null
  questions: string | null
  decisions: string | null
  dependencies: string | null
  blockers: string | null
  resolution_details: string | null
  // Jira version fields, stored as comma-separated names. Read via sync and
  // writable back to the ticket.
  fix_versions: string | null
  affects_versions: string | null
  // Fully Jira-sourced — only ever populated by API sync, never hand-edited.
  linked_issues: JiraLinkedIssue[]
  created_at: string
  updated_at: string
}

export interface JiraLinkedIssue {
  key: string
  summary: string
  status: string | null
  // e.g. "blocks", "is blocked by", "relates to" — Jira's own link-type verb phrase
  linkType: string
  url: string
}

export type JiraItemInput = Omit<JiraItem, 'id' | 'created_at' | 'updated_at' | 'linked_issues'>

export interface JiraComment {
  id: number
  jira_item_id: number
  comment_text: string
  created_at: string
}

export interface JiraColumnMap {
  issue_id: string
  issue_name?: string
  description?: string
  external_status?: string
  priority?: string
  assignee?: string
  jira_url?: string
  fix_versions?: string
  affects_versions?: string
  // Only ever set by the API-sync path — CSV export has no equivalent column.
  linked_issues?: string
}

export interface JiraImportResult {
  batchId: number
  inserted: number
  updated: number
}

// A single named Jira connection — one per client, since each runs their own
// separate Jira site/account, and some run Jira Cloud while others run a
// self-hosted Server/Data Center instance (different auth: Cloud uses an
// email + API token pair, Server/Data Center uses a Bearer Personal Access
// Token with no email). Never carries the token itself; that stays
// main-process-only (see src/main/jira/credentials.ts).
export type JiraConnectionType = 'cloud' | 'server'

export interface JiraConnectionSummary {
  id: string
  name: string
  type: JiraConnectionType
  siteUrl: string
  email: string | null
}

export interface JiraConnectionTestResult {
  ok: boolean
  displayName?: string
  error?: string
  id?: string
}

export interface JiraProjectSyncInput {
  jira_connection_id: string | null
  jira_jql: string | null
  jira_auto_sync: boolean
}

export interface JiraSyncResult {
  ok: boolean
  inserted?: number
  updated?: number
  error?: string
}

export type NoteType = 'general' | 'meeting' | 'decision' | 'lesson_learned'

export interface Note {
  id: number
  project_id: number | null
  note_type: NoteType
  title: string
  content_json: string
  content_text: string
  created_at: string
  updated_at: string
  archived_at: string | null
  tags?: string[]
}

export interface NoteInput {
  project_id: number | null
  note_type: NoteType
  title: string
  content_json: string
  content_text: string
  tags: string[]
}

export interface SearchResult {
  entity: 'note' | 'task' | 'jira' | 'daily_log'
  id: number
  project_id: number | null
  title: string
  snippet: string | null
  updated_at: string
}

export interface DashboardData {
  activeProjects: Project[]
  upcoming: { project_id: number; project_name: string; name: string; due_date: string; overdue: boolean }[]
  blockers: { project_id: number; project_name: string; text: string; source: 'daily_log' | 'jira'; date: string }[]
  questions: { project_id: number; project_name: string; text: string; source: 'daily_log' | 'jira'; date: string }[]
  recentActivity: (DailyLog & { project_name: string | null })[]
  hoursSummary: { budgeted: number; consumed: number; remaining: number }
}

export interface BackupInfo {
  fileName: string
  path: string
  createdAt: string
  sizeBytes: number
}

export interface DailyLogFilter {
  projectId?: number
  fromDate?: string
  toDate?: string
  limit?: number
}

export interface ExcelPreview {
  sheetNames: string[]
  activeSheet: string
  headers: string[]
  rows: string[][]
}

export interface ColumnMap {
  name: string
  due_date?: string
  start_date?: string
  resource_names?: string
  // Non-empty cells in this column mark the row watched + a "DA Item" on the schedule.
  flag_notes?: string
  // Only used together: a row only generates a task when task_title is non-empty.
  task_title?: string
  task_delivery_type?: string
}

export interface ScheduleImportResult {
  batchId: number
  count: number
  tasksCreated: number
}

// A single milestone row extracted from a Prescriptive project plan PDF.
export interface PdfScheduleRow {
  name: string
  due_date: string | null
  notes: string | null
}

// Same shape, plus the user's choice (from the import preview) of whether
// this row should also generate a task.
export interface PdfImportRow extends PdfScheduleRow {
  flagged: boolean
}
