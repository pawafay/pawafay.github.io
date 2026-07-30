import './DarkBackdrop.css'

/** The candlelit-dark room behind the intro. Glow swells once the candle lights. */
export function DarkBackdrop({ glowing }: { glowing: boolean }) {
  return (
    <div className={`dark-backdrop ${glowing ? 'is-glowing' : ''}`} aria-hidden="true">
      <div className="dark-backdrop__grain" />
      <div className="dark-backdrop__glow" />
    </div>
  )
}
