import { createContext, useContext } from 'react'
import type { AudioApi } from './useAudioController'

export const AudioContext = createContext<AudioApi | null>(null)

/** Read the shared audio controller. Must be used under <AudioProvider>. */
export function useAudio(): AudioApi {
  const ctx = useContext(AudioContext)
  if (!ctx) throw new Error('useAudio must be used within <AudioProvider>')
  return ctx
}
