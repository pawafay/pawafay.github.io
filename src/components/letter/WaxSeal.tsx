import { useId } from 'react'
import './WaxSeal.css'

interface WaxSealProps {
  className?: string
  /** Already opened: the wax is cracked in two and stops glowing. */
  broken?: boolean
}

/** A wax seal stamped with a heart. */
export function WaxSeal({ className = '', broken = false }: WaxSealProps) {
  // The gradient id has to be unique per instance: the mailbox renders one seal
  // per envelope, and duplicate ids make every url(#…) resolve to whichever one
  // happens to be first in the document — so seals lose their fill as soon as
  // the list reorders or the first envelope unmounts. useId's output contains
  // characters that aren't legal in a URL fragment, hence the scrub.
  const gid = `wax-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`
  const clipTop = `${gid}-top`
  const clipBottom = `${gid}-bottom`

  // A jagged split across the blob. Both halves are clipped from the same path,
  // then pulled apart, so the crack lines up however the seal is scaled.
  const CRACK = 'M0 20 L14 23 L22 18 L31 25 L40 21 L48 24'

  return (
    <span
      className={`wax-seal ${broken ? 'wax-seal--broken' : ''} ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" width="100%" height="100%">
        <defs>
          <radialGradient id={gid} cx="38%" cy="32%" r="70%">
            <stop offset="0%" stopColor="#f0879f" />
            <stop offset="55%" stopColor="#d6406a" />
            <stop offset="100%" stopColor="#a72b50" />
          </radialGradient>
          {broken && (
            <>
              <clipPath id={clipTop}>
                <path d={`${CRACK} L48 0 L0 0 Z`} />
              </clipPath>
              <clipPath id={clipBottom}>
                <path d={`${CRACK} L48 48 L0 48 Z`} />
              </clipPath>
            </>
          )}
        </defs>

        {broken ? (
          <>
            <g clipPath={`url(#${clipTop})`} transform="translate(-1.6 -1.4) rotate(-2 24 24)">
              <SealBlob fill={`url(#${gid})`} />
            </g>
            <g clipPath={`url(#${clipBottom})`} transform="translate(1.6 1.4) rotate(2 24 24)">
              <SealBlob fill={`url(#${gid})`} />
            </g>
          </>
        ) : (
          <SealBlob fill={`url(#${gid})`} />
        )}
      </svg>
    </span>
  )
}

/** The irregular wax blob with its embossed heart. */
function SealBlob({ fill }: { fill: string }) {
  return (
    <>
      <path
        d="M24 3c6 0 9 2 13 6s8 5 8 13-3 11-7 15-8 8-14 8-12-3-16-8-5-9-5-15 2-12 7-16 8-6 14-6Z"
        fill={fill}
      />
      <path
        d="M24 32c-6-4-10-7-10-12a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 5-4 8-10 12Z"
        fill="rgba(120,20,45,0.55)"
      />
    </>
  )
}
