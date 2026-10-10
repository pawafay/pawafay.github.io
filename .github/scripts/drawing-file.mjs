// Finding the file a given issue wrote. Shared by sync-drawing.mjs (which
// rewrites it) and unpublish-drawing.mjs (which removes it), so the two can never
// disagree about which drawing belongs to which issue.

import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

export const DRAWINGS_DIR = resolve('src/drawings')

/** yyyy-mm-dd-<issue>.json — the only names sync-drawing.mjs ever writes. */
const FILE = /^\d{4}-\d{2}-\d{2}-(\d+)\.json$/

/**
 * Every file written for this issue — normally one, or none when nothing was
 * ever published for it. Matched on the number at the end of the name, so a
 * file someone dropped in by hand under any other name is never touched.
 */
export function findFilesForIssue(issueNumber) {
  const number = String(issueNumber)
  if (!/^\d+$/.test(number)) throw new Error(`not an issue number: ${number}`)
  if (!existsSync(DRAWINGS_DIR)) return []
  return readdirSync(DRAWINGS_DIR).filter((name) => FILE.exec(name)?.[1] === number)
}
