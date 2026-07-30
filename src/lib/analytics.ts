// Google Analytics 4, wired by hand instead of pasting the <head> snippet, so the
// measurement ID lives in exactly one place: config.analyticsId. Leave that empty
// and every function here is a no-op — no script, no cookie, no request.
//
// Everything recorded is anonymous. The one identifier is a UUID minted by this
// browser and kept in localStorage; nothing is ever typed by, or asked of, a
// visitor. It exists only so "one person, seven visits" can be told apart from
// "seven people, one visit each" — which the raw hit count cannot do.

import { config } from '../config'
import { parseMailSlug } from './routes'

/** GA4 rejects nested objects, so event params are one level of scalars. */
export type EventParams = Record<string, string | number | boolean | undefined>

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

// The hash the page was *opened* with, captured at module load — before React
// mounts and before any route change can overwrite it. This is what tells a
// shared letter link apart from someone who browsed in from the mailbox.
const ENTRY_MAIL_SLUG = parseMailSlug(window.location.hash)

// Namespaced and versioned like 'kotak-pos:read:v1' in Mailbox.tsx.
const VISITOR_KEY = 'kotak-pos:visitor:v1'

/** A visit ends after this much away — GA4's own session timeout, so the two agree. */
const SESSION_GAP_MS = 30 * 60 * 1000

interface Visitor {
  id: string
  /** How many separate visits this browser has made, this one included. */
  visits: number
  firstSeen: number
  lastSeen: number
}

/**
 * 'off'  — no measurement ID configured; nothing happens at all.
 * 'log'  — dev: events go to the console so they can be checked, never to Google.
 * 'send' — production build: events go to GA4.
 */
type Mode = 'off' | 'log' | 'send'

let mode: Mode = 'off'
let visitCount = 0

function newId(): string {
  // randomUUID needs a secure context; http:// LAN testing has to fall back.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `v-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

/** The stored visitor, or null when absent, unreadable or the wrong shape. */
function readVisitor(): Visitor | null {
  try {
    const raw = window.localStorage.getItem(VISITOR_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Visitor>
    if (typeof parsed.id !== 'string' || typeof parsed.visits !== 'number') return null
    return {
      id: parsed.id,
      visits: parsed.visits,
      firstSeen: typeof parsed.firstSeen === 'number' ? parsed.firstSeen : 0,
      lastSeen: typeof parsed.lastSeen === 'number' ? parsed.lastSeen : 0,
    }
  } catch {
    // Private mode, blocked storage, or corrupt JSON — treat as a new visitor.
    return null
  }
}

/** Bumps the visit counter if enough time has passed, and persists the result. */
function touchVisitor(): Visitor {
  const now = Date.now()
  const stored = readVisitor()
  // A refresh or a re-open minutes later is the same visit; tomorrow is a new one.
  const visitor: Visitor = stored
    ? {
        ...stored,
        visits: stored.visits + (now - stored.lastSeen > SESSION_GAP_MS ? 1 : 0),
        lastSeen: now,
      }
    : { id: newId(), visits: 1, firstSeen: now, lastSeen: now }

  try {
    window.localStorage.setItem(VISITOR_KEY, JSON.stringify(visitor))
  } catch {
    // Storage unavailable — the id simply won't outlive this tab.
  }
  return visitor
}

/**
 * Loads gtag.js and reports the visit. Called from main.tsx rather than from any
 * mailbox code, because everything under PartyScene is a lazy chunk: importing
 * from there would delay the page_view until the party mounts.
 */
export function initAnalytics(): void {
  const id = config.analyticsId?.trim()
  if (!id) return

  const visitor = touchVisitor()
  visitCount = visitor.visits
  mode = import.meta.env.DEV ? 'log' : 'send'

  if (mode === 'send') {
    window.dataLayer = window.dataLayer ?? []
    window.gtag = function gtag() {
      // The official snippet pushes the `arguments` object itself, not an array —
      // gtag.js reads what it finds on the queue, so stay byte-compatible with it.
      window.dataLayer?.push(arguments)
    }

    const tag = document.createElement('script')
    tag.async = true
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
    document.head.appendChild(tag)

    window.gtag('js', new Date())
    // send_page_view: false because we send our own below. Left on, gtag.js would
    // also count hash-route changes as page views and inflate the visit numbers.
    window.gtag('config', id, { send_page_view: false })
    window.gtag('set', 'user_id', visitor.id)
    window.gtag('set', 'user_properties', {
      visitor_id: visitor.id,
      visit_count: String(visitor.visits),
    })
  }

  track('page_view', {
    entry_slug: ENTRY_MAIL_SLUG ?? '(none)',
    deep_link: ENTRY_MAIL_SLUG !== null,
  })
}

/** Sends one GA4 event. Silent unless initAnalytics() found a measurement ID. */
export function track(name: string, params: EventParams = {}): void {
  if (mode === 'off') return
  const payload = { ...params, visit_count: visitCount }
  if (mode === 'log') {
    console.debug('[ga]', name, payload)
    return
  }
  window.gtag?.('event', name, payload)
}
