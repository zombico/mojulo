/**
 * field-exact — a `fields` entry composed by Manifold instead of the surface-net grid.
 *
 * The field kernel samples a signed distance on a grid, so every edge and corner rounds to about
 * one cell and the face count grows with the square of `cells`. The workbench card has always
 * named the exit: `export_model union:true` unions shells, and `format:'scad'` hands the recipe
 * to OpenSCAD's exact booleans. Both exits leave the RECIPE rounded. This module is the third
 * exit, inside the recipe: `exact: true` on a field entry (or on a `cuts` entry) composes the
 * same term list with Manifold — the boolean kernel under OpenSCAD 2025, already an optional
 * creative dependency here — so a bore has a sharp lip in /world, in the .glb and on the
 * printer, with no OpenSCAD in the loop.
 *
 * Reach, measured the same way scene-scad.js measures it: the nine shapes (sphere, ellipsoid,
 * roundCone, box incl. `round`, capsule, lathe, extrude, sweep) and add / subtract / intersect
 * WITHOUT `blend`, plus `transform` and `repeat` (counted and polar). A `blend`, `stroke`,
 * `displace`, `shell`, `round`, `expr`, a harmonic lathe, or a twist / bend / taper / elongate
 * has no exact twin and the entry is refused at mint (`exactSupport` names the term) rather than
 * silently sampled. `exact` is opt-in, so every existing row renders byte for byte.
 *
 * Determinism: Manifold is deterministic for its inputs; curved primitives are faceted by
 * `segments` (default 48) so the recipe carries the dial. Faces come back as the standard list
 * with `group` = the nearest term (the same rule fieldToFaces applies), so `{ group: 'bore' }`
 * still selects a bore.
 *
 * The kernel is WASM and loads asynchronously; the lowering is synchronous. So the async entry
 * points (a mint, resolveWorldScene, the scene route) `await ensureExactKernel()` once, which
 * loads the module and REGISTERS `exactFieldFaces` with field-faces; field-faces itself never
 * imports this module, because field-faces is reachable from client bundles (figure-render →
 * image-outcomes) and this module reaches the Manifold package, whose entry reads `node:module`.
 * Absent the package the mint refuses with the install line.
 */

import { loadManifold } from '../scene/manifold-union.js';
import { axisBasis, perpBasisZ, latheMeridian } from './solid-frame.js';
import { roundedRectPath } from './extrude-faces.js';
import { composeFieldTerms } from './field-terms.js';
import { shadeHexMat, DEFAULT_LIGHT } from './vexar.js';
import { resolveMaterial } from './materials.js';
import { pickTint, setExactFieldRenderer } from './field-faces.js';
import { exactSupport } from './field-exact-reach.js';
export { exactSupport };

export const DEFAULT_SEGMENTS = 48;
export const EXACT_INSTALL_LINE = 'manifold-3d is not installed (an optional creative dependency — `npm install --include=optional` in control/ adds it)';

let wasm = null;
let tried = false;
/** Load the kernel once (idempotent); true when it is available. Await this at an async seam before lowering. */
export async function ensureExactKernel() {
  if (!tried) {
    tried = true;
    wasm = await loadManifold();
    // field-faces never imports this module (it is reachable from client bundles, and this one
    // reaches the Manifold package); the renderer is handed over here once the kernel is up
    if (wasm) setExactFieldRenderer(exactFieldFaces);
  }
  return wasm != null;
}
/** Is the kernel loaded right now (sync)? */
export const exactKernelReady = () => wasm != null;

// ─── reach ────────────────────────────────────────────────────────────────────────

const V = (p) => (Array.isArray(p) ? { x: +p[0], y: +p[1], z: +p[2] } : { x: +p.x, y: +p.y, z: +p.z });

// ─── shapes ───────────────────────────────────────────────────────────────────────

/** Column-major Mat4 from an orthonormal basis (columns) and an origin. */
function basisMat(bu, bv, bd, o) {
  return [bu.x, bu.y, bu.z, 0, bv.x, bv.y, bv.z, 0, bd.x, bd.y, bd.z, 0, o.x, o.y, o.z, 1];
}
const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len3 = (a) => Math.hypot(a.x, a.y, a.z);
const unit3 = (a) => { const l = len3(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };

function sphereAt(M, c, r, seg) { return M.sphere(r, seg).translate([c.x, c.y, c.z]); }

/** A field shape → a Manifold, or null when the kind is unknown. Caller owns the result. */
function shapeManifold(M, shape, seg) {
  switch (shape.kind) {
    case 'sphere': return sphereAt(M, V(shape.center), +shape.radius, seg);
    case 'ellipsoid': { const r = V(shape.radii), c = V(shape.center); return M.sphere(1, seg).scale([r.x, r.y, r.z]).translate([c.x, c.y, c.z]); }
    case 'capsule': { const a = sphereAt(M, V(shape.a), +shape.radius, seg), b = sphereAt(M, V(shape.b), +shape.radius, seg); const h = M.hull([a, b]); a.delete(); b.delete(); return h; }
    case 'roundCone': { const a = sphereAt(M, V(shape.a), +shape.ra, seg), b = sphereAt(M, V(shape.b), +shape.rb, seg); const h = M.hull([a, b]); a.delete(); b.delete(); return h; }
    case 'box': {
      const c = V(shape.center), s = V(shape.size), rr = Math.max(0, +shape.round || 0);
      if (!(rr > 0)) return M.cube([s.x, s.y, s.z], true).translate([c.x, c.y, c.z]);
      const h = { x: Math.max(0, s.x / 2 - rr), y: Math.max(0, s.y / 2 - rr), z: Math.max(0, s.z / 2 - rr) };
      const balls = [];
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) balls.push(sphereAt(M, { x: c.x + sx * h.x, y: c.y + sy * h.y, z: c.z + sz * h.z }, rr, seg));
      const out = M.hull(balls); for (const b of balls) b.delete(); return out;
    }
    case 'sweep': {
      const path = shape.path.map(V), r = +shape.radius;
      if (path.length === 1) return sphereAt(M, path[0], r, seg);
      const segs = [];
      for (let i = 0; i + 1 < path.length; i += 1) {
        const a = sphereAt(M, path[i], r, seg), b = sphereAt(M, path[i + 1], r, seg);
        segs.push(M.hull([a, b])); a.delete(); b.delete();
      }
      if (segs.length === 1) return segs[0];
      const out = M.union(segs); for (const s of segs) s.delete(); return out;
    }
    case 'lathe': {
      const A = V(shape.axisFrom), B = V(shape.axisTo), d = sub3(B, A), L = len3(d);
      const poly = latheMeridian(shape.profile, L).map(([r, z]) => [r, z]);
      const [bu, bv, bd] = axisBasis(unit3(d));
      return M.revolve([poly], seg).transform(basisMat(bu, bv, bd, A));
    }
    case 'extrude': {
      const A = V(shape.axisFrom), B = V(shape.axisTo), d = sub3(B, A), L = len3(d);
      const [bu, bv] = perpBasisZ(unit3(d));
      const poly = profilePolygon(shape.profile, seg);
      return M.extrude([poly], L).transform(basisMat(bu, bv, unit3(d), A));
    }
    default: return null;
  }
}

/** A prism profile as a CCW polygon: a rect (rounded by `roundedRectPath`, the surface net's own outline) or points. */
function profilePolygon(profile, seg) {
  if (profile && profile.rect) {
    const { w, h } = profile.rect;
    const r = Math.max(0, Math.min(+profile.rect.r || 0, Math.min(w, h) / 2));
    const pts = roundedRectPath(w, h, r, Math.max(2, Math.round(seg / 4))).map((p) => [p.u, p.v]);
    return ccw(pts);
  }
  if (profile && Array.isArray(profile.points)) return ccw(profile.points.map((p) => [+p[0], +p[1]]));
  throw new Error('extrude.profile must be { rect } or { points }');
}
function ccw(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i += 1) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a < 0 ? pts.slice().reverse() : pts;
}

// ─── the fold ─────────────────────────────────────────────────────────────────────

const degToRad = (d) => (d * Math.PI) / 180;
/** mojulo's transform: scale → mirror → rotate (Rz·Ry·Rx, degrees) → translate, as a Manifold chain. */
function applyTransform(m, t) {
  let out = m;
  const sc = t.scale === undefined ? null : (Number.isFinite(t.scale) ? { x: +t.scale, y: +t.scale, z: +t.scale } : V(t.scale));
  const mir = t.mirror ? { x: t.mirror === 'x' ? -1 : 1, y: t.mirror === 'y' ? -1 : 1, z: t.mirror === 'z' ? -1 : 1 } : null;
  if (sc || mir) { const s = sc || { x: 1, y: 1, z: 1 }, k = mir || { x: 1, y: 1, z: 1 }; out = out.scale([s.x * k.x, s.y * k.y, s.z * k.z]); }
  if (t.rotate !== undefined) { const r = V(t.rotate); out = out.rotate([r.x, r.y, r.z]); }
  if (t.translate !== undefined) { const v = V(t.translate); out = out.translate([v.x, v.y, v.z]); }
  return out;
}

/** Instances of `m` under a `repeat` op → one unioned Manifold. */
function repeated(M, m, t) {
  const inst = [];
  if (t.polar) {
    const { axis = 'z', count, radius = 0 } = t.polar;
    const push = axis === 'x' ? [0, radius, 0] : [radius, 0, 0];
    for (let i = 0; i < count; i += 1) {
      const deg = (i * 360) / count;
      const spin = axis === 'x' ? [deg, 0, 0] : axis === 'y' ? [0, deg, 0] : [0, 0, deg];
      inst.push(m.translate(push).rotate(spin));
    }
  } else {
    const sp = V(t.spacing), n = V(t.count);
    for (let ix = 0; ix < n.x; ix += 1) for (let iy = 0; iy < n.y; iy += 1) for (let iz = 0; iz < n.z; iz += 1) {
      inst.push(m.translate([(ix - (n.x - 1) / 2) * sp.x, (iy - (n.y - 1) / 2) * sp.y, (iz - (n.z - 1) / 2) * sp.z]));
    }
  }
  if (inst.length === 1) return inst[0];
  const out = M.union(inst); for (const i of inst) i.delete(); return out;
}

/** Fold a term list into one Manifold (the caller owns it). Mirrors composeFieldTerms / emitFieldTerms. */
function foldTerms(M, terms, seg, at = 'terms') {
  let acc = null;
  const combine = (op, s) => {
    if (acc === null) { if (op !== 'add') throw new Error(`${at}: the first term must be add`); acc = s; return; }
    const next = op === 'add' ? acc.add(s) : op === 'subtract' ? acc.subtract(s) : acc.intersect(s);
    acc.delete(); s.delete(); acc = next;
  };
  terms.forEach((t, i) => {
    switch (t.op) {
      case 'add': case 'subtract': case 'intersect': {
        const s = shapeManifold(M, t.shape, seg);
        if (!s) throw new Error(`${at}[${i}]: shape '${t.shape && t.shape.kind}' has no exact twin`);
        combine(t.op, s);
        break;
      }
      case 'transform': case 'repeat': {
        // with nested terms: build the sub-solid, warp it, combine in; without: warp the accumulator
        const base = Array.isArray(t.terms) ? foldTerms(M, t.terms, seg, `${at}[${i}].terms`) : acc;
        if (!base) throw new Error(`${at}[${i}]: a domain op needs a solid before it`);
        const warped = t.op === 'transform' ? applyTransform(base, t) : repeated(M, base, t);
        if (Array.isArray(t.terms)) { base.delete(); combine(t.combine || 'add', warped); }
        else { if (warped !== base) base.delete(); acc = warped; }
        break;
      }
      default: throw new Error(`${at}[${i}]: \`${t.op}\` has no exact twin`);
    }
  });
  if (!acc) throw new Error(`${at}: no terms`);
  return acc;
}

// ─── faces ────────────────────────────────────────────────────────────────────────

const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * exactFieldFaces(spec, opts) → faces, or throws. `spec` is a `fields` entry with `exact: true`;
 * `opts` as fieldToFaces (light, material, tint). Requires the kernel (ensureExactKernel).
 */
export function exactFieldFaces(spec = {}, opts = {}) {
  if (!wasm) throw new Error(`fields '${spec.id || ''}' asks for exact: true but the exact kernel is not loaded — ${EXACT_INSTALL_LINE}`);
  const reach = exactSupport(spec.terms);
  if (!reach.ok) throw new Error(`fields '${spec.id || ''}' cannot be exact: ${reach.at} — ${reach.why}. Drop \`exact\`, or shape the detail with exact terms.`);
  const M = wasm.Manifold;
  const seg = Number.isInteger(spec.segments) && spec.segments >= 8 ? spec.segments : DEFAULT_SEGMENTS;
  const light = opts.light || DEFAULT_LIGHT;
  const mat = opts.material ? resolveMaterial(opts.material) : null;
  const tint = opts.tint || spec.tint || spec.fill || (spec.style && spec.style.fill) || (mat && mat.base) || pickTint(spec);
  let solid = foldTerms(M, spec.terms, seg);
  if (Array.isArray(spec.translate)) { const t = solid.translate(spec.translate.map(Number)); solid.delete(); solid = t; }
  const status = solid.status();
  if (status !== 'NoError') { solid.delete(); throw new Error(`fields '${spec.id || ''}': the exact kernel reports ${status}`); }
  const mesh = solid.getMesh();
  const np = mesh.numProp, vp = mesh.vertProperties, tv = mesh.triVerts;
  // group by the nearest term — the same rule the surface net applies, via the composed field
  const composed = composeFieldTerms(spec.terms);
  const parts = composed.parts;
  const off = Array.isArray(spec.translate) ? spec.translate.map(Number) : [0, 0, 0];
  const faces = [];
  for (let t = 0; t + 3 <= tv.length; t += 3) {
    const c = [0, 1, 2].map((k) => { const v = tv[t + k] * np; return [vp[v], vp[v + 1], vp[v + 2]]; });
    const n = cross3([c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]], [c[2][0] - c[0][0], c[2][1] - c[0][1], c[2][2] - c[0][2]]);
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    const outNormal = [n[0] / l, n[1] / l, n[2] / l];
    let group = parts.length ? parts[0].id : 'field';
    if (parts.length > 1) {
      const cen = { x: (c[0][0] + c[1][0] + c[2][0]) / 3 - off[0], y: (c[0][1] + c[1][1] + c[2][1]) / 3 - off[1], z: (c[0][2] + c[1][2] + c[2][2]) / 3 - off[2] };
      let best = Infinity;
      for (const pt of parts) { const dd = Math.abs(pt.term.d(cen)); if (dd < best) { best = dd; group = pt.id; } }
    }
    faces.push({ corners: [c[0], c[1], c[2], c[0]], fill: shadeHexMat(tint, outNormal, mat, { light }), doubleSided: true, outNormal, group, exact: true });
  }
  solid.delete();
  return faces;
}
