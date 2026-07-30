// Warm every party asset while the dark intro is still playing, so the reveal
// after the light switch is instant. We deliberately trade a heavier initial
// load for zero delay once the switch is flipped: the code-split PartyScene
// chunk, the hero photo, and the sticker photos are all fetched up-front.
// (Audio is primed separately in useAudioController so play() is instant too.)
import { config } from '../config'
import { asset } from './paths'

let started = false

export function preloadPartyAssets(): void {
  if (started) return
  started = true

  // 1. The code-split party scene (its JS + CSS). Resolves to the same chunk
  //    App.tsx lazy-loads, so the later render is already in cache.
  import('../scenes/PartyScene').catch(() => {
    /* network hiccup — the lazy import will retry on render */
  })

  // 2. Every photo the party will show (hero + stickers) into the image cache.
  const sources = [config.heroPhoto, ...config.stickers.map((s) => s.src)]
  for (const src of sources) {
    const url = asset(src)
    if (!url) continue
    const img = new Image()
    img.decoding = 'async'
    img.src = url
  }
}
