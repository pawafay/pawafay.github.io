import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { DrawingStroke } from '../../drawings.types'
import { useDialogTrap } from '../../hooks/useDialogTrap'
import { useHashRoute } from '../../hooks/useHashRoute'
import { useReducedMotionPref } from '../../hooks/useReducedMotionPref'
import { seededRotation } from '../../hooks/useSeededRotation'
import { track } from '../../lib/analytics'
import type { DrawingRef } from '../../lib/drawings'
import {
  drawingRefs,
  findDrawingRef,
  formatDay,
  publishedIds,
  stillDrying,
} from '../../lib/drawings'
import { sketchRepo } from '../../lib/github'
import {
  NEW_PAGE_HREF,
  SKETCHBOOK_HREF,
  clearHashRoute,
  drawingHref,
  parseSketchRoute,
  replaceHashRoute,
} from '../../lib/routes'
import { draftStore, keyStore, pruneSent, sentIdOf, sentStore } from '../../lib/sketchStore'
import type { SentPage } from '../../lib/sketchStore'
import { Easel } from './Easel'
import { PageCanvas } from './PageCanvas'
import { PencilIcon } from './icons'
import { ReplayCanvas } from './ReplayCanvas'
import { KeySheet } from './Sheets'
import { usePublishedDrawing } from './usePublishedDrawing'
import './Sketchbook.css'

/** Past this many, tiles stop waiting their turn to drop in. */
const STAGGER_CAP = 12

/**
 * The sketchbook, wherever the hash puts it: the book of pages, one page, or a
 * blank page being drawn. Renders nothing for any other route — it is mounted
 * for the whole party, the way the mailbox keeps its open letter.
 *
 * It remembers how it was reached, so "back" is a real history step whenever
 * there is one (the Android back button agrees with it) and a replace when the
 * page was opened from a link and there is nowhere to go back to.
 */
export function Sketchbook() {
  const hash = useHashRoute()
  const route = parseSketchRoute(hash)
  const reduced = useReducedMotionPref()
  const [notice, setNotice] = useState<string | null>(null)

  const previous = useRef(route)
  /** The sketchbook was opened from the party in this session. */
  const fromParty = useRef(false)
  /** The page or blank page on screen was opened from the book. */
  const fromBook = useRef(false)

  useEffect(() => {
    const now = parseSketchRoute(hash)
    const before = previous.current
    if (!now) {
      fromParty.current = false
      fromBook.current = false
    } else {
      if (!before) {
        fromParty.current = true
        track('sketchbook_open', { view: now.view })
      }
      fromBook.current = now.view !== 'book' && before?.view === 'book'
    }
    previous.current = now
  }, [hash])

  const closeBook = useCallback(() => {
    if (fromParty.current) window.history.back()
    else clearHashRoute()
  }, [])

  const backToBook = useCallback(() => {
    if (fromBook.current) window.history.back()
    else replaceHashRoute(SKETCHBOOK_HREF)
  }, [])

  const onSent = useCallback(() => {
    setNotice('Sent! It’ll be pinned up for everyone in about a minute.')
    backToBook()
  }, [backToBook])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 7000)
    return () => window.clearTimeout(timer)
  }, [notice])

  if (!route || !sketchRepo) return null

  let view: ReactNode
  if (route.view === 'new') view = <Easel onClose={backToBook} onSent={onSent} />
  else if (route.view === 'page') {
    view = <PageView key={route.id} id={route.id} reduced={reduced} onBack={backToBook} />
  } else view = <Book onClose={closeBook} notice={notice} />

  // Outside .story-stage, like the mailbox letters: the lit tokens don't reach
  // here, so Sketchbook.css carries its own palette.
  return createPortal(<div className="sketchbook">{view}</div>, document.body)
}

// ── the book ─────────────────────────────────────────────────────────────────

interface BookProps {
  onClose: () => void
  notice: string | null
}

function Book({ onClose, notice }: BookProps) {
  const key = keyStore.use()
  const sent = sentStore.use()
  const draft = draftStore.use()
  const [sheet, setSheet] = useState(false)
  const [forgetting, setForgetting] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)

  useDialogTrap(rootRef, onClose, backRef, !sheet)

  // A page that has been deployed since it was sent is in drawingRefs now, so
  // its stand-in can go.
  useEffect(() => pruneSent(publishedIds), [])

  // Forgetting the key is the one thing here that can't be undone from this
  // device, so it takes a second tap.
  useEffect(() => {
    if (!forgetting) return
    const timer = window.setTimeout(() => setForgetting(false), 4000)
    return () => window.clearTimeout(timer)
  }, [forgetting])

  const closeSheet = useCallback(() => setSheet(false), [])

  const drying = stillDrying(sent)
  const firstSent = key ? 1 : 0
  const firstPublished = firstSent + drying.length

  return (
    <div
      className="sketch-book"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sketch-book-title"
      ref={rootRef}
    >
      <div className="sketch-book__main" inert={sheet}>
        <div className="sketch-bar">
          <button type="button" ref={backRef} className="sketch-back" onClick={onClose}>
            <span aria-hidden="true">‹</span> back to the party
          </button>
        </div>

        <header className="sketch-book__head">
          <h2 className="sketch-book__title" id="sketch-book-title">
            the sketchbook
          </h2>
          <p className="sketch-book__lede">pages drawn right here, pinned up for everyone</p>
        </header>

        {notice && (
          <p className="sketch-book__notice" role="status">
            {notice}
          </p>
        )}

        {drawingRefs.length === 0 && drying.length === 0 && !key && (
          <p className="sketch-book__empty">Nothing pinned up yet.</p>
        )}

        <div className="sketch-book__grid">
          {key && <NewPageTile draft={draft} />}
          {drying.map((page, i) => (
            <SentTile key={page.issue} page={page} index={firstSent + i} />
          ))}
          {drawingRefs.map((ref, i) => (
            <PublishedTile key={ref.id} drawingRef={ref} index={firstPublished + i} />
          ))}
        </div>

        <footer className="sketch-book__foot">
          {key ? (
            <p>
              drawing as <strong>{key.name}</strong> on this device ·{' '}
              <button
                type="button"
                className="sketch-book__link"
                onClick={() => {
                  if (!forgetting) return setForgetting(true)
                  keyStore.set(null)
                  setForgetting(false)
                }}
              >
                {forgetting ? 'tap again to forget the key' : 'forget the key'}
              </button>
            </p>
          ) : (
            <button type="button" className="sketch-book__link" onClick={() => setSheet(true)}>
              have a key? unlock drawing on this device
            </button>
          )}
        </footer>
      </div>

      {sheet && <KeySheet onDone={closeSheet} onCancel={closeSheet} />}
    </div>
  )
}

interface TileProps {
  href: string
  seed: string
  index: number
  strokes: readonly DrawingStroke[] | null
  caption: string
  meta: string
  tag?: string
  className?: string
}

/** A page torn out of the book and laid on the mat. */
function Tile({ href, seed, index, strokes, caption, meta, tag, className = '' }: TileProps) {
  const style = {
    '--rot': `${seededRotation(seed, -3.2, 3.2)}deg`,
    '--i': Math.min(index, STAGGER_CAP),
  } as CSSProperties

  return (
    <a className={`sketch-tile ${className}`} href={href} style={style}>
      <span className="sketch-tile__paper sketch-paper">
        <PageCanvas strokes={strokes} />
        {tag && <span className="sketch-tile__tag">{tag}</span>}
      </span>
      <span className="sketch-tile__caption">{caption}</span>
      <span className="sketch-tile__meta">{meta}</span>
    </a>
  )
}

function PublishedTile({ drawingRef, index }: { drawingRef: DrawingRef; index: number }) {
  const file = usePublishedDrawing(drawingRef.id)
  const day = formatDay(drawingRef.date)
  return (
    <Tile
      href={drawingHref(drawingRef.id)}
      seed={drawingRef.id}
      index={index}
      strokes={file?.strokes ?? null}
      caption={file === undefined ? '…' : file?.caption || 'untitled'}
      meta={file?.by ? `by ${file.by} · ${day}` : day}
    />
  )
}

function SentTile({ page, index }: { page: SentPage; index: number }) {
  return (
    <Tile
      href={drawingHref(sentIdOf(page))}
      seed={sentIdOf(page)}
      index={index}
      strokes={page.drawing.strokes}
      caption={page.drawing.caption || 'untitled'}
      meta={`by ${page.drawing.by} · up in a minute`}
      tag="drying…"
      className="sketch-tile--drying"
    />
  )
}

/** Only on a device with a key. Shows the unsent page, if there is one. */
function NewPageTile({ draft }: { draft: DrawingStroke[] }) {
  const resuming = draft.length > 0
  return (
    <a
      className={`sketch-tile sketch-tile--new${resuming ? ' is-resuming' : ''}`}
      href={NEW_PAGE_HREF}
      style={{ '--rot': '-1.4deg', '--i': 0 } as CSSProperties}
    >
      <span className={`sketch-tile__paper${resuming ? ' sketch-paper' : ''}`}>
        {resuming && <PageCanvas strokes={draft} />}
        <span className="sketch-tile__pencil" aria-hidden="true">
          <PencilIcon />
        </span>
      </span>
      <span className="sketch-tile__caption">{resuming ? 'keep drawing' : 'draw a new page'}</span>
      <span className="sketch-tile__meta">
        {resuming ? 'your unsent page' : 'only you can see it until you pin it up'}
      </span>
    </a>
  )
}

// ── one page ─────────────────────────────────────────────────────────────────

interface PageViewProps {
  id: string
  reduced: boolean
  onBack: () => void
}

/** One page, large, drawing itself again the way it was drawn. */
function PageView({ id, reduced, onBack }: PageViewProps) {
  const sent = sentStore.use()
  const sentPage = sent.find((page) => sentIdOf(page) === id)
  const ref = sentPage ? undefined : findDrawingRef(id)
  const file = usePublishedDrawing(ref ? id : null)
  const [run, setRun] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)

  useDialogTrap(rootRef, onBack, backRef)

  // A stale link — a page taken down since, or a sent page this device has
  // since forgotten — goes back to the book rather than to a blank stare.
  const missing = !sentPage && (!ref || file === null)
  useEffect(() => {
    if (missing) onBack()
  }, [missing, onBack])

  useEffect(() => {
    track('drawing_view', { drawing_id: id })
  }, [id])

  const page = sentPage?.drawing ?? file
  const date = sentPage?.date ?? file?.date
  const caption = page?.caption || 'untitled'

  return (
    <div className="sketch-view" role="dialog" aria-modal="true" aria-label={caption} ref={rootRef}>
      <div className="sketch-bar">
        <button type="button" ref={backRef} className="sketch-back" onClick={onBack}>
          <span aria-hidden="true">‹</span> back to the sketchbook
        </button>
      </div>

      <figure className="sketch-view__figure">
        <div
          className="sketch-view__paper sketch-paper"
          role="img"
          aria-label={page ? `${caption}, drawn by ${page.by}` : 'Loading the drawing'}
        >
          {page && <ReplayCanvas strokes={page.strokes} run={run} reduced={reduced} />}
          <span className="sketch-view__tape" aria-hidden="true" />
        </div>

        {page && (
          <figcaption className="sketch-view__caption">
            <span className="sketch-view__title">{caption}</span>
            <span className="sketch-view__meta">
              by {page.by}
              {date && ` · ${formatDay(date)}`}
              {sentPage && ' · drying, up in a minute'}
            </span>
          </figcaption>
        )}
      </figure>

      {page && !reduced && (
        <button type="button" className="sketch-view__replay" onClick={() => setRun((n) => n + 1)}>
          <span aria-hidden="true">↻</span> watch it draw again
        </button>
      )}
    </div>
  )
}
