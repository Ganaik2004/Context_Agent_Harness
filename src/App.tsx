import type { PrefsFile } from '@shared/types'
import { useEffect, useState } from 'react'
import { AiSidebar } from './components/AiSidebar'
import { DocCanvas } from './components/DocCanvas'
import { FolderView } from './components/FolderView'
import { HintChip } from './components/HintChip'
import { HomePage } from './components/HomePage'
import { StatusBar } from './components/StatusBar'
import { TitleBar } from './components/TitleBar'
import { Toolbar } from './components/Toolbar'
import { EditorProvider } from './editor/EditorProvider'
import { api } from './lib/api'
import { useAIStore } from './stores/ai'
import { useDocumentStore } from './stores/document'
import { usePrefsStore } from './stores/prefs'

let bootPromise: Promise<void> | null = null

/**
 * Loads prefs → AI/chat state → notes, exactly once. Module-level so React
 * StrictMode's double-mounted effect can't bootstrap twice.
 */
function boot(): Promise<void> {
  bootPromise ??= (async () => {
    let prefs: PrefsFile = {}
    try {
      prefs = await api.getPrefs()
    } catch {
      // Server unreachable — stores fall back to defaults.
    }
    usePrefsStore.getState().hydrate(prefs)
    await useAIStore.getState().hydrate(prefs)
    await useDocumentStore.getState().bootstrap(prefs.openTabs, prefs.activeNoteId)
  })()
  return bootPromise
}

export function App() {
  const [booted, setBooted] = useState(false)
  const [bootError, setBootError] = useState<string | null>(null)
  const view = useDocumentStore((s) => s.view)
  const activeId = useDocumentStore((s) => s.activeNoteId)
  const docReady = useDocumentStore((s) => (s.activeNoteId ? s.activeNoteId in s.docs : false))

  useEffect(() => {
    let cancelled = false
    boot()
      .then(() => {
        if (!cancelled) setBooted(true)
      })
      .catch(() => {
        if (!cancelled) setBootError('Could not reach the AI Notepad server. Is it running?')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Only read the doc once per note (getState, not a subscription) — otherwise
  // every keystroke would re-render the whole shell. EditorProvider only uses
  // it as the editor's initial content; live edits flow back through the store.
  const initialDoc = activeId && docReady ? useDocumentStore.getState().docs[activeId] : undefined

  const renderMain = () => {
    if (view === 'home') return <HomePage />
    if (view === 'folder') return <FolderView />
    if (booted && activeId && initialDoc) {
      return (
        <EditorProvider key={activeId} noteId={activeId} initialDoc={initialDoc}>
          <Toolbar />
          <DocCanvas />
        </EditorProvider>
      )
    }
    return (
      <div className="grid flex-1 place-items-center text-[13px] text-muted">
        {bootError ?? 'Loading…'}
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col bg-bg text-text">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">{renderMain()}</div>
        {view === 'note' && <AiSidebar />}
      </div>
      {view === 'note' && <StatusBar />}
      <HintChip />
    </div>
  )
}
