// Lock a GitHub key behind a question or two, for the sketchbook.
//
//   bun run lock-key        (or: node scripts/lock-sketchbook-key.mjs)
//
// Asks for the name their pages are signed with, the GitHub key, then each
// question as the site should ask it ("Your dog's name") and its answer. The
// key and answers are never shown on screen. Saves the locked key, the questions
// and the name into src/sketchbook-keys.json, replacing any earlier lock under
// the same name. Commit and push that file, and the questions work on the site.
//
// What you type stays on this computer. The one exception is the key itself,
// shown to GitHub to check it works, is on the right account and can post to
// the repo — which also makes the sketchbook's label if it isn't there yet.
//
// Format — mirrored in src/lib/keyLocks.ts, change the two together:
//   secret = each answer normalised, joined with "\n"
//   key   = PBKDF2-HMAC-SHA256(secret, salt, iterations) → 256 bits
//   lock   = AES-256-GCM(key, iv, GitHub key), auth tag appended
//   salt, iv, data are base64.

import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

const FILE = new URL('../src/sketchbook-keys.json', import.meta.url)
const CONFIG = new URL('../src/config.ts', import.meta.url)

/** OWASP's 2023 floor for PBKDF2-HMAC-SHA256: well under a second on a phone. */
const ITERATIONS = 600_000
/** Must match SKETCH_LABEL in src/lib/github.ts and the label sync-drawings.yml waits for. */
const LABEL = 'gambar'
const MIN_SECRET = 6
const MAX_NAME = 40
const MAX_QUESTION = 80
const MAX_QUESTIONS = 4

const { stdin, stdout } = process

// ── same rules as the site ───────────────────────────────────────────────────

/** Mirrors normaliseAnswer in src/lib/keyLocks.ts. */
const normalise = (answer) =>
  answer
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s@]+/g, '')
const isGithubKey = (token) => /^(github_pat_|ghp_)[A-Za-z0-9_]{16,251}$/.test(token)

// ── asking ───────────────────────────────────────────────────────────────────

// A real terminal can hide what is typed; a pipe can't. Git Bash's own window
// (mintty) counts as a pipe, so it gets a warning instead.
const lines = stdin.isTTY ? null : createInterface({ input: stdin })[Symbol.asyncIterator]()

function ask(question, { hidden = false } = {}) {
  if (lines) {
    stdout.write(question)
    return lines.next().then(({ value }) => value ?? '')
  }

  return new Promise((resolve) => {
    stdout.write(question)
    let value = ''
    const onData = (chunk) => {
      // Arrow keys and the like arrive as escape sequences; none of them belong
      // in a key or an answer.
      if (chunk.startsWith('\u001b')) return
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.off('data', onData)
          stdin.setRawMode(false)
          stdin.pause()
          stdout.write(hidden ? `  (${Array.from(value).length} characters)\n` : '\n')
          return resolve(value)
        }
        if (ch === '\u0003') {
          stdin.setRawMode(false)
          stdout.write('\n')
          process.exit(130)
        }
        if (ch === '\u007f' || ch === '\b') {
          if (!value) continue
          value = Array.from(value).slice(0, -1).join('')
          if (!hidden) stdout.write('\b \b')
          continue
        }
        if (ch < ' ') continue
        value += ch
        if (!hidden) stdout.write(ch)
      }
    }
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    stdin.resume()
    stdin.on('data', onData)
  })
}

function fail(message) {
  console.error(`\n✗ ${message}`)
  process.exit(1)
}

// ── locking ──────────────────────────────────────────────────────────────────

function lock(secret, token) {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = pbkdf2Sync(secret, salt, ITERATIONS, 32, 'sha256')
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(token, 'utf8'), cipher.final(), cipher.getAuthTag()])
  return {
    iterations: ITERATIONS,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    data: data.toString('base64'),
  }
}

/** Whether `secret` opens an existing lock — two people can't share answers. */
function opens(secret, entry) {
  try {
    const data = Buffer.from(entry.data, 'base64')
    const key = pbkdf2Sync(
      secret,
      Buffer.from(entry.salt, 'base64'),
      entry.iterations,
      32,
      'sha256',
    )
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(entry.iv, 'base64'))
    decipher.setAuthTag(data.subarray(-16))
    decipher.update(data.subarray(0, -16))
    decipher.final()
    return true
  } catch {
    return false
  }
}

// ── the run ──────────────────────────────────────────────────────────────────

const repo = /sketchbookRepo:\s*'([^']+)'/.exec(readFileSync(CONFIG, 'utf8'))?.[1]
const owner = repo?.split('/')[0]
if (!owner) fail('No sketchbookRepo in src/config.ts.')

const saved = JSON.parse(readFileSync(FILE, 'utf8'))
const locks = Array.isArray(saved.locks) ? saved.locks : []

console.log('Lock a GitHub key behind a question or two, for the sketchbook.')
if (lines) {
  console.log('\n! This terminal will SHOW what you type. To keep the key and answers')
  console.log('  hidden, run this from PowerShell or Windows Terminal instead.')
}
console.log('')

const name = Array.from((await ask('Name to sign their pages with: ')).trim())
  .slice(0, MAX_NAME)
  .join('')
if (!name) fail('A name is needed — it is how their pages are signed.')

const token = (await ask('GitHub key (hidden): ', { hidden: true })).trim()
if (!isGithubKey(token)) fail('That isn’t a GitHub key. It should start with github_pat_.')

console.log('\nNow the questions, worded the way the site should ask them. Capitals,')
console.log('spaces and @ in the answers are ignored, so they work however a phone')
console.log('keyboard types them.')

const questions = []
const answers = []
while (questions.length < MAX_QUESTIONS) {
  const n = questions.length + 1
  const hint = n === 1 ? ' (e.g. Your dog’s name)' : ' (leave empty to finish)'
  const question = Array.from((await ask(`\nQuestion ${n}${hint}: `)).trim())
    .slice(0, MAX_QUESTION)
    .join('')
  if (!question) break
  const answer = normalise(await ask('  Answer (hidden): ', { hidden: true }))
  if (!answer) fail('An answer can’t be empty.')
  if (normalise(await ask('  Same answer again (hidden): ', { hidden: true })) !== answer) {
    fail('The two answers are different. Nothing was saved.')
  }
  questions.push(question)
  answers.push(answer)
}
if (questions.length === 0) fail('At least one question is needed.')

const secret = answers.join('\n')
if (secret.length < MIN_SECRET) {
  fail(`Too short — the answers need at least ${MIN_SECRET} characters between them.`)
}

const clash = locks.find(
  (entry) => entry.name.toLowerCase() !== name.toLowerCase() && opens(secret, entry),
)
if (clash) fail(`Those answers already open ${clash.name}’s key. Pick other ones.`)

// ── checking the key against the real thing ──────────────────────────────────

const api = (path, init = {}) =>
  fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

stdout.write('\nChecking the key with GitHub… ')
let user
try {
  user = await api('/user')
} catch (error) {
  fail(`Couldn’t reach GitHub (${error.message}). Nothing was saved — try again online.`)
}
if (user.status === 401) fail('GitHub doesn’t accept this key — expired, or copied wrong?')
if (!user.ok) fail(`GitHub answered ${user.status}. Nothing was saved.`)
const { login } = await user.json()
if (String(login).toLowerCase() !== owner.toLowerCase()) {
  fail(`This key belongs to @${login}. Sketchbook keys must be made on @${owner}.`)
}

// The one thing a key-creation link can't pre-fill is which repo the key
// reaches — so prove it can write issues there, now rather than on the first
// drawing. Making sure the sketchbook's label exists takes exactly that
// permission, and the label is needed anyway (same one ensureLabel in
// src/lib/github.ts makes).
const labels = `/repos/${repo}/labels`
const label = { name: LABEL, color: 'f2c14e', description: 'a page from the sketchbook' }
const found = await api(`${labels}/${LABEL}`)
const proof =
  found.status === 404
    ? await api(labels, { method: 'POST', body: JSON.stringify(label) })
    : await api(`${labels}/${LABEL}`, { method: 'PATCH', body: JSON.stringify(label) })
if (proof.status === 403 || proof.status === 404) {
  fail(
    `This key can’t post to ${repo}. On GitHub, edit the key: Repository access → ` +
      `Only select repositories → ${repo}, and Permissions → Issues → Read and write.`,
  )
}
if (!proof.ok) fail(`GitHub answered ${proof.status} while checking the key. Nothing was saved.`)
console.log(`ok — @${login}, and it can post to ${repo}.`)

const kept = locks.filter((entry) => entry.name.toLowerCase() !== name.toLowerCase())
const replaced = kept.length !== locks.length
kept.push({ name, questions, ...lock(secret, token) })
writeFileSync(FILE, `${JSON.stringify({ v: 1, locks: kept }, null, 2)}\n`)

console.log(`\n✓ ${replaced ? 'Replaced' : 'Saved'} ${name}’s lock in src/sketchbook-keys.json:`)
for (const question of questions) console.log(`    · ${question}`)
console.log('  Commit and push that file; the questions work once the site has deployed.')
