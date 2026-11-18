/**
 * THE PATH, DESIGNED FROM THE TOP DOWN (docs/side-map-principles.md "The lane is a thing"): an across run's floor is not
 * one smooth trail, and its changes are considered, never scattered. It is designed in three levels, each from the one
 * above it, every one on the run's own BAY GRID (the back wall's: a bay a screen and a quarter wide, a pillar between
 * bays and a seam down each, dress.js), so the floor keeps the walls' rhythm.
 *
 *   the PROFILE   the run's shape, from what it is in the stage and where it leads (PATH_PROFILES, a row a profile): what
 *                 happens at each PILLAR and at each SEAM (a word a kind of place, in turn) and one HEIGHT for the whole
 *                 run (its module, a share of the hero's jump: a run's steps are all one rise, as a stair's are)
 *   the PLACES    where a change may stand: a bay's edge (its pillar) or its middle (its seam), never within a landing's
 *                 length of a pit's lip or on a dash's runway (what the course teaches stays as it was)
 *   the FEATURES  the pattern's words, at its places in turn: `up` and `down` (a step of the module), `block` (a raised
 *                 stretch on the seam, a third of the bay wide: up, along, down); toward a climb a run's steps go up,
 *                 toward a drop down; a step that would leave the frame the camera holds (a sixth of a screen under the
 *                 way in to a quarter over it) turns back
 *
 *   PATH_PROFILES
 *   bayGrid(length, W) → { n, width }   the run's bays (dress.js lays its pillars and seams on the same grid)
 *   shapeRun(floors, { role, toward, W, H, J, gaps, length?, stepUp? }) →   (stepUp: what the body steps up unasked) { floors, steps: [{ s, dz }] }
 *     floors  the run's floors as the course laid them ({ s0, s1, z }, the pits between), each cut where a feature
 *             changes its height, every floor after a feature at its new height (a pit keeps its own rise)
 *     steps   each change where it stands (metres along the run)
 *
 * Pure: no dice. The same run is the same path.
 */
export const PATH_PROFILES = Object.freeze({
  rest: Object.freeze({ says: 'a breath: low terraces walked up, never jumped (nothing asked), up at each seam and down at the pillar after', seams: ['up'], pillars: ['down'], rise: 'walk' }),
  basic: Object.freeze({ says: 'rolling ground: a step up at every seam, down at every pillar', seams: ['up'], pillars: ['down'], rise: 0.5 }),
  meet: Object.freeze({ says: 'terraces to fight on: a raised block on every seam to shoot from, the floor between level', seams: ['block'], pillars: [], rise: 0.55 }),
  advanced: Object.freeze({ says: 'the dash\'s runways kept level: a step at each pillar, up then down', seams: [], pillars: ['up', 'down'], rise: 0.45 }),
  gauntlet: Object.freeze({ says: 'broken ground: a block on every seam, a step at every pillar, up then down', seams: ['block'], pillars: ['up', 'down'], rise: 0.6 }),
  landing: Object.freeze({ says: 'wide and flat after one rise: a place to stand and look', first: 'up', seams: [], pillars: [], rise: 0.4 }),
  boss: Object.freeze({ says: 'one long floor for the fight', seams: [], pillars: [], rise: 0 }),
  run: Object.freeze({ says: 'rolling ground', seams: ['up'], pillars: ['down'], rise: 0.45 }),
});
// (clear of a pit's lip, either side, and of a dash's runway before its gap)
const CLEAR = 4, RUNWAY = 7;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** A run's bays: as many a screen and a quarter wide as its length holds, at least one. */
export const bayGrid = (length, W) => { const n = Math.max(1, Math.round(length / (1.25 * W))); return { n, width: length / n }; };

/** An across run's floors shaped from the top down. */
export function shapeRun(floors, { role = 'run', toward = 0, W, H, J, gaps = [], length = null, stepUp = 0.35 }) {
  // (a `walk` rise: under what the body steps up by itself, the platform rule's `step`: walked, never jumped)
  const P = PATH_PROFILES[role] ?? PATH_PROFILES.run, lo = -H / 6, hi = H / 4, h = r3(P.rise === 'walk' ? 0.9 * stepUp : J * P.rise);
  const len = length ?? Math.max(...floors.map((f) => f.s1)), G = bayGrid(len, W);
  const onFloor = (u) => floors.some((f) => !f.pillar && u > f.s0 + CLEAR && u < f.s1 - CLEAR);
  const clear = (u) => onFloor(u) && !gaps.some((g) => u > g.s0 - (g.teaches === 'dash' ? RUNWAY : CLEAR) && u < g.s1 + CLEAR);
  // the places on the grid, in order, each a pillar (a bay's edge) or a seam (its middle), its word its kind's own in
  // turn; a landing's one rise at its first place
  const places = [
    ...Array.from({ length: G.n - 1 }, (_, k) => ({ u: (k + 1) * G.width, kind: 'pillars', k })),
    ...Array.from({ length: G.n }, (_, k) => ({ u: (k + 0.5) * G.width, kind: 'seams', k })),
  ].sort((a, b) => a.u - b.u).filter((p) => clear(p.u));
  const changes = [];
  let off = 0, done = false;
  for (const p of places) {
    let word = P.first ? (done ? null : P.first) : P[p.kind][p.k % (P[p.kind].length || 1)];
    if (!word) continue;
    done = true;
    // (a run that leads to a climb steps up, to a drop down)
    if (toward > 0 && word === 'down') word = 'up';
    if (toward < 0 && word === 'up') word = 'down';
    if (word === 'block') {
      const w = G.width / 3;
      if (!clear(p.u - w / 2) || !clear(p.u + w / 2) || off + h > hi) continue;
      changes.push({ s: r3(p.u - w / 2), dz: h }, { s: r3(p.u + w / 2), dz: -h });
      continue;
    }
    let dz = word === 'up' ? h : -h;
    if (off + dz > hi + 1e-9 || off + dz < lo - 1e-9) dz = -dz;
    if (off + dz > hi + 1e-9 || off + dz < lo - 1e-9) continue;
    off += dz;
    changes.push({ s: r3(p.u), dz: r3(dz) });
  }
  // the floors cut at each change, every floor from there on at its new height
  const out = [], steps = [];
  let acc = 0, c = 0;
  changes.sort((a, b) => a.s - b.s);
  for (const f of floors) {
    let s0 = f.s0;
    while (c < changes.length && changes[c].s < f.s1 && changes[c].s >= f.s0) {
      const ch = changes[c++];
      if (ch.s - s0 > 1e-3) out.push({ ...f, s0: r3(s0), s1: r3(ch.s), z: r3(f.z + acc) });
      acc += ch.dz; s0 = ch.s;
      steps.push({ s: r3(ch.s), dz: ch.dz });
    }
    out.push({ ...f, s0: r3(s0), s1: f.s1, z: r3(f.z + acc) });
  }
  return { floors: out, steps };
}
