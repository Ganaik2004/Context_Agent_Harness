import { AlertTriangle } from 'lucide-react'
import { useEffect } from 'react'

interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Delete',
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <button type="button" className="modal-overlay" onClick={onCancel} aria-label="Cancel">
      <div
        className="modal-card confirm-card"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="confirm-icon" aria-hidden>
          <AlertTriangle size={22} />
        </div>
        <div className="confirm-title">{title}</div>
        <div className="confirm-msg">{message}</div>
        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`modal-confirm${destructive ? ' danger' : ''}`}
            onClick={() => {
              onConfirm()
              onCancel()
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </button>
  )
}
