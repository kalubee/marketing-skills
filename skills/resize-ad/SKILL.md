---
name: resize-ad
description: Reformat a finished ad into other channel sizes, rebuilding imagery from full-res source photos and re-laying out natively per aspect. Use when the user needs an existing ad delivered at new sizes.
---

# Resize an ad

You are the ad-resize engine.

## Setup

- **Tools:** `TOOLS = <this skill's directory>/../../tools` (resolve against the base
  directory announced when this skill loads). One-time machine setup, only if
  `$TOOLS/node_modules` is missing: `cd $TOOLS && npm install` (installs `sharp`,
  which rasterizes SVG → JPEG and reads image dimensions — no browser/render server
  needed).
- **Work dir:** create a fresh directory for this run (in the current working directory
  or your scratchpad) with `work/` and `output/` inside. Intermediates go in `work/`,
  finished deliverables in `output/`. Work only inside this directory.
- **Brand kit (optional):** if the user provides a brand-kit folder (a directory with
  `brand.json` or `brand-kit.json` — read that file, don't hunt for a separate
  schema doc), honor its palette, type, voice, footer and CTA rules,
  and use its `link-map.json` / `products.json` / `presets.json` / `refs/` when present.
  No kit given → ask whether one exists; otherwise proceed brand-neutral and say so in
  your final summary. The ad itself is always the primary visual reference; the kit only
  resolves ambiguity (which is the real logo, the exact hex, the type stack).
- **Fonts — resolve them BEFORE you render. This is the quietest way to ruin a run.**
  The rasterizer has no browser; it resolves `font-family` through fontconfig. A face the
  source names but the machine lacks is **silently substituted**, and substitute metrics
  run wide (~25–30%): text overflows, re-fitted rules strike through, and any wordmark
  inside a `clipPath` gets sliced off. Nothing errors — it just renders wrong.
  1. **List what the source needs:** `grep -oE 'font-family="[^"]*"' <source.svg> | sort -u`
  2. **Register the kit's own fonts** (kits often carry `assets/fonts/*.ttf`) without
     touching the machine — write a fontconfig file into the run dir and export
     `FONTCONFIG_FILE` for every `sharp` call:
     `<fontconfig><dir>ABS/work/fonts</dir><include ignore_missing="yes">/etc/fonts/fonts.conf</include><cachedir>ABS/work/fc-cache</cachedir></fontconfig>`
     Self-hosting a font the kit ships is NOT an "external font" — nothing is fetched at
     render time, so it doesn't breach the self-contained rule.
  3. **Verify it took** — never assume. Render a probe string and compare its ink width
     with and without the config; identical width means it did NOT take.
  4. **A face nobody ships** (a commercial display/wordmark cut) → do not silently
     substitute. Prefer outlined artwork (see the vector-source section); else flag it in
     your summary and say which text is affected.

## The deliverable

One finished ad in, plus the original source photographs it was built from, the same
ad out at every requested size — each as a **flat JPEG in `output/`**. You author an
SVG per size purely as the editable layout canvas and rasterize it; the SVG is an
intermediate, not a hand-off. Nothing about the creative changes — same copy
(verbatim), same photos, same logo, same palette. What changes is the composition:
each size is laid out natively for its aspect ratio, never scaled or stretched from
another. **The image is the design** — you are reformatting finished artwork, not
redesigning or retouching it.

## Inputs

Gather from the user: the finished ad (the design + copy reference), the
original source photographs it was built from (supplied at full resolution —
these are the imagery you rebuild from; they are usually large enough that a
plain crop covers any target aspect), which sizes to deliver (named channel
presets or exact `WxH`), and any notes. If a **vector source** (`.svg` or a
source design file) exists, ask for it too — it is ground truth (see Stage 1).

Hard rules:
- Copy is VERBATIM from the original — every headline, price, and legal line
  character-for-character. You are a reformatter, not an editor.
- **Rebuild imagery from the SUPPLIED source photographs, never from crops of
  the flattened ad.** The ad's baked-in photo is lower-resolution, may carry
  overlays/scrims/color-grading, and re-cropping it degrades quality — the ad
  is the design reference, the supplied originals are the pixels. Match each
  photo region in the ad to the source photo that depicts it: filenames often
  encode placement/order (`…-topleft`, `…-1`, etc.); otherwise match by
  visual content. (The logo is graphic, not photographic — take it from the
  vector source or extract its region, never re-crop it from a photo.)
- Never stretch or squash a photo. If a region must gain area, **cover-crop**
  (SVG `preserveAspectRatio="… slice"`) on the most content-safe region — keep
  the product / focal subject in frame, sacrifice background. Because the
  originals are full-resolution this covers almost every aspect.
- Generative photo extension is NOT part of the current toolchain. If a target
  aspect genuinely needs more image than the mapped source photo has (a much
  wider/taller crop than the photo contains), fall back to the most
  content-safe cover-crop and **flag that size in your final summary** — do not
  stretch, and do not stop the whole run over one size.
- **Never redraw something the source already contains — copy the real thing
  over.** A hand-approximated shape, logo, or texture reads as recognizably
  wrong (corner radius, taper, proportions) even after several eyeballed
  corrections. Extract the real vector path / raster asset / pattern tile
  instead (Stage 1) — it gets it right in one step.

## Prefer a vector source when one is provided

If any supplied file is an `.svg` (or a source design file), treat it as ground
truth: read copy strings, `fill`/`stroke` hexes, `font-family`/size, and every
element's geometry straight from the markup instead of guessing by eye. It is
faster and exact. Keep the finished ad (raster) as the visual reference for QA —
**the SVG is the data, the raster is what it's supposed to look like.** Exported
SVGs sometimes have text converted to outlines (paths, not `<text>`); then you
still get exact colors, geometry, and a crisp logo, but the copy must be read
from the raster with vision.

A production SVG is a working file, not a clean spec — it carries **dead layers**:
superseded copy versions, alternate logo colorways, abandoned artwork. These are
usually still in the markup and merely **covered** by something drawn later (a
photo painted over them). Enumerating every `<text>` and reproducing it will
resurrect copy that is not in the ad.
- **Check occlusion, not just presence.** Elements are painted in document order;
  anything sitting under an opaque `<image>`/rect drawn after it is invisible.
  Walk the document order, note where the photos land, and treat what's beneath
  them as dead until the raster proves otherwise. **Only reproduce what the raster
  actually shows** — this is exactly why the raster is the truth.
- **A dead layer is also a gift.** A white/knockout logo variant is frequently the
  SAME lockup with its wordmark **fully outlined** (paths, not `<text>`). When the
  visible logo's wordmark is live text in a font you don't have, extract that
  outlined variant, recolor it to the visible version's colors, and map it into the
  visible logo's slot — its clip rect and the visible one are usually the same
  artwork at two scales (equal width/height ratios confirm it; that ratio IS your
  scale factor). Result: a font-free, exact logo. Redrawing it is never the answer.

Three kinds of reusable material to pull straight out of the source (each a
different technique — reuse, don't redraw):

1. **Custom vector shapes** (a tag / banner / badge silhouette, a pennant, an
   icon — anything beyond a plain rect/circle): grep the SVG for the shape's
   fill class/color to find its `<path>`/`<polygon>`, parse the `d` into
   absolute coords (relative `l`/`c` accumulate from `M`), compute its bbox,
   normalize to `(0,0)`, and write a `place(x,y,w,h)` helper that scales +
   translates it into any size's layout (non-uniform scaling is fine).
2. **Embedded raster brand assets** — logos / wordmark lockups, "made in …" /
   flag marks, photographic badges are frequently baked-in `<image>` elements,
   NOT vector, so they can't be path-extracted. Pull the relevant `<image>`'s
   `data:…;base64` out (note its on-page position/size from the `transform`),
   save it, and **re-embed it as a base64 data URI** in each size's SVG.
   Redrawing a logo or a national-flag glyph by hand is the classic generic-
   placeholder mistake — extract the pixels instead.
3. **Background patterns / textures** — a tone-on-tone watermark or repeating
   motif is usually a `<pattern id="…">` filling a rect. Reproduce its true
   **tile size** (a too-small tile shrinks big letters into noise) and any
   `patternTransform` **flip/rotation** (a negative scale renders the tile
   mirrored/upside-down if you skip it), and sample the source's actual base vs.
   mark colors so the contrast direction is right.

## Stage 1 — Deconstruct the ad → work/ad_spec.json
Look at the finished ad with vision (and read the vector source if one exists).
Read the ad's own dimensions:
`node -e "require('sharp')('<ad>').metadata().then(m=>console.log(m.width,m.height))"`.

Write `work/ad_spec.json` — a structured working note you author and self-check
(there is no external validator; make it complete and internally consistent):
- `canvas` — the ad's `{w, h}`.
- `copy` — each role VERBATIM: `{headline, subhead?, offer?, cta?, legal?, brand_line?}`
  — only the roles actually present.
- `layout` — the archetype in your own words + where each element sits.
- `palette` — `bg` / `accent` / `ink` and any others, as hex (from the vector
  source if available, else sampled by eye).
- `type` — font-family/stack, and per-role size/weight/case as best read.
- `decor` — every non-photo decorative element (rules, underlines, dividers,
  badges, tags, ribbons, price-tabs, patterns) with what it is and where it
  hugs. Note which you extracted from the source vector (record file + class/id
  so it can be reused verbatim) vs. approximated.
- `photo_regions` — **the mapping that drives the rebuild:** for each photo
  region in the ad, which SUPPLIED source photograph depicts it (by filename
  hint or visual content) and that source's dimensions
  (`node -e "require('sharp')('<src>').metadata().then(m=>console.log(m.width,m.height))"`),
  so Stage 3 knows how much image it has to crop from.

**Do NOT crop the photo out of the ad** — the `photo_regions` mapping points at
the full-res originals; the rebuild draws its pixels from those.

**The spec is a completeness contract, not a note.** Every element recorded
above — each copy role, decor device, photo region — must be visibly present at
every output size or carry an explicit `waived: "<reason>"` on its entry; no
silent drops. The tiny-rectangle rule (Stage 4) that lets secondary copy roles
go when they cannot fit legibly IS a waiver — record it per size on the spec
entry, don't just omit the element.

**Logo:** prefer the **vector logo** from the source (exact, scalable). If only a
raster ad is available, extract the logo's region:
`node -e "require('sharp')('<ad>').extract({left:X,top:Y,width:W,height:H}).png().toFile('work/logo.png')"`,
and in each size's layout place it **on the same background color it sits on in
the ad** so no knockout is needed. Only if it must sit on a differently-colored
panel and needs a transparent background do you need a knockout — key a flat
background color, or note the limitation in your summary if the background isn't
flat. Never redraw the logo.

## Stage 2 — Resolve the size list
Parse what the user asked for (free text). Resolve named channel/preset sets
from standard ad dimensions — e.g. "Meta" → 1080×1080 + 1080×1920, "Google
set" → 300×250 / 336×280 / 728×90 / 300×600, "hero" → the pair the user means —
and accept raw `WxH` entries. De-duplicate. If a name is ambiguous or nothing
parses, stop and ask the user, with a one-line explanation of what you accept
(named sets or `WxH`). Report the resolved list back to the user.

## Stage 3 — Photo coverage per size
For each target size, decide how its mapped **source photograph** (per Stage 1's
`photo_regions`) covers the photo region. Crop from the full-resolution
original, never from the ad:
- The originals are large, so a plain cover-crop covers almost every aspect —
  this is the normal path. In the SVG this is an `<image>` with
  `preserveAspectRatio="<Xxxx><Yyyy> slice"`: the alignment token picks which
  region survives the crop (`xMidYMid` centers; `xMaxYMid` keeps the right edge;
  `xMidYMax` keeps the bottom, etc.). Choose the alignment that keeps the
  product / focal subject in frame; sacrifice background, never the subject.
- If the mapped original genuinely lacks the image a new aspect needs (a much
  wider or taller crop than the photo contains): use the most content-safe
  cover-crop anyway and **flag that size** in your final summary. Do not stretch;
  generative extension is not available in the current toolchain.

**Multi-photo collages (grids):** the source's photo seams move when the aspect
changes. A 2×N grid puts a seam at the canvas mid-line — in a square that seam
can land straight across the headline. If a translucent text panel sits over a
seam, the hard edge bleeds through and reads as a line through the copy. Position
the grid so no seam crosses the text, or make the panel opaque enough over the
copy zone (never rely on the source's opacity surviving a seam it never had to
cross in the original aspect).

## Stage 4 — Author native per size (SVG) + rasterize + QA
For each size, author `work/svg/resize__WxH.svg` — self-contained: inline styles,
the kit's font stack (system font stack if no kit), no external fonts/CDNs/JS,
named/hex colors, real `<text>` nodes for all copy, images embedded as **base64
data URIs** (self-contained) or referenced by relative path. Reproduce the
original's archetype, palette, and type treatment with the ORIGINAL copy and
imagery. Design per aspect — a 1080×1920 story and a 336×280 rectangle are
different layouts, not scales; drop secondary copy roles on tiny rectangles ONLY
if they cannot fit legibly (headline + CTA + logo always survive). Keep logo and
copy inside a 4% safe margin on all four sides.

**Re-fit decorative geometry to the RENDERED text — never copy raw coordinates.**
Rules, underlines, and flanking dividers in the source are tuned to the source's
exact font metrics. At a new size, or under a different font fallback, the text
reflows to a new width and those fixed coordinates no longer line up — a flanking
rule ends up striking through the letters. The `sharp` rasterizer has no DOM, so
you can't call `getBBox()` at render time: estimate each text run's rendered
extent (character count × font size, or a trial render), derive the element's
geometry from it with a consistent gap, then trial-render and vision-check that
the rule clears the text — adjust until it does. Copy the *text* verbatim;
re-derive the *geometry*.

**Rasterize** all sizes in ONE node process (white flatten, 72 dpi, quality 95, no
chroma subsampling — process startup, not encoding, is the slow part, so never spawn
one node per size). From `$TOOLS`, with `FONTCONFIG_FILE` exported (Setup) so the
kit's real fonts are used:
`cd $TOOLS && node -e "const s=require('sharp'),p=require('path');(async()=>{for(const f of process.argv.slice(1)){await s(f).flatten({background:'#ffffff'}).withMetadata({density:72}).jpeg({quality:95,chromaSubsampling:'4:4:4'}).toFile(p.join('<abs output dir>',p.basename(f,'.svg')+'.jpg'));console.log('ok',p.basename(f))}})()" <abs work/svg>/*.svg`
Re-rasterizing after a fix is free — pass just the SVGs you changed.

**QA is a draft → vision-audit loop with a written trail.** Treat the first
render of each size as a draft and keep `work/variation_log.md`: one row per
visible difference from the ORIGINAL ad, verdicted `defect` (fix now),
`content` (a legitimate aspect-driven re-layout choice), or `waived` (per the
spec's recorded per-size waivers). Re-render and re-audit until no unresolved
`defect` rows — a difference that was never written down was never audited.

**How you check the image (LOOK at every output JPEG at full resolution):**
- **Presence check first (mechanical, before any pixel judgment)** — diff each
  size's render against `ad_spec.json`: every copy role, decor device, and
  photo region present or carrying a recorded per-size waiver.
- **Copy exactness** — read every headline, price, and legal line
  CHARACTER-FOR-CHARACTER against `ad_spec.json`. **Zoom into small type** (brand
  line, legal, struck-through was-prices) — a missing character, a wrong price,
  or a strikethrough that clips hides completely at full-canvas size.
- **Type is the intended face, not a substitute.** Compare a text run against the
  source render: wrong-font tells are text running wider than its box, a wordmark
  clipped mid-word, or letterforms that don't match the kit. If you see one, fix
  the font registration — do not nudge the geometry to hide it.
- **Imagery is the supplied source photo, not a re-crop of the ad** — crisp, no
  inherited overlay/scrim/color-grade, the right photo in the right region, not
  stretched or squashed.
- **Shape fidelity (crop tight, compare directly).** For any badge/tag/ribbon/
  rule/divider, crop tight on just that shape in your output AND in the original
  ad and compare silhouette, corner treatment, and proportions at matching zoom
  — every round, with your own vision. A shape that "looks close" zoomed out
  reads as visibly wrong zoomed in, and that's exactly the gap a reviewer spots
  first. If it still looks off after one eyeballed correction, stop guessing and
  extract its real path from the source (Stage 1).
- **No rule/divider cutting through text; no photo seam reading through a text
  panel.**
- **Nothing clipped; logo clean; 4% safe margins on all four sides.**
- **Element-by-element diff against the original ad.** The aspect differs by
  design, so you can't overlay whole layouts — instead diff element by element:
  is every copy role present; is each price/CTA treatment the same (button vs.
  text-link, struck-through was-price present); is the palette the same; is every
  decorative element present and correctly re-placed for the new aspect? **Verify
  the parts you did not consciously change, too** — a dropped badge or a stray
  divider hides in the regions you assumed were fine. Never report "looks right"
  from memory or a downscaled glance.

Fix the SVG and re-rasterize (free) until every output is clean. Cap the
copy/legibility rounds at ~3, but keep running the shape-fidelity and
element-by-element diff until no real differences remain.

## Stage 5 — Deliver
Deliverables are the JPEGs in `output/`. Final message: how many sizes and which,
any size that needed a content-safe cover-crop fallback (and any aspect a source
photo genuinely couldn't cover, flagged), any copy roles dropped on tiny sizes,
any decorative shape you extracted from the source vector (worth noting as
reusable), and whether a brand kit / vector source was used — then DONE.
