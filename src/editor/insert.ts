import type { Editor } from '@tiptap/core'
import type { Node as ProseNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import { uploadImage } from '../lib/api'

/** Default insert width, like the reference: min(560, 70% of the document). */
export function defaultImageWidth(container: Element | null, natural: number): number {
  const docWidth = container?.closest('.doc')?.clientWidth ?? 760
  return Math.max(60, Math.min(natural, 560, Math.round(docWidth * 0.7)))
}

/** Pulls image files out of a clipboard or drop event. */
export function imageFilesFrom(data: DataTransfer | null): File[] {
  if (!data) return []
  const files: File[] = []
  for (const item of data.items ?? []) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }
  if (files.length > 0) return files
  // Some platforms (e.g. Linux) only expose files, not items.
  return [...(data.files ?? [])].filter((f) => f.type.startsWith('image/'))
}

/**
 * Maps an arbitrary document position to a safe BLOCK-level position.
 *
 * If `pos` sits inside a text block (a paragraph), the image would otherwise be
 * inserted inline, embedding it in the text. In that case we redirect to just
 * after the paragraph so the image lands as an independent sibling block. This
 * keeps text blocks text-only and image blocks independent, no matter where the
 * cursor or drop point is.
 */
export function blockLevelPosition(doc: ProseNode, pos: number): number {
  const $pos = doc.resolve(pos)
  if ($pos.depth >= 1 && $pos.parent.isTextblock) {
    return $pos.after($pos.depth)
  }
  return pos
}

/**
 * Uploads files and inserts image blocks. All insertions go through
 * {@link blockLevelPosition}, so an image pasted or dropped while editing text
 * is placed after the current text block instead of inside it.
 */
export async function insertImageFiles(
  view: EditorView,
  files: File[],
  preferredPos?: number,
): Promise<void> {
  const basePos = Math.max(
    0,
    Math.min(preferredPos ?? view.state.selection.from, view.state.doc.content.size),
  )
  const startAt = blockLevelPosition(view.state.doc, basePos)

  let insertAt = startAt
  for (const file of files) {
    const up = await uploadImage(file)
    // The user may have switched notes while the upload was in progress, which
    // unmounts this editor. Dispatching into a torn-down view would throw or,
    // worse, mutate a stale document — so stop inserting.
    if (!view.dom.isConnected) return
    const node = view.state.schema.nodes.imageBlock?.create({
      src: up.url,
      width: defaultImageWidth(view.dom, up.width),
      left: 0,
      natW: up.width,
      natH: up.height,
    })
    if (!node) continue
    const at = Math.max(0, Math.min(insertAt, view.state.doc.content.size))
    view.dispatch(view.state.tr.insert(at, node))
    insertAt = at + node.nodeSize
  }
}

/**
 * Position just before the block that corresponds to `el`, computed by mapping
 * the editor root's DOM children to doc children (they correspond 1:1).
 */
export function posBeforeBlock(editor: Editor, el: HTMLElement): number | null {
  const dom = editor.view.dom
  if (!dom.contains(el)) return null
  let top: HTMLElement = el
  while (top.parentElement && top.parentElement !== dom) {
    top = top.parentElement
  }
  if (top.parentElement !== dom) return null
  const idx = Array.from(dom.children).indexOf(top)
  const doc = editor.state.doc
  if (idx < 0 || idx >= doc.childCount) return null
  let pos = 0
  for (let i = 0; i < idx; i++) pos += doc.child(i).nodeSize
  return pos
}

/**
 * Resolves the live `{ from, to }` range of the block that corresponds to the
 * given DOM element. Because it re-resolves from the editor's current document
 * at call time, it stays correct even if other blocks were added or removed
 * above it (which would otherwise shift a cached numeric position and target the
 * wrong block). Returns null if the element is no longer a direct child of the
 * editor root.
 */
export function blockRangeForElement(
  editor: Editor,
  el: HTMLElement,
): { from: number; to: number } | null {
  const from = posBeforeBlock(editor, el)
  if (from === null) return null
  const node = editor.state.doc.nodeAt(from)
  if (!node) return null
  return { from, to: from + node.nodeSize }
}

/**
 * Position just after the top-level block containing `el`, computed by mapping
 * the editor root's DOM children to doc children (they correspond 1:1).
 */
export function posAfterBlock(editor: Editor, el: HTMLElement): number | null {
  const dom = editor.view.dom
  if (!dom.contains(el)) return null
  let top: HTMLElement = el
  while (top.parentElement && top.parentElement !== dom) {
    top = top.parentElement
  }
  if (top.parentElement !== dom) return null
  const idx = Array.from(dom.children).indexOf(top)
  const nodes = editor.state.doc.content
  if (idx < 0 || idx >= nodes.childCount) return null
  let pos = 0
  for (let i = 0; i <= idx; i++) pos += nodes.child(i).nodeSize
  return pos
}

/** Position after the top-level block that holds the selection. */
export function posAfterSelectionBlock(editor: Editor): number {
  const { $from, to } = editor.state.selection
  return $from.depth === 0 ? to : $from.after(1)
}

/** Inserts an empty paragraph at `pos` and puts the caret inside it. */
export function insertParagraphAt(editor: Editor, pos: number): void {
  const at = Math.max(0, Math.min(pos, editor.state.doc.content.size))
  editor
    .chain()
    .focus()
    .insertContentAt(at, { type: 'paragraph' })
    .setTextSelection(at + 1)
    .run()
}

export function logUploadError(err: unknown): void {
  console.error('Image upload failed:', err)
}
