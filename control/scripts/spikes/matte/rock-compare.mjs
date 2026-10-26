#!/usr/bin/env node
/**
 * SPIKE: the matte painter against the rock primitive (polygonizer/rock-fracture.js). One stone at a time, four ways:
 *   today      the painter's own relief and paint (lib/graph/matte-paint)
 *   grains     the painter's relief, coloured by the rock's mineral grains on the face's plane
 *   dressed    a rock field on a box base (`base: 'box'`): the box's faces stay flat, the rock's chips take its arrises
 *              and corners
 *   natural    the rock field alone, face-on: what a cliff or a rock on a road would start from
 * Each face's height is sphere-traced from the 3D field along the view axis, lit by matte-paint/light.js, and painted
 * from a cube ramp (the grain's brightness shifts the stop) or from the grains' own colours.
 *
 *   cd control && node scripts/spikes/matte/rock-compare.mjs  → ../lite-template/integration/1020/spike-output/matte/rock-compare.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { rockField } = await import('../../../lib/graph/polygonizer/rock-fracture.js');
const { reliefField } = await import('../../../lib/graph/matte-paint/relief.js');
const { lightRelief } = await import('../../../lib/graph/matte-paint/light.js');
const { rampAt, paintRelief } = await import('../../../lib/graph/matte-paint/paint.js');
const { paintSurface, readMatte } = await import('../../../lib/graph/matte-paint/index.js');
const { encodePngRgba } = await import('../../../lib/graph/landscape/surface-textures.js');
const { readGeocube, geocubeRamps } = await import('../../../lib/graph/era/geocube.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1020/spike-output/matte');
mkdirSync(outDir, { recursive: true });
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => (typeof c === 'string' ? c : `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`);
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const LIGHT = readMatte({ outline: { shape: 'block', w: 1, h: 1 }, paint: { ramp: ['#000000', '#ffffff'] } }).light;

const SANDSTONE = { modes: [['quartz', 0.72], ['orthoclase', 0.16], ['calcite', 0.12]], grain: 0.0012, colors: { quartz: '#cdb995', orthoclase: '#b98d68', calcite: '#ddd2b9' } };
const STONES = [
  { name: 'granite', rock: 'granite', cube: 'gothic-night' },
  { name: 'sandstone', rock: SANDSTONE, cube: 'valley-morning' },
];
const W_M = 1.2, H_M = 0.6, D_M = 0.5, PPM = 200, px = 1 / PPM;

// a box's exact signed distance (negative inside), half extents b
const sdBox = (p, b) => { const q = p.map((v, i) => Math.abs(v) - b[i]), o = Math.hypot(...q.map((v) => Math.max(v, 0))); return o + Math.min(Math.max(q[0], q[1], q[2]), 0); };

/** Sphere-trace a field along +y from y0 for each texel of a face spanning [x0, x1] × [z0, z1] (z up; image y down).
 * → a matte field { W, H, px, height, inside } and the hit points (null where the ray found nothing). */
function traceFace(D, x0, x1, z0, z1, y0, y1) {
  const W = Math.round((x1 - x0) * PPM), H = Math.round((z1 - z0) * PPM), height = new Float32Array(W * H), inside = new Float32Array(W * H), hits = new Array(W * H).fill(null);
  let evals = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = x0 + (i + 0.5) * px, z = z1 - (j + 0.5) * px, k = j * W + i;
    let y = y0, hit = false;
    for (let s = 0; s < 96 && y < y1; s++) { const d = D([x, y, z]); evals++; if (d < 0.0003) { hit = true; break; } y += Math.max(d * 0.8, 0.0004); }
    if (hit) { height[k] = -(y - y0); inside[k] = 1; hits[k] = [x, y, z]; } else { height[k] = -(y1 - y0); inside[k] = -1; }
  }
  return { field: { W, H, px, height, inside }, hits, evals };
}

/** The painter's own paint layers (mottle, damp, dirt) over a lit field, the grain's brightness folded into the value. */
function paintLayers(field, lit, grainOf, { ramp, mean, dirt }) {
  const mL = lum(mean), value = Float32Array.from(lit.value, (v, k) => (field.inside[k] > 0 ? v + (lum(grainOf(k)) / mL - 1) * 0.6 : v));
  const P = readMatte({ outline: { shape: 'block', w: 1, h: 1 }, paint: { ramp: ramp.map(toHex), dirt: { ramp: dirt.map(toHex) }, fleck: false } }).paint;
  return `data:image/png;base64,${encodePngRgba(paintRelief(field, { ...lit, value }, P, { grit: 0.7, seed: 7 }), field.W, field.H).toString('base64')}`;
}

/** Paint a lit field: from the cube ramp, the grain's brightness against the rock's mean shifting the stop; or from the
 * grains' own colours under the light. */
function paintLit(field, lit, grainOf, { ramp, mean, own = false }) {
  const { W, H, inside } = field, out = Buffer.alloc(W * H * 4), mL = lum(mean);
  for (let k = 0; k < W * H; k++) {
    if (inside[k] <= 0) continue;
    const g = grainOf(k), v = lit.value[k];
    const c = own ? g.map((x) => clamp(x * (0.55 + 0.45 * v) * (0.6 + 0.4 * v), 0, 255))
      : rampAt(ramp, 0.5 + (v - 1) * 0.9 + (lum(g) / mL - 1) * 0.55);
    out[k * 4] = Math.round(c[0]); out[k * 4 + 1] = Math.round(c[1]); out[k * 4 + 2] = Math.round(c[2]); out[k * 4 + 3] = 255;
  }
  return `data:image/png;base64,${encodePngRgba(out, W, H).toString('base64')}`;
}

const rows = [];
for (const S of STONES) {
  const R = geocubeRamps(readGeocube(S.cube)), rampOf = (n) => R[n].map((c) => (typeof c === 'string' ? hex(c) : c)), ramp = rampOf('stone'), dirt = rampOf('floor'), cells = [];
  const time = (label, f) => { const t0 = Date.now(), r = f(); cells.push({ label, ...r, ms: Date.now() - t0 }); };
  // today: the painter as it ships
  time('today: the painter', () => ({ url: paintSurface({ outline: { shape: 'block', w: W_M, h: H_M }, ppm: PPM, seed: 7, grit: 0.7, paint: { ramp: ramp.map(toHex) } }).url }));
  // grains: the painter's relief, the rock's grains on the face plane
  time('grains: painter relief, mineral colour', () => {
    const M = readMatte({ outline: { shape: 'block', w: W_M, h: H_M }, ppm: PPM, seed: 7, grit: 0.7, relief: { pit: false }, paint: { ramp: ['#000000', '#ffffff'] } });
    const f = reliefField({ outline: M.outline, ppm: PPM, relief: M.relief, grit: 0.7, seed: 7 }), lit = lightRelief(f, LIGHT);
    const rf = rockField({ size: 2, unit: 'm', rock: S.rock, seed: 7, octaves: 0 }), mean = hex(rf.meanColor);
    const grainOf = (k) => { const i = k % f.W, j = Math.floor(k / f.W); return hex(rf.colorAt([-W_M / 2 + (i + 0.5) * px, -0.3, H_M / 2 - (j + 0.5) * px], px)); };
    return { url: paintLit(f, lit, grainOf, { ramp, mean }) };
  });
  // dressed: the rock field on a box base (rock-fracture.js `base: 'box'`): the box's faces are the block, the chips find
  // its arrises and corners
  const rf = rockField({ size: W_M, unit: 'm', rock: S.rock, seed: 7, octaves: 4, aspect: [1, D_M / W_M, H_M / W_M], base: 'box', chipScale: Number(process.env.CHIP ?? 0.4), edgeChip: 1 }), mean = hex(rf.meanColor);
  const dressed = rf.d;
  let dressedTrace;
  time(`dressed: box-based rock, chipScale ${process.env.CHIP ?? 0.4} (cube ramp + paint layers)`, () => {
    dressedTrace = traceFace(dressed, -W_M / 2 - 0.02, W_M / 2 + 0.02, -H_M / 2 - 0.02, H_M / 2 + 0.02, -D_M / 2 - 0.01, -D_M / 2 + 0.12);
    const lit = lightRelief(dressedTrace.field, LIGHT);
    const grainOf = (k2) => hex(rf.colorAt(dressedTrace.hits[k2], px));
    return { url: paintLayers(dressedTrace.field, lit, grainOf, { ramp, mean, dirt }), note: `${(dressedTrace.evals / 1e3).toFixed(0)}k field evals` };
  });
  time('dressed: the minerals\' own colour', () => {
    const lit = lightRelief(dressedTrace.field, LIGHT);
    return { url: paintLit(dressedTrace.field, lit, (k2) => hex(rf.colorAt(dressedTrace.hits[k2], px)), { ramp, mean, own: true }) };
  });
  // natural: the rock alone, face-on
  time('natural: the rock face-on (+ paint layers)', () => {
    const nf = rockField({ size: 1.0, unit: 'm', rock: S.rock, seed: 11, octaves: 4, aspect: [1, 0.7, 0.6] }), b = nf.bounds;
    const T = traceFace(nf.d, b.min[0], b.max[0], b.min[2], b.max[2], b.min[1] - 0.01, b.max[1]);
    const lit = lightRelief(T.field, { ...LIGHT, reach: 0.12 });
    return { url: paintLayers(T.field, lit, (k2) => hex(nf.colorAt(T.hits[k2], px)), { ramp, mean: hex(nf.meanColor), dirt }), note: `${(T.evals / 1e3).toFixed(0)}k field evals` };
  });
  rows.push({ S, cells });
  console.log(S.name, cells.map((c) => `${c.label}: ${c.ms} ms`).join(' · '));
}
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px 16px;background:#4e4b46;color:#eee;font:13px system-ui}h2{font-size:14px;margin:12px 0 6px;color:#d8d2c6}.row{display:flex;gap:12px;align-items:flex-start}figure{margin:0}img{display:block;width:250px}figcaption small{display:block;color:#bdb6aa}</style>
<h1 style="font-size:15px;margin:0">matte painter vs the rock primitive · 1.2 × 0.6 m · ${PPM} px/m · light from the upper left</h1>
${rows.map(({ S, cells }) => `<h2>${S.name} (${S.cube}'s stone ramp)</h2><div class=row>${cells.map((c) => `<figure><img src="${c.url}"><figcaption>${c.label}<small>${c.ms} ms${c.note ? ` · ${c.note}` : ''}</small></figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, 'rock-compare.html'), page);
const browser = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await browser.newPage(); await p.setViewport({ width: 1340, height: 560 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, 'rock-compare.png'), await p.screenshot({ type: 'png', fullPage: true })); } finally { await browser.close(); }
console.log('→', path.join(outDir, 'rock-compare.png'));
