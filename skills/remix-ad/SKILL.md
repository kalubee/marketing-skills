---
name: remix-ad
description: Deconstruct a finished ad creative, regenerate its photo per the user's instruction, and recomposite native variants at every requested size. Use when the user has a finished ad image and wants on-brand variants — a photo swap, copy tweak, or new sizes.
---

# Remix an ad

You are the ad-remix engine.

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

Gather from the user: the ad image, the change instruction, how many variants (default
3), and which sizes (ids from `$TOOLS/sizes.json`, or exact `WxH`; default to the ad's
own size via `node $TOOLS/imgsize.js`).

Hard rules:
- Rendered ad copy is NEVER model-drawn: the render pipeline burns text from
  your HTML. Copy text must match `ad_spec.json` exactly, except changes the
  instruction explicitly requests.
- Photo generation happens ONLY through `node $TOOLS/fal-edit.js`
  (below), at most 12 fal calls per run, at most 2 retries per variant.
- If `FAL_KEY` is unset and the instruction requires generating or changing
  photos, STOP and tell the user photo work needs a fal.ai key in `FAL_KEY`,
  and what still works (copy changes, resizes, layout variants). Do not
  render anything.

## Stage 1 — Deconstruct (write work/ad_spec.json)
Look at the ad image with vision. Extract:
- copy roles VERBATIM (headline, subhead, offer, cta, legal — only those present)
- layout archetype in your own words + where each element sits
- palette (bg / accent / ink as hex, sampled by eye)
- logo: crop its bounding box to `work/logo.png` via
  `node $TOOLS/crop.js <adFile> x y w h work/logo.png`, then
  `node $TOOLS/knockout.js work/logo.png work/logo_t.png`
- photo region: crop to `work/source_photo.png` (same crop tool) + one-line description
Write `work/ad_spec.json` matching `$TOOLS/lib/adspec.js`'s schema. Validate:
`node $TOOLS/checkspec.js work/ad_spec.json` must print OK.

## Stage 2 — Photo variants (skip entirely for copy/size-only instructions)
Plan the requested number of variants (default 3) as distinct photo directions
from the instruction (e.g. "swap the fridge for the stainless model" → same
staging, different angles/scenes; honor anything the user pinned). One fal
call per direction:
`node $TOOLS/fal-edit.js work/source_photo.png "<edit prompt>" work/photos/photo_NN.png`
If the user uploaded product photos, reference them in prompts descriptively
and prefer compositing them directly when the instruction says "use this
exact photo". JUDGE each result with vision; regenerate the weak ones (wrong
product, warped geometry, mangled details) — at most 2 retries per variant
and never exceed 12 fal calls total. Report kept/regenerated to the user as
you go.

## Stage 3 — Recomposite
For each variant NN and each requested size, author
`work/html/variant_NN__WxH.html` — self-contained (inline CSS, no external
fonts/CDNs; system font stack is fine), honoring the ORIGINAL ad's look
(palette, copy roles, archetype) unless the instruction asks for drift.
Reference images by RELATIVE path (`../photos/photo_NN.png`, `../logo_t.png`).
Design per aspect — a 1080×1920 story and a 336×280 rectangle are different
layouts, not scales. Keep logo/text inside a 4% safe margin.
Render everything: `node $TOOLS/render.js work/html output/`
Then LOOK at every output jpg. QA: copy exactness vs ad_spec (+requested
changes), legibility, nothing cropped, logo clean. Fix HTML and re-render
(free) until clean — at most 3 QA rounds.

## Stage 4 — Deliver
Deliverables are the files in `output/`. Final message: one line per variant
describing it (which photo direction, which sizes) and what changed vs the
original, plus anything the user should know, then DONE.
