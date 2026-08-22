import type {
  Project,
  ProjectInput,
  ProjectPerson,
  ProjectPersonInput,
  ProjectSku,
  ProjectSkuInput,
  ScheduleItem,
  ScheduleItemInput,
  DocReference,
  DocReferenceInput,
  DailyLog,
  DailyLogInput,
  TaskCategory,
  TaskCategoryInput,
  ProjectTask,
  ProjectTaskInput,
  JiraItem,
  JiraItemInput,
  JiraComment,
  JiraExternalComment,
  JiraTransition,
  JiraFieldPush,
  Note,
  NoteInput,
  SearchResult,
  DashboardData,
  BackupInfo,
  DailyLogFilter,
  ExcelPreview,
  ColumnMap,
  ScheduleImportResult,
  JiraColumnMap,
  JiraImportResult,
  TaskTemplate,
  TaskTemplateInput,
  GenerateTasksResult,
  JiraConnectionSummary,
  JiraConnectionType,
  JiraConnectionTestResult,
  JiraProjectSyncInput,
  JiraSyncResult,
  PdfScheduleRow,
  PdfImportRow
} from '@shared/types'

// Thin, fully-typed wrapper around the untyped window.api IPC bridge exposed by preload.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = (): any => (window as unknown as { api: any }).api

export const api = {
  projects: {
    list: (includeArchived?: boolean): Promise<Project[]> => raw().projects.list(includeArchived),
    get: (id: number): Promise<Project | undefined> => raw().projects.get(id),
    create: (input: ProjectInput): Promise<Project> => raw().projects.create(input),
    update: (id: number, input: Partial<ProjectInput>): Promise<Project> => raw().projects.update(id, input),
    archive: (id: number): Promise<void> => raw().projects.archive(id),
    unarchive: (id: number): Promise<void> => raw().projects.unarchive(id)
  },
  people: {
    list: (projectId: number): Promise<ProjectPerson[]> => raw().people.list(projectId),
    add: (input: ProjectPersonInput): Promise<ProjectPerson> => raw().people.add(input),
    update: (id: number, input: Partial<ProjectPersonInput>): Promise<ProjectPerson> =>
      raw().people.update(id, input),
    remove: (id: number): Promise<void> => raw().people.remove(id)
  },
  skus: {
    list: (projectId: number): Promise<ProjectSku[]> => raw().skus.list(projectId),
    create: (input: ProjectSkuInput): Promise<ProjectSku> => raw().skus.create(input),
    update: (id: number, input: Partial<ProjectSkuInput>): Promise<ProjectSku> => raw().skus.update(id, input),
    delete: (id: number): Promise<void> => raw().skus.delete(id)
  },
  schedule: {
    list: (projectId: number): Promise<ScheduleItem[]> => raw().schedule.list(projectId),
    create: (input: ScheduleItemInput): Promise<ScheduleItem> => raw().schedule.create(input),
    update: (id: number, input: Partial<ScheduleItemInput>): Promise<ScheduleItem> =>
      raw().schedule.update(id, input),
    delete: (id: number): Promise<void> => raw().schedule.delete(id)
  },
  docs: {
    list: (projectId: number): Promise<DocReference[]> => raw().docs.list(projectId),
    add: (input: DocReferenceInput): Promise<DocReference> => raw().docs.add(input),
    remove: (id: number): Promise<void> => raw().docs.remove(id)
  },
  dailyLogs: {
    list: (filter?: DailyLogFilter): Promise<(DailyLog & { project_name: string | null })[]> =>
      raw().dailyLogs.list(filter),
    get: (id: number): Promise<DailyLog | undefined> => raw().dailyLogs.get(id),
    create: (input: DailyLogInput): Promise<DailyLog> => raw().dailyLogs.create(input),
    update: (id: number, input: Partial<DailyLogInput>): Promise<DailyLog> => raw().dailyLogs.update(id, input),
    delete: (id: number): Promise<void> => raw().dailyLogs.delete(id)
  },
  taskCategories: {
    list: (projectId: number): Promise<TaskCategory[]> => raw().taskCategories.list(projectId),
    add: (input: TaskCategoryInput): Promise<TaskCategory> => raw().taskCategories.add(input),
    delete: (id: number): Promise<void> => raw().taskCategories.delete(id)
  },
  tasks: {
    list: (projectId: number): Promise<ProjectTask[]> => raw().tasks.list(projectId),
    create: (input: ProjectTaskInput): Promise<ProjectTask> => raw().tasks.create(input),
    update: (id: number, input: Partial<ProjectTaskInput>): Promise<ProjectTask> => raw().tasks.update(id, input),
    delete: (id: number): Promise<void> => raw().tasks.delete(id),
    listAllOpen: (): Promise<(ProjectTask & { project_name: string })[]> => raw().tasks.listAllOpen(),
    generateFromSchedule: (projectId: number): Promise<GenerateTasksResult> =>
      raw().tasks.generateFromSchedule(projectId)
  },
  taskTemplates: {
    list: (): Promise<TaskTemplate[]> => raw().taskTemplates.list(),
    create: (input: TaskTemplateInput): Promise<TaskTemplate> => raw().taskTemplates.create(input),
    update: (id: number, input: Partial<TaskTemplateInput>): Promise<TaskTemplate> =>
      raw().taskTemplates.update(id, input),
    delete: (id: number): Promise<void> => raw().taskTemplates.delete(id)
  },
  jira: {
    list: (projectId: number): Promise<JiraItem[]> => raw().jira.list(projectId),
    get: (id: number): Promise<JiraItem | undefined> => raw().jira.get(id),
    create: (input: JiraItemInput): Promise<JiraItem> => raw().jira.create(input),
    update: (id: number, input: Partial<JiraItemInput>): Promise<JiraItem> => raw().jira.update(id, input),
    delete: (id: number): Promise<void> => raw().jira.delete(id),
    listComments: (jiraItemId: number): Promise<JiraComment[]> => raw().jira.listComments(jiraItemId),
    addComment: (jiraItemId: number, commentText: string): Promise<JiraComment> =>
      raw().jira.addComment(jiraItemId, commentText),
    deleteComment: (id: number): Promise<void> => raw().jira.deleteComment(id),
    listConnections: (): Promise<JiraConnectionSummary[]> => raw().jira.listConnections(),
    addConnection: (
      name: string,
      type: JiraConnectionType,
      siteUrl: string,
      email: string | null,
      apiToken: string
    ): Promise<JiraConnectionTestResult> => raw().jira.addConnection(name, type, siteUrl, email, apiToken),
    removeConnection: (id: string): Promise<void> => raw().jira.removeConnection(id),
    updateProjectSync: (projectId: number, input: JiraProjectSyncInput): Promise<Project> =>
      raw().jira.updateProjectSync(projectId, input),
    syncNow: (projectId: number): Promise<JiraSyncResult> => raw().jira.syncNow(projectId),
    fetchComments: (jiraItemId: number): Promise<JiraExternalComment[]> => raw().jira.fetchComments(jiraItemId),
    postToJira: (jiraItemId: number, text: string): Promise<void> => raw().jira.postToJira(jiraItemId, text),
    listTransitions: (jiraItemId: number): Promise<JiraTransition[]> => raw().jira.listTransitions(jiraItemId),
    applyTransition: (jiraItemId: number, transitionId: string): Promise<JiraItem> =>
      raw().jira.applyTransition(jiraItemId, transitionId),
    pushFields: (jiraItemId: number, fields: JiraFieldPush): Promise<void> =>
      raw().jira.pushFields(jiraItemId, fields)
  },
  notes: {
    list: (filter?: { projectId?: number | null; global?: boolean }): Promise<Note[]> => raw().notes.list(filter),
    get: (id: number): Promise<Note | undefined> => raw().notes.get(id),
    create: (input: NoteInput): Promise<Note> => raw().notes.create(input),
    update: (id: number, input: Partial<NoteInput>): Promise<Note> => raw().notes.update(id, input),
    archive: (id: number): Promise<void> => raw().notes.archive(id),
    listAllTags: (): Promise<string[]> => raw().notes.listAllTags()
  },
  search: {
    query: (q: string): Promise<SearchResult[]> => raw().search.query(q)
  },
  dashboard: {
    get: (): Promise<DashboardData> => raw().dashboard.get()
  },
  backup: {
    create: (): Promise<BackupInfo> => raw().backup.create(),
    list: (): Promise<BackupInfo[]> => raw().backup.list(),
    restore: (path: string): Promise<void> => raw().backup.restore(path),
    exportJson: (): Promise<string> => raw().backup.exportJson()
  },
  files: {
    pickFileOrFolder: (kind: 'file' | 'folder'): Promise<string | null> => raw().files.pickFileOrFolder(kind),
    pickExcelFile: (): Promise<string | null> => raw().files.pickExcelFile(),
    pickPdfFile: (): Promise<string | null> => raw().files.pickPdfFile(),
    pickJiraExportFile: (): Promise<string | null> => raw().files.pickJiraExportFile(),
    openPath: (path: string): Promise<void> => raw().files.openPath(path),
    pickBackupFile: (): Promise<string | null> => raw().files.pickBackupFile()
  },
  excel: {
    preview: (filePath: string, sheetName?: string): Promise<ExcelPreview> => raw().excel.preview(filePath, sheetName),
    import: (
      projectId: number,
      filePath: string,
      sheetName: string,
      columnMap: ColumnMap,
      replaceExisting?: boolean
    ): Promise<ScheduleImportResult> => raw().excel.import(projectId, filePath, sheetName, columnMap, replaceExisting),
    importJira: (
      projectId: number,
      filePath: string,
      sheetName: string,
      columnMap: JiraColumnMap
    ): Promise<JiraImportResult> => raw().excel.importJira(projectId, filePath, sheetName, columnMap)
  },
  pdf: {
    previewSchedule: (filePath: string): Promise<PdfScheduleRow[]> => raw().pdf.previewSchedule(filePath),
    importSchedule: (
      projectId: number,
      filePath: string,
      rows: PdfImportRow[],
      replaceExisting?: boolean
    ): Promise<ScheduleImportResult> => raw().pdf.importSchedule(projectId, filePath, rows, replaceExisting)
  }
}
