const HEX_RE = /^#[0-9a-fA-F]{6}$/

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

export function validateAdSpec(spec) {
  const errors = []

  if (!isPlainObject(spec)) {
    return { ok: false, errors: ['ad spec must be an object'] }
  }

  const { copy, layout, palette, logo, photo } = spec

  if (!isPlainObject(copy)) {
    errors.push('copy is required')
  } else {
    if (!isNonEmptyString(copy.headline)) errors.push('copy.headline is required and must be a non-empty string')
    for (const field of ['subhead', 'offer', 'cta', 'legal']) {
      if (copy[field] !== undefined && !isNonEmptyString(copy[field])) {
        errors.push(`copy.${field} must be a non-empty string when present`)
      }
    }
  }

  if (!isPlainObject(layout)) {
    errors.push('layout is required')
  } else if (!isNonEmptyString(layout.archetype)) {
    errors.push('layout.archetype is required and must be a non-empty string')
  }

  if (!isPlainObject(palette)) {
    errors.push('palette is required')
  } else {
    for (const field of ['bg', 'accent', 'ink']) {
      if (typeof palette[field] !== 'string' || !HEX_RE.test(palette[field])) {
        errors.push(`palette.${field} must be a hex color in #rrggbb form`)
      }
    }
  }

  if (!isPlainObject(logo)) {
    errors.push('logo is required')
  } else if (typeof logo.present !== 'boolean') {
    errors.push('logo.present must be a boolean')
  }

  if (!isPlainObject(photo)) {
    errors.push('photo is required')
  } else if (typeof photo.present !== 'boolean') {
    errors.push('photo.present must be a boolean')
  }

  return { ok: errors.length === 0, errors }
}
