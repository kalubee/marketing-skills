// render-html-shot.js <html> <out.png> [width] — full-page screenshot of a
// local HTML file (relative image src's resolve against the file's folder).
// E.g., to visually QA an assembled email.html against its source image.
import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'
import { isAbsolute, resolve } from 'node:path'

const [htmlPath, outPng, widthArg] = process.argv.slice(2)
if (!htmlPath || !outPng) {
  console.error('usage: render-html-shot.js <html> <out.png> [width]')
  process.exit(1)
}
const width = Number(widthArg) > 0 ? Math.round(Number(widthArg)) : 724

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width, height: 800 } })
  const url = pathToFileURL(isAbsolute(htmlPath) ? htmlPath : resolve(htmlPath)).href
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.screenshot({ path: outPng, fullPage: true })
  const dims = await page.evaluate(() => ({ w: document.body.scrollWidth, h: document.body.scrollHeight }))
  console.log(`shot ${outPng} (${dims.w}x${dims.h})`)
} finally {
  await browser.close()
}
