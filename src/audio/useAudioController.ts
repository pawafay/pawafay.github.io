import { useCallback, useEffect, useRef, useState } from 'react'
import { config } from '../config'
import { asset } from '../lib/paths'

const MUSIC_VOLUME = 0.55
const SFX_VOLUME = 0.7
const FADE_MS = 600

export interface AudioApi {
  /** Has audio been unlocked by a user gesture yet. */
  ready: boolean
  /** Call SYNCHRONOUSLY inside a click/tap handler (required on iOS). */
  unlock: () => void
  /** Play a one-shot sound effect by config key. */
  playSfx: (name: string) => void
}

/** Owns background music + SFX. Autoplay-safe: nothing plays until unlock(). */
export function useAudioController(): AudioApi {
  const [ready, setReady] = useState(false)
  const musicRef = useRef<HTMLAudioElement | null>(null)
  const fadeRef = useRef(0)

  const fadeTo = useCallback((target: number) => {
    const el = musicRef.current
    if (!el) return
    window.clearInterval(fadeRef.current)
    const from = el.volume
    const start = performance.now()
    fadeRef.current = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / FADE_MS)
      el.volume = from + (target - from) * t
      if (t >= 1) window.clearInterval(fadeRef.current)
    }, 30)
  }, [])

  const unlock = useCallback(() => {
    if (!config.musicPath) return
    const src = asset(config.musicPath)
    if (!src) return
    // Reuse one element across retries so tracks never stack.
    let el = musicRef.current
    if (!el) {
      el = new Audio(src)
      el.loop = true
      el.volume = 0
      el.preload = 'auto'
      musicRef.current = el
    }
    // Already playing (or an attempt is in flight) — nothing to do.
    if (!el.paused) return
    // play() must run synchronously inside the gesture (iOS). Some browsers
    // ignore pointerdown as an audio-unlocking gesture, so if it's rejected we
    // retry on the next gesture instead of giving up (don't latch `ready`).
    el.play()
      .then(() => {
        setReady(true)
        fadeTo(MUSIC_VOLUME)
      })
      .catch(() => {
        /* not unlocked yet — a later gesture will retry */
      })
  }, [fadeTo])

  const playSfx = useCallback((name: string) => {
    const path = config.sfx?.[name]
    const src = asset(path)
    if (!src) return
    const el = new Audio(src)
    el.volume = SFX_VOLUME
    el.play().catch(() => {
      /* missing sfx — ignore */
    })
  }, [])

  // Prime the music element during the intro so play() is instant on flip
  // (the file buffers while the dark scene plays), then tidy up on unmount.
  useEffect(() => {
    if (config.musicPath && !musicRef.current) {
      const src = asset(config.musicPath)
      if (src) {
        const el = new Audio(src)
        el.loop = true
        el.volume = 0
        el.preload = 'auto'
        el.load() // begin buffering now, while the dark intro is on screen
        musicRef.current = el
      }
    }
    return () => {
      window.clearInterval(fadeRef.current)
      musicRef.current?.pause()
      musicRef.current = null
    }
  }, [])

  return { ready, unlock, playSfx }
}
