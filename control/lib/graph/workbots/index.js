/**
 * WORKBOTS — the worker bots of a toy robot world: its own visual language, not the hero's family (the herobot body,
 * the reploid's) and not real machinery (the mecha shelf's). A worker bot is built from a FEW BIG PRIMITIVES, each read
 * at a glance: a box (its corners chamfered), an octagonal prism, a low dome, a ball of a few rings, a wheel, a track (a tread's loop); flat toy colours in
 * a two-tone cel (a lit side and a shaded side, a highlight on what faces up), no detail smaller than a hand. And it has
 * a FACE: two round lit eyes and a mouth at the least, on a light plate, turned toward whoever watches (a side view's
 * camera), since a bot in this world is someone.
 *
 *   THE LANGUAGE   a big body that does the work (a boiler, a crate, a drum), short legs or none, big hands that hold
 *                  (clamps, mitts, a scoop), one thing that says the trade (a hard hat, a stack, a lamp), the face on the
 *                  head's front; colours by ROLE: `paint` (the trade's colour), `trim` (the frame, graphite), `metal`
 *                  (the joints and the bare parts), `plate` (the face's screen), `eye` (lit), `mouth` (the grille's dark),
 *                  `accent` (one mark)
 *   A CARD         a bot as data (WORKBOTS): its palette by role and its PARTS, each a primitive on a bone (`root` the body,
 *                  `head`, `armR`, `armL`), in metres, +y its front, +z up, +x its right (the vehicle frame the page's rig
 *                  figures share), its `joints` (the neck, each shoulder: where each bone turns); the head's `glance` turns
 *                  it toward the camera's side (radians about its neck)
 *
 *   WORKBOTS, WORKBOT_IDS        the cards (a new bot is a card)
 *   readWorkbotSpec(spec, at?)   → { card, palette? } or throws
 *   workbotFaces(spec)           → { bones, buckets: Map bone → faces, height }   the bot's faces by bone, grounded
 *   workbotHeight(spec)          → its height (m), feet to the top of its head
 *   workbotVents(spec)           → [{ at, dir }]: where its steam leaves (a `vent` pipe's end, the way it points)
 *   workbotFigure(spec)          → the rig figure a level stands it as (vehicle-rig.js packVehicleFigure: a bone a part,
 *                                  so a wreck takes it apart), a CEL body as every body on the map is (its lit and shade
 *                                  bakes, `col` and `colS`, its eyes its signal, `toon`: WORKBOT_CEL), and its `workbot`
 *                                  readout ({ card, height, faces })
 *
 * Pure and deterministic: no dice, no clock; the same card, the same bot.
 */
import { packVehicleFigure } from '../vehicle-designer/vehicle-rig.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;

/** The cel light every worker bot is baked in: a key from above, ahead and the camera's side; its lit side the colour
 * itself, its shade a step down, what faces up a step toward white. */
export const WORKBOT_LIGHT = Object.freeze({ key: Object.freeze([-0.45, 0.35, 0.82]), step: 0.15, shade: 0.72, top: 0.62, highlight: 0.18 });

// ── the primitives (each face { corners, normal, fill-role }) ─────────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const face = (corners, role) => ({ corners, role });
// a ring of n points round an axis-aligned centre (in the plane of the two axes it spans), a radius each way
const ring = (c, rx, ry, z, n, phase = Math.PI / n) => Array.from({ length: n }, (_, i) => { const a = phase + (2 * Math.PI * i) / n; return [c[0] + rx * Math.cos(a), c[1] + ry * Math.sin(a), z]; });
// a solid between rings stacked up the z axis, capped at both ends
function loft(rings, role, { capLo = true, capHi = true } = {}) {
  const out = [];
  for (let k = 0; k + 1 < rings.length; k++) {
    const A = rings[k], B = rings[k + 1], n = A.length;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; out.push(face([A[i], A[j], B[j], B[i]], role)); }
  }
  if (capLo) out.push(face([...rings[0]].reverse(), role));
  if (capHi) out.push(face(rings[rings.length - 1], role));
  return out;
}
/** a box at centre `c`, size [x, y, z], its vertical edges chamfered by `ch` (an octagon in plan) */
function box(c, s, role, { ch = 0 } = {}) {
  const [hx, hy, hz] = s.map((v) => v / 2), k = Math.min(ch, hx * 0.9, hy * 0.9);
  const plan = (z) => (k > 0 ? [[hx - k, -hy], [hx, -hy + k], [hx, hy - k], [hx - k, hy], [-hx + k, hy], [-hx, hy - k], [-hx, -hy + k], [-hx + k, -hy]] : [[hx, -hy], [hx, hy], [-hx, hy], [-hx, -hy]]).map(([x, y]) => [c[0] + x, c[1] + y, z]);
  return loft([plan(c[2] - hz), plan(c[2] + hz)], role);
}
/** an n-sided prism up the z axis, from z0 to z1, radii `rx`, `ry` */
const prism = (c, rx, ry, z0, z1, role, n = 8) => loft([ring(c, rx, ry, z0, n), ring(c, rx, ry, z1, n)], role);
/** a low dome over z0: `rings` of n sides, `h` high */
const dome = (c, rx, ry, z0, h, role, n = 8, rings = 3) => loft(Array.from({ length: rings + 1 }, (_, k) => { const t = (k / rings) * (Math.PI / 2), s = Math.max(0.18, Math.cos(t)); return ring(c, rx * s, ry * s, z0 + h * Math.sin(t), n); }), role, { capHi: true });
/** a ball of a few rings, radius r */
const ball = (c, r, role, n = 8, rings = 4) => loft(Array.from({ length: rings + 1 }, (_, k) => { const t = -Math.PI / 2 + (Math.PI * (k + 0.5)) / (rings + 1); return ring(c, r * Math.cos(t), r * Math.cos(t), c[2] + r * Math.sin(t), n); }), role);
/** a disc standing on a face of the head: centre `c`, radius r, facing +y, `t` proud, n sides (an eye, a lamp) */
const lens = (c, r, t, role, n = 8) => { const R = (y) => Array.from({ length: n }, (_, i) => { const a = (2 * Math.PI * i) / n; return [c[0] + r * Math.cos(a), y, c[2] + r * Math.sin(a)]; });
  const A = R(c[1]), B = R(c[1] + t), out = [];
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; out.push(face([A[i], B[i], B[j], A[j]], role)); }
  out.push(face([...B].reverse(), role)); return out; };

// a profile in the (y, z) plane drawn counter-clockwise seen from +x, extruded across x from x0 to x1 (a wheel, a track)
const acrossX = (pts, x0, x1, role) => loft([pts.map(([y, z]) => [x0, y, z]), pts.map(([y, z]) => [x1, y, z])], role);
/** a wheel facing ±x: centre `c`, radius r, `w` wide, n sides (a road wheel, a fan's disc) */
const wheel = (c, r, w, role, n = 10) => acrossX(Array.from({ length: n }, (_, i) => { const a = (2 * Math.PI * i) / n; return [c[1] + r * Math.cos(a), c[2] + r * Math.sin(a)]; }), c[0] - w / 2, c[0] + w / 2, role);
/** a TRACK, a tank tread's loop: a stadium along y (its length `len`, its ends' radius r) across x, `w` wide, centre `c` */
const track = (c, len, r, w, role, n = 6) => { const h = len / 2 - r, arc = (y0, a0) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (Math.PI * i) / n; return [c[1] + y0 + r * Math.cos(a), c[2] + r * Math.sin(a)]; });
  return acrossX([...arc(h, -Math.PI / 2), ...arc(-h, Math.PI / 2)], c[0] - w / 2, c[0] + w / 2, role); };

/** a half sphere facing out along ±x (`s`): its flat side at x = c[0], its round `r` out; `n` sides, `rings` up it */
const cap = (c, r, sgn, role, n = 10, rings = 3) => {
  const R = Array.from({ length: rings + 1 }, (_, k) => { const t = (k / rings) * (Math.PI / 2), rr = Math.max(0.15, Math.cos(t)) * r;
    const pts = Array.from({ length: n }, (_, i) => { const a = (2 * Math.PI * i) / n; return [c[0] + sgn * r * Math.sin(t), c[1] + rr * Math.cos(a), c[2] + rr * Math.sin(a)]; });
    return sgn > 0 ? pts : pts.reverse(); });
  return loft(R, role);
};
/** a PIPE from p0 to p1, radius r, n sides (an exhaust at an angle, a strut) */
const pipe = (p0, p1, r, role, n = 8) => {
  const d = unit(sub(p1, p0)), any = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], u = unit(cross(d, any)), v = cross(d, u);
  const R = (p) => Array.from({ length: n }, (_, i) => { const a = (2 * Math.PI * i) / n, c = Math.cos(a) * r, sn = Math.sin(a) * r; return [p[0] + c * u[0] + sn * v[0], p[1] + c * u[1] + sn * v[1], p[2] + c * u[2] + sn * v[2]]; });
  return loft([R(p0), R(p1)], role);
};

// turn faces about the z axis through `p` by `a` radians (a head's glance)
const turnZ = (faces, p, a) => { const c = Math.cos(a), s = Math.sin(a); return faces.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [p[0] + (x - p[0]) * c - (y - p[1]) * s, p[1] + (x - p[0]) * s + (y - p[1]) * c, z]) })); };

// ── the language's parts, as a card names them ───────────────────────────────────────────────────────────────────
const PART = {
  box: (P) => box(P.at, P.size, P.role, { ch: P.ch ?? 0 }),
  prism: (P) => prism(P.at, P.r[0], P.r[1] ?? P.r[0], P.z[0], P.z[1], P.role, P.n ?? 8),
  dome: (P) => dome(P.at, P.r[0], P.r[1] ?? P.r[0], P.at[2], P.h, P.role, P.n ?? 8, P.rings ?? 3),
  ball: (P) => ball(P.at, P.r, P.role, P.n ?? 8, P.rings ?? 4),
  wheel: (P) => wheel(P.at, P.r, P.w, P.role, P.n ?? 10),
  track: (P) => track(P.at, P.len, P.r, P.w, P.role, P.n ?? 6),
  cap: (P) => cap(P.at, P.r, P.side, P.role, P.n ?? 10, P.rings ?? 3),
  pipe: (P) => pipe(P.from, P.to, P.r, P.role, P.n ?? 8),
  // THE FACE: on the head's front (+y) at `y`, a light plate, two round lit eyes and a mouth (a grille of dark bars, or
  // a slot), centred on x 0 at heights `eyes` and `mouth`
  face: (P) => {
    const F = P, y = F.y, out = [...box([0, y + 0.01, F.plate.z], [F.plate.w, 0.02, F.plate.h], 'plate', { ch: F.plate.ch ?? 0 })];
    for (const s of [1, -1]) out.push(...lens([s * F.eyes.apart / 2, y + 0.02, F.eyes.z], F.eyes.r, 0.03, 'eye', F.eyes.n ?? 8));
    const M = F.mouth;
    if (M.kind === 'grille') for (let k = 0; k < M.bars; k++) out.push(...box([0, y + 0.03, M.z + (k - (M.bars - 1) / 2) * M.step], [M.w, 0.02, M.bar], 'mouth'));
    else out.push(...box([0, y + 0.03, M.z], [M.w, 0.02, M.h], 'mouth', { ch: M.ch ?? 0 }));
    return out;
  },
};

/**
 * THE CARDS. Bulwark, level 0's boss: the plant's ENGINE BOT, an engine block for a body (its cylinder heads on top, two
 * exhausts angled up and back, steaming, a cooling fan on each side), on two TANK TREADS for legs (a track loop round its
 * road wheels), two clamp arms on pistons, and a head rounded by a half sphere each side, a blower's scoop on top, over
 * its screen face (two round orange eyes, a grille mouth) turned partly toward the camera.
 */
const side = (s, f) => [[1, 'R'], [-1, 'L']].flatMap(([k, n]) => f(k, n));
export const WORKBOTS = Object.freeze({
  bulwark: Object.freeze({
    reads: 'an engine bot on tank treads: an engine block body, cylinder heads, exhaust stacks, side fans, clamp arms on pistons, a blower scoop over a screen face',
    palette: Object.freeze({ paint: '#e5a91c', trim: '#33373d', metal: '#8d949c', plate: '#dfe3e8', eye: '#ff5a2a', mouth: '#2a2d33', accent: '#b8337a' }),
    joints: Object.freeze({ neck: Object.freeze([0, 0.1, 2.3]), armR: Object.freeze([1.0, 0.38, 1.95]), armL: Object.freeze([-1.0, 0.38, 1.95]) }), glance: 0.6,
    parts: Object.freeze([
      // the TREADS: a track loop each side, its road wheels on the outside, a drive sprocket at the back
      ...side(1, (k) => [
        { bone: 'root', kind: 'track', at: [k * 0.74, 0, 0.42], len: 2.0, r: 0.42, w: 0.46, role: 'trim' },
        ...[-0.55, 0, 0.55].map((y) => ({ bone: 'root', kind: 'wheel', at: [k * 0.99, y, 0.36], r: 0.24, w: 0.08, role: 'metal' })),
        ...[-0.55, 0, 0.55].map((y) => ({ bone: 'root', kind: 'wheel', at: [k * 1.04, y, 0.36], r: 0.1, w: 0.04, role: 'paint' })),
        { bone: 'root', kind: 'wheel', at: [k * 0.99, -0.72, 0.58], r: 0.2, w: 0.1, role: 'paint', n: 8 },
      ]),
      // the hull between them, the ENGINE BLOCK on it, a band and a mark
      { bone: 'root', kind: 'box', at: [0, 0, 0.82], size: [1.0, 1.4, 0.36], role: 'trim', ch: 0.12 },
      { bone: 'root', kind: 'box', at: [0, 0, 1.5], size: [1.5, 1.35, 1.0], role: 'paint', ch: 0.16 },
      { bone: 'root', kind: 'box', at: [0, 0, 1.12], size: [1.56, 1.41, 0.12], role: 'trim', ch: 0.18 },
      { bone: 'root', kind: 'box', at: [0, 0.69, 1.55], size: [0.34, 0.06, 0.34], role: 'accent', ch: 0.1 },
      // its cooling FANS, one each side: a disc, its hub, two blades across it
      ...side(1, (k) => [
        { bone: 'root', kind: 'wheel', at: [k * 0.77, -0.3, 1.55], r: 0.32, w: 0.05, role: 'metal', n: 12 },
        { bone: 'root', kind: 'box', at: [k * 0.81, -0.3, 1.55], size: [0.04, 0.56, 0.1], role: 'trim' },
        { bone: 'root', kind: 'box', at: [k * 0.81, -0.3, 1.55], size: [0.04, 0.1, 0.56], role: 'trim' },
        { bone: 'root', kind: 'wheel', at: [k * 0.83, -0.3, 1.55], r: 0.1, w: 0.04, role: 'paint', n: 8 },
      ]),
      // the CYLINDER HEADS on top: a bank each side, its caps in a row
      ...side(1, (k) => [
        { bone: 'root', kind: 'box', at: [k * 0.44, -0.12, 2.1], size: [0.42, 0.95, 0.22], role: 'metal', ch: 0.06 },
        ...[-0.45, -0.12, 0.21].map((y) => ({ bone: 'root', kind: 'prism', at: [k * 0.44, y, 0], r: [0.1], z: [2.21, 2.33], role: 'trim', n: 6 })),
      ]),
      // the EXHAUSTS behind, angled up and back and out, each its lip: a VENT, where its steam leaves
      ...side(1, (k) => [
        { bone: 'root', kind: 'pipe', from: [k * 0.42, -0.5, 1.75], to: [k * 0.62, -1.08, 2.7], r: 0.11, role: 'metal' },
        { bone: 'root', kind: 'pipe', from: [k * 0.6, -1.02, 2.6], to: [k * 0.64, -1.12, 2.79], r: 0.16, role: 'trim', vent: true },
      ]),
      // the neck and the HEAD between the banks: a box, a BLOWER's scoop on top, the face on its front
      { bone: 'head', kind: 'prism', at: [0, 0.1, 0], r: [0.2], z: [2.0, 2.32], role: 'metal' },
      { bone: 'head', kind: 'box', at: [0, 0.14, 2.62], size: [0.86, 0.72, 0.62], role: 'paint', ch: 0.12 },
      // (its round sides: a half sphere on each, a hub on it, so the head reads round against the boxes)
      ...side(1, (k) => [
        { bone: 'head', kind: 'cap', at: [k * 0.43, 0.14, 2.62], r: 0.27, side: k, role: 'metal' },
        { bone: 'head', kind: 'cap', at: [k * 0.68, 0.14, 2.62], r: 0.09, side: k, role: 'trim', n: 8, rings: 2 },
      ]),
      { bone: 'head', kind: 'box', at: [0, 0.08, 3.0], size: [0.5, 0.56, 0.16], role: 'metal', ch: 0.06 },
      { bone: 'head', kind: 'box', at: [0, 0.22, 3.2], size: [0.4, 0.34, 0.26], role: 'trim', ch: 0.06 },
      { bone: 'head', kind: 'box', at: [0, 0.4, 3.2], size: [0.3, 0.02, 0.16], role: 'mouth' },
      { bone: 'head', kind: 'face', y: 0.51, plate: { w: 0.74, h: 0.52, z: 2.62, ch: 0.1 }, eyes: { apart: 0.36, r: 0.115, z: 2.71 }, mouth: { kind: 'grille', bars: 3, w: 0.42, bar: 0.04, step: 0.075, z: 2.47 } },
      // the ARMS: a shoulder ball, a piston (its cylinder and its rod), a big clamp forearm, two jaws
      ...side(1, (k, n) => [
        { bone: `arm${n}`, kind: 'ball', at: [k * 1.0, 0.38, 1.95], r: 0.24, role: 'trim' },
        { bone: `arm${n}`, kind: 'prism', at: [k * 1.08, 0.38, 0], r: [0.14], z: [1.55, 1.92], role: 'metal' },
        { bone: `arm${n}`, kind: 'prism', at: [k * 1.08, 0.38, 0], r: [0.07], z: [1.25, 1.55], role: 'plate' },
        { bone: `arm${n}`, kind: 'box', at: [k * 1.1, 0.42, 1.0], size: [0.46, 0.5, 0.52], role: 'paint', ch: 0.1 },
        { bone: `arm${n}`, kind: 'box', at: [k * 1.1, 0.58, 0.6], size: [0.16, 0.14, 0.32], role: 'trim' },
        { bone: `arm${n}`, kind: 'box', at: [k * 1.1, 0.26, 0.6], size: [0.16, 0.14, 0.32], role: 'trim' },
      ]),
    ]),
  }),
});
export const WORKBOT_IDS = Object.freeze(Object.keys(WORKBOTS));
const BONES = Object.freeze(['root', 'head', 'armR', 'armL']);

export function readWorkbotSpec(spec, at = 'workbot') {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error(`${at} is { card, palette? }`);
  for (const k of Object.keys(spec)) if (!['card', 'palette'].includes(k)) throw new Error(`${at}.${k} is not a worker bot's word (card, palette)`);
  if (!WORKBOTS[spec.card]) throw new Error(`${at}.card is one of ${WORKBOT_IDS.join(', ')}`);
  if (spec.palette !== undefined && (typeof spec.palette !== 'object' || Object.entries(spec.palette).some(([k, v]) => !(k in WORKBOTS[spec.card].palette) || !/^#[0-9a-f]{6}$/i.test(v)))) throw new Error(`${at}.palette is { <role>: '#rrggbb' } over the card's (${Object.keys(WORKBOTS[spec.card].palette).join(', ')})`);
  return { card: spec.card, ...(spec.palette ? { palette: { ...spec.palette } } : {}) };
}

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const rgbHex = (c) => `#${c.map((v) => Math.round(255 * Math.max(0, Math.min(1, v))).toString(16).padStart(2, '0')).join('')}`;
// a face's fill: its role's colour in the cel light (a lit eye is its colour, whole)
function fillOf(f, P) {
  const base = hexRgb(P[f.role]), L = WORKBOT_LIGHT;
  if (f.role === 'eye') return P.eye;
  const [a, b, c] = f.corners, n = unit(cross(sub(b, a), sub(c, a))), k = unit(L.key), d = n[0] * k[0] + n[1] * k[1] + n[2] * k[2];
  const lit = d > L.step ? 1 : L.shade, up = n[2] > L.top ? L.highlight : 0;
  return rgbHex(base.map((v) => v * lit + (1 - v * lit) * up));
}

/** THE CEL every body on a side map is drawn in (the page's toon: worlds/world-scene.js celBody's two bakes): a worker
 * bot's LIT tone its role's colour, flat, and its SHADE a step down toward a cool dark; its eyes lit in both (a glow) */
export const WORKBOT_CEL = Object.freeze({ shade: 0.6, cool: '#26304a', coolBy: 0.18 });
const litOf = (f, P) => P[f.role];
const shadeOf = (f, P) => { if (f.role === 'eye') return P.eye; const C = WORKBOT_CEL, c = hexRgb(P[f.role]), k = hexRgb(C.cool); return rgbHex(c.map((v, i) => v * C.shade * (1 - C.coolBy) + k[i] * C.coolBy)); };

export function workbotFaces(spec) {
  const S = readWorkbotSpec(spec), C = WORKBOTS[S.card], P = { ...C.palette, ...(S.palette ?? {}) };
  const by = new Map(BONES.map((b) => [b, []]));
  for (const p of C.parts) by.get(p.bone).push(...PART[p.kind](p));
  // (the head turned toward the camera's side about its neck: the face seen)
  by.set('head', turnZ(by.get('head'), C.joints.neck, C.glance ?? 0));
  const all = [...by.values()].flat(), z0 = Math.min(...all.flatMap((f) => f.corners.map((c) => c[2]))), z1 = Math.max(...all.flatMap((f) => f.corners.map((c) => c[2])));
  // (each face its preview's two-tone `fill`, and the cel's `lit` and `shade` tones and its `role`, for the page's toon)
  const buckets = new Map([...by].map(([b, fs]) => [b, fs.map((f) => { const corners = f.corners.map(([x, y, z]) => [r4(x), r4(y), r4(z - z0)]), [a, bb, c] = corners; return { corners, normal: unit(cross(sub(bb, a), sub(c, a))).map(r4), fill: fillOf({ ...f, corners }, P), lit: litOf(f, P), shade: shadeOf(f, P), role: f.role }; })]));
  const at = (p) => [p[0], p[1], r4(p[2] - z0)], J = C.joints;
  // (its VENTS: where a part marked `vent` ends, the way it points; the page puffs its steam there)
  const vents = C.parts.filter((q) => q.vent && q.kind === 'pipe').map((q) => ({ at: at(q.to), dir: unit(sub(q.to, q.from)).map(r4) }));
  const heads = { root: [0, 0, 0], head: at(J.neck), armR: at(J.armR), armL: at(J.armL) };
  return { bones: BONES.map((id) => ({ id, head: heads[id] })), buckets, height: r4(z1 - z0), vents };
}

export const workbotHeight = (spec) => workbotFaces(spec).height;

export function workbotFigure(spec) {
  const S = readWorkbotSpec(spec), { bones, buckets, height } = workbotFaces(S);
  // (drawn as every body on the map is: a CEL body, its lit bake its `col`, its shade bake `colS` on the same corners, its
  // eyes marked `sigM` (its SIGNAL, lit by its tell), `toon` set; the page steps between the two by its own key light and
  // inks it as it inks the rest)
  const pack = (fill) => packVehicleFigure(bones, new Map([...buckets].map(([b, fs]) => [b, fs.map((f) => ({ ...f, fill: fill(f) }))])), { keys: 2, rolls: [] });
  const L = pack((f) => f.lit), D = pack((f) => f.shade), M = pack((f) => (f.role === 'eye' ? '#ff00fe' : f.lit));
  const mask = (a, b) => { const x = Buffer.from(a, 'base64'), y = Buffer.from(b, 'base64'), m = Buffer.alloc(x.length / 3); for (let v = 0; v < m.length; v++) m[v] = x[v * 3] !== y[v * 3] || x[v * 3 + 1] !== y[v * 3 + 1] || x[v * 3 + 2] !== y[v * 3 + 2] ? 255 : 0; return m.some((q) => q) ? m.toString('base64') : null; };
  const parts = L.parts.map((p, i) => { if (!p) return p; const sig = mask(p.col, M.parts[i].col); return { ...p, colS: D.parts[i].col, ...(sig ? { sigM: sig } : {}) }; });
  return { ...L, parts, toon: true, workbot: { card: S.card, height, faces: [...buckets.values()].reduce((a, fs) => a + fs.length, 0) } };
}

/** A worker bot's VENTS ({ at, dir } in its own frame, grounded): where its steam leaves (the page's steam, body.steam). */
export function workbotVents(spec) {
  return workbotFaces(spec).vents;
}
