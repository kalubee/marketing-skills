#!/usr/bin/env node
// extract-shape.js — lift a CLEAN, COMPLETE decorative shape out of a reference
// image/SVG, so a renderer can reuse the real silhouette instead of a hand-drawn
// approximation. Brand-neutral: everything comes from CLI args.
//
// Method (robust to shapes with knocked-out white text welded into the artwork,
// which defeats literal <path> copying and naive thresholding):
//   1. render/resize the reference, crop the shape's bounding box
//   2. mask pixels near the shape's fill colour
//   3. DILATE the mask (bridges gaps where interior text breaks the outer edge)
//   4. flood-fill the background inward from the crop border
//   5. anything not reached by the flood = interior hole → fill it (text holes)
//   6. ERODE back to original size; keep the largest connected component
//   7. optional: reduce to the convex hull → perfectly clean straight edges
// Output: a solid-fill PNG (trimmed) OR normalized polygon points JSON (0..1).
//
// Usage:
//   node extract-shape.js --ref <img|svg> --box x,y,w,h --color '#9e2136' \
//        --out shape.png [--width 1180] [--density 100] [--tol 60] \
//        [--dilate 6] [--hull] [--out-json hull.json]
//
// --box is in the coordinate space of the reference rendered at --width.
// --hull with --out *.png renders the hull filled; --out-json writes normalized
// hull vertices ([[x,y],...] in 0..1) for use as an SVG <polygon>.
const sharp = require('sharp');
const fs = require('fs');

function arg(name, def) { const i = process.argv.indexOf('--' + name); return i >= 0 ? process.argv[i + 1] : def; }
const has = name => process.argv.includes('--' + name);

const REF = arg('ref'), OUT = arg('out'), OUTJSON = arg('out-json');
if (!REF || (!OUT && !OUTJSON)) { console.error('need --ref and --out (or --out-json)'); process.exit(1); }
const [bx, by, bw, bh] = (arg('box') || '').split(',').map(Number);
if ([bx, by, bw, bh].some(n => Number.isNaN(n))) { console.error('need --box x,y,w,h'); process.exit(1); }
const COLOR = arg('color'); if (!COLOR) { console.error('need --color #hex (the shape fill from the reference <style>)'); process.exit(1); }
const W = +arg('width', 1180), DENS = +arg('density', 100), TOL = +arg('tol', 60), DIL = +arg('dilate', 6);
const HULL = has('hull');
const tc = [1, 3, 5].map(i => parseInt(COLOR.slice(i, i + 2), 16));

function dilate(m, w, h, r) { const o = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let on = 0; for (let dy = -r; dy <= r && !on; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue; for (let dx = -r; dx <= r; dx++) { const xx = x + dx; if (xx < 0 || xx >= w) continue; if (m[yy * w + xx]) { on = 1; break; } } } o[y * w + x] = on; } return o; }
function erode(m, w, h, r) { const o = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let all = 1; for (let dy = -r; dy <= r && all; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) { all = 0; break; } for (let dx = -r; dx <= r; dx++) { const xx = x + dx; if (xx < 0 || xx >= w || !m[yy * w + xx]) { all = 0; break; } } } o[y * w + x] = all; } return o; }
function largestCC(m, w, h) { const seen = new Uint8Array(w * h), q = new Int32Array(w * h); let best = []; for (let s = 0; s < w * h; s++) { if (m[s] && !seen[s]) { let qh = 0, qt = 0; q[qt++] = s; seen[s] = 1; const cur = [s]; while (qh < qt) { const p = q[qh++], x = p % w, y = (p / w) | 0; for (const np of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) if (np >= 0 && m[np] && !seen[np]) { seen[np] = 1; q[qt++] = np; cur.push(np); } } if (cur.length > best.length) best = cur; } } const o = new Uint8Array(w * h); for (const p of best) o[p] = 1; return o; }
function hull(pts) { pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = []; for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); } const up = []; for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } lo.pop(); up.pop(); return lo.concat(up); }

(async () => {
  const full = await sharp(REF, { density: DENS }).resize({ width: W }).png().toBuffer();
  const { data, info } = await sharp(full).extract({ left: bx, top: by, width: bw, height: bh }).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info, N = w * h;
  const mask = new Uint8Array(N);
  for (let p = 0; p < N; p++) { const i = p * c, dr = data[i] - tc[0], dg = data[i + 1] - tc[1], db = data[i + 2] - tc[2]; mask[p] = (dr * dr + dg * dg + db * db) < TOL * TOL ? 1 : 0; }
  const dil = dilate(mask, w, h, DIL);
  const outside = new Uint8Array(N), q = new Int32Array(N); let qh = 0, qt = 0;
  const seed = p => { if (!dil[p] && !outside[p]) { outside[p] = 1; q[qt++] = p; } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); } for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (qh < qt) { const p = q[qh++], x = p % w, y = (p / w) | 0; if (x > 0) seed(p - 1); if (x < w - 1) seed(p + 1); if (y > 0) seed(p - w); if (y < h - 1) seed(p + w); }
  const filled = new Uint8Array(N); for (let p = 0; p < N; p++) filled[p] = (dil[p] || !outside[p]) ? 1 : 0;
  let fin = largestCC(erode(filled, w, h, DIL), w, h);

  if (HULL) {
    const pts = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = y * w + x; if (fin[p] && (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !fin[p - 1] || !fin[p + 1] || !fin[p - w] || !fin[p + w])) pts.push([x, y]); }
    const H = hull(pts), xs = H.map(p => p[0]), ys = H.map(p => p[1]);
    const mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys);
    const norm = H.map(([x, y]) => [+((x - mnx) / (mxx - mnx)).toFixed(4), +((y - mny) / (mxy - mny)).toFixed(4)]);
    if (OUTJSON) { fs.writeFileSync(OUTJSON, JSON.stringify(norm)); console.log('hull JSON', OUTJSON, norm.length, 'verts, bbox', (mxx - mnx) + 'x' + (mxy - mny)); }
    if (OUT) { const pw = 640, ph = Math.round(pw * (mxy - mny) / (mxx - mnx)); const poly = norm.map(([x, y]) => `${(x * pw).toFixed(1)},${(y * ph).toFixed(1)}`).join(' '); await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}"><polygon points="${poly}" fill="${COLOR}"/></svg>`)).png().toFile(OUT); console.log('hull PNG', OUT); }
    return;
  }
  const rgba = Buffer.alloc(N * 4);
  for (let p = 0; p < N; p++) if (fin[p]) { rgba[p * 4] = tc[0]; rgba[p * 4 + 1] = tc[1]; rgba[p * 4 + 2] = tc[2]; rgba[p * 4 + 3] = 255; }
  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).median(3).trim({ threshold: 8 }).png().toFile(OUT);
  const m = await sharp(OUT).metadata(); console.log('silhouette PNG', OUT, m.width + 'x' + m.height);
})();
