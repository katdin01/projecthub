import { getJiraItem, updateJiraItem } from '../db/repositories/jira'
import { getProject } from '../db/repositories/projects'
import { getJiraConnection, type JiraCredentials } from './credentials'
import * as client from './client'
import type { JiraExternalComment, JiraItem } from '@shared/types'

// Resolve a local ticket to the live Jira connection it should be written
// through. Every failure here is a clear, user-actionable message because these
// bubble straight up to the UI.
function target(jiraItemId: number): { creds: JiraCredentials; issueKey: string; item: JiraItem } {
  const item = getJiraItem(jiraItemId)
  if (!item) throw new Error('Ticket not found.')
  const issueKey = (item.issue_id ?? '').trim()
  if (!issueKey) throw new Error('This ticket has no Jira issue key (set the Issue ID first).')
  const project = getProject(item.project_id)
  if (!project?.jira_connection_id) {
    throw new Error('This project has no Jira connection selected — pick one in the Jira tab first.')
  }
  const creds = getJiraConnection(project.jira_connection_id)
  if (!creds) throw new Error('The Jira connection for this project no longer exists (re-add it in Settings).')
  return { creds, issueKey, item }
}

// Post to the real Jira ticket. The comment is not mirrored into the local
// comment table — the app reads Jira comments live (fetchCommentsFromJira), so
// mirroring would show it twice. The UI reloads the Jira comments after posting.
export async function postCommentToJira(jiraItemId: number, text: string): Promise<void> {
  const trimmed = (text ?? '').trim()
  if (!trimmed) throw new Error('Comment is empty.')
  const { creds, issueKey } = target(jiraItemId)
  await client.postJiraComment(creds, issueKey, trimmed)
}

export async function fetchCommentsFromJira(jiraItemId: number): Promise<JiraExternalComment[]> {
  const { creds, issueKey } = target(jiraItemId)
  return client.fetchJiraComments(creds, issueKey)
}

export function listJiraTransitions(jiraItemId: number): Promise<client.JiraTransitionOption[]> {
  const { creds, issueKey } = target(jiraItemId)
  return client.listJiraTransitions(creds, issueKey)
}

// Apply a workflow transition, then reflect the resulting status locally so the
// app and Jira agree without waiting for the next full sync.
export async function applyJiraTransition(jiraItemId: number, transitionId: string): Promise<JiraItem> {
  const { creds, issueKey } = target(jiraItemId)
  const transitions = await client.listJiraTransitions(creds, issueKey)
  const chosen = transitions.find((t) => t.id === transitionId)
  if (!chosen) throw new Error('That status is no longer available for this ticket — reload and try again.')
  await client.transitionJiraIssue(creds, issueKey, transitionId)
  updateJiraItem(jiraItemId, { external_status: chosen.to })
  return getJiraItem(jiraItemId)!
}

export async function pushFieldsToJira(jiraItemId: number, fields: client.JiraFieldUpdate): Promise<void> {
  const { creds, issueKey } = target(jiraItemId)
  await client.updateJiraIssueFields(creds, issueKey, fields)
}
