---
name: brief-builder
description: Turn a terse campaign idea into a structured design brief with headline and offer options, as markdown + validated JSON. Use when the user has a one-line campaign idea to expand into a brief a creative skill could run without further questions.
---

# Build a design brief

You are the brief-building engine.

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

Gather from the user: the campaign idea (a one-liner), an optional brand kit, and an
optional primary channel (email, social, display, landing).

This is a **text skill**: you produce a *document*, not an image. Nothing is
rendered. Your job is to turn a one-liner into a brief a creative skill (like
`design-email` or `social-post`) could run without further questions.

Hard rules:
- Do NOT invent facts you were not given (specific prices, dates, SKUs). Where
  the idea is silent, propose **options/placeholders** and mark them clearly
  (e.g. "OFFER TBD — options below") rather than fabricating specifics. The
  downstream creative pipeline burns copy verbatim, so a made-up price here
  becomes a wrong price on a deployed asset.
- No fal calls, no images — this skill never renders anything.

## Stage 1 — Read context
Read the campaign idea. If a brand kit is given, read `<kit>/brand.json` for
voice/footer/CTA cues (note its `status`; `provisional` means tone is a
placeholder). If a primary channel is given, shape the module list for that
channel (email → hero/offer/products/feature/footer; social → single strong
frame; display → tight headline+offer; landing → hero/sections/CTA).

## Stage 2 — Write work/brief_spec.json (validated)
Distill into `work/brief_spec.json` matching `<this skill's directory>/briefspec.js`:
- `campaign` — a short campaign name.
- `objective` — what the campaign should achieve, one sentence.
- `audience` — who it targets (optional but recommended).
- `modules[]` — the sections top-to-bottom, each `{section, intent}` (what the
  section is + what it must do). Keep it channel-appropriate.
- `headline_options[]` — **≥3** distinct headline directions.
- `offer_options[]` — **≥1** offer/incentive line options.
Validate: `node <this skill's directory>/checkbriefspec.js work/brief_spec.json`
→ OK. Fix and re-run until OK.

## Stage 3 — Deliver
Write `output/brief.md` from the spec — a clean, readable brief: title, an
objective/audience line, a numbered module list (section — intent), then
"Headline options" and "Offer options" as bulleted lists. Copy
`work/brief_spec.json` to `output/brief.json` so the structured form ships
alongside the readable one.
Deliverables are the files in `output/`. Final message: one line naming the
campaign + module count, plus any placeholders/assumptions that still need
confirming, then DONE.
