import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { sliceImageByMap } from '../lib/slice-image.js'

test('sliceImageByMap cuts bands and writes slices.json', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'slice-'))
  const img = join(dir, 'email.jpg')
  await sharp({ create: { width: 200, height: 400, channels: 3, background: '#dddddd' } }).jpeg().toFile(img)
  const map = { width: 200, bands: [
    { module: 'hero', top: 0, bottom: 250 },
    { module: 'footer', top: 250, bottom: 400 },
  ] }
  const res = await sliceImageByMap({ imgPath: img, map, outDir: join(dir, 'out') })
  assert.equal(res.slices.length, 2)
  assert.ok(existsSync(join(dir, 'out', 'slices.json')))
  const meta = JSON.parse(readFileSync(join(dir, 'out', 'slices.json'), 'utf8'))
  assert.equal(meta.slices[0].module, 'hero')
})
