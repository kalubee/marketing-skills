// extend-image.js <src> <WxH> "<prompt>" <out> — extend (outpaint) a photo to
// a new aspect ratio. Builds a deterministic padded canvas first (source
// contain-fitted over a heavily blurred cover-fill of itself — the classic ad
// blur-extend), then ONE fal edit fills the padding with real content.
// Requires FAL_KEY; without it, fall back to CSS cover-cropping (never stretch).
import { unlinkSync } from 'node:fs'
import sharp from 'sharp'
import { makeFal } from './lib/fal.js'

const [srcPath, sizeArg, prompt, outPath] = process.argv.slice(2)
const sizeMatch = /^(\d+)x(\d+)$/.exec(sizeArg || '')
if (!srcPath || !sizeMatch || !prompt || !outPath) {
  console.error('usage: extend-image.js <src> <WxH> "<prompt>" <out>')
  process.exit(1)
}
const w = Number(sizeMatch[1])
const h = Number(sizeMatch[2])

const fal = makeFal({ apiKey: process.env.FAL_KEY || null })
if (!fal.isConfigured()) {
  console.error('extend-image: FAL_KEY is not set — fall back to CSS cover-cropping (never stretch)')
  process.exit(1)
}

// Deterministic pad: blurred cover-fill underlay + contain-fitted source on top.
const paddedPath = `${outPath}.pad.png`
const under = await sharp(srcPath).resize(w, h, { fit: 'cover' }).blur(40).toBuffer()
const over = await sharp(srcPath).resize(w, h, { fit: 'inside' }).toBuffer()
const overMeta = await sharp(over).metadata()
await sharp(under)
  .composite([{ input: over, left: Math.round((w - overMeta.width) / 2), top: Math.round((h - overMeta.height) / 2) }])
  .png()
  .toFile(paddedPath)

try {
  await fal.editImage({
    imagePath: paddedPath,
    prompt: `The sharp central photo has been padded with a blurred fill. Replace the blurred areas by extending the photo's scene naturally and seamlessly — same lighting, perspective and materials; do not alter the sharp central region. ${prompt}`,
    outPath,
  })
} catch (err) {
  console.error(`extend-image: ${err.message}`)
  process.exit(1)
} finally {
  try { unlinkSync(paddedPath) } catch { /* best-effort */ }
}
console.log(outPath)
