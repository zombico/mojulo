/**
 * lathe-faces — the bridge from a lathe's surface of revolution into the engine-agnostic
 * baked face list (`{ corners, fill, doubleSided }`) the World renderers consume (scene-css3d
 * `emitPreserve3dScene` + scene-three `emitThreeWorld` via face-mesh.js).
 *
 * The lathe twin of `taiji-faces.taijiToFaces` and `figure-render.litFaces`: `sampleLathe`
 * already returns a ring-grid (`polylines` — crossSections+1 closed cross-sections, each
 * samples+1 points), the SAME structure taijiToFaces meshes. Walk consecutive rings × samples,
 * emit one vexar-shaded quad per cell with the outward normal (away from the axis centreline),
 * then close each open end with a real-radius cap. Shading is camera-INDEPENDENT (Lambert on the
 * face normal), so the colour is correct from any orbit angle — matching every other World face.
 *
 * This is what lets a `lathe` monomer — and a polygomer of lathes (a candlestick, a dumbbell, a
 * bottle) — render in the traversable three.js World as a measured object, not only the projected
 * manji SVG. It is the geometry core of the `workbench` vantage.
 *
 * Pure: no three.js, no DOM. Unit-testable in node. The caller resolves axisFrom/axisTo to {x,y,z}
 * first (same contract as sampleLathe — endpoint paths are not resolved here).
 *
 * Design: control/lib/graph/workbench.plan.md  ·  Dual reference: lathe.js (sampleLathe),
 * vexar.js (the shade), taiji-faces.js (the meshing pattern this mirrors).
 */

import { sampleLathe } from './lathe.js';
import { centroid, newellNormal, dot3, sub3, norm3, shadeHexMat, DEFAULT_LIGHT } from './vexar.js';
import { resolveMaterial, tagFacesWithMaterial } from './materials.js';

// {x,y,z} (lathe frame) → [x,y,z] (vexar / World face frame).
const P = (p) => [p.x, p.y, p.z];

// sampleLathe's own clamp defaults — a single hero object can afford a smoother sweep than a
// taiji (a plant emits MANY taijis; a lathe is one monomer), so these match sampleLathe, not the
// coarse taiji floor. Exported for tests / callers that want predictable face counts.
const DEFAULT_CROSS_SECTIONS = 24;
const DEFAULT_SAMPLES = 36;

// Hard backstop so a runaway spec can't emit a giant mesh for one lathe.
const MAX_FACES_PER_LATHE = 16384;

// End rings narrower than this (world units) are treated as self-closing (a sphere/spindle pole,
// R→0) and get no cap — capping them would only add zero-area slivers at the axis.
const CAP_MIN_RADIUS = 0.08;

/** Representative albedo for the whole surface. A lathe spec's `style.fill`/`fill` carries it; else a neutral steel. */
export function pickTint(spec) {
  return (spec && spec.style && spec.style.fill) || (spec && spec.fill) || '#9aa3b0';
}

// A flat end cap: a triangle fan from the ring centre, emitted as (degenerate) 4-corner quads so
// face-mesh — which skips <4-corner faces — renders each triangle. One uniform shade (the cap
// normal is the axis direction) reads as a flat disc. `flip` reverses winding for the far end.
function capFan(ring, center, normal, tint, light, flip, mat = null) {
  const fill = shadeHexMat(tint, normal, mat, { light });
  const out = [];
  for (let j = 0; j < ring.length - 1; j += 1) {
    const p0 = P(ring[j]);
    const p1 = P(ring[j + 1]);
    out.push({ corners: flip ? [center, p1, p0, center] : [center, p0, p1, center], fill, doubleSided: true });
  }
  return out;
}

/**
 * latheToFaces(spec, opts) → [{ corners:[[x,y,z]×4], fill:'#hex', doubleSided:true }]
 *
 * @param {object} spec  a lathe spec ({ axisFrom, axisTo, profile, harmonics?, normalFrom?,
 *                       normalTo?, crossSections?, samples?, style? }) with resolved axis endpoints.
 * @param {object} opts  { light, tint, material, caps, crossSections, samples }
 *   light         — a vexar light (makeLight). Defaults to DEFAULT_LIGHT.
 *   tint          — override albedo hex (else derived from spec.style.fill / spec.fill).
 *   material      — optional material row / name / #hex (polygonizer/materials.js): the surface's
 *                   response curve (wood / steel / stone …). Camera-independent terms only — these
 *                   faces feed the shared payload, so no baked specular here. Absent → byte-identical
 *                   plain-vexar output (material-response.plan.md).
 *   caps          — close real-radius ends (default true). false → tube walls only (taiji-style).
 *   crossSections — override mesh density along the axis (else spec.crossSections / default).
 *   samples       — override mesh density around the axis (else spec.samples / default).
 */
export function latheToFaces(spec = {}, opts = {}) {
  const light = opts.light || DEFAULT_LIGHT;
  const mat = opts.material ? resolveMaterial(opts.material) : null;
  // a material with no explicit tint contributes its own albedo — 'gold' LOOKS gold
  const tint = opts.tint || (spec.style && spec.style.fill) || spec.fill || (mat && mat.base) || pickTint(spec);
  const caps = opts.caps !== false;
  const cs = Number.isInteger(opts.crossSections) ? opts.crossSections
    : Number.isInteger(spec.crossSections) ? spec.crossSections : DEFAULT_CROSS_SECTIONS;
  const sm = Number.isInteger(opts.samples) ? opts.samples
    : Number.isInteger(spec.samples) ? spec.samples : DEFAULT_SAMPLES;

  const { polylines } = sampleLathe({ ...spec, crossSections: cs, samples: sm });
  if (!Array.isArray(polylines) || polylines.length < 2) return [];

  const aF = spec.axisFrom;
  const aT = spec.axisTo;
  const centerAt = (i) => {
    const t = i / cs;
    return [aF.x + t * (aT.x - aF.x), aF.y + t * (aT.y - aF.y), aF.z + t * (aT.z - aF.z)];
  };

  // Optional LABEL WRAP: a texture mapped onto a t-band of the wall (a can/bottle label). Band faces
  // carry `uv` (u = θ/2π + seam, monotonic; v = position within the band) + a `texture` key so the
  // World renderer draws them with a MeshBasicMaterial({ map }). u increases WITH θ (no mirror) and
  // is NOT wrapped to [0,1] — RepeatWrapping resolves u>1 so the seam never smears (proven 0616).
  const wrap = spec.wrap && typeof spec.wrap === 'object' && typeof spec.wrap.texture === 'string' ? spec.wrap : null;
  const band = wrap && wrap.band && typeof wrap.band === 'object' ? wrap.band : {};
  const tFrom = Number.isFinite(band.tFrom) ? band.tFrom : 0;
  const tTo = Number.isFinite(band.tTo) ? band.tTo : 1;
  const seam = Number.isFinite(wrap && wrap.seam) ? wrap.seam : 0;
  const vAt = (t) => (tTo - tFrom > 1e-6 ? (t - tFrom) / (tTo - tFrom) : 0);

  // Sparse glow (spec.glowProxy): instead of tagging EVERY wall face (~cs×sm halos — a per-facet
  // trace that is both a perf sink and reads as an outline), emit the halo from only a few rings ×
  // a few columns spread over the surface. Radial coverage is kept (columns face all directions),
  // so from any orbit angle some source faces you — but the count drops from hundreds to ~rings×around.
  const proxy = spec.glow && spec.glowProxy ? (spec.glowProxy === true ? {} : spec.glowProxy) : null;
  const ringStep = proxy ? Math.max(1, Math.round(cs / (proxy.rings ?? 4))) : 1;
  const colStep = proxy ? Math.max(1, Math.round(sm / (proxy.around ?? 6))) : 1;
  const glowAt = (i, j) => spec.glow && (!proxy || (i % ringStep === 0 && j % colStep === 0));

  const faces = [];
  for (let i = 0; i < polylines.length - 1; i += 1) {
    const a = polylines[i];
    const b = polylines[i + 1];
    const m = Math.min(a.length, b.length);
    const c0 = centerAt(i);
    const c1 = centerAt(i + 1);
    const axisMid = [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2, (c0[2] + c1[2]) / 2];
    const ti = i / cs, ti1 = (i + 1) / cs;
    const inBand = wrap && (ti + ti1) / 2 >= tFrom - 1e-6 && (ti + ti1) / 2 <= tTo + 1e-6;
    for (let j = 0; j < m - 1; j += 1) {
      const corners = [P(a[j]), P(a[j + 1]), P(b[j + 1]), P(b[j])];
      let n = newellNormal(corners);
      if (!Number.isFinite(n[0]) || !Number.isFinite(n[1]) || !Number.isFinite(n[2])) continue; // collapsed cell
      if (dot3(n, sub3(centroid(corners), axisMid)) < 0) n = [-n[0], -n[1], -n[2]];
      const face = { corners, fill: shadeHexMat(tint, n, mat, { light }), doubleSided: true };
      if (glowAt(i, j)) face.glow = spec.glow;   // emissive halo marker → object-glow sprite (three) / box-shadow bloom (css-3d)
      if (inBand) {
        const uj = j / sm + seam, uj1 = (j + 1) / sm + seam;
        face.uv = [[uj, vAt(ti)], [uj1, vAt(ti)], [uj1, vAt(ti1)], [uj, vAt(ti1)]];
        face.texture = wrap.texture;
      }
      faces.push(face);
      if (faces.length >= MAX_FACES_PER_LATHE) return faces;
    }
  }

  // End caps — only where the end ring has real radius (skip self-closing R→0 ends).
  if (caps) {
    const prof = [...spec.profile].sort((p, q) => p.t - q.t);
    const axisDir = norm3([aT.x - aF.x, aT.y - aF.y, aT.z - aF.z]);
    if (prof[0].radius > CAP_MIN_RADIUS) {
      faces.push(...capFan(polylines[0], centerAt(0), [-axisDir[0], -axisDir[1], -axisDir[2]], tint, light, true, mat));
    }
    if (prof[prof.length - 1].radius > CAP_MIN_RADIUS) {
      faces.push(...capFan(polylines[polylines.length - 1], centerAt(cs), axisDir, tint, light, false, mat));
    }
  }
  if (spec.glow && !proxy) for (const f of faces) if (!f.glow) f.glow = spec.glow;   // full glow: cap faces inherit the halo too (proxy mode stays sparse)
  return tagFacesWithMaterial(faces.slice(0, MAX_FACES_PER_LATHE), mat);
}

export { DEFAULT_CROSS_SECTIONS, DEFAULT_SAMPLES, MAX_FACES_PER_LATHE, CAP_MIN_RADIUS };
