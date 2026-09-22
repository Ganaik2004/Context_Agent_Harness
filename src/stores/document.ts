import { create } from 'zustand'
import type { FolderMeta, NoteDoc, NoteMeta } from '../../shared/types'
import { api } from '../lib/api'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
export type View = 'home' | 'folder' | 'note'

const SAVE_DEBOUNCE_MS = 600

/** note id → pending save timer (one per note, so tab switches can't cancel saves) */
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()
let tabsPersistTimer: ReturnType<typeof setTimeout> | undefined

interface DocumentState {
  notes: NoteMeta[]
  openTabs: string[]
  activeNoteId: string | null
  docs: Record<string, NoteDoc>
  saveStatus: SaveStatus
  savedAt: number | null
  folders: FolderMeta[]
  view: View
  activeFolderId: string | null

  bootstrap: (savedTabs?: string[], savedActive?: string | null) => Promise<void>
  openNote: (id: string) => Promise<void>
  createNote: (title?: string, color?: string) => Promise<void>
  closeTab: (id: string) => Promise<void>
  renameNote: (id: string, title: string) => void
  updateNote: (id: string, patch: { title?: string; color?: string }) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  updateDoc: (id: string, doc: NoteDoc) => void
  flushNote: (id: string) => Promise<void>
  flushAll: () => void
  setView: (view: View, folderId?: string | null) => void
  openFolder: (id: string) => void
  goHome: () => void
  createFolder: (name: string, color: string) => Promise<void>
  updateFolder: (id: string, patch: { name?: string; color?: string }) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  notesInFolder: (folderId: string) => NoteMeta[]
}

/**
 * Note/tabs state. The editor reports every change here; this store debounces
 * disk writes (600 ms) and drives the "Saving… → Saved HH:MM:SS" indicator.
 */
export const useDocumentStore = create<DocumentState>((set, get) => ({
  notes: [],
  openTabs: [],
  activeNoteId: null,
  docs: {},
  saveStatus: 'idle',
  savedAt: null,
  folders: [],
  view: 'home',
  activeFolderId: null,

  bootstrap: async (_savedTabs, _savedActive) => {
    let notes: NoteMeta[]
    try {
      notes = (await api.listNotes()).notes
    } catch {
      notes = []
    }

    let folders: FolderMeta[]
    try {
      folders = (await api.listFolders()).folders
    } catch {
      folders = []
    }

    // First-run safety: if there are notes but no folders (pre-folder data),
    // create a default folder and assign all unfiled notes to it.
    if (notes.length > 0 && folders.length === 0) {
      try {
        const folder = await api.createFolder('Notes', '#8b7cf6')
        folders = [folder]
        notes = notes.map((n) => ({ ...n, folderId: n.folderId ?? folder.id }))
        for (const n of notes) {
          if (n.folderId) {
            const full = await api.getNote(n.id).catch(() => null)
            if (full) await api.saveNote(n.id, full.title, full.doc, folder.id).catch(() => {})
          }
        }
      } catch {
        // keep going — notes still load
      }
    }

    if (notes.length === 0) {
      const note = await api.createNote('Note 1')
      notes = [
        { id: note.id, title: note.title, createdAt: note.createdAt, updatedAt: note.updatedAt },
      ]
      set({ docs: { [note.id]: note.doc } })
    }

    // Startup is always the Home screen — do not auto-open the last note.
    set({ notes, folders, view: 'home', activeFolderId: null })
  },

  openNote: async (id) => {
    const { docs, openTabs } = get()
    if (!docs[id]) {
      try {
        const note = await api.getNote(id)
        set({ docs: { ...get().docs, [id]: note.doc } })
      } catch (err) {
        console.error('Failed to load note', id, err)
        return
      }
    }
    set({
      activeNoteId: id,
      openTabs: openTabs.includes(id) ? openTabs : [...openTabs, id],
      saveStatus: 'saved',
      savedAt: Date.now(),
      view: 'note',
    })
    persistTabs(get())
  },

  createNote: async (title?: string, color?: string) => {
    const { notes, docs, view, activeFolderId, folders } = get()
    const folderId = view === 'folder' ? activeFolderId : (folders[0]?.id ?? null)
    const record = await api.createNote(title, folderId ?? undefined, color)
    const meta: NoteMeta = {
      id: record.id,
      title: record.title,
      folderId: record.folderId ?? folderId ?? undefined,
      color: record.color ?? color ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
    set({
      notes: [...notes, meta],
      docs: { ...docs, [record.id]: record.doc },
      saveStatus: 'idle',
    })
    // Stays on the current page (folder view) — does not open the editor or change tabs.
  },

  closeTab: async (id) => {
    const { openTabs, activeNoteId, notes } = get()
    void get().flushNote(id)
    const idx = openTabs.indexOf(id)
    const tabs = openTabs.filter((t) => t !== id)
    const closedNote = notes.find((n) => n.id === id)

    if (activeNoteId !== id) {
      set({ openTabs: tabs })
      persistTabs(get())
      return
    }
    if (tabs.length === 0) {
      // Closed the last tab — return to the note's folder (or Home) instead of creating a note.
      set({ openTabs: tabs, activeNoteId: null })
      const folderId = closedNote?.folderId ?? null
      if (folderId) {
        set({ view: 'folder', activeFolderId: folderId })
      } else {
        set({ view: 'home', activeFolderId: null })
      }
      return
    }
    const next = tabs[Math.max(0, idx - 1)]
    set({ openTabs: tabs })
    await get().openNote(next)
  },

  renameNote: (id, title) => {
    const trimmed = title.trim()
    if (!trimmed) return
    const { notes, docs } = get()
    const meta = notes.find((n) => n.id === id)
    if (!meta || meta.title === trimmed) return
    const now = Date.now()
    set({
      notes: notes.map((n) => (n.id === id ? { ...n, title: trimmed, updatedAt: now } : n)),
    })
    void api
      .saveNote(
        id,
        trimmed,
        docs[id] ?? { type: 'doc', content: [{ type: 'paragraph' }] },
        meta.folderId,
        meta.color,
      )
      .catch((err) => console.error('Rename failed', err))
  },

  updateNote: async (id, patch: { title?: string; color?: string }) => {
    const { notes, docs } = get()
    const meta = notes.find((n) => n.id === id)
    if (!meta) return
    const title = patch.title !== undefined ? patch.title.trim() || meta.title : meta.title
    const color = patch.color ?? meta.color
    if (meta.title === title && meta.color === color) return
    const now = Date.now()
    set({ notes: notes.map((n) => (n.id === id ? { ...n, title, color, updatedAt: now } : n)) })
    await api
      .saveNote(
        id,
        title,
        docs[id] ?? { type: 'doc', content: [{ type: 'paragraph' }] },
        meta.folderId,
        color,
      )
      .catch((err) => console.error('Update note failed', err))
  },

  deleteNote: async (id) => {
    const { notes, openTabs, activeNoteId } = get()
    const deletedNote = notes.find((n) => n.id === id)
    await api.deleteNote(id).catch(() => {})
    const remaining = notes.filter((n) => n.id !== id)
    const tabs = openTabs.filter((t) => t !== id)
    const wasActive = activeNoteId === id
    set({ notes: remaining, openTabs: tabs })
    if (wasActive) {
      set({ activeNoteId: null })
      const folderId = deletedNote?.folderId ?? null
      if (folderId) {
        set({ view: 'folder', activeFolderId: folderId })
      } else {
        set({ view: 'home', activeFolderId: null })
      }
    }
  },

  updateDoc: (id, doc) => {
    set({ docs: { ...get().docs, [id]: doc }, saveStatus: 'saving' })
    clearTimeout(saveTimers.get(id))
    saveTimers.set(
      id,
      setTimeout(() => {
        void get().flushNote(id)
      }, SAVE_DEBOUNCE_MS),
    )
  },

  flushNote: async (id) => {
    const timer = saveTimers.get(id)
    if (timer) {
      clearTimeout(timer)
      saveTimers.delete(id)
    }
    const { docs, notes } = get()
    const doc = docs[id]
    const meta = notes.find((n) => n.id === id)
    if (!doc || !meta) return
    try {
      const { note } = await api.saveNote(id, meta.title, doc)
      set({
        saveStatus: 'saved',
        savedAt: Date.now(),
        notes: get().notes.map((n) => (n.id === id ? { ...n, updatedAt: note.updatedAt } : n)),
      })
    } catch (err) {
      console.error('Save failed', err)
      set({ saveStatus: 'error' })
    }
  },

  flushAll: () => {
    for (const id of [...saveTimers.keys()]) {
      void get().flushNote(id)
    }
  },

  setView: (view, folderId) => {
    set({ view, activeFolderId: folderId ?? null })
  },

  openFolder: (id) => {
    set({ view: 'folder', activeFolderId: id, activeNoteId: null })
  },

  goHome: () => {
    set({ view: 'home', activeFolderId: null, activeNoteId: null })
  },

  createFolder: async (name, color) => {
    const folder = await api.createFolder(name, color)
    set({ folders: [...get().folders, folder] })
  },

  updateFolder: async (id, patch) => {
    const updated = await api.updateFolder(id, patch)
    set({ folders: get().folders.map((f) => (f.id === id ? updated : f)) })
  },

  deleteFolder: async (id) => {
    await api.deleteFolder(id)
    const { folders, notes, activeFolderId, view } = get()
    const remaining = folders.filter((f) => f.id !== id)
    const notesInDeleted = notes.filter((n) => n.folderId === id)
    const fallbackFolder = remaining[0]?.id ?? null
    const updatedNotes = notes.map((n) =>
      n.folderId === id ? { ...n, folderId: fallbackFolder ?? undefined } : n,
    )
    // Persist the reassignment for notes that moved to the fallback folder.
    for (const n of notesInDeleted) {
      if (fallbackFolder) {
        const full = await api.getNote(n.id).catch(() => null)
        if (full) await api.saveNote(n.id, full.title, full.doc, fallbackFolder).catch(() => {})
      }
    }
    const stillInFolder = activeFolderId === id && view === 'folder'
    set({
      folders: remaining,
      notes: updatedNotes,
      view: stillInFolder ? 'home' : view,
      activeFolderId: stillInFolder ? null : activeFolderId,
    })
  },

  notesInFolder: (folderId) => get().notes.filter((n) => n.folderId === folderId),
}))

/** Tab layout is part of prefs.json (written server-side via shallow merge). */
function persistTabs(state: DocumentState): void {
  clearTimeout(tabsPersistTimer)
  tabsPersistTimer = setTimeout(() => {
    api.putPrefs({ openTabs: state.openTabs, activeNoteId: state.activeNoteId }).catch(() => {})
  }, 300)
}
