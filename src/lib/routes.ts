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
