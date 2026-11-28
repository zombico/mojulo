/**
 * THE SPECIMENS — what a prospector finds, in space and on Mars: each a row with its name, its kind, its grade and the
 * colour it is drawn in, and its WIREFRAME, drawn by mojulo's own depictors so a find has a shape of its own:
 *
 *   crystal   a gem's natural habit (polygonizer/crystal-optics.js crystalPolytope: its Wulff habit, exact faces)
 *   metal     a native metal's crystal (the cubic system: a cube's faces cut back by an octahedron's, or the other way,
 *             by `habit`, a polytope from their half-spaces)
 *   rock      a stone (form/land-stones.js stoneForms: the rock kernel's chipped block), its creases drawn
 *
 *   SPECIMENS                       the shelf (a new find is a row)
 *   readSpecimen(id, at?)           → the row (throws naming the shelf)
 *   specimenWire(id)                → { lines: [x0, y0, z0, x1, y1, z1, …] (unit size, centred, rounded), kind, colour }
 *
 * Pure and deterministic: the same specimen, the same lines.
 */
import { crystalPolytope, halfspacePolytope } from '../polygonizer/crystal-optics.js';
import { stoneForms } from '../form/land-stones.js';

const f = Object.freeze;
export const SPECIMENS = f({
  // (the belt's: stony, metallic and the rare seam)
  carbonaceous: f({ name: 'Carbonaceous chondrite', kind: 'rock', rock: 'basalt', seed: 7, colour: '#9fb0b8', grade: 'Low grade', about: 'dark, light, rich in carbon and water-bearing clays: cheap ballast' }),
  'nickel-iron': f({ name: 'Nickel-iron', kind: 'metal', habit: 'octahedron', colour: '#c9d3da', grade: 'Good grade', about: 'a metallic body: iron and nickel, the keel of a tow' }),
  platinum: f({ name: 'Platinum-group metals', kind: 'metal', habit: 'cube', colour: '#f1e6c8', grade: 'Rich seam', about: 'platinum, iridium, osmium: what makes a rock worth moving' }),
  // (Mars's and the moons')
  'water-ice': f({ name: 'Water ice', kind: 'crystal', gem: 'calcite', colour: '#bfe6ff', grade: 'Pure', about: 'ice under the regolith: water, air and fuel' }),
  hematite: f({ name: 'Hematite', kind: 'metal', habit: 'octahedron', colour: '#c9787a', grade: 'Good grade', about: 'iron oxide, the red of Mars, smelted for steel' }),
  olivine: f({ name: 'Olivine', kind: 'crystal', gem: 'tourmaline', colour: '#b7d98a', grade: 'Fair', about: 'the green of a basalt plain' }),
  quartz: f({ name: 'Quartz', kind: 'crystal', gem: 'quartz', colour: '#e8eef5', grade: 'Fair', about: 'silica for glass and panels' }),
  sapphire: f({ name: 'Corundum', kind: 'crystal', gem: 'sapphire', colour: '#8fb4ff', grade: 'Gem grade', about: 'a jewel of a find' }),
});

export function readSpecimen(id, at = 'specimen') {
  const S = SPECIMENS[id];
  if (!S) throw new Error(`${at} is a specimen: ${Object.keys(SPECIMENS).join(', ')}`);
  return S;
}

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
// the edges of a polytope's faces, each once
function polyLines(P) {
  const seen = new Set(), out = [];
  for (const F of P.faces) for (let i = 0; i < F.length; i++) {
    const a = F[i], b = F[(i + 1) % F.length], k = a < b ? `${a},${b}` : `${b},${a}`;
    if (seen.has(k)) continue;
    seen.add(k); out.push(...P.vertices[a], ...P.vertices[b]);
  }
  return out;
}
// (the cubic system's forms: a cube {100} cut back by an octahedron {111}, or an octahedron cut back by a cube)
function metalPolytope(habit) {
  const cube = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], s = 1 / Math.sqrt(3);
  const octa = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) octa.push([x * s, y * s, z * s]);
  const [dc, doct] = habit === 'cube' ? [1, 1.45] : [1.15, 1];
  return halfspacePolytope([...cube.map((n) => ({ n, d: dc })), ...octa.map((n) => ({ n, d: doct }))]);
}
// a triangle soup's creases: the edges whose two faces turn by more than `crease` degrees (or with one face)
function creaseLines(pos, crease = 22) {
  const key = (i) => `${Math.round(pos[i] * 1e4)},${Math.round(pos[i + 1] * 1e4)},${Math.round(pos[i + 2] * 1e4)}`;
  const edges = new Map(), cos = Math.cos((crease * Math.PI) / 180);
  for (let t = 0; t + 8 < pos.length; t += 9) {
    const A = [pos[t], pos[t + 1], pos[t + 2]], B = [pos[t + 3], pos[t + 4], pos[t + 5]], C = [pos[t + 6], pos[t + 7], pos[t + 8]];
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n) || 1;
    const N = n.map((x) => x / l), ks = [key(t), key(t + 3), key(t + 6)], ps = [A, B, C];
    for (let e = 0; e < 3; e++) {
      const a = ks[e], b = ks[(e + 1) % 3], k = a < b ? `${a}|${b}` : `${b}|${a}`;
      const E = edges.get(k);
      if (E) E.n.push(N); else edges.set(k, { p: [ps[e], ps[(e + 1) % 3]], n: [N] });
    }
  }
  const out = [];
  for (const E of edges.values()) {
    if (E.n.length === 1 || E.n[0][0] * E.n[1][0] + E.n[0][1] * E.n[1][1] + E.n[0][2] * E.n[1][2] < cos) out.push(...E.p[0], ...E.p[1]);
  }
  return out;
}
// centred and scaled to unit size (its longest extent 1)
function unitLines(L) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < L.length; i++) { const k = i % 3; lo[k] = Math.min(lo[k], L[i]); hi[k] = Math.max(hi[k], L[i]); }
  const mid = lo.map((v, k) => (v + hi[k]) / 2), s = 1 / Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  return L.map((v, i) => r3((v - mid[i % 3]) * s));
}

const memo = new Map();
export function specimenWire(id) {
  if (memo.has(id)) return memo.get(id);
  const S = readSpecimen(id);
  const raw = S.kind === 'crystal' ? polyLines(crystalPolytope(S.gem, { cut: 'natural' }))
    : S.kind === 'metal' ? polyLines(metalPolytope(S.habit))
      : creaseLines(stoneForms({ rock: S.rock, seed: S.seed }).far[0].pos);
  const out = f({ lines: unitLines(raw), kind: S.kind, colour: S.colour });
  memo.set(id, out);
  return out;
}
