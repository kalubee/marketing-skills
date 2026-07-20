---
name: product-photos
description: Fetch REAL product photos from a brand's own storefront for a creative — resolve each product name to its store page, pull silo and lifestyle shots from the carousel, optionally cut the background out, and emit a manifest a renderer or designer consumes. Use when a design/email/social task needs actual product imagery instead of placeholder frames.
---

# Fetch real product photos → silo / lifestyle / cutout + manifest

You are the product-photo engine. Given a list of products (or a design spec that
names them) and a brand kit, you resolve each product to a real photo on the
brand's storefront, download the right shot, optionally remove its background,
and write a `photo_manifest.json` that a renderer (e.g. `design-email`) or a human
designer drops into the creative. Products that can't be resolved are left as
placeholders — you never invent a photo or a URL.

## Setup

- **Tools:** `TOOLS = <this skill's directory>/../../tools` (resolve against the base
  directory announced when this skill loads). One-time, only if `$TOOLS/node_modules`
  is missing: `cd $TOOLS && npm install` (provides `sharp`). Node >= 18 (global `fetch`).
- **Work dir:** work inside the CONSUMING task's run directory (e.g. the
  `design-email` run). Outputs go under `<run>/` — `photo_manifest.json` and a
  `photos/` folder. If run standalone, make a fresh run dir with a `photos/` inside.
- **Brand kit:** point `--kit` at the brand-kit folder (the one with
  `products.json` / `link-map.json`). Its `products.json` seeds local catalog
  matches AND supplies the **store origin** (derived from a product `url`) — never
  hardcode a domain. No kit → pass `--origin <https://store>` explicitly.
- **Background removal (for cutout templates only):** the preferred cutter is
  `photo-cutout-rembg.py` (learned segmentation). One-time, only if
  `$TOOLS/.venv-rembg` is missing:
  `python3 -m venv $TOOLS/.venv-rembg && . $TOOLS/.venv-rembg/bin/activate && pip install "rembg[cpu]"`
  (first run auto-downloads a ~176 MB model). If Python/rembg isn't available,
  `photo-cutout.js` is a sharp-only heuristic fallback — good for high-contrast
  products, but it CANNOT cleanly key a white product on a white background
  (a bare mattress): use rembg there.

## Two independent choices — do not conflate them

1. **Silo vs lifestyle** = a per-PRODUCT *content* choice, driven by the brief's
   caption hint for that tile. "use enviro"/"lifestyle"/"in room" → the lifestyle
   (in-room) shot; "silo"/"packshot"/default → the pure silo (product on white).
2. **Framed vs cutout** = a per-TEMPLATE *format* choice, read off the reference
   creative. A **framed** template shows the photo inside a box (cover-cropped). A
   **cutout** template floats the product with **no background** on the panel/page.
   Check the reference before you build (some brands use both across templates).

The two interact: a **cutout template must use the silo shot** — you can't cut a
product out of a room scene. So in a cutout template, use each product's `pure`
shot (its cutout), even if the brief hinted "enviro" for the framed version.

## Inputs

Either:
- `--spec <email_spec.json>` — a design spec; product-bearing modules
  (`product_row`, `feature`) are extracted automatically. Each contributes
  `name`, `link`, `image_caption` (→ hint), row headline (→ category hint), and
  `price_now`.
- `--products <list.json>` — an explicit array; see `products.example.json`. Each
  item: `{ key, name, link?, caption?, hint?, price? }` (`key` is a stable id you
  reuse when wiring photos back into the render; `hint` is a category noun like
  "Bed" that disambiguates a bare model name; `caption` carries the silo/lifestyle
  hint; `link`/`price` sharpen resolution).

## Stage 1 — Resolve + fetch

```
node $TOOLS/photo-resolve.js --out <run> --kit <brand-kit-dir> \
     (--spec <run>/work/email_spec.json | --products <list.json>) [--limit 8]
```

Per product it resolves a storefront handle in priority order — **(1)** a real
`/products/<handle>` URL already in the product's `link`; **(2)** an exact-ish
match in the kit's `products.json`; **(3)** the storefront predictive-search
endpoint (`/search/suggest.json`, biased by the category hint + exact brief
price). It pulls the carousel (`/products/<handle>.json`), classifies each image
by border luminance (studio sweep vs room), and saves `photos/<key>_pure.jpg`
and, when present, `photos/<key>_life.jpg`. Anything it can't resolve is recorded
`source:"none"` → placeholder.

**Verify before trusting it.** Search can return the alphabetical-first accessory
("Ralinski" → a *mirror*, not the bed). Build a quick contact sheet of the
`chosenFile`s and eyeball that each is the right product and the right treatment;
re-run with a better `hint`/`price`/`link` for any miss.

## Stage 2 — (cutout templates only) remove backgrounds

```
. $TOOLS/.venv-rembg/bin/activate
python $TOOLS/photo-cutout-rembg.py --manifest <run>/photo_manifest.json
# fallback, no Python: node $TOOLS/photo-cutout.js --manifest <run>/photo_manifest.json
```

Cuts each product's `pure` shot to `photos/<key>_cutout.png` (trimmed, soft edge)
and records `cutoutFile`. Contact-sheet the cutouts on the actual panel colour and
confirm no white halo/box and no bitten-into product (interior whites like
bedding must survive).

## Stage 3 — Hand off / consume

The manifest is the contract. Per product it carries: `key`, `name`, `source`
(`spec-link`|`catalog`|`search`|`none`), `handle`, `url`, `chosen`
(`pure`|`lifestyle`), `chosenFile`, `pure`/`lifestyle` `{file,src,...}`, and (if
cut) `cutoutFile`. A renderer keys off `key`:
- **framed template:** embed `chosenFile` cover-cropped —
  `<image ... preserveAspectRatio="xMidYMid slice">` + hairline edge.
- **cutout template:** embed `cutoutFile` contained, no box —
  `<image ... preserveAspectRatio="xMidYMid meet">`.
- `source:"none"` → keep the placeholder frame.

**With `design-email`:** this skill automates the "swap in real product cutouts"
step. Run it against the same run dir after the spec is approved; `build`-side
code maps `key → photo` and renders a photos deliverable alongside the wireframe
and placeholder email.

## Hard rules

- **Never invent a product identity or a destination URL.** A photo/handle comes
  from the spec `link`, the kit catalog, or the storefront search — otherwise the
  product stays a placeholder (`source:"none"`), flagged for review.
- **Cutout templates use silo shots**, framed templates may use either; match the
  reference's format, don't homogenize across a brand's templates.
- **Never retouch the product** beyond background removal — no recolour, no
  reshaping. If a resolved shot is wrong, fix the query, don't paint over it.
- **Brand-neutral:** derive the store origin from the kit; never hardcode a brand,
  domain, or product. Work only inside the run directory.
