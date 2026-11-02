/**
 * tack — the horse's saddlery, fitted to its own body at the stand: an all-purpose saddle on its pad, the girth, the
 * stirrup leathers and irons, and a snaffle bridle with its reins. Each piece is built on the body's surface (rays cast
 * into the form field, body.js, and stopped where they meet it), a few millimetres proud of it, so a longer back or a
 * deeper head gets tack that fits. Straps and leather are too thin for the field's grid, so the tack is explicit
 * geometry: SLABS over surface patches (the pad, the seat, the flaps), RIBBONS along surface curves (the girth, the
 * bridle's straps, the reins) and RINGS (the bit's, the irons').
 *
 * THE SADDLE (after the English all-purpose saddle: the pommel over the withers, the seat's lowest point a hand behind
 * it, the cantle raised behind; the panels either side of the spine with the gullet clear over it; the flaps cut
 * forward over the shoulder with the knee rolls; the stirrup bars under the skirt): on a pad that reaches a little past
 * it all round; the girth in the girth groove behind the elbow; the irons run up the leathers (unridden) or hung to a
 * rider's feet. THE BRIDLE (a snaffle): the crownpiece over the poll behind the ears, the browband across the forehead,
 * the cheekpieces down to the bit's rings at the corners of the mouth, the cavesson noseband a couple of fingers below
 * the cheekbone, the throatlash under the throat; the reins from the rings, over the neck (unridden) or to the hands.
 *
 * Each piece names how it rides: `rigid` on a bone (the bridle's on `head`), or `skin` (the saddle, its pad and girth,
 * the leathers and irons, the noseband and throatlash: a vertex takes the weights of the body's nearest vertex AND its
 * corrective shapes, so the tack moves exactly as the skin it lies on: where a fold's correction lifts the skin, the
 * pad and the saddle lift with it).
 *
 *   tackPieces(B, { stirrups: 'up' | { length, out }, reins: 'neck' | false }) → [{ name, vertices, quads, colors, rides }]
 *     with `.anchors` { seat, bars: { R, L }, bits: { R, L }, crest } (world, at the stand): where a rider meets it
 */
import { bodyField, HEAD_PROFILE, neckCrest } from './body.js';
import { standPose } from './gait.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
const DEG = Math.PI / 180;

export const TACK_COLOURS = Object.freeze({ leather: '#5a3a24', seat: '#4b2f1d', pad: '#e8e5dc', padRim: '#2f3a52', steel: '#b9bdc3', girth: '#3b2a1e' });

/** the body's surface: where a ray from `o` toward `c` first meets the field, and the field's outward normal there */
function surfaceOn(field, o, c) {
  const d = sub(c, o), L = len(d), u = mul(d, 1 / L);
  let t0 = 0, t1 = null;
  for (let t = 0.01; t <= L; t += 0.01) if (field(add(o, mul(u, t))) < 0) { t1 = t; t0 = t - 0.01; break; }
  if (t1 === null) return null;
  for (let i = 0; i < 30; i++) { const m = (t0 + t1) / 2; if (field(add(o, mul(u, m))) < 0) t1 = m; else t0 = m; }
  const p = add(o, mul(u, t1)), e = 1e-4, f0 = field(p);
  return { p, n: unit([field(add(p, [e, 0, 0])) - f0, field(add(p, [0, e, 0])) - f0, field(add(p, [0, 0, e])) - f0]) };
}

/** the body's surface: where a ray from `c` (inside) along `d` first leaves the field, and its outward normal there */
function surfaceOut(field, c, d, L) {
  const u = unit(d);
  if (field(c) >= 0) return null;
  let t0 = 0, t1 = null;
  for (let t = 0.005; t <= L; t += 0.005) if (field(add(c, mul(u, t))) >= 0) { t1 = t; t0 = t - 0.005; break; }
  if (t1 === null) return null;
  for (let i = 0; i < 30; i++) { const m = (t0 + t1) / 2; if (field(add(c, mul(u, m))) >= 0) t1 = m; else t0 = m; }
  const p = add(c, mul(u, t1)), e = 1e-4, f0 = field(p);
  return { p, n: unit([field(add(p, [e, 0, 0])) - f0, field(add(p, [0, e, 0])) - f0, field(add(p, [0, 0, e])) - f0]) };
}

/** a slab over a grid of surface points: its top `off + thick` proud of the surface, its underside `off`, its rim closed */
function slab(grid, { off, thick, colour, rim = colour, lift = () => 0 }) {
  const vertices = [], quads = [], colors = [], R = grid.length, C = grid[0].length, at = (layer, i, j) => layer * R * C + i * C + j;
  for (const layer of [0, 1]) for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
    const { p, n } = grid[i][j];
    vertices.push(add(p, mul(n, off + (layer ? thick + lift(i, j) : 0))));
  }
  for (let i = 0; i + 1 < R; i++) for (let j = 0; j + 1 < C; j++) {
    quads.push([at(1, i, j), at(1, i + 1, j), at(1, i + 1, j + 1), at(1, i, j + 1)]); colors.push(colour);   // top
    quads.push([at(0, i, j), at(0, i, j + 1), at(0, i + 1, j + 1), at(0, i + 1, j)]); colors.push(colour);   // underside
  }
  const edge = [];
  for (let j = 0; j + 1 < C; j++) edge.push([0, j, 0, j + 1]);
  for (let i = 0; i + 1 < R; i++) edge.push([i, C - 1, i + 1, C - 1]);
  for (let j = C - 1; j > 0; j--) edge.push([R - 1, j, R - 1, j - 1]);
  for (let i = R - 1; i > 0; i--) edge.push([i, 0, i - 1, 0]);
  for (const [a, b, c, d] of edge) { quads.push([at(0, a, b), at(0, c, d), at(1, c, d), at(1, a, b)]); colors.push(rim); }
  return { vertices, quads, colors };
}

/** a flat strap along a curve: `pts` its centre line, `nrm` the surface's normal at each (the strap lies flat on it) */
function ribbon(pts, nrm, { width, thick, colour, closed = false }) {
  const vertices = [], quads = [], colors = [], n = pts.length;
  for (let k = 0; k < n; k++) {
    const t = unit(sub(pts[closed ? (k + 1) % n : Math.min(n - 1, k + 1)], pts[closed ? (k - 1 + n) % n : Math.max(0, k - 1)]));
    const nn = unit(sub(nrm[k], mul(t, dot(nrm[k], t)))), w = unit(cross(nn, t));
    for (const [a, b] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) vertices.push(add(add(pts[k], mul(w, a * width / 2)), mul(nn, b * thick)));
  }
  const m = closed ? n : n - 1;
  for (let k = 0; k < m; k++) {
    const a = 4 * k, b = 4 * ((k + 1) % n);
    for (let s = 0; s < 4; s++) { quads.push([a + s, b + s, b + ((s + 1) % 4), a + ((s + 1) % 4)]); colors.push(colour); }
  }
  if (!closed) { quads.push([0, 3, 2, 1]); colors.push(colour); const e = 4 * (n - 1); quads.push([e, e + 1, e + 2, e + 3]); colors.push(colour); }
  return { vertices, quads, colors };
}

/** a ring (a torus): centre, its axis, its radius and its tube's (a stirrup iron is one squashed by `squash`) */
function ring(c, axis, R, r, colour, { seg = 16, side = 6, squash = 1 } = {}) {
  const ax = unit(axis), u = unit(Math.abs(ax[2]) < 0.9 ? cross(ax, [0, 0, 1]) : cross(ax, [1, 0, 0])), v = cross(ax, u);
  const vertices = [], quads = [], colors = [];
  for (let i = 0; i < seg; i++) {
    const a = 2 * Math.PI * i / seg, rd = add(mul(u, Math.cos(a)), mul(v, Math.sin(a) * squash)), ctr = add(c, mul(rd, R));
    const rn = unit(rd);
    for (let j = 0; j < side; j++) { const b = 2 * Math.PI * j / side; vertices.push(add(ctr, add(mul(rn, r * Math.cos(b)), mul(ax, r * Math.sin(b))))); }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < side; j++) {
    const a = i * side + j, b = ((i + 1) % seg) * side + j, a2 = i * side + ((j + 1) % side), b2 = ((i + 1) % seg) * side + ((j + 1) % side);
    quads.push([a, b, b2, a2]); colors.push(colour);
  }
  return { vertices, quads, colors };
}

export function tackPieces(B, { stirrups = 'up', reins = 'neck' } = {}) {
  const k = B.scale, T = B.trunk, S = standPose(B), bn = S.bones, { field } = bodyField(B), out = [];
  const piece = (name, mesh, rides) => out.push({ name, ...mesh, rides });
  // THE BACK: rays from above and around the barrel's axis (at the centre of mass's height), θ from the top (0) down
  // the right side (+) or the left (−)
  const axisZ = T.com[1];
  const back = (y, th) => surfaceOn(field, [Math.sin(th) * 1.2 * k, y, axisZ + Math.cos(th) * 1.2 * k], [0, y, axisZ]);
  const yW = T.withers[0], yLoin = T.loin[0];
  // a grid over a superellipse outline in (along, around): `y0..y1`, ±`thMax`, its corners rounded (power p)
  const patch = (y0, y1, thMax, R, C, p = 4, thOf = null) => {
    const g = [];
    for (let i = 0; i < R; i++) {
      const row = [];
      for (let j = 0; j < C; j++) {
        let s = -1 + 2 * i / (R - 1), r = -1 + 2 * j / (C - 1);
        const m = Math.max(Math.abs(s), Math.abs(r)), q = (Math.abs(s) ** p + Math.abs(r) ** p) ** (1 / p);
        if (q > 1e-9) { s *= m / q; r *= m / q; }
        const y = y0 + (y1 - y0) * (s + 1) / 2, th = thOf ? thOf(s, r) : r * thMax;
        row.push(back(y, th) ?? back(y, th * 0.9));
      }
      g.push(row);
    }
    return g;
  };
  // the pad: from a little over the withers to the loin's front, down to a hand below the saddle's flaps
  const padF = yW + 0.02 * k, padB = yLoin + 0.06 * k;
  piece('pad', slab(patch(padB, padF, 72 * DEG, 18, 22), { off: 0.003 * k, thick: 0.012 * k, colour: TACK_COLOURS.pad, rim: TACK_COLOURS.padRim }), 'skin');
  // the saddle's seat and panels: the pommel over the withers' back edge, the cantle over the loin; its top raised by
  // the seat's profile (the pommel high, the twist and the seat's low point a hand behind the pommel, the cantle up),
  // the gullet clear over the spine
  const seatF = yW - 0.005 * k, seatB = yLoin + 0.14 * k, padTop = 0.015 * k;
  const profile = (i, j, R, C) => {
    const s = -1 + 2 * i / (R - 1), r = -1 + 2 * j / (C - 1);          // s: −1 the cantle, +1 the pommel
    // (the seat's rise along it: the pommel's over its front fifth, the cantle's over its back fifth, a smooth dip between;
    // across it the rise falls away to nothing at the panels' edges, so the saddle's sides meet the pad and the flaps)
    const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    const along = 0.02 * k + 0.045 * k * sm((s - 0.6) / 0.4) + 0.075 * k * sm((-0.55 - s) / 0.45);
    const across = (1 - r * r) ** 2;
    return along * across + 0.01 * k * Math.exp(-((r / 0.22) ** 2));
  };
  { const R = 16, C = 14; piece('saddle', slab(patch(seatB, seatF, 36 * DEG, R, C, 3), { off: 0.003 * k + padTop, thick: 0.008 * k, colour: TACK_COLOURS.seat, lift: (i, j) => profile(i, j, R, C) }), 'skin'); }
  // the flaps: hanging down each side from under the seat's edge, their front edge cut forward (the knee roll's line)
  for (const sd of [1, -1]) {
    const R = 10, C = 8, g = [];
    for (let i = 0; i < R; i++) {
      const row = [], u = i / (R - 1);                                  // u: 0 the top, 1 the bottom
      for (let j = 0; j < C; j++) {
        const v = j / (C - 1), th = sd * (37 + 60 * u) * DEG, front = seatF - 0.02 * k + 0.14 * k * u, rear = seatB + 0.16 * k + 0.02 * k * u;
        row.push(back(rear + (front - rear) * v, th));
      }
      g.push(row);
    }
    piece(`flap${sd > 0 ? "R" : "L"}`, slab(g, { off: padTop + 0.009 * k, thick: 0.006 * k, colour: TACK_COLOURS.leather }), 'skin');
  }
  // the girth: around the barrel in the girth groove (behind the elbow), from one flap's foot under the belly to the other's
  const yG = bn.humerusR.tail[1] - 0.06 * k;
  { const pts = [], nrm = []; for (let a = 92; a <= 268; a += 6) { const s = back(yG, a * DEG); if (s) { pts.push(add(s.p, mul(s.n, 0.004 * k))); nrm.push(s.n); } } piece('girth', ribbon(pts, nrm, { width: 0.075 * k, thick: 0.01 * k, colour: TACK_COLOURS.girth }), 'skin'); }
  // the stirrups: the leathers from the bars (under the skirt, at the seat's front third) down the flaps, the irons on
  // them; run up (unridden: the iron at the top of the leather) or hung to a length
  const yBar = seatF - 0.06 * k;
  for (const sd of [1, -1]) {
    const bar = back(yBar, sd * 28 * DEG), top = add(bar.p, mul(bar.n, padTop + 0.016 * k));
    const L = stirrups === 'up' ? 0.07 * k : stirrups.length, foot = add(top, [sd * (0.028 * k + (stirrups === 'up' ? 0 : stirrups.out ?? 0)), 0, -L]);
    const pts = Array.from({ length: 6 }, (_, i) => lerp(top, foot, i / 5)), nrm = pts.map(() => [sd, 0, 0]);
    piece(`leather${sd > 0 ? 'R' : 'L'}`, ribbon(pts, nrm, { width: 0.025 * k, thick: 0.005 * k, colour: TACK_COLOURS.leather }), 'skin');
    piece(`iron${sd > 0 ? 'R' : 'L'}`, ring(add(foot, [0, 0, -0.055 * k]), [sd, 0, 0], 0.06 * k, 0.007 * k, TACK_COLOURS.steel, { squash: 0.85 }), 'skin');
  }
  // THE BRIDLE: rays round the head's centre line (the bone, raised to the middle of its top line and its underline)
  const hd = bn.head, hdir = unit(sub(hd.tail, hd.head)), hl = len(sub(hd.tail, hd.head)), face = unit(cross([1, 0, 0], hdir)), hh = B.head.length / 0.6;
  const prof = (f) => { const P = HEAD_PROFILE; let i = 0; while (i + 2 < P.length && P[i + 1][0] < f) i++; const t = (f - P[i][0]) / (P[i + 1][0] - P[i][0]); return [0, 1, 2, 3].map((c) => P[i][c] + (P[i + 1][c] - P[i][c]) * t); };
  const centre = (f) => { const [, top, bot] = prof(f); return add(add(hd.head, mul(hdir, f * hl)), mul(face, (top + bot) / 2 * hh)); };
  // φ round the head: 0 the face's front (the top at the poll), ±90° the cheeks, 180° the jaw's underside
  // (marched OUT from the head's centre to where it leaves the head: a ray cast in from outside would meet the neck or
  // the chest first under a hanging head)
  const headAt = (f, phi) => { const c = centre(f), d = add(mul(face, Math.cos(phi)), mul([1, 0, 0], Math.sin(phi))); return surfaceOut(field, c, d, 0.4 * k); };
  const strap = (name, samples, opts) => {
    const pts = [], nrm = [];
    const { rides = 'rigid:head', ...o } = opts, lift = rides === 'skin' ? 0.005 * k : 0.003 * k;   // (round the jaw a little looser)
    for (const [f, phi] of samples) { const s = headAt(f, phi); if (s) { pts.push(add(s.p, mul(s.n, lift))); nrm.push(s.n); } }
    if (pts.length > 1) piece(name, ribbon(pts, nrm, { thick: 0.006 * k, colour: TACK_COLOURS.leather, ...o }), rides);
  };
  const arc = (f0, f1, p0, p1, n = 14) => Array.from({ length: n }, (_, i) => [f0 + (f1 - f0) * i / (n - 1), (p0 + (p1 - p0) * i / (n - 1)) * DEG]);
  strap('crownpiece', arc(0.05, 0.05, -105, 105), { width: 0.028 * k });
  strap('browband', arc(0.13, 0.13, -78, 78), { width: 0.022 * k });
  strap('noseband', arc(0.56, 0.56, -180, 180, 26), { width: 0.026 * k, rides: 'skin' });   // (round the jaw too: the skin)
  strap('throatlash', arc(0.07, 0.03, 105, 255, 12), { width: 0.016 * k, rides: 'skin' });   // (round the throat: it rides the skin)
  const bitF = B.sockets.bit + 0.04;
  // THE ANCHORS a rider meets (at the stand, world): the seat's lowest point on its centre line, the stirrup bars (the
  // leathers' tops), the bit's rings, the crest a hand before the withers
  {
    // (the seat's middle, between its twist and its cantle's rise: where the sit bones sit, the stirrup bar a hand and a
    // half before it, so the leathers hang plumb under a rider's heel; the back's own lowest point falls behind it)
    const s0 = -0.05, b = back(seatB + (seatF - seatB) * (s0 + 1) / 2, 0), seat = add(b.p, mul(b.n, 0.003 * k + padTop + 0.008 * k + 0.03 * k));
    const bars = {}, bits = {};
    for (const sd of [1, -1]) {
      const bar = back(yBar, sd * 28 * DEG), top = add(bar.p, mul(bar.n, padTop + 0.016 * k));
      bars[sd > 0 ? 'R' : 'L'] = add(top, [sd * 0.028 * k, 0, 0]);
      const r = headAt(bitF, sd * 125 * DEG); bits[sd > 0 ? 'R' : 'L'] = add(r.p, mul(r.n, 0.01 * k));
    }
    const { crestAt, crestUp } = neckCrest(B, S);
    out.anchors = { seat, bars, bits, crest: add(crestAt(0.14), mul(crestUp, 0.012 * k)) };
  }
  for (const sd of [1, -1]) {
    strap(`cheek${sd > 0 ? 'R' : 'L'}`, arc(0.05, bitF - 0.04, sd * 105, sd * 118, 12), { width: 0.022 * k });
    const s = headAt(bitF, sd * 125 * DEG);
    if (s) piece(`bitRing${sd > 0 ? 'R' : 'L'}`, ring(add(s.p, mul(s.n, 0.01 * k)), [1, 0, 0], 0.033 * k, 0.005 * k, TACK_COLOURS.steel), 'rigid:head');
  }
  // the reins: unridden, from the rings back along the neck's sides and over it at its base (a loop resting there)
  if (reins === 'neck') {
    // (over the crest a hand in front of the withers, the loop's bottom against the neck's sides)
    const { crestAt, crestUp } = neckCrest(B, S), crest = add(crestAt(0.14), mul(crestUp, 0.012 * k)), pts = [], nrm = [];
    for (const sd of [1, -1]) {
      const s = headAt(bitF, sd * 125 * DEG), a = add(s.p, mul(s.n, 0.035 * k)), side = surfaceOn(field, add(lerp(a, crest, 0.55), [sd * 0.6 * k, 0, -0.06 * k]), add(lerp(a, crest, 0.55), [0, 0, -0.06 * k]));
      const mid = side ? add(side.p, mul(side.n, 0.015 * k)) : lerp(a, crest, 0.55), top = add(crest, [sd * 0.035 * k, 0, 0]);
      // (through its mid point: a quadratic whose middle is `mid`)
      const ctl = sub(mul(mid, 2), mul(add(a, top), 0.5)), curve = Array.from({ length: 12 }, (_, i) => { const t = i / 11; return add(add(mul(a, (1 - t) ** 2), mul(ctl, 2 * t * (1 - t))), mul(top, t * t)); });
      if (sd > 0) pts.push(...curve); else pts.push(...curve.reverse());
    }
    for (let i = 0; i < pts.length; i++) nrm.push(unit(sub(pts[i], [0, pts[i][1], pts[i][2] - 0.3 * k])));
    piece('reins', ribbon(pts, nrm, { width: 0.018 * k, thick: 0.005 * k, colour: TACK_COLOURS.leather }), 'skin');
  }
  return out;
}

/** the body mesh's nearest vertex to a point (a grid of 4 cm cells), and how far */
function nearestOf(mesh) {
  const cell = 0.04, grid = new Map();
  mesh.vertices.forEach((v, i) => { const kk = v.map((x) => Math.floor(x / cell)).join(','); if (!grid.has(kk)) grid.set(kk, []); grid.get(kk).push(i); });
  return (p) => {
    const c = p.map((x) => Math.floor(x / cell));
    for (let r = 1; r <= 6; r++) {
      let best = -1, bd = Infinity;
      for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let d = -r; d <= r; d++) for (const i of grid.get(`${c[0] + a},${c[1] + b},${c[2] + d}`) ?? []) { const dd = len(sub(mesh.vertices[i], p)); if (dd < bd) { bd = dd; best = i; } }
      if (best >= 0) return { i: best, d: bd };
    }
    return { i: 0, d: Infinity };
  };
}

/**
 * Each tack vertex's skin: a piece riding a bone wholly on it; one riding the skin takes the weights of the body mesh's
 * nearest vertex (the pad and the girth move as the skin under them moves). → per piece, per vertex [[bone, w], …]
 */
export function tackSkin(pieces, mesh) {
  const near = nearestOf(mesh);
  return pieces.map((pc) => {
    const m = /^rigid:(.+)$/.exec(pc.rides), of = pc.vertices.map((v) => (m ? -1 : near(v).i));
    const ws = pc.vertices.map((v, j) => (m ? [[m[1], 1]] : mesh.weights[of[j]]));
    ws.near = of;                                                         // (the body vertex whose correctives it takes)
    return ws;
  });
}

/**
 * The tack's machine gate, against the body as it is rendered (`skinAt(pose)`: its vertices posed, LBS and the
 * correctives): each tack vertex within `reach` of the body at the stand keeps its height over its nearest body
 * vertex, measured along that vertex's normal carried into the pose; a piece through the skin there is `depth` under
 * it. `deltaAt(pose)` (with correctives: correctives.js bindDeltas) the bind-space offsets a skin-riding vertex takes
 * from its body vertex. Worst per piece, over the poses.
 */
export function tackGates(mesh, pieces, skins, poses, { rest, skinAt, deltaAt = null, tolerance = 0.006, reach = 0.05 } = {}) {
  const near = nearestOf(mesh), worst = Object.fromEntries(pieces.map((p) => [p.name, { depth: 0, at: null }]));
  const lbs = (v, ws, pose) => { let p = [0, 0, 0]; for (const [bone, w] of ws) { const r = rest[bone], q = pose[bone]; if (!r || !q) continue; const d = sub(v, r.h), l = [dot(d, r.R[0]), dot(d, r.R[1]), dot(d, r.R[2])]; p = add(p, mul(add(add(add(mul(q.R[0], l[0]), mul(q.R[1], l[1])), mul(q.R[2], l[2])), q.h), w)); } return p; };
  const turn = (n, ws, pose) => { let o = [0, 0, 0]; for (const [bone, w] of ws) { const r = rest[bone], q = pose[bone]; if (!r || !q) continue; const l = [dot(n, r.R[0]), dot(n, r.R[1]), dot(n, r.R[2])]; o = add(o, mul(add(add(mul(q.R[0], l[0]), mul(q.R[1], l[1])), mul(q.R[2], l[2])), w)); } return unit(o); };
  const tied = pieces.map((pc) => pc.vertices.map((v) => { const n = near(v); return n.d <= reach ? n.i : -1; }));
  for (const [pi, pose] of poses.entries()) {
    const body = skinAt(pose), dl = deltaAt ? deltaAt(pose) : null;
    pieces.forEach((pc, k) => pc.vertices.forEach((v, j) => {
      const i = tied[k][j];
      if (i < 0) return;
      const own = skins[k].near?.[j] ?? -1, bind = own >= 0 && dl?.has(own) ? add(v, dl.get(own)) : v;
      const h0 = dot(sub(v, mesh.vertices[i]), mesh.normals[i]), n = turn(mesh.normals[i], mesh.weights[i], pose), h = dot(sub(lbs(bind, skins[k][j], pose), body[i]), n);
      const depth = Math.min(0, h0) - h;                                 // (how far under the skin it went, past where it began)
      if (depth > worst[pc.name].depth) worst[pc.name] = { depth, at: pi };
    }));
  }
  const bad = Object.entries(worst).filter(([, w]) => w.depth > tolerance);
  return { checks: [{ name: 'proud', pass: !bad.length, saw: bad.length ? bad.map(([n, w]) => `${n} ${(w.depth * 1000).toFixed(0)} mm under (pose ${w.at})`).join(', ') : `every piece within ${tolerance * 1000} mm of the skin or proud of it`, want: `no tack more than ${tolerance * 1000} mm under the rendered skin` }], worst };
}
