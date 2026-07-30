import { seededRange } from '../../hooks/useSeededRotation'
import './BackgroundDiorama.css'

const BUNTING_COLORS = ['var(--rose)', 'var(--sage)', 'var(--sky)', 'var(--gold)', 'var(--grape)']

/** The lit paper room: back wall, floor fold (gutter), bunting, and bokeh. */
export function BackgroundDiorama({ reduced }: { reduced: boolean }) {
  const flags = Array.from({ length: 9 })
  const bokeh = reduced ? [] : Array.from({ length: 14 })

  return (
    <div className="diorama" aria-hidden="true">
      <div className="diorama__wall" />
      <div className="diorama__floor" />
      <div className="diorama__gutter" />
      <div className="diorama__vignette" />

      {/* bunting garland across the top */}
      <svg className="diorama__bunting" viewBox="0 0 100 16" preserveAspectRatio="none">
        <path d="M0 2 Q 50 10 100 2" stroke="rgba(90,70,45,0.5)" strokeWidth="0.4" fill="none" />
      </svg>
      <div className="diorama__flags">
        {flags.map((_, i) => (
          <span
            key={i}
            className="diorama__flag"
            style={{
              left: `${4 + i * 11.5}%`,
              top: `${seededRange(`flag${i}`, 1, 6)}%`,
              background: BUNTING_COLORS[i % BUNTING_COLORS.length],
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </div>

      {/* soft bokeh light motes */}
      {bokeh.map((_, i) => (
        <span
          key={i}
          className="diorama__bokeh"
          style={{
            left: `${seededRange(`bx${i}`, 2, 96)}%`,
            top: `${seededRange(`by${i}`, 6, 78)}%`,
            width: `${seededRange(`bs${i}`, 6, 18)}px`,
            height: `${seededRange(`bs${i}`, 6, 18)}px`,
            animationDelay: `${seededRange(`bd${i}`, 0, 4)}s`,
          }}
        />
      ))}
    </div>
  )
}
