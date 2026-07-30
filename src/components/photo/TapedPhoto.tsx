import type { CSSProperties } from 'react'
import { asset } from '../../lib/paths'
import { seededRotation } from '../../hooks/useSeededRotation'
import type { PhotoShape, TapeStyle } from '../../config.types'
import { PhotoPlaceholder } from './PhotoPlaceholder'
import { TornLabel } from './TornLabel'
import './TapedPhoto.css'

interface TapedPhotoProps {
  src?: string
  caption?: string
  shape?: PhotoShape
  tapeStyle?: TapeStyle
  /** Explicit rotation; omit for a stable seeded one. */
  rotation?: number
  together?: boolean
  /** Seed for deterministic rotation when `rotation` is absent. */
  seed: string
  /** Alt text for real photos. */
  alt?: string
  className?: string
}

/** Shared taped/scrapbook photo — powers the hero photo and every sticker. */
export function TapedPhoto({
  src,
  caption,
  shape = 'polaroid',
  tapeStyle = 'single',
  rotation,
  together = false,
  seed,
  alt,
  className = '',
}: TapedPhotoProps) {
  const rot = rotation ?? seededRotation(seed)
  const resolved = asset(src)

  return (
    <figure
      className={`taped-photo taped-photo--${shape} ${className}`}
      style={{ '--rot': `${rot}deg` } as CSSProperties}
    >
      <Tape style={tapeStyle} />

      <div className="taped-photo__frame">
        <div className="taped-photo__window">
          {resolved ? (
            <img src={resolved} alt={alt ?? caption ?? ''} loading="lazy" />
          ) : (
            <PhotoPlaceholder together={together} />
          )}
        </div>

        {shape === 'polaroid' && caption && (
          <figcaption className="taped-photo__strip">{caption}</figcaption>
        )}
      </div>

      {shape !== 'polaroid' && caption && (
        <figcaption className="taped-photo__tag">
          <TornLabel text={caption} />
        </figcaption>
      )}
    </figure>
  )
}

function Tape({ style }: { style: TapeStyle }) {
  if (style === 'tack') {
    return <span className="tape tape--tack" aria-hidden="true" />
  }
  if (style === 'cross') {
    return (
      <span aria-hidden="true">
        <span className="tape tape--strip tape--left" />
        <span className="tape tape--strip tape--right" />
      </span>
    )
  }
  return <span className="tape tape--strip tape--single" aria-hidden="true" />
}
