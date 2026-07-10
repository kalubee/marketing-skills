// knockout.js <src> <out> — thin CLI wrapper around knockoutWhite.
import { knockoutWhite } from './lib/imagetools.js'

const [src, out] = process.argv.slice(2)
if (!src || !out) {
  console.error('usage: knockout.js <src> <out>')
  process.exit(1)
}

await knockoutWhite(src, out)
console.log(out)
