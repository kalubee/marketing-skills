import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const TOOLS = join(dirname(fileURLToPath(import.meta.url)), '..')

test('scrape extracts title, links, colors from a local page', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scrape-'))
  const page = join(dir, 'page.html')
  writeFileSync(page, `<!doctype html><html><head><title>Test Store</title>
    <meta name="description" content="Fine goods">
    <style>.btn{background:#2f6f4f;color:#ffffff}</style></head>
    <body><nav><a href="https://example.com/shop">Shop</a></nav>
    <h1>Welcome</h1><footer><a href="https://example.com/contact">Contact</a></footer></body></html>`)
  const out = join(dir, 'out.json')
  execFileSync('node', [join(TOOLS, 'scrape.js'), page, out], { encoding: 'utf8' })
  const data = JSON.parse(readFileSync(out, 'utf8'))
  assert.equal(data.title, 'Test Store')
  assert.equal(data.meta.description, 'Fine goods')
  assert.equal(data.headings.h1[0], 'Welcome')
  assert.equal(data.nav_links[0].text, 'Shop')
  assert.equal(data.footer_links[0].text, 'Contact')
  assert.ok(data.color_hints['#2f6f4f'] >= 1)
})
