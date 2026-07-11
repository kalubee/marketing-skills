/**
 * socialspec.js — schema for social_spec.json, the content plan social-post
 * distills a brief into before authoring native-per-size HTML. Same discipline
 * as adspec/emailspec: it is the source of truth for rendered copy (burned from
 * HTML, never model-drawn), and it pins the exact sizes to render so the
 * gallery is deterministic.
 *
 * Recommended platform sizes (the skill may use any subset / add more):
 *   ig-square  1080x1080   ig-story 1080x1920   ig-portrait 1080x1350
 *   fb-link    1200x630     x-post   1600x900
 */

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}
function isPosInt(v) {
  return Number.isInteger(v) && v > 0
}

export function validateSocialSpec(spec) {
  const errors = []
  if (!isPlainObject(spec)) return { ok: false, errors: ['social spec must be an object'] }

  if (!isNonEmptyString(spec.brand)) errors.push('brand is required (brand profile id, e.g. "acme")')
  if ('campaign' in spec && !isNonEmptyString(spec.campaign)) errors.push('campaign, if present, must be a non-empty string')

  if (!isPlainObject(spec.copy)) {
    errors.push('copy is required')
  } else {
    if (!isNonEmptyString(spec.copy.headline)) errors.push('copy.headline is required')
    for (const field of ['subhead', 'cta']) {
      if (field in spec.copy && !isNonEmptyString(spec.copy[field])) {
        errors.push(`copy.${field}, if present, must be a non-empty string`)
      }
    }
  }

  if (!Array.isArray(spec.sizes) || spec.sizes.length === 0) {
    errors.push('sizes must be a non-empty array of {id, w, h}')
  } else {
    const seen = new Set()
    spec.sizes.forEach((s, i) => {
      if (!isPlainObject(s)) { errors.push(`sizes[${i}] must be an object`); return }
      if (!isNonEmptyString(s.id)) errors.push(`sizes[${i}].id is required`)
      else if (seen.has(s.id)) errors.push(`sizes[${i}].id "${s.id}" is duplicated`)
      else seen.add(s.id)
      if (!isPosInt(s.w)) errors.push(`sizes[${i}].w must be a positive integer`)
      if (!isPosInt(s.h)) errors.push(`sizes[${i}].h must be a positive integer`)
    })
  }

  return { ok: errors.length === 0, errors }
}
