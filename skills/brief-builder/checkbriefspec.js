// checkbriefspec.js <brief_spec.json> — validates against ./briefspec.js.
import { readFileSync } from 'node:fs'
import { validateBriefSpec } from './briefspec.js'

const [specPath] = process.argv.slice(2)
if (!specPath) {
  console.error('usage: checkbriefspec.js <brief_spec.json>')
  process.exit(1)
}

const spec = JSON.parse(readFileSync(specPath, 'utf8'))
const { ok, errors } = validateBriefSpec(spec)
if (!ok) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('OK')
