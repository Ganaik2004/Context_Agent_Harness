import { Node as ProseNode, Schema } from '@tiptap/pm/model'
import { describe, expect, it } from 'vitest'
import { blockLevelPosition } from './insert'

/**
 * A minimal schema — doc / paragraph / text / hardBreak — built by hand. The
 * position math in blockLevelPosition only depends on the document tree (depth +
 * whether the resolved parent is a textblock), so this is enough to prove that
 * inline positions — including mid-multiline ones — get pushed out to after
 * their enclosing paragraph.
 */
const schema = new Schema({
  nodes: {
    doc: { content: 'block+', toDOM: () => ['div', 0] as unknown as readonly [string, number] },
    paragraph: {
      content: 'inline*',
      group: 'block',
      toDOM: () => ['p', 0] as unknown as readonly [string, number],
    },
    text: { group: 'inline' },
    hardBreak: {
      inline: true,
      group: 'inline',
      toDOM: () => ['br'] as unknown as readonly [string],
    },
  },
})

function parse(json: unknown): ProseNode {
  return ProseNode.fromJSON(schema, json)
}

describe('blockLevelPosition', () => {
  it('passes through a block-level position (between blocks) unchanged', () => {
    // doc > [paragraph "abc"] [paragraph "def"] — position 5 is between them.
    const doc = parse({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'abc' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'def' }] },
      ],
    })
    expect(blockLevelPosition(doc, 5)).toBe(5)
  })

  it('redirects an inline position (inside a paragraph) to after that block', () => {
    // doc > [paragraph "abc"] [paragraph "def"] — position 2 is inline.
    const doc = parse({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'abc' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'def' }] },
      ],
    })
    expect(blockLevelPosition(doc, 2)).toBe(5) // end of the first paragraph
  })

  it('handles a cursor at the start of a paragraph', () => {
    const doc = parse({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'abc' }] }],
    })
    // Position 1 is at the start of the only paragraph (depth 1).
    expect(blockLevelPosition(doc, 1)).toBe(5) // end of the paragraph
  })

  it('redirects a mid-multiline cursor to the end of its whole paragraph', () => {
    // A single paragraph with two lines: "ab\ncd". The cursor between the two
    // lines (position 4, after the hard break) must map to the paragraph's end
    // (position 7), so an image lands below the entire text block — not between
    // its lines.
    const doc = parse({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'ab' },
            { type: 'hardBreak' },
            { type: 'text', text: 'cd' },
          ],
        },
      ],
    })
    expect(blockLevelPosition(doc, 4)).toBe(7) // end of the multiline paragraph
  })
})
