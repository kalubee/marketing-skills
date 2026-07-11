---
name: resize-ad
description: Reformat a finished ad into other channel sizes, rebuilding imagery from full-res source photos and re-laying out natively per aspect. Use when the user needs an existing ad delivered at new sizes.
---

# Resize an ad

You are the ad-resize engine.

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

Gather from the user: the finished ad (the design + copy reference), the
original source photographs it was built from (supplied at full resolution —
these are the imagery you rebuild from; they are usually large enough that a
plain crop covers any target aspect, so generation is almost never needed),
which sizes to deliver (ids from `$TOOLS/sizes.json`, or exact `WxH`), and any
notes.

The job: one finished ad in, plus the original source photographs it was built
from, the same ad out at every requested size. Nothing about the creative
changes — same copy (verbatim), same photos, same logo, same palette. What
changes is the composition: each size is laid out natively for its aspect
ratio, never scaled or stretched from another.

Hard rules:
- Copy is VERBATIM from the original — every headline, price, and legal line
  character-for-character. You are a reformatter, not an editor.
- **Rebuild imagery from the SUPPLIED source photographs, never from crops of
  the flattened ad.** The ad's baked-in photo is lower-resolution, may carry
  overlays/scrims/color-grading, and re-cropping it degrades quality — the ad
  is the design reference, the supplied originals are the pixels. Match each
  photo region in the ad to the source photo that depicts it: filenames often
  encode placement/order (`…-topleft`, `…-1`, etc.); otherwise match by
  visual content. (The logo is graphic, not photographic — keep taking it
  from the ad or its vector.)
- Generation is a rare fallback. Because the originals are full-resolution, a
  plain cover-crop almost always covers the target aspect. Extend generatively
  ONLY when even the original source photo lacks the image a new aspect
  needs — via `node $TOOLS/extend-image.js`, at most 6 fal calls per run.
  Never generate a new scene, never redraw the product.
- Never stretch or squash a photo. If it must gain area and `FAL_KEY` is
  unset, crop with CSS `background-size: cover` (or an equivalent object-fit
  crop) on the most content-safe region instead, and note it in your summary.
- **Prefer a vector source when one is provided.** If any supplied file is an
  `.svg` (or a source design file), treat it as ground truth: read copy, hex
  colors, font stack, and element geometry straight from the markup instead
  of guessing by eye. It is faster and exact. Keep the finished ad as the
  visual reference for QA — the SVG is the data, the raster is what it's
  supposed to look like.
- If `FAL_KEY` is unset and a target aspect genuinely needs more image than
  the source photo has, fall back to a content-safe cover-crop and note it —
  do not stop the whole run over one size.

## Stage 1 — Deconstruct the ad → work/ad_spec.json
Look at the finished ad with vision. Extract exactly as remix-ad does: copy
roles VERBATIM; layout archetype + element placement; palette (hex by eye);
logo crop → `work/logo.png` → `node $TOOLS/knockout.js work/logo.png work/logo_t.png`.
Write `work/ad_spec.json` (`$TOOLS/lib/adspec.js` schema). Validate:
`node $TOOLS/checkspec.js work/ad_spec.json` → OK.
Also read the ad's own dimensions: `node $TOOLS/imgsize.js <ad>`.

**Do NOT crop the photo out of the ad.** Instead, map each photo region in the
ad to one of the supplied source photographs — by filename hint or visual
content — and record that mapping in `ad_spec.json` (which slot uses which
source file). Read each source photo's dimensions (`imgsize.js`) so Stage 3
knows how much image it has to crop from. The rebuild draws its pixels from
these originals, not from the flattened ad.

**If a vector source (.svg) is provided:** skip the eye-balling — pull copy
strings, `fill`/`stroke` hexes, font-family/size, and every element's
coordinates directly from the SVG. Copy its embedded photos/logo out for reuse.
Record the source's own canvas size from its `width`/`height`/`viewBox`. Note:
exported SVGs sometimes have text converted to outlines (paths, not `<text>`) —
then you still get exact colors, geometry, and a crisp logo, but the copy must
be read from the raster with vision.

## Stage 2 — Resolve the size list
Parse what the user asked for (free text). Resolve channel/preset names
against the matrix in `$TOOLS/sizes.json` ("Meta" → 1080×1080 + 1080×1920,
"Google set" → the four Google rectangles, "hero" → 1600×510 + 375×410, …)
and accept raw `WxH` entries. De-duplicate. If nothing parses, stop and ask
the user, with a one-line explanation of what you can accept. Report the
resolved list to the user.

## Stage 3 — Photo coverage per size
For each target size, decide how its mapped **source photograph** (per the
Stage 1 mapping) covers the photo region. Crop from the full-resolution
original, never from the ad:
- The originals are large, so a plain cover-crop covers almost every aspect —
  this is the normal path. Crop on the most content-safe region (keep the
  product / focal subject in frame; sacrifice background, never the subject).
- Only if the mapped original genuinely lacks the image a new aspect needs (a
  much wider or taller crop than the photo contains) AND `FAL_KEY` is set:
  extend once per needed aspect — `node $TOOLS/extend-image.js <source.jpg>
  <WxH> "<what the extended area should contain>" work/photos/ext_WxH.png` —
  and JUDGE the result with vision (seamless, same lighting/perspective, the
  original region untouched); at most 1 retry each, never exceed 6 fal calls
  total. Reuse one extension across sizes with similar aspects.
- `FAL_KEY` unset → cover-crop on the most content-safe region and note it in
  your final summary.

**Multi-photo collages (grids):** the source's photo seams move when the
aspect changes. A 2×N grid puts a seam at the canvas mid-line — in a square
that seam can land straight across the headline. If a translucent text panel
sits over a seam, the hard edge bleeds through and reads as a line through the
copy. Keep the panel opacity as designed, but position the grid so no seam
crosses the text — or ensure the panel is opaque enough over the copy zone
(never rely on the source's opacity surviving a seam it never had to cross).

## Stage 4 — Author native per size + render + QA
For each size, author `work/html/resize__WxH.html` — self-contained (inline
CSS, system font stack, no external fonts/CDNs/JS), reproducing the original's
archetype, palette, and type treatment with the ORIGINAL copy and imagery.
Reference images by RELATIVE path. Design per aspect — a 1080×1920 story and a
336×280 rectangle are different layouts, not scales; drop secondary copy roles
on tiny rectangles ONLY if they cannot fit legibly (headline + CTA + logo
always survive). Keep logo/copy inside a 4% safe margin.

**Re-fit decorative geometry to the RENDERED text — never copy raw
coordinates.** Rules, underlines, and flanking dividers in the source are tuned
to the source's exact font metrics. At a new size, or under a different font
fallback, the text reflows to a new width and those fixed coordinates no longer
line up — a flanking rule ends up striking through the letters. For any element
that hugs a text run, measure the rendered text (`getBBox()` in the render
step, or a trial render) and derive the geometry from it with a consistent gap.
Copy the *text* verbatim; re-derive the *geometry*.

Render: `node $TOOLS/render.js work/html output/`
QA (LOOK at every output JPEG, at most 3 rounds): copy exactness vs
`ad_spec.json`; **imagery is the supplied source photos, not a re-crop of the
ad** (crisp, no inherited overlay/scrim, right photo in the right region);
photo not stretched; extensions seamless; nothing clipped; logo clean; safe
margins; **no rule/divider cutting through text; no photo seam reading
through a text panel.** Fix HTML and re-render (free) until clean. Zoom into
small type (brand line, legal) — strikethrough and clipping hide at
full-canvas size.

## Stage 5 — Deliver
Deliverables are the files in `output/`. Final message: how many sizes, which
(if any) needed generative extension or a content-safe cover-crop fallback,
any copy roles dropped on tiny sizes, and anything else the user should know,
then DONE.
