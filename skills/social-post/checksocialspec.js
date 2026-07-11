// checksocialspec.js <social_spec.json> — validates against ./socialspec.js.
import { readFileSync } from 'node:fs'
import { validateSocialSpec } from './socialspec.js'

const [specPath] = process.argv.slice(2)
if (!specPath) {
  console.error('usage: checksocialspec.js <social_spec.json>')
  process.exit(1)
}

const spec = JSON.parse(readFileSync(specPath, 'utf8'))
const { ok, errors } = validateSocialSpec(spec)
if (!ok) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('OK')
