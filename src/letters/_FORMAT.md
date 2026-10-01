# How to write a letter

Two ways. Both end up as the same thing: a folder in here.

---

## Way 1 — a GitHub issue (easiest, works from a phone)

1. Open a new issue in this repo **from your own account**.
2. Give it the label **`surat`**.
3. Title = the letter's title. Body = the letter. Drag in photos (up to **10**)
   and voice notes (**.mp3** or **.wav**, as many as you like) **wherever you
   want them to appear** — between two paragraphs, after the first line, at the
   very end. The letter shows them in exactly that order.
4. Submit.

[`.github/workflows/sync-letters.yml`](../../.github/workflows/sync-letters.yml)
picks it up, downloads the photos and voice notes, commits the folder, and kicks
off a deploy. It comments back on the issue with the live link when it's done.

The text is optional: a letter can be just a photo, or just a voice note.

### What happens to your files

- **Photos** are resized to at most 1600px and stripped of their metadata
  (phone photos carry GPS coordinates, and this repo is public).
- **Voice notes are never re-encoded** — the voice that plays is the voice you
  recorded:
  - an **.mp3** is kept exactly as it is. Only its ID3 tags (title, recorder
    app, that kind of metadata) are cut off; the audio itself is untouched.
  - a **.wav** is kept as a WAV, its audio copied across sample for sample.
    Only its metadata is dropped, same as the MP3 tags.

  (Not converted to FLAC, even though that's lossless and half the size:
  GitHub Pages serves .flac with a type iPhones aren't guaranteed to play.)
- The workflow also measures each voice note's **length and waveform**, so the
  player looks complete before anything is downloaded. Nothing is: a voice note
  only starts loading when play is pressed, and it streams, so even a long one
  starts straight away.

GitHub only accepts **.mp3** and **.wav** audio in issues, up to 25 MB each.
Voice memos from an iPhone are .m4a — convert them to .mp3 first.

The date on the envelope is the date the **issue** was created, in Asia/Jakarta
time. Editing the issue later updates the same letter — it won't create a
duplicate — so fixing a typo or adding a photo afterwards is fine.

Issues opened by anyone else are ignored entirely: the workflow checks the author
against the repo owner before it runs a single step. That check is the only thing
standing between the outside world and this mailbox, so don't loosen it.

### Taking one back down

**Remove the `surat` label.** The letter comes off the site within a minute. Put
the label back and it returns — same date, same URL, same place in the rack,
because the date comes from when the issue was *created*, not from today. The
label is the published switch, nothing more.

Only letters written by an issue can be removed this way; they're found by the
`issue:` key in their frontmatter, so a letter you committed by hand is never
touched. To remove one of those, delete its folder and push.

> **Off the site is not erased.** The letter stays in this repo's git history and
> the repo is public, so anyone who digs through old commits can still read it —
> photos included. The issue and its uploaded images stay on GitHub too. If
> something must never be readable by anyone else, don't send it through here in
> the first place; there is no undo that reaches far enough.

---

## Way 2 — commit a folder yourself

```
src/letters/
  2026-07-30-the-first-one/
    index.md          ← the letter
    1.jpg             ← optional photos, max 10
    2.jpg
    voice-1.mp3       ← optional voice notes (.mp3 or .wav)
    voice-1.json      ← optional: its length and waveform
```

The folder name **must** start with `yyyy-mm-dd-`. That date is what shows on the
envelope.

`index.md`:

```markdown
---
title: The first one
---

A line ends where you end it.
This shows up on its own line, not tacked onto the one above.

A blank line starts a new paragraph, with more space above it.

You can use **bold** and *italic*. Nothing else: no links, no headings,
no HTML. Anything else shows up as literal text.
```

Line breaks are kept exactly as typed — unlike markdown, which would reflow a
single newline into the line before it. Only a *blank* line makes a new
paragraph. Same when you write the letter as an issue: the letter lands on the
site laid out the way you typed it into GitHub.

### Frontmatter keys

| Key     | Required | Notes                                                            |
| ------- | -------- | ---------------------------------------------------------------- |
| `title` | no       | Shown above the letter. Leave it out and only the date shows.     |
| `date`  | no       | Overrides the folder-name date. Must be `yyyy-mm-dd`.            |
| `issue` | no       | Written by the workflow so edits find the right folder. Don't touch. |

### The order they appear in

Newest at the top of the rack. Letters sharing a date are ordered by issue
number — GitHub only ever counts up, so that is the order you wrote them in.

A letter committed by hand has no issue number and so nothing to compare with;
it sits after the issue-written letters of the same day. If that matters, give
it a `date` a day later, or write it as an issue instead.

### Photos and voice notes

Drop the files into the letter's folder. Images are `.jpg`, `.jpeg`, `.png`,
`.webp` and `.avif`; voice notes are `.mp3` and `.wav`.

To put one at a particular spot in the letter, write an **embed line** there —
`![](` + the filename + `)`:

```markdown
Hiii, I recorded something for you

![](voice-1.mp3)

and here's where I recorded it:

![](1.jpg)
![](2.jpg)

see you soon
```

Photos on consecutive lines share a row. That's how the issue workflow writes
every letter now.

A file that no embed line places still shows up, **after** the letter: voice
notes first, then photos, sorted by filename (name them `1.jpg`, `2.jpg` … if you
care about the order). That's also how every letter written before embeds
existed keeps looking exactly the way it did.

At most **10 photos** are shown.

> An 11th image is not shown — but it **is still deployed**. Vite bundles every
> image it finds in the folder; the photo cap is applied afterwards, when the
> letter is rendered. So delete the ones you don't want rather than leaving them
> lying around, or you'll ship megabytes nobody ever sees.

A voice note's `.json` (same name, e.g. `voice-1.json`) holds its length and
waveform:

```json
{ "duration": 42.31, "peaks": [0.12, 0.4, 0.86, "… one number 0–1 per bar"] }
```

The issue workflow writes it for you. Without one the player draws decorative
bars, and the browser reads the length from the file itself.

These files are the one place in this project where assets live under `src/`
instead of `public/`. That's what makes the auto-detection possible — see the
comment at the top of [`src/lib/letters.ts`](../lib/letters.ts).

> Files you commit by hand are **not** processed — photos aren't resized or
> stripped of EXIF, voice notes keep their tags. Remember phone photos carry GPS
> coordinates and this repo is public. The issue workflow does all of it for
> you automatically.

---

## If a letter doesn't appear

The loader wants a valid date, and some text or at least one photo or voice
note. An embed line naming a file that isn't in the folder loses just that one
piece, not the letter. When something's off:

- **`bun run dev`** throws immediately and the error names the folder.
- **In production** the bad letter is skipped, the rest still render, and the
  reason is logged to the browser console.

So the site never breaks because of a typo in here — but check the dev server
after hand-writing a letter, because a silent skip in production is easy to miss.
