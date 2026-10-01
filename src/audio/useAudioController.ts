import { useCallback, useEffect, useRef, useState } from 'react'
import { config } from '../config'
import { asset } from '../lib/paths'

const MUSIC_VOLUME = 0.55
/** The music under a voice note: still there, but well out of the voice's way. */
const DUCK_VOLUME = 0.12
const SFX_VOLUME = 0.7
const FADE_MS = 600
const DUCK_MS = 400
const UNDUCK_MS = 800
/**
 * How long the music waits before coming back up. Going from one voice note
 * straight to the next pauses the first a moment before the second starts, and
 * without this the music would swell into that gap and straight back down.
 */
const UNDUCK_DELAY_MS = 250

export interface AudioApi {
  /** Has audio been unlocked by a user gesture yet. */
  ready: boolean
  /** Call SYNCHRONOUSLY inside a click/tap handler (required on iOS). */
  unlock: () => void
  /** Play a one-shot sound effect by config key. */
  playSfx: (name: string) => void
  /**
   * A voice note started or stopped; the music sinks under it while any plays.
   * Call it with `true` inside the play tap, where iOS will let it wake Web Audio.
   */
  setVoicePlaying: (id: string, playing: boolean) => void
}

/** Safari before 14.1 only ships the prefixed constructor. */
type LegacyWindow = Window & { webkitAudioContext?: typeof AudioContext }
/** The Audio Session API — Safari 17+, not in TypeScript's DOM lib yet. */
type SessionNavigator = Navigator & { audioSession?: { type: string } }

interface MusicGraph {
  ctx: AudioContext
  gain: GainNode
}

/**
 * Owns background music + SFX. Autoplay-safe: nothing plays until unlock().
 *
 * The music's loudness is set through a Web Audio GainNode rather than the
 * element's own volume, because iOS makes HTMLMediaElement.volume read-only —
 * there, every fade (and ducking under a voice note) was silently a no-op and
 * the track simply played at full volume. If Web Audio can't be set up, the
 * element volume is still used, so other browsers lose nothing.
 */
export function useAudioController(): AudioApi {
  const [ready, setReady] = useState(false)
  const musicRef = useRef<HTMLAudioElement | null>(null)
  const graphRef = useRef<MusicGraph | null>(null)
  const graphTriedRef = useRef(false)
  const fadeRef = useRef(0)
  const voicesRef = useRef(new Set<string>())
  const unduckRef = useRef(0)

  /** Where the music should sit right now. */
  const level = useCallback(() => (voicesRef.current.size > 0 ? DUCK_VOLUME : MUSIC_VOLUME), [])

  const fadeTo = useCallback((target: number, ms = FADE_MS) => {
    const graph = graphRef.current
    if (graph) {
      // Start the ramp from wherever the gain is right now, even mid-fade, so a
      // duck that interrupts a fade-in doesn't jump.
      const param = graph.gain.gain
      const now = graph.ctx.currentTime
      param.cancelScheduledValues(now)
      param.setValueAtTime(param.value, now)
      param.linearRampToValueAtTime(target, now + ms / 1000)
      return
    }
    const el = musicRef.current
    if (!el) return
    window.clearInterval(fadeRef.current)
    const from = el.volume
    const start = performance.now()
    fadeRef.current = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / ms)
      el.volume = from + (target - from) * t
      if (t >= 1) window.clearInterval(fadeRef.current)
    }, 30)
  }, [])

  /** The music is audible: latch `ready` and bring it up to where it belongs. */
  const settle = useCallback(() => {
    setReady(true)
    fadeTo(level())
  }, [fadeTo, level])

  /**
   * Routes the music element through a GainNode — once, and inside a gesture,
   * because a context created anywhere else starts suspended. From here on the
   * element plays at full volume and the gain is the only volume control.
   */
  const connectGraph = useCallback(
    (el: HTMLAudioElement) => {
      if (graphTriedRef.current) return
      graphTriedRef.current = true
      const Context = window.AudioContext ?? (window as LegacyWindow).webkitAudioContext
      if (!Context) return
      try {
        // Web Audio on iOS defaults to the "ambient" session, which the ringer
        // switch mutes — a plain <audio> never was. "playback" keeps the music
        // behaving as it did before it was routed through here.
        const session = (navigator as SessionNavigator).audioSession
        if (session) session.type = 'playback'

        const ctx = new Context()
        const gain = ctx.createGain()
        gain.gain.value = 0
        ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination)
        window.clearInterval(fadeRef.current) // a fallback fade must not fight the gain
        el.volume = 1
        graphRef.current = { ctx, gain }

        // The context may start running only on a later gesture (or come back
        // after iOS interrupted it). Whenever it does, the music is audible.
        ctx.addEventListener('statechange', () => {
          if (ctx.state === 'running' && !el.paused) settle()
        })
      } catch {
        graphRef.current = null
      }
    },
    [settle],
  )

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

    connectGraph(el)
    const ctx = graphRef.current?.ctx
    // Retried on every gesture until it takes: a browser that won't count this
    // one as a gesture leaves the context suspended, and the music silent.
    if (ctx && ctx.state !== 'running') {
      ctx.resume().catch(() => {
        /* not allowed yet — a later gesture will retry */
      })
    }

    // Already playing (or an attempt is in flight) — nothing to do.
    if (!el.paused) return
    // play() must run synchronously inside the gesture (iOS). Some browsers
    // ignore pointerdown as an audio-unlocking gesture, so if it's rejected we
    // retry on the next gesture instead of giving up (don't latch `ready`).
    el.play()
      .then(() => {
        // With Web Audio, playing isn't the same as audible: a suspended context
        // swallows it, and the statechange listener settles once it runs.
        if (!ctx || ctx.state === 'running') settle()
      })
      .catch(() => {
        /* not unlocked yet — a later gesture will retry */
      })
  }, [connectGraph, settle])

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

  const setVoicePlaying = useCallback(
    (id: string, playing: boolean) => {
      const voices = voicesRef.current
      window.clearTimeout(unduckRef.current)
      if (playing) {
        voices.add(id)
        const ctx = graphRef.current?.ctx
        if (ctx && ctx.state !== 'running') {
          ctx.resume().catch(() => {
            /* not allowed outside a gesture — the play tap is one */
          })
        }
        fadeTo(DUCK_VOLUME, DUCK_MS)
        return
      }
      voices.delete(id)
      if (voices.size > 0) return
      unduckRef.current = window.setTimeout(() => fadeTo(MUSIC_VOLUME, UNDUCK_MS), UNDUCK_DELAY_MS)
    },
    [fadeTo],
  )

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

    // iOS interrupts audio contexts when the tab is hidden or the phone locks,
    // and doesn't always bring them back on its own.
    const onVisible = () => {
      const ctx = graphRef.current?.ctx
      if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') {
        ctx.resume().catch(() => {
          /* a later gesture will retry */
        })
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(fadeRef.current)
      window.clearTimeout(unduckRef.current)
      musicRef.current?.pause()
      musicRef.current = null
      graphRef.current?.ctx.close().catch(() => {})
      graphRef.current = null
      graphTriedRef.current = false
    }
  }, [])

  return { ready, unlock, playSfx, setVoicePlaying }
}
