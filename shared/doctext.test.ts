import { describe, expect, it } from 'vitest'
import { asNoteDoc, docToText, eachTextNode, nodeSize } from './doctext'
import type { DocNode, NoteDoc } from './types'

const p = (text: string): DocNode => ({
  type: 'paragraph',
  content: text ? [{ type: 'text', text }] : [],
})

const doc = (...blocks: DocNode[]): NoteDoc => ({ type: 'doc', content: blocks })

describe('nodeSize', () => {
  it('sizes text nodes by length', () => {
    expect(nodeSize({ type: 'text', text: 'Hello' })).toBe(5)
    expect(nodeSize({ type: 'text', text: '' })).toBe(0)
  })

  it('wraps container nodes with open and close tokens', () => {
    expect(nodeSize(p('Hello'))).toBe(7)
    expect(nodeSize(p(''))).toBe(2)
  })

  it('counts nested containers', () => {
    const list: DocNode = {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [p('a')] },
        { type: 'listItem', content: [p('b')] },
      ],
    }
    // bulletList(2) + 2 x [listItem(2) + paragraph(3)]
    expect(nodeSize(list)).toBe(2 + 2 * (2 + 3))
  })

  it('sizes atom nodes as single tokens', () => {
    expect(nodeSize({ type: 'imageBlock', attrs: { src: 'x' } })).toBe(1)
    expect(nodeSize({ type: 'hardBreak' })).toBe(1)
    expect(nodeSize({ type: 'horizontalRule' })).toBe(1)
  })
})

describe('eachTextNode', () => {
  it('reports ProseMirror positions across blocks', () => {
    const texts: [string, number][] = []
    eachTextNode(doc(p('Hello'), p('world')), (text, pos) => {
      texts.push([text, pos])
    })
    // First paragraph content starts at 1; second paragraph at 7, content at 8.
    expect(texts).toEqual([
      ['Hello', 1],
      ['world', 8],
    ])
  })

  it('walks into lists and skips atoms', () => {
    const texts: [string, number][] = []
    const list: DocNode = {
      type: 'bulletList',
      content: [{ type: 'listItem', content: [p('one')] }],
    }
    eachTextNode(doc(list, { type: 'imageBlock' }, p('two')), (text, pos) => {
      texts.push([text, pos])
    })
    // bulletList at 0, listItem at 1, paragraph at 2, its text starts at 3.
    // List spans 2 + (2 + 5) = 9, imageBlock atom at 9, next paragraph at 10,
    // its text at 11.
    expect(texts).toEqual([
      ['one', 3],
      ['two', 11],
    ])
  })
})

describe('docToText', () => {
  it('joins top-level blocks with newlines', () => {
    expect(docToText(doc(p('Hello'), p('world')))).toBe('Hello\nworld')
  })

  it('concatenates text across marks and inline nodes', () => {
    const inline: DocNode = {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'a', marks: [{ type: 'bold' }] },
        { type: 'hardBreak' },
        { type: 'text', text: 'b' },
      ],
    }
    expect(docToText(doc(inline))).toBe('ab')
  })

  it('returns empty lines for empty blocks and atoms', () => {
    expect(docToText(doc(p(''), { type: 'imageBlock' }, p('x')))).toBe('\n\nx')
  })
})

describe('asNoteDoc', () => {
  it('accepts valid docs', () => {
    const valid = doc(p('hi'))
    expect(asNoteDoc(valid)).toEqual(valid)
  })

  it('replaces invalid input with an empty doc', () => {
    const empty = { type: 'doc', content: [{ type: 'paragraph' }] }
    expect(asNoteDoc(null)).toEqual(empty)
    expect(asNoteDoc({ type: 'doc' })).toEqual(empty)
    expect(asNoteDoc('nope')).toEqual(empty)
  })
})
