// scrape.js <url-or-local-html> [out.json] — fetch one page with headless
// Chromium and emit brand-relevant structure as JSON: title, meta/og tags,
// headings, nav + footer links, image and icon URLs, hex colour hints, and a
// text sample. A brand-research skill calls this once per page and reasons
// over the JSON itself.
import { writeFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const [target, outJson] = process.argv.slice(2)
if (!target) {
  console.error('usage: scrape.js <url-or-local-html> [out.json]')
  process.exit(1)
}
const url = /^https?:\/\//.test(target)
  ? target
  : pathToFileURL(isAbsolute(target) ? target : resolve(process.cwd(), target)).href

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
  const data = await page.evaluate(() => {
    const attr = (sel, a) => [...document.querySelectorAll(sel)].map((el) => el.getAttribute(a)).filter(Boolean)
    const txt = (sel) => [...document.querySelectorAll(sel)].map((el) => el.textContent.trim()).filter(Boolean)
    const links = (root) => [...root.querySelectorAll('a[href]')].slice(0, 60)
      .map((a) => ({ text: a.textContent.trim().slice(0, 80), href: a.href }))
    const meta = {}
    for (const m of document.querySelectorAll('meta[name],meta[property]')) {
      const k = m.getAttribute('name') || m.getAttribute('property')
      if (/^(description|og:|twitter:)/.test(k)) meta[k.replace(/^(og|twitter):/, '$1_')] = m.getAttribute('content')
    }
    const hexes = {}
    // Extract from raw style tags (before browser converts to rgb)
    for (const style of document.querySelectorAll('style')) {
      for (const m of (style.textContent || '').matchAll(/#[0-9a-fA-F]{6}\b/g)) {
        const hx = m[0].toLowerCase(); hexes[hx] = (hexes[hx] || 0) + 1
      }
    }
    // Also extract from computed rules (for inline styles)
    for (const sheet of document.styleSheets) {
      let rules = []
      try { rules = [...sheet.cssRules] } catch { continue }
      for (const r of rules) for (const m of (r.cssText || '').matchAll(/#[0-9a-fA-F]{6}\b/g)) {
        const hx = m[0].toLowerCase(); hexes[hx] = (hexes[hx] || 0) + 1
      }
    }
    const navRoot = document.querySelector('nav') || document.querySelector('header')
    const footRoot = document.querySelector('footer')
    return {
      url: location.href,
      title: document.title,
      meta,
      headings: { h1: txt('h1').slice(0, 10), h2: txt('h2').slice(0, 20) },
      nav_links: navRoot ? links(navRoot) : [],
      footer_links: footRoot ? links(footRoot) : [],
      images: attr('img[src]', 'src').slice(0, 30),
      icons: attr('link[rel*="icon"]', 'href'),
      color_hints: Object.fromEntries(Object.entries(hexes).sort((a, b) => b[1] - a[1]).slice(0, 20)),
      text_sample: document.body.innerText.replace(/\s+/g, ' ').slice(0, 4000),
    }
  })
  const json = JSON.stringify(data, null, 2)
  if (outJson) { writeFileSync(outJson, json); console.log(outJson) } else { console.log(json) }
} finally {
  await browser.close()
}
