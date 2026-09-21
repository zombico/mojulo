/**
 * scene-scad — the recipe as an OpenSCAD PROGRAM (openscad-leg.plan.md phase 1).
 *
 * Every other emitter in this directory consumes the resolved FACE payload: scene-stl,
 * scene-3mf, scene-gltf and scene-usd all take triangles and write triangles. A SCAD
 * emitter that did the same would write one baked `polyhedron()` — no sharp edges, no
 * dials, nothing OpenSCAD could do that a mesh import could not. That is the "just an
 * exporter" trap the positioning doctrine names by name.
 *
 * So this one reads the MANIFEST instead, after `lowerCuts` has already rewritten named
 * booleans into a field term list, and lowers each TERM to its OpenSCAD equivalent. The
 * payoff is the one ceiling the print leg cannot lift from inside: mojulo composes solids
 * as sampled distance fields, so every edge rounds to about one grid cell, while
 * OpenSCAD's `difference()` computes exact intersection curves. A bore transpiled here
 * has a sharp lip the recipe itself cannot express.
 *
 * COVERAGE IS MEASURED, NEVER CLAIMED. A term with no OpenSCAD equivalent (a `blend`, a
 * `stroke`, a noise `displace`, an `expr`, a twist/bend/taper warp, a harmonic lathe) is
 * polygonized by the existing kernel and emitted as a frozen `polyhedron()`, with a
 * comment naming the term that forced it. The returned ledger says how many terms went
 * exact, how many baked, and which. Same posture as the field-solids `edge_rounding`
 * ledger: report the ceiling, do not hide it.
 *
 * THE DIAL RULE (plan decision 1). A number becomes a named OpenSCAD variable only where
 * it provably drives the emitted geometry — that is, inside an exactly-transpiled term. A
 * baked polyhedron is frozen literals and says so in a comment. Emitting a variable that
 * drives nothing would be a small lie in a file too large for anyone to catch it. Names
 * come from the term's own `id`, the grain `cuts` and face `group` already use, so
 * nothing is invented.
 *
 * WHY A STANDALONE `sweeps` MONOMER BAKES while a `sweep` SHAPE inside a terms list does
 * not: field-terms.js says it outright at sweepField — "the face-list `sweeps` monomer
 * caps its ends FLAT; this twin's ends are round." The field twin is exactly a union of
 * capsules, so it transpiles exactly (and that is what every `cuts`-produced bore is). The
 * monomer is a transported-frame tube with flat caps and mitred joints, which a capsule
 * chain would silently change. A lathe and a plain extrude have no such gap: mojulo's
 * mesher and `rotate_extrude` / `linear_extrude` approximate the SAME ideal solid, so
 * those transpile.
 *
 * Pure: no DB, no three.js, no binary, no clock. Deterministic — same manifest in, byte
 * identical text out. OpenSCAD is never in the render path; this writes text and nothing
 * more.
 */

import { lowerCuts } from '../polygonizer/workbench-cuts.js';
import { fieldGrid } from '../polygonizer/field-faces.js';
import { latheToFaces } from '../polygonizer/lathe-faces.js';
import { extrudeToFaces } from '../polygonizer/extrude-faces.js';
import { sweepToFaces } from '../polygonizer/sweep-faces.js';
import { loftToFaces } from '../polygonizer/loft-faces.js';
import { drapeToFaces } from '../polygonizer/drape-faces.js';
import { reliefToFaces } from '../polygonizer/relief-faces.js';
import { shellToFaces } from '../polygonizer/shell-faces.js';
import { surfaceNetFaces } from '../polygonizer/field-mesh.js';

export const SCAD_DEFAULT_FN = 64;

// Recipe unit → millimetres, the same table deriveStlScale uses. OpenSCAD is unitless and
// every slicer assumes mm, so the assembly is wrapped in this factor and the recipe's own
// numbers stay readable as dials.
const UNIT_MM = { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 };

// The monomer arrays, in the order the workbench lists them, with the builder that bakes
// one when it cannot be transpiled.
const MONOMER_BAKERS = {
  lathes: latheToFaces,
  extrudes: extrudeToFaces,
  sweeps: sweepToFaces,
  lofts: loftToFaces,
  fields: null, // fields lower term-by-term; never baked whole
  drapes: drapeToFaces,
  reliefs: reliefToFaces,
  shells: shellToFaces,
};
const MONOMER_ORDER = ['lathes', 'extrudes', 'sweeps', 'lofts', 'fields', 'drapes', 'reliefs', 'shells'];

// ─── deterministic scalar formatting ──────────────────────────────────────────────
//
// Byte-identical output is the baseline test for this module, so every number goes
// through here: fixed precision, no exponent notation, no negative zero.

const EPS = 1e-9;

export function num(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  const r = Math.abs(n) < EPS ? 0 : n;
  let s = r.toFixed(6);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
}

const asVec = (p) => (Array.isArray(p) ? { x: +p[0], y: +p[1], z: +p[2] } : { x: +p.x, y: +p.y, z: +p.z });
const v3 = (p) => { const q = asVec(p); return `[${num(q.x)}, ${num(q.y)}, ${num(q.z)}]`; };
const v2 = (u, w) => `[${num(u)}, ${num(w)}]`;

// ─── small vector kit (local; field-terms keeps its own private copy) ─────────────

const sub3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len3 = (a) => Math.hypot(a.x, a.y, a.z);
const cross3 = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const unit3 = (a) => { const l = len3(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

/**
 * An orthonormal right-handed basis whose THIRD vector is `d`. Used to stand a
 * `rotate_extrude` (which revolves about +Z) up along an arbitrary recipe axis. A
 * surface of revolution is symmetric about its axis, so any perpendicular pair does.
 */
function axisBasis(d) {
  const ref = Math.abs(d.z) > 0.999 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
  const u = unit3(cross3(ref, d));
  return [u, cross3(d, u), d];
}

/**
 * extrude-faces' Z-cross frame, duplicated from field-terms' private `perpBasisZ`. A
 * prism's profile must be laid the same way the face lister lays it or a non-symmetric
 * profile arrives rotated. Kept in sync by the mapping tests, which compare an emitted
 * prism's corners against `extrudeToFaces` output.
 */
function perpBasisZ(d) {
  if (Math.abs(d.z) > 0.999) return [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }];
  const u = unit3(cross3({ x: 0, y: 0, z: 1 }, d));
  return [u, unit3(cross3(d, u))];
}

/** A row-major 4×4 `multmatrix` whose columns are the basis and whose translation is `o`. */
function multmatrix([bu, bv, bd], o) {
  const row = (k) => `[${num(bu[k])}, ${num(bv[k])}, ${num(bd[k])}, ${num(o[k])}]`;
  return `multmatrix([${row('x')}, ${row('y')}, ${row('z')}, [0, 0, 0, 1]])`;
}

// ─── identifiers ──────────────────────────────────────────────────────────────────

const RESERVED = new Set([
  'module', 'function', 'if', 'else', 'for', 'intersection_for', 'let', 'each', 'true',
  'false', 'undef', 'include', 'use', 'echo', 'assert', 'union', 'difference',
  'intersection', 'hull', 'minkowski', 'translate', 'rotate', 'scale', 'mirror', 'color',
  'sphere', 'cube', 'cylinder', 'polyhedron', 'square', 'circle', 'polygon', 'text',
  'offset', 'linear_extrude', 'rotate_extrude', 'projection', 'surface', 'children',
]);

function sanitize(raw, fallback) {
  let s = String(raw == null ? '' : raw).replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+/, '');
  if (!s || !/^[A-Za-z_]/.test(s)) s = `${fallback}_${s}`.replace(/_+$/, '');
  if (RESERVED.has(s)) s = `${s}_`;
  return s || fallback;
}

/** Hand out a name nobody has taken yet, deterministically. */
function uniqueName(used, base) {
  if (!used.has(base)) { used.add(base); return base; }
  for (let i = 2; ; i += 1) {
    const cand = `${base}_${i}`;
    if (!used.has(cand)) { used.add(cand); return cand; }
  }
}

// ─── the emission tree ────────────────────────────────────────────────────────────
//
// A node knows how to print itself at an indent level. Leaves are single statements;
// groups are OpenSCAD blocks. A prefix with a one-line child inlines, which is what keeps
// `translate([0, 0, 3]) sphere(r = 1.2);` from becoming four lines.

const ind = (n) => '  '.repeat(n);
const leaf = (text) => ({ emit: (l) => [ind(l) + text] });
const raw = (lines) => ({ emit: (l) => lines.map((s) => (s ? ind(l) + s : '')) });

function group(head, children) {
  const kids = children.filter(Boolean);
  if (!kids.length) return null;
  if (kids.length === 1 && (head === 'union()' || head === 'intersection()')) return kids[0];
  return { emit: (l) => [ind(l) + `${head} {`, ...kids.flatMap((c) => c.emit(l + 1)), ind(l) + '}'] };
}

function prefix(head, child) {
  if (!child) return null;
  return {
    emit: (l) => {
      const one = child.emit(0);
      if (one.length === 1) return [ind(l) + `${head} ${one[0].trim()}`];
      return [ind(l) + `${head} {`, ...child.emit(l + 1), ind(l) + '}'];
    },
  };
}

/**
 * Wrap a node in a chain of prefixes, outermost first. The chain goes on ONE line, which
 * is how a person writes OpenSCAD — `for (…) rotate(…) translate(…) hull() { … }` rather
 * than four levels of braces around one solid.
 */
const prefixAll = (heads, child) => (heads.length ? prefix(heads.join(' '), child) : child);

// ─── the coverage ledger ──────────────────────────────────────────────────────────

function makeCtx(opts) {
  return {
    fn: Number.isFinite(opts.fn) && opts.fn >= 3 ? Math.round(opts.fn) : SCAD_DEFAULT_FN,
    vars: [],
    varNames: new Set(),
    moduleNames: new Set(),
    coverage: { exact: 0, baked: 0, terms: [] },
    bakedPoints: 0,
    bakedFaces: 0,
  };
}

const note = (ctx, at, what, status, why) => {
  ctx.coverage.terms.push({ at, what, status, ...(why ? { why } : {}) });
  if (status === 'exact') ctx.coverage.exact += 1;
  else ctx.coverage.baked += 1;
};

/**
 * Declare a dial. Returns the variable NAME so the geometry references it rather than the
 * literal. Only ever called from an exactly-transpiled term (the dial rule).
 */
function dial(ctx, base, field, literal) {
  const name = uniqueName(ctx.varNames, sanitize(`${base}_${field}`, 'v'));
  ctx.vars.push({ name, literal });
  return name;
}

// ─── what cannot be transpiled ────────────────────────────────────────────────────

/**
 * Why this term has no OpenSCAD equivalent, or null when it transpiles. A blended
 * boolean is the subtle one: smooth min/max has no counterpart, and the blend contaminates
 * the ACCUMULATED solid at that point rather than just the incoming shape — which is why
 * a contaminating term bakes everything up to and including itself.
 */
function contaminates(t) {
  switch (t.op) {
    case 'add': case 'subtract': case 'intersect': {
      if (Number.isFinite(t.blend) && t.blend > 0) return `\`blend\` is a smooth min/max — OpenSCAD has no blended boolean`;
      const k = t.shape && t.shape.kind;
      if (k === 'expr') return 'an `expr` distance expression has no closed-form solid';
      if (k === 'lathe' && Array.isArray(t.shape.harmonics) && t.shape.harmonics.length) return 'a lathe with `harmonics` is not a surface of revolution';
      return null;
    }
    case 'stroke': return 'a `stroke` dab is a smooth-blended sphere';
    case 'displace': return '`displace` is seeded 3D noise on the field';
    case 'shell': return '`shell` offsets the field inward; OpenSCAD has no 3D offset';
    case 'round': return '`round` inflates the field; the OpenSCAD twin is minkowski() and is far slower';
    case 'twist': case 'bend': case 'taper': case 'elongate':
      return `\`${t.op}\` warps the distance field, not the solid`;
    case 'transform': case 'repeat':
      return Number.isFinite(t.blend) && t.blend > 0 ? '`blend` is a smooth min/max — OpenSCAD has no blended boolean' : null;
    default: return `\`${t.op}\` has no OpenSCAD equivalent`;
  }
}

// ─── faces → polyhedron ───────────────────────────────────────────────────────────

/**
 * A face list as one welded `polyhedron()`. Corners are deduped by their PRINTED form, so
 * the emitted literals are exactly the keys that welded them and the result is closed
 * wherever the input was.
 *
 * Winding: OpenSCAD wants each face ordered clockwise seen from OUTSIDE. mojulo's builders
 * carry an outward normal, so compare Newell against it and reverse when they agree.
 */
export function facesToPolyhedron(faces, comment) {
  const index = new Map();
  const points = [];
  const polys = [];
  for (const f of faces) {
    const corners = f && Array.isArray(f.corners) ? f.corners : null;
    if (!corners || corners.length < 3) continue;
    const pts = corners.map((c) => (Array.isArray(c) ? { x: +c[0], y: +c[1], z: +c[2] } : { x: +c.x, y: +c.y, z: +c.z }));
    const idx = [];
    for (const p of pts) {
      const key = `${num(p.x)},${num(p.y)},${num(p.z)}`;
      let at = index.get(key);
      if (at === undefined) { at = points.length; index.set(key, at); points.push(`${num(p.x)}, ${num(p.y)}, ${num(p.z)}`); }
      if (idx[idx.length - 1] !== at && idx[0] !== at) idx.push(at);
    }
    if (idx.length < 3) continue;
    // Newell normal of the (deduped) ring
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      nx += (a.y - b.y) * (a.z + b.z);
      ny += (a.z - b.z) * (a.x + b.x);
      nz += (a.x - b.x) * (a.y + b.y);
    }
    const out = f.outNormal ? asVec(f.outNormal) : null;
    const ccwOutward = !out || dot3({ x: nx, y: ny, z: nz }, out) >= 0;
    polys.push(ccwOutward ? idx.slice().reverse() : idx);
  }
  if (!points.length || !polys.length) return null;
  const lines = [];
  if (comment) lines.push(`// ${comment}`);
  lines.push('polyhedron(');
  lines.push('  points = [');
  points.forEach((k, i) => lines.push(`    [${k}]${i === points.length - 1 ? '' : ','}`));
  lines.push('  ],');
  lines.push('  faces = [');
  polys.forEach((p, i) => lines.push(`    [${p.join(', ')}]${i === polys.length - 1 ? '' : ','}`));
  lines.push('  ],');
  lines.push('  convexity = 10);');
  const node = raw(lines);
  // carried so the export leg can report how much of the file is FROZEN — an all-exact
  // file honestly has zero of both
  node.points = points.length;
  node.faces = polys.length;
  return node;
}

/** Tally a baked node's frozen geometry onto the run, then hand the node back. */
function tallyBake(ctx, node) {
  if (node) { ctx.bakedPoints += node.points || 0; ctx.bakedFaces += node.faces || 0; }
  return node;
}

// ─── exact shape emission ─────────────────────────────────────────────────────────

/**
 * One field SHAPE as an exact OpenSCAD solid, or null when it has no equivalent.
 * `base` names the dials this shape declares.
 */
function shapeNode(shape, ctx, base) {
  switch (shape.kind) {
    case 'sphere': {
      const r = dial(ctx, base, 'radius', num(shape.radius));
      const c = dial(ctx, base, 'center', v3(shape.center));
      return prefix(`translate(${c})`, leaf(`sphere(r = ${r});`));
    }
    case 'ellipsoid': {
      const rr = dial(ctx, base, 'radii', v3(shape.radii));
      const c = dial(ctx, base, 'center', v3(shape.center));
      return prefixAll([`translate(${c})`, `scale(${rr})`], leaf('sphere(r = 1);'));
    }
    case 'capsule': {
      // a swept ball between two points IS the convex hull of the two balls
      const r = dial(ctx, base, 'radius', num(shape.radius));
      const a = dial(ctx, base, 'a', v3(shape.a));
      const b = dial(ctx, base, 'b', v3(shape.b));
      return group('hull()', [
        prefix(`translate(${a})`, leaf(`sphere(r = ${r});`)),
        prefix(`translate(${b})`, leaf(`sphere(r = ${r});`)),
      ]);
    }
    case 'roundCone': {
      // the tangent hull of two balls of different radii
      const ra = dial(ctx, base, 'ra', num(shape.ra));
      const rb = dial(ctx, base, 'rb', num(shape.rb));
      const a = dial(ctx, base, 'a', v3(shape.a));
      const b = dial(ctx, base, 'b', v3(shape.b));
      return group('hull()', [
        prefix(`translate(${a})`, leaf(`sphere(r = ${ra});`)),
        prefix(`translate(${b})`, leaf(`sphere(r = ${rb});`)),
      ]);
    }
    case 'box': {
      const rr = Math.max(0, +shape.round || 0);
      const c = dial(ctx, base, 'center', v3(shape.center));
      const s = asVec(shape.size);
      if (!(rr > 0)) {
        const size = dial(ctx, base, 'size', v3(shape.size));
        return prefix(`translate(${c})`, leaf(`cube(${size}, center = true);`));
      }
      // `size` is the FULL outer extent and the inner half-extents are size/2 - round, so
      // the rounded box is exactly the hull of eight balls at the inset corners — the
      // minkowski sum, without paying minkowski's price.
      const rn = dial(ctx, base, 'round', num(rr));
      const h = dial(ctx, base, 'inner', v3({
        x: Math.max(0, s.x / 2 - rr), y: Math.max(0, s.y / 2 - rr), z: Math.max(0, s.z / 2 - rr),
      }));
      const corners = [];
      for (const sx of ['-', '']) for (const sy of ['-', '']) for (const sz of ['-', '']) {
        corners.push(prefix(`translate([${sx}${h}[0], ${sy}${h}[1], ${sz}${h}[2]])`, leaf(`sphere(r = ${rn});`)));
      }
      return prefix(`translate(${c})`, group('hull()', corners));
    }
    case 'sweep': {
      // a ball swept along the polyline: the union of one capsule per segment. This is the
      // field twin, and therefore every bore `cuts` produces.
      const path = shape.path.map(asVec);
      const r = dial(ctx, base, 'radius', num(shape.radius));
      const pts = dial(ctx, base, 'path', `[${path.map((p) => v3(p)).join(', ')}]`);
      if (path.length === 1) return prefix(`translate(${pts}[0])`, leaf(`sphere(r = ${r});`));
      const segs = [];
      for (let i = 0; i + 1 < path.length; i += 1) {
        segs.push(group('hull()', [
          prefix(`translate(${pts}[${i}])`, leaf(`sphere(r = ${r});`)),
          prefix(`translate(${pts}[${i + 1}])`, leaf(`sphere(r = ${r});`)),
        ]));
      }
      return group('union()', segs);
    }
    case 'lathe': {
      const A = asVec(shape.axisFrom), B = asVec(shape.axisTo);
      const d = sub3(B, A), L = len3(d);
      const poly = latheMeridian(shape.profile, L);
      const pts = dial(ctx, base, 'profile', `[${poly.map(([r, z]) => v2(r, z)).join(', ')}]`);
      return prefix(multmatrix(axisBasis(unit3(d)), A), prefix(`rotate_extrude(angle = 360)`, leaf(`polygon(points = ${pts});`)));
    }
    case 'extrude': {
      const A = asVec(shape.axisFrom), B = asVec(shape.axisTo);
      const d = sub3(B, A), L = len3(d);
      const [bu, bv] = perpBasisZ(unit3(d));
      const inner = extrudeProfileNode(shape.profile, ctx, base);
      if (!inner) return null;
      const h = dial(ctx, base, 'height', num(L));
      return prefix(multmatrix([bu, bv, unit3(d)], A), prefix(`linear_extrude(height = ${h})`, inner));
    }
    default: return null;
  }
}

/**
 * The meridional polygon of a surface of revolution, in (radius, along-axis), closed back
 * down the axis so `rotate_extrude` sees a region rather than a line. Mirrors latheField's
 * clamping of the profile to t = 0 and t = 1.
 */
function latheMeridian(profile, L) {
  const prof = [...profile]
    .filter((q) => q && Number.isFinite(q.t) && Number.isFinite(q.radius))
    .sort((a, b) => a.t - b.t);
  if (prof[0].t > 0) prof.unshift({ t: 0, radius: prof[0].radius });
  if (prof[prof.length - 1].t < 1) prof.push({ t: 1, radius: prof[prof.length - 1].radius });
  const pts = prof.map((q) => [Math.max(0, q.radius), q.t * L]);
  pts.push([0, L], [0, 0]);
  // drop consecutive duplicates (a profile that already closes on the axis)
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || num(last[0]) !== num(p[0]) || num(last[1]) !== num(p[1])) out.push(p);
  }
  while (out.length > 3 && num(out[0][0]) === num(out[out.length - 1][0]) && num(out[0][1]) === num(out[out.length - 1][1])) out.pop();
  return out;
}

/** A prism's 2D profile. `rect` carries its rounding as an outer extent, exactly as sdRoundRect2 reads it. */
function extrudeProfileNode(profile, ctx, base) {
  if (profile && profile.rect) {
    const { w, h } = profile.rect;
    const rr = Math.max(0, Math.min(+profile.rect.r || 0, Math.min(w, h) / 2));
    if (!(rr > 0)) {
      const size = dial(ctx, base, 'section', v2(w, h));
      return leaf(`square(${size}, center = true);`);
    }
    const rn = dial(ctx, base, 'corner', num(rr));
    const iw = w - 2 * rr, ih = h - 2 * rr;
    // A side that equals 2r (a stadium, a pill, a fully-rounded button) leaves `square` with a
    // zero side, and OpenSCAD drops a zero-area polygon SILENTLY — the whole part vanished while
    // the ledger said exact (the iPhone Duo lost its buttons, port and camera plateau this way,
    // 2026-09-20). Such a profile is the hull of circles at the inset corners: two for a stadium,
    // one for a disc. The non-degenerate case keeps the offset(square) emission byte for byte.
    if (iw <= EPS || ih <= EPS) {
      const hu = Math.max(0, iw / 2), hv = Math.max(0, ih / 2);
      const at = [];
      for (const su of hu > EPS ? ['-', ''] : ['']) for (const sv of hv > EPS ? ['-', ''] : ['']) at.push(`[${su}${num(hu)}, ${sv}${num(hv)}]`);
      if (at.length === 1) return leaf(`circle(r = ${rn});`);
      return group('hull()', at.map((p) => prefix(`translate(${p})`, leaf(`circle(r = ${rn});`))));
    }
    const size = dial(ctx, base, 'section', v2(iw, ih));
    return prefix(`offset(r = ${rn})`, leaf(`square(${size}, center = true);`));
  }
  if (profile && Array.isArray(profile.points)) {
    const pts = dial(ctx, base, 'points', `[${profile.points.map((p) => v2(p[0], p[1])).join(', ')}]`);
    return leaf(`polygon(points = ${pts});`);
  }
  return null;
}

/** A domain op as a chain of OpenSCAD transform heads, or null when it has no equivalent. */
function domainHeads(t, ctx, base) {
  if (t.op === 'transform') {
    const heads = [];
    // mojulo applies scale → mirror → rotate → translate; OpenSCAD nests outermost-first,
    // so this order reproduces it exactly. A mirror is folded into the scale vector as a
    // negative factor, which is the same reflection.
    if (t.translate !== undefined) heads.push(`translate(${dial(ctx, base, 'translate', v3(t.translate))})`);
    if (t.rotate !== undefined) heads.push(`rotate(${dial(ctx, base, 'rotate', v3(t.rotate))})`);
    const sc = t.scale === undefined ? null : (Number.isFinite(t.scale) ? { x: +t.scale, y: +t.scale, z: +t.scale } : asVec(t.scale));
    const mir = t.mirror ? { x: t.mirror === 'x' ? -1 : 1, y: t.mirror === 'y' ? -1 : 1, z: t.mirror === 'z' ? -1 : 1 } : null;
    if (sc || mir) {
      const s = sc || { x: 1, y: 1, z: 1 };
      const m = mir || { x: 1, y: 1, z: 1 };
      heads.push(`scale(${dial(ctx, base, 'scale', v3({ x: s.x * m.x, y: s.y * m.y, z: s.z * m.z }))})`);
    }
    return heads;
  }
  if (t.op === 'repeat') {
    if (t.polar) {
      const { axis, count, radius = 0 } = t.polar;
      const ai = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
      const n = dial(ctx, base, 'count', num(count));
      const r = dial(ctx, base, 'radius', num(radius));
      const spin = ['[i * 360 / ' + n + ', 0, 0]', '[0, i * 360 / ' + n + ', 0]', '[0, 0, i * 360 / ' + n + ']'][ai];
      // The original is pushed out along the FIRST perpendicular axis — perpAxes drops the
      // spin axis and keeps x,y,z order, so that is y for x, and x for both y and z. The
      // rotation SENSE does not matter: a complete evenly-spaced ring is the same set of
      // instances traversed either way, and instance 0 sits at zero in both.
      const push = [`[0, ${r}, 0]`, `[${r}, 0, 0]`, `[${r}, 0, 0]`][ai];
      return [`for (i = [0 : ${n} - 1])`, `rotate(${spin})`, `translate(${push})`];
    }
    const sp = dial(ctx, base, 'spacing', v3(t.spacing));
    const cnt = dial(ctx, base, 'count', v3(t.count));
    // instance centres sit at (i − (n−1)/2)·spacing, exactly as repeatSolid places them
    return [
      `for (ix = [0 : ${cnt}[0] - 1], iy = [0 : ${cnt}[1] - 1], iz = [0 : ${cnt}[2] - 1])`,
      `translate([(ix - (${cnt}[0] - 1) / 2) * ${sp}[0], (iy - (${cnt}[1] - 1) / 2) * ${sp}[1], (iz - (${cnt}[2] - 1) / 2) * ${sp}[2]])`,
    ];
  }
  return null;
}

// ─── the fold ─────────────────────────────────────────────────────────────────────

/**
 * A `fields` term list as one OpenSCAD solid.
 *
 * The fold mirrors composeFieldTerms exactly: read the list top-down, each op applied to
 * everything accumulated so far. Runs of `add` collapse into one `union()` and runs of
 * `subtract` into one `difference()`, which is provably the same solid and is what makes a
 * `cuts`-produced file read as if a person wrote it.
 *
 * Baking is computed in ONE pass: find the LAST contaminating term, bake terms 0..that
 * index as a single polyhedron, then fold the rest exactly on top. Exact terms that fall
 * inside the baked span are reported as `absorbed` and name the term that forced it — they
 * were fine, they just sit under something that was not.
 */
function emitFieldTerms(terms, spec, ctx, at, base) {
  let lastBad = -1;
  terms.forEach((t, i) => { if (contaminates(t)) lastBad = i; });

  let acc = null;
  if (lastBad >= 0) {
    const forcedBy = `${at}[${lastBad}]`;
    const why = contaminates(terms[lastBad]);
    terms.slice(0, lastBad + 1).forEach((t, i) => {
      const own = contaminates(t);
      note(ctx, `${at}[${i}]`, t.op, own ? 'baked' : 'absorbed', own || `absorbed into the bake forced by ${forcedBy}`);
    });
    const partial = { ...spec, terms: terms.slice(0, lastBad + 1) };
    const { bounds, composed, cells } = fieldGrid(partial);
    const quads = surfaceNetFaces(composed.d, bounds, { cells });
    acc = tallyBake(ctx, facesToPolyhedron(quads, `baked at ${cells} cells — ${forcedBy} (${why}) has no OpenSCAD equivalent; frozen, and does NOT respond to the variables above`));
  }

  for (let i = lastBad + 1; i < terms.length; i += 1) {
    const t = terms[i];
    const here = `${at}[${i}]`;
    const id = typeof t.id === 'string' && t.id ? t.id : `term${i}`;
    // Don't double a name the module already carries: `lowerCuts` names its emitted field
    // `cut:<body>`, so the body term inside it would otherwise dial `cut_disc_disc_radius`.
    const sid = sanitize(id, 'term');
    const vbase = base === sid || base.endsWith(`_${sid}`) ? base : `${base}_${id}`;

    if (t.op === 'add' || t.op === 'subtract' || t.op === 'intersect') {
      const node = shapeNode(t.shape, ctx, vbase);
      if (!node) { note(ctx, here, `${t.op} ${t.shape && t.shape.kind}`, 'baked', 'no exact solid for this shape kind'); continue; }
      note(ctx, here, `${t.op} ${t.shape.kind}`, 'exact');
      acc = combine(acc, node, t.op);
      continue;
    }

    const heads = domainHeads(t, ctx, vbase);
    if (!heads) { note(ctx, here, t.op, 'baked', contaminates(t) || 'no OpenSCAD equivalent'); continue; }
    note(ctx, here, t.op, 'exact');

    if (Array.isArray(t.terms)) {
      const nested = emitFieldTerms(t.terms, spec, ctx, `${here}.terms`, vbase);
      acc = combine(acc, prefixAll(heads, nested), t.combine || 'add');
    } else {
      // no nested list: the op warps EVERYTHING accumulated so far
      acc = prefixAll(heads, acc);
    }
  }
  return acc;
}

/** acc ∘ node, flattening runs of the same operator the way the fold allows. */
function combine(acc, node, op) {
  if (!node) return acc;
  if (!acc) return node;
  const head = op === 'subtract' ? 'difference()' : op === 'intersect' ? 'intersection()' : 'union()';
  if (acc.__head === head && (op === 'add' || op === 'intersect')) { acc.__kids.push(node); return acc; }
  if (acc.__head === 'difference()' && op === 'subtract') { acc.__kids.push(node); return acc; }
  // `kids` stays live so the next term of the same operator joins THIS block rather than
  // nesting another one inside it — union(a, b, c), not union(union(a, b), c).
  const kids = [acc, node];
  return { emit: (l) => group(head, kids).emit(l), __head: head, __kids: kids };
}

// ─── monomers ─────────────────────────────────────────────────────────────────────

/**
 * One monomer as a module body. Returns null when nothing could be emitted at all.
 * `lathes` and plain `extrudes` transpile; every other monomer bakes through its own
 * builder, so the file is always complete.
 */
function monomerNode(kind, spec, ctx, base, at) {
  if (kind === 'fields') {
    const node = emitFieldTerms(spec.terms, spec, ctx, `${at}.terms`, base);
    return spec.translate !== undefined
      ? prefix(`translate(${dial(ctx, base, 'translate', v3(spec.translate))})`, node)
      : node;
  }

  if (kind === 'lathes') {
    const harm = Array.isArray(spec.harmonics) && spec.harmonics.length;
    if (!harm) {
      const node = shapeNode({ kind: 'lathe', profile: spec.profile, axisFrom: spec.axisFrom, axisTo: spec.axisTo }, ctx, base);
      if (node) {
        note(ctx, at, 'lathe', 'exact', spec.wrap ? 'geometry exact; the `wrap` label image has no OpenSCAD counterpart and is dropped' : undefined);
        return node;
      }
    }
    return bakeMonomer(kind, spec, ctx, at, harm ? 'a lathe with `harmonics` is not a surface of revolution' : 'no exact solid for this lathe');
  }

  if (kind === 'extrudes') {
    const shelled = spec.wallThickness !== undefined || spec.openFace !== undefined || spec.floorThickness !== undefined;
    const tapered = spec.endProfile !== undefined;
    if (!shelled && !tapered) {
      const node = shapeNode({ kind: 'extrude', profile: spec.profile, axisFrom: spec.axisFrom, axisTo: spec.axisTo }, ctx, base);
      if (node) {
        note(ctx, at, 'extrude', 'exact', spec.wrap ? 'geometry exact; the `wrap` label image has no OpenSCAD counterpart and is dropped' : undefined);
        return node;
      }
    }
    return bakeMonomer(kind, spec, ctx, at, shelled ? '`wallThickness` / `openFace` is a recessed shell, not a prism' : tapered ? '`endProfile` lofts between two profiles' : 'no exact solid for this prism');
  }

  // sweeps included: the monomer caps FLAT and mitres its joints where the capsule chain
  // would round both (field-terms.js says so at sweepField). Baking keeps the geometry the
  // operator actually approved at the eyes gate.
  const why = kind === 'sweeps'
    ? 'the `sweeps` monomer caps flat and mitres its joints; the capsule chain OpenSCAD would take rounds both'
    : `the \`${kind}\` monomer is a direct mesher with no OpenSCAD counterpart`;
  return bakeMonomer(kind, spec, ctx, at, why);
}

function bakeMonomer(kind, spec, ctx, at, why) {
  const baker = MONOMER_BAKERS[kind];
  if (!baker) { note(ctx, at, kind, 'baked', `${why} (and no baker is registered)`); return null; }
  let faces;
  try {
    faces = baker(spec, {});
  } catch (e) {
    note(ctx, at, kind, 'baked', `${why} — and baking it failed: ${e && e.message ? e.message : String(e)}`);
    return null;
  }
  note(ctx, at, kind, 'baked', why);
  return tallyBake(ctx, facesToPolyhedron(faces || [], `baked — ${why}; frozen, and does NOT respond to the variables above`));
}

// ─── the file ─────────────────────────────────────────────────────────────────────

/** Does this manifest carry anything the term-level transpiler can read? */
export function hasWorkbenchMonomers(manifest) {
  return !!manifest && typeof manifest === 'object'
    && MONOMER_ORDER.some((k) => Array.isArray(manifest[k]) && manifest[k].length);
}

/**
 * The shared file writer. Both entry points land here, so an exactly-transpiled workbench
 * and a fully-baked world get the same header, the same ledger, and the same honesty.
 */
function writeScadFile({ parts, ctx, units, mmPerUnit, scaleNote, opts }) {
  const cov = ctx.coverage;
  const L = [];
  const rule = `// ${'─'.repeat(74)}`;
  L.push(rule);
  L.push(`// ${opts.title || 'a mojulo solid'}`);
  L.push('//');
  const prov = ['minted by mojulo'];
  if (opts.ref) prov.push(`recipe ${opts.ref}`);
  if (opts.kind) prov.push(`kind ${opts.kind}`);
  L.push(`// ${prov.join(' · ')}`);
  L.push('//');
  L.push('// This file is a DERIVED SNAPSHOT. The recipe is the sovereign artifact and mojulo');
  L.push('// never reads this file back — change the part with update_sketch, or take this as a');
  L.push('// starting point and own it from here.');
  L.push('//');
  L.push('// WHY THIS FILE EXISTS. mojulo composes solids as sampled distance fields, so every');
  L.push('// edge and corner rounds to about one grid cell. OpenSCAD computes exact intersection');
  L.push('// curves, so a bore transpiled below has a SHARP lip the recipe itself cannot express.');
  L.push('// (Curved primitives are still faceted by $fn — it is the BOOLEAN that is exact.)');
  L.push('//');
  L.push(`// COVERAGE: ${cov.exact} exact, ${cov.baked} baked, of ${cov.terms.length} terms.`);
  if (cov.baked) {
    L.push('// A baked term had no OpenSCAD equivalent and arrives as a frozen polyhedron() that');
    L.push('// does NOT respond to the variables below. Each one says which term forced it:');
    for (const t of cov.terms) {
      if (t.status === 'exact') continue;
      L.push(`//   ${t.at} (${t.what}) — ${t.status}: ${t.why}`);
    }
  } else if (cov.terms.length) {
    L.push('// Every term transpiled exactly; nothing here is a frozen mesh.');
  }
  L.push(rule);
  L.push('');
  L.push(`$fn = ${ctx.fn};   // facet count for curved primitives; raise for a smoother print`);
  const unitWhy = scaleNote || (units ? `the recipe is authored in ${units}` : 'the recipe declares no units; 1 unit = 1 mm');
  L.push(`mm_per_unit = ${num(mmPerUnit)};   // ${unitWhy}`);

  if (ctx.vars.length) {
    L.push('');
    L.push('// ─── dials ─────────────────────────────────────────────────────────────────');
    L.push('// Every value here drives the geometry below. Baked polyhedra do not read them.');
    for (const v of ctx.vars) L.push(`${v.name} = ${v.literal};`);
  }

  if (parts.length) {
    L.push('');
    L.push('// ─── parts ─────────────────────────────────────────────────────────────────');
    for (const p of parts) {
      L.push('');
      L.push(`module ${p.name}() {   // ${p.at}`);
      L.push(...p.node.emit(1));
      L.push('}');
    }
    L.push('');
    L.push('// ─── assembly ──────────────────────────────────────────────────────────────');
    if (parts.some((p) => p.tint)) {
      L.push('// color() is PREVIEW ONLY — OpenSCAD drops it from any STL it renders.');
    }
    const calls = parts.map((p) => leaf(p.tint ? `color("${p.tint}") ${p.name}();` : `${p.name}();`));
    const body = calls.length === 1 ? calls[0] : group('union()', calls);
    L.push(...prefix(`scale(mm_per_unit)`, body).emit(0));
  } else {
    L.push('');
    L.push('// No geometry: this manifest carries no monomer this leg could emit or bake.');
  }
  L.push('');

  const text = L.join('\n');
  const bytes = Buffer.from(text, 'utf8');
  return {
    text,
    bytes,
    byteLength: bytes.length,
    // What the file FREEZES. An all-exact program honestly carries zero of both: there are
    // no triangles in it, only solids OpenSCAD will tessellate itself.
    vertexCount: ctx.bakedPoints,
    triangleCount: ctx.bakedFaces,
    sidecars: [],
    coverage: cov,
    variables: ctx.vars.length,
    units,
    mmPerUnit,
    parts: parts.map((p) => ({ name: p.name, at: p.at })),
  };
}

/**
 * A workbench manifest → an OpenSCAD program, term by term.
 *
 * @param {object} manifest a workbench spec (monomer arrays, optional `cuts`, `units`)
 * @param {object} [opts] `{ title, ref, kind, fn, mmPerUnit, scaleNote }`
 */
export function specToScad(manifest, opts = {}) {
  if (!manifest || typeof manifest !== 'object') throw new Error('specToScad: a workbench manifest is required');
  const spec = lowerCuts(manifest);
  const ctx = makeCtx(opts);

  const parts = [];
  for (const kind of MONOMER_ORDER) {
    const arr = spec[kind];
    if (!Array.isArray(arr)) continue;
    arr.forEach((entry, i) => {
      if (!entry || typeof entry !== 'object') return;
      const at = `${kind}[${i}]`;
      const base = uniqueName(ctx.moduleNames, sanitize(entry.id || `${kind.slice(0, -1)}${i}`, 'part'));
      const node = monomerNode(kind, entry, ctx, base, at);
      if (!node) return;
      parts.push({ name: base, at, node, tint: entry.tint || entry.fill || (entry.style && entry.style.fill) || null });
    });
  }

  const units = typeof spec.units === 'string' && UNIT_MM[spec.units] ? spec.units : null;
  const mmPerUnit = Number.isFinite(opts.mmPerUnit) && opts.mmPerUnit > 0 ? opts.mmPerUnit : (units ? UNIT_MM[units] : 1);
  return writeScadFile({ parts, ctx, units, mmPerUnit, scaleNote: opts.scaleNote, opts });
}

/**
 * A resolved FACE payload → an OpenSCAD program that is one frozen `polyhedron()`.
 *
 * Decision 6: no kind refuses the format. A world or a figure has no manifest to transpile
 * term by term, so it arrives fully baked with a ledger reporting zero exact terms and a
 * note naming `stl` as the better file. That is the print profiles' settled posture —
 * discriminate the note, never the export — applied here rather than a new refusal.
 */
export function facesToScad(faces, opts = {}) {
  const ctx = makeCtx(opts);
  const why = opts.why || 'this kind has no workbench manifest to transpile term by term';
  note(ctx, opts.at || 'payload', opts.kind || 'faces', 'baked', why);
  const node = tallyBake(ctx, facesToPolyhedron(
    Array.isArray(faces) ? faces : [],
    `baked — ${why}; frozen, and no part of it is editable as solids`,
  ));
  const parts = node ? [{ name: uniqueName(ctx.moduleNames, sanitize(opts.partName || 'body', 'body')), at: opts.at || 'payload', node, tint: null }] : [];
  const units = typeof opts.units === 'string' && UNIT_MM[opts.units] ? opts.units : null;
  const mmPerUnit = Number.isFinite(opts.mmPerUnit) && opts.mmPerUnit > 0 ? opts.mmPerUnit : (units ? UNIT_MM[units] : 1);
  return writeScadFile({ parts, ctx, units, mmPerUnit, scaleNote: opts.scaleNote, opts });
}

/**
 * A `scad` recipe → its own source, verbatim. The recipe IS an OpenSCAD program, so the export
 * is the identity: the stored text under the same provenance header, plus the `parts`
 * instantiations appended as the assembly when the source is a library of modules. Nothing is
 * transpiled and nothing is frozen; the ledger says so with one exact term.
 */
export function sourceToScad(manifest, opts = {}) {
  const units = typeof manifest.units === 'string' && UNIT_MM[manifest.units] ? manifest.units : null;
  const mmPerUnit = Number.isFinite(opts.mmPerUnit) && opts.mmPerUnit > 0 ? opts.mmPerUnit : (units ? UNIT_MM[units] : 1);
  const parts = manifest.parts && typeof manifest.parts === 'object' ? Object.entries(manifest.parts) : [];
  const L = [];
  const bar = '// ' + '─'.repeat(74);
  L.push(bar);
  if (opts.title) L.push(`// ${opts.title}`);
  L.push('//');
  L.push(`// minted by mojulo${opts.ref ? ` · recipe ${opts.ref}` : ''} · kind scad`);
  L.push('//');
  L.push('// This recipe IS an OpenSCAD program: the text below is the stored source, verbatim.');
  L.push('// Change it with update_sketch (`/source`, `/parts/<name>`) or own it from here.');
  if (units) L.push(`// Authored in ${units}${mmPerUnit !== 1 ? ` (${num(mmPerUnit)} mm per unit)` : ''}.`);
  L.push(bar);
  L.push('');
  L.push(String(manifest.source).replace(/\s+$/, ''));
  if (parts.length) {
    L.push('');
    L.push('// ─── parts (each is a render group in mojulo) ─────────────────────────────');
    for (const [name, statement] of parts) L.push(`${String(statement).trim()}   // ${name}`);
  }
  L.push('');
  const text = L.join('\n');
  const bytes = Buffer.from(text, 'utf8');
  return {
    text, bytes, byteLength: bytes.length,
    vertexCount: 0, triangleCount: 0, sidecars: [],
    coverage: { exact: 1, baked: 0, terms: [{ at: 'source', what: 'scad', status: 'exact' }] },
    variables: 0, units, mmPerUnit,
    parts: parts.length ? parts.map(([name]) => ({ name, at: `parts.${name}` })) : [{ name: 'body', at: 'source' }],
  };
}

/**
 * The export leg's one door: transpile the manifest when there is one to read, otherwise
 * bake the payload. Never refuses.
 */
export function scadExport({ manifest, payload, ...opts }) {
  if (manifest && manifest.kind === 'scad' && typeof manifest.source === 'string') return sourceToScad(manifest, opts);
  if (hasWorkbenchMonomers(manifest)) return specToScad(manifest, opts);
  return facesToScad(payload && Array.isArray(payload.faces) ? payload.faces : [], opts);
}
