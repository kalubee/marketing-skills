// render.js <htmlDir> <outDir> — thin CLI wrapper around renderHtmlDir.
import { renderHtmlDir } from './lib/render.js'

const [htmlDir, outDir] = process.argv.slice(2)
if (!htmlDir || !outDir) {
  console.error('usage: render.js <htmlDir> <outDir>')
  process.exit(1)
}

const results = await renderHtmlDir({ htmlDir, outDir })
console.log(`rendered ${results.length} file(s)`)
