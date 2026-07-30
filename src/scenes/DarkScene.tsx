import { useEffect, useRef } from 'react'
import { DarkBackdrop } from '../components/background/DarkBackdrop'
import { Candle } from '../components/candle/Candle'
import { TypedLine } from '../components/dialogue/TypedLine'
import { LightSwitch } from '../components/switch/LightSwitch'
import { DrawArrow } from '../components/switch/DrawArrow'
import { config } from '../config'
import type { Phase } from '../state/phases'
import './DarkScene.css'

const INTRO_ORDER: Phase[] = ['DARK', 'LINE1', 'CANDLE', 'SWITCH', 'LINE2', 'IGNITE']

interface DarkSceneProps {
  phase: Phase
  flipped: boolean
  reduced: boolean
  /** advance LINE1 → CANDLE (after the line finishes + a beat). */
  advance: () => void
  /** flip the switch (also unlocks audio). */
  onFlip: () => void
}

export function DarkScene({ phase, flipped, reduced, advance, onFlip }: DarkSceneProps) {
  const idx = INTRO_ORDER.indexOf(phase)
  const reached = (p: Phase) => idx >= INTRO_ORDER.indexOf(p)
  const holdRef = useRef(0)

  const line1Visible = phase === 'LINE1' || phase === 'CANDLE'
  const line2Visible = phase === 'LINE2' || phase === 'IGNITE'
  const candleVisible = reached('CANDLE')
  const switchVisible = reached('SWITCH')
  const arrowShow = phase === 'SWITCH' || phase === 'LINE2'
  const igniting = phase === 'IGNITE'

  useEffect(() => () => window.clearTimeout(holdRef.current), [])

  return (
    <div className={`dark-scene ${igniting ? 'is-igniting' : ''}`}>
      <DarkBackdrop glowing={candleVisible} />

      <div className="dark-scene__stack">
        <div className="dark-scene__dialogue">
          {line1Visible && (
            <TypedLine
              text={config.dialogue.darkLine}
              startWhen
              instant={reduced}
              startDelay={reduced ? 0 : 250}
              onDone={() => {
                window.clearTimeout(holdRef.current)
                holdRef.current = window.setTimeout(advance, reduced ? 200 : 650)
              }}
            />
          )}
          {line2Visible && (
            <TypedLine
              text={config.dialogue.switchHint}
              startWhen
              instant={reduced}
              className="dark-scene__hint"
            />
          )}
        </div>

        <div className={`dark-scene__candle ${candleVisible ? 'is-visible' : ''}`}>
          <Candle lit={candleVisible} />
        </div>

        <div className={`dark-scene__switch ${switchVisible ? 'is-visible' : ''}`}>
          <span className="dark-scene__arrow">
            <DrawArrow show={arrowShow} />
          </span>
          <LightSwitch flipped={flipped} onFlip={onFlip} />
        </div>
      </div>
    </div>
  )
}
