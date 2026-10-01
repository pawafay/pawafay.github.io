import { useLayoutEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'

interface RuleSnapProps {
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/**
 * A block whose height is always a whole number of ruled lines.
 *
 * Every line of writing in a letter sits on the ruling only because everything
 * above it is a whole number of --rule tall (see MailLetter.css). Text was the
 * only thing that ever came before more text, so that held by construction; a
 * photo or a voice note in the middle of a letter is whatever height it is, and
 * every line after it would land between the rules. This pads the block, half
 * above and half below, up to the next whole line — so the media sits centred
 * in its band and the writing after it lands back on the lines.
 *
 * Measured rather than computed, because photos load lazily and change height,
 * and --rule itself scales with the viewport. ResizeObserver rather than
 * getBoundingClientRect: it reports layout sizes, which the sheet's scaling
 * draw-in animation doesn't distort, and the content box, which the padding set
 * here can never feed back into.
 */
export function RuleSnap({ className = '', style, children }: RuleSnapProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const probeRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const box = boxRef.current
    const probe = probeRef.current
    if (!box || !probe || typeof ResizeObserver === 'undefined') return

    let rule = 0
    let content = 0
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === probe) rule = entry.contentRect.height
        else content = entry.contentRect.height
      }
      if (rule <= 0 || content <= 0) return
      // The epsilon keeps a block already a hair over a whole line (subpixel
      // rounding) from being given a whole extra line.
      const pad = Math.ceil(content / rule - 0.01) * rule - content
      box.style.paddingBlock = `${Math.max(0, pad) / 2}px`
    })
    observer.observe(box)
    observer.observe(probe) // --rule changes with the viewport width
    return () => observer.disconnect()
  }, [])

  return (
    <div className={`rule-snap ${className}`} style={style} ref={boxRef}>
      <span className="rule-snap__probe" ref={probeRef} aria-hidden="true" />
      {children}
    </div>
  )
}
