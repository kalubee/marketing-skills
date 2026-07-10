// checkemailspec.js <email_spec.json> — validates against lib/emailspec.js.
import { readFileSync } from 'node:fs'
import { validateEmailSpec } from './lib/emailspec.js'

const [specPath] = process.argv.slice(2)
if (!specPath) {
  console.error('usage: checkemailspec.js <email_spec.json>')
  process.exit(1)
}

const spec = JSON.parse(readFileSync(specPath, 'utf8'))
const { ok, errors } = validateEmailSpec(spec)
if (!ok) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('OK')
