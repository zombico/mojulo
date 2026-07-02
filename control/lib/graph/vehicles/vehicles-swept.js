/**
 * vehicles-swept — adapt the production swept-superellipse vehicle models
 * (polygonizer/vehicle-swept-net.js) into CSS3D faces.
 *
 * The production builders construct 3D facet quads with baked vexar lighting and a
 * wrap-card texture sampled per facet; they only flatten to 2D at the final
 * `.map(project)`. We pass an IDENTITY projector that preserves z, so the returned
 * shapes are real 3D quads we drop into the CSS3D `faces` list. Wheels (30-gon
 * rings) become "coins" — a tread rim extruded along the axle + a circular face
 * (a square quad with `radius:'50%'`, so the cap reads round in BOTH the CSS3D
 * border-radius path and the Three.js realizer's rounded-rect tessellation; a
 * `circle()` clip would only round in CSS3D and stay square in the World).
 *
 * `cull:false` (default) emits the whole closed shell so the model reads from ANY
 * camera (multi-camera scenes), at ~2× the face count of the single-camera path.
 *
 * Models are normalised by GLOBAL_K so a swept sedan (5 m) lands at ~1.75 world
 * units — the same convention as the box-city scale — and real relative sizes are
 * preserved (a bus stays proportionally bigger). Orientation: build local (length
 * along +y), then rotate to (axis,dir) and translate to (cx,cy) on the ground.
 *
 *   sweptFaces({ net, family, cx, cy, axis, dir, scale, ns, na, quality, cull }) → faces[]
 */

import {
  buildCarNetSceneShapes, buildSmoothBoxNetSceneShapes, getCarNet, getSmoothBoxNet,
} from '../polygonizer/vehicle-swept-net.js';
import { buildFuselageNetSceneShapes, getFuselageNet } from '../polygonizer/vehicle-fuselage-net.js';

const GLOBAL_K = 0.35;                                 // 5 m sedan → ~1.75 world units
const P3 = (w) => ({ x: w[0], y: w[1], z: w[2] });     // identity projector (non-array → kept verbatim, z survives)
const cen = (pts) => { let x = 0, y = 0, z = 0; for (const p of pts) { x += p[0]; y += p[1]; z += p[2]; } const n = pts.length; return [x / n, y / n, z / n]; };
const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const shade = (h, f) => '#' + hx(h).map((v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join('');

// axis/dir → rotation that aligns the model's local +y (production length axis)
// with the requested heading. `heading` (radians, nose direction CCW from +x)
// overrides axis/dir so callers can park a vehicle at an arbitrary angle (sawtooth
// bus bays, taxiing planes).
function rotFor(axis, dir, heading) {
  if (Number.isFinite(heading)) return heading - Math.PI / 2;
  const deg = axis === 'x' ? (dir > 0 ? 0 : 180) : (dir > 0 ? 90 : -90);
  return ((deg - 90) * Math.PI) / 180;
}

export function sweptFaces({ net = 'sedan', family = 'car', cx = 0, cy = 0, axis = 'x', dir = 1, heading, scale = 1, ns = 10, na = 11, quality = 0.3, cull = false, paint, hull } = {}) {
  const isCar = family === 'car';
  const build = isCar ? buildCarNetSceneShapes : buildSmoothBoxNetSceneShapes;
  const L = isCar ? getCarNet(net).length : getSmoothBoxNet(net).geo.length;

  const place = { cx: 0, noseY: L / 2 };                            // centred, length along +y
  const buildOpts = { place, projectPoint: P3, cameraPosition: [0, 0, 1e4], ns, na, quality, cull };
  if (isCar) { buildOpts.paint = paint; buildOpts.hull = hull; }    // paint/hull are car-family finishes
  const { shapes } = build(net, buildOpts);

  // local → world: uniform scale (GLOBAL_K·scale) about origin, rotate to heading, translate
  const k = GLOBAL_K * scale, rot = rotFor(axis, dir, heading), cos = Math.cos(rot), sin = Math.sin(rot);
  const W = ([x, y, z]) => { const sx = x * k, sy = y * k; return [cx + (sx * cos - sy * sin), cy + (sx * sin + sy * cos), z * k]; };

  const out = [];
  for (const s of shapes) {
    if (s.role === 'wheel') { out.push(...wheelCoin(s, W)); continue; }
    if (s.role === 'hub') { out.push(disc(s, W)); continue; }
    if (s.points.length === 4) out.push({ corners: s.points.map((p) => W([p.x, p.y, p.z])), fill: s.fill, doubleSided: true });
  }
  return out;
}

// wheel ring → a short cylinder ("coin"): tread rim extruded inboard + circular face
function wheelCoin(s, W) {
  const ring = s.points.map((p) => [p.x, p.y, p.z]);
  const c = cen(ring);
  const r = Math.max(...ring.map((p) => Math.hypot(p[1] - c[1], p[2] - c[2])));
  const outSign = Math.sign(c[0] || 1), width = Math.min(0.26, r * 0.52), inX = c[0] - outSign * width;
  const faces = [], tread = shade(s.fill, 0.82);
  for (let i = 0; i < ring.length; i += 2) {
    const a = ring[i], b = ring[(i + 2) % ring.length];
    faces.push({ corners: [a, b, [inX, b[1], b[2]], [inX, a[1], a[2]]].map(W), fill: tread, doubleSided: true });
  }
  const x = c[0] + outSign * 0.004;
  faces.push({ corners: [[x, c[1] - r, c[2] + r], [x, c[1] + r, c[2] + r], [x, c[1] + r, c[2] - r], [x, c[1] - r, c[2] - r]].map(W), fill: s.fill, radius: '50%', doubleSided: true });
  return faces;
}

// hubcap ring → a thin circular disc nudged onto the tyre face
function disc(s, W) {
  const pts = s.points.map((p) => [p.x, p.y, p.z]);
  const c = cen(pts);
  const r = Math.max(...pts.map((p) => Math.hypot(p[1] - c[1], p[2] - c[2])));
  const x = c[0] + 0.03 * Math.sign(c[0] || 1);
  return { corners: [[x, c[1] - r, c[2] + r], [x, c[1] + r, c[2] + r], [x, c[1] + r, c[2] - r], [x, c[1] - r, c[2] - r]].map(W), fill: s.fill, radius: '50%', doubleSided: true };
}

/**
 * Aircraft → CSS3D faces, the curved-fuselage twin of sweptFaces. Builds the
 * production swept fuselage (polygonizer/vehicle-fuselage-net.js — tapered body of
 * revolution + flat wing/stab/fin cards, baked vexar shading) at WORLD scale, then
 * rotates to heading + translates onto the ground. The WHOLE shell is emitted
 * (`cull:false`) so the aircraft reads solid from ANY camera in an orbitable scene —
 * `camHint` only orders the painter sort. Belly sits at z=0 (axisZ = radius). Feed the
 * result to renderBoxCityToHtml({faces}).
 *
 * `fillInterior` paints the inner skin the livery's dominant colour (true → livery.base,
 * or a hex override) so the open-ended fuselage reads as a filled solid through the
 * nose/tail rings instead of a dark hollow cavity.
 */
export function fuselageFaces({ net = 'jet', cx = 0, cy = 0, axis = 'y', dir = 1, heading, scale = 1, quality = 0.3, stations, angles, camHint, livery, fillInterior = false } = {}) {
  const descriptor = getFuselageNet(net);
  // Build at the model's NATURAL proportions — the appendage spans/drops in the net
  // are authored in this space (a span-4.6 wing on a length-6 body) and are NOT scaled
  // with the body, so the whole shell must be uniform-scaled afterwards (like sweptFaces).
  const L = descriptor?.proportions?.length || 6;
  const R = descriptor?.proportions?.radius || 0.6;
  const body = { center: [0, 0], axisZ: R, noseY: L / 2, length: L, radius: R };   // centred at origin, length along −y from nose(+y), belly on ground

  const k = GLOBAL_K * scale, rot = rotFor(axis, dir, heading), cos = Math.cos(rot), sin = Math.sin(rot);
  const W = ([x, y, z]) => { const sx = x * k, sy = y * k; return [cx + (sx * cos - sy * sin), cy + (sx * sin + sy * cos), z * k]; };
  // inverse-transform the world camera into the model's natural-scale local frame for
  // back-face culling: scale⁻¹ · Rz(−rot) · (cam − origin).
  const ch = Array.isArray(camHint) ? camHint : [cx, cy + 30, 24];
  const rx = ch[0] - cx, ry = ch[1] - cy;
  const localCam = [(rx * cos + ry * sin) / k, (-rx * sin + ry * cos) / k, ch[2] / k];

  const { shapes } = buildFuselageNetSceneShapes(net, { body, projectPoint: P3, cameraPosition: localCam, quality, stations, angles, scheme: livery, cull: false, fillInterior });
  const out = [];
  for (const s of shapes) if (s.points.length === 4) out.push({ corners: s.points.map((p) => W([p.x, p.y, p.z])), fill: s.fill, doubleSided: true });
  return out;
}
