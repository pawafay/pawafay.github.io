import { useEffect, useRef } from 'react'
import type { DrawingStroke } from '../../drawings.types'
import { fitCanvas, paintPartial, paintStroke, paintStrokes } from '../../lib/ink'

/** A lifted pen costs this many points' worth of time, so strokes don't run together. */
const LIFT = 8
const MS_PER_POINT = 4
const MIN_MS = 1400
const MAX_MS = 8000

interface ReplayCanvasProps {
  strokes: readonly DrawingStroke[]
  /** Change it to draw the page again from the beginning. */
  run: number
  reduced: boolean
}

/**
 * A page drawing itself again, stroke by stroke, in the order it was drawn.
 *
 * Finished strokes are kept on an offscreen layer, so a frame only redraws the
 * one stroke in progress on top of a single image copy. With reduced motion the
 * finished page is simply shown.
 */
export function ReplayCanvas({ strokes, run, reduced }: ReplayCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    let animating = !reduced && strokes.length > 0
    const paintAll = () => {
      const ctx = fitCanvas(canvas, 2.5)
      if (ctx) paintStrokes(ctx, strokes)
    }

    // Once it's done, or with reduced motion, a resize just repaints the page.
    const observer = new ResizeObserver(() => {
      if (!animating) paintAll()
    })
    observer.observe(canvas)
    if (!animating) return () => observer.disconnect()

    // Where each stroke starts, in time units: its points plus a pen lift.
    const starts: number[] = []
    let total = 0
    for (const stroke of strokes) {
      starts.push(total)
      total += stroke.points.length / 3 + LIFT
    }
    const duration = Math.min(MAX_MS, Math.max(MIN_MS, total * MS_PER_POINT))

    const done = document.createElement('canvas')
    let doneCount = 0
    let begun: number | null = null
    let frame = 0

    const tick = (now: number) => {
      begun ??= now
      const progress = Math.min(1, (now - begun) / duration)
      // Eased so it starts and settles like a hand would, not a plotter.
      const eased = progress < 0.5 ? 2 * progress ** 2 : 1 - (-2 * progress + 2) ** 2 / 2
      const at = eased * total

      const ctx = fitCanvas(canvas, 2.5)
      if (ctx) {
        // The offscreen layer follows the canvas's size; resizing wipes it, so
        // it is rebuilt from the first stroke on.
        if (done.width !== canvas.width || done.height !== canvas.height) {
          done.width = canvas.width
          done.height = canvas.height
          doneCount = 0
        }
        const doneCtx = done.getContext('2d')
        if (doneCtx) {
          doneCtx.setTransform(ctx.getTransform())
          while (doneCount < strokes.length) {
            const end = starts[doneCount] + strokes[doneCount].points.length / 3
            if (end > at) break
            paintStroke(doneCtx, strokes[doneCount])
            doneCount += 1
          }
          ctx.save()
          ctx.setTransform(1, 0, 0, 1, 0, 0)
          ctx.drawImage(done, 0, 0)
          ctx.restore()
        }
        if (doneCount < strokes.length) {
          const drawn = Math.floor(at - starts[doneCount])
          if (drawn > 0) paintPartial(ctx, strokes[doneCount], drawn)
        }
      }

      if (progress < 1) frame = requestAnimationFrame(tick)
      else {
        animating = false
        paintAll()
      }
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      // Every replay makes a new one; zero-sized, iOS frees it now, not at the
      // next GC — it caps how much canvas memory a page may hold.
      done.width = done.height = 0
    }
  }, [strokes, run, reduced])

  return <canvas ref={ref} aria-hidden="true" />
}
