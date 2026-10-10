import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, ReactNode, RefObject } from 'react'
import type { DrawingData, DrawingStroke } from '../../drawings.types'
import { config } from '../../config'
import { useDialogTrap } from '../../hooks/useDialogTrap'
import { LIMITS, PAGE_H, PAGE_W, cleanText } from '../../lib/drawingFormat'
import type { SendFailure } from '../../lib/github'
import { SKETCH_LABEL, checkKey, jakartaDate, sendDrawing, sketchRepo } from '../../lib/github'
import { lockQuestions, looksLikeGithubKey, openWithAnswers } from '../../lib/keyLocks'
import { keyStore } from '../../lib/sketchStore'
import type { SentPage } from '../../lib/sketchStore'

/** What went wrong, in words — and, whenever it's true, that the drawing is safe. */
function failureMessage(failure: SendFailure): string {
  const owner = sketchRepo?.owner ?? 'the site owner'
  switch (failure.kind) {
    case 'bad-key':
      return 'That key doesn’t work any more — it may have expired or been cancelled. Paste a new one.'
    case 'wrong-account':
      return `That key belongs to @${failure.login}. Keys for this sketchbook have to be made on the @${owner} account.`
    case 'no-access':
      return 'This key isn’t allowed to post here. It needs “Issues: Read and write” on this repo.'
    case 'too-big':
      return 'This page is too detailed to send in one go. Undo a few strokes and try again.'
    case 'no-label':
      return `It reached GitHub as issue #${failure.issue}, but without its “${SKETCH_LABEL}” label, so it won’t be pinned up. Add the label to that issue by hand.`
    case 'offline':
      return 'Couldn’t reach GitHub. Your drawing is still here — try again in a moment.'
    case 'other':
      return `GitHub said no (${failure.status || 'not set up'}). Your drawing is still here — try again in a bit.`
  }
}

interface SheetProps {
  title: string
  children: ReactNode
  onCancel: () => void
  initialFocusRef: RefObject<HTMLElement | null>
}

/**
 * A card that slides up over whatever is behind it — the page being drawn, or
 * the book. It runs its own focus trap; the parent stands its trap down and
 * marks itself inert while a sheet is open, so Escape and Tab belong here.
 */
function Sheet({ title, children, onCancel, initialFocusRef }: SheetProps) {
  const titleId = useId()
  const sheetRef = useRef<HTMLDivElement>(null)
  useDialogTrap(sheetRef, onCancel, initialFocusRef)

  return (
    <div
      className="sketch-sheet-scrim"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="sketch-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={sheetRef}
      >
        <h2 className="sketch-sheet__title" id={titleId}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}

interface KeySheetProps {
  onDone: () => void
  onCancel: () => void
}

/** The name on pages drawn with the owner's own GitHub key, pasted as it is. */
const OWNER_NAME =
  cleanText(config.sketchbookOwnerName, LIMITS.by) || sketchRepo?.owner || 'someone'

/**
 * Unlocking this device — the only thing that lets it send drawings.
 *
 * Two ways in, and nobody types a name in either. Answering the questions opens
 * a key locked in src/sketchbook-keys.json, and the lock carries the name its
 * pages are signed with. Or a GitHub key pasted as it is — the owner's own —
 * which signs pages with OWNER_NAME.
 */
export function KeySheet({ onDone, onCancel }: KeySheetProps) {
  const [mode, setMode] = useState<'answers' | 'key'>(lockQuestions ? 'answers' : 'key')
  const [answers, setAnswers] = useState<string[]>(() => (lockQuestions ?? []).map(() => ''))
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstRef = useRef<HTMLInputElement>(null)
  const switched = useRef(false)
  const fieldId = useId()

  // Swapping between the two puts the cursor in the first box of the new one.
  // (On open, the sheet's focus trap does that.)
  useEffect(() => {
    if (switched.current) firstRef.current?.focus()
  }, [mode])

  const switchTo = (next: 'answers' | 'key') => {
    switched.current = true
    setError(null)
    setMode(next)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)

    let opened: { token: string; name: string } | null
    if (mode === 'key') {
      const token = key.trim()
      opened = looksLikeGithubKey(token) ? { token, name: OWNER_NAME } : null
      if (!opened) {
        setBusy(false)
        setError('That isn’t a GitHub key. It starts with github_pat_.')
        return
      }
    } else {
      opened = await openWithAnswers(answers)
      if (!opened) {
        setBusy(false)
        // Deliberately no hint as to which answer is wrong.
        setError('Those don’t open anything. Check the spelling and try again.')
        return
      }
    }

    const result = await checkKey(opened.token)
    setBusy(false)
    if ('ok' in result) {
      keyStore.set(opened)
      onDone()
    } else if (mode === 'answers' && result.kind === 'bad-key') {
      setError(
        'Those are the right answers, but the key behind them has expired or been cancelled.',
      )
    } else {
      setError(failureMessage(result))
    }
  }

  const inputProps = {
    autoComplete: 'off',
    autoCapitalize: 'none',
    autoCorrect: 'off',
    spellCheck: false,
    required: true,
  } as const

  return (
    <Sheet title="unlock drawing" onCancel={onCancel} initialFocusRef={firstRef}>
      <p className="sketch-sheet__lede">
        {mode === 'answers'
          ? 'Answer these to unlock drawing on this device. You won’t be asked again here.'
          : 'Paste a GitHub key for this sketchbook. It stays on this device.'}
      </p>
      <form className="sketch-sheet__form" onSubmit={submit}>
        {mode === 'answers' && lockQuestions ? (
          lockQuestions.map((question, i, all) => (
            <div className="sketch-sheet__field" key={question}>
              <label htmlFor={`${fieldId}-${i}`}>{question}</label>
              <input
                id={`${fieldId}-${i}`}
                ref={i === 0 ? firstRef : undefined}
                type="text"
                value={answers[i]}
                onChange={(e) => {
                  const next = [...answers]
                  next[i] = e.target.value
                  setAnswers(next)
                }}
                enterKeyHint={i === all.length - 1 ? 'go' : 'next'}
                {...inputProps}
              />
            </div>
          ))
        ) : (
          <div className="sketch-sheet__field">
            <label htmlFor={fieldId}>GitHub key</label>
            <input
              id={fieldId}
              ref={firstRef}
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="github_pat_…"
              enterKeyHint="go"
              {...inputProps}
            />
          </div>
        )}

        {lockQuestions && (
          <p className="sketch-sheet__switch">
            <button
              type="button"
              className="sketch-sheet__link"
              onClick={() => switchTo(mode === 'answers' ? 'key' : 'answers')}
            >
              {mode === 'answers' ? 'have a GitHub key instead?' : 'answer the questions instead'}
            </button>
          </p>
        )}

        {error && (
          <p className="sketch-sheet__error" role="alert">
            {error}
          </p>
        )}
        <div className="sketch-sheet__actions">
          <button type="button" className="sketch-sheet__quiet" onClick={onCancel}>
            not now
          </button>
          <button type="submit" className="sketch-sheet__go" disabled={busy}>
            {busy ? 'checking…' : 'unlock'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}

interface SendSheetProps {
  strokes: DrawingStroke[]
  onSent: (page: SentPage) => void
  onNeedKey: () => void
  onCancel: () => void
}

/** Naming the page, then sending it off to be pinned up. */
export function SendSheet({ strokes, onSent, onNeedKey, onCancel }: SendSheetProps) {
  const key = keyStore.use()
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<SendFailure | null>(null)
  const captionRef = useRef<HTMLInputElement>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!key) return
    setBusy(true)
    setFailure(null)
    const page: DrawingData = {
      v: 1,
      width: PAGE_W,
      height: PAGE_H,
      by: key.name,
      caption: cleanText(caption, LIMITS.caption),
      strokes,
    }
    const result = await sendDrawing(key.token, page)
    setBusy(false)
    if ('ok' in result) {
      onSent({
        issue: result.issue,
        date: jakartaDate(result.createdAt),
        sentAt: Date.now(),
        drawing: page,
      })
    } else {
      setFailure(result)
    }
  }

  const keyTrouble = failure?.kind === 'bad-key' || failure?.kind === 'wrong-account'

  return (
    <Sheet title="pin it up" onCancel={onCancel} initialFocusRef={captionRef}>
      <p className="sketch-sheet__lede">
        It goes up in the sketchbook for everyone, about a minute after you send it.
      </p>
      <form className="sketch-sheet__form" onSubmit={submit}>
        <label className="sketch-sheet__field">
          <span>Give it a name (optional)</span>
          <input
            ref={captionRef}
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="untitled"
            maxLength={LIMITS.caption}
            enterKeyHint="send"
          />
        </label>
        {key && (
          <p className="sketch-sheet__signed">
            — {key.name}{' '}
            <button type="button" className="sketch-sheet__link" onClick={onNeedKey}>
              not you?
            </button>
          </p>
        )}
        {failure && (
          <p className="sketch-sheet__error" role="alert">
            {failureMessage(failure)}
          </p>
        )}
        <div className="sketch-sheet__actions">
          <button type="button" className="sketch-sheet__quiet" onClick={onCancel}>
            keep drawing
          </button>
          {keyTrouble || !key ? (
            <button type="button" className="sketch-sheet__go" onClick={onNeedKey}>
              use another key
            </button>
          ) : (
            <button type="submit" className="sketch-sheet__go" disabled={busy}>
              {busy ? 'sending…' : 'send it'}
            </button>
          )}
        </div>
      </form>
    </Sheet>
  )
}
