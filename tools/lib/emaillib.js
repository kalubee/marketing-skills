// emaillib.js — shared, brand-neutral render primitives for design-email render
// scripts. require() this from a run's work/render.js so every template gets the
// same correct behaviour: a WIREFRAME FALLBACK for shapes that can't be matched,
// auto-sizing tags that never clip, near-white photo placeholders, and superscript
// prices. Nothing brand-specific lives here — colours/fonts/copy are passed in.
//
//   const L = require('<TOOLS>/lib/emaillib.js');
//   const P = [];                      // your SVG-node sink (array of strings)
//   const em = L.make(P, { HEAVY, BODY, wireDir: __dirname });
//   em.frame(x,y,w,h,'Product silo: …');
//   em.priceTag(cx,cy,'$500 OFF',{scale:.9});
//   em.blockOrWire('hero', x,y,w,h, ()=>{ /* styled */ }, 'Hero', [{t:'…',s:22,w:800}]);
const fs = require('fs'), path = require('path');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function make(P, cfg = {}) {
  const HEAVY = cfg.HEAVY || "'Open Sans Extrabold','Open Sans','Helvetica Neue',Arial,sans-serif";
  const BODY = cfg.BODY || "'Open Sans','Helvetica Neue',Arial,sans-serif";
  const SEMI = cfg.SEMI || "'Open Sans Semibold','Open Sans','Helvetica Neue',Arial,sans-serif";
  const push = s => P.push(s);
  // wireframe fallback set: work/wireframe-blocks.json = ["hero", ...]
  const wirePath = path.join(cfg.wireDir || '.', 'wireframe-blocks.json');
  const WIRE = new Set(fs.existsSync(wirePath) ? JSON.parse(fs.readFileSync(wirePath, 'utf8')) : []);

  function text(x, y, s, o = {}) {
    const size = o.size || 15, weight = o.weight || 400, fill = o.fill || '#1c252d';
    const fam = o.fam || (weight >= 800 ? HEAVY : weight >= 600 ? SEMI : BODY);
    const ls = o.ls != null ? `letter-spacing="${o.ls}"` : '';
    push(`<text x="${x}" y="${y}" text-anchor="${o.anchor || 'start'}" font-family="${fam}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${ls}${o.sp ? ' xml:space="preserve"' : ''}>${esc(o.upper ? String(s).toUpperCase() : s)}</text>`);
  }
  const rrect = (x, y, w, h, fill, r = 8) => push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`);
  const img = (href, x, y, w, h, mode = 'meet') => push(`<image x="${x}" y="${y}" width="${w}" height="${h}" href="${href}" preserveAspectRatio="xMidYMid ${mode}"/>`);
  function wrap(s, n, max = 3) { const words = String(s).split(' '), lines = []; let cur = ''; for (const w of words) { if ((cur + ' ' + w).trim().length > n) { if (cur) lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } if (cur) lines.push(cur); return lines.slice(0, max); }

  // near-white photo placeholder (reference product shots sit on white), dashed frame
  function frame(x, y, w, h, caption, o = {}) {
    push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${o.fill || '#f4f1ee'}"/>`);
    push(`<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="4" fill="none" stroke="${o.stroke || '#e2ddd7'}" stroke-width="1" stroke-dasharray="5 5"/>`);
    wrap(caption, Math.max(12, Math.round(w / 7)), 3).forEach((ln, i, a) => text(x + w / 2, y + h / 2 + 4 + (i - (a.length - 1) / 2) * 13, ln, { anchor: 'middle', size: 11, fill: o.cap || '#b4aca3' }));
  }
  // big price: $ small-raised, integer big, cents small-raised
  function priceBig(x, y, now, size = 44, fill = '#9e2136') {
    const m = String(now).replace(/^\$/, '').match(/^([\d,]+)\.(\d{2})$/), ip = m ? m[1] : String(now).replace(/^\$/, ''), c = m ? m[2] : '';
    push(`<text x="${x}" y="${y}" font-family="${HEAVY}" font-weight="800" fill="${fill}"><tspan font-size="${size * 0.5}" dy="${-size * 0.42}">$</tspan><tspan font-size="${size}" dy="${size * 0.42}">${ip}</tspan><tspan font-size="${size * 0.5}" dy="${-size * 0.42}">${c}</tspan></text>`);
  }
  // pointed price-tag (rounded body + point + punched hole), AUTO-SIZED to label
  function priceTag(cx, cy, label, o = {}) {
    const scale = o.scale || 1, rot = o.rot != null ? o.rot : -9, fill = o.fill || '#9e2136';
    const fs2 = 19 * scale, h = 50 * scale, r = 11 * scale, pt = 26 * scale, hole = 16 * scale;
    const textW = String(label).length * fs2 * 0.60, bodyW = hole + 14 * scale + textW + 12 * scale, w = bodyW + pt;
    const x = cx - w / 2, y = cy - h / 2;
    const d = `M ${x + r} ${y} H ${x + bodyW} L ${x + bodyW + pt} ${y + h / 2} L ${x + bodyW} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
    push(`<g transform="rotate(${rot} ${cx} ${cy})"><path d="${d}" fill="${fill}"/><circle cx="${x + hole}" cy="${y + h / 2}" r="${5.5 * scale}" fill="#fff"/></g>`);
    push(`<g transform="rotate(${rot} ${cx} ${cy})">`); text(x + hole + 14 * scale + textW / 2, cy + fs2 * 0.34, label, { anchor: 'middle', size: fs2, weight: 800, fill: '#fff' }); push(`</g>`);
  }
  // ---- wireframe fallback -------------------------------------------------
  function wireBox(x, y, w, h, title, lines) {
    push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#ffffff"/>`);
    push(`<rect x="${x + 1.5}" y="${y + 1.5}" width="${w - 3}" height="${h - 3}" rx="8" fill="none" stroke="#c7c1ba" stroke-width="1.5" stroke-dasharray="8 6"/>`);
    text(x + 16, y + 24, '⛞ ' + title, { size: 11, weight: 600, fill: '#b0a89f' });
    const cy = y + h / 2 - ((lines.length - 1) * 34) / 2 + 6;
    lines.forEach((ln, i) => text(x + w / 2, cy + i * 34, ln.t, { anchor: 'middle', size: ln.s || 22, weight: ln.w || 700, fill: '#5c5650' }));
  }
  // route a styled block through the gate: flagged id => wireframe, else styled
  function blockOrWire(id, x, y, w, h, styledFn, title, lines) {
    if (WIRE.has(id)) { wireBox(x, y, w, h, title, lines); return true; }
    styledFn(); return false;
  }
  return { text, rrect, img, wrap, frame, priceBig, priceTag, wireBox, blockOrWire, WIRE, esc };
}
module.exports = { make, esc };
