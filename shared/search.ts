import { eachTextNode } from './doctext'
import type { NoteDoc } from './types'

export interface TextRange {
  from: number
  to: number
}

/**
 * Finds the first case-insensitive occurrence of `query` in the document and
 * returns its ProseMirror positions, ready for `setTextSelection`.
 */
export function findTextRange(doc: NoteDoc, query: string): TextRange | null {
  if (!query) return null
  const needle = query.toLowerCase()

  // Flatten the document into a char array plus the doc position of each char,
  // so matches that span multiple text nodes still map back to real positions.
  let chars = ''
  const positions: number[] = []
  eachTextNode(doc, (text, pos) => {
    for (let i = 0; i < text.length; i++) {
      chars += text[i]
      positions.push(pos + i)
    }
  })

  const index = chars.toLowerCase().indexOf(needle)
  if (index < 0) return null
  return {
    from: positions[index],
    to: positions[index + needle.length - 1] + 1,
  }
}

/** Builds a one-line snippet around the character at `index`. */
export function makeSnippet(text: string, index: number, radius = 36): string {
  if (text.length === 0) return ''
  const start = Math.max(0, Math.min(index, text.length - 1) - radius)
  const end = Math.min(text.length, Math.max(index, 1) + radius)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  const middle = text.slice(start, end).replace(/\s+/g, ' ').trim()
  return `${prefix}${middle}${suffix}`
}
