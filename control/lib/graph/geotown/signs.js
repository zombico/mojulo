/**
 * THE STREET'S SIGNS AND SIGNALS — a geotown's signal heads, its stop signs, its street-name blades and the signs an
 * exaggerated street adds (a speed limit, a crossing ahead, parking), drawn as the things they are when the cube draws
 * its street exaggerated (doodads.js's hand): a signal a housing on its backplate in a bright border, its three lenses
 * each under its visor, on a round mast arm; a stop sign an octagon in its white rim, its letters, its back; each sign a
 * plate in its rim on a round post. In the cube's TOON register each is EXAGGERATED and INCONGRUENT by its own dice: a
 * signal's lenses each its own size and its visors long and drooping, its head tipped; a sign too big, squashed, turned
 * in its plane on a bent post. Each stands where it stood; only its shape is the hand's.
 *
 *   signalHead(D, R)            → faces in a local frame (x toward the approach, y across, z up; the head's foot at 0)
 *   signOf(kind, D, R, glyphs?) → faces in the local frame, the post's foot at 0: kinds SIGN_KINDS
 *   mastArm(len, D)             → faces: the arm from the pole's top (0) out along +y, at z 0
 *   place(faces, at, out)       the local frame set down at `at` [x, y, z] facing `out` [ox, oy] (world)
 *   SIGN_KINDS                  stop, diamond, speed, parking, name
 *
 * Roles: signal (the housing, visors), plate (a backplate), border (its bright edge), rim (a sign's), lens-red, lens-amber, lens-green, sign-red, sign-white,
 * sign-yellow, sign-blue, sign-green, glyph (the letters: ink on a sign), pole. Metres. Pure; the dice are the caller's.
 */
import { tube, postOf } from './doodads.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P = (p) => p.map(r5);
export const SIGN_KINDS = Object.freeze(['stop', 'diamond', 'speed', 'parking', 'name']);
// a sign's plate, its rim, its letters' ink (a role each, the scene's palette)
const PLATE = { stop: ['sign-red', 'sign-white', 'sign-white'], diamond: ['sign-yellow', 'rim', 'rim'], speed: ['sign-white', 'rim', 'rim'], parking: ['sign-blue', 'sign-white', 'sign-white'], name: ['sign-green', 'sign-white', 'sign-white'] };

/** A box's six faces in the local frame. */
function box(x0, y0, x1, y1, z0, z1, role) {
  return [
    { corners: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], out: [0, 0, 1], role }, { corners: [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], out: [0, 0, -1], role },
    { corners: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], out: [1, 0, 0], role }, { corners: [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], out: [-1, 0, 0], role },
    { corners: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], out: [0, -1, 0], role }, { corners: [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], out: [0, 1, 0], role },
  ];
}
/** A flat polygon facing +x at depth x, its points [[y, z], …] round a middle, in triangles from it. */
function plateAt(x, pts, role) {
  const m = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]), out = [];
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; out.push({ corners: [[x, m[0], m[1]], [x, a[0], a[1]], [x, b[0], b[1]]], out: [1, 0, 0], role }); }
  return out;
}
/** Turn faces about the x axis (the sign's own plane: a turn in it) about (y, z) = c, by `a` radians; or about y (a tip). */
const turnX = (fs, a, cy, cz) => (a ? fs.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [x, cy + (y - cy) * Math.cos(a) - (z - cz) * Math.sin(a), cz + (y - cy) * Math.sin(a) + (z - cz) * Math.cos(a)]) })) : fs);
const tipY = (fs, a, cx, cz) => (a ? fs.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [cx + (x - cx) * Math.cos(a) + (z - cz) * Math.sin(a), y, cz - (x - cx) * Math.sin(a) + (z - cz) * Math.cos(a)]) })) : fs);

/** A signal's head: its housing, its backplate in a bright border, its three lenses each under its visor. */
export function signalHead(D, R) {
  const t = D.toon, u = (lo, hi) => lo + (hi - lo) * R(), hw = 0.17 * (t ? D.body * 0.7 + 0.3 : 1), H = 1 * (t ? D.height * 0.6 + 0.4 : 1), d = 0.13;
  const out = [...box(-d, -hw, d, hw, 0, H, 'signal')];
  // its backplate behind it, a bright border round it
  const bw = hw + 0.13, bz0 = -0.12, bz1 = H + 0.12;
  out.push(...box(-d - 0.03, -bw, -d - 0.01, bw, bz0, bz1, 'plate'));
  for (const [y0, y1, z0, z1] of [[-bw, bw, bz1 - 0.04, bz1], [-bw, bw, bz0, bz0 + 0.04], [-bw, -bw + 0.04, bz0, bz1], [bw - 0.04, bw, bz0, bz1]]) out.push(...box(-d - 0.005, y0, -d + 0.005, y1, z0, z1, 'border'));
  // its lenses, red over amber over green, each under its visor (a toon one's each its own size, its visor long)
  [['lens-red', 0.8], ['lens-amber', 0.5], ['lens-green', 0.2]].forEach(([role, f]) => {
    const r = 0.1 * (t ? u(0.7, 1.7) : 1), zc = H * f, c0 = [d + 0.005, 0, zc], c1 = [d + 0.02, 0, zc];
    out.push(...tube([{ c: c0, r, a: [1, 0, 0] }, { c: c1, r, a: [1, 0, 0] }], 12, role, [false, true]));
    const vl = 0.18 * (t ? u(1, 2.6) : 1), droop = t ? u(0, 0.12) : 0, vr = r + 0.025, k = 6;
    // (a visor: the upper half of a tube from the lens out, its end drooping)
    for (let i = 0; i < k; i++) {
      const a0 = (Math.PI * i) / k, a1 = (Math.PI * (i + 1)) / k, p = (x, a, dz) => [x, vr * Math.cos(a), zc + vr * Math.sin(a) - dz];
      out.push({ corners: [p(d, a0, 0), p(d, a1, 0), p(d + vl, a1, droop), p(d + vl, a0, droop)], out: [0, Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2)], role: 'signal' });
    }
  });
  return t ? tipY(out, D.tilt * 0.8, 0, H / 2) : out;
}

/** A mast arm from the pole's top out along +y `len` metres, tapering; a toon one bowed. */
export function mastArm(len, D) {
  const k = 6, bow = D.toon ? 0.5 * D.bend : 0;
  return tube(Array.from({ length: k + 1 }, (_, i) => { const f = i / k; return { c: [0, len * f, bow * Math.sin(Math.PI * f) - 0.15 * f], r: 0.075 * (1 - 0.45 * f), a: [0, 1, -0.15 + bow * Math.cos(Math.PI * f) * Math.PI / Math.max(1, len)] }; }), 8, 'pole', [false, true]);
}

/** A sign on its post (`glyphs`: its letters' count, blocks across its middle). In the local frame, its post's foot at 0. */
export function signOf(kind, D, R, glyphs = 0) {
  const t = D.toon, u = (lo, hi) => lo + (hi - lo) * R(), [plate, rim, ink] = PLATE[kind] ?? PLATE.speed;
  const big = t ? D.head * 0.6 : 1, sq = t ? D.taper : 1, spin = t ? D.tilt * 1.4 : 0;
  // its plate's outline [[y, z]] about its middle, before it is raised onto its post
  const oct = (r) => Array.from({ length: 8 }, (_, i) => { const a = (Math.PI / 8) * (2 * i + 1); return [r * Math.cos(a), r * sq * Math.sin(a)]; });
  const rectP = (w, h) => [[-w / 2, -h / 2 * sq], [w / 2, -h / 2 * sq], [w / 2, h / 2 * sq], [-w / 2, h / 2 * sq]];
  const shape = kind === 'stop' ? (r) => oct(r) : kind === 'diamond' ? (r) => [[0, -r * sq], [r, 0], [0, r * sq], [-r, 0]] : kind === 'speed' ? (r) => rectP(r * 1.6, r * 2) : kind === 'parking' ? (r) => rectP(r * 1.8, r * 1.8) : (r) => rectP(r * 4.8, r * 0.95);
  const R0 = (kind === 'name' ? 0.19 : kind === 'diamond' ? 0.42 : 0.38) * big, postH = kind === 'name' ? 2.9 : 2.1, zc = postH + (kind === 'name' ? 0 : R0 * sq * (kind === 'speed' ? 1 : 0.95));
  const lift = (pts, dz = 0) => pts.map(([y, z]) => [y, z + zc + dz]);
  let face = [
    ...plateAt(0.06, lift(shape(R0 * 0.9)), plate),
    ...plateAt(0.055, lift(shape(R0)), rim),
    ...plateAt(0.05, lift(shape(R0 * 1.02)), 'plate'),
  ];
  // its letters: blocks across its middle (a stop's four, a speed's two, a name's many), each a hair proud of the plate
  const n = glyphs || (kind === 'stop' ? 4 : kind === 'speed' ? 2 : kind === 'parking' ? 1 : kind === 'name' ? 7 : 0), span = kind === 'name' ? R0 * 4 : kind === 'parking' ? R0 * 0.9 : R0 * 1.15;
  for (let i = 0; i < n; i++) {
    const w = (span / n) * (t ? u(0.45, 0.8) : 0.62), h = (kind === 'name' ? R0 * 0.55 : kind === 'speed' ? R0 * 0.8 : R0 * 0.5) * (t ? u(0.75, 1.25) : 1), y = -span / 2 + (span / n) * (i + 0.5), z = zc + (kind === 'speed' ? -R0 * 0.25 : 0);
    face.push(...plateAt(0.065, [[y - w / 2, z - h / 2], [y + w / 2, z - h / 2], [y + w / 2, z + h / 2], [y - w / 2, z + h / 2]], ink));
  }
  // (a speed sign's word over its number: a bar)
  if (kind === 'speed') face.push(...plateAt(0.065, lift([[-R0 * 0.55, R0 * 0.5], [R0 * 0.55, R0 * 0.5], [R0 * 0.55, R0 * 0.7], [-R0 * 0.55, R0 * 0.7]]), ink));
  face = turnX(face, spin, 0, zc);
  // (a name's two blades, across each other, the second over the first, a cap on its post)
  if (kind === 'name') face = [...face, ...turnX(face, 0, 0, zc).map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [-y, x, z + R0 * 1.15 + (t ? u(-0.05, 0.12) : 0)]) }))];
  const post = postOf(0, 0, 0, zc + (kind === 'name' ? R0 * 1.8 : 0), 0.035 * (t ? Math.sqrt(D.body) : 1), 'pole', D);
  if (kind === 'name') post.push(...tube([{ c: [0, 0, zc + R0 * 1.8], r: 0.05 }, { c: [0, 0, zc + R0 * 1.8 + 0.08], r: 0.02 }], 8, 'pole'));
  return [...post, ...face];
}

/** Faces in the local frame set down at `at` facing `out` (the local +x to [ox, oy]). */
export function place(fs, [X, Y, Z], [ox, oy]) {
  const l = Math.hypot(ox, oy) || 1, c = ox / l, s = oy / l;
  const T = ([x, y, z]) => P([X + x * c - y * s, Y + x * s + y * c, Z + z]);
  return fs.map((f) => ({ ...f, corners: f.corners.map(T), out: P([f.out[0] * c - f.out[1] * s, f.out[0] * s + f.out[1] * c, f.out[2]]) }));
}
