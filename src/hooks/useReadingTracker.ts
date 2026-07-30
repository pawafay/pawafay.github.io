import { useEffect } from 'react'
import type { RefObject } from 'react'
import { track } from '../lib/analytics'

/** Engaged seconds a letter needs, on top of reaching the end, to count as read. */
const READ_SECONDS = 15

/** How long after opening to measure the sheet — past the entrance animation. */
const SETTLE_MS = 900

/** Within this many pixels of the bottom counts as the bottom. */
const SLACK_PX = 4

/** maxPct at or above this counts as having reached the end. */
const END_PCT = 95

export interface ReadingSubject {
  /** A mailbox letter, or the one inside the closing envelope. */
  kind: 'mail' | 'greeting'
  slug: string
  title?: string
  paragraphCount: number
  photoCount: number
}

/**
 * Measures one sitting with one letter: how long it was actually looked at, and
 * how far down it got.
 *
 * Open and close come from this effect rather than from a click handler, because
 * MiniEnvelope is a bare <a href="#/mail/…"> — a deep link opens a letter with no
 * click at all. The effect is keyed on the slug, so going straight from one letter
 * to another closes the first and opens the second without remounting the DOM
 * (which would replay the entrance animation).
 *
 * `scrollRef` must point at the element that actually scrolls — the overlay
 * scroller in MailLetter, the paper in Letter.
 */
export function useReadingTracker(
  scrollRef: RefObject<HTMLElement | null>,
  subject: ReadingSubject,
): void {
  const { kind, slug, title, paragraphCount, photoCount } = subject

  useEffect(() => {
    const openedAt = Date.now()
    let engagedMs = 0
    let visibleSince = document.visibilityState === 'visible' ? performance.now() : null
    let maxPct = 0
    let ticking = false
    let sent = false

    const measure = () => {
      const el = scrollRef.current
      if (!el) return
      const { scrollTop, clientHeight, scrollHeight } = el
      // A letter that fits on one screen is read as far as it goes the moment it
      // opens: there is nothing to scroll, so a scroll-derived number would sit
      // at zero however long it is read for.
      const pct =
        scrollHeight <= clientHeight + SLACK_PX
          ? 100
          : ((scrollTop + clientHeight) / scrollHeight) * 100
      maxPct = Math.max(maxPct, Math.min(100, Math.round(pct)))
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        measure()
      })
    }

    const stopClock = () => {
      if (visibleSince === null) return
      engagedMs += performance.now() - visibleSince
      visibleSince = null
    }

    // Switching tabs or locking the phone is not reading — but it is not leaving
    // either, so the clock pauses instead of the sitting ending.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stopClock()
      else if (visibleSince === null) visibleSince = performance.now()
    }

    // Deliberately does not re-measure: on a letter→letter switch this cleanup
    // runs after the DOM already shows the *next* letter, whose geometry would be
    // credited to this one.
    const finish = (reason: 'close' | 'pagehide') => {
      if (sent) return
      sent = true
      stopClock()

      const engagedSeconds = Math.round(engagedMs / 1000)
      const reachedEnd = maxPct >= END_PCT

      track('letter_close', {
        letter_slug: slug,
        letter_kind: kind,
        engaged_seconds: engagedSeconds,
        total_seconds: Math.round((Date.now() - openedAt) / 1000),
        scroll_pct: maxPct,
        reached_end: reachedEnd,
        reason,
      })

      if (engagedSeconds >= READ_SECONDS && reachedEnd) {
        track('letter_read', {
          letter_slug: slug,
          letter_kind: kind,
          engaged_seconds: engagedSeconds,
        })
      }
    }

    // pagehide rather than visibilitychange: hidden happens constantly and mostly
    // comes back, while pagehide means this page really is going away — including
    // on iOS, where unload never fires.
    const onPageHide = () => finish('pagehide')

    track('letter_open', {
      letter_slug: slug,
      letter_title: title ?? '(untitled)',
      letter_kind: kind,
      paragraph_count: paragraphCount,
      photo_count: photoCount,
    })

    const settle = window.setTimeout(measure, SETTLE_MS)
    const el = scrollRef.current
    el?.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      window.clearTimeout(settle)
      el?.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      finish('close')
    }
  }, [scrollRef, kind, slug, title, paragraphCount, photoCount])
}
