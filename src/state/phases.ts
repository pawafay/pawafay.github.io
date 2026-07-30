// Story phases as a string-literal union (no `enum` — erasableSyntaxOnly).

export const PHASES = [
  'DARK', // black screen, a beat of nothing
  'LINE1', // typed: "why is it so dark in here??"
  'CANDLE', // a candle appears and lights
  'SWITCH', // a clickable light switch fades in
  'LINE2', // typed: "flip the switch to light up the room"
  'IGNITE', // switch flipped → pop-up cascade + light flood
  'PARTY', // hero photo, balloons, cake, stickers, envelope
  'LETTER', // the opened letter overlay
] as const

export type Phase = (typeof PHASES)[number]

export interface StoryState {
  phase: Phase
  /** Whether the switch has been flipped (audio unlocked, room lit). */
  flipped: boolean
}

export type StoryAction =
  | { type: 'ADVANCE' } // linear intro step (DARK→LINE1→CANDLE→SWITCH→LINE2)
  | { type: 'GOTO'; phase: Phase }
  | { type: 'FLIP' } // user flipped the switch
  | { type: 'IGNITED' } // pop-up cascade finished
  | { type: 'OPEN_LETTER' }
  | { type: 'CLOSE_LETTER' }

export const INITIAL_STATE: StoryState = { phase: 'DARK', flipped: false }
