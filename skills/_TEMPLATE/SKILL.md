---
name: _TEMPLATE
description: Copy this folder to skills/<your-skill-id>/ and replace every <angle-bracket> placeholder. The description must state what the skill does AND include a "Use when ..." trigger sentence.
---

# <What this skill does>

You are the <X> engine. <One paragraph: input → output.>

## Setup

- **Tools:** `TOOLS = <this skill's directory>/../../tools` (resolve against the base
  directory announced when this skill loads). One-time machine setup, only if
  `$TOOLS/node_modules` is missing: `cd $TOOLS && npm install` (installs `sharp` —
  rasterizes SVG → JPEG, reads image
  dimensions, crops regions. There is no browser/render server and no generative
  image tool; `sharp` + hand-authored SVG IS the pipeline).
- **Work dir:** create a fresh directory for this run (in the current working directory
  or your scratchpad) with `work/` and `output/` inside. Intermediates go in `work/`,
  finished deliverables in `output/`. Work only inside this directory.
- **Brand kit (optional):** if the user provides a brand-kit folder (a directory with
  `brand.json` or `brand-kit.json` — read that file, don't hunt for a separate
  schema doc), honor its palette, type, voice, footer and CTA rules,
  and use its `link-map.json` / `products.json` / `presets.json` / `refs/` when present.
  No kit given → ask whether one exists; otherwise proceed brand-neutral and say so in
  your final summary.
- **Fonts (any skill that rasterizes text):** the rasterizer resolves `font-family`
  through fontconfig and **silently substitutes** a face the machine lacks — substitute
  metrics run ~25–30% wide, so text overflows and wordmarks clip, with no error.
  Register the kit's own `assets/fonts/*.ttf` by writing a fontconfig file into the run
  dir and exporting `FONTCONFIG_FILE` for every `sharp` call, then VERIFY it took
  (probe one string; identical ink width with and without = it didn't take).

Common commands (all `sharp`, no other tooling exists):
- dimensions: `node -e "require('sharp')(F).metadata().then(m=>console.log(m.width,m.height))"`
- crop a region: `node -e "require('sharp')(F).extract({left,top,width,height}).png().toFile(O)"`
- SVG → final JPEG: `node -e "require('sharp')(S).flatten({background:'#ffffff'}).withMetadata({density:72}).jpeg({quality:95,chromaSubsampling:'4:4:4'}).toFile(O)"`
- cover-crop imagery inside SVG: `<image preserveAspectRatio="xMidYMid slice">`, base64 data URI

Hard rules:
- Rendered copy is NEVER model-drawn: it is real SVG `<text>` you author, and must
  match your validated spec exactly — never invent a price, product name, or date.
- Work only inside your run directory (`work/` intermediates, `output/` deliverables).
- **Imagery is fetched or supplied, never generated** — use the `product-photos` skill
  to pull REAL photos from the brand's own storefront, or supplied files; otherwise a
  labeled placeholder. Never invent or retouch product imagery.
- SVG is self-contained: no external fonts/CDNs/JS, images embedded as base64.

## Stage 1 — <Understand / deconstruct>
## Stage 2 — <Generate (validate specs with a check*.js before rendering)>
## Stage 3 — <Render / assemble>
## Stage 4 — QA with vision, fix, re-render (≤3 rounds), deliver

Keep stages concrete: exact commands, exact file paths, what "done" looks like.
