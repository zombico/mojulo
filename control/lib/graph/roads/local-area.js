/**
 * LOCAL AREAS — each zone of the arena plan (arena-plan.js) built on its own, in PASSES, so a venue is never one-shot:
 * every pass reviewable, every zone re-rolled on its own seed (or held, or stopped at a pass) without touching the rest.
 *
 *   ground     a graded pad at the zone's footprint (level at its highest ground, retaining walls where the land falls
 *              away), paved by its use (asphalt for the pit lane, paddock and car park, concrete under a building or a
 *              stand, gravel round the landmark), a car park's bays painted
 *   massing    the volumes the zone will hold, plain: the pit building's block, a stand's wedge, hospitality's box
 *              (drawn only when the area stops here: the review of the volumes before their elements)
 *   elements   the structure from blocks (set-pieces.js), in modules where it runs long (the pit building a row of pit
 *              modules along the straight, a long stand in sections), facing the track; with `stands` (stadium/stand.js
 *              readStands) a stand is the stadium's section swept along the zone's front instead, on every pole but
 *              the voxel's
 *   dressing   what makes it used: the pit wall and its catch fence, a stand's fence, the team trucks in the paddock,
 *              cars parked, lamp posts
 *
 * The roads (the service ring, the spurs) are a local area of their own: asphalt laid on the land, lamps along the
 * spurs, a spur stopped short of the track where it goes under it (a tunnel's portals).
 *
 *   buildLocalAreas(plan, arena, { K, seed, local: { <zone>: { seed?, skip?, upTo? } }, upTo, stands? }) →
 *       { areas: [{ zone, use, seed, upTo, pad, passes: { ground, massing, elements, dressing } (face counts), laws }],
 *         faces, colliders, things, byZone: { <zone>: the faces it drew } }
 *   localCamera(plan, arena, zoneId) → a worldFraming that looks at one area (its review shot)
 *
 * Pure, deterministic: an area's seed is its own (the venue's and its zone's id), so re-rolling one moves nothing else.
 */
import { face, faceOut } from './road-faces.js';
import { buildBlock } from '../era/blocks.js';
import { TRACK_BLOCKS, paintPiece } from './set-pieces.js';
import { buildVehicle, PAINTS, FLEET } from './fleet.js';
import { boxFaces } from './road-faces.js';
import { ARENA } from './arena-plan.js';
import { mulberry32 } from '../vegetation/grow.js';
import { standFaces, paintStand } from '../stadium/stand.js';

export const PASSES = Object.freeze(['ground', 'massing', 'elements', 'dressing']);
const PAVING = Object.freeze({ 'pit lane': 'asphalt', paddock: 'asphalt', 'car park': 'asphalt', 'pit building': 'concrete', hospitality: 'concrete', grandstand: 'concrete', 'landmark ground': 'gravel' });
/** How high a class's buildings stand (m): the pit building, hospitality; a stand's rows. */
const HEIGHTS = Object.freeze({ circuit: { pit: 9, hosp: 8, rows: 10 }, kart: { pit: 4.5, hosp: 5, rows: 5 }, rally: { pit: 6, hosp: 6, rows: 6 } });
const RETAIN_MAX = Object.freeze({ circuit: 4, kart: 2, rally: 4 });
const r3 = (v) => Math.round(v * 1000) / 1000;
const fnv = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// a zone's footprint as its two long edges (a strip, or a rectangle: the near edge first, the far reversed)
const edges = (poly) => { const m = poly.length / 2; return { near: poly.slice(0, m), far: poly.slice(m).reverse() }; };
const centroid = (poly) => poly.reduce((s, p) => [s[0] + p[0] / poly.length, s[1] + p[1] / poly.length], [0, 0]);
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export function buildLocalAreas(plan, arena, { K, seed = 1, local = {}, upTo = 'dressing', stands = null } = {}) {
  const cls = plan.course.class, A = ARENA[cls] ?? ARENA.circuit, Hh = HEIGHTS[cls] ?? HEIGHTS.circuit;
  const a = plan.alignment, X = plan.X, Lt = a.length, ground = plan.groundAt;
  const C = Array.from({ length: Math.max(32, Math.round(Lt / 2)) + 1 }, (_, i) => a.at(Math.min(Lt, (i * Lt) / Math.max(32, Math.round(Lt / 2)))));
  const nearestC = (x, y) => { let b = C[0], d = Infinity; for (const c of C) { const e = (c.x - x) ** 2 + (c.y - y) ** 2; if (e < d) { d = e; b = c; } } return { c: b, d: Math.sqrt(d) }; };
  const areas = [], faces = [], colliders = [], things = [], byZone = {};
  const build = (id, params, at, yaw, s) => {
    const B = TRACK_BLOCKS[id], b = buildBlock(B, { params, library: TRACK_BLOCKS, many: 0.5, seed: s, at, yaw: (yaw * 180) / Math.PI });
    return { b, faces: paintPiece(b.faces, K) };
  };
  const facingTrack = (p) => { const { c } = nearestC(p[0], p[1]); return Math.atan2(c.y - p[1], c.x - p[0]) + Math.PI / 2; };
  const box = (b) => ({ min: b.box.lo.map(r3), max: b.box.hi.map(r3) });

  for (const z of arena.zones) {
    const o = local[z.id] ?? {};
    if (o.skip) { areas.push({ zone: z.id, use: z.use, skipped: true }); continue; }
    const s = Number.isInteger(o.seed) ? o.seed : (fnv(`${seed}:${z.id}`) % 1000003) + 1, stop = PASSES.indexOf(o.upTo ?? upTo), rnd = mulberry32(s);
    const passes = { ground: [], massing: [], elements: [], dressing: [] }, laws = [];
    const { near, far } = edges(z.poly), m = near.length, cz = centroid(z.poly);
    // ── ground: the pad. A strip along the road (the pit lane, the pit building, the paddock) is level with the track
    // it serves, following its grade; a block of its own (a stand, the car park) one level, at its highest ground ──
    const STRIP = z.use === 'pit lane' || z.use === 'pit building' || z.use === 'paddock';
    const under = [...z.poly, cz, ...near.map((p, i) => lerp2(p, far[i], 0.5))].map(([x, y]) => ground(x, y));
    const level = r3(Math.max(...under) + 0.05);
    // (a strip never under its land: the road's height where the land is lower, the land's where it rises)
    const zAt = (p) => (STRIP ? r3(Math.max(nearestC(p[0], p[1]).c.z, ground(p[0], p[1])) + 0.05) : level);
    const zPad = zAt(cz);
    const top = (p, dz = 0) => [p[0], p[1], zAt(p) + dz];
    // (across its depth too, every 8 m: a pad that follows its land must have heights where the land bulges)
    const across = STRIP ? Math.max(1, Math.ceil(Math.hypot(far[0][0] - near[0][0], far[0][1] - near[0][1]) / 8)) : 1;
    for (let i = 0; i < m - 1; i++) for (let j = 0; j < across; j++) {
      const A0 = lerp2(near[i], far[i], j / across), A1 = lerp2(near[i], far[i], (j + 1) / across), B0 = lerp2(near[i + 1], far[i + 1], j / across), B1 = lerp2(near[i + 1], far[i + 1], (j + 1) / across);
      const q = [top(A0), top(B0), top(B1), top(A1)];
      passes.ground.push(K.surface(PAVING[z.use] ?? 'concrete', q, q.map((p) => [p[0] / 2.5, p[1] / 2.5])));
    }
    // retaining walls where the land falls away from the pad
    let retain = 0;
    for (let i = 0; i < z.poly.length; i++) {
      const p = z.poly[i], q = z.poly[(i + 1) % z.poly.length], gp = ground(p[0], p[1]), gq = ground(q[0], q[1]), zp = zAt(p), zq = zAt(q);
      if (zp - gp < 0.15 && zq - gq < 0.15) continue;
      retain = Math.max(retain, zp - gp, zq - gq);
      passes.ground.push(K.wall('concrete', [[p[0], p[1], zp], [q[0], q[1], zq], [q[0], q[1], Math.min(gq, zq) - 0.1], [p[0], p[1], Math.min(gp, zp) - 0.1]], cz));
    }
    if (retain > (RETAIN_MAX[cls] ?? 4)) laws.push({ law: 'graded', detail: `${z.id}'s pad stands ${r3(retain)} m over the land at its edge (at most ${RETAIN_MAX[cls] ?? 4})` });
    // a car park's rows: one along each long edge, back-to-back pairs across its depth between aisles; a bay 2.6 m wide
    // and 5 m deep, its lines painted
    const bays = [];
    if (z.use === 'car park') {
      const u0 = [near[m - 1][0] - near[0][0], near[m - 1][1] - near[0][1]], len = Math.hypot(...u0), u = [u0[0] / len, u0[1] / len];
      const v0 = [far[0][0] - near[0][0], far[0][1] - near[0][1]], D = Math.hypot(...v0), v = [v0[0] / D, v0[1] / D], n = Math.floor(len / 2.6);
      const rows = [[0, 1], [D, -1]];
      for (let c = 16; c + 8 < D - 8; c += 16) rows.push([c - 5, 1], [c + 5, -1]);   // (a back-to-back pair: noses meet at c)
      for (const [d0, sg] of rows) for (let k = 0; k <= n; k++) {
        const along = (k * len) / n, p = [near[0][0] + u[0] * along + v[0] * d0, near[0][1] + u[1] * along + v[1] * d0], e = [p[0] + v[0] * sg * 5, p[1] + v[1] * sg * 5], w = 0.06, nx = u[0] * w, ny = u[1] * w;
        passes.ground.push(K.paint('line', [[p[0] - nx, p[1] - ny, zPad + 0.01], [e[0] - nx, e[1] - ny, zPad + 0.01], [e[0] + nx, e[1] + ny, zPad + 0.01], [p[0] + nx, p[1] + ny, zPad + 0.01]]));
        if (k < n) bays.push({ at: [p[0] + u[0] * 1.3 + v[0] * sg * 2.6, p[1] + u[1] * 1.3 + v[1] * sg * 2.6], nose: Math.atan2(-v[1] * sg, -v[0] * sg) });
      }
    }
    // ── massing: the volumes, plain ──
    const height = z.use === 'pit building' ? Hh.pit : z.use === 'hospitality' ? Hh.hosp : z.use === 'grandstand' ? A.eye + 3 : 0;
    if (height) {
      const front = (p) => nearestC(p[0], p[1]).d, fmin = Math.min(...z.poly.map(front)), fmax = Math.max(...z.poly.map(front));
      const hAt = (p) => (z.use === 'grandstand' ? 1 + (height - 1) * ((front(p) - fmin) / Math.max(1e-6, fmax - fmin)) : height);   // a stand rises away from the track
      const grey = K.flat('concrete', 2), P = z.poly.map((p) => [p[0], p[1], zAt(p) + hAt(p)]);
      for (let i = 0; i < z.poly.length; i++) { const p = z.poly[i], q = z.poly[(i + 1) % z.poly.length]; passes.massing.push(faceOut([[p[0], p[1], zAt(p)], [q[0], q[1], zAt(q)], P[(i + 1) % P.length], P[i]], grey, cz)); }
      for (let i = 0; i < m - 1; i++) passes.massing.push(face([P[i], P[i + 1], P[z.poly.length - 2 - i], P[z.poly.length - 1 - i]], grey));
    }
    // ── elements: the structure from blocks, in modules where it runs long ──
    const runs = (maxLen) => {   // the strip cut into modules of at most maxLen along its near edge: [{ at, len, depth, yaw }]
      const cum = [0];
      for (let i = 1; i < m; i++) cum.push(cum[i - 1] + Math.hypot(near[i][0] - near[i - 1][0], near[i][1] - near[i - 1][1]));
      const total = cum[m - 1], k = Math.max(1, Math.ceil(total / maxLen)), out = [];
      const along = (d) => { let i = 1; while (i < m - 1 && cum[i] < d) i++; const t = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]); return { n: lerp2(near[i - 1], near[i], t), f: lerp2(far[i - 1], far[i], t) }; };
      for (let j = 0; j < k; j++) {
        const d0 = (total * j) / k, d1 = (total * (j + 1)) / k, A0 = along(d0), A1 = along(d1);
        const mid = lerp2(lerp2(A0.n, A1.n, 0.5), lerp2(A0.f, A1.f, 0.5), 0.5), depth = Math.hypot(A0.f[0] - A0.n[0], A0.f[1] - A0.n[1]);
        out.push({ at: [r3(mid[0]), r3(mid[1]), zAt(mid)], len: d1 - d0 - 0.4, depth, yaw: facingTrack(mid) });
      }
      return out;
    };
    const elements = [];
    if (z.use === 'pit building') for (const r of runs(48)) elements.push(build('pit-module', { len: Math.max(10, Math.min(50, r.len)), depth: Math.max(6, Math.min(20, r.depth - 1)), h: Math.min(11, Hh.pit) }, r.at, r.yaw, s));
    // a stand in the stadium's section (stadium/stand.js) when the words ask, on every pole but the voxel's (its cubes
    // keep the block): set back from the zone's front, where the catch fence stands, along the whole of it
    const bowl = z.use === 'grandstand' && stands && K.pole !== 'voxel';
    const front = bowl ? frontOf(z.poly, (p) => nearestC(p[0], p[1]).d) : null;
    if (bowl) {
      const { a: fa, b: fb, out } = front, tl = Math.hypot(fb[0] - fa[0], fb[1] - fa[1]), tu = [(fb[0] - fa[0]) / tl, (fb[1] - fa[1]) / tl], inset = 0.5;
      const at = (p, d) => [p[0] + out[0] * stands.back + tu[0] * d, p[1] + out[1] * stands.back + tu[1] * d];
      const st = standFaces(stands, { from: at(fa, inset), to: at(fb, -inset), out, z: zPad, seed: s });
      elements.push({ b: { id: 'stand', box: st.box, faces: st.faces }, faces: paintStand(st.faces, K) });
    }
    if (z.use === 'grandstand' && !bowl) for (const r of runs(54)) elements.push(build('grandstand', { w: Math.max(14, Math.min(56, r.len)), rows: Math.max(4, Math.min(14, Hh.rows)) }, [r.at[0], r.at[1], zPad], r.yaw, s));
    if (z.use === 'hospitality') { const len = Math.hypot(near[m - 1][0] - near[0][0], near[m - 1][1] - near[0][1]), dep = Math.hypot(far[0][0] - near[0][0], far[0][1] - near[0][1]); elements.push(build('hospitality', { w: Math.max(10, Math.min(50, len - 2)), d: Math.max(8, Math.min(30, dep - 2)), h: Math.min(10, Hh.hosp) }, [cz[0], cz[1], zPad], facingTrack(cz), s)); }
    for (const e of elements) {
      passes.elements.push(...e.faces);
      colliders.push({ ...box(e.b), of: `local:${z.id}` });
      const sz = e.b.box.size, c = e.b.box.lo.map((v, i) => (v + e.b.box.hi[i]) / 2);
      things.push({ kind: z.use, interest: z.use === 'grandstand' ? 'focus' : 'prop', at: c, span: Math.min(Math.max(sz[0], sz[1]), sz[2]), top: e.b.box.hi[2] });
      // its own corners (an axis box round a turned building reaches further than it does)
      const reach = Math.min(...e.b.faces.filter((_, i) => i % 3 === 0).flatMap((f) => f.corners).map(([x, y]) => nearestC(x, y).d));
      if (reach < X.outer) laws.push({ law: 'off-the-road', detail: `${z.id}'s ${e.b.id} reaches the road (${r3(reach)} m from its line)` });
      // a stand stays on its zone's footprint (the plan's room for it), a hand's breadth spare
      if (e.b.id === 'stand') { const out = e.b.faces.flatMap((f) => f.corners).filter(([x, y]) => !insidePoly(z.poly, [x, y], 0.3)); if (out.length) laws.push({ law: 'in-zone', detail: `${z.id}'s stand reaches past its zone (${out.length} corners): fewer rows, or a deeper zone` }); }
    }
    // ── dressing: what makes it used ──
    const dress = passes.dressing, place = (id, params, at, yaw) => { const e = build(id, params, at, yaw, s); dress.push(...e.faces); return e; };
    const along = (e0, step, fn) => { for (let i = 0; i < e0.length - 1; i++) { const p = e0[i], q = e0[i + 1], d = Math.hypot(q[0] - p[0], q[1] - p[1]); for (let t = 0; t < d; t += step) fn(lerp2(p, q, t / d), Math.atan2(q[1] - p[1], q[0] - p[0])); } };
    if (z.use === 'pit lane') {
      // the pit wall on the track's side of the lane, a catch fence on it
      for (let i = 0; i < m - 1; i++) {
        const p = near[i], q = near[i + 1], d = Math.hypot(q[0] - p[0], q[1] - p[1]), u = [(q[0] - p[0]) / d, (q[1] - p[1]) / d], w = [-u[1] * 0.25, u[0] * 0.25];
        const base = [[p[0] - w[0], p[1] - w[1]], [q[0] - w[0], q[1] - w[1]], [q[0] + w[0], q[1] + w[1]], [p[0] + w[0], p[1] + w[1]]];
        const zw = (pt) => zAt(pt) - 0.05;
        for (let k = 0; k < 4; k++) { const A0 = base[k], B0 = base[(k + 1) % 4]; dress.push(K.wall('concrete', [[A0[0], A0[1], zw(A0)], [B0[0], B0[1], zw(B0)], [B0[0], B0[1], zw(B0) + 1.1], [A0[0], A0[1], zw(A0) + 1.1]], lerp2(p, q, 0.5))); }
        dress.push(K.surface('concrete', base.map(([x, y]) => [x, y, zw([x, y]) + 1.1]), base.map(([x, y]) => [x / 2.5, y / 2.5])));
        colliders.push({ min: [r3(Math.min(...base.map((b) => b[0]))), r3(Math.min(...base.map((b) => b[1]))), r3(Math.min(...base.map(zw)))], max: [r3(Math.max(...base.map((b) => b[0]))), r3(Math.max(...base.map((b) => b[1]))), r3(Math.max(...base.map(zw)) + 1.1)], of: 'local:pit-wall' });
      }
      if (cls !== 'kart') along(near, 10, (p, h) => place('catch-fence', { len: 9.8, h: 3 }, [p[0], p[1], zAt(p) + 1.05], h));
    }
    if (z.use === 'grandstand' && !bowl) along(near, 10, (p, h) => place('catch-fence', { len: 9.8, h: cls === 'kart' ? 2 : 4 }, [p[0], p[1], zAt(p)], h));
    // (before a stand in the stadium's section, at its zone's front: the posts painted, the mesh seen through, as a
    // debris fence is, so the lower rows read from the track)
    if (bowl) along([front.a, front.b], 10, (p, h) => {
      const B = TRACK_BLOCKS['catch-fence'], b = buildBlock(B, { params: { len: 9.8, h: cls === 'kart' ? 2 : 4 }, library: TRACK_BLOCKS, many: 0.5, seed: s, at: [p[0], p[1], zAt(p)], yaw: (h * 180) / Math.PI });
      dress.push(...paintPiece(b.faces.filter((f) => f.group !== 'tech:cable'), K), ...b.faces.filter((f) => f.group === 'tech:cable').map((f) => ({ corners: f.corners, fill: K.flat('tyre', 3), alpha: 0.3, group: 'stand:mesh' })));
    });
    if (z.use === 'paddock' && cls !== 'kart') {
      // the team trucks, nose to the pit building, a lamp along the row
      along(far, 14, (p) => {
        if (rnd() < 0.25) return;
        const dir = [cz[0] - p[0], cz[1] - p[1]], dl = Math.hypot(...dir) || 1, at = [p[0] + (dir[0] / dl) * 7, p[1] + (dir[1] / dl) * 7];
        const v = buildVehicle('straightTruck', Math.atan2(dir[1], dir[0])), col = PAINTS[Math.floor(rnd() * PAINTS.length)];
        const zt = zAt(at), T = (f) => ({ ...f, corners: f.corners.map(([x, y, zz]) => [r3(at[0] + x), r3(at[1] + y), r3(zt + zz)]) });
        dress.push(...fan([...v.paint.map((f) => tint(T(f), col)), ...v.trim.map(T), ...v.trailer.map(T)]));
      });
    }
    if (z.use === 'car park') {
      // cars parked in about half the bays
      const classes = ['compact', 'midsize', 'crossover', 'midsize', 'pickup'];
      for (const b of bays) {
        if (rnd() < 0.5) continue;
        dress.push(...parkedCar(FLEET[classes[Math.floor(rnd() * classes.length)]], [b.at[0], b.at[1], zPad], b.nose, PAINTS[Math.floor(rnd() * PAINTS.length)]));
      }
      along(near, 30, (p, h) => place('lamp-post', { h: 8 }, [p[0], p[1], zPad], h + Math.PI));
    }
    const shown = (pass) => PASSES.indexOf(pass) <= stop;
    const drawn = [...(shown('ground') ? passes.ground : []), ...(stop === PASSES.indexOf('massing') ? passes.massing : []), ...(shown('elements') ? passes.elements : []), ...(shown('dressing') ? passes.dressing : [])];
    faces.push(...drawn);
    byZone[z.id] = drawn;
    areas.push({ zone: z.id, use: z.use, seed: s, upTo: PASSES[stop], pad: zPad, retain: r3(retain), passes: Object.fromEntries(PASSES.map((p) => [p, passes[p].length])), laws });
  }

  // ── the roads: the ring and the spurs on the land; a spur stops short of the track it goes under ──
  const roadArea = { zone: 'roads', use: 'service roads', passes: { ground: 0, massing: 0, elements: 0, dressing: 0 }, laws: [] };
  const lay = (pts, w, isTunnel) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], d = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.ceil(d / 6)), u = [(q[0] - p[0]) / (d || 1), (q[1] - p[1]) / (d || 1)], nx = -u[1] * (w / 2), ny = u[0] * (w / 2);
      for (let k = 0; k < n; k++) {
        const a0 = lerp2(p, q, k / n), a1 = lerp2(p, q, (k + 1) / n);
        if (isTunnel && (nearestC(...a0).d < X.outer + 3 || nearestC(...a1).d < X.outer + 3)) continue;   // under the track
        const c = [[a0[0] - nx, a0[1] - ny], [a1[0] - nx, a1[1] - ny], [a1[0] + nx, a1[1] + ny], [a0[0] + nx, a0[1] + ny]].map(([x, y]) => [r3(x), r3(y), r3(ground(x, y) + 0.08)]);
        faces.push(K.surface('asphalt', c, c.map((v) => [v[0] / 2.5, v[1] / 2.5]))); roadArea.passes.ground++;
      }
    }
  };
  for (const r of arena.roads) lay(r.pts, A.road ?? 6, r.use === 'tunnel road');
  for (const t of arena.tunnels) {
    // a tunnel's two portals: concrete mouths either side of the track where the spur goes under
    const st = a.at(t.s);
    for (const sd of [1, -1]) {
      const off = sd * (X.outer + 3), x = st.x - Math.sin(st.heading) * off, y = st.y + Math.cos(st.heading) * off;
      const e = build('pit-module', { len: 10, depth: 6, h: 4 }, [x, y, ground(x, y) - 0.5], st.heading + (sd > 0 ? 0 : Math.PI), seed);
      faces.push(...e.faces); roadArea.passes.elements += e.faces.length;
    }
  }
  areas.push(roadArea);
  return { areas, faces, colliders, things, byZone };
}

// a zone's long edge nearest the track (its front: { a, b }) and the unit direction from it to the other (`out`)
function frontOf(poly, dist) {
  const { near, far } = edges(poly), mean = (e) => e.reduce((s, p) => s + dist(p) / e.length, 0);
  const [f, k] = mean(near) <= mean(far) ? [near, far] : [far, near];
  const fm = centroid(f), km = centroid(k), d = Math.hypot(km[0] - fm[0], km[1] - fm[1]) || 1;
  return { a: f[0], b: f[f.length - 1], out: [(km[0] - fm[0]) / d, (km[1] - fm[1]) / d] };
}
// a point inside a convex footprint, `m` spare past its edges
function insidePoly(poly, [x, y], m = 0) {
  const c = centroid(poly);
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], ex = q[0] - p[0], ey = q[1] - p[1], l = Math.hypot(ex, ey) || 1;
    const side = (px, py) => (ex * (py - p[1]) - ey * (px - p[0])) / l;
    if (side(x, y) * Math.sign(side(c[0], c[1])) < -m) return false;
  }
  return true;
}

// many-sided faces (a fleet wheel's disc, a cap) fanned to quads: the World draws a face's first four corners only
function fan(faces) {
  return faces.flatMap((f) => {
    const n = f.corners.length;
    if (n <= 4) return [f];
    const out = [];
    for (let i = 1; i + 1 < n; i += 2) { const idx = i + 2 < n ? [0, i, i + 1, i + 2] : [0, i, i + 1]; out.push({ ...f, corners: idx.map((j) => f.corners[j]), ...(f.cornerFills ? { cornerFills: idx.map((j) => f.cornerFills[j]) } : {}) }); }
    return out;
  });
}

// a parked car at a car park's distance: its class's true length, width and height as three boxes (the body to the
// belt, the glasshouse, the tyres' dark band), about fifteen faces where the loft is a hundred
function parkedCar(F, at, yaw, rgb) {
  const hex = `#${rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`, belt = F.profile?.zBelt ?? F.H * 0.6;
  const cx = Math.cos(yaw), sx = Math.sin(yaw), off = (d) => [at[0] + cx * d, at[1] + sx * d, at[2]];
  return [
    ...boxFaces([at[0], at[1], at[2] + 0.12], [F.L, F.W * 0.98, belt * 0.62], yaw, '#1b1c1e'),
    ...boxFaces([at[0], at[1], at[2] + belt * 0.45], [F.L, F.W, belt * 0.55], yaw, hex),
    ...boxFaces(off(-F.L * 0.05), [F.L * 0.5, F.W * 0.86, F.H - belt], yaw, '#1e2630').map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [x, y, z + belt]) })),
  ];
}

// a template face recoloured: its baked shade carried over the fleet's template paint (#e9e9e9)
function tint(f, rgb) {
  const P = 0xe9 / 255, sh = (h) => { const l = parseInt(h.slice(1, 3), 16) / 255 / P; return `#${rgb.map((v) => Math.round(Math.min(255, v * 255 * l)).toString(16).padStart(2, '0')).join('')}`; };
  return { ...f, fill: sh(f.fill), ...(f.cornerFills ? { cornerFills: f.cornerFills.map(sh) } : {}) };
}

/** A review shot of one local area: three-quarter, from its track side, its whole footprint in frame. */
export function localCamera(plan, arena, zoneId) {
  const z = arena.zones.find((x) => x.id === zoneId);
  if (!z) throw new Error(`trackscape: no zone '${zoneId}' (${arena.zones.map((x) => x.id).join(', ')})`);
  const c = centroid(z.poly), r = Math.max(...z.poly.map(([x, y]) => Math.hypot(x - c[0], y - c[1]))), g = plan.groundAt(c[0], c[1]);
  const a = plan.alignment; let st = a.at(0), d = Infinity;
  for (let s = 0; s <= a.length; s += 4) { const q = a.at(s), e = Math.hypot(q.x - c[0], q.y - c[1]); if (e < d) { d = e; st = q; } }
  const u = [(st.x - c[0]) / (d || 1), (st.y - c[1]) / (d || 1)], back = r * 1.6 + 25;
  return { cameraPosition: [c[0] + u[0] * back - u[1] * back * 0.5, c[1] + u[1] * back + u[0] * back * 0.5, g + r * 0.7 + 12], lookAt: [c[0], c[1], g + 3], horizontalFov: 60, pictureCenter: [560, 390] };
}
