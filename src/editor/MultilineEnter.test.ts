import type { Editor } from '@tiptap/core'
import { Node as ProseNode, Schema } from '@tiptap/pm/model'
import { EditorState, NodeSelection } from '@tiptap/pm/state'
import { describe, expect, it } from 'vitest'
import { MultilineEnter } from './MultilineEnter'

/**
 * TipTap keyboard shortcuts decide whether Enter splits a block, inserts a line
 * break, or (new) creates a text block after an image. These tests pin down the
 * Enter-vs-Backspace contract and the new image-selection behavior.
 *
 * Note: in TipTap v3 the extension methods live on `.config`, not on the
 * instance itself (instance keys are type/parent/child/name/config).
 */

// Minimal schema: doc / paragraph / text plus an imageBlock atom (selectable),
// mirroring the real editor just enough to build a state and a node selection.
const schema = new Schema({
  nodes: {
    doc: { content: 'block+', toDOM: () => ['div', 0] as unknown as readonly [string, number] },
    paragraph: {
      content: 'inline*',
      group: 'block',
      toDOM: () => ['p', 0] as unknown as readonly [string, number],
    },
    text: { group: 'inline' },
    imageBlock: {
      inline: false,
      group: 'block',
      atom: true,
      selectable: true,
      toDOM: () => ['img'] as unknown as readonly [string],
    },
  },
})

function imageNode(): ProseNode {
  return schema.nodes.imageBlock.create({ src: 'x', width: 100, left: 0, natW: 100, natH: 100 })
}

// A doc with [paragraph "abc"] followed by an image block.
function docWithImage(): ProseNode {
  return schema.node('doc', null, [
    schema.node('paragraph', null, [schema.text('abc')]),
    imageNode(),
  ])
}

type ChainCall = { name: string; args: unknown[] }

// Records every chain command so we can assert what Enter asked the editor to do.
function makeEditor(state: EditorState) {
  const calls: ChainCall[] = []
  const chain = (...names: string[]) => {
    const current: Record<string, unknown> = {}
    for (const name of names) {
      current[name] = (...args: unknown[]) => {
        calls.push({ name, args })
        return current
      }
    }
    // terminal run()
    current.run = () => {
      calls.push({ name: 'run', args: [] })
      return true
    }
    return current
  }
  const editor = {
    state,
    chain: () =>
      chain('insertContentAt', 'focus', 'setTextSelection', 'setHardBreak', 'splitBlock'),
  }
  return { editor: editor as never, calls }
}

function enterHandler() {
  const config = (
    MultilineEnter as unknown as {
      config: { addKeyboardShortcuts(): Record<string, (ctx: { editor: unknown }) => boolean> }
    }
  ).config
  return config.addKeyboardShortcuts().Enter
}

describe('MultilineEnter', () => {
  it('registers Enter and Shift+Enter, but not Backspace', () => {
    const config = (
      MultilineEnter as unknown as {
        config: { addKeyboardShortcuts(): Record<string, unknown> }
      }
    ).config
    const keys = Object.keys(config.addKeyboardShortcuts())
    expect(keys).toContain('Enter')
    expect(keys).toContain('Shift-Enter')
    expect(keys).not.toContain('Backspace')
  })

  it('Enter inside a text block inserts a hard break', () => {
    const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text('abc')])])
    const state = EditorState.create({ schema, doc })
    const { editor, calls } = makeEditor(state)
    expect(enterHandler()({ editor })).toBe(true)
    expect(calls.some((c) => c.name === 'setHardBreak')).toBe(true)
  })

  it('Enter on a selected image inserts a paragraph after it and focuses', () => {
    const doc = docWithImage()
    // Find the actual position of the image node, then select it.
    let imagePos = -1
    doc.descendants((node, pos) => {
      if (node.type.name === 'imageBlock') {
        imagePos = pos
        return false
      }
      return true
    })
    expect(imagePos).toBeGreaterThan(0)
    const sel = NodeSelection.create(doc, imagePos)

    // Build a real editor whose chain runs a real transaction, so we can assert
    // on the resulting document structure rather than mocked calls.
    let currentState = EditorState.create({ schema, doc, selection: sel })
    let resultingDoc = doc
    const editor = {
      get state() {
        return currentState
      },
      chain: () => ({
        insertContentAt: (pos: number, content: unknown) => ({
          focus: () => ({
            setTextSelection: (_pos: number) => ({
              run: () => {
                const tr = currentState.tr.insert(
                  pos,
                  ProseNode.fromJSON(schema, content as Record<string, unknown>),
                )
                currentState = currentState.apply(tr)
                resultingDoc = currentState.doc
                return true
              },
            }),
          }),
        }),
      }),
    } as unknown as Editor

    expect(enterHandler()({ editor })).toBe(true)

    // The document should now be [paragraph "abc"] [imageBlock] [paragraph ""].
    expect(resultingDoc.childCount).toBe(3)
    expect(resultingDoc.child(0).type.name).toBe('paragraph')
    expect(resultingDoc.child(1).type.name).toBe('imageBlock')
    expect(resultingDoc.child(2).type.name).toBe('paragraph')
    expect(resultingDoc.child(2).childCount).toBe(0)
  })

  it('Shift+Enter splits the block', () => {
    const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text('abc')])])
    const state = EditorState.create({ schema, doc })
    const config = (
      MultilineEnter as unknown as {
        config: { addKeyboardShortcuts(): Record<string, (ctx: { editor: unknown }) => boolean> }
      }
    ).config
    const handler = config.addKeyboardShortcuts()['Shift-Enter']
    const { editor, calls } = makeEditor(state)
    expect(handler({ editor })).toBe(true)
    expect(calls.some((c) => c.name === 'splitBlock')).toBe(true)
  })
})
