import { type Editor, Extension } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'

/**
 * Enter key behavior.
 *
 *  - Inside a text block → insert a hard break (a new line in the same
 *    paragraph), bound to Shift+Enter.
 *
 *  - On a selected image block → create a new, empty text block immediately
 *    after the image and move the caret into it. This keeps images and text
 *    independent: you never type "into" an image, you get a fresh block below.
 *
 *  - Shift+Enter anywhere → split the block (new paragraph), the original way.
 *
 * Backspace is untouched — it keeps TipTap's native join/delete behavior.
 *
 * Priority 1001 (above the default 100) ensures these shortcuts are checked
 * before StarterKit's, so the Enter binding actually wins.
 */
export const MultilineEnter = Extension.create({
  name: 'multilineEnter',
  priority: 1001,

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }: { editor: Editor }) => {
        const { selection } = editor.state
        if (isImageNodeSelection(selection)) {
          return insertBlockAfterImage(editor, selection)
        }
        return editor.chain().setHardBreak().run()
      },
      'Shift-Enter': ({ editor }: { editor: Editor }) => editor.chain().splitBlock().run(),
    }
  },
})

/** True when the whole image block is selected (a node selection on it). */
function isImageNodeSelection(selection: unknown): selection is NodeSelection {
  return selection instanceof NodeSelection && selection.node.type.name === 'imageBlock'
}

/**
 * Inserts an empty paragraph directly after the selected image and places the
 * caret at its start, so the user can begin typing immediately.
 */
function insertBlockAfterImage(editor: Editor, selection: NodeSelection) {
  const endOfImage = selection.from + selection.node.nodeSize
  return editor
    .chain()
    .insertContentAt(endOfImage, { type: 'paragraph' })
    .focus()
    .setTextSelection(endOfImage + 1)
    .run()
}
