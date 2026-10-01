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
/** The Audio Session API — Safari 16.4+, not in TypeScript's DOM lib yet. */
type SessionNavigator = Navigator & { audioSession?: { type: string } }

/**
 * Owns background music + SFX. Autoplay-safe: nothing plays until unlock().
 *
 * The music is decoded into memory and played through Web Audio, not an <audio>
 * element, and both halves of that are for iOS:
 *
 *   - Its loudness can only be changed there through a GainNode — iOS makes
 *     HTMLMediaElement.volume read-only, so every fade, and sinking under a voice
 *     note, was silently a no-op and the track just played at full volume.
 *   - The other way to reach a GainNode, routing the element through
 *     createMediaElementSource, is the one path WebKit keeps breaking on iOS:
 *     silent on 17.0.x, crackling or choppy on earlier releases. A decoded buffer
 *     has none of that history, and loops without a gap besides.
 *
 * The track is under a megabyte, so holding it decoded costs little.
 */
export function useAudioController(): AudioApi {
  const [ready, setReady] = useState(false)
  const ctxRef = useRef<AudioContext | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const bytesRef = useRef<Promise<ArrayBuffer> | null>(null)
  /** The track has been asked to start — set once, cleared only if starting fails. */
  const startedRef = useRef(false)
  const voicesRef = useRef(new Set<string>())
  const unduckRef = useRef(0)

  /** Where the music should sit right now. */
  const level = useCallback(() => (voicesRef.current.size > 0 ? DUCK_VOLUME : MUSIC_VOLUME), [])

  /**
   * The track's bytes, fetched once. Kicked off on mount so they're in hand by
   * the time the switch is flipped; decoding has to wait for the first gesture,
   * because that is when the context it decodes into may be created.
   */
  const fetchMusic = useCallback((): Promise<ArrayBuffer> | null => {
    if (bytesRef.current) return bytesRef.current
    const src = config.musicPath ? asset(config.musicPath) : undefined
    if (!src) return null
    const bytes = fetch(src).then((response) => {
      if (!response.ok) throw new Error(`music: HTTP ${response.status}`)
      return response.arrayBuffer()
    })
    bytesRef.current = bytes
    bytes.catch(() => {
      bytesRef.current = null // a network hiccup — the next unlock fetches again
    })
    return bytes
  }, [])

  const fadeTo = useCallback((target: number, ms = FADE_MS) => {
    const ctx = ctxRef.current
    const gain = gainRef.current
    if (!ctx || !gain) return
    // Start the ramp from wherever the gain is right now, even mid-fade, so a
    // duck that interrupts a fade-in doesn't jump.
    const param = gain.gain
    const now = ctx.currentTime
    param.cancelScheduledValues(now)
    param.setValueAtTime(param.value, now)
    param.linearRampToValueAtTime(target, now + ms / 1000)
  }, [])

  /** Wakes the context. Only succeeds inside a gesture on iOS, so call it from one. */
  const wake = useCallback(() => {
    const ctx = ctxRef.current
    if (!ctx || ctx.state === 'running') return
    ctx.resume().catch(() => {
      /* not allowed yet — a later gesture will retry */
    })
    // Some iOS releases only count the gesture once a sound has actually started
    // inside it. One silent sample is the long-standing way to make it count.
    const blip = ctx.createBufferSource()
    blip.buffer = ctx.createBuffer(1, 1, 22050)
    blip.connect(ctx.destination)
    blip.start(0)
  }, [])

  const unlock = useCallback(() => {
    if (!config.musicPath) return

    let ctx = ctxRef.current
    if (!ctx) {
      const Context = window.AudioContext ?? (window as LegacyWindow).webkitAudioContext
      if (!Context) return
      // Web Audio on iOS defaults to the "ambient" session, which the ringer
      // switch mutes — a plain <audio> never was. "playback" keeps the music
      // behaving like the <audio> it used to be. Must be set before the context
      // exists.
      const session = (navigator as SessionNavigator).audioSession
      if (session) session.type = 'playback'
      try {
        ctx = new Context()
      } catch {
        return
      }
      const gain = ctx.createGain()
      gain.gain.value = 0
      gain.connect(ctx.destination)
      ctxRef.current = ctx
      gainRef.current = gain

      // The context may only start running on a later gesture than the one that
      // made it — or come back after iOS interrupted it.
      const created = ctx
      created.addEventListener('statechange', () => {
        if (created.state === 'running' && startedRef.current) setReady(true)
      })
    }

    wake()

    // Already playing (or an attempt is in flight) — nothing more to do.
    if (startedRef.current) return
    const bytes = fetchMusic()
    if (!bytes) return
    startedRef.current = true

    const context = ctx
    bytes
      // slice(): decoding detaches the buffer it is given, and a retry after a
      // failed decode needs the bytes intact. The callback form is the one every
      // Safari supports; the promise form only arrived in 14.1.
      .then(
        (data) =>
          new Promise<AudioBuffer>((resolve, reject) =>
            context.decodeAudioData(data.slice(0), resolve, reject),
          ),
      )
      .then((buffer) => {
        const source = context.createBufferSource()
        source.buffer = buffer
        source.loop = true
        source.connect(gainRef.current ?? context.destination)
        source.start()
        // The fade is scheduled on the context's clock, so if it isn't running
        // yet the music fades in the moment it does.
        fadeTo(level())
        if (context.state === 'running') setReady(true)
      })
      .catch(() => {
        startedRef.current = false // a later gesture will retry
      })
  }, [fadeTo, fetchMusic, level, wake])

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
      if (playing) {
        window.clearTimeout(unduckRef.current)
        voices.add(id)
        wake()
        fadeTo(DUCK_VOLUME, DUCK_MS)
        return
      }
      // A note that wasn't playing stopping (a closed letter tidying up) changes
      // nothing — and mustn't cancel another note's pending return to full.
      if (!voices.delete(id) || voices.size > 0) return
      window.clearTimeout(unduckRef.current)
      unduckRef.current = window.setTimeout(() => fadeTo(MUSIC_VOLUME, UNDUCK_MS), UNDUCK_DELAY_MS)
    },
    [fadeTo, wake],
  )

  useEffect(() => {
    // Fetch the track during the intro so starting it after the flip only has
    // to decode, not download.
    fetchMusic()

    // iOS interrupts audio contexts when the tab is hidden, the phone locks or a
    // call comes in, and doesn't reliably bring them back. Resuming needs a
    // gesture there, so any tap after an interruption brings the music back —
    // App's own unlock listeners are gone by then, once `ready` latched.
    const wakeIfStarted = () => {
      if (startedRef.current) wake()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') wakeIfStarted()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('touchend', wakeIfStarted, { passive: true })
    window.addEventListener('click', wakeIfStarted, { passive: true })
    window.addEventListener('keydown', wakeIfStarted, { passive: true })

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('touchend', wakeIfStarted)
      window.removeEventListener('click', wakeIfStarted)
      window.removeEventListener('keydown', wakeIfStarted)
      window.clearTimeout(unduckRef.current)
      ctxRef.current?.close().catch(() => {})
      ctxRef.current = null
      gainRef.current = null
      startedRef.current = false
    }
  }, [fetchMusic, wake])

  return { ready, unlock, playSfx, setVoicePlaying }
}
