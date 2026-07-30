import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { config } from '../../config'
import './Letter.css'

/** The opened birthday letter: a portal modal with focus trap + Esc to close. */
export function Letter({ onClose }: { onClose: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const { greeting } = config
  const paragraphs = Array.isArray(greeting.body) ? greeting.body : [greeting.body]

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'Tab' && sheetRef.current) {
        const f = sheetRef.current.querySelectorAll<HTMLElement>(
          'button, a[href], [tabindex]:not([tabindex="-1"])',
        )
        if (f.length === 0) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

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

        <div className="letter__paper">
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
