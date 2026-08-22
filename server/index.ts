/**
 * ProjectHub — local web server.
 *
 * Replaces the Electron main process. It:
 *   1. opens the SQLite database (running migrations) and starts the Jira
 *      auto-sync scheduler, exactly as the Electron app did on startup;
 *   2. exposes the old IPC table as HTTP (POST /api/invoke) via server/handlers;
 *   3. accepts browser file uploads (POST /api/upload) so the Excel/PDF/backup
 *      import flows still get a real file path to read;
 *   4. serves the built renderer in ./dist as a static site.
 *
 * Nothing here needs Electron, so it runs on any machine with Node — including
 * ones where Electron itself is blocked.
 */
import express from 'express'
import multer from 'multer'
import { existsSync, mkdirSync, statSync, createWriteStream } from 'fs'
import { join, resolve } from 'path'
import { randomUUID } from 'crypto'
import { getDb, dataDir } from '../src/main/db/index'
import { startJiraScheduler } from '../src/main/jira/sync'
import { upgradeTokenEncryption } from '../src/main/jira/credentials'
import { startAutoBackup } from '../src/main/backup/auto'
import { handlers } from './handlers'

const PORT = Number(process.env.PH_PORT) || 4317
const DIST_DIR = resolve(process.cwd(), 'dist')

function tmpDir(): string {
  const dir = join(dataDir(), 'tmp')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

// When running hidden in the background there's no console to watch, so mirror
// all output to a rolling log file the user (or I) can read to diagnose issues.
function setupFileLogging(): void {
  const dir = join(dataDir(), 'logs')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const logPath = join(dir, 'server.log')
  const tooBig = existsSync(logPath) && statSync(logPath).size > 5 * 1024 * 1024
  const stream = createWriteStream(logPath, { flags: tooBig ? 'w' : 'a' })
  const tee = (level: string, orig: (...a: unknown[]) => void) => (...args: unknown[]): void => {
    try {
      stream.write(`[${new Date().toISOString()}] ${level} ${args.map((a) => String(a)).join(' ')}\n`)
    } catch {
      /* never let logging crash the server */
    }
    orig(...args)
  }
  console.log = tee('INFO', console.log.bind(console))
  console.warn = tee('WARN', console.warn.bind(console))
  console.error = tee('ERROR', console.error.bind(console))
}

setupFileLogging()

// Startup order: open+migrate the DB, upgrade token encryption to DPAPI, kick
// off automatic off-machine backups, then start Jira auto-sync.
getDb()
upgradeTokenEncryption()
startAutoBackup()
// Skip the automatic Jira sync scheduler when PH_DISABLE_SYNC=1 (used in local
// refine/dev sessions to avoid any unattended external calls). Manual "Sync now"
// from the UI still works.
if (process.env.PH_DISABLE_SYNC !== '1') startJiraScheduler()

const app = express()
app.use(express.json({ limit: '50mb' }))

// Uploaded files land in ./data/tmp with a unique name; the returned path is
// what the browser passes back to excel:*/pdf:*/backup:restore handlers.
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpDir()),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}-${file.originalname}`)
  }),
  limits: { fileSize: 100 * 1024 * 1024 }
})

app.post('/api/upload', upload.single('file'), (req, res) => {
  const file = (req as express.Request & { file?: { path: string } }).file
  if (!file) {
    res.status(400).json({ ok: false, error: 'No file uploaded' })
    return
  }
  res.json({ ok: true, path: file.path })
})

app.post('/api/invoke', async (req, res) => {
  const { channel, args } = req.body as { channel?: string; args?: unknown[] }
  if (!channel || typeof channel !== 'string') {
    res.status(400).json({ ok: false, error: 'Missing channel' })
    return
  }
  const handler = handlers[channel]
  if (!handler) {
    res.status(404).json({ ok: false, error: `Unknown channel: ${channel}` })
    return
  }
  try {
    const result = await handler(...(Array.isArray(args) ? args : []))
    res.json({ ok: true, result })
  } catch (err) {
    // Surface the real message to the UI (these are local, trusted callers).
    const error = err instanceof Error ? err.message : 'Unknown server error'
    console.error(`[api] ${channel} failed:`, err)
    res.status(500).json({ ok: false, error })
  }
})

if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
} else {
  console.warn(`\n[!] Built UI not found at ${DIST_DIR}. Run "npm run build" first.\n`)
}

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  ProjectHub is running.`)
  console.log(`  Open:  http://localhost:${PORT}`)
  console.log(`  Data:  ${join(dataDir(), 'data.db')}`)
  console.log(`  Logs:  ${join(dataDir(), 'logs', 'server.log')}\n`)
})

// If another ProjectHub instance already holds the port, exit quietly rather
// than crash-looping — the supervisor treats a clean exit as "already running".
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`  Port ${PORT} is already in use — another ProjectHub is running. Exiting.`)
    process.exit(0)
  }
  console.error('  Server failed to start:', err)
  process.exit(1)
})
