import { type NodeViewProps, NodeViewWrapper } from '@tiptap/react'
import { useRef, useState } from 'react'
import type { ImageBlockAttrs } from '../editor/ImageBlockNode'

const MIN_WIDTH = 140

interface DragState {
  side: 'left' | 'right'
  startX: number
  startWidth: number
  startLeft: number
}

/**
 * React node view for the image block. Mirrors the reference prototype's
 * ImageBlockComponent: the image sits in a relative "stage" whose height
 * follows the aspect ratio; hover shows edge handles — the right handle
 * changes width (left stays pinned), the left handle moves both left and
 * width (right edge stays fixed). A size badge shows "W × H px".
 */
export function ImageBlockView({ node, editor, getPos }: NodeViewProps) {
  const attrs = node.attrs as ImageBlockAttrs
  const { src, width, left, natW, natH } = attrs

  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [resizing, setResizing] = useState(false)

  const aspect = natW > 0 && natH > 0 ? natW / natH : 1
  const h = Math.max(1, Math.round(width / aspect))

  /** Attribute updates skip the undo history so pixel-level drags stay one gesture. */
  const setAttrs = (next: Partial<ImageBlockAttrs>) => {
    const pos = typeof getPos === 'function' ? getPos() : undefined
    if (typeof pos !== 'number') return
    const tr = editor.state.tr.setNodeMarkup(pos, undefined, { ...attrs, ...next })
    tr.setMeta('addToHistory', false)
    editor.view.dispatch(tr)
  }

  const onPointerDown = (e: React.PointerEvent, side: 'left' | 'right') => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { side, startX: e.clientX, startWidth: width, startLeft: left }
    setResizing(true)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    const stage = stageRef.current
    if (!drag || !stage) return
    const maxW = stage.clientWidth
    const delta = e.clientX - drag.startX

    if (drag.side === 'right') {
      // Right edge: width follows the pointer, left stays pinned.
      const w = Math.max(MIN_WIDTH, Math.min(drag.startWidth + delta, maxW - drag.startLeft))
      setAttrs({ width: Math.round(w) })
    } else {
      // Left edge: width and offset move together, right edge stays fixed.
      const newLeft = Math.max(0, drag.startLeft + delta)
      const newWidth = Math.max(MIN_WIDTH, drag.startWidth - delta)
      const maxLeft = maxW - MIN_WIDTH
      if (newLeft <= maxLeft && newWidth >= MIN_WIDTH) {
        setAttrs({ left: Math.round(newLeft), width: Math.round(newWidth) })
      }
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null
    setResizing(false)
    const el = e.currentTarget as HTMLElement
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
  }

  return (
    <NodeViewWrapper className="image-block">
      <div
        ref={stageRef}
        className={`img-stage${resizing ? ' resizing' : ''}`}
        style={{ height: h }}
      >
        <img
          className="img-abs"
          src={src}
          alt=""
          draggable={false}
          style={{ left, width, height: h }}
        />
        <div
          className="resize-handle"
          style={{ left, top: h / 2 }}
          onPointerDown={(e) => onPointerDown(e, 'left')}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
        <div
          className="resize-handle"
          style={{ left: left + width, top: h / 2 }}
          onPointerDown={(e) => onPointerDown(e, 'right')}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
        <div className="size-badge" style={{ left: left + width - 10 }}>
          {width} × {h} px
        </div>
        <div className="anchor-dot" style={{ left: left - 4 }} />
        <div className="anchor-note">drag edges to resize</div>
      </div>
    </NodeViewWrapper>
  )
}
