import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { getDb, getDbPath, closeDb, dataDir } from '../index'
import type { BackupInfo } from '@shared/types'

function backupsDir(): string {
  const dir = join(dataDir(), 'backups')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function createBackup(): BackupInfo {
  const db = getDb()
  db.pragma('wal_checkpoint(TRUNCATE)')

  const dir = backupsDir()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `projecthub-backup-${stamp}.db`
  const dest = join(dir, fileName)
  copyFileSync(getDbPath(), dest)

  const stats = statSync(dest)
  return { fileName, path: dest, createdAt: new Date().toISOString(), sizeBytes: stats.size }
}

export function listBackups(): BackupInfo[] {
  const dir = backupsDir()
  return readdirSync(dir)
    .filter((f) => f.endsWith('.db'))
    .map((fileName) => {
      const path = join(dir, fileName)
      const stats = statSync(path)
      return { fileName, path, createdAt: stats.mtime.toISOString(), sizeBytes: stats.size }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function restoreBackup(backupPath: string): void {
  closeDb()
  copyFileSync(backupPath, getDbPath())
  // Reopen so the app keeps working without a restart; migrations re-run harmlessly
  // (already-applied migrations are skipped via the _migrations table).
  getDb()
}

export function exportJson(): string {
  const db = getDb()
  const tables = [
    'projects',
    'project_people',
    'schedule_items',
    'doc_references',
    'daily_logs',
    'task_categories',
    'tasks',
    'jira_items',
    'notes',
    'tags',
    'note_tags'
  ]
  const dump: Record<string, unknown[]> = {}
  for (const table of tables) {
    dump[table] = db.prepare(`SELECT * FROM ${table}`).all()
  }
  return JSON.stringify(dump, null, 2)
}
