// Finding the folder a given issue wrote. Shared by sync-letter.mjs (which
// rewrites it) and unpublish-letter.mjs (which removes it), so the two can never
// disagree about which folder belongs to which issue.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const LETTERS_DIR = resolve('src/letters')

/**
 * The folder written for this issue, located by the `issue:` key in its
 * frontmatter rather than by name — the folder name contains the title, so it
 * moves whenever the issue is retitled, but the issue number never does.
 *
 * Returns null when nothing was ever published for it.
 */
export function findFolderForIssue(issueNumber) {
  const number = String(issueNumber)
  if (!/^\d+$/.test(number)) throw new Error(`not an issue number: ${number}`)
  if (!existsSync(LETTERS_DIR)) return null

  for (const name of readdirSync(LETTERS_DIR)) {
    const index = join(LETTERS_DIR, name, 'index.md')
    if (!existsSync(index)) continue
    const frontmatter = readFileSync(index, 'utf8').split(/\n---/, 1)[0]
    // Anchored both ends so `issue: 1` never matches a letter from issue 12.
    if (new RegExp(`^issue:\\s*${number}\\s*$`, 'm').test(frontmatter)) return name
  }
  return null
}
