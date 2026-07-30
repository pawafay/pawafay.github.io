# How to write a letter

Two ways. Both end up as the same thing: a folder in here.

---

## Way 1 — a GitHub issue (easiest, works from a phone)

1. Open a new issue in this repo **from your own account**.
2. Give it the label **`surat`**.
3. Title = the letter's title. Body = the letter. Drag in up to **3 photos**.
4. Submit.

[`.github/workflows/sync-letters.yml`](../../.github/workflows/sync-letters.yml)
picks it up, downloads and compresses the photos, commits the folder, and kicks
off a deploy. It comments back on the issue with the live link when it's done.

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
    1.jpg             ← optional photos, max 3
    2.jpg
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

### Photos

Drop image files straight into the letter's folder — no need to mention them
anywhere. `.jpg`, `.jpeg`, `.png`, `.webp` and `.avif` are picked up, sorted by
filename, and the **first 3** are used. Name them `1.jpg`, `2.jpg`, `3.jpg` if
you care about the order.

> A 4th image is not shown — but it **is still deployed**. Vite bundles every
> image it finds in the folder; the 3-photo cap is applied afterwards, when the
> letter is rendered. So delete the ones you don't want rather than leaving them
> lying around, or you'll ship megabytes nobody ever sees.

These photos are the one place in this project where assets live under `src/`
instead of `public/`. That's what makes the auto-detection possible — see the
comment at the top of [`src/lib/letters.ts`](../lib/letters.ts).

> Photos you commit by hand are **not** compressed or stripped of EXIF — resize
> them first, and remember phone photos carry GPS coordinates and this repo is
> public. The issue workflow does both for you automatically.

---

## If a letter doesn't appear

The loader wants a valid date and some body text. When something's off:

- **`bun run dev`** throws immediately and the error names the folder.
- **In production** the bad letter is skipped, the rest still render, and the
  reason is logged to the browser console.

So the site never breaks because of a typo in here — but check the dev server
after hand-writing a letter, because a silent skip in production is easy to miss.
