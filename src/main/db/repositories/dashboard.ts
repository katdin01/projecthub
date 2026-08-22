import { getDb } from '../index'
import type { DashboardData, DailyLog, Project } from '@shared/types'
import { unresolvedStatusSql } from './jira'
import { deriveProjectPhase } from './projects'

export function getDashboardData(): DashboardData {
  const db = getDb()

  const activeProjects = (
    db
      .prepare(
        `SELECT * FROM projects WHERE archived_at IS NULL AND status NOT IN ('completed', 'cancelled')
       ORDER BY status = 'at_risk' DESC, target_go_live IS NULL, target_go_live`
      )
      .all() as Project[]
  ).map((p) => ({ ...p, phase: deriveProjectPhase(p.id) }))

  const today = new Date().toISOString().slice(0, 10)
  const in14Days = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)

  // Upcoming TASKS (not schedule items) due within the next 14 days for all
  // active projects (not archived, not completed/cancelled) — a forward window
  // from today through +14 days. Past-due tasks are not "upcoming", so they're
  // excluded here.
  const taskUpcomingRows = db
    .prepare(
      `SELECT t.project_id, p.project_name, t.title AS name, t.due_date
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.status != 'done' AND t.due_date IS NOT NULL
         AND t.due_date >= ? AND t.due_date <= ?
         AND p.archived_at IS NULL AND p.status NOT IN ('completed', 'cancelled')
       ORDER BY t.due_date`
    )
    .all(today, in14Days) as {
    project_id: number
    project_name: string
    name: string
    due_date: string
  }[]

  const upcoming = taskUpcomingRows.map((r) => ({ ...r, overdue: false }))

  // Blockers: latest daily log per project with a non-empty blockers field, plus open jira blockers
  const dailyLogBlockers = db
    .prepare(
      `SELECT d.project_id, p.project_name, d.blockers AS text, d.log_date AS date
       FROM daily_logs d
       JOIN projects p ON p.id = d.project_id
       WHERE d.blockers IS NOT NULL AND TRIM(d.blockers) != '' AND p.archived_at IS NULL
       AND d.id IN (
         SELECT id FROM daily_logs d2 WHERE d2.project_id = d.project_id ORDER BY log_date DESC, created_at DESC LIMIT 1
       )`
    )
    .all() as { project_id: number; project_name: string; text: string; date: string }[]

  const jiraBlockers = db
    .prepare(
      `SELECT j.project_id, p.project_name, j.blockers AS text, j.updated_at AS date
       FROM jira_items j JOIN projects p ON p.id = j.project_id
       WHERE j.blockers IS NOT NULL AND TRIM(j.blockers) != '' AND ${unresolvedStatusSql('j.external_status')} AND p.archived_at IS NULL`
    )
    .all() as { project_id: number; project_name: string; text: string; date: string }[]

  const blockers = [
    ...dailyLogBlockers.map((r) => ({ ...r, source: 'daily_log' as const })),
    ...jiraBlockers.map((r) => ({ ...r, source: 'jira' as const }))
  ]

  const dailyLogQuestions = db
    .prepare(
      `SELECT d.project_id, p.project_name, d.open_questions AS text, d.log_date AS date
       FROM daily_logs d
       JOIN projects p ON p.id = d.project_id
       WHERE d.open_questions IS NOT NULL AND TRIM(d.open_questions) != '' AND p.archived_at IS NULL
       AND d.id IN (
         SELECT id FROM daily_logs d2 WHERE d2.project_id = d.project_id ORDER BY log_date DESC, created_at DESC LIMIT 1
       )`
    )
    .all() as { project_id: number; project_name: string; text: string; date: string }[]

  const jiraQuestions = db
    .prepare(
      `SELECT j.project_id, p.project_name, j.questions AS text, j.updated_at AS date
       FROM jira_items j JOIN projects p ON p.id = j.project_id
       WHERE j.questions IS NOT NULL AND TRIM(j.questions) != '' AND ${unresolvedStatusSql('j.external_status')} AND p.archived_at IS NULL`
    )
    .all() as { project_id: number; project_name: string; text: string; date: string }[]

  const questions = [
    ...dailyLogQuestions.map((r) => ({ ...r, source: 'daily_log' as const })),
    ...jiraQuestions.map((r) => ({ ...r, source: 'jira' as const }))
  ]

  const recentActivity = db
    .prepare(
      `SELECT d.*, p.project_name FROM daily_logs d
       LEFT JOIN projects p ON p.id = d.project_id
       ORDER BY d.log_date DESC, d.created_at DESC LIMIT 15`
    )
    .all() as (DailyLog & { project_name: string | null })[]

  const hoursSummary = db
    .prepare(
      `SELECT COALESCE(SUM(hours_budgeted),0) AS budgeted, COALESCE(SUM(hours_consumed),0) AS consumed
       FROM projects WHERE archived_at IS NULL AND status NOT IN ('completed','cancelled')`
    )
    .get() as { budgeted: number; consumed: number }

  return {
    activeProjects,
    upcoming,
    blockers,
    questions,
    recentActivity,
    hoursSummary: {
      budgeted: hoursSummary.budgeted,
      consumed: hoursSummary.consumed,
      remaining: hoursSummary.budgeted - hoursSummary.consumed
    }
  }
}
