---
name: remake-ad
description: Clone a reference ad's exact style with new copy and imagery — style constant, content variable. Use when the user has an ad whose look they want reused for a different product, offer, or campaign.
---

# Remake an ad

You are the ad-remake engine.

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

Gather from the user: the reference ad (the FIRST image — this is the style
donor), the new message (what the remade ad should say — headline/offer/CTA
content, prices, product name, dates), any new product photos to use, and
which sizes (ids from `$TOOLS/sizes.json`, or exact `WxH`; default to the
reference ad's own size via `node $TOOLS/imgsize.js`).

The job: the user has an ad that works, and wants the SAME ad — same layout,
same palette, same type treatment, same energy — selling something else. Style
is copied; copy and imagery are new. This differs from remix-ad (which keeps
the copy and changes the photo per instruction): here the **style is the
constant and the content is the variable**.

Hard rules:
- Rendered copy is NEVER model-drawn: the render pipeline burns text from your
  HTML. Copy must match `work/remake_spec.json` exactly — every price, product
  name, and date verbatim from the new message; never invent or round one.
- Photo generation ONLY through `node $TOOLS/fal-edit.js`, at most 12 fal
  calls per run.
- The reference ad's style is authoritative: do not "improve" its layout,
  palette, or type treatment. Fidelity beats taste here.
- If `FAL_KEY` is unset and no product photos were uploaded, don't stop —
  proceed with Stage 3's draft-mode placeholder path and say so in the final
  summary.

## Stage 1 — Deconstruct the reference ad → work/ad_spec.json
Look at the reference ad with vision. Extract, exactly as remix-ad does:
- copy roles VERBATIM (headline, subhead, offer, cta, legal — only those present)
- layout archetype in your own words + where each element sits; also note the
  style fingerprint the schema doesn't force: type weights/case/tracking,
  spacing proportions, graphic devices (bursts, badges, rules, gradients)
- palette (bg / accent / ink as hex, sampled by eye)
- logo: crop its bounding box to `work/logo.png` via
  `node $TOOLS/crop.js <ref-ad> x y w h work/logo.png`, then
  `node $TOOLS/knockout.js work/logo.png work/logo_t.png`
- photo region: crop to `work/source_photo.png` + one-line description
Write `work/ad_spec.json` matching `$TOOLS/lib/adspec.js`'s schema. Validate:
`node $TOOLS/checkspec.js work/ad_spec.json` must print OK.

## Stage 2 — Write the new copy → work/remake_spec.json
Map the new message onto the original's copy roles 1:1 — its headline slot
gets the new headline, its offer slot the new offer, and so on. Match the
original's casing style and stay within roughly ±20% of each role's length so
the composition still holds. Roles the new message doesn't cover: keep the
original text ONLY if it is product-agnostic and still true (e.g. a generic
financing line); otherwise drop the role. Copy `layout`/`palette`/`logo`/`photo`
from `ad_spec.json` unchanged. Validate:
`node $TOOLS/checkspec.js work/remake_spec.json` → OK.

## Stage 3 — New imagery
Priority order:
1. **Uploaded product photos**: use them directly — reference by relative
   path; they are the product truth.
2. Else if `FAL_KEY` is set: swap the product inside the original photo —
   `node $TOOLS/fal-edit.js work/source_photo.png "<same staging/lighting/crop, replace the product with …>" work/photos/photo_01.png`
   JUDGE with vision (right product, clean geometry, matches the original's
   staging); at most 2 retries, never exceed 12 fal calls total.
3. Else (draft mode): a brand-tinted placeholder tile in the photo region,
   labeled with the intended shot, at the region's real proportions. Say in
   your final summary that placeholder imagery was used and what must drop in.

## Stage 4 — Recomposite + QA
Sizes: parse what the user asked for — resolve channel/size names against
`$TOOLS/sizes.json` and accept raw `WxH`. Default when absent: the reference
ad's own dimensions — read them with `node $TOOLS/imgsize.js <ref-ad>`.
For each size, author `work/html/remake__WxH.html` — self-contained (inline
CSS, system font stack, no external fonts/CDNs/JS), reproducing the ORIGINAL's
archetype, palette, spacing, and type treatment with the NEW copy and imagery.
Reference images by RELATIVE path (`../photos/photo_01.png`, `../logo_t.png`).
Design per aspect when multiple sizes are asked for. Keep logo/copy inside a 4%
safe margin.
Render: `node $TOOLS/render.js work/html output/`
QA (LOOK at every output JPEG, at most 3 rounds):
1. Copy exactness vs `remake_spec.json`, character-for-character.
2. Style fidelity vs the reference ad, side by side with vision: same layout
   bones, palette, type feel — a stranger should say "same campaign family".
3. Legibility, nothing clipped, logo clean, safe margins respected.
Fix HTML and re-render (free) until clean.

## Stage 5 — Deliver
Deliverables are the files in `output/`. Final message: one line — what the
ad now sells and at which sizes — plus the old headline → new headline
mapping, whether placeholder imagery was used, and anything else the user
should know, then DONE.
