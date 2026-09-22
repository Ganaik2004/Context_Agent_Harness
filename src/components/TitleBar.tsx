import { ChevronRight, PanelRight, Sparkles } from 'lucide-react'
import { useAIStore } from '../stores/ai'
import { useDocumentStore } from '../stores/document'
import { usePrefsStore } from '../stores/prefs'

export function TitleBar() {
  const view = useDocumentStore((s) => s.view)
  const title = useDocumentStore((s) => {
    const active = s.notes.find((n) => n.id === s.activeNoteId)
    return active?.title ?? ''
  })
  const activeFolderId = useDocumentStore((s) => s.activeFolderId)
  const folders = useDocumentStore((s) => s.folders)
  const goHome = useDocumentStore((s) => s.goHome)
  const toggleSidebar = usePrefsStore((s) => s.toggleSidebar)
  const status = useAIStore((s) => s.status)
  const error = useAIStore((s) => s.error)

  const openFolder = useDocumentStore((s) => s.openFolder)
  const activeFolder = folders.find((f) => f.id === activeFolderId)

  const pill =
    status === 'connected'
      ? { label: 'Connected', cls: 'pill ok' }
      : status === 'connecting'
        ? { label: 'Connecting…', cls: 'pill busy' }
        : { label: 'Disconnected', cls: 'pill' }

  return (
    <header className="flex h-12 shrink-0 items-center gap-3.5 border-b border-border bg-panel px-3">
      <button
        type="button"
        className="brand-btn"
        onClick={goHome}
        aria-label="Go to My Folders"
        title="My Folders"
      >
        <div className="grid size-[26px] place-items-center rounded-[7px] bg-linear-to-br from-accent to-[#5a4fd0] text-white">
          <Sparkles size={13} aria-hidden />
        </div>
        <span>AI Notepad</span>
      </button>
      <nav className="flex min-w-0 items-center gap-2 text-[13px] text-muted">
        <button type="button" className="crumb-home" onClick={goHome} aria-label="Go to Home">
          My Folders
        </button>
        {view !== 'home' && (
          <>
            <ChevronRight size={12} aria-hidden />
            {view === 'folder' && activeFolder && (
              <button
                type="button"
                className="crumb-link"
                onClick={() => openFolder(activeFolder.id)}
                aria-label={`Open folder ${activeFolder.name}`}
              >
                {activeFolder.name}
              </button>
            )}
            {view === 'note' && (
              <>
                <button
                  type="button"
                  className="crumb-link"
                  disabled={!activeFolder}
                  onClick={() => activeFolder && openFolder(activeFolder.id)}
                  aria-label={activeFolder ? `Open folder ${activeFolder.name}` : undefined}
                >
                  {activeFolder?.name ?? 'Notes'}
                </button>
                <ChevronRight size={12} aria-hidden />
                <b className="truncate font-semibold text-text">{title}</b>
              </>
            )}
          </>
        )}
      </nav>
      <div className="flex-1" />
      <div
        className={pill.cls}
        title={error ?? undefined}
        role="status"
        aria-label={`AI connection: ${pill.label}`}
      >
        {pill.label}
      </div>
      {view === 'note' && (
        <button
          type="button"
          className="iconbtn"
          onClick={toggleSidebar}
          title="Toggle AI panel"
          aria-label="Toggle AI panel"
        >
          <PanelRight size={16} aria-hidden />
        </button>
      )}
    </header>
  )
}
