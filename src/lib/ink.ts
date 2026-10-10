// Turning strokes into ink on a <canvas>.
//
// A stroke is stored as the points the nib passed through; perfect-freehand
// turns those into the outline of a real pen line — swelling with pressure,
// thinning with speed — and that outline is filled. Every drawing on the site,
// from the thumbnail on the party wall to the page being drawn, goes through
// here, so a page looks the same wherever it is shown.
//
// The canvas holds ink only and is transparent everywhere else; the paper is
// CSS behind it. That is what lets the eraser simply cut ink away
// (destination-out) instead of painting a paper colour over it.

import { getStroke } from 'perfect-freehand'
import type { StrokeOptions } from 'perfect-freehand'
import type { DrawingStroke } from '../drawings.types'
import { PAGE_H, PAGE_W } from './drawingFormat'

/** How see-through a marker is, so it reads as a highlighter over pen. */
const MARKER_ALPHA = 0.42

function optionsFor(stroke: DrawingStroke, last: boolean): StrokeOptions {
  const base = { size: stroke.size, last, smoothing: 0.6 }
  if (stroke.tool === 'pen') {
    return {
      ...base,
      thinning: stroke.pressure ? 0.65 : 0.55,
      streamline: 0.45,
      simulatePressure: !stroke.pressure,
    }
  }
  // Marker and eraser keep one width end to end, whatever the pressure.
  return { ...base, thinning: 0, streamline: stroke.tool === 'eraser' ? 0.35 : 0.5 }
}

function inputFor(stroke: DrawingStroke, count: number): number[][] {
  const input = new Array<number[]>(count)
  const p = stroke.points
  for (let i = 0; i < count; i += 1) input[i] = [p[i * 3], p[i * 3 + 1], p[i * 3 + 2] / 100]
  return input
}

/** The outline as a closed curve through the midpoints of its edges. */
function outlinePath(outline: number[][]): Path2D {
  const path = new Path2D()
  const len = outline.length
  if (len < 2) return path
  path.moveTo(outline[0][0], outline[0][1])
  for (let i = 0; i < len; i += 1) {
    const [x0, y0] = outline[i]
    const [x1, y1] = outline[(i + 1) % len]
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
  }
  path.closePath()
  return path
}

function fill(ctx: CanvasRenderingContext2D, stroke: DrawingStroke, path: Path2D): void {
  ctx.save()
  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = '#000'
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = stroke.color
    if (stroke.tool === 'marker') ctx.globalAlpha = MARKER_ALPHA
  }
  ctx.fill(path)
  ctx.restore()
}

/**
 * Finished strokes never change, so their outline is worked out once. Keyed on
 * the stroke object itself: undo, a resize or a thumbnail redrawn on scroll all
 * reuse it, and it goes when the stroke does.
 */
const finished = new WeakMap<DrawingStroke, Path2D>()

/** One finished stroke. */
export function paintStroke(ctx: CanvasRenderingContext2D, stroke: DrawingStroke): void {
  let path = finished.get(stroke)
  if (!path) {
    const count = stroke.points.length / 3
    path = outlinePath(getStroke(inputFor(stroke, count), optionsFor(stroke, true)))
    finished.set(stroke, path)
  }
  fill(ctx, stroke, path)
}

/**
 * The first `count` points of a stroke — one still being drawn, or one being
 * replayed. Never cached: it is a different shape every frame.
 */
export function paintPartial(
  ctx: CanvasRenderingContext2D,
  stroke: DrawingStroke,
  count: number,
): void {
  const n = Math.min(count, stroke.points.length / 3)
  if (n <= 0) return
  fill(ctx, stroke, outlinePath(getStroke(inputFor(stroke, n), optionsFor(stroke, false))))
}

export function paintStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: readonly DrawingStroke[],
): void {
  for (const stroke of strokes) paintStroke(ctx, stroke)
}

/**
 * Sizes a canvas's backing store to its laid-out size (sharp on a retina screen)
 * and scales it so that drawing in page units fills it exactly. Clears it, too:
 * changing a canvas's size always does.
 *
 * Returns null while the canvas has no size yet — not laid out, or hidden.
 */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  maxDpr = 2.5,
): CanvasRenderingContext2D | null {
  const cssWidth = canvas.clientWidth
  if (cssWidth === 0) return null
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
  const width = Math.round(cssWidth * dpr)
  const height = Math.round((width * PAGE_H) / PAGE_W)
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.setTransform(width / PAGE_W, 0, 0, width / PAGE_W, 0, 0)
  return ctx
}
