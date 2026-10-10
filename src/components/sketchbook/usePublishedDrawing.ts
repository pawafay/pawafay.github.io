import { useEffect, useState } from 'react'
import type { DrawingFile } from '../../drawings.types'
import { loadDrawing } from '../../lib/drawings'

/**
 * A published drawing by id: undefined while it loads, null when there is no
 * such drawing or it couldn't be read, the drawing once it has arrived.
 */
export function usePublishedDrawing(id: string | null): DrawingFile | null | undefined {
  const [loaded, setLoaded] = useState<{ id: string; file: DrawingFile | null } | null>(null)

  useEffect(() => {
    if (!id) return
    let live = true
    void loadDrawing(id).then((file) => {
      if (live) setLoaded({ id, file })
    })
    return () => {
      live = false
    }
  }, [id])

  if (!id) return null
  return loaded?.id === id ? loaded.file : undefined
}
