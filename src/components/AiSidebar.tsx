import { DEFAULT_BASE_URL } from '@shared/types'
import {
  ArrowUp,
  Check,
  ChevronDown,
  FileText,
  Plug,
  Search,
  Settings,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAIStore } from '../stores/ai'
import { MIN_WIDTH, usePrefsStore } from '../stores/prefs'

export function AiSidebar() {
  const open = usePrefsStore((s) => s.sidebarOpen)
  const width = usePrefsStore((s) => s.sidebarWidth)

  const baseUrl = useAIStore((s) => s.baseUrl)
  const apiKey = useAIStore((s) => s.apiKey)
  const model = useAIStore((s) => s.model)
  const models = useAIStore((s) => s.models)
  const status = useAIStore((s) => s.status)
  const error = useAIStore((s) => s.error)
  const messages = useAIStore((s) => s.messages)
  const streaming = useAIStore((s) => s.streaming)
  const includeContext = useAIStore((s) => s.includeContext)
  const setBaseUrl = useAIStore((s) => s.setBaseUrl)
  const setApiKey = useAIStore((s) => s.setApiKey)
  const setModel = useAIStore((s) => s.setModel)
  const setIncludeContext = useAIStore((s) => s.setIncludeContext)
  const connect = useAIStore((s) => s.connect)
  const send = useAIStore((s) => s.send)
  const stop = useAIStore((s) => s.stop)
  const clearHistory = useAIStore((s) => s.clearHistory)

  const [draft, setDraft] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modelPanelOpen, setModelPanelOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const asideRef = useRef<HTMLElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  const connected = status === 'connected'
  const showSettings = !connected || settingsOpen

  // Track parent container width for the 50% max.
  useEffect(() => {
    const parent = asideRef.current?.parentElement
    if (!parent) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setContainerWidth(w)
    })
    ro.observe(parent)
    setContainerWidth(parent.clientWidth)
    return () => ro.disconnect()
  }, [])

  const maxWidth = Math.max(MIN_WIDTH, Math.floor(containerWidth / 2))
  const displayWidth = Math.min(width, maxWidth)

  // Keep chat pinned to latest message while streaming.
  // biome-ignore lint/correctness/useExhaustiveDependencies: messages is the scroll trigger; the body only touches the ref
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  // Close model panel on outside click.
  useEffect(() => {
    if (!modelPanelOpen) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!panelRef.current?.contains(target)) setModelPanelOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [modelPanelOpen])

  const autoGrow = () => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`
  }

  const submit = () => {
    const text = draft.trim()
    if (!text || streaming) return
    setDraft('')
    if (taRef.current) taRef.current.style.height = ''
    void send(text)
  }

  const onDraftKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = displayWidth
    const maxAtStart = maxWidth
    let frame = 0
    let next = startWidth
    const onMove = (ev: MouseEvent) => {
      next = Math.min(maxAtStart, Math.max(MIN_WIDTH, startWidth + (startX - ev.clientX)))
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        usePrefsStore.getState().setSidebarWidth(next)
      })
    }
    const onUp = () => {
      if (frame) cancelAnimationFrame(frame)
      setResizing(false)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const [resizing, setResizing] = useState(false)
  const modelShort = model.includes('/') ? model.split('/').pop() || model : model

  const applySuggestion = (text: string) => setDraft(text)

  if (!open) return null

  const visible = messages.filter((m) => m.role !== 'system')

  return (
    <aside
      ref={asideRef}
      className={`sidebar${resizing ? ' resizing' : ''}`}
      style={{ width: displayWidth }}
      aria-label="AI assistant"
    >
      {/* biome-ignore lint/a11y/useSemanticElements: <hr> cannot host a child grip element or reliably receive pointer capture for a custom resize handle */}
      <div
        className="sidebar-resize-handle"
        onMouseDown={(e) => {
          setResizing(true)
          onResizeStart(e)
        }}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize AI panel"
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={maxWidth}
        aria-valuenow={displayWidth}
      >
        <div className="sidebar-resize-grip" />
      </div>

      <header className="sb2-header">
        <h1>AI Assistant</h1>
        <div className="sb2-header-right">
          {visible.length > 0 && (
            <button
              type="button"
              className="sb2-clear"
              onClick={clearHistory}
              title="Clear chat history"
              aria-label="Clear chat history"
            >
              <Trash2 size={15} aria-hidden />
            </button>
          )}
          <button
            type="button"
            className="sb2-gear"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={showSettings}
            aria-label="Toggle connection settings"
            title="Connection settings"
          >
            <Settings size={16} aria-hidden />
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="sb2-settings">
          <div className="sb2-settings-head">
            <Plug size={15} aria-hidden />
            <span>Connection</span>
          </div>
          <div className="sb2-field">
            <label htmlFor="ai-baseurl">Base URL</label>
            <input
              id="ai-baseurl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={DEFAULT_BASE_URL}
              spellCheck={false}
            />
          </div>
          <div className="sb2-field">
            <label htmlFor="ai-key">API key</label>
            <input
              id="ai-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-…"
              spellCheck={false}
            />
          </div>
          <button
            type="button"
            className="sb2-reconnect"
            onClick={() => void connect()}
            disabled={status === 'connecting'}
          >
            {status === 'connecting' ? 'Connecting…' : connected ? 'Reconnect' : 'Connect'}
          </button>
          {status === 'error' && error && (
            <div className="sb2-conn-status err" role="alert">
              {error}
            </div>
          )}
        </div>
      )}

      <div className="sb2-chat" ref={listRef} aria-live="polite">
        {visible.length === 0 ? (
          <div className="sb2-empty-card">
            <Sparkles size={34} className="sb2-empty-icon" aria-hidden />
            <h2 className="sb2-empty-title">Ask anything about your notes</h2>
            <p className="sb2-empty-desc">
              Use the input below to get insights, summaries, or help with your current notes.
            </p>
            <div className="sb2-suggestions">
              <button
                type="button"
                className="sb2-suggestion"
                onClick={() => applySuggestion('Summarize this note')}
              >
                <FileText size={14} aria-hidden />
                <span>Summarize this note</span>
              </button>
              <button
                type="button"
                className="sb2-suggestion"
                onClick={() => applySuggestion('Explain this in simple terms')}
              >
                <Sparkles size={14} aria-hidden />
                <span>Explain this in simple terms</span>
              </button>
              <button
                type="button"
                className="sb2-suggestion"
                onClick={() => applySuggestion('Find the key points')}
              >
                <Search size={14} aria-hidden />
                <span>Find key points</span>
              </button>
            </div>
          </div>
        ) : (
          visible.map((m, i) =>
            m.role === 'user' ? (
              <div key={m.id} className="msg-user">
                {m.content}
              </div>
            ) : (
              <div key={m.id} className="msg-ai">
                {m.content === '' && streaming && i === visible.length - 1 ? (
                  <span className="msg-thinking">Thinking…</span>
                ) : (
                  <div className="md">
                    <Markdown remarkPlugins={[remarkGfm]}>{m.content}</Markdown>
                  </div>
                )}
              </div>
            ),
          )
        )}
      </div>

      <div className="sb2-composer-wrap">
        <div className="sb2-composer">
          <textarea
            ref={taRef}
            className="sb2-textarea"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              autoGrow()
            }}
            onKeyDown={onDraftKeyDown}
            placeholder="Ask anything…"
            aria-label="Ask the AI"
          />
          <div className="sb2-toolbar">
            <button
              type="button"
              className="sb2-include-pill"
              role="switch"
              aria-checked={includeContext}
              onClick={() => setIncludeContext(!includeContext)}
              title="Include current note in context"
            >
              <span>Include current note</span>
            </button>

            <div className="sb2-spacer" />

            <button
              type="button"
              className={`sb2-model-pill${modelPanelOpen ? ' open' : ''}`}
              aria-haspopup="listbox"
              aria-expanded={modelPanelOpen}
              onClick={(e) => {
                e.stopPropagation()
                setModelPanelOpen((v) => !v)
              }}
            >
              <span className="sb2-model-name">{modelShort}</span>
              <ChevronDown size={13} className="sb2-chev" aria-hidden />
            </button>

            <button
              type="button"
              className="sb2-send"
              onClick={() => {
                if (streaming) stop()
                else submit()
              }}
              disabled={!streaming && !draft.trim()}
              title={streaming ? 'Stop' : 'Send'}
              aria-label={streaming ? 'Stop generating' : 'Send message'}
            >
              {streaming ? <Square size={16} aria-hidden /> : <ArrowUp size={16} aria-hidden />}
            </button>
          </div>
        </div>

        {modelPanelOpen && (
          <div className="sb2-model-panel" ref={panelRef} role="listbox" aria-label="Models">
            {!models.includes(model) && (
              <button
                type="button"
                className="sb2-mrow"
                role="option"
                aria-selected
                onClick={() => {}}
              >
                <span className="sb2-mname">{model}</span>
                <Check size={15} className="sb2-check" aria-hidden />
              </button>
            )}
            {models.map((m) => (
              <button
                key={m}
                type="button"
                className="sb2-mrow"
                role="option"
                aria-selected={m === model}
                onClick={() => {
                  setModel(m)
                  setModelPanelOpen(false)
                }}
              >
                <span className="sb2-mname">{m}</span>
                {m === model && <Check size={15} className="sb2-check" aria-hidden />}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
