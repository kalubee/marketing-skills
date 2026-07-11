/**
 * reportspec.js — schema for the `report` object the brand-compliance-check
 * skill writes to `output/report.json`. This is a review skill: it produces
 * no rendered creative, no manifest — the report IS the deliverable. This
 * module defines the bar for a real QA verdict (summary, verdict, and
 * actionable issue/pass/recommendation lists) so the agent can self-check
 * its report before finishing. `checkreport.js` in this same directory is
 * the CLI wrapper: `node checkreport.js output/report.json` reads the file,
 * runs `validateReport` below, and prints OK or the list of errors.
 */

const VERDICTS = new Set(['on-brand', 'minor-issues', 'off-brand'])

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}
function isStringArray(v) {
  return Array.isArray(v) && v.every(isNonEmptyString)
}

export function validateReport(report) {
  const errors = []
  if (!isPlainObject(report)) return { ok: false, errors: ['report must be an object'] }

  if (!isNonEmptyString(report.summary)) errors.push('report.summary is required (a one-paragraph verdict)')
  if (!VERDICTS.has(report.verdict)) errors.push(`report.verdict must be one of: ${[...VERDICTS].join(', ')}`)

  // The three lists are optional individually, but a useful report has at least
  // one of issues/passes populated — a verdict with no evidence is not a review.
  for (const key of ['issues', 'passes', 'recommendations']) {
    if (key in report && !isStringArray(report[key])) errors.push(`report.${key}, if present, must be an array of non-empty strings`)
  }
  const hasEvidence = isStringArray(report.issues) && report.issues.length > 0
    || isStringArray(report.passes) && report.passes.length > 0
  if (!hasEvidence) errors.push('report must cite evidence: a non-empty issues[] or passes[]')

  // A non-clean verdict should say what to fix.
  if ((report.verdict === 'minor-issues' || report.verdict === 'off-brand')
    && !(isStringArray(report.recommendations) && report.recommendations.length > 0)) {
    errors.push('a minor-issues/off-brand verdict must include recommendations[]')
  }

  return { ok: errors.length === 0, errors }
}
