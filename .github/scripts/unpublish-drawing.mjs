// Take a drawing back down, when the `gambar` label is removed from its issue.
//
// Like unpublish-letter.mjs, this removes it from the SITE only. The repo is
// public, so the drawing stays retrievable in git history and in the issue.

import { appendFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { DRAWINGS_DIR, findFilesForIssue } from './drawing-file.mjs'

function output(key, value) {
  const file = process.env.GITHUB_OUTPUT
  if (file) appendFileSync(file, `${key}=${value}\n`)
}

const number = process.env.ISSUE_NUMBER
if (!number) {
  console.error('unpublish-drawing: ISSUE_NUMBER is not set')
  process.exit(1)
}

const files = findFilesForIssue(number)

if (files.length === 0) {
  console.log(`unpublish-drawing: no drawing on the site for issue #${number}`)
  output('removed', 'false')
  process.exit(0)
}

for (const name of files) {
  rmSync(join(DRAWINGS_DIR, name), { force: true })
  console.log(`unpublish-drawing: removed ${name}`)
}

output('removed', 'true')
