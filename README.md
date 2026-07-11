# marketing-skills

Marketing creative-production skills for [Claude Code](https://claude.com/claude-code).
Each skill is a self-contained `SKILL.md` plus a shared `tools/` package: point
Claude at a brief, a reference ad, or a flat image, and it hands back
deliverable files — rendered ads, editable emails, clickable HTML, briefs,
calendars, brand-kit research — with no host application and no hidden state.

## What

Ten skills cover the full loop from campaign idea to shippable creative:
turning a one-line idea into a brief, building the calendar around it,
producing ads/emails/social posts, coding a finished email into clickable
HTML, and checking anything against a brand kit before it ships. Only the
image-generation paths call out to [fal.ai](https://fal.ai); every other
capability — copy, layout, resize, render, code, plan — runs with no
external key at all.

| Skill | Purpose | Needs `FAL_KEY`? |
|---|---|---|
| `remix-ad` | Regenerate a finished ad's photo per instruction and recomposite native variants at every requested size | Yes, for photo swaps |
| `remake-ad` | Clone a reference ad's exact style with new copy and imagery | Optional |
| `resize-ad` | Reformat a finished ad into new channel sizes, rebuilt natively per aspect | Optional (rare extend fallback) |
| `social-post` | Design native social image posts from a brief — copy spec, per-size HTML, exact-size JPEGs | Optional |
| `design-email` | Compose an on-brand marketing email from a brief as editable SVG + JPEG | No |
| `email-clickable` | Turn a finished flat email image into deployable, table-based clickable HTML | No |
| `brief-builder` | Turn a terse campaign idea into a structured design brief with headline/offer options | No |
| `content-calendar` | Build a dated, validated content calendar from a campaign goal | No |
| `brand-ingest` | Research a brand's public site and propose a starting brand-kit `brand.json` | No |
| `brand-compliance-check` | Vision-QA a creative against a brand kit — on-brand / minor-issues / off-brand verdict | No |

No `FAL_KEY`? Every non-generative capability still works: briefs, calendars,
resizes and layout variants, email design and coding, and brand QA all run
with zero external keys. Only new or swapped photography needs one.

## Install

```
/plugin marketplace add kalubee/marketing-skills
/plugin install marketing@marketing-skills
```

Working from a local checkout instead of GitHub:

```
/plugin marketplace add /path/to/marketing-skills
```

Skills are then available as `marketing:<skill>`, e.g. `marketing:remix-ad`.

## One-time setup

The skills share one tools package. Install it once per machine:

```
cd tools && npm install && npx playwright install chromium
```

Optionally, enable photo generation and photo swaps:

```
export FAL_KEY=...
```

Get a key at [fal.ai](https://fal.ai); image edits cost roughly $0.05 each.
Without `FAL_KEY`, photo generation refuses cleanly and every other
capability — copy, layout, resize, render — still works.

## Brand kits

Skills that produce branded deliverables accept an optional **brand kit**: a
folder with a `brand.json` (palette, type, voice, links) that any skill reads
the same way. See `brand-kit/SCHEMA.md` for the full schema and
`brand-kit/example/` for a complete fictional sample (used only to document
the format and give skills something real to run against). Real brand kits —
a company's actual colors, fonts, copy, and links — don't belong in this
repo; keep them in a private repo or folder and pass the path when you run a
skill.

## Design principles

- **Copy is burned from spec, never model-drawn.** Rendered text in an ad or
  email always comes from a validated spec file through the render pipeline
  — a model never draws the words onto the image.
- **Native per-aspect layout, no scaling.** Each output size gets its own
  layout pass instead of a single design stretched or shrunk to fit.
- **Vision QA loops.** Generated imagery and finished renders are checked
  visually against the brief or reference before being accepted, with
  bounded retries.
- **Validate before render.** Every spec is checked against its schema before
  anything is rendered, so failures surface as clear errors instead of broken
  output.

## License

[MIT](LICENSE)
