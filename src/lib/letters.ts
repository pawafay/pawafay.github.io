// Every letter in the mailbox, collected out of src/letters/ by Vite.
//
// ── Why these photos live under src/ and not public/ ────────────────────────
// Every other asset in this project sits in public/ and is resolved at runtime
// through asset() (see lib/paths.ts). Letter photos are the one exception, on
// purpose: public/ is copied verbatim and is invisible to import.meta.glob, so a
// folder in there can never be auto-detected. Keeping a letter's photos next to
// its index.md lets Vite collect, hash and emit them, which is the whole reason
// "drop the files in the folder and they show up" works. Their URLs come back
// already resolved, so they must NOT be passed through asset() again.
//
// Import this module from the mailbox components only. They live in the
// lazy-loaded PartyScene chunk, so the letter text rides along there instead of
// weighing down the initial bundle.
import type { LetterEntry, LetterPhoto } from '../letters.types'

/** Photos past this count are ignored, so a stray file can't blow up the layout. */
const MAX_PHOTOS = 3

const BODIES = import.meta.glob('../letters/*/index.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const PHOTOS = import.meta.glob('../letters/*/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const BODY_PATH = /^\.\.\/letters\/([^/]+)\/index\.md$/
const PHOTO_PATH = /^\.\.\/letters\/([^/]+)\/([^/]+)$/
const FRONTMATTER = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/
const META_LINE = /^([A-Za-z][\w-]*)[ \t]*:[ \t]*(.*)$/

/**
 * Markup the letter format doesn't support, removed rather than shown raw.
 *
 * This is tidiness, not the XSS defence — that comes from the fact that letter
 * text is only ever rendered as React strings and elements (see InlineText), so
 * it never reaches an HTML parser in the first place. Stripping here just keeps
 * a pasted image or stray tag from showing up as literal gibberish in the letter.
 */
const STRIPPED = [
  /!\[[^\]]*\]\([^)]*\)/g, // markdown images — photos come from the folder
  /<!--[\s\S]*?-->/g, // html comments
  /<\/?[a-zA-Z][^>]*>/g, // html tags
]

interface Frontmatter {
  title?: string
  date?: string
  issue?: number
}

function strip(text: string): string {
  return STRIPPED.reduce((out, pattern) => out.replace(pattern, ''), text)
}

function unquote(value: string): string {
  const trimmed = value.trim()
  const first = trimmed[0]
  if ((first === '"' || first === "'") && trimmed.length > 1 && trimmed.endsWith(first)) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

/**
 * Splits the leading `---` block off a letter. Unknown keys are ignored rather
 * than rejected, so the frontmatter can grow without breaking old letters.
 */
function splitFrontmatter(raw: string): { meta: Frontmatter; body: string } {
  // Normalise CRLF and drop leading blank space — a letter may well be typed on
  // Windows, and trimStart() also eats a byte-order mark (U+FEFF counts as
  // whitespace), which would otherwise stop the `---` fence from matching.
  const text = raw.replace(/\r\n/g, '\n').trimStart()
  const block = FRONTMATTER.exec(text)
  if (!block) return { meta: {}, body: text }

  const meta: Frontmatter = {}
  for (const line of block[1].split('\n')) {
    const pair = META_LINE.exec(line.trim())
    if (!pair) continue
    const value = unquote(pair[2])
    if (value === '') continue

    if (pair[1] === 'title') meta.title = strip(value).trim() || undefined
    else if (pair[1] === 'date') meta.date = value
    else if (pair[1] === 'issue') {
      const n = Number.parseInt(value, 10)
      if (Number.isFinite(n)) meta.issue = n
    }
  }

  return { meta, body: text.slice(block[0].length) }
}

function photosFor(slug: string): LetterPhoto[] {
  const found: LetterPhoto[] = []
  for (const path of Object.keys(PHOTOS)) {
    const parts = PHOTO_PATH.exec(path)
    if (!parts || parts[1] !== slug) continue
    found.push({ url: PHOTOS[path], name: parts[2] })
  }
  // Numeric-aware so 2.jpg sorts before 10.jpg.
  found.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
  return found.slice(0, MAX_PHOTOS)
}

/**
 * Folders that couldn't be read as letters, so the mailbox can say so out loud
 * in dev instead of the letter just quietly never appearing.
 *
 * Deliberately *not* a thrown error. This module is only reached through the
 * lazily-imported PartyScene chunk, and preloadPartyAssets() swallows that
 * import's rejection — so a throw here wouldn't surface a useful message, it
 * would just blank the party when it eventually mounted. Skipping keeps the
 * site alive for every other letter; the note below is what makes the mistake
 * impossible to miss while writing.
 */
export const letterProblems: string[] = []

function reject(slug: string, problem: string): void {
  const message = `"${slug}" was skipped: ${problem}`
  letterProblems.push(message)
  console.error(`[letters] ${message}`)
}

function build(): LetterEntry[] {
  const entries: LetterEntry[] = []

  for (const path of Object.keys(BODIES)) {
    const matched = BODY_PATH.exec(path)
    if (!matched) continue
    const slug = matched[1]
    const { meta, body } = splitFrontmatter(BODIES[path])

    const date = meta.date ?? slug.slice(0, 10)
    if (!ISO_DATE.test(date)) {
      reject(
        slug,
        'no usable date. Name the folder yyyy-mm-dd-some-slug, or add a ' +
          '"date: yyyy-mm-dd" line to its frontmatter.',
      )
      continue
    }

    const paragraphs = strip(body)
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)

    if (paragraphs.length === 0) {
      reject(slug, 'index.md has no body text below the frontmatter.')
      continue
    }

    entries.push({
      slug,
      date,
      title: meta.title,
      issue: meta.issue,
      paragraphs,
      photos: photosFor(slug),
    })
  }

  // Newest first. Slug breaks ties so the order never depends on glob order.
  entries.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
  return entries
}

export const letters: LetterEntry[] = build()

/** The letter a hash route points at, or undefined when the slug is stale/unknown. */
export function findLetter(slug: string | null | undefined): LetterEntry | undefined {
  if (!slug) return undefined
  return letters.find((letter) => letter.slug === slug)
}
