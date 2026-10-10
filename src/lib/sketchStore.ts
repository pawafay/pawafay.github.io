// What this device remembers about the sketchbook:
//
//   * the key that lets it send drawings, and the name they are signed with;
//   * the page being drawn, so a stray swipe-back or a locked phone loses nothing;
//   * pages it has sent that the deployed site doesn't have yet, so they show up
//     straight away instead of a minute later, after the next deploy.
//
// All of it lives in localStorage, readable by any page on this origin. For a
// <login>.github.io site that means every Pages site on the account — fine while
// this is the only one, and worth knowing before adding another. See
// src/drawings/_FORMAT.md.

import { useSyncExternalStore } from 'react'
import type { DrawingData, DrawingStroke } from '../drawings.types'
import { cleanDrawing, cleanStrokes, cleanText, LIMITS } from './drawingFormat'

// Namespaced and versioned like the mailbox's 'kotak-pos:read:v1'.
const KEY_KEY = 'sketchbook:key:v1'
const DRAFT_KEY = 'sketchbook:draft:v1'
const SENT_KEY = 'sketchbook:sent:v1'

/** A sent page is given up on after this long — its issue will say why. */
const SENT_TTL_MS = 3 * 24 * 60 * 60 * 1000

interface Stored<T> {
  get(): T
  set(next: T | null): void
  use(): T
}

/**
 * One localStorage key as a tiny external store. get() hands back the same
 * object until the stored string changes, which is what useSyncExternalStore
 * needs; the `storage` event keeps two open tabs in step. When storage is
 * blocked or full it carries on in memory, so the page at least works until
 * it is closed.
 */
function stored<T>(key: string, parse: (raw: unknown) => T | null, empty: T): Stored<T> {
  const listeners = new Set<() => void>()
  let inMemory = false
  let memory: string | null = null
  let lastRaw: string | null | undefined
  let lastValue = empty

  const readRaw = (): string | null => {
    if (inMemory) return memory
    try {
      return window.localStorage.getItem(key)
    } catch {
      inMemory = true
      return memory
    }
  }

  const get = (): T => {
    const raw = readRaw()
    if (raw === lastRaw) return lastValue
    lastRaw = raw
    try {
      lastValue = raw === null ? empty : (parse(JSON.parse(raw)) ?? empty)
    } catch {
      lastValue = empty
    }
    return lastValue
  }

  const set = (next: T | null): void => {
    const raw = next === null ? null : JSON.stringify(next)
    memory = raw
    if (!inMemory) {
      try {
        if (raw === null) window.localStorage.removeItem(key)
        else window.localStorage.setItem(key, raw)
      } catch {
        inMemory = true
      }
    }
    for (const listener of listeners) listener()
  }

  const subscribe = (onChange: () => void) => {
    listeners.add(onChange)
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) onChange()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(onChange)
      window.removeEventListener('storage', onStorage)
    }
  }

  return { get, set, use: () => useSyncExternalStore(subscribe, get, () => empty) }
}

// ── the key ──────────────────────────────────────────────────────────────────

export interface SketchKey {
  token: string
  /** How this device's drawings are signed. */
  name: string
}

/** No whitespace, nothing that could break out of a header. */
const TOKEN = /^[A-Za-z0-9_]{20,255}$/

export function isTokenShaped(token: string): boolean {
  return TOKEN.test(token)
}

export const keyStore = stored<SketchKey | null>(
  KEY_KEY,
  (raw) => {
    const { token, name } = (raw ?? {}) as Record<string, unknown>
    if (typeof token !== 'string' || !isTokenShaped(token)) return null
    return { token, name: cleanText(name, LIMITS.by) }
  },
  null,
)

// ── the page being drawn ─────────────────────────────────────────────────────

const NO_STROKES: DrawingStroke[] = []

export const draftStore = stored<DrawingStroke[]>(DRAFT_KEY, cleanStrokes, NO_STROKES)

// ── pages sent, not yet deployed ─────────────────────────────────────────────

export interface SentPage {
  issue: number
  /** The day its issue was opened, in Asia/Jakarta — as the workflow will date it. */
  date: string
  sentAt: number
  drawing: DrawingData
}

const NONE_SENT: SentPage[] = []

export const sentStore = stored<SentPage[]>(
  SENT_KEY,
  (raw) => {
    if (!Array.isArray(raw)) return null
    return raw.flatMap((item): SentPage[] => {
      const { issue, date, sentAt, drawing } = (item ?? {}) as Record<string, unknown>
      const clean = cleanDrawing(drawing)
      if (typeof issue !== 'number' || typeof date !== 'string' || typeof sentAt !== 'number') {
        return []
      }
      return clean ? [{ issue, date, sentAt, drawing: clean }] : []
    })
  },
  NONE_SENT,
)

/** Where a sent page will be once it is deployed: yyyy-mm-dd-<issue>. */
export function publishedIdOf(page: SentPage): string {
  return `${page.date}-${page.issue}`
}

export function sentIdOf(page: SentPage): string {
  return `sent-${page.issue}`
}

/** Drops the sent pages the site now has for real, and ones long given up on. */
export function pruneSent(publishedIds: ReadonlySet<string>): void {
  const sent = sentStore.get()
  const now = Date.now()
  const keep = sent.filter(
    (page) => !publishedIds.has(publishedIdOf(page)) && now - page.sentAt < SENT_TTL_MS,
  )
  if (keep.length !== sent.length) sentStore.set(keep.length > 0 ? keep : null)
}
