import type { DrawingTool } from '../../drawings.types'

/**
 * The pencil case — picked from the party's own paper, balloons and confetti so
 * a page pinned up beside them looks like it belongs. No white: on cream paper
 * it vanishes, and the eraser is the way to take ink off.
 */
export const INKS = [
  { name: 'Ink', hex: '#3a2c22' },
  { name: 'Berry', hex: '#b23a5b' },
  { name: 'Rose', hex: '#e8728c' },
  { name: 'Ember', hex: '#ef8a3a' },
  { name: 'Sunflower', hex: '#f2bd3d' },
  { name: 'Sage', hex: '#6f9e68' },
  { name: 'Sky', hex: '#4fa3bf' },
  { name: 'Grape', hex: '#8f6fc9' },
] as const

/** Fine, medium, bold — in page units, so a page looks the same on any screen. */
export const NIBS: Record<DrawingTool, readonly [number, number, number]> = {
  pen: [5, 11, 22],
  marker: [16, 30, 54],
  eraser: [18, 42, 84],
}

export const NIB_NAMES = ['Fine', 'Medium', 'Bold'] as const
