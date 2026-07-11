// checkcalendarspec.js <calendar_spec.json> — validates against ./calendarspec.js.
import { readFileSync } from 'node:fs'
import { validateCalendarSpec } from './calendarspec.js'

const [specPath] = process.argv.slice(2)
if (!specPath) {
  console.error('usage: checkcalendarspec.js <calendar_spec.json>')
  process.exit(1)
}

const spec = JSON.parse(readFileSync(specPath, 'utf8'))
const { ok, errors } = validateCalendarSpec(spec)
if (!ok) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('OK')
