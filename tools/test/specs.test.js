import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateAdSpec } from '../lib/adspec.js'
import { validateEmailSpec } from '../lib/emailspec.js'

test('adspec: valid spec passes', () => {
  const { ok, errors } = validateAdSpec({
    copy: { headline: 'BIG SALE' },
    layout: { archetype: 'hero left, copy right' },
    palette: { bg: '#ffffff', accent: '#c0392b', ink: '#1a1a1a' },
    logo: { present: true },
    photo: { present: true },
  })
  assert.equal(ok, true, errors.join(','))
})

test('adspec: missing headline and bad hex fail', () => {
  const { ok, errors } = validateAdSpec({
    copy: {}, layout: { archetype: 'x' },
    palette: { bg: 'white', accent: '#c0392b', ink: '#1a1a1a' },
    logo: { present: true }, photo: { present: false },
  })
  assert.equal(ok, false)
  assert.ok(errors.length >= 2)
})

test('emailspec: valid spec passes', () => {
  const { ok, errors } = validateEmailSpec({
    brand: 'acme', subject: 'Weekend Sale',
    layout: { width_px: 724, margin_px: 50, module_gap_px: 50 },
    modules: [
      { type: 'hero', headline: 'WEEKEND SALE' },
      { type: 'product_row', products: [{ name: 'Sofa', price_now: '$599' }] },
      { type: 'footer' },
    ],
  })
  assert.equal(ok, true, errors.join(','))
})

test('emailspec: unknown module type fails', () => {
  const { ok } = validateEmailSpec({
    brand: 'acme', subject: 's',
    layout: { width_px: 724, margin_px: 0, module_gap_px: 0 },
    modules: [{ type: 'jumbotron' }],
  })
  assert.equal(ok, false)
})
