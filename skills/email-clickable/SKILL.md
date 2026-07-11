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
  directory announced when this skill loads). One-time machine setup:
  `cd $TOOLS && npm install && npx playwright install chromium`.
- **Work dir:** create a fresh directory for this run (in the current working directory
  or your scratchpad) with `work/` and `output/` inside. Intermediates go in `work/`,
  finished deliverables in `output/`. Work only inside this directory.
- **Brand kit (optional):** if the user provides a brand-kit folder (a directory with
  `brand.json` — see `brand-kit/SCHEMA.md` at this repo's root; `brand-kit/example/` is
  a complete fictional sample), honor its palette, type, voice, footer and CTA rules,
  and use its `link-map.json` / `products.json` / `presets.json` / `refs/` when present.
  No kit given → ask whether one exists; otherwise proceed brand-neutral and say so in
  your final summary.
- **Photo generation** requires a [fal.ai](https://fal.ai) key in the `FAL_KEY`
  environment variable (~$0.05 per edit). Without it, photo generation refuses cleanly
  and everything else (copy, layout, resize, render) still works.

Hard rules:
- Never retouch, re-render, or re-typeset the artwork — the image is the design.
  You only cut it and wrap it in HTML.
- Never invent a destination URL. Every link comes from the kit's `link-map.json`,
  the kit's `products.json`, or an explicit user answer — anything else gets the
  brand's homepage and a `needs_review` entry.
- Work only inside your run directory.

## Inputs

Gather from the user: the email image; the brand kit (for `link-map.json`,
`products.json`, `brand.json.store.base_url` / `website`); any links they already
know (accept a pasted list); the target column width if not evident
(`node $TOOLS/imgsize.js <image>` — the image's own width is the default).

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

Cut lines sit in visual gutters — never through text or product imagery. Slice:
`node $TOOLS/slice-image.js <image> work/slice-map.json output/slices/`
Then LOOK at every slice; if a cut clips content, fix the map and re-slice.

## Stage 2 — Resolve links

For each slice, in order of preference:
1. **map** — a `link-map.json` entry whose key/label matches the slice.
2. **catalog** — a `products.json` item whose name matches the product shown
   (match conservatively; wrong product = wrong money page).
3. **user** — links the user pasted.
4. **fallback** — the brand homepage, plus a `needs_review` entry.

Write `work/links.json` aligned to `output/slices/slices.json`:
`[{ "n": 1, "href": "...", "source": "map|catalog|user|fallback" }, ...]`

## Stage 3 — Author output/email.html

Classic email-safe markup: a single centered `<table>` at the artwork width,
one `<tr>` per band; multi-cell bands use nested `<td>`s. Each cell is exactly
`<a href="..."><img src="slices/NN.jpg" width="..." style="display:block;border:0" alt="<label>"></a>`.
No CSS backgrounds, no fonts, no scripts — the slices carry all styling.
Include `role="presentation"` on tables and meaningful `alt` text per slice.

## Stage 4 — QA

`node $TOOLS/render-html-shot.js output/email.html work/shot.png <width>` then
compare `work/shot.png` against the original with vision: identical composition,
no gaps, no doubled borders. Fix and re-shoot until clean (≤3 rounds).

## Deliver

`output/` contains `email.html`, `slices/`, and `links.json`. Summarize link
sources and list every `needs_review` region for the user to fill in.
