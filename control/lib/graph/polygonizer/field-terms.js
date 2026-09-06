/**
 * field-terms — the shared signed-distance TERM library (field-solids.plan.md F2;
 * blenderish-animals.plan.md phase 3's sculpt layer). One pure table the animal skins
 * and the workbench `fields` monomer both compose from, so a bump on a haunch and a
 * bore through a flange are the same arithmetic.
 *
 * A TERM is `{ d: (p:{x,y,z}) => number, bounds: { min, max } }` — negative inside,
 * positive outside, plus the axis-aligned box that contains its zero set (the
 * polygonizer's grid must cover the surface with margin, and a term always knows
 * how far it can reach). Primitive terms are built from recipe-shaped specs;
 * combinators fold terms into terms; `composeFieldTerms` reads the `fields[].terms`
 * list top-down (the same discipline face-ops set: read the list and it is a
 * description of the object).
 *
 * Bounds rules (the one place a field solid can silently lose closure — a surface that
 * grazes the grid boundary drops its quads): union / smoothUnion grow to the union of
 * both boxes (+k for the blend bulge); subtract / intersect never grow; shell grows by
 * its thickness, round by its radius, an additive stroke by its sphere, a displace by
 * its worst-case noise amplitude.
 *
 * Distance honesty: sphere / box / capsule / roundCone / extrude / sweep / plain lathe
 * are exact distances. ellipsoid and a lathe WITH harmonics are bounds with the right
 * sign and a locally linear zero crossing — the polygonizer places vertices a little
 * off but closure is unaffected (said on the vocab card).
 *
 * Pure: no three.js, no DOM, no dice (noise is a seeded hash lattice). Deterministic.
 * vajra.js CPU and sdf-glsl.js GLSL remain hand-kept twins of the primitives here —
 * the one-table-two-emissions consolidation is deferred (pointer, not payload).
 */

import { smin, smax, sdRoundCone } from './vajra.js';
import { noise3, noise3Amplitude } from './fields.js';
import { parseFieldExpr, compileFieldExpr, validateExprVars, sampleExprGate, FieldExprError } from './field-expr.js';

// ─── small vector kit ({x,y,z} objects; recipe points may also be [x,y,z]) ─────────

export function vec(p) {
  if (Array.isArray(p)) return { x: +p[0], y: +p[1], z: +p[2] };
  return { x: +p.x, y: +p.y, z: +p.z };
}
const isVecLike = (p) => (Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(Number.isFinite))
  || (p && typeof p === 'object' && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const scl = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const unit = (a) => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };

// Extrude-faces' frame (Z-cross): the field twin of an extrude must lay its profile the
// same way the face lister does, else a cut aimed at a prism misses it.
function perpBasisZ(d) {
  if (Math.abs(d.z) > 0.999) return [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }];
  const u = unit(cross({ x: 0, y: 0, z: 1 }, d));
  return [u, unit(cross(d, u))];
}
// lathe.js's frame (X-ref): harmonics phase must line up with the lathe face lister.
function perpBasisLathe(n) {
  const ref = Math.abs(n.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const u = unit(cross(n, ref));
  return [u, unit(cross(n, u))];
}

// ─── bounds kit ───────────────────────────────────────────────────────────────────

const boundsOfPoints = (pts, pad = 0) => {
  const mn = { x: Infinity, y: Infinity, z: Infinity }, mx = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of pts) for (const k of ['x', 'y', 'z']) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; }
  return padBounds({ min: mn, max: mx }, pad);
};
export function padBounds(b, pad) {
  if (!(pad > 0)) return b;
  return { min: { x: b.min.x - pad, y: b.min.y - pad, z: b.min.z - pad }, max: { x: b.max.x + pad, y: b.max.y + pad, z: b.max.z + pad } };
}
export function unionBounds(a, b) {
  return {
    min: { x: Math.min(a.min.x, b.min.x), y: Math.min(a.min.y, b.min.y), z: Math.min(a.min.z, b.min.z) },
    max: { x: Math.max(a.max.x, b.max.x), y: Math.max(a.max.y, b.max.y), z: Math.max(a.max.z, b.max.z) },
  };
}
const term = (d, bounds) => ({ d, bounds });
// Bounds of a solid of revolution / prism about the segment A→B with radial reach r: each end
// reaches r·√(1−dirₖ²) along axis k (a disc, not a sphere) — tight for an axis-aligned lathe.
function axialBounds(A, B, dir, r) {
  const reach = { x: r * Math.sqrt(Math.max(0, 1 - dir.x * dir.x)), y: r * Math.sqrt(Math.max(0, 1 - dir.y * dir.y)), z: r * Math.sqrt(Math.max(0, 1 - dir.z * dir.z)) };
  return {
    min: { x: Math.min(A.x, B.x) - reach.x, y: Math.min(A.y, B.y) - reach.y, z: Math.min(A.z, B.z) - reach.z },
    max: { x: Math.max(A.x, B.x) + reach.x, y: Math.max(A.y, B.y) + reach.y, z: Math.max(A.z, B.z) + reach.z },
  };
}

// ─── primitive terms ─────────────────────────────────────────────────────────────

/** `{ center, radius }` — exact. */
export function sphere({ center, radius }) {
  const c = vec(center), r = +radius;
  return term((p) => len(sub(p, c)) - r, boundsOfPoints([c], r));
}

/** `{ center, radii:{x,y,z} | [rx,ry,rz] }` — iq's bounded ellipsoid (exact sign, approximate distance). */
export function ellipsoid({ center, radii }) {
  const c = vec(center), r = vec(radii);
  return term((p) => {
    const q = sub(p, c);
    const k0 = Math.hypot(q.x / r.x, q.y / r.y, q.z / r.z);
    const k1 = Math.hypot(q.x / (r.x * r.x), q.y / (r.y * r.y), q.z / (r.z * r.z));
    return k1 < 1e-9 ? -Math.min(r.x, r.y, r.z) : k0 * (k0 - 1) / k1;
  }, { min: { x: c.x - r.x, y: c.y - r.y, z: c.z - r.z }, max: { x: c.x + r.x, y: c.y + r.y, z: c.z + r.z } });
}

/** `{ a, b, ra, rb }` — the vajra round cone (two spheres + their tangent hull), exact. */
export function roundCone({ a, b, ra, rb }) {
  const A = vec(a), B = vec(b), r = Math.max(+ra, +rb);
  return term((p) => sdRoundCone(p, A, B, +ra, +rb), boundsOfPoints([A, B], r));
}

/** `{ center, size:{x,y,z}|[sx,sy,sz] (FULL extents), round? }` — exact, optionally rounded. */
export function box({ center, size, round = 0 }) {
  const c = vec(center), s = vec(size), rr = Math.max(0, +round || 0);
  const h = { x: Math.max(0, s.x / 2 - rr), y: Math.max(0, s.y / 2 - rr), z: Math.max(0, s.z / 2 - rr) };
  return term((p) => {
    const q = { x: Math.abs(p.x - c.x) - h.x, y: Math.abs(p.y - c.y) - h.y, z: Math.abs(p.z - c.z) - h.z };
    const outside = Math.hypot(Math.max(q.x, 0), Math.max(q.y, 0), Math.max(q.z, 0));
    return outside + Math.min(Math.max(q.x, q.y, q.z), 0) - rr;
  }, { min: { x: c.x - s.x / 2, y: c.y - s.y / 2, z: c.z - s.z / 2 }, max: { x: c.x + s.x / 2, y: c.y + s.y / 2, z: c.z + s.z / 2 } });
}

function sdSegment(p, a, b) {
  const pa = sub(p, a), ba = sub(b, a);
  const l2 = dot(ba, ba);
  const h = l2 < 1e-18 ? 0 : Math.max(0, Math.min(1, dot(pa, ba) / l2));
  return len(sub(pa, scl(ba, h)));
}

/** `{ a, b, radius }` — exact. */
export function capsule({ a, b, radius }) {
  const A = vec(a), B = vec(b), r = +radius;
  return term((p) => sdSegment(p, A, B) - r, boundsOfPoints([A, B], r));
}

/**
 * `{ path:[pt,…], radius }` — a tube along a polyline: the union of capsules, exact.
 * (The face-list `sweeps` monomer caps its ends FLAT; this twin's ends are round.)
 */
export function sweepField({ path, radius }) {
  const P = path.map(vec), r = +radius;
  if (P.length === 1) return sphere({ center: P[0], radius: r });
  return term((p) => {
    let d = Infinity;
    for (let i = 0; i + 1 < P.length; i += 1) { const s = sdSegment(p, P[i], P[i + 1]); if (s < d) d = s; }
    return d - r;
  }, boundsOfPoints(P, r));
}

// Signed distance to a closed 2D polygon (iq), even-odd inside test. Points as [u, v].
function sdPolygon2(u, v, poly) {
  const n = poly.length;
  let d = Infinity, s = 1;
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
    const ex = poly[j][0] - poly[i][0], ey = poly[j][1] - poly[i][1];
    const wx = u - poly[i][0], wy = v - poly[i][1];
    const el2 = ex * ex + ey * ey;
    const h = el2 < 1e-18 ? 0 : Math.max(0, Math.min(1, (wx * ex + wy * ey) / el2));
    const bx = wx - ex * h, by = wy - ey * h;
    const dd = bx * bx + by * by;
    if (dd < d) d = dd;
    const c0 = v >= poly[i][1], c1 = v < poly[j][1], c2 = ex * wy > ey * wx;
    if ((c0 && c1 && c2) || (!c0 && !c1 && !c2)) s = -s;
  }
  return s * Math.sqrt(d);
}

// Signed distance to a rounded rectangle centred on the origin (FULL w × h, corner r).
function sdRoundRect2(u, v, w, h, r) {
  const rr = Math.max(0, Math.min(r || 0, Math.min(w, h) / 2));
  const qx = Math.abs(u) - (w / 2 - rr), qy = Math.abs(v) - (h / 2 - rr);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
}

/**
 * `{ profile:{ rect:{w,h,r?} } | { points:[[u,v],…] }, axisFrom, axisTo }` — the field
 * twin of the `extrudes` monomer (same Z-cross frame, same profile plane), exact.
 */
export function extrudeField({ profile, axisFrom, axisTo }) {
  const A = vec(axisFrom), B = vec(axisTo);
  const ax = sub(B, A), L = len(ax);
  const dir = unit(ax);
  const [uH, vH] = perpBasisZ(dir);
  let d2, reach;
  if (profile && profile.rect) {
    const { w, h, r = 0 } = profile.rect;
    d2 = (u, v) => sdRoundRect2(u, v, w, h, r);
    reach = Math.hypot(w / 2, h / 2);
  } else {
    const pts = profile.points.map((p) => [+p[0], +p[1]]);
    d2 = (u, v) => sdPolygon2(u, v, pts);
    reach = Math.max(...pts.map(([u, v]) => Math.hypot(u, v)));
  }
  return term((p) => {
    const q = sub(p, A);
    const s = dot(q, dir);
    const du = d2(dot(q, uH), dot(q, vH));
    const dz = Math.abs(s - L / 2) - L / 2;
    return Math.min(Math.max(du, dz), 0) + Math.hypot(Math.max(du, 0), Math.max(dz, 0));
  }, axialBounds(A, B, dir, reach));
}

/**
 * `{ profile:[{t,radius},…], axisFrom, axisTo, harmonics? }` — the field twin of the
 * `lathes` monomer. The 3D distance to a surface of revolution IS the 2D distance to its
 * meridional profile, so this is exact without harmonics; with harmonics the radius
 * varies by angle and the value is a bound (right sign, right zero set).
 */
export function latheField({ profile, axisFrom, axisTo, harmonics }) {
  const A = vec(axisFrom), B = vec(axisTo);
  const ax = sub(B, A), L = len(ax);
  const dir = unit(ax);
  const [uH, vH] = perpBasisLathe(dir);
  const prof = [...profile].filter((q) => Number.isFinite(q?.t) && Number.isFinite(q?.radius)).sort((a, b) => a.t - b.t);
  if (prof[0].t > 0) prof.unshift({ t: 0, radius: prof[0].radius });
  if (prof[prof.length - 1].t < 1) prof.push({ t: 1, radius: prof[prof.length - 1].radius });
  const H = Array.isArray(harmonics) ? harmonics.filter((h) => h && Number.isFinite(h.n) && h.n !== 0 && Number.isFinite(h.amplitude) && h.amplitude !== 0) : [];
  const ampSum = H.reduce((s, h) => s + Math.abs(h.amplitude), 0);
  const maxR = Math.max(...prof.map((q) => q.radius)) + ampSum;
  // meridional polygon in (r, z), mirrored across the axis so r=0 is never an edge
  const polyFor = (bump) => {
    const fwd = prof.map((q) => [Math.max(0, q.radius + bump), q.t * L]);
    const back = fwd.slice().reverse().map(([r, z]) => [-r, z]);
    return fwd.concat(back);
  };
  const poly0 = polyFor(0);
  return term((p) => {
    const q = sub(p, A);
    const z = dot(q, dir);
    const u = dot(q, uH), v = dot(q, vH);
    const r = Math.hypot(u, v);
    let poly = poly0;
    if (H.length) {
      const theta = Math.atan2(v, u);
      let bump = 0;
      for (const h of H) bump += h.amplitude * Math.cos(h.n * theta + (Number.isFinite(h.phase) ? h.phase : 0));
      poly = polyFor(bump);
    }
    return sdPolygon2(r, z, poly);
  }, axialBounds(A, B, dir, maxR));
}

// ─── combinators (term × term → term) ────────────────────────────────────────────

// ─── expr — a distance expression (expressiveness.plan.md E1) ─────────────────────

/** `{ bounds:{min,max} }` or `{ reach: r }` (a cube of half-size r about the origin) → bounds. */
export function exprBounds(shape) {
  if (shape.bounds && typeof shape.bounds === 'object' && shape.bounds.min !== undefined && shape.bounds.max !== undefined) {
    return { min: vec(shape.bounds.min), max: vec(shape.bounds.max) };
  }
  const r = +shape.reach;
  return { min: { x: -r, y: -r, z: -r }, max: { x: r, y: r, z: r } };
}

/**
 * `{ d, vars?, bounds | reach }` — a signed-distance EXPRESSION over x y z (grammar in
 * field-expr.js). `bounds` is REQUIRED and is a CLIP, not a hint: the term is the expression
 * intersected with its bounds box, so an unbounded zero set (a plane, a gyroid) is closed by
 * construction like every other term, instead of losing its quads where it grazes the grid.
 * Distance honesty: a field with the right sign, exact only if the author made it one.
 */
export function exprField(shape) {
  const ast = parseFieldExpr(shape.d);
  const raw = compileFieldExpr(ast, shape.vars || {}, shape.d);
  const b = exprBounds(shape);
  const clip = box({ center: [(b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2], size: [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z] });
  return term((p) => Math.max(raw(p), clip.d(p)), b);
}

// ─── combinators ──────────────────────────────────────────────────────────────────

export function union(a, b) { return term((p) => Math.min(a.d(p), b.d(p)), unionBounds(a.bounds, b.bounds)); }
export function intersect(a, b) { return term((p) => Math.max(a.d(p), b.d(p)), a.bounds); }
export function subtract(a, b) { return term((p) => Math.max(a.d(p), -b.d(p)), a.bounds); }
export function smoothUnion(a, b, k) { return term((p) => smin(a.d(p), b.d(p), k), padBounds(unionBounds(a.bounds, b.bounds), k)); }
export function smoothIntersect(a, b, k) { return term((p) => smax(a.d(p), b.d(p), k), a.bounds); }
export function smoothSubtract(a, b, k) { return term((p) => smax(a.d(p), -b.d(p), k), a.bounds); }
/** Hollow a solid into a wall `thickness` thick (both sides of the old surface). */
export function shell(a, thickness) { const t = +thickness; return term((p) => Math.abs(a.d(p)) - t, padBounds(a.bounds, t)); }
/** Inflate a solid by `radius` (rounds every edge and corner). */
export function round(a, radius) { const r = +radius; return term((p) => a.d(p) - r, padBounds(a.bounds, Math.max(r, 0))); }

// ─── sculpt terms ────────────────────────────────────────────────────────────────

/**
 * `{ at, radius, strength, blend? }` — one brush dab: a sphere of `radius × |strength|`.
 * strength > 0 smooth-unions it IN (a bump, a haunch, a jowl); strength < 0 smooth-
 * subtracts it (a dent, a socket, a nostril); |strength| = 1 is the full radius. `blend`
 * (default half the dab radius) is the fillet width. A list of strokes IS a recipe. Order
 * matters where strokes overlap (smin is not associative) — pinned by test.
 */
export function stroke(a, { at, radius, strength, blend }) {
  const s = +strength;
  const r = Math.abs(+radius) * Math.abs(s);
  const k = Number.isFinite(blend) ? Math.max(0, blend) : r * 0.5;
  const ball = sphere({ center: at, radius: r });
  return s >= 0 ? smoothUnion(a, ball, k) : smoothSubtract(a, ball, k);
}

/**
 * `{ noise:{ amplitude, scale?, octaves?, persistence?, seed? } }` — add seeded 3D fBm to
 * the field: the iso-surface moves along its own gradient by ~amplitude × noise. Hide
 * wrinkles, pebble skin, fur breakup at hero resolution.
 */
export function displace(a, { noise }) {
  const amp = Number.isFinite(noise && noise.amplitude) ? noise.amplitude : 0;
  if (amp === 0) return a;
  const reach = Math.abs(amp) * noise3Amplitude(noise);
  return term((p) => a.d(p) + amp * noise3(p, noise), padBounds(a.bounds, reach));
}

// ─── recipe-facing composition ───────────────────────────────────────────────────


// ─── domain operators (expressiveness.plan.md E2) ─────────────────────────────────
// Ops, not shapes: they apply to whatever the term list has built so far — or, with a nested
// `terms` list, to a SUB-SOLID that is then combined in (`combine: add | subtract | intersect`,
// with `blend`). Every op is a point warp `d'(p) = d(warp(p)) · k` with conservative bounds,
// and the warp is applied to the sub-solid's PARTS too, so group tagging (nearest part)
// follows the geometry — every instance of a repeated bore is still `bore`.
// Warps are about the ORIGIN / the axis line through it: author the sub-solid there, then
// `transform` it into place. After a warp the field is a bound with the right sign, not an
// exact distance (said on the card).

const AXES = ['x', 'y', 'z'];
const axisIndex = (a) => (a === undefined ? 2 : AXES.indexOf(a));
const perpAxes = (ai) => AXES.filter((_, i) => i !== ai);
const DEG = Math.PI / 180;

const cornersOf = (b) => {
  const out = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push({ x, y, z });
  return out;
};

// wrap a composed solid ({ d, bounds, parts }) with a point warp; parts get the same warp
function warpSolid(sub, warp, boundsFn, scale = 1) {
  const wrap = (t) => term((p) => t.d(warp(p)) * scale, boundsFn(t.bounds));
  return { ...wrap(sub), parts: (sub.parts || []).map((pt) => ({ ...pt, term: wrap(pt.term) })) };
}

// Rz·Ry·Rx from degrees (shell-faces / assembler order) as a 3×3 row-major matrix.
function rotMat([rx = 0, ry = 0, rz = 0]) {
  const cx = Math.cos(rx * DEG), sx = Math.sin(rx * DEG);
  const cy = Math.cos(ry * DEG), sy = Math.sin(ry * DEG);
  const cz = Math.cos(rz * DEG), sz = Math.sin(rz * DEG);
  return [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ];
}
const mulMat = (m, p) => ({ x: m[0][0] * p.x + m[0][1] * p.y + m[0][2] * p.z, y: m[1][0] * p.x + m[1][1] * p.y + m[1][2] * p.z, z: m[2][0] * p.x + m[2][1] * p.y + m[2][2] * p.z });
const mulMatT = (m, p) => ({ x: m[0][0] * p.x + m[1][0] * p.y + m[2][0] * p.z, y: m[0][1] * p.x + m[1][1] * p.y + m[2][1] * p.z, z: m[0][2] * p.x + m[1][2] * p.y + m[2][2] * p.z });

/** `{ translate?, rotate?:[rx,ry,rz] deg, scale?: s | [sx,sy,sz], mirror?: 'x'|'y'|'z' }` — applied scale → mirror → rotate → translate. */
export function transformSolid(sub, { translate, rotate, scale, mirror } = {}) {
  const t = translate !== undefined ? vec(translate) : { x: 0, y: 0, z: 0 };
  const sc = scale === undefined ? { x: 1, y: 1, z: 1 } : Number.isFinite(scale) ? { x: scale, y: scale, z: scale } : vec(scale);
  const R = rotMat(rotate ? vec(rotate).x !== undefined ? [vec(rotate).x, vec(rotate).y, vec(rotate).z] : [0, 0, 0] : [0, 0, 0]);
  const mir = mirror ? { x: mirror === 'x' ? -1 : 1, y: mirror === 'y' ? -1 : 1, z: mirror === 'z' ? -1 : 1 } : { x: 1, y: 1, z: 1 };
  const forward = (p) => { const q = { x: p.x * sc.x * mir.x, y: p.y * sc.y * mir.y, z: p.z * sc.z * mir.z }; const r = mulMat(R, q); return { x: r.x + t.x, y: r.y + t.y, z: r.z + t.z }; };
  const inverse = (p) => { const r = mulMatT(R, { x: p.x - t.x, y: p.y - t.y, z: p.z - t.z }); return { x: r.x * mir.x / sc.x, y: r.y * mir.y / sc.y, z: r.z * mir.z / sc.z }; };
  const k = Math.min(sc.x, sc.y, sc.z);   // a uniform scale keeps exactness; non-uniform is a bound (min factor)
  return warpSolid(sub, inverse, (b) => boundsOfPoints(cornersOf(b).map(forward)), k);
}

/** `{ spacing:[sx,sy,sz], count:[nx,ny,nz] }` — a bounded grid of instances CENTERED on the original; `{ polar:{ axis?, count, radius? } }` — instances around an axis, the original pushed out by `radius` first. */
export function repeatSolid(sub, spec) {
  if (spec.polar) {
    const { axis, count, radius = 0 } = spec.polar;
    const ai = axisIndex(axis);
    const [u, v] = perpAxes(ai);
    const sector = (Math.PI * 2) / count;
    const warp = (p) => {
      const a = Math.atan2(p[v], p[u]);
      const kk = Math.round(a / sector);
      const c = Math.cos(-kk * sector), s = Math.sin(-kk * sector);
      const q = { ...p };
      q[u] = p[u] * c - p[v] * s - radius;
      q[v] = p[u] * s + p[v] * c;
      return q;
    };
    const boundsFn = (b) => {
      const reach = Math.max(...cornersOf(b).map((c) => Math.hypot(c[u] + radius, c[v])));
      const out = { min: { ...b.min }, max: { ...b.max } };
      out.min[u] = -reach; out.max[u] = reach; out.min[v] = -reach; out.max[v] = reach;
      return out;
    };
    return warpSolid(sub, warp, boundsFn);
  }
  const sp = vec(spec.spacing);
  const n = vec(spec.count);
  const half = { x: (n.x - 1) / 2, y: (n.y - 1) / 2, z: (n.z - 1) / 2 };
  // instance centres sit at (i − (n−1)/2)·s: integer multiples for odd n, half-multiples for even
  const rep = (val, s, h, off) => (h > 0 && s > 0 ? val - s * Math.max(-h, Math.min(h, Math.round(val / s + off) - off)) : val);
  const off = { x: n.x % 2 === 0 ? 0.5 : 0, y: n.y % 2 === 0 ? 0.5 : 0, z: n.z % 2 === 0 ? 0.5 : 0 };
  const warp = (p) => ({ x: rep(p.x, sp.x, half.x, off.x), y: rep(p.y, sp.y, half.y, off.y), z: rep(p.z, sp.z, half.z, off.z) });
  const boundsFn = (b) => ({
    min: { x: b.min.x - half.x * sp.x, y: b.min.y - half.y * sp.y, z: b.min.z - half.z * sp.z },
    max: { x: b.max.x + half.x * sp.x, y: b.max.y + half.y * sp.y, z: b.max.z + half.z * sp.z },
  });
  return warpSolid(sub, warp, boundsFn);
}

// perpendicular reach of a box about an axis line through the origin
const radialReach = (b, ai) => { const [u, v] = perpAxes(ai); return Math.max(...cornersOf(b).map((c) => Math.hypot(c[u], c[v]))); };
const radialBounds = (b, ai, r) => { const [u, v] = perpAxes(ai); const out = { min: { ...b.min }, max: { ...b.max } }; out.min[u] = -r; out.max[u] = r; out.min[v] = -r; out.max[v] = r; return out; };

/** `{ axis?, turns }` — `turns` full rotations across the solid's extent along `axis` (about the axis line through the origin). */
export function twistSolid(sub, { axis, turns }) {
  const ai = axisIndex(axis);
  const a = AXES[ai];
  const [u, v] = perpAxes(ai);
  const lo = sub.bounds.min[a], L = Math.max(sub.bounds.max[a] - lo, 1e-9);
  const rate = (turns * Math.PI * 2) / L;
  const warp = (p) => {
    const ang = -rate * (p[a] - lo);
    const c = Math.cos(ang), s = Math.sin(ang);
    const q = { ...p };
    q[u] = p[u] * c - p[v] * s;
    q[v] = p[u] * s + p[v] * c;
    return q;
  };
  return warpSolid(sub, warp, (b) => radialBounds(b, ai, radialReach(b, ai)));
}

/** `{ axis?, radius }` — bend the solid along `axis` into an arc of `radius`, curving toward the next axis (x→y, y→z, z→x). */
export function bendSolid(sub, { axis, radius }) {
  const ai = axisIndex(axis);
  const a = AXES[ai], up = AXES[(ai + 1) % 3];
  const k = 1 / radius;
  const warp = (p) => {
    const ang = k * p[a];
    const c = Math.cos(ang), s = Math.sin(ang);
    const q = { ...p };
    q[a] = c * p[a] - s * p[up];
    q[up] = s * p[a] + c * p[up];
    return q;
  };
  const boundsFn = (b) => {
    const reach = Math.max(...cornersOf(b).map((c) => Math.hypot(c[a], c[up])));
    const out = { min: { ...b.min }, max: { ...b.max } };
    out.min[a] = Math.min(out.min[a], -reach); out.max[a] = Math.max(out.max[a], reach);
    out.min[up] = Math.min(out.min[up], -reach); out.max[up] = Math.max(out.max[up], reach);
    return out;
  };
  return warpSolid(sub, warp, boundsFn);
}

/** `{ axis?, from, to }` — scale the cross-section linearly from `from` at the solid's low end along `axis` to `to` at its high end. */
export function taperSolid(sub, { axis, from, to }) {
  const ai = axisIndex(axis);
  const a = AXES[ai];
  const [u, v] = perpAxes(ai);
  const lo = sub.bounds.min[a], L = Math.max(sub.bounds.max[a] - lo, 1e-9);
  const sAt = (val) => { const t = Math.max(0, Math.min(1, (val - lo) / L)); return from + (to - from) * t; };
  const wrap = (t) => term((p) => { const sc = Math.max(sAt(p[a]), 1e-6); const q = { ...p }; q[u] = p[u] / sc; q[v] = p[v] / sc; return t.d(q) * Math.min(sc, 1); }, radialBounds(t.bounds, ai, radialReach(t.bounds, ai) * Math.max(from, to)));
  return { ...wrap(sub), parts: (sub.parts || []).map((pt) => ({ ...pt, term: wrap(pt.term) })) };
}

/** `{ by:[ex,ey,ez] }` — stretch the solid's core by inserting a flat span of these half-lengths about the origin (iq's elongate). Exact. */
export function elongateSolid(sub, { by }) {
  const h = vec(by);
  const warp = (p) => ({ x: p.x - Math.max(-h.x, Math.min(h.x, p.x)), y: p.y - Math.max(-h.y, Math.min(h.y, p.y)), z: p.z - Math.max(-h.z, Math.min(h.z, p.z)) });
  return warpSolid(sub, warp, (b) => ({ min: { x: b.min.x - h.x, y: b.min.y - h.y, z: b.min.z - h.z }, max: { x: b.max.x + h.x, y: b.max.y + h.y, z: b.max.z + h.z } }));
}

export const FIELD_DOMAIN_OPS = Object.freeze(['transform', 'repeat', 'twist', 'bend', 'taper', 'elongate']);
const DOMAIN_OP_FN = { transform: transformSolid, repeat: repeatSolid, twist: twistSolid, bend: bendSolid, taper: taperSolid, elongate: elongateSolid };
const COMBINES = ['add', 'subtract', 'intersect'];

export const FIELD_SHAPE_KINDS = Object.freeze(['sphere', 'ellipsoid', 'roundCone', 'box', 'capsule', 'lathe', 'extrude', 'sweep', 'expr']);
export const FIELD_OPS = Object.freeze(['add', 'subtract', 'intersect', 'stroke', 'displace', 'shell', 'round', ...FIELD_DOMAIN_OPS]);

/** Build a primitive term from a recipe `shape` (`{ kind, …params }`). Throws on an unknown kind. */
export function shapeFromSpec(shape) {
  switch (shape && shape.kind) {
    case 'sphere': return sphere(shape);
    case 'ellipsoid': return ellipsoid(shape);
    case 'roundCone': return roundCone(shape);
    case 'box': return box(shape);
    case 'capsule': return capsule(shape);
    case 'lathe': return latheField(shape);
    case 'extrude': return extrudeField(shape);
    case 'sweep': return sweepField(shape);
    case 'expr': return exprField(shape);
    default: throw new Error(`field shape kind must be one of ${FIELD_SHAPE_KINDS.join(' | ')}`);
  }
}

const pos = (v) => Number.isFinite(v) && v > 0;

function validateShape(shape, at) {
  const e = [];
  if (!shape || typeof shape !== 'object') { e.push(`${at}: must be an object { kind, … }`); return e; }
  if (!FIELD_SHAPE_KINDS.includes(shape.kind)) { e.push(`${at}.kind: must be one of ${FIELD_SHAPE_KINDS.join(' | ')}`); return e; }
  const needPt = (k) => { if (!isVecLike(shape[k])) e.push(`${at}.${k}: must be a point {x,y,z} or [x,y,z]`); };
  switch (shape.kind) {
    case 'sphere': needPt('center'); if (!pos(shape.radius)) e.push(`${at}.radius: must be a positive number`); break;
    case 'ellipsoid': needPt('center'); if (!isVecLike(shape.radii) || Object.values(vec(shape.radii)).some((r) => !pos(r))) e.push(`${at}.radii: must be three positive radii {x,y,z} or [rx,ry,rz]`); break;
    case 'roundCone': needPt('a'); needPt('b'); if (!pos(shape.ra) || !pos(shape.rb)) e.push(`${at}.ra/.rb: must be positive numbers`); break;
    case 'box': needPt('center'); if (!isVecLike(shape.size) || Object.values(vec(shape.size)).some((s) => !pos(s))) e.push(`${at}.size: must be three positive FULL extents {x,y,z} or [sx,sy,sz]`);
      if (shape.round !== undefined && !(Number.isFinite(shape.round) && shape.round >= 0)) e.push(`${at}.round: must be a non-negative number when provided`); break;
    case 'capsule': needPt('a'); needPt('b'); if (!pos(shape.radius)) e.push(`${at}.radius: must be a positive number`); break;
    case 'sweep':
      if (!Array.isArray(shape.path) || shape.path.length < 2 || !shape.path.every(isVecLike)) e.push(`${at}.path: must be ≥2 points`);
      if (!pos(shape.radius)) e.push(`${at}.radius: must be a positive number`); break;
    case 'extrude': {
      needPt('axisFrom'); needPt('axisTo');
      if (isVecLike(shape.axisFrom) && isVecLike(shape.axisTo) && len(sub(vec(shape.axisTo), vec(shape.axisFrom))) < 1e-9) e.push(`${at}: axisFrom and axisTo must differ`);
      const pr = shape.profile;
      const rectOk = pr && pr.rect && pos(pr.rect.w) && pos(pr.rect.h) && (pr.rect.r === undefined || (Number.isFinite(pr.rect.r) && pr.rect.r >= 0));
      const ptsOk = pr && Array.isArray(pr.points) && pr.points.length >= 3 && pr.points.every((q) => Array.isArray(q) && Number.isFinite(q[0]) && Number.isFinite(q[1]));
      if (!rectOk && !ptsOk) e.push(`${at}.profile: must be { rect:{ w, h, r? } } or { points:[≥3 [u,v]] }`);
      break;
    }
    case 'lathe': {
      needPt('axisFrom'); needPt('axisTo');
      if (isVecLike(shape.axisFrom) && isVecLike(shape.axisTo) && len(sub(vec(shape.axisTo), vec(shape.axisFrom))) < 1e-9) e.push(`${at}: axisFrom and axisTo must differ`);
      if (!Array.isArray(shape.profile) || !shape.profile.length || !shape.profile.every((q) => q && Number.isFinite(q.t) && q.t >= 0 && q.t <= 1 && Number.isFinite(q.radius) && q.radius >= 0)) e.push(`${at}.profile: must be a non-empty array of { t:0..1, radius>=0 }`);
      if (shape.harmonics !== undefined && (!Array.isArray(shape.harmonics) || !shape.harmonics.every((h) => h && Number.isInteger(h.n) && h.n > 0 && Number.isFinite(h.amplitude) && (h.phase === undefined || Number.isFinite(h.phase))))) e.push(`${at}.harmonics: must be an array of { n:int>0, amplitude, phase? }`);
      break;
    }
    case 'expr': e.push(...validateExprShape(shape, at)); break;
    default: break;
  }
  return e;
}

// The expr gate: parse (teaching errors with a caret), vars, bounds, then SAMPLE — a 9³
// lattice plus the corners must be finite and carry both signs, else there is no surface
// inside bounds. Fails at mint instead of as an empty or exploded mesh.
function validateExprShape(shape, at) {
  const e = [];
  if (typeof shape.d !== 'string' || !shape.d.trim()) { e.push(`${at}.d: must be a non-empty expression string over x y z (grammar on the workbench card)`); return e; }
  e.push(...validateExprVars(shape.vars, `${at}.vars`));
  const hasBounds = shape.bounds && typeof shape.bounds === 'object' && isVecLike(shape.bounds.min) && isVecLike(shape.bounds.max);
  const hasReach = pos(shape.reach);
  if (!hasBounds && !hasReach) e.push(`${at}.bounds: required — { min:[x,y,z], max:[x,y,z] } (or \`reach: r\`, a cube of half-size r about the origin). An expression's zero set cannot be bounded automatically; bounds are where it is clipped.`);
  else if (hasBounds) {
    const b = exprBounds(shape);
    for (const k of ['x', 'y', 'z']) if (!(b.max[k] - b.min[k] > 0)) e.push(`${at}.bounds: max.${k} must exceed min.${k}`);
  }
  if (e.length) return e;
  let raw;
  try {
    raw = compileFieldExpr(parseFieldExpr(shape.d), shape.vars || {}, shape.d);
  } catch (err) {
    e.push(`${at}.d: ${err instanceof FieldExprError ? err.message : err.message}`);
    return e;
  }
  const gate = sampleExprGate(raw, exprBounds(shape));
  if (!gate.finite) e.push(`${at}.d: evaluates to NaN or ±Infinity inside bounds — check for a division by zero, sqrt/log of a negative, or an unbounded pow`);
  else if (!gate.negatives || !gate.positives) e.push(`${at}.d: no surface inside bounds — the expression is all ${gate.negatives ? 'inside (negative)' : 'outside (positive)'} on a 9³ sample; widen \`bounds\` or check the sign convention (negative inside, positive outside)`);
  return e;
}

/**
 * Validate a `terms` list. Returns error strings (empty = valid). `at` prefixes each.
 * Rules: non-empty; the first term is `add`; every op is known; shapes are well-formed;
 * `blend` / `thickness` / `radius` / `strength` are finite where required.
 */
export function validateFieldTerms(terms, at = 'terms') {
  const errors = [];
  if (!Array.isArray(terms) || !terms.length) { errors.push(`${at}: must be a non-empty array of term objects`); return errors; }
  terms.forEach((t, i) => {
    const here = `${at}[${i}]`;
    if (!t || typeof t !== 'object') { errors.push(`${here}: must be an object { op, … }`); return; }
    if (!FIELD_OPS.includes(t.op)) { errors.push(`${here}.op: must be one of ${FIELD_OPS.join(' | ')}`); return; }
    if (i === 0 && t.op !== 'add' && !(FIELD_DOMAIN_OPS.includes(t.op) && Array.isArray(t.terms))) errors.push(`${here}.op: the first term must be 'add' (there is nothing to cut or sculpt yet) — or a domain op with a nested \`terms\` list`);
    if (t.id !== undefined && (typeof t.id !== 'string' || !t.id)) errors.push(`${here}.id: must be a non-empty string when provided`);
    switch (t.op) {
      case 'add': case 'subtract': case 'intersect':
        errors.push(...validateShape(t.shape, `${here}.shape`));
        if (t.blend !== undefined && !(Number.isFinite(t.blend) && t.blend >= 0)) errors.push(`${here}.blend: must be a non-negative number when provided`);
        break;
      case 'stroke':
        if (!isVecLike(t.at)) errors.push(`${here}.at: must be a point {x,y,z} or [x,y,z]`);
        if (!pos(t.radius)) errors.push(`${here}.radius: must be a positive number`);
        if (!Number.isFinite(t.strength) || t.strength === 0) errors.push(`${here}.strength: must be a non-zero number (>0 adds, <0 carves)`);
        if (t.blend !== undefined && !(Number.isFinite(t.blend) && t.blend >= 0)) errors.push(`${here}.blend: must be a non-negative number when provided`);
        break;
      case 'displace': {
        const nz = t.noise;
        if (!nz || typeof nz !== 'object' || !Number.isFinite(nz.amplitude)) errors.push(`${here}.noise: must be { amplitude, scale?, octaves?, persistence?, seed? }`);
        else {
          if (nz.scale !== undefined && !pos(nz.scale)) errors.push(`${here}.noise.scale: must be a positive number when provided`);
          if (nz.octaves !== undefined && (!Number.isInteger(nz.octaves) || nz.octaves < 1 || nz.octaves > 12)) errors.push(`${here}.noise.octaves: must be an integer in [1, 12] when provided`);
          if (nz.persistence !== undefined && !Number.isFinite(nz.persistence)) errors.push(`${here}.noise.persistence: must be a finite number when provided`);
        }
        break;
      }
      case 'shell': if (!pos(t.thickness)) errors.push(`${here}.thickness: must be a positive number`); break;
      case 'round': if (!pos(t.radius)) errors.push(`${here}.radius: must be a positive number`); break;
      default:
        if (FIELD_DOMAIN_OPS.includes(t.op)) errors.push(...validateDomainOp(t, here));
        break;
    }
  });
  return errors;
}

function validateDomainOp(t, here) {
  const e = [];
  if (t.terms !== undefined) {
    e.push(...validateFieldTerms(t.terms, `${here}.terms`));
    if (t.combine !== undefined && !COMBINES.includes(t.combine)) e.push(`${here}.combine: must be one of ${COMBINES.join(' | ')} (how the warped sub-solid joins what came before; default add)`);
    if (t.blend !== undefined && !(Number.isFinite(t.blend) && t.blend >= 0)) e.push(`${here}.blend: must be a non-negative number when provided`);
  } else if (t.combine !== undefined || t.blend !== undefined) {
    e.push(`${here}: \`combine\` / \`blend\` only apply with a nested \`terms\` list (without one the op warps the whole solid so far)`);
  }
  const axisOk = (a) => a === undefined || AXES.includes(a);
  switch (t.op) {
    case 'transform':
      if (t.translate !== undefined && !isVecLike(t.translate)) e.push(`${here}.translate: must be [x,y,z]`);
      if (t.rotate !== undefined && !isVecLike(t.rotate)) e.push(`${here}.rotate: must be [rx,ry,rz] in degrees`);
      if (t.scale !== undefined && !(pos(t.scale) || (isVecLike(t.scale) && Object.values(vec(t.scale)).every(pos)))) e.push(`${here}.scale: must be a positive number or [sx,sy,sz]`);
      if (t.mirror !== undefined && !AXES.includes(t.mirror)) e.push(`${here}.mirror: must be 'x' | 'y' | 'z'`);
      if (t.translate === undefined && t.rotate === undefined && t.scale === undefined && t.mirror === undefined) e.push(`${here}: give at least one of translate / rotate / scale / mirror`);
      break;
    case 'repeat':
      if (t.polar !== undefined) {
        if (!t.polar || typeof t.polar !== 'object' || !Number.isInteger(t.polar.count) || t.polar.count < 2) e.push(`${here}.polar: must be { axis?, count:int≥2, radius? }`);
        else {
          if (!axisOk(t.polar.axis)) e.push(`${here}.polar.axis: must be 'x' | 'y' | 'z'`);
          if (t.polar.radius !== undefined && !(Number.isFinite(t.polar.radius) && t.polar.radius >= 0)) e.push(`${here}.polar.radius: must be a non-negative number`);
        }
      } else {
        const cnt = isVecLike(t.count) ? vec(t.count) : null;
        if (!cnt || !Object.values(cnt).every((n) => Number.isInteger(n) && n >= 1)) e.push(`${here}.count: must be [nx,ny,nz] integers ≥ 1 (or give \`polar\`)`);
        if (!isVecLike(t.spacing) || !Object.values(vec(t.spacing)).every((v) => Number.isFinite(v) && v >= 0)) e.push(`${here}.spacing: must be [sx,sy,sz] ≥ 0`);
        if (cnt && Object.values(cnt).every((n) => n === 1)) e.push(`${here}.count: every count is 1 — nothing to repeat`);
      }
      break;
    case 'twist':
      if (!axisOk(t.axis)) e.push(`${here}.axis: must be 'x' | 'y' | 'z'`);
      if (!Number.isFinite(t.turns) || t.turns === 0) e.push(`${here}.turns: must be a non-zero number (full rotations across the solid's length)`);
      break;
    case 'bend':
      if (!axisOk(t.axis)) e.push(`${here}.axis: must be 'x' | 'y' | 'z'`);
      if (!pos(t.radius)) e.push(`${here}.radius: must be a positive number (the bend radius)`);
      break;
    case 'taper':
      if (!axisOk(t.axis)) e.push(`${here}.axis: must be 'x' | 'y' | 'z'`);
      if (!pos(t.from) || !pos(t.to)) e.push(`${here}.from/.to: must be positive scale factors`);
      break;
    case 'elongate':
      if (!isVecLike(t.by) || !Object.values(vec(t.by)).every((v) => Number.isFinite(v) && v >= 0)) e.push(`${here}.by: must be [ex,ey,ez] half-lengths ≥ 0`);
      break;
    default: break;
  }
  return e;
}

/**
 * Fold a validated `terms` list top-down into one term.
 * @returns {{ d, bounds, parts:[{ id, op, term }] }} — `parts` keeps each shape term
 *   (add / subtract / intersect) so a caller can tag output faces by nearest part.
 */
export function composeFieldTerms(terms) {
  const errors = validateFieldTerms(terms);
  if (errors.length) throw new Error(errors.join('; '));
  let acc = null;
  const parts = [];
  terms.forEach((t, i) => {
    const id = typeof t.id === 'string' ? t.id : `term${i}`;
    switch (t.op) {
      case 'add': {
        const s = shapeFromSpec(t.shape);
        parts.push({ id, op: t.op, term: s });
        acc = acc === null ? s : (t.blend > 0 ? smoothUnion(acc, s, t.blend) : union(acc, s));
        break;
      }
      case 'subtract': {
        const s = shapeFromSpec(t.shape);
        parts.push({ id, op: t.op, term: s });
        acc = t.blend > 0 ? smoothSubtract(acc, s, t.blend) : subtract(acc, s);
        break;
      }
      case 'intersect': {
        const s = shapeFromSpec(t.shape);
        parts.push({ id, op: t.op, term: s });
        acc = t.blend > 0 ? smoothIntersect(acc, s, t.blend) : intersect(acc, s);
        break;
      }
      case 'stroke': acc = stroke(acc, t); break;
      case 'displace': acc = displace(acc, t); break;
      case 'shell': acc = shell(acc, t.thickness); break;
      case 'round': acc = round(acc, t.radius); break;
      default: {
        const fn = DOMAIN_OP_FN[t.op];
        if (!fn) break;
        if (Array.isArray(t.terms)) {
          // a warped SUB-solid, combined in; its parts (warped) join the outer list
          const sub = fn(composeFieldTerms(t.terms), t);
          parts.push(...sub.parts);
          const s = term(sub.d, sub.bounds);
          const how = t.combine || 'add';
          if (acc === null) acc = s;
          else if (how === 'add') acc = t.blend > 0 ? smoothUnion(acc, s, t.blend) : union(acc, s);
          else if (how === 'subtract') acc = t.blend > 0 ? smoothSubtract(acc, s, t.blend) : subtract(acc, s);
          else acc = t.blend > 0 ? smoothIntersect(acc, s, t.blend) : intersect(acc, s);
        } else {
          // warp everything so far — parts move with it
          const w = fn({ d: acc.d, bounds: acc.bounds, parts }, t);
          acc = term(w.d, w.bounds);
          parts.splice(0, parts.length, ...w.parts);
        }
        break;
      }
    }
  });
  return { d: acc.d, bounds: acc.bounds, parts };
}
