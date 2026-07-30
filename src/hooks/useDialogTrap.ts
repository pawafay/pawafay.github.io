import { useEffect } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE = 'button, a[href], [tabindex]:not([tabindex="-1"])'

/**
 * The keyboard contract every letter overlay shares: focus something sensible on
 * open, close on Escape, and cycle Tab inside the container instead of escaping
 * into the page behind it. Layout is left to the caller — the closing letter is
 * a centred modal, a mailbox letter takes over the whole screen.
 */
export function useDialogTrap(
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    // preventScroll, because the letter is opening: the sheet is mid-animation
    // and still translated down the screen, so letting focus scroll its button
    // into view lands the reader a paragraph into a letter they haven't started.
    initialFocusRef?.current?.focus({ preventScroll: true })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !containerRef.current) return

      const focusable = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [containerRef, onClose, initialFocusRef])
}
