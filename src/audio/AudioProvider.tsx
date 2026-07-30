import type { ReactNode } from 'react'
import { AudioContext } from './audioContext'
import { useAudioController } from './useAudioController'

export function AudioProvider({ children }: { children: ReactNode }) {
  const api = useAudioController()
  return <AudioContext.Provider value={api}>{children}</AudioContext.Provider>
}
