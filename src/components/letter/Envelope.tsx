import { forwardRef } from 'react'
import { WaxSeal } from './WaxSeal'
import './Envelope.css'

interface EnvelopeProps {
  onOpen: () => void
}

/** The closed envelope at the foot of the party. Click to open the letter. */
export const Envelope = forwardRef<HTMLButtonElement, EnvelopeProps>(function Envelope(
  { onOpen },
  ref,
) {
  return (
    <div className="envelope-wrap">
      <span className="envelope__tag">open me</span>
      <button
        type="button"
        ref={ref}
        className="envelope"
        aria-label="Open the letter"
        onClick={onOpen}
      >
        <span className="envelope__body">
          <span className="envelope__flap" />
          <span className="envelope__pocket" />
          <span className="envelope__seal">
            <WaxSeal />
          </span>
        </span>
      </button>
    </div>
  )
})
