import { useState } from 'react'
import type { CSSProperties } from 'react'
import './Balloon.css'

interface BalloonProps {
  color: string
  /** position within the field */
  x: string
  y: string
  /** width in px */
  size?: number
  tilt?: number
  delay?: number
  floatDur?: number
  label?: string
  onPop?: () => void
}

/** A floating balloon you can pop for a little delight. */
export function Balloon({
  color,
  x,
  y,
  size = 78,
  tilt = 0,
  delay = 0,
  floatDur = 4,
  label,
  onPop,
}: BalloonProps) {
  const [popped, setPopped] = useState(false)

  if (popped) return null

  return (
    <button
      type="button"
      className="balloon"
      aria-label="Pop the balloon"
      style={
        {
          '--tilt': `${tilt}deg`,
          '--float-dur': `${floatDur}s`,
          left: x,
          top: y,
          width: size,
          pointerEvents: 'auto',
          animationDelay: `${delay}s`,
        } as CSSProperties
      }
      onPointerDown={() => {
        setPopped(true)
        onPop?.()
      }}
    >
      <span className="balloon__inflate">
        <svg viewBox="0 0 60 90" width="100%" height="100%">
          <defs>
            <radialGradient id={`bg-${color.replace(/[^a-z0-9]/gi, '')}`} cx="38%" cy="32%" r="70%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
              <stop offset="35%" stopColor={color} />
              <stop offset="100%" stopColor={color} />
            </radialGradient>
          </defs>
          <ellipse
            cx="30"
            cy="34"
            rx="26"
            ry="32"
            fill={`url(#bg-${color.replace(/[^a-z0-9]/gi, '')})`}
          />
          {/* knot */}
          <path d="M27 64 L33 64 L30 70 Z" fill={color} />
          {/* string */}
          <path
            d="M30 70 Q 36 80 28 90"
            stroke="rgba(90,70,45,0.6)"
            strokeWidth="1.2"
            fill="none"
          />
          {/* highlight */}
          <ellipse cx="22" cy="22" rx="6" ry="9" fill="rgba(255,255,255,0.55)" />
        </svg>
        {label && <span className="balloon__tag">{label}</span>}
      </span>
    </button>
  )
}
