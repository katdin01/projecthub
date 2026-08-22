import { getJiraConnection } from './credentials'
import { searchJiraIssues } from './client'
import { upsertJiraItemsFromApiSync } from '../db/repositories/jira'
import { getProject, listProjectsWithJiraAutoSync, recordJiraSyncResult } from '../db/repositories/projects'
import type { JiraSyncResult } from '@shared/types'

export async function syncProjectJira(projectId: number): Promise<JiraSyncResult> {
  const project = getProject(projectId)
  if (!project) return { ok: false, error: 'Project not found' }
  if (!project.jira_connection_id) return { ok: false, error: 'No Jira connection selected for this project' }
  if (!project.jira_jql || !project.jira_jql.trim()) return { ok: false, error: 'No JQL configured for this project' }

  const creds = getJiraConnection(project.jira_connection_id)
  if (!creds) {
    const error = 'The selected Jira connection no longer exists — pick another in the Jira tab'
    recordJiraSyncResult(projectId, error)
    return { ok: false, error }
  }

  try {
    const items = await searchJiraIssues(creds, project.jira_jql)
    const result = upsertJiraItemsFromApiSync(projectId, creds.siteUrl, items)
    recordJiraSyncResult(projectId, null)
    return { ok: true, inserted: result.inserted, updated: result.updated }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error syncing with Jira'
    recordJiraSyncResult(projectId, error)
    return { ok: false, error }
  }
}

// Runs every project's sync sequentially (not in parallel) to stay well under
// Jira's rate limits. One project's failure never stops the others.
export async function syncAllProjects(): Promise<void> {
  const projects = listProjectsWithJiraAutoSync()
  for (const project of projects) {
    await syncProjectJira(project.id)
  }
}

let intervalHandle: NodeJS.Timeout | null = null
const SYNC_INTERVAL_MS = 20 * 60 * 1000
const INITIAL_DELAY_MS = 30 * 1000

export function startJiraScheduler(): void {
  if (intervalHandle) return
  setTimeout(() => {
    syncAllProjects()
    intervalHandle = setInterval(syncAllProjects, SYNC_INTERVAL_MS)
  }, INITIAL_DELAY_MS)
}

export function stopJiraScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
}
