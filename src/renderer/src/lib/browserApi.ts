/**
 * Browser transport for the app that used to run inside Electron.
 *
 * In the Electron build, preload exposed `window.api.<namespace>.<method>` and
 * each call went over IPC to the main process. Here we recreate the exact same
 * `window.api` shape, but every call becomes an HTTP POST to the local Node
 * server in ../../../server. Because the shape is identical, none of the React
 * components or src/renderer/src/lib/api.ts had to change — they still call
 * `window.api.projects.list()` etc.
 *
 * The only calls that can't be a plain fetch are the native file pickers, which
 * used OS dialogs. In a browser we substitute a real <input type="file"> upload
 * (the server saves it to a temp file and returns that path, which the existing
 * excel/pdf/backup import code then reads) and, for doc references, a prompt for
 * a path on disk (so "open" can later launch the real file via the OS).
 *
 * This module MUST run before the React app makes any api call — main.tsx
 * imports it first.
 */

interface InvokeResponse {
  ok: boolean
  result?: unknown
  error?: string
}

const invoke =
  (channel: string) =>
  async (...args: unknown[]): Promise<unknown> => {
    const res = await fetch('/api/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, args })
    })
    let data: InvokeResponse
    try {
      data = (await res.json()) as InvokeResponse
    } catch {
      throw new Error(`Request failed (${res.status}) for ${channel}`)
    }
    if (!data.ok) throw new Error(data.error || `Request failed for ${channel}`)
    return data.result
  }

/**
 * Open a browser file dialog, upload the chosen file to the server, and resolve
 * with the temp path the server saved it to (or null if the user cancelled).
 * Mirrors the Electron pickers, which returned an absolute path string.
 */
function pickAndUpload(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false
    const input = document.createElement('input')
    input.type = 'file'
    if (accept) input.accept = accept
    input.style.display = 'none'

    const finish = (value: string | null): void => {
      if (settled) return
      settled = true
      input.remove()
      resolve(value)
    }

    // Success path: the user chose a file. Upload it and hand back the server's
    // temp path (what the excel/pdf/backup import handlers then read).
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0]
      if (!file) return finish(null)
      try {
        const fd = new FormData()
        fd.append('file', file, file.name)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const data = (await res.json()) as { ok: boolean; path?: string; error?: string }
        finish(data.ok && data.path ? data.path : null)
      } catch {
        finish(null)
      }
    })

    // Chromium/Edge fire this when the dialog is dismissed without a choice.
    // (Using the real cancel event avoids the classic focus/timeout guess, which
    // could wrongly resolve null while the dialog was still open — that bug made
    // imports silently do nothing.)
    input.addEventListener('cancel', () => finish(null))

    document.body.appendChild(input)
    input.click()
  })
}

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
  generalTasks: {
    list: invoke('generalTasks:list'),
    create: invoke('generalTasks:create'),
    update: invoke('generalTasks:update'),
    delete: invoke('generalTasks:delete')
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
    syncNow: invoke('jira:syncNow'),
    fetchComments: invoke('jira:fetchComments'),
    postToJira: invoke('jira:postToJira'),
    listTransitions: invoke('jira:listTransitions'),
    applyTransition: invoke('jira:applyTransition'),
    pushFields: invoke('jira:pushFields')
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
    // Browsers can't read an arbitrary disk path from a picker, so for doc
    // references (which store a path to be opened later) we ask for the path.
    pickFileOrFolder: async (kind: 'file' | 'folder'): Promise<string | null> => {
      const answer = window.prompt(
        `Paste the full path to the ${kind} you want to reference (e.g. C:\\Users\\you\\Documents\\plan.xlsx):`
      )
      const trimmed = (answer || '').trim()
      return trimmed ? trimmed : null
    },
    pickExcelFile: (): Promise<string | null> => pickAndUpload('.xlsx,.xls'),
    pickPdfFile: (): Promise<string | null> => pickAndUpload('.pdf'),
    pickJiraExportFile: (): Promise<string | null> => pickAndUpload('.csv,.xlsx,.xls'),
    pickBackupFile: (): Promise<string | null> => pickAndUpload('.db'),
    openPath: invoke('files:openPath')
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

;(window as unknown as { api: typeof api }).api = api
