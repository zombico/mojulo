/**
 * dna-process — animated DNA-biology explainers as a traversable three.js World, selected by
 * `process`:
 *
 *   • conception   — fertilization: a maternal + paternal helix converge into a homologous pair.
 *   • recombination— crossing-over: a recombined (mosaic) gamete is kept; the remainder is ejected.
 *   • assortment   — independent assortment: 4 pairs each keep one copy (up) and discard one (down).
 *   • meiosis      — the whole sequence: diploid pairs → crossover mosaics → segregate to a gamete.
 *
 * Geometry is the taiji → lit-solid lowering (taijiStrandFaces); motion is the mover channel
 * (returned in payload.movers, which resolveWorldScene preserves). Stored manifest is a tiny recipe
 * (`kind: 'dna-process', process }`); the scene is regenerated on render. Orbit-only.
 *
 * Promoted from the dna-conception / dna-recombination / dna-assortment / dna-meiosis spikes in
 * lite-template/integration/0626/spike-output/ (those also write static storyboard SVGs; the live
 * World portion is what's ported here).
 */

import { taijiStrandFaces } from './polygonizer/taiji-faces.js';
import { makeLight } from './polygonizer/vexar.js';

const LIGHT = makeLight({ direction: [-0.4, -0.55, -0.72], ambient: 0.5, diffuse: 0.9 });
const MAT = { yin: '#e87aa0', yang: '#f0a23c' };   // maternal (warm)
const PAT = { yin: '#3fb6ad', yang: '#4f9bd9' };   // paternal (cool)
const BG = '#0a0f1c';

// ── helpers ──
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (u) => u * u * (3 - 2 * u);
const translate = (faces, d) => faces.map((f) => ({ ...f, corners: f.corners.map((c) => add(c, d)) }));
const approach = (S, E, n = 44) => Array.from({ length: n }, (_, i) => lerp(S, E, smooth(i / (n - 1))));
function centroidOf(faces) { let x = 0, y = 0, z = 0, n = 0; for (const f of faces) for (const p of f.corners) { x += p[0]; y += p[1]; z += p[2]; n++; } return n ? [x / n, y / n, z / n] : [0, 0, 0]; }

// one chromosome built at the origin in a single render-`group`. `uniform` = flat parental palette;
// `paint(i)` = per-cross-section mosaic (a crossover). Returns faces (at origin).
function chromosome({ group, uniform, paint, bp = 14, radius = 0.85, scale = 1, sides = 9 }) {
  const half = ((0.34 * (bp - 1)) / 2) * scale;
  const spec = { yin: { x: 0, y: 0, z: -half }, yang: { x: 0, y: 0, z: half }, twist: bp / 10.5, radius: radius * scale, profile: 'capsule', crossSections: bp - 1 };
  const opts = paint
    ? { light: LIGHT, sides, rungColor: '#8b93ab', strandPaint: paint }
    : { light: LIGHT, sides, rungColor: '#8b93ab', yinColor: uniform.yin, yangColor: uniform.yang };
  return taijiStrandFaces(spec, opts).faces.map((f) => ({ ...f, group }));
}

// two preset cameras framing a set of world points (molecule-view style).
function camerasFor(pts, { fov = 48, mul = 3.0, minD = 7 } = {}) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; }
  const c = [(mn[0] + mx[0]) / 2, 0, (mn[2] + mx[2]) / 2];
  const rad = 0.5 * Math.hypot(mx[0] - mn[0] + 2, 2, mx[2] - mn[2] + 2) || 6;
  const d = Math.max(minD, rad * mul);
  return [
    { name: 'angle', worldFraming: { cameraPosition: [c[0] + d * 0.55, c[1] - d * 1.05, c[2] + d * 0.4], lookAt: c, horizontalFov: fov } },
    { name: 'front', worldFraming: { cameraPosition: [c[0], c[1] - d * 1.25, c[2]], lookAt: c, horizontalFov: fov } },
  ];
}

// ── conception (fertilization): two helices converge into a pair ──
function buildConception() {
  const GAP = 3.4, PAIR = 1.25;
  const mat = chromosome({ group: 'maternal', uniform: MAT, bp: 16, radius: 0.9 });
  const pat = chromosome({ group: 'paternal', uniform: PAT, bp: 16, radius: 0.9 });
  const matStart = [-GAP, 0, 0], patStart = [GAP, 0, 0];
  const faces = [...translate(mat, matStart), ...translate(pat, patStart)];
  const movers = [
    { group: 'maternal', basePos: matStart, path: approach(matStart, [-PAIR, 0, 0]), period: 4.5, hold: 2.6, loop: false },
    { group: 'paternal', basePos: patStart, path: approach(patStart, [PAIR, 0, 0]), period: 4.5, hold: 2.6, loop: false },
  ];
  const picks = [
    { name: 'maternal', kind: 'chromosome', label: 'Maternal chromosome (from the egg)', fields: [{ k: 'ploidy', v: 'haploid — 1 of the pair' }] },
    { name: 'paternal', kind: 'chromosome', label: 'Paternal chromosome (from the sperm)', fields: [{ k: 'ploidy', v: 'haploid — 1 of the pair' }] },
  ];
  return { faces, movers, picks, cameras: camerasFor([matStart, patStart, [0, 0, 3], [0, 0, -3]], { mul: 3.4 }) };
}

// ── recombination (crossing-over): keep a mosaic gamete, eject the remainder ──
function buildRecombination() {
  const BP = 16, SEP = 1.35, CROSS = Math.round(BP * 0.45);
  const MOSAIC_M = (i) => (i < CROSS ? MAT : PAT);
  const MOSAIC_P = (i) => (i < CROSS ? PAT : MAT);
  const gamete = chromosome({ group: 'gamete', paint: MOSAIC_M, bp: BP, radius: 0.9 });
  const remainder = chromosome({ group: 'remainder', paint: MOSAIC_P, bp: BP, radius: 0.9 });
  const remStart = [SEP + 0.4, 0, 0];
  const faces = [...gamete, ...translate(remainder, remStart)];
  const movers = [{ group: 'remainder', basePos: remStart, path: approach(remStart, [9, 0, 2.5]), period: 3.4, hold: 3.0, loop: false }];
  const picks = [
    { name: 'gamete', kind: 'chromosome', label: 'Recombinant gamete', fields: [{ k: 'note', v: 'a mosaic of both parents after crossover' }] },
    { name: 'remainder', kind: 'chromosome', label: 'Discarded remainder (polar body)', fields: [] },
  ];
  return { faces, movers, picks, cameras: camerasFor([[0, 0, 3], [0, 0, -3], remStart, [9, 0, 2.5]], { mul: 3.2 }) };
}

// ── independent assortment: 4 pairs, each keeps one copy (up) / discards one (down) ──
function buildAssortment() {
  const CHROMS = 4, KEEP = ['M', 'P', 'P', 'M'], BP = 11, COL = 3.0, DX = 0.72, UP = 4.6, DOWN = 4.6, R = 0.58;
  const colX = (i) => (i - (CHROMS - 1) / 2) * COL;
  const faces = [], movers = [], pts = [];
  for (let i = 0; i < CHROMS; i++) {
    const matKept = KEEP[i] === 'M';
    const m = chromosome({ group: `mat${i}`, uniform: MAT, bp: BP, radius: R, sides: 8 });
    const p = chromosome({ group: `pat${i}`, uniform: PAT, bp: BP, radius: R, sides: 8 });
    const mStart = [colX(i) - DX, 0, 0], pStart = [colX(i) + DX, 0, 0];
    const mEnd = matKept ? [colX(i), 0, UP] : [colX(i) - 1.5, 0, -DOWN];
    const pEnd = matKept ? [colX(i) + 1.5, 0, -DOWN] : [colX(i), 0, UP];
    faces.push(...translate(m, mStart), ...translate(p, pStart));
    movers.push(
      { group: `mat${i}`, basePos: mStart, path: approach(mStart, mEnd), period: 3.2, hold: 3.2, loop: false },
      { group: `pat${i}`, basePos: pStart, path: approach(pStart, pEnd), period: 3.2, hold: 3.2, loop: false },
    );
    pts.push(mStart, pStart, mEnd, pEnd);
  }
  const picks = [{ name: 'mat0', kind: 'note', label: 'Independent assortment', fields: [{ k: 'rule', v: 'each pair keeps one copy at random → the gamete' }, { k: 'variety', v: '2²³ ≈ 8.4M combinations in humans' }] }];
  return { faces, movers, picks, cameras: camerasFor(pts, { fov: 52, mul: 2.3, minD: 9 }) };
}

// ── meiosis: diploid pairs → crossover mosaics → segregate to a haploid gamete ──
function buildMeiosis() {
  const BP = 12, R = 0.6, COL = 2.3, DX = 0.72, UP = 4.4, DOWN = 4.4, CROSS = Math.round(BP * 0.45);
  const MOSAIC_M = (i) => (i < CROSS ? MAT : PAT);
  const MOSAIC_P = (i) => (i < CROSS ? PAT : MAT);
  // chr A at x=−COL, chr B at x=+COL; keep paternal-A + maternal-B (one of each = haploid).
  const defs = [
    { group: 'mA', paint: MOSAIC_M, start: [-COL - DX, 0, 0], end: [-COL - 1.4, 0, -DOWN] },   // discarded
    { group: 'pA', paint: MOSAIC_P, start: [-COL + DX, 0, 0], end: [-COL, 0, UP] },             // kept
    { group: 'mB', paint: MOSAIC_M, start: [COL - DX, 0, 0], end: [COL, 0, UP] },               // kept
    { group: 'pB', paint: MOSAIC_P, start: [COL + DX, 0, 0], end: [COL + 1.4, 0, -DOWN] },      // discarded
  ];
  const faces = [], movers = [], pts = [];
  for (const d of defs) {
    const faceset = chromosome({ group: d.group, paint: d.paint, bp: BP, radius: R, sides: 8 });
    faces.push(...translate(faceset, d.start));
    movers.push({ group: d.group, basePos: d.start, path: approach(d.start, d.end), period: 3.4, hold: 3.2, loop: false });
    pts.push(d.start, d.end);
  }
  const picks = [{ name: 'pA', kind: 'note', label: 'Meiosis', fields: [{ k: 'crossover', v: 'homologs swap segments → mosaics' }, { k: 'reduction', v: 'one recombined copy of each chromosome → the gamete; the rest discarded' }] }];
  return { faces, movers, picks, cameras: camerasFor(pts, { fov: 52, mul: 2.4, minD: 9 }) };
}

export const DNA_PROCESSES = ['meiosis', 'conception', 'recombination', 'assortment'];
const BUILDERS = { conception: buildConception, recombination: buildRecombination, assortment: buildAssortment, meiosis: buildMeiosis };
const TITLES = { conception: 'mojulo DNA — fertilization', recombination: 'mojulo DNA — recombination', assortment: 'mojulo DNA — independent assortment', meiosis: 'mojulo DNA — meiosis' };

/** Resolve a recipe into a placed face list + movers + picks for the chosen process. Pure. */
export function planDnaProcess(recipe = {}) {
  const process = DNA_PROCESSES.includes(recipe.process) ? recipe.process : 'meiosis';
  const built = BUILDERS[process]();
  return { process, ...built };
}

/** Resolve a recipe into the emitThreeWorld payload. The world route calls this. Orbit-only. */
export function assembleDnaProcessScene(recipe = {}, { title } = {}) {
  const plan = planDnaProcess(recipe);
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : BG;
  return {
    faces: plan.faces,
    movers: plan.movers,
    picks: plan.picks,
    cameras: plan.cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1200, height: 760 },
    title: title || recipe.title || TITLES[plan.process],
    bg,
    glow: false,
  };
}
