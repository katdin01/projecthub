import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { getDb, getDbPath } from '../db/index'

// Automatic, rotating off-machine backups so client data can't be lost. Copies
// live in OneDrive (or Documents) so a copy exists outside this machine. These
// are separate from the manual Settings → Backup files (which stay local).
const KEEP = 14
const DAY_MS = 24 * 60 * 60 * 1000
const PREFIX = 'projecthub-auto-'

export function backupDir(): string {
  const configured = process.env.PH_BACKUP_DIR
  let base: string
  if (configured) {
    base = configured
  } else {
    const oneDrive = process.env.OneDrive || process.env.OneDriveCommercial || process.env.OneDriveConsumer
    base = oneDrive ? join(oneDrive, 'ProjectHub Backups') : join(homedir(), 'Documents', 'ProjectHub Backups')
  }
  if (!existsSync(base)) mkdirSync(base, { recursive: true })
  return base
}

function listBackups(dir: string): { file: string; mtime: number }[] {
  return readdirSync(dir)
    .filter((f) => f.startsWith(PREFIX) && f.endsWith('.db'))
    .map((f) => ({ file: f, mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
}

export function runBackup(): string | null {
  try {
    const db = getDb()
    // Fold the WAL back into the main file so the copy is a complete database.
    db.pragma('wal_checkpoint(TRUNCATE)')
    const dir = backupDir()
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dest = join(dir, `${PREFIX}${stamp}.db`)
    copyFileSync(getDbPath(), dest)
    for (const { file } of listBackups(dir).slice(KEEP)) {
      try {
        unlinkSync(join(dir, file))
      } catch {
        /* ignore prune failures */
      }
    }
    console.log(`[backup] wrote ${dest}`)
    return dest
  } catch (e) {
    console.error('[backup] failed:', e)
    return null
  }
}

let handle: NodeJS.Timeout | null = null

export function startAutoBackup(): void {
  // Back up on startup unless a recent one already exists (avoids churn if the
  // app restarts several times), then once a day while running.
  try {
    const newest = listBackups(backupDir())[0]
    if (!newest || Date.now() - newest.mtime > 12 * 60 * 60 * 1000) runBackup()
  } catch {
    runBackup()
  }
  if (!handle) handle = setInterval(runBackup, DAY_MS)
}
