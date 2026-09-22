import { create } from 'zustand'
import type { PrefsFile } from '../../shared/types'
import { api } from '../lib/api'

export const MIN_WIDTH = 200
const MIN_FONT = 13
const MAX_FONT = 22

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

function applyFontSize(px: number): void {
  document.documentElement.style.setProperty('--doc-fs', `${px}px`)
}

let persistTimer: ReturnType<typeof setTimeout> | undefined

interface PrefsState {
  hydrated: boolean
  sidebarOpen: boolean
  sidebarWidth: number
  fontSize: number
  showHint: boolean
  hydrate: (prefs: PrefsFile) => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  changeFontSize: (delta: number) => void
  dismissHint: () => void
}

/**
 * UI preferences (sidebar, font size, hint chip). Persisted to prefs.json on
 * the server — disk is the source of truth, this store is just the live view.
 */
export const usePrefsStore = create<PrefsState>((set, get) => ({
  hydrated: false,
  sidebarOpen: true,
  sidebarWidth: 330,
  fontSize: 16,
  showHint: true,

  hydrate: (prefs) => {
    const fontSize = clamp(prefs.fontSize ?? 16, MIN_FONT, MAX_FONT)
    applyFontSize(fontSize)
    set({
      hydrated: true,
      sidebarOpen: prefs.sidebarOpen ?? true,
      sidebarWidth: Math.max(MIN_WIDTH, prefs.sidebarWidth ?? 330),
      fontSize,
      showHint: prefs.showHint ?? true,
    })
  },

  toggleSidebar: () => {
    set({ sidebarOpen: !get().sidebarOpen })
    schedulePersist(get())
  },

  setSidebarWidth: (width) => {
    set({ sidebarWidth: Math.max(MIN_WIDTH, width) })
    schedulePersist(get())
  },

  changeFontSize: (delta) => {
    const fontSize = clamp(get().fontSize + delta, MIN_FONT, MAX_FONT)
    set({ fontSize })
    applyFontSize(fontSize)
    schedulePersist(get())
  },

  dismissHint: () => {
    set({ showHint: false })
    schedulePersist(get())
  },
}))

function schedulePersist(state: PrefsState): void {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    api
      .putPrefs({
        sidebarOpen: state.sidebarOpen,
        sidebarWidth: state.sidebarWidth,
        fontSize: state.fontSize,
        showHint: state.showHint,
      })
      .catch(() => {})
  }, 300)
}
