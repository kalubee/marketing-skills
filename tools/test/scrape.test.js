import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

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

// Chromium gives every file:// resource its own opaque origin, so a linked
// stylesheet renders but throws on CSSOM access (cssRules) even from the same
// directory. Real sites serve HTML + CSS same-origin over http(s), so this
// fixture uses a tiny local server to reproduce that faithfully. The scrape
// subprocess is awaited asynchronously (not execFileSync) so this process's
// event loop stays free to serve the subprocess's requests.
test('scrape extracts colors declared in an external stylesheet', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'scrape-'))
  writeFileSync(join(dir, 'styles.css'), `.hero{background:#a1b2c3}`)
  writeFileSync(join(dir, 'page2.html'), `<!doctype html><html><head><title>External CSS Store</title>
    <link rel="stylesheet" href="styles.css"></head>
    <body><h1>Welcome</h1><div class="hero">Hero</div></body></html>`)

  const server = createServer((req, res) => {
    const name = req.url === '/' ? 'page2.html' : req.url.replace(/^\//, '')
    try {
      const body = readFileSync(join(dir, name))
      res.setHeader('Content-Type', name.endsWith('.css') ? 'text/css' : 'text/html')
      res.end(body)
    } catch {
      res.statusCode = 404
      res.end()
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  const out = join(dir, 'out2.json')
  try {
    await execFileAsync('node', [join(TOOLS, 'scrape.js'), `http://127.0.0.1:${port}/page2.html`, out], { encoding: 'utf8' })
  } finally {
    server.close()
  }
  const data = JSON.parse(readFileSync(out, 'utf8'))
  assert.ok(data.color_hints['#a1b2c3'] >= 1)
})
