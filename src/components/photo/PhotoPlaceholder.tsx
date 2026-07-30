import './PhotoPlaceholder.css'

interface PhotoPlaceholderProps {
  /** Label shown under the doodle. */
  label?: string
  /** Mark a "you + friend" placeholder (two figures). */
  together?: boolean
}

/** Drawn stand-in shown until a real photo is dropped into config. */
export function PhotoPlaceholder({
  label = 'your photo',
  together = false,
}: PhotoPlaceholderProps) {
  return (
    <div className="photo-ph" aria-hidden="true">
      <svg viewBox="0 0 100 100" className="photo-ph__art" preserveAspectRatio="xMidYMid slice">
        {/* sun / spotlight */}
        <circle cx="74" cy="26" r="11" fill="#f4d27a" opacity="0.8" />
        {together ? (
          <>
            <circle cx="38" cy="44" r="11" fill="#caa978" />
            <rect x="25" y="55" width="26" height="30" rx="11" fill="#caa978" />
            <circle cx="62" cy="46" r="10" fill="#b8946a" />
            <rect x="50" y="56" width="24" height="29" rx="10" fill="#b8946a" />
          </>
        ) : (
          <>
            <circle cx="50" cy="42" r="13" fill="#caa978" />
            <rect x="34" y="56" width="32" height="34" rx="13" fill="#caa978" />
          </>
        )}
      </svg>
      <span className="photo-ph__label">{label}</span>
    </div>
  )
}
