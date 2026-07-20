#!/usr/bin/env node
// No-background product cutouts — sharp-only heuristic fallback for when rembg
// (photo-cutout-rembg.py) isn't available. Removes a near-white studio sweep by
// edge flood-fill (so interior whites like bedding stay opaque), grows through
// weak near-white with a saturation guard, shaves a 1px rim by erosion, drops
// small enclosed light pockets (floor between legs / headboard-mattress gap),
// then feathers. GOOD for high-contrast products; a genuinely WHITE product on
// a WHITE background (bare mattress) has no boundary to key on — use rembg there.
//
// Reads a photo_manifest.json (from photo-resolve.js), cuts out each product's
// `pure` shot, writes <photos>/<key>_cutout.png, records `cutoutFile`.
//
// Usage: node photo-cutout.js --manifest <run>/photo_manifest.json

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const args = (() => { const a = {}; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith("--")) a[k.slice(2)] = process.argv[i + 1]; } return a; })();
if (!args.manifest) { console.error("Usage: node photo-cutout.js --manifest <photo_manifest.json>"); process.exit(2); }
const MAN = path.resolve(args.manifest);
const PHOTOS = path.join(path.dirname(MAN), "photos");

const STRONG = 236, WEAK = 224, WEAK_SAT = 16, ERODE = 1, FEATHER = 0.8;
const POCKET_WHITE = 214, POCKET_SAT = 22, POCKET_MAX_FRAC = 0.02;

function removeLightPockets(bg, data, W, H, C) {
  const light = (px) => { const i = px * C, r = data[i], g = data[i + 1], b = data[i + 2]; const mn = Math.min(r, g, b), mx = Math.max(r, g, b); return mn >= POCKET_WHITE && (mx - mn) <= POCKET_SAT; };
  const seen = new Uint8Array(W * H), maxSize = POCKET_MAX_FRAC * W * H;
  for (let p0 = 0; p0 < W * H; p0++) {
    if (bg[p0] || seen[p0] || !light(p0)) continue;
    const comp = [p0]; seen[p0] = 1; let qi = 0;
    while (qi < comp.length) {
      const px = comp[qi++], x = px % W, y = (px / W) | 0, nb = [];
      if (x > 0) nb.push(px - 1); if (x < W - 1) nb.push(px + 1); if (y > 0) nb.push(px - W); if (y < H - 1) nb.push(px + W);
      for (const n of nb) if (!seen[n] && !bg[n] && light(n)) { seen[n] = 1; comp.push(n); }
    }
    if (comp.length <= maxSize) for (const px of comp) bg[px] = 1;
  }
}
function erode(mask, W, H, r) {
  const tmp = new Uint8Array(W * H), out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let m = 255; for (let d = -r; d <= r; d++) { const xx = x + d; if (xx < 0 || xx >= W) { m = 0; break; } const v = mask[y * W + xx]; if (v < m) m = v; } tmp[y * W + x] = m; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let m = 255; for (let d = -r; d <= r; d++) { const yy = y + d; if (yy < 0 || yy >= H) { m = 0; break; } const v = tmp[yy * W + x]; if (v < m) m = v; } out[y * W + x] = m; }
  return out;
}

async function cutout(src, dst) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const bg = new Uint8Array(W * H), stack = [];
  const strong = (px) => { const i = px * C; return data[i] >= STRONG && data[i + 1] >= STRONG && data[i + 2] >= STRONG; };
  const weak = (px) => { const i = px * C, r = data[i], g = data[i + 1], b = data[i + 2]; const mn = Math.min(r, g, b), mx = Math.max(r, g, b); return mn >= WEAK && (mx - mn) <= WEAK_SAT; };
  const seed = (x, y) => { const px = y * W + x; if (!bg[px] && strong(px)) { bg[px] = 1; stack.push(px); } };
  for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1); }
  for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y); }
  while (stack.length) {
    const px = stack.pop(), x = px % W, y = (px / W) | 0;
    if (x > 0)     { const n = px - 1; if (!bg[n] && weak(n)) { bg[n] = 1; stack.push(n); } }
    if (x < W - 1) { const n = px + 1; if (!bg[n] && weak(n)) { bg[n] = 1; stack.push(n); } }
    if (y > 0)     { const n = px - W; if (!bg[n] && weak(n)) { bg[n] = 1; stack.push(n); } }
    if (y < H - 1) { const n = px + W; if (!bg[n] && weak(n)) { bg[n] = 1; stack.push(n); } }
  }
  removeLightPockets(bg, data, W, H, C);
  const hard = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) hard[p] = bg[p] ? 0 : 255;
  const eroded = erode(hard, W, H, ERODE);
  const alpha = Buffer.alloc(W * H);
  let minx = W, miny = H, maxx = -1, maxy = -1;
  for (let p = 0; p < W * H; p++) { alpha[p] = eroded[p]; if (eroded[p]) { const x = p % W, y = (p / W) | 0; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; } }
  if (maxx < 0) throw new Error("cutout removed everything (not a studio shot?)");
  // NB: sharp promotes a 1-channel raw to 3-channel through blur, so force it
  // back to single-channel ("b-w") before reading — else the alpha is 3x long
  // and misaligned (silent transparent output).
  const alphaBlur = await sharp(alpha, { raw: { width: W, height: H, channels: 1 } }).blur(FEATHER).toColourspace("b-w").raw().toBuffer();
  const out = Buffer.alloc(W * H * 4);
  for (let p = 0; p < W * H; p++) { out[p * 4] = data[p * C]; out[p * 4 + 1] = data[p * C + 1]; out[p * 4 + 2] = data[p * C + 2]; out[p * 4 + 3] = alphaBlur[p]; }
  const pad = 6;
  const ex = { left: Math.max(0, minx - pad), top: Math.max(0, miny - pad) };
  ex.width = Math.min(W - ex.left, maxx - minx + 1 + pad * 2);
  ex.height = Math.min(H - ex.top, maxy - miny + 1 + pad * 2);
  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).extract(ex).png().toFile(dst);
  return { w: ex.width, h: ex.height };
}

async function run() {
  const manifest = JSON.parse(fs.readFileSync(MAN, "utf8"));
  for (const rec of manifest) {
    const src = rec.pure && rec.pure.file;
    if (!src || !fs.existsSync(src)) { console.log(`- ${rec.name}: no pure shot, skip`); continue; }
    const dst = path.join(PHOTOS, `${rec.key}_cutout.png`);
    try { const { w, h } = await cutout(src, dst); rec.cutoutFile = dst; rec.cutoutMethod = "heuristic"; console.log(`✓ ${rec.name}: ${w}x${h} -> ${path.basename(dst)}`); }
    catch (e) { console.log(`✗ ${rec.name}: ${e.message}`); }
  }
  fs.writeFileSync(MAN, JSON.stringify(manifest, null, 2));
  console.log("manifest updated with cutoutFile paths");
}
run().catch((e) => { console.error(e); process.exit(1); });
