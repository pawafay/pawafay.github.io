import { useState } from 'react'
import { Flame } from '../candle/Flame'
import { useAudio } from '../../audio/audioContext'
import './Cake.css'

const CANDLE_COLORS = ['#e8728c', '#6db5c9', '#c9a24b', '#7faa78', '#9b7ad1', '#ff9d4d']

/** Layered paper cake whose candles can be blown out (tap), then "make a wish". */
export function Cake({ candleCount = 5 }: { candleCount?: number }) {
  const audio = useAudio()
  const count = Math.max(1, Math.min(candleCount, 12))
  const [lit, setLit] = useState<boolean[]>(() => Array.from({ length: count }, () => true))
  const allOut = lit.every((l) => !l)

  const blow = (i: number) => {
    setLit((prev) => {
      if (!prev[i]) return prev
      const next = [...prev]
      next[i] = false
      return next
    })
    audio.playSfx('whoosh')
  }

  return (
    <div className="cake">
      <p className={`cake__hint ${allOut ? 'is-wish' : ''}`} aria-live="polite">
        {allOut ? 'make a wish ★' : 'blow the candles'}
      </p>

      <div className="cake__candles">
        {lit.map((isLit, i) => (
          <button
            key={i}
            type="button"
            className="cake__candle"
            aria-label="Blow out the candle"
            onPointerEnter={() => blow(i)}
            onPointerDown={() => blow(i)}
          >
            <span className="cake__flame">
              <Flame size={22} lit={isLit} />
            </span>
            <span
              className="cake__stick"
              style={{
                background: `linear-gradient(90deg, ${CANDLE_COLORS[i % CANDLE_COLORS.length]}, #fff7ea)`,
              }}
            />
          </button>
        ))}
      </div>

      <div className="cake__body">
        <div className="cake__tier cake__tier--top">
          <span className="cake__drip" />
        </div>
        <div className="cake__tier cake__tier--mid">
          <span className="cake__drip" />
          <span className="cake__dots" />
        </div>
        <div className="cake__tier cake__tier--bottom">
          <span className="cake__dots" />
        </div>
        <div className="cake__plate" />
      </div>
    </div>
  )
}
