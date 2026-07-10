import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { makeFal } from '../lib/fal.js'

const dir = mkdtempSync(join(tmpdir(), 'fal-'))
const TOOLS = join(dirname(fileURLToPath(import.meta.url)), '..')

test('isConfigured false without key; editImage throws mentioning FAL_KEY', async () => {
  const fal = makeFal({ apiKey: null })
  assert.equal(fal.isConfigured(), false)
  await assert.rejects(() => fal.editImage({ imagePath: 'x', prompt: 'y', outPath: 'z' }), /FAL_KEY/)
})

test('editImage happy path via injected fetch', async () => {
  const src = join(dir, 'in.png'); writeFileSync(src, 'fake-png-bytes')
  const out = join(dir, 'out.png')
  const calls = []
  const fetchImpl = async (url, opts) => {
    calls.push(url)
    if (opts) return { ok: true, json: async () => ({ images: [{ url: 'https://img.example/x.png' }] }) }
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode('result-bytes').buffer }
  }
  const fal = makeFal({ apiKey: 'test-key', fetchImpl })
  await fal.editImage({ imagePath: src, prompt: 'p', outPath: out })
  assert.equal(readFileSync(out, 'utf8'), 'result-bytes')
  assert.match(calls[0], /fal\.run/)
})

test('fal-edit CLI refuses without FAL_KEY', () => {
  try {
    execFileSync('node', [join(TOOLS, 'fal-edit.js'), 'a.png', 'prompt', 'b.png'],
      { env: { ...process.env, FAL_KEY: '' }, encoding: 'utf8' })
    assert.fail('should exit 1')
  } catch (err) {
    assert.equal(err.status, 1)
    assert.match(String(err.stderr), /FAL_KEY/)
  }
})

test('extend-image CLI refuses without FAL_KEY', () => {
  try {
    execFileSync('node', [join(TOOLS, 'extend-image.js'), 'a.png', '100x100', 'prompt', 'b.png'],
      { env: { ...process.env, FAL_KEY: '' }, encoding: 'utf8' })
    assert.fail('should exit 1')
  } catch (err) {
    assert.equal(err.status, 1)
    assert.match(String(err.stderr), /FAL_KEY/)
  }
})
