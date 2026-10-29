/**
 * THE FEATURE FACE: the feature style's eyes, lids and brows (docs/mascot.md, the feature style). The eye is a GLOBE and
 * everything about it turns about the globe's centre, as feature animation draws and moves an eye:
 *
 *   the globe   a ball whose pole is the gaze, toed in a little: the sclera, then the iris and the pupil as rings about
 *               the pole (their edges clean circles), on the eye's own bone (`eye$S`); the catchlight a small bright
 *               lens on it toward the key light
 *   the lids    each a closed SHELL a little larger than the globe, a lune of the sphere about the globe's centre between
 *               its back (hidden in the skin) and its edge, the edge arched (its corners lower than its middle) and rolled
 *               into a lip; the two lids' lunes meet at the eye's corners. A lid closes by TURNING about the globe's
 *               centre (`lid$S`, `lidLow$S`: degrees down and up), and tilts about the gaze (`lidTilt$S`: degrees the
 *               inner end drops), so it slides round the egg and never leaves it
 *   the brows   a soft bar over each eye ATTACHED TO THE EYE: it turns about the same centre (`browLift$S`: degrees up;
 *               `brow$S`: degrees the inner end drops), so a brow pressing down rides the lid it presses on
 *
 *   featureFace({ eggsField, H, eye, rest, groups, mouth })   → { segments, joints, bones, chains, channels(name),
 *                                                                blink(), eyes } (the face mascot-form.js rigOf plays)
 *   FEATURE_FACE    the expressions as lid closures (upper 0 open … 1 shut, below 0 wider), the lower lid's rise, the brows
 *
 * The mouth is the mascot's (mascot-face.js buildFace): a dark lens with its tongue, under two lips, on the muzzle.
 * Pure and deterministic.
 */
import { buildFace, EXPRESSION_FACE, EXPRESSION_IDS } from './mascot-face.js';

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const r6 = (x) => Math.round(x * 1e6) / 1e6 + 0;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const rad = (d) => (d * Math.PI) / 180;
const turnZ = (v, a) => { const c = Math.cos(rad(a)), s = Math.sin(rad(a)); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]]; };
const side = (v, S) => (v && typeof v === 'object' && !Array.isArray(v) && S in v ? v[S] : v);

/** The expressions on the feature face: `lid` the upper lid's closure (0 at rest over the iris's top, 1 shut, below 0
 *  wider: the white shows over the iris), `low` the lower lid's rise (0 … 1: to meet a shut upper lid), the brows' lift
 *  and tilt (degrees; the inner end drops by the tilt); a side each where they differ. First readings for the eyes gate. */
export const FEATURE_FACE = Object.freeze({
  happy: { lid: 0.1, low: 0.25, brow: { lift: 5, tilt: -6 } },
  joy: { lid: 0.88, low: 0.55, brow: { lift: 9, tilt: -6 } },
  grin: { lid: 0.15, low: 0.35, brow: { lift: 6, tilt: -4 } },
  content: { lid: 0.45, low: 0.3, brow: { lift: 0, tilt: -3 } },
  determined: { lid: 0.32, low: 0.2, brow: { lift: -5, tilt: 16 } },
  smirk: { lid: { R: 0.08, L: 0.5 }, low: { R: 0.2, L: 0.4 }, brow: { R: { lift: 11, tilt: -8 }, L: { lift: -4, tilt: 12 } } },
  surprised: { lid: -0.45, low: 0, brow: { lift: 16, tilt: -4 } },
  sad: { lid: 0.35, low: 0.1, brow: { lift: 4, tilt: -18 } },
  angry: { lid: 0.35, low: 0.3, brow: { lift: -9, tilt: 24 } },
  sleepy: { lid: 0.75, low: 0.2, brow: { lift: -3, tilt: -2 } },
});

/** the eye's measures, in its globe's radius: the iris's and the pupil's half-angles (degrees from the gaze); the lids'
 *  shell (inner and outer radius, the arch of their edges, degrees), the upper lid's edge from the top (open, shut) and
 *  the lower's (open), the brow's place (degrees above the gaze's level, seated on the skin, its middle sunk in it by a share of its thickness)
 *  and its size */
export const FEATURE_EYE = Object.freeze({ iris: 34, pupil: 17, toe: 3, shell: [1.05, 1.13], arch: 14, upper: [60, 103], lower: 128, back: 70, brow: { at: 50, sink: 0.12, r: [1.05, 0.3, 0.36] }, catch: 0.2 });

/** a closed ball mesh about c, its pole along a (unit), the rings at the polar angles given (degrees), `seg` round */
function ballMesh(c, a, b, radii, rings, seg, groupOf = () => null) {
  const w = cross(a, b), points = {}, normals = {}, faces = {}, groups = {}, [ra, rb, rc] = radii;
  const at = (al, be) => { const ca = Math.cos(rad(al)), sa = Math.sin(rad(al)), cb = Math.cos(be), sb = Math.sin(be);
    const l = [ra * ca, rb * sa * cb, rc * sa * sb], n = unit([l[0] / (ra * ra), l[1] / (rb * rb), l[2] / (rc * rc)]);
    return [add(c, add(mul(a, l[0]), add(mul(b, l[1]), mul(w, l[2])))), add(mul(a, n[0]), add(mul(b, n[1]), mul(w, n[2])))]; };
  const put = (id, [p, n]) => { points[id] = p.map(r6); normals[id] = unit(n).map(r4); };
  put('n', at(0, 0)); put('s', at(180, 0));
  rings.forEach((al, i) => { for (let j = 0; j < seg; j++) put(`r${i}_${j}`, at(al, (2 * Math.PI * j) / seg)); });
  let f = 0;
  const tri = (x, y, z, g) => { const id = `f${f++}`, P = [x, y, z].map((v) => points[v]), N = cross(sub(P[1], P[0]), sub(P[2], P[0])), o = sub(P[0], c);
    faces[id] = dot(N, o) >= 0 ? [x, y, z] : [x, z, y]; if (g) groups[id] = g; };
  for (let j = 0; j < seg; j++) tri('n', `r0_${j}`, `r0_${(j + 1) % seg}`, groupOf(0));
  for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < seg; j++) {
    const g = groupOf((rings[i] + rings[i + 1]) / 2), a0 = `r${i}_${j}`, a1 = `r${i}_${(j + 1) % seg}`, b0 = `r${i + 1}_${j}`, b1 = `r${i + 1}_${(j + 1) % seg}`;
    tri(a0, b0, b1, g); tri(a0, b1, a1, g);
  }
  const L = rings.length - 1;
  for (let j = 0; j < seg; j++) tri('s', `r${L}_${(j + 1) % seg}`, `r${L}_${j}`, groupOf(180));
  return { points, faces, groups, normals };
}

/** a LID: a closed shell, a lune of the sphere about G between its back φa and its edge φe (degrees from the top, about
 *  the across axis X: 0 up, 90 the gaze's level, 180 down), the edge arched, the lip rolled; ψ across, the corners capped */
function lidMesh(G, X, U, F, { rIn, rOut, back, edge, arch, cols = 22, rows = 9 }) {
  const s = Math.sign(edge - back), P = [], points = {}, faces = {}, normals = {};
  const at = (r, psi, phi) => { const cp = Math.cos(rad(psi)), sp = Math.sin(rad(psi)), cf = Math.cos(rad(phi)), sf = Math.sin(rad(phi));
    return add(G, mul(add(mul(X, sp), mul(add(mul(U, cf), mul(F, sf)), cp)), r)); };
  const PSI = 82, rm = (rIn + rOut) / 2, h = (rOut - rIn) / 2, lipDeg = (h / rm) * (180 / Math.PI);
  for (let i = 0; i <= cols; i++) {
    const psi = -PSI + (2 * PSI * i) / cols, q = psi / PSI, e = edge + s * arch * q * q, loop = [];
    for (let k = 0; k <= rows; k++) loop.push([rOut, back + ((e - back) * k) / rows]);
    for (let k = 1; k < 6; k++) { const t = (Math.PI * k) / 6; loop.push([rm + h * Math.cos(t), e + s * lipDeg * Math.sin(t)]); }
    for (let k = rows; k >= 0; k--) loop.push([rIn, back + ((e - back) * k) / rows]);
    P.push(loop.map(([r, phi]) => at(r, psi, phi)));
  }
  const n = P[0].length, id = (i, k) => `p${i}_${k}`;
  P.forEach((loop, i) => loop.forEach((p, k) => { points[id(i, k)] = p.map(r6); }));
  const capA = P[0].reduce((m, p) => add(m, mul(p, 1 / n)), [0, 0, 0]), capB = P[cols].reduce((m, p) => add(m, mul(p, 1 / n)), [0, 0, 0]);
  points.ca = capA.map(r6); points.cb = capB.map(r6);
  for (let i = 0; i < cols; i++) for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; faces[`f${2 * (i * n + k)}`] = [id(i, k), id(i + 1, k), id(i + 1, k1)]; faces[`f${2 * (i * n + k) + 1}`] = [id(i, k), id(i + 1, k1), id(i, k1)]; }
  for (let k = 0; k < n; k++) { faces[`a${k}`] = ['ca', id(0, (k + 1) % n), id(0, k)]; faces[`b${k}`] = ['cb', id(cols, k), id(cols, (k + 1) % n)]; }
  // (wound one way throughout; turned over whole if that way is inward: the signed volume)
  let vol = 0; for (const t of Object.values(faces)) { const Q = t.map((v) => sub(points[v], G)); vol += dot(Q[0], cross(Q[1], Q[2])); }
  if (vol < 0) for (const k of Object.keys(faces)) { const t = faces[k]; faces[k] = [t[0], t[2], t[1]]; }
  // (a lid's normals: its faces' about each point, area-weighted)
  const acc = Object.fromEntries(Object.keys(points).map((k) => [k, [0, 0, 0]]));
  for (const t of Object.values(faces)) { const Q = t.map((v) => points[v]), N = cross(sub(Q[1], Q[0]), sub(Q[2], Q[0])); for (const v of t) acc[v] = add(acc[v], N); }
  for (const [k, v] of Object.entries(acc)) normals[k] = unit(v).map(r4);
  return { points, faces, normals };
}

/** a mesh mirrored to the left: x negated, each face turned over, its groups kept */
const mirrorMesh = (M) => ({ points: Object.fromEntries(Object.entries(M.points).map(([k, p]) => [k, [-p[0] + 0, p[1], p[2]]])),
  faces: Object.fromEntries(Object.entries(M.faces).map(([k, t]) => [k, [t[0], t[2], t[1]]])),
  ...(M.groups ? { groups: { ...M.groups } } : {}), normals: Object.fromEntries(Object.entries(M.normals).map(([k, n]) => [k, [-n[0] + 0, n[1], n[2]]])) });
const mx = (p) => [-p[0] + 0, p[1], p[2]];

/**
 * The face for a skin (its field, to seat the globes on it), the head H (its centre, for the eyes' directions), the eye
 * (its azimuth and elevation on the head, degrees; its globe's radius, metres), the rest expression, the groups (lid,
 * brow) and the mouth (the muzzle's ellipsoid: buildFace's).
 */
export function featureFace({ field, H, eye, rest = 'happy', groups, mouth }) {
  const C = FEATURE_EYE, E = FEATURE_FACE, restE = E[rest] ?? E.happy, rg = eye.r;
  // the globe's centre: along the eye's direction from the head's centre to the skin, then in by its proud share
  const dir = unit([Math.cos(rad(eye.el)) * Math.sin(rad(eye.az)), Math.cos(rad(eye.el)) * Math.cos(rad(eye.az)), Math.sin(rad(eye.el))]);
  let lo = 0, hi = 2 * Math.max(H.rx, H.ry, H.rz);
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2, p = add(H.C, mul(dir, m)); (field({ x: p[0], y: p[1], z: p[2] }) < 0 ? (lo = m) : (hi = m)); }
  const surf = add(H.C, mul(dir, lo)), G = add(surf, mul(dir, -rg * (1 - eye.proud)));
  const X = [1, 0, 0], g = unit(turnZ([0, 1, 0], C.toe)), F = unit(sub(g, mul(X, dot(g, X)))), U = cross(X, F);
  const segments = [], joints = {}, bones = [], chains = {};
  const J = (name, p) => { joints[name] = { at: p.map(r4), rides: 'head' }; };
  // the lid's edge from the top at a closure, the lower lid's at its rise (it meets a shut upper lid at its rise of 1)
  const upAt = (c) => C.upper[0] + c * (C.upper[1] - C.upper[0]), lowAt = (c) => C.lower - c * (C.lower - C.upper[1]);
  const restOf = (S) => ({ up: upAt(side(restE.lid, S)), low: lowAt(side(restE.low, S)), brow: side(restE.brow, S) });
  const R0 = restOf('R');
  // THE GLOBE (the right's, mirrored): the sclera, the iris and the pupil as rings about the gaze
  const rings = [C.pupil * 0.5, C.pupil, (C.pupil + C.iris) / 2, C.iris, 50, 70, 90, 110, 130, 150, 165];
  const globe = ballMesh(G, g, U, [rg, rg, rg], rings, 28, (al) => (al < C.pupil ? 'Pupil' : al < C.iris ? 'Iris' : null));
  // (the catchlight: a small bright lens on the cornea toward the key light, up and to the figure's right)
  const lc = unit(add(g, add(mul(U, 0.42), mul(X, 0.3)))), catchlight = ballMesh(add(G, mul(lc, rg * 1.005)), lc, U, [rg * 0.03, rg * C.catch, rg * C.catch * 0.8], [30, 60, 90, 120, 150], 12);
  // THE LIDS at rest: lunes about G, the upper's back over the top and behind it, the lower's under and behind
  const upper = lidMesh(G, X, U, F, { rIn: rg * C.shell[0], rOut: rg * C.shell[1], back: -C.back, edge: R0.up, arch: C.arch });
  const lower = lidMesh(G, X, U, F, { rIn: rg * C.shell[0], rOut: rg * C.shell[1], back: 180 + C.back, edge: R0.low, arch: C.arch * 0.8 });
  // THE BROW: a soft bar over the eye, set by its rest lift (degrees about the globe's across axis) and tilt
  const B = C.brow, browDir = (lift) => { const phi = 90 - B.at - lift; return unit(add(mul(U, Math.cos(rad(phi))), mul(F, Math.sin(rad(phi))))); };
  // (seated on the skin along its direction from the globe's centre, at its rest lift)
  const reach = (d) => { let a = 0, b = 4 * rg; for (let i = 0; i < 40; i++) { const m = (a + b) / 2, p = add(G, mul(d, m)); (field({ x: p[0], y: p[1], z: p[2] }) < 0 ? (a = m) : (b = m)); } return a; };
  const browAt = (lift, tilt) => { const d = browDir(lift), c0 = add(G, mul(d, reach(d) + rg * B.r[1] * (1 - 2 * B.sink))), al = unit(add(mul(X, Math.cos(rad(tilt))), mul(U, -Math.sin(rad(tilt)))));   // (+ tilt: the inner end (−x) drops)
    return ballMesh(c0, al, d, B.r.map((x) => x * rg), [20, 45, 70, 90, 110, 135, 160], 14); };
  const bLift = R0.brow.lift ?? 0, bTilt = R0.brow.tilt ?? 0, brow = browAt(bLift, bTilt);
  for (const S of ['R', 'L']) {
    const m = S === 'R' ? (p) => p : mx, mm = S === 'R' ? (M) => M : mirrorMesh, R = restOf(S);
    J(`eyeC${S}`, m(G)); J(`eyeTip${S}`, m(add(G, mul(g, rg)))); J(`lidTip${S}`, m(add(G, mul(U, rg * 1.3)))); J(`lidLowTip${S}`, m(add(G, mul(U, -rg * 1.3)))); J(`browTip${S}`, m(add(G, mul(U, rg * 1.6))));
    bones.push({ id: `eye${S}`, head: `eyeC${S}`, tail: `eyeTip${S}` }, { id: `lid${S}`, head: `eyeC${S}`, tail: `lidTip${S}` }, { id: `lidLow${S}`, head: `eyeC${S}`, tail: `lidLowTip${S}` }, { id: `brow${S}`, head: `eyeC${S}`, tail: `browTip${S}` });
    // (each side its own lid at its own rest: the smirk rests one lid lower)
    const up = S === 'R' || R.up === R0.up ? upper : mirrorMesh(lidMesh(G, X, U, F, { rIn: rg * C.shell[0], rOut: rg * C.shell[1], back: -C.back, edge: R.up, arch: C.arch }));
    const low = S === 'R' || R.low === R0.low ? lower : mirrorMesh(lidMesh(G, X, U, F, { rIn: rg * C.shell[0], rOut: rg * C.shell[1], back: 180 + C.back, edge: R.low, arch: C.arch * 0.8 }));
    segments.push(
      { name: `globe${S}`, kind: 'mesh', group: 'Sclera', mesh: mm(globe), bind: `eye${S}` },
      { name: `catch${S}`, kind: 'mesh', group: 'Sclera', mesh: mm(catchlight), bind: `eye${S}` },
      { name: `lid${S}`, kind: 'mesh', group: groups.lid, mesh: S === 'R' ? up : (up === upper ? mirrorMesh(upper) : up), bind: `lid${S}` },
      { name: `lidLow${S}`, kind: 'mesh', group: groups.lid, mesh: S === 'R' ? low : (low === lower ? mirrorMesh(lower) : low), bind: `lidLow${S}` },
    );
    if (groups.brow) {
      const b = R.brow ?? {}, sameB = (b.lift ?? 0) === bLift && (b.tilt ?? 0) === bTilt;
      const mine = sameB ? brow : browAt(b.lift ?? 0, b.tilt ?? 0);
      segments.push({ name: `brow${S}`, kind: 'mesh', group: groups.brow, mesh: mm(mine), bind: `brow${S}` });
    }
    // the chains, each about the globe's centre: the lids close (down, up) and tilt; the brow lifts and tilts; the eye looks
    const inner = S === 'R' ? -1 : 1;
    chains[`lid${S}`] = { axis: 'x', sign: -1, links: [{ pivot: `eyeC${S}`, joints: [`lidTip${S}`] }] };
    chains[`lidLow${S}`] = { axis: 'x', sign: 1, links: [{ pivot: `eyeC${S}`, joints: [`lidLowTip${S}`] }] };
    chains[`lidTilt${S}`] = { axis: 'y', sign: inner, links: [{ pivot: `eyeC${S}`, joints: [`lidTip${S}`] }] };
    chains[`browLift${S}`] = { axis: 'x', sign: 1, links: [{ pivot: `eyeC${S}`, joints: [`browTip${S}`] }] };
    chains[`brow${S}`] = { axis: 'y', sign: inner, links: [{ pivot: `eyeC${S}`, joints: [`browTip${S}`] }] };
  }
  // THE MOUTH: the mascot's (its lids and brows left out)
  const M = buildFace({ H, eye: { az: eye.az, el: eye.el, w: 0.15, h: 0.2, lidOut: 0.07 }, mouth, rest, ride: 'head', brows: { on: false }, groups: { lid: groups.lid, lip: groups.lip, brow: 'Brow' } });
  const MOUTH = ['mouth', 'tongue', 'lipU', 'lipD'];
  segments.push(...M.segments.filter((s) => MOUTH.includes(s.name)));
  for (const [k, v] of Object.entries(M.joints)) if (/^(mouthC|lipUTip|lipDTip)$/.test(k)) joints[k] = v;
  bones.push(...M.bones.filter((b) => b.id === 'lipU' || b.id === 'lipD'));
  for (const k of ['lipU', 'lipD']) chains[k] = M.chains[k];
  /** an expression's channel values: its differences from the rest face (degrees) */
  const channels = (name) => {
    const X0 = E[name]; if (!X0) throw new Error(`mascot: unknown expression '${name}' (known: ${EXPRESSION_IDS.join(', ')})`);
    const out = {};
    for (const S of ['R', 'L']) {
      const R = restOf(S), b = side(X0.brow, S) ?? {};
      out[`lid${S}`] = r4(upAt(side(X0.lid, S)) - R.up);
      out[`lidLow${S}`] = r4(R.low - lowAt(side(X0.low, S)));
      out[`lidTilt${S}`] = r4(0.5 * ((b.tilt ?? 0) - (R.brow.tilt ?? 0)));
      out[`browLift${S}`] = r4((b.lift ?? 0) - (R.brow.lift ?? 0));
      out[`brow${S}`] = r4((b.tilt ?? 0) - (R.brow.tilt ?? 0));
    }
    for (const [k, v] of Object.entries(M.channels(name))) if (k === 'lipU' || k === 'lipD') out[k] = v;
    return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== 0));
  };
  /** the blink: both upper lids down to meet the lower ones at their rest */
  const blink = () => Object.fromEntries(['R', 'L'].map((S) => { const R = restOf(S); return [`lid${S}`, r4(R.low - 4 - R.up)]; }));
  return { segments, joints, bones, chains, channels, blink, eyes: { G, rg, gaze: g } };
}

export { EXPRESSION_FACE };
