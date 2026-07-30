// Type definitions for the letters in the mailbox, loaded by src/lib/letters.ts.
// Mirrors the config.ts / config.types.ts split: shapes here, data on disk.

export interface LetterPhoto {
  /** URL already resolved (and content-hashed) by Vite — do NOT pass it through asset(). */
  url: string
  /** Original filename, used as the alt-text fallback. */
  name: string
}

export interface LetterEntry {
  /** Folder name. Doubles as the hash-route segment and the read-state key. */
  slug: string
  /** yyyy-mm-dd — from the folder-name prefix, or a frontmatter override. */
  date: string
  title?: string
  /** The issue this letter came from, when written by sync-letters.yml. */
  issue?: number
  /** Body paragraphs, split on blank lines. Newlines within one are line breaks. */
  paragraphs: string[]
  /** At most MAX_PHOTOS, ordered by filename. */
  photos: LetterPhoto[]
}
