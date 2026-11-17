/**
 * A BOUT'S MAP — the arena's laws (laws.js) put to a match's means. A mission's map is crossed once, from a door to a way
 * out; a bout's is fought over again and again by people who are each other's equals, so what the laws grow is shaped
 * for that before and after:
 *
 *   one level         a bout's floor is one floor (its high ground is its towers, stood after: gameworld/tunnel-arena.js)
 *   a start by words  the words still say its kind: lanes (dividers along it, a gap at each end and the middle, so every
 *                     way loops) or a court in the middle with a doorway a side; the laws grow it from there
 *   its guns' reach   the kit the laws size it by is the bout's sight: close quarters the near band alone, long
 *                     sightlines every band, else the near two
 *   sparse            asked bare, the start stands as it is: nothing is grown on a floor the words want open
 *   fair              neither side has the better ground: the half the laws liked best is kept and turned half round
 *                     the centre onto the other, so every panel has its partner; and a turned map is held to the laws
 *                     again (it must stay one ground, walled round), the best of a few seeds kept
 *
 *   BOUT                         its numbers
 *   boutStart(n, { topology, lanes, court, stagger })  → the map the laws start from, n cells a side
 *   boutMap({ n, topology?, lanes?, court?, stagger?, sight?, seed? })  → { map, laws, held, of, seed } grown and turned
 *   pushMap, pushPieces          a campaign's stretch, grown the same way for a push (below)
 *   boutPieces(M, half)          → [{ form: 'wall', u, v, along, length, height, thick? }] its panels and masses in the
 *                                  arena's own frame (the centre at 0, 0), runs joined, its outer wall left to the arena
 *
 * Pure; seeded dice only. A map is remembered by what asked for it: the same ask is the same map.
 */
import { CELL, RISE, LOW } from './blocks.js';
import { blank, seal } from './templates.js';
import { growArenaMap } from './generate.js';
import { mapLaws, kitOf } from './laws.js';

export const BOUT = Object.freeze({ passes: 220, drift: 40, tries: 3, wall: 2.2 });
const SIGHT = Object.freeze({ close: { close: true }, long: { close: true, mid: true, long: true } });

/** The map the laws start from (see the header). */
export function boutStart(n, { topology = 'lanes', lanes = 3, court = 0.33, stagger = false } = {}) {
  const M = blank(n, n, 1), wall = (i, j, side, kind = 'full') => M.walls.push({ at: [i, j, 0], side, kind });
  // (walled round: the arena's own wall stands there; here it is what bounds the ground for the laws)
  for (let k = 0; k < n; k++) { wall(-1, k, 'e'); wall(n - 1, k, 'e'); wall(k, -1, 'n'); wall(k, n - 1, 'n'); }
  const gap = Math.max(1, Math.round(n / 8));
  if (topology === 'ring') {
    const half = Math.max(1, Math.round((court * n) / 2)), a = Math.floor(n / 2) - half, b = Math.ceil(n / 2) + half - 1, mid = Math.floor(n / 2);
    for (let k = a; k <= b; k++) {
      if (Math.abs(k - mid) < gap && k !== a && k !== b) continue;   // a doorway a side
      wall(k, a - 1, 'n'); wall(k, b, 'n'); wall(a - 1, k, 'e'); wall(b, k, 'e');
    }
  } else {
    for (let q = 1; q < lanes; q++) {
      const i = Math.round((q * n) / lanes) - 1, off = stagger ? (q % 2 ? 1 : -1) * Math.round(n / 8) : 0, mid = Math.floor(n / 2) + off;
      for (let j = gap; j < n - gap; j++) if (Math.abs(j - mid) >= gap) wall(i, j, 'e');
    }
  }
  return seal(M);
}

// a map turned half round its centre: the half the laws grew (the rows below the middle) and its partner
function turned(M) {
  const n = M.nx, lower = (j) => j < n / 2, at = (w) => (w.side === 'e' ? { at: [n - 2 - w.at[0], n - 1 - w.at[1], 0], side: 'e', kind: w.kind } : { at: [n - 1 - w.at[0], n - 2 - w.at[1], 0], side: 'n', kind: w.kind });
  const seen = new Set(), walls = [];
  const put = (w) => { const k = `${w.at},${w.side}`; if (!seen.has(k)) { seen.add(k); walls.push(w); } };
  // (a panel on the middle line is its own partner's neighbour: kept with its turn; an 'n' panel's row is the lower of its two)
  for (const w of M.walls) if (w.at[1] < n / 2 - (w.side === 'n' ? 0.5 : 0)) { put({ at: w.at.slice(), side: w.side, kind: w.kind }); put(at(w)); }
  const solids = [];
  for (const c of M.solids ?? []) if (lower(c[1])) { solids.push(c.slice()); solids.push([n - 1 - c[0], n - 1 - c[1], 0]); }
  const mass = new Set(solids.map((c) => `${c[0]},${c[1]}`));
  return seal({ nx: n, ny: n, nz: 1, floors: M.floors.filter((f) => f[2] === 0 && !mass.has(`${f[0]},${f[1]}`)), solids: [...new Map(solids.map((c) => [`${c}`, c])).values()], walls, ramps: [], ladders: [] });
}

const memo = new Map();
/** A bout's map, grown under the laws and turned (see the header). */
export function boutMap({ n, topology = 'lanes', lanes = 3, court = 0.33, stagger = false, sight = null, seed = 1, bare = false } = {}) {
  const key = JSON.stringify([n, topology, lanes, court, stagger, sight, seed, bare]);
  if (memo.has(key)) return memo.get(key);
  const kit = kitOf({ serves: SIGHT[sight] ?? { close: true, mid: true } }), start = boutStart(n, { topology, lanes, court, stagger });
  const holds = (R, id) => R.laws.find((l) => l.law === id).holds;
  // (asked bare, a sparse floor: the words' start as it stands, nothing grown on it)
  if (bare) { const R = mapLaws(start, kit), out = { map: start, laws: R.laws, held: R.held, of: R.of, seed: seed | 0, one: true }; memo.set(key, out); return out; }
  let best = null;
  for (let t = 0; t < BOUT.tries; t++) {
    const s = (seed | 0) + 101 * t, G = growArenaMap({ map: start, seed: s, passes: BOUT.passes, drift: BOUT.drift, kit }), M = turned(G.map), R = mapLaws(M, kit);
    const one = holds(R, 'connected') && holds(R, 'bounded'), cand = { map: M, laws: R.laws, held: R.held, of: R.of, seed: s, one };
    if (!best || (cand.one && !best.one) || (cand.one === best.one && cand.held > best.held)) best = cand;
    if (best.one && best.held === best.of) break;
  }
  // (no turn of any seed stayed one ground: the start itself, which is one by construction)
  if (!best.one) { const R = mapLaws(start, kit); best = { map: start, laws: R.laws, held: R.held, of: R.of, seed: seed | 0, one: true }; }
  memo.set(key, best);
  return best;
}

/** A bout's map as the arena's pieces (see the header). */
export function boutPieces(M, half) {
  // (snapped to 5 cm by its size, its sign kept: a piece and its turned partner land on exactly opposite places, so laid
  // on the land at any centre they stay each other's turn to the millimetre)
  const n = M.nx, s = (2 * half) / n, r2 = (v) => (Math.sign(v) * Math.round(Math.abs(v) * 20)) / 20 + 0, out = [];
  const inner = (M.walls ?? []).filter((w) => (w.side === 'e' ? w.at[0] >= 0 && w.at[0] < n - 1 : w.at[1] >= 0 && w.at[1] < n - 1));
  // runs of panels of one kind along one line, joined
  for (const side of ['e', 'n']) for (const kind of ['full', 'low']) {
    const by = new Map();
    for (const w of inner) if (w.side === side && w.kind === kind) { const line = side === 'e' ? w.at[0] : w.at[1], t = side === 'e' ? w.at[1] : w.at[0]; if (!by.has(line)) by.set(line, []); by.get(line).push(t); }
    for (const [line, ts] of [...by].sort((a, b) => a[0] - b[0])) {
      ts.sort((a, b) => a - b);
      for (let k = 0; k < ts.length;) {
        let e = k; while (e + 1 < ts.length && ts[e + 1] === ts[e] + 1) e++;
        const mid = ((ts[k] + ts[e] + 1) / 2) * s - half, at = (line + 1) * s - half, len = (e - k + 1) * s;
        out.push(side === 'e' ? { form: 'wall', u: r2(at), v: r2(mid), along: 'v', length: r2(len), height: kind === 'low' ? LOW : BOUT.wall } : { form: 'wall', u: r2(mid), v: r2(at), along: 'u', length: r2(len), height: kind === 'low' ? LOW : BOUT.wall });
        k = e + 1;
      }
    }
  }
  // a mass: its cell filled a level high
  for (const [i, j] of M.solids ?? []) out.push({ form: 'wall', u: r2((i + 0.5) * s - half), v: r2((j + 0.5) * s - half), along: 'u', length: r2(s), height: RISE, thick: r2(s) });
  return out;
}

/**
 * A PUSH'S GROUND — the laws put to a campaign's means: the stretch a body fights up, from where it comes on (the
 * near end's middle) to a post that holds it (the far end's middle). A strip `w` cells across and `d` along, grown
 * under the laws for the kit's bands, then held to what a push needs: the post keeps its cover a sidestep away (a full
 * panel across the approach before the cell beside it), the way on and the post's own cell stand clear, and the strip
 * stays one ground, so there is always a way up it. Its edges are open land: the walls that bound it for the laws are
 * not built. → { map, laws, held, of, seed }, the best of a few seeds. Remembered by what asked for it.
 */
export const PUSH = Object.freeze({ w: 7, d: [4, 10], passes: 140, drift: 30, tries: 2 });
export function pushMap({ w = PUSH.w, d = 5, side = 1, seed = 1, sight = null } = {}) {
  const key = JSON.stringify(['push', w, d, side, seed, sight]);
  if (memo.has(key)) return memo.get(key);
  const kit = kitOf({ serves: SIGHT[sight] ?? { close: true, mid: true } }), pc = Math.floor(w / 2), entry = [pc, 0], post = [pc, d - 1];
  const M0 = blank(w, d, 1);
  for (let k = 0; k < d; k++) M0.walls.push({ at: [-1, k, 0], side: 'e', kind: 'full' }, { at: [w - 1, k, 0], side: 'e', kind: 'full' });
  for (let k = 0; k < w; k++) M0.walls.push({ at: [k, -1, 0], side: 'n', kind: 'full' }, { at: [k, d - 1, 0], side: 'n', kind: 'full' });
  const coverAt = { at: [Math.max(0, Math.min(w - 1, pc + side)), d - 2, 0], side: 'n', kind: 'full' };
  M0.walls.push(coverAt);
  const start = seal(M0), holds = (R, id) => R.laws.find((l) => l.law === id).holds;
  // what a push needs, put back after the laws have grown it
  const held = (M) => {
    const clear = new Set([`${entry}`, `${post}`]), N = structuredClone(M);
    N.solids = (N.solids ?? []).filter((c) => !clear.has(`${c[0]},${c[1]}`));
    const fl = new Set(N.floors.map((f) => `${f[0]},${f[1]},${f[2]}`));
    for (const c of [entry, post]) if (!fl.has(`${c[0]},${c[1]},0`)) N.floors.push([c[0], c[1], 0]);
    // (no panel across the way straight in front of the post's own cell, and its cover standing beside it)
    N.walls = N.walls.filter((x) => !(x.side === 'n' && x.at[0] === pc && x.at[1] === d - 2));
    if (!N.walls.some((x) => x.side === 'n' && x.at[0] === coverAt.at[0] && x.at[1] === coverAt.at[1])) N.walls.push({ ...coverAt });
    N.floors = N.floors.filter((f) => f[2] === 0); N.ramps = []; N.ladders = []; N.nz = 1;
    return seal(N);
  };
  let best = null;
  for (let t = 0; t < PUSH.tries; t++) {
    const s = (seed | 0) + 211 * t, G = growArenaMap({ map: start, seed: s, passes: PUSH.passes, drift: PUSH.drift, kit }), M = held(G.map), R = mapLaws(M, kit);
    const cand = { map: M, laws: R.laws, held: R.held, of: R.of, seed: s, one: holds(R, 'connected') };
    if (!best || (cand.one && !best.one) || (cand.one === best.one && cand.held > best.held)) best = cand;
  }
  if (!best.one) { const R = mapLaws(start, kit); best = { map: start, laws: R.laws, held: R.held, of: R.of, seed: seed | 0, one: true }; }
  memo.set(key, best);
  return best;
}

/** A push's map as panels in its own frame (`a` across from its middle line, `b` along from where it is come on, m):
 *  [{ a, b, across: true (it lies across the way) | false (along it), length, height }], its masses as short thick
 *  panels, the walls that bound it left out. */
export function pushPieces(M) {
  const w = M.nx, d = M.ny, r2 = (v) => Math.round(v * 100) / 100, out = [];
  for (const x of M.walls ?? []) {
    if (x.side === 'e') { if (x.at[0] < 0 || x.at[0] >= w - 1) continue; out.push({ a: r2((x.at[0] + 1 - w / 2) * CELL), b: r2((x.at[1] + 0.5) * CELL), across: false, length: CELL, height: x.kind === 'low' ? LOW : BOUT.wall }); }
    else { if (x.at[1] < 0 || x.at[1] >= d - 1) continue; out.push({ a: r2((x.at[0] + 0.5 - w / 2) * CELL), b: r2((x.at[1] + 1) * CELL), across: true, length: CELL, height: x.kind === 'low' ? LOW : BOUT.wall }); }
  }
  for (const [i, j] of M.solids ?? []) out.push({ a: r2((i + 0.5 - w / 2) * CELL), b: r2((j + 0.5) * CELL), across: true, length: r2(CELL * 0.8), height: BOUT.wall, thick: r2(CELL * 0.8) });
  return out;
}
export { CELL as BOUT_CELL };
