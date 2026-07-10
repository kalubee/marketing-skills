import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { imageSize } from '../lib/imagetools.js'
import { renderHtmlDir } from '../lib/render.js'
import { renderEmailHtml } from '../lib/render-email.js'

const dir = mkdtempSync(join(tmpdir(), 'render-'))
const htmlDir = join(dir, 'html'); mkdirSync(htmlDir)
const outDir = join(dir, 'out')
writeFileSync(join(htmlDir, 'variant_01__200x100.html'),
  '<!doctype html><body style="margin:0;background:#222;color:#fff;font-family:sans-serif"><h1>Hi</h1></body>')

test('renderHtmlDir renders exact-size JPEGs from __WxH names', async () => {
  const results = await renderHtmlDir({ htmlDir, outDir })
  assert.equal(results.length, 1)
  assert.ok(existsSync(results[0].out))
  assert.deepEqual(await imageSize(results[0].out), { w: 200, h: 100 })
})

test('renderEmailHtml renders fixed-width content-height JPEG', async () => {
  const htmlPath = join(dir, 'email.html')
  writeFileSync(htmlPath, '<!doctype html><body style="margin:0"><div style="height:900px;background:#eee">email</div></body>')
  const res = await renderEmailHtml({ htmlPath, outJpg: join(dir, 'email.jpg'), width: 300 })
  assert.equal(res.w, 300)
  assert.ok(res.h >= 900)
})
