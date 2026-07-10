import sharp from 'sharp'

/** @returns {Promise<{w:number,h:number}>} */
export async function imageSize(path) {
  const meta = await sharp(path).metadata()
  return { w: meta.width, h: meta.height }
}

/**
 * Extract a region from srcPath, clamping {x,y,w,h} to the source image bounds.
 * @returns {Promise<string>} outPath
 */
export async function cropRegion(srcPath, { x, y, w, h }, outPath) {
  const meta = await sharp(srcPath).metadata()
  const left = Math.max(0, Math.min(x, meta.width))
  const top = Math.max(0, Math.min(y, meta.height))
  const width = Math.max(0, Math.min(w, meta.width - left))
  const height = Math.max(0, Math.min(h, meta.height - top))
  await sharp(srcPath).extract({ left, top, width, height }).toFile(outPath)
  return outPath
}

/**
 * Turn near-white pixels transparent (logo cutout). Writes a PNG with alpha.
 * @returns {Promise<string>} outPath
 */
export async function knockoutWhite(srcPath, outPath, { threshold = 245 } = {}) {
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  for (let i = 0; i < width * height; i++) {
    const idx = i * channels
    if (data[idx] >= threshold && data[idx + 1] >= threshold && data[idx + 2] >= threshold) {
      data[idx + 3] = 0
    }
  }
  await sharp(data, { raw: { width, height, channels } }).png().toFile(outPath)
  return outPath
}

/**
 * Resize to exact w×h (Lanczos, fit:'fill') and encode as a q95 4:4:4 JPEG.
 * @returns {Promise<string>} outJpg
 */
export async function encodeFinal(srcPng, outJpg, { w, h, quality = 95 } = {}) {
  await sharp(srcPng)
    .resize(w, h, { fit: 'fill', kernel: 'lanczos3' })
    .flatten({ background: '#ffffff' })
    .withMetadata({ density: 72 })
    .jpeg({ quality, chromaSubsampling: '4:4:4' })
    .toFile(outJpg)
  return outJpg
}
