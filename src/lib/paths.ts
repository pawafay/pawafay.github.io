// Single source of truth for resolving asset URLs.
// Every runtime asset path is prefixed with import.meta.env.BASE_URL (the active Vite
// `base` — "/" for this user site, but a sub-path like "/repo/" if it ever moves to a
// project site) so assets resolve no matter where the site is served from.
// Absolute URLs (http/https/data/blob) pass through untouched.
const ABSOLUTE = /^(?:[a-z]+:)?\/\//i

export function asset(path?: string): string | undefined {
  if (!path) return undefined
  if (ABSOLUTE.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path
  }
  const base = import.meta.env.BASE_URL // "/" — see the Vite `base` note above
  const clean = path.replace(/^\/+/, '')
  return `${base}${clean}`
}
