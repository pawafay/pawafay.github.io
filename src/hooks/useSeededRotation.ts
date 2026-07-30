// Deterministic pseudo-random rotation from a string seed.
// Stable across reloads/HMR (never Math.random() at render time).

function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** A stable number in [min, max] derived from `seed`. */
export function seededRange(seed: string, min: number, max: number): number {
  const norm = (hash(seed) % 10000) / 10000
  return Math.round((min + norm * (max - min)) * 100) / 100
}

/** Stable sticker rotation in degrees, default −9°..+11°. */
export function seededRotation(seed: string, min = -9, max = 11): number {
  return seededRange(seed, min, max)
}
