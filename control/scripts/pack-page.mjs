#!/usr/bin/env node
// pack-page — a World page made smaller, nothing in it cut (lib/graph/scene/page-pack.js).
//
//   node scripts/pack-page.mjs <page.html>                       → <page>.packed.html beside it: one file, its script gzipped
//   node scripts/pack-page.mjs <page.html> --parts [bytes]       → <page>.bundle/: index.html and its script in gzipped
//                                                                  parts of at most `bytes` (12 MB by default), for a
//                                                                  host that limits a file's size; serve the folder
//   --out <path>   where to write (a file for the one-file form, a folder for the parts)
//   --json         print what was written as JSON (an agent reads it: the files and their sizes)
import fs from 'node:fs';
import path from 'node:path';
import { packPage, bundlePage, PAGE_PACK } from '../lib/graph/scene/page-pack.js';

const args = process.argv.slice(2), flag = (k) => args.includes(k), val = (k) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null; };
const src = args.find((a) => !a.startsWith('--') && a !== val('--out') && a !== val('--parts'));
if (!src || flag('--help')) { console.log('usage: node scripts/pack-page.mjs <page.html> [--parts [bytes]] [--out <path>] [--json]'); process.exit(src ? 0 : 1); }
const html = fs.readFileSync(src, 'utf8'), base = src.replace(/\.html?$/i, ''), mb = (n) => `${(n / 1e6).toFixed(1)} MB`;
let report;
if (flag('--parts')) {
  const partBytes = Number(val('--parts')) || PAGE_PACK.partBytes, dir = val('--out') || `${base}.bundle`;
  const B = bundlePage(html, { partBytes, name: path.basename(base).replace(/[^a-z0-9-]/gi, '-') || 'world' });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), B['index.html']);
  for (const [k, v] of Object.entries(B.files)) fs.writeFileSync(path.join(dir, k), v);
  report = { form: 'parts', dir, was: Buffer.byteLength(html), bytes: B.manifest.bytes, files: [{ path: 'index.html', bytes: Buffer.byteLength(B['index.html']) }, ...Object.entries(B.files).map(([k, v]) => ({ path: k, bytes: v.length }))] };
} else {
  const out = val('--out') || `${base}.packed.html`, packed = packPage(html);
  fs.writeFileSync(out, packed);
  report = { form: 'file', file: out, was: Buffer.byteLength(html), bytes: Buffer.byteLength(packed) };
}
if (flag('--json')) console.log(JSON.stringify(report, null, 2));
else console.log(report.form === 'file' ? `${report.file}: ${mb(report.was)} → ${mb(report.bytes)}` : `${report.dir}: ${mb(report.was)} → ${mb(report.bytes)} in ${report.files.length} files (${report.files.map((f) => `${f.path} ${mb(f.bytes)}`).join(', ')})`);
