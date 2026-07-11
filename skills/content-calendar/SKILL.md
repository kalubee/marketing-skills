---
name: content-calendar
description: Build a dated, validated content calendar from a campaign goal — channels, cadence, asset checklist. Use when the user wants a posting/production schedule for a campaign or period.
---

# Build a content calendar

You are the planning engine.

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

Gather from the user: the plan (what's happening this period — promos,
launches, events, each with real dates), the period (`{start, end}`), an
optional brand kit, and an optional channel list (default: email, social,
display, web).

The job: turn "here's what's happening this period" into a calendar the team
can execute — what publishes on which date, on which channel, and what asset
has to exist by then.

Hard rules:
- Dates and offers in the plan are sacred — a promo that "ends July 14" must
  have its last send/post ON or BEFORE July 14, verbatim pricing throughout.
- Never invent promotions. Gaps in the calendar get evergreen/brand content,
  clearly labeled as such, not fabricated offers.
- Retail rhythm matters: emails announce (start) + remind (mid) + close
  (last day); social sustains between sends; display runs the whole promo
  window. Weight sends toward Thu–Sat for retail unless the plan says
  otherwise.

## Stage 1 — Parse plan + period → work/calendar_spec.json
Resolve the period to `{start, end}` (YYYY-MM-DD). Parse every promo / event /
launch from the plan with its real dates. Channels: use the given list or
default to email, social, display, web.
Build `work/calendar_spec.json`:
```json
{"campaign":"<period name>","period":{"start":"2026-07-01","end":"2026-07-31"},
 "entries":[{"date":"2026-07-03","channel":"email","title":"Summer Patio launch",
             "asset":"email","notes":"hero + 3 products, offer ends 07-14"}]}
```
`asset` names what must be produced — a generic kind (`email`, `social post`,
`display ad`, `landing hero`, `ad copy`) or a short noun. Channels must be one
of: email, social, display, web, sms, in-store, other.
Validate:
`node <this skill's directory>/checkcalendarspec.js work/calendar_spec.json`
→ OK. Fix and re-run until it prints OK.

## Stage 2 — Deliverable → output/calendar.md
Render the spec as a readable markdown calendar:
- Title + period + one-paragraph strategy note (how the period flows).
- A week-by-week table: Date | Channel | What goes out | Asset needed | Notes.
- A "production checklist" section: every distinct asset, its due date
  (publish date minus a working buffer — 3 business days for email, 2 for
  social/display), and — where a sibling skill in this repo can produce it —
  which one (`design-email` for an email, `social-post` for a social post,
  `remake-ad` or `resize-ad` for a display ad). Assets with no matching skill
  here (a landing hero, ad copy) are noted as produced manually.
Also copy `work/calendar_spec.json` to `output/calendar_spec.json`.

## Stage 3 — Deliver
Deliverables are the files in `output/`. Final message: one line — period,
entry count, channels covered — plus anything the user should know, then
DONE.
