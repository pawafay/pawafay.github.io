import type { ReactNode } from 'react'

// The only markup a letter body understands: **bold** and *italic*.
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

  for (const match of text.matchAll(TOKEN)) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index))
    parts.push(
      match[1] !== undefined ? (
        <strong key={key++}>{match[1]}</strong>
      ) : (
        <em key={key++}>{match[2]}</em>
      ),
    )
    cursor = match.index + match[0].length
  }

  if (cursor < text.length) parts.push(text.slice(cursor))

  return <>{parts}</>
}
