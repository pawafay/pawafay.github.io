import { useEffect, useRef, useState } from 'react'

interface Parallax {
  x: number // -1..1
  y: number // -1..1
}

const ZERO: Parallax = { x: 0, y: 0 }

/**
 * Normalised pointer offset from screen centre, for subtle parallax depth.
 * Disabled on coarse/touch pointers and when reduced motion is requested
 * (returns a steady {0,0}). Throttled to one update per animation frame.
 */
export function usePointerParallax(enabled = true): Parallax {
  const [pos, setPos] = useState<Parallax>(ZERO)
  const frame = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setPos(ZERO)
      return
    }
    const fine = window.matchMedia('(pointer: fine)').matches
    if (!fine) return

    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth) * 2 - 1
        const y = (e.clientY / window.innerHeight) * 2 - 1
        setPos({ x, y })
      })
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      cancelAnimationFrame(frame.current)
      window.removeEventListener('pointermove', onMove)
    }
  }, [enabled])

  return pos
}
