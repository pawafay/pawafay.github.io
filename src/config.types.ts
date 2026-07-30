// Type definitions for the single user-editable config (src/config.ts).
// Kept in its own module so config.ts can be a pure data file.

export type TapeStyle = 'single' | 'cross' | 'tack'
export type PhotoShape = 'polaroid' | 'torn' | 'circle'
export type ConfettiIntensity = 'low' | 'med' | 'high'

export interface StickerConfig {
  /** Path under /public (resolved via asset()). Omit → drawn placeholder. */
  src?: string
  /** Handwritten caption shown on the tape/label. */
  caption?: string
  /** Fixed rotation in degrees; omit → stable seeded rotation. */
  rotation?: number
  tapeStyle?: TapeStyle
  shape?: PhotoShape
  /** true → a "you + friend" photo (styled slightly differently). */
  together?: boolean
}

export interface GreetingConfig {
  salutation: string
  /** A single paragraph or several. */
  body: string | string[]
  signoff: string
  /** Your name — the handwritten signature at the bottom of the letter. */
  signature?: string
}

export interface DialogueConfig {
  /** Typed in the dark, step 2. */
  darkLine: string
  /** Typed next to the switch, step 5. */
  switchHint: string
}

export interface SfxMap {
  switch?: string
  rustle?: string
  pop?: string
  whoosh?: string
  sealCrack?: string
  [k: string]: string | undefined
}

/** CSS custom-property overrides, written without the leading dashes. */
export interface ThemeOverrides {
  [cssVarWithoutDashes: string]: string
}

export interface StoryConfig {
  friendName: string
  age?: number
  /**
   * The dark intro — candle, light switch, the two typed lines.
   * `false` opens straight into the lit party. Defaults to `true`.
   *
   * With the intro off there is no switch to flip, so the music waits for the
   * first tap or key press instead (browsers refuse to start audio before a
   * gesture, whatever we do).
   */
  showIntro?: boolean
  /** Hero photo path under /public; omit → drawn placeholder. */
  heroPhoto?: string
  stickers: StickerConfig[]
  /** Background music path under /public; omit → silent. */
  musicPath?: string
  sfx?: SfxMap
  candleCount: number
  confettiIntensity?: ConfettiIntensity
  greeting: GreetingConfig
  dialogue: DialogueConfig
  theme?: ThemeOverrides
}
