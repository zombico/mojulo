/**
 * TOWN INTERCEPTORS — what a lived-in town takes on after its routes and buildings are laid: things that are seen and
 * never named (a lamp, a bench, a cart at a work door, barrels at a counter, a woodpile against a gable, a planter by
 * a door, a sign at a fork, a tree in a yard, the market round the well). The room stage's
 * interceptors (era/interceptors.js) are the pattern: each kind is a SITE FINDER over the town map, a GROWER, and an
 * AGGRESSIVENESS from 0 (none) to 1 (every site taken), seeded from the town alone, so a recipe dresses the same way
 * every time. A kind's count is capped, so the budget holds at full aggressiveness.
 *
 * The street's own furniture is the ANCHOR's: the lamp and the post are elements designed with the town's citizen
 * (era/out-anchor-elements.js), built from those elements, at their strides, on the section's footway. Fences and walls
 * are not dress: they are structures, laid out by the town plan (era/out-town.js `boundaries`).
 *
 * Sites are read off the plan, never placed by hand: lamps along the walk's kerb at the lamp's stride (wider down the
 * ranks), posts where the walk meets the square and at each stair, the well at the heart of every
 * place, stalls round it, benches on a place's edges and at the top of a stair looking back over the town, carts at
 * work doors, barrels at counters, woodpiles against a hearth's free gable, planters at lived doors, signs where the trail comes in and where routes fork, trees in back yards and at the
 * square's back corners. A doodad is built in values on surface groups (`dress:timber`, `dress:leaf`, …) and painted by
 * the style guide as a separate concern (era/out-structures-paint.js); one that is under the eye spot at its ring
 * is not there (the dress is near-ring detail; trees reach the mid ring as flora).
 *
 *   readTownDress(dress)                → { lamps, market, … } each 0…1
 *   dressTown(town, style, dress, seed) → { items: [{ kind, at, face, ring, faces }], counts, laws }
 */
import { designFlora } from './out-flora.js';
import { eyeSpot } from './out-structures.js';
import { along, TOWN_CARD } from './out-town.js';
import { build as EB } from './out-anchor-elements.js';

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r3 = (x) => Math.round(x * 1000) / 1000 + 0;
const subSeed = (seed, key) => { let h = (seed >>> 0) ^ 0x9e3779b9; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0; return (h % 99998) + 1; };

/** Each kind: what it reads as, where it grows, how many at most, and its least span (the eye-spot gate). */
export const TOWN_DRESS = Object.freeze({
  lamps: { read: 'the anchor\'s streetlight on the footway by the kerb, at its stride (wider on a branch), sides alternating (it reads by its head)', cap: 24, span: 0.32, def: 0.7 },
  posts: { read: 'the anchor\'s posts where the walk meets the square, either side of each stair, and along a flush walk\'s line (where no kerb keeps the wheel off it)', cap: 72, span: 0.22, def: 0.8 },
  well: { read: 'a well at the heart of every place: a stone ring, two posts, a little roof', cap: 3, span: 1.6, def: 1 },
  market: { read: 'stalls round the square\'s well, facing it: a counter under a striped awning', cap: 6, span: 0.9, def: 0.6 },
  benches: { read: 'benches on a place\'s edges facing in, and at a stair\'s top looking back over the town', cap: 10, span: 0.45, def: 0.6 },
  carts: { read: 'a cart at a work door, its shafts down', cap: 6, span: 0.9, def: 0.6 },
  barrels: { read: 'barrels and a crate beside a counter\'s door', cap: 12, span: 0.6, def: 0.7 },
  woodpiles: { read: 'logs stacked against a hearth\'s free gable', cap: 12, span: 0.55, def: 0.5 },
  planters: { read: 'a planter either side of a lived door, in flower', cap: 24, span: 0.3, def: 0.5 },
  signs: { read: 'a sign where the trail comes in, where routes fork and at a stair\'s top', cap: 8, span: 0.4, def: 1 },
  trees: { read: 'a tree in a back yard, two at the square\'s back corners', cap: 30, span: 1.5, def: 0.6 },
});
export const TOWN_DRESS_IDS = Object.freeze(Object.keys(TOWN_DRESS));

/** A recipe's `dress`: a number 0…1 for every kind, or { kind: 0…1 }; unnamed kinds take their default. */
export function readTownDress(d) {
  const out = Object.fromEntries(TOWN_DRESS_IDS.map((k) => [k, TOWN_DRESS[k].def]));
  if (d === undefined) return out;
  const num = (v, k) => { if (!(typeof v === 'number' && v >= 0 && v <= 1)) throw new Error(`town: dress${k ? `.${k}` : ''} is a number from 0 (none) to 1 (every site)`); return v; };
  if (typeof d === 'number') { num(d); for (const k of TOWN_DRESS_IDS) out[k] = d; return out; }
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error(`town: dress is 0…1 for every kind, or { ${TOWN_DRESS_IDS.join(', ')} }`);
  for (const [k, v] of Object.entries(d)) { if (!TOWN_DRESS[k]) throw new Error(`town: dress.${k} is not a kind (${TOWN_DRESS_IDS.join(', ')})`); out[k] = num(v, k); }
  return out;
}

// ── builders: a doodad in its own frame (x right, y back, z up, its front at −y), then placed ───────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
function face(out, corners, outward, group, value) {
  let n = unit(cross(sub(corners[1], corners[0]), sub(corners[2], corners[0])));
  if (n[0] * outward[0] + n[1] * outward[1] + n[2] * outward[2] < 0) { corners = corners.slice().reverse(); n = n.map((v) => -v); }
  out.push({ corners, normal: n, part: 'dress', group, value });
}
function box(out, [x0, y0, z0], [x1, y1, z1], group, value) {
  const q = (pts, o) => face(out, pts, o, group, value);
  q([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]); q([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]);
  q([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], [-1, 0, 0]); q([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]);
  q([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
}
function prism(out, [cx, cy], r, z0, z1, group, value, sides = 8, topGroup = null, topValue = null) {
  const P = (k, z) => [cx + r * Math.cos((2 * Math.PI * k) / sides + Math.PI / sides), cy + r * Math.sin((2 * Math.PI * k) / sides + Math.PI / sides), z];
  for (let k = 0; k < sides; k++) { const a = P(k, z0), b = P(k + 1, z0); face(out, [a, b, P(k + 1, z1), P(k, z1)], [(a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cy, 0], group, value); }
  face(out, Array.from({ length: sides }, (_, k) => P(k, z1)), [0, 0, 1], topGroup ?? group, topValue ?? value);
}
const TIMBER = 'dress:timber', STONE = 'dress:stone', PAINT = 'dress:paint', CLOTH = 'dress:cloth', LEAF = 'dress:leaf', BARK = 'dress:bark', BLOOM = 'dress:bloom';
const BUILD = {
  lamps(o, ch, S) { EB.lamp(o, S.lamp, ch); },
  posts(o, ch, S) { EB.post(o, S.post, ch); },
  well(o, ch) { prism(o, [0, 0], 0.8, 0, 0.8, STONE, 0.6, 10, STONE, 0.03); prism(o, [0, 0], 0.62, 0.78, 0.81, STONE, 0.03, 10); for (const x of [-0.78, 0.7]) box(o, [x, -0.06, 0.8], [x + 0.08 * ch, 0.06, 2.1], TIMBER, 0.35); box(o, [-0.78, -0.03, 1.7], [0.78, 0.03, 1.76], TIMBER, 0.3); for (const s of [-1, 1]) face(o, [[-1.05, 0, 2.45], [1.05, 0, 2.45], [1.05, s * 0.75, 1.95], [-1.05, s * 0.75, 1.95]], [0, s, 0.6], TIMBER, 0.45); },
  market(o, ch) { box(o, [-1.1, -0.4, 0], [1.1, 0.4, 0.9], TIMBER, 0.55); for (const [x, y] of [[-1.15, -0.95], [1.05, -0.95], [-1.15, 0.85], [1.05, 0.85]]) box(o, [x, y, 0], [x + 0.1, y + 0.1, y < 0 ? 2.05 : 2.4], TIMBER, 0.35); for (let k = 0; k < 6; k++) { const x0 = -1.3 + (2.6 * k) / 6, x1 = -1.3 + (2.6 * (k + 1)) / 6; face(o, [[x0, -1.15, 2.05], [x1, -1.15, 2.05], [x1, 1.0, 2.45], [x0, 1.0, 2.45]], [0, -0.2, 1], k % 2 ? CLOTH : PAINT, k % 2 ? 0.85 : 0.7); } box(o, [-0.9, -0.35, 0.9], [-0.2, 0.15, 1.1], BLOOM, 0.7); box(o, [0.1, -0.35, 0.9], [0.8, 0.15, 1.08], LEAF, 0.6); },
  benches(o, ch) { box(o, [-0.8, -0.22, 0.42], [0.8, 0.22, 0.5], TIMBER, 0.6); for (const x of [-0.72, 0.62]) box(o, [x, -0.2, 0], [x + 0.1, 0.2, 0.42], TIMBER, 0.35); box(o, [-0.8, 0.18, 0.5], [0.8, 0.24, 0.9], TIMBER, 0.55); },
  carts(o, ch) { box(o, [-0.55, -1, 0.6], [0.55, 1, 0.68], TIMBER, 0.55); for (const x of [-0.55, 0.49]) box(o, [x, -1, 0.68], [x + 0.06, 1, 0.98], TIMBER, 0.45); box(o, [-0.55, 0.94, 0.68], [0.55, 1, 0.98], TIMBER, 0.45); for (const x of [-0.66, 0.66]) { const P = (k) => [x, 0.45 * Math.cos((k * Math.PI) / 4), 0.45 + 0.45 * Math.sin((k * Math.PI) / 4)]; face(o, Array.from({ length: 8 }, (_, k) => P(k)), [Math.sign(x), 0, 0], TIMBER, 0.3); } for (const x of [-0.4, 0.34]) box(o, [x, -2.3, 0], [x + 0.06, -1, 0.62], TIMBER, 0.4); },
  barrels(o, ch) { prism(o, [-0.35, 0], 0.3, 0, 0.85, TIMBER, 0.45); prism(o, [0.32, 0.05], 0.3, 0, 0.85, TIMBER, 0.5); box(o, [-0.05, -0.75, 0], [0.55, -0.2, 0.55], TIMBER, 0.65); },
  woodpiles(o, ch) { box(o, [-0.9, -0.28, 0], [0.9, 0.28, 1.05], BARK, 0.4); box(o, [-0.95, -0.34, 1.05], [0.95, 0.34, 1.12], TIMBER, 0.3); },
  planters(o, ch) { box(o, [-0.4, -0.16, 0], [0.4, 0.16, 0.36], TIMBER, 0.5); box(o, [-0.38, -0.14, 0.36], [0.38, 0.14, 0.6], LEAF, 0.55); box(o, [-0.25, -0.17, 0.48], [-0.05, 0.1, 0.64], BLOOM, 0.75); box(o, [0.08, -0.17, 0.44], [0.3, 0.1, 0.62], BLOOM, 0.6); },
  signs(o, ch) { box(o, [-0.06, -0.06, 0], [0.06, 0.06, 2.1], TIMBER, 0.35); box(o, [-0.48, -0.1, 1.45], [0.48, -0.04, 1.85], PAINT, 0.6); },
};
function tree(o, seed) { const v = ['lollipop', 'broccoli', 'column'][seed % 3], d = designFlora('broccoli', v, seed, { level: 'mid' }); for (const f of d.faces) o.push({ corners: f.corners, normal: f.normal, part: 'dress', group: f.part === 'wood' ? BARK : LEAF, value: f.value }); }

/** Place a doodad's faces: its front faces `face` (a unit [x, y]); the frame keeps right-handed (ex × ey = z). */
function placed(faces, at, f) {
  const ey = [-f[0], -f[1]], ex = [ey[1], -ey[0]], map = (p) => [r3(at[0] + ex[0] * p[0] + ey[0] * p[1]), r3(at[1] + ex[1] * p[0] + ey[1] * p[1]), r3(at[2] + p[2])];
  return faces.map((x) => ({ ...x, corners: x.corners.map(map), normal: [ex[0] * x.normal[0] + ey[0] * x.normal[1], ex[1] * x.normal[0] + ey[1] * x.normal[1], x.normal[2]].map(r3) }));
}

// ── the sites ───────────────────────────────────────────────────────────────────────────────────────────────────────
const lotAt = (l, u, v) => [r3(l.place.o[0] + l.ex[0] * u + l.ey[0] * v), r3(l.place.o[1] + l.ex[1] * u + l.ey[1] * v), l.z];
const doorOf = (l) => { const d = l.design, f = d.faces.find((x) => x.part === 'door' || x.part === 'accent' || (x.part === 'shutter' && Math.min(...x.corners.map((c) => c[2])) < 0.05 && Math.abs(x.normal[1] + 1) < 1e-6)); return f ? f.corners.reduce((s, c) => s + c[0], 0) / f.corners.length : d.dims.W0 / 2; };
const levelZ = (town, y) => town.terraces.reduce((z, t) => (y > t.y ? z + t.rise : z), 0);
function sites(town) {
  const S = Object.fromEntries(TOWN_DRESS_IDS.map((k) => [k, []])), walk = town.routes.filter((r) => r.walk);
  const near = town.lots.filter((l) => l.ring === 'near'), doors = near.map((l) => lotAt(l, doorOf(l), 0));
  // lamps: along the walk's kerb at the anchor's stride (wider down the ranks), sides alternating, clear of doors and stairs
  const SX = town.language.street;
  for (const r of walk) {
    let L = 0; for (let i = 1; i < r.pts.length; i++) L += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
    const stride = SX.lamp.stride * (TOWN_CARD.section[r.rank]?.lamps || 1), off = r.foot ? r.w / 2 + SX.kerb.w + 0.35 : r.w / 2 - 0.3;
    for (let s = 6, k = 0; s < L - 3; s += stride, k++) {
      const c = along(r.pts, s), side = k % 2 ? 1 : -1, n = [-c.t[1] * side, c.t[0] * side], at = [r3(c.p[0] + n[0] * off), r3(c.p[1] + n[1] * off)];
      if (doors.some((d) => Math.hypot(d[0] - at[0], d[1] - at[1]) < 2.2) || town.stairs.some((st) => Math.abs(at[0] - st.at[0]) < 3 && at[1] < st.at[1] + 1 && at[1] > st.at[1] - st.run - 1)) continue;
      S.lamps.push({ at: [...at, levelZ(town, at[1])], face: [-n[0], -n[1]] });
    }
  }
  // the well at the heart of every place; stalls round the square's; benches on its edges
  for (const p of town.places.filter((x) => x.id === 'square' || x.id === 'pocket')) {
    S.well.push({ at: [...p.centre, levelZ(town, p.centre[1])], face: [0, -1] });
    if (p.id === 'square') {
      const R = 6.2;
      for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3 + Math.PI / 6, at = [r3(p.centre[0] + R * Math.cos(a)), r3(p.centre[1] + R * Math.sin(a) * 0.62)]; S.market.push({ at: [...at, 0], face: [-(at[0] - p.centre[0]), -(at[1] - p.centre[1])].map((v, i, a) => v / Math.hypot(...a)) }); }
      const [a, b, c, d] = p.poly;
      for (const [q0, q1] of [[d, a], [b, c]]) for (const t of [0.3, 0.7]) { const at = [r3(q0[0] + (q1[0] - q0[0]) * t), r3(q0[1] + (q1[1] - q0[1]) * t)], f = [p.centre[0] - at[0], p.centre[1] - at[1]], l = Math.hypot(...f); S.benches.push({ at: [at[0] + (f[0] / l) * 0.5, at[1] + (f[1] / l) * 0.5, 0], face: [f[0] / l, f[1] / l] }); }
      for (const q of [c, d]) S.trees.push({ at: [r3(q[0] + (p.centre[0] - q[0]) * 0.12), r3(q[1] + (p.centre[1] - q[1]) * 0.12), 0], face: [0, -1] });
      S.signs.push({ at: [r3(a[0] - 0.8), r3(a[1] + 0.6), 0], face: [0, -1] });
    }
  }
  // posts: where the walk meets the square, along its lane edge at the post's stride; either side of each stair's top and foot
  const sq = town.places.find((p) => p.id === 'square');
  if (sq) { const [a, b] = sq.poly, L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = [-u[1], u[0]]; for (let s = 1; s < L - 0.5; s += SX.post.stride) S.posts.push({ at: [r3(a[0] + u[0] * s + n[0] * 0.4), r3(a[1] + u[1] * s + n[1] * 0.4), 0], face: [-n[0], -n[1]] }); }
  // a flush walk keeps its line by posts, at the post's stride, both sides, clear of doors and stairs
  for (const r of walk.filter((x) => x.walkForm === 'flush' && x.foot)) {
    let L = 0; for (let i = 1; i < r.pts.length; i++) L += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
    for (let s = 2; s < L - 2; s += SX.post.stride) for (const side of [1, -1]) {
      const c = along(r.pts, s), n = [-c.t[1] * side, c.t[0] * side], at = [r3(c.p[0] + n[0] * (r.w / 2 + 0.2)), r3(c.p[1] + n[1] * (r.w / 2 + 0.2))];
      if (doors.some((d) => Math.hypot(d[0] - at[0], d[1] - at[1]) < 1.6) || town.paths.some((p) => Math.hypot(p.pts[1][0] - at[0], p.pts[1][1] - at[1]) < 1.6) || town.stairs.some((st) => Math.abs(at[0] - st.at[0]) < 3 && at[1] < st.at[1] + 1 && at[1] > st.at[1] - st.run - 1)) continue;
      S.posts.push({ at: [...at, levelZ(town, at[1])], face: [-n[0], -n[1]] });
    }
  }
  for (const st of town.stairs) for (const dx of [-1, 1]) { const x = r3(st.at[0] + dx * (st.width / 2 + 0.45)); S.posts.push({ at: [x, r3(st.at[1] + 0.4), st.z0 + st.rise], face: [0, -1] }, { at: [x, r3(st.at[1] - st.run - 0.4), st.z0], face: [0, -1] }); }
  // benches at each stair's top, looking back over the town; a sign at each
  for (const st of town.stairs) for (const dx of [-4.2, 4.2]) S.benches.push({ at: [r3(st.at[0] + dx), r3(st.at[1] + 2.2), st.z0 + st.rise], face: [0, -1] });
  for (const st of town.stairs) S.signs.push({ at: [r3(st.at[0] + st.width / 2 + 0.6), r3(st.at[1] + 1.2), st.z0 + st.rise], face: [0, -1] });
  // a sign where the trail comes in, and where the pocket's way forks
  const lane = town.routes.find((r) => r.id === 'lane'); S.signs.push({ at: [r3(lane.pts[0][0] + 1), r3(lane.pts[0][1] + lane.w / 2 + 0.5), 0], face: [-1, 0] });
  const pw = town.routes.find((r) => r.id === 'pocket-way'); if (pw) S.signs.push({ at: [r3(pw.pts[0][0] + pw.w / 2 + 0.6), r3(pw.pts[0][1] - 0.5), 0], face: [0, 1] });
  // at the doors: carts at work, barrels at counters, planters at lived doors; woodpiles at a free gable; trees out back
  for (const l of near) {
    const d = l.design, u = doorOf(l), front = d.dims.front;
    if ((l.use === 'workshop' || l.use === 'barn') && front >= 1.2) S.carts.push({ at: lotAt(l, Math.min(d.dims.W0 - 0.6, u + d.dims.doorW / 2 + 1.0), -Math.min(front, 2.6) + 0.1), face: [l.ex[0], l.ex[1]] });
    if (l.use === 'shop') S.barrels.push({ at: lotAt(l, Math.max(0.7, u - d.dims.doorW / 2 - 0.8), -0.55), face: [-l.ey[0], -l.ey[1]] });
    if (l.use === 'dwelling' && front >= 0.8) for (const s of [-1, 1]) S.planters.push({ at: lotAt(l, u + s * (d.dims.doorW / 2 + 0.55), -0.3), face: [-l.ey[0], -l.ey[1]] });
    if (STRUCTURE_HEARTH.includes(l.use) && d.dims.side >= 1.2) S.woodpiles.push({ at: lotAt(l, d.dims.W0 + 0.42, d.dims.D0 * 0.62), face: [l.ex[0], l.ex[1]] });
    if (d.dims.rear >= 2.4 && l.d - d.dims.front - d.dims.D0 >= 3.5) S.trees.push({ at: lotAt(l, d.dims.W0 * (0.3 + 0.4 * ((l.k ?? 0) % 2)), l.d - d.dims.front - 1.8), face: [0, -1] });
  }
  for (const f of town.farms) S.trees.push({ at: [f.field[1][0] + 1.5, f.field[2][1] - 1.5, 0], face: [0, -1] });
  return S;
}
const STRUCTURE_HEARTH = ['dwelling', 'shop', 'workshop'];

/** The town dressed: each kind's sites taken by its aggressiveness (seeded), capped, built, and gated by the eye spot. */
export function dressTown(town, style, dress, seed = 1) {
  const A = readTownDress(dress), S = sites(town), ch = style.tokens.chunk, items = [], counts = {};
  for (const k of TOWN_DRESS_IDS) {
    const R = mulberry32(subSeed(seed, `dress:${k}`)), K = TOWN_DRESS[k];
    const ring = 'near', taken = S[k].filter(() => R() < A[k]).slice(0, K.cap);
    counts[k] = { sites: S[k].length, taken: taken.length, cap: K.cap, built: K.span >= eyeSpot(ring) - 1e-9 };
    if (!counts[k].built) continue;
    taken.forEach((s, i) => {
      const local = [];
      if (k === 'trees') tree(local, subSeed(seed, `tree:${i}`) % 997); else BUILD[k](local, ch, town.language.street);
      items.push({ kind: k, at: s.at, face: s.face, ring, faces: placed(local, s.at, s.face) });
    });
  }
  const tris = items.reduce((s, it) => s + it.faces.reduce((a, f) => a + f.corners.length - 2, 0), 0);
  const laws = [
    { law: 'dress-capped', ok: TOWN_DRESS_IDS.every((k) => counts[k].taken <= TOWN_DRESS[k].cap), value: `${items.length} doodads, ${tris} tris`, want: 'every kind under its cap, at any aggressiveness' },
    { law: 'dress-clear', ok: items.filter((it) => !['lamps', 'signs', 'posts'].includes(it.kind)).every((it) => town.routes.filter((r) => r.walk).every((r) => distTo2(r, it.at) > r.w / 2 - 0.2)), value: 'nothing but lamps, posts and signs stands at the walk', want: 'the walk stays clear: only what marks it stands at its edge' },
  ];
  return { items, counts, tris, laws, dress: A };
}
function distTo2(r, [x, y]) { let best = Infinity; for (let i = 1; i < r.pts.length; i++) { const [ax, ay] = r.pts[i - 1], [bx, by] = r.pts[i], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)); best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy)); } return best; }
