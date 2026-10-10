// Type definitions for the sketchbook, loaded by src/lib/drawings.ts.
// Mirrors letters.types.ts: shapes here, data on disk under src/drawings/.

export type DrawingTool = 'pen' | 'marker' | 'eraser'

export interface DrawingStroke {
  tool: DrawingTool
  /** #rrggbb. Meaningless for the eraser, which always carries #000000. */
  color: string
  /** Nib width in page units — the page is PAGE_W units across. */
  size: number
  /**
   * True when the points carry a stylus's real pressure. Fingers and mice
   * report none, so their strokes get pressure simulated from speed instead.
   */
  pressure: boolean
  /** Flat [x, y, pressure 0–100, x, y, pressure, …], whole page units. */
  points: number[]
}

/** A page as the site sends it — and, give or take two keys, as it is stored. */
export interface DrawingData {
  v: 1
  width: number
  height: number
  /** Who drew it, as the key on that device was signed. Plain text. */
  by: string
  /** Optional title. Plain text, may be empty. */
  caption: string
  strokes: DrawingStroke[]
}

/** A published drawing: what .github/scripts/sync-drawing.mjs writes. */
export interface DrawingFile extends DrawingData {
  issue: number
  /** yyyy-mm-dd, the day its issue was opened in Asia/Jakarta. */
  date: string
}
