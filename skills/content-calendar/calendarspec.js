/**
 * calendarspec.js — schema for calendar_spec.json, content-calendar's
 * structured product: a dated plan of what publishes where. Deterministic
 * checks (real dates, inside the period, known channels) keep the calendar
 * trustworthy enough to schedule against.
 */

export const CHANNELS = ['email', 'social', 'display', 'web', 'sms', 'in-store', 'other']

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}
// A YYYY-MM-DD string that round-trips through Date (rejects 2026-02-31).
function isRealDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function validateCalendarSpec(spec) {
  const errors = []
  if (!isPlainObject(spec)) return { ok: false, errors: ['calendar spec must be an object'] }

  if (!isNonEmptyString(spec.campaign)) errors.push('campaign is required')

  let start = null
  let end = null
  if (!isPlainObject(spec.period)) {
    errors.push('period is required ({start, end})')
  } else {
    for (const edge of ['start', 'end']) {
      if (!isRealDate(spec.period[edge])) errors.push(`period.${edge} must be a real date in YYYY-MM-DD form`)
    }
    if (isRealDate(spec.period.start) && isRealDate(spec.period.end)) {
      start = spec.period.start
      end = spec.period.end
      if (start > end) errors.push('period.start must not be after period.end')
    }
  }

  if (!Array.isArray(spec.entries) || spec.entries.length === 0) {
    errors.push('entries must be a non-empty array (the dated plan)')
    return { ok: errors.length === 0, errors }
  }

  spec.entries.forEach((e, i) => {
    if (!isPlainObject(e)) { errors.push(`entries[${i}] must be an object`); return }
    if (!isRealDate(e.date)) {
      errors.push(`entries[${i}].date must be a real date in YYYY-MM-DD form`)
    } else if (start && end && (e.date < start || e.date > end)) {
      errors.push(`entries[${i}].date ${e.date} falls outside the period ${start}..${end}`)
    }
    if (!CHANNELS.includes(e.channel)) {
      errors.push(`entries[${i}].channel must be one of ${CHANNELS.join(', ')}`)
    }
    if (!isNonEmptyString(e.title)) errors.push(`entries[${i}].title is required`)
    if ('asset' in e && !isNonEmptyString(e.asset)) errors.push(`entries[${i}].asset, if present, must be a non-empty string`)
  })

  return { ok: errors.length === 0, errors }
}
