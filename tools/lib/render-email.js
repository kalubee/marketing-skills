/**
 * render-email.js — render a marketing-email HTML into a single tall JPEG.
 *
 * Emails are the inverse of the ad matrix: the WIDTH is fixed (the 724px email spec convention:
 * 724px) and the HEIGHT is content-driven ("depends on content & length").
 * So unlike render.js — which screenshots a fixed W×H viewport per size — this
 * pins the viewport width, measures the rendered document height, and captures
 * the whole column with a full-page screenshot. Rendered at deviceScaleFactor
 * for crisp burned-in copy, then downscaled to the exact logical width by the
 * shared q95 encoder.
 *
 * The design output is one JPEG at 724×<natural height>; downstream tooling slices that
 * into modules for coding and deployment.
 */
import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { encodeFinal } from './imagetools.js'

const DEFAULT_WIDTH = 724
const DEFAULT_SCALE = 2
// Backstop against a runaway layout (e.g. an unbounded image or a broken
// float) blowing memory when we grow the viewport + full-page screenshot.
// A real marketing email is a few thousand px tall; 20k is comfortably above
// any legitimate design and still safe to rasterize at scale 2.
const DEFAULT_MAX_HEIGHT = 20000

function coerceWidth(width) {
  const n = Number(width)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : DEFAULT_WIDTH
}

export async function renderEmailHtml({ htmlPath, outJpg, width = DEFAULT_WIDTH, scale = DEFAULT_SCALE, maxHeight = DEFAULT_MAX_HEIGHT }) {
  const w = coerceWidth(width)
  mkdirSync(dirname(outJpg), { recursive: true })
  // pathToFileURL percent-encodes spaces and other characters that a bare
  // 'file://' + path concatenation would mangle, so a job dir with a space in
  // it (or any non-trivial temp path) still loads.
  const fileUrl = pathToFileURL(isAbsolute(htmlPath) ? htmlPath : resolve(htmlPath)).href

  const browser = await chromium.launch()
  try {
    // Start SHORT on purpose: scrollHeight is bounded below by the viewport, so
    // a tall initial viewport would report its own height instead of the real
    // content height. With a short viewport the content always overflows it, so
    // the measurement is the true rendered column height.
    const page = await browser.newPage({ viewport: { width: w, height: 64 }, deviceScaleFactor: scale })
    await page.goto(fileUrl, { waitUntil: 'networkidle' })
    // Wait for web/system fonts to settle before measuring — otherwise a late
    // font swap can reflow the column and make the measured height wrong (text
    // clipped at the bottom of the capture).
    await page.evaluate(() => (document.fonts && document.fonts.ready) ? document.fonts.ready : null).catch(() => {})
    const measured = Math.ceil(await page.evaluate(() =>
      Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)))
    const height = Math.min(Math.max(measured, 1), maxHeight)
    // Grow the viewport to the (clamped) measured height so fullPage captures
    // exactly the column — no trailing whitespace, no clipping.
    await page.setViewportSize({ width: w, height })
    const pngBuf = await page.screenshot({ fullPage: true, type: 'png' })
    await page.close()
    // encodeFinal resizes to the exact logical size (fit:'fill', lanczos) and
    // emits a q95 4:4:4 JPEG — same final encode as the ad pipeline.
    await encodeFinal(pngBuf, outJpg, { w, h: height })
    return { out: outJpg, w, h: height, clamped: measured > maxHeight }
  } finally {
    await browser.close()
  }
}
