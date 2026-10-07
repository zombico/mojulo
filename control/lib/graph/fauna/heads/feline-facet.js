// FELINE FACET HEAD — a cat's head as a low-poly mesh built from interlocking facial VOLUMES rather than a ring plan
// with features pinned on. The ring head cannot hold a cat's face (a broad flat front with the eyes sunk in sockets
// under a forehead, a short muzzle standing proud of the cheeks, cheekbones wider than the jaw): every fix to one
// feature moved another. Here each region is its own volume, placed by landmarks measured off a reference sheet
// (front and side views, in units of the pupils' spacing, the origin at the eye's centre):
//
//   cranium · cheekbones (zygomatic) · two muzzle pads · nasal bridge · nose base          (the head, unioned)
//   lower face · chin                                                                     (the jaw, its own shell)
//   eye sockets                                                                          (carved out of the head)
//   eyeballs (almond, vertical slit pupil) · nose (a small pyramid) · ears (wedges, recessed inner face)  (own shells)
//
// The skin is the union's surface sampled along rays from a point inside the skull on a coarse, uneven grid (finer
// over the face), so the head is faceted by construction and closed. Every face is named by the volume that made it
// (the muzzle, chin and nasal bridge are the pale `Muzzle`; a carved socket is the dark `Socket`). One half is built
// and mirrored across x = 0. The lower jaw is returned apart (`jaw`, with its `hinge`) so the head opens its mouth as a
// ring head does (../build.js `headMesh` hinges it on the `jawOpen` dial); where the shells overlap at rest, the
// buried faces are the mouth's lining (`Mouth`). Frame +y front, +z up, units of the pupils' spacing; `headMesh` scales
// it to metres and seats it on the neck. Pure and deterministic.
import * as dmath from '../../../util/dmath.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const DEG = Math.PI / 180;
const rotY = (a) => { const c = dmath.cos(a), s = dmath.sin(a); return (v) => [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]; };
const rotX = (a) => { const c = dmath.cos(a), s = dmath.sin(a); return (v) => [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]]; };
const r6 = (x) => Math.round(x * 1e6) / 1e6 + 0;

/** The landmarks (one half, x ≥ 0; a volume on the midline has x = 0). Ellipsoids: [centre, radii, roll°, pitch°]. */
export const FELINE_FACE = Object.freeze({
  centre: [0, -0.6, -0.1],                                       // the rays' origin, inside the skull
  cranium: [[0, -0.7, 0.1], [0.97, 0.86, 0.72]],                 // broad, the top only gently domed, the back flatter
  cheek: [[0.55, -0.28, -0.08], [0.52, 0.46, 0.38]],             // the cheekbone: the face's widest point, at the eye's foot
  lowerFace: [[0, -0.22, -0.5], [0.44, 0.5, 0.3]],               // narrower than the cranium (a cat's jaw is slight)
  muzzle: [[0.17, 0.26, -0.55], [0.27, 0.28, 0.21]],             // a pad either side of the centre line
  bridge: [[0, 0.22, -0.06], [0.17, 0.36, 0.19], 0, -35],        // between the eyes, descending to the nose
  noseBase: [[0, 0.4, -0.45], [0.14, 0.14, 0.12]],              // the philtrum's top, the nose sits on it
  chin: [[0, 0.14, -0.75], [0.18, 0.18, 0.12]],
  jawCentre: [0, -0.2, -0.55],                                   // the lower jaw's own rays' origin
  jawHinge: [0, -0.62, -0.32],                                   // the jaw turns about x through here (below the ear)
  socket: [[0.5, 0.12, 0.05], [0.31, 0.1, 0.2], 14],              // carved: the eye's hollow, outer corner higher
  eye: [[0.5, 0.0, 0.05], [0.27, 0.15, 0.18], 14],             // the ball, almond, sunk in the socket
  nose: { top: [0.15, 0.48, -0.36], tip: [0, 0.53, -0.52], front: [0, 0.6, -0.41], back: [0, 0.34, -0.44] },
  ear: { inner: [0.34, -0.3, 0.8], outer: [1.0, -0.46, 0.34], back: [0.66, -0.98, 0.7], tip: [1.02, -0.62, 1.44], recess: 0.1 },
  // whiskers: from a root on the muzzle pad, a thin needle out to its tip (one half; mirrored)
  whiskers: [{ root: [0.26, 0.42, -0.52], tip: [1.45, 0.2, -0.36] }, { root: [0.28, 0.4, -0.57], tip: [1.5, 0.1, -0.62] }, { root: [0.25, 0.38, -0.62], tip: [1.38, 0.05, -0.86] }],
  whiskerR: 0.012,
  // the tabby's marks on the skin: forehead stripes (the "M") between the ears, a cheek stripe back from the eye
  stripes: { forehead: [[0.05, 0.13], [0.24, 0.34]], foreheadZ: 0.38, cheek: { from: [0.78, -0.1], z: [-0.16, -0.04] } },
  azimuths: [0, 14, 28, 40, 52, 66, 85, 110, 140, 180],          // degrees round from the front, toward +x
  elevations: [-75, -52, -32, -15, -2, 10, 24, 42, 64],
  jawAzimuths: [0, 20, 45, 75, 115, 180], jawElevations: [-70, -40, -12, 15, 45, 72],
});

const ellipsoid = ([c, r, roll = 0, pitch = 0]) => {
  const R = (v) => rotX(pitch * DEG)(rotY(roll * DEG)(v)), Ri = (v) => rotY(-roll * DEG)(rotX(-pitch * DEG)(v));
  // where the ray o + t·d crosses the surface: [t_in, t_out] or null
  return { c, r, R, Ri, hit(o, d) {
    const p = Ri(sub(o, c)), q = Ri(d), P = [p[0] / r[0], p[1] / r[1], p[2] / r[2]], Q = [q[0] / r[0], q[1] / r[1], q[2] / r[2]];
    const a = dot(Q, Q), b = 2 * dot(P, Q), k = dot(P, P) - 1, disc = b * b - 4 * a * k;
    if (disc < 0) return null; const s = Math.sqrt(disc); return [(-b - s) / (2 * a), (-b + s) / (2 * a)];
  } };
};

/**
 * A closed part's faces wound consistently and outward: the winding spread face to face across shared edges (a
 * neighbour runs the shared edge the other way), then the whole part flipped if its signed volume is negative.
 * Works for a part that is not convex (an ear's pocket), where "away from the middle" would guess wrong.
 */
function orient(V, F) {
  const out = F.map((f) => [...f]), byEdge = new Map(), seen = new Array(F.length).fill(false);
  out.forEach((f, i) => { for (let k = 0; k < 3; k++) { const a = f[k], b = f[(k + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`; (byEdge.get(key) || byEdge.set(key, []).get(key)).push(i); } });
  const runs = (f, a, b) => { for (let k = 0; k < 3; k++) if (f[k] === a && f[(k + 1) % 3] === b) return true; return false; };
  for (let s0 = 0; s0 < F.length; s0++) { if (seen[s0]) continue; seen[s0] = true; const queue = [s0];
    while (queue.length) { const i = queue.shift(), f = out[i];
      for (let k = 0; k < 3; k++) { const a = f[k], b = f[(k + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`;
        for (const j of byEdge.get(key)) { if (seen[j]) continue; if (runs(out[j], a, b)) out[j] = [out[j][0], out[j][2], out[j][1]]; seen[j] = true; queue.push(j); } } } }
  const vol = out.reduce((s, [a, b, c]) => s + dot(V[a], cross(V[b], V[c])), 0);
  return vol < 0 ? out.map((f) => [f[0], f[2], f[1]]) : out;
}

/** An ellipsoid as a closed low-poly shell: `m` round its long axis, `n` rings; `group(local unit dir)` names a face. */
function blob(E, m, n, group) {
  const V = [], F = [], G = [];
  const at = (u, v) => { const th = (2 * Math.PI * u) / m, ph = -Math.PI / 2 + (Math.PI * v) / n;
    const l = [dmath.cos(ph) * dmath.sin(th), dmath.cos(ph) * dmath.cos(th), dmath.sin(ph)];
    return { p: add(E.c, E.R([l[0] * E.r[0], l[1] * E.r[1], l[2] * E.r[2]])), l }; };
  const id = new Map(), key = (u, v) => (v === 0 ? 'S' : v === n ? 'N' : `${u % m},${v}`);
  const vi = (u, v) => { const k = key(u, v); if (!id.has(k)) { id.set(k, V.length); V.push(at(u, v)); } return id.get(k); };
  for (let v = 0; v < n; v++) for (let u = 0; u < m; u++) {
    const a = vi(u, v), b = vi(u + 1, v), c = vi(u + 1, v + 1), d = vi(u, v + 1);
    for (const t of [[a, b, c], [a, c, d]]) { if (new Set(t).size < 3) continue;
      const l = mul(add(add(V[t[0]].l, V[t[1]].l), V[t[2]].l), 1 / 3); F.push(t); G.push(group(l)); }
  }
  return { V: V.map((x) => x.p), F, G };
}

/** The feline head mesh: `{ vertices, faces, groups }`, closed parts, frame +y front, +z up. `over` retunes landmarks. */
export function felineFacetHead(over = {}) {
  const L = { ...FELINE_FACE, ...over };
  const O = L.centre;
  const mirror = (e) => [[-e[0][0], e[0][1], e[0][2]], e[1], -(e[2] || 0), e[3] || 0];
  // the head proper (skull, cheeks, the upper muzzle) and the lower jaw (lower face and chin): two shells, so the jaw
  // can open on its hinge; closed, the jaw lies tucked in under the muzzle and the two read as one
  const upper = [
    ['Skull', ellipsoid(L.cranium)], ['Skull', ellipsoid(L.cheek)], ['Skull', ellipsoid(mirror(L.cheek))],
    ['Muzzle', ellipsoid(L.muzzle)], ['Muzzle', ellipsoid(mirror(L.muzzle))], ['Muzzle', ellipsoid(L.bridge)], ['Muzzle', ellipsoid(L.noseBase)],
  ];
  const lower = [['Jaw', ellipsoid(L.lowerFace)], ['Muzzle', ellipsoid(L.chin)]];
  const sockets = [ellipsoid(L.socket), ellipsoid(mirror(L.socket))];
  const inside = (solids, p, k = 1) => solids.some(([, E]) => { const q = E.Ri(sub(p, E.c)); return (q[0] / E.r[0]) ** 2 + (q[1] / E.r[1]) ** 2 + (q[2] / E.r[2]) ** 2 < k * k; });
  const dir = (az, el) => [dmath.cos(el * DEG) * dmath.sin(az * DEG), dmath.cos(el * DEG) * dmath.cos(az * DEG), dmath.sin(el * DEG)];
  // a skin face is a tabby stripe: on the forehead in the stripe bands, or on the cheek behind and level with the eye
  const St = L.stripes, striped = (m) => { const x = Math.abs(m[0]);
    return (m[2] > St.foreheadZ && m[1] > -0.75 && St.forehead.some(([a, b]) => x >= a && x <= b))
      || (x > St.cheek.from[0] && m[1] < St.cheek.from[1] && m[1] > -0.75 && m[2] > St.cheek.z[0] && m[2] < St.cheek.z[1]); };

  /** One closed shell: the union's surface along rays from `o` over an az × el grid (poles single points). Each face is
   * named by the volume that made most of its corners; a face buried in `hidden` (the other shell, at rest) is the
   * mouth's lining, seen only when the jaw opens. */
  const shell = (o, solids, carves, azimuths, elevations, hidden) => {
    const skin = (d) => {
      let t = 0, g = 'Skull';
      for (const [name, E] of solids) { const h = E.hit(o, d); if (h && h[1] > t) { t = h[1]; g = name; } }
      for (const S of carves) { const h = S.hit(o, d); if (h && h[0] > 0 && h[0] < t && h[1] > t) { t = h[0]; g = 'Socket'; } }
      return { p: add(o, mul(d, t)).map(r6), g };
    };
    const V = [], F = [], G = [], put = (p) => { V.push(p); return V.length - 1; };
    const AZ = [...azimuths.slice(1, -1).map((a) => -a).reverse(), ...azimuths], nA = AZ.length - 1;   // −180 and 180 are one column
    const grid = elevations.map((el) => AZ.slice(0, nA).map((az) => skin(dir(az, el))));
    const gid = grid.map((row) => row.map((x) => put(x.p)));
    const south = put(skin([0, 0, -1]).p), north = put(skin([0, 0, 1]).p);
    const pick = (...ss) => { const gs = ss.map((x) => x.g), n = (g) => gs.filter((x) => x === g).length;
      return n('Socket') >= 2 ? 'Socket' : n('Muzzle') >= 2 ? 'Muzzle' : n('Jaw') >= 2 ? 'Jaw' : 'Skull'; };
    // a facet (the quad's two triangles together) is named at its middle: buried deep in the other shell, the mouth's
    // lining; a skin facet in a tabby band, a stripe
    const name = (ids, g) => { const m = mul(ids.reduce((acc, k) => add(acc, V[k]), [0, 0, 0]), 1 / ids.length);
      return hidden && inside(hidden, m, 0.9) ? 'Mouth' : g === 'Skull' && striped(m) ? 'Stripe' : g; };
    const tri = (f, g) => { F.push(f); G.push(g); };
    for (let i = 0; i + 1 < elevations.length; i++) for (let j = 0; j < nA; j++) {
      const j2 = (j + 1) % nA, a = gid[i][j], b = gid[i][j2], c = gid[i + 1][j2], d = gid[i + 1][j];
      const g = name([a, b, c, d], pick(grid[i][j], grid[i][j2], grid[i + 1][j2], grid[i + 1][j]));
      tri([a, b, c], g); tri([a, c, d], g);
    }
    for (let j = 0; j < nA; j++) { const j2 = (j + 1) % nA, top = elevations.length - 1;
      tri([south, gid[0][j2], gid[0][j]], name([south, gid[0][j2], gid[0][j]], pick(grid[0][j], grid[0][j2])));
      tri([north, gid[top][j], gid[top][j2]], name([north, gid[top][j], gid[top][j2]], pick(grid[top][j], grid[top][j2]))); }
    return { V, F: orient(V, F), G };
  };

  const V = [], F = [], G = [];
  const put = (p) => { V.push(p.map(r6)); return V.length - 1; };
  const head = shell(O, upper, sockets, L.azimuths, L.elevations, lower);
  head.V.forEach((p) => put(p)); head.F.forEach((f, k) => { F.push(f); G.push(head.G[k]); });
  const jawShell = shell(L.jawCentre, lower, [], L.jawAzimuths, L.jawElevations, upper);

  // a closed part appended as it is (its own vertices), named face by face
  const part = (P) => { const base = V.length; P.V.forEach((p) => put(p)); orient(P.V, P.F).forEach((f, k) => { F.push(f.map((x) => x + base)); G.push(P.G[k]); }); };
  const mirrorPart = (P) => ({ V: P.V.map((p) => [-p[0], p[1], p[2]]), F: P.F.map((f) => [f[0], f[2], f[1]]), G: P.G });

  // the eyes: almond balls, the front an iris; the pupil a vertical slit on it, a thin shell of its own
  const E = ellipsoid(L.eye);
  const eye = blob(E, 12, 8, (l) => (l[1] > 0.35 ? 'Eyes' : 'Socket'));
  { const [rx, ry, rz] = E.r, at = (v) => add(E.c, E.R(v)), f = ry * 1.01;
    const P = { V: [at([0, f, 0.78 * rz]), at([0, f, -0.78 * rz]), at([-0.07 * rx, f, 0]), at([0.07 * rx, f, 0]), at([0, f + 0.03, 0]), at([0, f - 0.05, 0])],
      F: [[4, 0, 3], [4, 3, 1], [4, 1, 2], [4, 2, 0], [5, 3, 0], [5, 1, 3], [5, 2, 1], [5, 0, 2]], G: Array(8).fill('Pupil') };
    eye.V.push(...P.V.map((p) => p)); const b = eye.V.length - P.V.length; P.F.forEach((t) => { eye.F.push(t.map((x) => x + b)); eye.G.push('Pupil'); }); }
  part(eye); part(mirrorPart(eye));
  // the nose: a small inverted pyramid, its front plane proud of the muzzle
  { const n = L.nose, tl = [-n.top[0], n.top[1], n.top[2]], tr = n.top, P = { V: [tl, tr, n.tip, n.front, n.back], F: [[0, 1, 3], [1, 2, 3], [2, 0, 3], [1, 0, 4], [2, 1, 4], [0, 2, 4]], G: Array(6).fill('Nose') }; part(P); }
  // the ears: a wedge on the skull's top-side; its front a coat rim round the inner ear, recessed into the wedge
  { const e = L.ear, A = e.inner, B = e.outer, T = e.tip, c = mul(add(add(A, B), T), 1 / 3), nrm = cross(sub(B, A), sub(T, A)), n0 = mul(nrm, 1 / Math.hypot(...nrm));
    const facing = dot(n0, [0, 1, 0]) >= 0 ? n0 : mul(n0, -1), inset = (q) => sub(add(q, mul(sub(c, q), 0.28)), mul(facing, e.recess));
    const a = inset(A), b = inset(B), t = inset(T);
    const P = { V: [A, B, e.back, T, a, b, t], F: [[0, 1, 5], [0, 5, 4], [1, 3, 6], [1, 6, 5], [3, 0, 4], [3, 4, 6], [4, 5, 6], [1, 2, 3], [2, 0, 3], [0, 2, 1]],
      G: ['Ears', 'Ears', 'Ears', 'Ears', 'Ears', 'Ears', 'EarInset', 'Ears', 'Ears', 'Ears'] };
    part(P); part(mirrorPart(P)); }

  // the whiskers: each a thin closed needle (a three-sided spike) from its root on the pad to its tip
  for (const w of L.whiskers) {
    const d = sub(w.tip, w.root), u = mul(d, 1 / Math.hypot(...d)), a = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const e1 = cross(u, a), n1 = mul(e1, 1 / Math.hypot(...e1)), n2 = cross(u, n1), r = L.whiskerR;
    const base = [0, 120, 240].map((deg) => add(w.root, add(mul(n1, r * dmath.cos(deg * DEG)), mul(n2, r * dmath.sin(deg * DEG)))));
    const P = { V: [...base, w.tip], F: [[0, 1, 3], [1, 2, 3], [2, 0, 3], [0, 2, 1]], G: Array(4).fill('Whiskers') };
    part(P); part(mirrorPart(P));
  }
  const jaw = { vertices: jawShell.V, faces: jawShell.F, groups: jawShell.G, hinge: L.jawHinge };
  return { vertices: V, faces: F, groups: G, jaw };
}
