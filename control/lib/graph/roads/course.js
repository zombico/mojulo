/**
 * course — a roadway's line as a designer draws one: POINTS OF INTERSECTION (PIs) joined by tangents, each PI rounded
 * by a spiral–arc–spiral curve (alignment.js `curve`), a profile of hills, and ramps on its straights. A closed PI
 * polygon is a lap; an open one is a stage from its first point to its last.
 *
 *   fromPIs({ class, pis: [[x, y, R?], …], closed, z0?, pvis?, elevation?, ramps?, crestK? })   → a course
 *   designRoadway({ class, length, twist, elevation, ramps, crossing, seed })              → a lap, seeded
 *   designStage({ class, length, twist, elevation, ramps, seed })                          → a stage, seeded
 *   roadwayCourse(name | spec)                                                             → a preset or a spec's
 *
 * A course: { class, closed, pis, spec (buildAlignment's), alignment, ramps, crossings, clearance, advisories, width,
 * length }. Advisories say where a dial was held inside its class (a hill clamped to the grade, a corner opened to fit
 * its tangents); nothing refuses but a reading error (an unknown class or ramp, too few points).
 *
 * The curve at a PI is integrated once in its own frame to find its tangent lengths exactly (no spiral series), so a
 * closed polygon closes to integration error; the alignment snaps that onto the start and reports it (`closure`).
 */
import { buildAlignment, curve } from './alignment.js';
import { designClass } from './classes.js';
import { ramp, RAMP_KINDS, lipSpeedBand } from './ramps.js';
import { mulberry32 } from '../vegetation/grow.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const TAU = 2 * Math.PI;
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
export const DECK = 0.9;             // m: a crossing's deck and girders over the lower road's clearance (kart scale)

// a curve's elements at a PI and its tangent length (PI to each tangent point), from its own integration
function cornerAt(R, defl, cls) {
  const D = Math.abs(defl);
  if (D < 1e-4) return { elements: [], T: 0 };
  const Ls = Math.min(cls.spiral(R), 0.5 * D * R);
  const elements = curve({ radius: R, deflection: D, dir: defl < 0 ? 'right' : 'left', spiral: Ls });
  const a = buildAlignment({ elements, sub: 64 }), e = a.at(a.length);   // as finely as the lap it joins
  // the PI is where the entry tangent (y = 0) meets the exit tangent through the end at heading ±D
  const T = Math.abs(e.y) / Math.sin(D);
  return { elements, T: e.x - Math.abs(e.y) / Math.tan(D), Tout: T };
}

/** A course from its PIs (metres, in the level's frame). */
export function fromPIs({ class: className = 'kart', pis, closed = true, z0 = 0, pvis = [], elevation = null, ramps = [], crestK = null, seed = 1 } = {}) {
  const cls = designClass(className), advisories = [];
  if (!Array.isArray(pis) || pis.length < (closed ? 3 : 2)) throw new Error(`roadway: a ${closed ? 'lap' : 'stage'} needs ${closed ? 3 : 2} points or more (pis)`);
  const P = pis.map((p) => [p[0], p[1]]), n = P.length;
  const dir = (a, b) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / d, (b[1] - a[1]) / d, d]; };
  // the corners: a lap's every PI, a stage's inner ones
  const R = pis.map((p) => (Number.isFinite(p[2]) && p[2] > 0 ? p[2] : (cls.rmin + cls.rmax) / 2));
  const isCorner = (i) => closed || (i > 0 && i < n - 1);
  const defl = P.map((p, i) => {
    if (!isCorner(i)) return 0;
    const a = dir(P[(i - 1 + n) % n], p), b = dir(p, P[(i + 1) % n]);
    return Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
  });
  // open a corner (its radius down to the class's tightest) until its tangents fit between its neighbours'
  let corners = R.map((r, i) => (isCorner(i) ? cornerAt(r, defl[i], cls) : { elements: [], T: 0, Tout: 0 }));
  const legs = Array.from({ length: closed ? n : n - 1 }, (_, i) => dir(P[i], P[(i + 1) % n])[2]);
  for (let pass = 0; pass < 40; pass++) {
    let short = false;
    legs.forEach((d, i) => {
      const j = (i + 1) % n, need = (corners[i].Tout ?? 0) + (corners[j].T ?? 0);
      if (need <= d) return;
      short = true;
      for (const k of [i, j]) if (isCorner(k) && R[k] > cls.rmin) { R[k] = Math.max(cls.rmin, R[k] * 0.9); corners[k] = cornerAt(R[k], defl[k], cls); }
    });
    if (!short) break;
  }
  legs.forEach((d, i) => {
    const j = (i + 1) % n, need = (corners[i].Tout ?? 0) + (corners[j].T ?? 0);
    if (need > d + 1e-6) throw new Error(`roadway: the leg from point ${i} to ${j} is ${d.toFixed(1)} m, too short for its corners at the class's tightest radius (${cls.rmin} m)`);
  });
  R.forEach((r, i) => { if (isCorner(i) && pis[i][2] && r < pis[i][2]) advisories.push(`corner ${i} tightened from R ${pis[i][2]} to R ${r3(r)} to fit its legs`); });
  // the elements: from the end of corner 0 (a lap) or the first point (a stage)
  const elements = [];
  const start = closed ? (() => { const d = dir(P[0], P[1]); return [P[0][0] + d[0] * corners[0].Tout, P[0][1] + d[1] * corners[0].Tout]; })() : P[0];
  const heading = Math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0]);
  const order = closed ? [...Array(n).keys()].map((i) => (i + 1) % n) : [...Array(n - 1).keys()].map((i) => i + 1);
  let prev = 0;
  for (const i of order) {
    const d = legs[(i - 1 + n) % n] - (corners[prev].Tout ?? 0) - (corners[i].T ?? 0);
    if (d > 1e-6) elements.push({ type: 'tangent', length: d });
    elements.push(...corners[i].elements);
    prev = i;
  }
  const length = elements.reduce((a, e) => a + e.length, 0);
  // the profile: given PVIs, or hills from the elevation dial
  const hills = elevation ? elevationPVIs({ length, cls, closed, seed, ...elevation }) : { pvis: [], crestK: null, advisories: [] };
  advisories.push(...hills.advisories);
  const tangents = [];
  { let s = 0; for (const e of elements) { if (e.type === 'tangent') tangents.push({ s0: s, s1: s + e.length }); s += e.length; } }
  const placed = placeRamps(ramps, { tangents, length, advisories });
  const spec = {
    start, heading, elements, closed, emax: cls.emax, designSpeed: cls.designSpeed, rmin: cls.rmin, crestK: cls.crestK, sagK: cls.sagK,
    profile: { z0, pvis: [...pvis, ...hills.pvis].sort((a, b) => a.s - b.s), ...(placed.length ? { features: placed } : {}) },
  };
  if (crestK ?? hills.crestK) spec.crestK = crestK ?? hills.crestK;
  const alignment = buildAlignment(spec);
  const top = cls.designSpeed / 3.6 * 1.6;
  const rampsOut = placed.map((f) => ({ kind: f.kind, s0: r3(f.s0), s1: r3(f.s1), lip: f.lip, landing: f.landing, band: lipSpeedBand(f, alignment, top) }));
  return { class: className, closed, pis: P.map((p, i) => [r3(p[0]), r3(p[1]), ...(isCorner(i) ? [r3(R[i])] : [])]), spec, alignment, ramps: rampsOut, width: cls.roadW, footprint: cls.footprint, clearance: cls.clearance, length: r3(alignment.length), advisories };
}

/** Hills over a course: `hills` crests, `amplitude` metres over the sags, jittered by the seed, held inside the class's
 *  grade. `crest: 'sharp'` sizes the crests to fly at three quarters of the design speed (the arcade's air). */
export function elevationPVIs({ length, cls, closed, seed = 1, amplitude = 0, hills = 2, crest = 'smooth' }) {
  const advisories = [], rnd = mulberry32(seed * 2654435761 + 17);
  const m = Math.max(1, Math.round(hills)) * 2, gap = length / m;
  const at = Array.from({ length: m }, (_, i) => (i + 0.5) * gap + (rnd() - 0.5) * gap * 0.3);
  const run = Math.min(...at.map((s, i) => (i ? s - at[i - 1] : s)), length - at[m - 1]);
  let A = Math.max(0, amplitude);
  const cap = cls.gradeMax * 0.85 * run;          // a hill's tangent grade is A over its run; its curves only ease it
  if (A > cap) { advisories.push(`hills held to ${r3(cap)} m over the sags (asked ${A}): the class climbs ${cls.gradeMax * 100}% at most`); A = cap; }
  const pvis = at.map((s, i) => ({ s: r3(s), z: i % 2 ? 0 : r3(A) }));
  let crestK = null;
  if (crest === 'sharp') {
    const v = (cls.designSpeed / 3.6) * 0.75;
    crestK = r3((v * v) / 9.81 / 100);
    for (const p of pvis) if (p.z > 0) p.K = crestK;
  }
  if (!closed && pvis.length) pvis.pop();
  return { pvis, crestK: null, advisories };   // a sharp crest's K rides on its own PVI
}

// ramps on the longest straights, one a straight, clear of the start and finish; a ramp that finds no room is advised
function placeRamps(ramps, { tangents, length, advisories }) {
  const free = tangents.map((t) => ({ ...t, used: false })).sort((a, b) => (b.s1 - b.s0) - (a.s1 - a.s0) || a.s0 - b.s0);
  const out = [];
  for (const r of ramps) {
    const spec = typeof r === 'string' ? { kind: r } : r;
    if (!RAMP_KINDS.includes(spec.kind)) throw new Error(`roadway: ramp '${spec.kind}' is not one of ${RAMP_KINDS.join(', ')}`);
    if (Number.isFinite(spec.at)) { out.push(ramp(spec)); continue; }
    const len = ramp({ ...spec, at: 0 }).length, room = len + 24;
    const t = free.find((x) => !x.used && x.s1 - x.s0 >= room && x.s0 >= 15 && x.s1 <= length - 15);
    if (!t) { advisories.push(`no straight long enough for a ${spec.kind} (${r3(room)} m)`); continue; }
    t.used = true;
    out.push(ramp({ ...spec, at: r3((t.s0 + t.s1) / 2 - len / 2) }));
  }
  return out.sort((a, b) => a.s0 - b.s0);
}

/** Where a course comes near itself: samples every `step` m; a pair further apart along the road than a hairpin and
 *  nearer in plan than the road's width and `margin` is a conflict; where two legs cross, a crossing (its stations and
 *  the height between the two passes). → { minGap, conflicts: [{ s1, s2, d }], crossings: [{ s1, s2, at, dz }] } */
export function selfClearance(alignment, { width, margin = 3, step = 2 } = {}) {
  const L = alignment.length, n = Math.max(8, Math.round(L / step)), pts = Array.from({ length: n }, (_, i) => alignment.at((i * L) / n));
  const reach = width + margin, arcMin = Math.PI * reach, cell = reach;
  const grid = new Map(), key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  pts.forEach((p, i) => { const k = key(p.x, p.y); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); });
  const arc = (i, j) => { const d = Math.abs(pts[i].s - pts[j].s); return alignment.closed ? Math.min(d, L - d) : d; };
  const conflicts = [], crossings = [];
  let minGap = Infinity;
  for (let i = 0; i < n; i++) {
    const p = pts[i], cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell);
    for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) for (const j of grid.get(`${gx},${gy}`) ?? []) {
      if (j <= i || arc(i, j) < arcMin) continue;
      const d = Math.hypot(p.x - pts[j].x, p.y - pts[j].y);
      minGap = Math.min(minGap, d);
      if (d < reach) conflicts.push({ s1: r3(p.s), s2: r3(pts[j].s), d: r3(d) });
    }
  }
  // crossings: segment pairs that intersect in plan
  const seg = (i) => [pts[i], pts[(i + 1) % n]];
  const hit = (a, b, c, d) => {
    const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
    if (Math.abs(den) < 1e-12) return null;
    const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den, u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
    return t >= 0 && t < 1 && u >= 0 && u < 1 ? [t, u] : null;
  };
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (alignment.closed && i === 0 && j === n - 1) continue;
    const [a, b] = seg(i), [c, d] = seg(j);
    if (Math.max(a.x, b.x) < Math.min(c.x, d.x) || Math.max(c.x, d.x) < Math.min(a.x, b.x) || Math.max(a.y, b.y) < Math.min(c.y, d.y) || Math.max(c.y, d.y) < Math.min(a.y, b.y)) continue;
    const tu = hit(a, b, c, d);
    if (!tu) continue;
    const ds = L / n, s1 = a.s + tu[0] * ds, s2 = c.s + tu[1] * ds, z1 = alignment.at(s1).z, z2 = alignment.at(s2).z;
    crossings.push({ s1: r3(s1), s2: r3(s2), at: [r3(a.x + tu[0] * (b.x - a.x)), r3(a.y + tu[0] * (b.y - a.y))], dz: r3(Math.abs(z1 - z2)), upper: z1 >= z2 ? 1 : 2 });
  }
  // a crossing's own near passes are its business, not a conflict
  const near = (c, x) => Math.min(Math.abs(x.s1 - c.s1) + Math.abs(x.s2 - c.s2), Math.abs(x.s1 - c.s2) + Math.abs(x.s2 - c.s1)) < 6 * reach;
  return { minGap: r3(minGap), conflicts: conflicts.filter((x) => !crossings.some((c) => near(c, x))), crossings };
}

/** A course designed from a few words, seeded: a lap of `length` metres (a star of `5 + 5·twist` corners, or with
 *  `crossing` a figure of eight with a bridge at its crossing), its corners from the class's radius band, its hills and
 *  ramps as asked. Tries seeds on from `seed` until the line keeps clear of itself (or advises it could not). */
export function designRoadway({ class: className = 'kart', length = 600, twist = 0.5, elevation = null, ramps = [], crossing = false, seed = 1 } = {}) {
  const cls = designClass(className), tw = Math.max(0, Math.min(1, twist));
  let best = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const rnd = mulberry32((seed + attempt * 7919) >>> 0);
    const shape = crossing ? eightShape(rnd, tw) : starShape(rnd, tw);
    const radii = shape.map(() => cls.rmin + (cls.rmax - cls.rmin) * (0.12 + 0.6 * rnd()) * (1 - 0.5 * tw));
    // scaled until the lap is as long as asked (corners hold their radii, so a few passes)
    let S = length / (2 * Math.PI), course = null;
    for (let k = 0; k < 6; k++) {
      try {
        course = fromPIs({ class: className, pis: shape.map(([x, y], i) => [x * S, y * S, radii[i]]), closed: true, seed, elevation: crossing ? null : elevation, ramps });
      } catch { S *= 1.25; course = null; continue; }
      S *= length / course.length;
    }
    if (!course) continue;
    if (crossing) course = withBridge(course, cls);
    const sc = selfClearance(course.alignment, { width: course.footprint, margin: 1 });
    const ok = !sc.conflicts.length && (crossing ? sc.crossings.length === 1 && sc.crossings[0].dz >= cls.clearance + DECK - 0.05 : !sc.crossings.length);
    const scored = { ...course, design: { class: className, length, twist: tw, seed, attempt }, selfClearance: sc };
    if (ok) return scored;
    best ??= scored;
  }
  return { ...best, advisories: [...best.advisories, 'no seed tried keeps the line clear of itself: the best is kept'] };
}

/** A stage designed from a few words, seeded: a road from one end to the other `length` metres along, meandering by
 *  `twist` (each leg turning up to 25° + 50°·twist, the heading held within 70° of the way on so it never folds back),
 *  its corners from the class's radius band, its hills and ramps as asked. */
export function designStage({ class: className = 'rally', length = 1500, twist = 0.5, elevation = null, ramps = [], seed = 1 } = {}) {
  const cls = designClass(className), tw = Math.max(0, Math.min(1, twist));
  let best = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const rnd = mulberry32((seed * 31 + attempt * 7919) >>> 0);
    const legs = Math.max(4, Math.round(6 + 6 * tw)), turn = ((25 + 50 * tw) * Math.PI) / 180, lim = (70 * Math.PI) / 180;
    let h = 0, x = 0, y = 0;
    const shape = [[0, 0]];
    for (let i = 0; i < legs; i++) {
      h = Math.max(-lim, Math.min(lim, h + (rnd() - 0.5) * 2 * turn));
      const d = 0.7 + 0.6 * rnd();
      x += d * Math.cos(h); y += d * Math.sin(h);
      shape.push([x, y]);
    }
    const radii = shape.map(() => cls.rmin + (cls.rmax - cls.rmin) * (0.15 + 0.6 * rnd()) * (1 - 0.4 * tw));
    let S = length / legs, course = null;
    for (let k = 0; k < 6; k++) {
      try {
        course = fromPIs({ class: className, pis: shape.map(([px, py], i) => [px * S, py * S, radii[i]]), closed: false, seed, elevation, ramps });
      } catch { S *= 1.25; course = null; continue; }
      S *= length / course.length;
    }
    if (!course) continue;
    const sc = selfClearance(course.alignment, { width: course.footprint, margin: 1 });
    const scored = { ...course, design: { class: className, form: 'stage', length, twist: tw, seed, attempt }, selfClearance: sc };
    if (!sc.conflicts.length && !sc.crossings.length) return scored;
    best ??= scored;
  }
  return { ...best, advisories: [...best.advisories, 'no seed tried keeps the line clear of itself: the best is kept'] };
}

// a star-shaped polygon of 5 + 5·twist corners about the origin, radius about 1 (simple by construction)
function starShape(rnd, tw) {
  const n = Math.round(5 + 5 * tw);
  return Array.from({ length: n }, (_, i) => {
    const a = (TAU * i) / n + (rnd() - 0.5) * (TAU / n) * 0.5 * tw, r = 1 + (rnd() - 0.5) * 0.8 * tw;
    return [r * Math.cos(a), r * 0.75 * Math.sin(a)];
  });
}
// a figure of eight: points round a lemniscate, crossing once at the origin
function eightShape(rnd, tw) {
  const n = 8;
  return Array.from({ length: n }, (_, i) => {
    const t = ((i + 0.5) * TAU) / n + (rnd() - 0.5) * 0.15 * tw, d = 1 + Math.sin(t) ** 2;
    return [(1.6 * Math.cos(t)) / d, (1.6 * Math.sin(t) * Math.cos(t)) / d];
  });
}

// a figure of eight's bridge: the first pass over the crossing raised by the class's clearance and a deck, flat over
// the crossing for the other road's width and a margin, ramped at three quarters of the class's grade
function withBridge(course, cls) {
  const sc = selfClearance(course.alignment, { width: course.footprint, margin: 1 });
  if (sc.crossings.length !== 1) return course;
  // the deck spans the lower road's whole footprint (its run-off and barriers too) and a metre each side, measured along
  // the upper road at the crossing's angle (its own footprint's edges cross the lower one further along when oblique)
  const c = sc.crossings[0], th = Math.abs(Math.sin(course.alignment.at(c.s1).heading - course.alignment.at(c.s2).heading));
  const H = r3(cls.clearance + DECK), deck = (cls.footprint + 2) / Math.max(0.3, th) + cls.footprint * Math.sqrt(Math.max(0, 1 - th * th)) / Math.max(0.3, th),
    // each end's vertical curve starts half its length before its PVI: the flat is carried on past the deck by that
    lip = (cls.crestK * cls.gradeMax * 0.75 * 100) / 2, ramp = H / (cls.gradeMax * 0.75);
  const s = c.s1, L = course.length;
  const pvis = [{ s: s - deck / 2 - lip - ramp - lip, z: 0 }, { s: s - deck / 2 - lip, z: H }, { s: s + deck / 2 + lip, z: H }, { s: s + deck / 2 + lip + ramp + lip, z: 0 }]
    .filter((p) => p.s > 0 && p.s < L).map((p) => ({ ...p, s: r3(p.s) }));
  const pis = course.pis;
  return { ...fromPIs({ class: course.class, pis, closed: true, pvis, ramps: [] }), crossingDeck: { s0: r3(s - deck / 2), s1: r3(s + deck / 2), z: H } };
}

/** The named courses callers and tests reach for. */
export const COURSE_PRESETS = Object.freeze({
  // a stadium: two straights and two half circles (the old trail oval's shape, on its own ground)
  'kart-oval': () => fromPIs({ class: 'kart', pis: [[-70, -26, 20], [70, -26, 20], [70, 26, 20], [-70, 26, 20]], closed: true }),
  'kart-sprint': () => designRoadway({ class: 'kart', length: 650, twist: 0.6, seed: 7 }),
  'figure-eight': () => designRoadway({ class: 'kart', length: 760, twist: 0.3, crossing: true, seed: 3 }),
  hillside: () => designRoadway({ class: 'circuit', length: 1800, twist: 0.45, elevation: { amplitude: 14, hills: 3 }, seed: 11 }),
  'stunt-park': () => designRoadway({ class: 'rally', length: 1100, twist: 0.3, elevation: { amplitude: 5, hills: 2, crest: 'sharp' }, ramps: ['kicker', 'tabletop', 'gap', 'whoops'], seed: 5 }),
  // point to point: a gravel special stage over three crests cut to fly
  'rally-stage': () => designStage({ class: 'rally', length: 2000, twist: 0.6, elevation: { amplitude: 12, hills: 3, crest: 'sharp' }, seed: 9 }),
});

/** A course by preset name, or from a spec: `{ pis, … }` (fromPIs), `{ length, … }` (designRoadway), or with
 *  `closed: false` and no points a stage (designStage). */
export function roadwayCourse(what) {
  if (typeof what === 'string') {
    const make = COURSE_PRESETS[what];
    if (!make) throw new Error(`roadway: course '${what}' is not one of ${Object.keys(COURSE_PRESETS).join(', ')}`);
    return { ...make(), preset: what };
  }
  if (what && Array.isArray(what.pis)) return fromPIs(what);
  if (what?.closed === false) { const { closed: _c, ...rest } = what; return designStage(rest); }
  return designRoadway(what ?? {});
}
