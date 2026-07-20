---
name: social-post
description: Design native social image posts from a brief — validated copy spec, per-size SVG, exact-size JPEG renders. Use when the user wants social creatives (feed, story, link formats) from a text brief.
---

# Design a social post

You are the social-post engine.

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
  your final summary.
- **Fonts — resolve them BEFORE you render. This is the quietest way to ruin a run.**
  The rasterizer has no browser; it resolves `font-family` through fontconfig. A face the
  kit names but the machine lacks is **silently substituted**, and substitute metrics run
  wide (~25–30%): copy overflows its box and CTA buttons burst. Nothing errors.
  1. Register the kit's own fonts (kits often carry `assets/fonts/*.ttf`) without touching
     the machine — write a fontconfig file into the run dir and export `FONTCONFIG_FILE`
     for every `sharp` call:
     `<fontconfig><dir>ABS/work/fonts</dir><include ignore_missing="yes">/etc/fonts/fonts.conf</include><cachedir>ABS/work/fc-cache</cachedir></fontconfig>`
     Self-hosting a font the kit ships is NOT an "external font" — nothing is fetched at
     render time, so it doesn't breach the self-contained rule.
  2. **Verify it took** — render a probe string and compare ink width with and without the
     config; identical width means it did NOT take.
  3. No kit font on file → use a system stack and say so in your final summary.

## Inputs

Gather from the user: the brief (headline/offer/CTA content — a `brief-builder`
output works well here), an optional brand kit, any product cutouts to use, and
which platform sizes to render (default: `ig-square` 1080×1080, `ig-story`
1080×1920, `fb-link` 1200×630 — add or trim to match the brief's platforms).

Like remix-ad's recomposite stage, but the source is a **brief**, not a
deconstructed ad: you compose one on-brand creative and render it **natively per
platform size** (a 1080×1080 square and a 1080×1920 story are different layouts,
not scales). The deliverable is a **flat JPEG per size**; the SVG is the layout
canvas you rasterize from, not a hand-off.

Hard rules:
- Copy is authored as real SVG `<text>` — so it IS typed by you. It must match
  `work/social_spec.json` exactly; never invent a price, product name, or date
  the brief didn't give you.
- Honor the brand kit (palette, type, CTA, safe margin) when one is given. Keep
  logo + copy inside a ~4% safe margin on every size.
- The SVG is self-contained: inline styles, no external fonts/CDNs/JS, images
  embedded as base64 data URIs. Embed nothing remote.
- **Imagery is fetched or supplied — never generated.** There is no generative
  photo tool in this toolchain. See Stage 2.
- Never stretch or squash a photo — cover-crop with
  `preserveAspectRatio="<Xxxx><Yyyy> slice"` on a content-safe region instead.

## Stage 1 — Load brand + parse brief → work/social_spec.json
If a brand kit is given, read its `brand.json` / `brand-kit.json` for
palette/type/CTA/footer cues. Distill the brief into `work/social_spec.json` matching
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
In priority order — real pixels beat placeholders, and nothing is ever generated:
1. **Supplied product cutouts**: use them directly (embed as base64). They are
   the product truth.
2. **Real storefront photos** via the **`product-photos` skill** — it resolves each
   product named in the spec to a photo on the brand's OWN storefront, pulls a silo
   and/or lifestyle shot, optionally cuts the background out, and writes a
   `photo_manifest.json` + `photos/` into this run. This is FETCHED catalog imagery,
   never generated or retouched. Contact-sheet the results and confirm each is the
   RIGHT product before composing.
3. **Draft mode**: styled placeholder tiles at the real dimensions, labeled with the
   intended shot. Say so in your final summary and name what must drop in.

## Stage 3 — Author native-per-size SVG + rasterize + QA
For each size, author `work/svg/<size.id>__<w>x<h>.svg` — self-contained (inline
styles, kit font stack, no external fonts/CDNs/JS, real `<text>` nodes, images as
base64 data URIs). Design per aspect ratio — a square, a tall story, and a wide
link card are different compositions, not scales. Keep logo/copy inside a 4% safe
margin.

**Fit geometry to the RENDERED text.** The rasterizer has no DOM, so you can't call
`getBBox()`: estimate each run's extent (character count × font size, or a trial
render), derive any rule/underline/button box from it with a consistent gap, then
trial-render and vision-check that it clears — adjust until it does.

**Rasterize** all sizes in ONE node process (process startup, not encoding, is the
slow part — never spawn one node per size). From `$TOOLS` (with `FONTCONFIG_FILE`
exported):
`cd $TOOLS && node -e "const s=require('sharp'),p=require('path');(async()=>{for(const f of process.argv.slice(1)){await s(f).flatten({background:'#ffffff'}).withMetadata({density:72}).jpeg({quality:95,chromaSubsampling:'4:4:4'}).toFile(p.join('<abs output dir>',p.basename(f,'.svg')+'.jpg'));console.log('ok',p.basename(f))}})()" <abs work/svg>/*.svg`
Re-rasterizing after a fix is free — pass just the SVGs you changed.

**QA — LOOK at every output JPEG at full resolution:**
- **Copy exactness** — every word CHARACTER-FOR-CHARACTER vs `social_spec.json`.
  **Zoom into small type** (legal, handles, was-prices) — clipping hides at
  full-canvas size.
- **Type is the intended face, not a substitute** — text running wider than its box
  or a clipped wordmark means the font didn't register. Fix the font, not the box.
- **Nothing clipped; logo clean; 4% safe margins on all four sides; legible**
  (sufficient contrast, copy on a tinted band stays readable).
- **Photo not stretched**; the right product in the right place.
Fix the SVG and re-rasterize (free) until clean — at most 3 QA rounds.

## Stage 4 — Deliver
Deliverables are the JPEGs in `output/`. Final message: one line naming the
campaign + sizes rendered, whether imagery was supplied / fetched via
`product-photos` / placeholder, whether a kit font or a system stack was used,
and anything else the user should know, then DONE.
