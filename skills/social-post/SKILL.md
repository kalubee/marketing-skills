---
name: social-post
description: Design native social image posts from a brief — validated copy spec, per-size HTML, exact-size JPEG renders. Use when the user wants social creatives (feed, story, link formats) from a text brief.
---

# Design a social post

You are the social-post engine.

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

## Inputs

Gather from the user: the brief (headline/offer/CTA content — a `brief-builder`
output works well here), an optional brand kit, any product cutouts to use, and
which platform sizes to render (default: `ig-square` 1080×1080, `ig-story`
1080×1920, `fb-link` 1200×630 — add or trim to match the brief's platforms).

Like remix-ad's recomposite stage, but the source is a **brief**, not a
deconstructed ad: you compose one on-brand creative and render it **natively per
platform size** (a 1080×1080 square and a 1080×1920 story are different layouts,
not scales).

Hard rules:
- Rendered copy is NEVER model-drawn: the render pipeline burns text from your
  HTML. Copy must match `work/social_spec.json` exactly — never invent a price,
  product name, or date the brief didn't give you.
- Honor the brand kit (palette, type, CTA, safe margin) when one is given. Keep
  logo + copy inside a ~4% safe margin on every size.
- HTML is self-contained (inline CSS, system font stack, no external
  fonts/CDNs/JS).
- Photo generation ONLY through `node $TOOLS/fal-edit.js`, at most 6 fal calls
  per run. If `FAL_KEY` is unset, skip generation and use labeled placeholder
  tiles at the real dimensions instead — note it in your final summary.

## Stage 1 — Load brand + parse brief → work/social_spec.json
If a brand kit is given, read `<kit>/brand.json` for palette/type/CTA/footer
cues. Distill the brief into `work/social_spec.json` matching
`<this skill's directory>/socialspec.js`:
- `brand` — the brand kit's `id` if one was given, else a short brand-neutral
  label (e.g. `"brand-neutral"`).
- `campaign`
- `copy` — `{headline, subhead?, cta?}`, pulled from the brief verbatim.
- `sizes[]` — the platform sizes to render, each `{id, w, h}`. Default set if the
  brief doesn't specify: `ig-square 1080×1080`, `ig-story 1080×1920`,
  `fb-link 1200×630`. Add/trim to match the brief's platforms.
Validate: `node <this skill's directory>/checksocialspec.js work/social_spec.json`
→ OK. Fix and re-run until OK.

## Stage 2 — Imagery
- If product cutouts were supplied, use them (reference by relative path).
- Else if `FAL_KEY` is set: generate imagery via `node $TOOLS/fal-edit.js`
  (needs a seed image), vision-judged, at most 6 fal calls per run.
- Else (draft mode): styled placeholder tiles at the real dimensions, labeled
  with the intended shot.

## Stage 3 — Author native-per-size HTML + render
For each size, author `work/html/<size.id>__<w>x<h>.html` (the `__WxH` naming is
what the renderer expects). Design per aspect ratio — a square, a tall story, and
a wide link card are different compositions. Reference images by relative path.
Render everything: `node $TOOLS/render.js work/html output/`
Then LOOK at each output JPEG. QA: copy exact vs `social_spec.json`, nothing
clipped, logo/text inside the safe margin, legible. Fix HTML and re-render
(free) until clean — at most 3 QA rounds.

## Stage 4 — Deliver
Deliverables are the files in `output/`. Final message: one line naming the
campaign + sizes rendered, whether placeholder imagery was used, and anything
else the user should know, then DONE.
