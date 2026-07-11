# Authoring a skill

A skill is a folder under `skills/` containing a `SKILL.md`. The folder name
**is** the skill's identity — no `skill.json`, no registry to update elsewhere.

## Frontmatter contract

`name` must exactly match the containing folder's name. `description` must
say what the skill does AND include a "Use when ..." trigger sentence a
caller can match against. `scripts/check.js` enforces both.

## Optional skill-local files

A skill may ship its own validator `.js` files (e.g. `checkspec.js`) as
siblings of `SKILL.md`. Keep them inside the skill's own folder — don't reach
into `tools/lib` beyond what `tools/*.js` already documents; shared logic
belongs in `tools/`, not duplicated per skill.

## `## Setup` block conventions

Every `SKILL.md` opens with the same `## Setup` shape: `TOOLS` resolves to
`<this skill's dir>/../../tools`; each run gets a fresh work directory with
`work/` (intermediates) and `output/` (deliverables); an optional brand-kit
folder (`brand.json`, see `brand-kit/SCHEMA.md`) supplies palette/type/voice/
links; photo generation needs `FAL_KEY` and refuses cleanly without it.

## Getting started

Copy `skills/_TEMPLATE/` to `skills/<your-skill-id>/` and replace every
`<angle-bracket>` placeholder.
