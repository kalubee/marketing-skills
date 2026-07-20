---
name: remix-ad
description: Deconstruct a finished ad creative, swap its photography for new real shots, and recomposite native variants at every requested size. Use when the user has a finished ad image and wants on-brand variants — a photo swap, copy tweak, or new sizes.
---

# Remix an ad

You are the ad-remix engine.

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
  your final summary. The ad itself is always the primary visual authority; the kit only
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
  3. **Verify it took** — render a probe string and compare ink width with and without the
     config; identical width means it did NOT take.
  4. **A face nobody ships** (a commercial display/wordmark cut) → do not silently
     substitute. Prefer outlined artwork (see the vector-source section); else flag it.

## The deliverable

The user has a finished ad and wants on-brand **variants** of it: the same creative
with different photography, an optional copy tweak, and/or new sizes. **Copy and
style stay constant; the photo is the variable.** This differs from remake-ad (which
keeps the style but writes NEW copy for a different product) and from resize-ad
(which changes nothing but the aspect).

Each variant × size ships as a **flat JPEG in `output/`**. You author an SVG per
variant/size purely as the layout canvas and rasterize it; the SVG is an
intermediate, not a hand-off.

Hard rules:
- Copy is authored as real SVG `<text>` — so it IS typed by you. It must match
  `work/ad_spec.json` exactly, except changes the instruction explicitly requests.
  Never invent, round, or "improve" a price, product name, or date.
- **Imagery is fetched or supplied — never generated.** There is no generative photo
  tool in this toolchain. A "photo swap" means swapping in REAL photography (Stage 2),
  not synthesizing one. If the user asks for a generated/edited scene ("put the sofa
  on a beach", "make it sunset"), say plainly that generation isn't wired up, and offer
  what does work: a different real photo, a re-crop, a copy tweak, or new sizes.
- **Rebuild imagery from full-resolution sources, never from a crop of the flattened
  ad.** The ad's baked-in photo is lower-resolution and may carry overlays/scrims —
  the ad is the design reference, the supplied/fetched originals are the pixels.
- Never stretch or squash a photo — cover-crop with
  `preserveAspectRatio="<Xxxx><Yyyy> slice"` on a content-safe region.
- **Never redraw something the source already contains — copy the real thing over.**
  Extract the real vector path / raster asset / pattern tile instead.

## Prefer a vector source when one is provided

If the ad comes with an `.svg` (or a source design file), treat it as ground truth:
read copy strings, `fill`/`stroke` hexes, `font-family`/size, and every element's
geometry straight from the markup instead of guessing by eye. Keep the rendered ad as
the visual check — **the SVG is the data, the raster is what it's supposed to look
like.** Pull out custom vector shapes (parse the `d`, normalize the bbox to `(0,0)`,
scale into place), embedded raster brand assets (lift the `<image>`'s base64 and
re-embed it), and pattern tiles (honor true tile size + `patternTransform` flip).

A production SVG is a working file, not a clean spec — it carries **dead layers**:
superseded copy versions, alternate logo colorways, abandoned artwork, usually still
in the markup and merely **covered** by something drawn later.
- **Check occlusion, not just presence.** Elements paint in document order; anything
  under an opaque `<image>`/rect drawn after it is invisible. **Only reproduce what the
  raster actually shows.**
- **A dead layer is also a gift.** A white/knockout logo variant is frequently the SAME
  lockup with its wordmark **fully outlined** (paths, not `<text>`). When the visible
  logo's wordmark is live text in a font you don't have, extract that outlined variant,
  recolor it, and map it into the visible logo's slot — the two clip rects are usually
  the same artwork at two scales (equal width/height ratios confirm it; that ratio IS
  your scale factor). A font-free, exact logo.

## Inputs

Gather from the user: the ad image (plus its vector source and the full-res source
photographs, if they exist), the change instruction, how many variants (default 3),
and which sizes (named channel sets or exact `WxH`; default to the ad's own size via
`node -e "require('sharp')('<ad>').metadata().then(m=>console.log(m.width,m.height))"`).

## Stage 1 — Deconstruct → work/ad_spec.json
Look at the ad with vision (and read its vector source if one exists). Write
`work/ad_spec.json` — a structured working note you author and self-check (there is no
external validator; make it complete and internally consistent):
- `canvas` — the ad's `{w, h}`.
- `copy` — each role VERBATIM (`headline`, `subhead?`, `offer?`, `cta?`, `legal?`) —
  only the roles actually present.
- `layout` — the archetype in your own words + where each element sits.
- `palette` — `bg` / `accent` / `ink` and any others, as hex.
- `type` — font stack, and per-role size/weight/case.
- `decor` — every non-photo decorative element and what it hugs; note which you
  extracted from the source vector (file + class/id) vs. approximated.
- `photo_regions` — each photo region's box, a one-line description of the shot, and
  (if full-res originals were supplied) which source file depicts it.

**The spec is a completeness contract, not a note.** Every element recorded
above — each copy role, decor device, photo region — must be visibly present in
every variant or carry an explicit `waived: "<reason>"` on its entry; no silent
drops (a dropped badge or divider hides exactly where you stopped looking). And
if an instruction changes the offer or copy, every decor device carrying the OLD
words must be updated or waived — stale offer text surviving inside a badge or
ribbon is a defect, not style.

**Logo:** prefer the **vector logo** from the source. If only a raster ad exists,
extract its region:
`node -e "require('sharp')('<ad>').extract({left:X,top:Y,width:W,height:H}).png().toFile('work/logo.png')"`,
and place it on the same background color it sits on in the ad so no knockout is
needed. Never redraw it.

## Stage 2 — Photo directions (skip entirely for copy/size-only instructions)
Plan the requested number of variants (default 3) as distinct photo directions from
the instruction (e.g. "show the stainless model" → that product in different
angles/settings; honor anything the user pinned). Fill each direction with REAL
photography, in priority order:
1. **Uploaded photos**: use them directly — they are the product truth. Prefer these
   whenever the instruction says "use this exact photo".
2. **Real storefront photos** via the **`product-photos` skill** — it resolves each
   product to a photo on the brand's OWN storefront, pulls silo and/or lifestyle
   shots, optionally cuts the background out, and writes a `photo_manifest.json` +
   `photos/` into this run. Distinct carousel shots make natural distinct variants.
   FETCHED catalog imagery, never generated or retouched.
3. **Fewer variants, honestly** — if only one real photo exists for the product, say
   so and deliver fewer variants rather than padding with placeholders or re-crops
   dressed up as new directions. A re-crop IS a legitimate variant if the source is
   high-res enough — just call it what it is.

**Contact-sheet every candidate and JUDGE it with vision** before composing: right
product, right treatment, no wrong item from search, no white halo on a cutout.
Report kept/rejected to the user as you go.

## Stage 3 — Recomposite + rasterize + QA
For each variant NN and each requested size, author `work/svg/variant_NN__WxH.svg` —
self-contained (inline styles, the kit/source font stack, no external fonts/CDNs/JS,
real `<text>` nodes, images as base64 data URIs), honoring the ORIGINAL ad's look
(palette, copy roles, archetype) unless the instruction asks for drift. Design per
aspect — a 1080×1920 story and a 336×280 rectangle are different layouts, not scales.
Keep logo/copy inside a 4% safe margin.

**Re-fit decorative geometry to the RENDERED text — never copy raw coordinates.** The
rasterizer has no DOM (no `getBBox()`): estimate each run's extent (character count ×
font size, or a trial render), derive any rule/underline from it with a consistent
gap, then trial-render and vision-check that it clears — adjust until it does.

**Rasterize** every variant × size in ONE node process (process startup, not
encoding, is the slow part — never spawn one node per file). From `$TOOLS` (with
`FONTCONFIG_FILE` exported):
`cd $TOOLS && node -e "const s=require('sharp'),p=require('path');(async()=>{for(const f of process.argv.slice(1)){await s(f).flatten({background:'#ffffff'}).withMetadata({density:72}).jpeg({quality:95,chromaSubsampling:'4:4:4'}).toFile(p.join('<abs output dir>',p.basename(f,'.svg')+'.jpg'));console.log('ok',p.basename(f))}})()" <abs work/svg>/*.svg`
Re-rasterizing after a QA fix is free — pass just the SVGs you changed.

**QA is a draft → vision-audit loop with a written trail.** Treat the first
render of each variant × size as a draft and keep `work/variation_log.md`: one
row per visible difference from the original ad, verdicted `defect` (fix now),
`content` (the requested change — photo swap, copy tweak — legitimately
differs), or `waived` (per the spec's waivers). Re-render and re-audit until no
unresolved `defect` rows — a difference that was never written down was never
audited.

**LOOK at every output JPEG at full resolution:**
- **Presence check first (mechanical, before any pixel judgment)** — diff the
  render against `ad_spec.json`: every copy role, decor device, and photo
  region present or carrying a recorded waiver.
- **Copy exactness** — every word CHARACTER-FOR-CHARACTER vs `ad_spec.json` (plus any
  requested change). **Zoom into small type** — clipping hides at full-canvas size.
- **Type is the intended face, not a substitute** — text wider than its box or a
  clipped wordmark means the font didn't register. Fix the font, not the box.
- **The photo is the real fetched/supplied shot**, not a re-crop of the flattened ad:
  crisp, no inherited scrim, not stretched.
- **Shape fidelity** — crop tight on any badge/rule/divider in your output AND the
  original and compare silhouette at matching zoom. If still off after one eyeballed
  correction, extract its real path (Stage 1).
- **No rule/divider cutting through text; nothing clipped; logo clean; 4% safe
  margins.**
- **Verify the parts you did not consciously change, too.** Never report "looks right"
  from memory or a downscaled glance.
Fix the SVG and re-rasterize (free) until clean — at most 3 QA rounds.

## Stage 4 — Deliver
Deliverables are the JPEGs in `output/`. Final message: one line per variant
describing it (which photo direction, which sizes) and what changed vs the original,
whether imagery was supplied / fetched via `product-photos`, whether fewer variants
were delivered than asked and why, whether a kit font or a system stack was used, and
anything else the user should know, then DONE.
