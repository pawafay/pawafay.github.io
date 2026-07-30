import { useEffect, useRef, useState } from 'react'

interface TypewriterOptions {
  /** ms per character. */
  speed?: number
  /** Only begin typing once this is true. */
  startWhen?: boolean
  /** Reveal instantly (reduced motion). */
  instant?: boolean
  /** Delay before the first character (ms). */
  startDelay?: number
  /** Fired once when the full string is shown. */
  onDone?: () => void
}

/** A tiny dependency-free typewriter. Returns the revealed substring + done. */
export function useTypewriter(text: string, opts: TypewriterOptions = {}) {
  const { speed = 48, startWhen = true, instant = false, startDelay = 0, onDone } = opts
  const [count, setCount] = useState(0)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (!startWhen) {
      setCount(0)
      return
    }

    if (instant) {
      setCount(text.length)
      const id = window.setTimeout(() => onDoneRef.current?.(), 16)
      return () => window.clearTimeout(id)
    }

    setCount(0)
    let i = 0
    let intervalId = 0
    const startId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        i += 1
        setCount(i)
        if (i >= text.length) {
          window.clearInterval(intervalId)
          onDoneRef.current?.()
        }
      }, speed)
    }, startDelay)

    return () => {
      window.clearTimeout(startId)
      window.clearInterval(intervalId)
    }
  }, [text, startWhen, instant, speed, startDelay])

  return { shown: text.slice(0, count), done: count >= text.length && text.length > 0 }
}
