---
name: vault-setup
description: Hydrate a freshly cloned vault — report what the repo deliberately doesn't ship, re-fetch product catalogs exhaustively, and walk the user through restoring reference artwork. Use when a vault has just been cloned on a new machine, when a skill fails on a missing photo or catalog, or when a brand's catalog needs refreshing from the live store.
---

# Hydrate a cloned vault

You are the vault restore engine. Input: a vault directory that came from `git
clone`. Output: that same vault with its catalogs current and its missing
binaries either restored or explicitly accounted for — plus a short report of
anything still absent.

## Why this skill exists

The vault repos track **knowledge** and deliberately ignore **bulk**. Committed:
`brand-kit.json`, `link-map.json`, `products.json`, `profile.md`, `presets.json`,
the small `scrapes/` provenance, and the hand-extracted `assets/` brand chrome.
Ignored: binary artwork (`*.svg/jpg/png/eps/...`), raw catalog dumps
(`scrapes/shopify-products.json`), raw crawl residue, and `graphify-out/`.

That keeps a clone at single-digit MB instead of hundreds. The cost is that a
fresh clone is missing files the creative skills expect, and they'd fail late
and confusingly. This skill front-loads that discovery.

`ASSETS.json` at the vault root is the committed inventory of every ignored
file — path, size, sha256, and an `origin` saying how it comes back.

## Setup

- **Tools:** `TOOLS = <this skill's directory>/../../tools`. No `npm install`
  needed for this skill — it uses only Node built-ins.
- **Vault:** the vault directory to hydrate. If the user didn't name one, ask;
  don't guess between sibling workspaces.
- **Work dir:** a fresh scratch directory for this run. The only files you write
  *outside* it are the restored assets and refreshed catalogs themselves.

Hard rules:
- **Never invent a destination URL or a product fact.** Catalog values come from
  the live store via `catalog-fetch.js`, never from you.
- **Never fabricate a missing binary.** You cannot regenerate reference artwork
  or photography — do not substitute, redraw, or generate a stand-in. A missing
  asset stays missing and gets reported.
- Restore only into the vault being hydrated; never touch a sibling vault.
- Ask before overwriting a file that exists on disk but differs from `ASSETS.json`.

## Stage 1 — Report what's missing

    node $TOOLS/vault-manifest.js --vault <vault> --check

Exits 1 when anything is absent, and groups the missing files by brand kit with
an `origin` tag on each:

- `rescrape` — a raw store dump. Stage 2 rebuilds it.
- `manual` — artwork and photography. Only the user can supply it (Stage 3).

If `ASSETS.json` is absent the clone predates this workflow; say so and skip to
Stage 2. Show the user the grouped summary before doing any work, and confirm
which brands they actually want hydrated — a full re-scrape of every brand is
slow and usually unnecessary.

## Stage 2 — Re-fetch catalogs exhaustively

Per brand the user picked:

    node $TOOLS/catalog-fetch.js --kit <vault>/3-Resources/Brands/<slug>

This paginates `/products.json?limit=250&page=N` until a page comes back empty
or short — it stops on exhaustion, never on a page count, because a truncated
catalog silently produces "product not found" in a later creative run. It then
rewrites `scrapes/shopify-products.json` (gitignored) and refreshes
`products.json` from it.

It resolves the store URL from `--base-url`, else the kit's
`store.base_url`/`website`, else the most common origin in `link-map.json` —
some kits carry links without ever stating their own base URL.

Categories are learned from the committed `products.json`, not hardcoded: a
known handle keeps its bucket, a new one inherits the bucket most common for its
`product_type`, else `other`. Report the `+N new / -N gone` line to the user,
and flag new products landing in `other` — those need a human category call.

Preview first when the user is unsure: add `--dry-run` to report counts and
write nothing. Use `--raw-only` to rebuild just the dump and leave the curated
`products.json` untouched.

**Do not hand-edit `products.json` to paper over a failed fetch.** If the store
blocks the fetch, report that and stop — a stale committed catalog beats a
half-written one.

## Stage 3 — Restore artwork the user must supply

For every `manual` entry still missing, group by brand and by the directory it
belongs in (`Example Emails/<campaign>/`, `campaigns/<name>/Images/`, ...), then
ask **once**, in a single message — never one question per file. For each group
give the destination path, the file count, and the names, so the user can drag a
folder across and know it landed right.

Two things worth telling them, because both are recoverable:
- Reference creative (`Example Emails/`) is what `design-email` matches a rebuild
  against. Without it that skill degrades to wireframes — it still runs.
- `assets/` brand chrome (logos, icons, fonts) **is committed** and should
  already be present. If any of it is missing, that's a real problem, not an
  expected gap — flag it loudly rather than offering to redraw it.

After they've copied files in, re-run Stage 1's `--check` to confirm. Sizes are
compared against the manifest, so a truncated copy is caught here.

## Stage 4 — Rebuild the index and report

Only once the catalogs are current:

    # re-index the vault with the `graphify` skill (rebuilds graphify-out/)

Then give the user a short plain report:

- per brand: catalog count and the `+new / -gone` delta
- what was restored, and **what is still missing**, by origin
- anything that needs a human decision — new products bucketed `other`, files on
  disk whose size disagrees with the manifest

State plainly what is still absent and which skills that limits. Do not describe
the vault as fully hydrated while `--check` still exits non-zero.

## Adding a brand later

New brands need no change here. Drop the kit under `3-Resources/Brands/<slug>/`,
commit the text (the ignore rules already exclude the bulk), and regenerate the
inventory so the next clone knows what to expect:

    node $TOOLS/vault-manifest.js --vault <vault>
