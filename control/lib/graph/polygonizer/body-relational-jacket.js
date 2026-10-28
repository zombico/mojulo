/**
 * THE JACKET AS BUILT on the realistic body (an outfit's outer CONSTRUCTION words: styles.js, the tailor's
 * `tailoring.jacket`): a jacket that opens. The tailor's cloth is a closed tube, and its openings were painted on it
 * (cutOpening, an open front's V): the cloth taken in and coloured as what shows there, the tube whole. Here the body's
 * rings are split at the centre front: each ring a C in section, the inner face from the back centre round to a front
 * edge, the edge turned, the outer face back, so the two fronts are two edges with a real gap between them (closed on a
 * zip, or worn open) and what is under it shows through the gap itself.
 *
 *   openFront(P, { gap, thick, front })   the tube `P` (a jacket's body: rings of named slots round the trunk) as a C in
 *       section, its centre front open by `gap(z)` (m, the whole opening at height z), `thick` the cloth's thickness; its
 *       two ends turned in and drawn small inside the body, so the tube's caps close the C where nothing sees them; each
 *       point carried by the weights of the cloth point it was made from. → the part, its `fronts` (per station the
 *       right and the left edge's outer slot)
 *
 * A ring is a closed loop of named slots (station-loft.js mirrors faces by NAME, slot k with slot n − k, for their
 * winding), so a C is a ring like any other: `front` the inner face's back centre, `back` the outer face's, the right
 * half the inner face round to the right edge and the outer face back, the left half its mirror. Deterministic.
 */
import { ringSlots } from './body-relational-resample.js';
import { stripAlong, beltOn, webbingOn } from './body-relational-kit.js';
import { block, bindNearest } from '../footwear/parts.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const lerp3 = (a, b, t) => [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * t);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** the jacket's measures (m): its leather's thickness, a closed zip's opening, how far its ends turn in and how small */
export const JACKET = Object.freeze({ thick: 0.0025, zipGap: 0.009, turn: 0.012, tuck: 0.45, arc: 25 });

/** a polyline resampled to `m` points evenly by arc length */
function resample(pts, m) {
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + dist(pts[i], pts[i - 1]));
  const T = L[L.length - 1] || 1e-9;
  return Array.from({ length: m }, (_, k) => { const s = (T * k) / (m - 1); let i = 1; while (i < L.length - 1 && L[i] < s) i++; const f = (s - L[i - 1]) / Math.max(1e-12, L[i] - L[i - 1]); return lerp3(pts[i - 1], pts[i], Math.max(0, Math.min(1, f))); });
}

/** one side's arc of a ring, from its front EDGE (the first point at half the gap from the midline, on the ring's front
 * half: the crossing interpolated) to the back centre; `walk` the ring's slot indices from the front round that side */
function arcOf(at, walk, g, front) {
  for (let w = 1; w < walk.length; w++) {
    const a = at[walk[w - 1]], b = at[walk[w]], fa = a.p[0] * front[1] - a.p[1] * front[0], fb = b.p[0] * front[1] - b.p[1] * front[0];
    // (lateral distance from the midline, signed by the side; the edge where it first reaches half the gap)
    const xa = Math.abs(fa), xb = Math.abs(fb);
    if (xb >= g && xa < g) { const t = (g - xa) / Math.max(1e-9, xb - xa); return [lerp3(a.p, b.p, t), ...walk.slice(w).map((j) => at[j].p)]; }
  }
  return walk.map((j) => at[j].p);
}

/** The tube `P` as a C in section, its centre front open by `gap(z)`; see the head. `front` the jacket's forward
 * direction (unit, level). */
export function openFront(P, { gap = () => JACKET.zipGap, thick = JACKET.thick, front = [0, 1, 0], arc = JACKET.arc } = {}) {
  const n = P.slots.length, h = n / 2, blend = P.bind?.blend ?? {};
  const walkR = Array.from({ length: h + 1 }, (_, k) => k), walkL = [0, ...Array.from({ length: h }, (_, k) => n - 1 - k)];
  const m = arc, N = 4 * m - 2, slots = ringSlots(N), nb = {};
  const stations = P.stations.map((st) => {
    const at = P.slots.map((sl) => ({ sl, p: st.points[sl] })), c = mean(at.map((q) => q.p)), g = gap(c[2]) / 2;
    const out = (p) => { const d = [p[0] - c[0], p[1] - c[1]], r = Math.hypot(...d) || 1e-9; return [p[0] - (d[0] / r) * thick, p[1] - (d[1] / r) * thick, p[2]]; };
    const R = resample(arcOf(at, walkR, g, front), m), Lf = resample(arcOf(at, walkL, g, front), m);   // edge … back centre
    const ringSide = (A) => { const toEdge = [...A].reverse(); return [...toEdge.map(out), ...A]; };   // inner back→edge, outer edge→back
    const lR = ringSide(R), lL = ringSide(Lf), pts = {};
    pts[slots[0]] = lR[0].map(r6);
    for (let k = 1; k < N / 2; k++) { pts[slots[k]] = lR[k].map(r6); pts[slots[N - k]] = lL[k].map(r6); }
    pts[slots[N / 2]] = lR[lR.length - 1].map(r6);
    // (each new point carried by the weights of the cloth point nearest it on its ring)
    for (const sl of slots) { let best = at[0], d0 = Infinity; for (const q of at) { const d = dist(q.p, pts[sl]); if (d < d0) { d0 = d; best = q; } } const w = blend[`${st.id}.${best.sl}`] ?? blend[st.id] ?? null; if (w) nb[`${st.id}.${sl}`] = w; }
    return { st: { id: st.id, u: st.u, points: pts }, c };
  });
  // the ENDS turned in: a ring past each end, drawn toward the tube's axis and stepped back inside the body
  const turned = ({ st, c }, toward, k) => ({ id: `${st.id}_in`, u: r6((st.u ?? 0) + k * 1e-3), points: Object.fromEntries(slots.map((sl) => { const p = st.points[sl]; return [sl, [c[0] + (p[0] - c[0]) * JACKET.tuck, c[1] + (p[1] - c[1]) * JACKET.tuck, p[2] + toward * JACKET.turn].map(r6)]; })) });
  const A = stations[0], Z = stations[stations.length - 1], up = Math.sign(Z.c[2] - A.c[2]) || 1;
  const head = turned(A, up, -1), tail = turned(Z, -up, 1);
  for (const [t, s] of [[head, A.st], [tail, Z.st]]) for (const sl of slots) { const w = nb[`${s.id}.${sl}`]; if (w) nb[`${t.id}.${sl}`] = w; }
  const { bandGroups: _b, painted: _p, slotT: _t, ...rest } = P;
  return { ...rest, slots, stations: [head, ...stations.map((x) => x.st), tail], caps: { back: mean(Object.values(head.points)).map(r6), tip: mean(Object.values(tail.points)).map(r6) },
    bind: { ...(P.bind || {}), blend: nb }, fronts: [slots[m], slots[N - m]] };
}

/**
 * THE ZIP down an opened jacket's front (`P` from openFront, closed): its TAPE behind the two edges, under them from the
 * hem's turn to the collar, and its TEETH in the gap between them, standing to the cloth's face; its PULL at the top. Each
 * station's two outer edge points set where it runs. → { `<id>Tape`, `<id>Teeth`, `<id>Pull` }, carried by the jacket's
 * weights at the front
 */
export function zipDown(P, id, { group = 'Buckle', tape = 'Outer' } = {}) {
  const [eR, eL] = P.fronts, S = P.stations.slice(1, -1), mid = S.map((st) => mean([st.points[eR], st.points[eL]]));
  const nrm = S.map((st, i) => { const c = mean(Object.values(st.points)), d = [mid[i][0] - c[0], mid[i][1] - c[1], 0], l = Math.hypot(d[0], d[1]) || 1; return [d[0] / l, d[1] / l, 0]; });
  const across = S.map((_, i) => unitX(nrm[i]));
  const inset = (i, k) => mid[i].map((v, q) => v - nrm[i][q] * k);
  const tapeP = S.map((_, i) => inset(i, JACKET.thick + 0.0008)), teethP = S.map((_, i) => inset(i, JACKET.thick + 0.0004));
  const tapeS = stripAlong(tapeP, nrm, across, JACKET.zipGap + 0.014, 0.0008), teethS = stripAlong(teethP, nrm, across, JACKET.zipGap * 0.7, JACKET.thick + 0.0012);
  const top = teethP[teethP.length - 1], down = mean([teethP[teethP.length - 2], teethP[teethP.length - 1]]), pull = block(top.map((v, q) => v + nrm[nrm.length - 1][q] * 0.002 + (down[q] - top[q]) * 0), nrm[nrm.length - 1], [0, 0, -1], { w: 0.012, h: 0.028, thick: 0.003 });
  const bind = (X) => bindNearest(X, P);
  return { [`${id}Tape`]: { ...tapeS, group: tape, bind: bind(tapeS) }, [`${id}Teeth`]: { ...teethS, group, bind: bind(teethS) }, [`${id}Pull`]: { ...pull, group, bind: bind(pull) } };
}
/** the level direction across a level normal (its right hand, looking along it from outside) */
const unitX = (n) => { const a = [-n[1], n[0], 0], l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l, 0]; };

// ─── the jacket's pieces, on its own outer face ───

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
/** a layer-1 closed tube through `rings` (each a list of points, all the same length), capped at its two ends' middles */
function tubeOf(rings) {
  const slots = ringSlots(rings[0].length);
  return { layer: 1, closure: 'closed', slots, stations: rings.map((R, i) => ({ id: `st${i}`, u: i, points: Object.fromEntries(slots.map((sl, j) => [sl, R[j].map(r6)])) })), caps: { back: mean(rings[0]).map(r6), tip: mean(rings[rings.length - 1]).map(r6) } };
}
/** an opened jacket's OUTER FACE at each station: per side the polyline from the front edge to the back centre */
function outerFace(P) {
  const N = P.slots.length, h = N / 2, m = (h + 1) / 2;
  return P.stations.slice(1, -1).map((st) => {
    const c = mean(Object.values(st.points)), R = [], L = [];
    for (let k = m; k <= h; k++) R.push(st.points[P.slots[k]]);
    for (let k = m; k <= h; k++) L.push(st.points[P.slots[(N - k) % N]]);
    return { c, z: c[2], R, L };
  });
}
const FACES = new WeakMap();
/** the point of the jacket's outer face at lateral `x` (signed: + the right) and height `z`, on its front, and its level
 * normal; null off the face */
export function faceAt(P, x, z) {
  let F = FACES.get(P); if (!F) FACES.set(P, F = outerFace(P));
  let i = 1; while (i < F.length - 1 && F[i].z < z) i++;
  const A = F[i - 1], B = F[i], t = Math.max(0, Math.min(1, (z - A.z) / ((B.z - A.z) || 1e-9)));
  const on = (ring) => { const line = x >= 0 ? ring.R : ring.L, X = Math.abs(x);
    for (let k = 1; k < line.length; k++) { const a = line[k - 1], b = line[k], xa = Math.abs(a[0]), xb = Math.abs(b[0]);
      // (walked from the front edge out to the side: a crossing only while the face still widens, past the side it would
      // be the back's; inside the opening, short of the edge, no face at all)
      if (k === 1 && X < xa) return null;
      if (xb < xa) return null;
      if ((xa - X) * (xb - X) <= 0) { const f = (X - xa) / ((xb - xa) || 1e-9); return lerp3(a, b, f); } }
    return null; };
  const a = on(A), b = on(B); if (!a || !b) return null;
  const p = lerp3(a, b, t), c = lerp3(A.c, B.c, t), d = [p[0] - c[0], p[1] - c[1], 0], l = Math.hypot(d[0], d[1]) || 1;
  return { p: [p[0], p[1], z], n: [d[0] / l, d[1] / l, 0] };
}
/** how far the jacket's front reaches to one side (`sx` +1 the right) at height `z`: its outer face's widest there */
function frontReach(P, z, sx) {
  let F = FACES.get(P); if (!F) FACES.set(P, F = outerFace(P));
  const ring = F.reduce((b, r) => (Math.abs(r.z - z) < Math.abs(b.z - z) ? r : b));
  return Math.max(...(sx > 0 ? ring.R : ring.L).map((q) => Math.abs(q[0])));
}
/** a PATCH lying on the jacket's face: rows down from `z0` to `z1`, each `width(v)` wide about `cx(v)` (v 0 the top … 1
 * the bottom), `lift` off the face and `t` thick, its cross-section `cols` points; null where it leaves the face */
export function patchOn(P, { z0, z1, cx, width, lift = 0.0006, t = 0.0025, cols = 7, rows = 7 }) {
  const rings = [];
  for (let r = 0; r < rows; r++) {
    const v = r / (rows - 1), z = z0 + (z1 - z0) * v, w = Math.max(0.002, width(v)), x0 = cx(v);
    const inner = [], outer = [];
    for (let k = 0; k < cols; k++) { const x = x0 - w / 2 + (w * k) / (cols - 1), F = faceAt(P, x, z); if (!F) return null; const q = add(F.p, scl(F.n, lift)); inner.push(q); outer.push(add(q, scl(F.n, t))); }
    rings.push([...inner, ...outer.reverse()]);
  }
  return tubeOf(rings);
}

/** a KNIT RIB round the open jacket's hem: the band `P` (a closed band, beltOn's) opened by the jacket's gap and its
 * outer face ribbed, every other point of it `depth` proud */
export function ribbed(band, { gap, depth = 0.0012 }) {
  const C = openFront(band, { gap });
  const N = C.slots.length, h = N / 2, m = (h + 1) / 2;
  for (const st of C.stations) { const c = mean(Object.values(st.points)); for (let k = m; k <= h; k++) for (const sl of [C.slots[k], C.slots[(N - k) % N]]) { if (k % 2) continue; const p = st.points[sl], d = [p[0] - c[0], p[1] - c[1]], l = Math.hypot(...d) || 1; st.points[sl] = [p[0] + (d[0] / l) * depth, p[1] + (d[1] / l) * depth, p[2]].map(r6); } }
  return C;
}
/** a KNIT CUFF past a sleeve's end: rings from `back` (m) inside the sleeve's last ring on out `long` past it along the
 * sleeve, each round the wrist under it at `snug` over its reach, every other point ribbed */
export function cuffOn(sleeve, wrist, { long = 0.045, back = 0.015, snug = 0.004, depth = 0.0012 } = {}) {
  // (the sleeve's END is its ring farthest from the shoulder: a hem turned in runs its last rings back up inside it)
  const S = sleeve.stations, C = S.map((st) => mean(Object.values(st.points))), far = C.reduce((b, c, i) => (dist(c, C[0]) > dist(C[b], C[0]) ? i : b), 0);
  const last = S[far], c1 = C[far], c0 = C[Math.max(0, far - 3)];
  const ax = (() => { const d = [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]], l = Math.hypot(...d) || 1; return d.map((v) => v / l); })();
  const dirs = sleeve.slots.map((sl) => { const p = last.points[sl], d = [p[0] - c1[0], p[1] - c1[1], p[2] - c1[2]], a = d[0] * ax[0] + d[1] * ax[1] + d[2] * ax[2], o = [d[0] - ax[0] * a, d[1] - ax[1] * a, d[2] - ax[2] * a], l = Math.hypot(...o) || 1; return o.map((v) => v / l); });
  const reach = (q, d) => { let r = 0; for (const p of wrist) { const v = [p[0] - q[0], p[1] - q[1], p[2] - q[2]], along = v[0] * ax[0] + v[1] * ax[1] + v[2] * ax[2]; if (Math.abs(along) > 0.012) continue; const pr = v[0] * d[0] + v[1] * d[1] + v[2] * d[2]; if (pr > r && Math.hypot(v[0] - ax[0] * along - d[0] * pr, v[1] - ax[1] * along - d[1] * pr, v[2] - ax[2] * along - d[2] * pr) < 0.012) r = pr; } return r; };
  const rings = [0, 0.15, 0.5, 0.85, 1].map((f) => { const q = add(c1, scl(ax, -back + (back + long) * f)); return dirs.map((d, j) => { const r = Math.max(reach(q, d) + snug, 0.02) + (j % 2 ? 0 : depth) - (f === 0 || f === 1 ? 0.0015 : 0); return add(q, scl(d, r)); }); });
  return tubeOf(rings);
}

/** the jacket's piece measures (m) */
export const JACKET_PIECES = Object.freeze({ rib: 0.06, ribTuck: 0.012, pocket: { w: 0.13, h: 0.15, above: 0.03, inset: 0.015 }, flap: { h: 0.048, over: 0.008, t: 0.003 }, collar: { drop: 0.075, out: 0.04, w: 0.055 }, epaulette: { w: 0.045, t: 0.003, inside: 0.006 }, snap: 0.011 });

/**
 * THE JACKET'S PIECES, after its front is opened (`parts[bodyName]` the opened body, `J` the construction words, `recipe`
 * the body's skin): its rib waistband and cuffs (`rib`), its flapped patch pockets (`pockets`), its epaulettes, its
 * shirt collar's points (`collar: 'shirt'`), each lying on the jacket's own face and carried by its weights; `gapAt(z)` the
 * opening at a height, `gathered` filled with the band the body is gathered into (for the folds). → { name: part }
 */
export function jacketPieces(parts, bodyName, J, recipe, { gapAt, gathered }) {
  const B = parts[bodyName], out = {}, X = JACKET_PIECES, group = B.group ?? 'Outer';
  const zs = B.stations.slice(1, -1).map((st) => mean(Object.values(st.points))[2]), zHem = Math.min(...zs), zTop = Math.max(...zs);
  const pts = (P) => P.stations.flatMap((st) => Object.values(st.points));
  const bound = (P, g, on = B) => ({ ...P, group: g, bind: bindNearest(P, on) });
  const snapAt = (F, lift, id) => { if (!F) return; out[id] = bound(block(add(F.p, scl(F.n, lift)), F.n, [0, 0, 1], { w: X.snap, h: X.snap, thick: 0.0022 }), 'Buckle'); };
  // THE RIB WAISTBAND: a knit band cinched round what is under the hem, its top tucked under the leather, opened as the
  // jacket is; the body gathered into it
  if (J.rib === 'waist' || J.rib === 'both') {
    const under = Object.entries(parts).filter(([k, P]) => P.garment && k !== bodyName && /_(body|torso|pelvis)$/.test(k)).map(([, P]) => P);
    const on = under.find((P) => P.stations.some((st) => Math.abs(mean(Object.values(st.points))[2] - zHem) < 0.04)) ?? recipe.parts.torso;
    const z = zHem - X.rib / 2 + X.ribTuck, band = beltOn(on, [...under, recipe.parts.torso, recipe.parts.pelvis].filter(Boolean).flatMap(pts), z, { width: X.rib, thick: 0.0045 });
    if (band) { out.outerRib_waist = { ...ribbed(band, { gap: gapAt }), group: 'Rib', bind: band.bind }; gathered[bodyName] = [[z - X.rib / 2, z + X.rib / 2]]; }
  }
  // THE RIB CUFFS past the sleeves' ends, round the wrists
  if (J.rib === 'cuffs' || J.rib === 'both') for (const S of ['R', 'L']) {
    const sleeve = parts[`outer_arm${S}`], fore = recipe.parts[`foreArm${S}`]; if (!sleeve || !fore) continue;
    const C = cuffOn(sleeve, pts(fore)); out[`outerRib_cuff${S}`] = { ...C, group: 'Rib', bind: bindNearest(C, fore) };
  }
  // THE POCKETS: a patch low on each front, clear of the opening, under a flap with its snap
  if (J.pockets === 'flap') for (const [S, sx] of [['R', 1], ['L', -1]]) {
    // (each inside its own front: from a little past the opening's edge to short of the side, at most its own width)
    const P = X.pocket, z1 = zHem + P.above, z0 = z1 + P.h, edge = gapAt(z0) / 2 + P.inset, side = 0.85 * frontReach(B, z0, sx), w = Math.min(P.w, side - edge), cx = sx * (edge + w / 2);
    if (w < 0.06) continue;
    const bag = patchOn(B, { z0, z1, cx: () => cx, width: (v) => w * (1 - 0.04 * v) });
    if (!bag) continue;
    out[`outerPocket${S}`] = bound(bag, group);
    const flap = patchOn(B, { z0: z0 + X.flap.over, z1: z0 - X.flap.h, cx: () => cx, width: (v) => (w + 0.008) * (1 - 0.06 * v), lift: 0.0006 + 0.0025 + 0.0006, t: X.flap.t });
    if (flap) { out[`outerFlap${S}`] = bound(flap, group); snapAt(faceAt(B, cx, z0 - X.flap.h + 0.01), 0.0025 + 0.0012 + X.flap.t, `outerFlapSnap${S}`); }
  }
  // THE SHIRT COLLAR's points: a leaf each side from the collar's foot down and out over the chest, its point snapped
  if (J.collar === 'shirt') for (const [S, sx] of [['R', 1], ['L', -1]]) {
    // (from the jacket's edge at the collar's foot, the leaf's inner side along the edge, its point out over the chest)
    const C = X.collar, z0 = zTop - 0.03, g = gapAt(z0) / 2 + 0.003, wd = (v) => C.w * (1 - v) + 0.006;
    const leaf = patchOn(B, { z0, z1: z0 - C.drop, cx: (v) => sx * (g + wd(v) / 2 + C.out * v * 0.8), width: wd, lift: 0.0012, t: 0.003, rows: 6 });
    if (leaf) { out[`outerCollarPoint${S}`] = bound(leaf, group); snapAt(faceAt(B, sx * (g + C.out * 0.8 + 0.003), z0 - C.drop + 0.012), 0.0045, `outerCollarSnap${S}`); }
  }
  // THE EPAULETTES: a strap over each shoulder from the sleeve's seam to the collar, buttoned there
  if (J.epaulettes) for (const [S, sx] of [['R', 1], ['L', -1]]) {
    // (to the collar's foot: the neck's side, the jacket's top ring's reach; never the turned-in rings inside the body)
    const sh = recipe.rig?.joints?.[`shoulder${S}`], top = B.stations.slice(1, -1).flatMap((st) => Object.values(st.points)), X0 = Math.abs((sh?.at ?? sh)?.[0] ?? 0.17) - 0.01;
    const neck = B.stations[B.stations.length - 2], X1 = Math.max(...Object.values(neck.points).map((q) => sx * q[0])) + 0.008, bases = [];
    for (let k = 0; k <= 6; k++) { const x = sx * (X0 + (X1 - X0) * (k / 6)), near = top.filter((q) => Math.abs(q[0] - x) < 0.012 && Math.abs(q[1]) < 0.05); if (!near.length) continue; const q = near.reduce((a, b) => (b[2] > a[2] ? b : a)); bases.push([q[0], q[1], q[2] - 0.004]); }
    if (bases.length < 3) continue;
    // (each base's normal the shoulder's own: the slope across it from the points a little before and behind, crossed with
    // the strap's run; up a level shoulder, out down a sloped one)
    const normalAt = (q, along) => {
      const fwd = top.filter((r) => Math.hypot(r[0] - q[0], r[2] - q[2]) < 0.015 && r[1] > q[1] + 0.01 && r[1] < q[1] + 0.035), aft = top.filter((r) => Math.hypot(r[0] - q[0], r[2] - q[2]) < 0.015 && r[1] < q[1] - 0.01 && r[1] > q[1] - 0.035);
      const hi = (L) => (L.length ? L.reduce((a, r) => (r[2] > a[2] ? r : a)) : null), f = hi(fwd), a = hi(aft);
      const t = f && a ? [f[0] - a[0], f[1] - a[1], f[2] - a[2]] : [0, 1, 0], n = [along[1] * t[2] - along[2] * t[1], along[2] * t[0] - along[0] * t[2], along[0] * t[1] - along[1] * t[0]], l = Math.hypot(...n) || 1;
      return n[2] < 0 ? n.map((v) => -v / l) : n.map((v) => v / l);
    };
    const normals = bases.map((q, i) => { const a = bases[Math.max(0, i - 1)], b = bases[Math.min(bases.length - 1, i + 1)], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d) || 1; return normalAt(q, d.map((v) => v / l)); });
    const strap = webbingOn(bases, normals, top, { w: X.epaulette.w, t: X.epaulette.t });
    out[`outerEpaulette${S}`] = bound(strap, group);
    const end = bases[bases.length - 1], nE = normals[normals.length - 1]; out[`outerEpauletteButton${S}`] = bound(block([end[0] - sx * 0.008 + nE[0] * (X.epaulette.t + 0.004), end[1] + nE[1] * (X.epaulette.t + 0.004), end[2] + nE[2] * (X.epaulette.t + 0.004)], nE, [1, 0, 0], { w: 0.014, h: 0.014, thick: 0.003 }), 'Buckle');
  }
  return out;
}
