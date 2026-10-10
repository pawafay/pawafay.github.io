// Every drawing in the sketchbook, collected out of src/drawings/ by Vite.
//
// Unlike the letters, these are NOT imported eagerly. A page of strokes runs to
// tens of kilobytes of numbers, and the sketchbook only ever grows, so each file
// becomes its own small chunk that is fetched the first time that page is shown.
// The file name alone — yyyy-mm-dd-<issue>.json, written by sync-drawing.mjs —
// is enough to list and order them before any of that is fetched.

import type { DrawingFile } from '../drawings.types'
import { cleanDrawingFile } from './drawingFormat'
import { publishedIdOf } from './sketchStore'
import type { SentPage } from './sketchStore'

const FILES = import.meta.glob<unknown>('../drawings/*.json', { import: 'default' })

const FILE_PATH = /^\.\.\/drawings\/((\d{4}-\d{2}-\d{2})-(\d+))\.json$/

export interface DrawingRef {
  /** The file name without .json. Doubles as the hash-route segment. */
  id: string
  date: string
  issue: number
}

function collect(): DrawingRef[] {
  const refs: DrawingRef[] = []
  for (const path of Object.keys(FILES)) {
    const matched = FILE_PATH.exec(path)
    if (!matched) continue
    refs.push({ id: matched[1], date: matched[2], issue: Number(matched[3]) })
  }
  // Newest first; the issue number settles a shared day, as in the mailbox.
  return refs.sort((a, b) => b.date.localeCompare(a.date) || b.issue - a.issue)
}

export const drawingRefs: DrawingRef[] = collect()

export function findDrawingRef(id: string | null | undefined): DrawingRef | undefined {
  if (!id) return undefined
  return drawingRefs.find((ref) => ref.id === id)
}

const loaded = new Map<string, Promise<DrawingFile | null>>()

/**
 * The drawing behind a ref, fetched once and shared by every place that shows
 * it. Resolves to null for a file that can't be read, rather than rejecting —
 * one bad page should leave a gap, not break the sketchbook.
 */
export function loadDrawing(id: string): Promise<DrawingFile | null> {
  let pending = loaded.get(id)
  if (!pending) {
    const load = FILES[`../drawings/${id}.json`]
    pending = load
      ? load().then(cleanDrawingFile, (error: unknown) => {
          console.error(`[sketchbook] could not load ${id}`, error)
          loaded.delete(id) // a network blip; let the next look try again
          return null
        })
      : Promise.resolve(null)
    loaded.set(id, pending)
  }
  return pending
}

/** Every published id, for checking a sent page against what's deployed. */
export const publishedIds: ReadonlySet<string> = new Set(drawingRefs.map((ref) => ref.id))

/** The pages this device sent that the deployed site doesn't have yet. */
export function stillDrying(sent: readonly SentPage[]): SentPage[] {
  return sent.filter((page) => !publishedIds.has(publishedIdOf(page)))
}

const DAY = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/** yyyy-mm-dd → "10 Oct 2026". UTC on both sides, so the day never shifts. */
export function formatDay(date: string): string {
  const at = new Date(`${date}T00:00:00Z`)
  return Number.isNaN(at.getTime()) ? date : DAY.format(at)
}
