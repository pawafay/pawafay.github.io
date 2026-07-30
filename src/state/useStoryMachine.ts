import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { storyReducer } from './storyReducer'
import { INITIAL_STATE, type Phase } from './phases'

// Purely time-driven transitions (callback/gesture ones live in components).
const AUTO_TIMERS: Partial<Record<Phase, { ms: number; to: Phase }>> = {
  DARK: { ms: 700, to: 'LINE1' }, // a beat of darkness before the first line
  CANDLE: { ms: 1300, to: 'SWITCH' }, // candle finishes lighting, then the switch
  SWITCH: { ms: 650, to: 'LINE2' }, // switch settles, then the hint types
  IGNITE: { ms: 1500, to: 'PARTY' }, // pop-up cascade plays out, then the party
}

export function useStoryMachine(reducedMotion: boolean) {
  const [state, dispatch] = useReducer(storyReducer, INITIAL_STATE)

  // One timer per phase; cleared whenever the phase changes.
  useEffect(() => {
    const auto = AUTO_TIMERS[state.phase]
    if (!auto) return
    const ms = reducedMotion ? Math.min(auto.ms, 300) : auto.ms
    const id = window.setTimeout(() => dispatch({ type: 'GOTO', phase: auto.to }), ms)
    return () => window.clearTimeout(id)
  }, [state.phase, reducedMotion])

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
    }),
    [state.phase, state.flipped, advance, flip, ignited, openLetter, closeLetter],
  )
}
