import { lazy, Suspense, useCallback, useEffect } from 'react'
import { AudioProvider } from './audio/AudioProvider'
import { useAudio } from './audio/audioContext'
import { useHashRoute } from './hooks/useHashRoute'
import { useReducedMotionPref } from './hooks/useReducedMotionPref'
import { useStoryMachine } from './state/useStoryMachine'
import { StoryStage } from './components/ui/StoryStage'
import { DarkScene } from './scenes/DarkScene'
import { parseMailSlug } from './lib/routes'
import { preloadPartyAssets } from './lib/preload'

const PartyScene = lazy(() =>
  import('./scenes/PartyScene').then((m) => ({ default: m.PartyScene })),
)

function StoryExperience() {
  const reduced = useReducedMotionPref()
  const machine = useStoryMachine(reduced)
  const audio = useAudio()
  const { phase, flipped } = machine

  const mailSlug = parseMailSlug(useHashRoute())

  const lit = phase === 'IGNITE' || phase === 'PARTY' || phase === 'LETTER'
  const showDark = phase !== 'PARTY' && phase !== 'LETTER'
  const showParty = phase === 'IGNITE' || phase === 'PARTY' || phase === 'LETTER'

  // Someone followed a link to one specific letter — put them in front of it
  // rather than at the start of a minute-long intro.
  useEffect(() => {
    if (mailSlug && !showParty) machine.skipToParty()
  }, [mailSlug, showParty, machine])

  // Never stack two letters: a mail route wins over the closing envelope.
  useEffect(() => {
    if (mailSlug && phase === 'LETTER') machine.closeLetter()
  }, [mailSlug, phase, machine])

  // Audio unlocks here — synchronous, inside the flip gesture (iOS-safe).
  const handleFlip = useCallback(() => {
    audio.unlock()
    audio.playSfx('switch')
    machine.flip()
  }, [audio, machine])

  // Flipping the switch is what unlocks the music — but there is no switch when
  // `config.showIntro` is false, and none was flipped when a mailbox link
  // dropped someone straight into the party. Fall back to the first gesture
  // anywhere, which is the least a browser will accept. unlock() is a no-op once
  // the track is playing, and it deliberately leaves `ready` false when play()
  // is rejected, so a browser that won't count pointerdown gets another go.
  const { ready: audioReady, unlock: unlockAudio } = audio
  useEffect(() => {
    if (!showParty || audioReady) return
    const tryUnlock = () => unlockAudio()
    window.addEventListener('pointerdown', tryUnlock)
    window.addEventListener('keydown', tryUnlock)
    return () => {
      window.removeEventListener('pointerdown', tryUnlock)
      window.removeEventListener('keydown', tryUnlock)
    }
  }, [showParty, audioReady, unlockAudio])

  // Warm every party asset while the dark intro plays, so flipping the switch
  // reveals the party (photos, code, music) with no delay.
  useEffect(() => {
    preloadPartyAssets()
  }, [])

  // Reflect the lit room to the browser chrome.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', lit ? '#f6ead2' : '#14110f')
  }, [lit])

  return (
    <StoryStage lit={lit}>
      {showDark && (
        <DarkScene
          phase={phase}
          flipped={flipped}
          reduced={reduced}
          advance={machine.advance}
          onFlip={handleFlip}
        />
      )}

      {showParty && (
        <Suspense fallback={null}>
          <PartyScene
            phase={phase}
            reduced={reduced}
            openLetter={machine.openLetter}
            closeLetter={machine.closeLetter}
          />
        </Suspense>
      )}
    </StoryStage>
  )
}

export default function App() {
  return (
    <AudioProvider>
      <StoryExperience />
    </AudioProvider>
  )
}
