---
name: brand-ingest
description: Research a brand's website and propose a brand-kit brand.json plus a human-review report — propose, never install. Use when the user wants a starting brand kit drafted from a company's public site.
---

# Ingest a brand from its website

You are the brand-research engine.

## Setup

- **Work dir:** create a fresh directory for this run (in the current working directory
  or your scratchpad) with `work/` and `output/` inside. Intermediates go in `work/`,
  finished deliverables in `output/`. Work only inside this directory.
- **Brand kit (optional):** if the user provides a brand-kit folder (a directory with
  `brand.json` or `brand-kit.json` — read that file, don't hunt for a separate
  schema doc), honor its palette, type, voice, footer and CTA rules,
  and use its `link-map.json` / `products.json` / `presets.json` / `refs/` when present.
  No kit given → ask whether one exists; otherwise proceed brand-neutral and say so in
  your final summary.

You never browse the web yourself — the scrape tool fetches pages for you, and you
reason over the JSON it returns.

## Inputs

Gather from the user: the brand's website URL, a short brand id/slug to name the
proposal with, and any notes on facts they've already confirmed (a hex code, a font
name, exact footer copy) that should outrank whatever the scrape turns up.

The job: crawl a brand's public website with the **`Scrapling-Skill`** and turn what
comes back into a **draft brand kit** in the standard kit shape (Stage 2 lists the
fields; an installed kit's `brand-kit.json` under the vault's `3-Resources/Brands/`
is a live reference if one exists), with the evidence for every value. This is how a starting kit gets bootstrapped without waiting on a brand-guide
PDF.

Hard rules:
- **Propose, never install.** Write the draft to `output/brand.json`. NEVER write into
  an existing brand kit — the user reviews and installs it themselves. A kit drafted
  from a scrape is `"status": "provisional"` by definition.
- Scrape ONLY through the **`Scrapling-Skill`** (it handles fetching, JS rendering, and
  anti-bot bypass) — at most 5 pages per run, all on the SAME registrable domain as the
  brand's URL. No other network access, no crawling beyond those pages.
- The user's notes (facts they already confirmed) always outrank scraped signals.
  Record where every value came from.
- If a fetch fails or is blocked, note it and work with what you have rather than
  retrying endlessly (≤2 attempts per page); flag blocked pages in the report.

## Stage 1 — Scrape

Fetch the homepage with the `Scrapling-Skill` and normalize what you extract into
`work/page_home.json` with these keys: `url`, `title`, `meta`, `headings`, `nav_links`,
`footer_links`, `images`, `icons`, `color_hints` (hexes harvested from inline styles and
linked CSS, with occurrence counts), `text_sample`. Keep that shape for every page — the
later stages read it. From `nav_links`/`footer_links`, pick
up to 4 more same-domain pages that likely carry brand truth — an about/brand page, a
product or collection page, and a contact/footer-heavy page are the highest-value picks
— and scrape each to `work/page_NN.json`. Tell the user each URL as you go.

## Stage 2 — Distill → output/brand.json

Build `output/brand.json` with these keys (same shape as an installed kit's
`brand-kit.json`):
- `id` = the brand slug given, `name` from `meta.og_site_name`/`title`, `status`:
  `"provisional"`.
- `palette`: from `color_hints` (a hex→frequency map) — the dominant non-neutral hex
  across pages is the `brand_primary` candidate; call out a secondary or sale/accent
  color separately if one stands out. Neutrals (near-black/near-white/greys) map to
  `ink`/`bg`/`hairline`.
- `logo`: point at the best `icons`/`meta.og_image`/header image URL (do NOT download
  it); note in `logo._note` that the asset must be pulled and knocked out manually.
- `footer`: company line, address, and standard links as found in
  `footer_links`/`text_sample`.
- `type` + `cta`: whatever the pages reveal (heading casing, button styles implied by
  `color_hints`); mark unknowns with a `_note` rather than guessing silently.
  `type`'s font stacks must be self-contained (system fonts or generics) — if the site uses a webfont, name the closest self-contained substitute
  here and record the intended webfont in `provenance`.
- `email_layout` and `store`: the site itself won't reveal these reliably — use the
  generic defaults for `email_layout` (`width_px` 724, `margin_px` 50,
  `module_gap_px` 50) and `store: null` unless a storefront platform is evident, and
  note in `provenance` that they're unconfirmed placeholders.
- `provenance`: one paragraph — which pages, what came from where, what the user's
  notes overrode, what is still unverified.

## Stage 3 — Deliver

Write `output/brand_report.md`: a short human-review doc with a proposed-kit summary
table (value + source + confidence), the palette as a swatch list (hex + where seen +
count), open questions for the brand owner, and the exact next step ("review, correct,
then use `output/brand.json` as the kit's `brand.json` — the user reviews and
installs").
Deliverables are `output/brand.json` and `output/brand_report.md`. Final message: one
line — brand, pages scraped, confidence — then DONE.
