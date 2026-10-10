import { drawingRefs, stillDrying } from '../../lib/drawings'
import { SKETCHBOOK_HREF } from '../../lib/routes'
import { sentStore } from '../../lib/sketchStore'
import { PageCanvas } from './PageCanvas'
import { usePublishedDrawing } from './usePublishedDrawing'
import './SketchbookShelf.css'

/**
 * The sketchbook lying on the party wall, the newest page tucked into its cover.
 * Whether it is on the wall at all is useSketchbookOnWall's call.
 */
export function SketchbookShelf() {
  const drying = stillDrying(sentStore.use())
  const newest = drying[0]
  const latest = usePublishedDrawing(newest ? null : (drawingRefs[0]?.id ?? null))
  const cover = newest?.drawing.strokes ?? latest?.strokes ?? null
  const count = drawingRefs.length + drying.length

  return (
    <a className="sketch-shelf" href={SKETCHBOOK_HREF}>
      <span className="sketch-shelf__book">
        <span className="sketch-shelf__cover" aria-hidden="true" />
        <span className="sketch-shelf__coil" aria-hidden="true" />
        <span className="sketch-shelf__peek sketch-paper" aria-hidden="true">
          <PageCanvas strokes={cover} />
        </span>
        <span className="sketch-shelf__label">the sketchbook</span>
      </span>
      <span className="sketch-shelf__count">
        {count === 0
          ? 'blank so far — draw the first page'
          : `${count} page${count === 1 ? '' : 's'}`}
        {drying.length > 0 && ` · ${drying.length} drying`}
      </span>
    </a>
  )
}
