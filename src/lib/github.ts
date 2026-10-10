// Sending a page to the sketchbook: one call to the GitHub REST API, straight
// from the browser (api.github.com answers CORS for any origin).
//
// The page goes in as an issue labelled `gambar`, and sync-drawings.yml does the
// rest — checks it, commits it, deploys it. So the key on this device only ever
// needs to open issues: it cannot touch the site's code. Making those keys is
// covered in src/drawings/_FORMAT.md.

import { config } from '../config'
import type { DrawingData } from '../drawings.types'

const API = 'https://api.github.com'

/** Must match the label sync-drawings.yml listens for. */
export const SKETCH_LABEL = 'gambar'

/** GitHub refuses an issue body over 65,536 characters; leave room for the prose. */
const MAX_PAYLOAD = 62_000

const REPO = /^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})$/

export const sketchRepo: { owner: string; name: string } | null = (() => {
  const matched = REPO.exec(config.sketchbookRepo?.trim() ?? '')
  return matched ? { owner: matched[1], name: matched[2] } : null
})()

export type SendFailure =
  /** 401 — expired, cancelled, or never a key at all. */
  | { kind: 'bad-key' }
  /** The key works, but isn't the repo owner's, so the workflow would turn it away. */
  | { kind: 'wrong-account'; login: string }
  /** 403/404 — the key can't open issues on this repo. */
  | { kind: 'no-access' }
  | { kind: 'too-big' }
  /** The issue went up, but without its label — so nothing will publish it. */
  | { kind: 'no-label'; issue: number }
  | { kind: 'offline' }
  | { kind: 'other'; status: number }

function headers(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
  }
}

async function call(token: string, path: string, init: RequestInit = {}) {
  try {
    return await fetch(`${API}${path}`, {
      ...init,
      headers: { ...headers(token), ...init.headers },
      cache: 'no-store',
      // The key goes in a header, never a URL; and no referrer for good measure.
      referrerPolicy: 'no-referrer',
    })
  } catch {
    return null
  }
}

/**
 * Whether a key can be used here, checked before it is saved on the device.
 *
 * GitHub has no way to ask a token what it is *allowed* to do short of trying,
 * so this checks the two things that can be checked: that the key is alive, and
 * that it belongs to the repo owner — a key from any other account would open
 * issues the workflow is built to refuse. Missing Issues permission only shows
 * up on the first send, and is reported as 'no-access' then.
 */
export async function checkKey(token: string): Promise<{ ok: true } | SendFailure> {
  if (!sketchRepo) return { kind: 'other', status: 0 }
  const response = await call(token, '/user')
  if (!response) return { kind: 'offline' }
  if (response.status === 401) return { kind: 'bad-key' }
  if (!response.ok) return { kind: 'other', status: response.status }
  const { login } = (await response.json().catch(() => ({}))) as { login?: unknown }
  if (typeof login !== 'string') return { kind: 'other', status: response.status }
  if (login.toLowerCase() !== sketchRepo.owner.toLowerCase()) {
    return { kind: 'wrong-account', login }
  }
  return { ok: true }
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

/**
 * A stroke's points as steps rather than positions: the first point as it is,
 * then each one as the difference from the one before. Pen strokes move a few
 * units at a time, so this turns a page of three-digit numbers into a page of
 * small, repetitive ones — about a third of the size once deflated, which is
 * what lets a full page (LIMITS.points) fit under the issue body's ceiling.
 * sync-drawing.mjs adds them back up.
 */
function toSteps(points: readonly number[]): number[] {
  return points.map((value, i) => (i < 3 ? value : value - points[i - 3]))
}

/**
 * The page, packed for the issue body: points as steps, then deflated when the
 * browser can (every current one can). sync-drawing.mjs reads both forms.
 */
async function pack(drawing: DrawingData): Promise<{ format: 'deflate' | 'plain'; data: string }> {
  const wire = {
    ...drawing,
    strokes: drawing.strokes.map((stroke) => ({ ...stroke, points: toSteps(stroke.points) })),
  }
  const json = new TextEncoder().encode(JSON.stringify(wire))
  if (typeof CompressionStream === 'undefined') return { format: 'plain', data: toBase64(json) }
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  const packed = new Uint8Array(await new Response(stream).arrayBuffer())
  return { format: 'deflate', data: toBase64(packed) }
}

function issueBody(drawing: DrawingData, format: string, data: string): string {
  const lines = data.match(/.{1,100}/g) ?? []
  return [
    `A page from the sketchbook, drawn by ${drawing.by || 'someone'} on the site.`,
    '',
    `It is pinned up by itself. Take the \`${SKETCH_LABEL}\` label off to take it down again.`,
    '',
    `\`\`\`drawing ${format}`,
    ...lines,
    '```',
    '',
  ].join('\n')
}

/**
 * Sends a finished page. Resolves with the new issue's number and when it was
 * opened (the workflow dates the drawing by that), or with why it didn't go.
 */
export async function sendDrawing(
  token: string,
  drawing: DrawingData,
): Promise<{ ok: true; issue: number; createdAt: string } | SendFailure> {
  if (!sketchRepo) return { kind: 'other', status: 0 }

  const { format, data } = await pack(drawing)
  if (data.length > MAX_PAYLOAD) return { kind: 'too-big' }

  const title = drawing.caption
    ? `🖍️ ${drawing.caption} — by ${drawing.by || 'someone'}`
    : `🖍️ A drawing by ${drawing.by || 'someone'}`

  const response = await call(token, `/repos/${sketchRepo.owner}/${sketchRepo.name}/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      body: issueBody(drawing, format, data),
      labels: [SKETCH_LABEL],
    }),
  })

  if (!response) return { kind: 'offline' }
  if (response.status === 401) return { kind: 'bad-key' }
  if (response.status === 403 || response.status === 404) return { kind: 'no-access' }
  if (response.status === 422) return { kind: 'too-big' }
  if (!response.ok) return { kind: 'other', status: response.status }

  const issue = (await response.json().catch(() => ({}))) as {
    number?: unknown
    created_at?: unknown
    labels?: { name?: unknown }[]
  }
  if (typeof issue.number !== 'number') return { kind: 'other', status: response.status }
  // GitHub drops labels it won't apply instead of failing the request.
  if (!issue.labels?.some((label) => label.name === SKETCH_LABEL)) {
    return { kind: 'no-label', issue: issue.number }
  }
  const createdAt =
    typeof issue.created_at === 'string' ? issue.created_at : new Date().toISOString()
  return { ok: true, issue: issue.number, createdAt }
}

/** The yyyy-mm-dd sync-drawing.mjs will give it: the day in Asia/Jakarta. */
export function jakartaDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}
