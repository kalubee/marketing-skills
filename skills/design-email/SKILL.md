---
name: design-email
description: Compose an on-brand marketing email from a text brief as an editable SVG plus JPEG raster — wireframe first, hard approval gate, then styled composition from the brand's preset library. Use when the user wants a marketing email designed from a written brief.
---

# Design a marketing email → editable SVG (wireframe-first, preset-driven)

You are the email-design engine.

## Setup

- **Tools:** `TOOLS = <this skill's directory>/../../tools` (resolve against the base
  directory announced when this skill loads). One-time machine setup, only if
  `$TOOLS/node_modules` is missing: `cd $TOOLS && npm install` (installs `sharp`,
  which rasterizes SVG → JPEG — no browser/render server needed). This skill is
  self-contained — everything below runs from a reference image + brief with no
  prior runs. The bundled helpers:
  - `$TOOLS/lib/emaillib.js` — `require()` it from your `work/render.js` for the
    shared, correct primitives: `frame` (near-white dashed photo placeholder),
    `priceBig` (superscript price), `priceTag` (pointed tag, AUTO-SIZED to its
    label so it never clips), and the **wireframe fallback** (`blockOrWire`/
    `wireBox`, below). `const em = require('<TOOLS>/lib/emaillib.js').make(P, {HEAVY, BODY, wireDir: __dirname})`.
  - `$TOOLS/extract-shape.js` — lift a CLEAN, COMPLETE decorative shape from a
    reference (flood-fill hole-fill + optional convex hull). Use it whenever a
    shape can't be copied as a literal `<path>` (see Setup shape notes).
  - `$TOOLS/qa-compare.js` — the wireframe-fallback decision harness (Stage 3b).
- **Work dir:** create a fresh directory for this run (in the current working directory
  or your scratchpad) with `work/` and `output/` inside. Intermediates go in `work/`,
  finished deliverables in `output/`. Work only inside this directory.
- **Brand kit (optional):** if the user provides a brand-kit folder (a directory with
  `brand.json` or `brand-kit.json` — read that file, don't hunt for a separate
  schema doc), honor its palette, type, voice, footer and CTA rules,
  and use its `link-map.json` / `products.json` / `presets.json` / `refs/` when present.
  No kit given → ask whether one exists; otherwise proceed brand-neutral and say so in
  your final summary.
- **Reference creative (optional):** if the kit (or the user) points at an existing
  finished email — an `Example Emails/` folder, a `refs/` asset, or a named file — and
  the brief says to match that email's exact visual style, treat its **source SVG**, not
  the rendered JPG, as ground truth. **Copy the real thing over; never redraw a generic
  stand-in for something the source already contains.** A hand-approximation of a shape,
  logo, or texture reads as recognizably wrong (corner radius, taper, proportions) even
  after several eyeballed corrections — reusing the real asset gets it right in one step.
  First build a **class→fill map** from the `<style>` block (`.stN { fill:#hex }`) — the
  whole extraction workflow keys off it, and the block's own hex values ARE the exact
  palette (use them; don't eyeball colours off the JPG). Then, to locate any element,
  find it by its fill + approximate on-page position (the SVG content is usually just
  offset/scaled from the email's own coordinate space, so a shape's x/y map back with a
  constant offset). Three kinds of material to pull out, each a different technique:
  1. **Custom vector shapes** (a tag/banner/badge silhouette, an icon — anything beyond a
     plain rect/circle): grep the SVG for the shape's fill class/color to find its
     `<path>`/`<polygon>`, parse the `d` into absolute coords (relative `l`/`c` accumulate
     from `M`), compute its bbox, normalize to `(0,0)`, and write a `place(x,y,w,h)` helper
     that scales+translates it into any module's box (non-uniform scaling is fine).
     **This applies even to shapes that LOOK simple.** A price banner that reads as "a gold
     box" is, in the source, a specific thing: an exact fill hex, **sharp vs rounded corners**,
     a real width/height proportion, and often a separate sub-element for a detail (e.g. a
     ribbon *fold* is its own little rotated `<rect>`). Read those exact attributes off the
     element and reproduce them — do NOT approximate "a rounded gold box with a triangle".
     Guessing corner-radius, shade, proportion, or a fold's geometry is exactly what reads
     as "dumb/wrong" to the person who knows the template. When unsure, extract the element(s)
     verbatim into a tiny standalone SVG, render it to a PNG, and confirm the silhouette
     before wiring it into the renderer.
     **When the literal `<path>` can't be copied cleanly** — the shape lives in nested
     `<g transform>` groups (its coords are local, not page-space), or its outline is
     welded to knocked-out white text (a pennant/banner with baked-in copy) — do NOT
     hand-trace it. Lift it from the RENDER with `$TOOLS/extract-shape.js`: it masks the
     shape's fill colour, bridges the text breaks, flood-fills the interior holes, and
     (with `--hull`) reduces to a convex hull = perfectly clean straight edges. Output a
     solid PNG asset, or `--out-json` normalized polygon points to drop in as an SVG
     `<polygon>`. Example (box is in the reference rendered at `--width`):
     `node $TOOLS/extract-shape.js --ref <ref.svg> --box x,y,w,h --color '#hex' --hull --out-json work/assets/<shape>.json`
     Always render the result and eyeball it before wiring it in — a lifted shape with
     notches/cut-offs at zoom is a fail (see Stage 3b wireframe fallback).
     If a shape still can't be produced cleanly, do NOT ship a hand-drawn stand-in and do
     NOT keep re-styling it past two rounds — route it through the wireframe fallback.
  2. **Embedded raster brand assets** — logos/wordmark lockups, "made in …"/flag marks,
     photographic badges are frequently baked-in `<image>` elements, NOT vector, so they
     can't be path-extracted. Pull the topmost/relevant `<image>`'s `data:…;base64` out
     (note its on-page position/size from the `transform`), save it, and **re-embed it as
     a base64 data URI** in your header/module. Redrawing a logo or a national-flag glyph
     by hand is the classic "generic placeholder" mistake — extract the pixels instead.
  3. **Type is often OUTLINED to paths** (an Illustrator export can have zero live `<text>`
     nodes — every word/number is vector artwork). You then CANNOT copy or re-word the
     reference's text; new campaign copy must be **re-typeset**. Set it in the brand kit's
     declared font stack — and if the kit's real display face is a licensed font that isn't
     installed, use the kit's documented substitute (list it stack-first so it snaps to the
     real face once supplied). A generic system stack (plain Helvetica/Arial) when the brand
     face is a rounded-humanist/quirky display type reads visibly off — check the kit's
     `assets/fonts/` note before choosing.
  4. **Background patterns / textures** — tone-on-tone watermark text or a repeating motif
     is usually a `<pattern id="…">` filling a rect. Render that pattern tile to a PNG and
     re-tile it, but honor its `patternTransform`: reproduce the true **tile size** (a
     too-small tile shrinks big letters into noise) and any **flip/rotation** (a negative
     scale means the tile renders mirrored/upside-down if you skip it). Sample the source's
     actual base vs. mark colors so the contrast direction is right (light-on-mid, not the
     reverse).
- **One brand can have several distinct templates** (e.g. a bold-promo look, a clearance
  look, an editorial-lifestyle look…). **Each is its own format — scan it top to bottom
  and reproduce ITS specific structure; do not assume templates share a skeleton.** They
  differ in real ways: which badges/panels/ribbons they use, whether prices sit on a
  banner or in the open, whether there's a header nav, and **whether they even have a
  footer/coverage block at all** (some end at a product grid). Forcing one template's
  modules onto another — e.g. stamping a shared support/coverage footer strip or a loud
  offer-card onto a template whose reference has neither — is a common, immediately
  visible error. Build each template as its own preset.
- **Real product photos (optional):** to drop ACTUAL product imagery into the email
  instead of leaving every image region a placeholder, use the **`product-photos`
  skill**. It resolves each product named in the spec to a photo on the brand's OWN
  storefront (never invents one), pulls a silo and/or lifestyle shot, optionally cuts
  the background out, and writes a `photo_manifest.json` + `photos/` into this run.
  This is FETCHED catalog imagery (real product shots), never generated or retouched.
  Consumed in Stage 3c; the base `email.svg` still ships with placeholder frames.

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
  resolved against the kit's palette — never hardcode a hex value
  the kit could supply.
- The SVG is self-contained: use the kit's font stack in `font-family` (a
  system font stack if no kit), no external fonts/CDNs/JS, named colours, real
  `<text>` nodes (never text converted to paths — that kills editability).
  Embed nothing remote.
- Image regions in the base `email.svg` are **labeled placeholder frames** (a
  rect + a caption of the intended shot), NOT baked-in photos — the human drops
  real cutouts in. If product files were supplied, reference them by relative
  `href` inside the frame so the human can keep or replace them. Real FETCHED
  product photos, when wanted, go into a SEPARATE optional `email_photos`
  deliverable via the `product-photos` skill (Stage 3c) — the base `email.svg`
  stays placeholder-framed so it remains a clean editable hand-off.

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
If you extracted a shape from a reference SVG (see Setup) because the kit
had no preset for it, that extracted, normalized path template IS the new
preset — record its origin (which file/class it came from) in your summary
so it can be promoted into `presets.json` verbatim.

## Stage 1 — Load the kit + presets + parse the brief → work/email_spec.json
If a brand kit is supplied, read its `brand.json` / `brand-kit.json` (palette, type, logo,
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
- `modules[]` top-to-bottom — pick from: `header` (logo/wordmark + nav —
  only include it if the brief or the brand's own reference creative actually
  calls for one; don't invent nav items), `hero`, `offer_band`, `product_row`
  (1–4 products, each `{name, price_was?, price_now, link?}`), `feature`,
  `strip`, `footer`. For EACH module, set a `preset` field to the matching
  named box from the library (e.g. `"preset": "primary-hero"`,
  `"sale-offer-band"`, `"four-up-products"`). Pull every headline / price /
  date / legal line VERBATIM from the brief. Map the brief's sections 1:1 — do
  not drop or merge modules.
- **Vary the product treatments — do not render every product in the same card.**
  A column of identical cards reads as a spreadsheet, not a designed email (and
  reference campaigns never do it). Give the products a MIX of layouts, chosen to
  echo how the reference paces its page: e.g. one full-width **hero product**, a
  **2-up** compact pair, a coloured **offer-panel + product** combo, a **horizontal
  split** (photo one side / copy the other, and mirror the side on the next one), a
  **feature band** (photo + coloured side panel). Assign each brief product to a
  treatment in the spec (a `layout` hint per product/row) so Stage 3 renders variety,
  not repetition.
Validate: `node $TOOLS/checkemailspec.js work/email_spec.json` → OK. Fix and
re-run until it prints OK before moving on.

## Stage 1b — Template anatomy inventory (mandatory when matching reference creative)

Reproducing a template faithfully is a *noticing* problem before it is a
rendering problem — and instructions to "look carefully" don't survive
contact with generation. So the looking produces an ARTIFACT: for EACH target
template, before composing anything (wireframe included), walk its reference
top-to-bottom — the source SVG for ground truth plus the final JPG at full
resolution — and write `work/anatomy_<style>.json`: the ordered list of every
element the reference contains. Per element:
- `type` — header / ribbon-strip / hero / flag / badge / offer-band / panel /
  product-row / strip / grid / coverage-row / footer / …
- `geometry` — y-range and box (approximate is fine; order and existence are
  what matter)
- `fills` — palette tokens, and any pattern/texture with a note of what the
  tile actually depicts (**if a texture's tile contains words, say the words**
  — a pattern made of language is both chrome and copy, and briefs need to be
  able to rule on it)
- `text_slots` — each classified `chrome` (the template's own fixed
  vocabulary, e.g. a repeating urgency ribbon, a coverage row's labels) or
  `campaign` (a slot the brief's copy fills). **Bright line: anything that
  states a price, discount, percentage, or offer claim is ALWAYS `campaign`,
  never `chrome`, no matter how consistently the brand's references repeat
  it** — chrome is structure and decoration; an offer is a promise, and a
  promise the brief doesn't make must not ship. If such an element has no
  matching brief content, it gets waived, not copied.
- `source` — where in the reference SVG it lives (class/element), so a later
  stage can extract the real asset instead of redrawing it

Then the contract: **every inventoried element is either instantiated in the
composition or explicitly waived** — add `waived: "<reason derived from the
brief>"` to the element in the JSON and mention it in the final summary. No
silent drops, ever: a remix may reorder or restyle elements within the
template's grammar; only a recorded waiver may remove one. If a brief's tone
rules collide with a `chrome` element (e.g. a no-promo-copy brief vs. a
sale-worded texture), that's a waiver decision — record it and flag the
collision in the final summary rather than deciding silently.

## Stage 2 — Build the wireframe SVG (grey-toned structure preview, REAL copy)
Author `output/wireframe.svg`: one fixed-width column (`layout.width_px`),
`margin_px` padding on all four sides, `module_gap_px` between modules. This should
genuinely preview the final, not stand in an abstract diagram for it — reuse each
preset's REAL geometry (a distinctive tag/banner/badge silhouette, not a generic
rectangle), the kit's real font stack, AND the real copy from `work/email_spec.json`
(headlines, product names, prices, badges — verbatim, same as Stage 3 will render).
The wireframe carries the **full, correct per-template FORMATTING** — every module in
its real position with its real layout (the actual banners, panels, badges, ribbons,
price-tabs, section headers, logo/asset placement, and the same footer-or-no-footer
each template really has). The ONLY things removed are colour and detail:
- **Same composition, colour mapped to grey.** The cleanest way to guarantee the
  wireframe and the final never drift is to render the SAME composition twice from ONE
  code path — once with the real palette (Stage 3's `email.svg`) and once with every
  colour token mapped to a greyscale value by luminance (accent fills → mid-grey, dark
  bands → dark-grey, keep white/hairline light). Use the SAME shape functions/geometry
  for both — never substitute plain boxes for the greyed version. A reviewer approving
  structure must see the actual silhouette (tag, banner, panel, ribbon), not a rectangle
  they have to imagine.
- **No detail, just formatting.** Drop embedded photos (X-box placeholders) and flatten
  any texture/pattern/watermark fills to a plain flat grey — the wireframe shows
  structure and layout, not the busy surface detail. Real geometry stays; real texture
  does not.
- **Real copy, not greeked placeholder text.** Do NOT substitute lorem-ipsum or
  generic labels — render the actual headline/product name/price/badge text from
  the spec, just in grey instead of the brand's accent colour. The point of the
  approval gate is confirming the right product and copy landed in the right
  module with the right emphasis; greeked text hides exactly the information a
  reviewer needs to approve that. (It also happens to keep line-wrap counts
  identical to Stage 3 automatically, since it's the same string.)
- Image regions are still framed X-box placeholders with a caption of the intended
  shot (no photos).
Compute each module's y-offset from the running height (`y += height + module_gap_px`)
and tag each module's group `<g data-module="<type>" data-preset="<name>">` in order.

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

**Stage 3 is a REBUILD toward the reference, NOT a colour-fill of the wireframe
(MANDATORY — every run, no exceptions).** The wireframe locked exactly three
things: structure, copy, and module order. It locked NOTHING about the surface.
Do not simply recolour the approved wireframe's boxes — a recoloured wireframe
reads as a prototype, and that is the single most common and most visible failure
of this skill. Treat your first styled render as a **discardable v1** and rebuild
each module toward the reference until it is indistinguishable in grammar (the
same posture the QA loop in 3b enforces). When you are matching a reference
creative, EVERY styled pass MUST do all four of these, every time:

1. **Extract & composite the reference's OWN artwork — not just the logo.** Any
   decorative element the reference contains as real art — hero decorations,
   background patterns/textures, pennants / tags / ribbons / badges with a real
   silhouette, price banners, coverage/feature icons — is EXTRACTED (per Setup:
   raster `<image>` → base64 re-embed; vector → `extract-shape.js`/copied path)
   and composited, **never redrawn as a generic stand-in.** Redrawing a shape the
   reference already contains is the defining "prototype" tell — a drawn
   parallelogram where the reference has a real folded pennant reads as wrong to
   anyone who knows the template. Extracted decorations belong in the run's
   `work/assets/` (and shared brand chrome — logo, coverage icons — in the kit's
   `assets/` so every future email reuses them).
2. **Sample the palette from the RENDERED reference pixels, not only the source
   `<style>` hex.** The rendered colour is frequently, visibly different from the
   source hex (a hero red that reads dusty in the render can be a saturated hex in
   the source because it sits under a texture/overlay, or is a different element
   than the one you grepped). Rasterize the reference (or open its final JPG) and
   pick the ACTUAL pixel colours with a sampler; use those. Watch for genuinely
   distinct tones the flat read collapses (e.g. a dusty hero red vs a deeper
   section/badge red are two colours, not one).
3. **Reproduce the reference's DENSE grammar with the brief's real numbers.**
   Build the specific card/badge anatomy the reference uses, not a simplified
   line: a `$`-off roundel computed from the real `price_was − price_now` delta,
   alternating value tags (HOT BUY / AMAZING VALUE / etc.) where the reference
   alternates them, a full price hierarchy (struck reg price + big now price with
   superscript cents + fine-print), banner folds, etc. A column of plain boxes
   reads as a spreadsheet; the reference's density IS the design.
4. **Match the reference's real ENDING and per-module treatment.** Some templates
   end at a product grid with NO coverage row and NO footer (the ESP appends legal
   downstream); others carry both. End where the reference ends — do not append
   modules it lacks, and do not silently drop ones it has (removal is a recorded
   Stage 1b waiver, never a quiet omission).

From the APPROVED wireframe, produce `output/email.svg` — same structure, copy,
and module order, its surface rebuilt to the reference per the four rules above:
- Apply each module's preset **colours** (`bg`, `accent`, palette/`colors`
  tokens, resolved against the kit's palette) and shape
  **styles**, and the kit's **type** (`font-family` = display/body stack,
  weights/transform). Render CTAs as buttons in the kit's `cta` style (bg,
  radius, uppercase as specified).
- Rebuild the surface to the reference — NOT just a recolour. The copy itself
  doesn't change (it was already real in the wireframe), but the visual is rebuilt
  per the four mandatory rules above: real extracted artwork replaces drawn
  stand-ins, render-sampled colours replace the grey tones, and each module takes
  the reference's dense grammar. "Swap grey for the accent token and stop" is
  exactly the prototype failure. Keep copy as editable `<text>`
  nodes verbatim from `work/email_spec.json`. For a `product_row`, lay out equal-width
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
**HARD GATE — never present or hand off a draft you have not run this loop on.**
The user is not your QA pass. If the person reviewing can spot a defect (text
upside-down, a shape that's a plain box where the reference is a banner/ribbon,
off-centre copy, clipping) at a glance, you skipped this loop — running it is not
optional and not deferrable to "after approval". Three defects that recur and MUST
be checked every round: (a) **orientation of any extracted pattern/texture tile** —
a reference `patternTransform` with a negative scale renders the tile
mirrored/upside-down unless you flip it, so read the actual letters/motif in the
render and confirm they're upright; (b) **number/price/offer elements are almost
never plain rectangles** — they sit on banners, ribbons, tabs, or badges with a
real silhouette (folds, angled ends, notches), so reproduce the shape, not a box;
(c) **centring** — anything meant to be centred (in a band, on a tab, within a
shape) is measured, not eyeballed. 
Treat the first styled render as a **discardable v1** (per Stage 3), and this loop
as a rebuild → vision-audit cycle with a written trail. When matching a reference,
keep going past "close" until each region is **indistinguishable in grammar** from
the reference — a merely recoloured wireframe never passes this loop. After the
first render of
each template, do the audit below and keep a `work/variation_log_<style>.md`:
one row per visible difference from the reference, each with a verdict —
`defect` (fix now), `content` (the brief's content legitimately differs —
keep), or `waived` (per a Stage 1b inventory waiver). Re-render and re-audit
until the log has **no unresolved `defect` rows**. A difference that was
never written down was never audited — "looks the same" without a log row is
not a pass.

Open `work/preview.png` with vision and check, in order:
0. **Inventory presence check (mechanical, before any pixel judgment)** —
   diff the rendered module list against `work/anatomy_<style>.json`
   (Stage 1b): every inventoried element is present or carries a recorded
   waiver. A missing banner/ribbon/strip/coverage-row is a hard fail no
   amount of visual polish can offset — this catch must not depend on
   noticing it in the render.
1. **Copy exactness — mechanical grep AND vision (both, every rebuild).** First
   mechanically diff the rendered SVG against `work/email_spec.json`: for every
   price, product name, date, badge, and legal line in the spec, `grep` it in
   `output/email.svg` and confirm it is present (accounting for `<text>`/`<tspan>`
   splits — e.g. superscript cents split `$999` from `99`, so check the dollar
   integer and the cents separately). A rebuild silently DROPS fields (a struck
   `was` price, a legal footnote) that vision skims right over — the grep is what
   catches it, so it is mandatory, not optional. Then read every price/name/date
   with vision and compare CHARACTER-FOR-CHARACTER. Any missing or mismatched
   value is a hard fail — fix the SVG `<text>` and re-audit.
2. **Nothing clipped** — no text cut off at any module edge; the column bottom
   isn't truncated.
3. **Safe zone** — logo and all copy inside the `margin_px` on all four sides.
4. **Legibility** — sufficient contrast; copy on a tinted preset band stays legible.
5. **Preset fidelity** — each box's colours and geometry match the library preset;
   even `module_gap_px` between modules; product columns aligned.
6. **Shape fidelity, when copying a reference** — render the candidate and look at it
   next to the actual reference image at matching zoom, with your own vision, every
   round. Don't approve a custom shape from memory or a single glance at the full
   email — crop tight on just that shape in both images and compare silhouette,
   corner treatment, and proportions directly. A shape that "looks close" zoomed out
   often reads as visibly wrong zoomed in (and that's exactly the gap a person
   reviewing your work will spot immediately). If a shape still looks off after one
   eyeballed correction, stop guessing and go extract its real path data instead (Setup).
7. **Text fits the shape it's on** — for any non-rectangular preset (a tag, banner,
   badge), confirm you computed the text block's total height and centered it in the
   shape's solid area. Anchoring a text block from a fixed top offset silently leaves
   dead space below it (or worse) whenever the shape or copy length changes. Also
   check baseline-to-baseline spacing between adjacent lines of very different font
   sizes: the gap must be sized off the LARGER of the two sizes, not the smaller one
   — a small eyebrow line followed by a big display numeral needs a much bigger gap
   than the eyebrow's own size would suggest, or the numeral's top overlaps it.
8. **Band-by-band diff against the reference (mandatory when matching one).** A
   downscaled side-by-side thumbnail is NOT verification — it hides exactly the
   differences that matter (whether a section even exists, whether a price sits on a
   banner vs. in the open, whether a background texture is present). Slice BOTH the
   reference JPG and your rasterized candidate into matching full-width horizontal bands
   (~1000px tall) and compare each band at full resolution, top to bottom. Write down
   every difference, no matter how small — module present/absent, badge/price/CTA
   treatment (button vs. text-link), background/pattern, section-title colour, spacing —
   then fix the real ones. Verify the parts you did NOT edit too, not just your changes:
   the most-missed defects (a stray footer, a module the reference lacks) live in the
   regions you assumed were fine. Never report "looks the same" from memory or a glance.
Fix the SVG and re-render (free) until clean. Matching a reference exactly usually
takes more than 3 rounds of the earlier checks; the band-by-band diff (8) is the one
you keep running until no differences remain. If a genuine gap is content-driven (the
brief is shorter than the reference campaign), leave it rather than inventing copy, and
note it in your final summary.

### Wireframe fallback — degrade, don't ship a wrong shape
A styled decorative block (a hero shape, banner, badge, pennant) that you cannot
make genuinely match the reference at zoom must **fall back to a wireframe** — the
block's text in a plain labeled outlined rectangle — NOT ship as a broken/approximate
shape. A clean wireframe reads as an honest "styling unavailable here" placeholder; a
mismatched filled shape reads as a mistake. This is a required capability, not a
last resort:
- **Mechanism** (bundled — `$TOOLS/lib/emaillib.js`). Route every such block through
  `em.blockOrWire(id, x, y, w, h, styledFn, title, lines)`. Ids listed in
  `work/wireframe-blocks.json` render via `wireBox` (white rect + dashed border +
  small corner label + the `lines` centered) instead of `styledFn()`. Keep the id
  stable so the decision persists across re-renders. (`emaillib` reads that JSON from
  the `wireDir` you pass to `.make()`.)
- **Decide with the compare harness** (bundled — `$TOOLS/qa-compare.js`). Author a
  `work/qa-blocks.json` mapping each block id to its box in your email space and the
  matching box in the reference render: `{ "hero": {"mine":[x,y,w,h],"ref":[x,y,w,h],"label":"Hero"} }`.
  Then: `node $TOOLS/qa-compare.js --mine output/email.jpg --mine-width <W> --ref <ref.svg> --ref-width 1180 --blocks work/qa-blocks.json --out work/qa`.
  It stitches your styled block beside the reference region at equal width into
  `work/qa/<id>.png` and prints a coarse similarity score. The score is only a hint;
  **you make the call with vision** on each side-by-side — if a person can see it
  doesn't match, it fails.
- **Apply.** Add every failing id to `work/wireframe-blocks.json` (or re-run
  qa-compare with `--wire work/wireframe-blocks.json --apply` to auto-flag sub-
  threshold blocks) and re-render; those blocks become wireframes. Prefer the
  wireframe over a shape you have already corrected once and still can't match — do
  not enter a third styling round on the same shape. Note any wireframed blocks in
  your final summary.

## Stage 3c — (optional) real product photos → `email_photos` deliverable
Only when the brief/user wants actual product imagery (not placeholder frames).
Leaves the base `email.svg` untouched; produces a SEPARATE filled variant.
1. **Fetch** via the `product-photos` skill against THIS run:
   `node $TOOLS/photo-resolve.js --out <run> --kit <kit> --spec work/email_spec.json`
   then, only for a cutout template (below), the cutout step
   (`photo-cutout-rembg.py`, or `photo-cutout.js` fallback). It writes
   `photo_manifest.json` keyed by module position (`m<i>` for a feature,
   `m<i>_p<j>` for a product-row product) — the SAME keys you tag your `<g>`s with.
2. **Decide the treatment PER TEMPLATE from the reference** (this is a format
   choice, like footer-or-not above — do not homogenize):
   - **framed** template (photo sits in a box): embed `chosenFile` cover-cropped —
     `<image … preserveAspectRatio="xMidYMid slice"/>` + the hairline edge.
   - **cutout** template (product floats with NO box on the panel): embed
     `cutoutFile` contained — `<image … preserveAspectRatio="xMidYMid meet"/>`,
     no rect/fill, so the panel shows through around the product.
   The brief's caption hint (silo vs "use enviro" lifestyle) is a per-product
   CONTENT choice the resolver already applied to `chosenFile`; a cutout template
   always uses the silo-derived `cutoutFile`.
3. **Author `output/email_photos.svg`** = a copy of `email.svg` where each
   product module's placeholder frame is replaced by its embedded photo
   (**base64 data URI** — self-contained, embed nothing remote), keeping every
   badge/price/CTA/pennant overlay drawn ON TOP. A module with `source:"none"`
   (unresolved) keeps its placeholder frame. Hero/decorative regions that aren't
   a spec product stay placeholders (don't invent a photo for them).
4. **Verify:** first contact-sheet the fetched `chosenFile`/`cutoutFile`s and
   confirm each is the RIGHT product and treatment (search can return the wrong
   item; a cutout must have no white halo/box) — re-run with a better hint/price/
   link for any miss. Then rasterize `email_photos.svg` and run the Stage 3b
   band-by-band diff on it too.
Rasterize like Stage 4 to `output/email_photos.jpg`.

## Stage 4 — Deliver
Once the QA loop is clean, produce the JPEG raster alongside the editable SVG:
`cd $TOOLS && node -e "require('sharp')('<absolute path to output/email.svg>').flatten({background:'#ffffff'}).withMetadata({density:72}).jpeg({quality:95,chromaSubsampling:'4:4:4'}).toFile('<absolute path to output/email.jpg>').then(()=>console.log('ok'))"`
(matches `encodeFinal`'s JPEG conventions in `tools/lib/imagetools.js`.)
Deliverables are the files in `output/` (`email.svg` — the editable file the
human finishes; `email.jpg` — the raster preview; `wireframe.svg` — kept for
reference; and, if Stage 3c ran, `email_photos.svg` / `email_photos.jpg` — the
same email with real product photos filled in). Final message: one line —
campaign name, module count, image-placeholder count (and, if Stage 3c ran, how
many were filled with real photos vs. left as placeholders), any new presets
worth adding to the kit's `presets.json`, and whether generic presets/defaults
were used — then DONE.
