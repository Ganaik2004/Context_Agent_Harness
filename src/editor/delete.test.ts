import type { Editor } from '@tiptap/core'
import { Node as ProseNode, Schema } from '@tiptap/pm/model'
import { EditorState } from '@tiptap/pm/state'
import { describe, expect, it } from 'vitest'
import { blockRangeForElement, posBeforeBlock } from './insert'

/**
 * A minimal schema — doc / paragraph / text / imageBlock — matching the real
 * editor's top-level block types. Built by hand so the delete-block tests can
 * exercise the position resolution without a DOM.
 */
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block' },
    text: { group: 'inline' },
    imageBlock: { inline: false, group: 'block', atom: true, selectable: true },
  },
})

function parse(json: unknown): ProseNode {
  return ProseNode.fromJSON(schema, json)
}

/**
 * A fake DOM node: just enough of the browser API for posBeforeBlock /
 * blockRangeForElement (parentElement, contains, children, indexOf).
 */
function fakeEl(parent: FakeDom | null, siblings: FakeDom[]): FakeDom {
  const el: FakeDom = {
    parentElement: parent,
    contains: (c: FakeDom) => {
      // Real DOM.contains: true if c is this node or a descendant.
      let node: FakeDom | null = c
      while (node) {
        if (node === el) return true
        node = node.parentElement
      }
      return false
    },
    children: siblings,
    indexOf: (c: FakeDom) => siblings.indexOf(c),
  }
  return el
}

type FakeDom = {
  parentElement: FakeDom | null
  contains: (c: FakeDom) => boolean
  children: FakeDom[]
  indexOf: (c: FakeDom) => number
}

/** Builds a mock editor whose view.dom wraps the given sibling elements. */
function mockEditor(state: EditorState, childEls: FakeDom[]): Editor {
  const dom = fakeEl(null, childEls)
  // Each child element's parent must be the dom.
  for (const child of childEls) child.parentElement = dom
  return { view: { dom }, state } as unknown as Editor
}

/** Cast a fake DOM node to HTMLElement for the position helpers. */
function asHtml(el: FakeDom): HTMLElement {
  return el as unknown as HTMLElement
}

/** Wraps a document in a minimal EditorState for the position helpers. */
function stateOf(doc: ProseNode): EditorState {
  return EditorState.create({ schema, doc })
}

describe('posBeforeBlock', () => {
  it('returns the start position of the block that matches the element', () => {
    // doc > [paragraph "abc" (size 5)] [imageBlock (size 1)]
    // paragraph spans [0,5), imageBlock spans [5,6).
    const doc = parse({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'abc' }] },
        { type: 'imageBlock' },
      ],
    })
    const imageEl = fakeEl(null, [])
    const paraEl = fakeEl(null, [])
    const editor = mockEditor(stateOf(doc), [paraEl, imageEl])

    expect(posBeforeBlock(editor, asHtml(paraEl))).toBe(0)
    expect(posBeforeBlock(editor, asHtml(imageEl))).toBe(5)
  })

  it('returns null when the element is not a direct child of the editor', () => {
    const doc = parse({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'abc' }] }],
    })
    const paraEl = fakeEl(null, [])
    const editor = mockEditor(stateOf(doc), [paraEl])
    const detached = fakeEl(null, [])
    expect(posBeforeBlock(editor, asHtml(detached))).toBeNull()
  })
})

describe('blockRangeForElement', () => {
  it('resolves the full range of the block to delete', () => {
    // doc > [paragraph "abc" (size 5)] [imageBlock (size 1)] [paragraph "x" (size 3)]
    // paragraph spans [0,5), imageBlock spans [5,6), last paragraph spans [6,9)
    const doc = parse({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'abc' }] },
        { type: 'imageBlock' },
        { type: 'paragraph', content: [{ type: 'text', text: 'x' }] },
      ],
    })
    const paraEl = fakeEl(null, [])
    const imageEl = fakeEl(null, [])
    const editor = mockEditor(stateOf(doc), [paraEl, imageEl, fakeEl(null, [])])

    expect(blockRangeForElement(editor, asHtml(imageEl))).toEqual({ from: 5, to: 6 })
    expect(blockRangeForElement(editor, asHtml(paraEl))).toEqual({ from: 0, to: 5 })
  })

  it('returns null when the element is gone from the editor', () => {
    const doc = parse({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'abc' }] }],
    })
    const editor = mockEditor(stateOf(doc), [fakeEl(null, [])])
    const detached = fakeEl(null, [])
    expect(blockRangeForElement(editor, asHtml(detached))).toBeNull()
  })
})

/**
 * End-to-end check: the range returned by blockRangeForElement, when applied as
 * a ProseMirror delete transaction, removes exactly the targeted block and
 * leaves the others intact. This is the real proof the math is right.
 */
describe('block deletion via transaction', () => {
  const baseDoc = parse({
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'keep' }] },
      { type: 'imageBlock' },
      { type: 'paragraph', content: [{ type: 'text', text: 'me' }] },
    ],
  })
  const keepEl = fakeEl(null, [])
  const imageEl = fakeEl(null, [])
  const meEl = fakeEl(null, [])

  it('deleting the middle image removes only that block', () => {
    const editor = mockEditor(stateOf(baseDoc), [keepEl, imageEl, meEl])
    const range = blockRangeForElement(editor, asHtml(imageEl))
    expect(range).toEqual({ from: 6, to: 7 })
    if (!range) throw new Error('expected range')
    const tr = editor.state.tr.delete(range.from, range.to)
    const next = editor.state.apply(tr)

    expect(next.doc.childCount).toBe(2)
    expect(next.doc.child(0).type.name).toBe('paragraph')
    expect(next.doc.child(0).textContent).toBe('keep')
    expect(next.doc.child(1).type.name).toBe('paragraph')
    expect(next.doc.child(1).textContent).toBe('me')
  })

  it('deleting the first text block removes only that block', () => {
    const editor = mockEditor(stateOf(baseDoc), [keepEl, imageEl, meEl])
    const range = blockRangeForElement(editor, asHtml(keepEl))
    expect(range).toEqual({ from: 0, to: 6 })
    if (!range) throw new Error('expected range')
    const tr = editor.state.tr.delete(range.from, range.to)
    const next = editor.state.apply(tr)

    expect(next.doc.childCount).toBe(2)
    expect(next.doc.child(0).type.name).toBe('imageBlock')
    expect(next.doc.child(1).type.name).toBe('paragraph')
    expect(next.doc.child(1).textContent).toBe('me')
  })

  it('deleting the last text block removes only that block', () => {
    const editor = mockEditor(stateOf(baseDoc), [keepEl, imageEl, meEl])
    const range = blockRangeForElement(editor, asHtml(meEl))
    expect(range).toEqual({ from: 7, to: 11 })
    if (!range) throw new Error('expected range')
    const tr = editor.state.tr.delete(range.from, range.to)
    const next = editor.state.apply(tr)

    expect(next.doc.childCount).toBe(2)
    expect(next.doc.child(0).type.name).toBe('paragraph')
    expect(next.doc.child(0).textContent).toBe('keep')
    expect(next.doc.child(1).type.name).toBe('imageBlock')
  })
})
