import { Folder, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FolderMeta } from '../../shared/types'

const COLORS = [
  '#8b7cf6',
  '#34d399',
  '#f5b83d',
  '#ec6a9f',
  '#60a5fa',
  '#f87171',
  '#a78bfa',
  '#38bdf8',
]

interface NewFolderModalProps {
  mode: 'create' | 'edit'
  initial?: FolderMeta
  noteCount?: number
  onCreate: (name: string, color: string) => void
  onUpdate?: (name: string, color: string) => void
  onClose: () => void
}

export function NewFolderModal({
  mode,
  initial,
  noteCount = 0,
  onCreate,
  onUpdate,
  onClose,
}: NewFolderModalProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? COLORS[0] ?? '#8b7cf6')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    if (mode === 'create') inputRef.current?.select()
  }, [mode])

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (mode === 'edit' && onUpdate) onUpdate(trimmed, color)
    else onCreate(trimmed, color)
    onClose()
  }

  const previewName = name.trim() || 'Untitled folder'

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClose()
      }}
      role="button"
      tabIndex={0}
      aria-label="Close dialog"
    >
      <div
        className="create-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'edit' ? 'Edit folder' : 'New folder'}
      >
        <header className="create-modal-header">
          <div>
            <h1>{mode === 'edit' ? 'Edit folder' : 'New folder'}</h1>
            <p>Name it, pick a color — the card previews live.</p>
          </div>
          <button type="button" className="create-modal-close" onClick={onClose} aria-label="Close">
            <X size={16} aria-hidden />
          </button>
        </header>

        <div className="create-modal-body">
          <div>
            <label className="create-field-lbl" htmlFor="folder-name">
              Name
            </label>
            <input
              ref={inputRef}
              id="folder-name"
              className="create-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Finance, GMAT, Project Alpha"
              maxLength={100}
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                }
              }}
            />

            <span className="create-field-lbl">Color</span>
            <div className="create-swatches">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`create-swatch${c === color ? ' selected' : ''}`}
                  style={{ background: c, '--swatch-color': c } as React.CSSProperties}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  aria-pressed={c === color}
                />
              ))}
              <button
                type="button"
                className="create-swatch custom"
                title="Custom color"
                aria-label="Custom color"
              >
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  aria-label="Pick custom color"
                />
              </button>
            </div>
          </div>

          <div>
            <span className="create-field-lbl">Live preview</span>
            <div
              className="create-preview-card"
              style={{ '--preview-color': color } as React.CSSProperties}
            >
              <div className="create-preview-icon">
                <Folder size={20} aria-hidden />
              </div>
              <div className="create-preview-name">{previewName}</div>
              <div className="create-preview-meta">
                {noteCount} note{noteCount === 1 ? '' : 's'} · just now
              </div>
              <div className="create-preview-bar" />
            </div>
          </div>
        </div>

        <footer className="create-modal-footer">
          <button type="button" className="create-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="create-submit" onClick={submit} disabled={!name.trim()}>
            <Plus size={15} aria-hidden />
            <span>{mode === 'edit' ? 'Save' : 'Create'}</span>
          </button>
        </footer>
      </div>
    </div>
  )
}
