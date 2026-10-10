// The page every drawing is made on, and the checks a drawing has to pass before
// it is drawn. The limits are mirrored in .github/scripts/sync-drawing.mjs —
// change the two together, or the site will happily make pages the workflow
// refuses to publish.
//
// Published files have already been rebuilt by that script, so checking them
// again here is belt and braces. What it is really for is this device's own
// storage — the unsent draft and the pages waiting to be pinned up — which
// anything else on the origin could have written to.

import type { DrawingData, DrawingFile, DrawingStroke, DrawingTool } from '../drawings.types'

/** 4:5 portrait. Points are stored in these units, whatever size the screen. */
export const PAGE_W = 800
export const PAGE_H = 1000
/** How far past the edge a stroke may run before its points are clamped. */
export const PAGE_MARGIN = 60

export const LIMITS = {
  strokes: 1500,
  /** Points across the whole page, not per stroke. */
  points: 40_000,
  size: 120,
  by: 40,
  caption: 80,
} as const

const TOOLS: ReadonlySet<string> = new Set<DrawingTool>(['pen', 'marker', 'eraser'])
const HEX = /^#[0-9a-f]{6}$/i
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const UNPRINTABLE = /[\p{Cc}\u2028\u2029\u202a-\u202e\u2066-\u2069]/gu

/** A short line of plain text, cut by characters so an emoji is never halved. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  const flat = value.replace(UNPRINTABLE, ' ').replace(/\s+/g, ' ').trim()
  return Array.from(flat).slice(0, max).join('').trim()
}

const isNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

function cleanStroke(raw: unknown): DrawingStroke | null {
  if (!raw || typeof raw !== 'object') return null
  const { tool, color, size, pressure, points } = raw as Record<string, unknown>
  if (typeof tool !== 'string' || !TOOLS.has(tool)) return null
  if (!isNumber(size) || size < 1 || size > LIMITS.size) return null
  if (tool !== 'eraser' && (typeof color !== 'string' || !HEX.test(color))) return null
  if (!Array.isArray(points) || points.length < 3 || points.length % 3 !== 0) return null
  if (!points.every(isNumber)) return null
  return {
    tool: tool as DrawingTool,
    color: tool === 'eraser' ? '#000000' : (color as string),
    size,
    pressure: pressure === true,
    points: points as number[],
  }
}

/** Strokes worth drawing, or null when `raw` isn't a list of them at all. */
export function cleanStrokes(raw: unknown): DrawingStroke[] | null {
  if (!Array.isArray(raw)) return null
  const strokes: DrawingStroke[] = []
  for (const item of raw.slice(0, LIMITS.strokes)) {
    const stroke = cleanStroke(item)
    if (stroke) strokes.push(stroke)
  }
  return strokes
}

export function cleanDrawing(raw: unknown): DrawingData | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  if (data.v !== 1 || data.width !== PAGE_W || data.height !== PAGE_H) return null
  const strokes = cleanStrokes(data.strokes)
  if (!strokes) return null
  return {
    v: 1,
    width: PAGE_W,
    height: PAGE_H,
    by: cleanText(data.by, LIMITS.by),
    caption: cleanText(data.caption, LIMITS.caption),
    strokes,
  }
}

export function cleanDrawingFile(raw: unknown): DrawingFile | null {
  const drawing = cleanDrawing(raw)
  if (!drawing) return null
  const { issue, date } = raw as Record<string, unknown>
  if (!isNumber(issue) || typeof date !== 'string' || !ISO_DATE.test(date)) return null
  return { ...drawing, issue, date }
}

export function pointCount(strokes: readonly DrawingStroke[]): number {
  let total = 0
  for (const stroke of strokes) total += stroke.points.length / 3
  return total
}

/** Whether a page has anything on it an eraser didn't put there. */
export function hasInk(strokes: readonly DrawingStroke[]): boolean {
  return strokes.some((stroke) => stroke.tool !== 'eraser')
}
