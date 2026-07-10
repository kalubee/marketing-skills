import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { imageSize, cropRegion, knockoutWhite, encodeFinal } from '../lib/imagetools.js'

const dir = mkdtempSync(join(tmpdir(), 'imgtools-'))
const src = join(dir, 'src.png')
// 100x100: red field with a white 20px border
await sharp({ create: { width: 100, height: 100, channels: 3, background: '#ffffff' } })
  .composite([{ input: await sharp({ create: { width: 60, height: 60, channels: 3, background: '#cc0000' } }).png().toBuffer(), left: 20, top: 20 }])
  .png().toFile(src)

test('imageSize reads dimensions', async () => {
  assert.deepEqual(await imageSize(src), { w: 100, h: 100 })
})

test('cropRegion extracts and clamps', async () => {
  const out = join(dir, 'crop.png')
  await cropRegion(src, { x: 20, y: 20, w: 60, h: 60 }, out)
  assert.deepEqual(await imageSize(out), { w: 60, h: 60 })
})

test('knockoutWhite makes the white border transparent', async () => {
  const out = join(dir, 'ko.png')
  await knockoutWhite(src, out)
  const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true })
  assert.equal(data[3], 0) // top-left pixel alpha (white border) is 0
  const center = ((50 * info.width) + 50) * 4
  assert.equal(data[center + 3], 255) // red center stays opaque
})

test('encodeFinal produces an exact-size JPEG', async () => {
  const out = join(dir, 'final.jpg')
  await encodeFinal(src, out, { w: 40, h: 30 })
  assert.deepEqual(await imageSize(out), { w: 40, h: 30 })
})
