#!/usr/bin/env bash
#
# build-zips.sh — package each skill as a zip for upload to Claude cowork.
#
# Cowork takes one zip per skill. These are built from THIS repo's skills/
# tree, which `scripts/check.js` gates — so whatever ships in a zip has already
# passed the sanitization sweep. Never build cowork zips from a private
# workspace's .claude/skills directly; that bypasses the gate.
#
# Several skills shell out to the shared toolchain (referenced as $TOOLS in
# SKILL.md). That isn't bundled per-skill — it ships once as tools.zip.
#
# Usage:
#   bash scripts/build-zips.sh          # -> dist/skills/*.zip + dist/tools.zip
#   bash scripts/build-zips.sh --check  # verify existing zips are in sync
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/dist"
SKILLS_OUT="$OUT/skills"

command -v zip >/dev/null || { echo "need 'zip' installed" >&2; exit 1; }

# Refuse to package anything the gate hasn't cleared.
node "$ROOT/scripts/check.js" >/dev/null || { echo "check.js failed — not packaging" >&2; exit 1; }

rm -rf "$SKILLS_OUT"
mkdir -p "$SKILLS_OUT"

count=0
shopt -s nullglob
for dir in "$ROOT"/skills/*/; do
  name="$(basename "$dir")"
  [ "$name" = "_TEMPLATE" ] && continue
  # -X drops extra file attributes so rebuilds are byte-stable.
  ( cd "$ROOT/skills" && zip -rqX "$SKILLS_OUT/$name.zip" "$name" \
      -x '*/node_modules/*' '*/.venv*/*' '*/__pycache__/*' '*.pyc' '*/.DS_Store' )
  count=$((count + 1))
done

rm -f "$OUT/tools.zip"
( cd "$ROOT" && zip -rqX "$OUT/tools.zip" tools \
    -x 'tools/node_modules/*' 'tools/.venv*/*' 'tools/__pycache__/*' '*.pyc' '*/.DS_Store' )

echo "built $count skill zip(s) + tools.zip -> dist/"
du -ch "$SKILLS_OUT"/*.zip "$OUT/tools.zip" | tail -1
