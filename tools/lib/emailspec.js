/**
 * emailspec.js — schema for email_spec.json, the structured content plan the
 * design-email skill distills a text brief into before authoring HTML.
 *
 * Same contract as adspec.js: it is the single source of truth for rendered
 * copy. The render pipeline burns text from the authored HTML, and that HTML
 * must match email_spec verbatim — copy is never model-invented. Pricing in
 * particular must survive brief → spec → HTML unchanged.
 *
 * A module is one stacked block in the 724px column. Known types:
 *   hero        — headline + optional subhead + optional cta + image region
 *   offer_band  — offer line + optional small print (tinted band)
 *   product_row — 1..4 products, each {name, price_now, price_was?, link?}
 *   feature     — headline + body + optional cta + optional image region
 *   strip       — a single thin line of copy (financing, shipping, etc.)
 *   footer      — brand footer (address + links, pulled from the brand profile)
 */

const KNOWN_TYPES = new Set(['hero', 'offer_band', 'product_row', 'feature', 'strip', 'footer'])

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function validateModule(m, i, errors) {
  if (!isPlainObject(m)) {
    errors.push(`modules[${i}] must be an object`)
    return
  }
  if (!KNOWN_TYPES.has(m.type)) {
    errors.push(`modules[${i}].type must be one of: ${[...KNOWN_TYPES].join(', ')}`)
    return
  }
  const where = `modules[${i}] (${m.type})`
  switch (m.type) {
    case 'hero':
    case 'feature':
      if (!isNonEmptyString(m.headline)) errors.push(`${where}.headline is required`)
      break
    case 'offer_band':
      if (!isNonEmptyString(m.offer)) errors.push(`${where}.offer is required`)
      break
    case 'strip':
      if (!isNonEmptyString(m.text)) errors.push(`${where}.text is required`)
      break
    case 'product_row': {
      if (!Array.isArray(m.products) || m.products.length < 1 || m.products.length > 4) {
        errors.push(`${where}.products must be an array of 1..4 items`)
        break
      }
      m.products.forEach((p, j) => {
        if (!isPlainObject(p)) { errors.push(`${where}.products[${j}] must be an object`); return }
        if (!isNonEmptyString(p.name)) errors.push(`${where}.products[${j}].name is required`)
        if (!isNonEmptyString(p.price_now)) errors.push(`${where}.products[${j}].price_now is required`)
        // Optional fields, but if present must be non-empty — a blank price_was
        // or link is almost always an authoring mistake that would render a
        // stray struck-through empty span or a dead "SHOP NOW".
        if ('price_was' in p && !isNonEmptyString(p.price_was)) errors.push(`${where}.products[${j}].price_was, if present, must be a non-empty string`)
        if ('link' in p && !isNonEmptyString(p.link)) errors.push(`${where}.products[${j}].link, if present, must be a non-empty string`)
      })
      break
    }
    case 'footer':
      break
  }
}

export function validateEmailSpec(spec) {
  const errors = []
  if (!isPlainObject(spec)) return { ok: false, errors: ['email spec must be an object'] }

  if (!isNonEmptyString(spec.brand)) errors.push('brand is required (brand profile id, e.g. "acme")')

  // Subject + preheader are the two lines the recipient sees in the inbox
  // before opening — they ship with the email and must be captured from the
  // brief verbatim. Subject is required; preheader is strongly recommended
  // and, if present, must be non-empty (a blank preheader lets the client
  // leak body copy into the inbox preview).
  if (!isNonEmptyString(spec.subject)) errors.push('subject is required (pull the subject line from the brief verbatim)')
  if ('preheader' in spec && !isNonEmptyString(spec.preheader)) errors.push('preheader, if present, must be a non-empty string')

  if (!isPlainObject(spec.layout)) {
    errors.push('layout is required')
  } else {
    if (!Number.isFinite(spec.layout.width_px) || spec.layout.width_px <= 0) {
      errors.push('layout.width_px must be a positive number')
    }
    for (const field of ['margin_px', 'module_gap_px']) {
      if (!Number.isFinite(spec.layout[field]) || spec.layout[field] < 0) {
        errors.push(`layout.${field} must be a non-negative number`)
      }
    }
  }

  if (!Array.isArray(spec.modules) || spec.modules.length === 0) {
    errors.push('modules must be a non-empty array')
  } else {
    spec.modules.forEach((m, i) => validateModule(m, i, errors))
  }

  return { ok: errors.length === 0, errors }
}
