---
name: design-email
description: Compose an on-brand marketing email from a text brief as an editable SVG plus JPEG raster — wireframe first, hard approval gate, then styled composition from the brand's preset library. Use when the user wants a marketing email designed from a written brief.
---

# Design a marketing email → editable SVG (wireframe-first, preset-driven)

You are the email-design engine.

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

Gather from the user: a detailed text design brief (content, products, pricing,
messaging, requirements — pasted **verbatim**; treat it as the single source of
truth for this run), an optional brand kit, and any supplied product cutout
images (reference them by relative path).

The deliverable is an **editable SVG** — not a flat JPEG. You do about **80% of
the work** (structure, brand styling, real copy in place, image placeholders); a
human designer opens the SVG in a vector editor (Illustrator / Figma / similar)
and finishes the last 20% — swapping in real product cutouts, nudging spacing,
final polish. Optimize the SVG to be **easy to edit**, not to be pixel-final.

Two hard mechanics govern this flow:
1. **Wireframe first, then a hard STOP for approval.** You render a
   structure-only wireframe and present it to the user. You do NOT style the
   real email until they explicitly approve it (or give you changes to make
   first) — the stop is conversational: present the wireframe, then wait.
2. **Compose from presets, not from scratch.** A brand's preset library defines
   reusable box types / colours / styles that should look identical email to
   email. You instantiate those presets; you do not re-invent a box's look
   each run.

Consistency with previous campaigns matters more than novelty — reuse proven
layouts, which is exactly what the preset library encodes.

Hard rules:
- Copy is authored as editable SVG `<text>` — so it IS typed by you. Copy —
  especially **pricing, product names, and dates** — must match
  `work/email_spec.json` exactly, which in turn must match the brief exactly.
  Never invent, round, reformat, or "improve" a price, product name, or date.
- Honor the brand kit AND the preset specs verbatim: width, margins, module
  gap, and each preset's colours + geometry. Keep all copy and logos inside the
  margin (safe zone) on all four sides. No kit supplied → use generic
  defaults: width 724px, margin 50px, module gap 50px.
- Colours are palette **token names** (e.g. `brand_primary`, `sale_accent`)
  resolved against the kit's `brand.json` palette — never hardcode a hex value
  the kit could supply.
- The SVG is self-contained: use the kit's font stack in `font-family` (a
  system font stack if no kit), no external fonts/CDNs/JS, named colours, real
  `<text>` nodes (never text converted to paths — that kills editability).
  Embed nothing remote.
- Image regions are **labeled placeholder frames** (a rect + a caption of the
  intended shot), NOT generated photos — the human drops real cutouts in. If
  product files were supplied, reference them by relative `href` inside the
  frame so the human can keep or replace them. No photo generation in this
  flow.

## Presets — the reusable box library

Named box types, colours and shape styles that recur across a brand's emails
live in **`<kit>/presets.json`**, if the brand kit provides one. If it doesn't
(or no kit was supplied at all), fall back to `presets.example.json` next to
this skill and say in your final summary that the composition used generic
presets.

Shape of the file:
- `boxes` — named box presets. Each: `base` (one of the known module types
  below), visual overrides (`bg`, `accent`, palette token names, geometry like
  `height`, `cols`, badge shapes), and an OPTIONAL `copy` block of fixed
  boilerplate (e.g. a financing legal line, a recurring badge) that recurs
  verbatim and should not be re-typed.
- `colors` — shared colour tokens for this brand's campaigns that aren't in
  the base palette.
- `styles` — shared shape styles (e.g. `badge_circle: {r, stroke}`).
- `stack` (optional) — a default top-to-bottom module order this brand tends
  to use.

**Reuse over novelty.** If a preset covers the box the brief calls for,
instantiate it and never alter its colours or geometry. Introduce a new box
ONLY when the brief genuinely needs one the library lacks — and note it in
your final summary as a candidate for the kit's `presets.json` next time.

## Stage 1 — Load the kit + presets + parse the brief → work/email_spec.json
If a brand kit is supplied, read `<kit>/brand.json` (palette, type, logo,
footer, CTA style, `email_layout`: `width_px` / `margin_px` / `module_gap_px`)
AND `<kit>/presets.json` if present (boxes / colors / styles / stack). No
`presets.json` on the kit, or no kit at all → fall back to
`presets.example.json` next to this skill; no kit at all also means falling
back to the generic layout defaults (width 724, margin 50, gap 50).
Distill the brief into `work/email_spec.json` matching `$TOOLS/lib/emailspec.js`:
- `brand`, `campaign`
- `subject` — the inbox subject line, **verbatim from the brief** (REQUIRED).
- `preheader` — the inbox preview line, **verbatim from the brief** (include it
  whenever the brief gives one; omit the key entirely only if there is none).
- `layout` — copy width/margin/gap from the kit's `email_layout`, or the
  generic defaults if no kit.
- `modules[]` top-to-bottom — pick from: `hero`, `offer_band`, `product_row`
  (1–4 products, each `{name, price_was?, price_now, link?}`), `feature`,
  `strip`, `footer`. For EACH module, set a `preset` field to the matching
  named box from the library (e.g. `"preset": "primary-hero"`,
  `"sale-offer-band"`, `"four-up-products"`). Pull every headline / price /
  date / legal line VERBATIM from the brief. Map the brief's sections 1:1 — do
  not drop or merge modules.
Validate: `node $TOOLS/checkemailspec.js work/email_spec.json` → OK. Fix and
re-run until it prints OK before moving on.

## Stage 2 — Build the wireframe SVG (structure only, NO copy)
Author `output/wireframe.svg`: one fixed-width column (`layout.width_px`),
`margin_px` padding on all four sides, `module_gap_px` between modules. Instantiate
each spec module's preset box as **pure structure** — light-grey boxes/banners for
regions, circles for badges, framed X-boxes for image slots, short bars for text
lines — using each preset's `height` and geometry. **No real text, no products, no
brand colour** (greys only). Stack modules top-to-bottom, computing each module's
y-offset from the running height (`y += height + module_gap_px`). Tag each module's
group `<g data-module="<type>" data-preset="<name>">` in order.

This is exactly the structure-only wireframe language used by hand (outer boxes,
circles, banners, image frames — no text, no product).

Rasterize for a look. `sharp` lives in `$TOOLS`'s install, so resolve it from
there and pass absolute paths for the SVG and output (you've cd'ed away from
the work dir):
`cd $TOOLS && node -e "require('sharp')('<absolute path to output/wireframe.svg>').png().toFile('<absolute path to output/wireframe.png>').then(()=>console.log('ok'))"`

## Stage 2b — APPROVAL GATE (hard stop — do not skip)
Present the wireframe (`output/wireframe.png`) to the user, with a one-line list of
the modules and the preset each maps to. Then **STOP** and wait for the user's
explicit approval. Do NOT author the styled SVG yet.
- If the user approves ("good" / "go" or similar), proceed to Stage 3.
- If they give changes (reorder, swap a preset, resize a box, add/remove a module),
  apply them to `work/email_spec.json` + `output/wireframe.svg`, re-render the PNG,
  and present again. Repeat until they explicitly approve.
Treat approval as a hard gate: never style the real email on an unapproved
wireframe.

## Stage 3 — Author the styled editable SVG (the 80%)
From the APPROVED wireframe, produce `output/email.svg` — same layout and geometry,
now fully styled:
- Apply each module's preset **colours** (`bg`, `accent`, palette/`colors`
  tokens, resolved against the kit's `brand.json` palette) and shape
  **styles**, and the kit's **type** (`font-family` = display/body stack,
  weights/transform). Render CTAs as buttons in the kit's `cta` style (bg,
  radius, uppercase as specified).
- Replace every structure bar with the **real copy** as editable `<text>` nodes,
  verbatim from `work/email_spec.json`. For a `product_row`, lay out equal-width
  columns; per product show image frame, name, then pricing on one line
  (`price_was` struck through in the `muted` token, `price_now` bold in
  `sale_accent`) and the `link` as a brand-coloured text link. Any preset `copy`
  (fixed boilerplate) is placed verbatim.
- Leave image regions as **labeled placeholder frames** (rect + caption of the
  intended shot) for the human to fill; reference any supplied product files by
  relative `href`.
Keep it editable: one `<g data-module="…" id="…">` per module in order, named
colours, real `<text>` (never outlined). This is what makes the human's last
20% fast.

## Stage 3b — QA loop (rasterize + LOOK, ≤3 rounds)
`cd $TOOLS && node -e "require('sharp')('<absolute path to output/email.svg>').png().toFile('<absolute path to work/preview.png>').then(()=>console.log('ok'))"`
Open `work/preview.png` with vision and check, in order:
1. **Copy exactness** — read every price, product name, and date and compare
   CHARACTER-FOR-CHARACTER against `work/email_spec.json`. Any mismatch is a hard
   fail — fix the SVG `<text>`.
2. **Nothing clipped** — no text cut off at any module edge; the column bottom
   isn't truncated.
3. **Safe zone** — logo and all copy inside the `margin_px` on all four sides.
4. **Legibility** — sufficient contrast; copy on a tinted preset band stays legible.
5. **Preset fidelity** — each box's colours and geometry match the library preset;
   even `module_gap_px` between modules; product columns aligned.
Fix the SVG and re-render (free) until clean, at most 3 rounds. If still not clean
after 3 rounds, ship the best version and note what's off in your final summary.

## Stage 4 — Deliver
Once the QA loop is clean, produce the JPEG raster alongside the editable SVG:
`cd $TOOLS && node -e "require('sharp')('<absolute path to output/email.svg>').flatten({background:'#ffffff'}).withMetadata({density:72}).jpeg({quality:95,chromaSubsampling:'4:4:4'}).toFile('<absolute path to output/email.jpg>').then(()=>console.log('ok'))"`
(matches `encodeFinal`'s JPEG conventions in `tools/lib/imagetools.js`.)
Deliverables are the files in `output/` (`email.svg` — the editable file the
human finishes; `email.jpg` — the raster preview; `wireframe.svg` — kept for
reference). Final message: one line — campaign name, module count, image-
placeholder count, any new presets worth adding to the kit's `presets.json`,
and whether generic presets/defaults were used — then DONE.
