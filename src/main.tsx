import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Self-hosted fonts (latin subsets).
import '@fontsource-variable/fraunces/wght.css'
import '@fontsource/caveat/latin-400.css'
import '@fontsource/caveat/latin-600.css'
import '@fontsource/caveat/latin-700.css'
import '@fontsource/newsreader/latin-400.css'
import '@fontsource/newsreader/latin-500.css'
import '@fontsource/newsreader/latin-400-italic.css'
// Itim — a round, playful handwriting face that covers Thai + Latin, so the
// Thai greeting and the friend's name read cute instead of stiff-serif.
import '@fontsource/itim/latin-400.css'
import '@fontsource/itim/thai-400.css'

import './styles/theme.css'
import './styles/base.css'
import './styles/keyframes.css'

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
