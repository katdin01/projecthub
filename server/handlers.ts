/**
 * The request router for the local server. This is a straight port of the old
 * Electron IPC table (src/main/ipc/index.ts): every `ipcMain.handle('ns:method',
 * fn)` becomes an entry in this map, called by server/index.ts when a matching
 * `POST /api/invoke {channel, args}` arrives. The repository/business logic in
 * src/main is reused unchanged.
 *
 * The native file PICKERS are intentionally absent — the browser handles those
 * and uploads files to /api/upload, then calls the excel/pdf/backup handlers
 * below with the resulting temp path. `files:openPath` stays because opening a
 * path is the server's job.
 */
import * as projects from '../src/main/db/repositories/projects'
import * as people from '../src/main/db/repositories/people'
import * as skus from '../src/main/db/repositories/skus'
import * as schedule from '../src/main/db/repositories/schedule'
import * as docs from '../src/main/db/repositories/docs'
import * as dailyLogs from '../src/main/db/repositories/dailyLogs'
import * as tasks from '../src/main/db/repositories/tasks'
import * as taskTemplates from '../src/main/db/repositories/taskTemplates'
import * as jira from '../src/main/db/repositories/jira'
import * as jiraCredentials from '../src/main/jira/credentials'
import * as jiraClient from '../src/main/jira/client'
import * as jiraWrite from '../src/main/jira/write'
import { syncProjectJira } from '../src/main/jira/sync'
import * as notes from '../src/main/db/repositories/notes'
import * as search from '../src/main/db/repositories/search'
import * as dashboard from '../src/main/db/repositories/dashboard'
import * as backup from '../src/main/db/repositories/backup'
import * as files from '../src/main/files/index'
import * as excelImport from '../src/main/excel/import'
import * as pdfImport from '../src/main/pdf/import'

type Handler = (...args: any[]) => unknown | Promise<unknown>

export const handlers: Record<string, Handler> = {
  // Projects
  'projects:list': (includeArchived?: boolean) => projects.listProjects(includeArchived),
  'projects:get': (id: number) => projects.getProject(id),
  'projects:create': (input) => projects.createProject(input),
  'projects:update': (id: number, input) => projects.updateProject(id, input),
  'projects:archive': (id: number) => projects.archiveProject(id),
  'projects:unarchive': (id: number) => projects.unarchiveProject(id),

  // People
  'people:list': (projectId: number) => people.listPeople(projectId),
  'people:add': (input) => people.addPerson(input),
  'people:update': (id: number, input) => people.updatePerson(id, input),
  'people:remove': (id: number) => people.removePerson(id),

  // SKUs
  'skus:list': (projectId: number) => skus.listSkus(projectId),
  'skus:create': (input) => skus.createSku(input),
  'skus:update': (id: number, input) => skus.updateSku(id, input),
  'skus:delete': (id: number) => skus.deleteSku(id),

  // Schedule
  'schedule:list': (projectId: number) => schedule.listScheduleItems(projectId),
  'schedule:create': (input) => schedule.createScheduleItem(input),
  'schedule:update': (id: number, input) => schedule.updateScheduleItem(id, input),
  'schedule:delete': (id: number) => schedule.deleteScheduleItem(id),

  // Docs
  'docs:list': (projectId: number) => docs.listDocReferences(projectId),
  'docs:add': (input) => docs.addDocReference(input),
  'docs:remove': (id: number) => docs.removeDocReference(id),

  // Daily logs
  'dailyLogs:list': (filter) => dailyLogs.listDailyLogs(filter ?? {}),
  'dailyLogs:get': (id: number) => dailyLogs.getDailyLog(id),
  'dailyLogs:create': (input) => dailyLogs.createDailyLog(input),
  'dailyLogs:update': (id: number, input) => dailyLogs.updateDailyLog(id, input),
  'dailyLogs:delete': (id: number) => dailyLogs.deleteDailyLog(id),

  // Tasks
  'taskCategories:list': (projectId: number) => tasks.listTaskCategories(projectId),
  'taskCategories:add': (input) => tasks.addTaskCategory(input),
  'taskCategories:delete': (id: number) => tasks.deleteTaskCategory(id),
  'tasks:list': (projectId: number) => tasks.listTasks(projectId),
  'tasks:create': (input) => tasks.createTask(input),
  'tasks:update': (id: number, input) => tasks.updateTask(id, input),
  'tasks:delete': (id: number) => tasks.deleteTask(id),
  'tasks:listAllOpen': () => tasks.listAllOpenTasksAcrossProjects(),
  'tasks:generateFromSchedule': (projectId: number) => tasks.generateTasksFromTemplates(projectId),

  // Task templates
  'taskTemplates:list': () => taskTemplates.listTaskTemplates(),
  'taskTemplates:create': (input) => taskTemplates.createTaskTemplate(input),
  'taskTemplates:update': (id: number, input) => taskTemplates.updateTaskTemplate(id, input),
  'taskTemplates:delete': (id: number) => taskTemplates.deleteTaskTemplate(id),

  // Jira items & comments
  'jira:list': (projectId: number) => jira.listJiraItems(projectId),
  'jira:get': (id: number) => jira.getJiraItem(id),
  'jira:create': (input) => jira.createJiraItem(input),
  'jira:update': (id: number, input) => jira.updateJiraItem(id, input),
  'jira:delete': (id: number) => jira.deleteJiraItem(id),
  'jira:listComments': (jiraItemId: number) => jira.listJiraComments(jiraItemId),
  'jira:addComment': (jiraItemId: number, commentText: string) => jira.addJiraComment(jiraItemId, commentText),
  'jira:deleteComment': (id: number) => jira.deleteJiraComment(id),

  // Jira API connections & sync
  'jira:listConnections': () => jiraCredentials.listJiraConnections(),
  'jira:addConnection': async (
    name: string,
    type: 'cloud' | 'server',
    siteUrl: string,
    email: string | null,
    apiToken: string
  ) => {
    const normalizedSiteUrl = siteUrl.trim().replace(/\/+$/, '')
    const trimmedToken = apiToken.trim()
    const result = await jiraClient.testJiraConnection({
      type,
      siteUrl: normalizedSiteUrl,
      email,
      apiToken: trimmedToken
    })
    if (result.ok) {
      const id = jiraCredentials.addJiraConnection(name, type, siteUrl, email, trimmedToken)
      return { ...result, id }
    }
    return result
  },
  'jira:removeConnection': (id: string) => {
    jiraCredentials.removeJiraConnection(id)
    projects.clearProjectsJiraConnection(id)
  },
  'jira:updateProjectSync': (projectId: number, input) => projects.updateProjectJiraSync(projectId, input),
  'jira:syncNow': (projectId: number) => syncProjectJira(projectId),

  // Reads/writes against the real Jira ticket
  'jira:fetchComments': (jiraItemId: number) => jiraWrite.fetchCommentsFromJira(jiraItemId),
  'jira:postToJira': (jiraItemId: number, text: string) => jiraWrite.postCommentToJira(jiraItemId, text),
  'jira:listTransitions': (jiraItemId: number) => jiraWrite.listJiraTransitions(jiraItemId),
  'jira:applyTransition': (jiraItemId: number, transitionId: string) =>
    jiraWrite.applyJiraTransition(jiraItemId, transitionId),
  'jira:pushFields': (jiraItemId: number, fields) => jiraWrite.pushFieldsToJira(jiraItemId, fields),

  // Notes
  'notes:list': (filter) => notes.listNotes(filter ?? {}),
  'notes:get': (id: number) => notes.getNote(id),
  'notes:create': (input) => notes.createNote(input),
  'notes:update': (id: number, input) => notes.updateNote(id, input),
  'notes:archive': (id: number) => notes.archiveNote(id),
  'notes:listAllTags': () => notes.listAllTags(),

  // Search & dashboard
  'search:query': (query: string) => search.globalSearch(query),
  'dashboard:get': () => dashboard.getDashboardData(),

  // Backup
  'backup:create': () => backup.createBackup(),
  'backup:list': () => backup.listBackups(),
  'backup:restore': (path: string) => backup.restoreBackup(path),
  'backup:exportJson': () => backup.exportJson(),

  // Files (open only; pickers are handled in the browser)
  'files:openPath': (path: string) => files.openPath(path),

  // Excel import
  'excel:preview': (filePath: string, sheetName?: string) => excelImport.previewExcelFile(filePath, sheetName),
  'excel:import': (projectId: number, filePath: string, sheetName: string, columnMap, replaceExisting?: boolean) =>
    excelImport.importScheduleFromExcel(projectId, filePath, sheetName, columnMap, replaceExisting),
  'excel:importJira': (projectId: number, filePath: string, sheetName: string, columnMap) =>
    excelImport.importJiraFromFile(projectId, filePath, sheetName, columnMap),

  // PDF schedule import
  'pdf:previewSchedule': (filePath: string) => pdfImport.previewPdfSchedule(filePath),
  'pdf:importSchedule': (projectId: number, filePath: string, rows, replaceExisting?: boolean) =>
    pdfImport.importPdfSchedule(projectId, filePath, rows, replaceExisting)
}
