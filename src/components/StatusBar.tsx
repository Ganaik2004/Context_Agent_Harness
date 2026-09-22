import { docStats } from '@shared/count'
import { useMemo } from 'react'
import { useDocumentStore } from '../stores/document'

function formatTime(ts: number): string {
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
}

export function StatusBar() {
  const title = useDocumentStore((s) => s.notes.find((n) => n.id === s.activeNoteId)?.title ?? '')
  const doc = useDocumentStore((s) => (s.activeNoteId ? s.docs[s.activeNoteId] : undefined))
  const saveStatus = useDocumentStore((s) => s.saveStatus)
  const savedAt = useDocumentStore((s) => s.savedAt)

  const stats = useMemo(() => (doc ? docStats(doc) : { words: 0, chars: 0 }), [doc])

  const saved =
    saveStatus === 'saving'
      ? { label: 'Saving…', color: 'var(--color-amber)' }
      : saveStatus === 'error'
        ? { label: 'Save failed', color: 'var(--color-red)' }
        : savedAt
          ? { label: `Saved ${formatTime(savedAt)}`, color: 'var(--color-green)' }
          : { label: 'Ready', color: 'var(--color-muted)' }

  return (
    <div className="statusbar">
      <span>
        {stats.words} words · {stats.chars} chars
      </span>
      <span className="truncate">{title}</span>
      <span className="saved" style={{ color: saved.color }} role="status">
        {saved.label}
      </span>
    </div>
  )
}
