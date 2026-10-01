import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import type { LetterVoice } from '../../letters.types'
import { useAudio } from '../../audio/audioContext'
import { seededRange } from '../../hooks/useSeededRotation'
import { track } from '../../lib/analytics'
import './VoiceNote.css'

/** Bars drawn for a voice note that has no waveform file. */
const DECORATIVE_BARS = 48
/** How far one arrow key moves the playhead. */
const STEP_SECONDS = 5

/**
 * The note playing right now, page-wide. Starting another stops this one: two
 * voices talking over each other is nobody's idea of a letter.
 */
let current: HTMLAudioElement | null = null

function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/**
 * A stable, speech-ish shape for a voice note dropped into a folder by hand,
 * which has no measured waveform: a slow swell with seeded jitter, so it reads
 * as a recording rather than a bar chart, and never changes between visits.
 */
function decorativePeaks(seed: string): number[] {
  const phase = seededRange(seed, 0, 6)
  return Array.from({ length: DECORATIVE_BARS }, (_, i) => {
    const swell = 0.6 + 0.3 * Math.sin((i / DECORATIVE_BARS) * Math.PI * 3 + phase)
    return Math.min(1, Math.max(0.12, swell * seededRange(`${seed}-${i}`, 0.45, 1)))
  })
}

interface VoiceNoteProps {
  voice: LetterVoice
  slug: string
  /** 1-based, among this letter's voice notes — for labels and analytics. */
  index: number
}

/**
 * A voice note taped into a letter: play/pause, its waveform, and its length.
 *
 * Nothing is downloaded until play is pressed (preload="none"); the length and
 * the bars come from the waveform file the sync workflow measured, so the card
 * looks finished without the audio. The browser then streams it, so a long note
 * starts in a moment rather than after the whole file arrives.
 */
export function VoiceNote({ voice, slug, index }: VoiceNoteProps) {
  const { unlock, setVoicePlaying } = useAudio()
  const id = useId()
  const audioRef = useRef<HTMLAudioElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const pendingSeek = useRef<number | null>(null)
  const dragging = useRef(false)
  const stats = useRef({ started: false, sent: false, maxPct: 0 })

  const [playing, setPlaying] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [failed, setFailed] = useState(false)
  const [duration, setDuration] = useState(voice.duration ?? 0)
  const [time, setTime] = useState(0)

  const peaks = useMemo(
    () => voice.peaks ?? decorativePeaks(`${slug}/${voice.name}`),
    [voice.peaks, voice.name, slug],
  )
  const tilt = seededRange(`${slug}/${voice.name}`, -1.4, 1.4)

  /** Fills the played part of the waveform. A CSS variable, not state: it runs every frame. */
  const paint = useCallback(
    (seconds: number) => {
      if (duration <= 0) return
      const ratio = Math.min(1, Math.max(0, seconds / duration))
      cardRef.current?.style.setProperty('--progress', String(ratio))
    },
    [duration],
  )

  /** One voice_finish per mount, however the listening ended. */
  const finish = useCallback(
    (reason: 'ended' | 'close' | 'pagehide') => {
      const s = stats.current
      if (!s.started || s.sent) return
      s.sent = true
      const completed = reason === 'ended'
      track('voice_finish', {
        letter_slug: slug,
        voice_index: index,
        listened_pct: completed ? 100 : s.maxPct,
        completed,
        reason,
      })
    },
    [slug, index],
  )

  // Smooth progress while playing; timeupdate only fires a few times a second.
  useEffect(() => {
    if (!playing) return
    let frame = 0
    const tick = () => {
      const el = audioRef.current
      if (el) paint(el.currentTime)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, paint])

  // Closing the letter stops the voice and gives the music back.
  useEffect(() => {
    const el = audioRef.current
    const onPageHide = () => finish('pagehide')
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      el?.pause()
      if (current === el) current = null
      setVoicePlaying(id, false)
      finish('close')
    }
  }, [finish, id, setVoicePlaying])

  const toggle = () => {
    const el = audioRef.current
    if (!el) return
    if (!el.paused) {
      el.pause()
      return
    }

    // Both inside the tap on purpose. On a letter opened from a link, this may be
    // the very first gesture — unlock() starts the music, already sunk under the
    // voice because it's registered straight after. And iOS only lets a gesture
    // wake the Web Audio context the music plays through.
    unlock()
    setVoicePlaying(id, true)

    if (current && current !== el) current.pause()
    current = el
    if (failed) {
      setFailed(false)
      el.load()
    }
    if (el.ended) el.currentTime = 0
    el.play().catch(() => setVoicePlaying(id, false))
  }

  const seek = (seconds: number) => {
    if (duration <= 0) return
    const to = Math.min(duration, Math.max(0, seconds))
    const el = audioRef.current
    // Before play nothing is loaded, so there is nowhere to seek yet: remember it
    // and apply it once the metadata arrives.
    if (el && el.readyState >= HTMLMediaElement.HAVE_METADATA) el.currentTime = to
    else pendingSeek.current = to
    setTime(to)
    paint(to)
  }

  const seekToPointer = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    if (box.width > 0) seek(((e.clientX - box.left) / box.width) * duration)
  }

  const onWaveKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const to: Record<string, number> = {
      ArrowRight: time + STEP_SECONDS,
      ArrowUp: time + STEP_SECONDS,
      ArrowLeft: time - STEP_SECONDS,
      ArrowDown: time - STEP_SECONDS,
      Home: 0,
      End: duration,
    }
    if (!(e.key in to)) return
    e.preventDefault()
    seek(to[e.key])
  }

  // The length until it's started; where it's at once it has.
  const shown = playing || time > 0 ? time : duration
  const label = failed ? "couldn't load" : duration > 0 ? clock(shown) : '–:––'

  const bars = peaks.map((h, i) => <span key={i} style={{ '--h': h } as CSSProperties} />)

  const state = [playing && 'is-playing', waiting && 'is-waiting', failed && 'is-failed']
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={`voice-note ${state}`}
      ref={cardRef}
      role="group"
      aria-label={`Voice note ${index}`}
      style={{ '--tilt': `${tilt}deg` } as CSSProperties}
    >
      <span className="voice-note__tape" aria-hidden="true" />

      <button
        type="button"
        className="voice-note__play"
        onClick={toggle}
        aria-label={`${playing ? 'Pause' : 'Play'} voice note ${index}`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {playing ? (
            <path d="M7 5.5h3.4v13H7zM13.6 5.5H17v13h-3.4z" />
          ) : (
            <path d="M8.5 5.8v12.4a.8.8 0 0 0 1.2.7l9.6-6.2a.8.8 0 0 0 0-1.4L9.7 5.1a.8.8 0 0 0-1.2.7z" />
          )}
        </svg>
      </button>

      <div
        className="voice-note__wave"
        role="slider"
        tabIndex={0}
        aria-label={`Voice note ${index} position`}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={`${clock(time)} of ${clock(duration)}`}
        onKeyDown={onWaveKey}
        onPointerDown={(e) => {
          dragging.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          seekToPointer(e)
        }}
        onPointerMove={(e) => {
          if (dragging.current) seekToPointer(e)
        }}
        onPointerUp={() => {
          dragging.current = false
        }}
        onPointerCancel={() => {
          dragging.current = false
        }}
      >
        <span className="voice-note__bars" aria-hidden="true">
          {bars}
        </span>
        <span className="voice-note__bars voice-note__bars--played" aria-hidden="true">
          {bars}
        </span>
      </div>

      <span className="voice-note__time" aria-live={failed ? 'polite' : undefined}>
        {label}
      </span>

      <audio
        ref={audioRef}
        src={voice.url}
        // A note with no waveform file needs its length from the file itself.
        preload={voice.duration ? 'none' : 'metadata'}
        onPlay={() => {
          setPlaying(true)
          setVoicePlaying(id, true)
          if (!stats.current.started) {
            stats.current.started = true
            track('voice_play', {
              letter_slug: slug,
              voice_index: index,
              voice_seconds: Math.round(duration),
            })
          }
        }}
        onPause={(e) => {
          setPlaying(false)
          setWaiting(false)
          setVoicePlaying(id, false)
          if (current === e.currentTarget) current = null
        }}
        onEnded={(e) => {
          finish('ended')
          // Back to the start, ready to be played again — like a voice memo.
          e.currentTarget.currentTime = 0
          setTime(0)
          paint(0)
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onTimeUpdate={(e) => {
          const el = e.currentTarget
          if (dragging.current) return
          setTime(el.currentTime)
          if (!el.paused && duration > 0) {
            const pct = Math.round(Math.min(1, el.currentTime / duration) * 100)
            stats.current.maxPct = Math.max(stats.current.maxPct, pct)
          }
        }}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget
          if (!voice.duration && Number.isFinite(el.duration)) setDuration(el.duration)
          if (pendingSeek.current !== null) {
            el.currentTime = pendingSeek.current
            pendingSeek.current = null
          }
        }}
        onError={() => {
          setFailed(true)
          setWaiting(false)
          setPlaying(false)
          setVoicePlaying(id, false)
        }}
      />
    </div>
  )
}
