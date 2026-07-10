// slice-image.js <image.jpg> <slice-map.json> <outDir> — cut a flat email
// image into per-region slices from an explicit slice map (Photoshop-style).
import { readFileSync } from 'node:fs'
import { sliceImageByMap } from './lib/slice-image.js'

const [imgPath, mapPath, outDir] = process.argv.slice(2)
if (!imgPath || !mapPath || !outDir) {
  console.error('usage: slice-image.js <image.jpg> <slice-map.json> <outDir>')
  process.exit(1)
}

try {
  const map = JSON.parse(readFileSync(mapPath, 'utf8'))
  const res = await sliceImageByMap({ imgPath, map, outDir })
  for (const s of res.slices) console.log(`${s.file} (${s.width}x${s.height})`)
} catch (err) {
  console.error(`slice-image: ${err.message}`)
  process.exit(1)
}
