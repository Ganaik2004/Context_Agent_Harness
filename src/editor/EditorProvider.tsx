import { asNoteDoc } from '@shared/doctext'
import type { NoteDoc } from '@shared/types'
import type { Editor } from '@tiptap/core'
import { Placeholder } from '@tiptap/extensions'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { createContext, type ReactNode, useContext, useEffect, useRef } from 'react'
import { useDocumentStore } from '../stores/document'
import { ImageBlockNode } from './ImageBlockNode'
import { imageFilesFrom, insertImageFiles, logUploadError } from './insert'
import { MultilineEnter } from './MultilineEnter'

const EditorContext = createContext<Editor | null>(null)

export function useEditorCtx(): Editor | null {
  return useContext(EditorContext)
}

/** Live editor instance, also reachable from outside the tree (search jumps). */
export const activeEditorRef: { current: Editor | null } = { current: null }

/** Maps each editor instance to the note id it was created for. */
export const editorNoteMap = new WeakMap<Editor, string>()

interface EditorProviderProps {
  noteId: string
  initialDoc: NoteDoc
  children: ReactNode
}

/**
 * Owns the TipTap editor for the active note (one editor per note; recreated
 * when the note changes). Provides it via context to the toolbar and document
 * area, and handles image paste/drop.
 */
export function EditorProvider({ noteId, initialDoc, children }: EditorProviderProps) {
  const noteIdRef = useRef(noteId)
  noteIdRef.current = noteId

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        MultilineEnter,
        Placeholder.configure({
          placeholder: 'Type here…  (Shift+Enter = new block)',
          showOnlyCurrent: false,
          includeChildren: true,
        }),
        ImageBlockNode,
      ],
      content: initialDoc,
      editorProps: {
        attributes: { spellcheck: 'true' },
        handlePaste: (view, event) => {
          const files = imageFilesFrom(event.clipboardData)
          if (files.length === 0) return false
          event.preventDefault()
          event.stopPropagation()
          insertImageFiles(view, files).catch(logUploadError)
          return true
        },
        handleDrop: (view, event, _slice, moved) => {
          if (moved) return false
          const files = imageFilesFrom(event.dataTransfer)
          if (files.length === 0) return false
          event.preventDefault()
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
          insertImageFiles(view, files, pos).catch(logUploadError)
          return true
        },
      },
      onUpdate: ({ editor: current }) => {
        useDocumentStore.getState().updateDoc(noteIdRef.current, asNoteDoc(current.getJSON()))
      },
    },
    [noteId],
  )

  useEffect(() => {
    activeEditorRef.current = editor
    if (editor) editorNoteMap.set(editor, noteIdRef.current)
    return () => {
      if (activeEditorRef.current === editor) activeEditorRef.current = null
    }
  }, [editor])

  // Drop editor focus (and its caret) whenever the user clicks outside the
  // editor DOM, so arrow keys and caret rendering stay confined to the editor.
  // Clicks that land in other input areas (AI composer, search, modals) are
  // skipped: the browser moves focus there natively. Blurs the editor DOM
  // directly — commands.blur() defers via requestAnimationFrame and clears the
  // document selection, which can wipe a caret just placed in another input.
  useEffect(() => {
    if (!editor) return
    const onDown = (e: MouseEvent): void => {
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      if (!editor.view.dom.contains(e.target as Node)) editor.view.dom.blur()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [editor])

  // Paste an image from anywhere (e.g. right after switching tabs) — inserts
  // at the end of the document. Focused-editor pastes are handled above.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea')) return
      const editorNow = activeEditorRef.current
      if (!editorNow) return
      const files = imageFilesFrom(event.clipboardData)
      if (files.length === 0) return
      event.preventDefault()
      const end = editorNow.state.doc.content.size
      insertImageFiles(editorNow.view, files, end).catch(logUploadError)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  return <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>
}
