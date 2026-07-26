# marketing-skills

Marketing creative-production skills for [Claude Code](https://claude.com/claude-code).
Each skill is a self-contained `SKILL.md` plus a shared `tools/` package: point
Claude at a brief, a reference ad, or a flat image, and it hands back
deliverable files — rendered ads, editable emails, clickable HTML, briefs,
calendars, brand-kit research — with no host application and no hidden state.

## What

Fourteen skills cover the full loop from campaign idea to shippable creative:
turning a one-line idea into a brief, building the calendar around it,
producing ads/emails/social posts, coding a finished email into clickable
HTML, fetching real product photography, researching a brand kit, checking
anything against that kit before it ships, and hydrating a brand-kit vault on a
new machine. The creative pipeline is
SVG-plus-[sharp](https://sharp.pixelplumbing.com) — **no external API key is
required for any capability.**

| Skill | Purpose |
|---|---|
| `design-email` | Compose an on-brand marketing email from a brief — wireframe for approval, then a same-zoom rebuild to the brand's reference creative, as editable SVG + JPEG |
| `email-clickable` | Turn a finished flat email image into deployable, table-based clickable HTML |
| `remix-ad` | Deconstruct a finished ad, swap its photography for new real shots, recomposite native variants at every requested size |
| `remake-ad` | Clone a reference ad's exact style with new copy and imagery |
| `resize-ad` | Reformat a finished ad into new channel sizes, rebuilt natively per aspect |
| `social-post` | Design native social image posts from a brief — copy spec, per-size SVG, exact-size JPEGs |
| `product-photos` | Fetch real product photos from a brand's own storefront — silo + lifestyle shots, optional background cutout |
| `brief-builder` | Turn a terse campaign idea into a structured design brief with headline/offer options |
| `content-calendar` | Build a dated, validated content calendar from a campaign goal |
| `brand-ingest` | Research a brand's public site and propose a starting brand-kit `brand.json` |
| `brand-compliance-check` | Vision-QA a creative against a brand kit — on-brand / minor-issues / off-brand verdict |
| `graphify` | Index a project (skills + brand kits) into a queryable knowledge graph |
| `Scrapling-Skill` | Scrape/crawl web pages with anti-bot bypass — the fetch engine under `brand-ingest` |
| `vault-setup` | Hydrate a freshly cloned brand-kit vault — re-fetch catalogs exhaustively, report what's missing |

## Install

```
/plugin marketplace add kalubee/marketing-skills
/plugin install marketing@marketing-skills
```

Working from a local checkout instead of GitHub:

```
/plugin marketplace add /path/to/marketing-skills
```

Skills are then available as `marketing:<skill>`, e.g. `marketing:design-email`.

### Claude cowork

Cowork takes skills as individual zips rather than a plugin. Prebuilt ones live
in [`dist/`](dist/) — one per skill, plus `tools.zip` for the shared toolchain
that several skills shell out to. Upload the skills you need and `tools.zip`
alongside them.

Rebuild after changing a skill:

```
bash scripts/build-zips.sh
```

It runs `scripts/check.js` first and refuses to package if the gate fails, so a
zip can only ever contain content that already passed the sanitization sweep.

## One-time setup

The creative skills share one tools package. Install it once per machine:

```
cd tools && npm install
```

That installs `sharp` (the SVG→JPEG rasterizer) — no browser or API key needed
for the creative pipeline.

**Fonts.** `design-email` renders live `<text>` and rasterizes it, so the font
must be installed locally to match a brand's look. The bundled examples use
**Open Sans** — install it (Debian/Ubuntu: `sudo apt-get install fonts-open-sans`;
macOS: `brew install --cask font-open-sans`) or the raster falls back to a
system sans and won't match the reference. A brand kit can specify any installed
font stack.

**Optional extras** (only for the skills that use them):

- `product-photos` background cutout uses Python `rembg`:
  `python3 -m venv tools/.venv-rembg && tools/.venv-rembg/bin/pip install rembg pillow onnxruntime`
- `Scrapling-Skill` (and the deep-scrape path of `brand-ingest`) uses the
  Scrapling library: `pip install "scrapling[all]>=0.4.10" && scrapling install`

## Brand kits

Skills that produce branded deliverables accept an optional **brand kit**: a
folder with a `brand.json` (palette, type, voice, links) that any skill reads
the same way. See `brand-kit/SCHEMA.md` for the full schema and
`brand-kit/example/` for a complete fictional sample (used only to document
the format and give skills something real to run against).

For the highest-fidelity output, a brand kit can also carry **reference
creatives** (a brand's actual finished emails/ads) and **extracted brand assets**
(the real logo, icons, and decorative art lifted from those references).
`design-email` rebuilds toward those references at matching zoom and composites
the real assets rather than drawing stand-ins — that is what makes an output
read as a real send instead of a prototype.

Real brand kits — a company's actual colors, fonts, copy, links, reference
creatives, and assets — don't belong in this public repo; keep them in a
private repo or folder and pass the path when you run a skill.

## Design principles

- **Copy is burned from spec, never model-drawn.** Rendered text in an ad or
  email always comes from a validated spec file through the render pipeline
  — a model never draws the words onto the image, and a mechanical grep
  re-checks every price/name/date against the spec before hand-off.
- **Rebuild to the reference, don't recolour a wireframe.** Where a brand has a
  reference creative, the styled pass reproduces its real grammar and composites
  its real artwork, iterating on same-zoom crops until indistinguishable.
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
