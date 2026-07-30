import './DrawArrow.css'

/** A hand-drawn arrow that draws itself in, nudging toward the switch. */
export function DrawArrow({ show }: { show: boolean }) {
  return (
    <svg
      className={`draw-arrow ${show ? 'is-drawing' : ''}`}
      viewBox="0 0 120 90"
      fill="none"
      aria-hidden="true"
    >
      {/* curved shaft */}
      <path
        className="draw-arrow__shaft"
        d="M14 12 C 50 6, 96 18, 96 64"
        stroke="#ffcf8a"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* arrowhead */}
      <path
        className="draw-arrow__head"
        d="M82 52 L96 68 L108 50"
        stroke="#ffcf8a"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
