/**
 * briefspec.js — schema for brief_spec.json, the structured design brief
 * brief-builder distills a terse idea into. The brief is a document skill's
 * product: no image is rendered, so this JSON (and the markdown rendered from
 * it) IS the deliverable. It is also the input contract a creative skill
 * expects downstream, so the shape mirrors what design-email / social-post
 * need: an ordered set of modules plus headline/offer options to choose from.
 */

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}
function nonEmptyStringArray(v, min) {
  return Array.isArray(v) && v.length >= min && v.every(isNonEmptyString)
}

export function validateBriefSpec(spec) {
  const errors = []
  if (!isPlainObject(spec)) return { ok: false, errors: ['brief spec must be an object'] }

  if (!isNonEmptyString(spec.campaign)) errors.push('campaign is required')
  if (!isNonEmptyString(spec.objective)) errors.push('objective is required (what this campaign should achieve)')
  if ('audience' in spec && !isNonEmptyString(spec.audience)) errors.push('audience, if present, must be a non-empty string')

  if (!Array.isArray(spec.modules) || spec.modules.length === 0) {
    errors.push('modules must be a non-empty array (the sections, top to bottom)')
  } else {
    spec.modules.forEach((m, i) => {
      if (!isPlainObject(m)) { errors.push(`modules[${i}] must be an object`); return }
      if (!isNonEmptyString(m.section)) errors.push(`modules[${i}].section is required`)
      if (!isNonEmptyString(m.intent)) errors.push(`modules[${i}].intent is required (what the section must do)`)
    })
  }

  // The options are the reason to run brief-builder rather than write freehand:
  // a few concrete headline + offer directions to pick from.
  if (!nonEmptyStringArray(spec.headline_options, 3)) {
    errors.push('headline_options must be an array of at least 3 non-empty strings')
  }
  if (!nonEmptyStringArray(spec.offer_options, 1)) {
    errors.push('offer_options must be an array of at least 1 non-empty string')
  }

  return { ok: errors.length === 0, errors }
}
