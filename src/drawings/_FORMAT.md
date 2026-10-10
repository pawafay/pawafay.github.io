# The sketchbook

Pages drawn right on the site, at **https://pawafay.github.io/#/sketchbook**, and
pinned up for everyone. Each finished page ends up as a file in this folder.

Anyone can look. Only a device holding a **key** can draw and send a page.

---

## Giving someone a key (you, or a friend you trust)

Do this once per person, on the **pawafay** account. One key each, so you can
cancel one without touching the other.

0. **The first time only:** make the label. Repo → Issues → Labels → New label,
   name it **`gambar`**. (Sent pages arrive as issues with this label; without
   it, nothing gets published, and the site will say so.)
1. Open https://github.com/settings/personal-access-tokens/new
2. **Token name:** `sketchbook — <their name>`. **Expiration:** whatever you like.
   When it runs out, the site tells them the key stopped working.
3. **Resource owner:** `pawafay`.
4. **Repository access:** _Only select repositories_ → `pawafay/pawafay.github.io`.
5. **Permissions → Repository permissions → Issues: _Read and write_.**
   Nothing else. (_Metadata: Read-only_ is added by itself; leave it.)
6. **Generate token** and copy it. It starts with `github_pat_`, and GitHub only
   shows it once.
7. Send it to them privately. They open the sketchbook, tap **"have a key?
   unlock drawing on this device"**, paste it, and type the name their pages
   should be signed with.

That device can draw from then on. The key stays in that browser only and is
only ever sent to GitHub. **"Forget the key"** at the bottom of the sketchbook
removes it from the device.

**Cancelling a key:** https://github.com/settings/personal-access-tokens → the
token → Delete. Their next send fails with "that key doesn't work any more".

### What a key can and can't do

It can only work with **issues** on this one repo. It cannot touch the site's
code, its workflows or any other repo.

But within issues it acts **as you**. Whoever holds it could post a page, and
could also open or edit a `surat` letter, because to GitHub that is you doing
it. So give keys only to people you'd trust with that, and delete one the
moment a phone is lost.

Keys made on any other account are refused twice: the site checks the account
when the key is pasted, and the workflow only accepts issues opened by the
repo owner.

---

## What happens when a page is sent

1. The site opens an issue titled `🖍️ <name> — by <who>`, labelled `gambar`. The
   drawing is inside it as a `drawing` code block (deflated, base64). Nothing
   else in the issue matters.
2. [`sync-drawings.yml`](../../.github/workflows/sync-drawings.yml) checks the
   issue is yours, then
   [`sync-drawing.mjs`](../../.github/scripts/sync-drawing.mjs) unpacks the
   drawing, checks every value and rebuilds it from scratch. It commits
   `yyyy-mm-dd-<issue>.json` here and deploys.
3. It comments the link on the issue. About a minute later the page is on the
   site for everyone.

The device that sent it doesn't wait: the page shows in its sketchbook straight
away with a **drying…** tag, which goes once the deployed site has it.

An unfinished page is saved on the device after every stroke. Leaving, or the
phone locking, loses nothing: **keep drawing** picks it up.

## Taking one down

**Remove the `gambar` label** from its issue, the same as `surat` for letters.
Put the label back and it returns, same date, same place.

The repo is public, so a page taken down is still in git history and in the
issue. Taking it off the site is not erasing it.

## The files

`yyyy-mm-dd-<issue>.json`: the date the issue was opened (Asia/Jakarta), then
the issue number. One stroke per line, so a diff reads stroke by stroke.
Prettier leaves this folder alone on purpose.

```jsonc
{
  "v": 1,
  "issue": 51,
  "date": "2026-10-10",
  "by": "David",
  "caption": "a sunny day for you 🌻",
  "width": 800,          // the page is always 800 × 1000 units
  "height": 1000,
  "strokes": [
    // tool: pen | marker | eraser. size is in page units. points is a flat
    // [x, y, pressure 0–100, …]. pressure: true only for a real stylus.
    {"tool":"pen","color":"#3a2c22","size":11,"pressure":false,"points":[120,90,50,124,96,50]}
  ]
}
```

The limits (strokes, points, caption length) live in
[`src/lib/drawingFormat.ts`](../lib/drawingFormat.ts) and are mirrored in
`sync-drawing.mjs`. Change both together.

## One thing to know about `pawafay.github.io`

The key is kept in the browser's storage for `pawafay.github.io`. On a
`<login>.github.io` site, that storage is shared by every GitHub Pages site on
the account (`pawafay.github.io/<any-repo>`). That's fine while this is the only
one. Before publishing another repo's Pages site under this account, remember
that its scripts could read the key.
