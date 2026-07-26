#!/usr/bin/env node
// catalog-fetch.js — exhaustively re-fetch a brand's product catalog.
//
// The vault commits the DERIVED catalog (products.json) but not the raw store
// dump (scrapes/shopify-products.json), which runs past 60MB on a large brand.
// This tool rebuilds the raw dump from the live storefront and refreshes the
// derived catalog from it. It paginates to exhaustion — it stops only on an
// empty page, never on a page count — because a truncated catalog silently
// yields "product not found" later, which is worse than a slow run.
//
// Categories are NOT hardcoded: the existing products.json is the source of
// truth for how this brand buckets things. Known handles keep their category;
// new ones inherit the bucket most common for their product_type, else "other".
// So the tool carries no brand-specific knowledge of its own.
//
// Usage:
//   node catalog-fetch.js --kit <brand-kit-dir> [--base-url <url>]
//   node catalog-fetch.js --kit <dir> --raw-only      # rebuild the dump only
//   node catalog-fetch.js --kit <dir> --dry-run       # report, write nothing
//
// Options: --delay <ms> between pages (default 300), --max-pages <n> safety
// stop (default 500 = 125k products).
const fs = require('fs'), path = require('path');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const has = n => process.argv.includes('--' + n);

const KIT = path.resolve(arg('kit', '.'));
const DELAY = +arg('delay', 300), MAX_PAGES = +arg('max-pages', 500);
const RAW_ONLY = has('raw-only'), DRY = has('dry-run');
const RAW = path.join(KIT, 'scrapes', 'shopify-products.json');
const DERIVED = path.join(KIT, 'products.json');

const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── base URL: explicit flag, then the kit, then infer from the link map ──────
function baseUrl() {
  const flag = arg('base-url');
  if (flag) return flag.replace(/\/+$/, '');
  for (const name of ['brand-kit.json', 'brand.json']) {
    const f = path.join(KIT, name);
    if (!fs.existsSync(f)) continue;
    const k = readJSON(f);
    const u = k.store?.base_url || k.store?.website || k.website || k.url;
    if (u) return String(u).replace(/\/+$/, '');
  }
  // Fall back to the most common origin across the curated link map — a kit
  // can carry links without ever stating its own base URL.
  const lm = path.join(KIT, 'link-map.json');
  if (fs.existsSync(lm)) {
    const raw = readJSON(lm);
    const entries = raw.entries || raw;
    const counts = {};
    for (const v of Object.values(entries)) {
      const url = typeof v === 'string' ? v : v?.url;
      if (!url) continue;
      try { const o = new URL(url).origin; counts[o] = (counts[o] || 0) + 1; } catch {}
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (best) return best[0];
  }
  console.error(`cannot resolve a base URL for ${KIT} — pass --base-url`);
  process.exit(1);
}

// ── exhaustive pagination ───────────────────────────────────────────────────
async function fetchAll(base) {
  const all = [], seen = new Set();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${base}/products.json?limit=250&page=${page}`;
    let res, body;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (catalog-fetch)', accept: 'application/json' } });
        if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
        if (!res.ok) { console.error(`page ${page}: HTTP ${res.status} — stopping`); return all; }
        body = await res.json();
        break;
      } catch (e) {
        if (attempt === 3) { console.error(`page ${page}: ${e.message} after 3 attempts — stopping`); return all; }
        await sleep(DELAY * 4 * attempt);
      }
    }
    const batch = body?.products || [];
    if (!batch.length) { process.stdout.write(`\n  exhausted at page ${page} (empty)\n`); return all; }
    // A store that ignores ?page= would replay page 1 forever — detect it.
    const fresh = batch.filter(p => !seen.has(p.id));
    if (!fresh.length) { process.stdout.write(`\n  page ${page} repeated earlier products — stopping\n`); return all; }
    for (const p of fresh) { seen.add(p.id); all.push(p); }
    process.stdout.write(`\r  page ${page}: ${all.length} products`);
    if (batch.length < 250) { process.stdout.write(`\n  exhausted at page ${page} (short page)\n`); return all; }
    await sleep(DELAY);
  }
  console.error(`\nhit --max-pages ${MAX_PAGES}; catalog may be truncated`);
  return all;
}

// ── derive products.json, learning the category scheme from the current one ──
function derive(raw, base, prev) {
  const byHandle = new Map(prev.map(p => [p.handle, p]));
  // product_type -> most common existing category, learned from prev
  const votes = {};
  for (const p of prev) {
    if (!p.type || !p.category) continue;
    const c = (votes[p.type] ??= {});
    c[p.category] = (c[p.category] || 0) + 1;
  }
  const typeCategory = {};
  for (const [type, c] of Object.entries(votes)) typeCategory[type] = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];

  return raw.map(p => {
    const existing = byHandle.get(p.handle);
    const skus = [...new Set((p.variants || []).map(v => v.sku).filter(Boolean))];
    // Model numbers appear as a trailing parenthetical on appliance/electronics
    // titles, e.g. "...Steam Clean - White (YWSES3330TW)".
    const mn = /\(([A-Z0-9][A-Z0-9\-\/.]{3,})\)\s*$/.exec(p.title || '');
    return {
      name: p.title,
      url: `${base}/products/${p.handle}`,
      handle: p.handle,
      price: p.variants?.[0]?.price ?? null,
      image: p.images?.[0]?.src ?? null,
      type: p.product_type ?? null,
      category: existing?.category || typeCategory[p.product_type] || 'other',
      model_number: mn ? mn[1] : null,
      skus,
    };
  });
}

(async () => {
  const base = baseUrl();
  console.log(`catalog-fetch: ${path.basename(KIT)} <- ${base}`);
  const raw = await fetchAll(base);
  if (!raw.length) { console.error('no products fetched — leaving existing files untouched'); process.exit(1); }

  const prev = fs.existsSync(DERIVED) ? readJSON(DERIVED) : [];
  const prevHandles = new Set(prev.map(p => p.handle));
  const nowHandles = new Set(raw.map(p => p.handle));
  const added = [...nowHandles].filter(h => !prevHandles.has(h));
  const removed = [...prevHandles].filter(h => !nowHandles.has(h));

  console.log(`\nfetched ${raw.length} products (was ${prev.length}): +${added.length} new, -${removed.length} gone`);
  if (DRY) { console.log('--dry-run: nothing written'); return; }

  fs.mkdirSync(path.dirname(RAW), { recursive: true });
  fs.writeFileSync(RAW, JSON.stringify(raw, null, 2) + '\n');
  console.log(`wrote ${path.relative(KIT, RAW)} (${(fs.statSync(RAW).size / 1048576).toFixed(1)}MB, gitignored)`);

  if (RAW_ONLY) { console.log('--raw-only: products.json left as-is'); return; }
  const out = derive(raw, base, prev);
  const uncategorized = out.filter(p => p.category === 'other').length;
  fs.writeFileSync(DERIVED, JSON.stringify(out, null, 2) + '\n');
  console.log(`wrote products.json (${out.length} products, ${uncategorized} in "other")`);
  if (added.length) console.log(`  review the ${added.length} new product(s) for correct category bucketing`);
})();
