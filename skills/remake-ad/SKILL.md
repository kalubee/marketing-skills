---
name: remake-ad
description: Clone a reference ad's exact style with new copy and imagery — style constant, content variable. Use when the user has an ad whose look they want reused for a different product, offer, or campaign.
---

# Remake an ad

You are the ad-remake engine.

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
  your final summary. The reference ad is always the primary visual authority; the kit
  only resolves ambiguity (which is the real logo, the exact hex, the type stack).
- **Fonts — resolve them BEFORE you render. This is the quietest way to ruin a run.**
  The rasterizer has no browser; it resolves `font-family` through fontconfig. A face the
  reference names but the machine lacks is **silently substituted**, and substitute
  metrics run wide (~25–30%): text overflows, re-fitted rules strike through, and any
  wordmark inside a `clipPath` gets sliced off. Nothing errors — it just renders wrong.
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

The user has an ad that works and wants the SAME ad — same layout, same palette,
same type treatment, same energy — selling something else. **Style is copied; copy
and imagery are new.** This differs from remix-ad (which keeps the reference's copy
and swaps its photo) and from resize-ad (which changes nothing but the aspect):
here the **style is the constant and the content is the variable**.

Each size ships as a **flat JPEG in `output/`**. You author an SVG per size purely
as the layout canvas and rasterize it; the SVG is an intermediate, not a hand-off.

Hard rules:
- Copy is authored as real SVG `<text>` — so it IS typed by you. It must match
  `work/remake_spec.json` exactly: every price, product name, and date verbatim
  from the new message. Never invent, round, or "improve" one.
- **The reference ad's style is authoritative** — do not "improve" its layout,
  palette, or type treatment. Fidelity beats taste here.
- **Imagery is fetched or supplied — never generated.** There is no generative
  photo tool in this toolchain. See Stage 3.
- Never stretch or squash a photo — cover-crop with
  `preserveAspectRatio="<Xxxx><Yyyy> slice"` on a content-safe region.
- **Never redraw something the source already contains — copy the real thing
  over.** A hand-approximated shape, logo, or texture reads as recognizably wrong
  (corner radius, taper, proportions) even after several eyeballed corrections.
  Extract the real vector path / raster asset / pattern tile instead.

## Prefer a vector source when one is provided

If the reference comes with an `.svg` (or a source design file), treat it as ground
truth: read copy strings, `fill`/`stroke` hexes, `font-family`/size, and every
element's geometry straight from the markup instead of guessing by eye. Keep the
rendered reference as the visual check — **the SVG is the data, the raster is what
it's supposed to look like.**

Three kinds of reusable material to pull straight out (reuse, don't redraw):
1. **Custom vector shapes** (a tag/banner/badge silhouette, a pennant, an icon —
   anything beyond a plain rect/circle): grep for the shape's fill class/color to
   find its `<path>`/`<polygon>`, parse the `d` into absolute coords (relative
   `l`/`c` accumulate from `M`), compute its bbox, normalize to `(0,0)`, and write a
   `place(x,y,w,h)` helper that scales + translates it into any layout.
2. **Embedded raster brand assets** — logos/wordmark lockups, "made in …"/flag
   marks are frequently baked-in `<image>` elements, NOT vector. Pull the relevant
   `<image>`'s `data:…;base64` out (note its position/size from the `transform`) and
   **re-embed it as a base64 data URI**. Redrawing a logo by hand is the classic
   generic-placeholder mistake.
3. **Background patterns / textures** — usually a `<pattern id="…">` filling a rect.
   Reproduce its true **tile size** and any `patternTransform` **flip/rotation**, and
   sample the real base vs. mark colors so contrast runs the right way.

A production SVG is a working file, not a clean spec — it carries **dead layers**:
superseded copy versions, alternate logo colorways, abandoned artwork, usually
still in the markup and merely **covered** by something drawn later. Enumerating
every `<text>` will resurrect copy that isn't in the ad.
- **Check occlusion, not just presence.** Elements paint in document order; anything
  under an opaque `<image>`/rect drawn after it is invisible. Walk the order, note
  where photos land, and **only reproduce what the raster actually shows.**
- **A dead layer is also a gift.** A white/knockout logo variant is frequently the
  SAME lockup with its wordmark **fully outlined** (paths, not `<text>`). When the
  visible logo's wordmark is live text in a font you don't have, extract that
  outlined variant, recolor it, and map it into the visible logo's slot — the two
  clip rects are usually the same artwork at two scales (equal width/height ratios
  confirm it; that ratio IS your scale factor). A font-free, exact logo.

## Stage 1 — Deconstruct the reference ad → work/ad_spec.json
Look at the reference with vision (and read its vector source if one exists). Read
its dimensions:
`node -e "require('sharp')('<ref>').metadata().then(m=>console.log(m.width,m.height))"`.

Write `work/ad_spec.json` — a structured working note you author and self-check
(there is no external validator; make it complete and internally consistent):
- `canvas` — `{w, h}`.
- `copy` — each role VERBATIM (`headline`, `subhead?`, `offer?`, `cta?`, `legal?`) —
  only the roles actually present. You are recording the ORIGINAL here.
- `layout` — the archetype in your own words + where each element sits, plus the
  **style fingerprint**: type weights/case/tracking, spacing proportions, graphic
  devices (bursts, badges, rules, gradients).
- `palette` — `bg` / `accent` / `ink` and any others as hex (from the vector source
  if available, else sampled by eye).
- `type` — font stack, and per-role size/weight/case.
- `decor` — every non-photo decorative element and what it hugs; note which you
  extracted from the source vector (file + class/id) vs. approximated.
- `photo_regions` — each photo region's box and a one-line description of the shot,
  so Stage 3 knows what to fill it with.

**The spec is a completeness contract, not a note.** Every element recorded
above — each copy role, decor device, photo region — must be visibly present in
the remake or carry an explicit `waived: "<reason>"` on its entry; no silent
drops (a missing badge or divider is the classic remake regression, and it
hides exactly where you stopped looking). Bright line for `decor` that carries
words: a device stating a price, discount, or offer claim is CAMPAIGN COPY,
not style — it transfers only if the new message actually makes that offer;
otherwise waive the device or re-fill it from the new copy. Never ship the
reference's offer on a campaign that doesn't make it.

**Logo:** prefer the **vector logo** from the source. If only a raster reference
exists, extract its region:
`node -e "require('sharp')('<ref>').extract({left:X,top:Y,width:W,height:H}).png().toFile('work/logo.png')"`,
and place it on the same background color it sits on in the reference so no knockout
is needed. Never redraw it.

## Stage 2 — Write the new copy → work/remake_spec.json
Map the new message onto the original's copy roles 1:1 — its headline slot gets the
new headline, its offer slot the new offer, and so on. Match the original's casing
style and stay within roughly ±20% of each role's length so the composition still
holds. Roles the new message doesn't cover: keep the original text ONLY if it is
product-agnostic and still true (e.g. a generic financing line); otherwise drop the
role. Carry `layout` / `palette` / `type` / `decor` over from `ad_spec.json`
unchanged — those are the constant. Self-check it against the brief
character-for-character before moving on.

## Stage 3 — New imagery
In priority order — real pixels beat placeholders, and nothing is ever generated:
1. **Uploaded product photos**: use them directly (embed as base64). They are the
   product truth. Cover-crop to the region's aspect; never stretch.
2. **Real storefront photos** via the **`product-photos` skill** — it resolves each
   product named in `remake_spec.json` to a photo on the brand's OWN storefront,
   pulls a silo and/or lifestyle shot, optionally cuts the background out, and writes
   a `photo_manifest.json` + `photos/` into this run. FETCHED catalog imagery, never
   generated or retouched. Contact-sheet the results and confirm each is the RIGHT
   product (search can return the wrong item) before composing.
3. **Draft mode**: a brand-tinted placeholder tile in the photo region, labeled with
   the intended shot, at the region's real proportions. Say in your final summary
   that placeholder imagery was used and what must drop in.

## Stage 4 — Recomposite + rasterize + QA
Sizes: parse what the user asked for — resolve named channel sets from standard ad
dimensions (e.g. "Meta" → 1080×1080 + 1080×1920; "Google set" → 300×250 / 336×280 /
728×90 / 300×600) and accept raw `WxH`. Default when absent: the reference ad's own
dimensions. If a name is ambiguous or nothing parses, ask.

For each size, author `work/svg/remake__WxH.svg` — self-contained (inline styles,
the kit/reference font stack, no external fonts/CDNs/JS, real `<text>` nodes, images
as base64 data URIs), reproducing the ORIGINAL's archetype, palette, spacing, and
type treatment with the NEW copy and imagery. Design per aspect when multiple sizes
are asked for. Keep logo/copy inside a 4% safe margin.

**Re-fit decorative geometry to the RENDERED text — never copy raw coordinates.**
The new copy is a different length than the original's, so any rule, underline, or
flanking divider tuned to the old string will strike through the new one. The
rasterizer has no DOM (no `getBBox()`): estimate each run's extent (character count ×
font size, or a trial render), derive the geometry from it with a consistent gap,
then trial-render and vision-check that it clears — adjust until it does.

**Rasterize** all sizes in ONE node process (process startup, not encoding, is the
slow part — never spawn one node per size). From `$TOOLS` (with `FONTCONFIG_FILE`
exported):
`cd $TOOLS && node -e "const s=require('sharp'),p=require('path');(async()=>{for(const f of process.argv.slice(1)){await s(f).flatten({background:'#ffffff'}).withMetadata({density:72}).jpeg({quality:95,chromaSubsampling:'4:4:4'}).toFile(p.join('<abs output dir>',p.basename(f,'.svg')+'.jpg'));console.log('ok',p.basename(f))}})()" <abs work/svg>/*.svg`
Re-rasterizing after a QA fix is free — pass just the SVGs you changed.

**QA is a draft → vision-audit loop with a written trail.** Treat the first
render of each size as a draft and keep `work/variation_log.md`: one row per
visible difference from the reference, verdicted `defect` (fix now), `content`
(the new copy/imagery legitimately differs), or `waived` (per the spec's
waivers). Re-render and re-audit until no unresolved `defect` rows — a
difference that was never written down was never audited.

**LOOK at every output JPEG at full resolution:**
- **Presence check first (mechanical, before any pixel judgment)** — diff the
  render against `ad_spec.json`: every copy role, decor device, and photo
  region present or carrying a recorded waiver.
- **Copy exactness** — every price, product name, and date CHARACTER-FOR-CHARACTER
  vs `remake_spec.json`. **Zoom into small type** — clipping hides at full-canvas size.
- **Type is the intended face, not a substitute** — text wider than its box or a
  clipped wordmark means the font didn't register. Fix the font, not the box.
- **Style fidelity vs the reference, side by side with vision** — same layout bones,
  palette, type feel: a stranger should say "same campaign family". For any
  badge/tag/rule, **crop tight on that shape in both** and compare silhouette,
  corner treatment, and proportions at matching zoom. If it still looks off after one
  eyeballed correction, go extract its real path (Stage 1).
- **No rule/divider cutting through the new copy** (the classic remake failure).
- **Nothing clipped; logo clean; 4% safe margins; photo not stretched.**
- **Verify the parts you did not consciously change, too** — a dropped badge hides in
  the regions you assumed were fine. Never report "looks the same" from memory.
Fix the SVG and re-rasterize (free) until clean.

## Stage 5 — Deliver
Deliverables are the JPEGs in `output/`. Final message: one line — what the ad now
sells and at which sizes — plus the old headline → new headline mapping, whether
imagery was supplied / fetched via `product-photos` / placeholder, any copy role
dropped, whether a kit font or a system stack was used, and anything else the user
should know, then DONE.
