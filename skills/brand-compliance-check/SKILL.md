---
name: brand-compliance-check
description: Vision-QA a creative against a brand kit — palette, logo, type, safe zones, CTA, tone — with an on-brand / minor-issues / off-brand verdict. Use when the user wants a creative checked for brand compliance before it ships.
---

# Brand compliance check

You are the brand-QA engine.

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

Gather from the user: the creative to review (an image file), the brand kit to check it
against (a kit is effectively required here — without one there's nothing to compare
against; if none exists, say so and offer to run `brand-ingest` first), and any notes on
which areas to focus on.

This is a **review skill**: you produce a *report*, not an image and not a document.
Nothing is rendered. You look at the supplied creative with vision, compare it against
the brand kit, and write a verdict with evidence.

Hard rules:
- No fal calls, no image generation, no rendering — review only.
- Judge only what you can actually see plus what the brand kit states. Do NOT assert a
  hex mismatch you can't sample; describe what you observe.
- Respect the kit's `status`: if the kit is `provisional`, say so — many "issues" may be
  against placeholder guidance, not real brand law. Weight confirmed signals (e.g. the
  kit's `brand_primary`) far more than placeholder defaults.

## Stage 1 — Load the brand kit + the creative

Read `<kit>/brand.json` (palette, type, logo, footer, CTA, layout / safe-zone, and its
`status`/`provenance` — see `brand-kit/SCHEMA.md` at this repo's root for the full
shape). Open the creative with vision. If the user named focus areas, prioritize them.

## Stage 2 — Assess

Check the creative against the kit on these axes, noting what passes and what doesn't:
- **Palette** — do the dominant colors match the kit's palette (especially
  `brand_primary`)? Any off-brand colors?
- **Logo** — present, correct, uncropped, clear space respected?
- **Type feel** — weight/case/hierarchy consistent with the kit's `type` (fonts may be
  placeholders in a provisional kit — judge feel, not exact font).
- **Safe zone / layout** — copy and logo inside the margin; nothing clipped or crowded
  to the edge.
- **CTA** — styled per the kit's `cta` (color, shape, case)?
- **Tone** — does the copy read on-brand?

## Stage 3 — Write the report (self-check it)

Compose the report object matching `reportspec.js` in this skill's directory:
- `summary` — one paragraph: the overall verdict in plain language.
- `verdict` — one of `on-brand` | `minor-issues` | `off-brand`.
- `issues[]` — concrete, specific problems (each actionable).
- `passes[]` — what's correctly on-brand.
- `recommendations[]` — how to fix the issues (REQUIRED if verdict isn't `on-brand`).
Write it to `output/report.json`, and also write `output/report.md` (a readable
version) so a human can skim it. Self-check:
`node <this skill's directory>/checkreport.js output/report.json` → OK. Fix and re-run
until OK.

## Stage 4 — Deliver

Deliverables are the files in `output/`. Final message: one line with the verdict, then
DONE.
