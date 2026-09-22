import { X } from 'lucide-react'
import { useDocumentStore } from '../stores/document'

/** Open-note tab strip. Note creation/deletion happen on the folder's note list, not here. */
export function NoteTabs() {
  const notes = useDocumentStore((s) => s.notes)
  const openTabs = useDocumentStore((s) => s.openTabs)
  const activeId = useDocumentStore((s) => s.activeNoteId)
  const openNote = useDocumentStore((s) => s.openNote)
  const closeTab = useDocumentStore((s) => s.closeTab)

  return (
    <div className="tabs" role="tablist" aria-label="Open notes">
      {openTabs.map((id) => {
        const note = notes.find((n) => n.id === id)
        if (!note) return null
        const active = id === activeId
        return (
          <div
            key={id}
            role="tab"
            aria-selected={active}
            tabIndex={0}
            className={active ? 'tab active' : 'tab'}
            title={note.title}
            onClick={() => void openNote(id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                void openNote(id)
              }
            }}
          >
            <span className="max-w-44 truncate">{note.title}</span>
            <button
              type="button"
              className="x"
              aria-label={`Close ${note.title}`}
              onClick={(e) => {
                e.stopPropagation()
                void closeTab(id)
              }}
            >
              <X size={11} aria-hidden />
            </button>
          </div>
        )
      })}
    </div>
  )
}
