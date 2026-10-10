import { drawingRefs } from '../../lib/drawings'
import { sketchRepo } from '../../lib/github'
import { keyStore, sentStore } from '../../lib/sketchStore'

/**
 * Whether the sketchbook belongs on the party wall: once there is something in
 * it, or on a device that can draw the first page. Until then it stays out of
 * the party entirely — an empty book on a birthday wall reads as an unfinished
 * one. #/sketchbook works either way, which is how a key gets entered at all.
 */
export function useSketchbookOnWall(): boolean {
  const key = keyStore.use()
  const sent = sentStore.use()
  return sketchRepo !== null && (drawingRefs.length > 0 || sent.length > 0 || key !== null)
}
