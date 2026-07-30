import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// This ships as a GitHub Pages *user site* (repo: pawafay/pawafay.github.io), which is
// served from the domain root. So `base` stays at Vite's default "/" everywhere — `vite`
// dev, `vite build` and `vite preview` all agree and no mode-dependent branching is needed.
// asset() reads import.meta.env.BASE_URL, so every runtime asset path follows the same base.
// Moving back to a project site (served from "/<repo>/") means setting `base` here; nothing
// else in the app hardcodes a path.
export default defineConfig({
  plugins: [react()],
})
