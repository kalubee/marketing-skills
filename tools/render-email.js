// render-email.js <htmlPath> <outJpg> [width] — thin CLI wrapper around
// renderEmailHtml. Fixed width (default 724), content-driven height.
import { renderEmailHtml } from './lib/render-email.js'

const [htmlPath, outJpg, width] = process.argv.slice(2)
if (!htmlPath || !outJpg) {
  console.error('usage: render-email.js <htmlPath> <outJpg> [width]')
  process.exit(1)
}

const res = await renderEmailHtml({ htmlPath, outJpg, ...(width ? { width: Number(width) } : {}) })
console.log(`rendered ${res.out} (${res.w}x${res.h})`)
