// Take a letter back down, when the `surat` label is removed from its issue.
//
// Only ever deletes a folder this workflow wrote — it is located by the `issue:`
// key in the frontmatter, so a hand-written letter (which has no such key) can
// never be removed by an issue event.
//
// This removes the letter from the SITE. It does not remove it from git history,
// and it cannot: the repo is public, so the text and photos stay retrievable in
// old commits forever. Same for the issue and its uploaded images on GitHub.

import { appendFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { LETTERS_DIR, findFolderForIssue } from './letter-folder.mjs'

function output(key, value) {
  const file = process.env.GITHUB_OUTPUT
  if (file) appendFileSync(file, `${key}=${value}\n`)
}

const number = process.env.ISSUE_NUMBER
if (!number) {
  console.error('unpublish-letter: ISSUE_NUMBER is not set')
  process.exit(1)
}

const folder = findFolderForIssue(number)

if (!folder) {
  // Nothing was ever published for this issue, or it is already gone. Removing a
  // label that was never used to publish anything is not an error.
  console.log(`unpublish-letter: no letter on the site for issue #${number}`)
  output('removed', 'false')
  process.exit(0)
}

rmSync(join(LETTERS_DIR, folder), { recursive: true, force: true })
console.log(`unpublish-letter: removed ${folder}`)

output('removed', 'true')
output('letter_slug', folder)
