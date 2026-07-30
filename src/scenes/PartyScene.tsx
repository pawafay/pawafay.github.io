import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { Phase } from '../state/phases'
import { config } from '../config'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { usePointerParallax } from '../hooks/usePointerParallax'
import { BackgroundDiorama } from '../components/background/BackgroundDiorama'
import { ConfettiController } from '../components/celebration/ConfettiController'
import { Firework } from '../components/celebration/Firework'
import { BalloonField } from '../components/balloons/BalloonField'
import { StickerLayer } from '../components/photo/StickerLayer'
import { TapedPhoto } from '../components/photo/TapedPhoto'
import { Cake } from '../components/cake/Cake'
import { Envelope } from '../components/letter/Envelope'
import { Letter } from '../components/letter/Letter'
import './PartyScene.css'

interface PartySceneProps {
  phase: Phase
  reduced: boolean
  openLetter: () => void
  closeLetter: () => void
}

export function PartyScene({ phase, reduced, openLetter, closeLetter }: PartySceneProps) {
  const bp = useBreakpoint()
  const parallax = usePointerParallax(!reduced)
  const envelopeRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  const letterOpen = phase === 'LETTER'

  // Return focus to the envelope when the letter closes.
  useEffect(() => {
    if (wasOpen.current && !letterOpen) envelopeRef.current?.focus()
    wasOpen.current = letterOpen
  }, [letterOpen])

  const heroCaption = config.age != null ? `turning ${config.age}` : 'the birthday star'

  return (
    <div
      className="party-scene"
      style={{ '--px': parallax.x, '--py': parallax.y } as CSSProperties}
    >
      <BackgroundDiorama reduced={reduced} />
      <ConfettiController reduced={reduced} intensity={config.confettiIntensity} />

      {!reduced && (
        <>
          <Firework x="26%" y="22%" color="var(--rose)" delay={0.2} />
          <Firework x="74%" y="18%" color="var(--sky)" delay={0.55} />
          <Firework x="50%" y="9%" color="var(--gold)" delay={0.95} />
        </>
      )}

      <BalloonField breakpoint={bp} />
      <StickerLayer breakpoint={bp} />

      <div className="party-scene__scroll">
        <div className="party-scene__content">
          <header className="party-scene__head pop-layer" style={{ '--i': 0 } as CSSProperties}>
            <p className="party-scene__eyebrow">happy&nbsp;birthday</p>
            <h1 className="party-scene__title">{config.friendName}</h1>
            {config.age != null && (
              <span className="party-scene__age" aria-label={`turning ${config.age}`}>
                {config.age}
              </span>
            )}
          </header>

          <div className="party-scene__hero pop-layer" style={{ '--i': 1 } as CSSProperties}>
            <TapedPhoto
              src={config.heroPhoto}
              caption={heroCaption}
              shape="polaroid"
              tapeStyle="cross"
              seed="hero"
              alt={config.friendName}
            />
          </div>

          <div className="party-scene__cake pop-layer" style={{ '--i': 2 } as CSSProperties}>
            <Cake candleCount={config.candleCount} />
          </div>

          <div className="party-scene__envelope pop-layer" style={{ '--i': 3 } as CSSProperties}>
            <Envelope ref={envelopeRef} onOpen={openLetter} />
          </div>
        </div>
      </div>

      {letterOpen && <Letter onClose={closeLetter} />}
    </div>
  )
}
