import { randomUUID } from 'crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { dataDir } from '../db/index'
import { dpapiAvailable, dpapiProtect, dpapiUnprotect } from './dpapi'
import type { JiraConnectionSummary, JiraConnectionType } from '@shared/types'

// Kept in its own file outside the SQLite database (and therefore outside
// backups and JSON exports) since it holds Jira tokens. Different clients run
// their own separate Jira sites (some Cloud, some self-hosted Server/Data
// Center), so this holds a list of named connections rather than a single
// global one — each project picks which connection it syncs against (see
// projects.jira_connection_id).
//
// SECURITY: on Windows the token is encrypted at rest with DPAPI (CurrentUser
// scope) — decryptable only by this Windows account on this machine (enc:
// 'dpapi'). Where DPAPI isn't available it falls back to base64 (enc: 'b64').
// Legacy entries written before this had no `enc` field and are treated as b64;
// upgradeTokenEncryption() re-encrypts them to DPAPI on startup.
function credentialsPath(): string {
  return join(dataDir(), 'jira-credentials.json')
}

type TokenEnc = 'dpapi' | 'b64'

function protectToken(plain: string): { encryptedToken: string; enc: TokenEnc } {
  if (dpapiAvailable()) {
    try {
      return { encryptedToken: dpapiProtect(plain), enc: 'dpapi' }
    } catch {
      // Fall back to base64 if DPAPI ever fails, so saving never hard-errors.
    }
  }
  return { encryptedToken: Buffer.from(plain, 'utf-8').toString('base64'), enc: 'b64' }
}

function unprotectToken(c: StoredConnection): string {
  if (c.enc === 'dpapi') return dpapiUnprotect(c.encryptedToken)
  return Buffer.from(c.encryptedToken, 'base64').toString('utf-8')
}

interface StoredConnection {
  id: string
  name: string
  type: JiraConnectionType
  siteUrl: string
  email: string | null
  encryptedToken: string
  enc?: TokenEnc
}

export interface JiraCredentials {
  type: JiraConnectionType
  siteUrl: string
  email: string | null
  apiToken: string
}

function readStored(): StoredConnection[] {
  const path = credentialsPath()
  if (!existsSync(path)) return []
  return JSON.parse(readFileSync(path, 'utf-8')) as StoredConnection[]
}

function writeStored(connections: StoredConnection[]): void {
  writeFileSync(credentialsPath(), JSON.stringify(connections), { mode: 0o600 })
}

export function listJiraConnections(): JiraConnectionSummary[] {
  return readStored().map(({ id, name, type, siteUrl, email }) => ({ id, name, type, siteUrl, email }))
}

export function getJiraConnection(id: string): JiraCredentials | null {
  const stored = readStored().find((c) => c.id === id)
  if (!stored) return null
  const apiToken = unprotectToken(stored)
  return { type: stored.type, siteUrl: stored.siteUrl, email: stored.email, apiToken }
}

// Re-encrypt any tokens still stored as base64 (legacy or DPAPI-unavailable
// writes) to DPAPI. Called once on server startup; a no-op when nothing needs
// upgrading or DPAPI isn't available.
export function upgradeTokenEncryption(): void {
  if (!dpapiAvailable()) return
  const connections = readStored()
  let changed = false
  for (const c of connections) {
    if (c.enc === 'dpapi') continue
    try {
      const plain = unprotectToken(c)
      const p = protectToken(plain)
      if (p.enc === 'dpapi') {
        c.encryptedToken = p.encryptedToken
        c.enc = p.enc
        changed = true
      }
    } catch {
      // Leave unreadable/odd entries untouched rather than risk losing them.
    }
  }
  if (changed) writeStored(connections)
}

export function addJiraConnection(
  name: string,
  type: JiraConnectionType,
  siteUrl: string,
  email: string | null,
  apiToken: string
): string {
  const id = randomUUID()
  // A stray trailing newline from copy-pasting the token (common — some
  // token-generation pages render it in a way that includes one) would
  // silently corrupt every request and produce auth failures that look
  // identical to a wrong token, so strip whitespace before it's ever stored.
  const { encryptedToken, enc } = protectToken(apiToken.trim())
  const normalizedSiteUrl = siteUrl.trim().replace(/\/+$/, '')
  const connections = readStored()
  connections.push({
    id,
    name: name.trim(),
    type,
    siteUrl: normalizedSiteUrl,
    email: type === 'cloud' ? (email ?? '').trim() : null,
    encryptedToken,
    enc
  })
  writeStored(connections)
  return id
}

export function removeJiraConnection(id: string): void {
  writeStored(readStored().filter((c) => c.id !== id))
}
