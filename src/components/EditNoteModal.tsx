import { FileText, Save, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

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

interface EditNoteModalProps {
  initialTitle: string
  initialColor?: string
  onSave: (name: string, color: string) => void
  onClose: () => void
}

export function EditNoteModal({ initialTitle, initialColor, onSave, onClose }: EditNoteModalProps) {
  const [name, setName] = useState(initialTitle)
  const [color, setColor] = useState(initialColor ?? COLORS[0] ?? '#8b7cf6')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      onSave(trimmed, color)
    } finally {
      onClose()
    }
  }

  const previewName = name.trim() || 'Untitled note'

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
        aria-label="Edit note"
      >
        <header className="create-modal-header">
          <div>
            <h1>Edit note</h1>
            <p>Rename it or change the color — the card previews live.</p>
          </div>
          <button type="button" className="create-modal-close" onClick={onClose} aria-label="Close">
            <X size={16} aria-hidden />
          </button>
        </header>

        <div className="create-modal-body">
          <div>
            <label className="create-field-lbl" htmlFor="edit-note-name">
              Name
            </label>
            <input
              ref={inputRef}
              id="edit-note-name"
              className="create-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Meeting ideas, Chapter 1"
              maxLength={200}
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void submit()
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
                <FileText size={20} aria-hidden />
              </div>
              <div className="create-preview-name">{previewName}</div>
              <div className="create-preview-meta">Just now</div>
              <div className="create-preview-bar" />
            </div>
          </div>
        </div>

        <footer className="create-modal-footer">
          <button type="button" className="create-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="create-submit"
            onClick={() => void submit()}
            disabled={!name.trim() || saving}
          >
            <Save size={15} aria-hidden />
            <span>{saving ? 'Saving…' : 'Save'}</span>
          </button>
        </footer>
      </div>
    </div>
  )
}
