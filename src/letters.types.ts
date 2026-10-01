// Type definitions for the letters in the mailbox, loaded by src/lib/letters.ts.
// Mirrors the config.ts / config.types.ts split: shapes here, data on disk.

export interface LetterPhoto {
  /** URL already resolved (and content-hashed) by Vite — do NOT pass it through asset(). */
  url: string
  /** Original filename, used as the alt-text fallback. */
  name: string
}

export interface LetterVoice {
  /** URL already resolved by Vite, like LetterPhoto's. Nothing is fetched until play. */
  url: string
  /** Original filename. Also the key that pairs it with its waveform .json. */
  name: string
  /** Seconds, measured by the sync workflow. Absent for a file dropped in by hand. */
  duration?: number
  /** Loudness bars between 0 and 1, from the same .json. Absent → decorative bars. */
  peaks?: number[]
}

/** One piece of a letter, in the order it was written. */
export type LetterBlock =
  /** A paragraph. Newlines within one are line breaks. */
  | { kind: 'text'; text: string }
  /**
   * Photos side by side. `trailing` is the group of photos the text never
   * placed — every photo of a letter written before photos could sit inline —
   * shown after the letter like a scrapbook page, as they always were.
   */
  | { kind: 'photos'; photos: LetterPhoto[]; trailing: boolean }
  | { kind: 'voice'; voice: LetterVoice }

export interface LetterEntry {
  /** Folder name. Doubles as the hash-route segment and the read-state key. */
  slug: string
  /** yyyy-mm-dd — from the folder-name prefix, or a frontmatter override. */
  date: string
  title?: string
  /** The issue this letter came from, when written by sync-letters.yml. */
  issue?: number
  /** Text, photos and voice notes, in the order they appear on the page. */
  blocks: LetterBlock[]
  counts: { paragraphs: number; photos: number; voices: number }
}
