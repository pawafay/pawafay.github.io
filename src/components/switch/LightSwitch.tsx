import './LightSwitch.css'

interface LightSwitchProps {
  flipped: boolean
  onFlip: () => void
}

/**
 * Wall light switch. The single gate before the room lights up.
 * onFlip fires on click — synchronously, so audio can unlock on iOS. We use
 * click (not pointerdown) because click reliably counts as the user gesture
 * that unlocks audio playback across browsers; pointerdown is ignored by some
 * (e.g. iOS Safari), which would leave the music silent on the main flow.
 * Click also covers keyboard activation (Enter/Space fire click).
 */
export function LightSwitch({ flipped, onFlip }: LightSwitchProps) {
  return (
    <button
      type="button"
      className={`light-switch ${flipped ? 'is-on' : ''}`}
      aria-label="Light switch"
      aria-pressed={flipped}
      onClick={() => {
        if (!flipped) onFlip()
      }}
    >
      <span className="light-switch__plate">
        <span className="light-switch__screw light-switch__screw--tl" />
        <span className="light-switch__screw light-switch__screw--br" />
        <span className="light-switch__slot">
          <span className="light-switch__rocker">
            <span className="light-switch__rocker-face" />
          </span>
        </span>
      </span>
      <span className="light-switch__halo" aria-hidden="true" />
    </button>
  )
}
