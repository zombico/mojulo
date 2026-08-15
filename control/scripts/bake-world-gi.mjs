#!/usr/bin/env node
/**
 * bake-world-gi.mjs — the world-GI bicycle (a self-documenting loop: machine gate + eyes gate).
 *
 * "Blenderifies" a mojulo world: Blender bakes global illumination offline into the
 * geometry's own vertex colours, which mojulo's UNLIT runtime draws at ZERO runtime
 * cost. The soft contact shadows / ambient occlusion / bounce a bake computes are the
 * performance-FRIENDLY way to have shadows — no runtime shadow map, no per-frame light.
 *
 * ── THE DRIVETRAIN (fixed for every world) ─────────────────────────────────────────
 *   FACING  → stamp `outNormal` (probe + floor rule) so a Cycles bake knows the
 *             presented side (mojulo's double-sided unlit renderer never recorded it).
 *   EXPORT  → facesToGlb({ faces }) → raw-albedo GLB.
 *   BAKE    → bake-world-gi.py: headless Cycles diffuse GI → COLOR_0 (per-archetype preset).
 *   GATE(m) → glbToFaces decode + albedo-aware floor coverage (a lit-paint floor that
 *             baked near-zero is a wrong-facing back-face → refuse, don't ship).
 *   BIND    → (adapter) write the lit result back.
 *   GATE(e) → a flat vertex-colour still + the URL, for the operator.
 *
 * ── THE GEAR ADAPTERS (swappable per world kind) ───────────────────────────────────
 * What differs per world is the two ENDS of the drivetrain — how raw-albedo faces come
 * IN, and how the lit result is written BACK. An adapter declares { match, source, bind }.
 *   • inline-faces   — a frozen `manifest.faces` terrain (MS arena maps). Recolours the
 *                      faces IN PLACE; mapRef mode-variants inherit (map-ref.js). ao→false.
 *   • generated-mesh — a generated world (fractal-city, …). resolveWorldScene → faces,
 *                      bakes, binds the baked mesh and mints a `<ref>_gi` static variant.
 * Add a world kind by adding an adapter object to ADAPTERS — the drivetrain is untouched.
 *
 * Provenance: the recipe stays sovereign; a `giBake` stamp (preset, date, sha256,
 * migration id) makes the bake a re-mintable derived step. `--write` backs the target up
 * to data/backups/ first. Optional, operator-hosted; needs a local Blender.
 *
 * Usage (from control/, repo-dev needs MOJULO_DATA_DIR/MOJULO_OUTCOMES_DIR set):
 *   node scripts/bake-world-gi.mjs --ref sk_ms_hangar_arena --write            # arena (inline-faces)
 *   node scripts/bake-world-gi.mjs --ref sk_city_seed42 --preset exterior --write   # city (generated-mesh)
 *   node scripts/bake-world-gi.mjs --ref <ref> --preview                       # dry run, keep the preview
 */
import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { register } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveMojuloPaths } from './mojulo-paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BLENDER = process.env.MOJULO_BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
const MIGRATION_ID = 'probe+floor-v1';

// ── per-archetype light presets (the middle gear — chosen by the world's look) ──
const PRESETS = {
  'interior-day': { roof_cut: 0.12, samples: 128, ambient: { color: [0.6, 0.66, 0.78], strength: 2.2 }, sun: { energy: 4.0, color: [1, 0.96, 0.9], euler: [0.35, 0.2, 0.3] } },
  'exterior':     { roof_cut: null, samples: 128, ambient: { color: [0.55, 0.62, 0.72], strength: 1.5 }, sun: { energy: 5.0, color: [1, 0.95, 0.85], euler: [0.5, 0.2, 0.4] } },
  'space':        { roof_cut: null, samples: 160, ambient: { color: [0.03, 0.035, 0.05], strength: 0.4 }, sun: { energy: 6.0, color: [1, 0.97, 0.92], euler: [0.5, -0.32, 0.62] } },
  'interior-lit': { roof_cut: null, samples: 160, ambient: { color: [0.16, 0.17, 0.2], strength: 0.5 }, sun: null, lightGrid: { nx: 3, ny: 3, zFrac: 0.62, color: [1, 0.92, 0.78], energyScale: 0.9 } },
};

// generated world kinds the generated-mesh adapter handles (resolveWorldScene → faces).
const GENERATED_KINDS = new Set(['fractal-city', 'fractal-condo', 'condo-complex', 'school-complex', 'dungeon', 'floorplan', 'subway-station', 'subway-building', 'restaurant']);

// ── shared geometry helpers ──
const newell = (c) => { let x = 0, y = 0, z = 0; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]); } const L = Math.hypot(x, y, z) || 1; return [x / L, y / L, z / L]; };
const cent = (c) => { const o = [0, 0, 0]; for (const p of c) { o[0] += p[0]; o[1] += p[1]; o[2] += p[2]; } const n = c.length; return [o[0] / n, o[1] / n, o[2] / n]; };
const hexToRgb = (h) => { if (typeof h !== 'string') return null; const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const rgbToHex = (c) => '#' + c.map((x) => Math.max(0, Math.min(255, Math.round(x * 255))).toString(16).padStart(2, '0')).join('');
const bright = (rgb) => rgb ? (rgb[0] + rgb[1] + rgb[2]) / 3 : 0;

// FACING — stamp outNormal (probe + floor rule). Mutates faces. Returns {up,down,bbox}.
function stampFacing(faces) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const f of faces) for (const p of f.corners) for (let k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; }
  const diag = Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
  const cell = diag / 70, step = cell * 0.7, maxT = diag * 0.5, hitR = cell * 0.55;
  const grid = new Map();
  const key = (p) => `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)},${Math.floor(p[2] / cell)}`;
  const norms = faces.map((f) => newell(f.corners));
  const cents = faces.map((f) => cent(f.corners));
  faces.forEach((f, i) => { for (const p of [...f.corners, cents[i]]) { const k = key(p); (grid.get(k) || grid.set(k, []).get(k)).push({ p, i }); } });
  const occ = (p, s) => { const gx = Math.floor(p[0] / cell), gy = Math.floor(p[1] / cell), gz = Math.floor(p[2] / cell); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const arr = grid.get(`${gx + a},${gy + b},${gz + c}`); if (!arr) continue; for (const e of arr) { if (e.i === s) continue; if (Math.hypot(e.p[0] - p[0], e.p[1] - p[1], e.p[2] - p[2]) < hitR) return true; } } return false; };
  const clr = (c, d, s) => { for (let t = step; t <= maxT; t += step) { const p = [c[0] + d[0] * t, c[1] + d[1] * t, c[2] + d[2] * t]; if (occ(p, s)) return t; } return maxT; };
  const roofZ = mn[2] + (mx[2] - mn[2]) * 0.85;
  let up = 0, down = 0;
  faces.forEach((f, i) => {
    const n = norms[i], c = cents[i];
    let on;
    if (Math.abs(n[2]) > 0.7) on = c[2] > roofZ ? [0, 0, -1] : [0, 0, 1];
    else { const cp = clr(c, n, i), cm = clr(c, [-n[0], -n[1], -n[2]], i); on = cp >= cm ? n : [-n[0], -n[1], -n[2]]; }
    if (on[2] > 0.5) up++; else if (on[2] < -0.5) down++;
    f.outNormal = on;
  });
  return { up, down, bbox: { mn, mx } };
}

// RECOLOUR — position→colour map from baked faces onto source faces. Mutates sourceFaces
// (fill + cornerFills). Robust to the tri↔quad split (position-keyed, not index-keyed).
function recolourFromBaked(sourceFaces, bakedFaces) {
  const pkey = (p) => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)},${Math.round(p[2] * 10)}`;
  const posMap = new Map();
  for (const f of bakedFaces) {
    const cf = f.cornerFills && f.cornerFills.length === f.corners.length ? f.cornerFills : null;
    f.corners.forEach((p, i) => { const rgb = hexToRgb(cf ? cf[i] : f.fill); if (!rgb) return; const k = pkey(p); const e = posMap.get(k) || [0, 0, 0, 0]; e[0] += rgb[0]; e[1] += rgb[1]; e[2] += rgb[2]; e[3] += 1; posMap.set(k, e); });
  }
  let matched = 0, missed = 0;
  for (const f of sourceFaces) {
    const fills = f.corners.map((p) => { const e = posMap.get(pkey(p)); if (!e || !e[3]) { missed++; return null; } matched++; return rgbToHex([e[0] / e[3], e[1] / e[3], e[2] / e[3]]); });
    const solved = fills.filter(Boolean);
    if (!solved.length) continue;
    f.cornerFills = fills.map((h) => h || solved[0]);
    const a = [0, 0, 0]; for (const h of solved) { const c = hexToRgb(h); a[0] += c[0]; a[1] += c[1]; a[2] += c[2]; }
    f.fill = rgbToHex([a[0] / solved.length, a[1] / solved.length, a[2] / solved.length]);
  }
  return matched / (matched + missed || 1);
}

// MACHINE GATE (coverage) — an up-facing lit-paint face that baked near-zero is a
// wrong-facing back-face (genuine AO shadow still catches ~4-10% of bounce).
function coverageBlackFrac(sourceFaces, origBright) {
  let n = 0, dark = 0;
  sourceFaces.forEach((f, i) => {
    if (!Array.isArray(f.outNormal) || f.outNormal[2] <= 0.5) return;
    if (origBright[i] < 0.03) return;
    n++;
    if (bright(hexToRgb(f.fill)) / origBright[i] < 0.04) dark++;
  });
  return n ? dark / n : 0;
}

// ── THE GEAR ADAPTERS ──
const ADAPTERS = [
  {
    name: 'inline-faces',
    match: (s) => Array.isArray(s.manifest.faces) && s.manifest.faces.length >= 200,
    defaultPreset: 'interior-day',
    async source(s) { return { faces: s.manifest.faces }; }, // recipe stores the terrain; recolour in place
    async bind(ctx) {
      const { sketch, sourceFaces, matchRate, blackFrac, sha256, preset, samples, doWrite, deps } = ctx;
      const manifest = sketch.manifest; // sourceFaces IS manifest.faces (same ref) — already recoloured
      const aoWas = manifest.ao;
      manifest.ao = false; // the baked GI already contains ambient occlusion
      manifest.giBake = { adapter: 'inline-faces', preset, migration: MIGRATION_ID, bakedAt: new Date().toISOString(), sha256, samples, matchRate: +matchRate.toFixed(3), floorBlackFrac: +blackFrac.toFixed(3), aoDisabled: aoWas === true };
      if (!doWrite) return { target: sketch.ref, inherited: 'mapRef mode-variants' };
      await deps.backup(sketch.ref, ctx.originalJson);
      deps.SketchRepository.update({ ref: sketch.ref, title: sketch.title, manifest });
      return { target: sketch.ref, written: true, inherited: 'mapRef mode-variants' };
    },
  },
  {
    name: 'generated-mesh',
    match: (s) => GENERATED_KINDS.has(s.manifest.kind) && !(Array.isArray(s.manifest.faces) && s.manifest.faces.length >= 200),
    defaultPreset: 'exterior',
    async source(s, deps) {
      const { payload } = await deps.resolveWorldScene(s, { unshaded: true }); // raw albedo where supported
      return { faces: payload.faces || [], payload, unshadedWarning: payload.unshadedWarning };
    },
    // A generated world has no stored faces to recolour — bind the baked mesh and mint a
    // `<ref>_gi` static variant that renders it. (v1 freezes one instance; live walkers/cars
    // are dropped — a `--live-channels` gear is the documented follow-up.)
    async bind(ctx) {
      const { sketch, bakedBytes, sha256, preset, samples, matchRate, blackFrac, doWrite, deps, payload } = ctx;
      const giRef = `${sketch.ref}_gi`;
      if (!doWrite) return { target: giRef, written: false, note: 'dry run — no mesh bound, no variant minted' };
      const slot = deps.nextMeshPath(sketch.ref);
      await fs.writeFile(slot.path, bakedBytes);
      await fs.writeFile(slot.sidecarPath, JSON.stringify({ source_ref: sketch.ref, bound_at: new Date().toISOString(), sha256, bytes: bakedBytes.length, worker: 'bake-world-gi', note: `GI bake (${preset})`, n: slot.n }, null, 2));
      const cam = (payload.cameras && payload.cameras[0]) || null;
      const variant = {
        kind: 'controllable',
        title: `${sketch.title} — GI baked`,
        figures: { _gi: { meshRef: sketch.ref } },
        bg: payload.bg || '#0c1017',
        ...(cam && cam.worldFraming ? { worldFraming: cam.worldFraming } : {}),
        giBake: { adapter: 'generated-mesh', from: sketch.ref, preset, migration: MIGRATION_ID, bakedAt: new Date().toISOString(), sha256, samples, matchRate: +matchRate.toFixed(3), floorBlackFrac: +blackFrac.toFixed(3), meshN: slot.n },
      };
      if (deps.SketchRepository.getByRef(giRef)) deps.SketchRepository.update({ ref: giRef, title: variant.title, manifest: variant });
      else deps.SketchRepository.create({ ref: giRef, title: variant.title, manifest: variant });
      return { target: giRef, written: true, mesh: `mesh-${slot.n}`, static: true, dropped: 'live walkers/cars (v1)' };
    },
  },
];

// ── the drivetrain ──
const { values: args } = parseArgs({ options: {
  ref: { type: 'string' }, preset: { type: 'string' }, adapter: { type: 'string' },
  write: { type: 'boolean', default: false }, 'no-write': { type: 'boolean', default: false },
  preview: { type: 'boolean', default: false }, remigrate: { type: 'boolean', default: false },
  samples: { type: 'string' }, blender: { type: 'string' },
} });
function fail(msg) { process.stdout.write(`${JSON.stringify({ ok: false, error: msg })}\n`); process.exit(1); }
if (!args.ref) fail('need --ref <world sketch>');
const blenderBin = args.blender || BLENDER;
if (!existsSync(blenderBin)) fail(`Blender not found at ${blenderBin} — set MOJULO_BLENDER`);
const doWrite = args.write && !args['no-write'];

register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
resolveMojuloPaths();
const { SketchRepository } = await import('@/lib/db/repositories/sketches');
const { facesToGlb } = await import('@/lib/graph/scene/scene-gltf');
const { glbToFaces } = await import('@/lib/graph/scene/scene-gltf-read.js');
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { nextMeshPath } = await import('@/lib/graph/scene/mesh-store.js');
const deps = { SketchRepository, resolveWorldScene, nextMeshPath, backup };

const sketch = SketchRepository.getByRef(args.ref);
if (!sketch) fail(`world '${args.ref}' not found`);
const originalJson = JSON.stringify(sketch.manifest);

const adapter = args.adapter ? ADAPTERS.find((a) => a.name === args.adapter) : ADAPTERS.find((a) => a.match(sketch));
if (!adapter) fail(`no gear adapter matches '${args.ref}' (kind '${sketch.manifest.kind}'). Adapters: ${ADAPTERS.map((a) => a.name).join(', ')}`);
const presetName = args.preset || adapter.defaultPreset;
const preset = PRESETS[presetName];
if (!preset) fail(`unknown --preset '${presetName}' (have: ${Object.keys(PRESETS).join(', ')})`);

// SOURCE (gear) → raw-albedo faces
const src = await adapter.source(sketch, deps);
const faces = src.faces;
if (!Array.isArray(faces) || faces.length < 50) fail(`adapter '${adapter.name}' produced no faces for '${args.ref}'`);
if (src.unshadedWarning) process.stderr.write(`[bake-world-gi] unshaded note: ${src.unshadedWarning}\n`);

// FACING
const alreadyStamped = faces.every((f) => Array.isArray(f.outNormal));
const facing = (alreadyStamped && !args.remigrate) ? { up: '(cached)', down: '(cached)' } : stampFacing(faces);
const origBright = faces.map((f) => bright(hexToRgb(f.fill)));

// EXPORT
const work = await fs.mkdtemp(path.join(os.tmpdir(), 'moj-worldgi-'));
const srcGlb = path.join(work, 'src.glb');
await fs.writeFile(srcGlb, facesToGlb({ faces }, { generator: `world-gi ${args.ref}` }).bytes);

// BAKE
const outGlb = path.join(work, 'baked.glb');
const outcomeDir = path.join(process.env.MOJULO_OUTCOMES_DIR || path.join(process.cwd(), 'data', 'outcomes'), args.ref);
await fs.mkdir(outcomeDir, { recursive: true });
const previewPng = (args.preview || doWrite) ? path.join(outcomeDir, 'gi-preview.png') : null;
const config = { src_glb: srcGlb, out_glb: outGlb, preview_png: previewPng, roof_cut: preset.roof_cut, samples: args.samples ? Number(args.samples) : preset.samples, ambient: preset.ambient, sun: preset.sun, points: preset.points || [] };
if (preset.lightGrid) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const f of faces) for (const p of f.corners) for (let k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; }
  const g = preset.lightGrid, span = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
  config.points = [];
  for (let i = 0; i < g.nx; i++) for (let j = 0; j < g.ny; j++) { const fx = (i + 0.5) / g.nx, fy = (j + 0.5) / g.ny; config.points.push({ energy: span * span * g.energyScale, color: g.color, size: span * 0.12, at: [mn[0] + fx * (mx[0] - mn[0]), mn[1] + fy * (mx[1] - mn[1]), mn[2] + g.zFrac * (mx[2] - mn[2])] }); }
}
const cfgPath = path.join(work, 'config.json');
await fs.writeFile(cfgPath, JSON.stringify(config, null, 2));
const code = await new Promise((r) => spawn(blenderBin, ['-b', '-P', path.join(here, 'bake-world-gi.py'), '--', cfgPath], { stdio: ['ignore', 'inherit', 'inherit'] }).on('close', r));
if (code !== 0 || !existsSync(outGlb)) fail(`Blender bake failed (exit ${code})`);

// MACHINE GATE (decode) + recolour + MACHINE GATE (coverage)
const bakedBytes = await fs.readFile(outGlb);
const bakedFaces = glbToFaces(bakedBytes);
if (!bakedFaces.length) fail('baked GLB carries no geometry (decode gate)');
const matchRate = recolourFromBaked(faces, bakedFaces);
const blackFrac = coverageBlackFrac(faces, origBright);
if (blackFrac > 0.25) fail(`MACHINE GATE failed: ${(blackFrac * 100).toFixed(0)}% of lit-paint floor faces received almost no light (>25%) — facing/bake is wrong, not shipping. preview: ${previewPng}`);

// BIND (gear)
const sha256 = createHash('sha256').update(bakedBytes).digest('hex');
const bindResult = await adapter.bind({ sketch, sourceFaces: faces, bakedBytes, matchRate, blackFrac, sha256, preset: presetName, samples: config.samples, doWrite, deps, payload: src.payload || {}, originalJson });

process.stdout.write(`${JSON.stringify({ ok: true, ref: args.ref, adapter: adapter.name, preset: presetName, faces: faces.length, facing, corner_match_rate: +matchRate.toFixed(3), floor_black_frac: +blackFrac.toFixed(3), preview_png: previewPng, ...bindResult }, null, 2)}\n`);

async function backup(ref, json) {
  const dir = path.join(process.env.MOJULO_DATA_DIR || path.join(process.cwd(), 'data'), 'backups');
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.writeFile(path.join(dir, `${ref}.${stamp}.json`), json);
}
