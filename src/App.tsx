import { lazy, Suspense, useCallback, useEffect } from 'react'
import { AudioProvider } from './audio/AudioProvider'
import { useAudio } from './audio/audioContext'
import { useReducedMotionPref } from './hooks/useReducedMotionPref'
import { useStoryMachine } from './state/useStoryMachine'
import { StoryStage } from './components/ui/StoryStage'
import { DarkScene } from './scenes/DarkScene'
import { preloadPartyAssets } from './lib/preload'

const PartyScene = lazy(() =>
  import('./scenes/PartyScene').then((m) => ({ default: m.PartyScene })),
)

function StoryExperience() {
  const reduced = useReducedMotionPref()
  const machine = useStoryMachine(reduced)
  const audio = useAudio()
  const { phase, flipped } = machine

  const lit = phase === 'IGNITE' || phase === 'PARTY' || phase === 'LETTER'
  const showDark = phase !== 'PARTY' && phase !== 'LETTER'
  const showParty = phase === 'IGNITE' || phase === 'PARTY' || phase === 'LETTER'

  // Audio unlocks here — synchronous, inside the flip gesture (iOS-safe).
  const handleFlip = useCallback(() => {
    audio.unlock()
    audio.playSfx('switch')
    machine.flip()
  }, [audio, machine])

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
