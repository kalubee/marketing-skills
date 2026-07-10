#!/usr/bin/env node
// check.js — repo gate: sanitization sweep + skill structure checks.
// Usage: node scripts/check.js   (exit 1 on any finding)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SELF = 'scripts/check.js'
const findings = []

// --- 1. banned content: client names, people, origin, addresses, key shapes ---
const BANNED = [
  /dufresne/i, /\barctic\b/i, /sleep\s*shop/i, /mackenzie/i,
  /tenth(and|\s*(and|&)\s*)maple/i,
  /\balyssa\b/i, /\bleanne\b/i, /\bviolet\b/i, /\bDom\b/, /\bepsilon\b/i, /\bdrsg\b/i,
  /kaleb/i, /reimer/i, /winnipeg/i, /commerce\s+dr/i,
  /piper/i, /scrapling/i, /009a44/i, /00b050/i,
  /\bgho_[A-Za-z0-9]{8,}/, /\bsk-[A-Za-z0-9]{8,}/, /\bghp_[A-Za-z0-9]{8,}/,
]
const TEXT_EXT = new Set(['.md', '.js', '.json', '.txt', '.html', '.svg', '.yml', '.yaml', '.sh'])
const SKIP_DIRS = new Set(['.git', 'node_modules', '.superpowers'])
const MAX_BYTES = 500 * 1024

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) yield* walk(p)
    else yield { path: p, size: st.size }
  }
}

for (const f of walk(ROOT)) {
  const rel = relative(ROOT, f.path)
  if (f.size > MAX_BYTES) findings.push(`${rel}: ${Math.round(f.size / 1024)}KB exceeds 500KB cap`)
  if (rel === SELF || !TEXT_EXT.has(extname(f.path))) continue
  const lines = readFileSync(f.path, 'utf8').split('\n')
  for (const re of BANNED) {
    lines.forEach((line, i) => {
      if (re.test(line)) findings.push(`${rel}:${i + 1}: banned pattern ${re} — ${line.trim().slice(0, 80)}`)
    })
  }
}

// --- 2. skill structure ---
const skillsDir = join(ROOT, 'skills')
if (existsSync(skillsDir)) {
  for (const id of readdirSync(skillsDir)) {
    const dir = join(skillsDir, id)
    if (!statSync(dir).isDirectory()) continue
    const sm = join(dir, 'SKILL.md')
    if (!existsSync(sm)) { findings.push(`skills/${id}: missing SKILL.md`); continue }
    const text = readFileSync(sm, 'utf8')
    const fm = /^---\n([\s\S]*?)\n---/.exec(text)
    if (!fm) { findings.push(`skills/${id}/SKILL.md: missing frontmatter`); continue }
    const name = /(?:^|\n)name:\s*(\S+)/.exec(fm[1])?.[1]
    const desc = /(?:^|\n)description:\s*(\S[^\n]*)/.exec(fm[1])?.[1]
    if (id !== '_TEMPLATE' && name !== id) findings.push(`skills/${id}/SKILL.md: frontmatter name "${name}" != folder name`)
    if (!desc) findings.push(`skills/${id}/SKILL.md: missing description`)
    else if (id !== '_TEMPLATE' && !/use when/i.test(text)) findings.push(`skills/${id}/SKILL.md: no "Use when" trigger`)
    for (const m of text.matchAll(/(?:\$TOOLS|tools)\/([a-z-]+\.js)/g)) {
      if (!existsSync(join(ROOT, 'tools', m[1]))) findings.push(`skills/${id}/SKILL.md: references missing tools/${m[1]}`)
    }
  }
}

if (findings.length) {
  console.error(findings.join('\n'))
  console.error(`\n${findings.length} finding(s)`)
  process.exit(1)
}
console.log('check: clean')
