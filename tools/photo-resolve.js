#!/usr/bin/env node
// Product-photo resolver for the `product-photos` skill.
//
// Resolves each requested product to a real photo from the BRAND'S OWN
// storefront and saves, when available, two variants: a "pure" silo shot
// (product on a studio sweep) and a "lifestyle" shot (product in a room).
// Which one a tile should use is decided by the brief hint carried in each
// product's `caption` ("use enviro" -> lifestyle, "silo"/default -> pure).
//
// Resolution order per product (never invents a URL):
//   1. a real /products/<handle> URL already in the product's `link`
//   2. an exact-ish match in the brand kit's products.json catalog
//   3. the storefront's predictive-search endpoint (Shopify: /search/suggest.json)
// Carousel comes from the Shopify per-product endpoint (/products/<handle>.json);
// if that isn't available, it falls back to the catalog/search `image` as a
// single silo shot. If nothing resolves, the product is left for a placeholder
// (source:"none") — the consumer renders a placeholder frame for it.
//
// Brand-neutral: the store origin is derived from the kit (or --origin), never
// hardcoded. Requires Node >= 18 (global fetch) and sharp (in tools/).
//
// Usage:
//   node photo-resolve.js --out <dir> (--kit <brand-kit-dir> | --origin <url>) \
//        (--spec <email_spec.json> | --products <list.json>) [--limit 8] [--ua <string>]
//
//   --spec      an email-spec-style file; product-bearing modules (product_row,
//               feature) are extracted automatically.
//   --products  an explicit array of { key, name, link?, caption?, hint?, price? }.
//   --kit       brand-kit dir (its products.json seeds local matches + origin).
//   --out       run dir; writes <out>/photo_manifest.json and <out>/photos/*.jpg

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// ---- args -----------------------------------------------------------------
function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith("--")) a[k.slice(2)] = (argv[i + 1] && !argv[i + 1].startsWith("--")) ? argv[++i] : true;
  }
  return a;
}
const args = parseArgs(process.argv);
function die(msg) { console.error(msg); process.exit(2); }
if (!args.out) die("Usage: node photo-resolve.js --out <dir> (--kit <dir>|--origin <url>) (--spec <f>|--products <f>) [--limit N]");
if (!args.spec && !args.products) die("Provide --spec <email_spec.json> or --products <list.json>");

const OUT = path.resolve(args.out);
const PHOTO_DIR = path.join(OUT, "photos");
fs.mkdirSync(PHOTO_DIR, { recursive: true });
const LIMIT = Number(args.limit) || 8;           // carousel images downloaded per product
const UA = typeof args.ua === "string" ? args.ua : "Mozilla/5.0";

// ---- brand kit / catalog / origin -----------------------------------------
let catalog = [];
if (args.kit) {
  const cp = path.join(path.resolve(args.kit), "products.json");
  if (fs.existsSync(cp)) { try { catalog = JSON.parse(fs.readFileSync(cp, "utf8")); } catch { catalog = []; } }
}
const ORIGIN = (() => {
  if (typeof args.origin === "string") return args.origin.replace(/\/+$/, "");
  const withUrl = catalog.find((p) => p && p.url);
  return withUrl ? new URL(withUrl.url).origin : null;
})();

// ---- input: explicit list or extracted from a spec ------------------------
function priceNum(s) {
  if (!s) return null;
  const m = /([\d]+(?:\.\d{2})?)/.exec(String(s).replace(/,/g, ""));
  return m ? m[1] : null; // keep as "299.88" to compare with storefront price strings
}
function fromSpec(spec) {
  const out = [];
  (spec.modules || []).forEach((m, mi) => {
    if (m.type === "product_row") {
      const hint = (m.headline || "").replace(/starting at.*/i, "").replace(/\$[\d.,]+/g, "").trim();
      (m.products || []).forEach((p, pi) => out.push({
        key: `m${mi}_p${pi}`, name: p.name, link: p.link,
        caption: p.image_caption || "", hint, price: priceNum(p.price_now),
      }));
    } else if (m.type === "feature") {
      out.push({ key: `m${mi}`, name: m.headline, link: m.cta_link,
        caption: m.image_caption || "", hint: "", price: priceNum(m.price_now) });
    }
  });
  return out;
}
let products;
if (args.products) {
  products = JSON.parse(fs.readFileSync(path.resolve(args.products), "utf8"));
  products = products.map((p, i) => ({ key: p.key || `p${i}`, name: p.name, link: p.link,
    caption: p.caption || "", hint: p.hint || "", price: p.price ? priceNum(p.price) : null }));
} else {
  products = fromSpec(JSON.parse(fs.readFileSync(path.resolve(args.spec), "utf8")));
}

// ---- handle resolution ----------------------------------------------------
function handleFromLink(link) {
  if (!link) return null;
  const m = /\/products\/([^/?#]+)/.exec(link);
  return m ? m[1] : null;
}
function localMatch(name) {
  if (!name || !catalog.length) return null;
  const q = name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const head = q.split(" ").slice(0, 2).join(" ");
  const hits = catalog.filter((p) => {
    const n = (p.name || "").toLowerCase();
    return n.startsWith(head) || n.includes(q);
  });
  if (!hits.length) return null;
  hits.sort((a, b) => (a.name || "").length - (b.name || "").length);
  const h = hits[0];
  return { handle: handleFromLink(h.url) || h.handle, url: h.url, title: h.name, price: h.price, image: h.image, source: "catalog" };
}
async function shopifySearch(name, { hint = "", price = null } = {}) {
  if (!ORIGIN || !name) return null;
  // Query with the hint's HEAD NOUN only ("Queen Bed" -> "Bed"); size qualifiers
  // can exclude correctly-priced listings whose title omits them.
  const headNoun = hint ? hint.split(/\s+/).slice(-1)[0] : "";
  const query = (headNoun ? `${name} ${headNoun}` : name).trim();
  const u = `${ORIGIN}/search/suggest.json?q=${encodeURIComponent(query)}` +
            `&resources%5Btype%5D=product&resources%5Blimit%5D=10`;
  try {
    const r = await fetch(u, { headers: { "User-Agent": UA } });
    if (!r.ok) return null;
    const j = await r.json();
    const list = j?.resources?.results?.products || [];
    if (!list.length) return null;
    const model = name.toLowerCase().split(/\s+/)[0];
    const hintWords = hint.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const wantsSet = /\bset\b|\bpiece\b|\bpackage\b/i.test(`${name} ${hint}`);
    const scored = list.map((p, idx) => {
      const t = (p.title || "").toLowerCase();
      let s = 0;
      if (t.includes(model)) s += 5;
      if (price && p.price === price) s += 8;                 // exact brief price wins
      for (const w of hintWords) if (t.includes(w)) s += 3;   // matches category noun(s)
      if (!wantsSet && /\bpiece\b|\bbedroom\b|\bpackage\b|\bset\b/.test(t)) s -= 4; // avoid bundles
      s -= idx * 0.1; s -= t.length * 0.01;                   // relevance + prefer the base item
      return { p, s };
    }).sort((a, b) => b.s - a.s);
    const best = scored[0].p;
    return { handle: best.handle, url: `${ORIGIN}/products/${best.handle}`, title: best.title,
             price: best.price, image: best.image ? String(best.image).split("?")[0] : null,
             source: "search", query, alternates: scored.slice(1, 4).map((x) => `${x.p.handle} ($${x.p.price})`) };
  } catch { return null; }
}
async function resolveHandle(prod) {
  const fromLink = handleFromLink(prod.link);
  if (fromLink) return { handle: fromLink, url: ORIGIN ? `${ORIGIN}/products/${fromLink}` : prod.link, source: "spec-link" };
  return localMatch(prod.name) || (await shopifySearch(prod.name, { hint: prod.hint, price: prod.price }));
}

// ---- carousel + classification --------------------------------------------
async function fetchCarousel(handle) {
  if (!ORIGIN) return [];
  try {
    const r = await fetch(`${ORIGIN}/products/${handle}.json`, { headers: { "User-Agent": UA } });
    if (!r.ok) return [];
    const j = await r.json();
    return (j?.product?.images || []).sort((a, b) => a.position - b.position)
      .map((im) => ({ position: im.position, src: String(im.src).split("?")[0] }));
  } catch { return []; }
}
async function download(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
// "pure" silo = product on a near-white studio sweep. Sample the image border:
// studio shots have a clean bright border, room scenes don't.
async function classify(buf) {
  const N = 48, band = 5;
  const { data } = await sharp(buf).resize(N, N, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0, sumL = 0, sumSat = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!(x < band || x >= N - band || y < band || y >= N - band)) continue;
    const i = (y * N + x) * 3, r = data[i], g = data[i + 1], b = data[i + 2];
    sumL += 0.299 * r + 0.587 * g + 0.114 * b;
    sumSat += Math.max(r, g, b) - Math.min(r, g, b);
    n++;
  }
  return { borderL: Math.round(sumL / n), borderSat: Math.round(sumSat / n) };
}
async function saveResized(buf, file, max = 900) {
  await sharp(buf).resize(max, max, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toFile(file);
}
const wantsLifestyle = (c) => /enviro|environment|lifestyle|\broom\b|in.?situ|setting/i.test(c || "");

// ---- main -----------------------------------------------------------------
// Everything network-bound runs concurrently: products through a small pool
// (polite to the storefront), the carousel downloads within a product all at
// once. Selection/classification logic is unchanged; manifest keeps input order.
const PRODUCT_CONCURRENCY = 4;
async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; results[i] = await fn(items[i]); }
  }));
  return results;
}

async function resolveProduct(prod) {
  const rec = { ...prod, origin: ORIGIN };
  const resolved = await resolveHandle(prod);
  if (!resolved || !resolved.handle) {
    rec.source = "none"; rec.reason = "no handle resolved";
    console.log(`✗ ${prod.name}: no match -> placeholder`); return rec;
  }
  Object.assign(rec, { handle: resolved.handle, url: resolved.url, source: resolved.source, resolvedTitle: resolved.title });
  let carousel = await fetchCarousel(resolved.handle);
  // fallback for non-Shopify / empty: single catalog/search image as a silo shot
  if (!carousel.length && resolved.image) carousel = [{ position: 1, src: resolved.image }];
  if (!carousel.length) {
    rec.source = "none"; rec.reason = "no carousel/image";
    console.log(`✗ ${prod.name}: no image -> placeholder`); return rec;
  }
  const scored = (await Promise.all(carousel.slice(0, LIMIT).map(async (im) => {
    try { const buf = await download(im.src); return { ...im, ...(await classify(buf)), buf }; } catch { return null; }
  }))).filter(Boolean);
  if (!scored.length) {
    rec.source = "none"; rec.reason = "downloads failed";
    console.log(`✗ ${prod.name}: downloads failed -> placeholder`); return rec;
  }
  // pure = earliest studio-class image (merchandiser primary), not the whitest.
  const STUDIO_L = 210, STUDIO_SAT = 22;
  const studio = scored.filter((s) => s.borderL >= STUDIO_L && s.borderSat < STUDIO_SAT).sort((a, b) => a.position - b.position);
  const pure = studio[0] || scored.slice().sort((a, b) => b.borderL - a.borderL)[0];
  const life = scored.filter((s) => s.position !== pure.position && s.borderL < STUDIO_L).sort((a, b) => a.borderL - b.borderL)[0] || null;
  rec.scored = scored.map((s) => ({ position: s.position, borderL: s.borderL, borderSat: s.borderSat }));

  const purePath = path.join(PHOTO_DIR, `${prod.key}_pure.jpg`);
  await saveResized(pure.buf, purePath);
  let lifePath = null;
  if (life) { lifePath = path.join(PHOTO_DIR, `${prod.key}_life.jpg`); await saveResized(life.buf, lifePath); }
  const want = wantsLifestyle(prod.caption);
  const chosen = want && life ? "lifestyle" : "pure";
  Object.assign(rec, {
    carouselCount: carousel.length,
    pure: { src: pure.src, position: pure.position, borderL: pure.borderL, borderSat: pure.borderSat, file: purePath },
    lifestyle: life ? { src: life.src, position: life.position, borderL: life.borderL, borderSat: life.borderSat, file: lifePath } : null,
    wantsLifestyle: want, chosen, chosenFile: chosen === "lifestyle" ? lifePath : purePath,
  });
  console.log(`✓ ${prod.name}  [${resolved.source}] ${resolved.handle}  pure@${pure.position}(L${pure.borderL})` +
              `${life ? ` life@${life.position}(L${life.borderL})` : " life:—"}  -> use ${chosen}`);
  return rec;
}

async function run() {
  const manifest = await mapPool(products, PRODUCT_CONCURRENCY, resolveProduct);
  fs.writeFileSync(path.join(OUT, "photo_manifest.json"), JSON.stringify(manifest, null, 2));
  const filled = manifest.filter((r) => r.source !== "none").length;
  console.log(`\nmanifest -> ${path.join(OUT, "photo_manifest.json")} (${filled}/${manifest.length} resolved)`);
}
run().catch((e) => { console.error(e); process.exit(1); });
