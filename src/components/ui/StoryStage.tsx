import type { CSSProperties, ReactNode } from 'react'
import { config } from '../../config'
import './StoryStage.css'

// config.theme → inline CSS custom properties on the stage root.
function themeVars(): CSSProperties {
  const vars: Record<string, string> = {}
  if (config.theme) {
    for (const [k, v] of Object.entries(config.theme)) vars[`--${k}`] = v
  }
  return vars as CSSProperties
}

/**
 * The fixed full-viewport root. Owns the master `--lit` value (0 dark → 1 lit)
 * and the 3D perspective the pop-up cascade stands up within.
 */
export function StoryStage({ lit, children }: { lit: boolean; children: ReactNode }) {
  return (
    <div className={`stage-root story-stage ${lit ? 'is-lit' : ''}`} style={themeVars()}>
      {children}
    </div>
  )
}
