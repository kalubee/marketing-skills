// crop.js <src> <x> <y> <w> <h> <out> — thin CLI wrapper around cropRegion.
import { cropRegion } from './lib/imagetools.js'

const [src, x, y, w, h, out] = process.argv.slice(2)
if (!src || !out || [x, y, w, h].some((v) => v === undefined)) {
  console.error('usage: crop.js <src> <x> <y> <w> <h> <out>')
  process.exit(1)
}

await cropRegion(src, { x: Number(x), y: Number(y), w: Number(w), h: Number(h) }, out)
console.log(out)
