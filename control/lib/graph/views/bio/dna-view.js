/**
 * dna-view — a DNA DOUBLE HELIX hung in the traversable three.js World.
 *
 * The science/education sibling of molecule-view: same `emitThreeWorld` faces
 * payload, same orbit-to-inspect framing, but the geometry comes from a single
 * TAIJI (the substrate's chiral double-helix coupling primitive) lowered to lit
 * solids by `taijiStrandFaces`. The two pole-strands become the sugar-phosphate
 * BACKBONES (beaded tubes); corresponding strand points are joined by RUNG rods —
 * the base pairs. Chirality is real: `handedness:'right'` (default, B-DNA) is a
 * positive taiji twist, `'left'` (Z-DNA) negative.
 *
 * Stored manifest IS the recipe (geometry regenerated on render, nothing baked):
 *   { kind:'dna-view', sequence?|basePairs?, bpPerTurn?, radius?, rise?,
 *     handedness?, profile?, palette?, lod?, viewBox?, scene?:{bg?}, title? }
 *
 * Author by SEQUENCE (a string of A/T/G/C → base-pair count + per-rung base
 * colours, complement on the far strand) or by COUNT (`basePairs`, uniform rungs).
 *
 * Orbit-only object study like molecule-view (NOT in the world route's WALK_KINDS);
 * the /world route still exposes ?walk=1 for a first-person pass through the helix.
 */

import { makeLight } from '../../polygonizer/vexar.js';
import { taijiStrandFaces } from '../../polygonizer/taiji-faces.js';

// canonical Watson–Crick palette — distinct from the teal/gold backbones so bases pop.
const BASE_COLORS = { A: '#5cb85c', T: '#d9534f', G: '#9b59b6', C: '#4f9bd9', N: '#8a8a8a' };
const COMPLEMENT = { A: 'T', T: 'A', G: 'C', C: 'G', N: 'N' };
const BASE_NAME = { A: 'adenine', T: 'thymine', G: 'guanine', C: 'cytosine', N: 'unknown' };

const LOD_SIDES = { draft: 7, default: 9, hero: 13 };
const HEX = /^#[0-9a-fA-F]{6}$/;

const clampNum = (v, lo, hi, dflt) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : dflt);

// normalize a sequence string to upper-case A/T/G/C (anything else → 'N'). Returns null if empty.
function normalizeSequence(seq) {
  if (typeof seq !== 'string') return null;
  const s = seq.replace(/\s+/g, '').toUpperCase();
  if (!s.length) return null;
  return [...s].map((c) => (BASE_COLORS[c] ? c : 'N'));
}

/**
 * Resolve a recipe into a placed face list + pick map + framing bounds. Pure — no
 * DB, no HTML. Reused by the world route and by tests.
 *
 * @returns {{ faces, picks, bounds, basePairs, turns, handedness }}
 */
export function planDnaScene(recipeIn = {}) {
  const recipe = recipeIn && typeof recipeIn === 'object' ? recipeIn : {};
  const seq = normalizeSequence(recipe.sequence);
  const basePairs = seq ? seq.length : clampNum(recipe.basePairs, 2, 240, 22) | 0;
  if (basePairs < 2) throw new Error('dna-view needs at least 2 base pairs');

  const bpPerTurn = clampNum(recipe.bpPerTurn, 2, 40, 10.5);
  const radius = clampNum(recipe.radius, 0.1, 20, 1.0);
  const rise = clampNum(recipe.rise, 0.02, 5, 0.34);
  const left = String(recipe.handedness || 'right').toLowerCase() === 'left';
  const profile = recipe.profile === 'spindle' ? 'spindle' : 'capsule';
  const sides = LOD_SIDES[recipe.lod] || LOD_SIDES.default;

  const half = (rise * (basePairs - 1)) / 2;
  const turns = (basePairs / bpPerTurn) * (left ? -1 : 1);

  // palette: teal/gold backbones + Watson–Crick base colours, all overridable.
  const pal = recipe.palette && typeof recipe.palette === 'object' ? recipe.palette : {};
  const yinColor = HEX.test(pal.yin || '') ? pal.yin : '#3fb6ad';
  const yangColor = HEX.test(pal.yang || '') ? pal.yang : '#e3b23c';
  const rungColor = HEX.test(pal.rung || '') ? pal.rung : '#9aa0bd';
  const baseColor = (b) => (HEX.test(pal[b] || '') ? pal[b] : BASE_COLORS[b] || BASE_COLORS.N);

  // a 3/4 upper-front key light so the tubes read as round (matches molecule-view's framing light).
  const light = makeLight({ direction: [-0.4, -0.55, -0.72], ambient: 0.5, diffuse: 0.9 });

  const spec = {
    yin: { x: 0, y: 0, z: -half },
    yang: { x: 0, y: 0, z: half },
    twist: turns,
    radius,
    profile,
    crossSections: basePairs - 1,   // crossSections+1 strand points = one per base pair
  };

  const { faces, rungs } = taijiStrandFaces(spec, {
    light,
    sides,
    yinColor,
    yangColor,
    rungColor,
    rungPaint: seq
      ? (i) => { const b = seq[i] || 'N'; return { a: baseColor(b), b: baseColor(COMPLEMENT[b]) }; }
      : undefined,
  });

  // base-pair picks (one per rung) + the two backbone strands → click popups in the World.
  const picks = rungs.map((r, k) => {
    const b = seq ? seq[r.index] || 'N' : null;
    const comp = b ? COMPLEMENT[b] : null;
    return {
      name: r.group,
      kind: 'base-pair',
      index: r.index,
      label: b ? `bp ${k + 1}: ${b}·${comp}` : `bp ${k + 1}`,
      fields: b
        ? [{ k: 'pair', v: `${b}·${comp}` }, { k: 'bases', v: `${BASE_NAME[b]} · ${BASE_NAME[comp]}` }]
        : [{ k: 'index', v: String(k + 1) }],
    };
  });
  picks.push(
    { name: 'backbone:yin', kind: 'strand', label: "strand 1 (5'→3')", fields: [{ k: 'role', v: 'sugar-phosphate backbone' }] },
    { name: 'backbone:yang', kind: 'strand', label: "strand 2 (3'→5')", fields: [{ k: 'role', v: 'complementary backbone' }] },
  );

  // bounds (exact, over every emitted corner) drive the camera framing.
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) {
    if (c[k] < mn[k]) mn[k] = c[k];
    if (c[k] > mx[k]) mx[k] = c[k];
  }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  const radiusOut = 0.5 * Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) || 1;

  return {
    faces,
    picks,
    bounds: { min: mn, max: mx, center, radius: radiusOut },
    basePairs,
    turns,
    handedness: left ? 'left' : 'right',
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload. The world route calls this;
 * emitThreeWorld renders it. Orbit-only — no walk default, no CSS-3D /scene form.
 */
export function assembleDnaScene(recipe = {}, { title } = {}) {
  const plan = planDnaScene(recipe);
  const { center, radius } = plan.bounds;
  // pull back enough that the tall helix (axis vertical) clears the narrower vertical frustum.
  const d = Math.max(3.0, radius * 4.2);
  const cameras = [
    { name: 'angle', worldFraming: { cameraPosition: [center[0] + d * 0.8, center[1] - d * 0.9, center[2] + d * 0.55], lookAt: center, horizontalFov: 42 } },
    { name: 'broadside', worldFraming: { cameraPosition: [center[0], center[1] - d * 1.25, center[2]], lookAt: center, horizontalFov: 42 } },
    { name: 'end-on', worldFraming: { cameraPosition: [center[0], center[1], center[2] + d * 1.3], lookAt: center, horizontalFov: 42 } },
  ];
  const bg = (recipe.scene && HEX.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0b1020';
  return {
    faces: plan.faces,
    picks: plan.picks,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || 'mojulo DNA',
    bg,
    glow: false,
  };
}
