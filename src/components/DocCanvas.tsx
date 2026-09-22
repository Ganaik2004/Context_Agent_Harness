import { EditorContent } from '@tiptap/react'
import { GripVertical, Image as ImageIcon, Plus, Trash2, Type } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useEditorCtx } from '../editor/EditorProvider'
import {
  blockRangeForElement,
  insertImageFiles,
  insertParagraphAt,
  logUploadError,
  posAfterBlock,
} from '../editor/insert'

interface GutterState {
  top: number
  /** ProseMirror position just after the hovered block. */
  pos: number
  /** The hovered block's DOM element, kept so the delete action can re-resolve
   *  its live range even if other blocks shifted its numeric position. */
  el: HTMLElement
}

interface MenuState {
  left: number
  top: number
  pos: number
}

/**
 * The scrollable writing canvas. TipTap renders the note's blocks flat inside
 * .doc; a single floating gutter (＋ / grip) follows the hovered block — the
 * reference prototype's per-block gutter, adapted to a streamed editor DOM.
 */
export function DocCanvas() {
  const editor = useEditorCtx()
  const wrapRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingPos = useRef<number | null>(null)
  // Vertical band + left edge of the gutter's block, so the gutter survives
  // the pointer crossing the gap between block and buttons.
  const bandRef = useRef<{ top: number; bottom: number; left: number } | null>(null)
  const [gutter, setGutter] = useState<GutterState | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)

  // Close the insert menu on Escape / outside click.
  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null)
    }
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('.menu') && !t.closest('.gbtn')) setMenu(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onClick)
    }
  }, [menu])

  const onMouseMove = (e: React.MouseEvent) => {
    const wrap = wrapRef.current
    if (!editor || !wrap || menu) return
    const target = e.target as HTMLElement
    if (target.closest('.gutter')) return

    // Walk up to the top-level block (direct child of the editor root).
    const dom = editor.view.dom
    let block: HTMLElement | null = target
    while (block && block.parentElement !== dom) {
      if (block === wrap) {
        block = null
        break
      }
      block = block.parentElement
    }

    if (block && block !== dom && dom.contains(block)) {
      const pos = posAfterBlock(editor, block)
      if (pos === null) {
        bandRef.current = null
        setGutter(null)
        return
      }
      const rect = block.getBoundingClientRect()
      const wrapRect = wrap.getBoundingClientRect()
      bandRef.current = { top: rect.top, bottom: rect.bottom, left: rect.left }
      const top = rect.top - wrapRect.top + 6
      setGutter((prev) =>
        prev && prev.top === top && prev.pos === pos && prev.el === block
          ? prev
          : { top, pos, el: block },
      )
      return
    }

    // Pointer is in dead space — keep the gutter while crossing toward it.
    const band = bandRef.current
    if (
      band &&
      e.clientY >= band.top - 4 &&
      e.clientY <= band.bottom + 4 &&
      e.clientX < band.left + 6
    ) {
      return
    }
    bandRef.current = null
    setGutter(null)
  }

  const onMouseLeave = () => {
    if (menu) return
    bandRef.current = null
    setGutter(null)
  }

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (!gutter) return
    const rect = e.currentTarget.getBoundingClientRect()
    setMenu({ left: rect.left, top: rect.bottom + 6, pos: gutter.pos })
  }

  const insertText = () => {
    if (editor && menu) insertParagraphAt(editor, menu.pos)
    setMenu(null)
    setGutter(null)
  }

  const pickImage = () => {
    pendingPos.current = menu?.pos ?? null
    setMenu(null)
    fileRef.current?.click()
  }

  const deleteBlock = () => {
    if (!editor || !gutter) return
    const { el } = gutter
    const range = blockRangeForElement(editor, el)
    setMenu(null)
    setGutter(null)
    // Guard: never delete the block if it is the only one, or if the element
    // is no longer a valid block (already removed / re-rendered away).
    if (!range) return
    if (editor.state.doc.childCount <= 1) return
    editor.view.dispatch(editor.state.tr.delete(range.from, range.to))
  }

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (!editor || files.length === 0) return
    insertImageFiles(editor.view, files, pendingPos.current ?? undefined).catch(logUploadError)
    pendingPos.current = null
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-tracking region for the block gutter, not an interactive control
    <div className="canvas" onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
      <div className="doc" ref={wrapRef}>
        {editor && <EditorContent editor={editor} />}
        {gutter && (
          <div className="gutter" style={{ top: gutter.top }}>
            <button
              type="button"
              className="gbtn"
              title="Insert block"
              aria-label="Insert block below"
              onClick={openMenu}
            >
              <Plus size={14} aria-hidden />
            </button>
            <button
              type="button"
              className="gbtn grip"
              title="Drag (look only)"
              aria-label="Drag handle"
            >
              <GripVertical size={12} aria-hidden />
            </button>
          </div>
        )}
      </div>
      {menu && (
        <div className="menu" style={{ left: menu.left, top: menu.top }} role="menu">
          <button type="button" role="menuitem" onClick={insertText}>
            <Type size={14} aria-hidden /> Text block
          </button>
          <button type="button" role="menuitem" onClick={pickImage}>
            <ImageIcon size={14} aria-hidden /> Image from device
          </button>
          {editor && editor.state.doc.childCount > 1 && (
            <button type="button" role="menuitem" className="menu-danger" onClick={deleteBlock}>
              <Trash2 size={14} aria-hidden /> Delete block
            </button>
          )}
        </div>
      )}
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
    </div>
  )
}
