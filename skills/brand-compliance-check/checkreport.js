// checkreport.js <report.json> — validates a brand-QA report object.
import { readFileSync } from 'node:fs'
import { validateReport } from './reportspec.js'

const [reportPath] = process.argv.slice(2)
if (!reportPath) {
  console.error('usage: checkreport.js <report.json>')
  process.exit(1)
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'))
const { ok, errors } = validateReport(report)
if (!ok) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('OK')
