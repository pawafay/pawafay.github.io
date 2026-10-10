import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { DrawingStroke, DrawingTool } from '../../drawings.types'
import { useDialogTrap } from '../../hooks/useDialogTrap'
import { track } from '../../lib/analytics'
import { LIMITS, PAGE_H, PAGE_MARGIN, PAGE_W, hasInk, pointCount } from '../../lib/drawingFormat'
import { fitCanvas, paintPartial, paintStroke, paintStrokes } from '../../lib/ink'
import { draftStore, keyStore, sentStore } from '../../lib/sketchStore'
import type { SentPage } from '../../lib/sketchStore'
import { INKS, NIBS, NIB_NAMES } from './inks'
import { KeySheet, SendSheet } from './Sheets'
import { EraserIcon, MarkerIcon, PenIcon, RedoIcon, TrashIcon, UndoIcon } from './icons'

/** Points closer together than this (page units) add nothing but bytes. */
const MIN_STEP = 1.6
/** How far back undo reaches. Each step is one array of shared strokes, so it's cheap. */
const MAX_UNDO = 100
/** Retina, but not so dense that a big tablet canvas gets slow to repaint. */
const MAX_DPR = 3

interface History {
  past: DrawingStroke[][]
  present: DrawingStroke[]
  future: DrawingStroke[][]
}

interface Live {
  pointerId: number
  pointerType: string
  stroke: DrawingStroke
  /** Measured once when the stroke starts — reading layout per point is slow. */
  rect: DOMRect
  /** Points the page can still take before it is full. */
  budget: number
  /** The eraser cuts into the ink layer itself; this is that layer before it began. */
  snapshot: HTMLCanvasElement | null
}

const TOOLS: { tool: DrawingTool; label: string; Icon: typeof PenIcon }[] = [
  { tool: 'pen', label: 'Pen', Icon: PenIcon },
  { tool: 'marker', label: 'Marker', Icon: MarkerIcon },
  { tool: 'eraser', label: 'Eraser', Icon: EraserIcon },
]

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

/** Clears a canvas whatever its transform, leaving the transform as it was. */
function wipe(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.restore()
}

/** Puts the ink layer back the way the eraser's snapshot found it. */
function restore(ctx: CanvasRenderingContext2D, snapshot: HTMLCanvasElement): void {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.drawImage(snapshot, 0, 0)
  ctx.restore()
}

interface EaselProps {
  onClose: () => void
  onSent: () => void
}

/**
 * A blank page and a pencil case.
 *
 * Two canvases, stacked: the bottom one holds every finished stroke, the top one
 * only the stroke under the pen right now, so a frame never redraws the page.
 * The eraser is the exception — it has to cut into finished ink — so it works on
 * the bottom layer directly, from a snapshot taken as it touched down.
 *
 * Every finished stroke is saved to this device as it lands, so leaving and
 * coming back (or the phone locking mid-drawing) picks up where it was.
 */
export function Easel({ onClose, onSent }: EaselProps) {
  const key = keyStore.use()
  const [tool, setTool] = useState<DrawingTool>('pen')
  const [ink, setInk] = useState<string>(INKS[0].hex)
  const [nib, setNib] = useState(1)
  const [sheet, setSheet] = useState<'send' | 'key' | null>(null)
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: draftStore.get(),
    future: [],
  }))

  const rootRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const inkRef = useRef<HTMLCanvasElement>(null)
  const liveRef = useRef<HTMLCanvasElement>(null)
  // Pointer handlers run outside React's render, so they read these, not state.
  const historyRef = useRef(history)
  const liveStroke = useRef<Live | null>(null)
  const frame = useRef(0)
  /**
   * The eraser's snapshot, reused stroke to stroke. iOS caps how much memory
   * all of a page's canvases may hold together, and a new page-sized canvas per
   * eraser stroke can hit that cap on an iPad before the old ones are freed.
   */
  const snapshotRef = useRef<HTMLCanvasElement | null>(null)
  /**
   * A stylus has drawn on this page. From then on a finger or palm on the paper
   * is a hand resting on it — as with an Apple Pencil on an iPad — not a stroke.
   */
  const penSeen = useRef(false)

  const { present } = history
  const used = useMemo(() => pointCount(present), [present])
  const full = used >= LIMITS.points - 20 || present.length >= LIMITS.strokes
  const inked = hasInk(present)

  const commit = useCallback((next: History) => {
    historyRef.current = next
    setHistory(next)
    draftStore.set(next.present.length > 0 ? next.present : null)
  }, [])

  /** Redraws the whole page — after undo, redo, clear or a resize. */
  const repaint = useCallback(() => {
    const live = liveRef.current
    if (live) fitCanvas(live, MAX_DPR)
    const canvas = inkRef.current
    const ctx = canvas && fitCanvas(canvas, MAX_DPR)
    if (ctx) paintStrokes(ctx, historyRef.current.present)
  }, [])

  const drawFrame = useCallback(() => {
    frame.current = 0
    const live = liveStroke.current
    if (!live) return
    const count = live.stroke.points.length / 3
    if (live.snapshot) {
      const ctx = inkRef.current?.getContext('2d')
      if (!ctx) return
      restore(ctx, live.snapshot)
      paintPartial(ctx, live.stroke, count)
    } else {
      const ctx = liveRef.current?.getContext('2d')
      if (!ctx) return
      wipe(ctx)
      paintPartial(ctx, live.stroke, count)
    }
  }, [])

  const finishStroke = useCallback(() => {
    cancelAnimationFrame(frame.current)
    frame.current = 0
    const live = liveStroke.current
    liveStroke.current = null
    const liveCtx = liveRef.current?.getContext('2d')
    if (liveCtx) wipe(liveCtx)
    if (!live || live.stroke.points.length === 0) return

    const ctx = inkRef.current?.getContext('2d')
    if (ctx) {
      if (live.snapshot) restore(ctx, live.snapshot)
      paintStroke(ctx, live.stroke)
    }
    const { past, present: now } = historyRef.current
    commit({
      past: [...past, now].slice(-MAX_UNDO),
      present: [...now, live.stroke],
      future: [],
    })
  }, [commit])

  // Size both layers to the paper, and keep them sized. A stroke in progress is
  // finished first: its eraser snapshot would no longer line up.
  useEffect(() => {
    const paper = paperRef.current
    if (!paper) return
    const observer = new ResizeObserver(() => {
      if (liveStroke.current) finishStroke()
      repaint()
    })
    observer.observe(paper)
    return () => observer.disconnect()
  }, [finishStroke, repaint])

  /** Takes back the stroke under way without keeping any of it. */
  const dropStroke = () => {
    cancelAnimationFrame(frame.current)
    frame.current = 0
    const live = liveStroke.current
    liveStroke.current = null
    const liveCtx = liveRef.current?.getContext('2d')
    if (liveCtx) wipe(liveCtx)
    const ctx = inkRef.current?.getContext('2d')
    if (ctx && live?.snapshot) restore(ctx, live.snapshot)
  }

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current)
      // Zero-sized, iOS hands its memory back now rather than at the next GC.
      const snapshot = snapshotRef.current
      if (snapshot) snapshot.width = snapshot.height = 0
    },
    [],
  )

  // touch-action and user-select keep the paper still, but some iOS versions
  // still raise the magnifying loupe or start a text selection on a long press.
  // Cancelling the touches stops that; the pointer events drawing runs on are
  // dispatched ahead of them, so they're unaffected.
  useEffect(() => {
    const paper = paperRef.current
    if (!paper) return
    const hold = (e: TouchEvent) => e.preventDefault()
    paper.addEventListener('touchstart', hold, { passive: false })
    paper.addEventListener('touchmove', hold, { passive: false })
    return () => {
      paper.removeEventListener('touchstart', hold)
      paper.removeEventListener('touchmove', hold)
    }
  }, [])

  const addPoint = (e: PointerEvent) => {
    const live = liveStroke.current
    if (!live) return
    const { rect, stroke } = live
    const x = Math.round(
      clamp(((e.clientX - rect.left) / rect.width) * PAGE_W, -PAGE_MARGIN, PAGE_W + PAGE_MARGIN),
    )
    const y = Math.round(
      clamp(((e.clientY - rect.top) / rect.height) * PAGE_H, -PAGE_MARGIN, PAGE_H + PAGE_MARGIN),
    )
    // A stylus reports real pressure; a finger or a mouse reports a flat 0.5 (or
    // 0), which is why their strokes simulate it from speed instead.
    const pressure = stroke.pressure ? Math.round(clamp(e.pressure || 0.5, 0.05, 1) * 100) : 50

    const points = stroke.points
    const n = points.length
    if (n > 0) {
      const dx = x - points[n - 3]
      const dy = y - points[n - 2]
      if (dx * dx + dy * dy < MIN_STEP * MIN_STEP) return
    }
    if (live.budget <= 0) return
    live.budget -= 1
    points.push(x, y, pressure)
  }

  const schedule = () => {
    if (!frame.current) frame.current = requestAnimationFrame(drawFrame)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (full) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.pointerType === 'pen') penSeen.current = true
    else if (e.pointerType === 'touch' && penSeen.current) return
    const current = liveStroke.current
    if (current) {
      // A palm that landed a moment before the pen: the pen wins, and the
      // palm's smudge goes.
      if (e.pointerType === 'pen' && current.pointerType === 'touch') dropStroke()
      else return
    }
    e.preventDefault()
    const canvas = e.currentTarget
    try {
      // Keeps the stroke ours when the pen wanders off the paper mid-line.
      canvas.setPointerCapture(e.pointerId)
    } catch {
      // The pointer was already gone; the stroke still works, just uncaptured.
    }

    let snapshot: HTMLCanvasElement | null = null
    const inkCanvas = inkRef.current
    if (tool === 'eraser' && inkCanvas) {
      snapshot = snapshotRef.current ??= document.createElement('canvas')
      if (snapshot.width !== inkCanvas.width || snapshot.height !== inkCanvas.height) {
        snapshot.width = inkCanvas.width
        snapshot.height = inkCanvas.height
      }
      const snapshotCtx = snapshot.getContext('2d')
      snapshotCtx?.clearRect(0, 0, snapshot.width, snapshot.height)
      snapshotCtx?.drawImage(inkCanvas, 0, 0)
    }

    liveStroke.current = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      stroke: {
        tool,
        color: tool === 'eraser' ? '#000000' : ink,
        size: NIBS[tool][nib],
        pressure: e.pointerType === 'pen',
        points: [],
      },
      rect: canvas.getBoundingClientRect(),
      budget: LIMITS.points - used,
      snapshot,
    }
    addPoint(e.nativeEvent)
    schedule()
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const live = liveStroke.current
    if (!live || e.pointerId !== live.pointerId) return
    // Coalesced events are the points the browser saw between two frames: on a
    // 120 Hz stylus they're the difference between a curve and a polygon.
    const events = e.nativeEvent.getCoalescedEvents?.() ?? []
    if (events.length > 0) for (const event of events) addPoint(event)
    else addPoint(e.nativeEvent)
    schedule()
  }

  const onPointerEnd = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const live = liveStroke.current
    if (!live || e.pointerId !== live.pointerId) return
    if (e.type === 'pointerup') addPoint(e.nativeEvent)
    finishStroke()
  }

  const undo = useCallback(() => {
    const { past, present: now, future } = historyRef.current
    const previous = past.at(-1)
    if (!previous || liveStroke.current) return
    commit({ past: past.slice(0, -1), present: previous, future: [now, ...future] })
    repaint()
  }, [commit, repaint])

  const redo = useCallback(() => {
    const { past, present: now, future } = historyRef.current
    const next = future[0]
    if (!next || liveStroke.current) return
    commit({ past: [...past, now].slice(-MAX_UNDO), present: next, future: future.slice(1) })
    repaint()
  }, [commit, repaint])

  /** Undoable, so it needs no "are you sure". */
  const clear = () => {
    const { past, present: now } = historyRef.current
    if (now.length === 0 || liveStroke.current) return
    commit({ past: [...past, now].slice(-MAX_UNDO), present: [], future: [] })
    repaint()
  }

  // Ctrl/⌘+Z and Ctrl/⌘+Shift+Z (or Ctrl+Y) — ignored while a sheet is open, so
  // undo inside a text field stays the text field's.
  useEffect(() => {
    if (sheet) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) undo()
      else if ((k === 'z' && e.shiftKey) || k === 'y') redo()
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sheet, undo, redo])

  // A sheet runs its own trap; this one stands down until it's gone.
  useDialogTrap(rootRef, onClose, backRef, sheet === null)

  const closeSheet = useCallback(() => setSheet(null), [])
  const send = () => setSheet(key ? 'send' : 'key')

  const sent = (page: SentPage) => {
    sentStore.set([page, ...sentStore.get()])
    draftStore.set(null)
    track('drawing_send', { strokes: page.drawing.strokes.length })
    onSent()
  }

  return (
    <div className="easel" role="dialog" aria-modal="true" aria-label="A new page" ref={rootRef}>
      <div className="easel__main" inert={sheet !== null}>
        {/* Undo, redo and clear ride up here rather than in the tray: on a phone
            that is what leaves the paper room to be drawn on. */}
        <header className="easel__bar">
          <button type="button" ref={backRef} className="sketch-back" onClick={onClose}>
            <span aria-hidden="true">‹</span> back
          </button>
          <div className="easel__history" role="group" aria-label="History">
            <button
              type="button"
              className="easel__tool"
              aria-label="Undo"
              title="Undo"
              onClick={undo}
              disabled={history.past.length === 0}
            >
              <UndoIcon />
            </button>
            <button
              type="button"
              className="easel__tool"
              aria-label="Redo"
              title="Redo"
              onClick={redo}
              disabled={history.future.length === 0}
            >
              <RedoIcon />
            </button>
            <button
              type="button"
              className="easel__tool"
              aria-label="Clear the page"
              title="Clear the page"
              onClick={clear}
              disabled={present.length === 0}
            >
              <TrashIcon />
            </button>
          </div>
          <button type="button" className="easel__send" onClick={send} disabled={!inked}>
            pin it up
          </button>
        </header>

        <div className="easel__desk">
          <div className="easel__fit">
            <div className="easel__paper sketch-paper" ref={paperRef}>
              <canvas className="easel__ink" ref={inkRef} aria-hidden="true" />
              <canvas
                className="easel__live"
                ref={liveRef}
                role="img"
                aria-label={
                  present.length > 0
                    ? `Your drawing, ${present.length} stroke${present.length === 1 ? '' : 's'} so far`
                    : 'A blank page to draw on'
                }
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                onLostPointerCapture={onPointerEnd}
              />
              {present.length === 0 && (
                <p className="easel__hint" aria-hidden="true">
                  draw anything
                </p>
              )}
            </div>
          </div>
        </div>

        {full && (
          <p className="easel__full" role="status">
            This page is full — pin it up, or undo a few strokes.
          </p>
        )}

        <div className="easel__tray" role="toolbar" aria-label="Drawing tools">
          <div className="easel__row">
            <div className="easel__group" role="group" aria-label="Tool">
              {TOOLS.map(({ tool: t, label, Icon }) => (
                <button
                  key={t}
                  type="button"
                  className="easel__tool"
                  aria-pressed={tool === t}
                  aria-label={label}
                  title={label}
                  onClick={() => setTool(t)}
                  style={t === 'eraser' ? undefined : ({ '--ink': ink } as CSSProperties)}
                >
                  <Icon />
                </button>
              ))}
            </div>

            <div className="easel__group" role="group" aria-label="Size">
              {NIB_NAMES.map((name, i) => (
                <button
                  key={name}
                  type="button"
                  className="easel__nib"
                  aria-pressed={nib === i}
                  aria-label={name}
                  title={name}
                  onClick={() => setNib(i)}
                >
                  <span style={{ '--dot': `${6 + i * 5}px` } as CSSProperties} />
                </button>
              ))}
            </div>
          </div>

          <div className="easel__inks" role="group" aria-label="Colour">
            {INKS.map(({ name, hex }) => (
              <button
                key={hex}
                type="button"
                className="easel__swatch"
                aria-pressed={ink === hex && tool !== 'eraser'}
                aria-label={name}
                title={name}
                style={{ '--swatch': hex } as CSSProperties}
                onClick={() => {
                  setInk(hex)
                  if (tool === 'eraser') setTool('pen')
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {sheet === 'key' && <KeySheet onDone={() => setSheet('send')} onCancel={closeSheet} />}
      {sheet === 'send' && (
        <SendSheet
          strokes={present}
          onSent={sent}
          onNeedKey={() => setSheet('key')}
          onCancel={closeSheet}
        />
      )}
    </div>
  )
}
