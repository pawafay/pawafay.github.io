import './Flame.css'

interface FlameProps {
  /** Visual size in px (height of the flame). */
  size?: number
  /** When false the flame is out (only a wisp of smoke). */
  lit?: boolean
  /** Extra class for positioning. */
  className?: string
}

/**
 * Shared candle flame — used by the intro candle and every cake candle.
 * Pure SVG + CSS flicker, no JS animation. Honours reduced motion via CSS.
 */
export function Flame({ size = 36, lit = true, className = '' }: FlameProps) {
  if (!lit) {
    return (
      <span
        className={`flame flame--out ${className}`}
        style={{ width: size * 0.55, height: size }}
        aria-hidden="true"
      >
        <span className="flame__smoke" />
      </span>
    )
  }

  return (
    <span
      className={`flame ${className}`}
      style={{ width: size * 0.62, height: size }}
      aria-hidden="true"
    >
      <span className="flame__glow" />
      <span className="flame__body">
        <svg viewBox="0 0 24 40" width="100%" height="100%">
          <defs>
            <radialGradient id="flameGrad" cx="50%" cy="68%" r="60%">
              <stop offset="0%" stopColor="#fffdf0" />
              <stop offset="35%" stopColor="#ffe39a" />
              <stop offset="70%" stopColor="#ff9d4d" />
              <stop offset="100%" stopColor="#e85a2a" />
            </radialGradient>
          </defs>
          {/* teardrop flame */}
          <path d="M12 1C12 1 4 11 4 22a8 8 0 0 0 16 0C20 13 12 1 12 1Z" fill="url(#flameGrad)" />
          {/* blue-hot base */}
          <ellipse cx="12" cy="27" rx="3.4" ry="6" fill="#9ad7ff" opacity="0.55" />
          {/* bright core */}
          <ellipse cx="12" cy="25" rx="2.1" ry="4.2" fill="#fffef5" opacity="0.95" />
        </svg>
      </span>
    </span>
  )
}
