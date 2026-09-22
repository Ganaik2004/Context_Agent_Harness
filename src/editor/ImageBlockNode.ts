import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ImageBlockView } from '../components/ImageBlockView'

export interface ImageBlockAttrs {
  src: string
  /** Rendered width in px. */
  width: number
  /** Horizontal offset within the block (right edge grows from here). */
  left: number
  /** Natural size, kept so the aspect ratio survives round-trips. */
  natW: number
  natH: number
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageBlock: {
      insertImageBlock: (attrs: Partial<ImageBlockAttrs>) => ReturnType
    }
  }
}

const DEFAULT_ATTRS: ImageBlockAttrs = { src: '', width: 420, left: 0, natW: 800, natH: 600 }

/**
 * The image block from the reference prototype: an atom block node with
 * width + left attributes, rendered by a React node view that provides the
 * hover resize handles. Persistence round-trips through the note JSON.
 */
export const ImageBlockNode = Node.create({
  name: 'imageBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      src: { default: DEFAULT_ATTRS.src, parseHTML: (el) => el.getAttribute('src') ?? '' },
      width: {
        default: DEFAULT_ATTRS.width,
        parseHTML: (el) => Number(el.getAttribute('width')) || DEFAULT_ATTRS.width,
      },
      left: {
        default: DEFAULT_ATTRS.left,
        parseHTML: (el) => Number(el.getAttribute('data-left')) || 0,
      },
      natW: {
        default: DEFAULT_ATTRS.natW,
        parseHTML: (el) => Number(el.getAttribute('data-nat-w')) || DEFAULT_ATTRS.natW,
      },
      natH: {
        default: DEFAULT_ATTRS.natH,
        parseHTML: (el) => Number(el.getAttribute('data-nat-h')) || DEFAULT_ATTRS.natH,
      },
    }
  },

  parseHTML() {
    return [{ tag: 'img[data-type="image-block"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as ImageBlockAttrs
    return [
      'img',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'image-block',
        src: attrs.src,
        width: attrs.width,
        'data-left': attrs.left,
        'data-nat-w': attrs.natW,
        'data-nat-h': attrs.natH,
      }),
    ]
  },

  addCommands() {
    return {
      insertImageBlock:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { ...DEFAULT_ATTRS, ...attrs } }),
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView)
  },
})
