/** hero-relational-head.js — the RELATIONAL head (head-relational.js) worn by the realistic hero as recipe content: two
 * layer-1 parts the compiler, the bind and every exporter handle like any other head, in place of the landmark head.
 *
 *   the fit    the field scaled so vertex to menton is the landmark head's, the menton on its menton, the ear canal at its
 *              ear's depth (the body study's graft, read off the landmark head's own parts before they leave)
 *   the seam   the neck ends on its highest ring standing wholly outside the head by the join's width, and the head
 *              starts on that ring, slot for slot (`multiple` head slots to a neck slot, on the neck's own edges): one
 *              ring, no gap, no shell inside another
 *   the skin   every point on a ray from one centre inside the head (`O`, at the ear canal's height over the seam ring's
 *              middle), at the first crossing outward of the head's field joined smoothly to the neck's column (a
 *              distance read off the neck's own rings): the throat, the jaw's underside and the nape fill as one skin.
 *              Each column keeps its seam point's azimuth from the seam to the vertex
 *   the mouth  the two parts share one ring, the MOUTH's: across the mouth the lips' meeting line (the groove the two lips
 *              make, found on the field), level with it behind the corners. `jaw` runs from the seam to it, `cranium` from
 *              it to the vertex; their caps there are the Mouth (the landmark head's two-part mouth)
 *   the bind   the cranium the head bone; the jaw from the neck's seam blend on its first ring to { jaw, head } by how far
 *              ahead of the ramus a point is, the mouth ring jaw-bound only between the corners: so the rig's jaw opens
 *              the mouth and the ring stays shut behind them. The rig's jaw hinge moved to the head's condyles, its tip
 *              to the gnathion; the landmark head's `jawOpen` dial (a hinge of its own jaw) leaves with it
 *
 * The ears are out of the sampled field (a ray from inside cannot find a plate standing off the head) and the eyes are
 * the field's (globe and lids in one skin); both, expressions and a face rig are later work. Pure and deterministic. */
import { relationalHead } from './head-relational.js';
import { compileLayered } from './station-loft.js';
import { crossing, project } from './body-relational-field.js';
import { ringSlots, mixW, four, mirrorPart } from './body-relational-resample.js';
import { r6 } from './body-relational-vec.js';
import { smin } from './vajra.js';

/** the head's density and its joins: `multiple` head slots to a neck slot, `jaw` and `cranium` rings, the neck's join
 * to the head (`join`, metres: the smooth union's width, and how far outside the head the seam ring stands) */
export const RELATIONAL_HEAD = Object.freeze({
  multiple: 3, jaw: 14, cranium: 56, join: 0.012, top: 86,
  // the visage: its look's tilt (°), its slots and rings, the share of its reach the features fill (`inner`), how far its
  // rim sinks and the cranium under it is let down, how deep it closes behind; its casts' reach and its widest disc (m)
  tilt: 15, slots: 96, rings: 40, inner: 0.72, sink: 0.001, deflate: 0.004, rimDeflate: 0.0008, depth: 0.015, reach: 0.1, most: 0.1, relax: 6, blur: 0,
  // the eyes: their look's tilt, slots, the rings out past the opening's edge (m) and in toward the cornea (shares of the
  // edge), where the visage under them comes back up (m past the edge), and how far it is let down there
  eyeTilt: 5, eyeSlots: 64, eyeOut: [0.02, 0.017, 0.0145, 0.0123, 0.0104, 0.0088, 0.0074, 0.0062, 0.0051, 0.0042, 0.0034, 0.0027, 0.0021, 0.0016, 0.0011, 0.0007, 0.0003, 0],
  eyeIn: [0.85, 0.7, 0.55, 0.4, 0.28, 0.17, 0.08], eyeUnder: 0.01, eyeRise: 0.01, eyeShortIn: 0.6, eyeRoomEase: 6, noseShortDown: 0.45,
  noseSlots: 96, noseMost: 0.04, noseBase: 0.002, noseOut: [0.02, 0.017, 0.0145, 0.0123, 0.0104, 0.0088, 0.0074, 0.0062, 0.0051, 0.0042, 0.0034, 0.0027, 0.0021, 0.0016, 0.0011, 0.0007, 0.0003, 0],
  noseIn: [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.31, 0.23, 0.16, 0.1, 0.05], eyeSink: 0.002, eyeKeep: 0.015, eyeRimSink: 0.0005,
  // what lies under an eye (the visage's and the nose's points inside `eyeUnder` of its edge, easing out over `eyeRise`)
  // held `eyeSink` behind the globe's front (its height just inside the lids, `eyeGlobeIn` of the opening, along the
  // eye's look): the lower lid is a ledge over the globe, and a face bridging its front and the globe beside it would
  // otherwise cut in front of the eye
  eyeGlobeIn: 0.85, eyeDeflate: 0.006, eyeAround: 0.02, eyeAroundRise: 0.012,
  // the ears: slots round a section, sections up the ear
  earSlots: 40, earRings: 24,
});

/** the head's tune (head-relational.js `solveTune`, its wave's internal points) per pole, SOLVED once and kept: a solve
 * takes most of a minute, and a minted head is a compatibility promise (hero-relational-head.deep.test.js holds these to
 * the solver; re-pin with the solver's output in the commit that moves it) */
export const HEAD_TUNES = Object.freeze({
  male: Object.freeze({ eu: 0.006847826086956521, zy: 0.034434782608695653, go: 0.072, op: 0.019760869565217394, g: 0.01643478260869565, gn: 0.0064565217391304355, n: 0.03130434782608695, sn: 0.014086956521739132, prn: -0.012130434782608697, al: 0.005584493885869565, mod: -0.08 }),
  female: Object.freeze({ eu: 0.007434782608695652, zy: 0.034043478260869564, go: 0.07552173913043479, op: 0.009489130434782611, g: 0.030521739130434784, gn: 0.017070652173913046, n: -0.005771739130434786, sn: 0.02465217391304348, prn: -0.01682608695652174, al: 0.004206521739130434, mod: -0.08 }),
});

const ramp = (x) => { const y = Math.max(0, Math.min(1, x)); return y * y * (3 - 2 * y); };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rp = (p) => p.map(r6);
const mid3 = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);

/** the landmark head's parts: the cranium, the jaw and everything pinned on them (the eyes, the lips, the ears, the hair) */
function landmarkHeadParts(parts) {
  const out = new Set(['cranium', 'jaw'].filter((k) => parts[k]));
  for (let grew = true; grew;) { grew = false; for (const [k, p] of Object.entries(parts)) if (!out.has(k) && p.pin && out.has(p.pin.parent)) { out.add(k); grew = true; } }
  return out;
}

/** the fit of the relational head (STAND units) into the hero's frame: { k, ty, men } with hero = (x k, y k + ty, z k + men) */
function fitOf(parts, head, eared) {
  const { cranium, jaw, earR } = parts;
  const mesh = compileLayered({ parts: { cranium, jaw, ...(earR ? { earR } : {}) }, dials: {}, creases: {} });
  const of = (re) => mesh.vertices.filter((_, i) => re.test(mesh.provenance[i].part));
  const top = Math.max(...of(/^(cranium|jaw)$/).map((v) => v[2])), men = Math.min(...of(/^jaw$/).map((v) => v[2]));
  const ear = of(/^earR$/), earY = ear.length ? ear.reduce((a, v) => a + v[1], 0) / ear.length : 0;
  const f = (q) => head.field({ x: q[0], y: q[1], z: q[2] }), V = head.landmarks.H, vx = head.points.vertex;
  const hz = crossing(f, [0, vx.y, 0.5 * V], [0, 0, 1], 2 * V, 0.0005)[2], k = (top - men) / hz;
  return { k, men, ty: earY - eared.landmarks.tragionR.y * k };
}

/** the neck's column as a distance: each ring a level polygon at its mean height, lerped between; closed at both ends
 * (from ring `from` up: a ray cast steeply down the side found the neck's flared base again past the seam) */
function neckField(neck, from = 0) {
  const rings = neck.stations.slice(from).map((st) => { const pts = neck.slots.map((s) => st.points[s]); return { z: mean(pts)[2], pts }; });
  const zTop = Math.max(...rings.at(-1).pts.map((p) => p[2])), zBot = Math.min(...rings[0].pts.map((p) => p[2]));
  const poly = (pts, x, y) => {
    let d = Infinity, inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[j], b = pts[i], ex = b[0] - a[0], ey = b[1] - a[1], wx = x - a[0], wy = y - a[1];
      const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1)));
      d = Math.min(d, Math.hypot(wx - ex * t, wy - ey * t));
      if ((a[1] > y) !== (b[1] > y) && x < a[0] + ((y - a[1]) * ex) / ey) inside = !inside;
    }
    return inside ? -d : d;
  };
  return (q) => {
    let i = rings.findIndex((r) => r.z > q[2]), pts;
    if (i === 0) pts = rings[0].pts;
    else if (i < 0) pts = rings.at(-1).pts;
    else { const a = rings[i - 1], b = rings[i], t = (q[2] - a.z) / (b.z - a.z); pts = a.pts.map((p, s) => lerp3(p, b.pts[s], t)); }
    return Math.max(poly(pts, q[0], q[1]), q[2] - zTop, zBot - q[2]);
  };
}

/** the OUTERMOST crossing of `f` on the line from `from` along `d` (marched in from `from`, which stands outside, `reach`
 * at most; a step no longer than `step`, so a lid or an ear's rim is not stepped over), or null */
function castAlong(f, from, d, reach, step = 0.0005) {
  const at = (t) => [from[0] + d[0] * t, from[1] + d[1] * t, from[2] + d[2] * t];
  let t = 0, ft = f(from);
  if (ft <= 0) return null;
  while (t < reach) {
    const tn = t + Math.max(step, Math.min(ft / 4, 0.01)), fn = f(at(tn));
    if (fn <= 0) { let lo = t, hi = tn; for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (f(at(m)) > 0) lo = m; else hi = m; } return at(hi); }
    t = tn; ft = fn;
  }
  return null;
}
const add3 = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** each station's `normals` (slot → the unit gradient of `f` at its point, at rest): the part shades by its field, not its
 * facets (station-loft-shade.js authoredNormals) */
function withNormals(P, f, e = 1e-4) {
  const n4 = (x) => Math.round(x * 1e4) / 1e4;
  const at = (p) => { const g = [f([p[0] + e, p[1], p[2]]) - f([p[0] - e, p[1], p[2]]), f([p[0], p[1] + e, p[2]]) - f([p[0], p[1] - e, p[2]]), f([p[0], p[1], p[2] + e]) - f([p[0], p[1], p[2] - e])], l = Math.hypot(...g) || 1; return g.map((x) => n4(x / l)); };
  return { ...P, stations: P.stations.map((st) => ({ ...st, normals: Object.fromEntries(P.slots.map((sl) => [sl, at(st.points[sl])])) })) };
}

/** a RELIEF's frame: the disc about `c` square to `d` (the look, from the viewer to the skin: forward, tilted down by
 * `tilt`°), 0° `up` and 90° toward the figure's right; a point cast onto a field along the look, and a point's place in
 * the disc ({ r, th } and its depth `h` along the look's reverse) */
function reliefFrame(c, tilt, reach) {
  const t = (tilt * Math.PI) / 180, d = [0, Math.cos(t), -Math.sin(t)], up = [0, Math.sin(t), Math.cos(t)], side = [1, 0, 0];
  const inPlane = (th, r) => add3(add3(c, up, r * Math.cos(th)), side, r * Math.sin(th));
  const cast = (f, q) => castAlong(f, add3(q, d, reach), d.map((v) => -v), 2 * reach);
  const at = (q) => {
    const v = [q[0] - c[0], q[1] - c[1], q[2] - c[2]], a = v[0] * up[0] + v[1] * up[1] + v[2] * up[2], b = v[0] * side[0] + v[1] * side[1] + v[2] * side[2];
    return { r: Math.hypot(a, b), th: Math.atan2(b, a), h: v[0] * d[0] + v[1] * d[1] + v[2] * d[2] };
  };
  return { c, d, up, side, inPlane, cast, at };
}

/** an outline's convex hull (radii at N even angles from 0°), read back at the same angles */
function hullOf(radii) {
  const N = radii.length, pts = radii.map((r, j) => [r * Math.cos((2 * Math.PI * j) / N), r * Math.sin((2 * Math.PI * j) / N)]);
  const side = (a, b, q) => (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
  return radii.map((_, j) => {
    const u = [Math.cos((2 * Math.PI * j) / N), Math.sin((2 * Math.PI * j) / N)];
    let r = 0;
    for (let i = 0; i < N; i++) for (let k = i + 1; k < N; k++) {
      const a = pts[i], b = pts[k], den = u[0] * (b[1] - a[1]) - u[1] * (b[0] - a[0]);
      if (Math.abs(den) < 1e-12) continue;
      const t = (a[0] * (b[1] - a[1]) - a[1] * (b[0] - a[0])) / den, s = (u[1] * a[0] - u[0] * a[1]) / den;
      if (t > r && s >= -1e-9 && s <= 1 + 1e-9 && (pts.every((q) => side(a, b, q) <= 1e-12) || pts.every((q) => side(a, b, q) >= -1e-12))) r = t;
    }
    return r;
  });
}
/** a table of radii at N even angles, read at any angle */
const lookup = (R) => (th) => { const N = R.length, x = ((th / (2 * Math.PI)) * N + N) % N, i = Math.floor(x), f = x - i; return R[i % N] * (1 - f) + R[(i + 1) % N] * f; };

/** the VISAGE's frame and reach: per direction in its disc, how far the features change the skin (the whole field
 * against the bare one, cast along the look); the disc's outline the convex hull of that, reached past by `1 / inner`,
 * short of where the face turns away. `f(q)`: a point's share of the reach (0 the middle, 1 the rim) */
function visageFrame(fF, fB, c, C) {
  const F = reliefFrame(c, C.tilt, C.reach), half = C.slots / 2, raw = [];
  for (let j = 0; j <= half; j++) {
    const th = (Math.PI * j) / half;
    let zone = 0.01, sil = C.most;
    for (let r = 0.002; r <= C.most; r += 0.001) {
      const q = F.inPlane(th, r), a = F.cast(fF, q);
      if (!a) { sil = r - 0.001; break; }
      const b = F.cast(fB, q);
      if (!b || dist3(a, b) > 0.0003) zone = r;
    }
    raw.push({ zone, sil });
  }
  const at = (j) => raw[j <= half ? j : C.slots - j], hull = hullOf(Array.from({ length: C.slots }, (_, j) => at(j).zone));
  const R = hull.map((h, j) => Math.min(h / C.inner, at(j).sil - 0.002)), Rat = lookup(R);
  return { ...F, R, Rat, f: (q) => { const p = F.at(q); return { f: p.r / Rat(p.th), h: p.h }; } };
}

/** the NOSE's frame: the disc about the nose's middle, looked at along the face's look; per direction the nose's
 * OUTLINE, where the whole field first comes back onto the bare one (the wings' creases, the sidewalls), held within
 * `noseMost`; its hull. `beyond(q)`: how far out past the outline a point stands */
function noseFrame(fF, fB, c, sn, C) {
  const F = reliefFrame(c, C.tilt, C.reach), N = C.noseSlots, half = N / 2, raw = [];
  // (no lower than the nose's base: under it the lips are the visage's)
  const floor = F.at(sn).r * Math.cos(F.at(sn).th) - C.noseBase;
  for (let j = 0; j <= half; j++) {
    const th = (2 * Math.PI * j) / N;
    const most = Math.cos(th) < -1e-6 ? Math.min(C.noseMost, floor / Math.cos(th)) : C.noseMost;
    let o = most;
    for (let r = 0.004; r <= most; r += 0.0005) { const q = F.inPlane(th, r), a = F.cast(fF, q), b = F.cast(fB, q); if (a && b && dist3(a, b) < 0.0004) { o = r; break; } }
    raw.push(o);
  }
  const O = lookup(hullOf(Array.from({ length: N }, (_, j) => raw[j <= half ? j : N - j])));
  // (its reach shorter toward the lips, so the lips' line is the visage's)
  const scale = (th) => 1 - C.noseShortDown * Math.max(0, -Math.cos(th)) ** 2;
  return { ...F, O, scale, beyond: (q) => { const p = F.at(q); return (p.r - O(p.th)) / scale(p.th); } };
}

/** an EYE's frame (the right; the left its mirror): the disc about the globe's centre, looked at along the eye's own
 * look; per direction the OPENING's edge (as far out as the cast skin is the globe's, the head's paint), its hull.
 * `beyond(q)`: how far out past the opening's edge a point stands */
function eyeFrame(fF, paintAt, c, C) {
  const F = reliefFrame(c, C.eyeTilt, 0.06), N = C.eyeSlots, open = [];
  for (let j = 0; j < N; j++) {
    const th = (2 * Math.PI * j) / N;
    let o = 0.001;
    for (let r = 0.001; r <= 0.02; r += 0.00025) { const hit = F.cast(fF, F.inPlane(th, r)); if (!hit || !paintAt(hit)) break; o = r; }
    open.push(o);
  }
  const O = lookup(hullOf(open));
  // (its reach shorter toward the nose, so the bridge is the nose's)
  const scale = (th) => 1 - C.eyeShortIn * Math.max(0, -Math.sin(th)) ** 2;
  // the ROOM out past the edge, per direction: where the outer ring would cast past the face's side (a wide eye on a
  // narrow face, the skin there turned away from the eye's look), the rings out there close in to the furthest that
  // still meets the skin; elsewhere 1 (the rings as drawn)
  const room = Array.from({ length: N }, (_, j) => {
    const th = (2 * Math.PI * j) / N, o = O(th), out = C.eyeOut[0] * scale(th);
    if (F.cast(fF, F.inPlane(th, o + out))) return 1;
    let r = o;
    while (r + 0.0005 < o + out && F.cast(fF, F.inPlane(th, r + 0.0005))) r += 0.0005;
    return Math.max(0, r - o - 0.0005) / out;
  });
  // (eased into its neighbours over `eyeRoomEase` slots, a slope from each closed-in direction back up to 1: a lone
  // direction closed in beside open ones stood its rings as a spike at the eye's corner)
  const W = C.eyeRoomEase, eased = room.map((_, j) => {
    let m = 1;
    for (let k = -W; k <= W; k++) { const q = room[(j + k + N) % N]; m = Math.min(m, q + (Math.abs(k) / W) * (1 - q)); }
    return m;
  });
  return { ...F, O, scale, room: lookup(eased), beyond: (q) => { const p = F.at(q); return (p.r - O(p.th)) / scale(p.th); } };
}

/** a RELIEF part: rings about its frame's middle, ring `i` (0 the rim, inward) at `radius(th, i)`, each point cast
 * along the look onto `fF`; the rings from `relaxFrom` in relaxed `relax` times on the skin (each drawn toward its
 * neighbours and projected back: the walls a view leaves under what overhangs it relaxed out); then each point let down
 * along the look by `sink(p, i)`; closed behind by a ring `depth` back. `sym`: the left half the right's mirror (a part
 * on the midline). Its bands painted by `paintAt` (Sclera, Iris, Pupil). */
function reliefPart(F, fF, { slots: N, rings: n, radius, sym, relax = 0, relaxFrom = 0, sink, depth, paintAt = null, name }) {
  const half = N / 2, slots = ringSlots(N), js = sym ? half + 1 : N;
  const ringAt = (i) => {
    const pts = new Array(N);
    for (let j = 0; j < js; j++) {
      const th = (2 * Math.PI * j) / N, hit = F.cast(fF, F.inPlane(th, radius(th, i)));
      if (!hit) throw new Error(`hero-relational-head: the ${name} found no skin (ring ${i}, slot ${slots[j]})`);
      pts[j] = sym && (j === 0 || j === half) ? [0, hit[1], hit[2]] : hit;
      if (sym && j && j < half) pts[N - j] = [-hit[0], hit[1], hit[2]];
    }
    return pts;
  };
  const shown = Array.from({ length: n }, (_, i) => ringAt(i));
  for (let it = 0; it < relax; it++) {
    const next = shown.map((r) => r.slice());
    for (let i = Math.max(1, relaxFrom); i < n - 1; i++) for (let j = 0; j < js; j++) {
      const r = shown[i], nb = [r[(j + 1) % N], r[(j + N - 1) % N], shown[i - 1][j], shown[i + 1][j]];
      const m = [0, 1, 2].map((q) => (nb[0][q] + nb[1][q] + nb[2][q] + nb[3][q]) / 4), q = project(fF, lerp3(r[j], m, 0.5), 12, true) ?? r[j];
      next[i][j] = sym && (j === 0 || j === half) ? [0, q[1], q[2]] : q;
      if (sym && j && j < half) next[i][N - j] = [-q[0], q[1], q[2]];
    }
    shown.forEach((_, i) => { shown[i] = next[i]; });
  }
  const sunk = shown.map((r, i) => r.map((p) => add3(p, F.d, -sink(p, i))));
  const rim = sunk[0], mid = mean(rim), deep = rim.map((p) => add3(lerp3(p, mid, 0.15), F.d, -depth));
  const rings = [deep, ...sunk], tip = F.cast(fF, F.c);
  const stations = rings.map((pts, i) => ({ id: `st${i}`, u: i, points: Object.fromEntries(slots.map((s, j) => [s, rp(pts[j])])) }));
  const G = { sclera: 'Sclera', iris: 'Iris', pupil: 'Pupil' }, bandGroups = {};
  if (paintAt) for (let i = 1; i + 1 < rings.length; i++) {
    const row = [];
    for (let k = 0; k < half; k++) row.push(G[paintAt(mean([shown[i - 1][k], shown[i - 1][k + 1], (shown[i] ?? shown[i - 1])[k], (shown[i] ?? shown[i - 1])[k + 1]]))] || 'Skin');
    if (row.some((g) => g !== 'Skin')) bandGroups[`st${i}-st${i + 1}`] = row;
  }
  return { rings, part: { layer: 1, closure: 'closed', slots, stations, caps: { back: rp(add3(mean(deep), F.d, -0.004)), tip: rp(tip) }, group: 'Skin', ...(Object.keys(bandGroups).length ? { bandGroups } : {}), ...(paintAt && G[paintAt(tip)] ? { capGroups: { tip: G[paintAt(tip)] } } : {}) } };
}

/** THE EAR (the right; the left its mirror): a tube up the ear from the lobe to the helix's top, each ring the ear's
 * section at its height, its lateral face cast from beside the head and its medial face from inside, across the ear's
 * width at that height (front slot its front edge, `back` its back edge): the plate stands off the head, its root sunk
 * into the skin. Bound to the head. */
function earPart(fE, tragion, C) {
  // the ear's outline seen from beside the head (a grid of casts across it)
  const out = [1, 0, 0], inn = [-1, 0, 0], x0 = tragion[0] + 0.06, x1 = tragion[0] - 0.05;
  const lat = (y, z) => castAlong(fE, [x0, y, z], inn, 0.12, 0.0004), med = (y, z) => castAlong(fE, [x1, y, z], out, 0.12, 0.0004);
  const hits = [];
  for (let z = tragion[2] - 0.05; z <= tragion[2] + 0.06; z += 0.002) for (let y = tragion[1] - 0.06; y <= tragion[1] + 0.02; y += 0.002) if (lat(y, z)) hits.push([y, z]);
  if (!hits.length) throw new Error('hero-relational-head: the ear\'s field shows nothing beside the head');
  const z0 = Math.min(...hits.map((h) => h[1])) + 0.0015, z1 = Math.max(...hits.map((h) => h[1])) - 0.0015, half = C.earSlots / 2, slots = ringSlots(C.earSlots);
  // its width at a height: the first and last cast that finds it, each edge then bisected
  const edge = (z, yIn, yOut) => { let a = yIn, b = yOut; for (let i = 0; i < 16; i++) { const m = (a + b) / 2; if (lat(m, z)) a = m; else b = m; } return a; };
  const width = (z) => { const row = []; for (let y = tragion[1] - 0.06; y <= tragion[1] + 0.02; y += 0.001) if (lat(y, z)) row.push(y); return row.length ? [edge(z, row[0], row[0] - 0.001), edge(z, row.at(-1), row.at(-1) + 0.001)] : null; };
  const rings = [];
  for (let i = 0; i < C.earRings; i++) {
    const z = z0 + ((z1 - z0) * i) / (C.earRings - 1), w = width(z);
    if (!w) continue;
    const [yb, yf] = [w[0] + 0.0004, w[1] - 0.0004], pts = new Array(C.earSlots);
    // slot j from the front edge (0) over the lateral face to the back edge (half), and back over the medial face
    for (let j = 0; j < C.earSlots; j++) {
      const s = j <= half ? j / half : (C.earSlots - j) / half, y = yf + (yb - yf) * (0.5 - 0.5 * Math.cos(Math.PI * s));
      const p = (j <= half ? lat : med)(y, z) ?? (j <= half ? med : lat)(y, z);
      pts[j] = p ?? [tragion[0], y, z];
    }
    rings.push(pts);
  }
  const cap = (ring, dz) => { const m = mean(ring); return rp([m[0], m[1], m[2] + dz]); };
  const stations = rings.map((pts, i) => ({ id: `st${i}`, u: i, points: Object.fromEntries(slots.map((s, j) => [s, rp(pts[j])])) }));
  return { layer: 1, closure: 'closed', slots, stations, caps: { back: cap(rings[0], -0.0015), tip: cap(rings.at(-1), 0.0015) }, group: 'Skin', bind: { bone: 'head', blend: {} } };
}

/**
 * The realistic hero's recipe (a sliced one: formSlice) wearing the relational head in place of its landmark head.
 * `sex` picks the head's pole; `relations` and `eyes` a face of its own over the pole's (face-compose.js composeFace's,
 * on the pole's own tune: solving one per face costs most of a minute, and a composed face sits near its pole). Returns
 * a new recipe; the one given is left as it was.
 */
export function relationalHeadRecipe(recipe, { sex = 'male', relations = null, eyes = null, tune: own_ = null, actions = null, fit = null, opts = {} } = {}) {
  const C = { ...RELATIONAL_HEAD, ...opts };
  const r = structuredClone(recipe), parts = r.parts, neck = parts.neck;
  if (!parts.cranium || !parts.jaw || !neck) throw new Error('hero-relational-head: the recipe carries no landmark head on a neck');
  // (a face's own tune, solved for its relations, in place of the pole's: the head the study shows, exactly; it rides the fit)
  const tune = own_ ?? HEAD_TUNES[sex];
  if (!tune) throw new Error(`hero-relational-head: the head's pole is ${Object.keys(HEAD_TUNES).join(' or ')}`);
  const own = { ...(relations ? { relations } : {}), ...(eyes && Object.keys(eyes).length ? { eyes } : {}) };
  // (`actions`, the face's: head-relational.js ACTIONS, a blink, a smile, a brow; `fit` the rest's, kept so an action moves
  // the face and never the head's place: relational-face-rig.js differences these builds)
  const head = relationalHead({ sex, tune, ears: false, ...own, ...(actions ? { actions } : {}) }), eared = fit ? null : relationalHead({ sex, tune, ...own });
  const { k, ty, men } = fit ?? fitOf(parts, head, eared);
  const toHero = (p) => [p.x * k, p.y * k + ty, p.z * k + men];
  const inHead = (f) => (q) => f({ x: q[0] / k, y: (q[1] - ty) / k, z: (q[2] - men) / k }) * k;
  const fH = inHead(head.field), fBare = inHead(head.bare);
  // THE VISAGE's frame first: the cranium is let down under it by its reach (`deflate`, eased out over its rim)
  const V = visageFrame(fH, fBare, toHero(mid3(head.points.sto, head.points.ls)), C);
  const under = (q) => { const { f, h } = V.f(q); return (C.deflate * (1 - ramp((f - 0.85 * C.inner) / (0.15 * C.inner))) + C.rimDeflate * (1 - ramp((f - C.inner) / (1 - C.inner)))) * ramp((h + 0.06) / 0.02); };
  // (under the visage let down from the deeper of the bare head and the face itself: a deep-set eye's socket, sunk past
  // the bare head's reach, would have the cranium stand in front of the globe)
  // (and about each eye let down `eyeDeflate` more, within `eyeAround` of the globe's centre easing out over `eyeAroundRise`:
  // the visage there is held behind the globe, and the cranium must lie under it)
  const eyeC = toHero(head.points.eyeR), nearEye = (q) => 1 - ramp((Math.min(Math.hypot(q[0] - eyeC[0], q[1] - eyeC[1], q[2] - eyeC[2]), Math.hypot(q[0] + eyeC[0], q[1] - eyeC[1], q[2] - eyeC[2])) - C.eyeAround) / C.eyeAroundRise);
  const fB = (q) => { const u = under(q); return fBare(q) + u + (u > 0 ? Math.max(0, fH(q) - fBare(q)) : 0) + C.eyeDeflate * nearEye(q); };

  // THE SEAM: the highest neck ring standing wholly outside the head by the join's width (where the union is the neck's)
  let seam = -1;
  for (let i = neck.stations.length - 1; i >= 0 && seam < 0; i--) if (neck.slots.every((s) => fB(neck.stations[i].points[s]) > C.join)) seam = i;
  if (seam < 1) throw new Error('hero-relational-head: no neck ring stands clear of the head');
  // (the union's neck from the ring under the seam: the head's lower rings start on the seam and only rise from it)
  const fN = neckField(neck, seam - 1), fU = (q) => smin(fB(q), fN(q), C.join);
  const seamSt = neck.stations[seam], N = neck.slots.length, H = N * C.multiple, slots = ringSlots(H), half = H / 2;
  const seamPts = Array.from({ length: H }, (_, j) => { const i = Math.floor(j / C.multiple), t = (j % C.multiple) / C.multiple; return lerp3(seamSt.points[neck.slots[i]], seamSt.points[neck.slots[(i + 1) % N]], t); });

  // the centre: over the seam ring's middle, at the ear canal's height
  const P = head.points, c0 = mean(seamPts), O = [0, c0[1], toHero(P.porionR)[2]];
  const az = seamPts.map((p) => Math.atan2(p[0] - O[0], p[1] - O[1]));
  const dir = (a, f) => [Math.sin(a) * Math.cos(f), Math.cos(a) * Math.cos(f), Math.sin(f)];
  // the OUTERMOST crossing along the ray, marched in from outside (`reach` out): the head's field is not negative all
  // through (pockets between the masses, behind the lips), so the first crossing outward from O can be a pocket's wall
  const reach = 0.22, LIP = 4;
  const cast = (a, f) => {
    const d = dir(a, f), at = (t) => [O[0] + d[0] * t, O[1] + d[1] * t, O[2] + d[2] * t];
    let t = reach, ft = fU(at(t));
    if (ft <= 0) return crossing(fU, O, d, reach, 0.002);
    while (t > 0) {
      const tn = t - Math.max(0.002, ft / LIP), fn = fU(at(tn));
      if (fn <= 0) { let lo = tn, hi = t; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (fU(at(m)) <= 0) lo = m; else hi = m; } return at((lo + hi) / 2); }
      t = tn; ft = fn;
    }
    return null;
  };
  const latOf = (p) => Math.atan2(p[2] - O[2], Math.hypot(p[0] - O[0], p[1] - O[1]));
  // the latitude at which column a's skin stands at height z (bisection: the crossing's height rises with the latitude)
  const latAt = (a, z, lo, hi) => { for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2, q = cast(a, m); if (q && q[2] < z) lo = m; else hi = m; } return (lo + hi) / 2; };

  // THE MOUTH RING: level with the stomion, and across the mouth on the lips' meeting line (the groove: the nearest
  // the skin comes to O between the lips), eased back to the level past the corners
  const zM = toHero(P.sto)[2], ch = toHero(P.chR), aCh = Math.atan2(ch[0] - O[0], ch[1] - O[1]), ease = (6 * Math.PI) / 180;
  const shut = (a) => ramp((Math.abs(a) - aCh) / ease);   // 0 between the corners, 1 past them
  const latM = new Array(H);
  for (let j = 0; j <= half; j++) {
    const a = az[j], f0 = latAt(a, zM, latOf(seamPts[j]), Math.PI / 2 - 0.05), w = 1 - shut(a);
    let f = f0;
    if (w > 0) {
      const q0 = cast(a, f0), d0 = Math.hypot(q0[0] - O[0], q0[1] - O[1], q0[2] - O[2]), span = 0.005 / d0;
      let best = f0, bd = d0;
      for (let s = -12; s <= 12; s++) { const fs = f0 + (span * s) / 12, q = cast(a, fs); if (!q) continue; const d = Math.hypot(q[0] - O[0], q[1] - O[1], q[2] - O[2]); if (d < bd) { bd = d; best = fs; } }
      f = f0 + w * (best - f0);
    }
    latM[j] = f; if (j && j < half) latM[H - j] = f;
  }
  // a column's points, its right half cast and its left the mirror
  const column = (fOf) => {
    const pts = new Array(H);
    for (let j = 0; j <= half; j++) { const q = cast(az[j], fOf(j)); if (!q) throw new Error(`hero-relational-head: a ray found no skin (slot ${slots[j]})`); pts[j] = q; if (j && j < half) pts[H - j] = [-q[0], q[1], q[2]]; }
    for (const j of [0, half]) pts[j] = [0, pts[j][1], pts[j][2]];
    return pts;
  };
  const mouthPts = column((j) => latM[j]);
  const jawRings = [seamPts, ...Array.from({ length: C.jaw - 1 }, (_, i) => column((j) => latOf(seamPts[j]) + ((latM[j] - latOf(seamPts[j])) * (i + 1)) / C.jaw)), mouthPts];
  const top = (C.top * Math.PI) / 180;
  const cranRings = [mouthPts, ...Array.from({ length: C.cranium - 1 }, (_, i) => column((j) => latM[j] + ((top - latM[j]) * (i + 1)) / (C.cranium - 1)))];
  const vertex = cast(0, Math.PI / 2);

  const station = (pts, i) => ({ id: `st${i}`, u: i, points: Object.fromEntries(slots.map((s, j) => [s, rp(pts[j])])) });
  // (the caps on the shared rings are inside the head, each set a few millimetres off its ring's middle OUTWARD for its
  // part: the loft winds a cap by its first face against the ring's middle, and a flat cap leaves that undecided)
  const lift = (ps, h) => { const c = mean(ps); return rp([c[0], c[1], c[2] + h]); };
  const mouthUp = lift(mouthPts, 0.004), mouthDown = lift(mouthPts, -0.004), seamUp = lift(seamPts, 0.004), seamDown = lift(seamPts, -0.004);

  // THE BIND. The seam ring carries the neck's blend there (lerped onto the head's extra slots); the rings above ease
  // to { jaw, head }: the jaw's share by how far ahead of the ramus (gonion → condyle) a point stands, held to the
  // mouth's corners on the mouth ring and freed of them a lip's height under it
  const nb = neck.bind?.blend || {}, nbone = typeof neck.bind === 'string' ? neck.bind : neck.bind.bone;
  const neckW = (s) => nb[`${seamSt.id}.${s}`] || nb[seamSt.id] || { [nbone]: 1 };
  const seamW = Array.from({ length: H }, (_, j) => { const i = Math.floor(j / C.multiple), t = (j % C.multiple) / C.multiple; return mixW(neckW(neck.slots[i]), neckW(neck.slots[(i + 1) % N]), t); });
  const go = toHero(P.goR), cd = toHero(P.condyleR), ry = cd[1] - go[1], rz = cd[2] - go[2], rl = Math.hypot(ry, rz);
  const ahead = (p) => ((p[1] - go[1]) * rz - (p[2] - go[2]) * ry) / rl;   // + toward the face, square to the ramus
  const jawShare = (p, a) => ramp((ahead(p) + 0.006) / 0.018) * (1 - shut(a) * (1 - ramp((zM - p[2]) / 0.015)));
  const blend = {};
  jawRings.forEach((pts, i) => slots.forEach((s, j) => {
    const v = ramp(i / (0.45 * C.jaw)), wj = r6(jawShare(pts[j], az[j])), target = wj > 0 ? (wj < 1 ? { head: r6(1 - wj), jaw: wj } : { jaw: 1 }) : { head: 1 };
    blend[`st${i}.${s}`] = four(mixW(seamW[j], target, v));
  }));
  blend.back = four(mixW(seamW[0], seamW[half], 0.5)); blend.tip = { head: 1 };
  parts.jaw = { layer: 1, closure: 'closed', slots, stations: jawRings.map(station), group: 'Skin', caps: { back: seamDown, tip: mouthUp }, capGroups: { back: 'Skin', tip: 'Mouth' }, bind: { bone: 'head', blend } };
  parts.cranium = { layer: 1, closure: 'closed', slots, stations: cranRings.map(station), group: 'Skin', caps: { back: mouthDown, tip: rp(vertex) }, capGroups: { back: 'Mouth', tip: 'Skin' }, bind: 'head' };

  // the landmark head leaves (its details, its creases, its dial); the neck ends on the seam
  const gone = landmarkHeadParts(recipe.parts);
  for (const g of gone) if (g !== 'cranium' && g !== 'jaw') delete parts[g];
  for (const [id, c] of Object.entries(r.creases || {})) if (gone.has(c.parent)) delete r.creases[id];
  if (r.dials?.jawOpen?.part === 'jaw') delete r.dials.jawOpen;
  const kept = new Set(neck.stations.slice(0, seam + 1).map((s) => s.id));
  neck.stations = neck.stations.slice(0, seam + 1);
  neck.caps = { ...neck.caps, tip: seamUp };
  if (neck.bind?.blend) {
    for (const key of Object.keys(nb)) { const st = key.split('.')[0]; if (st !== 'back' && st !== 'tip' && !kept.has(st)) delete nb[key]; }
    nb.tip = blend.back;
  }
  // THE VISAGE over them, bound as the jaw's skin is: under the lips' line (the stomion to the corners, eased level past
  // them) the jaw's share, sharp across the line between the corners; over it the head
  const S2 = (q) => ({ x: q[0] / k, y: (q[1] - ty) / k, z: (q[2] - men) / k });
  // (the visage samples the field eased over `blur` (four samples about each point, a tetrahedron's corners): the lids'
  // and the nose's wings' blends are finer than its rings, and sampled sharp they read as facets)
  const T = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => v.map((x) => (x * C.blur) / Math.sqrt(3)));
  const fSoft = (q) => (fH([q[0] + T[0][0], q[1] + T[0][1], q[2] + T[0][2]]) + fH([q[0] + T[1][0], q[1] + T[1][1], q[2] + T[1][2]]) + fH([q[0] + T[2][0], q[1] + T[2][1], q[2] + T[2][2]]) + fH([q[0] + T[3][0], q[1] + T[3][1], q[2] + T[3][2]])) / 4;
  const fV = C.blur ? fSoft : fH, paintAt = (q) => head.paint(S2(q));
  // THE EYES first (the visage is let down under them): each its own relief about its globe, its rings following the
  // opening's edge (the lids' margins run along them, not across), dense over the margins, out `eyeLid` past the edge;
  // its rim let down there, the visage let down under it inside `eyeUnder` of the edge
  const E = eyeFrame(fV, paintAt, toHero(head.points.eyeR), C);
  const OFF = C.eyeOut, IN = C.eyeIn;
  const eyeRadius = (th, i) => (i < OFF.length ? E.O(th) + OFF[i] * E.scale(th) * E.room(th) : E.O(th) * IN[i - OFF.length]);
  const eye = reliefPart(E, fV, { slots: C.eyeSlots, rings: OFF.length + IN.length, radius: eyeRadius, sym: false, sink: (q, i) => (i < OFF.length ? C.eyeRimSink * ramp((OFF[i] - C.eyeKeep) / (OFF[0] - C.eyeKeep)) : 0), depth: 0.006, paintAt, name: 'eye' });
  const beyond = (q) => Math.min(E.beyond(q), E.beyond([-q[0], q[1], q[2]]));
  // THE NOSE, its rings following its outline (the wings' creases and the sidewalls run along them), the visage let
  // down under it as under the eyes
  const Nf = noseFrame(fV, fBare, toHero(mid3(head.points.rhinion, head.points.prn)), toHero(head.points.sn), C), NOFF = C.noseOut, NIN = C.noseIn;
  // (the globe's front per direction about the eye, as its own look sees it)
  const gH = Array.from({ length: C.eyeSlots }, (_, j) => { const th = (2 * Math.PI * j) / C.eyeSlots, q = E.cast(fV, E.inPlane(th, C.eyeGlobeIn * E.O(th))); return q ? E.at(q).h : null; });
  const gMin = Math.min(...gH.filter((h) => h !== null)), globeH = (th) => gH[((Math.round((th / (2 * Math.PI)) * C.eyeSlots) % C.eyeSlots) + C.eyeSlots) % C.eyeSlots] ?? gMin;
  const underGlobe = (q) => {
    const m = [-q[0], q[1], q[2]], qq = E.beyond(q) <= E.beyond(m) ? q : m, b = E.beyond(qq), w = 1 - ramp((b - C.eyeUnder) / C.eyeRise);
    if (w <= 0) return 0;
    const p = E.at(qq); return Math.max(0, p.h - globeH(p.th) + C.eyeSink) * w;
  };
  const underEyes = (q) => Math.max(C.eyeSink * (1 - ramp((beyond(q) - C.eyeUnder) / C.eyeRise)), underGlobe(q));
  const nose = reliefPart(Nf, fV, { slots: C.noseSlots, rings: NOFF.length + NIN.length, radius: (th, i) => (i < NOFF.length ? Nf.O(th) + NOFF[i] * Nf.scale(th) : Nf.O(th) * NIN[i - NOFF.length]), sym: true, sink: (q, i) => (i < NOFF.length ? C.eyeRimSink * ramp((NOFF[i] - C.eyeKeep) / (NOFF[0] - C.eyeKeep)) : 0) + underEyes(q), depth: 0.008, name: 'nose' });
  const vis = reliefPart(V, fV, {
    slots: C.slots, rings: C.rings, radius: (th, i) => (1 - i / C.rings) * V.Rat(th), sym: true, relax: C.relax,
    relaxFrom: Math.ceil((1 - C.inner) * C.rings), depth: C.depth, name: 'visage',
    sink: (q, i) => C.sink * ramp((1 - i / C.rings - C.inner) / (1 - C.inner)) + Math.max(C.eyeSink * (1 - ramp((Math.min(beyond(q), Nf.beyond(q)) - C.eyeUnder) / C.eyeRise)), underGlobe(q)),
  }), sto = toHero(P.sto);
  const lipZ = (x) => { const u = Math.min(1, Math.abs(x) / Math.abs(ch[0])); return sto[2] + (ch[2] - sto[2]) * u * u + (zM - ch[2]) * ramp((Math.abs(x) - Math.abs(ch[0])) / 0.01); };
  const visW = (p) => {
    const a = Math.atan2(p[0] - O[0], p[1] - O[1]), s = shut(a), below = (1 - s) * ramp((lipZ(p[0]) - p[2] + 0.0005) / 0.001) + s * ramp((lipZ(p[0]) - p[2]) / 0.015);
    const wj = r6(ramp((ahead(p) + 0.006) / 0.018) * below);
    return wj > 0 ? (wj < 1 ? { head: r6(1 - wj), jaw: wj } : { jaw: 1 }) : { head: 1 };
  };
  const vblend = {};
  vis.rings.forEach((pts, i) => vis.part.slots.forEach((s, j) => { vblend[`st${i}.${s}`] = visW(pts[j]); }));
  vblend.back = { head: 1 }; vblend.tip = visW(vis.part.caps.tip);
  parts.visage = { ...vis.part, bind: { bone: 'head', blend: vblend } };

  // THE EARS, each on its own field
  const earR = head.earFields.find((e) => e.side === 'R');
  if (earR) {
    const R = earPart(inHead(earR.field), toHero(earR.tragion), C);
    parts.earR = R; parts.earL = mirrorPart(R, { ...R, bind: { bone: 'head' } });
  }
  parts.eyeR = { ...eye.part, bind: { bone: 'head', blend: {} } };
  parts.nose = { ...nose.part, bind: 'head' };
  parts.eyeL = mirrorPart(parts.eyeR, { ...parts.eyeR, bind: { bone: 'head' } });
  // THE NORMALS: each part shades by the field it was sampled from, so where two hand over (each let down under the
  // other by a slope) they shade as one skin, and the lids' and the wings' blends finer than the rings read smooth
  parts.jaw = withNormals(parts.jaw, fU); parts.cranium = withNormals(parts.cranium, fU);
  for (const k of ['visage', 'nose', 'eyeR', 'eyeL']) parts[k] = withNormals(parts[k], fV);
  if (earR) { const fE = inHead(earR.field); parts.earR = withNormals(parts.earR, fE); parts.earL = withNormals(parts.earL, (q) => fE([-q[0], q[1], q[2]])); }


  // THE FIT kept on the recipe: the head's pole and its scale and offsets into the hero's frame, so its skin can be read
  // back in the head's own frame (its sphere's addresses, its landmarks' marks: epidermis/dermal-hero.js)
  // (a face of its own rides the fit, so the skin charts the head the face shaped: dermal-hero.js headSkin)
  r.headFit = { sex, k: r6(k), ty: r6(ty), men: r6(men), ...own, ...(own_ ? { tune: own_ } : {}) };
  // the rig's jaw on the head's own joint: the hinge between the condyles, the tip at the gnathion
  const J = r.rig.joints, at = (name, p) => { if (J[name]) J[name] = Array.isArray(J[name]) ? rp(p) : { ...J[name], at: rp(p) }; };
  at('jawHinge', [0, cd[1], cd[2]]); at('jawTip', toHero(P.gn));
  return r;
}
