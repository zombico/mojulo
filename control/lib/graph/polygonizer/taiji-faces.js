/**
 * taiji-faces — the bridge from a taiji's 3D envelope into the engine-agnostic
 * baked face list (`{ corners, fill, doubleSided }`) that the World renderers
 * consume (scene-css3d `emitPreserve3dScene` + scene-three `emitThreeWorld` via
 * face-mesh.js). This is what lets the taiji PLANT primitive (expandTree etc.)
 * render in the traversable three.js World, not only the projected manji SVG.
 *
 * It is the taiji twin of figure-render.litFaces and manji-svg.buildLatheFaces:
 * walk the envelope's ring-grid (crossSections+1 rings × samples+1 circle points,
 * produced by sampleTaiji with showEnvelope) and emit one shaded quad per cell.
 * Shading is camera-INDEPENDENT (vexar litFactor on the outward face normal), so
 * the colour is correct from any orbit angle — matching how every other World
 * face is baked.
 *
 * Mesh density is deliberately LOW (face-mesh defaults, NOT the SVG DETAIL_PRESETS
 * which are tuned for smooth 2D curves): a tube reads solid at ~8 sides, and a
 * plant emits many tubes. crossSections clamps to a min of 2 and samples to 8 in
 * resolveTaijiSpec, so those are the floor.
 *
 * v1 emits tube WALLS only — no end caps. Both renderers require 4-corner quads
 * (face-mesh skips <4 corners; CSS-3D renders a parallelogram), and a real cap is
 * an n-gon fan that would need the clip-polygon trick per slice. Trunk ends sit in
 * the ground or under a branch/canopy join, and spindle ends self-close (R→0), so
 * open ends are not visible in practice. Caps are a documented follow-up.
 *
 * Pure: no three.js, no DOM. Unit-testable in node.
 *
 * Design: control/lib/graph/vegetation.plan.md.
 * Dual reference: taiji.js (sampleTaiji), vexar.js (the shade), figure-render.js
 * (the meshing pattern this mirrors).
 */

import { sampleTaiji } from './taiji.js';
import { centroid, newellNormal, dot3, sub3, DEFAULT_LIGHT, shadeHex } from './vexar.js';

// {x,y,z} (taiji frame) → [x,y,z] (vexar / World face frame).
const P = (p) => [p.x, p.y, p.z];

// Low face-mesh density. A plant emits MANY taijis, so each tube is coarse;
// the surface reads from shading, not polygon count (the vexar LOD philosophy).
const FACE_CROSS_SECTIONS = 3; // segments ALONG the tube (a limb is short)
const FACE_SAMPLES = 8;        // sides AROUND the tube (the resolveTaijiSpec floor)

// Hard backstop so a runaway spec can't emit a giant mesh for one taiji.
const MAX_FACES_PER_TAIJI = 4096;

// Representative albedo for the whole tube. The plant styles carry the palette as
// stroke colours; partitionStroke is the mid tone (trunk brown / leaf green), so it
// reads as a sensible flat albedo that litFactor then modulates per face.
export function pickTint(spec) {
  const s = spec && spec.style;
  return (s && (s.partitionStroke || s.yinStroke || s.yangStroke)) || spec?.fill || '#6a4932';
}

/**
 * taijiToFaces(spec, opts) → [{ corners:[[x,y,z]×4], fill:'#hex', doubleSided:true }]
 *
 * @param {object} spec  a taiji spec (yin/yang/center/radius/profile/twist/style…),
 *                       as emitted by expandPlant/expandTree.
 * @param {object} opts  { light, crossSections, samples, tint }
 *   light          — a vexar light (makeLight). Defaults to DEFAULT_LIGHT.
 *   crossSections  — override mesh density along the tube.
 *   samples        — override mesh density around the tube.
 *   tint           — override albedo hex (else derived from spec.style).
 */
export function taijiToFaces(spec = {}, opts = {}) {
  const light = opts.light || DEFAULT_LIGHT;
  const crossSections = Number.isInteger(opts.crossSections) ? opts.crossSections : FACE_CROSS_SECTIONS;
  const samples = Number.isInteger(opts.samples) ? opts.samples : FACE_SAMPLES;
  const tint = opts.tint || pickTint(spec);

  const sampled = sampleTaiji({ ...spec, showEnvelope: true, crossSections, samples });
  const env = sampled.envelope;
  if (!Array.isArray(env) || env.length < 2) return [];

  const faces = [];
  for (let i = 0; i < env.length - 1; i += 1) {
    const a = env[i].polyline;
    const b = env[i + 1].polyline;
    const m = Math.min(a.length, b.length);
    const c0 = env[i].center;
    const c1 = env[i + 1].center;
    // Midpoint of the two ring centres = an interior axis point; the outward
    // normal points away from it (orientOutward, inlined).
    const cw = [(c0.x + c1.x) / 2, (c0.y + c1.y) / 2, (c0.z + c1.z) / 2];
    for (let j = 0; j < m - 1; j += 1) {
      const corners = [P(a[j]), P(a[j + 1]), P(b[j + 1]), P(b[j])];
      // Skip a degenerate cell (a ring that has collapsed to its centre — the
      // spindle pole, R→0 — produces zero-area quads).
      const cen = centroid(corners);
      let n = newellNormal(corners);
      if (!Number.isFinite(n[0]) || !Number.isFinite(n[1]) || !Number.isFinite(n[2])) continue;
      if (dot3(n, sub3(cen, cw)) < 0) n = [-n[0], -n[1], -n[2]];
      faces.push({ corners, fill: shadeHex(tint, n, light), doubleSided: true });
      if (faces.length >= MAX_FACES_PER_TAIJI) return faces;
    }
  }
  return faces;
}

export { FACE_CROSS_SECTIONS, FACE_SAMPLES, MAX_FACES_PER_TAIJI };

// ───────────────────────────────────────────────────────────────────────────
// taijiStrandFaces — the DOUBLE-HELIX lowering (sibling of taijiToFaces above).
//
// Where taijiToFaces meshes the taiji's outer ENVELOPE into one solid tube (the
// plant/limb read), taijiStrandFaces meshes the taiji's two pole-STRANDS into
// beaded backbone tubes and joins corresponding strand points with RUNG rods —
// i.e. the double helix as a ladder. Every piece is a CONVEX solid with outward
// normals (tube segment, sphere bead, straight rod), so single-sided vexar
// shading reads correctly under WebGL backface culling — and the discrete rung
// sampling sidesteps the helicoid's central-axis pinch (where the continuous
// partition surface self-touches and a naive quad-strip goes degenerate).
//
// First customer: dna-view.js. Reusable for any taiji whose strands are the
// salient form (coiled coils, twisted cable pairs).
// ───────────────────────────────────────────────────────────────────────────

const TAU2 = Math.PI * 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// a straight capped-cylinder ROD (side quads only — ends buried in beads). Each quad carries its
// outward radial normal. Mirrors molecule-view's rodFaces.
function rodFaces(pA, pB, r, sides) {
  const axisV = sub3(pB, pA), L = vlen(axisV);
  if (L < 1e-6 || r <= 0) return [];
  const dir = scl(axisV, 1 / L);
  let u = cross(dir, [0, 0, 1]);
  if (vlen(u) < 1e-4) u = cross(dir, [1, 0, 0]);
  u = unit(u);
  const w = unit(cross(dir, u));
  const ring = (c) => Array.from({ length: sides }, (_, k) => {
    const a = (k / sides) * TAU2;
    return add(c, add(scl(u, Math.cos(a) * r), scl(w, Math.sin(a) * r)));
  });
  const rA = ring(pA), rB = ring(pB), out = [];
  for (let k = 0; k < sides; k++) {
    const k2 = (k + 1) % sides, mid = ((k + 0.5) / sides) * TAU2;
    const n = unit(add(scl(u, Math.cos(mid)), scl(w, Math.sin(mid))));
    out.push({ corners: [rA[k], rB[k], rB[k2], rA[k2]], normal: n });
  }
  return out;
}

// a smooth TUBE swept along a polyline ([x,y,z][]) with a parallel-transport frame, so the facet
// seam doesn't spin around bends. Consecutive rings quad-stripped; ends left open (beads cap them).
function tubeFaces(points, r, sides) {
  if (points.length < 2 || r <= 0) return [];
  const tan = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const t = sub3(b, a);
    return vlen(t) < 1e-9 ? [0, 0, 1] : unit(t);
  });
  let refN = cross(tan[0], [0, 0, 1]);
  if (vlen(refN) < 1e-4) refN = cross(tan[0], [1, 0, 0]);
  refN = unit(refN);
  const rings = [];
  for (let i = 0; i < points.length; i++) {
    refN = unit(sub3(refN, scl(tan[i], dot3(refN, tan[i]))));     // parallel transport
    if (vlen(refN) < 1e-6) { refN = cross(tan[i], [0, 0, 1]); if (vlen(refN) < 1e-4) refN = cross(tan[i], [1, 0, 0]); refN = unit(refN); }
    const bi = unit(cross(tan[i], refN));
    rings.push(Array.from({ length: sides }, (_, k) => {
      const a = (k / sides) * TAU2, c = Math.cos(a), s = Math.sin(a);
      return { p: add(points[i], add(scl(refN, c * r), scl(bi, s * r))), n: unit(add(scl(refN, c), scl(bi, s))) };
    }));
  }
  const out = [];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      const a = rings[i][k], b = rings[i + 1][k], c = rings[i + 1][k2], d = rings[i][k2];
      out.push({ corners: [a.p, b.p, c.p, d.p], normal: unit(add(add(a.n, b.n), add(c.n, d.n))) });
    }
  }
  return out;
}

// a faceted UV-sphere bead → corner-array faces (convex; per-face outward normal).
function sphereFaces(center, r, longs, lats) {
  const grid = [];
  for (let j = 0; j <= lats; j++) {
    grid[j] = [];
    for (let i = 0; i < longs; i++) {
      const th = -Math.PI / 2 + Math.PI * (j / lats), ph = TAU2 * (i / longs);
      grid[j][i] = [Math.cos(th) * Math.cos(ph), Math.cos(th) * Math.sin(ph), Math.sin(th)];
    }
  }
  const out = [];
  for (let j = 0; j < lats; j++) for (let i = 0; i < longs; i++) {
    const a = grid[j][i], b = grid[j][(i + 1) % longs], c = grid[j + 1][(i + 1) % longs], d = grid[j + 1][i];
    const ug = j === 0 ? [a, c, d] : j === lats - 1 ? [a, b, d] : [a, b, c, d];
    out.push({ corners: ug.map((u) => add(center, scl(u, r))), normal: unit(centroid(ug)) });
  }
  return out;
}

/**
 * taijiStrandFaces(spec, opts) → { faces, rungs, strands }
 *
 * `spec` is a sampleTaiji spec ({ yin, yang, center?, twist, radius, profile,
 * crossSections } with yin/yang as {x,y,z}). Geometry is regenerated from the
 * spec, so the World mesh tracks the same helix the projected SVG taiji draws.
 *
 * opts (all optional): light, sides, strandRadius, rungRadius, beadRadius,
 *   beads (bool, default true), rungStride (emit a rung every N cross-sections),
 *   yinColor, yangColor, rungColor, yinGroup, yangGroup, rungGroupPrefix,
 *   rungPaint(i) → { a, b } (split-coloured halves) | hex (whole rung),
 *   strandPaint(i) → { yin, yang } per-cross-section backbone colours (a mosaic /
 *     gradient along the axis — e.g. a recombination crossover). When given, the
 *     backbone is drawn as per-segment rods + beads instead of one smooth tube.
 */
export function taijiStrandFaces(spec, opts = {}) {
  const sampled = sampleTaiji(spec);
  const yin = sampled.strands.yin.map(P);
  const yang = sampled.strands.yang.map(P);
  const R = Number.isFinite(spec.radius) && spec.radius > 0 ? spec.radius : 1;

  const light = opts.light || DEFAULT_LIGHT;
  const sides = Math.max(4, Math.floor(opts.sides ?? 9));
  const strandR = Number.isFinite(opts.strandRadius) ? opts.strandRadius : R * 0.12;
  const rungR = Number.isFinite(opts.rungRadius) ? opts.rungRadius : R * 0.07;
  const beadR = Number.isFinite(opts.beadRadius) ? opts.beadRadius : strandR * 1.5;
  const beads = opts.beads !== false;
  const stride = Math.max(1, Math.floor(opts.rungStride ?? 1));
  const yinColor = opts.yinColor || '#3fb6ad';
  const yangColor = opts.yangColor || '#e3b23c';
  const rungColor = opts.rungColor || '#9aa0bd';
  const yinGroup = opts.yinGroup || 'backbone:yin';
  const yangGroup = opts.yangGroup || 'backbone:yang';
  const rungPrefix = opts.rungGroupPrefix || 'bp:';
  const strandPaint = typeof opts.strandPaint === 'function' ? opts.strandPaint : null;

  const faces = [];
  const lit = (rf, color, group) => { for (const f of rf) faces.push({ corners: f.corners, fill: shadeHex(color, f.normal, light), group }); };
  const blong = Math.max(6, Math.round(sides)), blat = Math.max(4, Math.round(sides * 0.6));

  // backbones: a bead at each cross-section (phosphate nodes; also hide tube ends / bend gaps) plus the
  // connecting tube. Uniform colour → one smooth tube; a per-cross-section `strandPaint` → per-segment
  // rods so the backbone can read as a mosaic (e.g. a recombination crossover where the colour switches).
  if (strandPaint) {
    for (let i = 0; i < yin.length; i += 1) {
      const c = strandPaint(i) || {};
      const cy = c.yin || yinColor, cg = c.yang || yangColor;
      if (beads) { lit(sphereFaces(yin[i], beadR, blong, blat), cy, yinGroup); lit(sphereFaces(yang[i], beadR, blong, blat), cg, yangGroup); }
      if (i < yin.length - 1) {
        lit(rodFaces(yin[i], yin[i + 1], strandR, sides), cy, yinGroup);
        lit(rodFaces(yang[i], yang[i + 1], strandR, sides), cg, yangGroup);
      }
    }
  } else {
    lit(tubeFaces(yin, strandR, sides), yinColor, yinGroup);
    lit(tubeFaces(yang, strandR, sides), yangColor, yangGroup);
    if (beads) {
      for (const p of yin) lit(sphereFaces(p, beadR, blong, blat), yinColor, yinGroup);
      for (const p of yang) lit(sphereFaces(p, beadR, blong, blat), yangColor, yangGroup);
    }
  }

  // rungs: a rod (or two split half-rods) joining corresponding strand points = the base pairs.
  const rungs = [];
  for (let i = 0; i < yin.length; i += stride) {
    const a = yin[i], b = yang[i], mid = scl(add(a, b), 0.5);
    const group = `${rungPrefix}${i}`;
    const paint = typeof opts.rungPaint === 'function' ? opts.rungPaint(i) : null;
    if (paint && typeof paint === 'object' && paint.a && paint.b) {
      lit(rodFaces(a, mid, rungR, sides), paint.a, group);
      lit(rodFaces(mid, b, rungR, sides), paint.b, group);
    } else {
      lit(rodFaces(a, b, rungR, sides), (typeof paint === 'string' && paint) || rungColor, group);
    }
    rungs.push({ index: i, a, b, mid, group });
  }

  return { faces, rungs, strands: { yin, yang } };
}
