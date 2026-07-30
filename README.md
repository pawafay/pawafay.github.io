# 🎂 A Little Surprise — Birthday Greeting Site

A static, interactive birthday surprise built as a **cut-paper pop-up book**
("Pop-Up Petang"). The page boots in candlelit dark; flip the light switch and
the whole room floods with warm gold — confetti, music, balloons, a cake you can
blow out, scrapbook photos, and a sealed letter to open.

Everything is hand-built with **inline SVG + CSS** (candle, switch, balloons,
cake, envelope, fireworks) plus `motion`, `canvas-confetti`, and self-hosted
fonts. No real assets are required to run — drawn placeholders stand in until you
drop in real photos and music.

## The flow

Dark screen → typed _"why is it so dark in here??"_ → a candle appears and lights
→ a light switch fades in → typed _"flip the switch to light up the room"_ → flip
it → light floods in with confetti + music → the birthday photo, balloons, cake,
and taped memory photos appear → an envelope at the bottom opens into a
lined-paper letter.

## Configure (the only file you edit)

Open [`src/config.ts`](src/config.ts) and change:

- `friendName`, `age`
- `showIntro` — `false` skips the dark intro and opens on the lit party
- `dialogue` — the two typed lines
- `greeting` — the letter (salutation, body paragraphs, sign-off)
- `stickers` — the scattered memory photos (captions, shapes, tape style)
- `heroPhoto`, `stickers[].src`, `musicPath`, `sfx` — asset paths
- `candleCount`, `confettiIntensity`, and optional `theme` overrides

### Skipping the intro

`showIntro: false` starts the story at the party instead of in the dark: no
candle, no light switch, no typed lines. Useful once the surprise has been seen
and the page is just the mailbox, and handy while working on the party itself.

The switch is also what unlocks the music, so with the intro off the track waits
for the first tap or key press anywhere on the page — a browser will not start
audio before a gesture no matter how it is asked. Everything else (confetti,
pop-up cascade, balloons) plays on load as usual.

### Adding real assets

Put files under `public/` (e.g. `public/photos/…`, `public/audio/…`) and point
the config paths at them, **without** a leading slash:

```ts
heroPhoto: 'photos/hero.jpg',
musicPath: 'audio/celebration.mp3',
stickers: [{ src: 'photos/us.jpg', caption: 'us together', together: true }],
```

Paths are resolved through `asset()` so they stay correct no matter what `base`
the site is served from. Leave a path out → a hand-drawn placeholder is shown and
the layout stays identical when the real photo is added later.

> Music and sound effects only start **after** the switch is flipped (a user
> gesture), which is required for autoplay on iOS.

## The mailbox

Below the closing envelope there is a rack of dated letters. Each envelope shows
its date as a postmark (`yyyy-mm-dd`); clicking one takes over the screen with the
letter drawn out of its envelope, and up to three photos taped underneath.
Envelopes you haven't opened keep an intact wax seal and an airmail edge; opened
ones show a cracked seal. That's remembered per browser, in `localStorage`.

An open letter is a real URL — `…/#/mail/<folder-name>` — so it can be linked
directly, the browser and Android back buttons close it, and a shared link skips
the intro and lands on the letter.

One letter is one folder in [`src/letters/`](src/letters/):

```
src/letters/2026-07-30-the-first-one/
  index.md      ← frontmatter + the letter
  1.jpg         ← optional, max 3, auto-detected
```

Full format notes, both authoring paths, and the gotchas are in
[`src/letters/_FORMAT.md`](src/letters/_FORMAT.md). The short version:

**Write from your phone** — open an issue labelled `surat`, drag in photos, submit.
[`sync-letters.yml`](.github/workflows/sync-letters.yml) downscales the photos,
strips their EXIF, commits the folder and triggers a deploy. It only ever acts on
issues that you both wrote and saved; anyone else's are closed untouched.

The `surat` label is the published switch: take it off and the letter comes down,
put it back and it returns unchanged. Note that coming off the site is not the
same as being erased — the letter stays in git history, and this repo is public.

**Write from the repo** — create the folder, commit, push. The folder name must
start with `yyyy-mm-dd-`.

> Letter photos are the single exception to the "assets live in `public/`" rule
> above. `public/` is copied verbatim and is invisible to `import.meta.glob`, so a
> folder in there can't be auto-detected — see the comment at the top of
> [`src/lib/letters.ts`](src/lib/letters.ts). Everything else still goes through
> `asset()`.

## Develop

```bash
bun install
bun run dev        # http://localhost:5173/      (dev is served at root)
bun run build      # tsc -b && vite build
bun run preview    # http://localhost:4173/       (mirrors production)
bun run lint       # oxlint
```

## Deploy (GitHub Pages)

This is a **user site** — the repo is named `pawafay.github.io`, so Pages serves it
from the domain root at **https://pawafay.github.io/**. `base` therefore stays at
Vite's default `'/'` and [`vite.config.ts`](vite.config.ts) needs no sub-path
handling. Renaming the repo to anything else turns it back into a project site
served from `/<repo>/`, which means setting `base: '/<repo>/'` or every asset 404s.

1. In the repo: **Settings → Pages → Build and deployment → Source = "GitHub
   Actions"**. **Do this before trusting the first deploy.** Because this repo is
   named `<login>.github.io`, GitHub turns Pages on by itself the moment you first
   push and defaults it to _"Deploy from a branch"_ — which serves the raw
   repository, so the page renders blank with a MIME-type error for
   `/src/main.tsx`. Worse, that branch build races this workflow and, finishing a
   few seconds later, silently overwrites the correct deploy. Switching Source to
   "GitHub Actions" retires the branch build for good.
   (`configure-pages` is passed `enablement: true`, which turns Pages on when it is
   off — but it will **not** convert an already-enabled site from branch to
   workflow, so it cannot save you here.)
2. Push to the `main` branch.
3. The included workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml))
   builds with Bun and deploys `dist/` automatically.

> A user site must live in a **public** repo on the free plan, and only one exists
> per account. For a custom domain, drop a `public/CNAME` file in — `base` stays `'/'`.

## Notes

- Fully responsive (mobile → ultrawide, portrait & landscape) and tuned for
  Android/iOS — `dvh` units, safe-area insets, ≥44px touch targets, pointer
  events.
- Respects `prefers-reduced-motion`: all ten story beats still play, but loops,
  parallax, and the confetti storm are toned down.
- A `#/mail/<folder>` link skips the intro and opens that letter directly, which
  is the quickest way to get to the party while working on it.
