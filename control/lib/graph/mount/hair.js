/**
 * hair — a mount's mane, forelock and tail as hair CARDS on guide strands, their swing computed into every clip.
 *
 * GUIDES: chains of points rooted on the body. The mane along the crest, falling to the off (right) side, longest at
 * mid-neck; the forelock between the ears, over the forehead; the tail around the dock (its top and sides, not its
 * underside), hanging to about the hocks. Each root rides its bone (the crest's neck bone, the head, a dock bone).
 *
 * THE SWING (secondary motion, Verlet at a fixed step): each point falls under gravity, damped; the strand keeps its
 * segments' lengths; each point is drawn, weakly and less toward the tip, toward where its rest hang would put it on
 * its bone (so it lags and follows through, and settles back); and it is kept out of the body by the body's own masses:
 * the point carried back into its mass's bone's rest frame, pushed out of that mass there (body.js's eggs and cones), and
 * carried forward again. Deterministic: a fixed step, fixed iterations; the bones' frames sampled and eased between.
 *
 * A CYCLE's hair is run to its steady state and its last period closed onto its first exactly (a loop an engine can
 * repeat); a one-shot's starts from its first frame's settled hang.
 *
 *   hairGuides(B) → [{ id, kind, bone, root, dir, side, len, n, width, cards }]
 *   simulateHair(B, frameAt, { t0, t1, fps, loop, settle }) → { times, strands: [[points] per guide] per sample, guides }
 *   hairCards(guides, strands, { color }) → { vertices, quads, colors, twoSided }
 */
import { bodyPrims, bodyField, neckCrest } from './body.js';
import { boneFrames } from './skin.js';
import { standPose } from './gait.js';
import { sdEgg, sdCone } from '../polygonizer/body-relational-field.js';
import { COATS } from './coats.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (len(a) || 1));
const G = 9.81;
/** the point at distance L from p along d, or, if that sinks below the floor, on the floor at distance L (the same heading) */
function onFloor(p, d, L, floor) {
  const q = add(p, mul(d, L));
  if (q[2] >= floor) return q;
  const dz = floor - p[2], hz = Math.sqrt(Math.max(0, L * L - dz * dz)), hl = Math.hypot(d[0], d[1]);
  const hx = hl > 1e-9 ? d[0] / hl : 0, hy = hl > 1e-9 ? d[1] / hl : 1;
  return [p[0] + hx * hz, p[1] + hy * hz, floor];
}

/** the hair's feel (≈): its points per strand, its damping per step, its pull toward the rest hang at the root (falling
 * to nothing at the tip), the margin it keeps off the skin, the step; the tail heavier and more damped than the mane */
export const HAIR = Object.freeze({ points: 8, damping: { mane: 0.985, forelock: 0.985, tail: 0.97 }, follow: { mane: 0.08, forelock: 0.06, tail: 0.06 },
  bend: { mane: 40, forelock: 30, tail: 30 }, margin: 0.006, hz: 240 });

/** a bone's transform: a point (or a direction) from the stand into the pose, and back */
const toPose = (r, p, q, isDir = false) => {
  const v = isDir ? q : sub(q, r.h), l = [dot(v, r.R[0]), dot(v, r.R[1]), dot(v, r.R[2])];
  const w = add(add(mul(p.R[0], l[0]), mul(p.R[1], l[1])), mul(p.R[2], l[2]));
  return isDir ? w : add(w, p.h);
};
const toRest = (r, p, q, isDir = false) => toPose(p, r, q, isDir);

export function hairGuides(B) {
  const S = standPose(B), bn = S.bones, k = B.scale, out = [];
  const { crestAt, crestUp, neckBone } = neckCrest(B, S);
  // THE MANE: along the crest, falling to the off side and down, longest at mid-neck
  const NM = 16;
  for (let i = 0; i < NM; i++) {
    const t = 0.04 + 0.94 * i / (NM - 1), tan = unit(sub(crestAt(Math.min(1, t + 0.01)), crestAt(Math.max(0, t - 0.01))));
    // (rooted just to the off side of the crest's ridge, falling down the neck's side: a mane lies, it does not stand)
    out.push({ id: `mane${i}`, kind: 'mane', bone: neckBone(t), root: add(crestAt(t), [0.02 * k, 0, 0]), outward: unit(add(crestUp, [0.35, 0, 0])), dir: unit([0.42, 0, -0.91]),
      side: tan, len: (0.16 + 0.11 * Math.sin(Math.PI * t)) * k, width: 0.045 * k, cards: [-0.35, 0.35] });
  }
  // THE FORELOCK: between the ears, over the forehead
  const hd = bn.head, hdir = unit(sub(hd.tail, hd.head)), face = unit(cross([1, 0, 0], hdir)), hh = len(sub(hd.tail, hd.head)) / 0.6;
  for (const sx of [-0.012, 0, 0.012]) {
    out.push({ id: `forelock${sx}`, kind: 'forelock', bone: 'head', root: add(add(hd.head, mul(face, 0.03 * hh)), [sx * hh, 0, 0]), outward: face, dir: unit(add(mul(hdir, 0.95), mul(face, 0.05))),
      side: [1, 0, 0], len: 0.17 * hh, width: 0.04 * hh, cards: [0] });
  }
  // THE TAIL: a bundle round the dock's top and sides, to about the hocks, the outer hairs shorter (lengths seeded)
  const hock = bn.tibiaR.tail[2];
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (const b of ['tail0', 'tail1', 'tail2', 'tail3']) {
    // (the dock's top: d runs back and down, so its top faces back and up, cross(d, x); cross(x, d) is its underside)
    const t = bn[b], d = unit(sub(t.tail, t.head)), up = unit(cross(d, [1, 0, 0])), sideAx = [1, 0, 0];
    for (const a of [-90, -60, -30, 0, 30, 60, 90]) {
      const th = a * Math.PI / 180, out_ = unit(add(mul(up, Math.cos(th)), mul(sideAx, Math.sin(th))));   // round the dock's top
      const root = add(add(t.head, mul(sub(t.tail, t.head), 0.5)), mul(out_, 0.045 * k));
      const full = Math.max(0.3, root[2] - hock * 0.85), short = 1 - 0.18 * Math.abs(a) / 90 - 0.12 * rnd();
      // (no strand long enough to sweep the ground: its tip a third of a metre clear at rest)
      out.push({ id: `tail${b}${a}`, kind: 'tail', bone: b, root, outward: out_, dir: unit(add(d, mul(out_, 0.22))), side: unit(cross(d, out_)),
        len: Math.min(full * short, root[2] - 0.35 * k), width: 0.05 * k, cards: [-0.3, 0.3], taper: 0.8 });
    }
  }
  // each root ON the skin: along its outward direction to the surface where it crosses near (bisection), else down the
  // field's gradient (Newton's projection) from wherever it stands, inside or out
  const { field } = bodyField(B);
  const grad = (p) => { const e = 1e-4, f0 = field(p); return [(field(add(p, [e, 0, 0])) - f0) / e, (field(add(p, [0, e, 0])) - f0) / e, (field(add(p, [0, 0, e])) - f0) / e]; };
  for (const g of out) {
    g.n = HAIR.points;
    let lo = -0.12 * k, hi = 0.12 * k;
    const at = (x) => add(g.root, mul(g.outward, x));
    if (field(at(lo)) < 0 && field(at(hi)) > 0) { for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (field(at(m)) < 0) lo = m; else hi = m; } g.root = at(hi); }
    for (let i = 0; i < 40 && Math.abs(field(g.root)) > 1e-5; i++) { const f = field(g.root), gr = grad(g.root), g2 = dot(gr, gr) || 1; g.root = sub(g.root, mul(gr, f / g2)); }
  }
  return out;
}

/** the colliders: the body's masses near the hair (the neck, head, trunk and hindquarters), each with its bone */
function colliders(B) {
  const { prims } = bodyPrims(B);
  return prims.filter((q) => q.group !== 'eye' && q.group !== 'ear' && !/^(radius|cannon|pastern|hoof)/.test(q.bone));
}
function primD(q, p) { return q.kind === 'egg' ? sdEgg(p, q) : sdCone(p, q.a, q.b, q.r1, q.r2); }

/**
 * Run the hair through frames: `frameAt(t)` a pose frame (bones, legs, body); from t0 to t1, sampled at `fps`. `loop`
 * (a cycle): run `warm` periods first and close the recorded one onto itself. `settle`: seconds held at the first
 * frame before (a one-shot's start).
 */
export function simulateHair(B, frameAt, { t0 = 0, t1 = 1, fps = 60, loop = false, warm = 5, settle = 1.5 } = {}) {
  const guides = hairGuides(B), rest = boneFrames(B, standPose(B)), cols = colliders(B);
  const k = B.scale, period = t1 - t0, floorZ = 0.01 * k;
  // the samples: nS spans over the period, each stepped in equal substeps near the hair's rate
  const nS = Math.max(2, Math.round(period * fps)), times = Array.from({ length: nS + 1 }, (_, i) => t0 + period * i / nS);
  const sub_ = Math.max(1, Math.ceil(HAIR.hz * period / nS)), h = period / nS / sub_;
  const cache = new Map();
  const framesAt = (t) => {
    const key = Math.round(t * 1e6);
    if (!cache.has(key)) cache.set(key, boneFrames(B, frameAt(t)));
    return cache.get(key);
  };
  // the bones' frames between two samples, eased (positions and axes; the axes made square again)
  const between = (A, Bf, w) => {
    const out = {};
    for (const id of Object.keys(A)) {
      const a = A[id], b = Bf[id];
      const d = unit(add(mul(a.R[0], 1 - w), mul(b.R[0], w))), s0 = add(mul(a.R[1], 1 - w), mul(b.R[1], w)), sq = unit(sub(s0, mul(d, dot(s0, d))));
      out[id] = { h: add(mul(a.h, 1 - w), mul(b.h, w)), R: [d, sq, cross(d, sq)] };
    }
    return out;
  };
  // each guide's colliders: the masses within its reach at the stand
  const near = guides.map((g) => cols.filter((q) => len(sub(q.c, g.root)) - q.R < g.len + 0.05));
  // each guide's own field: its near masses alone, blended as the body's (a tenth of the masses to evaluate)
  const fields = near.map((nq) => { const ids = new Set(nq.map((q) => `${q.bone}|${q.c.join(',')}`)); return bodyField(B, { only: (q) => ids.has(`${q.bone}|${q.c.join(',')}`) }).field; });
  const seg = guides.map((g) => g.len / (g.n - 1));
  const P = guides.map((g, gi) => Array.from({ length: g.n }, (_, i) => add(g.root, mul(g.dir, seg[gi] * i))));
  const Q = P.map((st) => st.map((p) => p.slice()));
  const restHang = P.map((st) => st.map((p) => p.slice()));
  const step = (F, followOn = true) => {
    for (let gi = 0; gi < guides.length; gi++) {
      const g = guides[gi], r = rest[g.bone], f = F[g.bone], st = P[gi], o = Q[gi], hang = restHang[gi];
      const kf = HAIR.follow[g.kind];
      st[0] = toPose(r, f, g.root); o[0] = st[0].slice();
      for (let i = 1; i < g.n; i++) {
        const v = mul(sub(st[i], o[i]), HAIR.damping[g.kind]);
        o[i] = st[i];
        let p = add(add(st[i], v), [0, 0, -G * h * h]);
        if (followOn) { const tgt = toPose(r, f, hang[i]), w = kf * (1 - i / g.n) ** 2; p = add(p, mul(sub(tgt, p), w)); }
        st[i] = p;
      }
      // the segments' lengths (fixed iterations, the root pinned)
      // and their bend: a lock is a bundle, stiff enough that no joint turns past HAIR.bend (points two apart kept at
      // least 2·seg·cos(bend/2) apart; the root and its first point stay where the dock holds them)
      const dMin = 2 * seg[gi] * Math.cos(HAIR.bend[g.kind] * Math.PI / 360);
      for (let it = 0; it < 4; it++) {
        for (let i = 1; i < g.n; i++) {
          const d = sub(st[i], st[i - 1]), L = len(d) || 1e-9, c = mul(d, (L - seg[gi]) / L);
          if (i === 1) st[i] = sub(st[i], c); else { st[i] = sub(st[i], mul(c, 0.5)); st[i - 1] = add(st[i - 1], mul(c, 0.5)); }
        }
        for (let i = 2; i < g.n; i++) {
          const d = sub(st[i], st[i - 2]), L = len(d) || 1e-9;
          if (L >= dMin) continue;
          const c = mul(d, (dMin - L) / L);
          if (i === 2) st[i] = add(st[i], c); else { st[i] = add(st[i], mul(c, 0.5)); st[i - 2] = sub(st[i - 2], mul(c, 0.5)); }
        }
      }
      // out of the SKIN (the blended field, which lies outside its masses): each point into the rest frame of the bone
      // of the mass nearest it, the field's depth there, pushed out along its gradient, carried back
      for (let i = 1; i < g.n; i++) {
        let best = null, bd = Infinity, bpr = null;
        for (const q of near[gi]) {
          const rb = rest[q.bone], fb = F[q.bone];
          if (!rb || !fb) continue;
          const pr = toRest(rb, fb, st[i]), dq = len(sub(pr, q.c)) - q.R;
          if (dq < bd) { bd = dq; best = q; bpr = pr; }
        }
        if (!best || bd > 0.05 * k) continue;                                     // the skin lies within a few cm of its masses
        const field = fields[gi], d = field(bpr);
        if (d >= HAIR.margin * k) continue;
        const e = 1e-3, gr = unit([field(add(bpr, [e, 0, 0])) - d, field(add(bpr, [0, e, 0])) - d, field(add(bpr, [0, 0, e])) - d]);
        st[i] = add(st[i], toPose(rest[best.bone], F[best.bone], mul(gr, HAIR.margin * k - d), true));
      }
      // above the ground (last: nothing after it pushes a point down)
      for (let i = 1; i < g.n; i++) if (st[i][2] < floorZ) st[i] = [st[i][0], st[i][1], floorZ];
    }
  };
  const snap = () => P.map((st) => st.map((p) => p.slice()));
  // the rest hang: settled at the stand (no follow), kept as what the follow pulls toward
  for (let i = 0; i < Math.round(1.5 * HAIR.hz); i++) step(rest, false);
  for (let gi = 0; gi < guides.length; gi++) for (let i = 0; i < guides[gi].n; i++) restHang[gi][i] = P[gi][i].slice();
  // a one-shot settles at its first frame; a cycle runs its warm periods
  if (!loop) { const F0 = framesAt(t0); for (let i = 0; i < Math.round(settle * HAIR.hz); i++) step(F0); }
  const period_ = () => {
    const out = [snap()];
    for (let si = 0; si < nS; si++) {
      const A = framesAt(times[si]), Bf = framesAt(times[si + 1]);
      for (let j = 0; j < sub_; j++) step(between(A, Bf, (j + 1) / sub_));
      out.push(snap());
    }
    return out;
  };
  if (loop) for (let w = 0; w < warm; w++) period_();
  let strands = period_(), closure = 0, closureBy = {};
  if (loop) {
    // close the loop: the recorded period's end drawn onto its start, the correction growing linearly through it
    const first = strands[0], last = strands[strands.length - 1];
    closure = Math.max(...first.flatMap((st, gi) => st.map((p, i) => len(sub(p, last[gi][i])))));
    closureBy = Object.fromEntries(['mane', 'forelock', 'tail'].map((kd) => [kd, Math.max(0, ...first.flatMap((st, gi) => (guides[gi].kind === kd ? st.map((p, i) => len(sub(p, last[gi][i]))) : [])))]));
    strands = strands.map((S2, si) => { const w = si / (strands.length - 1); return S2.map((st, gi) => st.map((p, i) => add(p, mul(sub(first[gi][i], last[gi][i]), w)))); });
    // then each segment's length again, walking out from the root (only the directions the correction bent are kept)
    // and kept above the ground: a point the walk would sink is laid on the floor at the same distance
    strands = strands.map((S2) => S2.map((st, gi) => { const o = [st[0]]; for (let i = 1; i < st.length; i++) o.push(onFloor(o[i - 1], unit(sub(st[i], o[i - 1])), seg[gi], floorZ)); return o; }));
  }
  return { times, strands, guides, closure: loop ? closure : 0, closureBy };
}

/** the cards: ribbons along each strand (a guide's cards side by side across it), tapering to the tip, two-sided */
export function hairCards(guides, strands, { coat = 'bay' } = {}) {
  const C = typeof coat === 'string' ? COATS[coat] : coat, vertices = [], quads = [], colors = [], twoSided = [], at = [];
  const shade = (hex, f) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join('');
  guides.forEach((g, gi) => {
    const s = strands[gi];
    for (const off of g.cards) {
      const base = vertices.length;
      for (let i = 0; i < g.n; i++) {
        const along = unit(sub(s[Math.min(g.n - 1, i + 1)], s[Math.max(0, i - 1)]));
        // the card's width across the strand, square to it, along the guide's side
        const sd = unit(sub(g.side, mul(along, dot(g.side, along)))), w = g.width * (1 - (g.taper ?? 0.65) * i / (g.n - 1));
        const c = add(s[i], mul(sd, off * g.width));
        vertices.push(add(c, mul(sd, -w / 2)), add(c, mul(sd, w / 2)));
        at.push([gi, i], [gi, i]);                                                 // (each vertex's guide and point: a skin's)
      }
      for (let i = 0; i + 1 < g.n; i++) {
        quads.push([base + 2 * i, base + 2 * i + 1, base + 2 * i + 3, base + 2 * i + 2]);
        colors.push(shade(C.mane, off < 0 ? 0.85 : 1)); twoSided.push(true);
      }
    }
  });
  return { vertices, quads, colors, twoSided, at };
}
