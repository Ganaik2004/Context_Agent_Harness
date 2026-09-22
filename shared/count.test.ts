import { describe, expect, it } from 'vitest'
import { countWords, docStats } from './count'
import type { DocNode, NoteDoc } from './types'

const p = (text: string): DocNode => ({
  type: 'paragraph',
  content: text ? [{ type: 'text', text }] : [],
})
const doc = (...blocks: DocNode[]): NoteDoc => ({ type: 'doc', content: blocks })

describe('countWords', () => {
  it('counts whitespace-separated words', () => {
    expect(countWords('one two  three')).toBe(3)
  })

  it('handles empty and blank text', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   ')).toBe(0)
  })
})

describe('docStats', () => {
  it('counts across blocks', () => {
    const stats = docStats(doc(p('hello world'), p('third block here')))
    expect(stats.words).toBe(5)
    // "hello world\nthird block here".length = 11 + 1 + 16
    expect(stats.chars).toBe(28)
  })

  it('counts atoms as no text', () => {
    const stats = docStats(doc(p('only words'), { type: 'imageBlock' }))
    expect(stats).toEqual({ words: 2, chars: 10 })
  })

  it('returns zeros for an empty doc', () => {
    expect(docStats(doc(p('')))).toEqual({ words: 0, chars: 0 })
  })
})
