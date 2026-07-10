import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const FAL_EDIT_URL = 'https://fal.run/fal-ai/flux-2-pro/edit'
const RETRY_MS = [1000, 4000]

/**
 * fal.ai FLUX.2 Pro edit client — direct REST, no SDK. Reads a source image, base64s it into the request, downloads the
 * resulting image to outPath. Retries the whole attempt (edit + download)
 * with backoff on network error or non-2xx; never logs the API key.
 * @returns {{isConfigured: () => boolean, editImage: (args: {imagePath:string, prompt:string, outPath:string}) => Promise<{outPath:string, url:string}>}}
 */
export function makeFal({ apiKey = null, fetchImpl = fetch, sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  function isConfigured() {
    return Boolean(apiKey)
  }

  async function requestEdit(imagePath, prompt) {
    const b64 = readFileSync(imagePath).toString('base64')
    const res = await fetchImpl(FAL_EDIT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      // flux-2-pro/edit expects image_urls (array), not image_url (singular).
      body: JSON.stringify({ prompt, image_urls: [`data:image/png;base64,${b64}`] }),
    })
    if (!res.ok) {
      const detail = typeof res.text === 'function' ? await res.text() : ''
      throw new Error(`fal edit request failed: ${res.status ?? 'unknown status'}${detail ? ` — ${detail}` : ''}`)
    }
    const json = await res.json()
    const url = json?.images?.[0]?.url
    if (!url) throw new Error('fal edit response missing images[0].url')
    return url
  }

  async function downloadTo(url, outPath) {
    const res = await fetchImpl(url)
    if (!res.ok) throw new Error(`fal image download failed: ${res.status ?? 'unknown status'}`)
    const buf = Buffer.from(await res.arrayBuffer())
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, buf)
  }

  async function editImage({ imagePath, prompt, outPath }) {
    if (!isConfigured()) throw new Error('fal is not configured — set the FAL_KEY environment variable')

    let lastErr
    for (let attempt = 0; attempt < 1 + RETRY_MS.length; attempt++) {
      try {
        const url = await requestEdit(imagePath, prompt)
        await downloadTo(url, outPath)
        return { outPath, url }
      } catch (err) {
        lastErr = err
        if (attempt < RETRY_MS.length) await sleepImpl(RETRY_MS[attempt])
      }
    }
    throw lastErr
  }

  return { isConfigured, editImage }
}
