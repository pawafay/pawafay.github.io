import type { Phase, StoryAction, StoryState } from './phases'

// The linear intro chain. Time/typewriter-driven steps walk this map.
const LINEAR: Partial<Record<Phase, Phase>> = {
  DARK: 'LINE1',
  LINE1: 'CANDLE',
  CANDLE: 'SWITCH',
  SWITCH: 'LINE2',
}

export function storyReducer(state: StoryState, action: StoryAction): StoryState {
  switch (action.type) {
    case 'ADVANCE': {
      const next = LINEAR[state.phase]
      return next ? { ...state, phase: next } : state
    }
    case 'GOTO':
      return { ...state, phase: action.phase }
    case 'FLIP':
      // The switch can be flipped once it's visible (SWITCH or LINE2).
      if (state.phase === 'SWITCH' || state.phase === 'LINE2') {
        return { phase: 'IGNITE', flipped: true }
      }
      return state
    case 'IGNITED':
      return state.phase === 'IGNITE' ? { ...state, phase: 'PARTY' } : state
    case 'OPEN_LETTER':
      return state.phase === 'PARTY' ? { ...state, phase: 'LETTER' } : state
    case 'CLOSE_LETTER':
      return state.phase === 'LETTER' ? { ...state, phase: 'PARTY' } : state
    default:
      return state
  }
}
