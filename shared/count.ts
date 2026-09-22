import { docToText } from './doctext'
import type { NoteDoc } from './types'

export interface DocStats {
  words: number
  chars: number
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/** Word and character counts for a note, as shown in the status bar. */
export function docStats(doc: NoteDoc): DocStats {
  const text = docToText(doc).trim()
  return { words: countWords(text), chars: text.length }
}
