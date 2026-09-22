import type { DocNode, NoteDoc } from './types'

/**
 * Node types that are leaves in the editor schema: they never have a content
 * array, so their node size is 1 (a single token). Everything else that can
 * hold children has an open token and a close token around its content.
 */
const LEAF_TYPES = new Set(['text', 'hardBreak', 'horizontalRule', 'image', 'imageBlock'])

/** ProseMirror node size — the number of positions a node spans in the document. */
export function nodeSize(node: DocNode): number {
  if (node.type === 'text') {
    return (node.text ?? '').length
  }
  if (!node.content || node.content.length === 0) {
    return LEAF_TYPES.has(node.type) ? 1 : 2
  }
  return 2 + node.content.reduce((sum, child) => sum + nodeSize(child), 0)
}

/**
 * Calls `fn(text, pos)` for every text node in the document. `pos` is the
 * ProseMirror position of the text's first character, so results can be used
 * with editor selection commands.
 */
export function eachTextNode(doc: NoteDoc, fn: (text: string, pos: number) => void): void {
  const walk = (nodes: DocNode[], base: number) => {
    let pos = base
    for (const node of nodes) {
      if (node.type === 'text') {
        fn(node.text ?? '', pos)
      } else if (node.content) {
        walk(node.content, pos + 1)
      }
      pos += nodeSize(node)
    }
  }
  walk(doc.content ?? [], 0)
}

function collectText(node: DocNode, fn: (text: string) => void): void {
  if (node.type === 'text') {
    fn(node.text ?? '')
    return
  }
  for (const child of node.content ?? []) {
    collectText(child, fn)
  }
}

/** Flattens a document to plain text — one line per top-level block. */
export function docToText(doc: NoteDoc): string {
  const lines: string[] = []
  for (const block of doc.content ?? []) {
    let line = ''
    collectText(block, (text) => {
      line += text
    })
    lines.push(line)
  }
  return lines.join('\n')
}

/** Coerces unknown JSON into a valid NoteDoc (empty doc as a safe fallback). */
export function asNoteDoc(value: unknown): NoteDoc {
  if (typeof value === 'object' && value !== null) {
    const v = value as { type?: unknown; content?: unknown }
    if (v.type === 'doc' && Array.isArray(v.content)) {
      return { type: 'doc', content: v.content as DocNode[] }
    }
  }
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}
