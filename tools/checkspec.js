// checkspec.js <ad_spec.json> — validates against lib/adspec.js's schema.
import { readFileSync } from 'node:fs'
import { validateAdSpec } from './lib/adspec.js'

const [specPath] = process.argv.slice(2)
if (!specPath) {
  console.error('usage: checkspec.js <ad_spec.json>')
  process.exit(1)
}

const spec = JSON.parse(readFileSync(specPath, 'utf8'))
const { ok, errors } = validateAdSpec(spec)
if (!ok) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('OK')
