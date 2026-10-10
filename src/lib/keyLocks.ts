// Questions that unlock the sketchbook.
//
// A GitHub key is 90-odd random characters nobody can remember, so a key can be
// locked behind the answers to a question or two instead ("your dog's name").
// scripts/lock-sketchbook-key.mjs encrypts the key with the answers and saves
// the result in src/sketchbook-keys.json, together with the questions and the
// name its pages are signed with. Answering here opens it again.
//
// Those locks ship inside the public site — questions included — so anyone can
// download them and try answers offline, as fast as their hardware allows. The
// slow key derivation below makes each guess cost something; how guessable the
// answers are decides the rest. See src/drawings/_FORMAT.md.
//
// Format, shared with the script — change the two together:
//   secret = each answer normalised (see normaliseAnswer), joined with "\n"
//   key    = PBKDF2-HMAC-SHA256(secret, salt, iterations) → 256 bits
//   lock   = AES-256-GCM(key, iv, GitHub key), auth tag appended (WebCrypto's layout)
//   salt, iv, data are base64.

import { cleanText, LIMITS } from './drawingFormat'
import { isTokenShaped } from './sketchStore'
import raw from '../sketchbook-keys.json'

const MAX_QUESTIONS = 4
const DEFAULT_QUESTIONS = ['Secret phrase']

interface Lock {
  name: string
  questions: string[]
  salt: Uint8Array<ArrayBuffer>
  iv: Uint8Array<ArrayBuffer>
  data: Uint8Array<ArrayBuffer>
  iterations: number
}

function fromBase64(value: unknown): Uint8Array<ArrayBuffer> | null {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function readQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) return DEFAULT_QUESTIONS
  const questions = value.map((q) => cleanText(q, 80)).filter(Boolean)
  return questions.length > 0 && questions.length <= MAX_QUESTIONS ? questions : DEFAULT_QUESTIONS
}

function readLocks(): Lock[] {
  const list = (raw as { locks?: unknown }).locks
  if (!Array.isArray(list)) return []
  return list.flatMap((item): Lock[] => {
    const entry = (item ?? {}) as Record<string, unknown>
    const name = cleanText(entry.name, LIMITS.by)
    const salt = fromBase64(entry.salt)
    const iv = fromBase64(entry.iv)
    const data = fromBase64(entry.data)
    const iterations = entry.iterations
    if (!name || !salt || !iv || !data || typeof iterations !== 'number' || iterations < 1) {
      return []
    }
    return [{ name, questions: readQuestions(entry.questions), salt, iv, data, iterations }]
  })
}

const LOCKS = readLocks()

/**
 * What the unlock sheet asks — the first lock's questions. Locks are tried
 * against the answers whatever their own questions, so in practice every lock
 * should ask the same ones; there is one today.
 */
export const lockQuestions: readonly string[] | null = LOCKS[0]?.questions ?? null

/**
 * An answer as it is actually used. Forgiving of what a phone keyboard does on
 * its own — a capital first letter, a stray space, an @ in front of a handle —
 * so it works however it's typed, as long as the word is right.
 */
export function normaliseAnswer(answer: string): string {
  return answer
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s@]+/g, '')
}

/** A GitHub key pasted as it is, rather than answers. */
export function looksLikeGithubKey(input: string): boolean {
  return /^(github_pat_|ghp_)/.test(input) && isTokenShaped(input)
}

async function open(secret: string, lock: Lock): Promise<string | null> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: lock.salt, iterations: lock.iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: lock.iv }, key, lock.data)
    return new TextDecoder().decode(plain)
  } catch {
    return null // wrong answers: GCM's tag doesn't check out
  }
}

/**
 * The key the answers open, and whose it is — or null when they open none.
 * Each lock costs one deliberately slow derivation (well under a second on a
 * phone), so this tries them one after another rather than all at once.
 */
export async function openWithAnswers(
  answers: readonly string[],
): Promise<{ token: string; name: string } | null> {
  const normalised = answers.map(normaliseAnswer)
  if (normalised.some((answer) => !answer)) return null
  if (typeof crypto === 'undefined' || !crypto.subtle) return null
  const secret = normalised.join('\n')
  for (const lock of LOCKS) {
    if (lock.questions.length !== normalised.length) continue
    const token = await open(secret, lock)
    if (token && isTokenShaped(token)) return { token, name: lock.name }
  }
  return null
}
