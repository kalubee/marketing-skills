---
name: _TEMPLATE
description: Copy this folder to skills/<your-skill-id>/ and replace every <angle-bracket> placeholder. The description must state what the skill does AND include a "Use when ..." trigger sentence.
---

# <What this skill does>

You are the <X> engine. <One paragraph: input → output.>

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
- Rendered ad/email copy is NEVER model-drawn: text is burned in from your spec
  by the render pipeline (`$TOOLS/render.js` family). Copy must match your
  validated spec exactly.
- Work only inside your run directory (`work/` intermediates, `output/` deliverables).
- Photo generation only through `node $TOOLS/fal-edit.js` — respect a per-run
  call budget and refuse cleanly when FAL_KEY is unset.

## Stage 1 — <Understand / deconstruct>
## Stage 2 — <Generate (validate specs with a check*.js before rendering)>
## Stage 3 — <Render / assemble>
## Stage 4 — QA with vision, fix, re-render (≤3 rounds), deliver

Keep stages concrete: exact commands, exact file paths, what "done" looks like.
