import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { config } from '../../config'
import { useDialogTrap } from '../../hooks/useDialogTrap'
import { useReadingTracker } from '../../hooks/useReadingTracker'
import './Letter.css'

/** The opened birthday letter: a portal modal with focus trap + Esc to close. */
export function Letter({ onClose }: { onClose: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)

  const { greeting } = config
  const paragraphs = Array.isArray(greeting.body) ? greeting.body : [greeting.body]

  useDialogTrap(sheetRef, onClose, closeRef)

  // There is only ever one of these, so a fixed slug rather than a real one.
  useReadingTracker(paperRef, {
    kind: 'greeting',
    slug: '(greeting)',
    title: greeting.salutation,
    paragraphCount: paragraphs.length,
    photoCount: 0,
  })

  return createPortal(
    <div className="letter-overlay" onPointerDown={onClose}>
      <div
        className="letter"
        role="dialog"
        aria-modal="true"
        aria-label="A birthday letter"
        ref={sheetRef}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          ref={closeRef}
          className="letter__close"
          aria-label="Close letter"
          onClick={onClose}
        >
          ×
        </button>

        <div className="letter__paper paper-ruled" ref={paperRef}>
          <div className="letter__content">
            <p className="letter__salutation" style={{ animationDelay: '0.1s' }}>
              {greeting.salutation}
            </p>
            {paragraphs.map((p, i) => (
              <p key={i} className="letter__line" style={{ animationDelay: `${0.25 + i * 0.18}s` }}>
                {p}
              </p>
            ))}
            <p
              className="letter__signoff"
              style={{ animationDelay: `${0.3 + paragraphs.length * 0.18}s` }}
            >
              {greeting.signoff}
            </p>
            {greeting.signature && (
              <p
                className="letter__name"
                style={{ animationDelay: `${0.45 + paragraphs.length * 0.18}s` }}
              >
                {greeting.signature}
              </p>
            )}
            <span
              className="letter__heart"
              style={{ animationDelay: `${0.6 + paragraphs.length * 0.18}s` }}
              aria-hidden="true"
            >
              ♥
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
