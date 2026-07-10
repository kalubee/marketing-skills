import { readdirSync, mkdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { encodeFinal } from './imagetools.js'

const NAME_RE = /^(.+)__(\d+)x(\d+)\.html$/

export async function renderHtmlDir({ htmlDir, outDir, scale = 2 }) {
  mkdirSync(outDir, { recursive: true })
  const files = readdirSync(htmlDir).filter(f => NAME_RE.test(f)).sort()
  if (!files.length) return []
  const browser = await chromium.launch()
  const results = []
  try {
    for (const f of files) {
      const [, base, w, h] = f.match(NAME_RE)
      const W = parseInt(w, 10), H = parseInt(h, 10)
      const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: scale })
      await page.goto('file://' + join(htmlDir, f), { waitUntil: 'networkidle' })
      const png = join(outDir, `${base}_${W}x${H}.png`)
      await page.screenshot({ path: png })
      await page.close()
      const out = await encodeFinal(png, join(outDir, `${base}_${W}x${H}.jpg`), { w: W, h: H })
      unlinkSync(png) // outDir should hold only jpgs
      results.push({ html: f, out, w: W, h: H })
    }
  } finally { await browser.close() }
  return results
}
