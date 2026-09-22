import { ArrowLeft, FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useDocumentStore } from '../stores/document'
import { ConfirmModal } from './ConfirmModal'
import { EditNoteModal } from './EditNoteModal'
import { NewNoteModal } from './NewNoteModal'

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function FolderView() {
  const folders = useDocumentStore((s) => s.folders)
  const activeFolderId = useDocumentStore((s) => s.activeFolderId)
  const notes = useDocumentStore((s) => s.notes)
  const openNote = useDocumentStore((s) => s.openNote)
  const createNote = useDocumentStore((s) => s.createNote)
  const updateNote = useDocumentStore((s) => s.updateNote)
  const deleteNote = useDocumentStore((s) => s.deleteNote)
  const goHome = useDocumentStore((s) => s.goHome)

  const [query, setQuery] = useState('')
  const [editingNote, setEditingNote] = useState<{
    id: string
    title: string
    color?: string
  } | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; title: string } | null>(null)
  const [noteModalOpen, setNoteModalOpen] = useState(false)

  const folder = folders.find((f) => f.id === activeFolderId)

  const folderNotes = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = notes.filter((n) => n.folderId === activeFolderId)
    const sorted = filtered.sort((a, b) => b.updatedAt - a.updatedAt)
    if (!q) return sorted
    return sorted.filter((n) => n.title.toLowerCase().includes(q))
  }, [notes, activeFolderId, query])

  return (
    <div className="folder-view">
      <div className="folder-view-head">
        <button type="button" className="folder-back" onClick={goHome} aria-label="Back to Home">
          <ArrowLeft size={16} aria-hidden />
        </button>
        {folder && (
          <span className="folder-view-swatch" style={{ background: folder.color }} aria-hidden />
        )}
        <span className="folder-view-name">{folder?.name ?? 'Folder'}</span>
        <span className="folder-view-count">
          {folderNotes.length} note{folderNotes.length === 1 ? '' : 's'}
        </span>
        <div className="folder-spacer" />
        <button
          type="button"
          className="folder-new-note"
          onClick={() => setNoteModalOpen(true)}
          title="New note"
        >
          <Plus size={14} aria-hidden />
          <span>New Note</span>
        </button>
      </div>

      <div className="home-search-wrap">
        <Search size={15} className="home-search-icon" aria-hidden />
        <input
          className="home-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes…"
          aria-label="Search notes"
        />
      </div>

      {folderNotes.length === 0 ? (
        <div className="folder-empty">
          <FileText size={28} className="folder-empty-icon" aria-hidden />
          <p>{query ? 'No notes match your search.' : 'No notes in this folder yet.'}</p>
          {!query && (
            <button
              type="button"
              className="folder-empty-btn"
              onClick={() => setNoteModalOpen(true)}
            >
              Create your first note
            </button>
          )}
        </div>
      ) : (
        <div className="note-card-grid">
          {folderNotes.map((note) => (
            <div
              key={note.id}
              className="note-card"
              style={{ '--note-color': note.color } as React.CSSProperties}
            >
              <span className="note-card-icon">
                <FileText size={18} aria-hidden />
              </span>
              <span className="note-card-body">
                <span className="note-card-title">{note.title}</span>
                <span className="note-card-meta">{formatDate(note.updatedAt)}</span>
              </span>
              <span className="note-card-actions">
                <button
                  type="button"
                  className="note-action"
                  title="Edit note"
                  aria-label={`Edit note ${note.title}`}
                  onClick={() =>
                    setEditingNote({ id: note.id, title: note.title, color: note.color })
                  }
                >
                  <Pencil size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  className="note-action danger"
                  title="Delete note"
                  aria-label={`Delete note ${note.title}`}
                  onClick={() => setConfirmTarget({ id: note.id, title: note.title })}
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </span>
              <button
                type="button"
                className="note-card-open"
                onClick={() => void openNote(note.id)}
                aria-label={`Open note ${note.title}`}
              />
              <span className="note-card-bar" aria-hidden />
            </div>
          ))}
        </div>
      )}

      {confirmTarget && (
        <ConfirmModal
          title="Delete note"
          message={`Are you sure you want to delete "${confirmTarget.title}"? This cannot be undone.`}
          onConfirm={() => void deleteNote(confirmTarget.id)}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      {editingNote && (
        <EditNoteModal
          initialTitle={editingNote.title}
          initialColor={editingNote.color}
          onSave={(name, color) => void updateNote(editingNote.id, { title: name, color })}
          onClose={() => setEditingNote(null)}
        />
      )}

      {noteModalOpen && (
        <NewNoteModal
          onCreate={(name, color) => void createNote(name, color)}
          onClose={() => setNoteModalOpen(false)}
        />
      )}
    </div>
  )
}
