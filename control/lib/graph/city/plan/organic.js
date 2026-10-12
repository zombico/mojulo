/**
 * ORGANIC MASSES: the shapes a box cannot stand as, built from facade-carded strips so their windows follow the curve,
 * the way the legacy city's cylinder is (scene-css3d.js cylinderBuilding). The vocabulary a modernista or an alien city
 * reaches for:
 *
 *   undulate  a mass whose street walls ripple inward in a slow wave and whose roofline swells and dips with it, its
 *             roof crowned with sculpted chimneys (Casa Milà's register): it stays inside its lot, so its neighbours'
 *             party walls are untouched
 *   spindle   a revolved tower that swells and tapers to a finial (a Sagrada Família spire's register): its profile a
 *             smooth bulge, its windows on bands of floors
 *
 * Each takes a box in the legacy city's units (scene.js cityBoxes) and its worn facade, and returns faces as that
 * pipeline does: a wall carries its facade card (`card`, `lit`) and its CSS-3D paint (`bg`). Pure; no dice: the shape's
 * variation is hashed off the lot's id, so the facade layer's streams stay as they are.
 */
import { buildFacadeCard } from '../../architecture/facade-card.js';
import { facadeCss, makeFacade } from '../../architecture/building-facade.js';
import { litFactor, makeLight, scaleHex } from '../../polygonizer/vexar.js';
import { cos, sin, pow } from '../../../util/dmath.js';
import { strHash } from './dice.js';

export const ORGANIC_SHAPES = Object.freeze(['undulate', 'spindle']);
// the city pipeline's own key light (scene-css3d.js assembleBoxCityScene), so a curved wall reads beside a flat one
const LIGHT = makeLight({ direction: [0.34, 0.46, -0.82], ambient: 0.56, diffuse: 0.52 });
const r3 = (v) => Math.round(v * 1000) / 1000;
const TAU = 2 * Math.PI;

// the light a mass is grown under: the city pipeline's own unless a look hands another (organicFaces' third argument)
let light = LIGHT;
function wall(corners, normal, facade, floors, bays) {
  const lit = litFactor(normal, light);
  return { corners: corners.map((p) => p.map(r3)), normal: normal.map(r3), bg: facadeCss(facade, lit, floors, bays), card: buildFacadeCard(facade, Math.max(1, floors), Math.max(1, bays)), lit, doubleSided: false };
}
const plain = (corners, normal, hex, k = 1) => ({ corners: corners.map((p) => p.map(r3)), normal: normal.map(r3), fill: scaleHex(hex, litFactor(normal, light) * k), doubleSided: true });
const unit = (v) => { const L = Math.hypot(...v) || 1; return v.map((x) => x / L); };
const roofHex = (f) => f.roof || scaleHex(f.glass, 0.62);
const bodyHex = (f) => (f.material === 'glass' ? f.glass : f.frame);

/**
 * UNDULATE: the lot's rectangle, its street faces drawn in by a wave (never out of the lot), its roofline a wave over
 * the perimeter. `b` a city box (units), `f` its facade.
 */
export function undulateMass(b, f) {
  const h = strHash(b.lot || `${b.x},${b.y}`), phase = (h % 628) / 100, waves = 1 + ((h >>> 10) % 2);
  const { x, y, w, d, z0, z1 } = b, cx = x + w / 2, cy = y + d / 2;
  const amp = Math.min(0.9, Math.min(w, d) * 0.18), crest = Math.min(f.floorH * 1.1, (z1 - z0) * 0.18);
  // the perimeter, corner to corner, sampled every ~half a bay; a street face waves, a party wall stays straight
  const fronts = new Set(b.roadFaces || [b.front || '+y']);
  const sides = [['-y', [x, y], [x + w, y], [0, 1]], ['+x', [x + w, y], [x + w, y + d], [-1, 0]], ['+y', [x + w, y + d], [x, y + d], [0, -1]], ['-x', [x, y + d], [x, y], [1, 0]]];
  const ring = [];
  let s = 0;
  const per = 2 * (w + d);
  for (const [face, a, c, inward] of sides) {
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]), n = Math.max(2, Math.round(len / Math.max(0.25, f.bayW * 0.5)));
    for (let k = 0; k < n; k++) {
      const t = k / n, wave = fronts.has(face) ? amp * (0.5 - 0.5 * cos(TAU * waves * t)) : 0;
      const px = a[0] + (c[0] - a[0]) * t + inward[0] * wave, py = a[1] + (c[1] - a[1]) * t + inward[1] * wave;
      ring.push({ p: [px, py], top: z1 - crest * 0.5 + crest * 0.5 * sin(TAU * 3 * (s + t * len) / per + phase), face });
    }
    s += len;
  }
  const faces = [];
  for (let i = 0; i < ring.length; i++) {
    const A = ring[i], B = ring[(i + 1) % ring.length], dx = B.p[0] - A.p[0], dy = B.p[1] - A.p[1];
    if (Math.hypot(dx, dy) < 1e-6) continue;
    const n = unit([dy, -dx, 0]), floors = Math.max(1, Math.round(((A.top + B.top) / 2 - z0) / f.floorH));
    faces.push(wall([[A.p[0], A.p[1], z0], [B.p[0], B.p[1], z0], [B.p[0], B.p[1], B.top], [A.p[0], A.p[1], A.top]], n, f, floors, 1));
  }
  // the roof: a fan from the middle, swelling a little over the walls
  const apex = [cx, cy, z1 + crest * 0.3];
  for (let i = 0; i < ring.length; i++) {
    const A = ring[i], B = ring[(i + 1) % ring.length], P = [A.p[0], A.p[1], A.top], Q = [B.p[0], B.p[1], B.top];
    const u = [Q[0] - P[0], Q[1] - P[1], Q[2] - P[2]], v = [apex[0] - P[0], apex[1] - P[1], apex[2] - P[2]];
    const n = unit([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
    faces.push(plain([P, Q, apex, apex], n[2] < 0 ? n.map((k) => -k) : n, roofHex(f)));
  }
  // the sculpted chimneys: small spindles on the roof, two to four of them
  const count = 2 + ((h >>> 3) % 3);
  for (let k = 0; k < count; k++) {
    const t = (k + 0.5) / count, rx = x + w * (0.25 + 0.5 * t), ry = y + d * (0.3 + 0.4 * (((h >>> (5 + k)) & 1) ? 1 : 0));
    faces.push(...lathe(rx, ry, z1 - crest * 0.2, Math.min(0.22, Math.min(w, d) * 0.08), f.floorH * 1.4, { segments: 8, bands: 3, bulge: 0.6, point: 0.25 }, null, bodyHex(f)));
  }
  return faces;
}

/** A revolved mass on (cx, cy) from z0, `height` tall, its radius `r` at the widest; windows on bands when `f` is given. */
function lathe(cx, cy, z0, r, height, { segments = 12, bands = 6, bulge = 0.35, point = 0.08 }, f, hex) {
  // the profile: swelling to its widest a third of the way up, then tapering to a point (`point` of the radius at the top)
  const R = (t) => r * (point + (1 - point) * pow(1 - t, 0.8) * (1 + bulge * sin(Math.PI * Math.min(1, t * 1.5))) / (1 + bulge));
  const faces = [];
  for (let k = 0; k < bands; k++) {
    const t0 = k / bands, t1 = (k + 1) / bands, za = z0 + height * t0, zb = z0 + height * t1, ra = R(t0), rb = R(t1);
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * TAU, a1 = ((i + 1) / segments) * TAU, am = (a0 + a1) / 2;
      const P = (a, rr, z) => [cx + cos(a) * rr, cy + sin(a) * rr, z];
      const slope = (ra - rb) / Math.max(1e-6, zb - za), n = unit([cos(am), sin(am), slope]);
      const corners = [P(a0, ra, za), P(a1, ra, za), P(a1, rb, zb), P(a0, rb, zb)];
      if (f) {
        const floors = Math.max(1, Math.round((zb - za) / f.floorH)), bays = Math.max(1, Math.round((TAU * (ra + rb) / 2 / segments) / f.bayW));
        faces.push(wall(corners, n, f, floors, bays));
      } else faces.push(plain(corners, n, hex));
    }
  }
  // the finial: a short point over the top
  const top = z0 + height, rt = R(1);
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * TAU, a1 = ((i + 1) / segments) * TAU, am = (a0 + a1) / 2, tip = [cx, cy, top + Math.max(rt * 3, height * 0.06)];
    faces.push(plain([[cx + cos(a0) * rt, cy + sin(a0) * rt, top], [cx + cos(a1) * rt, cy + sin(a1) * rt, top], tip, tip], unit([cos(am), sin(am), 0.6]), f ? roofHex(f) : hex, 1.05));
  }
  return faces;
}

/** SPINDLE: a revolved tower inscribed in its lot, swelling then tapering to a finial, windows on bands of floors. */
export function spindleMass(b, f) {
  const h = strHash(b.lot || `${b.x},${b.y}`), height = b.z1 - b.z0;
  const r = Math.min(b.w, b.d) / 2 * 0.96, bands = Math.max(3, Math.min(14, Math.round(height / (f.floorH * 2))));
  return lathe(b.x + b.w / 2, b.y + b.d / 2, b.z0, r, height, { segments: 14, bands, bulge: 0.25 + ((h % 100) / 100) * 0.3, point: 0.06 + ((h >>> 8) % 10) / 100 }, f, bodyHex(f));
}

/** A box's worn facade, made as the city pipeline makes it (a hashed descriptor, the box's own floor height, its skin
 *  over both: scene-css3d.js wearSkin, whose roof cap, blades and kit stay with the boxes it draws). */
export function facadeOf(b) {
  const base = makeFacade(strHash(b.lot || b.site || `${b.x},${b.y}`), { height: b.z1 - b.z0 });
  const { kit, roofCap, blades, ...rest } = b.skin || {};
  return { ...base, ...(b.floorH ? { floorH: b.floorH } : {}), ...rest, ...(rest.material === 'brick' ? {} : { fireEscape: false }) };
}

/** The faces of an organic mass, or null when the box stands as a shape the city pipeline draws itself. */
export function organicFaces(b, f = facadeOf(b), L = LIGHT) {
  if (!ORGANIC_SHAPES.includes(b.shape)) return null;
  light = L;
  try { return b.shape === 'undulate' ? undulateMass(b, f) : spindleMass(b, f); } finally { light = LIGHT; }
}
