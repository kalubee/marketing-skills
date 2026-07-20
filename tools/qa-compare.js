#!/usr/bin/env node
// qa-compare.js — the wireframe-fallback decision harness. For each registered
// block it stitches your styled render beside the matching reference region at
// equal width into <out>/<id>.png, and prints a coarse similarity score. YOU make
// the final call with vision on each side-by-side; the score only flags a LIKELY
// mismatch. With --apply, ids scoring below --threshold are appended to the
// wireframe set so they degrade to wireframes on the next render.
//
// Usage:
//   node qa-compare.js --mine <email.jpg> --mine-width 724 \
//        --ref <reference.svg|img> --ref-width 1180 \
//        --blocks work/qa-blocks.json --out work/qa \
//        [--wire work/wireframe-blocks.json] [--threshold 0.72] [--apply]
//
// qa-blocks.json: { "hero": { "mine":[x,y,w,h], "ref":[x,y,w,h], "label":"Hero" }, ... }
//   mine[] is in your email coordinate space (--mine-width); the script scales by
//   the jpg's real width. ref[] is in the reference rendered at --ref-width.
const sharp = require('sharp');
const fs = require('fs'), path = require('path');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const has = n => process.argv.includes('--' + n);

const MINE = arg('mine'), REF = arg('ref'), BLOCKS = arg('blocks'), OUT = arg('out', 'qa');
const MW = +arg('mine-width', 724), RW = +arg('ref-width', 1180), TH = +arg('threshold', 0.72);
const WIRE = arg('wire'), APPLY = has('apply');
if (!MINE || !REF || !BLOCKS) { console.error('need --mine --ref --blocks'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const blocks = JSON.parse(fs.readFileSync(BLOCKS, 'utf8'));

async function sim(a, b) { const g = x => sharp(x).resize(64, 64, { fit: 'fill' }).greyscale().raw().toBuffer(); const [A, B] = await Promise.all([g(a), g(b)]); let s = 0; for (let i = 0; i < A.length; i++) s += Math.abs(A[i] - B[i]); return 1 - s / (A.length * 255); }

(async () => {
  const mine = await sharp(MINE).png().toBuffer();
  const mMeta = await sharp(mine).metadata();
  const k = mMeta.width / MW;                      // jpg px per email unit
  const ref = await sharp(REF, { density: 72 }).resize({ width: RW }).png().toBuffer();
  const W = 540, flag = [];
  for (const [id, b] of Object.entries(blocks)) {
    const mCrop = await sharp(mine).extract({ left: Math.round(b.mine[0] * k), top: Math.round(b.mine[1] * k), width: Math.round(b.mine[2] * k), height: Math.round(b.mine[3] * k) }).resize({ width: W }).png().toBuffer();
    const rCrop = await sharp(ref).extract({ left: b.ref[0], top: b.ref[1], width: b.ref[2], height: b.ref[3] }).resize({ width: W }).png().toBuffer();
    const [mm, rm] = [await sharp(mCrop).metadata(), await sharp(rCrop).metadata()];
    const H = Math.max(mm.height, rm.height);
    await sharp({ create: { width: W * 2 + 24, height: H, channels: 3, background: '#666' } })
      .composite([{ input: rCrop, left: 0, top: 0 }, { input: mCrop, left: W + 24, top: 0 }]).png().toFile(path.join(OUT, id + '.png'));
    const score = await sim(rCrop, mCrop), bad = score < TH; if (bad) flag.push(id);
    console.log(`${id.padEnd(16)} score=${score.toFixed(3)}  ${bad ? '⚠ LIKELY MISMATCH — review ' + path.join(OUT, id + '.png') + ' → wireframe?' : 'ok (still eyeball ' + id + '.png)'}`);
  }
  if (APPLY && WIRE) {
    const set = new Set(fs.existsSync(WIRE) ? JSON.parse(fs.readFileSync(WIRE, 'utf8')) : []);
    flag.forEach(id => set.add(id));
    fs.writeFileSync(WIRE, JSON.stringify([...set]));
    console.log('--apply: wrote', WIRE, '=', JSON.stringify([...set]), '(re-render to apply)');
  } else if (flag.length) {
    console.log('\nreview the sheets; to wireframe the mismatches add to your wireframe-blocks.json:', JSON.stringify(flag));
  }
})();
