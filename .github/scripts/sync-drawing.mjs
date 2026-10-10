// Turn a `gambar` issue — a page sent from the sketchbook on the site — into a
// drawing file under src/drawings/.
//
// Run by .github/workflows/sync-drawings.yml, which has already checked that the
// issue was written *and* saved by the repo owner. The drawing in it is still
// treated as hostile input:
//
//   * every value arrives through process.env, never through `${{ }}` inside a
//     `run:` block (see sync-letter.mjs for why that matters);
//   * the drawing is never copied through. It is decoded, every field is checked,
//     and a fresh object is built from numbers, a hex colour and two short plain
//     strings — only that rebuilt copy is written. Nothing in the issue can get
//     markup, script or an unexpected key onto the site;
//   * inflating is capped, so a small payload can't balloon into a huge one;
//   * $GITHUB_OUTPUT only ever receives values generated here.
//
// Zero dependencies: Node built-ins only.

import { appendFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { DRAWINGS_DIR, findFilesForIssue } from './drawing-file.mjs'

const TIMEZONE = 'Asia/Jakarta'

// Mirrors src/lib/drawingFormat.ts — change the two together.
const PAGE_W = 800
const PAGE_H = 1000
const MARGIN = 60
const MAX_STROKES = 1500
const MAX_POINTS = 40_000
const MAX_SIZE = 120
const MAX_BY = 40
const MAX_CAPTION = 80
const TOOLS = new Set(['pen', 'marker', 'eraser'])
const HEX = /^#[0-9a-f]{6}$/i

/** Far more than MAX_POINTS can ever need, so only a crafted payload hits it. */
const MAX_INFLATED = 4 * 1024 * 1024

/**
 * The block the site writes into the issue body (see src/lib/github.ts):
 *
 *   ```drawing deflate
 *   <base64 of the deflate-raw'd JSON, points as steps (see cleanStroke)>
 *   ```
 *
 * `plain` instead of `deflate` when the browser had no CompressionStream.
 * \r? because an issue edited on github.com comes back with CRLF line endings.
 */
const FENCE = /^[ \t]*```drawing[ \t]+(deflate|plain)[ \t]*\r?\n([A-Za-z0-9+/=\s]+?)\r?\n[ \t]*```/m

/**
 * Control characters, and the bidi overrides that can make a name render
 * backwards. Neither belongs in a caption.
 */
const UNPRINTABLE = /[\p{Cc}\u2028\u2029\u202a-\u202e\u2066-\u2069]/gu

function fail(message) {
  console.error(`sync-drawing: ${message}`)
  process.exit(1)
}

function env(name) {
  const value = process.env[name]
  if (value === undefined || value === '') fail(`${name} is not set`)
  return value
}

function output(key, value) {
  const file = process.env.GITHUB_OUTPUT
  if (file) appendFileSync(file, `${key}=${value}\n`)
}

/** Same as sync-letter.mjs: the day the issue was opened, in Jakarta. */
function jakartaDate(iso) {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) fail(`could not parse the issue date: ${iso}`)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

/** A short line of plain text, cut by characters rather than UTF-16 units. */
function text(value, max) {
  if (typeof value !== 'string') return ''
  const flat = value.replace(UNPRINTABLE, ' ').replace(/\s+/g, ' ').trim()
  return Array.from(flat).slice(0, max).join('').trim()
}

function decode(body) {
  const block = FENCE.exec(body)
  if (!block) fail('no ```drawing block in the issue body — was it sent from the sketchbook?')

  const bytes = Buffer.from(block[2].replace(/\s+/g, ''), 'base64')
  let json
  try {
    json =
      block[1] === 'deflate'
        ? inflateRawSync(bytes, { maxOutputLength: MAX_INFLATED }).toString('utf8')
        : bytes.toString('utf8')
  } catch (error) {
    fail(`could not unpack the drawing: ${error.message}`)
  }
  if (json.length > MAX_INFLATED) fail('the drawing is too large')

  try {
    return JSON.parse(json)
  } catch {
    fail('the drawing is not valid JSON')
  }
}

/**
 * A stroke rebuilt from scratch, or null when it isn't one.
 *
 * The site sends each stroke's points as steps — the first point as it is, then
 * the difference from the one before (toSteps in src/lib/github.ts) — so they
 * are added back up into positions here. The file on disk holds positions.
 */
function cleanStroke(raw, budget) {
  if (!raw || typeof raw !== 'object') return null
  const { tool, color, size, pressure, points } = raw

  if (!TOOLS.has(tool)) return null
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 1 || size > MAX_SIZE) {
    return null
  }
  if (tool !== 'eraser' && (typeof color !== 'string' || !HEX.test(color))) return null
  if (!Array.isArray(points) || points.length < 3 || points.length % 3 !== 0) return null
  if (points.length / 3 > budget) return null

  const clean = new Array(points.length)
  let [x, y, p] = [0, 0, 0]
  for (let i = 0; i < points.length; i += 3) {
    const step = [points[i], points[i + 1], points[i + 2]]
    if (!step.every((n) => typeof n === 'number' && Number.isFinite(n))) return null
    x += step[0]
    y += step[1]
    p += step[2]
    if (![x, y, p].every(Number.isFinite)) return null
    clean[i] = Math.round(Math.min(PAGE_W + MARGIN, Math.max(-MARGIN, x)))
    clean[i + 1] = Math.round(Math.min(PAGE_H + MARGIN, Math.max(-MARGIN, y)))
    clean[i + 2] = Math.round(Math.min(100, Math.max(0, p)))
  }

  return {
    tool,
    // The eraser has no colour; a fixed one keeps every stroke the same shape.
    color: tool === 'eraser' ? '#000000' : color.toLowerCase(),
    size: Math.round(size * 10) / 10,
    pressure: pressure === true,
    points: clean,
  }
}

function clean(raw) {
  if (!raw || typeof raw !== 'object') fail('the drawing is not an object')
  if (raw.v !== 1) fail(`unknown drawing version: ${JSON.stringify(raw.v)}`)
  if (raw.width !== PAGE_W || raw.height !== PAGE_H) fail('the page is the wrong size')
  if (!Array.isArray(raw.strokes)) fail('the drawing has no strokes')
  if (raw.strokes.length > MAX_STROKES) fail(`more than ${MAX_STROKES} strokes`)

  const strokes = []
  let budget = MAX_POINTS
  for (const [i, rawStroke] of raw.strokes.entries()) {
    const stroke = cleanStroke(rawStroke, budget)
    if (!stroke) fail(`stroke ${i + 1} is malformed, or the page has too many points`)
    budget -= stroke.points.length / 3
    strokes.push(stroke)
  }
  if (!strokes.some((stroke) => stroke.tool !== 'eraser')) fail('the page is blank')

  return {
    by: text(raw.by, MAX_BY) || 'someone',
    caption: text(raw.caption, MAX_CAPTION),
    strokes,
  }
}

/**
 * One stroke per line: a diff of the file then reads stroke by stroke, and
 * nobody has to scroll sideways past ten thousand numbers to see the caption.
 */
function serialise(file) {
  const { strokes, ...head } = file
  const lines = Object.entries(head).map(
    ([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`,
  )
  const body = strokes.map((stroke) => `    ${JSON.stringify(stroke)}`).join(',\n')
  return `{\n${lines.join('\n')}\n  "strokes": [\n${body}\n  ]\n}\n`
}

const issue = Number.parseInt(env('ISSUE_NUMBER'), 10)
if (!Number.isSafeInteger(issue) || issue <= 0) fail('ISSUE_NUMBER is not a number')
const date = jakartaDate(env('ISSUE_CREATED'))
const drawing = clean(decode(env('ISSUE_BODY')))

const file = {
  v: 1,
  issue,
  date,
  by: drawing.by,
  caption: drawing.caption,
  width: PAGE_W,
  height: PAGE_H,
  strokes: drawing.strokes,
}
const contents = serialise(file)
JSON.parse(contents) // never commit a file the site can't read

// The date comes from created_at, which never changes, so the name is stable
// across edits. Clearing first anyway means a hand-renamed copy can't double up.
mkdirSync(DRAWINGS_DIR, { recursive: true })
for (const name of findFilesForIssue(issue)) rmSync(join(DRAWINGS_DIR, name), { force: true })

const id = `${date}-${issue}`
writeFileSync(join(DRAWINGS_DIR, `${id}.json`), contents)
console.log(`sync-drawing: wrote ${id}.json — ${drawing.strokes.length} stroke(s) by ${drawing.by}`)

output('drawing_id', id)
output('stroke_count', String(drawing.strokes.length))
