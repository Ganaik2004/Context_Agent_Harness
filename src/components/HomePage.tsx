import { Folder as FolderIcon, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { FolderMeta } from '../../shared/types'
import { useDocumentStore } from '../stores/document'
import { ConfirmModal } from './ConfirmModal'
import { NewFolderModal } from './NewFolderModal'

export function HomePage() {
  const folders = useDocumentStore((s) => s.folders)
  const notes = useDocumentStore((s) => s.notes)
  const openFolder = useDocumentStore((s) => s.openFolder)
  const createFolder = useDocumentStore((s) => s.createFolder)
  const updateFolder = useDocumentStore((s) => s.updateFolder)
  const deleteFolder = useDocumentStore((s) => s.deleteFolder)

  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<
    { mode: 'create' } | { mode: 'edit'; folder: FolderMeta } | null
  >(null)
  const [confirmTarget, setConfirmTarget] = useState<FolderMeta | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...folders].sort((a, b) => b.updatedAt - a.updatedAt)
    if (!q) return sorted
    return sorted.filter((f) => f.name.toLowerCase().includes(q))
  }, [folders, query])

  return (
    <div className="home-wrap">
      <div className="home-head">
        <h1 className="home-title">My Folders</h1>
        <button
          type="button"
          className="new-folder-btn"
          onClick={() => setModal({ mode: 'create' })}
        >
          <Plus size={15} aria-hidden />
          <span>New Folder</span>
        </button>
      </div>

      <div className="home-search-wrap">
        <Search size={15} className="home-search-icon" aria-hidden />
        <input
          className="home-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search folders…"
          aria-label="Search folders"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="home-empty">
          <FolderIcon size={32} className="home-empty-icon" aria-hidden />
          <p>
            {folders.length === 0
              ? 'No folders yet. Create one to organize your notes.'
              : 'No folders match your search.'}
          </p>
        </div>
      ) : (
        <div className="folder-grid">
          {filtered.map((folder) => {
            const count = notes.filter((n) => n.folderId === folder.id).length
            return (
              <button
                key={folder.id}
                type="button"
                className="folder-card"
                style={{ '--folder-color': folder.color } as React.CSSProperties}
                onClick={() => openFolder(folder.id)}
              >
                <span className="folder-card-icon">
                  <FolderIcon size={20} aria-hidden />
                </span>
                <span className="folder-card-body">
                  <span className="folder-card-name">{folder.name}</span>
                  <span className="folder-card-meta">
                    {count} note{count === 1 ? '' : 's'} · just now
                  </span>
                </span>
                <span className="folder-card-actions">
                  <button
                    type="button"
                    className="folder-action"
                    title="Edit folder"
                    aria-label={`Edit folder ${folder.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setModal({ mode: 'edit', folder })
                    }}
                  >
                    <Pencil size={14} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="folder-action danger"
                    title="Delete folder"
                    aria-label={`Delete folder ${folder.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmTarget(folder)
                    }}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </span>
                <span className="folder-card-bar" aria-hidden />
              </button>
            )
          })}
        </div>
      )}

      {modal && (
        <NewFolderModal
          mode={modal.mode}
          initial={modal.mode === 'edit' ? modal.folder : undefined}
          noteCount={
            modal.mode === 'edit' ? notes.filter((n) => n.folderId === modal.folder.id).length : 0
          }
          onCreate={(name, color) => void createFolder(name, color)}
          onUpdate={
            modal.mode === 'edit'
              ? (name, color) => void updateFolder(modal.folder.id, { name, color })
              : undefined
          }
          onClose={() => setModal(null)}
        />
      )}

      {confirmTarget && (
        <ConfirmModal
          title="Delete folder"
          message={`Delete "${confirmTarget.name}" and move its notes to another folder?`}
          confirmLabel="Delete"
          onConfirm={() => void deleteFolder(confirmTarget.id)}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </div>
  )
}
