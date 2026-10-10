// Hash routes for the mailbox. Hash rather than path routing so GitHub Pages
// needs no 404.html SPA fallback, and so an opened letter is a real history
// entry — which is what makes the Android hardware back button close it.

const MAIL = /^#\/mail\/([A-Za-z0-9._~-]{1,80})$/

export function mailHref(slug: string): string {
  return `#/mail/${encodeURIComponent(slug)}`
}

/** The slug an open-letter hash points at, or null for any other hash. */
export function parseMailSlug(hash: string): string | null {
  const matched = MAIL.exec(hash)
  if (!matched) return null
  try {
    return decodeURIComponent(matched[1])
  } catch {
    // A lone '%' makes decodeURIComponent throw — treat it as "no route".
    return null
  }
}

// The sketchbook: #/sketchbook is the book, #/sketchbook/new a blank page,
// #/sketchbook/<id> one drawing. Ids are yyyy-mm-dd-<issue>, or sent-<issue>
// for a page this device sent that isn't deployed yet — never "new".
const SKETCH = /^#\/sketchbook(?:\/([A-Za-z0-9._~-]{1,80}))?\/?$/

export type SketchRoute = { view: 'book' } | { view: 'new' } | { view: 'page'; id: string }

export const SKETCHBOOK_HREF = '#/sketchbook'
export const NEW_PAGE_HREF = '#/sketchbook/new'

export function drawingHref(id: string): string {
  return `#/sketchbook/${encodeURIComponent(id)}`
}

/** Where in the sketchbook a hash points, or null when it is somewhere else. */
export function parseSketchRoute(hash: string): SketchRoute | null {
  const matched = SKETCH.exec(hash)
  if (!matched) return null
  if (matched[1] === undefined) return { view: 'book' }
  if (matched[1] === 'new') return { view: 'new' }
  return { view: 'page', id: matched[1] }
}

/** Swaps the current hash route for another without adding a history entry. */
export function replaceHashRoute(hash: string): void {
  window.history.replaceState(null, '', window.location.pathname + window.location.search + hash)
  window.dispatchEvent(new Event('hashchange'))
}

/**
 * Leaves the current hash route without adding a history entry.
 *
 * pushState/replaceState deliberately do NOT fire `hashchange`, so anything
 * subscribed to it would never learn the route changed and the letter would stay
 * on screen. Hence the synthetic event — the listeners ignore its payload.
 */
export function clearHashRoute(): void {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  window.dispatchEvent(new Event('hashchange'))
}
