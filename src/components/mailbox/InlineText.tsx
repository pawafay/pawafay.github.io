import type { ReactNode } from 'react'

// The only markup a letter body understands: **bold**, *italic*, and the line
// breaks that were typed.
// Deliberately narrow, and deliberately element-based — letter text can arrive
// from a GitHub issue, so it is never handed to an HTML parser and never goes
// near dangerouslySetInnerHTML. Anything that isn't one of these two tokens is
// rendered as a plain string, which React escapes for us.
const TOKEN = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g

/** A letter paragraph with its inline emphasis turned into real elements. */
export function InlineText({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let cursor = 0
  let key = 0

  /**
   * Plain text, with every newline kept as a real break.
   *
   * Markdown would reflow these into one long line, and for a letter that is
   * simply wrong: these are written the way a note is written — one thought per
   * line — so a break that was typed is meant. Blank lines still open a new
   * paragraph (and its own fade-in) upstream in lib/letters.ts; this only covers
   * the single newlines inside one.
   */
  const pushText = (chunk: string) => {
    chunk.split('\n').forEach((line, i) => {
      if (i > 0) parts.push(<br key={key++} />)
      if (line !== '') parts.push(line)
    })
  }

  for (const match of text.matchAll(TOKEN)) {
    if (match.index > cursor) pushText(text.slice(cursor, match.index))
    parts.push(
      match[1] !== undefined ? (
        <strong key={key++}>{match[1]}</strong>
      ) : (
        <em key={key++}>{match[2]}</em>
      ),
    )
    cursor = match.index + match[0].length
  }

  if (cursor < text.length) pushText(text.slice(cursor))

  return <>{parts}</>
}
