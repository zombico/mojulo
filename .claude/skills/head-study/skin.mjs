#!/usr/bin/env node
// head-study --skin — the epidermis cube's SKIN studied on SWATCHES before the head: blocks of skin a few mm across,
// gently domed, lit gray under a raking light with the cavities shaded (epidermis/skin-relief.js). Rows:
//
//   the sequence     one cheek swatch over the lateral orbital rim, layer by layer: form → creases (crow's feet
//                    fanning across the rim) → keratin (the furrow network) → pores (at its junctions) → micro (the
//                    fine net, the grain, the sheen)
//   the regions      forehead, cheek, nose, eyelid, chin at full fidelity
//   age              the crow's-feet swatch at ages 0, ⅓, ⅔, 1, and ⅔ in a squint
//   along a tether   lines beside a tether (under-eye, forehead), and close-ups of pores (cheek, nose)
//
//   node .claude/skills/head-study/skin.mjs [--seed N] [--out dir]
//
// Then Read <out>/sheet.png (default /tmp/head-study-skin). Each panel's bar is 1 mm.
import { writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const sharp = createRequire(path.join(REPO, 'control/package.json'))('sharp');
const { skinRelief } = await import(path.join(REPO, 'control/lib/graph/epidermis/skin-relief.js'));

const args = process.argv.slice(2);
let out = '/tmp/head-study-skin', seed = 1;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') { out = args[++i]; continue; }
  if (args[i] === '--seed') { seed = Number(args[++i]); continue; }
  if (args[i] === '--skin') continue;
  console.error(`head-study --skin: unknown argument "${args[i]}"`);
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const PX = 400, BG = '#e9e7e3';
// the light: raking from the upper left, low; the eye straight on
const L = (() => { const v = [-0.62, 0.5, 0.42], l = Math.hypot(...v); return v.map((x) => x / l); })();
const Hv = (() => { const v = [L[0], L[1], L[2] + 1], l = Math.hypot(...v); return v.map((x) => x / l); })();

// a swatch `size` mm across, domed (a 60 mm radius), its relief from `spec`
async function swatch(spec, size = 14) {
  const relief = skinRelief({ seed, ...spec });
  const N = PX + 2, d = size / PX, h = new Float64Array(N * N), rough = new Float64Array(N * N), c = size / 2;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = (i - 1) * d, v = (j - 1) * d, r = relief.at(u, v);
    h[j * N + i] = r.h - ((u - c) ** 2 + (v - c) ** 2) / 120;
    rough[j * N + i] = r.rough;
  }
  // the cavities: the height below its neighbourhood's mean (a summed-area box of ~0.25 mm) darkens
  const S = new Float64Array((N + 1) * (N + 1));
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) S[(j + 1) * (N + 1) + i + 1] = h[j * N + i] + S[j * (N + 1) + i + 1] + S[(j + 1) * (N + 1) + i] - S[j * (N + 1) + i];
  const rb = Math.max(1, Math.round(0.25 / d));
  const mean = (i, j) => {
    const i0 = Math.max(0, i - rb), i1 = Math.min(N, i + rb + 1), j0 = Math.max(0, j - rb), j1 = Math.min(N, j + rb + 1);
    return (S[j1 * (N + 1) + i1] - S[j0 * (N + 1) + i1] - S[j1 * (N + 1) + i0] + S[j0 * (N + 1) + i0]) / ((i1 - i0) * (j1 - j0));
  };
  const img = Buffer.alloc(PX * PX * 3);
  for (let j = 1; j <= PX; j++) for (let i = 1; i <= PX; i++) {
    const o = j * N + i;
    const dx = (h[o + 1] - h[o - 1]) / (2 * d), dy = (h[o + N] - h[o - N]) / (2 * d), nl = Math.hypot(dx, dy, 1);
    const n = [-dx / nl, -dy / nl, 1 / nl];
    const diff = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
    const ro = rough[o], spec = (1 - ro) * 0.3 * Math.pow(Math.max(0, n[0] * Hv[0] + n[1] * Hv[1] + n[2] * Hv[2]), 8 + 140 * (1 - ro) ** 2);
    const cav = Math.max(0.55, Math.min(1.08, 1 + (h[o] - mean(i, j)) * 9));
    const g = Math.max(0, Math.min(1, 0.72 * (0.16 + 0.84 * diff) * cav + spec));
    const p = ((PX - j) * PX + (i - 1)) * 3;   // +v up
    img[p] = img[p + 1] = img[p + 2] = Math.round(255 * Math.pow(g, 1 / 1.1));
  }
  const png = await sharp(img, { raw: { width: PX, height: PX, channels: 3 } }).png().toBuffer();
  return { png, size, lines: relief.lines.length };
}

// the tethers, in a 14 mm swatch: the lateral orbital rim down its left edge with crow's feet fanning across it from
// the canthus just off the swatch; an under-eye line; a forehead line
const RIM = { kind: 'radial', pivot: { u: -1.5, v: 7.5 }, span: [-38, 38], reach: [2.5, 15], count: 9, depth: 70, path: [{ u: 3, v: 0 }, { u: 2.3, v: 7 }, { u: 3, v: 14 }] };
const UNDER = { kind: 'along', path: [{ u: 0, v: 9.5 }, { u: 7, v: 8.2 }, { u: 14, v: 9.5 }], reach: [0, 5], count: 7, depth: 50 };
const BROW = { kind: 'along', path: [{ u: 0, v: 6.5 }, { u: 7, v: 7.4 }, { u: 14, v: 6.5 }], reach: [0, 6.5], count: 8, depth: 65 };

const ROWS = [
  ['the sequence · cheek over the orbital rim, age ½', [
    ['form', { region: 'cheek', age: 0.5, fidelity: 'form', tethers: [RIM] }],
    ['+ creases (crow’s feet)', { region: 'cheek', age: 0.5, fidelity: 'creases', tethers: [RIM] }],
    ['+ keratin furrows', { region: 'cheek', age: 0.5, fidelity: 'keratin', pores: 0, tethers: [RIM] }],
    ['+ pores at the junctions', { region: 'cheek', age: 0.5, fidelity: 'keratin', tethers: [RIM] }],
    ['+ micro (fine net, grain, sheen)', { region: 'cheek', age: 0.5, fidelity: 'micro', tethers: [RIM] }],
  ]],
  ['the regions · full fidelity, age 0.4', ['forehead', 'cheek', 'nose', 'eyelid', 'chin'].map((r) => [r, { region: r, age: 0.4 }])],
  ['age · crow’s feet over the rim', [
    ...[0, 1 / 3, 2 / 3, 1].map((a) => [`age ${Math.round(a * 100) / 100}`, { region: 'cheek', age: a, tethers: [RIM] }]),
    ['age 0.67 · squint', { region: 'cheek', age: 2 / 3, squint: 1, tethers: [RIM] }],
  ]],
  ['along a tether, and close', [
    ['under-eye lines · eyelid, age 0.5', { region: 'eyelid', age: 0.5, tethers: [UNDER] }],
    ['forehead lines · age 0.6', { region: 'forehead', age: 0.6, tethers: [BROW] }],
    ['forehead lines · age 0.6 · raised', { region: 'forehead', age: 0.6, squint: 1, tethers: [BROW] }],
    ['cheek pores · 5 mm', { region: 'cheek', age: 0.4 }, 5],
    ['nose pores · 5 mm', { region: 'nose', age: 0.4 }, 5],
  ]],
];

const parts = [], HEAD = 34, CAP = 26;
let y = 0;
const t0 = Date.now();
for (const [title, panels] of ROWS) {
  parts.push(`<rect x="0" y="${y}" width="${5 * PX}" height="${HEAD}" fill="#f4f2ee"/><text x="12" y="${y + 23}" font-family="monospace" font-size="17" fill="#333">${title}</text>`);
  y += HEAD;
  for (const [k, [label, spec, size]] of panels.entries()) {
    const s = await swatch(spec, size);
    const x = k * PX, bar = PX / s.size;
    parts.push(`<image x="${x}" y="${y}" width="${PX}" height="${PX}" href="data:image/png;base64,${s.png.toString('base64')}"/>`);
    parts.push(`<rect x="${x + PX - 14 - bar}" y="${y + PX - 16}" width="${bar}" height="4" fill="#222"/>`);
    parts.push(`<rect x="${x}" y="${y + PX}" width="${PX}" height="${CAP}" fill="${BG}"/><text x="${x + 10}" y="${y + PX + 18}" font-family="monospace" font-size="14" fill="#333">${label.replace(/&/g, '&amp;')}</text>`);
  }
  y += PX + CAP;
}
const W = 5 * PX;
writeFileSync(path.join(out, 'sheet.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${y}" width="${W}" height="${y}"><rect width="${W}" height="${y}" fill="${BG}"/>${parts.join('\n')}</svg>`);
const r = spawnSync('node', [path.join(REPO, '.claude/skills/view-svg/rasterize.mjs'), path.join(out, 'sheet.svg'), '--out', out, '--max', '2400'], { cwd: REPO, encoding: 'utf8' });
process.stdout.write(r.stdout || '');
if (r.stderr) process.stderr.write(r.stderr);
console.log(`— head-study --skin: ${ROWS.reduce((m, r) => m + r[1].length, 0)} swatches in ${Date.now() - t0} ms → ${out} (sheet.png)`);
