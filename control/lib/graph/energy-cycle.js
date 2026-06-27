/**
 * energy-cycle — the PHOTOSYNTHESIS ⇄ RESPIRATION loop as a traversable three.js World.
 *
 * A science-explainer sibling of molecule-view: a chloroplast (green, with grana stacks) and a
 * mitochondrion (orange, with a crista fold) trade molecules along two arcs. Photosynthesis emits
 * glucose + O₂; respiration burns them back to CO₂ + H₂O + ATP; the CO₂ + H₂O return. The flow is
 * a TIMED reaction cascade on the shared mover clock — each molecule is a lifetime mover
 * ({ t0, t1, vanish }) so a product only appears once the reaction that makes it has run, then is
 * consumed (vanish) or stays (ATP). Both organelles live in a plant cell; an animal cell has only
 * the mitochondrion, so the loop is really plant ↔ animal.
 *
 * Stored manifest is a tiny recipe ({ kind:'energy-cycle', scene?:{bg}, title? }); the geometry +
 * timeline are regenerated here and rendered by emitThreeWorld. Orbit-only object study.
 *
 * Promoted from lite-template/integration/0626/spike-output/energy-cycle/ (the labelled stills the
 * spike also writes are not part of the live World — see the spike for those).
 */

import { makeLight, shadeHex } from './polygonizer/vexar.js';

const TAU = Math.PI * 2;
const LIGHT = makeLight({ direction: [-0.35, -0.55, -0.75], ambient: 0.52, diffuse: 0.9 });
const CPK = { O: '#ff3b30', C: '#9aa0a6', H: '#f2f2f2', P: '#ff8a00', N: '#5b7fe0' };

// ── vec + face helpers ──
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const translate = (faces, d) => faces.map((f) => ({ ...f, corners: f.corners.map((c) => add(c, d)) }));
const scaleFaces = (faces, s) => faces.map((f) => ({ ...f, corners: f.corners.map((c) => [c[0] * s[0], c[1] * s[1], c[2] * s[2]]) }));

function sphereFaces(center, r, color, group, longs = 14, lats = 9) {
  const grid = [];
  for (let j = 0; j <= lats; j++) { grid[j] = []; for (let i = 0; i < longs; i++) { const th = -Math.PI / 2 + Math.PI * (j / lats), ph = TAU * (i / longs); grid[j][i] = [Math.cos(th) * Math.cos(ph), Math.cos(th) * Math.sin(ph), Math.sin(th)]; } }
  const out = [];
  for (let j = 0; j < lats; j++) for (let i = 0; i < longs; i++) {
    const a = grid[j][i], b = grid[j][(i + 1) % longs], c = grid[j + 1][(i + 1) % longs], d = grid[j + 1][i];
    const ug = j === 0 ? [a, c, d] : j === lats - 1 ? [a, b, d] : [a, b, c, d];
    const n = unit(ug.reduce((s, p) => add(s, p), [0, 0, 0]));
    out.push({ corners: ug.map((u) => add(center, scl(u, r))), fill: shadeHex(color, n, LIGHT), group });
  }
  return out;
}
function rodFaces(pA, pB, r, color, group, sides = 9) {
  const axisV = sub(pB, pA), L = vlen(axisV); if (L < 1e-6) return [];
  const dir = scl(axisV, 1 / L); let u = cross(dir, [0, 0, 1]); if (vlen(u) < 1e-4) u = cross(dir, [1, 0, 0]); u = unit(u); const w = unit(cross(dir, u));
  const ring = (c) => Array.from({ length: sides }, (_, k) => { const a = (k / sides) * TAU; return add(c, add(scl(u, Math.cos(a) * r), scl(w, Math.sin(a) * r))); });
  const rA = ring(pA), rB = ring(pB), out = [];
  for (let k = 0; k < sides; k++) { const k2 = (k + 1) % sides, mid = ((k + 0.5) / sides) * TAU; const n = unit(add(scl(u, Math.cos(mid)), scl(w, Math.sin(mid)))); out.push({ corners: [rA[k], rB[k], rB[k2], rA[k2]], fill: shadeHex(color, n, LIGHT), group }); }
  return out;
}

// ── molecules (small ball-and-stick, built at origin, one group each) ──
function molecule({ atoms, bonds = [], group, scale = 1 }) {
  const out = [], P = atoms.map((a) => scl(a.p, scale));
  for (const [i, j] of bonds) out.push(...rodFaces(P[i], P[j], 0.09 * scale, '#c9ccd2', group, 7));
  atoms.forEach((a, i) => out.push(...sphereFaces(P[i], a.r * scale, a.c, group, 12, 8)));
  return out;
}
const MOL = {
  O2: { atoms: [{ p: [-0.33, 0, 0], r: 0.27, c: CPK.O }, { p: [0.33, 0, 0], r: 0.27, c: CPK.O }], bonds: [[0, 1]] },
  CO2: { atoms: [{ p: [-0.64, 0, 0], r: 0.25, c: CPK.O }, { p: [0, 0, 0], r: 0.3, c: CPK.C }, { p: [0.64, 0, 0], r: 0.25, c: CPK.O }], bonds: [[0, 1], [1, 2]] },
  H2O: { atoms: [{ p: [0, 0, 0], r: 0.3, c: CPK.O }, { p: [0.46, 0, 0.32], r: 0.17, c: CPK.H }, { p: [-0.46, 0, 0.32], r: 0.17, c: CPK.H }], bonds: [[0, 1], [0, 2]] },
  glucose: { atoms: Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * TAU; return { p: [Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62], r: i === 0 ? 0.22 : 0.21, c: i === 0 ? CPK.O : CPK.C }; }), bonds: Array.from({ length: 6 }, (_, i) => [i, (i + 1) % 6]) },
  ATP: { atoms: [{ p: [-0.7, 0, 0], r: 0.22, c: CPK.P }, { p: [-0.3, 0, 0], r: 0.22, c: CPK.P }, { p: [0.1, 0, 0], r: 0.22, c: CPK.P }, { p: [0.5, 0, 0.12], r: 0.2, c: CPK.C }, { p: [0.92, 0, 0.28], r: 0.26, c: CPK.N }], bonds: [[0, 1], [1, 2], [2, 3], [3, 4]] },
};

// ── organelles ──
const CHLORO = [-4.7, 0, 0], MITO = [4.7, 0, 0];
function chloroplast() {
  const out = [...scaleFaces(sphereFaces([0, 0, 0], 1, '#3fa34d', 'chloroplast', 18, 12), [1.35, 1.05, 2.15]).map((f) => ({ ...f, corners: f.corners.map((c) => add(c, CHLORO)) }))];
  for (const sx of [-0.5, 0.5]) for (let k = -1; k <= 1; k++) out.push(...scaleFaces(sphereFaces([0, 0, 0], 1, '#2f7d3a', 'chloroplast', 12, 8), [0.42, 0.42, 0.12]).map((f) => ({ ...f, corners: f.corners.map((c) => add(c, add(CHLORO, [sx, 0.2, k * 0.42]))) })));
  return out;
}
function mitochondrion() {
  const out = [...scaleFaces(sphereFaces([0, 0, 0], 1, '#d98a3d', 'mitochondrion', 18, 12), [1.25, 1.05, 2.1]).map((f) => ({ ...f, corners: f.corners.map((c) => add(c, MITO)) }))];
  const pts = Array.from({ length: 22 }, (_, i) => { const t = i / 21; return add(MITO, [Math.sin(t * TAU * 1.5) * 0.55, 0.15, (t - 0.5) * 3.1]); });
  for (let i = 0; i < pts.length - 1; i++) out.push(...rodFaces(pts[i], pts[i + 1], 0.12, '#aa5a26', 'mitochondrion', 7));
  return out;
}
function sunlight() {
  const sun = [-9.5, -1.2, 6], out = [...sphereFaces(sun, 0.8, '#ffd23a', 'sun', 16, 10)];
  for (let k = -1; k <= 1; k++) out.push(...rodFaces(add(sun, [0.4, 0, -0.3]), add(CHLORO, [-0.6, 0, 1.4 + k * 0.7]), 0.05, '#ffe27a', 'sun', 6));
  return out;
}

const arcPath = (S, E, bow, n = 46) => Array.from({ length: n }, (_, i) => { const t = i / (n - 1); const p = lerp(S, E, t); return [p[0], p[1], p[2] + Math.sin(Math.PI * t) * bow]; });
const TOP_S = add(CHLORO, [1.6, 0, 1.9]), TOP_E = add(MITO, [-1.6, 0, 1.9]);
const BOT_S = add(MITO, [-1.6, 0, -1.9]), BOT_E = add(CHLORO, [1.6, 0, -1.9]);
const TOP = arcPath(TOP_S, TOP_E, 0.9), TOP2 = arcPath(add(TOP_S, [0.2, 0, -0.75]), add(TOP_E, [0.2, 0, -0.75]), 0.9);
const BOT = arcPath(BOT_S, BOT_E, -0.9), BOT2 = arcPath(add(BOT_S, [-0.2, 0, 0.75]), add(BOT_E, [-0.2, 0, 0.75]), -0.9);
const ATP_RISE = arcPath(add(MITO, [1.4, 0, 1.2]), add(MITO, [2.3, 0, 3.0]), 0.2);

// the timed cascade (seconds on the shared clock). speed scales every t0/t1.
function sequence(speed = 1) {
  const t = (v) => +(v / speed).toFixed(3);
  return [
    { key: 'glucose', group: 'm-glucose', label: 'Glucose (C₆H₁₂O₆)', path: TOP, t0: t(0.0), t1: t(2.5), vanish: true },
    { key: 'O2', group: 'm-o2', label: 'Oxygen (O₂)', path: TOP2, t0: t(0.35), t1: t(2.85), vanish: true },
    { key: 'ATP', group: 'm-atp', label: 'ATP — usable energy', path: ATP_RISE, t0: t(2.7), t1: t(3.7), vanish: false },
    { key: 'CO2', group: 'm-co2', label: 'Carbon dioxide (CO₂)', path: BOT, t0: t(2.9), t1: t(5.3), vanish: true },
    { key: 'H2O', group: 'm-h2o', label: 'Water (H₂O)', path: BOT2, t0: t(3.1), t1: t(5.5), vanish: true },
  ];
}
const arcGuide = (pts, color, group = 'guide') => { const out = []; for (let i = 0; i < pts.length - 1; i++) out.push(...rodFaces(pts[i], pts[i + 1], 0.035, color, group, 5)); return out; };

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Resolve a recipe into a placed face list + movers + picks. Pure. Reused by the route and tests. */
export function planEnergyCycle(recipe = {}) {
  const speed = Number.isFinite(+recipe.speed) ? Math.min(4, Math.max(0.25, +recipe.speed)) : 1;
  const seq = sequence(speed);
  const faces = [
    ...arcGuide(TOP, '#36456a'), ...arcGuide(BOT, '#36456a'),
    ...chloroplast(), ...mitochondrion(), ...sunlight(),
    ...seq.flatMap((m) => translate(molecule({ ...MOL[m.key], group: m.group }), m.path[0])),
  ];
  const movers = seq.map((m) => ({ group: m.group, basePos: m.path[0], path: m.path, t0: m.t0, t1: m.t1, vanish: m.vanish }));
  const picks = [
    { name: 'chloroplast', kind: 'organelle', label: 'Chloroplast', fields: [{ k: 'process', v: 'photosynthesis' }, { k: 'reaction', v: '6 CO₂ + 6 H₂O + light → glucose + 6 O₂' }, { k: 'found in', v: 'plant cells' }] },
    { name: 'mitochondrion', kind: 'organelle', label: 'Mitochondrion', fields: [{ k: 'process', v: 'cellular respiration' }, { k: 'reaction', v: 'glucose + 6 O₂ → 6 CO₂ + 6 H₂O + ATP' }, { k: 'found in', v: 'plant AND animal cells' }] },
    ...seq.map((m) => ({ name: m.group, kind: 'molecule', label: m.label, fields: [] })),
  ];
  return { faces, movers, picks };
}

/** Resolve a recipe into the emitThreeWorld payload. The world route calls this. Orbit-only. */
export function assembleEnergyCycleScene(recipe = {}, { title } = {}) {
  const plan = planEnergyCycle(recipe);
  const cameras = [
    { name: 'angle', worldFraming: { cameraPosition: [0.5, -20, 6.5], lookAt: [0, 0, 0], horizontalFov: 46 } },
    { name: 'front', worldFraming: { cameraPosition: [0, -22, 1.5], lookAt: [0, 0, 0], horizontalFov: 44 } },
  ];
  const bg = (recipe.scene && HEX.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#070b16';
  return {
    faces: plan.faces,
    movers: plan.movers,
    picks: plan.picks,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1240, height: 720 },
    title: title || recipe.title || 'mojulo energy cycle',
    bg,
    glow: false,
  };
}
