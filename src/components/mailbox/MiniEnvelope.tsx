import type { CSSProperties } from 'react'
import { WaxSeal } from '../letter/WaxSeal'
import { seededRotation } from '../../hooks/useSeededRotation'
import { mailHref } from '../../lib/routes'
import './MiniEnvelope.css'

interface MiniEnvelopeProps {
  slug: string
  /** yyyy-mm-dd — printed on the envelope as its postmark. */
  date: string
  title?: string
  read: boolean
  /** Position in the stack, used to stagger the reveal. */
  index: number
}

/**
 * One letter in the rack.
 *
 * A real anchor, not a button: the hash href gives browser + Android hardware
 * back, a shareable link and middle-click for free, with no click handler and no
 * router. The closing envelope in the story stays its own component — that one
 * is a single 240px hero with a permanent breathing animation, which would read
 * as a nervous twitch repeated six times across a grid.
 */
export function MiniEnvelope({ slug, date, title, read, index }: MiniEnvelopeProps) {
  const rotation = seededRotation(slug, -2.6, 2.6)

  return (
    <a
      className={`mini-envelope ${read ? 'is-read' : 'is-unread'}`}
      href={mailHref(slug)}
      data-slug={slug}
      style={{ '--rot': `${rotation}deg`, '--i': index } as CSSProperties}
    >
      <span className="mini-envelope__paper" aria-hidden="true">
        <span className="mini-envelope__pocket" />
        <span className="mini-envelope__flap" />
        <span className="mini-envelope__seal">
          <WaxSeal broken={read} />
        </span>
      </span>

      <span className="mini-envelope__postmark">
        <time className="mini-envelope__date" dateTime={date}>
          {date}
        </time>
      </span>

      {title && <span className="mini-envelope__title">{title}</span>}

      {!read && (
        <>
          <span className="mini-envelope__dot" aria-hidden="true" />
          <span className="sr-only">unread</span>
        </>
      )}
    </a>
  )
}
