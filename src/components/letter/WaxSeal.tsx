import './WaxSeal.css'

/** A wax seal stamped with a heart. */
export function WaxSeal({ className = '' }: { className?: string }) {
  return (
    <span className={`wax-seal ${className}`} aria-hidden="true">
      <svg viewBox="0 0 48 48" width="100%" height="100%">
        <defs>
          <radialGradient id="waxGrad" cx="38%" cy="32%" r="70%">
            <stop offset="0%" stopColor="#f0879f" />
            <stop offset="55%" stopColor="#d6406a" />
            <stop offset="100%" stopColor="#a72b50" />
          </radialGradient>
        </defs>
        {/* irregular wax blob */}
        <path
          d="M24 3c6 0 9 2 13 6s8 5 8 13-3 11-7 15-8 8-14 8-12-3-16-8-5-9-5-15 2-12 7-16 8-6 14-6Z"
          fill="url(#waxGrad)"
        />
        {/* embossed heart */}
        <path
          d="M24 32c-6-4-10-7-10-12a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 5-4 8-10 12Z"
          fill="rgba(120,20,45,0.55)"
        />
      </svg>
    </span>
  )
}
