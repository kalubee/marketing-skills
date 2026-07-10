// imgsize.js <image> — print an image's pixel dimensions as JSON ({"w":..,"h":..}).
import { imageSize } from './lib/imagetools.js'

const [imagePath] = process.argv.slice(2)
if (!imagePath) {
  console.error('usage: imgsize.js <image>')
  process.exit(1)
}

try {
  console.log(JSON.stringify(await imageSize(imagePath)))
} catch (err) {
  console.error(`imgsize: ${err.message}`)
  process.exit(1)
}
