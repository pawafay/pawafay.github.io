// Turn a GitHub issue into a letter folder under src/letters/.
//
// Run by .github/workflows/sync-letters.yml, which has already checked that the
// issue was written *and* saved by the repo owner. Everything here still treats
// the issue text as hostile input:
//
//   * every value arrives through process.env, never through `${{ }}` inside a
//     `run:` block — that form is textual substitution done before bash starts,
//     so a title containing `"; curl evil | sh #` would simply execute;
//   * ImageMagick and ffmpeg are invoked with execFileSync and an argv array (no
//     shell), so nothing derived from the issue can break out of an argument;
//   * only GitHub's own attachment hosts are fetched, so the job can't be turned
//     into an arbitrary-URL downloader;
//   * $GITHUB_OUTPUT only ever receives values we generated ourselves.
//
// Photos and voice notes stay where they were dropped into the issue: each one is
// replaced, in place, by an embed line — `![](2.jpg)`, `![](voice-1.mp3)` — that
// src/lib/letters.ts turns back into a photo or a player at that same spot.
//
// Zero dependencies: Node built-ins plus global fetch. Nothing to install, and
// almost no supply-chain surface.

import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LETTERS_DIR, findFolderForIssue } from './letter-folder.mjs'

const MAX_PHOTOS = 10
const MAX_BYTES = 25 * 1024 * 1024
const TIMEZONE = 'Asia/Jakarta'

/** How many bars the voice-note card draws, and the rate they're measured at. */
const WAVE_BARS = 48
const WAVE_RATE = 8000

/** Only GitHub's own attachment hosts. Anything else is ignored, not fetched. */
const ALLOWED_HOST =
  /^https:\/\/(github\.com\/user-attachments\/(assets|files)\/|(private-)?user-images\.githubusercontent\.com\/|raw\.githubusercontent\.com\/)/

// Every way GitHub writes an upload into an issue body, as one alternation so a
// single left-to-right pass meets them in the order they were written:
//
//   1  ![alt](url)                     a markdown image
//   2  <img … src="url" … />           what the editor inserts for a photo today
//   3  [name.mp3](url)                 what it inserts for a file — kept only
//      4                               when it is an .mp3/.wav (see voiceHint)
//   5  https://…/user-attachments/assets/<uuid>   alone on a line: how video is
//                                      inserted, so audio may well arrive this way
//
// The image form is tried first, so `![…](…)` is never mistaken for a link.
const ATTACHMENT = new RegExp(
  [
    /!\[[^\]]*\]\(\s*<?(https?:\/\/[^\s)>]+?)>?(?:\s+["'][^"']*["'])?\s*\)/.source,
    /<img\b[^>]*?\bsrc\s*=\s*["']?(https?:\/\/[^"'\s>]+)[^>]*>/.source,
    /\[([^\]\n]*)\]\(\s*<?(https?:\/\/[^\s)>]+?)>?\s*\)/.source,
    /^[ \t]*(https:\/\/github\.com\/user-attachments\/assets\/[0-9a-f-]{36})[ \t]*$/.source,
  ].join('|'),
  'gim',
)

const AUDIO_NAME = /\.(mp3|wav)$/i

/**
 * Placeholders for attachments, swapped for embed lines once they're saved —
 * fenced by a private-use character, which no one types into a letter. The
 * spaces around one go with it, or the words after a mid-sentence voice note
 * would start their new line with a stray space.
 */
const TOKEN = /[ \t]*(\d+)[ \t]*/g

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

/** Whether a `[text](url)` link is a voice note: by the file's name, either place. */
function voiceHint(text, url) {
  let path = ''
  try {
    path = decodeURIComponent(new URL(url).pathname)
  } catch {
    /* unparsable — fall back to the link text alone */
  }
  return AUDIO_NAME.test(path) || AUDIO_NAME.test(text.trim())
}

/**
 * Swaps every attachment in the body for a numbered placeholder and lists what
 * each one is, in the order they appear. Nothing is fetched yet.
 *
 * kind: 'photo' (image markup), 'voice' (an .mp3/.wav link), or 'unknown' (a bare
 * asset URL — only its download says what it is). The same URL twice is one
 * attachment shown twice, not two downloads.
 */
function collectAttachments(body) {
  const attachments = []
  const tokenFor = (url, kind) => {
    let index = attachments.findIndex((a) => a.url === url)
    if (index === -1) index = attachments.push({ url, kind }) - 1
    return `${index}`
  }

  const text = body.replace(
    ATTACHMENT,
    (match, mdImage, htmlImage, linkText, linkUrl, bareAsset) => {
      const image = mdImage ?? htmlImage
      // An image from anywhere else is dropped, as it always was: the letter
      // can't show it and its markup would only print as gibberish.
      if (image !== undefined) return ALLOWED_HOST.test(image) ? tokenFor(image, 'photo') : ''
      if (bareAsset !== undefined) return tokenFor(bareAsset, 'unknown')
      // Any other link stays exactly as written.
      if (ALLOWED_HOST.test(linkUrl) && voiceHint(linkText, linkUrl)) {
        return tokenFor(linkUrl, 'voice')
      }
      return match
    },
  )
  return { text, attachments }
}

/**
 * `magick` on ImageMagick 7, `convert` on 6 — Ubuntu's apt package is 6, so in CI
 * this finds `convert`. The workflow installs it; see the "Install ImageMagick
 * and ffmpeg" step in .github/workflows/sync-letters.yml if this ever fails again.
 */
function magickBinary() {
  for (const bin of ['magick', 'convert']) {
    try {
      execFileSync(bin, ['-version'], { stdio: 'ignore' })
      return bin
    } catch {
      /* try the next one */
    }
  }
  return fail(
    'ImageMagick is not available — the workflow should have installed it (see the "Install ImageMagick and ffmpeg" step)',
  )
}

function requireFfmpeg() {
  for (const bin of ['ffmpeg', 'ffprobe']) {
    try {
      execFileSync(bin, ['-version'], { stdio: 'ignore' })
    } catch {
      fail(
        `${bin} is not available — the workflow should have installed it (see the "Install ImageMagick and ffmpeg" step)`,
      )
    }
  }
}

async function download(url, label) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) fail(`could not download ${label}: HTTP ${response.status}`)

  const type = response.headers.get('content-type') ?? ''
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length === 0) fail(`${label} came back empty`)
  if (bytes.length > MAX_BYTES) fail(`${label} is larger than ${MAX_BYTES} bytes`)
  return { type, bytes }
}

function savePhoto(bytes, number, intoDir, bin) {
  const raw = join(intoDir, `raw-photo-${number}`)
  writeFileSync(raw, bytes)

  // -auto-orient BEFORE -strip: bake the rotation in, then drop the metadata, or
  // phone photos come out sideways. -strip is also the privacy step — phone EXIF
  // carries GPS coordinates and this repo is public.
  // '1600x1600>' shrinks only; it never upscales a small image.
  const file = `${number}.jpg`
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
    join(intoDir, file),
  ])
  rmSync(raw)
  return file
}

/** The container and first audio stream ffprobe sees, or null when there is none. */
function probeAudio(path) {
  try {
    const out = execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-select_streams',
        'a:0',
        '-show_entries',
        'format=format_name:stream=codec_name',
        '-of',
        'json',
        path,
      ],
      { encoding: 'utf8' },
    )
    const info = JSON.parse(out)
    const codec = info.streams?.[0]?.codec_name
    if (!codec) return null
    return { format: String(info.format?.format_name ?? ''), codec: String(codec) }
  } catch {
    return null
  }
}

/**
 * The MP3 with its ID3 tags cut off, and nothing else touched.
 *
 * Tags are where a recorder app writes its name, a title, sometimes a location —
 * the audio equivalent of the EXIF that photos are stripped of, and this repo is
 * public. They sit wholly outside the audio frames (ID3v2 before the first one,
 * ID3v1 in the last 128 bytes), so slicing them off leaves every frame
 * byte-for-byte as recorded. Nothing is decoded or re-encoded.
 */
function withoutId3(bytes) {
  let start = 0
  let end = bytes.length
  // ID3v2: "ID3", version (2), flags (1), then a 4-byte syncsafe size that
  // excludes the 10-byte header and the optional 10-byte footer (flag 0x10).
  while (end - start >= 10 && bytes.toString('latin1', start, start + 3) === 'ID3') {
    const size =
      ((bytes[start + 6] & 0x7f) << 21) |
      ((bytes[start + 7] & 0x7f) << 14) |
      ((bytes[start + 8] & 0x7f) << 7) |
      (bytes[start + 9] & 0x7f)
    start += 10 + size + (bytes[start + 5] & 0x10 ? 10 : 0)
  }
  if (end - start >= 128 && bytes.toString('latin1', end - 128, end - 125) === 'TAG') end -= 128
  // A size field pointing past the end means the tag is corrupt, not that the
  // file is empty — keep the original rather than publishing nothing.
  return start < end ? bytes.subarray(start, end) : bytes
}

/**
 * A voice note, saved without ever lowering its quality:
 *
 *   MP3              kept as is — only the ID3 tags come off (see withoutId3);
 *   16/24-bit WAV    becomes FLAC, which is lossless: it decodes back to exactly
 *                    the same samples, at roughly half the size, so it streams
 *                    on a phone instead of stalling;
 *   any other WAV    kept as is (32-bit or float PCM, which FLAC either can't
 *                    hold exactly or browsers can't play back).
 */
function saveVoice(bytes, number, intoDir, label) {
  const raw = join(intoDir, `raw-voice-${number}`)
  writeFileSync(raw, bytes)

  const audio = probeAudio(raw)
  if (!audio) fail(`${label} is not an audio file — only .mp3 and .wav voice notes are supported`)

  let file
  if (audio.codec === 'mp3') {
    file = `voice-${number}.mp3`
    writeFileSync(join(intoDir, file), withoutId3(bytes))
  } else if (audio.format === 'wav' && /^pcm_s(16|24)le$/.test(audio.codec)) {
    file = `voice-${number}.flac`
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-nostdin',
      '-i',
      raw,
      '-map',
      '0:a:0',
      '-map_metadata',
      '-1',
      '-c:a',
      'flac',
      '-compression_level',
      '8',
      join(intoDir, file),
    ])
  } else if (audio.format === 'wav') {
    file = `voice-${number}.wav`
    writeFileSync(join(intoDir, file), bytes)
  } else {
    fail(`${label} is ${audio.codec} audio — only .mp3 and .wav voice notes are supported`)
  }
  rmSync(raw)

  const wave = waveformOf(join(intoDir, file), label)
  writeFileSync(join(intoDir, file.replace(/\.\w+$/, '.json')), `${JSON.stringify(wave)}\n`)
  return file
}

/**
 * What the voice-note card draws, measured once here so the page never has to
 * download the audio just to show it: the length, and WAVE_BARS loudness values
 * between 0 and 1.
 *
 * Loudness is RMS per slice rather than the peak — speech peaks near full scale
 * in nearly every slice longer than a syllable, which would draw a flat bar code.
 * The square-root curve then lifts the quiet parts so a whisper still shows.
 */
function waveformOf(path, label) {
  // Mono 16-bit at a low rate is plenty to measure loudness by, and keeps the
  // decoded buffer small: an hour of audio is under 60 MB.
  const pcm = execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-nostdin',
      '-i',
      path,
      '-map',
      '0:a:0',
      '-ac',
      '1',
      '-ar',
      String(WAVE_RATE),
      '-f',
      's16le',
      '-',
    ],
    { maxBuffer: 256 * 1024 * 1024 },
  )
  const samples = Math.floor(pcm.length / 2)
  if (samples === 0) fail(`${label} has no sound in it`)

  const levels = []
  for (let bar = 0; bar < WAVE_BARS; bar += 1) {
    const from = Math.floor((bar * samples) / WAVE_BARS)
    const to = Math.max(from + 1, Math.floor(((bar + 1) * samples) / WAVE_BARS))
    let sum = 0
    for (let i = from; i < to && i < samples; i += 1) sum += pcm.readInt16LE(i * 2) ** 2
    levels.push(Math.sqrt(sum / (to - from)))
  }

  const loudest = Math.max(...levels) || 1
  const round = (n) => Math.round(n * 100) / 100
  return {
    duration: round(samples / WAVE_RATE),
    peaks: levels.map((level) => round(Math.max(0.04, Math.sqrt(level / loudest)))),
  }
}

function output(key, value) {
  const file = process.env.GITHUB_OUTPUT
  if (file) appendFileSync(file, `${key}=${value}\n`)
}

async function main() {
  const title = env('ISSUE_TITLE', { required: false }).trim()
  const body = env('ISSUE_BODY', { required: false }).replace(/\r\n/g, '\n')
  const number = env('ISSUE_NUMBER')
  const date = jakartaDate(env('ISSUE_CREATED'))

  const slug = slugify(title) || `letter-${number}`
  const folder = `${date}-${slug}`

  const { text, attachments } = collectAttachments(body)

  // Build the whole letter somewhere disposable first. Only once every download
  // and conversion has worked does src/letters get touched, so a failure leaves
  // the repo exactly as it was rather than publishing half a letter.
  const staging = mkdtempSync(join(tmpdir(), 'letter-'))
  const staged = join(staging, folder)
  mkdirSync(staged, { recursive: true })

  let magick = null
  let photosFound = 0
  let photos = 0
  let voices = 0
  if (attachments.some((a) => a.kind !== 'photo')) requireFfmpeg()

  // In order, so 1.jpg and voice-1 are the first of each in the letter.
  for (const [index, attachment] of attachments.entries()) {
    const label = `attachment ${index + 1}`
    const { type, bytes } = await download(attachment.url, label)

    // A bare asset URL is whatever it turns out to be.
    const isPhoto =
      attachment.kind === 'photo' || (attachment.kind === 'unknown' && type.startsWith('image/'))

    if (isPhoto) {
      if (!type.startsWith('image/')) fail(`${label} is not an image (${type || 'no type'})`)
      photosFound += 1
      if (photos >= MAX_PHOTOS) continue // file stays null: the embed is dropped
      magick ??= magickBinary()
      photos += 1
      attachment.file = savePhoto(bytes, photos, staged, magick)
    } else {
      voices += 1
      attachment.file = saveVoice(bytes, voices, staged, label)
    }
  }

  // Each placeholder becomes an embed line on its own, so a voice note dropped
  // mid-sentence still gets a line of its own rather than splitting the words.
  const letter = text
    .replace(TOKEN, (_, index) => {
      const file = attachments[Number(index)].file
      return file ? `\n\n![](${file})\n\n` : ''
    })
    .replace(/<img\b[^>]*>/gi, '') // an <img> with no fetchable src at all
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (letter === '') fail('the issue body is empty — there is no letter to write')

  const frontmatter = ['---']
  if (title) frontmatter.push(`title: ${title.replace(/\n/g, ' ')}`)
  frontmatter.push(`date: ${date}`, `issue: ${number}`, '---', '')
  writeFileSync(join(staged, 'index.md'), `${frontmatter.join('\n')}\n${letter}\n`, 'utf8')

  // Replace rather than merge, so photos removed from the issue actually go away
  // instead of leaving a stale 3.jpg behind.
  mkdirSync(LETTERS_DIR, { recursive: true })
  const previous = findFolderForIssue(number)
  if (previous && previous !== folder) {
    rmSync(join(LETTERS_DIR, previous), { recursive: true, force: true })
    console.log(`sync-letter: renamed ${previous} -> ${folder}`)
  }
  const target = join(LETTERS_DIR, folder)
  rmSync(target, { recursive: true, force: true })
  renameSync(staged, target)
  rmSync(staging, { recursive: true, force: true })

  const files = readdirSync(target)
  console.log(
    `sync-letter: wrote ${folder} (${photos} photo(s) of ${photosFound} found, ` +
      `${voices} voice note(s); ${files.join(', ')})`,
  )

  output('letter_slug', folder)
  output('photo_count', String(photos))
  output('photos_found', String(photosFound))
  output('voice_count', String(voices))
}

if (!existsSync('src')) fail('run this from the repository root')

await main()
