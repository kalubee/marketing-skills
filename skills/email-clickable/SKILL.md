---
name: email-clickable
description: Turn a finished flat email image into deployable clickable HTML — pixel-accurate slices, resolved links, table-based markup any ESP accepts. Use when the user has a designed email as a JPEG/PNG and needs the coded, clickable version.
---

# Clickable email from a flat image

You are the email-coding engine. The user gives you a finished email design as a
single flat image; you hand back sliced assets plus a self-contained, table-based
HTML file where every region links to the right destination.

## Setup

- **Tools:** `TOOLS = <this skill's directory>/../../tools` (resolve against the base
  directory announced when this skill loads). One-time machine setup, only if
  `$TOOLS/node_modules` is missing: `cd $TOOLS && npm install` (installs `sharp` —
  no browser/render server needed).
- **Work dir:** create a fresh directory for this run (in the current working directory
  or your scratchpad) with `work/` and `output/` inside. Intermediates go in `work/`,
  finished deliverables in `output/`. Work only inside this directory.
- **Brand kit (optional):** if the user provides a brand-kit folder (a directory with
  `brand.json` or `brand-kit.json` — read that file, don't hunt for a separate
  schema doc), honor its palette, type, voice, footer and CTA rules,
  and use its `link-map.json` / `products.json` / `presets.json` / `refs/` when present.
  No kit given → ask whether one exists; otherwise proceed brand-neutral and say so in
  your final summary.

Hard rules:
- Never retouch, re-render, or re-typeset the artwork — the image is the design.
  You only cut it and wrap it in HTML.
- Never invent a destination URL. Every link comes from the kit's `link-map.json`,
  the kit's `products.json`, or an explicit user answer — anything else gets the
  brand's homepage and a `needs_review` entry.
- Work only inside your run directory.

## Inputs

Gather from the user: the email image; the brand kit path (`KIT = <that path>`, for
`link-map.json`, `products.json`, the kit file's `store.base_url` / `website`); any links
they already know (accept a pasted list); the target column width if not evident
(`node -e "require('sharp')('<image>').metadata().then(m=>console.log(m.width,m.height))"`
— the image's own width is the default).

`KIT` is exactly one brand's folder for this entire run — resolve it once here and
reuse it in Stage 2. Never glob or search across other brands' kits.

## Stage 1 — Author the slice map (look, then measure)

Study the image with vision. Identify horizontal bands (hero, offer band, product
rows, notice strips, footer) and, inside product rows, the per-product cells.
Write `work/slice-map.json`:

    { "width": <image px width>,
      "bands": [
        { "module": "hero", "key": "hero", "label": "Hero — Fall Sale", "top": 0, "bottom": 620 },
        { "module": "product_row", "top": 620, "bottom": 1080,
          "cells": [
            { "key": "prod-1", "label": "Harlow Sofa", "left": 0, "right": 362 },
            { "key": "prod-2", "label": "Nordholm Bed", "left": 362, "right": 724 }
          ] },
        { "module": "footer", "key": "footer", "top": 1080, "bottom": 1400 }
      ] }

Cut lines sit in visual gutters — never through text or product imagery. Slice every
region out of the original with `sharp` in ONE node process driven by
`work/slice-map.json`, so every slice's box comes from the same numbers the HTML will
use and you don't pay a process startup per slice (a full-width module uses
`left:0, right:<image width>`):
`cd $TOOLS && node -e "const s=require('sharp');const m=require('<abs work/slice-map.json>');(async()=>{for(const b of m.bands){for(const c of (b.cells||[{key:b.key,left:0,right:m.width}])){const box={left:c.left,top:b.top,width:c.right-c.left,height:b.bottom-b.top};await s('<abs image>').extract(box).png().toFile('<abs output/slices>/'+c.key+'.png');console.log(c.key,box.width+'x'+box.height)}}})()"` **Never re-encode or retouch the pixels — extract
only; the image is the design.**
Then LOOK at every slice; if a cut clips content, fix the map and re-slice.

## Stage 2 — Resolve links

`link-map.json` and `products.json` can run to hundreds of entries for a large
catalog brand — never Read either file whole. Query `$KIT` with `jq` per slice and
only pull the matched entries into context. Both files live only under `$KIT`; every
query below is scoped to `$KIT` alone, never any other brand's kit.

For each slice, in order of preference:
1. **map** — query `link-map.json` for a key or label matching the slice's `key`/
   `label` (case-insensitive substring, no whole-file read):
   `jq --arg q "<slice key or a keyword from its label>" \
     '.entries | to_entries[] | select((.key|test($q;"i")) or (.value.label|test($q;"i")))' \
     "$KIT/link-map.json"`
   Zero hits → fall through to catalog. Multiple hits → pick the closest label match,
   never guess past two ambiguous candidates (send to `needs_review` instead).
2. **catalog** — query `products.json` for a name matching the product shown (match
   conservatively; wrong product = wrong money page):
   `jq --arg q "<product name/keyword from the slice, e.g. the model name shown>" \
     '[.[] | select(.name|test($q;"i"))]' "$KIT/products.json"`
   Narrow the query (fuller product name) before broadening it — a query returning
   more than ~10 hits is too generic to trust; tighten it rather than reading them all.
3. **user** — links the user pasted.
4. **fallback** — the brand homepage, plus a `needs_review` entry.

Write `work/links.json` aligned to `output/slices/slices.json`:
`[{ "n": 1, "href": "...", "source": "map|catalog|user|fallback" }, ...]`

## Stage 3 — Author output/email.html

Classic email-safe markup: a single centered `<table>` at the artwork width,
one `<tr>` per band; multi-cell bands use nested `<td>`s. Each cell is exactly
`<a href="..."><img src="slices/NN-<module>.jpg" width="..." style="display:block;border:0" alt="<label>"></a>`
— use each slice's `file` field from `slices.json` rather than guessing the name.
No CSS backgrounds, no fonts, no scripts — the slices carry all styling.
Include `role="presentation"` on tables and meaningful `alt` text per slice.

## Stage 4 — QA

There is no browser in this toolchain, so the HTML itself can't be screenshotted.
Verify the slice geometry instead — which is what actually breaks:

1. **Reassemble and diff.** Composite every slice back onto a blank canvas at the exact
   `left`/`top` the HTML places it, then compare against the original:
   `cd $TOOLS && node -e "const s=require('sharp');s({create:{width:W,height:H,channels:3,background:'#fff'}}).composite([{input:'slices/hero.png',left:0,top:0}, ...]).png().toFile('work/reassembled.png')"`
   A correct slice map reproduces the original pixel-for-pixel. Gaps, doubled rows, or a
   shifted module show up immediately as seams or ghosting.
2. **Arithmetic check.** Every module's `bottom` equals the next module's `top` (no gap,
   no overlap); each row's columns sum to the full width; the last module's `bottom`
   equals the image height. Slice widths in the HTML must match the extracted PNGs'
   real dimensions — read them back with `sharp().metadata()`, don't trust the map.
3. **LOOK at `work/reassembled.png`** next to the original with vision: identical
   composition, no gaps, no doubled borders.
Fix the map, re-slice, and re-diff until clean (≤3 rounds). Note in your summary that
the HTML was verified by slice-reassembly, not by a browser render — an ESP/inbox
preview is still worth a human's eyes before send.

## Deliver

`output/` contains `email.html`, `slices/`, and `links.json`. Summarize link
sources and list every `needs_review` region for the user to fill in.
