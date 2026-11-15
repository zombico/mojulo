/**
 * THE ARENA MAP, GROWN — a template (templates.js) changed a block at a time under the laws (laws.js). Each pass tries
 * one change on the seed's dice (a wall panel set, lowered or taken; a pillar; a floor panel; a ladder, a ramp, a rail;
 * or a repair of what a law names: a line broken by a panel or a pillar, an open edge railed, a ramp cut up to a floor
 * that has none) and keeps it only when the map holds its laws no
 * worse: so what comes out is not the template but a map of its kind that the laws allow, and another seed is another
 * map. The laws are the only judge of what is kept.
 *
 *   growArenaMap({ template?, map?, seed?, passes?, drift?, kit? }) → { template, seed, map, laws, held, of, complete, passes, furnished, measures }
 *     map   a given map in place of a template (a town's cut, a building read): its masses, its water and its fences are
 *           kept as they are, and only what stands on its open ground is grown (`template` then says 'given')
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
function change(M, rnd, mend = null, fixed = null) {
  const pick = (xs) => xs[Math.floor(rnd() * xs.length)], N = structuredClone(M), has = (c) => N.floors.some((f) => f[0] === c[0] && f[1] === c[1] && f[2] === c[2]);
  const wallOn = (a, b, kind) => {
    const e = b[0] !== a[0] ? { at: [Math.min(a[0], b[0]), a[1], a[2]], side: 'e' } : { at: [a[0], Math.min(a[1], b[1]), a[2]], side: 'n' };
    if (fixed && fixed.has(`w${e.at},${e.side}`)) return;
    const at = N.walls.findIndex((w) => w.at[0] === e.at[0] && w.at[1] === e.at[1] && w.at[2] === e.at[2] && w.side === e.side);
    if (at >= 0) N.walls.splice(at, 1);
    N.walls.push({ ...e, kind });
  };
  // THE REPAIRS: each mends what a law names (laws.js `mend`), where the dice fall
  const R = mend ?? { lines: [], rails: [], unwalked: [] }, roll = rnd();
  // an open edge over nothing: railed
  if (R.rails.length && roll < 0.15) { const [c, b] = pick(R.rails); wallOn(c, [b[0], b[1], c[2]], 'low'); return seal(N); }
  // an upper floor no ramp reaches: a ramp up to it, an opening cut in the floor over the ramp where it runs under one
  if (R.unwalked.length && roll < 0.35) {
    const cells = pick(R.unwalked), T = pick(cells), d = pick(DIRS), run = 2, k = T[2] - 1;
    const line = Array.from({ length: run }, (_, t) => [T[0] - d[0] * (run - t), T[1] - d[1] * (run - t), k]), foot = [T[0] - d[0] * (run + 1), T[1] - d[1] * (run + 1), k];
    if ([...line, foot].some((c) => c[0] < 0 || c[1] < 0 || c[0] >= N.nx || c[1] >= N.ny)) return null;
    if (!has(foot) || N.solids.some((s) => s[0] === foot[0] && s[1] === foot[1] && s[2] === k)) return null;
    const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2], path = [foot, ...line, [T[0], T[1], k]];
    N.floors = N.floors.filter((f) => !line.some((c) => f[0] === c[0] && f[1] === c[1] && f[2] === k + 1));
    N.solids = N.solids.filter((s) => !line.some((c) => s[0] === c[0] && s[1] === c[1] && (s[2] === k || s[2] === k + 1)));
    N.ladders = N.ladders.filter((l) => !line.some((c) => same(l.at, c)));
    // (no wall across its line, on either level)
    N.walls = N.walls.filter((w) => !path.slice(0, -1).some((a, t) => { const b = path[t + 1], e = b[0] !== a[0] ? [Math.min(a[0], b[0]), a[1], 'e'] : [a[0], Math.min(a[1], b[1]), 'n']; return w.at[0] === e[0] && w.at[1] === e[1] && w.side === e[2] && (w.at[2] === k || w.at[2] === k + 1); }));
    N.ramps.push({ at: line[0], dir: d, run });
    return seal(N);
  }
  // a line to break: a wall panel across it or a pillar in it; through open air, a pillar from the ground up to it, or
  // a wall at the edge of the floor it leaves
  if (R.lines.length && roll < 0.7) {
    const [a, b] = pick(R.lines), u = 0.15 + rnd() * 0.7, i = Math.round(a[0] + (b[0] - a[0]) * u), j = Math.round(a[1] + (b[1] - a[1]) * u), k = Math.round(a[2] + (b[2] - a[2]) * u);
    const ax = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 0 : 1, step = [0, 0]; step[ax] = Math.sign(b[ax] - a[ax]) || 1;
    const solidAt = (c) => N.solids.some((s) => s[0] === c[0] && s[1] === c[1] && s[2] === c[2]);
    if (has([i, j, k])) {
      if (k === 0 && rnd() < 0.3) { if (!solidAt([i, j, 0])) N.solids.push([i, j, 0]); if (N.nz > 1 && !has([i, j, 1]) && rnd() < 0.5 && !solidAt([i, j, 1])) N.solids.push([i, j, 1]); }
      else wallOn([i, j, k], [i + step[0], j + step[1], k], 'full');
    } else if (k > 0 && has([i, j, 0]) && rnd() < 0.5) { for (let z = 0; z <= k; z++) if (!has([i, j, z]) || z === 0) { if (!solidAt([i, j, z])) N.solids.push([i, j, z]); } }
    else { const e = rnd() < 0.5 ? a : b, s2 = e === a ? step : [-step[0], -step[1]]; wallOn(e, [e[0] + s2[0], e[1] + s2[1], e[2]], 'full'); }
    return seal(N);
  }
  const k = Math.floor(rnd() * N.nz), i = Math.floor(rnd() * N.nx), j = Math.floor(rnd() * N.ny), d = pick(DIRS), op = rnd();
  const upper = N.floors.filter((f) => f[2] > 0);
  if (op < 0.4) {
    // a wall panel between two floor cells: set, lowered or taken
    const side = rnd() < 0.5 ? 'e' : 'n', b = side === 'e' ? [i + 1, j, k] : [i, j + 1, k];
    if (!has([i, j, k]) || !has(b) || (fixed && fixed.has(`w${[i, j, k]},${side}`))) return null;
    const at = N.walls.findIndex((w) => w.at[0] === i && w.at[1] === j && w.at[2] === k && w.side === side), kind = pick(['none', 'low', 'full']);
    if (at >= 0) N.walls.splice(at, 1);
    if (kind !== 'none') N.walls.push({ at: [i, j, k], side, kind });
  } else if (op < 0.55) {
    // a pillar on the ground: stood or taken (never where a given map's own mass or water is)
    if (fixed && fixed.has(`${i},${j},0`)) return null;
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
export function growArenaMap({ template = 'courtyard', map = null, seed = 1, passes = 1500, drift = 120, kit = kitOf() } = {}) {
  const T = map ? null : TEMPLATES[template];
  if (!map && !T) throw new Error(`arena-map: template is one of ${TEMPLATE_IDS.join(', ')}`);
  const rnd = mulberry32(seed | 0);
  // (a GIVEN map, a place read onto the grid (read-town.js, read-geocube.js): what it is made of is kept, its masses,
  // its ground with no floor (water) and its low walls (a fence), and only what stands on its open ground is grown)
  const fixed = map ? new Set([...(map.solids ?? []).map((c) => `${c}`), ...(map.walls ?? []).filter((w) => w.kind === 'low').map((w) => `w${w.at},${w.side}`)]) : null;
  if (map) { const fl = new Set(map.floors.map((c) => `${c}`)); for (let j = 0; j < map.ny; j++) for (let i = 0; i < map.nx; i++) if (!fl.has(`${i},${j},0`)) fixed.add(`${i},${j},0`); }
  let M = map ? seal(structuredClone(map)) : T.build(), R = mapLaws(M, kit), s = score(R), tried = 0, kept = 0;
  // (it stops once every law is held and it has drifted `drift` passes from its template; `passes` is the most it tries)
  let p = 0;
  for (; p < passes && !(R.held === R.of && p >= drift); p++) {
    const N = change(M, rnd, R.mend, fixed);
    if (!N) continue;
    tried++;
    const RN = mapLaws(N, kit), sn = score(RN);
    // (a given map is never cut in two or opened to the outside to hold another law: a place stays one place)
    if (map && ['bounded', 'connected'].some((id) => R.laws.find((l) => l.law === id).holds && !RN.laws.find((l) => l.law === id).holds)) continue;
    // (kept when the laws are held no worse: better always, as well half the time, so a map that already holds
    // them still drifts from its template)
    if (sn > s || (sn === s && rnd() < 0.5)) { M = N; R = RN; s = sn; kept++; }
  }
  return { template: map ? 'given' : template, seed, map: M, laws: R.laws, held: R.held, of: R.of, complete: R.held === R.of, passes: { asked: passes, ran: p, tried, kept }, furnished: R.furnished, measures: R.measures };
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
