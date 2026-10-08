#!/usr/bin/env node
/**
 * Write a scapeshift outdoor sheet to disk: `node scripts/out-sheet.mjs <index|flora|structures> [out.html] [--seed N] [--kit id]`.
 * The sheets are pure string builders (era/out-*-html.js); this only writes one where a browser can open it.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2), flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const seed = flag('--seed'), kitId = flag('--kit');
const [name = 'structures', out = `out-${name}.html`] = args;
const SHEETS = {
  index: async (o) => (await import('../lib/graph/era/out-index-html.js')).outIndexHtml(o),
  flora: async (o) => (await import('../lib/graph/era/out-flora-html.js')).outFloraHtml(o),
  structures: async (o) => (await import('../lib/graph/era/out-structures-html.js')).outStructuresHtml(o),
};
if (!SHEETS[name]) { console.error(`out-sheet: '${name}' is not a sheet (${Object.keys(SHEETS).join(', ')})`); process.exit(1); }
const opts = { ...(seed ? { seed: Number(seed) } : {}), ...(kitId ? { kitId } : {}) };
const html = await SHEETS[name](opts);
writeFileSync(resolve(out), html);
console.log(`${resolve(out)} (${Math.round(html.length / 1024)} KB)`);
