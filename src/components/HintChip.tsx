import { X } from 'lucide-react'
import { usePrefsStore } from '../stores/prefs'

/** First-run hint, bottom-left. Dismissal persists via the prefs store. */
export function HintChip() {
  const showHint = usePrefsStore((s) => s.showHint)
  const dismissHint = usePrefsStore((s) => s.dismissHint)

  if (!showHint) return null

  return (
    <div className="hintchip">
      <span>
        <b>Paste a screenshot</b> with Ctrl+V · hover an image and drag its{' '}
        <b>left or right edge</b> · hover a block for the <b>+</b> menu
      </span>
      <button type="button" onClick={dismissHint} aria-label="Dismiss hint">
        <X size={13} aria-hidden />
      </button>
    </div>
  )
}
