import { Flame } from './Flame'
import './Candle.css'

interface CandleProps {
  /** Is the flame burning. */
  lit: boolean
  /** Candle (wax) height in px. */
  height?: number
}

/** The lone intro candle that appears and lights in the dark. */
export function Candle({ lit, height = 130 }: CandleProps) {
  const width = Math.round(height * 0.34)
  return (
    <div className="candle" style={{ width, height }}>
      <div className={`candle__flame ${lit ? 'is-lit' : ''}`}>
        <Flame size={Math.round(height * 0.34)} lit={lit} />
      </div>
      <div className="candle__wick" />
      <div className="candle__wax">
        <span className="candle__drip" />
        <span className="candle__sheen" />
      </div>
    </div>
  )
}
