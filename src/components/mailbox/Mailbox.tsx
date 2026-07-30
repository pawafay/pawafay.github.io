import { useCallback, useEffect, useRef } from 'react'
import { useHashRoute } from '../../hooks/useHashRoute'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { findLetter, letterProblems, letters } from '../../lib/letters'
import { clearHashRoute, parseMailSlug } from '../../lib/routes'
import { MiniEnvelope } from './MiniEnvelope'
import { MailLetter } from './MailLetter'
import './Mailbox.css'

// Namespaced so a future key can't collide, versioned so a shape change is a
// one-line bump rather than a migration.
const READ_KEY = 'kotak-pos:read:v1'

/** slug → the ms timestamp it was first opened at. */
type ReadMap = Record<string, number>

/** The rack of letters at the foot of the party, and whichever one is open. */
export function Mailbox() {
  const activeSlug = parseMailSlug(useHashRoute())
  const active = findLetter(activeSlug)
  const [read, setRead] = useLocalStorage<ReadMap>(READ_KEY, {})

  const rackRef = useRef<HTMLDivElement>(null)
  // Whether *this* session pushed the history entry for the open letter. A deep
  // link didn't, so there would be nothing to go back to.
  const openedHere = useRef(false)
  const previousSlug = useRef<string | null>(activeSlug)
  const lastOpenedSlug = useRef<string | null>(null)

  useEffect(() => {
    if (previousSlug.current === null && activeSlug !== null) openedHere.current = true
    if (activeSlug === null) openedHere.current = false
    previousSlug.current = activeSlug
  }, [activeSlug])

  const close = useCallback(() => {
    if (openedHere.current) window.history.back()
    else clearHashRoute()
  }, [])

  // A shared link to a letter that has since been deleted shouldn't strand the
  // reader on a blank hash.
  useEffect(() => {
    if (activeSlug && !active) close()
  }, [activeSlug, active, close])

  // Mark read on *route*, not on click, so a deep link counts as reading too.
  useEffect(() => {
    if (!active || read[active.slug]) return
    // Since we're writing anyway, drop slugs that no longer exist so storage
    // can't grow forever as letters come and go.
    const next: ReadMap = {}
    for (const letter of letters) {
      const at = letter.slug === active.slug ? Date.now() : read[letter.slug]
      if (at) next[letter.slug] = at
    }
    setRead(next)
  }, [active, read, setRead])

  // Hand focus back to the envelope the reader came from.
  useEffect(() => {
    if (activeSlug) {
      lastOpenedSlug.current = activeSlug
      return
    }
    const slug = lastOpenedSlug.current
    if (!slug) return
    lastOpenedSlug.current = null
    rackRef.current?.querySelector<HTMLElement>(`[data-slug="${CSS.escape(slug)}"]`)?.focus()
  }, [activeSlug])

  const problems = import.meta.env.DEV ? letterProblems : []
  if (letters.length === 0 && problems.length === 0) return null

  const unread = letters.reduce((n, letter) => (read[letter.slug] ? n : n + 1), 0)

  return (
    <section className="mailbox" aria-labelledby="mailbox-title">
      <header className="mailbox__head">
        <h2 className="mailbox__title" id="mailbox-title">
          the mailbox
        </h2>
        <p className="mailbox__count">
          {unread > 0 ? (
            <span className="mailbox__badge">{unread} unread</span>
          ) : (
            <span className="mailbox__hint">all read — for now</span>
          )}
        </p>
      </header>

      {problems.length > 0 && (
        <p className="mailbox__problems" role="status">
          <strong>Not shipped:</strong> {problems.join(' · ')}
        </p>
      )}

      <div className="mailbox__rack" ref={rackRef}>
        {letters.map((letter, i) => (
          <MiniEnvelope
            key={letter.slug}
            slug={letter.slug}
            date={letter.date}
            title={letter.title}
            read={Boolean(read[letter.slug])}
            index={i}
          />
        ))}
      </div>

      {active && <MailLetter letter={active} onClose={close} />}
    </section>
  )
}
