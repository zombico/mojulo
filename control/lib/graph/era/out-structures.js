/**
 * STRUCTURES — what every building in an outdoor town answers to, whatever its style: the USES (programmes: what a
 * building holds and offers the lane, never a shape), the RINGS and the EYE SPOT (a part is geometry at a ring only
 * where its least span covers 12 frame px at the ring's read distance; smaller marks go into the tile, smaller things
 * on the silhouette are not built), the laws of SCALE (storey, door, one leads, value order, eye spot, budget,
 * programme) and the STREET (frontage, by cause, repeat-adjacent, corner, accent, focus, distinct radius), the
 * coverings' least pitch and courses, a kit's CRAFT (the chunk its members are fattened by, and the anchor structure
 * its towns are spoken from), and the GEOMETRY the pieces are made of.
 *
 * There is no house shape here. A town's style is decompiled from one anchor structure (era/out-anchor-structure.js)
 * and every building is that language spoken on its lot. Values only: colour is the paint's (era/out-structures-paint.js).
 *
 * Frame: metres, x along the lane frontage, y back from the lot's front edge, z up, right-handed; the lane side is −y.
 * Pure; seeded dice only.
 */
import { baseOf } from './style/looks.js';
import { EYE_SPOT_PX, metresPerPixel } from '../playscape/objects/laws.js';

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r3 = (x) => Math.round(x * 1000) / 1000 + 0;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const subSeed = (seed, key) => { let h = (seed >>> 0) ^ 0x9e3779b9; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0; return (h % 99998) + 1; };
const isRange = (v) => Array.isArray(v) && typeof v[0] === 'number';
const isWords = (v) => Array.isArray(v) && typeof v[0] === 'string';
function dice(seed) {
  const R = mulberry32(seed);
  const roll = (v) => (isWords(v) ? v[Math.floor(R() * v.length)] : isRange(v) ? (v[2] === 'i' ? v[0] + Math.floor(R() * (v[1] - v[0] + 1)) : r3(v[0] + (v[1] - v[0]) * R())) : v);
  return { R, roll };
}
export const showRail = (v) => (isWords(v) ? [...new Set(v)].join(' | ') : isRange(v) ? `${v[0]}–${v[1]}${v[2] === 'i' ? ' (whole)' : ''}` : String(v));
const within = (v, [lo, hi]) => v >= lo - 1e-9 && v <= hi + 1e-9;

// ── the town this index is tuned toward ─────────────────────────────────────────────────────────────────────────────
export const STRUCTURE_TARGET = Object.freeze({
  kit: 'isekai-meadow',
  read: 'a trail village spoken from one anchor structure, twenty to forty roofs: the lane follows the trail and its lots are cut from the frontage; a square opens at the reveal with the hall at its back; a tower stands at the landmark; workshops and barns sit at the trailhead end where the carts come in; houses thin into farmsteads in the far ring',
  scale: 'chunky sixth-gen proportions: members fattened by the kit\'s chunk so they read at walking distance, a person\'s door and window everywhere a person meets the building',
  materials: 'whatever the anchor is built of, in values: the paint colours it; one accent on the whole street, the focus\'s door',
});

// ── rings: how far off the walk a building stands, and the distance it is read from ─────────────────────────────────
/** `off` the band of distance from the walk (m); `read` the distance the eye meets it at; `budget` triangles. */
export const STRUCTURE_RINGS = Object.freeze({
  near: { off: [0, 14], read: 6, budget: 640, gain: 1 },
  mid: { off: [14, 40], read: 24, budget: 200, gain: 0.5 },
  far: { off: [40, 400], read: 72, budget: 60, gain: 0 },
});
export const STRUCTURE_RING_IDS = Object.freeze(Object.keys(STRUCTURE_RINGS));
/** The eye spot at a ring: the least span (m) a part must cover to be geometry there. */
export const eyeSpot = (ring) => r3(EYE_SPOT_PX * metresPerPixel(STRUCTURE_RINGS[ring].read));
export const ringOf = (off) => STRUCTURE_RING_IDS.find((k) => off < STRUCTURE_RINGS[k].off[1]) ?? 'far';

// ── materials ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** Roof coverings: the least pitch each sheds water at, and how thick its edge reads. */
export const COVERINGS = Object.freeze({
  thatch: { min: 45, thick: 0.34, course: 0, cap: 0.42, value: 0.35, read: 'straw laid thick: steep, deep at the eave, round at the corners; no courses, a rolled ridge' },
  tile: { min: 30, thick: 0.12, course: 0.34, cap: 0.26, value: 0.5, read: 'fired clay in courses: warm, a crisp edge, every course a shadow line, a ridge of half-round tiles' },
  shingle: { min: 26, thick: 0.1, course: 0.24, cap: 0.18, value: 0.42, read: 'split timber in courses: greys as it weathers, close courses, a boarded ridge' },
  slate: { min: 25, thick: 0.08, course: 0.22, cap: 0.16, value: 0.4, read: 'split stone: thin, hard-edged, cold, the closest courses, a lead or stone ridge' },
});

/**
 * THE USES: programmes. `area` the floor area it needs (m²), `storeys` and `storeyH` its rails, `door` the way in
 * (w, h), `lot` the least lot it fits, `hearth` a chimney, `windows` the share of bays lit, `counter` a ground floor
 * open to the lane, `focus` it faces the lane with its biggest single shape (its gable), `dare` it is there to be
 * seen from far, `arched` its door and lights are round-headed.
 */
export const STRUCTURE_USES = Object.freeze({
  dwelling: { read: 'a household: rooms over rooms round a hearth, a window to every lived side', area: [55, 110], storeys: [1, 2, 'i'], storeyH: [2.7, 3.2], door: { w: [1, 1.15], h: [2.1, 2.3] }, lot: { w: 5.5, d: 10 }, hearth: true, windows: 1, porch: true },
  shop: { read: 'a household over a counter: the ground floor opens to the lane, a sign says what is sold', area: [80, 140], storeys: [2, 3, 'i'], storeyH: [2.8, 3.3], door: { w: [1, 1.15], h: [2.1, 2.3] }, lot: { w: 5.5, d: 12 }, hearth: true, windows: 1, counter: true },
  workshop: { read: 'a work floor behind a wide door: tall, a few high lights, a hearth for the work', area: [45, 90], storeys: [1, 1, 'i'], storeyH: [3.6, 4.4], door: { w: [2.2, 2.7], h: [2.6, 3] }, lot: { w: 7, d: 10 }, hearth: true, windows: 0.5, work: true },
  barn: { read: 'a floor for carts under a great roof: one great door in the gable, where the wall is tallest; a loft (it counts half its floor); no hearth', loft: true, gableEnd: true, area: [70, 150], storeys: [1, 1, 'i'], storeyH: [3.8, 4.6], door: { w: [2.8, 3.3], h: [3, 3.4] }, lot: { w: 9, d: 11 }, hearth: false, windows: 0.25, work: true },
  hall: { read: 'where the village gathers: one tall room (aisled when it is wider than the timber spans), a door that says so, a round in the gable', area: [80, 150], storeys: [1, 1, 'i'], storeyH: [6.5, 9], door: { w: [1.6, 2], h: [3, 3.5] }, lot: { w: 9, d: 14 }, hearth: false, windows: 1, focus: true, arched: true },
  tower: { read: 'height seen from the trail: a stair round a square core, a lookout under the roof', side: [4.2, 5.4], storeys: [3, 5, 'i'], storeyH: [2.8, 3.2], door: { w: [1, 1.15], h: [2.1, 2.3] }, lot: { w: 5.5, d: 6 }, hearth: false, windows: 0.5, dare: true, arched: true },
});
export const STRUCTURE_USE_IDS = Object.freeze(Object.keys(STRUCTURE_USES));

/**
 * THE LAWS. `layer` body (it stands and sheds), read (it reads as one thing at its ring) or street (checked on a
 * street, where buildings stand together). `test(m)` reads a design's measures.
 */
export const STRUCTURE_LAWS = Object.freeze([
  { id: 'storey', layer: 'body', want: 'every storey inside its use\'s height: lived 2.7–3.3 m, worked 3.6–4.6 m, gathered 6.5–9 m', why: 'a person and a ceiling over them; the work floor and the hall are taller because of what happens in them', test: (m) => within(m.storeyH, m.use.storeyH), show: (m) => m.storeyH, era: 'scale' },
  { id: 'door', layer: 'body', want: 'the way in inside its use\'s door, on the lane side', why: 'the door is the scale reference: a wrong door makes the whole building a toy', test: (m) => within(m.door.w, m.use.door.w) && within(m.door.h, m.use.door.h) && m.door.side === 'front', show: (m) => `${m.door.w} × ${m.door.h} ${m.door.side}` },
  { id: 'one-leads', layer: 'read', want: 'the main mass ≥ 60 % of the built volume; every other ridge ≥ 0.4 m under its ridge', why: 'one shape with things added, never a pile of equals: the 66 of 33/66', test: (m) => m.lead >= 0.6 - 1e-9 && m.under >= 0.4 - 1e-9, show: (m) => `${m.lead}, ${m.under === Infinity ? '—' : m.under}`, era: 'thirty-three' },
  { id: 'value-order', layer: 'read', want: 'in values: wall (or shell) lighter than its roof (or its lights), those lighter than an opening (the paint must keep it)', why: 'the building reads in three values under any look: field, cap, holes', test: (m) => m.values[0] > m.values[1] && m.values[1] > m.values[2], show: (m) => m.values.join(' > '), era: 'value-order' },
  { id: 'eye-spot', layer: 'read', want: 'every part built as geometry spans ≥ the eye spot at its ring', why: 'smaller detail is noise at that distance: it lives in the tile or it is not there', test: (m) => m.leastPart >= m.eye - 1e-9, show: (m) => `${m.leastPart} ≥ ${m.eye}`, era: 'detail-in-tile' },
  { id: 'budget', layer: 'read', want: 'triangles inside the ring\'s budget (near 640, mid 200, far 60; a focus or a landmark the next ring in\'s)', why: 'a village is many buildings: each costs what its distance can afford', test: (m) => m.tris <= m.budget, show: (m) => `${m.tris} / ${m.budget}`, era: 'vertex-density' },
  { id: 'programme', layer: 'read', want: 'the floor holds ≥ 85 % of what the use needs', why: 'a lot too small for its use says so rather than lying about its rooms (advisory)', test: (m) => m.held >= 0.85 - 1e-9, show: (m) => `${m.floor} of ${m.need} m²` },
  { id: 'frontage', layer: 'street', want: 'every door faces the lane it was cut from', why: 'the lane is the spine: a building turns to the way people come', era: 'subject-line' },
  { id: 'by-cause', layer: 'street', want: 'counters within 26 m of the square; work and carts at the trailhead end', why: 'things are where their cause is: trade where people stop, carts where they come in', era: 'by-cause' },
  { id: 'repeat-adjacent', layer: 'street', want: 'no two neighbours in the near ring alike in turn, height, upper wall, covering and roof form', why: 'a run reads as a run only if each answers the last', era: 'repeat-adjacent' },
  { id: 'corner', layer: 'street', want: 'a lot on a corner rises a storey or turns its roof', why: 'corners are where the eye turns: the thing there marks it', era: 'corner-things' },
  { id: 'accent', layer: 'street', want: 'exactly one accent on the street: the focus\'s door', why: 'the accent marks the one thing to use; two are none', era: 'accent-wall' },
  { id: 'focus', layer: 'street', want: 'the focus crowns ≥ 1.25 × the street\'s median and ≥ 8 m; the tower ≥ 1.6 ×', why: 'dare height: the thing that matters stands over the run', era: 'dare-height' },
  { id: 'distinct-radius', layer: 'street', want: 'every near design its own; mid repeats in pairs; far is two designs', why: 'distinct inside the radius, repetition outside it', era: 'distinct-radius' },
]);

// ── kit rails ───────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Per kit, its CRAFT: `chunk` (members fattened so they read at walking distance) and `anchor`, the anchor structure its
 * towns are spoken from unless a recipe names another (era/out-anchor-structure.js). Everything else a building is
 * comes from its anchor's language; every colour from the kit's paint.
 */
const STRUCTURE_TOKENS = ['chunk'];
export const CRAFT_TOKENS = Object.freeze(['chunk']);
export const STRUCTURE_RAILS = Object.freeze({
  'isekai-meadow': { chunk: [1.15, 1.35], anchor: 'timber-hall' },
  'isekai-garden': { chunk: [1.15, 1.3], anchor: 'timber-hall' },
  'isekai-sakura': { chunk: [1.1, 1.25], anchor: 'tiered' },
  'isekai-bamboo': { chunk: [1, 1.15], anchor: 'tiered' },
  'nature-trail': { chunk: [1, 1.15], anchor: 'timber-hall' },
  'jungle-mgs3': { chunk: [1, 1.1], anchor: 'timber-hall' },
  'alien-night': { chunk: [1.1, 1.3], anchor: 'shell' },
  'airless-plain': { chunk: [1, 1.2], anchor: 'shell' },
});
export const STRUCTURE_KITS = Object.freeze(Object.keys(STRUCTURE_RAILS));
/** Whether a kit's buildings are indexed (it, or the kit it varies), so it speaks a building language. */
export const hasStructureRails = (kitId) => !!(STRUCTURE_RAILS[kitId] ?? STRUCTURE_RAILS[baseOf(kitId)]);
const kitRails = (kitId) => {
  const R = STRUCTURE_RAILS[kitId] ?? STRUCTURE_RAILS[baseOf(kitId)];
  if (!R) throw new Error(`structures: buildings are indexed for the outdoor kits ${STRUCTURE_KITS.join(', ')} (got '${kitId}')`);
  return R;
};

/** A town's narrowing of its kit's craft: `tokens: { chunk }` inside the kit's rail; anything else refused. */
export function readTown(town, kitId) {
  const R = kitRails(kitId);
  if (town === undefined) return { tokens: {} };
  if (!town || typeof town !== 'object' || Array.isArray(town)) throw new Error('structures: give a town as { tokens? }');
  if ('laws' in town) throw new Error('structures: a town cannot loosen a law; laws are the index\'s');
  if ('swatches' in town) throw new Error('structures: a building is values only; colour is the paint\'s (structurePaint(kitId, { swatches }))');
  for (const k of Object.keys(town)) if (k !== 'tokens') throw new Error(`structures: '${k}' is not a layer a town sets (tokens); a town's style is its anchor structure`);
  const tokens = {};
  for (const [k, v] of Object.entries(town.tokens || {})) {
    if (!STRUCTURE_TOKENS.includes(k)) throw new Error(`structures: '${k}' is not a craft token (${STRUCTURE_TOKENS.join(', ')}); the rest of a building is its anchor's language`);
    const rail = R[k], r = typeof v === 'number' ? [v, v] : v;
    if (!isRange(r) || r[0] > r[1] || r[0] < rail[0] - 1e-9 || r[1] > rail[1] + 1e-9) throw new Error(`structures: ${kitId} allows ${k} ${showRail(rail)} (got ${JSON.stringify(v)})`);
    tokens[k] = r;
  }
  return { tokens };
}

/** A kit's craft, resolved: its tokens rolled by `seed`, a town's narrowing rolled inside them, and its anchor. */
export function structureStyle(kitId, seed = 1, town) {
  const R = kitRails(kitId), M = readTown(town, kitId), tokens = {}, from = {}, rails = {};
  for (const k of STRUCTURE_TOKENS) { rails[k] = M.tokens[k] ?? R[k]; tokens[k] = dice(subSeed(seed, `structure:${k}`)).roll(rails[k]); from[k] = M.tokens[k] ? 'town' : 'kit'; }
  return { kitId, seed, tokens, from, rails, anchor: R.anchor };
}

// ── geometry ────────────────────────────────────────────────────────────────────────────────────────────────────────
// a face: { corners: [[x, y, z], …], normal, part, mat?, value }; corners wind outward (counter-clockwise seen from
// outside). `tile` faces are marks in a wall's texture: drawn, never counted.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function face(out, corners, out3, part, value, extra = {}) {
  corners = corners.map((p) => p.map(r3));
  let n = unit(cross(sub(corners[1], corners[0]), sub(corners[2], corners[0])));
  if (dot(n, out3) < 0) { corners = corners.slice().reverse(); n = n.map((v) => -v); }
  out.push({ corners, normal: n.map(r3), part, value, ...extra });
}
// the four walls of a rect, by side: where it lies, its outward normal, and a point at (u along it, z up, d proud)
const SIDES = {
  front: (x0, y0, x1, y1) => ({ len: x1 - x0, n: [0, -1, 0], at: (u, z, d = 0) => [x0 + u, y0 - d, z] }),
  right: (x0, y0, x1, y1) => ({ len: y1 - y0, n: [1, 0, 0], at: (u, z, d = 0) => [x1 + d, y0 + u, z] }),
  back: (x0, y0, x1, y1) => ({ len: x1 - x0, n: [0, 1, 0], at: (u, z, d = 0) => [x1 - u, y1 + d, z] }),
  left: (x0, y0, x1, y1) => ({ len: y1 - y0, n: [-1, 0, 0], at: (u, z, d = 0) => [x0 - d, y1 - u, z] }),
};
const wallOf = (rect, side) => SIDES[side](...rect);
/** A quad on a wall: u0–u1 along it, z0–z1, `d` proud of it. */
function wallQuad(out, W, u0, u1, z0, z1, d, part, value, extra) {
  face(out, [W.at(u0, z0, d), W.at(u1, z0, d), W.at(u1, z1, d), W.at(u0, z1, d)], W.n, part, value, extra);
}
/** A polygon on a wall from [u, z] points. */
function wallPoly(out, W, pts, d, part, value, extra) { face(out, pts.map(([u, z]) => W.at(u, z, d)), W.n, part, value, extra); }

/**
 * A pitched roof over `rect` [x0, y0, x1, y1], eaves at `ze`, `form` gable | hip | pyramid | shed, its ridge along the
 * rect's long side (or `axis`), `e` overhang, `p` pitch (deg). Returns its ridge height and the faces it pushed
 * (slopes, the gables in `gableMat`, and the covering's edge when `edge` > 0).
 */
function roof(out, rect, ze, { form, axis, e, p, mat, value, gableMat, gableValue, edge = 0, shedHigh = null, low = 'v0', sides = true, courses = null }) {
  const [x0, y0, x1, y1] = rect, t = Math.tan((p * Math.PI) / 180);
  // build with the ridge along u; map (u, v) back to (x, y)
  const alongX = axis === 'x';
  const U0 = alongX ? x0 : y0, U1 = alongX ? x1 : y1, V0 = alongX ? y0 : x0, V1 = alongX ? y1 : x1;
  const P = (u, v, z) => (alongX ? [u, v, z] : [v, u, z]);
  const half = (V1 - V0) / 2, vm = (V0 + V1) / 2, zl = ze - e * t, zr = ze + half * t, mid = P((U0 + U1) / 2, vm, ze);
  const slopes = [];
  const slope = (corners) => { face(out, corners, sub(corners.reduce((s, c) => [s[0] + c[0] / corners.length, s[1] + c[1] / corners.length, s[2] + c[2] / corners.length], [0, 0, 0]), mid), 'roof', value, { mat }); slopes.push(out[out.length - 1]); };
  if (form === 'shed') {
    // one slope falling from the high side to the eave (at V0, or at V1 when `low` is 'v1'); its sides close it
    const zh = shedHigh, rise = zh - ze, tt = rise / (V1 - V0), zlo = ze - e * tt, lo = low === 'v1', vl = lo ? V1 + e : V0 - e, vh = lo ? V0 : V1;
    slope([P(U0 - e, vl, zlo), P(U1 + e, vl, zlo), P(U1 + e, vh, zh), P(U0 - e, vh, zh)]);
    if (sides) for (const u of [U0, U1]) face(out, [P(u, lo ? V1 : V0, ze), P(u, vh, ze), P(u, vh, zh)], P(u === U0 ? -1 : 1, 0, 0), 'wall', gableValue, { mat: gableMat });
    if (edge) face(out, [P(U0 - e, vl, zlo - edge), P(U1 + e, vl, zlo - edge), P(U1 + e, vl, zlo), P(U0 - e, vl, zlo)], P(0, lo ? 1 : -1, 0), 'edge', value * 0.5, { mat });
    if (courses) lay(courses, slopes, Math.atan(tt), mat, value);
    return { ridge: r3(zh), rise: r3(rise) };
  }
  const len = U1 - U0, hip = form === 'pyramid' ? len / 2 : form === 'hip' ? Math.min(half, len / 2) : 0;
  const ra = U0 + hip, rb = U1 - hip;
  const eU0 = U0 - e, eU1 = U1 + e, eV0 = V0 - e, eV1 = V1 + e;
  if (form === 'gable') {
    slope([P(eU0, eV0, zl), P(eU1, eV0, zl), P(eU1, vm, zr), P(eU0, vm, zr)]);
    slope([P(eU1, eV1, zl), P(eU0, eV1, zl), P(eU0, vm, zr), P(eU1, vm, zr)]);
    for (const u of [U0, U1]) face(out, [P(u, V0, ze), P(u, V1, ze), P(u, vm, zr)], P(u === U0 ? -1 : 1, 0, 0), 'wall', gableValue, { mat: gableMat, gable: true });
  } else {
    if (rb - ra > 1e-6) {
      slope([P(eU0, eV0, zl), P(eU1, eV0, zl), P(rb, vm, zr), P(ra, vm, zr)]);
      slope([P(eU1, eV1, zl), P(eU0, eV1, zl), P(ra, vm, zr), P(rb, vm, zr)]);
    } else {
      slope([P(eU0, eV0, zl), P(eU1, eV0, zl), P(ra, vm, zr)]);
      slope([P(eU1, eV1, zl), P(eU0, eV1, zl), P(ra, vm, zr)]);
    }
    slope([P(eU0, eV1, zl), P(eU0, eV0, zl), P(ra, vm, zr)]);
    slope([P(eU1, eV0, zl), P(eU1, eV1, zl), P(rb, vm, zr)]);
  }
  if (edge) {
    // the covering's thickness along the eaves (and the verges of a gable): the roof's edge reads as a band
    for (const v of [eV0, eV1]) face(out, [P(eU0, v, zl - edge), P(eU1, v, zl - edge), P(eU1, v, zl), P(eU0, v, zl)], P(0, v < vm ? -1 : 1, 0), 'edge', value * 0.5, { mat });
    if (form === 'gable') for (const u of [eU0, eU1]) for (const [va, vb] of [[eV0, vm], [vm, eV1]]) { const za = va === vm ? zr : zl, zb = vb === vm ? zr : zl; face(out, [P(u, va, za - edge), P(u, vb, zb - edge), P(u, vb, zb), P(u, va, za)], P(u === eU0 ? -1 : 1, 0, 0), 'edge', value * 0.5, { mat }); }
  }
  if (courses) {
    lay(courses, slopes, (p * Math.PI) / 180, mat, value);
    // the ridge: a cap along it, geometry where it covers the eye spot (`courses.capGeo`), a mark in the tile otherwise
    const c = courses.cap, a = form === 'gable' ? eU0 : ra, b = form === 'gable' ? eU1 : rb;
    if (c > 0 && b - a > 1e-6) {
      const lz = zr - (c / 2) * t + 0.02, top = zr + c * 0.42;
      for (const s of [-1, 1]) {
        const q = [P(a, vm + (s * c) / 2, lz), P(b, vm + (s * c) / 2, lz), P(b, vm, top), P(a, vm, top)];
        if (courses.capGeo) face(out, q, P(0, s, 0.6), 'cap', Math.max(0.05, value - 0.12), { mat });
        else face(courses.out, q, P(0, s, 0.6), 'cap', Math.max(0.05, value - 0.12), { mat, tile: true });
      }
    }
  }
  return { ridge: r3(zr), rise: r3(zr - ze) };
}

/** A convex polygon clipped to lo ≤ z ≤ hi. */
function clipZ(poly, lo, hi) {
  const cut = (pts, keep, at) => {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ka = keep(a[2]), kb = keep(b[2]);
      if (ka) out.push(a);
      if (ka !== kb) { const t = (at - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, at]); }
    }
    return out;
  };
  return cut(cut(poly, (z) => z >= lo, lo), (z) => z <= hi, hi);
}
/**
 * The courses of a covering, laid on its slopes: a course every `course` m up the slope, each casting a shadow line
 * (a quarter of the course, a step darker) on the one under it, so a roof reads as laid at any distance. They are the
 * roof's tile: drawn, never counted.
 */
function lay({ out, course }, slopes, angle, mat, value) {
  if (!course) return;
  const dz = course * Math.sin(angle);
  for (const f of slopes) {
    const zs = f.corners.map((c) => c[2]), lo = Math.min(...zs), hi = Math.max(...zs), n = f.normal;
    for (let z = lo + dz; z < hi - 1e-6; z += dz) {
      const band = clipZ(f.corners, z - dz * 0.26, z);
      if (band.length >= 3) out.push({ corners: band.map((c) => [r3(c[0] + n[0] * 0.012), r3(c[1] + n[1] * 0.012), r3(c[2] + n[2] * 0.012)]), normal: n, part: 'course', value: Math.max(0.05, value - 0.1), mat, tile: true });
    }
  }
}

/** The walls of a storey band over rect from z0 to z1, each side but those `skip`ped. */

// ── curved pieces: shells, lenses, points ─────────────────────────────────────────────────────────────────────────
function shellAt(c, rx, ry, h, z0) {
  const P = (t, f) => [c[0] + rx * Math.cos(f) * Math.cos(t), c[1] + ry * Math.cos(f) * Math.sin(t), z0 + h * Math.sin(f)];
  const N = (t, f) => unit([Math.cos(f) * Math.cos(t) / rx, Math.cos(f) * Math.sin(t) / ry, Math.sin(f) / h]);
  return { P, N, c, rx, ry, h, z0 };
}
function shellFaces(out, S, L, part, value) {
  const top = [S.c[0], S.c[1], S.z0 + S.h], hint = (p) => [(p[0] - S.c[0]) / S.rx ** 2, (p[1] - S.c[1]) / S.ry ** 2, (p[2] - S.z0) / S.h ** 2];
  for (let i = 0; i < L.lat; i++) for (let j = 0; j < L.lon; j++) {
    const ta = (2 * Math.PI * j) / L.lon, tb = (2 * Math.PI * (j + 1)) / L.lon, fa = (i / L.lat) * (Math.PI / 2), fb = ((i + 1) / L.lat) * (Math.PI / 2);
    const q = i === L.lat - 1 ? [S.P(ta, fa), S.P(tb, fa), top] : [S.P(ta, fa), S.P(tb, fa), S.P(tb, fb), S.P(ta, fb)];
    face(out, q, hint(q[0].map((v, k) => (v + q[2][k]) / 2)), part, value);
  }
}
const basis = (n) => { const a = Math.abs(n[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], t1 = unit(cross(n, a)); return [t1, cross(n, t1)]; };
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
/** A lens: a small dome of radius r set into the shell at p, along n (sunk a fifth), or its disc in the tile. */
function lens(out, p, n, r, sides, part, value, rows = 2) {
  const C = add3(p, n, -0.06 * r), [t1, t2] = basis(n), ring = (a, k) => add3(add3(C, n, r * Math.sin(a)), add3(t1, t2, 0).map((_, i) => r * Math.cos(a) * (Math.cos((2 * Math.PI * k) / sides) * t1[i] + Math.sin((2 * Math.PI * k) / sides) * t2[i])));
  // two rows round a near lens; one (a low cone) where the eye sees it from further
  for (let k = 0; k < sides; k++) {
    const a0 = Math.PI / 6, a1 = rows > 1 ? Math.PI / 2.6 : a0;
    if (rows > 1) face(out, [ring(a0, k), ring(a0, k + 1), ring(a1, k + 1), ring(a1, k)], sub(ring(a0, k), C), part, value);
    face(out, [ring(a1, k), ring(a1, k + 1), add3(C, n, r)], sub(ring(a1, k), C), part, value);
  }
}
function disc(out, p, n, r, sides, part, value, extra) { const [t1, t2] = basis(n); face(out, Array.from({ length: sides }, (_, k) => add3(add3(p, n, 0.03), t1.map((_, i) => r * (Math.cos((2 * Math.PI * k) / sides) * t1[i] + Math.sin((2 * Math.PI * k) / sides) * t2[i])))), n, part, value, extra); }
/** A point: a cone of base radius rb, length len, standing out of the shell at p along a (sunk a tenth). */
function point(out, p, a, rb, len, sides, part, value) {
  const B = add3(p, a, -0.1 * len), [t1, t2] = basis(a), tip = add3(B, a, len), ring = (k) => add3(B, t1.map((_, i) => rb * (Math.cos((2 * Math.PI * k) / sides) * t1[i] + Math.sin((2 * Math.PI * k) / sides) * t2[i])));
  for (let k = 0; k < sides; k++) face(out, [ring(k), ring(k + 1), tip], sub(ring(k), B), part, value);
}

/** The geometry the pieces are made of, for the anchor structure's language (era/out-anchor-structure.js). */
export const geometry = Object.freeze({ face, roof, wallOf, wallQuad, wallPoly, SIDES, clipZ, shellAt, shellFaces, lens, disc, point, basis, add3, sub, cross, unit, dot, dice, subSeed, mulberry32, r3, clamp, within });
