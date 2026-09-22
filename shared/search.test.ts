import { describe, expect, it } from 'vitest'
import { findTextRange, makeSnippet } from './search'
import type { DocNode, NoteDoc } from './types'

const p = (text: string): DocNode => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
})
const doc = (...blocks: DocNode[]): NoteDoc => ({ type: 'doc', content: blocks })

describe('findTextRange', () => {
  it('finds text inside a block', () => {
    expect(findTextRange(doc(p('hello world')), 'world')).toEqual({ from: 7, to: 12 })
  })

  it('matches case-insensitively', () => {
    expect(findTextRange(doc(p('hello WORLD')), 'world')).toEqual({ from: 7, to: 12 })
  })

  it('matches across text nodes within a block', () => {
    const block: DocNode = {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'foo ' },
        { type: 'text', text: 'bar' },
      ],
    }
    // 'foo ' starts at pos 1; 'o ba' spans the gap into 'bar' (pos 5..8).
    expect(findTextRange(doc(block), 'o ba')).toEqual({ from: 3, to: 7 })
  })

  it('finds text in later blocks', () => {
    // First paragraph spans 7; second paragraph content starts at 8,
    // 'block' sits 7 chars into 'second block'.
    expect(findTextRange(doc(p('first'), p('second block')), 'block')).toEqual({
      from: 15,
      to: 20,
    })
  })

  it('returns null when nothing matches', () => {
    expect(findTextRange(doc(p('hello')), 'zzz')).toBeNull()
    expect(findTextRange(doc(p('hello')), '')).toBeNull()
  })
})

describe('makeSnippet', () => {
  it('keeps short text intact', () => {
    expect(makeSnippet('short text', 0)).toBe('short text')
  })

  it('adds ellipses around the match window', () => {
    const text = 'a'.repeat(100)
    const snippet = makeSnippet(text, 50)
    expect(snippet.startsWith('…')).toBe(true)
    expect(snippet.endsWith('…')).toBe(true)
    expect(snippet.length).toBeLessThanOrEqual(2 + 72 + 2)
  })

  it('collapses whitespace inside the window', () => {
    expect(makeSnippet('line one\nline two\nline three', 9, 8)).toBe('…ine one line two…')
  })
})
