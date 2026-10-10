import { useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * Keeps a fixed overlay inside the part of the screen that can actually be
 * seen, which shrinks when an on-screen keyboard comes up.
 *
 * Phone browsers no longer make the page shorter for their keyboard: iOS Safari
 * never did, and Android Chrome stopped in version 108. The keyboard slides over
 * a page that keeps its full height, so a sheet pinned to the bottom of the
 * screen ends up underneath it, text field and all. The visual viewport is the
 * part left showing; its top and height go onto the element as --visible-top
 * and --visible-height, for its CSS to sit inside.
 */
export function useVisibleViewport(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current
    const viewport = window.visualViewport
    if (!el || !viewport) return

    const fit = () => {
      el.style.setProperty('--visible-top', `${viewport.offsetTop}px`)
      el.style.setProperty('--visible-height', `${viewport.height}px`)
    }
    // Once the room above the keyboard has shrunk, the field being typed in
    // may have been squeezed out of view; bring it back.
    const resize = () => {
      fit()
      const focused = document.activeElement
      if (focused instanceof HTMLElement && el.contains(focused)) {
        focused.scrollIntoView({ block: 'nearest' })
      }
    }

    fit()
    viewport.addEventListener('resize', resize)
    viewport.addEventListener('scroll', fit)
    return () => {
      viewport.removeEventListener('resize', resize)
      viewport.removeEventListener('scroll', fit)
    }
  }, [ref])
}
