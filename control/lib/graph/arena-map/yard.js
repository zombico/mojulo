/**
 * A YARD, DESIGNED PIECE BY PIECE — an open ground laid out under the arena's laws (laws.js) from the things a yard is
 * made of, never from cells: a shipping container (forty feet or twenty, lying either way), a concrete barrier on a
 * line between two places, and what is stood there before the design begins (a parked walker, a building's mass). The
 * yard is fenced on three sides and walled on the fourth by the building it stands before, whose door is its way out.
 *
 * Each pass tries one change on the seed's dice (a container stood, turned, moved or taken; a barrier set or taken; or a
 * repair of what a law names: a long line broken by a container across it) and keeps it only when the yard holds its
 * laws no worse and stays one ground. So what comes out is a yard the laws allow, and another seed is another yard.
 * The laws are the only judge of what is kept.
 *
 *   PIECES                     { <kind>: { about, cells, sight } }: what a yard is made of; a new piece is a row
 *   yardMap(Y)                 → the arena map of a yard's pieces (map.js): its ground, its masses, its barriers, its edge
 *   designYard({ nx, ny, door?, fixed?, seed?, passes?, drift?, kit? }) → { nx, ny, pieces, fixed, map, laws, held, of,
 *                                complete, furnished, lights, passes }
 *     door    the column of the far edge (j = ny - 1, the building's) its way out stands at: kept clear before it
 *     fixed   [{ kind, cells: [[i, j]] }] what stands there already, kept
 *     towers  [{ i, j }] high ground: a deck a level up (TOWER.deck cells a side, its south-west cell at i, j) over open
 *             ground, railed, a stair up to it from the west and one from the east (two ways, as the laws ask);
 *             the design keeps its stairs and their feet clear
 *     lights  [[i, j]] where its floodlights stand: over its prizes (the laws' own measures: the most seen places are
 *             the lit ones), kept apart, each at a corner of its cell
 *
 * Pure; seeded dice only.
 */
import { mulberry32 } from '../vegetation/grow.js';
import { mapLaws, kitOf } from './laws.js';

export const PIECES = Object.freeze({
  'container-40': Object.freeze({ about: 'a forty-foot container: twelve metres of steel, taller than a head', cells: 4, sight: 'stops a line' }),
  'container-20': Object.freeze({ about: 'a twenty-foot container: six metres of it', cells: 2, sight: 'stops a line' }),
  barrier: Object.freeze({ about: 'a concrete barrier on the line between two places: over a knee, under an eye', cells: 0, sight: 'stops a line below it, and a body' }),
});
export const YARD = Object.freeze({ passes: 500, drift: 60, stacks: 36, barriers: 40, lights: 4, apart: 5, clear: 2 });
/** A tower on the grid: its deck's side in cells, its stair's run in cells (it climbs east, onto the deck's south-west cell). */
export const TOWER = Object.freeze({ deck: 2, run: 2 });
/** The cells a tower keeps clear of the yard's pieces: under its deck, its stair, and the landing at its foot. */
export const towerCells = (t) => [...Array.from({ length: TOWER.deck * TOWER.deck }, (_, k) => [t.i + (k % TOWER.deck), t.j + Math.floor(k / TOWER.deck)]), ...Array.from({ length: TOWER.run + 1 }, (_, k) => [t.i - 1 - k, t.j]), ...Array.from({ length: TOWER.run + 1 }, (_, k) => [t.i + TOWER.deck + k, t.j + TOWER.deck - 1])];
const k2 = (i, j) => `${i},${j}`;
const cellsOf = (p) => Array.from({ length: PIECES[p.kind].cells }, (_, t) => (p.along === 'y' ? [p.i, p.j + t] : [p.i + t, p.j]));
const score = (R) => R.laws.reduce((s, l) => s + (l.holds ? 1000 : -10 * Math.min(l.n, 40)), 0) - R.short;

/** The arena map of a yard: every cell ground, a mass where a container or a fixed thing stands, a low wall where a
 *  barrier lies, a fence (a rail) round three sides and the building's wall along the fourth. */
export function yardMap(Y) {
  const { nx, ny } = Y, floors = [], solid = new Set(), walls = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) floors.push([i, j, 0]);
  for (const f of Y.fixed ?? []) for (const c of f.cells) solid.add(k2(...c));
  for (const p of Y.pieces) if (p.kind !== 'barrier') for (const c of cellsOf(p)) solid.add(k2(...c));
  for (let j = 0; j < ny; j++) { walls.push({ at: [-1, j, 0], side: 'e', kind: 'low' }, { at: [nx - 1, j, 0], side: 'e', kind: 'low' }); }
  for (let i = 0; i < nx; i++) { walls.push({ at: [i, -1, 0], side: 'n', kind: 'low' }, { at: [i, ny - 1, 0], side: 'n', kind: 'full' }); }
  for (const p of Y.pieces) if (p.kind === 'barrier') {
    const b = p.side === 'e' ? [p.i + 1, p.j] : [p.i, p.j + 1];
    if (!solid.has(k2(p.i, p.j)) && !solid.has(k2(...b))) walls.push({ at: [p.i, p.j, 0], side: p.side, kind: 'low' });
  }
  // A TOWER: a deck a level up over open ground, railed round but at its stairs' heads; two stairs, since the laws ask
  // two ways onto any high ground: one a ramp from the west onto its south-west cell, one from the east onto its
  // north-east
  const ramps = [];
  for (const t of Y.towers ?? []) {
    const { i, j } = t, n = TOWER.deck;
    for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) floors.push([i + a, j + b, 1]);
    for (let a = 0; a < n; a++) walls.push({ at: [i + a, j - 1, 1], side: 'n', kind: 'low' }, { at: [i + a, j + n - 1, 1], side: 'n', kind: 'low' });
    for (let b = 0; b < n; b++) { if (b < n - 1) walls.push({ at: [i + n - 1, j + b, 1], side: 'e', kind: 'low' }); if (b > 0) walls.push({ at: [i - 1, j + b, 1], side: 'e', kind: 'low' }); }
    ramps.push({ at: [i - TOWER.run, j, 0], dir: [1, 0], run: TOWER.run }, { at: [i + n - 1 + TOWER.run, j + n - 1, 0], dir: [-1, 0], run: TOWER.run });
  }
  return { nx, ny, nz: ramps.length ? 2 : 1, floors, solids: [...solid].map((s) => [...s.split(',').map(Number), 0]), walls, ramps, ladders: [] };
}

/** A yard designed under the laws (see the header). */
export function designYard({ nx, ny, door = null, fixed = [], towers = [], seed = 1, passes = YARD.passes, drift = YARD.drift, kit = kitOf() } = {}) {
  const rnd = mulberry32(seed | 0), pick = (xs) => xs[Math.floor(rnd() * xs.length)];
  // (kept clear: the ground before the way out, so the door is never built over)
  const keep = new Set();
  if (door !== null) for (let j = ny - YARD.clear; j < ny; j++) for (let i = door - 1; i <= door + 1; i++) keep.add(k2(i, j));
  for (const t of towers) { if (t.i - TOWER.run - 1 < 0 || t.i + TOWER.deck + TOWER.run >= nx || t.j < 0 || t.j + TOWER.deck > ny) throw new Error(`arena-map: a tower at ${t.i},${t.j} does not stand in a yard ${nx} by ${ny} with a stair and its foot to its west and to its east`); for (const c of towerCells(t)) keep.add(k2(...c)); }
  const taken = (Y, skip = null) => { const s = new Set(); for (const f of Y.fixed) for (const c of f.cells) s.add(k2(...c)); for (const p of Y.pieces) if (p !== skip && p.kind !== 'barrier') for (const c of cellsOf(p)) s.add(k2(...c)); return s; };
  const fits = (Y, p, skip = null) => { const T = taken(Y, skip); return cellsOf(p).every(([i, j]) => i >= 0 && j >= 0 && i < nx && j < ny && !T.has(k2(i, j)) && !keep.has(k2(i, j))); };
  const count = (Y, f) => Y.pieces.filter(f).length;
  const change = (Y, mend) => {
    const N = { ...Y, pieces: Y.pieces.map((p) => ({ ...p })) }, roll = rnd(), boxes = N.pieces.filter((p) => p.kind !== 'barrier'), bars = N.pieces.filter((p) => p.kind === 'barrier');
    const box = (i, j, along) => ({ kind: rnd() < 0.45 ? 'container-40' : 'container-20', i, j, along, high: rnd() < 0.3 ? 2 : 1 });
    // a line the laws name too long: a container across it, where the dice fall along it
    if (mend && mend.lines.length && roll < 0.45 && boxes.length < YARD.stacks) {
      const [a, b] = pick(mend.lines), u = 0.2 + rnd() * 0.6, i = Math.round(a[0] + (b[0] - a[0]) * u), j = Math.round(a[1] + (b[1] - a[1]) * u);
      const p = box(i, j, Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 'y' : 'x');
      // (laid across the line, its middle on it)
      const half = Math.floor(PIECES[p.kind].cells / 2); if (p.along === 'y') p.j -= half; else p.i -= half;
      if (!fits(N, p)) return null;
      N.pieces.push(p); return N;
    }
    if (roll < 0.62 && boxes.length < YARD.stacks) { const p = box(Math.floor(rnd() * nx), Math.floor(rnd() * ny), rnd() < 0.5 ? 'x' : 'y'); if (!fits(N, p)) return null; N.pieces.push(p); return N; }
    if (roll < 0.78 && bars.length < YARD.barriers) {
      const side = rnd() < 0.5 ? 'e' : 'n', i = Math.floor(rnd() * (nx - (side === 'e' ? 1 : 0))), j = Math.floor(rnd() * (ny - (side === 'n' ? 1 : 0)));
      if (N.pieces.some((p) => p.kind === 'barrier' && p.i === i && p.j === j && p.side === side)) return null;
      N.pieces.push({ kind: 'barrier', i, j, side }); return N;
    }
    if (!N.pieces.length) return null;
    const at = Math.floor(rnd() * N.pieces.length), p = N.pieces[at];
    if (roll < 0.9) { N.pieces.splice(at, 1); return N; }
    if (p.kind === 'barrier') return null;
    // moved a cell, or turned about its first cell
    const q = rnd() < 0.5 ? { ...p, along: p.along === 'y' ? 'x' : 'y' } : { ...p, i: p.i + pick([-1, 0, 1]), j: p.j + pick([-1, 0, 1]) };
    if (!fits(N, q, p)) return null;
    N.pieces[at] = q; return N;
  };
  let Y = { nx, ny, towers: towers.map((t) => ({ i: t.i, j: t.j })), fixed: fixed.map((f) => ({ kind: f.kind, cells: f.cells.map((c) => c.slice()) })), pieces: [] }, M = yardMap(Y), R = mapLaws(M, kit), s = score(R), tried = 0, kept = 0, p = 0;
  const held = (X, id) => X.laws.find((l) => l.law === id).holds;
  for (; p < passes && !(R.held === R.of && p >= drift); p++) {
    const N = change(Y, R.mend);
    if (!N) continue;
    tried++;
    const MN = yardMap(N), RN = mapLaws(MN, kit), sn = score(RN);
    // (a yard is never cut in two to hold another law)
    if (held(R, 'connected') && !held(RN, 'connected')) continue;
    if (sn > s || (sn === s && rnd() < 0.5)) { Y = N; M = MN; R = RN; s = sn; kept++; }
  }
  // THE FLOODLIGHTS: over the yard's prizes, the first the most seen place, kept apart
  const lights = [];
  for (const x of [...R.furnished.items.filter((q) => q.major), ...R.furnished.items.filter((q) => !q.major)]) {
    if (lights.length >= YARD.lights) break;
    if (lights.some((l) => Math.hypot(l[0] - x.at[0], l[1] - x.at[1]) < YARD.apart)) continue;
    lights.push([x.at[0], x.at[1]]);
  }
  return { nx, ny, pieces: Y.pieces, fixed: Y.fixed, towers: Y.towers, map: M, laws: R.laws, held: R.held, of: R.of, complete: R.held === R.of, furnished: R.furnished, lights, passes: { asked: passes, ran: p, tried, kept } };
}

/** A yard drawn as letters, north (the building) at the top: # a container (2 where it is stacked), W what was stood
 *  there, T a tower's deck and / its stair, . ground, with its barriers not shown. */
export function yardAscii(D) {
  const g = Array.from({ length: D.ny }, () => Array(D.nx).fill('.'));
  for (const f of D.fixed) for (const [i, j] of f.cells) g[j][i] = 'W';
  for (const t of D.towers ?? []) towerCells(t).forEach(([i, j], k) => { g[j][i] = k < TOWER.deck * TOWER.deck ? 'T' : (k - TOWER.deck * TOWER.deck) % (TOWER.run + 1) === TOWER.run ? '.' : '/'; });
  for (const p of D.pieces) if (p.kind !== 'barrier') for (const [i, j] of cellsOf(p)) g[j][i] = p.high > 1 ? '2' : '#';
  for (const [i, j] of D.lights ?? []) if (g[j][i] === '.') g[j][i] = '*';
  return g.reverse().map((r) => r.join('')).join('\n');
}
