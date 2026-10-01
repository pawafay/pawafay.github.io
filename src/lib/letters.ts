// Every letter in the mailbox, collected out of src/letters/ by Vite.
//
// ── Why these photos live under src/ and not public/ ────────────────────────
// Every other asset in this project sits in public/ and is resolved at runtime
// through asset() (see lib/paths.ts). Letter photos and voice notes are the one
// exception, on purpose: public/ is copied verbatim and is invisible to
// import.meta.glob, so a folder in there can never be auto-detected. Keeping a
// letter's files next to its index.md lets Vite collect, hash and emit them,
// which is the whole reason "drop the files in the folder and they show up"
// works. Their URLs come back already resolved, so they must NOT be passed
// through asset() again.
//
// Importing them eagerly costs nothing at runtime: for a photo or a voice note
// the import is just its URL string. The bytes are only fetched when an <img>
// scrolls into view or a voice note's play button is pressed.
//
// Import this module from the mailbox components only. They live in the
// lazy-loaded PartyScene chunk, so the letter text rides along there instead of
// weighing down the initial bundle.
import type { LetterBlock, LetterEntry, LetterPhoto, LetterVoice } from '../letters.types'

/** Photos past this count are ignored, so a stray file can't blow up the layout. */
const MAX_PHOTOS = 10

const BODIES = import.meta.glob('../letters/*/index.md', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const PHOTOS = import.meta.glob('../letters/*/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const VOICES = import.meta.glob('../letters/*/*.{mp3,wav,flac}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

/** voice-1.json beside voice-1.mp3: its length and waveform, from sync-letter.mjs. */
const WAVEFORMS = import.meta.glob('../letters/*/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const BODY_PATH = /^\.\.\/letters\/([^/]+)\/index\.md$/
const FILE_PATH = /^\.\.\/letters\/([^/]+)\/([^/]+)$/
const FRONTMATTER = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/
const META_LINE = /^([A-Za-z][\w-]*)[ \t]*:[ \t]*(.*)$/

/**
 * `![](voice-1.mp3)` — a file from this letter's own folder, placed right here.
 * A bare filename only: anything with a slash or a scheme is a remote image, and
 * those are stripped below like any other unsupported markup.
 */
const EMBED = /!\[[^\]\n]*\]\(\s*([\w.-]+)\s*\)/g
const EMBED_ONLY = /^!\[[^\]\n]*\]\(\s*([\w.-]+)\s*\)$/

/**
 * Markup the letter format doesn't support, removed rather than shown raw.
 *
 * This is tidiness, not the XSS defence — that comes from the fact that letter
 * text is only ever rendered as React strings and elements (see InlineText), so
 * it never reaches an HTML parser in the first place. Stripping here just keeps
 * a pasted image or stray tag from showing up as literal gibberish in the letter.
 */
const STRIPPED = [
  /!\[[^\]]*\]\((?![\w.-]+\s*\))[^)]*\)/g, // remote markdown images — not embeds
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

type FolderFile = { kind: 'photo' | 'voice'; url: string }

/** slug → filename → file, for every photo and voice note in every letter folder. */
const FOLDERS = new Map<string, Map<string, FolderFile>>()
for (const [kind, files] of [
  ['photo', PHOTOS],
  ['voice', VOICES],
] as const) {
  for (const [path, url] of Object.entries(files)) {
    const parts = FILE_PATH.exec(path)
    if (!parts) continue
    let folder = FOLDERS.get(parts[1])
    if (!folder) FOLDERS.set(parts[1], (folder = new Map()))
    folder.set(parts[2], { kind, url })
  }
}

/** Numeric-aware so 2.jpg sorts before 10.jpg. */
const byName = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true })

/**
 * A voice note plus its waveform file, when it has a usable one. A hand-dropped
 * file has none, and the card then draws decorative bars and asks the browser
 * for the length instead — so a malformed .json is ignored, never fatal.
 */
function voiceOf(slug: string, name: string, url: string): LetterVoice {
  const data = WAVEFORMS[`../letters/${slug}/${name.replace(/\.\w+$/, '')}.json`] as
    { duration?: unknown; peaks?: unknown } | undefined
  const voice: LetterVoice = { url, name }
  if (typeof data?.duration === 'number' && data.duration > 0) voice.duration = data.duration
  if (
    Array.isArray(data?.peaks) &&
    data.peaks.length > 0 &&
    data.peaks.every((p) => typeof p === 'number' && Number.isFinite(p))
  ) {
    voice.peaks = (data.peaks as number[]).map((p) => Math.min(1, Math.max(0, p)))
  }
  return voice
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

/** Like reject(), for a problem that loses one piece of a letter but not the letter. */
function warn(slug: string, problem: string): void {
  const message = `"${slug}": ${problem}`
  letterProblems.push(message)
  console.error(`[letters] ${message}`)
}

/**
 * The letter as the page shows it: paragraphs, photos and voice notes in the
 * order they were written.
 *
 * An embed line puts its file exactly there; consecutive photos share one row.
 * Files nothing places come last — voice notes, then photos as the closing
 * scrapbook group. Every letter written before files could sit inline places
 * none of them, so it renders exactly as it always has.
 */
function blocksFor(slug: string, body: string): LetterBlock[] {
  const files = FOLDERS.get(slug) ?? new Map<string, FolderFile>()
  const placed = new Set<string>()
  const blocks: LetterBlock[] = []
  let photoCount = 0

  const addPhoto = (photo: LetterPhoto) => {
    if (photoCount >= MAX_PHOTOS) return
    photoCount += 1
    const last = blocks.at(-1)
    if (last?.kind === 'photos' && !last.trailing) last.photos.push(photo)
    else blocks.push({ kind: 'photos', photos: [photo], trailing: false })
  }

  // Trailing spaces ride along for free from an editor or a phone keyboard, and
  // they matter now that a newline inside a paragraph is a real break (see
  // InlineText): a line holding nothing but spaces isn't blank, so it would
  // quietly stop a paragraph break from being one. Flatten them first. Then give
  // every embed a paragraph of its own, wherever in a line it was typed.
  const chunks = strip(body)
    .replace(/[ \t]+$/gm, '')
    .replace(EMBED, '\n\n$&\n\n')
    .split(/\n{2,}/)

  for (const chunk of chunks) {
    const text = chunk.trim()
    if (!text) continue

    const embed = EMBED_ONLY.exec(text)
    if (!embed) {
      blocks.push({ kind: 'text', text })
      continue
    }

    const name = embed[1]
    const file = files.get(name)
    if (!file) {
      warn(slug, `index.md places "${name}", but there is no such photo or voice note beside it.`)
      continue
    }
    placed.add(name)
    if (file.kind === 'voice') blocks.push({ kind: 'voice', voice: voiceOf(slug, name, file.url) })
    else addPhoto({ url: file.url, name })
  }

  const rest = [...files.keys()].filter((name) => !placed.has(name)).sort(byName)
  for (const name of rest) {
    const file = files.get(name)!
    if (file.kind === 'voice') blocks.push({ kind: 'voice', voice: voiceOf(slug, name, file.url) })
  }
  const trailing: LetterPhoto[] = []
  for (const name of rest) {
    const file = files.get(name)!
    if (file.kind !== 'photo' || photoCount >= MAX_PHOTOS) continue
    photoCount += 1
    trailing.push({ url: file.url, name })
  }
  if (trailing.length > 0) blocks.push({ kind: 'photos', photos: trailing, trailing: true })

  return blocks
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

    // A letter can be nothing but a photo or a voice note — but it has to be
    // something.
    const blocks = blocksFor(slug, body)
    if (blocks.length === 0) {
      reject(slug, 'index.md has nothing below the frontmatter, and there are no files beside it.')
      continue
    }

    const counts = { paragraphs: 0, photos: 0, voices: 0 }
    for (const block of blocks) {
      if (block.kind === 'text') counts.paragraphs += 1
      else if (block.kind === 'photos') counts.photos += block.photos.length
      else counts.voices += 1
    }

    entries.push({ slug, date, title: meta.title, issue: meta.issue, blocks, counts })
  }

  // Newest first — and "newest" has to survive several letters sharing a day,
  // which is the normal case, not the edge one.
  //
  // The date is only a day, so same-day letters used to fall through to the slug
  // and come out in alphabetical order. That reads as random, and when the titles
  // happen to run in the order they were written it reads as *backwards*. The
  // issue number is the write-order signal we already have — GitHub only ever
  // counts up, and the sync workflow records it in the frontmatter — so it
  // settles the tie properly.
  //
  // A hand-written letter carries no issue number and so no time to compare
  // against; it sorts after the issue-written ones of its own day. The slug is
  // last purely so the order can never depend on the glob's.
  entries.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (b.issue ?? -1) - (a.issue ?? -1) ||
      b.slug.localeCompare(a.slug),
  )
  return entries
}

export const letters: LetterEntry[] = build()

/**
 * Whether there is a mailbox to show at all. Single source of truth, because
 * PartyScene has to decide whether to render the wrapper too — otherwise an
 * empty mailbox leaves a stray pop-layer div and its margin in the party.
 */
export const hasMail: boolean =
  letters.length > 0 || (import.meta.env.DEV && letterProblems.length > 0)

/** The letter a hash route points at, or undefined when the slug is stale/unknown. */
export function findLetter(slug: string | null | undefined): LetterEntry | undefined {
  if (!slug) return undefined
  return letters.find((letter) => letter.slug === slug)
}
