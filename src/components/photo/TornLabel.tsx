import './TornLabel.css'

/** A small handwritten caption on a strip of tape/kraft. */
export function TornLabel({ text, className = '' }: { text: string; className?: string }) {
  return <span className={`torn-label ${className}`}>{text}</span>
}
