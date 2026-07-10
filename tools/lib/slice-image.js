/**
 * slice-image.js — cut a FLAT email JPEG (no HTML, no markers) into per-region
 * slices from an explicit slice map, the way Photoshop's slice tool cuts a
 * "Save for Web" export.
 *
 * This is the counterpart to slice-email: that one measures rendered HTML;
 * this one slices artwork produced elsewhere (a designer's
 * InDesign/Photoshop export) where the only thing we have is pixels + a set of
 * cut guides. The output shape is a standard slice metadata format for
 * further processing by the render pipeline.
 *
 * A slice map is:
 *   { width, bands: [
 *       { module, key?, label?, top, bottom },                 // full-width band
 *       { module, top, bottom, cells: [                        // grid band
 *           { key?, label?, left, right }, ... ] } ] }
 * Coordinates are in the image's own pixels. Bands tile top→bottom; cells tile
 * left→right within their band.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

function slug(name) {
  const s = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return s || 'slice'
}

const clamp = (v, lo, hi) => Math.min(Math.max(Math.round(v), lo), hi)

export async function sliceImageByMap({ imgPath, map, outDir }) {
  const meta = await sharp(imgPath).metadata()
  const W = meta.width
  const H = meta.height
  if (!map || !Array.isArray(map.bands) || !map.bands.length) {
    throw new Error('slice map has no bands')
  }
  const bands = map.bands.slice().sort((a, b) => a.top - b.top)

  mkdirSync(outDir, { recursive: true })
  const pad = (x) => String(x).padStart(2, '0')
  const slices = []
  let n = 0

  for (let i = 0; i < bands.length; i++) {
    const b = bands[i]
    const top = clamp(b.top, 0, H - 1)
    const bottom = clamp(b.bottom, top + 1, H)
    const bandH = bottom - top
    const cells = Array.isArray(b.cells) && b.cells.length > 1
      ? b.cells.slice().sort((x, y) => x.left - y.left)
      : null

    if (!cells) {
      n++
      const file = join(outDir, `${pad(n)}-${slug(b.module)}.jpg`)
      await sharp(imgPath)
        .extract({ left: 0, top, width: W, height: bandH })
        .withMetadata({ density: 72 })
        .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
        .toFile(file)
      slices.push({ n, module: b.module, key: b.key || null, label: b.label || null, band: i, col: 0, top, left: 0, width: W, height: bandH, file })
      continue
    }

    for (let j = 0; j < cells.length; j++) {
      n++
      const left = clamp(cells[j].left, 0, W - 1)
      const right = clamp(cells[j].right, left + 1, W)
      const width = right - left
      const file = join(outDir, `${pad(n)}-${slug(b.module)}.jpg`)
      await sharp(imgPath)
        .extract({ left, top, width, height: bandH })
        .withMetadata({ density: 72 })
        .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
        .toFile(file)
      slices.push({ n, module: b.module, key: cells[j].key || null, label: cells[j].label || null, band: i, col: j, top, left, width, height: bandH, file })
    }
  }

  const result = { width: W, height: H, slices }
  writeFileSync(join(outDir, 'slices.json'), JSON.stringify(result, null, 2))
  return result
}
