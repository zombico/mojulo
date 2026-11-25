/**
 * THE ASSAULT FRAME'S BODY — a build (parts.js, assemble.js) drawn as the frame it is: a core over biped legs, a head on
 * it, two arms holding their guns forward, a booster on its back and a weapon on each shoulder mount beside it. Realistic
 * military, a hundred and fifty years on, built for space: layered armour plate with chamfered edges over a dark
 * structural frame, the actuators bare and polished (rods, rams, joint drums and collars), cable runs in their dark seal,
 * intakes and vents, bolts, optics that glow, stencils; the booster's bells chrome, their mouths lit. Its class sets its
 * proportions (a light part lean, a heavy one broad); each part's look follows its row's `about`.
 *
 *   frameBody(build, { palette?, wear? })  → { bones, faces, mounts, thrusters, height, hips, footprint, rig, build }
 *     bones      [{ id, head }]: each joint's pivot in the rest frame, absolute (never a hierarchy): root (the pelvis),
 *                core, head (none on a headless core: a forward fuselage carries its cockpit and optics), booster, armUpR, armLowR (forearm, hand and the gun it holds), armUpL, armLowL, backR, backL
 *                (a shoulder weapon's, only where one is carried), thighR, shinR, footR, thighL, shinL, footL
 *     faces      Map bone id → [{ corners, material, albedo, fill, outNormal, cornerNormals? }]: every face on one bone;
 *                material a slot of FRAME_SLOTS, albedo its colour unlit, fill the same under a plain key (a page that
 *                does not light)
 *     mounts     { armR?, armL?, backR?, backL? } each { bone, at, dir }: a carried weapon's muzzle, at rest
 *     thrusters  [{ bone, at, dir, half, kind }]: the booster's bells (`main`, back and a little down) and the verniers on
 *                the shins, the shoulders and the back (`vernier`); `at` the mouth, `dir` the way the exhaust leaves,
 *                `half` the mouth's half-extent on each axis
 *     height     the top of the frame over its soles (m); hips the root's height (the legs' `height`)
 *     footprint  { L, W, H }: what the standing frame takes up (+y its front)
 *     rig        what the clips read (clips.js): each bone's parent, the legs' joint ('biped' | 'reverse', its knee bent
 *                forward or back: `bend` 1 | −1), their lengths and the rest pose's hip, knee and ankle
 *   FRAME_SLOTS        the material slots: paint (the satin military paint), chrome (polished metal), gunmetal (the
 *                      structure's dark metal), seal (rubber, cables, boots), lens (sensor glass), glow (lit), stencil
 *   FRAME_PALETTES     federation (default: cold blue-grey over chrome), mars (rust red, sand), ash (dark grey, hazard
 *                      yellow), vermilion (an ace's: lacquered red over black, gold trim); each role's colour
 *   FRAME_WEARS        factory | used (default) | battered: edges rubbed bright, a grime, soot round the bells
 *
 * Frame space: metres, +y forward, +x right, +z up, the soles on z = 0 at rest, centred on x = y = 0. Pure and
 * deterministic: the same build, the same body (its wear's dice seeded from the build).
 */
import { readBuild } from './assemble.js';
import { partOf, WEAPON_SLOTS } from './parts.js';
import { mulberry32, strHash } from '../city/plan/dice.js';

const f = Object.freeze;
const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const DEG = Math.PI / 180;

export const FRAME_SLOTS = f(['paint', 'chrome', 'gunmetal', 'seal', 'lens', 'glow', 'stencil']);
// (a role is a colour; its slot is how it takes the light: the paint's three tones are one satin paint)
const ROLE_SLOT = f({ paint: 'paint', paint2: 'paint', trim: 'paint', chrome: 'chrome', gunmetal: 'gunmetal', dark: 'gunmetal', seal: 'seal', lens: 'lens', glow: 'glow', stencil: 'stencil' });

export const FRAME_PALETTES = f({
  // the federation's: a cold blue-grey over polished chrome, its second plate a shade down, white bands and stencils
  federation: f({ paint: '#74818d', paint2: '#4d5864', trim: '#d9dde0', chrome: '#e3e7ec', gunmetal: '#4a5058', dark: '#22262b', seal: '#17191b', lens: '#0c1820', glow: '#7fe6ff', stencil: '#f1f3f4', exhaust: '#9fd8ff' }),
  // a Mars garrison's: rust red over warm chrome, its trim the desert's sand
  mars: f({ paint: '#9b4a2d', paint2: '#6a3522', trim: '#d6b489', chrome: '#e6ddd1', gunmetal: '#4d423b', dark: '#241d19', seal: '#1c1716', lens: '#1c110c', glow: '#ffb24a', stencil: '#efe4d4', exhaust: '#ffbf78' }),
  // ash: dark grey, hazard yellow bands, red optics
  // vermilion: an ace's own, a deep lacquered red over black plate, gold trim, white-hot optics
  vermilion: f({ paint: '#9e1b1e', paint2: '#1c1a1d', trim: '#d4a64a', chrome: '#e8e2da', gunmetal: '#2b2a2e', dark: '#121113', seal: '#0e0d0e', lens: '#1a0606', glow: '#fff2e0', stencil: '#f3e3c4', exhaust: '#ff9a6a' }),
  ash: f({ paint: '#4b4e53', paint2: '#33363a', trim: '#e2b021', chrome: '#d7dbdf', gunmetal: '#3c3f44', dark: '#17181a', seal: '#131415', lens: '#160b0b', glow: '#ff4b3a', stencil: '#ecebe6', exhaust: '#ffa36b' }),
});
export const FRAME_WEARS = f(['factory', 'used', 'battered']);
const WEAR = f({ factory: f({ edge: 0, grime: 0, soot: 0 }), used: f({ edge: 0.12, grime: 0.07, soot: 0.25 }), battered: f({ edge: 0.26, grime: 0.18, soot: 0.5 }) });

// ── vectors and transforms ─────────────────────────────────────────────────────────────────────────────────────────
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const V3 = f({ add, sub, mul, dot, cross, len, unit, lerp });

const I3 = f([1, 0, 0, 0, 1, 0, 0, 0, 1]);
const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const mm = (a, b) => { const o = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; return o; };
const rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const mtv = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
const cols = (ex, ey, ez) => [ex[0], ey[0], ez[0], ex[1], ey[1], ez[1], ex[2], ey[2], ez[2]];
const MIRROR = f([-1, 0, 0, 0, 1, 0, 0, 0, 1]);
const T0 = f({ m: I3, t: [0, 0, 0] });
const tx = (T, p) => add(T.t, mv(T.m, p));
const compose = (A, B) => ({ m: mm(A.m, B.m), t: add(A.t, mv(A.m, B.t)) });
/** A place: a point and a turn (a 3×3, row-major) about it. */
const at = (p, m = I3) => ({ m, t: p });
export const M3 = f({ mv, mm, rx, ry, rz, cols });

/** A limb's own frame: its origin the near joint, its −z down the limb to the far joint, its +y toward `hint`. */
function segFrame(p0, p1, hint = [0, 1, 0]) {
  const ez = unit(sub(p0, p1)), ey = unit(sub(hint, mul(ez, dot(hint, ez)))), ex = cross(ey, ez);
  return at(p0, cols(ex, ey, ez));
}

const newell = (C) => {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < C.length; i++) { const a = C[i], b = C[(i + 1) % C.length]; x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]); }
  return [x, y, z];
};
const centroid = (C) => mul(C.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / C.length);

// ── the primitives: each → { faces: [{ c, r, out?, n?, edge? }], center } in its own space ─────────────────────────
// (a face wound to turn away from its solid's centre, or toward `out` where the solid is not convex: a bell's inside)

/** A box, centre `c`, size `s`, every edge chamfered by `ch` (an armour plate's bevel); `taper` the top's scale on x and
 *  y (the box's +z end), `shear` the top's shift. */
function cbox(c, s, r, { ch = 0, taper = null, shear = null } = {}) {
  const h = [s[0] / 2, s[1] / 2, s[2] / 2], k = Math.min(ch, h[0] * 0.45, h[1] * 0.45, h[2] * 0.45);
  const warp = (p) => {
    const t = (p[2] + h[2]) / (2 * h[2]);
    const sx = taper ? 1 + (taper[0] - 1) * t : 1, sy = taper ? 1 + (taper[1] - 1) * t : 1;
    return [c[0] + p[0] * sx + (shear ? shear[0] * t : 0), c[1] + p[1] * sy + (shear ? shear[1] * t : 0), c[2] + p[2]];
  };
  const faces = [];
  if (k <= 1e-6) {
    const P = (x, y, z) => warp([x * h[0], y * h[1], z * h[2]]);
    const sq = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const sg of [-1, 1]) {
      faces.push({ c: sq.map(([u, v]) => P(sg, u, v)), r }, { c: sq.map(([u, v]) => P(u, sg, v)), r }, { c: sq.map(([u, v]) => P(u, v, sg)), r });
    }
    return { faces, center: warp([0, 0, 0]) };
  }
  // (a corner's three points: on each axis's face, the other two drawn in by the chamfer)
  const P = (sg, w) => warp([0, 1, 2].map((a) => sg[a] * (a === w ? h[a] : h[a] - k)));
  const SQ = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let w = 0; w < 3; w++) {
    const u = (w + 1) % 3, v = (w + 2) % 3;
    for (const s0 of [-1, 1]) faces.push({ c: SQ.map(([a, b]) => { const sg = []; sg[w] = s0; sg[u] = a; sg[v] = b; return P(sg, w); }), r });
    // (the bevel between this axis's faces and the next's, along the third)
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
      const g = (s3) => { const sg = []; sg[w] = s1; sg[u] = s2; sg[v] = s3; return sg; };
      faces.push({ c: [P(g(-1), w), P(g(-1), u), P(g(1), u), P(g(1), w)], r, edge: true });
    }
  }
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const d of [-1, 1]) faces.push({ c: [P([a, b, d], 0), P([a, b, d], 1), P([a, b, d], 2)], r, edge: true });
  return { faces, center: warp([0, 0, 0]) };
}

const axes = (d) => { const any = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], u = unit(cross(d, any)); return [u, cross(d, u)]; };

/** A frustum from p0 (radius r0) to p1 (r1), n sides, its sides drawn smooth (a rod, a drum, a barrel). */
function cyl(p0, p1, r0, r1, r, { n = 10, caps = [true, true], smooth = true, phase = 0 } = {}) {
  const d = unit(sub(p1, p0)), L = len(sub(p1, p0)), [u, v] = axes(d), faces = [];
  const ring = (p, rr) => Array.from({ length: n }, (_, i) => { const a = phase + (2 * Math.PI * i) / n; return add(p, add(mul(u, Math.cos(a) * rr), mul(v, Math.sin(a) * rr))); });
  const nrm = (i) => { const a = phase + (2 * Math.PI * i) / n; return unit(add(add(mul(u, Math.cos(a)), mul(v, Math.sin(a))), mul(d, (r0 - r1) / (L || 1)))); };
  const A = ring(p0, r0), B = ring(p1, r1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push({ c: [A[i], A[j], B[j], B[i]], r, ...(smooth ? { n: [nrm(i), nrm(j), nrm(j), nrm(i)] } : {}) });
  }
  if (caps[0]) faces.push({ c: A.slice(), r, out: mul(d, -1), edge: true });
  if (caps[1]) faces.push({ c: B.slice(), r, out: d, edge: true });
  return { faces, center: lerp(p0, p1, 0.5) };
}

/** A rocket's bell from its throat at p0 (radius rt) to its mouth at p1 (rm): its chrome skin flaring in two bands, its
 *  lip, its dark inside, and its lit throat seen down the mouth. */
function bell(p0, p1, rt, rm, { n = 12, glow = true } = {}) {
  const d = unit(sub(p1, p0)), [u, v] = axes(d), faces = [];
  const ring = (p, rr) => Array.from({ length: n }, (_, i) => { const a = (2 * Math.PI * i) / n; return add(p, add(mul(u, Math.cos(a) * rr), mul(v, Math.sin(a) * rr))); });
  const rad = (i) => { const a = (2 * Math.PI * (i + 0.5)) / n; return add(mul(u, Math.cos(a)), mul(v, Math.sin(a))); };
  const pm = lerp(p0, p1, 0.55), rmid = rt + (rm - rt) * 0.38, lip = rm * 0.86;
  const R0 = ring(p0, rt), R1 = ring(pm, rmid), R2 = ring(p1, rm), Ri = ring(p1, lip), Rd = ring(lerp(p0, p1, 0.35), rt * 0.85);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, o = rad(i);
    faces.push({ c: [R0[i], R0[j], R1[j], R1[i]], r: 'chrome', out: o, n: [unit(rad(i - 0.5)), unit(rad(j - 0.5)), unit(rad(j - 0.5)), unit(rad(i - 0.5))] });
    faces.push({ c: [R1[i], R1[j], R2[j], R2[i]], r: 'chrome', out: o, n: [unit(rad(i - 0.5)), unit(rad(j - 0.5)), unit(rad(j - 0.5)), unit(rad(i - 0.5))] });
    faces.push({ c: [R2[i], R2[j], Ri[j], Ri[i]], r: 'gunmetal', out: d, edge: true });
    faces.push({ c: [Ri[i], Ri[j], Rd[j], Rd[i]], r: 'dark', out: mul(o, -1) });
  }
  faces.push({ c: R0.slice(), r: 'gunmetal', out: mul(d, -1) });
  if (glow) faces.push({ c: Rd.slice(), r: 'glow', out: d });
  return { faces, center: lerp(p0, p1, 0.5) };
}

/** A dome of `rings` bands over a ring of n sides at z0, rx by ry, h high (a head's armoured crown). */
function dome(c, rxr, ryr, h, r, { n = 10, rings = 3, floor = 0.25 } = {}) {
  const R = Array.from({ length: rings + 1 }, (_, k) => {
    const t = (k / rings) * (Math.PI / 2), s = Math.max(floor, Math.cos(t));
    return Array.from({ length: n }, (_, i) => { const a = Math.PI / n + (2 * Math.PI * i) / n; return [c[0] + rxr * s * Math.cos(a), c[1] + ryr * s * Math.sin(a), c[2] + h * Math.sin(t)]; });
  });
  const faces = [];
  for (let k = 0; k < rings; k++) for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push({ c: [R[k][i], R[k][j], R[k + 1][j], R[k + 1][i]], r, ...(k === rings - 1 ? { edge: true } : {}) }); }
  faces.push({ c: R[rings].slice(), r }, { c: R[0].slice(), r });
  return { faces, center: [c[0], c[1], c[2] + h * 0.35] };
}

// a seven-segment digit's strokes in its cell (0..1 across, 0..2 up): which are lit, by digit
const SEG = f({ a: [0, 2, 1, 2], b: [1, 1, 1, 2], c: [1, 0, 1, 1], d: [0, 0, 1, 0], e: [0, 0, 0, 1], f: [0, 1, 0, 2], g: [0, 1, 1, 1] });
const DIGIT = f({ 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g' });

// ── the kit: faces gathered by bone, each primitive placed by the transform in hand ─────────────────────────────────
function makeKit() {
  const byBone = new Map(), stack = [];
  let bone = null, T = T0, prim = 0;
  const K = {
    byBone,
    bone(id) { bone = id; if (!byBone.has(id)) byBone.set(id, []); return K; },
    /** Draw `fn` in a place (a transform composed onto the one in hand). */
    in(Tl, fn) { stack.push(T); T = compose(T, Tl); try { fn(); } finally { T = stack.pop(); } },
    put({ faces, center }) {
      const c = tx(T, center), list = byBone.get(bone), id = prim++;
      for (const fc of faces) {
        let cs = fc.c.map((p) => tx(T, p)), n = newell(cs), cn = fc.n ? fc.n.map((v) => mv(T.m, v)) : null;
        const want = fc.out ? mv(T.m, fc.out) : sub(centroid(cs), c);
        if (dot(n, want) < 0) { cs = cs.reverse(); n = mul(n, -1); if (cn) cn = cn.reverse(); }
        const L = len(n);
        if (L < 1e-9) continue;
        list.push({ corners: cs, role: fc.r, outNormal: mul(n, 1 / L), prim: id, ...(cn ? { cn } : {}), ...(fc.edge ? { edge: true } : {}) });
      }
    },
    box(c, s, r, o) { K.put(cbox(c, s, r, o)); },
    cyl(p0, p1, r0, r1, r, o) { K.put(cyl(p0, p1, r0, r1, r, o)); },
    bell(p0, p1, rt, rm, o) { K.put(bell(p0, p1, rt, rm, o)); },
    dome(c, a, b, h, r, o) { K.put(dome(c, a, b, h, r, o)); },
    /** A hydraulic ram from p0 to p1: its barrel dark, a chrome gland at its end, its polished rod out of it. */
    ram(p0, p1, rb, { split = 0.52, n = 8 } = {}) {
      const m = lerp(p0, p1, split), d = unit(sub(p1, p0));
      K.cyl(p0, m, rb, rb, 'gunmetal', { n, smooth: true });
      K.cyl(sub(m, mul(d, rb * 0.5)), add(m, mul(d, rb * 0.25)), rb * 1.18, rb * 1.18, 'chrome', { n, smooth: false });
      K.cyl(m, p1, rb * 0.5, rb * 0.5, 'chrome', { n, caps: [false, true] });
    },
    /** A cable run through its points, in its seal. */
    cable(pts, rr = 0.045) { for (let i = 0; i + 1 < pts.length; i++) K.cyl(pts[i], pts[i + 1], rr, rr, 'seal', { n: 6, caps: [false, false] }); },
    /** A joint's drum across x at `p`: its axle chrome, two collars. */
    drum(p, r, w, role = 'chrome') {
      K.cyl(add(p, [-w / 2, 0, 0]), add(p, [w / 2, 0, 0]), r, r, role, { n: 12 });
      K.cyl(add(p, [-w / 2 - 0.035, 0, 0]), add(p, [-w / 2 + 0.035, 0, 0]), r * 1.12, r * 1.12, 'gunmetal', { n: 12, smooth: false });
      K.cyl(add(p, [w / 2 - 0.035, 0, 0]), add(p, [w / 2 + 0.035, 0, 0]), r * 1.12, r * 1.12, 'gunmetal', { n: 12, smooth: false });
    },
    /** Draw on a box's face (its centre `c`, size `s`, `side` '+x' | '-x' | '+y' | '-y' | '+z' | '-z'): u to the
     *  right of one who faces it, v up it, w out of it. */
    on(c, s, side, fn) {
      const ax = { x: 0, y: 1, z: 2 }[side[1]], sg = side[0] === '+' ? 1 : -1;
      const o = c.slice(); o[ax] += sg * s[ax] / 2;
      const w = [0, 0, 0]; w[ax] = sg;
      const vup = ax === 2 ? [0, sg, 0] : [0, 0, 1], u = cross(vup, w);
      K.in(at(o, cols(u, vup, w)), fn);
    },
    /** A flat mark lifted a little off the face it is drawn on (in an `on`'s plane). */
    rect(u0, v0, u1, v1, r, lift = 0.012) { K.put({ faces: [{ c: [[u0, v0, lift], [u1, v0, lift], [u1, v1, lift], [u0, v1, lift]], r, out: [0, 0, 1] }], center: [0, 0, 0] }); },
    /** A raised panel on the face: a thin plate, its edges chamfered (an inset's seam reads round it). */
    panel(u0, v0, u1, v1, r, t = 0.05) { K.box([(u0 + u1) / 2, (v0 + v1) / 2, t / 2], [Math.abs(u1 - u0), Math.abs(v1 - v0), t], r, { ch: t * 0.6 }); },
    /** A panel line: a dark seam drawn across the face. */
    seam(u0, v0, u1, v1, w = 0.02) {
      const d = [u1 - u0, v1 - v0], l = Math.hypot(d[0], d[1]) || 1, n = [(-d[1] / l) * w / 2, (d[0] / l) * w / 2], z = 0.008;
      K.put({ faces: [{ c: [[u0 - n[0], v0 - n[1], z], [u1 - n[0], v1 - n[1], z], [u1 + n[0], v1 + n[1], z], [u0 + n[0], v0 + n[1], z]], r: 'dark', out: [0, 0, 1] }], center: [0, 0, 0] });
    },
    /** A polished strip along a plate's edge (u0..u1 at height v), proud of the face. */
    edge(u0, u1, v, h = 0.05, t = 0.03) { K.box([(u0 + u1) / 2, v, t / 2], [Math.abs(u1 - u0), h, t], 'chrome', { ch: t * 0.45 }); },
    bolt(u, v, rr = 0.035) { K.cyl([u, v, 0], [u, v, rr * 0.8], rr, rr * 0.85, 'chrome', { n: 6, caps: [false, true], smooth: false }); },
    /** A number stencilled in seven-segment strokes, its glyphs `h` high, centred on (u, v). */
    digits(str, u, v, h, r = 'stencil') {
      // (in a mirrored place a number would read backwards: drawn mirrored about its own middle, it reads true)
      const m = T.m, det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
      if (det < 0) { stack.push(T); T = compose(T, { m: MIRROR, t: [2 * u, 0, 0] }); try { K.digitsTrue(str, u, v, h, r); } finally { T = stack.pop(); } return; }
      K.digitsTrue(str, u, v, h, r);
    },
    digitsTrue(str, u, v, h, r) {
      const w = h * 0.5, t = h * 0.12, gap = h * 0.25, W = str.length * w + (str.length - 1) * gap;
      [...str].forEach((ch, i) => {
        const x0 = u - W / 2 + i * (w + gap), y0 = v - h / 2;
        for (const s of DIGIT[ch] ?? '') {
          const [a, b, cc, d] = SEG[s];
          K.rect(x0 + a * w - t / 2, y0 + b * (h / 2) - t / 2, x0 + cc * w + t / 2, y0 + d * (h / 2) + t / 2, r);
        }
      });
    },
    /** Hazard chevrons across a band (u0..u1, v0..v1): diagonal bars of the trim on the dark. */
    hazard(u0, v0, u1, v1, k = 5) {
      K.rect(u0, v0, u1, v1, 'dark', 0.01);
      const w = (u1 - u0) / k, hgt = v1 - v0;
      for (let i = 0; i < k; i++) {
        const a = u0 + i * w;
        K.put({ faces: [{ c: [[a, v0, 0.016], [a + w * 0.5, v0, 0.016], [Math.min(u1, a + w * 0.5 + hgt * 0.6), v1, 0.016], [Math.min(u1, a + hgt * 0.6), v1, 0.016]], r: 'trim', out: [0, 0, 1] }], center: [0, 0, 0] });
      }
    },
    /** Vent slats across a frame (u0..u1, v0..v1) on a face: a dark well and its louvres. */
    vent(u0, v0, u1, v1, k = 4) {
      K.rect(u0, v0, u1, v1, 'dark', 0.006);
      const h = (v1 - v0) / k;
      for (let i = 0; i < k; i++) K.box([(u0 + u1) / 2, v0 + h * (i + 0.5), 0.03], [u1 - u0 - 0.02, h * 0.45, 0.04], 'gunmetal');
    },
  };
  return K;
}

// ── the part's proportions, by its row (its class where a row has no look of its own) ───────────────────────────────
const LEGS = f({
  // hw the hips' half-span, ha the ankle over the sole, t the girth, foot [heel, toe] and width
  light: f({ hw: 0.6, ha: 0.5, t: 0.82, foot: [0.52, 1.25], fw: 0.72, toes: 2, pod: false }),
  medium: f({ hw: 0.74, ha: 0.58, t: 1, foot: [0.62, 1.45], fw: 0.92, toes: 2, pod: true }),
  heavy: f({ hw: 0.92, ha: 0.7, t: 1.28, foot: [0.78, 1.68], fw: 1.22, toes: 3, pod: false }),
  // (reverse-joint legs: the ankle a raised heel over a short metatarsal, three toes splayed from its ball, a spur behind;
  // the knee bent back, the shin the longer bone. A crouched, forward-raked bird's stance: the bones their own lengths
  // (`bones`, thigh and shin), the ankle set `fore` ahead of the hip and the metatarsal raked forward (`meta`, its length
  // and its angle off the vertical), so the hip stands as low as the legs' height says)
  reverse: f({ hw: 0.8, ha: 0.81, t: 1.04, foot: [0.7, 1.45], fw: 1.1, toes: 3, pod: true, bend: -1, bones: f([2.21, 3.05]), fore: 0.5, meta: f([0.9, 52]) }),
});
const ARMS = f({ light: f({ a: 0.78, up: 1.5, fo: 1.3 }), medium: f({ a: 1, up: 1.6, fo: 1.4 }), heavy: f({ a: 1.28, up: 1.66, fo: 1.46 }) });
const CORE_CH = f({ light: 1.75, medium: 1.85, heavy: 1.9, prow: 1.5 });
const legsLook = (P) => LEGS[P.joint === 'reverse' ? 'reverse' : P.class];
const classOf = (slot, id) => partOf(slot, id).class ?? 'medium';

/** The rest skeleton of a build: every joint where it stands. */
function skeleton(B) {
  const P = { core: partOf('core', B.core), legs: partOf('legs', B.legs), arms: partOf('arms', B.arms) };
  const s = P.core.size, Lg = legsLook(P.legs), A = ARMS[P.arms.class];
  // (the legs' two bones over the hip-to-ankle drop: a biped's knee bent forward a little, a reverse joint's back far)
  const H = P.legs.height, D = H - Lg.ha, reach = D / Math.cos((Lg.rake ?? 14) * DEG), bend = Lg.bend ?? 1;
  const L1 = Lg.bones ? Lg.bones[0] : reach * (Lg.split ?? 0.47), L2 = Lg.bones ? Lg.bones[1] : reach - L1;
  const zc0 = H + 0.72, zc1 = zc0 + CORE_CH[P.core.headless ? 'prow' : P.core.class] * s;
  const halfW = 1.18 * s, shoulderX = halfW + 0.36 * A.a;
  const sk = { s, H, L1, L2, Lg, A, zc0, zc1, halfW, depth: 0.95 * s, bend, joint: bend < 0 ? 'reverse' : 'biped', headless: !!P.core.headless };
  sk.root = [0, 0, H];
  sk.core = [0, -0.05, H + 0.5];
  sk.neck = [0, 0.12 * s, zc1 + 0.04];
  sk.booster = [0, -0.92 * s, zc0 + 0.95 * s];
  sk.shoulder = [shoulderX, 0, zc1 - 0.42 * s];
  // (the upper arm down and forward to the elbow, a little out; the forearm level and forward: an AC always aims)
  const upDir = unit([0.06, Math.sin(22 * DEG), -Math.cos(22 * DEG)]);
  sk.elbow = add(sk.shoulder, mul(upDir, A.up));
  sk.wrist = add(sk.elbow, [0, A.fo, 0]);
  sk.grip = add(sk.wrist, [0, 0.2 * A.a, -0.04]);
  sk.mount = [0.7 * s + 0.16, -0.62 * s, zc1 - 0.3];
  sk.hip = [Lg.hw, 0, H];
  sk.ankle = [Lg.hw + 0.06, Lg.fore ?? 0.02, Lg.ha];
  sk.knee = legKnee(sk.hip, sk.ankle, L1, L2, [1, 0, 0], bend);
  return sk;
}

/** The knee of a two-bone leg from the hip to the ankle, in the plane square to `n` (+x at rest): bent forward
 *  (`bend` 1, a biped's) or back (−1, a reverse joint's, a bird's). */
export function legKnee(hip, ankle, L1, L2, n, bend = 1) {
  const dv = sub(ankle, hip), D = Math.min(len(dv), (L1 + L2) * 0.9995), u = unit(dv);
  const nn = unit(sub(n, mul(u, dot(n, u)))), w = mul(cross(nn, u), bend < 0 ? -1 : 1);
  const ca = Math.max(-1, Math.min(1, (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D))), a = Math.acos(ca);
  return add(hip, add(mul(u, L1 * Math.cos(a)), mul(w, L1 * Math.sin(a))));
}

// ── the parts ──────────────────────────────────────────────────────────────────────────────────────────────────────
function pelvis(K, sk, cls) {
  K.bone('root');
  const { H, s, Lg } = sk, hw = Lg.hw, t = Lg.t;
  // (the pelvis frame: a dark block between the hips, its drums at each side)
  K.box([0, -0.05, H + 0.08], [2 * (hw - 0.14), 0.9 * s, 0.6], 'gunmetal', { ch: 0.08 });
  K.box([0, -0.05, H + 0.42], [1.1 * s, 0.75 * s, 0.2], 'gunmetal', { ch: 0.05 });
  // (the groin plate, layered, a band of the trim across it)
  K.in(at([0, 0.48 * s, H - 0.02], rx(-0.22)), () => {
    const c = [0, 0, 0], sz = [0.78 * s, 0.16, 0.72];
    K.box(c, sz, 'paint', { ch: 0.06, taper: [1.3, 1] });
    K.on(c, sz, '+y', () => { K.panel(-0.22 * s, -0.25, 0.22 * s, 0.12, 'paint2', 0.04); K.rect(-0.3 * s, 0.2, 0.3 * s, 0.28, 'trim'); });
  });
  K.box([0, -0.5 * s, H + 0.05], [0.9 * s, 0.18, 0.6], 'paint2', { ch: 0.06 });
  for (const sg of [-1, 1]) {
    K.in(at([0, 0, 0], sg < 0 ? MIRROR : I3), () => {
      // (the hip's housing on the pelvis's side, and the skirt plate over its outside, tilted out; a chevron on it)
      K.cyl([hw - 0.34, 0, H], [hw - 0.16, 0, H], 0.34 * t, 0.34 * t, 'gunmetal', { n: 12, smooth: false });
      K.cyl([hw - 0.17, 0, H], [hw - 0.13, 0, H], 0.38 * t, 0.38 * t, 'chrome', { n: 12 });
      K.in(at([hw + 0.34 * t + 0.08, 0.02, H + 0.08], ry(-0.16)), () => {
        const c = [0, 0, 0], sz = [0.14, 0.95 * t + 0.1, 0.8];
        K.box(c, sz, 'paint', { ch: 0.05, taper: [1, 0.85] });
        K.on(c, sz, '+x', () => {
          K.panel(-0.25 * t, -0.25, 0.25 * t, 0.15, 'paint2', 0.035);
          if (cls === 'heavy') K.hazard(-0.4 * t, 0.22, 0.4 * t, 0.32, 6); else K.rect(-0.4 * t, 0.22, 0.4 * t, 0.29, 'trim');
          for (const u of [-0.38 * t, 0.38 * t]) K.bolt(u, -0.3, 0.03);
        });
      });
      // (the hip's ram: from the pelvis down to the thigh's front)
      K.cable([[hw - 0.3, -0.42 * s, H + 0.3], [hw - 0.1, -0.4 * s, H + 0.1], [hw, -0.32 * t, H - 0.15]], 0.04);
    });
  }
  // (the waist: a sealed boot between the pelvis and the core)
  for (let i = 0; i < 3; i++) K.cyl([0, -0.05, H + 0.5 + i * 0.09], [0, -0.05, H + 0.59 + i * 0.09], 0.5 * s, 0.44 * s, 'seal', { n: 12, caps: [false, false] });
}

function core(K, sk, id, cls) {
  K.bone('core');
  const { s, zc0, zc1, halfW: hw } = sk, ch = zc1 - zc0, zm = (zc0 + zc1) / 2;
  // (the waist ring and the cockpit block: the dark core the armour is layered over)
  K.cyl([0, -0.05, zc0 - 0.2], [0, -0.05, zc0 - 0.05], 0.55 * s, 0.6 * s, 'chrome', { n: 14 });
  const blockW = cls === 'light' ? 1.3 * s : 1.5 * s;
  K.box([0, -0.05, zm], [blockW, 1.55 * s, ch * 0.95], 'gunmetal', { ch: 0.1, taper: [1.25, 1.08] });
  // (the waist's rams: two polished rods from the pelvis up into the chest's underside, each side of the boot)
  for (const sg of [-1, 1]) K.ram([sg * 0.42 * s, 0.22 * s, sk.H + 0.2], [sg * 0.48 * s, 0.25 * s, zc0 + 0.08], 0.07 * s, { split: 0.45 });
  // (the shoulders' yokes: the frame the arms hang from)
  for (const sg of [-1, 1]) {
    K.in(at([0, 0, 0], sg < 0 ? MIRROR : I3), () => {
      K.box([hw - 0.25 * s, -0.05, zc1 - 0.42 * s], [0.6 * s, 0.9 * s, 0.7 * s], 'gunmetal', { ch: 0.08 });
      K.cyl([hw - 0.1, 0, zc1 - 0.42 * s], [sk.shoulder[0] - 0.2, 0, zc1 - 0.42 * s], 0.3 * s, 0.3 * s, 'chrome', { n: 12 });
    });
  }
  // (the back plate the booster hangs on, and its cable runs to the shoulders)
  const bc = [0, -0.82 * s, zm], bs = [1.5 * s, 0.22, ch * 0.8];
  K.box(bc, bs, 'paint2', { ch: 0.07 });
  K.on(bc, bs, '-y', () => { K.vent(-0.62 * s, ch * 0.2, -0.32 * s, ch * 0.34, 4); K.vent(0.32 * s, ch * 0.2, 0.62 * s, ch * 0.34, 4); });
  for (const sg of [-1, 1]) K.cable([[sg * 0.55 * s, -0.95 * s, zm + 0.1], [sg * 0.9 * s, -0.7 * s, zc1 - 0.1], [sg * (hw + 0.05), -0.35 * s, zc1 - 0.25]], 0.05);
  if (id === 'cr-prow' || sk.headless) prowFuselage(K, sk);
  else if (id === 'cr-citadel' || cls === 'heavy') citadelChest(K, sk);
  else if (id === 'cr-raptor' || cls === 'light') raptorChest(K, sk);
  else vanguardChest(K, sk);
  // (the collar round the neck: a chrome ring on its dark seat; a fuselage has no neck)
  if (!sk.headless) {
    K.cyl([0, sk.neck[1], zc1 - 0.06], [0, sk.neck[1], zc1 + 0.04], 0.42 * s, 0.38 * s, 'gunmetal', { n: 12, smooth: false });
    K.cyl([0, sk.neck[1], zc1 + 0.04], [0, sk.neck[1], zc1 + 0.09], 0.34 * s, 0.34 * s, 'chrome', { n: 12 });
  }
  // (the back's verniers, low each side: a quick boost's sideways kick)
  for (const sg of [-1, 1]) {
    const p = [sg * (0.78 * s), -0.95 * s, zc0 + 0.25 * s], d = unit([sg * 0.85, -0.5, -0.15]);
    K.box(add(p, [0, 0.12, 0]), [0.3, 0.3, 0.3], 'gunmetal', { ch: 0.05 });
    K.bell(p, add(p, mul(d, 0.22)), 0.07, 0.11, { n: 8 });
    sk.thrusters.push({ bone: 'core', at: add(p, mul(d, 0.22)), dir: d, r: 0.11, kind: 'vernier' });
  }
}

/** A medium core: a chest of layered plate over the cockpit block, intakes at the sides. */
function vanguardChest(K, sk) {
  const { s, zc0, zc1, halfW: hw } = sk, ch = zc1 - zc0;
  // (the chest: two breast plates swept back from a keel, the cockpit's hatch between them; the abdomen's bands
  // narrowing down to the waist)
  for (const sg of [-1, 1]) {
    K.in(at([0, 0, 0], sg < 0 ? MIRROR : I3), () => {
      K.in(at([0.5 * s, 0.7 * s, zc0 + 0.64 * ch], mm(rz(-0.24), rx(0.22))), () => {
        const c = [0, 0, 0], sz = [1.0 * s, 0.38 * s, 0.56 * ch];
        K.box(c, sz, 'paint', { ch: 0.1, taper: [1.06, 0.82] });
        K.on(c, sz, '+y', () => {
          K.panel(-0.3 * s, -0.2 * ch, 0.22 * s, 0.14 * ch, 'paint2', 0.06);
          K.rect(-0.42 * s, 0.19 * ch, 0.38 * s, 0.23 * ch, 'trim');
          K.seam(0.3 * s, -0.27 * ch, 0.3 * s, 0.17 * ch); K.seam(-0.46 * s, -0.05 * ch, -0.32 * s, -0.05 * ch);
          K.edge(-0.44 * s, 0.44 * s, -0.255 * ch, 0.045);
          if (sg > 0) K.in(at([0, 0, 0.06]), () => K.digits('07', -0.05 * s, -0.04 * ch, 0.17 * s));
          for (const u of [-0.42 * s, 0.4 * s]) for (const v of [-0.2 * ch, 0.12 * ch]) K.bolt(u, v, 0.03);
        });
      });
    });
  }
  K.in(at([0, 0.86 * s, zc0 + 0.6 * ch], rx(0.18)), () => {
    const c = [0, 0, 0], sz = [0.34 * s, 0.3 * s, 0.62 * ch];
    K.box(c, sz, 'paint2', { ch: 0.06, taper: [1.2, 0.8] });
    K.on(c, sz, '+y', () => { K.rect(-0.05 * s, -0.25 * ch, 0.05 * s, 0.05 * ch, 'trim'); for (const v of [-0.27 * ch, 0.2 * ch]) K.bolt(0, v, 0.03); });
  });
  K.in(at([0, 0.64 * s, zc0 + 0.27 * ch], rx(-0.1)), () => {
    const c = [0, 0, 0], sz = [1.3 * s, 0.32 * s, 0.17 * ch];
    K.box(c, sz, 'paint2', { ch: 0.06, taper: [1.12, 1] });
    K.on(c, sz, '+y', () => K.rect(-0.45 * s, -0.02, 0.45 * s, 0.02, 'dark'));
  });
  K.in(at([0, 0.58 * s, zc0 + 0.1 * ch], rx(-0.18)), () => K.box([0, 0, 0], [1.0 * s, 0.3 * s, 0.15 * ch], 'paint', { ch: 0.05, taper: [1.15, 1] }));
  for (const sg of [-1, 1]) {
    K.in(at([0, 0, 0], sg < 0 ? MIRROR : I3), () => {
      // (the side intakes: a framed mouth forward of the shoulder, louvred)
      const c = [hw - 0.12 * s, 0.55 * s, zc0 + 0.42 * ch], sz = [0.42 * s, 0.5 * s, 0.42 * ch];
      K.box(c, sz, 'gunmetal', { ch: 0.06 });
      K.on(c, sz, '+y', () => K.vent(-0.16 * s, -0.17 * ch, 0.16 * s, 0.17 * ch, 5));
      // (the side plates: a cheek of armour over the intake's flank)
      K.in(at([hw + 0.02, 0.05, zc0 + 0.48 * ch], rz(0.08)), () => {
        const c2 = [0, 0, 0], s2 = [0.16, 1.2 * s, 0.62 * ch];
        K.box(c2, s2, 'paint', { ch: 0.06 });
        K.on(c2, s2, '+x', () => { K.panel(-0.4 * s, -0.18 * ch, 0.25 * s, 0.18 * ch, 'paint2', 0.04); K.rect(0.32 * s, -0.25 * ch, 0.4 * s, 0.25 * ch, 'trim'); });
      });
      // (the shoulder's yoke plate over the top)
      K.in(at([hw - 0.38 * s, 0.05, zc1 - 0.02], ry(0.12)), () => K.box([0, 0, 0], [0.9 * s, 1.5 * s, 0.22], 'paint', { ch: 0.07 }));
    });
  }
  // (the cockpit's sensor: a lens in the chest's top plate)
  K.box([0, 0.98 * s, zc0 + 0.86 * ch], [0.42 * s, 0.1, 0.1], 'lens', { ch: 0.02 });
  K.box([0, 1.01 * s, zc0 + 0.86 * ch], [0.3 * s, 0.06, 0.04], 'glow');
}

/** A light core: slim, its chest cut back at the shoulders for the arms' reach; a keel of plate down its middle. */
function raptorChest(K, sk) {
  const { s, zc0, zc1, halfW: hw } = sk, ch = zc1 - zc0;
  // (the keel: a narrow prow of plate, its sides raked back)
  K.in(at([0, 0.7 * s, zc0 + 0.55 * ch], rx(0.16)), () => {
    const c = [0, 0, 0], sz = [1.1 * s, 0.5 * s, 0.85 * ch];
    K.box(c, sz, 'paint', { ch: 0.16, taper: [0.82, 0.9] });
    K.on(c, sz, '+y', () => { K.panel(-0.22 * s, -0.3 * ch, 0.22 * s, 0.05 * ch, 'paint2', 0.05); K.rect(-0.05 * s, 0.12 * ch, 0.05 * s, 0.38 * ch, 'trim'); K.digits('3', 0.0, -0.15 * ch, 0.16 * s); });
  });
  for (const sg of [-1, 1]) {
    K.in(at([0, 0, 0], sg < 0 ? MIRROR : I3), () => {
      // (the flank plates, raked back from the keel so the arm swings past them)
      K.in(at([0.62 * s, 0.32 * s, zc0 + 0.5 * ch], mm(rz(-0.55), rx(0.1))), () => {
        const c = [0, 0, 0], sz = [0.7 * s, 0.18, 0.8 * ch];
        K.box(c, sz, 'paint2', { ch: 0.06, taper: [0.7, 1] });
        K.on(c, sz, '+y', () => { K.vent(-0.18 * s, -0.25 * ch, 0.12 * s, -0.05 * ch, 4); K.bolt(0.2 * s, 0.25 * ch); });
      });
      K.in(at([hw - 0.42 * s, -0.05, zc1 - 0.05], ry(0.18)), () => K.box([0, 0, 0], [0.75 * s, 1.2 * s, 0.18], 'paint', { ch: 0.06, taper: [0.8, 0.8] }));
      K.box([hw - 0.2 * s, -0.3 * s, zc0 + 0.35 * ch], [0.34 * s, 0.7 * s, 0.4 * ch], 'gunmetal', { ch: 0.05 });
    });
  }
  K.box([0, 0.62 * s, zc0 + 0.08 * ch], [0.9 * s, 0.28 * s, 0.16 * ch], 'paint', { ch: 0.06 });
  K.box([0, 0.98 * s, zc0 + 0.8 * ch], [0.28 * s, 0.1, 0.08], 'lens', { ch: 0.02 });
  K.box([0, 1.01 * s, zc0 + 0.8 * ch], [0.2 * s, 0.06, 0.035], 'glow');
}

/** A heavy core: its chest a slab of armour, its collar high round the head. */
function citadelChest(K, sk) {
  const { s, zc0, zc1, halfW: hw } = sk, ch = zc1 - zc0;
  // (the slab: thick, near upright, its face layered with a second plate, a hazard band and its number)
  K.in(at([0, 0.78 * s, zc0 + 0.52 * ch], rx(0.08)), () => {
    const c = [0, 0, 0], sz = [2.3 * s, 0.46 * s, 0.82 * ch];
    K.box(c, sz, 'paint', { ch: 0.12 });
    K.on(c, sz, '+y', () => {
      K.panel(-0.85 * s, -0.3 * ch, 0.85 * s, 0.22 * ch, 'paint2', 0.08);
      K.hazard(-1.05 * s, 0.28 * ch, 1.05 * s, 0.36 * ch, 9);
      // (the inset's own panels: a seam down it and across, the number on its upper left, a row of bolts)
      K.in(at([0, 0, 0.08]), () => {
        K.digits('12', -0.5 * s, 0.08 * ch, 0.22 * s);
        K.seam(0.1 * s, -0.28 * ch, 0.1 * s, 0.2 * ch); K.seam(-0.83 * s, -0.08 * ch, 0.83 * s, -0.08 * ch);
        K.panel(0.25 * s, -0.24 * ch, 0.7 * s, -0.12 * ch, 'paint', 0.03);
        for (const u of [-0.7 * s, -0.35 * s, 0.35 * s, 0.7 * s]) K.bolt(u, -0.25 * ch, 0.03);
        K.edge(-0.83 * s, 0.83 * s, -0.31 * ch, 0.045);
      });
      for (const u of [-1.02 * s, -0.34 * s, 0.34 * s, 1.02 * s]) for (const v of [-0.36 * ch, 0.24 * ch]) K.bolt(u, v, 0.04);
    });
  });
  K.box([0, 0.7 * s, zc0 + 0.03 * ch], [1.5 * s, 0.3 * s, 0.14 * ch], 'paint2', { ch: 0.06 });
  for (const sg of [-1, 1]) {
    K.in(at([0, 0, 0], sg < 0 ? MIRROR : I3), () => {
      // (the collar's cheeks: plates rising past the head's sides, raked back)
      K.in(at([0.6 * s, 0.05 * s, zc1 + 0.32], mm(rz(-0.3), rx(-0.1))), () => {
        const c = [0, 0, 0], sz = [0.24, 0.95 * s, 0.85];
        K.box(c, sz, 'paint', { ch: 0.07, taper: [0.8, 0.75] });
        K.on(c, sz, '+x', () => K.rect(-0.3 * s, 0.1, 0.3 * s, 0.17, 'trim'));
      });
      // (the flanks: armour hung on the side, its intake under a hood)
      K.in(at([hw + 0.04, 0.0, zc0 + 0.45 * ch], rz(0.05)), () => {
        const c = [0, 0, 0], sz = [0.26, 1.45 * s, 0.75 * ch];
        K.box(c, sz, 'paint2', { ch: 0.08 });
        K.on(c, sz, '+x', () => { K.vent(-0.35 * s, -0.25 * ch, 0.2 * s, 0.0, 5); for (const u of [-0.55 * s, 0.55 * s]) K.bolt(u, 0.25 * ch, 0.04); });
      });
      K.in(at([hw - 0.4 * s, 0.0, zc1 - 0.02], ry(0.1)), () => K.box([0, 0, 0], [1.0 * s, 1.6 * s, 0.28], 'paint', { ch: 0.08 }));
    });
  }
  // (the collar's back, high behind the head)
  K.in(at([0, -0.35 * s, zc1 + 0.36], rx(0.2)), () => K.box([0, 0, 0], [1.25 * s, 0.24, 0.85], 'paint', { ch: 0.07, taper: [0.85, 1] }));
  K.box([0, 1.03 * s, zc0 + 0.95 * ch], [0.5 * s, 0.1, 0.1], 'lens', { ch: 0.02 });
  K.box([0, 1.06 * s, zc0 + 0.95 * ch], [0.38 * s, 0.06, 0.04], 'glow');
}

/** A forward fuselage (a headless core): a long armoured prow ahead of the shoulders, the cockpit in it under a narrow
 *  canopy, its optics in a chin turret under the nose, sensor fins behind the canopy; the shoulders and the arms hang
 *  at its root, behind and under it, as a gunship's nose carries its guns. */
function prowFuselage(K, sk) {
  const { s, zc0, zc1, halfW: hw } = sk, ch = zc1 - zc0;
  // the prow's line: from its root at the chest (y0) to its nose (y0 + L), its top falling and its sides drawing in
  const y0 = 0.3 * s, L = 2.5 * s, zp = zc0 + 0.6 * ch, W = 1.3 * s, Hh = 1.0 * ch, tw = 0.5, th = 0.55, drop = 0.2 * s;
  const along = (t) => [0, y0 + L * t, zp - drop * t];
  const halfH = (t) => (Hh / 2) * (1 + (th - 1) * t), halfWd = (t) => (W / 2) * (1 + (tw - 1) * t);
  const top = (t) => along(t)[2] + halfH(t), bottom = (t) => along(t)[2] - halfH(t);
  const slope = Math.atan2(top(0) - top(1), L);
  // (the hull: built up its length, the nose its narrow end, dropped a little)
  K.in(at([0, y0, zp], rx(-Math.PI / 2)), () => K.box([0, 0, L / 2], [W, Hh, L], 'paint2', { ch: 0.12, taper: [tw, th], shear: [0, drop] }));
  // (the root's frame where the prow meets the chest, and the armoured hump behind it over the cockpit block)
  K.box([0, y0 - 0.05, zp], [W * 1.08, 0.3, Hh * 1.05], 'gunmetal', { ch: 0.06 });
  K.in(at([0, -0.25 * s, zc1 - 0.08], rx(0.06)), () => {
    const c = [0, 0, 0], sz = [1.45 * s, 1.25 * s, 0.26];
    K.box(c, sz, 'paint', { ch: 0.08, taper: [0.9, 0.9] });
    K.on(c, sz, '+z', () => { K.vent(-0.5 * s, -0.4 * s, -0.22 * s, -0.05 * s, 4); K.vent(0.22 * s, -0.4 * s, 0.5 * s, -0.05 * s, 4); K.rect(-0.04 * s, -0.55 * s, 0.04 * s, 0.5 * s, 'trim'); });
  });
  // (the deck: an armour plate over the prow's top, along its fall, its seams, its edge polished)
  K.in(at(add(along(0.42), [0, 0, halfH(0.42) + 0.05]), rx(-slope)), () => {
    const c = [0, 0, 0], sz = [W * 0.72, L * 0.86, 0.1];
    K.box(c, sz, 'paint', { ch: 0.04 });
    K.on(c, sz, '+z', () => {
      K.seam(-0.36 * W, -0.38 * L, -0.36 * W, 0.38 * L); K.seam(0.36 * W, -0.38 * L, 0.36 * W, 0.38 * L);
      for (const v of [-0.38 * L, 0.38 * L]) for (const u of [-0.3 * W, 0.3 * W]) K.bolt(u, v, 0.03);
      // (the canopy: a narrow ridge of glass raised in a polished sill, its bars across it, the cockpit lit inside
      // along its spine; its foot faired into the deck)
      K.box([0, 0.08 * L, 0.06], [0.5 * s, 0.6 * L, 0.12], 'chrome', { ch: 0.05 });
      K.in(at([0, 0.08 * L, 0.12], rx(-Math.PI / 2)), () => K.box([0, -0.13, 0], [0.4 * s, 0.26, 0.56 * L], 'lens', { ch: 0.06, taper: [0.8, 0.6] }));
      K.box([0, -0.06 * L, 0.38], [0.05 * s, 0.2 * L, 0.02], 'glow');
      for (const v of [-0.1 * L, 0.06 * L, 0.22 * L]) K.box([0, v, 0.27], [0.36 * s, 0.04, 0.3], 'chrome', { ch: 0.012, taper: [0.55, 1] });
      K.box([0, -0.26 * L, 0.12], [0.44 * s, 0.1, 0.22], 'paint2', { ch: 0.03 });
      K.rect(-0.3 * W, 0.3 * L, 0.3 * W, 0.34 * L, 'trim');
    });
  });
  // (the cheeks: plates down the prow's flanks, an intake in each, the frame's number on the right)
  for (const sg of [-1, 1]) {
    K.in(at([0, 0, 0], sg < 0 ? MIRROR : I3), () => {
      const t = 0.38, p = along(t), yaw = Math.atan2((halfWd(0) - halfWd(1)), L);
      K.in(at([halfWd(t) + 0.03, p[1], p[2] - 0.02], mm(rz(yaw), rx(-slope * 0.5))), () => {
        const c = [0, 0, 0], sz = [0.12, L * 0.62, Hh * 0.62];
        K.box(c, sz, 'paint', { ch: 0.04 });
        K.on(c, sz, '+x', () => {
          K.vent(-0.26 * L, -0.12 * Hh, -0.08 * L, 0.12 * Hh, 4);
          K.rect(-0.3 * L, 0.2 * Hh, 0.3 * L, 0.25 * Hh, 'trim');
          K.seam(0.02 * L, -0.28 * Hh, 0.02 * L, 0.28 * Hh);
          K.digits('07', 0.17 * L, 0.0, 0.17 * s);
          K.edge(-0.3 * L, 0.3 * L, -0.3 * Hh, 0.04);
        });
      });
      // (a sensor fin behind the canopy, raked back, and the antenna off its root)
      K.in(at([0.28 * s, y0 + 0.05 * L, top(0.05) + 0.02], ry(sg > 0 ? 0.32 : 0.32)), () => K.box([0, 0, 0.2], [0.035, 0.5, 0.4], 'chrome', { taper: [1, 0.35], shear: [0, -0.3] }));
      K.cyl([0.4 * s, y0 - 0.15, top(0) - 0.05], [0.48 * s, y0 - 0.9, top(0) + 0.55], 0.022, 0.01, 'chrome', { n: 6 });
    });
  }
  // (the nose: a polished sensor cone and its lens)
  const nose = along(1);
  K.cyl(nose, add(nose, [0, 0.32, -0.02]), Math.min(halfWd(1), halfH(1)) * 0.8, 0.06, 'chrome', { n: 12 });
  K.cyl(add(nose, [0, 0.32, -0.02]), add(nose, [0, 0.35, -0.02]), 0.05, 0.05, 'glow', { n: 8, smooth: false, caps: [false, true] });
  // (the chin turret: a ball on a ring under the nose, its optic forward, lit, a twin pair of lenses beside it)
  const tp = along(0.78), tz = bottom(0.78);
  K.cyl([0, tp[1], tz + 0.02], [0, tp[1], tz - 0.1], 0.26 * s, 0.24 * s, 'gunmetal', { n: 12, smooth: false });
  K.in(at([0, tp[1], tz - 0.3 * s]), () => {
    K.dome([0, 0, -0.05], 0.3 * s, 0.3 * s, 0.25 * s, 'paint', { n: 12, rings: 3 });
    K.cyl([0, 0, -0.05], [0, 0, -0.15], 0.3 * s, 0.26 * s, 'paint', { n: 12 });
    K.cyl([0, 0.18 * s, -0.04], [0, 0.36 * s, -0.04], 0.13 * s, 0.13 * s, 'gunmetal', { n: 12 });
    K.cyl([0, 0.36 * s, -0.04], [0, 0.4 * s, -0.04], 0.1 * s, 0.1 * s, 'lens', { n: 12, smooth: false });
    K.cyl([0, 0.4 * s, -0.04], [0, 0.41 * s, -0.04], 0.06 * s, 0.06 * s, 'glow', { n: 10, smooth: false, caps: [false, true] });
    for (const sg of [-1, 1]) {
      K.cyl([sg * 0.2 * s, 0.16 * s, 0.05], [sg * 0.2 * s, 0.3 * s, 0.05], 0.05 * s, 0.05 * s, 'chrome', { n: 8, smooth: false });
      K.cyl([sg * 0.2 * s, 0.3 * s, 0.05], [sg * 0.2 * s, 0.31 * s, 0.05], 0.035 * s, 0.035 * s, 'glow', { n: 8, smooth: false, caps: [false, true] });
    }
  });
  // (under the prow's root: the chest's lower plates over the cockpit block, the bands down to the waist)
  K.in(at([0, 0.56 * s, zc0 + 0.18 * ch], rx(-0.14)), () => {
    const c = [0, 0, 0], sz = [1.3 * s, 0.32 * s, 0.32 * ch];
    K.box(c, sz, 'paint', { ch: 0.06, taper: [1.12, 1] });
    K.on(c, sz, '+y', () => { K.rect(-0.45 * s, -0.02, 0.45 * s, 0.02, 'dark'); K.bolt(-0.5 * s, 0.08, 0.03); K.bolt(0.5 * s, 0.08, 0.03); });
  });
  for (const sg of [-1, 1]) {
    K.in(at([0, 0, 0], sg < 0 ? MIRROR : I3), () => {
      // (the shoulders' yoke plates, and an intake at each side of the prow's root)
      K.in(at([hw - 0.38 * s, -0.1, zc1 - 0.04], ry(0.14)), () => K.box([0, 0, 0], [0.9 * s, 1.35 * s, 0.22], 'paint', { ch: 0.07 }));
      const c = [hw - 0.2 * s, 0.4 * s, zc0 + 0.45 * ch], sz = [0.42 * s, 0.4 * s, 0.5 * ch];
      K.box(c, sz, 'gunmetal', { ch: 0.06 });
      K.on(c, sz, '+y', () => K.vent(-0.15 * s, -0.2 * ch, 0.15 * s, 0.2 * ch, 4));
    });
  }
}

function head(K, sk, id, cls) {
  K.bone('head');
  const N = sk.neck;
  // (the neck: a dark column in its sealed boot)
  K.cyl(add(N, [0, 0, -0.05]), add(N, [0, 0, 0.16]), 0.2, 0.18, 'gunmetal', { n: 10 });
  K.cyl(add(N, [0, 0, 0.0]), add(N, [0, 0, 0.12]), 0.26, 0.23, 'seal', { n: 10, caps: [false, false] });
  K.in(at(add(N, [0, 0, 0.14])), () => {
    if (id === 'hd-bulwark' || cls === 'heavy') bulwarkHead(K);
    else if (id === 'hd-lancet' || cls === 'light') lancetHead(K);
    else sentinelHead(K);
  });
}

/** A standard head: a visor slit, a sensor bar, the antennas swept back. */
function sentinelHead(K) {
  const c = [0, 0.06, 0.26], sz = [0.66, 0.82, 0.52];
  K.box(c, sz, 'paint', { ch: 0.09, taper: [0.82, 0.86] });
  // (the visor: a lens band across the face under a brow, its slit lit)
  K.in(at([0, 0.45, 0.24], rx(0.25)), () => {
    K.box([0, 0, 0], [0.56, 0.12, 0.14], 'lens', { ch: 0.03 });
    K.box([0, 0.055, 0], [0.46, 0.03, 0.035], 'glow');
  });
  K.box([0, 0.42, 0.38], [0.62, 0.18, 0.08], 'paint2', { ch: 0.03 });
  // (the chin: a dark intake)
  K.in(at([0, 0.4, 0.07], rx(-0.3)), () => { K.box([0, 0, 0], [0.4, 0.14, 0.14], 'gunmetal', { ch: 0.03 }); K.on([0, 0, 0], [0.4, 0.14, 0.14], '+y', () => K.vent(-0.15, -0.05, 0.15, 0.05, 3)); });
  // (the sensor bar on the crown: chrome housing, three lenses)
  K.box([0, 0.12, 0.56], [0.42, 0.3, 0.1], 'chrome', { ch: 0.03 });
  for (const x of [-0.12, 0, 0.12]) { K.cyl([x, 0.26, 0.565], [x, 0.29, 0.565], 0.035, 0.035, 'lens', { n: 8, smooth: false }); }
  K.cyl([0, 0.29, 0.565], [0, 0.295, 0.565], 0.02, 0.02, 'glow', { n: 6, smooth: false, caps: [false, true] });
  // (the cheeks and the antennas swept back off them)
  for (const sg of [-1, 1]) {
    K.in(at([0, 0, 0], sg < 0 ? MIRROR : I3), () => {
      K.box([0.31, 0.1, 0.24], [0.1, 0.55, 0.34], 'paint2', { ch: 0.03 });
      K.on([0.31, 0.1, 0.24], [0.1, 0.55, 0.34], '+x', () => K.rect(-0.18, -0.03, 0.12, 0.02, 'trim'));
      K.cyl([0.34, -0.12, 0.38], [0.4, -0.78, 0.8], 0.025, 0.012, 'chrome', { n: 6 });
      K.box([0.34, -0.1, 0.38], [0.08, 0.12, 0.12], 'gunmetal', { ch: 0.02 });
    });
  }
  K.box([0, -0.36, 0.24], [0.5, 0.12, 0.36], 'gunmetal', { ch: 0.03 });
}

/** A light head: a narrow wedge, one long optic, light and quick. */
function lancetHead(K) {
  // (the wedge: long, narrowing to its nose; built up its length, the nose its top end)
  K.in(at([0, -0.32, 0.22], rx(-Math.PI / 2)), () => K.box([0, 0, 0.46], [0.44, 0.36, 0.92], 'paint', { ch: 0.07, taper: [0.55, 0.5] }));
  K.box([0, -0.1, 0.44], [0.3, 0.6, 0.1], 'paint2', { ch: 0.03 });
  // (the optic: one long lens down the wedge's flank to its nose, a lit line in it)
  for (const sg of [-1, 1]) {
    K.in(at([sg * 0.17, 0.25, 0.25], mm(rz(sg * 0.18), rx(0))), () => { K.box([0, 0, 0], [0.05, 0.62, 0.08], 'lens', { ch: 0.015 }); K.box([sg * 0.022, 0.03, 0], [0.012, 0.5, 0.03], 'glow'); });
  }
  K.cyl([0, 0.58, 0.24], [0, 0.66, 0.24], 0.06, 0.05, 'lens', { n: 8, smooth: false });
  K.cyl([0, 0.66, 0.24], [0, 0.67, 0.24], 0.035, 0.035, 'glow', { n: 8, smooth: false, caps: [false, true] });
  // (fins: two small blades raked back off the top)
  for (const sg of [-1, 1]) K.in(at([sg * 0.12, -0.42, 0.42], ry(sg * 0.35)), () => K.box([0, 0, 0.12], [0.03, 0.32, 0.26], 'chrome', { taper: [1, 0.4], shear: [0, -0.18] }));
  K.box([0, -0.5, 0.18], [0.34, 0.16, 0.28], 'gunmetal', { ch: 0.03 });
}

/** A heavy head: an armoured dome, its sensors behind shutters. */
function bulwarkHead(K) {
  K.box([0, 0.02, 0.1], [0.74, 0.74, 0.22], 'gunmetal', { ch: 0.05 });
  K.dome([0, 0.0, 0.18], 0.44, 0.46, 0.5, 'paint', { n: 12, rings: 3 });
  // (the sensor housing forward of the dome: a lit window behind three shutter slats)
  K.box([0, 0.36, 0.32], [0.62, 0.22, 0.32], 'paint2', { ch: 0.05 });
  K.box([0, 0.47, 0.32], [0.48, 0.04, 0.2], 'lens');
  K.box([0, 0.485, 0.32], [0.42, 0.02, 0.05], 'glow');
  for (const z of [0.25, 0.32, 0.39]) K.in(at([0, 0.5, z], rx(-0.35)), () => K.box([0, 0, 0], [0.52, 0.025, 0.05], 'paint', { ch: 0.008 }));
  // (the brow and the side shutters' housings, a periscope block on the crown)
  K.box([0, 0.38, 0.5], [0.66, 0.24, 0.08], 'paint', { ch: 0.03 });
  for (const sg of [-1, 1]) {
    K.in(at([0, 0, 0], sg < 0 ? MIRROR : I3), () => {
      K.box([0.42, 0.05, 0.25], [0.14, 0.5, 0.36], 'paint2', { ch: 0.04 });
      K.on([0.42, 0.05, 0.25], [0.14, 0.5, 0.36], '+x', () => { K.vent(-0.16, -0.1, 0.16, 0.08, 3); K.bolt(0.18, 0.13, 0.025); });
    });
  }
  K.box([0.12, -0.12, 0.64], [0.16, 0.22, 0.14], 'chrome', { ch: 0.03 });
  K.box([0.12, 0.0, 0.64], [0.1, 0.02, 0.06], 'glow');
  K.cyl([-0.18, -0.2, 0.58], [-0.22, -0.35, 0.98], 0.022, 0.01, 'chrome', { n: 6 });
}

function arm(K, sk, sg, id, cls, weapon) {
  const S = sk.shoulder, E = sk.elbow, A = sk.A, a = A.a;
  const side = sg > 0 ? 'R' : 'L';
  K.in(at([0, 0, 0], sg < 0 ? MIRROR : I3), () => {
    // ── the upper arm, in its own frame: x out, y forward, z back up the arm to the shoulder
    K.bone(`armUp${side}`);
    K.in(segFrame(S, E, [0, 1, 0]), () => {
      const L = A.up;
      K.drum([0, 0, 0], 0.27 * a, 0.42 * a);
      // (the pauldron: a plate over the shoulder, layered, its band and its number; a vernier on its back)
      const pc = [0.14 * a, -0.02, 0.1 * a], ps = cls === 'heavy' ? [1.0 * a, 1.25 * a, 0.72 * a] : cls === 'light' ? [0.62 * a, 0.86 * a, 0.46 * a] : [0.86 * a, 1.12 * a, 0.6 * a];
      K.in(at([0, 0, 0], ry(0.28)), () => {
      K.box(pc, ps, 'paint', { ch: 0.1 * a, taper: [0.82, 0.9] });
      K.on(pc, ps, '+x', () => {
        K.panel(-0.3 * ps[1], -0.22 * ps[2], 0.3 * ps[1], 0.18 * ps[2], 'paint2', 0.04);
        K.rect(-0.45 * ps[1], 0.26 * ps[2], 0.45 * ps[1], 0.34 * ps[2], 'trim');
        K.digits(sg > 0 ? '1' : '2', 0, -0.02 * ps[2], 0.2 * a);
        K.seam(-0.36 * ps[1], -0.4 * ps[2], -0.36 * ps[1], 0.22 * ps[2]); K.seam(0.36 * ps[1], -0.4 * ps[2], 0.36 * ps[1], 0.22 * ps[2]);
        K.edge(-0.42 * ps[1], 0.42 * ps[1], -0.43 * ps[2], 0.05);
      });
      K.on(pc, ps, '+z', () => { for (const u of [-0.32, 0.32]) for (const v of [-0.35, 0.35]) K.bolt(u * ps[0], v * ps[1], 0.03); });
      });
      if (cls === 'heavy') {
        // (heavy arms: shouldered with armour, a second slab hung on the pauldron's flank)
        K.in(at([0.66 * a, 0.0, -0.3 * a], ry(0.12)), () => { K.box([0, 0, 0], [0.16, 1.05 * a, 0.7 * a], 'paint2', { ch: 0.05 }); K.on([0, 0, 0], [0.16, 1.05 * a, 0.7 * a], '+x', () => K.hazard(-0.4 * a, 0.18 * a, 0.4 * a, 0.27 * a, 5)); });
      }
      const vb = [0.1 * a, -0.62 * ps[1], 0.18 * a], vd = unit([0.35, -0.9, 0.25]);
      K.box(add(vb, [0, 0.1, 0]), [0.22 * a, 0.2, 0.22 * a], 'gunmetal', { ch: 0.03 });
      K.bell(vb, add(vb, mul(vd, 0.2 * a)), 0.06 * a, 0.1 * a, { n: 8 });
      if (sg > 0) sk.thrusters.push({ bone: 'armUpR', at: add(vb, mul(vd, 0.2 * a)), dir: vd, r: 0.1 * a, kind: 'vernier', T: true });
      // (the upper arm: a dark frame, armour on its outside, its ram on its back down to the elbow)
      K.box([0, 0, -0.5 * L], [0.36 * a, 0.4 * a, L - 0.45], 'gunmetal', { ch: 0.05 });
      const oc = [0.2 * a, 0.02, -0.55 * L], os = [0.12 * a, 0.46 * a, 0.5 * L];
      K.box(oc, os, cls === 'light' ? 'paint2' : 'paint', { ch: 0.04 });
      if (cls !== 'light') K.box([0, 0.24 * a, -0.55 * L], [0.3 * a, 0.1 * a, 0.45 * L], 'paint2', { ch: 0.03 });
      K.ram([0, -0.27 * a, -0.35], [0, -0.22 * a, -L + 0.08], 0.075 * a);
      K.cable([[-0.18 * a, -0.15 * a, -0.2], [-0.2 * a, -0.18 * a, -0.6 * L], [-0.14 * a, -0.12 * a, -L + 0.15]], 0.035);
      K.drum([0, 0, -L], 0.21 * a, 0.36 * a);
    });
    // ── the forearm, the hand and its gun: level and forward from the elbow (world axes, at the elbow)
    K.bone(`armLow${side}`);
    K.in(at(E), () => {
      const L = A.fo;
      K.box([0, 0.08, 0], [0.38 * a, 0.42 * a, 0.42 * a], 'gunmetal', { ch: 0.05 });
      const fc = [0, 0.5 * L, 0.02], fs = [0.5 * a, 0.8 * L, 0.48 * a];
      K.box(fc, fs, 'paint', { ch: 0.08 * a, taper: [0.92, 1] });
      K.on(fc, fs, '+x', () => { K.panel(-0.25 * L, -0.12 * a, 0.25 * L, 0.12 * a, 'paint2', 0.035); K.vent(0.28 * L, -0.1 * a, 0.36 * L, 0.1 * a, 3); });
      if (cls !== 'light') K.box([0, 0.52 * L, 0.27 * a], [0.36 * a, 0.62 * L, 0.08], 'paint2', { ch: 0.03 });
      if (cls === 'heavy') K.in(at([0.3 * a, 0.5 * L, 0.0]), () => { K.box([0, 0, 0], [0.14, 0.9 * L, 0.56 * a], 'paint', { ch: 0.05, taper: [1, 0.9] }); K.on([0, 0, 0], [0.14, 0.9 * L, 0.56 * a], '+x', () => K.rect(-0.35 * L, 0.18 * a, 0.35 * L, 0.24 * a, 'trim')); });
      // (the forearm's actuators bare underneath: two chrome rods between their blocks)
      for (const x of [-0.12 * a, 0.12 * a]) {
        K.cyl([x, 0.18, -0.27 * a], [x, L - 0.18, -0.27 * a], 0.045 * a, 0.045 * a, 'chrome', { n: 8 });
        K.box([x, L - 0.16, -0.27 * a], [0.12 * a, 0.12, 0.12 * a], 'gunmetal');
      }
      K.box([0, 0.2, -0.27 * a], [0.34 * a, 0.14, 0.14 * a], 'gunmetal', { ch: 0.02 });
      // (the wrist's collar and the fist round the grip)
      K.cyl([0, L - 0.08, 0], [0, L + 0.04, 0], 0.19 * a, 0.19 * a, 'chrome', { n: 10 });
      const G = [0, L + 0.2 * a, -0.04];
      K.box(add(G, [0, 0, 0.02]), [0.32 * a, 0.3 * a, 0.34 * a], 'gunmetal', { ch: 0.04 });
      for (let i = 0; i < 4; i++) K.box(add(G, [-0.12 * a + i * 0.08 * a, 0.14 * a, -0.06 * a]), [0.065 * a, 0.08 * a, 0.2 * a], 'dark', { ch: 0.01 });
      K.box(add(G, [-0.17 * a, 0.08 * a, 0.08 * a]), [0.07 * a, 0.18 * a, 0.08 * a], 'gunmetal', { ch: 0.01 });
      if (weapon) K.in(at(sub(sk.grip, E)), () => { sk.muzzles[`arm${side}`] = armWeapon(K, weapon, a); });
    });
  });
}

// ── the guns: each in its grip's frame (+y the bore, +z up, the hand at the origin); → its muzzle ──────────────────
function armWeapon(K, W, a) {
  const k = 0.88 + 0.12 * a, z = -0.26 * k;
  const grip = () => K.box([0, 0, -0.12 * k], [0.12, 0.16, 0.3 * k], 'dark', { ch: 0.02 });
  grip();
  switch (W.kind) {
    case 'shotgun': {
      K.box([0, 0.05, z], [0.4, 1.25, 0.46], 'gunmetal', { ch: 0.06 });
      K.on([0, 0.05, z], [0.4, 1.25, 0.46], '+x', () => { K.panel(-0.4, -0.12, 0.3, 0.12, 'paint2', 0.03); K.digits('12', 0.12, 0, 0.12); });
      K.cyl([0, 0.6, z + 0.03], [0, 1.85, z + 0.03], 0.19, 0.19, 'gunmetal', { n: 12 });
      K.cyl([0, 1.85, z + 0.03], [0, 2.02, z + 0.03], 0.23, 0.23, 'chrome', { n: 12 });
      K.cyl([0, 2.0, z + 0.03], [0, 2.03, z + 0.03], 0.13, 0.13, 'dark', { n: 12, caps: [false, true] });
      K.box([0, 1.05, z + 0.26], [0.3, 0.9, 0.06], 'paint2', { ch: 0.02 });
      K.on([0, 1.05, z + 0.26], [0.3, 0.9, 0.06], '+z', () => { for (let i = 0; i < 4; i++) K.rect(-0.1, -0.35 + i * 0.2, 0.1, -0.28 + i * 0.2, 'dark'); });
      // (the drum under it: a magazine's disc across the receiver)
      K.cyl([-0.17, 0.2, z - 0.42], [0.17, 0.2, z - 0.42], 0.3, 0.3, 'paint', { n: 14, smooth: true });
      K.cyl([0.17, 0.2, z - 0.42], [0.2, 0.2, z - 0.42], 0.18, 0.18, 'chrome', { n: 10, smooth: false });
      K.box([0, -0.7, z + 0.02], [0.3, 0.4, 0.34], 'paint', { ch: 0.05 });
      return [0, 2.03, z + 0.03];
    }
    case 'gatling': {
      K.box([0, -0.3, z], [0.5, 0.9, 0.5], 'gunmetal', { ch: 0.06 });
      K.cyl([0, 0.12, z], [0, 1.05, z], 0.3, 0.28, 'paint', { n: 14 });
      K.cyl([0, 1.05, z], [0, 1.12, z], 0.3, 0.3, 'chrome', { n: 14, smooth: false });
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2, x = Math.cos(ang) * 0.15, zz = z + Math.sin(ang) * 0.15;
        K.cyl([x, 1.0, zz], [x, 2.3, zz], 0.048, 0.048, 'gunmetal', { n: 6, caps: [false, true] });
      }
      K.cyl([0, 1.86, z], [0, 1.94, z], 0.22, 0.22, 'chrome', { n: 12, caps: [true, true] });
      K.cyl([0, 1.0, z], [0, 2.32, z], 0.05, 0.05, 'chrome', { n: 6 });
      // (the belt back to the drum on the forearm's side)
      const drum = [0.42, -0.85, z + 0.1];
      K.cyl(add(drum, [-0.18, 0, 0]), add(drum, [0.18, 0, 0]), 0.42, 0.42, 'paint', { n: 14 });
      K.cyl(add(drum, [0.18, 0, 0]), add(drum, [0.22, 0, 0]), 0.22, 0.22, 'chrome', { n: 10, smooth: false });
      for (let i = 0; i < 5; i++) K.box(lerp([0.24, -0.1, z - 0.05], add(drum, [-0.05, 0.36, -0.12]), i / 4), [0.12, 0.1, 0.08], i % 2 ? 'chrome' : 'gunmetal');
      return [0, 2.32, z];
    }
    case 'bazooka': {
      K.cyl([0, -1.25, z + 0.08], [0, 2.0, z + 0.08], 0.29, 0.29, 'paint', { n: 14 });
      K.bell([0, -1.15, z + 0.08], [0, -1.6, z + 0.08], 0.26, 0.36, { n: 12, glow: false });
      K.cyl([0, 1.95, z + 0.08], [0, 2.08, z + 0.08], 0.33, 0.33, 'gunmetal', { n: 14 });
      // (the rocket's nose seen in the mouth)
      K.cyl([0, 1.7, z + 0.08], [0, 2.06, z + 0.08], 0.2, 0.04, 'chrome', { n: 10, caps: [false, true] });
      for (const y of [-0.6, 0.4, 1.4]) K.cyl([0, y, z + 0.08], [0, y + 0.1, z + 0.08], 0.31, 0.31, 'trim', { n: 14, smooth: false });
      K.box([0.34, 0.3, z + 0.26], [0.12, 0.5, 0.22], 'gunmetal', { ch: 0.03 });
      K.box([0.41, 0.52, z + 0.28], [0.03, 0.06, 0.1], 'lens');
      K.box([0, 0.15, z - 0.28], [0.18, 0.5, 0.2], 'gunmetal', { ch: 0.03 });
      return [0, 2.08, z + 0.08];
    }
    case 'blade': {
      // (a blade: the emitter, a plated housing on the fist, and the edge out of it, a long white-hot slab; its tip the
      // muzzle, where the cut is reckoned from)
      K.box([0, 0.1, z], [0.42, 0.9, 0.46], 'paint', { ch: 0.06 });
      K.on([0, 0.1, z], [0.42, 0.9, 0.46], '+x', () => { K.panel(-0.32, -0.12, 0.3, 0.12, 'paint2', 0.03); K.rect(-0.1, -0.16, 0.18, -0.1, 'glow'); });
      K.cyl([0, 0.5, z], [0, 0.78, z], 0.2, 0.15, 'chrome', { n: 12 });
      for (const zz of [0.17, -0.17]) K.box([0, 0.66, z + zz], [0.34, 0.26, 0.05], 'gunmetal', { ch: 0.01 });
      K.box([0, 2.6, z], [0.07, 3.7, 0.26], 'glow', { ch: 0.02 });
      K.box([0, 2.6, z], [0.12, 3.6, 0.1], 'glow');
      K.cyl([0, 4.4, z], [0, 4.6, z], 0.1, 0.02, 'glow', { n: 6, caps: [false, true] });
      return [0, 4.6, z];
    }
    case 'laser': {
      K.box([0, -0.05, z], [0.32, 1.1, 0.38], 'paint', { ch: 0.05 });
      K.box([0, -0.4, z - 0.32], [0.26, 0.5, 0.28], 'gunmetal', { ch: 0.04 });
      K.on([0, -0.4, z - 0.32], [0.26, 0.5, 0.28], '+x', () => K.rect(-0.18, -0.06, 0.18, 0.06, 'glow'));
      K.cyl([0, 0.4, z], [0, 2.6, z], 0.065, 0.065, 'chrome', { n: 8 });
      // (the cooling fins: square plates stacked along the barrel, a lit coil between each pair)
      for (let i = 0; i < 9; i++) K.box([0, 0.65 + i * 0.13, z], [0.32, 0.035, 0.32], i % 3 === 0 ? 'chrome' : 'gunmetal', { ch: 0.01 });
      for (let i = 0; i < 8; i++) K.cyl([0, 0.7 + i * 0.13, z], [0, 0.73 + i * 0.13, z], 0.1, 0.1, 'glow', { n: 8, smooth: false, caps: [false, false] });
      K.cyl([0, 2.6, z], [0, 2.72, z], 0.09, 0.07, 'gunmetal', { n: 10 });
      K.cyl([0, 2.72, z], [0, 2.74, z], 0.05, 0.05, 'glow', { n: 8, smooth: false, caps: [false, true] });
      return [0, 2.74, z];
    }
    default: {
      // (a rifle: a long receiver, a box magazine, a muzzle brake; a sight on it)
      K.box([0, 0.15, z], [0.3, 1.5, 0.4], 'gunmetal', { ch: 0.05 });
      K.on([0, 0.15, z], [0.3, 1.5, 0.4], '+x', () => { K.panel(-0.55, -0.1, 0.2, 0.1, 'paint2', 0.03); K.digits('7', 0.4, 0.0, 0.12); });
      K.box([0, 1.15, z + 0.02], [0.24, 0.7, 0.28], 'paint', { ch: 0.04 });
      K.on([0, 1.15, z + 0.02], [0.24, 0.7, 0.28], '+x', () => K.vent(-0.25, -0.06, 0.25, 0.06, 2));
      K.cyl([0, 1.4, z + 0.03], [0, 2.6, z + 0.03], 0.075, 0.075, 'gunmetal', { n: 8 });
      K.cyl([0, 2.6, z + 0.03], [0, 2.86, z + 0.03], 0.12, 0.12, 'chrome', { n: 8, smooth: false });
      for (const y of [2.66, 2.74]) K.box([0, y, z + 0.03], [0.26, 0.03, 0.06], 'dark');
      K.box([0, 0.35, z - 0.42], [0.2, 0.36, 0.55], 'paint2', { ch: 0.03, shear: [0, 0.08] });
      K.cyl([0, -0.1, z + 0.3], [0, 0.45, z + 0.3], 0.07, 0.07, 'gunmetal', { n: 8 });
      K.cyl([0, 0.45, z + 0.3], [0, 0.48, z + 0.3], 0.06, 0.06, 'lens', { n: 8, smooth: false, caps: [false, true] });
      K.box([0, -0.75, z - 0.02], [0.22, 0.35, 0.32], 'paint', { ch: 0.04 });
      return [0, 2.86, z + 0.03];
    }
  }
}

// ── the shoulder weapons: each on its mount (its frame at the mount, +y forward); → its muzzle ─────────────────────
function backWeapon(K, W, s) {
  // (the mount: a pylon up off the back to the weapon's cradle)
  K.box([0, 0, 0.12], [0.3, 0.42, 0.3], 'gunmetal', { ch: 0.04 });
  K.cyl([0, 0, 0.26], [0, 0, 0.34], 0.2, 0.2, 'chrome', { n: 10 });
  switch (W.kind) {
    case 'grenade': {
      // (a short heavy barrel on a cradle, raised forward over the shoulder; its breech behind, recoil rods along it)
      K.box([0, 0, 0.42], [0.62, 0.7, 0.18], 'gunmetal', { ch: 0.04 });
      for (const sg of [-1, 1]) K.box([sg * 0.26, 0.05, 0.62], [0.08, 0.6, 0.38], 'paint2', { ch: 0.02 });
      K.drum([0, 0.05, 0.7], 0.11, 0.6, 'chrome');
      K.in(at([0, 0.05, 0.7], rx(0.22)), () => {
        K.box([0, -0.25, 0.02], [0.44, 0.7, 0.44], 'paint', { ch: 0.07 });
        K.on([0, -0.25, 0.02], [0.44, 0.7, 0.44], '+x', () => { K.hazard(-0.3, 0.08, 0.3, 0.16, 4); K.digits('40', 0, -0.06, 0.1); });
        K.cyl([0, 0.1, 0.02], [0, 1.45, 0.02], 0.27, 0.25, 'gunmetal', { n: 12 });
        K.cyl([0, 1.4, 0.02], [0, 1.6, 0.02], 0.31, 0.31, 'chrome', { n: 12 });
        K.cyl([0, 1.59, 0.02], [0, 1.61, 0.02], 0.18, 0.18, 'dark', { n: 12, caps: [false, true] });
        for (const sg of [-1, 1]) K.cyl([sg * 0.2, -0.05, -0.22], [sg * 0.2, 1.0, -0.2], 0.04, 0.04, 'chrome', { n: 8 });
      });
      const m = mv(rx(0.22), [0, 1.61, 0.02]);
      return add([0, 0.05, 0.7], m);
    }
    case 'plasma': {
      // (a bore wrapped in coils, its cell behind it, its lit window; cables from the cell to the coils)
      const z = 0.62;
      K.box([0, -0.45, z], [0.5, 0.7, 0.5], 'paint', { ch: 0.08 });
      K.on([0, -0.45, z], [0.5, 0.7, 0.5], '+x', () => { K.rect(-0.22, -0.08, 0.22, 0.08, 'glow'); K.rect(-0.26, 0.15, 0.26, 0.2, 'trim'); });
      K.cyl([0, -0.1, z], [0, 1.55, z], 0.15, 0.15, 'gunmetal', { n: 10 });
      for (let i = 0; i < 5; i++) {
        const y = 0.05 + i * 0.26;
        K.cyl([0, y, z], [0, y + 0.13, z], 0.27, 0.27, 'chrome', { n: 12 });
        K.cyl([0, y + 0.13, z], [0, y + 0.2, z], 0.22, 0.22, 'glow', { n: 12, smooth: false, caps: [false, false] });
      }
      K.cyl([0, 1.4, z], [0, 1.66, z], 0.22, 0.2, 'gunmetal', { n: 12 });
      K.cyl([0, 1.66, z], [0, 1.68, z], 0.12, 0.12, 'glow', { n: 10, smooth: false, caps: [false, true] });
      K.cable([[0.2, -0.15, z + 0.22], [0.26, 0.4, z + 0.32], [0.2, 1.0, z + 0.3]], 0.04);
      return [0, 1.68, z];
    }
    default: {
      // (a missile pod: four cells under a hatch, its noses in their cells)
      const c = [0, 0.18, 0.72], sz = [0.82, 1.2, 0.7];
      K.box(c, sz, 'paint', { ch: 0.07 });
      K.on(c, sz, '+x', () => { K.panel(-0.42, -0.2, 0.42, 0.18, 'paint2', 0.035); K.rect(-0.5, 0.22, 0.5, 0.28, 'trim'); K.digits('4', 0.3, -0.01, 0.14); });
      K.on(c, sz, '+y', () => {
        for (const u of [-0.17, 0.17]) for (const v of [-0.15, 0.15]) {
          K.rect(u - 0.13, v - 0.12, u + 0.13, v + 0.12, 'dark', 0.006);
          K.cyl([u, v, -0.05], [u, v, 0.08], 0.09, 0.02, 'chrome', { n: 8, caps: [false, true] });
        }
      });
      // (the hatch raised on its hinge)
      K.in(at([0, -0.4, 1.08], rx(0.18)), () => { K.box([0, 0.55, 0.02], [0.78, 1.1, 0.06], 'paint2', { ch: 0.02 }); });
      for (const sg of [-1, 1]) K.ram([sg * 0.3, -0.3, 0.9], [sg * 0.3, 0.2, 1.12], 0.03, { n: 6 });
      return add(c, [0, sz[1] / 2, 0]);
    }
  }
}

// ── the booster: on the back, its cowl and its bells (main: back and a little down) ────────────────────────────────
function booster(K, sk, id, cls) {
  K.bone('booster');
  const s = sk.s, B = sk.booster;
  const kind = id === 'bs-ox' ? 'heavy' : id === 'bs-falcon' ? 'light' : id === 'bs-kestrel' ? 'medium' : cls;
  const dir = unit([0, -0.86, -0.5]);
  K.in(at(B), () => {
    const cw = kind === 'heavy' ? 1.85 * s : kind === 'light' ? 1.15 * s : 1.5 * s, chh = kind === 'heavy' ? 1.6 * s : kind === 'light' ? 1.45 * s : 1.5 * s;
    // (the cowl: a plated hood over the engine block, its intakes on its shoulders, its number)
    K.box([0, -0.2, 0], [cw * 0.8, 0.45, chh * 0.9], 'gunmetal', { ch: 0.06 });
    const cc = [0, -0.58, 0.15], cs = [cw, 0.72, chh];
    K.box(cc, cs, 'paint', { ch: 0.1, taper: [0.9, 0.7] });
    K.on(cc, cs, '-y', () => {
      K.panel(-0.3 * cw, 0.0, 0.3 * cw, 0.35 * chh, 'paint2', 0.04);
      K.rect(-0.42 * cw, 0.39 * chh, 0.42 * cw, 0.44 * chh, 'trim');
      K.digits(kind === 'heavy' ? '6' : kind === 'light' ? '2' : '4', 0, 0.18 * chh, 0.16);
      for (const u of [-0.4 * cw, 0.4 * cw]) K.bolt(u, 0.3 * chh, 0.03);
    });
    for (const sg of [-1, 1]) {
      K.box([sg * (cw / 2 + 0.06), -0.45, 0.25], [0.14, 0.45, 0.5 * chh], 'gunmetal', { ch: 0.04 });
      K.on([sg * (cw / 2 + 0.06), -0.45, 0.25], [0.14, 0.45, 0.5 * chh], sg > 0 ? '+x' : '-x', () => K.vent(-0.18, -0.2 * chh, 0.18, 0.2 * chh, 4));
    }
    // (the bells, under the cowl's lower back)
    const bells = kind === 'heavy' ? { n: 6, cols: 3, rt: 0.15, rm: 0.27, L: 0.55, dx: 0.56 * s, dz: 0.56 }
      : kind === 'light' ? { n: 2, cols: 2, rt: 0.15, rm: 0.3, L: 1.2, dx: 0.48 * s, dz: 0 }
        : { n: 4, cols: 2, rt: 0.16, rm: 0.3, L: 0.62, dx: 0.6 * s, dz: 0.6 };
    const rows = bells.n / bells.cols;
    K.box([0, -0.82, -0.35 * chh], [cw * 0.85, 0.4, (rows === 1 ? 0.5 : 1.0) * chh * 0.6], 'gunmetal', { ch: 0.05 });
    for (let i = 0; i < bells.n; i++) {
      const c = i % bells.cols, r = Math.floor(i / bells.cols);
      const x = (c - (bells.cols - 1) / 2) * bells.dx, zz = -0.35 * chh + (r - (rows - 1) / 2) * bells.dz * (rows > 1 ? 1 : 0);
      const p0 = [x, -0.98, zz], p1 = add(p0, mul(dir, bells.L));
      K.cyl(add(p0, mul(dir, -0.1)), add(p0, mul(dir, 0.04)), bells.rt * 1.35, bells.rt * 1.35, 'gunmetal', { n: 10, smooth: false });
      K.bell(p0, p1, bells.rt, bells.rm, { n: 12 });
      if (kind === 'light') for (const tt of [0.3, 0.6]) K.cyl(lerp(p0, p1, tt), lerp(p0, p1, tt + 0.05), bells.rt + (bells.rm - bells.rt) * (tt * 0.6) + 0.03, bells.rt + (bells.rm - bells.rt) * (tt * 0.6) + 0.03, 'gunmetal', { n: 12, smooth: false });
      sk.thrusters.push({ bone: 'booster', at: add(B, p1), dir, r: bells.rm, kind: 'main' });
    }
  });
}

function leg(K, sk, sg, cls) {
  const side = sg > 0 ? 'R' : 'L', Lg = sk.Lg, t = Lg.t;
  const hip = sk.hip, knee = sk.knee, ankle = sk.ankle, L1 = sk.L1, L2 = sk.L2;
  K.in(at([0, 0, 0], sg < 0 ? MIRROR : I3), () => {
    // ── the thigh: its drum at the hip, a dark frame, plate on its front and outside, its knee's ram behind
    K.bone(`thigh${side}`);
    K.in(segFrame(hip, knee, [0, 1, 0]), () => {
      const t = Lg.t * 1.16;
      K.cyl([-0.12, 0, 0], [0.24, 0, 0], 0.3 * t, 0.3 * t, 'chrome', { n: 12 });
      K.ram([0.26 * t, 0.32 * t, -0.06], [0.3 * t, 0.4 * t, -0.58 * L1], 0.085 * t, { split: 0.38 });
      for (const y of [-0.1 * t, 0.12 * t]) K.ram([-0.3 * t, y, -0.18], [-0.31 * t, y + 0.02, -0.86 * L1], 0.07 * t, { split: 0.42 });
      K.box([0, -0.02, -0.5 * L1], [0.46 * t, 0.5 * t, L1 - 0.3], 'gunmetal', { ch: 0.05 });
      const fc = [-0.04 * t, 0.2 * t, -0.48 * L1], fs = [0.66 * t, 0.26 * t, 0.74 * L1];
      K.box(fc, fs, 'paint', { ch: 0.08, taper: [1.18, 1.12] });
      K.on(fc, fs, '+y', () => {
        K.panel(-0.18 * t, -0.2 * L1, 0.18 * t, 0.12 * L1, 'paint2', 0.04);
        for (const u of [-0.24 * t, 0.24 * t]) for (const v of [-0.3 * L1, 0.28 * L1]) K.bolt(u, v, 0.03);
        K.seam(-0.3 * t, 0.2 * L1, 0.3 * t, 0.2 * L1); K.seam(-0.3 * t, -0.26 * L1, 0.3 * t, -0.26 * L1);
        K.edge(-0.28 * t, 0.28 * t, -0.355 * L1, 0.045);
      });
      const oc = [0.3 * t, 0.0, -0.42 * L1], os = [0.14 * t, 0.62 * t, 0.62 * L1];
      K.box(oc, os, 'paint', { ch: 0.05 });
      K.on(oc, os, '+x', () => { K.panel(-0.2 * t, -0.18 * L1, 0.2 * t, 0.1 * L1, 'paint2', 0.035); K.rect(-0.26 * t, 0.2 * L1, 0.26 * t, 0.24 * L1, 'trim'); K.digits(side === 'R' ? '07' : '70', 0, -0.04 * L1, 0.14 * t); });
      if (cls === 'heavy') {
        // (wide plated thighs: a second layer on the front and a slab on the inside)
        K.in(at([0, 0.38 * t, -0.62 * L1], rx(-0.1)), () => K.box([0, 0, 0], [0.5 * t, 0.12, 0.36 * L1], 'paint2', { ch: 0.04 }));
        K.box([-0.29 * t, 0.02, -0.45 * L1], [0.1 * t, 0.55 * t, 0.55 * L1], 'paint2', { ch: 0.03 });
      }
      K.ram([0, -0.3 * t, -0.22], [0, -0.26 * t, -L1 + 0.12], 0.07 * t);
      K.cable([[-0.2 * t, -0.25 * t, -0.15], [-0.24 * t, -0.3 * t, -0.55 * L1], [-0.16 * t, -0.22 * t, -L1 + 0.2]], 0.04);
      K.drum([0, 0, -L1], 0.25 * t, 0.42 * t);
    });
    // ── the shin: broad toward the ankle (reverse-tapered), its knee cap, its calf's thrusters, the ankle's rams
    K.bone(`shin${side}`);
    K.in(segFrame(knee, ankle, [0, 1, 0]), () => {
      K.in(at([0, 0.36 * t, 0.04], rx(0.38)), () => {
        const c = [0, 0, 0], sz = [0.62 * t, 0.3 * t, 0.66];
        K.box(c, sz, 'paint2', { ch: 0.08, taper: [0.72, 0.7] });
        K.on(c, sz, '+y', () => { K.rect(-0.2 * t, 0.12, 0.2 * t, 0.18, 'trim'); K.bolt(0, -0.18, 0.03); });
      });
      K.box([0, -0.04, -0.46 * L2], [0.4 * t, 0.42 * t, L2 * 0.82], 'gunmetal', { ch: 0.04 });
      const sc = [0, 0.1 * t, -0.57 * L2], ss = [0.86 * t, 0.72 * t, 0.8 * L2];
      K.box(sc, ss, 'paint', { ch: 0.1, taper: [0.6, 0.62] });
      K.on(sc, ss, '+y', () => {
        K.panel(-0.2 * t, -0.3 * L2, 0.2 * t, 0.0, 'paint2', 0.045);
        K.edge(-0.2 * t, 0.2 * t, 0.36 * L2, 0.05); K.seam(-0.32 * t, -0.36 * L2, 0.32 * t, -0.36 * L2); K.seam(0, 0.02 * L2, 0, 0.3 * L2);
        K.rect(-0.22 * t, 0.06 * L2, 0.22 * t, 0.1 * L2, cls === 'heavy' ? 'trim' : 'stencil');
        for (const u of [-0.28 * t, 0.28 * t]) K.bolt(u, -0.34 * L2, 0.03);
      });
      K.on(sc, ss, '+x', () => { K.vent(-0.15 * t, -0.3 * L2, 0.1 * t, -0.12 * L2, 4); K.rect(-0.2 * t, 0.0, 0.2 * t, 0.03, 'trim'); });
      // (the calf: dark structure behind, the knee's ram up to the thigh, the ankle's twin rams down to the heel)
      K.box([0, -0.34 * t, -0.3 * L2], [0.38 * t, 0.3 * t, 0.42 * L2], 'gunmetal', { ch: 0.04 });
      K.ram([0, -0.32 * t, -0.52 * L2], [0, -0.22 * t, -0.04], 0.06 * t);
      for (const x of [-0.15 * t, 0.15 * t]) K.ram([x, -0.34 * t, -0.55 * L2], [x, -0.3 * t, -L2 + 0.12], 0.05 * t, { n: 6 });
      K.cable([[0.22 * t, -0.2 * t, -0.08], [0.3 * t, -0.25 * t, -0.5 * L2], [0.22 * t, -0.18 * t, -L2 + 0.2]], 0.035);
      // (the calf's verniers: a pod and its bell on a medium leg, small bells on the others)
      const pod = Lg.pod;
      const vp = [0, -0.5 * t, -0.62 * L2], vd = [0, -0.62, -0.78];
      if (pod) {
        K.box([0, -0.42 * t, -0.62 * L2], [0.46 * t, 0.28 * t, 0.5 * L2], 'paint', { ch: 0.06, taper: [0.8, 0.9] });
        K.on([0, -0.42 * t, -0.62 * L2], [0.46 * t, 0.28 * t, 0.5 * L2], '-y', () => K.vent(-0.14 * t, 0.02 * L2, 0.14 * t, 0.18 * L2, 3));
      }
      for (const x of pod ? [-0.11 * t, 0.11 * t] : [0]) {
        const p0 = add(vp, [x, pod ? -0.06 : 0, pod ? -0.18 * L2 : -0.1 * L2]);
        const rr = pod ? 0.1 : 0.07;
        K.bell(p0, add(p0, mul(unit(vd), rr * 2.2)), rr * 0.55, rr, { n: 10 });
        sk.legThrusters.push({ side, at: add(p0, mul(unit(vd), rr * 2.2)), dir: unit(vd), r: rr });
      }
      K.drum([0, 0, -L2], 0.2 * t, 0.36 * t);
    });
    // ── the foot: a broad plated foot over its dark sole, split toes, a heel spur (world axes at the ankle)
    K.bone(`foot${side}`);
    K.in(at(ankle), () => {
      const ha = Lg.ha, [heel, toe] = Lg.foot, fw = Lg.fw;
      K.box([0, 0, -ha * 0.45], [0.44 * t, 0.56 * t, ha * 0.7], 'gunmetal', { ch: 0.05 });
      K.box([0, (toe - heel) / 2, -ha + 0.09], [fw, toe + heel, 0.18], 'gunmetal', { ch: 0.04 });
      const tc = [0, toe * 0.2 - heel * 0.25, -ha + 0.3], ts = [fw * 0.92, (toe + heel) * 0.72, 0.28];
      K.box(tc, ts, 'paint', { ch: 0.07, taper: [0.78, 0.7] });
      K.on(tc, ts, '+x', () => { K.rect(-0.3 * ts[1], -0.06, 0.3 * ts[1], -0.02, 'trim'); K.bolt(0.38 * ts[1], 0.0, 0.025); });
      // (the toes, each a plate sloping down to its tip)
      const n = Lg.toes, tw = fw / n;
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * tw;
        K.in(at([x, toe - 0.3, -ha + 0.2], rx(-0.22)), () => { K.box([0, 0, 0], [tw * 0.9, 0.62, 0.2], 'paint2', { ch: 0.05, taper: [0.9, 1] }); });
        K.box([x, toe - 0.12, -ha + 0.07], [tw * 0.85, 0.26, 0.14], 'gunmetal', { ch: 0.03 });
      }
      // (the heel's spur and its plate)
      K.box([0, -heel + 0.1, -ha + 0.14], [fw * 0.6, 0.3, 0.28], 'gunmetal', { ch: 0.04 });
      K.in(at([0, -heel + 0.14, -ha + 0.36], rx(0.35)), () => K.box([0, 0, 0], [fw * 0.55, 0.12, 0.3], 'paint', { ch: 0.04 }));
      // (the ankle's guards each side)
      for (const sx of [-1, 1]) K.box([sx * 0.27 * t, 0.0, -ha * 0.35], [0.1, 0.48 * t, ha * 0.55], 'paint2', { ch: 0.03 });
    });
  });
}

/** Reverse-joint legs: the thigh slung back and down from the hip, the knee bent back as a bird's, a long shin forward
 *  and down to the raised ankle, a short metatarsal to the ball of a splayed three-toed foot, a spur behind. Chrome rams
 *  along the back of the thigh and the front of the shin; verniers on the shins' backs. */
function reverseLeg(K, sk, sg) {
  const side = sg > 0 ? 'R' : 'L', Lg = sk.Lg, t = Lg.t;
  const hip = sk.hip, knee = sk.knee, ankle = sk.ankle, L1 = sk.L1, L2 = sk.L2;
  K.in(at([0, 0, 0], sg < 0 ? MIRROR : I3), () => {
    // ── the thigh: a heavy drum at the hip, the thigh's plated mass, two rams down its back to the knee
    K.bone(`thigh${side}`);
    K.in(segFrame(hip, knee, [0, 1, 0]), () => {
      const tt = t * 1.2;
      K.drum([0.05, 0, 0], 0.34 * tt, 0.5 * tt);
      K.box([0, 0, -0.5 * L1], [0.5 * tt, 0.5 * tt, L1 - 0.35], 'gunmetal', { ch: 0.05 });
      const fc = [0, 0.16 * tt, -0.42 * L1], fs = [0.7 * tt, 0.42 * tt, 0.72 * L1];
      K.box(fc, fs, 'paint', { ch: 0.1, taper: [0.8, 0.75] });
      K.on(fc, fs, '+y', () => { K.panel(-0.2 * tt, -0.2 * L1, 0.2 * tt, 0.15 * L1, 'paint2', 0.04); K.seam(-0.32 * tt, -0.27 * L1, 0.32 * tt, -0.27 * L1); K.edge(-0.3 * tt, 0.3 * tt, 0.33 * L1, 0.045); for (const u of [-0.26 * tt, 0.26 * tt]) K.bolt(u, 0.25 * L1, 0.03); });
      const oc = [0.33 * tt, 0.04, -0.4 * L1], os = [0.14 * tt, 0.6 * tt, 0.62 * L1];
      K.box(oc, os, 'paint', { ch: 0.05, taper: [1, 0.85] });
      K.on(oc, os, '+x', () => { K.panel(-0.18 * tt, -0.18 * L1, 0.18 * tt, 0.1 * L1, 'paint2', 0.035); K.rect(-0.24 * tt, 0.18 * L1, 0.24 * tt, 0.22 * L1, 'trim'); K.digits(side === 'R' ? '07' : '70', 0, -0.04 * L1, 0.13 * tt); });
      for (const x of [-0.16 * tt, 0.16 * tt]) K.ram([x, -0.32 * tt, -0.12], [x, -0.3 * tt, -L1 + 0.12], 0.08 * tt, { split: 0.45 });
      K.cable([[-0.3 * tt, -0.2 * tt, -0.15], [-0.32 * tt, -0.22 * tt, -0.55 * L1], [-0.2 * tt, -0.15 * tt, -L1 + 0.2]], 0.04);
      K.drum([0, 0, -L1], 0.27 * t, 0.46 * t);
    });
    // ── the shin: long, forward and down; its greave on its front, rams beside it, a spur of armour behind the knee
    K.bone(`shin${side}`);
    const ST = segFrame(knee, ankle, [0, 1, 0]);
    K.in(ST, () => {
      K.box([0, -0.02, -0.48 * L2], [0.38 * t, 0.38 * t, L2 * 0.9], 'gunmetal', { ch: 0.04 });
      const gc = [0, 0.16 * t, -0.5 * L2], gs = [0.56 * t, 0.26 * t, 0.78 * L2];
      K.box(gc, gs, 'paint', { ch: 0.08, taper: [1.25, 1.3] });
      K.on(gc, gs, '+y', () => {
        K.panel(-0.14 * t, -0.25 * L2, 0.14 * t, 0.12 * L2, 'paint2', 0.04);
        K.edge(-0.2 * t, 0.2 * t, 0.36 * L2, 0.05); K.seam(-0.25 * t, -0.3 * L2, 0.25 * t, -0.3 * L2);
        K.rect(-0.2 * t, 0.22 * L2, 0.2 * t, 0.26 * L2, 'trim');
      });
      K.on(gc, gs, '+x', () => K.vent(-0.2 * L2, -0.06 * t, -0.05 * L2, 0.06 * t, 3));
      for (const x of [-0.27 * t, 0.27 * t]) K.ram([x, 0.24 * t, -0.08], [x, 0.22 * t, -0.86 * L2], 0.06 * t, { split: 0.5 });
      // (behind the knee: its cap, a wedge of plate standing back, as the knee is the leg's back)
      K.in(at([0, -0.28 * t, 0.05], rx(-0.5)), () => { K.box([0, 0, 0], [0.5 * t, 0.36 * t, 0.62], 'paint2', { ch: 0.07, taper: [0.7, 0.6] }); K.on([0, 0, 0], [0.5 * t, 0.36 * t, 0.62], '-y', () => K.rect(-0.14 * t, 0.12, 0.14 * t, 0.17, 'trim')); });
      K.cable([[0.22 * t, -0.18 * t, -0.1], [0.24 * t, -0.2 * t, -0.5 * L2], [0.2 * t, -0.15 * t, -L2 + 0.25]], 0.035);
      // (the shin's verniers: a pod on its back below the knee, two bells back and down)
      const pc = [0, -0.3 * t, -0.3 * L2], ps = [0.42 * t, 0.26 * t, 0.36 * L2];
      K.box(pc, ps, 'paint', { ch: 0.05 });
      K.on(pc, ps, '-y', () => K.vent(-0.12 * t, -0.05 * L2, 0.12 * t, 0.1 * L2, 3));
      const vd = unit(mtv(ST.m, [0, -0.55, -0.83]));
      for (const x of [-0.1 * t, 0.1 * t]) {
        const p0 = [x, -0.42 * t, -0.42 * L2], rr = 0.1;
        K.bell(p0, add(p0, mul(vd, rr * 2.2)), rr * 0.55, rr, { n: 10 });
        sk.legThrusters.push({ side, at: add(p0, mul(vd, rr * 2.2)), dir: vd, r: rr });
      }
      K.drum([0, 0, -L2], 0.23 * t, 0.4 * t);
    });
    // ── the foot: the metatarsal down to its ball, three toes splayed from it, a spur behind (world axes at the ankle)
    K.bone(`foot${side}`);
    K.in(at(ankle), () => {
      // (the ball under the metatarsal's raked end, on its pad above the ground)
      const ha = Lg.ha, [heel, toe] = Lg.foot, [ml, mr] = Lg.meta ?? [0.85, 30], ball = [0, ml * Math.sin(mr * DEG), -ha + 0.26];
      K.in(segFrame([0, 0, 0], ball, [0, 1, 0]), () => {
        const Lm = len(ball);
        K.box([0, 0, -0.5 * Lm], [0.36 * t, 0.36 * t, Lm + 0.1], 'gunmetal', { ch: 0.05 });
        K.box([0, 0.12 * t, -0.48 * Lm], [0.42 * t, 0.18 * t, Lm * 0.8], 'paint', { ch: 0.05 });
        for (const x of [-0.2 * t, 0.2 * t]) K.ram([x, 0.05, -0.05], [x, 0.08, -Lm + 0.08], 0.045 * t, { n: 6 });
      });
      K.cyl(add(ball, [-0.22 * t, 0, 0]), add(ball, [0.22 * t, 0, 0]), 0.16 * t, 0.16 * t, 'chrome', { n: 10 });
      K.box(add(ball, [0, -0.05, -0.12]), [0.44 * t, 0.42, 0.18], 'seal', { ch: 0.04 });
      // (the toes: one forward, two splayed, each a plate and a dark claw)
      for (const a of [-30 * DEG, 0, 30 * DEG]) {
        const Lt = a === 0 ? toe : toe * 0.82;
        K.in(at(ball, rz(-a)), () => {
          K.box([0, Lt * 0.42, -0.14], [0.3 * t, Lt * 0.78, 0.24], 'paint2', { ch: 0.06, taper: [0.85, 0.9] });
          K.on([0, Lt * 0.42, -0.14], [0.3 * t, Lt * 0.78, 0.24], '+z', () => { K.rect(-0.04 * t, -0.25 * Lt, 0.04 * t, 0.25 * Lt, 'trim'); K.bolt(0, -0.3 * Lt, 0.025); });
          K.in(at([0, Lt * 0.86, -0.135], rx(-0.3)), () => K.box([0, 0, 0], [0.24 * t, 0.3, 0.15], 'gunmetal', { ch: 0.03, taper: [0.6, 0.6] }));
        });
      }
      // (the spur: back off the ankle's foot, down to the ground behind)
      K.in(at([0, -0.08, -ha + 0.3], rx(0.32)), () => {
        K.box([0, -heel * 0.45, 0], [0.26 * t, heel * 0.9, 0.2], 'paint2', { ch: 0.05 });
        K.box([0, -heel * 0.95, 0.012], [0.2 * t, 0.22, 0.14], 'gunmetal', { ch: 0.03 });
      });
      for (const sx of [-1, 1]) K.box([sx * 0.25 * t, 0.02, -0.05], [0.1, 0.46 * t, 0.4], 'paint2', { ch: 0.03 });
    });
  });
}

// ── the body ───────────────────────────────────────────────────────────────────────────────────────────────────────
const BONE_ORDER = f(['root', 'core', 'head', 'booster', 'armUpR', 'armLowR', 'armUpL', 'armLowL', 'backR', 'backL', 'thighR', 'shinR', 'footR', 'thighL', 'shinL', 'footL']);
const PARENT = f({ root: null, core: 'root', head: 'core', booster: 'core', armUpR: 'core', armLowR: 'armUpR', armUpL: 'core', armLowL: 'armUpL', backR: 'core', backL: 'core', thighR: 'root', shinR: 'thighR', footR: 'shinR', thighL: 'root', shinL: 'thighL', footL: 'shinL' });

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// the plain key a page that does not light reads the frame under: from ahead, the left and above
const KEY = unit([-0.42, 0.55, 0.72]);
function bakeFill(albedo, slot, n) {
  const c = hexRgb(albedo);
  if (slot === 'glow') return albedo;
  const lam = Math.max(0, dot(n, KEY));
  if (slot === 'chrome') return rgbHex(c.map((v) => v * (0.3 + 0.35 * lam + 0.45 * Math.max(0, n[2]) ** 2)));
  if (slot === 'lens') return rgbHex(c.map((v) => v * 1.2 + 20 * Math.max(0, n[2])));
  return rgbHex(c.map((v) => v * (0.42 + 0.62 * lam)));
}

export function readFrameLook({ palette, wear } = {}, at = 'frame') {
  if (palette !== undefined && !FRAME_PALETTES[palette]) throw new Error(`${at}.palette is one of ${Object.keys(FRAME_PALETTES).join(', ')}`);
  if (wear !== undefined && !FRAME_WEARS.includes(wear)) throw new Error(`${at}.wear is one of ${FRAME_WEARS.join(', ')}`);
  return { palette: palette ?? 'federation', wear: wear ?? 'used' };
}

export function frameBody(build, { palette, wear } = {}) {
  const B = readBuild(build), look = readFrameLook({ palette, wear }), C = FRAME_PALETTES[look.palette], Wr = WEAR[look.wear];
  const sk = skeleton(B);
  sk.thrusters = []; sk.legThrusters = []; sk.muzzles = {};
  const K = makeKit();
  const cls = (slot) => classOf(slot, B[slot]);
  pelvis(K, sk, cls('legs'));
  core(K, sk, B.core, cls('core'));
  if (B.head) head(K, sk, B.head, cls('head'));
  booster(K, sk, B.booster, cls('booster'));
  for (const sg of [1, -1]) arm(K, sk, sg, B.arms, cls('arms'), B[sg > 0 ? 'armR' : 'armL'] ? partOf(sg > 0 ? 'armR' : 'armL', B[sg > 0 ? 'armR' : 'armL']) : null);
  for (const [slot, sg] of [['backR', 1], ['backL', -1]]) {
    if (!B[slot]) continue;
    K.bone(slot);
    K.in(at([0, 0, 0], sg < 0 ? MIRROR : I3), () => K.in(at(sk.mount), () => {
      const muzzle = backWeapon(K, partOf(slot, B[slot]), sk.s);
      sk.muzzles[slot] = add(sk.mount, muzzle);
    }));
    sk.muzzles[slot] = [sg * sk.muzzles[slot][0], sk.muzzles[slot][1], sk.muzzles[slot][2]];
  }
  for (const sg of [1, -1]) (sk.joint === 'reverse' ? reverseLeg : leg)(K, sk, sg, cls('legs'));

  // the bones: each joint's pivot (a left one the right's, mirrored)
  const L = (p) => [-p[0], p[1], p[2]];
  const heads = {
    root: sk.root, core: sk.core, head: sk.neck, booster: sk.booster,
    armUpR: sk.shoulder, armLowR: sk.elbow, armUpL: L(sk.shoulder), armLowL: L(sk.elbow),
    backR: sk.mount, backL: L(sk.mount),
    thighR: sk.hip, shinR: sk.knee, footR: sk.ankle, thighL: L(sk.hip), shinL: L(sk.knee), footL: L(sk.ankle),
  };
  const bones = BONE_ORDER.filter((id) => K.byBone.has(id) && K.byBone.get(id).length).map((id) => ({ id, head: heads[id].map(r4) }));

  // the faces: each its slot and its colour, worn by its wear's dice (rubbed edges, a grime, soot round the bells)
  const roll = mulberry32(strHash(`assault-frame|${JSON.stringify(B)}|${look.palette}|${look.wear}`));
  const faces = new Map();
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const { id } of bones) {
    faces.set(id, K.byBone.get(id).map((fc) => {
      const slot = ROLE_SLOT[fc.role];
      let c = hexRgb(C[fc.role]);
      const d = roll();
      if (slot === 'paint' && fc.edge && d < 0.6) c = mix(c, hexRgb(C.chrome), Wr.edge);
      else if (slot === 'paint' && d > 1 - Wr.grime) c = mul(c, 0.86);
      if (id === 'booster' && (slot === 'chrome' || slot === 'paint') && Wr.soot && fc.outNormal[1] < -0.3) c = mix(c, hexRgb(C.dark), Wr.soot * 0.5);
      const albedo = rgbHex(c), corners = fc.corners.map((p) => p.map(r4));
      for (const p of corners) for (let k = 0; k < 3; k++) { if (p[k] < lo[k]) lo[k] = p[k]; if (p[k] > hi[k]) hi[k] = p[k]; }
      return {
        corners, material: slot, albedo, fill: bakeFill(albedo, slot, fc.outNormal), outNormal: fc.outNormal.map(r4),
        ...(fc.cn ? { cornerNormals: fc.cn.map((v) => unit(v).map(r4)) } : {}),
      };
    }));
  }

  // the mounts: each carried weapon's muzzle
  const mounts = {};
  for (const s of WEAPON_SLOTS) {
    if (!B[s] || !sk.muzzles[s]) continue;
    const isArm = s.startsWith('arm'), sg = s.endsWith('R') ? 1 : -1;
    let p = sk.muzzles[s];
    if (isArm) p = add(sk.grip, p);
    if (isArm && sg < 0) p = L(p);
    mounts[s] = { bone: isArm ? `armLow${s.slice(3)}` : s, at: p.map(r4), dir: [0, 1, 0] };
  }

  // the thrusters: the booster's bells, the verniers on the back, the shoulders and the shins (left ones mirrored)
  const halfOf = (d, r) => d.map((v) => r4(r * Math.sqrt(Math.max(0, 1 - v * v))));
  const thrusters = [];
  for (const th of sk.thrusters) {
    if (th.T) {
      // (a shoulder's vernier, drawn in the upper arm's frame: carried out to the frame, and mirrored for the left)
      const T = segFrame(sk.shoulder, sk.elbow, [0, 1, 0]);
      const p = tx(T, th.at), d = unit(mv(T.m, th.dir));
      thrusters.push({ bone: 'armUpR', at: p.map(r4), dir: d.map(r4), half: halfOf(d, th.r), kind: 'vernier' });
      thrusters.push({ bone: 'armUpL', at: L(p).map(r4), dir: L(d).map(r4), half: halfOf(d, th.r), kind: 'vernier' });
    } else thrusters.push({ bone: th.bone, at: th.at.map(r4), dir: th.dir.map(r4), half: halfOf(th.dir, th.r), kind: th.kind });
  }
  const shinT = segFrame(sk.knee, sk.ankle, [0, 1, 0]);
  for (const th of sk.legThrusters) {
    if (th.side !== 'R') continue;
    const p = tx(shinT, th.at), d = unit(mv(shinT.m, th.dir));
    thrusters.push({ bone: 'shinR', at: p.map(r4), dir: d.map(r4), half: halfOf(d, th.r), kind: 'vernier' });
    thrusters.push({ bone: 'shinL', at: L(p).map(r4), dir: L(d).map(r4), half: halfOf(d, th.r), kind: 'vernier' });
  }

  // (the soles stand on z = 0: the frame was laid out so, and the bounds say how far it reaches)
  const height = r4(hi[2]);
  return {
    build: B, palette: look.palette, wear: look.wear,
    bones, faces, mounts, thrusters, height, hips: r4(sk.H),
    footprint: { L: r4(hi[1] - lo[1]), W: r4(hi[0] - lo[0]), H: r4(hi[2] - Math.min(0, lo[2])) },
    rig: {
      parent: PARENT,
      legs: { joint: sk.joint, bend: sk.bend, L1: r4(sk.L1), L2: r4(sk.L2), hip: sk.hip.map(r4), knee: sk.knee.map(r4), ankle: sk.ankle.map(r4) },
      grip: sk.grip.map(r4),
    },
  };
}

/** How many faces a frame is drawn with (its bones' together). */
export const frameFaceCount = (body) => [...body.faces.values()].reduce((a, fs) => a + fs.length, 0);
