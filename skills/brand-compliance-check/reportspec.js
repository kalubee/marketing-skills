/**
 * reportspec.js — schema for the `report` object brand-compliance-check writes
 * into its manifest. A review skill produces NO rendered output; the report IS
 * the deliverable, so the engine (manifestSatisfiesOutput, output.kind:report)
 * accepts any manifest whose `report` has a non-empty `summary`. This checker
 * is the stronger, skill-specific bar: a real QA verdict with actionable lists,
 * so the agent can self-check before finishing.
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
