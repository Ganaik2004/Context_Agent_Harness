import { create } from 'zustand'
import { docToText } from '../../shared/doctext'
import { newId } from '../../shared/id'
import { parseChatEvent, SSEParser } from '../../shared/sse'
import {
  type AIMessage,
  type AIPrefs,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  type PrefsFile,
} from '../../shared/types'
import { api } from '../lib/api'
import { useDocumentStore } from './document'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

const HISTORY_SENT = 20
let abortController: AbortController | null = null
let chatPersistTimer: ReturnType<typeof setTimeout> | undefined
let prefsPersistTimer: ReturnType<typeof setTimeout> | undefined

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

async function httpErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: unknown } | string }
    if (typeof body.error === 'string') return body.error
    if (body.error?.message) return String(body.error.message)
  } catch {
    // not json
  }
  if (res.status === 401 || res.status === 403) return 'Invalid API key'
  return `The request failed (${res.status} ${res.statusText})`
}

interface AIState {
  hydrated: boolean
  baseUrl: string
  apiKey: string
  model: string
  includeContext: boolean
  status: ConnectionStatus
  error: string | null
  models: string[]
  messages: AIMessage[]
  streaming: boolean

  hydrate: (prefs: PrefsFile) => Promise<void>
  setBaseUrl: (url: string) => void
  setApiKey: (key: string) => void
  setModel: (model: string) => void
  setIncludeContext: (value: boolean) => void
  connect: () => Promise<void>
  send: (text: string) => Promise<void>
  stop: () => void
  clearHistory: () => void
}

/**
 * AI connection + chat state. Talks to any OpenAI-compatible endpoint
 * (default OpenRouter) with native fetch + ReadableStream and hand-parsed SSE.
 */
export const useAIStore = create<AIState>((set, get) => ({
  hydrated: false,
  baseUrl: DEFAULT_BASE_URL,
  apiKey: '',
  model: DEFAULT_MODEL,
  includeContext: false,
  status: 'disconnected',
  error: null,
  models: [],
  messages: [],
  streaming: false,

  hydrate: async (prefs) => {
    const ai: AIPrefs | undefined = prefs.ai
    let messages: AIMessage[] = []
    try {
      messages = (await api.getChat()).messages
    } catch {
      // chat history is optional
    }
    set({
      hydrated: true,
      baseUrl: ai?.baseUrl?.trim() || DEFAULT_BASE_URL,
      apiKey: ai?.apiKey ?? '',
      model: ai?.model || DEFAULT_MODEL,
      includeContext: ai?.includeContext ?? false,
      messages,
    })
  },

  setBaseUrl: (url) => {
    set({ baseUrl: url, status: 'disconnected' })
    schedulePrefsPersist(get())
  },

  setApiKey: (key) => {
    set({ apiKey: key, status: 'disconnected' })
    schedulePrefsPersist(get())
  },

  setModel: (model) => {
    set({ model })
    schedulePrefsPersist(get())
  },

  setIncludeContext: (value) => {
    set({ includeContext: value })
    schedulePrefsPersist(get())
  },

  connect: async () => {
    const { baseUrl, apiKey } = get()
    set({ status: 'connecting', error: null })
    try {
      const res = await fetch(`${normalizeBaseUrl(baseUrl)}/models`, {
        headers: { authorization: `Bearer ${apiKey}` },
      })
      if (!res.ok) {
        set({
          status: 'error',
          error:
            res.status === 401 || res.status === 403
              ? 'Invalid API key'
              : `Connection failed (${res.status})`,
        })
        return
      }
      const data = (await res.json()) as { data?: { id?: unknown }[] }
      const models = Array.isArray(data.data)
        ? data.data
            .map((m) => (typeof m?.id === 'string' ? m.id : ''))
            .filter(Boolean)
            .slice(0, 300)
        : []
      set({ status: 'connected', models, error: null })
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Could not reach the endpoint',
      })
    }
  },

  send: async (text) => {
    const trimmed = text.trim()
    const state = get()
    if (!trimmed || state.streaming) return
    if (!state.apiKey) {
      set({ error: 'Add your API key below, then connect.' })
      return
    }

    const assistantId = newId()
    const userMessage: AIMessage = { id: newId(), role: 'user', content: trimmed }
    const history = state.messages
    set({
      messages: [...history, userMessage, { id: assistantId, role: 'assistant', content: '' }],
      streaming: true,
      error: null,
    })
    scheduleChatPersist(get())

    const payload = {
      model: state.model,
      stream: true,
      messages: [
        ...contextMessages(),
        ...history.slice(-HISTORY_SENT).map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: trimmed },
      ],
    }

    const controller = new AbortController()
    abortController = controller

    const append = (delta: string) => {
      set({
        messages: get().messages.map((m) =>
          m.id === assistantId ? { ...m, content: m.content + delta } : m,
        ),
      })
    }
    const dropIfEmpty = () => {
      set({
        messages: get().messages.filter((m) => !(m.id === assistantId && m.content === '')),
      })
    }

    try {
      const res = await fetch(`${normalizeBaseUrl(state.baseUrl)}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${state.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(await httpErrorMessage(res))
      if (!res.body) throw new Error('The connection returned no data')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      const parser = new SSEParser()

      const handleEvents = (events: { data: string }[]): boolean => {
        for (const event of events) {
          const delta = parseChatEvent(event.data)
          if (delta.error) throw new Error(delta.error)
          if (delta.done) return true
          if (delta.content) append(delta.content)
        }
        return false
      }

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (handleEvents(parser.push(decoder.decode(value, { stream: true })))) break
      }
      handleEvents(parser.final())
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        set({ error: err instanceof Error ? err.message : 'The request failed' })
        dropIfEmpty()
      }
    } finally {
      abortController = null
      set({ streaming: false })
      scheduleChatPersist(get())
    }
  },

  stop: () => {
    abortController?.abort()
  },

  clearHistory: () => {
    set({ messages: [], error: null })
    scheduleChatPersist(get())
  },
}))

/** Builds the "include current file" system message from the active note. */
function contextMessages(): { role: 'system'; content: string }[] {
  const docState = useDocumentStore.getState()
  const id = docState.activeNoteId
  if (!id) return []
  const meta = docState.notes.find((n) => n.id === id)
  const doc = docState.docs[id]
  if (!meta || !doc) return []
  const text = docToText(doc).trim()
  if (!text) return []
  return [
    {
      role: 'system',
      content: `The user is working in a note-taking app. Their current note is titled "${meta.title}" and contains:\n\n${text}`,
    },
  ]
}

function scheduleChatPersist(state: AIState): void {
  clearTimeout(chatPersistTimer)
  chatPersistTimer = setTimeout(() => {
    api.putChat(state.messages).catch(() => {})
  }, 600)
}

function schedulePrefsPersist(state: AIState): void {
  clearTimeout(prefsPersistTimer)
  prefsPersistTimer = setTimeout(() => {
    api
      .putPrefs({
        ai: {
          baseUrl: state.baseUrl,
          apiKey: state.apiKey,
          model: state.model,
          includeContext: state.includeContext,
        },
      })
      .catch(() => {})
  }, 400)
}
