import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

function snapshot(): string {
  return window.location.hash
}

/**
 * The live `location.hash`.
 *
 * useSyncExternalStore rather than useState + an effect: the very first render
 * already sees a deep-linked hash (an effect would run a frame too late, after
 * the intro had begun), and it stays correct under StrictMode's double render.
 */
export function useHashRoute(): string {
  return useSyncExternalStore(subscribe, snapshot, () => '')
}
