import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { config } from '../config'
import { storyReducer } from './storyReducer'
import { INITIAL_STATE, type Phase, type StoryState } from './phases'

// Where the story opens. `showIntro: false` skips the dark scene entirely —
// those phases are never entered, so no timer ever fires for them. Resolved once
// at module load rather than per render, because useReducer only ever reads its
// initial state on the first one.
//
// `flipped` stays false on purpose: it means "the switch has been flipped", and
// it hasn't. Only DarkScene reads it, and DarkScene never mounts here.
const START: StoryState =
  config.showIntro === false ? { ...INITIAL_STATE, phase: 'PARTY' } : INITIAL_STATE

// Purely time-driven transitions (callback/gesture ones live in components).
const AUTO_TIMERS: Partial<Record<Phase, { ms: number; to: Phase }>> = {
  DARK: { ms: 700, to: 'LINE1' }, // a beat of darkness before the first line
  CANDLE: { ms: 1300, to: 'SWITCH' }, // candle finishes lighting, then the switch
  SWITCH: { ms: 650, to: 'LINE2' }, // switch settles, then the hint types
  IGNITE: { ms: 1500, to: 'PARTY' }, // pop-up cascade plays out, then the party
}

export function useStoryMachine(reducedMotion: boolean) {
  const [state, dispatch] = useReducer(storyReducer, START)

  // One timer per phase; cleared whenever the phase changes.
  useEffect(() => {
    const auto = AUTO_TIMERS[state.phase]
    if (!auto) return
    const ms = reducedMotion ? Math.min(auto.ms, 300) : auto.ms
    const id = window.setTimeout(() => dispatch({ type: 'GOTO', phase: auto.to }), ms)
    return () => window.clearTimeout(id)
  }, [state.phase, reducedMotion])

  // Used by a deep link into a mailbox letter: the reader followed a link to one
  // specific letter, so the intro would be in the way. GOTO alone is enough —
  // `flipped` is only read by DarkScene, which is unmounted at PARTY, and leaving
  // audio locked is correct since there has been no gesture to unlock it with.
  const skipToParty = useCallback(() => dispatch({ type: 'GOTO', phase: 'PARTY' }), [])
  const advance = useCallback(() => dispatch({ type: 'ADVANCE' }), [])
  const flip = useCallback(() => dispatch({ type: 'FLIP' }), [])
  const ignited = useCallback(() => dispatch({ type: 'IGNITED' }), [])
  const openLetter = useCallback(() => dispatch({ type: 'OPEN_LETTER' }), [])
  const closeLetter = useCallback(() => dispatch({ type: 'CLOSE_LETTER' }), [])

  return useMemo(
    () => ({
      phase: state.phase,
      flipped: state.flipped,
      advance,
      flip,
      ignited,
      openLetter,
      closeLetter,
      skipToParty,
    }),
    [state.phase, state.flipped, advance, flip, ignited, openLetter, closeLetter, skipToParty],
  )
}
