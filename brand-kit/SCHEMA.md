# Brand Kit Schema

A **brand kit** is a folder that tells a skill in this repo how to speak, look,
and link for a specific brand. Every skill that produces a branded deliverable
(an ad, an email, a social post, a landing hero) accepts an optional brand-kit
path and reads it the same way, so a kit works interchangeably across every
skill without per-skill configuration.

A kit is just files on disk — there is no registration step and no database.
Point a skill at a folder and it reads what's there.

## Folder layout

```
<kit>/
  brand.json         required
  link-map.json       optional
  products.json       optional
  presets.json        optional
  sizes.json          optional
  refs/                optional
```

Only `brand.json` is required. A kit with nothing else is valid — skills fall
back to sensible defaults for anything the other files would have supplied
(no curated links, no product catalog, the repo's default size matrix, no
saved layout presets, no reference creatives).

This repo ships exactly one kit, at `brand-kit/example/`, built entirely from
invented values for a fictional brand ("Acme Home & Living"). It exists to
document the schema by example and to give skills something real to run
against in a demo. Real brand kits — with a company's actual colors, fonts,
copy, and links — do not belong in this repo; see **Private kits**, below.

## `brand.json` (required)

A single JSON object describing the brand's visual and verbal identity. Every
field below is expected; skills read fields by name and degrade gracefully
only where noted.

| Field | Type | Required |
|---|---|---|
| `id` | string (slug) | yes |
| `name` | string | yes |
| `status` | `"example" \| "provisional" \| "confirmed"` | yes |
| `provenance` | string | yes |
| `email_layout` | object | yes |
| `palette` | object of named color tokens | yes |
| `type` | object | yes |
| `logo` | object | yes |
| `footer` | object | yes |
| `cta` | object | yes |
| `store` | object or `null` | yes |

### `id`

A short slug identifying the brand, matching `^[a-z0-9][a-z0-9-]*$` — lowercase
letters, digits, and internal hyphens, starting with a letter or digit. Used
as a stable key wherever a brand needs to be referenced by name rather than by
kit path (for example, `link-map.json`'s own `brand` field echoes it back for
sanity-checking that the two files belong together).

### `name`

The brand's display name, used verbatim in copy, footers, and file naming
where a human-readable label is needed.

### `status`

One of three values, and skills are expected to change behavior on it:

- **`example`** — the kit is a demonstration, not a real brand. This repo's
  shipped kit uses this value.
- **`provisional`** — the kit is a first pass. Colors, type, or footer copy may
  be scraped or guessed rather than confirmed by the brand owner. Skills
  should hedge: say in their summary that voice and typography are
  placeholders, and prefer neutral, low-risk choices over confident ones
  where the kit leaves room for interpretation.
- **`confirmed`** — the kit has been reviewed by someone who owns the brand.
  Skills can treat every field as authoritative and apply it without caveats.

### `provenance`

A free-text sentence recording where the kit's values came from — a scrape of
the brand's website, a shared style guide, a set of confirmed hex codes from a
marketing team, or (for the shipped example) a note that every value was
invented for demonstration. This is documentation for humans reading the kit
later, not something skills need to parse.

### `email_layout`

Sizing and spacing constants for email module rendering:

```json
{
  "width_px": 724,
  "margin_px": 50,
  "module_gap_px": 50,
  "height": "content-driven (varies with number of modules)",
  "safe_zone_note": "Keep all copy and logos inside the margin on all four sides."
}
```

- `width_px` — the fixed pixel width of the email's content column.
- `margin_px` — the inset, in pixels, from each edge of `width_px` that
  content must not cross.
- `module_gap_px` — the vertical gap, in pixels, inserted between stacked
  content modules (hero, product grid, footer, and so on).
- `height` — email height is driven by how many modules a given send
  includes, so this is a descriptive string rather than a number; kits may
  also supply a fixed pixel value if a brand's template is a constant height.
- `safe_zone_note` — a short reminder, surfaced to whoever reviews a render,
  about what "inside the margin" means for that brand's templates.

### `palette`

A flat object mapping **named color tokens** to `#rrggbb` hex values. Skills
reference palette colors by token name — `brand_primary`, `ink`, `hairline`,
and so on — never by hardcoding a hex value. This is the mechanism that makes
a kit swap re-theme a skill's output without touching any skill code: change
the hex behind `brand_primary` in the kit, and every skill that draws a
primary-colored element picks up the new color on its next run.

The shipped example defines eight tokens, which skills in this repo treat as
the conventional baseline set:

| Token | Purpose |
|---|---|
| `brand_primary` | The brand's dominant color — primary buttons, headline accents. |
| `brand_secondary` | A supporting brand color, used sparingly against the primary. |
| `ink` | Default body and headline text color. |
| `muted` | De-emphasized text — captions, fine print, secondary labels. |
| `hairline` | Thin rule and border color. |
| `bg` | Default background color. |
| `band_bg` | Background for a contrasting content band or section. |
| `sale_accent` | Reserved for promotional/urgency callouts (sale badges, countdown copy). |

A kit is free to define additional tokens beyond this set for its own
templates; skills that don't recognize an extra token simply ignore it. A kit
should not omit any token a skill it will be used with expects — check the
target skill's SKILL.md for the tokens it reads.

### `type`

Font stacks and headline styling:

```json
{
  "display_stack": "'Helvetica Neue', Helvetica, Arial, sans-serif",
  "body_stack": "'Helvetica Neue', Helvetica, Arial, sans-serif",
  "headline_weight": 800,
  "headline_transform": "uppercase",
  "headline_tracking_px": 0.5
}
```

- `display_stack` / `body_stack` — CSS `font-family` stacks for headline and
  body text respectively. **Stacks must be self-contained.** The render
  pipeline has no network access at render time, so it cannot fetch a
  webfont; every stack must resolve entirely to fonts already installed on
  the rendering machine or to generic families (`sans-serif`, `serif`,
  `monospace`). A kit that names a webfont as its brand typeface should list
  the closest self-contained substitute here and note the intended webfont in
  `provenance` for future reference — it is not a field a render can act on.
- `headline_weight` — numeric CSS `font-weight` for headlines (for example
  `800` for extra-bold).
- `headline_transform` — a CSS `text-transform` value (`"uppercase"`,
  `"none"`, and so on) applied to headline copy.
- `headline_tracking_px` — additional letter-spacing, in pixels, applied to
  headline copy.

### `logo`

```json
{
  "present": true,
  "wordmark": "ACME",
  "_note": "..."
}
```

- `present` — whether the brand has a logo treatment at all. `false` means
  skills should not attempt to render a logo mark.
- `wordmark` — the text to render as a text-only lockup when no logo asset is
  available. Used as a fallback (or as the only logo treatment, for brands
  that are wordmark-only).
- Any underscore-prefixed key (such as `_note`) is a free-text aside for
  whoever is filling in or extending the kit — for example, instructions on
  where to drop a real logo file and how to prepare it (see `refs/`, below).
  Skills ignore underscore-prefixed keys.

If a kit supplies an actual logo asset, place it under `refs/` (see below)
rather than inlining it in `brand.json`; JSON is not the place for binary
image data.

### `footer`

```json
{
  "company": "Acme Home & Living",
  "address": "100 Example Street, Springfield",
  "boilerplate": "You are receiving this email because you subscribed to Acme offers.",
  "links": ["Shop Online", "Find a Store", "Unsubscribe"]
}
```

- `company` — legal or display name for footer attribution.
- `address` — mailing address, included where required (for example, email
  footers subject to anti-spam disclosure requirements).
- `boilerplate` — standard footer sentence explaining why the recipient is
  seeing the message.
- `links` — an ordered list of footer link labels. Labels here are matched
  against `link-map.json` entries (see below) to resolve actual URLs; a label
  with no matching entry is rendered as text without a hyperlink.

### `cta`

```json
{
  "style": "solid",
  "bg": "#2F6F4F",
  "text": "#FFFFFF",
  "radius_px": 2,
  "transform": "uppercase"
}
```

Default styling for call-to-action buttons:

- `style` — the button treatment, such as `"solid"` (filled background) or
  `"outline"` (bordered, transparent background).
- `bg` — button background color as a hex value. (Buttons are one of the few
  places a kit may specify a raw hex directly, since a CTA is frequently a
  brand-specific combination that doesn't map cleanly onto the shared
  `palette` tokens; kits are still encouraged to reuse a `palette` hex here
  where it matches.)
- `text` — button label text color as a hex value.
- `radius_px` — corner radius, in pixels, for the button shape.
- `transform` — a CSS `text-transform` value applied to the button label.

### `store`

Either `null` or an object shaped `{ "base_url": "https://...", "platform": "shopify" }`.

When present, `base_url` and `platform` let a skill resolve product
references against a live storefront (for example, constructing a product URL
from a handle, or fetching a live catalog) instead of relying solely on a
static `products.json` snapshot. When `null`, skills fall back to
`products.json` if present, or ask the user for product URLs directly.

## Optional siblings

Everything below is optional. A kit can mix and match any subset; skills
treat a missing file as "not supplied" and fall back accordingly.

### `link-map.json`

A curated map from short, memorable keys to real URLs, so copy and templates
can reference `"hero"` or `"unsubscribe"` instead of hardcoding links:

```json
{
  "brand": "acme",
  "base_url": "https://acme.example",
  "entries": {
    "hero":        { "url": "https://acme.example/collections/sale", "kind": "collection" },
    "unsubscribe": { "url": "https://acme.example/unsubscribe", "kind": "utility" }
  }
}
```

- `brand` — should match `brand.json`'s `id`, as a consistency check.
- `base_url` — the brand's root URL, useful for skills that need to resolve
  relative paths or validate that entries stay on-domain.
- `entries` — an object keyed by a short, skill-meaningful slice or section
  name (a footer link label, an email module's name, and so on). Each entry
  is `{ "url": "...", "kind": "..." }`, where `kind` is a free-text
  categorization (`"collection"`, `"product"`, `"utility"`, and so on) that
  skills may use to pick presentation (for example, styling a utility link
  like "Unsubscribe" differently from a merchandising link).

### `products.json`

A flat array of products for skills that need to match copy or images against
real product links without a live store connection:

```json
[
  { "name": "Harlow 3-Seat Sofa", "url": "https://acme.example/products/harlow-3-seat-sofa", "handle": "harlow-3-seat-sofa" }
]
```

Each entry has `name` (display name, used for fuzzy matching against
free-text product mentions), `url` (the full product page URL), and `handle`
(the platform-specific slug — a Shopify handle, for example — for skills that
need to construct alternate URLs, such as a direct-to-cart link).

### `presets.json`

A library of saved layout "boxes" for the email-design pipeline — reusable
module definitions (hero, product grid, footer band, and so on) that a kit
can pre-populate so a skill doesn't have to invent layout from scratch every
run. The shape of this file is defined by, and demonstrated in,
`skills/design-email/presets.example.json`; consult that file for the
authoritative structure once it exists in this repo. A kit that omits
`presets.json` simply gets a skill's built-in default boxes.

### `sizes.json`

Overrides the repo's default creative size matrix (`tools/sizes.json`) with
brand-specific dimensions — for example, a brand whose paid channels or ad
placements differ from the shared defaults. When present, it takes the exact
same shape as `tools/sizes.json`: an object with a `default_ids` array and a
`sizes` array of `{ channel, id, w, h, label }` records. A skill that resizes
or renders creatives should prefer a kit's `sizes.json` over the tools
default when both exist.

### `refs/`

A directory of reference creatives and assets: real logo files, past ad or
email screenshots the brand wants a new creative to match, product
photography, or anything else that's easier to hand over as a file than to
describe in JSON. Skills that support "match this reference" workflows look
here first when a kit is supplied. There's no required naming convention
inside `refs/` — skills that consume it document what they expect to find.

## Private kits

This folder ships only the fictional `example/` kit described above. A real
brand kit — one built from an actual client's colors, copy, and links — is
never committed here. Keep private kits in a private repository (or any
location outside this one) and point a skill at that path directly; the
brand-kit convention documented in this file is the same either way; only the
storage location changes.
