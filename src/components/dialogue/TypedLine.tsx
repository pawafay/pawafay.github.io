import { useTypewriter } from '../../hooks/useTypewriter'
import './TypedLine.css'

interface TypedLineProps {
  text: string
  startWhen?: boolean
  instant?: boolean
  startDelay?: number
  speed?: number
  onDone?: () => void
  className?: string
}

/** A single handwritten line that types itself in, with a live region for SR. */
export function TypedLine({
  text,
  startWhen = true,
  instant = false,
  startDelay = 0,
  speed,
  onDone,
  className = '',
}: TypedLineProps) {
  const { shown, done } = useTypewriter(text, { startWhen, instant, startDelay, speed, onDone })

  return (
    <p className={`typed-line ${className}`} aria-label={text}>
      <span aria-hidden="true">{shown}</span>
      <span className={`typed-line__caret ${done ? 'is-done' : ''}`} aria-hidden="true">
        |
      </span>
    </p>
  )
}
