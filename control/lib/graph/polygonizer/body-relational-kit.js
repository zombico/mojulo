/**
 * THE KIT AS PIECES on the realistic body (realistic laws 8): a belt, a webbing strap and a pouch made as the things
 * they are, fitted to what the body wears, where the authored kernel made each a slab lifted off the skin's envelope
 * (station-loft-adorn.js, shared by every body; it never saw the tailor's cloth, so a strap or a pouch sat inside the
 * shirt) and the tailor's belt was two of the cloth's rings copied (so it rippled with them).
 *
 *   beltOn(on, worn, z, { width, thick })   a BELT: one mass round the trunk at height `z`. Its section is read off
 *       everything worn there (`worn`: the skin's and the cloth's points) across its whole width, the hollows spanned as
 *       a cinched belt spans them (the section's hull), so the belt is the same section top to bottom, never the cloth's
 *       ripple; its edges rounded; on `on`'s slots, carried by `on`'s weights. → the band, or null
 *   frameBuckle(belt, { w, h, bar, thick })  the BUCKLE on its front: a frame of four bars, the tongue across it, the
 *       belt's end through it and on past it, a keeper loop beside it. → { <name>: part }
 *
 * Every piece is a layer-1 part (stations of rings, caps, a bind), as the tailor's are. Deterministic, no dice.
 */
import { ringSlots } from './body-relational-resample.js';
import { bindNearest, block } from '../footwear/parts.js';
import { byShare } from './station-loft-adorn.js';
import { frameAt } from './station-loft-detail.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (v) => Math.hypot(...v);
const unitv = (v) => { const l = len(v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** the kit's measures: what a belt, its buckle and its keeper are made of (m) */
export const KIT = Object.freeze({
  // a belt stands this far off what it is cinched over, its section read every `step` across its width, its edges
  // rounded over a share `round` of its thickness
  belt: { gap: 0.0015, step: 0.006, round: 0.45, reach: 0.04 },
  // a frame buckle: its bars' width and depth, the tongue's, the end through it, the keeper's width and gap from it
  buckle: { bar: 0.006, depth: 0.004, tongue: 0.003, tail: 0.05, keeper: 0.012, keeperGap: 0.012 },
});

/** a ring's middle: the mean of its points */
const middle = (st) => mean(Object.values(st.points));
/** the station of `P` nearest height `z` */
const nearestStation = (P, z) => P.stations.reduce((b, st) => (Math.abs(middle(st)[2] - z) < Math.abs(middle(b)[2] - z) ? st : b));

/** the reach of the points `pts` from `c` along each horizontal direction `dirs` (within a lane of `lane` m either side
 * of the ray, at heights `zs` ± `band`): the farthest each ray meets; a direction none meets takes its neighbours' */
function reachOf(pts, c, dirs, zs, { band = 0.006, lane = 0.02 } = {}) {
  const near = pts.filter((q) => zs.some((z) => Math.abs(q[2] - z) < band));
  const R = dirs.map((d) => { let m = 0; for (const q of near) { const vx = q[0] - c[0], vy = q[1] - c[1], pr = vx * d[0] + vy * d[1]; if (pr > m && Math.abs(vx * d[1] - vy * d[0]) < lane) m = pr; } return m; });
  const N = R.length;
  for (let pass = 0; pass < N && R.some((r) => r === 0); pass++) for (let j = 0; j < N; j++) if (R[j] === 0) { const a = R[(j + N - 1) % N], b = R[(j + 1) % N]; if (a || b) R[j] = Math.max(a, b); }
  return R;
}

/** the HULL of a section given as radii along directions: each direction's radius out to the convex hull of the
 * section's points (a cinched belt spans a hollow, the small of the back, the dip at the spine) */
function hullRadii(c, dirs, R) {
  const P = dirs.map((d, j) => [d[0] * R[j], d[1] * R[j]]);
  // (the hull by the monotone chain, its edges then cut by each direction's ray)
  const pts = P.map((p, j) => [...p, j]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const crossZ = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of pts) { while (lo.length >= 2 && crossZ(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of [...pts].reverse()) { while (hi.length >= 2 && crossZ(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  const H = [...lo.slice(0, -1), ...hi.slice(0, -1)];
  return dirs.map((d, j) => {
    let best = R[j];
    for (let k = 0; k < H.length; k++) {
      const a = H[k], b = H[(k + 1) % H.length], e = [b[0] - a[0], b[1] - a[1]], den = d[0] * e[1] - d[1] * e[0];
      if (Math.abs(den) < 1e-12) continue;
      const t = (a[0] * e[1] - a[1] * e[0]) / den, s = (a[0] * d[1] - a[1] * d[0]) / den;
      if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9 && t > best) best = t;
    }
    return best;
  });
}

/** A BELT round the trunk at height `z`, on the cloth piece `on` (its slots, its weights), standing over `worn` (every
 * point it is cinched over: the skin's and the cloth's) across its whole `width`, `thick` thick. One section top to
 * bottom (the widest the worn things reach anywhere across the belt's width, hulled), its upper and lower edges rounded.
 * Null when `on` has no ring near `z`. */
export function beltOn(on, worn, z, { width = 0.035, thick = 0.004 } = {}) {
  const st = nearestStation(on, z), c0 = middle(st);
  if (Math.abs(c0[2] - z) > 0.04) return null;
  const c = [c0[0], c0[1], z], K = KIT.belt;
  // (each slot's direction round the trunk, level, as the cloth's ring there sets it)
  const dirs = on.slots.map((sl) => { const p = st.points[sl], d = [p[0] - c[0], p[1] - c[1], 0], l = Math.hypot(d[0], d[1]) || 1; return [d[0] / l, d[1] / l, 0]; });
  const n = Math.max(2, Math.ceil(width / K.step)), zs = Array.from({ length: n + 1 }, (_, k) => z - width / 2 + (width * k) / n);
  const near = worn.filter((q) => Math.abs(q[2] - z) < width / 2 + 0.01 && Math.hypot(q[0] - c[0], q[1] - c[1]) < 0.6);
  const reach = reachOf(near, c, dirs, zs);
  const inner = hullRadii(c, dirs, reach).map((r) => r + K.gap);
  // the section's profile up the belt: [height share, out share of the thickness]
  const e = Math.min(K.round, 0.5), prof = [[0, 0.15], [e * thick / width, 0.8], [2 * e * thick / width, 1], [1 - 2 * e * thick / width, 1], [1 - e * thick / width, 0.8], [1, 0.15]];
  const stations = prof.map(([h, o], k) => ({ id: `st${k}`, u: k, points: Object.fromEntries(on.slots.map((sl, j) => [sl, [c[0] + dirs[j][0] * (inner[j] + o * thick), c[1] + dirs[j][1] * (inner[j] + o * thick), z - width / 2 + h * width].map(r6)])) }));
  const band = { layer: 1, closure: 'closed', slots: on.slots, ...(on.slotT ? { slotT: on.slotT } : {}), stations,
    caps: { back: [c[0], c[1], z - width / 2 - 0.001].map(r6), tip: [c[0], c[1], z + width / 2 + 0.001].map(r6) } };
  return { ...band, bind: bindNearest(band, on) };
}

/** the belt's front: the point on its outer face at its middle height, its outward normal, its up and its across */
function frontOf(belt) {
  const mid = belt.stations[Math.floor(belt.stations.length / 2)], lo = belt.stations[2], hi = belt.stations[belt.stations.length - 3];
  const sl = belt.slots.includes('front') ? 'front' : belt.slots[0];
  const P = mean([lo.points[sl], hi.points[sl]]), C = middle(mid);
  const n = unitv([P[0] - C[0], P[1] - C[1], 0]), up = [0, 0, 1], across = unitv(cross(up, n));
  return { P, n, up, across, height: hi.points[sl][2] - lo.points[sl][2] };
}

/** THE BUCKLE on a belt's front: a frame (`w` across, `h` up, four bars `bar` wide and `depth` deep), the tongue
 * across it, the belt's tail through it and on past it toward the wearer's left, and a keeper loop beside the frame.
 * Each a block on the belt's face, bound as the belt is. `id` names the parts. */
export function frameBuckle(belt, id, { w = 0.05, h = null, group = 'Buckle', tailGroup = null } = {}) {
  const B = KIT.buckle, F = frontOf(belt), H = h ?? F.height + 2 * B.bar, out = {};
  const at = (x, y, lift = 0) => add(add(add(F.P, scl(F.across, x)), scl(F.up, y)), scl(F.n, lift));
  const put = (name, P, t, size, g) => { const b = block(P, F.n, t, size); out[`${id}${name}`] = { ...b, group: g, bind: belt.bind }; };
  // (the tail: the belt's own end, over the belt from the frame on 5 cm, a leather layer proud of it)
  put('Tail', at(-w / 2 - B.tail / 2, 0, 0), F.across, { w: F.height * 0.96, h: B.tail + w * 0.4, thick: 0.0035 }, tailGroup ?? belt.group ?? 'Leather');
  // (the frame: its top and bottom bars across, its two sides up, over the tail)
  put('Top', at(0, H / 2 - B.bar / 2, 0.003), F.across, { w: B.bar, h: w, thick: B.depth }, group);
  put('Bottom', at(0, -H / 2 + B.bar / 2, 0.003), F.across, { w: B.bar, h: w, thick: B.depth }, group);
  put('Right', at(w / 2 - B.bar / 2, 0, 0.003), F.up, { w: B.bar, h: H, thick: B.depth }, group);
  put('Left', at(-w / 2 + B.bar / 2, 0, 0.003), F.up, { w: B.bar, h: H, thick: B.depth }, group);
  // (the tongue: from the frame's right bar across to the middle, through the tail)
  put('Tongue', at(w / 4 - B.bar / 4, 0, 0.0035), F.across, { w: B.tongue, h: w / 2, thick: B.tongue }, group);
  // (the keeper: a loop round the belt beside the frame, the tail under it)
  put('Keeper', at(-w / 2 - B.keeperGap - B.keeper / 2, 0, 0.0035), F.up, { w: B.keeper, h: F.height + 0.006, thick: 0.003 }, tailGroup ?? belt.group ?? 'Leather');
  return out;
}

// ─── pieces: a closed tube of rings, a rounded section ───

/** a layer-1 closed tube through `rings` (each a list of points, all the same length), capped at `back` and `tip` */
function tube(rings, back, tip) {
  const slots = ringSlots(rings[0].length);
  return { layer: 1, closure: 'closed', slots, stations: rings.map((R, i) => ({ id: `st${i}`, u: i, points: Object.fromEntries(slots.map((sl, j) => [sl, R[j].map(r6)])) })), caps: { back: back.map(r6), tip: tip.map(r6) } };
}
/** a ROUNDED RECTANGLE about `c` in the plane of `a` (across) and `b` (up): `w` by `h`, its corners of radius `r`, `k`
 * points a corner; starting at the middle of its right side, counter-clockwise */
function roundRect(c, a, b, w, h, r, k = 4) {
  const rr = Math.max(0.0005, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4)), pts = [];
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  corners.forEach(([sx, sy], q) => { const cx = sx * (w / 2 - rr), cy = sy * (h / 2 - rr), a0 = (q * Math.PI) / 2;
    for (let i = 0; i < k; i++) { const t = a0 + ((i + 0.5) / k) * (Math.PI / 2), x = cx + Math.cos(t) * rr, y = cy + Math.sin(t) * rr; pts.push(add(c, add(scl(a, x), scl(b, y)))); } });
  return pts;
}
/** a flat STRIP along `path` (each point's normal `ns`, its across `acs`), `w` wide and `t` thick, lying on the side the
 * normals point to: its inner face on the path, its outer `t` out */
function stripAlong(path, ns, acs, w, t) {
  const rings = path.map((p, i) => { const l = scl(acs[i], w / 2), o = scl(ns[i], t); return [sub(p, l), add(p, l), add(add(p, l), o), add(sub(p, l), o)]; });
  const d0 = unitv(sub(path[1], path[0])), d1 = unitv(sub(path[path.length - 1], path[path.length - 2]));
  return tube(rings, sub(add(path[0], scl(ns[0], t / 2)), scl(d0, 0.0008)), add(add(path[path.length - 1], scl(ns[ns.length - 1], t / 2)), scl(d1, 0.0008)));
}

/** the farthest any of `pts` stands out along `out` from `o` within a box `w` across `a` and `h` up `b` (its footprint) */
function standOut(pts, o, out, a, b, w, h) {
  let m = -Infinity;
  for (const q of pts) { const d = sub(q, o); if (Math.abs(d[0] * a[0] + d[1] * a[1] + d[2] * a[2]) > w / 2 || Math.abs(d[0] * b[0] + d[1] * b[1] + d[2] * b[2]) > h / 2) continue; const e = d[0] * out[0] + d[1] * out[1] + d[2] * out[2]; if (e > m && e < 0.12) m = e; }
  return Number.isFinite(m) ? m : 0;
}

/** the pouch's measures (shares of its own size, or m) */
export const POUCH = Object.freeze({ gap: 0.0015, round: 0.22, bevel: 0.006, flapThick: 0.003, flapOver: 0.003, tab: 0.024, tabLen: 0.03, snap: 0.0065, seam: 0.0016 });

/** A POUCH: a box with rounded corners pressed flat to whatever stands out most under its footprint (`worn`), its top at
 * `o` + `b`·h/2 (`a` across, `b` up, `out` away from the body), `w` × `h` × `d`; a lid FLAP over its top falling `flap`
 * of its height down its front, a closure TAB on the flap and its SNAP, a SEAM bead down each front edge. → { name: part }
 * (`id` the parts' stem; `group` the cloth's, `metal` the snap's) */
export function pouchOn(o, { a, b, out }, worn, { w, h, d, flap = 0.3, group = 'Leather', metal = 'Buckle', id }) {
  const P = POUCH, back = standOut(worn, o, out, a, b, w + 0.01, h + 0.01) + P.gap, c = add(o, scl(out, back)), parts = {};
  const at = (x, y, z) => add(c, add(add(scl(a, x), scl(b, y)), scl(out, z)));
  // THE BODY: its section through its depth, full to near the front, then the front's bevel
  const r = Math.min(w, h) * P.round, bev = Math.min(P.bevel, d / 4);
  const sec = (z, inset) => roundRect(at(0, 0, z), a, b, w - 2 * inset, h - 2 * inset, r - inset * 0.6);
  parts[`${id}Body`] = tube([sec(0, 0.002), sec(0.15 * d, 0), sec(d - bev, 0), sec(d - bev * 0.3, bev * 0.55), sec(d, bev)], at(0, 0, -0.001), at(0, 0, d + 0.0005));
  // THE FLAP: from the back over the top and down the front, a rounded fold at the edge, a little wider than the body
  const ft = P.flapThick, fw = w + 2 * P.flapOver, top = h / 2 + 0.0008, drop = h * flap;
  // (its profile in (depth, height): along the top, round the front edge on a 6 mm fold, down the front)
  const R = Math.min(0.006, d / 3), e = 0.0008, fold = Array.from({ length: 5 }, (_, i) => { const t = (i / 4) * (Math.PI / 2); return [d - R + Math.sin(t) * (R + e), top - R + Math.cos(t) * R]; });
  const prof = [[0.004, top], [(d - R) / 2, top], ...fold, [d + e, top - R - (drop - R) * 0.5], [d + e, top - drop]];
  const fp = prof.map(([z, y]) => at(0, y, z)), fn = prof.map((_, i) => { const p0 = prof[Math.max(0, i - 1)], p1 = prof[Math.min(prof.length - 1, i + 1)], dz = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dz, dy) || 1; return add(scl(out, -dy / l), scl(b, dz / l)); });
  parts[`${id}Flap`] = stripAlong(fp, fn, fp.map(() => a), fw, ft);
  // THE CLOSURE: a tab down from the flap's edge over the front, its snap at the end
  const ty0 = top - drop + 0.006, ty1 = ty0 - P.tabLen, tz = d + 0.0008 + ft;
  parts[`${id}Tab`] = stripAlong([at(0, ty0, tz), at(0, ty1, tz)], [out, out], [a, a], P.tab, 0.0025);
  const sc = at(0, ty1 + 0.009, tz + 0.0025), ring = (z, rr) => Array.from({ length: 10 }, (_, j) => { const t = (2 * Math.PI * j) / 10; return add(add(sc, scl(out, z)), add(scl(a, Math.cos(t) * rr), scl(b, Math.sin(t) * rr))); });
  parts[`${id}Snap`] = { ...tube([ring(0, P.snap), ring(0.0018, P.snap), ring(0.0028, P.snap * 0.7)], sub(sc, scl(out, 0.0005)), add(sc, scl(out, 0.0032))), group: metal };
  // THE SEAMS: a bead down each front edge, where the gusset is sewn to the face
  for (const [S, sx] of [['R', 1], ['L', -1]]) {
    const x = sx * (w / 2 - bev * 0.4), n = unitv(add(out, scl(a, sx * 0.7))), ac = unitv(cross(n, scl(b, -1)));
    parts[`${id}Seam${S}`] = stripAlong([at(x, h / 2 - r, d - bev * 0.5), at(x, -h / 2 + r, d - bev * 0.5)], [n, n], [ac, ac], P.seam * 2, P.seam);
  }
  for (const k of Object.keys(parts)) parts[k].group ??= group;
  return parts;
}

/** WEBBING along a path of `bases` (points on the body, each its normal `ns`), laid on what is worn there: each point
 * lifted over the farthest any of `worn` stands within the strap's width (the cloth, a belt), the lift smoothed along,
 * so the strap lies flat on the outermost layer and never stands off or sinks; `w` wide, `t` thick. → the strip */
export function webbingOn(bases, ns, worn, { w, t, gap = 0.001 }) {
  // (the path resampled every 12 mm, its points and normals eased along it)
  const L = [0]; for (let i = 1; i < bases.length; i++) L.push(L[i - 1] + len(sub(bases[i], bases[i - 1])));
  const total = L[L.length - 1], n = Math.max(2, Math.round(total / 0.012));
  const at = (s, arr) => { let i = 1; while (i < L.length - 1 && L[i] < s) i++; const f = (s - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1]); return add(arr[i - 1], scl(sub(arr[i], arr[i - 1]), Math.max(0, Math.min(1, f)))); };
  let P = Array.from({ length: n + 1 }, (_, k) => at((total * k) / n, bases)), N = Array.from({ length: n + 1 }, (_, k) => unitv(at((total * k) / n, ns)));
  const ease = (A, keepEnds = true) => A.map((p, i) => (keepEnds && (i === 0 || i === A.length - 1) ? p : scl(add(add(A[Math.max(0, i - 1)], A[Math.min(A.length - 1, i + 1)]), scl(p, 2)), 0.25)));
  for (let it = 0; it < 3; it++) { P = ease(P); N = ease(N, false).map(unitv); }
  const along = P.map((p, i) => unitv(sub(P[Math.min(P.length - 1, i + 1)], P[Math.max(0, i - 1)])));
  const across = P.map((_, i) => unitv(cross(N[i], along[i])));
  const near = worn.filter((q) => P.some((p) => Math.abs(q[2] - p[2]) < 0.05));
  // (each point's lift: the farthest a worn point stands along its normal within the strap's half width)
  let lift = P.map((p, i) => { let m = 0; for (const q of near) { const d = sub(q, p), up = d[0] * N[i][0] + d[1] * N[i][1] + d[2] * N[i][2]; if (up <= m || up > 0.06) continue; const lat = len(sub(d, scl(N[i], up))); if (lat < w / 2 + 0.004) m = up; } return m + gap; });
  for (let it = 0; it < 4; it++) lift = lift.map((v, i) => Math.max(v, (lift[Math.max(0, i - 1)] + 2 * v + lift[Math.min(lift.length - 1, i + 1)]) / 4));
  return stripAlong(P.map((p, i) => add(p, scl(N[i], lift[i]))), N, across, w, t);
}

/** one weight for a whole piece (a rigid thing rides its bone as one): `w` on every point and cap */
function rigidBind(piece, bone, w) {
  const blend = {};
  for (const st of piece.stations) for (const sl of Object.keys(st.points)) blend[`${st.id}.${sl}`] = w;
  for (const k of Object.keys(piece.caps)) blend[k] = w;
  return { bone, blend };
}
/** the weights `P` gives the point nearest `q` */
const weightAt = (P, q) => { const b = bindNearest({ stations: [{ id: 'q', points: { q } }], caps: {} }, P); return b.blend['q.q'] ?? { [P.bind.bone]: 1 }; };
const pointsOf = (P) => P.stations.flatMap((st) => Object.values(st.points));
const BELT_PART = /^(belt|\w*Belt)_[a-z]+$/;

/**
 * THE KIT'S PIECES on the realistic body (realistic laws 8): of the kit `kit` (the expander's adornments), each one this
 * module makes as the thing it is, made on what the body wears (`cloth`: the tailor's parts, its belts among them) over
 * the skin (`S`'s parts, `L1` them compiled, the frames an address reads):
 *   - a shell carrying a hard `pack` (a pouch: a vest rig's magazine pouches, a duty belt's, a thigh rig's): `pouchOn`,
 *     hung on the belt at its height when there is one (its top a little over the belt's), rigid on what carries it;
 *   - a strap on the torso (a harness, a rig's shoulder straps): `webbingOn` along its path;
 *   - a band wrapped round a thigh (a thigh rig's leg strap): `beltOn` on the cloth there.
 * → { parts, taken } (`taken` the kit's ids made here, for the authored kernel to leave). Deterministic.
 */
export function kitPieces(S, cloth, kit, { L1 }) {
  const parts = {}, taken = new Set(), laid = new Set(), waists = new Set();
  const skin = ['torso', 'pelvis', 'neck', 'thighR', 'thighL', 'upperArmR', 'upperArmL'].map((k) => S.parts[k]).filter(Boolean);
  const worn = [...skin, ...Object.values(cloth)].flatMap(pointsOf);
  const belts = Object.entries(cloth).filter(([k]) => BELT_PART.test(k));
  for (const A of kit || []) {
    if (!A || typeof A.id !== 'string' || typeof A.part !== 'string') continue;
    const sig = A.signature, Pskin = S.parts[A.part];
    if (!Pskin || !L1[A.part]) continue;
    // (each frame read OUT from the part's own axis: an address's normal comes out of its neighbours' handedness, which a
    // reshaped part can turn over, and a pouch laid along it went into the body)
    const at = (s, t, side) => {
      const F = frameAt(L1, A.part, [s, t], side), st = Pskin.stations.reduce((b, x) => (Math.abs(middle(x)[2] - F.origin[2]) < Math.abs(middle(b)[2] - F.origin[2]) ? x : b)), c = middle(st);
      return F.normal[0] * (F.origin[0] - c[0]) + F.normal[1] * (F.origin[1] - c[1]) < 0 ? { ...F, normal: scl(F.normal, -1) } : F;
    };
    if (A.mode === 'shell' && sig?.kind === 'pack' && !sig.soft && Array.isArray(A.s) && Array.isArray(A.t)) {
      const W = byShare(Pskin, A), f = at((W.s[0] + W.s[1]) / 2, (W.t[0] + W.t[1]) / 2, A.side ?? 'R');
      const out = unitv([f.normal[0], f.normal[1], 0]), b = [0, 0, 1], a = unitv(cross(b, out)), h = sig.h, w = sig.w, d = sig.d;
      // (on a belt at its height: hung from it, its top a little over the belt's, its back on the belt's face)
      // (its own belt first, the one its kit made with it: `<stem>Belt`, the pouches' duty belt; else the nearest)
      const stem = A.id.replace(/[RL]\d*$/, ''), own = belts.filter(([k]) => k.startsWith(`${stem}Belt_`));
      const belt = (own.length ? own : belts).map(([k, P]) => { const near = pointsOf(P).filter((q) => Math.hypot(q[0] - f.origin[0], q[1] - f.origin[1]) < 0.08); return near.length ? [k, P, Math.max(...near.map((q) => q[2]))] : null; })
        .filter((x) => x && Math.abs(x[2] - f.origin[2]) < h + (own.length ? 0.1 : 0)).sort((x, y) => Math.abs(x[2] - f.origin[2]) - Math.abs(y[2] - f.origin[2]))[0];
      const o = belt ? [f.origin[0], f.origin[1], belt[2] + 0.004 - h / 2] : f.origin;
      const made = pouchOn(o, { a, b, out }, worn, { w, h, d, flap: typeof sig.flap === 'number' ? sig.flap : 0.3, group: A.group ?? 'Leather', metal: 'Buckle', id: A.id });
      const carrier = belt ? belt[1] : Pskin, wgt = weightAt(carrier, o);
      for (const [k, P] of Object.entries(made)) parts[`${k}_kit`] = { ...P, bind: rigidBind(P, carrier.bind.bone, wgt) };
      // (a thigh rig HANGS from the belt above it: a strap from the belt's lower edge down the hip to the pouch's top)
      const above = /^thigh[RL]$/.test(A.part) && !belt ? belts.map(([, P]) => [P, Math.min(...pointsOf(P).filter((q) => Math.hypot(q[0] - o[0], q[1] - o[1]) < 0.15).map((q) => q[2]))]).filter(([, z]) => Number.isFinite(z) && z > o[2] && z - o[2] < 0.45).sort((x, y) => x[1] - y[1])[0] : null;
      if (above) {
        const top = o[2] + h / 2, n = 8, bases = Array.from({ length: n + 1 }, (_, k) => [o[0], o[1], top + ((above[1] + 0.006 - top) * k) / n]);
        const strap = webbingOn(bases, bases.map(() => out), worn, { w: 0.03, t: 0.0025 });
        parts[`${A.id}Hanger_kit`] = { ...strap, group: A.group ?? 'Leather', bind: bindNearest(strap, Pskin) };
      }
      taken.add(A.id);
    } else if (A.mode === 'strap' && Array.isArray(A.path) && A.path.length >= 2 && laid.has(`${A.part}:${JSON.stringify(A.path)}`)) {
      // (a strap along a path one is already laid on is that strap: a rig's shoulder straps and a harness worn with it)
      taken.add(A.id);
    } else if (A.mode === 'strap' && Array.isArray(A.path) && A.path.length >= 2) {
      laid.add(`${A.part}:${JSON.stringify(A.path)}`);
      // (the path's addresses as the authored kernel walks them: four steps a leg on one side, one where it crosses)
      const bases = [], ns = [];
      for (let i = 0; i + 1 < A.path.length; i++) { const [p, q] = [A.path[i], A.path[i + 1]], n = p[2] === q[2] ? 4 : 1; for (let k = 0; k < n; k++) { const u = k / n, F = at(p[0] + (q[0] - p[0]) * (p[2] === q[2] ? u : 0), p[1] + (q[1] - p[1]) * (p[2] === q[2] ? u : 0), p[2]); bases.push(F.origin); ns.push(F.normal); } }
      { const z = A.path[A.path.length - 1], F = at(z[0], z[1], z[2]); bases.push(F.origin); ns.push(F.normal); }
      const sw = Math.min(0.045, A.width ?? 0.04), stt = Math.max(0.002, Math.min(0.0035, A.thick ?? 0.003));
      // (an end that runs to a belt is FASTENED to it: the strap cut a little over the belt's top, a ladder lock there, and
      // a tab from the lock down over the belt's face, round it)
      const beltTop = (q) => { const zs = belts.flatMap(([, P]) => pointsOf(P).filter((r) => Math.hypot(r[0] - q[0], r[1] - q[1]) < 0.1).map((r) => r[2])); return zs.length ? [Math.max(...zs), Math.min(...zs)] : null; };
      const locks = [];
      // (a strap whose two ends meet, a hand apart at the waist, is ANCHORED to a WAIST STRAP round the body there: a band
      // of the same webbing round the trunk just over the belt, made once for every strap that ends at its height, each
      // strap cut at the band's middle and locked to it; a rig's X never hangs open at the sides)
      const e0 = A.path[0], e1 = A.path[A.path.length - 1], loop = e0[2] === e1[2] && len(sub(bases[0], bases[bases.length - 1])) < 0.1;
      if (loop) {
        const B = beltTop(bases[0]), zBand = Math.max(Math.min(bases[0][2], bases[bases.length - 1][2]), B ? B[0] + 0.002 : -Infinity) + sw / 2;
        // (each end cut where it first comes down to the band's top, never run along it, then set straight down onto it)
        const top = zBand + sw / 2;
        while (bases.length > 3 && bases[0][2] < top) { bases.shift(); ns.shift(); }
        while (bases.length > 3 && bases[bases.length - 1][2] < top) { bases.pop(); ns.pop(); }
        bases.unshift([bases[0][0], bases[0][1], zBand]); ns.unshift(ns[0]);
        bases.push([bases[bases.length - 1][0], bases[bases.length - 1][1], zBand]); ns.push(ns[ns.length - 1]);
        const key = `${A.part}:${Math.round(zBand * 50)}`;
        if (!waists.has(key)) {
          waists.add(key);
          const trunk = Object.entries(cloth).filter(([k, P]) => (P.garment && /_(body|torso|pelvis)$/.test(k)) || BELT_PART.test(k)), near = (P) => { const st = P.stations.reduce((b, x) => (Math.abs(middle(x)[2] - zBand) < Math.abs(middle(b)[2] - zBand) ? x : b)); return Math.abs(middle(st)[2] - zBand) < 0.03 ? st : null; };
          const radius = (P) => { const st = near(P), c = st && middle(st); return st ? P.slots.reduce((t, sl) => t + Math.hypot(st.points[sl][0] - c[0], st.points[sl][1] - c[1]), 0) / P.slots.length : -1; };
          const on = trunk.filter(([, P]) => P.garment).map(([, P]) => P).sort((x, y) => radius(y) - radius(x))[0] ?? Pskin;
          const band = beltOn(on, [...trunk.map(([, P]) => P), Pskin, ...(S.parts.pelvis ? [S.parts.pelvis] : [])].flatMap(pointsOf), zBand, { width: sw, thick: stt });
          if (band) parts[`${A.id}Waist_kit`] = { ...band, group: A.group ?? 'Leather' };
        }
        locks.push({ end: 0, join: true }, { end: 1, join: true });
      }
      for (const end of loop ? [] : [0, 1]) {
        const q = end ? bases[bases.length - 1] : bases[0], B = beltTop(q), addr = end ? A.path[A.path.length - 1] : A.path[0];
        if (!B || q[2] > B[0] + 0.2) continue;
        const keep = (p) => p[2] >= B[0] + 0.012;
        while (bases.length > 3 && !keep(end ? bases[bases.length - 1] : bases[0])) { if (end) { bases.pop(); ns.pop(); } else { bases.shift(); ns.shift(); } }
        // (an end short of the belt carried on down the body to it, by its address: down the torso at its own turn)
        const more = [];
        for (let sv = addr[0] - 0.05; sv >= 0 && (more.length ? more[more.length - 1].origin : q)[2] > B[0] + 0.012; sv -= 0.05) more.push(at(sv, addr[1], addr[2]));
        const fit = more.filter((F) => keep(F.origin));
        if (end) for (const F of fit) { bases.push(F.origin); ns.push(F.normal); } else for (const F of fit) { bases.unshift(F.origin); ns.unshift(F.normal); }
        locks.push({ end, top: B[0], bottom: B[1] });
      }
      const strap = webbingOn(bases, ns, worn, { w: sw, t: stt });
      parts[`${A.id}_kit`] = { ...strap, group: A.group ?? 'Leather', bind: bindNearest(strap, Pskin) };
      for (const L of locks) {
        const st = L.end ? strap.stations[strap.stations.length - 1] : strap.stations[0], [p0, p1, p2] = strap.slots.slice(0, 3).map((sl) => st.points[sl]);
        const mid = mean([p0, p1]), n = unitv(sub(p2, p1)), tag = `${A.id}Lock${L.end ? 'B' : 'A'}`;
        const lock = block(mid, n, [0, 0, 1], { w: sw + 0.008, h: 0.02, thick: 0.0045 });
        parts[`${tag}_kit`] = { ...lock, group: 'Buckle', bind: bindNearest(lock, Pskin) };
        if (L.join) continue;
        // (the tab: from the lock down over the belt, lying on it)
        const down = [mid, [mid[0], mid[1], L.bottom - 0.004]], tab = webbingOn([down[0], mean(down), down[1]], [n, n, n], worn, { w: sw * 0.8, t: stt });
        parts[`${tag}Tab_kit`] = { ...tab, group: A.group ?? 'Leather', bind: bindNearest(tab, Pskin) };
      }
      taken.add(A.id);
    } else if (A.mode === 'band' && A.t === 'wrap' && /^thigh[RL]$/.test(A.part) && Array.isArray(A.s)) {
      const side = A.part.slice(-1), on = Object.entries(cloth).find(([k, P]) => P.garment && new RegExp(`_(leg|thigh)${side}$`).test(k))?.[1];
      if (!on) continue;
      // (no higher than a hand under the crotch: above it the leg's ring runs into the crotch, and a band there would too)
      const crotch = S.parts.pelvis ? Math.min(...pointsOf(S.parts.pelvis).map((q) => q[2])) : Infinity;
      const W = byShare(Pskin, A), z = Math.min(at((W.s[0] + W.s[1]) / 2, 0, side).origin[2], crotch - 0.07);
      // (read off this leg alone: its cloth and its skin, never the other leg or the hips beside it)
      const band = beltOn(on, [...pointsOf(on), ...pointsOf(Pskin)], z, { width: 0.025, thick: 0.003 });
      if (!band) continue;
      parts[`${A.id}_kit`] = { ...band, group: A.group ?? 'Leather' };
      taken.add(A.id);
    }
  }
  return { parts, taken };
}
