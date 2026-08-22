import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const invoke = (channel: string) => (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)

const api = {
  projects: {
    list: invoke('projects:list'),
    get: invoke('projects:get'),
    create: invoke('projects:create'),
    update: invoke('projects:update'),
    archive: invoke('projects:archive'),
    unarchive: invoke('projects:unarchive')
  },
  people: {
    list: invoke('people:list'),
    add: invoke('people:add'),
    update: invoke('people:update'),
    remove: invoke('people:remove')
  },
  skus: {
    list: invoke('skus:list'),
    create: invoke('skus:create'),
    update: invoke('skus:update'),
    delete: invoke('skus:delete')
  },
  schedule: {
    list: invoke('schedule:list'),
    create: invoke('schedule:create'),
    update: invoke('schedule:update'),
    delete: invoke('schedule:delete')
  },
  docs: {
    list: invoke('docs:list'),
    add: invoke('docs:add'),
    remove: invoke('docs:remove')
  },
  dailyLogs: {
    list: invoke('dailyLogs:list'),
    get: invoke('dailyLogs:get'),
    create: invoke('dailyLogs:create'),
    update: invoke('dailyLogs:update'),
    delete: invoke('dailyLogs:delete')
  },
  taskCategories: {
    list: invoke('taskCategories:list'),
    add: invoke('taskCategories:add'),
    delete: invoke('taskCategories:delete')
  },
  tasks: {
    list: invoke('tasks:list'),
    create: invoke('tasks:create'),
    update: invoke('tasks:update'),
    delete: invoke('tasks:delete'),
    listAllOpen: invoke('tasks:listAllOpen'),
    generateFromSchedule: invoke('tasks:generateFromSchedule')
  },
  taskTemplates: {
    list: invoke('taskTemplates:list'),
    create: invoke('taskTemplates:create'),
    update: invoke('taskTemplates:update'),
    delete: invoke('taskTemplates:delete')
  },
  jira: {
    list: invoke('jira:list'),
    get: invoke('jira:get'),
    create: invoke('jira:create'),
    update: invoke('jira:update'),
    delete: invoke('jira:delete'),
    listComments: invoke('jira:listComments'),
    addComment: invoke('jira:addComment'),
    deleteComment: invoke('jira:deleteComment'),
    listConnections: invoke('jira:listConnections'),
    addConnection: invoke('jira:addConnection'),
    removeConnection: invoke('jira:removeConnection'),
    updateProjectSync: invoke('jira:updateProjectSync'),
    syncNow: invoke('jira:syncNow')
  },
  notes: {
    list: invoke('notes:list'),
    get: invoke('notes:get'),
    create: invoke('notes:create'),
    update: invoke('notes:update'),
    archive: invoke('notes:archive'),
    listAllTags: invoke('notes:listAllTags')
  },
  search: {
    query: invoke('search:query')
  },
  dashboard: {
    get: invoke('dashboard:get')
  },
  backup: {
    create: invoke('backup:create'),
    list: invoke('backup:list'),
    restore: invoke('backup:restore'),
    exportJson: invoke('backup:exportJson')
  },
  files: {
    pickFileOrFolder: invoke('files:pickFileOrFolder'),
    pickExcelFile: invoke('files:pickExcelFile'),
    pickPdfFile: invoke('files:pickPdfFile'),
    pickJiraExportFile: invoke('files:pickJiraExportFile'),
    openPath: invoke('files:openPath'),
    pickBackupFile: invoke('files:pickBackupFile')
  },
  excel: {
    preview: invoke('excel:preview'),
    import: invoke('excel:import'),
    importJira: invoke('excel:importJira')
  },
  pdf: {
    previewSchedule: invoke('pdf:previewSchedule'),
    importSchedule: invoke('pdf:importSchedule')
  }
}

export type Api = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
