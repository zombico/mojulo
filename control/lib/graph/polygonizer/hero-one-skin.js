/** hero-one-skin.js — the realistic hero's head as ONE SKIN (realistic laws 2): the relational head's field netted whole,
 * in place of the pieces hero-relational-head.js casts and lets down under one another (the cranium, the jaw, the
 * visage, the nose, the eyes), whose hand-overs read as seams, torn lids and patches on an engine's light.
 *
 *   the skin   the head's field, globes left out (head-relational.js `globes: false`) and ears left out (each its own
 *              part, as before), joined smoothly to the neck's column and cut off at the seam ring; netted along its
 *              surface (skin-net.js netSkin) at `cell`, made sound where the net pinches (a lid's margin, the lips'
 *              meeting), its rim set exactly on the neck's seam ring (each seam point a point of the skin, the rest on
 *              the ring's edges between them: no gap, no shell inside another), then QUADRIC-simplified to `faces`,
 *              the eyes, the nose and the mouth keeping more of them (`feature` × the planes' weight there)
 *   the lips   cut between the corners along the lips' line before the skin is simplified (the points on it set onto
 *              the line and held): the upper lip's points the head's, the lower's the jaw's, so the jaw bone parts them;
 *              each lip turned in `lipDepth` along the cut (the Mouth), and behind them a closed MOUTH bag
 *   the eyes   each globe its own closed part (`globeR`, `globeL`), rings about its gaze set on its field, the pupil's and
 *              the iris's edges on rings of their own (Pupil, Iris, Sclera): crisp at any count, seen through the
 *              opening the skin's lids leave
 *   the bind   the seam's points carry the neck's blend there; up the head they ease to { jaw, head } by the jaw's share
 *              (`jawW`: ahead of the ramus and under the lips' line), as the jaw's rings did
 *
 * Every part is a layer-1 MESH part (station-loft.js meshPart): its points named, bound per point, shaded by the field's
 * own normals. Pure and deterministic: fixed loops, ties by index; no dice, no clock. */
import { netSkin, soundMesh, closeHoles, boundaryLoops, simplifyMesh, fieldNormals, untangle } from './skin-net.js';
import { mixW, four } from './body-relational-resample.js';
import { r6 } from './body-relational-vec.js';
import { smin } from './vajra.js';

/** the one skin's density: the net's `cell` (m), how near two rim points on the seam ring are welded (`weld` m), the
 * faces it is simplified to, how much more the features keep (`feature` × the planes' weight within `reach` m of an eye,
 * the nose's tip and wings, the mouth), the lips' turn-in (`lipDepth` m back, easing to nothing over `lipEase` m at the
 * corners) and how far either side of their line the cut looks (`lipWindow` m), the turn a collapse may give a face
 * (`turn`, the cosine), the globe's rings and slots, the mouth bag (its gap behind the turn-in, its depth and height,
 * how far `wide` past the corners, its rings and slots) */
export const ONE_SKIN = Object.freeze({
  cell: 0.001, weld: 0.0002, faces: 30000, feature: 12, reach: { eye: 0.02, nose: 0.016, mouth: 0.02 }, lipDepth: 0.005, lipEase: 0.003, lipWindow: 0.006, turn: 0.5,
  globeSlots: 48, globeRings: { pupil: 2, iris: 5, sclera: 14 },
  bag: { gap: 0.001, depth: 0.026, height: 0.024, wide: 0.004, rings: 10, slots: 24 },
});

/** the one skin by the head's rung on screen (dermal-hair.js `hairLevel`, from the hero's target: L2 a head 200 px tall
 * and over, L1 80 and over, L0 under): its faces, its net's cell (the lids' fold is thinner than a 1.5 mm cell, and
 * pinches into a ragged crease a close head shows) and its globes', over ONE_SKIN. A hero drawn for no target wears
 * ONE_SKIN as it is (a hero's export: the eyes gate's) */
export const ONE_SKIN_RUNGS = Object.freeze({
  L2: Object.freeze({ faces: 30000 }),
  L1: Object.freeze({ faces: 18000, cell: 0.0012 }),
  L0: Object.freeze({ faces: 8000, cell: 0.0015, globeSlots: 24, globeRings: Object.freeze({ pupil: 1, iris: 3, sclera: 8 }) }),
});

const ramp = (x) => { const y = Math.max(0, Math.min(1, x)); return y * y * (3 - 2 * y); };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rp = (p) => p.map(r6);
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const P3 = (q) => ({ x: q[0], y: q[1], z: q[2] });
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const n4 = (v) => v.map((x) => Math.round(x * 1e4) / 1e4);

/** The seam ring read by azimuth about its middle: its height there, a point on its edges, the blend there (lerped
 * between the two seam points about it). `pts` in slot order, `W` their blends. */
function seamRing(pts, W) {
  const c = mean(pts), az = (q) => Math.atan2(q[0] - c[0], q[1] - c[1]);
  const order = pts.map((p, j) => ({ a: az(p), j })).sort((x, y) => x.a - y.a || x.j - y.j), n = order.length;
  // the two seam points about azimuth `a` (cyclic), and how far along from the first
  const about = (a) => {
    let i = order.findIndex((o) => o.a > a); if (i < 0) i = 0;
    const hi = order[i], lo = order[(i - 1 + n) % n], span = wrap(hi.a - lo.a) || 1e-9, t = Math.max(0, Math.min(1, wrap(a - lo.a) / span));
    return { j0: lo.j, j1: hi.j, t };
  };
  const at = (a) => { const { j0, j1, t } = about(a); return lerp3(pts[j0], pts[j1], t); };
  const wAt = (a) => { const { j0, j1, t } = about(a); return mixW(W[j0], W[j1], t); };
  return { c, az, at, z: (a) => at(a)[2], wAt, about };
}

/** a closed GLOBE about its gaze: rings at polar angles from the gaze's pole, the pupil's and the iris's edges each a
 * ring (found along a meridian by the paint), each point cast from the centre onto the globe's field. → mesh part */
function globePart(g, { toHero, inHead, S2, k }, C) {
  const c = toHero(g.centre), d = [g.gaze.x, g.gaze.y, g.gaze.z], dl = Math.hypot(...d), D = d.map((x) => x / dl);
  const e1n = Math.abs(D[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], dot = e1n[0] * D[0] + e1n[1] * D[1] + e1n[2] * D[2];
  let e1 = [e1n[0] - D[0] * dot, e1n[1] - D[1] * dot, e1n[2] - D[2] * dot]; const l1 = Math.hypot(...e1); e1 = e1.map((x) => x / l1);
  const e2 = [D[1] * e1[2] - D[2] * e1[1], D[2] * e1[0] - D[0] * e1[2], D[0] * e1[1] - D[1] * e1[0]];
  const fG = inHead(g.field), R = 0.03 * k;
  const dir = (ph, th) => [0, 1, 2].map((a) => Math.cos(ph) * D[a] + Math.sin(ph) * (Math.cos(th) * e1[a] + Math.sin(th) * e2[a]));
  const cast = (ph, th) => { const u = dir(ph, th); let lo = 0, hi = R; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (fG(c.map((x, a) => x + u[a] * m)) <= 0) lo = m; else hi = m; } const t = (lo + hi) / 2; return c.map((x, a) => x + u[a] * t); };
  const paint = (q) => g.paint(S2(q)) ?? 'sclera';
  // the edges along one meridian: where the paint turns from the pupil to the iris, and from the iris to the sclera
  const edge = (from) => { let lo = 0, hi = Math.PI / 2; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (from.includes(paint(cast(m, 0)))) lo = m; else hi = m; } return (lo + hi) / 2; };
  const phP = edge(['pupil']), phI = edge(['pupil', 'iris']), Rg = C.globeRings;
  const phis = [
    ...Array.from({ length: Rg.pupil }, (_, i) => (phP * (i + 1)) / Rg.pupil),
    ...Array.from({ length: Rg.iris }, (_, i) => phP + ((phI - phP) * (i + 1)) / Rg.iris),
    ...Array.from({ length: Rg.sclera }, (_, i) => phI + ((Math.PI * 0.97 - phI) * (i + 1) ** 1.3) / Rg.sclera ** 1.3),
  ];
  const N = C.globeSlots, points = { front: rp(cast(0, 0)), back: rp(cast(Math.PI, 0)) }, faces = {}, groups = {};
  phis.forEach((ph, i) => { for (let j = 0; j < N; j++) points[`r${i}s${j}`] = rp(cast(ph, (2 * Math.PI * j) / N)); });
  const G = (ids) => { const q = mean(ids.map((id) => points[id])), p = paint(q); return p === 'pupil' ? 'Pupil' : p === 'iris' ? 'Iris' : 'Sclera'; };
  let f = 0;
  const face = (a, b, cc) => { const id = `f${f++}`; faces[id] = [a, b, cc]; groups[id] = G([a, b, cc]); };
  const id = (i, j) => `r${i}s${((j % N) + N) % N}`;
  // (wound outward: the pole along the gaze, the rings counter-clockwise about it seen from outside)
  for (let j = 0; j < N; j++) face('front', id(0, j), id(0, j + 1));
  for (let i = 0; i + 1 < phis.length; i++) for (let j = 0; j < N; j++) { face(id(i, j), id(i + 1, j), id(i + 1, j + 1)); face(id(i, j), id(i + 1, j + 1), id(i, j + 1)); }
  for (let j = 0; j < N; j++) face(id(phis.length - 1, j), 'back', id(phis.length - 1, j + 1));
  // (which way round the rings run depends on the frame's hand: turned once if the front fan faces in)
  const P0 = points.front, P1 = points[id(0, 0)], P2 = points[id(0, 1)], nn = [(P1[1] - P0[1]) * (P2[2] - P0[2]) - (P1[2] - P0[2]) * (P2[1] - P0[1]), (P1[2] - P0[2]) * (P2[0] - P0[0]) - (P1[0] - P0[0]) * (P2[2] - P0[2]), (P1[0] - P0[0]) * (P2[1] - P0[1]) - (P1[1] - P0[1]) * (P2[0] - P0[0])];
  if (nn[0] * D[0] + nn[1] * D[1] + nn[2] * D[2] < 0) for (const k2 of Object.keys(faces)) { const t = faces[k2]; faces[k2] = [t[0], t[2], t[1]]; }
  const ids = Object.keys(points), normals = Object.fromEntries(fieldNormals(ids.map((i) => points[i]), (p) => fG([p.x, p.y, p.z]), 1e-5).map((n, i) => [ids[i], n4(n)]));
  return { layer: 1, closure: 'closed', group: 'Sclera', mesh: { points, faces, groups, normals }, bind: 'head' };
}

/**
 * The head as ONE SKIN (see the head of the file). `head` the relational head built with `globes: false` and no ears,
 * `inHead`/`toHero`/`S2` its frame's maps (hero metres ↔ the head's own), `fN` the neck's column as a distance, `join`
 * its smooth union's width, `seamPts`/`seamW` the seam ring (slot order) and its blends, `O` a point inside the head,
 * `lipZ(x)` the lips' line's height across the mouth, `ch` the right mouth corner and `sto` the stomion (hero frame),
 * `jawW(p)` the jaw's share as the visage's bind reads it. → { parts: { headSkin, mouth, globeR, globeL }, stats }.
 */
export function oneSkinHead({ head, k, toHero, inHead, S2, fN, join, seamPts, seamW, O, lipZ, ch, sto, jawW, opts = {} }) {
  const C = { ...ONE_SKIN, ...opts }, cell = C.cell;
  const fH = inHead(head.field), fU = (q) => smin(fH(q), fN(q), join), ring = seamRing(seamPts, seamW);
  const fClip = (q) => Math.max(fU(q), ring.z(ring.az(q)) - q[2]);
  // THE NET over the head's box and the seam ring, a few cells over
  const b0 = toHero(head.bounds.min), b1 = toHero(head.bounds.max), pad = 3 * cell;
  const lo = [0, 1, 2].map((a) => Math.min(b0[a], ...seamPts.map((p) => p[a])) - pad), hi = [0, 1, 2].map((a) => Math.max(b1[a], ...seamPts.map((p) => p[a])) + pad);
  const net = netSkin((p) => fClip([p.x, p.y, p.z]), { min: P3(lo), max: P3(hi) }, { cell });
  let V = net.V, F = net.F;
  // (the cut's own floor let go: every face lying wholly at the seam's level)
  const onSeam = (p) => p[2] - ring.z(ring.az(p)) < 0.4 * cell;
  F = F.filter((t) => !t.every((v) => onSeam(V[v])));
  // SOUND: pinches let go, wound outward from inside the head, the holes they leave closed (the seam's rim kept open)
  F = soundMesh(V, F, { out: (q) => [q[0] - O[0], q[1] - O[1], q[2] - O[2]] });
  const lowest = (loop) => mean(loop.map((v) => V[v]))[2];
  const seamLoopOf = (FF) => boundaryLoops(FF).reduce((a, l) => (!a || lowest(l) < lowest(a) ? l : a), null);
  const seam0 = seamLoopOf(F);
  ({ V, F } = closeHoles(V, F, (p) => fU([p.x, p.y, p.z]), { keep: (loop) => loop.length === seam0.length && loop.every((v, i) => v === seam0[i]) }));
  // THE RIM on the seam ring: each rim point onto the ring's edge at its azimuth, and the seam's own points each taken
  // by the rim point nearest it in azimuth
  V = V.map((p) => p.slice());
  const rim = seamLoopOf(F), rimW = new Map(), claimed = new Set();
  for (const v of rim) { const a = ring.az(V[v]); V[v] = ring.at(a); rimW.set(v, ring.wAt(a)); }
  seamPts.forEach((p, j) => {
    const a = ring.az(p); let best = -1, bd = Infinity;
    for (const v of rim) { const d = Math.abs(wrap(ring.az(V[v]) - a)); if (d < bd) { bd = d; best = v; } }
    V[best] = p.slice(); rimW.set(best, seamW[j]); claimed.add(best);
  });
  // (a rim point set within a hair of its neighbour along the ring, a seam point's and the one beside it, welded into
  // one: the face between them would have no area)
  const into = new Map();
  for (let i = 0; i < rim.length; i++) {
    const a = rim[i], b = rim[(i + 1) % rim.length], ra = into.get(a) ?? a;
    if (ra === b || Math.hypot(V[ra][0] - V[b][0], V[ra][1] - V[b][1], V[ra][2] - V[b][2]) > C.weld) continue;
    const [keep, drop] = claimed.has(b) && !claimed.has(ra) ? [b, ra] : [ra, b];
    into.set(drop, keep); for (const [k2, v2] of into) if (v2 === drop) into.set(k2, keep);
  }
  if (into.size) {
    F = F.map((t) => t.map((v) => into.get(v) ?? v)).filter((t) => t[0] !== t[1] && t[1] !== t[2] && t[0] !== t[2]);
    for (let i = rim.length - 1; i >= 0; i--) if (into.has(rim[i])) { rimW.delete(rim[i]); rim.splice(i, 1); }
  }
  // (a rim point moved onto the ring can fold the face beside it: those faces' free points relaxed back)
  const outward = (q) => [q[0] - O[0], q[1] - O[1], q[2] - O[2]], rimSet = new Set(rim);
  untangle(V, F, { out: outward, fixed: (v) => rimSet.has(v), field: (p) => fU([p.x, p.y, p.z]), around: rimSet });
  // THE LIPS' CUT, exactly on the lips' line: each edge across it (between the corners, at the mouth's front, its ends
  // within `lipWindow` of it) split where it crosses (the point set back onto the skin along the look: the groove faces
  // forward), each face across it split on those points; the points on the line then doubled, the lower lip's faces
  // taking the copies
  const chx = Math.abs(ch[0]), lim = chx - 0.001, cOf = V.map((p) => p[2] - lipZ(p[0]) || 1e-12);
  const e = 1e-5, gradH = (p) => [fH([p[0] + e, p[1], p[2]]) - fH([p[0] - e, p[1], p[2]]), fH([p[0], p[1] + e, p[2]]) - fH([p[0], p[1] - e, p[2]]), fH([p[0], p[1], p[2] + e]) - fH([p[0], p[1], p[2] - e])].map((x) => x / (2 * e));
  const onLine = new Map(), cut = [];
  const crossAt = (a, b) => {
    const kk = a < b ? a * 4194304 + b : b * 4194304 + a;
    if (onLine.has(kk)) return onLine.get(kk);
    let r = -1; const ca = cOf[a], cb = cOf[b];
    if ((ca > 0) !== (cb > 0) && Math.abs(ca) < C.lipWindow && Math.abs(cb) < C.lipWindow) {
      let p = lerp3(V[a], V[b], ca / (ca - cb));
      if (Math.abs(p[0]) < lim && p[1] > sto[1] - 0.012) {
        p = [p[0], p[1], lipZ(p[0])];
        for (let it = 0; it < 4; it++) { const f = fH(p), g = gradH(p); if (Math.abs(g[1]) < 1e-6) break; p = [p[0], p[1] - Math.max(-cell, Math.min(cell, f / g[1])), p[2]]; }
        r = V.length; V.push(p); cOf.push(0); cut.push(r);
      }
    }
    onLine.set(kk, r); return r;
  };
  const split = [];
  for (const t of F) {
    const x = [crossAt(t[0], t[1]), crossAt(t[1], t[2]), crossAt(t[2], t[0])], n = x.filter((v) => v >= 0).length;
    if (!n) { split.push(t); continue; }
    if (n === 2) {
      // (the lone corner j between the two crossed edges: a face on its side, two on the other)
      const j = [0, 1, 2].find((i) => x[(i + 2) % 3] >= 0 && x[i] >= 0), m1 = x[(j + 2) % 3], m2 = x[j];
      split.push([t[j], m2, m1], [m1, m2, t[(j + 1) % 3]], [m1, t[(j + 1) % 3], t[(j + 2) % 3]]);
    } else {
      const i = x.findIndex((v) => v >= 0), m = x[i];
      split.push([t[i], m, t[(i + 2) % 3]], [m, t[(i + 1) % 3], t[(i + 2) % 3]]);
    }
  }
  F = split;
  // (two points on the line within `weld` of each other are one: near the corners crossings of neighbouring edges land
  // on one spot, and the faces between them would have no area)
  const same = new Map(), grid = new Map(), gk = (p) => p.map((x) => Math.floor(x / C.weld)).join();
  for (const v of cut) {
    let hit = -1;
    const g = V[v].map((x) => Math.floor(x / C.weld));
    for (let a = -1; a <= 1 && hit < 0; a++) for (let b = -1; b <= 1 && hit < 0; b++) for (let c = -1; c <= 1 && hit < 0; c++) for (const w of grid.get(`${g[0] + a},${g[1] + b},${g[2] + c}`) || []) if (Math.hypot(V[v][0] - V[w][0], V[v][1] - V[w][1], V[v][2] - V[w][2]) < C.weld) { hit = w; break; }
    if (hit >= 0) same.set(v, hit); else { const k = gk(V[v]); (grid.get(k) || grid.set(k, []).get(k)).push(v); }
  }
  if (same.size) {
    F = F.map((t) => t.map((v) => same.get(v) ?? v)).filter((t) => t[0] !== t[1] && t[1] !== t[2] && t[0] !== t[2]);
    for (let i = cut.length - 1; i >= 0; i--) if (same.has(cut[i])) cut.splice(i, 1);
  }
  const cutSet = new Set(cut), lower = new Map(); for (const v of cut) { lower.set(v, V.length); V.push(V[v].slice()); }
  // (a face touching the line is the lower lip's by its own corners' side of it)
  F = F.map((t) => { if (!t.some((v) => cutSet.has(v))) return t; const c = t.reduce((sum, v) => sum + cOf[v], 0); return c < 0 ? t.map((v) => lower.get(v) ?? v) : t; });
  // SIMPLIFIED, the rim and the cut held, the features keeping more of the faces
  const L = (n) => toHero(head.points[n]), centres = [
    ...['eyeR', 'eyeL'].map((n) => [L(n), C.reach.eye]), ...['prn', 'alR', 'alL'].map((n) => [L(n), C.reach.nose]), [sto, C.reach.mouth], [ch, C.reach.mouth], [[-ch[0], ch[1], ch[2]], C.reach.mouth],
  ];
  const weight = (p) => { let m = 0; for (const [q, r] of centres) m = Math.max(m, Math.exp(-((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2) / (r * r))); return 1 + C.feature * m; };
  const locked = new Uint8Array(V.length); for (const v of rim) locked[v] = 1; for (const v of cut) { locked[v] = 1; locked[lower.get(v)] = 1; }
  // (a point near the cut never collapses across the lips' line from its own side: shut, the lips hide it; parted, it
  // stands in the mouth as a spike)
  const sideOf = (v) => (v < cOf.length ? Math.sign(cOf[v]) : -1), nearCut = (p) => Math.abs(p[0]) < chx + 0.002 && p[1] > sto[1] - 0.012 && Math.abs(p[2] - lipZ(p[0])) < C.lipWindow;
  const accept = (a, b, p) => { if (!nearCut(p)) return true; const s2 = sideOf(a) || sideOf(b); return !s2 || Math.sign(p[2] - lipZ(p[0])) !== -s2; };
  const S = simplifyMesh(V, F, { target: C.faces, locked, weight, turn: C.turn, accept });
  const of = S.of, isUp = new Set(cut.map((v) => of[v])), isDn = new Set(cut.map((v) => of[lower.get(v)])), rimOf = new Map([...rimW].map(([v, w]) => [of[v], w]));
  // (each kept point's side of the cut, as its points before were: a point a hair over the line is the upper lip's)
  const sideAfter = new Map();
  for (let v = 0; v < of.length; v++) { if (of[v] < 0) continue; const sd = sideOf(v); if (sd && nearCut(V[v])) sideAfter.set(of[v], sd); }
  V = S.V; F = S.F;
  // THE LIPS TURNED IN: along the cut's rim (the loop that is not the seam's), each point carried `lipDepth` back,
  // easing to nothing over `lipEase` m at the rim's ends (the corners); each bound as the point it turns in from
  const loops = boundaryLoops(F), seamL = loops.reduce((a, l) => (!a || lowest(l) < lowest(a) ? l : a), null);
  const inner = new Map(), upper = new Set(), strip = [];
  for (const loop of loops) {
    if (loop === seamL || !loop.some((v) => isUp.has(v) || isDn.has(v))) continue;
    const xm = Math.max(...loop.map((v) => Math.abs(V[v][0])));
    const back = (v) => {
      if (inner.has(v)) return inner.get(v);
      const s2 = ramp((xm - Math.abs(V[v][0])) / C.lipEase), up = isUp.has(v) || (!isDn.has(v) && V[v][2] >= lipZ(V[v][0]));
      if (s2 < 0.05) { inner.set(v, v); return v; }
      const w = V.length; inner.set(v, w); if (up) upper.add(w);
      V.push([V[v][0], V[v][1] - C.lipDepth * s2, V[v][2] + (up ? 0.0005 : -0.0005) * s2]);
      return w;
    };
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length], a2 = back(a), b2 = back(b);
      if (b2 !== b) strip.push([a, b, b2]);
      if (a2 !== a) strip.push([a, b2, a2]);
    }
  }
  // THE BIND: the seam's blend up the head easing to the jaw's share, the cut's sides each whole
  const zM = sto[2], wOf = (p, v) => {
    if (rimOf.has(v)) return four(rimOf.get(v));
    const target = isUp.has(v) ? { head: 1 } : isDn.has(v) ? { jaw: 1 } : jawW(p, sideAfter.get(v) ?? 0), a = ring.az(p), zs = ring.z(a);
    const t = ramp((p[2] - zs) / (0.45 * Math.max(0.01, zM - zs)));
    return four(t >= 1 ? target : mixW(ring.wAt(a), target, t));
  };
  const N0 = fieldNormals(V, (p) => fU([p.x, p.y, p.z]), 1e-5);
  const points = {}, normals = {}, blend = {}, faces = {}, groups = {}, innerOf = new Map([...inner].filter(([v, w]) => v !== w).map(([v, w]) => [w, v]));
  V.forEach((p, v) => {
    const id = `v${v}`; points[id] = rp(p);
    const inn = innerOf.get(v);
    if (inn !== undefined) { normals[id] = upper.has(v) ? [0, 0, -1] : [0, 0, 1]; blend[`st0.${id}`] = wOf(V[inn], inn); }
    else { normals[id] = n4(N0[v]); blend[`st0.${id}`] = wOf(p, v); }
  });
  F.forEach((t, fi) => { faces[`f${fi}`] = t.map((v) => `v${v}`); });
  strip.forEach((t, i) => { const id = `m${i}`; faces[id] = t.map((v) => `v${v}`); groups[id] = 'Mouth'; });
  const count = new Map(); for (const t of Object.values(faces)) for (let a = 0; a < 3; a++) { const u = t[a], w = t[(a + 1) % 3], kk = u < w ? `${u}|${w}` : `${w}|${u}`; count.set(kk, (count.get(kk) || 0) + 1); }
  const boundary = [...count].filter(([, c]) => c === 1).map(([kk]) => kk.split('|'));
  const headSkin = { layer: 1, closure: 'open', group: 'Skin', mesh: { points, faces, groups, normals, boundary }, bind: { bone: 'head', blend } };
  // THE MOUTH: a closed bag behind the lips, its upper half the head's and its lower the jaw's
  const B = C.bag, cx = chx + B.wide, cy = sto[1] - C.lipDepth - B.gap - B.depth / 2, mp = {}, mf = {}, mb = {}, mn = {};
  const bagAt = (u, th) => { const s = Math.sin(u), c2 = Math.cos(u); return [cx * s * Math.sin(th), cy + (B.depth / 2) * s * Math.cos(th), sto[2] + (B.height / 2) * c2]; };
  mp.top = rp(bagAt(0, 0)); mp.bot = rp(bagAt(Math.PI, 0));
  for (let i = 1; i < B.rings; i++) for (let j = 0; j < B.slots; j++) mp[`r${i}s${j}`] = rp(bagAt((Math.PI * i) / B.rings, (2 * Math.PI * j) / B.slots));
  const mid = (i, j) => `r${i}s${((j % B.slots) + B.slots) % B.slots}`;
  let mi = 0; const mface = (a, b2, c2) => { mf[`f${mi++}`] = [a, b2, c2]; };
  for (let j = 0; j < B.slots; j++) mface('top', mid(1, j + 1), mid(1, j));
  for (let i = 1; i + 1 < B.rings; i++) for (let j = 0; j < B.slots; j++) { mface(mid(i, j), mid(i, j + 1), mid(i + 1, j + 1)); mface(mid(i, j), mid(i + 1, j + 1), mid(i + 1, j)); }
  for (let j = 0; j < B.slots; j++) mface(mid(B.rings - 1, j), mid(B.rings - 1, j + 1), 'bot');
  for (const [id, p] of Object.entries(mp)) {
    const q = [p[0] / cx, (p[1] - cy) / (B.depth / 2), (p[2] - sto[2]) / (B.height / 2)], l = Math.hypot(q[0] / cx, q[1] / (B.depth / 2), q[2] / (B.height / 2)) || 1;
    mn[id] = n4([q[0] / cx / l, q[1] / (B.depth / 2) / l, q[2] / (B.height / 2) / l]);
    const t = ramp((p[2] - sto[2] + 0.003) / 0.006); mb[`st0.${id}`] = t >= 1 ? { head: 1 } : t <= 0 ? { jaw: 1 } : { head: r6(t), jaw: r6(1 - t) };
  }
  // (wound outward: turned once if its volume reads negative)
  let vol = 0; for (const t of Object.values(mf)) { const [a, b2, c2] = t.map((id) => mp[id]); vol += a[0] * (b2[1] * c2[2] - b2[2] * c2[1]) - a[1] * (b2[0] * c2[2] - b2[2] * c2[0]) + a[2] * (b2[0] * c2[1] - b2[1] * c2[0]); }
  if (vol < 0) for (const id of Object.keys(mf)) { const t = mf[id]; mf[id] = [t[0], t[2], t[1]]; }
  const mouth = { layer: 1, closure: 'closed', group: 'Mouth', mesh: { points: mp, faces: mf, normals: mn }, bind: { bone: 'head', blend: mb } };
  // THE GLOBES
  const frame = { toHero, inHead, S2, k }, globes = Object.fromEntries(head.globes.map((g) => [`globe${g.side}`, globePart(g, frame, C)]));
  return { parts: { headSkin, mouth, ...globes }, stats: { net: net.F.length, faces: Object.keys(faces).length, cut: cut.length, rim: rim.length } };
}
