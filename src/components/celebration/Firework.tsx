import type { CSSProperties } from 'react'
import './Firework.css'

interface FireworkProps {
  /** position as CSS values, e.g. '20%' */
  x: string
  y: string
  color: string
  delay?: number
  rays?: number
}

/** A single CSS spark-burst. Plays a couple of times then rests. */
export function Firework({ x, y, color, delay = 0, rays = 14 }: FireworkProps) {
  return (
    <div
      className="firework"
      style={{ left: x, top: y, '--c': color } as CSSProperties}
      aria-hidden="true"
    >
      {Array.from({ length: rays }).map((_, i) => (
        <span
          key={i}
          className="firework__ray"
          style={{ rotate: `${i * (360 / rays)}deg`, animationDelay: `${delay}s` } as CSSProperties}
        >
          <span className="firework__spark" />
        </span>
      ))}
    </div>
  )
}
