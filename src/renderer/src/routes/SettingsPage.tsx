import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { BackupInfo, TaskTemplate, DeliveryType, JiraConnectionSummary, JiraConnectionType } from '@shared/types'
import { Button, Card, SectionTitle, EmptyState, Input, Select, Field, Modal } from '../components/ui'
import { formatDate } from '../lib/format'

const deliveryTypeLabels: Record<DeliveryType, string> = {
  internal_delivery: 'Internal delivery',
  external_delivery: 'External delivery',
  soft_internal_delivery: 'Soft internal delivery',
  meeting: 'Meeting',
  client_due_date: 'Client due date'
}

const emptyTemplateForm = { name: '', category: '', delivery_type: '' as DeliveryType | '' }

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function SettingsPage(): React.JSX.Element {
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null)
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm)

  const [jiraConnections, setJiraConnections] = useState<JiraConnectionSummary[]>([])
  const [jiraModalOpen, setJiraModalOpen] = useState(false)
  const [jiraForm, setJiraForm] = useState({
    name: '',
    type: 'cloud' as JiraConnectionType,
    siteUrl: '',
    email: '',
    apiToken: ''
  })
  const [jiraBusy, setJiraBusy] = useState(false)
  const [jiraError, setJiraError] = useState<string | null>(null)

  function refresh(): void {
    api.backup.list().then(setBackups)
    api.taskTemplates.list().then(setTemplates)
    api.jira.listConnections().then(setJiraConnections)
  }
  useEffect(refresh, [])

  function openNewJiraConnection(): void {
    setJiraForm({ name: '', type: 'cloud', siteUrl: '', email: '', apiToken: '' })
    setJiraError(null)
    setJiraModalOpen(true)
  }

  async function saveJiraConnection(): Promise<void> {
    if (!jiraForm.name.trim() || !jiraForm.siteUrl.trim() || !jiraForm.apiToken.trim()) return
    if (jiraForm.type === 'cloud' && !jiraForm.email.trim()) return
    setJiraBusy(true)
    setJiraError(null)
    try {
      const result = await api.jira.addConnection(
        jiraForm.name,
        jiraForm.type,
        jiraForm.siteUrl,
        jiraForm.type === 'cloud' ? jiraForm.email : null,
        jiraForm.apiToken
      )
      if (result.ok) {
        setJiraModalOpen(false)
        refresh()
      } else {
        setJiraError(result.error ?? 'Could not connect to Jira.')
      }
    } finally {
      setJiraBusy(false)
    }
  }

  async function removeJiraConnection(c: JiraConnectionSummary): Promise<void> {
    if (
      !confirm(
        `Remove the "${c.name}" Jira connection? Any projects using it will stop auto-syncing until you pick a replacement.`
      )
    )
      return
    await api.jira.removeConnection(c.id)
    refresh()
  }

  function openNewTemplate(): void {
    setTemplateForm(emptyTemplateForm)
    setEditingTemplateId(null)
    setTemplateModalOpen(true)
  }

  function openEditTemplate(t: TaskTemplate): void {
    setTemplateForm({ name: t.name, category: t.category ?? '', delivery_type: t.delivery_type ?? '' })
    setEditingTemplateId(t.id)
    setTemplateModalOpen(true)
  }

  async function saveTemplate(): Promise<void> {
    if (!templateForm.name.trim()) return
    const payload = {
      name: templateForm.name,
      category: templateForm.category || null,
      delivery_type: templateForm.delivery_type || null,
      sort_order: editingTemplateId ? templates.find((t) => t.id === editingTemplateId)!.sort_order : templates.length
    }
    if (editingTemplateId) {
      await api.taskTemplates.update(editingTemplateId, payload)
    } else {
      await api.taskTemplates.create(payload)
    }
    setTemplateModalOpen(false)
    refresh()
  }

  async function createBackup(): Promise<void> {
    setBusy(true)
    try {
      const info = await api.backup.create()
      setMessage(`Backup created: ${info.fileName}`)
      refresh()
    } finally {
      setBusy(false)
    }
  }

  async function restore(path: string): Promise<void> {
    if (!confirm('Restore this backup? Your current data will be replaced with this backup.')) return
    setBusy(true)
    try {
      await api.backup.restore(path)
      setMessage('Backup restored. Restart the app to ensure a clean reload.')
    } finally {
      setBusy(false)
    }
  }

  async function restoreFromFile(): Promise<void> {
    const path = await api.files.pickBackupFile()
    if (path) restore(path)
  }

  async function exportJson(): Promise<void> {
    const json = await api.backup.exportJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `projecthub-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-8">
      <h1 className="text-2xl font-bold">Settings &amp; Backup</h1>

      {message && <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle>Task Templates</SectionTitle>
          <Button variant="ghost" onClick={openNewTemplate}>
            + Add
          </Button>
        </div>
        <p className="mb-3 text-sm text-slate-500">
          The standard checklist used by "Generate from schedule" on a project's Tasks tab. Each template creates a
          task with a matching name and, when found, a due date pulled from that project's imported schedule.
        </p>
        {templates.length === 0 ? (
          <EmptyState>No task templates yet.</EmptyState>
        ) : (
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto text-sm">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 py-1.5">
                <div className="min-w-0">
                  <button onClick={() => openEditTemplate(t)} className="truncate text-left hover:underline">
                    {t.name}
                  </button>
                  <div className="text-xs text-slate-400">
                    {t.category ?? 'Uncategorized'}
                    {t.delivery_type ? ` · ${deliveryTypeLabels[t.delivery_type]}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => api.taskTemplates.delete(t.id).then(refresh)}
                  className="shrink-0 text-xs text-slate-400 hover:text-red-500"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle>Jira connections</SectionTitle>
          <Button variant="ghost" onClick={openNewJiraConnection}>
            + Add
          </Button>
        </div>
        <p className="mb-3 text-sm text-slate-500">
          Since each client typically runs their own separate Jira site — some Jira Cloud, some self-hosted
          Server/Data Center — add one named connection per client here, then pick which one each project should
          auto-sync against on that project&apos;s Jira tab (in addition to the manual CSV export import, which is
          unaffected). Tokens are encrypted locally and never included in backups or exports.
        </p>

        {jiraConnections.length === 0 ? (
          <EmptyState>No Jira connections yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {jiraConnections.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">
                    {c.name} <span className="font-normal text-slate-400">({c.type === 'cloud' ? 'Cloud' : 'Server/Data Center'})</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {c.siteUrl}
                    {c.email ? ` · ${c.email}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => removeJiraConnection(c)}
                  className="shrink-0 text-xs text-slate-400 hover:text-red-500"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={jiraModalOpen} onClose={() => setJiraModalOpen(false)} title="Add Jira connection" wide>
        <div className="space-y-3">
          {jiraError && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{jiraError}</div>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name (e.g. the client this belongs to)">
              <Input
                placeholder="Acme Corp"
                value={jiraForm.name}
                onChange={(e) => setJiraForm({ ...jiraForm, name: e.target.value })}
              />
            </Field>
            <Field label="Jira type">
              <Select
                value={jiraForm.type}
                onChange={(e) => setJiraForm({ ...jiraForm, type: e.target.value as JiraConnectionType })}
              >
                <option value="cloud">Jira Cloud (yoursite.atlassian.net)</option>
                <option value="server">Jira Server / Data Center (self-hosted)</option>
              </Select>
            </Field>
          </div>
          <Field label="Jira site URL">
            <Input
              placeholder={jiraForm.type === 'cloud' ? 'https://theirsite.atlassian.net' : 'https://jira.theircompany.com'}
              value={jiraForm.siteUrl}
              onChange={(e) => {
                const siteUrl = e.target.value
                // Only *.atlassian.net is ever Jira Cloud — anything else is
                // self-hosted Server/Data Center. Auto-switching this from the
                // URL (instead of relying on the dropdown, which defaults back
                // to Cloud every time this modal opens) avoids silently
                // sending Cloud-style auth at a server site, which Jira's
                // login-attempt limiter reads as repeated bad logins.
                const looksLikeCloud = /(^|\.)atlassian\.net(\/|$)/i.test(siteUrl.replace(/^https?:\/\//, ''))
                setJiraForm({ ...jiraForm, siteUrl, type: siteUrl.trim() ? (looksLikeCloud ? 'cloud' : 'server') : jiraForm.type })
              }}
            />
          </Field>
          {jiraForm.type === 'cloud' ? (
            <>
              <Field label="Email">
                <Input
                  type="email"
                  value={jiraForm.email}
                  onChange={(e) => setJiraForm({ ...jiraForm, email: e.target.value })}
                />
              </Field>
              <Field label="API token">
                <Input
                  type="password"
                  value={jiraForm.apiToken}
                  onChange={(e) => setJiraForm({ ...jiraForm, apiToken: e.target.value })}
                />
              </Field>
              <p className="text-xs text-slate-400">
                Generate a Cloud API token at{' '}
                <span className="font-mono">id.atlassian.com/manage-profile/security/api-tokens</span>.
              </p>
            </>
          ) : (
            <>
              <Field label="Personal Access Token">
                <Input
                  type="password"
                  value={jiraForm.apiToken}
                  onChange={(e) => setJiraForm({ ...jiraForm, apiToken: e.target.value })}
                />
              </Field>
              <p className="text-xs text-slate-400">
                Generate a Personal Access Token from your profile on that Jira instance itself (Profile picture →
                Personal Access Tokens). No email needed — the token identifies you.
              </p>
            </>
          )}
          <div className="flex justify-end">
            <Button disabled={jiraBusy} onClick={saveJiraConnection}>
              {jiraBusy ? 'Connecting…' : 'Save & test connection'}
            </Button>
          </div>
        </div>
      </Modal>

      <Card>
        <SectionTitle>Backup</SectionTitle>
        <p className="mb-3 text-sm text-slate-500">
          Your data lives in a single local SQLite file. Create a backup regularly, and copy it (or the whole
          ProjectHub data folder) when moving to a new machine.
        </p>
        <div className="flex gap-2">
          <Button disabled={busy} onClick={createBackup}>
            Create backup now
          </Button>
          <Button disabled={busy} variant="secondary" onClick={restoreFromFile}>
            Restore from file…
          </Button>
          <Button disabled={busy} variant="secondary" onClick={exportJson}>
            Export as JSON
          </Button>
        </div>
      </Card>

      <Card>
        <SectionTitle>Backup history</SectionTitle>
        {backups.length === 0 ? (
          <EmptyState>No backups yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {backups.map((b) => (
              <li key={b.path} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">{b.fileName}</div>
                  <div className="text-xs text-slate-400">
                    {formatDate(b.createdAt)} · {formatBytes(b.sizeBytes)}
                  </div>
                </div>
                <Button variant="secondary" onClick={() => restore(b.path)}>
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title={editingTemplateId ? 'Edit task template' : 'New task template'}
      >
        <div className="space-y-3">
          <Field label="Name">
            <Input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} />
          </Field>
          <Field label="Category">
            <Input
              value={templateForm.category}
              onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
              placeholder="e.g. Data Conversion"
            />
          </Field>
          <Field label="Delivery type">
            <Select
              value={templateForm.delivery_type}
              onChange={(e) => setTemplateForm({ ...templateForm, delivery_type: e.target.value as DeliveryType | '' })}
            >
              <option value="">(none)</option>
              {Object.entries(deliveryTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-between">
            {editingTemplateId && (
              <Button
                variant="danger"
                onClick={() => api.taskTemplates.delete(editingTemplateId).then(() => { setTemplateModalOpen(false); refresh() })}
              >
                Delete
              </Button>
            )}
            <Button onClick={saveTemplate} className="ml-auto">
              {editingTemplateId ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
