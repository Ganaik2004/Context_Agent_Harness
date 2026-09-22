import { findTextRange } from '@shared/search'
import type { SearchResult } from '@shared/types'
import { Image as ImageIcon, Plus, Redo2, Search, Undo2 } from 'lucide-react'
import { useEffect, useReducer, useRef, useState } from 'react'
import { activeEditorRef, editorNoteMap, useEditorCtx } from '../editor/EditorProvider'
import {
  insertImageFiles,
  insertParagraphAt,
  logUploadError,
  posAfterSelectionBlock,
} from '../editor/insert'
import { api } from '../lib/api'
import { useDocumentStore } from '../stores/document'
import { usePrefsStore } from '../stores/prefs'

const FONT_MIN = 13
const FONT_MAX = 22

export function Toolbar() {
  const editor = useEditorCtx()
  const fileRef = useRef<HTMLInputElement>(null)
  const searchBtnRef = useRef<HTMLButtonElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Undo/redo availability lives inside the editor, so re-render on transactions.
  const [, bump] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    if (!editor) return
    editor.on('transaction', bump)
    return () => {
      editor.off('transaction', bump)
    }
  }, [editor])

  const fontSize = usePrefsStore((s) => s.fontSize)
  const changeFontSize = usePrefsStore((s) => s.changeFontSize)
  const openNote = useDocumentStore((s) => s.openNote)

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchPos, setSearchPos] = useState({ left: 0, top: 0 })
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])

  // Debounced full-text search across all notes on disk.
  useEffect(() => {
    if (!searchOpen) return
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    let stale = false
    const timer = setTimeout(() => {
      api
        .search(q)
        .then((r) => {
          if (!stale) setResults(r.results)
        })
        .catch(() => {
          if (!stale) setResults([])
        })
    }, 180)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [query, searchOpen])

  // Focus the input when the panel opens; close on Escape / outside click.
  useEffect(() => {
    if (!searchOpen) return
    searchInputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false)
    }
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('.searchmenu') && !t.closest('[data-searchbtn]')) setSearchOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onClick)
    }
  }, [searchOpen])

  const addTextBlock = () => {
    if (!editor) return
    insertParagraphAt(editor, posAfterSelectionBlock(editor))
  }

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (!editor || files.length === 0) return
    insertImageFiles(editor.view, files).catch(logUploadError)
  }

  const toggleSearch = () => {
    if (!searchOpen && searchBtnRef.current) {
      const r = searchBtnRef.current.getBoundingClientRect()
      setSearchPos({ left: r.left, top: r.bottom + 6 })
    }
    setQuery('')
    setResults([])
    setSearchOpen(!searchOpen)
  }

  /** Opens the note, waits for its editor to mount, then selects the match. */
  const jumpTo = async (result: SearchResult) => {
    const q = query.trim()
    setSearchOpen(false)
    await openNote(result.noteId)
    if (!q) return
    const doc = useDocumentStore.getState().docs[result.noteId]
    const range = doc ? findTextRange(doc, q) : null
    if (!range) return
    const attempt = (triesLeft: number) => {
      const ed = activeEditorRef.current
      if (ed && editorNoteMap.get(ed) === result.noteId) {
        ed.chain().focus().setTextSelection(range).scrollIntoView().run()
      } else if (triesLeft > 0) {
        setTimeout(() => attempt(triesLeft - 1), 50)
      }
    }
    attempt(30)
  }

  return (
    <div className="toolbar">
      <button type="button" className="tbtn primary" onClick={addTextBlock}>
        <Plus size={14} aria-hidden /> Text
      </button>
      <button type="button" className="tbtn primary" onClick={() => fileRef.current?.click()}>
        <ImageIcon size={14} aria-hidden /> Image
      </button>
      <div className="sep" />
      <button
        type="button"
        className="tbtn"
        title="Undo"
        aria-label="Undo"
        disabled={!editor?.can().undo()}
        onClick={() => editor?.chain().focus().undo().run()}
      >
        <Undo2 size={14} aria-hidden />
      </button>
      <button
        type="button"
        className="tbtn"
        title="Redo"
        aria-label="Redo"
        disabled={!editor?.can().redo()}
        onClick={() => editor?.chain().focus().redo().run()}
      >
        <Redo2 size={14} aria-hidden />
      </button>
      <div className="sep" />
      <button
        type="button"
        className="tbtn"
        data-searchbtn
        ref={searchBtnRef}
        onClick={toggleSearch}
        aria-expanded={searchOpen}
      >
        <Search size={14} aria-hidden /> Search
      </button>
      <div className="sep" />
      <button
        type="button"
        className="tbtn"
        onClick={() => changeFontSize(-1)}
        disabled={fontSize <= FONT_MIN}
        aria-label="Decrease font size"
      >
        A−
      </button>
      <span className="fsread">{fontSize}px</span>
      <button
        type="button"
        className="tbtn"
        onClick={() => changeFontSize(1)}
        disabled={fontSize >= FONT_MAX}
        aria-label="Increase font size"
      >
        A+
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        tabIndex={-1}
        aria-hidden
        onChange={onFiles}
      />
      {searchOpen && (
        <div
          className="menu searchmenu"
          style={{ left: searchPos.left, top: searchPos.top }}
          role="dialog"
          aria-label="Search notes"
        >
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            aria-label="Search notes"
            spellCheck={false}
          />
          {query.trim() === '' ? (
            <div className="searchempty">Type to search every note on disk.</div>
          ) : results.length === 0 ? (
            <div className="searchempty">No matches.</div>
          ) : (
            results.map((r) => (
              <button
                type="button"
                className="searchitem"
                key={r.noteId}
                onClick={() => void jumpTo(r)}
              >
                <b>{r.title}</b>
                {r.snippet && <span>{r.snippet}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
