import Database from 'better-sqlite3'
import { existsSync, mkdirSync, copyFileSync } from 'fs'
import { homedir } from 'os'
import { join, isAbsolute, resolve } from 'path'
import { migrations } from './migrations'

let db: Database.Database | null = null

// Where the SQLite database and related files live.
//
// For real, day-to-day use the live database lives in a stable per-user app
// folder (Windows: %LOCALAPPDATA%\ProjectHub\data) rather than next to the app
// in Downloads, which can get cleared. Override with PH_DATA_DIR.
export function dataDir(): string {
  const configured = process.env.PH_DATA_DIR
  let dir: string
  if (configured) {
    dir = isAbsolute(configured) ? configured : resolve(process.cwd(), configured)
  } else if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    dir = join(process.env.LOCALAPPDATA, 'ProjectHub', 'data')
  } else {
    dir = join(homedir(), '.projecthub', 'data')
  }
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

// One-time move of a proof-of-concept database that lived in <app>/data into the
// stable app folder. Runs only when the new location has no database yet and the
// old one exists, so it never clobbers real data and is a no-op afterwards.
function migrateLegacyDataIfNeeded(targetDir: string): void {
  const targetDb = join(targetDir, 'data.db')
  if (existsSync(targetDb)) return
  const legacyDir = resolve(process.cwd(), 'data')
  if (legacyDir === targetDir) return
  if (!existsSync(join(legacyDir, 'data.db'))) return
  for (const f of ['data.db', 'data.db-wal', 'data.db-shm', 'jira-credentials.json']) {
    const src = join(legacyDir, f)
    if (existsSync(src)) copyFileSync(src, join(targetDir, f))
  }
  console.log(`[data] migrated existing database from ${legacyDir} to ${targetDir}`)
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const applied = new Set(
    database.prepare('SELECT name FROM _migrations').all().map((r) => (r as { name: string }).name)
  )

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue
    const runMigration = database.transaction(() => {
      database.exec(migration.sql)
      database.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name)
    })
    runMigration()
  }
}

export function getDb(): Database.Database {
  if (db) return db

  const dir = dataDir()
  migrateLegacyDataIfNeeded(dir)
  const dbPath = join(dir, 'data.db')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)

  return db
}

export function getDbPath(): string {
  return join(dataDir(), 'data.db')
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
