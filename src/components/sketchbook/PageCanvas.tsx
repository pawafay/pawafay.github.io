import { useEffect, useRef } from 'react'
import type { DrawingStroke } from '../../drawings.types'
import { fitCanvas, paintStrokes } from '../../lib/ink'

interface PageCanvasProps {
  /** null while the drawing is still on its way — the paper shows bare. */
  strokes: readonly DrawingStroke[] | null
  className?: string
}

/**
 * A finished page, drawn once — a thumbnail on the shelf or in the book. Redrawn
 * only when it changes size, which on a phone mostly means turning it sideways.
 */
export function PageCanvas({ strokes, className }: PageCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    // The observer fires once as soon as it starts watching, so that is the
    // first paint too — by then the canvas has been laid out and has a size.
    const observer = new ResizeObserver(() => {
      const ctx = fitCanvas(canvas, 2)
      if (ctx && strokes) paintStrokes(ctx, strokes)
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [strokes])

  return <canvas ref={ref} className={className} aria-hidden="true" />
}
