# The sketchbook

Pages drawn right on the site, at **https://pawafay.github.io/#/sketchbook**, and
pinned up for everyone. Each finished page ends up as a file in this folder.

Anyone can look. Only a device holding a **key** can draw and send a page.

---

## Keys

Two GitHub keys, both made on the **pawafay** account: one for you, one for
Pawa. One each, so either can be cancelled without touching the other.

The `gambar` label the pages arrive with makes itself, the first time a key is
checked or a page is sent. Nothing to set up there.

### Making a key

These links open GitHub's form already filled in: name, owner `pawafay`,
365 days, and **Issues: Read and write**. Change the expiry if you like; when it
runs out, the site says the key stopped working.

- [Your key](https://github.com/settings/personal-access-tokens/new?name=sketchbook-mine&description=Draw+in+the+sketchbook+on+pawafay.github.io&target_name=pawafay&expires_in=365&issues=write)
- [Pawa's key](https://github.com/settings/personal-access-tokens/new?name=sketchbook-pawa&description=Pawa%27s+sketchbook+key%2C+locked+behind+her+questions&target_name=pawafay&expires_in=365&issues=write)

**The one thing a link can't fill in:** under **Repository access**, choose
_Only select repositories_ → `pawafay/pawafay.github.io`. Then **Generate
token** and copy it. It starts with `github_pat_`, and GitHub only shows it
once.

(By hand instead: https://github.com/settings/personal-access-tokens/new →
resource owner `pawafay` → only `pawafay/pawafay.github.io` → Repository
permissions → Issues: Read and write. Nothing else; _Metadata: Read-only_ adds
itself.)

### Yours: paste it as it is

Open the sketchbook, tap **"have a key? unlock drawing on this device"**, then
**"have a GitHub key instead?"**, and paste it. Your pages are signed with
`sketchbookOwnerName` in [`src/config.ts`](../config.ts), which is
`someone 😼`, the same as your letter. Change it there if you like.

### Pawa's: locked behind her questions

She never sees the GitHub key. The site asks her the questions, and her
answers unlock the key behind them, signed **Pawa**.

1. Make her key (above) and copy it.
2. In the repo folder, from **PowerShell or Windows Terminal** (Git Bash's
   own window can't hide what you type), run:
   ```
   bun run lock-key
   ```
   It asks for the name (`Pawa`), the key, then each question as the site
   should word it, with its answer twice. The key and answers are not shown on
   screen. It checks the key with GitHub, including that it can post here, and
   saves nothing if anything is off.
3. Commit and push **`src/sketchbook-keys.json`**. Once the site has deployed,
   the questions appear in the sketchbook's unlock box.

**How answers are matched:** capitals, spaces and `@` are ignored, so `Rex`,
`rex ` and `@rex` are all the same answer. Everything else must match.

New key, or new questions? Run `bun run lock-key` again with the same name. It
replaces her old lock.

**How safe are the answers?** The locked key ships inside the public site,
questions and all, so anyone can download it and try answers on their own
computer, as fast as they like, with no lockout. A pet's name or a game
username keeps out strangers, but not someone who knows her or looks her up:
usernames are public, and common pet names are the first thing anyone would
try. That's the trade for not having to remember anything. The key's expiry
and the delete button below are the backstop.

### Either key

The device can draw from then on. The unlocked key stays in that browser only
and is only ever sent to GitHub. **"Forget the key"** at the bottom of the
sketchbook removes it from the device.

**Cancelling a key:** https://github.com/settings/personal-access-tokens → the
token → Delete. The device's next send fails with "that key doesn't work any
more". For Pawa's, make a new one and run `bun run lock-key` again.

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
