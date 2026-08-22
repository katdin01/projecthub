import { ipcMain, BrowserWindow } from 'electron'
import * as projects from '../db/repositories/projects'
import * as people from '../db/repositories/people'
import * as skus from '../db/repositories/skus'
import * as schedule from '../db/repositories/schedule'
import * as docs from '../db/repositories/docs'
import * as dailyLogs from '../db/repositories/dailyLogs'
import * as tasks from '../db/repositories/tasks'
import * as taskTemplates from '../db/repositories/taskTemplates'
import * as jira from '../db/repositories/jira'
import * as jiraCredentials from '../jira/credentials'
import * as jiraClient from '../jira/client'
import { syncProjectJira } from '../jira/sync'
import * as notes from '../db/repositories/notes'
import * as search from '../db/repositories/search'
import * as dashboard from '../db/repositories/dashboard'
import * as backup from '../db/repositories/backup'
import * as files from '../files'
import * as excelImport from '../excel/import'
import * as pdfImport from '../pdf/import'
import type { PdfImportRow } from '@shared/types'

export function registerIpcHandlers(): void {
  // Projects
  ipcMain.handle('projects:list', (_e, includeArchived?: boolean) => projects.listProjects(includeArchived))
  ipcMain.handle('projects:get', (_e, id: number) => projects.getProject(id))
  ipcMain.handle('projects:create', (_e, input) => projects.createProject(input))
  ipcMain.handle('projects:update', (_e, id: number, input) => projects.updateProject(id, input))
  ipcMain.handle('projects:archive', (_e, id: number) => projects.archiveProject(id))
  ipcMain.handle('projects:unarchive', (_e, id: number) => projects.unarchiveProject(id))

  // People
  ipcMain.handle('people:list', (_e, projectId: number) => people.listPeople(projectId))
  ipcMain.handle('people:add', (_e, input) => people.addPerson(input))
  ipcMain.handle('people:update', (_e, id: number, input) => people.updatePerson(id, input))
  ipcMain.handle('people:remove', (_e, id: number) => people.removePerson(id))

  // SKUs
  ipcMain.handle('skus:list', (_e, projectId: number) => skus.listSkus(projectId))
  ipcMain.handle('skus:create', (_e, input) => skus.createSku(input))
  ipcMain.handle('skus:update', (_e, id: number, input) => skus.updateSku(id, input))
  ipcMain.handle('skus:delete', (_e, id: number) => skus.deleteSku(id))

  // Schedule
  ipcMain.handle('schedule:list', (_e, projectId: number) => schedule.listScheduleItems(projectId))
  ipcMain.handle('schedule:create', (_e, input) => schedule.createScheduleItem(input))
  ipcMain.handle('schedule:update', (_e, id: number, input) => schedule.updateScheduleItem(id, input))
  ipcMain.handle('schedule:delete', (_e, id: number) => schedule.deleteScheduleItem(id))

  // Docs
  ipcMain.handle('docs:list', (_e, projectId: number) => docs.listDocReferences(projectId))
  ipcMain.handle('docs:add', (_e, input) => docs.addDocReference(input))
  ipcMain.handle('docs:remove', (_e, id: number) => docs.removeDocReference(id))

  // Daily logs
  ipcMain.handle('dailyLogs:list', (_e, filter) => dailyLogs.listDailyLogs(filter ?? {}))
  ipcMain.handle('dailyLogs:get', (_e, id: number) => dailyLogs.getDailyLog(id))
  ipcMain.handle('dailyLogs:create', (_e, input) => dailyLogs.createDailyLog(input))
  ipcMain.handle('dailyLogs:update', (_e, id: number, input) => dailyLogs.updateDailyLog(id, input))
  ipcMain.handle('dailyLogs:delete', (_e, id: number) => dailyLogs.deleteDailyLog(id))

  // Tasks
  ipcMain.handle('taskCategories:list', (_e, projectId: number) => tasks.listTaskCategories(projectId))
  ipcMain.handle('taskCategories:add', (_e, input) => tasks.addTaskCategory(input))
  ipcMain.handle('taskCategories:delete', (_e, id: number) => tasks.deleteTaskCategory(id))
  ipcMain.handle('tasks:list', (_e, projectId: number) => tasks.listTasks(projectId))
  ipcMain.handle('tasks:create', (_e, input) => tasks.createTask(input))
  ipcMain.handle('tasks:update', (_e, id: number, input) => tasks.updateTask(id, input))
  ipcMain.handle('tasks:delete', (_e, id: number) => tasks.deleteTask(id))
  ipcMain.handle('tasks:listAllOpen', () => tasks.listAllOpenTasksAcrossProjects())
  ipcMain.handle('tasks:generateFromSchedule', (_e, projectId: number) => tasks.generateTasksFromTemplates(projectId))

  // Task templates
  ipcMain.handle('taskTemplates:list', () => taskTemplates.listTaskTemplates())
  ipcMain.handle('taskTemplates:create', (_e, input) => taskTemplates.createTaskTemplate(input))
  ipcMain.handle('taskTemplates:update', (_e, id: number, input) => taskTemplates.updateTaskTemplate(id, input))
  ipcMain.handle('taskTemplates:delete', (_e, id: number) => taskTemplates.deleteTaskTemplate(id))

  // Jira
  ipcMain.handle('jira:list', (_e, projectId: number) => jira.listJiraItems(projectId))
  ipcMain.handle('jira:get', (_e, id: number) => jira.getJiraItem(id))
  ipcMain.handle('jira:create', (_e, input) => jira.createJiraItem(input))
  ipcMain.handle('jira:update', (_e, id: number, input) => jira.updateJiraItem(id, input))
  ipcMain.handle('jira:delete', (_e, id: number) => jira.deleteJiraItem(id))
  ipcMain.handle('jira:listComments', (_e, jiraItemId: number) => jira.listJiraComments(jiraItemId))
  ipcMain.handle('jira:addComment', (_e, jiraItemId: number, commentText: string) =>
    jira.addJiraComment(jiraItemId, commentText)
  )
  ipcMain.handle('jira:deleteComment', (_e, id: number) => jira.deleteJiraComment(id))

  // Jira API connections (Cloud or Server/Data Center, one per client site) & sync
  ipcMain.handle('jira:listConnections', () => jiraCredentials.listJiraConnections())
  ipcMain.handle(
    'jira:addConnection',
    async (
      _e,
      name: string,
      type: 'cloud' | 'server',
      siteUrl: string,
      email: string | null,
      apiToken: string
    ) => {
      const normalizedSiteUrl = siteUrl.trim().replace(/\/+$/, '')
      const trimmedToken = apiToken.trim()
      const result = await jiraClient.testJiraConnection({ type, siteUrl: normalizedSiteUrl, email, apiToken: trimmedToken })
      if (result.ok) {
        const id = jiraCredentials.addJiraConnection(name, type, siteUrl, email, trimmedToken)
        return { ...result, id }
      }
      return result
    }
  )
  ipcMain.handle('jira:removeConnection', (_e, id: string) => {
    jiraCredentials.removeJiraConnection(id)
    projects.clearProjectsJiraConnection(id)
  })
  ipcMain.handle('jira:updateProjectSync', (_e, projectId: number, input) =>
    projects.updateProjectJiraSync(projectId, input)
  )
  ipcMain.handle('jira:syncNow', (_e, projectId: number) => syncProjectJira(projectId))

  // Notes
  ipcMain.handle('notes:list', (_e, filter) => notes.listNotes(filter ?? {}))
  ipcMain.handle('notes:get', (_e, id: number) => notes.getNote(id))
  ipcMain.handle('notes:create', (_e, input) => notes.createNote(input))
  ipcMain.handle('notes:update', (_e, id: number, input) => notes.updateNote(id, input))
  ipcMain.handle('notes:archive', (_e, id: number) => notes.archiveNote(id))
  ipcMain.handle('notes:listAllTags', () => notes.listAllTags())

  // Search & dashboard
  ipcMain.handle('search:query', (_e, query: string) => search.globalSearch(query))
  ipcMain.handle('dashboard:get', () => dashboard.getDashboardData())

  // Backup
  ipcMain.handle('backup:create', () => backup.createBackup())
  ipcMain.handle('backup:list', () => backup.listBackups())
  ipcMain.handle('backup:restore', (_e, path: string) => backup.restoreBackup(path))
  ipcMain.handle('backup:exportJson', () => backup.exportJson())

  // Files
  ipcMain.handle('files:pickFileOrFolder', (_e, kind: 'file' | 'folder') => files.pickFileOrFolder(kind))
  ipcMain.handle('files:pickExcelFile', () => files.pickExcelFile())
  ipcMain.handle('files:pickPdfFile', () => files.pickPdfFile())
  ipcMain.handle('files:pickJiraExportFile', () => files.pickJiraExportFile())
  ipcMain.handle('files:openPath', (_e, path: string) => files.openPath(path))
  ipcMain.handle('files:pickBackupFile', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    return files.pickBackupFile(win)
  })

  // Excel import
  ipcMain.handle('excel:preview', (_e, filePath: string, sheetName?: string) =>
    excelImport.previewExcelFile(filePath, sheetName)
  )
  ipcMain.handle(
    'excel:import',
    (_e, projectId: number, filePath: string, sheetName: string, columnMap, replaceExisting?: boolean) =>
      excelImport.importScheduleFromExcel(projectId, filePath, sheetName, columnMap, replaceExisting)
  )
  ipcMain.handle('excel:importJira', (_e, projectId: number, filePath: string, sheetName: string, columnMap) =>
    excelImport.importJiraFromFile(projectId, filePath, sheetName, columnMap)
  )

  // PDF schedule import
  ipcMain.handle('pdf:previewSchedule', (_e, filePath: string) => pdfImport.previewPdfSchedule(filePath))
  ipcMain.handle(
    'pdf:importSchedule',
    (_e, projectId: number, filePath: string, rows: PdfImportRow[], replaceExisting?: boolean) =>
      pdfImport.importPdfSchedule(projectId, filePath, rows, replaceExisting)
  )
}
