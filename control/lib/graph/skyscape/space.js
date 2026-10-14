/**
 * WHAT A MAP IS IN SPACE. A pilot's map without the ground: no haze to hide an edge (there is no edge to see, only
 * stars), no ground to clear, no climb a gate must respect. It keeps the rest of a map's contract:
 *
 *   field      where the course or the mission is: a box, its height SPACE.depth of its smaller side
 *   reach      the flyable bound: the field plus room to turn back at top speed, above and below as well as around
 *   horizon    the stars: the World page's space sky (a full-sphere starfield on black), far beyond everything
 *
 * and what fills it:
 *
 *   asteroids  seeded rocks (polygonizer/rock-pool.js, instanced) scattered through the reach, kept clear of the course
 *              and the start by ASTEROIDS.clear (each leg a tube no rock enters); each one a sphere a craft can hit
 *   the course a 3-D loop of ring gates (course.js's look and checkpoints), weaving up and down as well as round, flown
 *              from a start behind the first gate, the last gate the finish (nothing to land on)
 *
 *   planSpace({ field?, craft?, seed? }) → map;   spaceField(map, { asteroids?, seed? }) → field (groundAt below all,
 *   hitAt, asteroids, repeats, report);   planSpaceCourse(map, field, { gates?, laps?, seed? }) → course;
 *   spaceSeat(map, course) → the start;   spaceLaws(map, field, course)
 *
 * Pure, deterministic.
 */
import { pilotEye } from './eye.js';
import { rockPool, rockRepeats } from '../polygonizer/rock-pool.js';
import { makeLight } from '../polygonizer/vexar.js';
import { gnoise, hashSeed } from '../polygonizer/landform.js';
import * as dmath from '../../util/dmath.js';

/** The field when none is asked: SPACE.fieldS s of cruise across; its height a share of its side; the warning (s). */
export const SPACE = Object.freeze({ fieldS: 40, fieldMin: 3000, depth: 0.5, warn: 5 });
/** The asteroids: rocks per km³ of the field by density, their radius (m: median, spread of ln r, bounds), and the
 *  clearance (m) every leg of the course and the start keep from a rock's surface, past the gate's own radius. */
export const ASTEROIDS = Object.freeze({ densities: { none: 0, sparse: 2, field: 6, dense: 15 }, r: { median: 28, sigma: 0.8, min: 6, max: 180 }, clear: 40 });
/** The sun's direction (toward it) on a space map: the rocks are lit by it. */
const SUN = [0.45, -0.35, 0.82];
/** A space gate's ring: wider than an atmosphere's (a gate a second wide at top speed, on these rails). */
const GATE_R = [12, 40];
/** The gates' weave: up and down by this share of the field's half-height. */
const WEAVE = 0.6;

const r2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Errors (strings) for a space map ask. */
export function validateSpace(m = {}, s = {}) {
  const e = [];
  const f = m.field;
  if (f !== undefined && !(Number.isFinite(f) && f >= 1000 && f <= 40000) && !(Array.isArray(f) && f.length === 2 && f.every((v) => Number.isFinite(v) && v >= 1000 && v <= 40000))) e.push('map.field must be metres 1000–40000, or [width, depth]');
  if (s.asteroids !== undefined && !ASTEROIDS.densities[s.asteroids] && ASTEROIDS.densities[s.asteroids] !== 0) e.push(`space.asteroids must be one of ${Object.keys(ASTEROIDS.densities).join(', ')}`);
  if (s.trench !== undefined && typeof s.trench !== 'boolean') e.push('space.trench must be true (a battle station\'s trench to run, trench.js) or false');
  if (s.trench && s.asteroids !== undefined && s.asteroids !== 'none') e.push('space.trench: a station\'s surface has no asteroids over it');
  return e;
}

/** A space map: the field, the reach about it (in three dimensions), the eye's turn circles. */
export function planSpace({ field: fieldAsk, craft = 'fighter', seed = 1 } = {}) {
  const errs = validateSpace({ field: fieldAsk }); if (errs.length) throw new Error(`space: ${errs.join('; ')}`);
  const eye = pilotEye(craft, { lands: false }), c = eye.craft;
  const field = fieldAsk ?? Math.max(SPACE.fieldMin, Math.round(c.cruise * SPACE.fieldS / 100) * 100);
  const [fw, fd] = Array.isArray(field) ? field : [field, field];
  const hz = r2(SPACE.depth * Math.min(fw, fd) / 2);
  const margin = r2(c.max * SPACE.warn + 2 * eye.turn.max);
  const fieldBox = { hx: fw / 2, hy: fd / 2, hz }, reach = { hx: r2(fw / 2 + margin), hy: r2(fd / 2 + margin), hz: r2(hz + margin) };
  return {
    form: 'void', label: 'space: stars all round, nothing underfoot', seed, craft: c, ceiling: reach.hz,
    rings: { field: fieldBox, reach, root: { hx: reach.hx, hy: reach.hy } },
    eye: { turn: eye.turn, rings: eye.rings },
  };
}

/** The field's contents: the asteroids (spheres and their instanced rocks), placed clear of `keep` (legs [a, b, r]). */
export function spaceField(map, { asteroids = 'field', seed = 1, keep = [] } = {}) {
  const R = map.rings.reach, F = map.rings.field, dens = ASTEROIDS.densities[asteroids] ?? ASTEROIDS.densities.field;
  const vol = (8 * F.hx * F.hy * F.hz) / 1e9, n = Math.round(dens * vol);
  let s = hashSeed(`space::${seed}`) || 1;
  const rnd = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => { const u = Math.max(1e-9, rnd()), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const rocks = [];
  for (let k = 0, tries = 0; k < n && tries < 20 * n; tries++) {
    // through the field, thinning into the reach (a field's rocks are where the flying is)
    const ex = 1.15, x = (rnd() * 2 - 1) * F.hx * ex, y = (rnd() * 2 - 1) * F.hy * ex, z = (rnd() * 2 - 1) * F.hz * ex;
    const r = clamp(ASTEROIDS.r.median * Math.exp(ASTEROIDS.r.sigma * gauss()), ASTEROIDS.r.min, ASTEROIDS.r.max);
    if (Math.abs(x) > R.hx || Math.abs(y) > R.hy || Math.abs(z) > R.hz) continue;
    if (keep.some(([a, b, w]) => segDist([x, y, z], a, b) < r + w + ASTEROIDS.clear)) continue;
    if (rocks.some((q) => dmath.hypot(q[0] - x, q[1] - y, q[2] - z) < q[3] + r + 4)) continue;
    rocks.push([r2(x), r2(y), r2(z), r2(r)]); k++;
  }
  const light = makeLight({ direction: SUN.map((v) => -v), ambient: 0.32, diffuse: 0.78 });
  const repeats = rocks.length ? rockRepeats(rockPool({ rock: 'granite', variants: 6, detail: 1, tone: '#7d756c', seed: `space::rocks::${seed}`, light, group: 'asteroids' }), rocks.map(([x, y, z, r]) => ({ x, y, z0: z, size: 2 * r })), { sink: 0, group: 'asteroids' }) : [];
  const hitAt = (x, y, z, pad = 0) => rocks.some((q) => (q[0] - x) ** 2 + (q[1] - y) ** 2 + (q[2] - z) ** 2 <= (q[3] + pad) ** 2);
  return {
    // nothing underfoot: the ground is far below everything (a flying body's ground hook finds none on the page)
    groundAt: () => -1e9, topAt: () => -1e9, pads: [], roofs: [], cityFaces: [], cityRepeats: [], cityFormed: [],
    bounds: { x: [-R.hx, R.hx], y: [-R.hy, R.hy], z: [-R.hz, R.hz], cell: 50 },
    asteroids: rocks, repeats, hitAt,
    report: { asteroids: rocks.length, density: asteroids, wanted: n },
  };
}

/** The distance from a point to a segment, in three dimensions. */
export function segDist(p, a, b) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const t = L2 > 0 ? clamp(((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / L2, 0, 1) : 0;
  return dmath.hypot(p[0] - a[0] - d[0] * t, p[1] - a[1] - d[1] * t, p[2] - a[2] - d[2] * t);
}

/** The gates' radius for a craft. */
export const spaceGateR = (c) => r2(clamp(c.max * 0.2, GATE_R[0], GATE_R[1]));

/**
 * The course in space: the loop through the field (course.js's line, handed in as `ring`, [x, y] points in order), its
 * heights weaving WEAVE of the field's half-height up and down. → { gates, finish: null, laps, open: false, line }
 * (the look and the laws are course.js's, which calls this).
 */
export function spaceHeights(map, ring, seed) {
  const F = map.rings.field, n = ring.length;
  return ring.map((p, i) => r2(WEAVE * F.hz * (0.7 * Math.sin((4 * Math.PI * i) / n + 0.3) + 0.3 * gnoise(i * 0.6, 7.7, seed + 41))));
}

/** Where a space craft starts: SEAT_TURNS turn circles behind the first gate, on the line into it, at its height,
 *  flying at cruise. → { pos, heading, pitch } */
export const SEAT_TURNS = 4;
export function spaceSeat(map, course) {
  const g = course.gates[0], h = g.heading, back = SEAT_TURNS * map.eye.turn.cruise;
  return { pos: [r2(g.at[0] - Math.cos(h) * back), r2(g.at[1] - Math.sin(h) * back), g.at[2]], heading: h, pitch: 0 };
}

/** The legs a field keeps clear: the start's run-in, every gate to the next (round the loop). [a, b, width] */
export function courseTubes(map, course, seat) {
  const G = course.gates, w = G[0].radius, out = [[seat.pos, G[0].at, w]];
  for (let i = 0; i < G.length; i++) out.push([G[i].at, G[(i + 1) % G.length].at, w]);
  return out;
}

/**
 * The space map's laws, advising:
 *   turn-room   the reach holds the warning flown straight and a turn back at top speed, above and below too
 *   clear       no rock within the clearance of any leg or the start
 *   in-reach    every rock and gate inside the reach
 */
export function spaceLaws(map, field, course, seat) {
  const R = map.rings.reach, F = map.rings.field, c = map.craft, need = c.max * SPACE.warn + 2 * map.eye.turn.max;
  const margin = Math.min(R.hx - F.hx, R.hy - F.hy, R.hz - F.hz);
  const tubes = course ? courseTubes(map, course, seat) : [];
  let worst = Infinity; for (const q of field.asteroids) for (const [a, b, w] of tubes) worst = Math.min(worst, segDist(q, a, b) - q[3] - w);
  const inside = (p) => Math.abs(p[0]) <= R.hx && Math.abs(p[1]) <= R.hy && Math.abs(p[2]) <= R.hz;
  return [
    { law: 'turn-room', ok: margin >= need - 1e-6, note: `${r2(margin)} m between the field and the reach's edge; turning back at ${c.max} m/s needs ${r2(need)} m` },
    { law: 'rocks-clear', ok: !tubes.length || worst >= ASTEROIDS.clear - 1e-6, note: tubes.length ? `the nearest rock is ${Number.isFinite(worst) ? r2(worst) : '∞'} m off a leg's ring (at least ${ASTEROIDS.clear})` : 'no course' },
    { law: 'space-in-reach', ok: field.asteroids.every(inside) && (!course || course.gates.every((g) => inside(g.at))), note: `${field.asteroids.length} rocks and the gates inside the reach` },
  ];
}
