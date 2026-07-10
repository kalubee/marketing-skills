// fal-edit.js <imagePath> <prompt> <outPath> — generate an edited photo via
// fal.ai FLUX.2 Pro (~$0.05 per call, billed to your fal account). Requires
// FAL_KEY in the environment; refuses cleanly when unset so callers can fall
// back to non-generative paths (copy changes, resizes, layout variants).
import { makeFal } from './lib/fal.js'

const [imagePath, prompt, outPath] = process.argv.slice(2)
if (!imagePath || !prompt || !outPath) {
  console.error('usage: fal-edit.js <imagePath> <prompt> <outPath>')
  process.exit(1)
}

const fal = makeFal({ apiKey: process.env.FAL_KEY || null })
if (!fal.isConfigured()) {
  console.error('fal-edit: FAL_KEY is not set — photo generation unavailable (copy, resize and layout work still fine)')
  process.exit(1)
}

try {
  await fal.editImage({ imagePath, prompt, outPath })
} catch (err) {
  console.error(`fal-edit: ${err.message}`)
  process.exit(1)
}
console.log(outPath)
