import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { SearchResult } from '@shared/types'

const entityLabel: Record<SearchResult['entity'], string> = {
  note: 'NOTE',
  task: 'TASK',
  jira: 'JIRA',
  daily_log: 'HOURS LOG'
}

// The snippet comes from SQLite's FTS5 snippet() function with '<b>'/'</b>' markers
// around matched terms. Render those as React elements instead of raw HTML so
// nothing in user-entered note content is ever interpreted as markup.
function HighlightedSnippet({ snippet }: { snippet: string | null }): React.JSX.Element {
  const parts = (snippet ?? '').split(/(<b>|<\/b>)/)
  let bold = false
  return (
    <>
      {parts.map((part, i) => {
        if (part === '<b>') {
          bold = true
          return null
        }
        if (part === '</b>') {
          bold = false
          return null
        }
        return bold ? <b key={i}>{part}</b> : <span key={i}>{part}</span>
      })}
    </>
  )
}

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element | null {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const handle = setTimeout(() => {
      api.search.query(query).then(setResults)
    }, 150)
    return () => clearTimeout(handle)
  }, [query])

  if (!open) return null

  function goTo(result: SearchResult): void {
    if (result.project_id) {
      navigate(`/projects/${result.project_id}?tab=${result.entity === 'jira' ? 'jira' : result.entity === 'task' ? 'tasks' : result.entity === 'daily_log' ? 'daily-log' : 'notes'}`)
    } else if (result.entity === 'note') {
      navigate('/notes')
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-24" onClick={onClose}>
      <div className="w-[36rem] rounded-lg bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          placeholder="Search notes, tasks, Jira, hours logs…"
          className="w-full border-b border-slate-200 px-4 py-3 text-base outline-none"
        />
        <div className="max-h-96 overflow-y-auto">
          {results.length === 0 && query.trim() && (
            <div className="px-4 py-6 text-center text-sm text-slate-400">No matches</div>
          )}
          {results.map((r) => (
            <button
              key={`${r.entity}-${r.id}`}
              onClick={() => goTo(r)}
              className="block w-full border-b border-slate-100 px-4 py-2.5 text-left last:border-b-0 hover:bg-slate-50"
            >
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="font-semibold">{entityLabel[r.entity]}</span>
              </div>
              <div className="text-sm font-medium text-slate-800">{r.title}</div>
              <div className="truncate text-xs text-slate-500">
                <HighlightedSnippet snippet={r.snippet} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
