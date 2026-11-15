/**
 * THE ARENA MAP, GROWN — a template (templates.js) changed a block at a time under the laws (laws.js). Each pass tries
 * one change on the seed's dice (a wall panel set, lowered or taken; a pillar; a floor panel; a ladder, a ramp, a rail;
 * or a repair: a panel or a pillar on a line the laws call too long) and keeps it only when the map holds its laws no
 * worse: so what comes out is not the template but a map of its kind that the laws allow, and another seed is another
 * map. The laws are the only judge of what is kept.
 *
 *   growArenaMap({ template?, seed?, passes?, kit? }) → { template, seed, map, laws, held, of, complete, passes, furnished, measures }
 *   mapAscii(M, furnished?)   → the map drawn a level at a time, for a readout
 *   mapPieces(M)              → [{ form, at: [x, y, z] (m), … }] every block in metres, for what builds it
 *
 * Pure; seeded dice only.
 */
import { mulberry32 } from '../vegetation/grow.js';
import { CELL, RISE } from './blocks.js';
import { TEMPLATES, TEMPLATE_IDS, seal } from './templates.js';
import { mapLaws, kitOf } from './laws.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const score = (R) => R.laws.reduce((s, l) => s + (l.holds ? 1000 : -10 * Math.min(l.n, 40)), 0) - R.short;

// one change, on the dice; null when the dice ask for nothing
function change(M, rnd, long = []) {
  const pick = (xs) => xs[Math.floor(rnd() * xs.length)], N = structuredClone(M), has = (c) => N.floors.some((f) => f[0] === c[0] && f[1] === c[1] && f[2] === c[2]);
  // A REPAIR: a line over the cap is broken where the dice fall along it, by a wall panel across it or a pillar in it
  if (long.length && rnd() < 0.45) {
    const [a, b] = pick(long), u = 0.2 + rnd() * 0.6, i = Math.round(a[0] + (b[0] - a[0]) * u), j = Math.round(a[1] + (b[1] - a[1]) * u), k = Math.round(a[2] + (b[2] - a[2]) * u);
    if (!has([i, j, k])) return null;
    if (k === 0 && rnd() < 0.3) { if (!N.solids.some((s) => s[0] === i && s[1] === j && s[2] === 0)) N.solids.push([i, j, 0]); return seal(N); }
    const side = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 'e' : 'n', o = side === 'e' ? [i + 1, j, k] : [i, j + 1, k];
    if (!has(o)) return null;
    const at = N.walls.findIndex((w) => w.at[0] === i && w.at[1] === j && w.at[2] === k && w.side === side);
    if (at >= 0) N.walls.splice(at, 1);
    N.walls.push({ at: [i, j, k], side, kind: 'full' });
    return seal(N);
  }
  const k = Math.floor(rnd() * N.nz), i = Math.floor(rnd() * N.nx), j = Math.floor(rnd() * N.ny), d = pick(DIRS), op = rnd();
  const upper = N.floors.filter((f) => f[2] > 0);
  if (op < 0.4) {
    // a wall panel between two floor cells: set, lowered or taken
    const side = rnd() < 0.5 ? 'e' : 'n', b = side === 'e' ? [i + 1, j, k] : [i, j + 1, k];
    if (!has([i, j, k]) || !has(b)) return null;
    const at = N.walls.findIndex((w) => w.at[0] === i && w.at[1] === j && w.at[2] === k && w.side === side), kind = pick(['none', 'low', 'full']);
    if (at >= 0) N.walls.splice(at, 1);
    if (kind !== 'none') N.walls.push({ at: [i, j, k], side, kind });
  } else if (op < 0.55) {
    // a pillar on the ground: stood or taken
    const at = N.solids.findIndex((s) => s[0] === i && s[1] === j && s[2] === 0);
    if (at >= 0) N.solids.splice(at, 1); else N.solids.push([i, j, 0]);
  } else if (op < 0.7) {
    // a floor panel of an upper level: laid beside one that is there, or taken
    if (N.nz < 2) return null;
    const k1 = 1 + Math.floor(rnd() * (N.nz - 1)), at = N.floors.findIndex((f) => f[0] === i && f[1] === j && f[2] === k1);
    if (at >= 0) N.floors.splice(at, 1);
    else if (DIRS.some(([a, b]) => has([i + a, j + b, k1]))) N.floors.push([i, j, k1]);
    else return null;
  } else if (op < 0.82) {
    // a ladder: onto a ledge that is there, or taken
    if (N.ladders.length && rnd() < 0.35) N.ladders.splice(Math.floor(rnd() * N.ladders.length), 1);
    else if (upper.length) { const T = pick(upper); N.ladders.push({ at: [T[0] - d[0], T[1] - d[1], T[2] - 1], dir: d }); }
    else return null;
  } else if (op < 0.92) {
    // a ramp: up to a floor that is there, or taken
    if (N.ramps.length && rnd() < 0.35) N.ramps.splice(Math.floor(rnd() * N.ramps.length), 1);
    else if (upper.length) { const T = pick(upper), run = 2 + Math.floor(rnd() * 2); N.ramps.push({ at: [T[0] - d[0] * run, T[1] - d[1] * run, T[2] - 1], dir: d, run }); }
    else return null;
  } else {
    // a rail on an upper floor's open edge
    if (!upper.length) return null;
    const T = pick(upper), b = [T[0] + d[0], T[1] + d[1], T[2]];
    if (has(b) || b[0] < 0 || b[1] < 0 || b[0] >= N.nx || b[1] >= N.ny) return null;
    const e = d[0] ? { at: [Math.min(T[0], b[0]), T[1], T[2]], side: 'e' } : { at: [T[0], Math.min(T[1], b[1]), T[2]], side: 'n' };
    if (N.walls.some((w) => w.at[0] === e.at[0] && w.at[1] === e.at[1] && w.at[2] === e.at[2] && w.side === e.side)) return null;
    N.walls.push({ ...e, kind: 'low' });
  }
  return seal(N);
}

/** A map grown from a template under the laws (see the header). */
export function growArenaMap({ template = 'courtyard', seed = 1, passes = 160, kit = kitOf() } = {}) {
  const T = TEMPLATES[template];
  if (!T) throw new Error(`arena-map: template is one of ${TEMPLATE_IDS.join(', ')}`);
  const rnd = mulberry32(seed | 0);
  let M = T.build(), R = mapLaws(M, kit), s = score(R), tried = 0, kept = 0;
  for (let p = 0; p < passes; p++) {
    const N = change(M, rnd, R.long);
    if (!N) continue;
    tried++;
    const RN = mapLaws(N, kit), sn = score(RN);
    // (kept when the laws are held no worse: better always, as well half the time, so a map that already holds
    // them still drifts from its template)
    if (sn > s || (sn === s && rnd() < 0.5)) { M = N; R = RN; s = sn; kept++; }
  }
  return { template, seed, map: M, laws: R.laws, held: R.held, of: R.of, complete: R.held === R.of, passes: { asked: passes, tried, kept }, furnished: R.furnished, measures: R.measures };
}

/** The map drawn a level at a time (north up): # a mass, . a floor, / a ramp, H a ladder's foot, S a spawn, a capital a prize, a small letter a small thing. */
export function mapAscii(M, furnished = null) {
  const out = [];
  for (let k = 0; k < M.nz; k++) {
    const g = Array.from({ length: M.ny }, () => Array(M.nx).fill(' '));
    for (const [i, j, kk] of M.floors) if (kk === k) g[j][i] = '.';
    for (const [i, j, kk] of M.solids ?? []) if (kk === k) g[j][i] = '#';
    for (const r of M.ramps ?? []) if (r.at[2] === k) for (let t = 0; t < r.run; t++) { const i = r.at[0] + r.dir[0] * t, j = r.at[1] + r.dir[1] * t; if (g[j]?.[i] !== undefined) g[j][i] = '/'; }
    for (const l of M.ladders ?? []) if (l.at[2] === k && g[l.at[1]]?.[l.at[0]] !== undefined) g[l.at[1]][l.at[0]] = 'H';
    for (const s of furnished?.spawns ?? []) if (s[2] === k) g[s[1]][s[0]] = 'S';
    for (const x of furnished?.items ?? []) if (x.at[2] === k) g[x.at[1]][x.at[0]] = x.major ? x.gives[0].toUpperCase() : x.gives[0];
    out.push(`level ${k}\n${g.reverse().map((r) => r.join('')).join('\n')}`);
  }
  return out.join('\n\n');
}

/** Every block in metres: what a builder of panels lays. */
export function mapPieces(M) {
  const m = (c) => [c[0] * CELL, c[1] * CELL, c[2] * RISE];
  return [
    ...M.floors.map((c) => ({ form: 'floor', at: m(c), size: [CELL, CELL] })),
    ...(M.solids ?? []).map((c) => ({ form: 'solid', at: m(c), size: [CELL, CELL, RISE] })),
    ...(M.walls ?? []).map((w) => ({ form: w.kind === 'low' ? 'low-wall' : 'wall', at: w.side === 'e' ? [(w.at[0] + 1) * CELL, w.at[1] * CELL, w.at[2] * RISE] : [w.at[0] * CELL, (w.at[1] + 1) * CELL, w.at[2] * RISE], along: w.side === 'e' ? 'y' : 'x', length: CELL })),
    ...(M.ramps ?? []).map((r) => ({ form: 'ramp', at: m(r.at), dir: r.dir, length: r.run * CELL, rise: RISE })),
    ...(M.ladders ?? []).map((l) => ({ form: 'ladder', at: m(l.at), dir: l.dir, rise: RISE })),
  ];
}
