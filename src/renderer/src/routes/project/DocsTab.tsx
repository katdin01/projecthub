import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { DocReference, DocCategory } from '@shared/types'
import { Badge, Button, Card, Field, Input, Modal, Select, EmptyState } from '../../components/ui'

const categoryLabels: Record<DocCategory, string> = {
  scope_of_work: 'Scope of Work',
  project_plan: 'Project Plan',
  mapping: 'Mapping',
  qa_qc: 'QA/QC',
  meeting_notes: 'Meeting Notes',
  technical_doc: 'Technical Documentation',
  other: 'Other'
}

export function DocsTab({ projectId }: { projectId: number }): React.JSX.Element {
  const [docs, setDocs] = useState<DocReference[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<{ category: DocCategory; label: string; path: string; is_folder: boolean; notes: string }>({
    category: 'scope_of_work',
    label: '',
    path: '',
    is_folder: false,
    notes: ''
  })

  function refresh(): void {
    api.docs.list(projectId).then(setDocs)
  }
  useEffect(refresh, [projectId])

  async function pick(kind: 'file' | 'folder'): Promise<void> {
    const path = await api.files.pickFileOrFolder(kind)
    if (!path) return
    setForm({ ...form, path, is_folder: kind === 'folder', label: form.label || path.split(/[\\/]/).pop() || path })
  }

  async function save(): Promise<void> {
    if (!form.path.trim()) return
    await api.docs.add({ project_id: projectId, ...form })
    setForm({ category: 'scope_of_work', label: '', path: '', is_folder: false, notes: '' })
    setModalOpen(false)
    refresh()
  }

  const grouped = Object.entries(categoryLabels).map(([value, label]) => ({
    value: value as DocCategory,
    label,
    docs: docs.filter((d) => d.category === value)
  }))

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setModalOpen(true)}>+ Add reference</Button>
      </div>

      {docs.length === 0 ? (
        <EmptyState>No documents linked yet. Add references to local files or folders (SoW, mapping files, QA docs…).</EmptyState>
      ) : (
        grouped
          .filter((g) => g.docs.length > 0)
          .map((g) => (
            <Card key={g.value}>
              <h3 className="mb-2 text-sm font-semibold">{g.label}</h3>
              <ul className="space-y-1.5 text-sm">
                {g.docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between">
                    <button onClick={() => api.files.openPath(d.path)} className="text-left hover:underline">
                      {d.is_folder && <Badge>folder</Badge>} {d.label}
                    </button>
                    <button onClick={() => api.docs.remove(d.id).then(refresh)} className="text-xs text-slate-400 hover:text-red-500">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ))
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add document reference">
        <div className="space-y-3">
          <Field label="Category">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as DocCategory })}>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Label">
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </Field>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => pick('file')}>
              Pick file…
            </Button>
            <Button variant="secondary" onClick={() => pick('folder')}>
              Pick folder…
            </Button>
          </div>
          {form.path && <p className="truncate text-xs text-slate-500">{form.path}</p>}
          <div className="flex justify-end">
            <Button onClick={save}>Add</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
