#!/usr/bin/env node
/**
 * audit-figure-mesh.mjs — the MACHINE GATE for animal figure meshes (the figure
 * sibling of bake-world-gi's gate; the eyes gate stays `/figure-study` + `/skull-study`).
 *
 * Exports every bare archetype and every dressed ZOO_BUILDS species as OBJ, then hands
 * the set to Blender/bmesh (audit-figure-mesh.py) for a topology report.
 *
 * ── THE MIRRORING CONTRACT (the whole point) ───────────────────────────────────────
 * The OBJ must be what the RENDERER draws, not an idealised solid. So the exporter
 * mirrors figure-render.js's `litFaces` exactly:
 *   • quads between CONSECUTIVE rings of a part's `polylines`, columns `j = 0 … m-2`
 *     where `m = min(ringA.length, ringB.length)`;
 *   • ring polylines repeat their first point to wrap — kept as-is, since the j<m-1
 *     sweep relies on that repeat;
 *   • NO synthetic caps, no welding, no dedupe.
 * Break the mirror and the audit stops measuring the thing that ships.
 *
 * ── WHAT THE NUMBERS MEAN ──────────────────────────────────────────────────────────
 *   nonmanifold_edges — must stay 0. Ring-strip construction cannot produce them; a
 *                       non-zero count means a builder emitted something else.
 *   degenerate_faces  — REAL defects: collapsed quads where a ring pinches to a point
 *                       (renders as facet slashes / shards). Target: 0.
 *   open_edges        — boundary edges AFTER welding coincident verts. Raw boundary
 *                       counts are dominated by ring-stack bookkeeping (every ring
 *                       repeats its first point → an open seam column per strip; a cap
 *                       fan ends in a ring of coincident points → a rim that is really
 *                       closed), so the welded count is the one that means "hole".
 *                       WATCHED, not gated: render-only geometry is open by construction
 *                       (painter's sort + backface cull hide it), and it is the honest
 *                       distance to STL closure. Every animal is render-only today; a
 *                       print lane needs a welding/capping pass. Advise, never refuse.
 *
 * Optional + operator-hosted: no Blender ⇒ the audit is unavailable and the figures
 * still build and render byte-identically. Absence degrades a loop, never breaks one.
 *
 * Usage (from control/):
 *   node scripts/audit-figure-mesh.mjs                     # export + Blender + report
 *   node scripts/audit-figure-mesh.mjs --export-only --out /tmp/objs
 *   node scripts/audit-figure-mesh.mjs --json audit.json   # keep the raw report
 *   node scripts/audit-figure-mesh.mjs --only wolf,horse   # a subset, by label substring
 */
import { parseArgs } from 'node:util';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildAnimal, ZOO_BUILDS } from '../lib/graph/polygonizer/figure-animal-build.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const BLENDER = process.env.MOJULO_BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';

// Bare archetypes worth auditing — the cheap protoSkull/overlap-flesh path. (The full
// archetype roster lives in QUADRUPED_ARCHETYPES; these six span the silhouette range.)
const BARE = ['canine', 'feline', 'equine', 'ursine', 'theropod', 'avian'];

/**
 * BASELINE — recorded 2026-09-01, before the degenerate-quad fix (figure-inception-quality
 * plan, phase 0). Every degenerate face in the zoo was in ONE part: the front of the
 * WELDED SKULL, where the march axis ran past the muzzle surface, so the terminal rings
 * marched to radius ~0 and collapsed to a point (which also left the front cap zero-depth,
 * i.e. the muzzle was never actually capped on those species).
 * Numbers are per-build totals: [open_edges, degenerate_faces] — `open_edges` is the
 * welded count (see above). nonmanifold + loose were 0 everywhere and stay that way.
 */
export const BASELINE = {
  'bare-avian': [1132, 0], 'bare-canine': [904, 0], 'bare-equine': [904, 0],
  'bare-feline': [904, 0], 'bare-theropod': [1132, 0], 'bare-ursine': [904, 0],
  'zoo-buck': [1452, 158], 'zoo-bull': [1196, 0], 'zoo-camel': [1004, 130],
  'zoo-cougar': [1040, 0], 'zoo-deer': [1132, 158], 'zoo-fox': [1040, 110],
  'zoo-gazelle': [1410, 132], 'zoo-hippo': [956, 0], 'zoo-horse': [1156, 182],
  'zoo-kangaroo': [1448, 0], 'zoo-lion': [1984, 0], 'zoo-ram': [1572, 136],
  'zoo-redPanda': [1256, 0], 'zoo-rhino': [1156, 126], 'zoo-wolf': [1040, 112],
  'zoo-wombat': [956, 0],
};

const { values: opt } = parseArgs({
  options: {
    out: { type: 'string' }, json: { type: 'string' }, only: { type: 'string' },
    'export-only': { type: 'boolean' }, help: { type: 'boolean' },
  },
});
if (opt.help) { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]); process.exit(0); }

// ── OBJ export, mirroring litFaces ──
function toObj(parts) {
  const lines = [];
  let vBase = 1;
  parts.forEach((p, pi) => {
    lines.push(`o part_${String(pi).padStart(2, '0')}`);
    const rings = p.polylines;
    for (const ring of rings) for (const q of ring) lines.push(`v ${q.x} ${q.y} ${q.z}`);
    const ringStart = [];
    let acc = 0;
    for (const ring of rings) { ringStart.push(acc); acc += ring.length; }
    for (let i = 0; i < rings.length - 1; i++) {
      const a = rings[i], b = rings[i + 1], m = Math.min(a.length, b.length);
      for (let j = 0; j < m - 1; j++) {
        const A = vBase + ringStart[i] + j, A1 = A + 1;
        const B = vBase + ringStart[i + 1] + j, B1 = B + 1;
        lines.push(`f ${A} ${A1} ${B1} ${B}`);
      }
    }
    vBase += acc;
  });
  return lines.join('\n') + '\n';
}

const targets = [
  ...BARE.map((a) => [`bare-${a}`, a, {}]),
  ...Object.entries(ZOO_BUILDS).map(([name, spec]) => [`zoo-${name}`, spec.archetype, spec.opts || {}]),
].filter(([label]) => !opt.only || opt.only.split(',').some((s) => label.includes(s.trim())));

const outDir = opt.out || mkdtempSync(path.join(os.tmpdir(), 'mojulo-figure-audit-'));
mkdirSync(outDir, { recursive: true });

const failures = [];
let exported = 0;
for (const [label, archetype, opts] of targets) {
  try {
    writeFileSync(path.join(outDir, `${label}.obj`), toObj(buildAnimal(archetype, opts).parts));
    exported++;
  } catch (e) { failures.push([label, e.message]); }
}
console.log(`exported ${exported}/${targets.length} builds → ${outDir}`);
for (const [label, msg] of failures) console.log(`  BUILD ERROR ${label}: ${msg}`);

if (opt['export-only']) process.exit(failures.length ? 1 : 0);

// ── Blender half ──
if (!existsSync(BLENDER)) {
  console.error(`\nBlender not found at ${BLENDER} — set MOJULO_BLENDER to audit topology.`);
  console.error(`The OBJ set is still at ${outDir}; the figures themselves are unaffected.`);
  process.exit(2);
}
const jsonOut = opt.json ? path.resolve(opt.json) : path.join(outDir, 'audit.json');
const run = spawnSync(BLENDER, ['-b', '-P', path.join(here, 'audit-figure-mesh.py'), '--', outDir, jsonOut], { encoding: 'utf8' });
if (run.status !== 0) { console.error(run.stdout || '', run.stderr || ''); process.exit(1); }

// ── report: the burn-down against BASELINE ──
const report = JSON.parse(readFileSync(jsonOut, 'utf8'));
const d = (n) => String(n).padStart(6);
let degTotal = 0, nmTotal = 0, regressed = 0;
console.log(`\n${'build'.padEnd(16)}${'open'.padStart(7)}${'Δbase'.padStart(8)}${'degen'.padStart(7)}${'Δbase'.padStart(8)}${'nonman'.padStart(8)}${'loose'.padStart(7)}`);
for (const a of report) {
  const t = a.totals, base = BASELINE[a.label];
  degTotal += t.degenerate_faces; nmTotal += t.nonmanifold_edges;
  const db = base ? t.open_edges - base[0] : NaN, dd = base ? t.degenerate_faces - base[1] : NaN;
  if (dd > 0 || t.nonmanifold_edges > 0) regressed++;
  const sgn = (v) => (Number.isNaN(v) ? '     ·' : (v > 0 ? '+' : '') + v);
  console.log(a.label.padEnd(16) + d(t.open_edges) + String(sgn(db)).padStart(8) + d(t.degenerate_faces) + String(sgn(dd)).padStart(8) + d(t.nonmanifold_edges) + d(t.loose_verts));
}
// Which part carries what is left — degeneracies cluster in ONE builder at a time.
const hot = report.flatMap((a) => a.parts.filter((p) => p.degenerate_faces > 0).map((p) => `${a.label}:${p.part} ${p.degenerate_faces}/${p.faces}`));
if (hot.length) console.log(`\nremaining degenerate parts:\n  ${hot.join('\n  ')}`);

console.log(`\ntotals — degenerate ${degTotal} (target 0) · non-manifold ${nmTotal} (must be 0)`);
console.log(`report: ${jsonOut}`);
if (nmTotal > 0) { console.error('FAIL: non-manifold edges — ring-strip construction cannot produce these.'); process.exit(1); }
if (regressed) { console.error(`FAIL: ${regressed} build(s) worse than the recorded baseline.`); process.exit(1); }
