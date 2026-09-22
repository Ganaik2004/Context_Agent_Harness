/**
 * Data types shared between the frontend, the server, and the tests.
 * These mirror the TipTap/ProseMirror document JSON without depending on TipTap,
 * so the server can read and search notes without any editor dependency.
 */

/** A single node in a ProseMirror document JSON tree. */
export interface DocNode {
  type: string
  attrs?: Record<string, unknown>
  content?: DocNode[]
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  text?: string
}

/** A full note document — exactly what `editor.getJSON()` produces. */
export interface NoteDoc {
  type: 'doc'
  content: DocNode[]
}

export interface NoteMeta {
  id: string
  title: string
  folderId?: string
  color?: string
  createdAt: number
  updatedAt: number
}

export interface FolderMeta {
  id: string
  name: string
  color: string
  createdAt: number
  updatedAt: number
}

export interface NoteRecord extends NoteMeta {
  doc: NoteDoc
}

export interface AIPrefs {
  baseUrl: string
  apiKey: string
  model: string
  includeContext: boolean
}

/** Shape of ~/.ai_note/prefs.json — everything the app remembers between runs. */
export interface PrefsFile {
  sidebarOpen?: boolean
  sidebarWidth?: number
  fontSize?: number
  showHint?: boolean
  ai?: AIPrefs
  openTabs?: string[]
  activeNoteId?: string | null
}

export interface AIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface SearchResult {
  noteId: string
  title: string
  snippet: string
}

export const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'
export const DEFAULT_MODEL = 'openai/gpt-4.1-mini'
