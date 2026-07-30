import { useRef } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { LetterEntry } from '../../letters.types'
import type { TapeStyle } from '../../config.types'
import { useDialogTrap } from '../../hooks/useDialogTrap'
import { TapedPhoto } from '../photo/TapedPhoto'
import { InlineText } from './InlineText'
import './MailLetter.css'

/** Cycled so a row of photos never looks like a spreadsheet. */
const TAPES: TapeStyle[] = ['single', 'cross', 'tack']

interface MailLetterProps {
  letter: LetterEntry
  onClose: () => void
}

/**
 * A mailbox letter, full-screen.
 *
 * The closing envelope's Letter is a centred modal over the party; this one takes
 * the whole viewport, because it is the thing you came to read rather than an
 * interruption of something else. The keyboard contract is shared with it via
 * useDialogTrap so both behave identically for Esc, Tab and initial focus.
 */
export function MailLetter({ letter, onClose }: MailLetterProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)

  useDialogTrap(sheetRef, onClose, backRef)

  const { date, title, paragraphs, photos } = letter
  const photosDelay = 0.52 + paragraphs.length * 0.14

  return createPortal(
    <div className="mail-letter-overlay">
      <div
        className="mail-letter"
        role="dialog"
        aria-modal="true"
        aria-label={title ? `${title}, letter from ${date}` : `Letter from ${date}`}
        ref={sheetRef}
      >
        {/* The envelope mouth the paper is drawn out of. Purely scenery. */}
        <span className="mail-letter__mouth" aria-hidden="true">
          <span className="mail-letter__mouth-flap" />
        </span>

        <div className="mail-letter__sheet paper-ruled">
          <button type="button" ref={backRef} className="mail-letter__back" onClick={onClose}>
            <span aria-hidden="true">‹</span> back to the mailbox
          </button>

          <div className="mail-letter__content">
            <p className="mail-letter__postmark" style={{ animationDelay: '0.44s' }}>
              <time dateTime={date}>{date}</time>
            </p>

            {title && (
              <h3 className="mail-letter__title" style={{ animationDelay: '0.5s' }}>
                {title}
              </h3>
            )}

            {paragraphs.map((paragraph, i) => (
              <p
                key={i}
                className="mail-letter__line"
                style={{ animationDelay: `${0.56 + i * 0.14}s` }}
              >
                <InlineText text={paragraph} />
              </p>
            ))}

            {photos.length > 0 && (
              <div className={`mail-letter__photos mail-letter__photos--${photos.length}`}>
                {photos.map((photo, i) => (
                  <div
                    key={photo.name}
                    className="mail-letter__photo"
                    style={
                      { animationDelay: `${photosDelay + i * 0.12}s`, '--i': i } as CSSProperties
                    }
                  >
                    <TapedPhoto
                      resolvedSrc={photo.url}
                      shape="polaroid"
                      tapeStyle={TAPES[i % TAPES.length]}
                      seed={`${letter.slug}-${photo.name}`}
                      alt={title ? `${title} — photo ${i + 1}` : `Photo ${i + 1} from ${date}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
