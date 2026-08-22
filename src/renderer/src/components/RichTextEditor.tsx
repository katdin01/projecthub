import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { useEffect } from 'react'
import clsx from 'clsx'

interface Props {
  contentJson: string
  onChange: (json: string, text: string) => void
  placeholder?: string
  editable?: boolean
}

function parseInitialContent(contentJson: string): object | string {
  if (!contentJson) return ''
  try {
    return JSON.parse(contentJson)
  } catch {
    return contentJson
  }
}

export function RichTextEditor({ contentJson, onChange, placeholder, editable = true }: Props): React.JSX.Element {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder ?? 'Start typing…' })
    ],
    content: parseInitialContent(contentJson),
    editable,
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()), editor.getText())
    }
  })

  useEffect(() => {
    return () => editor?.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!editor) return <></>

  return (
    <div className="rounded-md border border-slate-300">
      {editable && (
        <div className="flex flex-wrap gap-1 border-b border-slate-200 p-1.5">
          <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
            B
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
            I
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            • List
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            1. List
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('taskList')}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          >
            ✓ Checklist
          </ToolbarButton>
        </div>
      )}
      <div className="px-3 py-2">
        <EditorContent editor={editor} className="tiptap text-sm" />
      </div>
    </div>
  )
}

function ToolbarButton({
  children,
  active,
  onClick
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded px-2 py-1 text-xs font-medium',
        active ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
      )}
    >
      {children}
    </button>
  )
}
