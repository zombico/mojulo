#!/usr/bin/env node
// Compare two gate-2b reports (lib/mcp/tools/body-routing-eval.integration.test.js): which rows moved, and whether
// the model's answer moved or the fixture's answer key did. Usage:
//   node scripts/body-eval-diff.mjs <before.json> <after.json> [--json]
import { readFileSync } from 'node:fs';
import { diffReports, formatDiff } from '../lib/mcp/routing-cards/eval-diff.js';

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith('--'));
if (files.length !== 2) {
  console.error('usage: node scripts/body-eval-diff.mjs <before.json> <after.json> [--json]');
  process.exit(2);
}
const [a, b] = files.map((f) => JSON.parse(readFileSync(f, 'utf8')));
const d = diffReports(a, b);
console.log(args.includes('--json') ? JSON.stringify(d, null, 2) : formatDiff(d));
