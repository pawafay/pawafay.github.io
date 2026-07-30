import type { CSSProperties } from 'react'
import { config } from '../../config'
import type { Breakpoint } from '../../hooks/useBreakpoint'
import { TapedPhoto } from './TapedPhoto'
import './StickerLayer.css'

interface Slot {
  x: string
  y: string
  scale: number
}

// Curated layouts per breakpoint — edges/corners only, clear of the centre
// column, spaced so captions never collide.
const LAYOUTS: Record<Breakpoint, Slot[]> = {
  mobile: [
    { x: '1%', y: '13%', scale: 1 },
    { x: '64%', y: '6%', scale: 0.9 },
    { x: '1%', y: '71%', scale: 0.92 },
    { x: '63%', y: '74%', scale: 0.98 },
  ],
  tablet: [
    { x: '2%', y: '17%', scale: 1 },
    { x: '81%', y: '9%', scale: 0.95 },
    { x: '3%', y: '60%', scale: 0.95 },
    { x: '80%', y: '56%', scale: 0.95 },
    { x: '83%', y: '84%', scale: 0.82 },
  ],
  desktop: [
    { x: '3%', y: '20%', scale: 1 },
    { x: '85%', y: '13%', scale: 1 },
    { x: '3%', y: '56%', scale: 0.9 },
    { x: '86%', y: '52%', scale: 0.98 },
    { x: '11%', y: '86%', scale: 0.74 },
    { x: '88%', y: '84%', scale: 0.74 },
  ],
}

const BASE_WIDTH: Record<Breakpoint, number> = { mobile: 108, tablet: 146, desktop: 158 }

/** Scattered, taped memory photos around the edges of the party. */
export function StickerLayer({ breakpoint }: { breakpoint: Breakpoint }) {
  const slots = LAYOUTS[breakpoint]
  const base = BASE_WIDTH[breakpoint]
  const stickers = config.stickers.slice(0, slots.length)

  return (
    <div className="sticker-layer" aria-hidden="false">
      {stickers.map((s, i) => {
        const slot = slots[i]
        return (
          <div
            key={i}
            className="sticker-layer__item"
            style={
              {
                left: slot.x,
                top: slot.y,
                width: `${Math.round(base * slot.scale)}px`,
                animationDelay: `${0.15 + i * 0.12}s`,
                '--spin': `${s.rotation ?? (i % 2 ? 6 : -6)}deg`,
              } as CSSProperties
            }
          >
            <TapedPhoto
              src={s.src}
              caption={s.caption}
              shape={s.shape}
              tapeStyle={s.tapeStyle}
              rotation={s.rotation}
              together={s.together}
              seed={`sticker-${i}-${s.caption ?? ''}`}
            />
          </div>
        )
      })}
    </div>
  )
}
