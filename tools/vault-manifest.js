#!/usr/bin/env node
// vault-manifest.js — inventory of everything the vault DOESN'T commit.
//
// The vault repos track knowledge (brand kits, link maps, notes) but ignore
// the heavy restorable stuff: binary artwork, raw catalog dumps, the graphify
// index. That keeps clones small, but a fresh clone is then silently missing
// files the creative skills expect. This tool writes a committed manifest of
// those files so `vault-setup` can tell you exactly what's absent and how to
// get it back — instead of a skill failing later on a missing photo.
//
// The ignored set is taken from git itself (`git ls-files -o -i`), so the
// manifest can never drift from .gitignore.
//
// Usage:
//   node vault-manifest.js --vault <path>            # write <vault>/ASSETS.json
//   node vault-manifest.js --vault <path> --check    # compare manifest to disk
//   node vault-manifest.js --vault <path> --out <f>  # custom manifest path
//
// --check exits 1 if anything in the manifest is missing from disk, so it
// doubles as a gate at the top of a run.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d; };
const has = n => process.argv.includes('--' + n);

const VAULT = path.resolve(arg('vault', '.'));
const OUT = path.resolve(arg('out', path.join(VAULT, 'ASSETS.json')));
const CHECK = has('check');

// Regenerable wholesale by another skill — listing every file would be noise.
const SKIP_PREFIX = ['graphify-out/'];

const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);

// How a missing file comes back. Raw scrape dumps are re-fetchable from the
// live store; artwork is not derivable from anything and has to be restored
// from wherever the originals live.
function origin(rel) {
  if (/\/scrapes\//.test(rel)) return 'rescrape';
  return 'manual';
}

// Group by brand kit where possible, so the report reads per-brand.
function group(rel) {
  const m = /^(.*Brands\/[^/]+)\//.exec(rel);
  return m ? m[1] : '(vault)';
}

function ignoredFiles() {
  const out = execFileSync('git', ['ls-files', '-o', '-i', '--exclude-standard', '-z'],
    { cwd: VAULT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out.split('\0').filter(Boolean)
    .filter(r => !SKIP_PREFIX.some(p => r.startsWith(p)))
    .filter(r => path.resolve(VAULT, r) !== OUT);
}

if (CHECK) {
  if (!fs.existsSync(OUT)) { console.error(`no manifest at ${OUT} — run without --check first`); process.exit(1); }
  const man = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const missing = [], changed = [];
  for (const f of man.files) {
    const abs = path.join(VAULT, f.path);
    if (!fs.existsSync(abs)) { missing.push(f); continue; }
    if (fs.statSync(abs).size !== f.bytes) changed.push(f);
  }
  const present = man.files.length - missing.length;
  console.log(`manifest: ${man.files.length} restorable file(s) — ${present} present, ${missing.length} missing, ${changed.length} size-changed`);
  if (missing.length) {
    const by = {};
    for (const f of missing) (by[f.group] ??= []).push(f);
    console.log('\nMISSING:');
    for (const g of Object.keys(by).sort()) {
      const rescrape = by[g].filter(f => f.origin === 'rescrape').length;
      console.log(`  ${g}  (${by[g].length} file(s)${rescrape ? `, ${rescrape} re-scrapable` : ''})`);
      for (const f of by[g].slice(0, 12)) console.log(`      [${f.origin}] ${path.basename(f.path)}  ${(f.bytes / 1048576).toFixed(1)}MB`);
      if (by[g].length > 12) console.log(`      ... and ${by[g].length - 12} more`);
    }
  }
  if (changed.length) { console.log('\nSIZE-CHANGED (local differs from manifest):'); for (const f of changed) console.log(`  ${f.path}`); }
  process.exit(missing.length ? 1 : 0);
}

const files = ignoredFiles().map(rel => {
  const abs = path.join(VAULT, rel);
  const st = fs.statSync(abs);
  return { path: rel, bytes: st.size, sha256: sha(abs), origin: origin(rel), group: group(rel) };
}).sort((a, b) => a.path.localeCompare(b.path));

const total = files.reduce((s, f) => s + f.bytes, 0);
fs.writeFileSync(OUT, JSON.stringify({
  note: 'Files the vault deliberately does not commit. Restore with the `vault-setup` skill; regenerate the graphify index with `graphify`.',
  generated_from: 'git ls-files -o -i --exclude-standard',
  files_total: files.length,
  bytes_total: total,
  files,
}, null, 2) + '\n');

console.log(`wrote ${path.relative(VAULT, OUT)} — ${files.length} file(s), ${(total / 1048576).toFixed(1)}MB not committed`);
const byOrigin = files.reduce((a, f) => (a[f.origin] = (a[f.origin] || 0) + 1, a), {});
for (const [k, v] of Object.entries(byOrigin)) console.log(`  ${k}: ${v}`);
