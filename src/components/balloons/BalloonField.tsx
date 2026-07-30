import type { CSSProperties } from 'react'
import type { Breakpoint } from '../../hooks/useBreakpoint'
import { useAudio } from '../../audio/audioContext'
import { Balloon } from './Balloon'

interface Slot {
  x: string
  y: string
  color: string
  size: number
  tilt: number
  floatDur: number
  label?: string
}

// Curated, non-overlapping positions kept clear of the central hero/cake column.
const SLOTS: Slot[] = [
  { x: '6%', y: '20%', color: '#e8728c', size: 84, tilt: -8, floatDur: 4.2, label: 'HBD!' },
  { x: '86%', y: '16%', color: '#6db5c9', size: 92, tilt: 7, floatDur: 5 },
  { x: '15%', y: '54%', color: '#c9a24b', size: 70, tilt: -5, floatDur: 4.6 },
  { x: '82%', y: '52%', color: '#7faa78', size: 76, tilt: 6, floatDur: 3.8 },
  { x: '3%', y: '40%', color: '#9b7ad1', size: 64, tilt: -10, floatDur: 5.4 },
  { x: '92%', y: '36%', color: '#ff9d4d', size: 68, tilt: 9, floatDur: 4.4 },
  { x: '24%', y: '12%', color: '#7faa78', size: 60, tilt: -6, floatDur: 4.9 },
]

const COUNT: Record<Breakpoint, number> = { mobile: 4, tablet: 6, desktop: 7 }

/** Floating, poppable balloons scattered around the edges. */
export function BalloonField({ breakpoint }: { breakpoint: Breakpoint }) {
  const audio = useAudio()
  const slots = SLOTS.slice(0, COUNT[breakpoint])
  const scale = breakpoint === 'mobile' ? 0.74 : 1

  return (
    <div
      className="balloon-field"
      style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' } as CSSProperties}
    >
      {slots.map((s, i) => (
        <Balloon
          key={i}
          color={s.color}
          x={s.x}
          y={s.y}
          size={Math.round(s.size * scale)}
          tilt={s.tilt}
          delay={i * 0.12}
          floatDur={s.floatDur}
          label={s.label}
          onPop={() => audio.playSfx('pop')}
        />
      ))}
    </div>
  )
}
