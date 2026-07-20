#!/usr/bin/env node
// CLI validator for design-email's Stage 1 output.
// Usage: node checkemailspec.js <path-to-email_spec.json>

const fs = require("fs");
const path = require("path");
const { validate } = require("./lib/emailspec.js");

const target = process.argv[2];
if (!target) {
  console.error("Usage: node checkemailspec.js <path-to-email_spec.json>");
  process.exit(2);
}

let raw;
try {
  raw = fs.readFileSync(path.resolve(target), "utf8");
} catch (e) {
  console.error(`Could not read ${target}: ${e.message}`);
  process.exit(2);
}

let spec;
try {
  spec = JSON.parse(raw);
} catch (e) {
  console.error(`Invalid JSON in ${target}: ${e.message}`);
  process.exit(1);
}

const { valid, errors } = validate(spec);
if (valid) {
  console.log("OK");
  process.exit(0);
} else {
  console.error(`INVALID (${errors.length} issue${errors.length === 1 ? "" : "s"}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
