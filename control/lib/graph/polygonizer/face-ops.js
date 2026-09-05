/**
 * face-ops — the PANEL-MODULE language: inset / extrude / recolor / port over a face selection.
 *
 * A polyhedron on its own is a bare shell. What makes a faceted object read as designed is what
 * happens ON its faces — a smaller panel inset into each hexagon and pushed outward, a scatter of
 * coloured modules, a socket seated on the face that points at the camera. Authoring that by hand
 * means computing per-face centroids, normals and tangent frames, which is exactly the arithmetic
 * an operator should never be doing in a recipe.
 *
 * An op is a pure function `(faces, spec) => faces`, and an op LIST is applied in order, each op
 * seeing the previous one's output:
 *
 *   ops: [
 *     { op:'inset',   select:{ sides:6 },             by:0.18 },
 *     { op:'extrude', select:{ group:'inset' },       by:0.12, material:'brushed-steel' },
 *     { op:'recolor', select:{ sides:5, every:3 },    tint:'#39c2d7' },
 *     { op:'port',    select:{ facing:'+z', within:20 }, radius:0.14, depth:0.2 },
 *   ]
 *
 * That composition — op 2 selecting `group:'inset'`, the group op 1 just created — IS the
 * mechanism. Each op tags what it emits, and the next op selects on those tags. Read the op list
 * top-down and it is a description of the object.
 *
 * NON-GOAL: booleans. `port` seats a cylinder ON a face; it does not cut through the shell, and
 * there is no boolean difference here. Real CSG needs a half-edge mesh and this whole directory is
 * deliberately a face-list SURFACE modeler (see face-closure.js, which warns about holes rather
 * than preventing them). When an object genuinely needs booleans, that is the honest moment to
 * export and reach for Blender — not to grow a CSG kernel in here. (Since field-solids F3 there IS a
 * native answer for soft cuts: the workbench `fields` monomer composes in FIELD space — `subtract` /
 * `intersect` / `stroke` — and polygonizes once, rounded to about a grid cell; see field-faces.js.
 * That is a different representation, not a boolean over these face lists.)
 *
 * Pure: no three.js, no DOM, no dice. Deterministic — the same op list on the same faces re-renders
 * byte-identical.
 *
 * Design: faceted-shell.plan.md §C. Built on face-select.js; consumed by shell-faces.js.
 */

import { norm3, dot3, centroid, newellNormal, shadeHexMat, DEFAULT_LIGHT } from './vexar.js';
import { resolveMaterial, tagFacesWithMaterial, validateMaterialRef } from './materials.js';
import { selectFaces, validateSelector, distinctCorners, faceNormal, summarizeFaces } from './face-select.js';

export const FACE_OPS = ['inset', 'extrude', 'recolor', 'port'];

const DEFAULT_PORT_SIDES = 12;
const MAX_PORT_SIDES = 64;
const MAX_OP_FACES = 32768;
const EPS = 1e-9;

const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

// ---------------------------------------------------------------------------
// face helpers
// ---------------------------------------------------------------------------

/**
 * The face's inradius — the shortest distance from its centroid to any edge.
 *
 * This is what an ABSOLUTE inset/offset distance is measured against: insetting a face "by 0.2"
 * means moving every edge 0.2 inward, which is only possible while 0.2 < inradius.
 */
function inradiusOf(pts, c) {
  let min = Infinity;
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const e = sub(b, a);
    const len = Math.hypot(...e);
    if (len < EPS) continue;
    const d = Math.hypot(...cross3(e, sub(c, a))) / len;   // point-to-line distance
    if (d < min) min = d;
  }
  return Number.isFinite(min) ? min : 0;
}

/** Is the polygon convex when viewed along `n`? Inset/extrude self-intersect on concave faces. */
function isConvex(pts, n) {
  let sign = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i], b = pts[(i + 1) % pts.length], c = pts[(i + 2) % pts.length];
    const t = dot3(cross3(sub(b, a), sub(c, b)), n);
    if (Math.abs(t) < EPS) continue;
    const s = t > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** An in-plane orthonormal basis for a face, seeded by its first corner so it is deterministic. */
function tangentBasis(pts, c, n) {
  const r = sub(pts[0], c);
  const u = norm3(sub(r, mul(n, dot3(r, n))));
  return [u, cross3(n, u)];
}

// ---------------------------------------------------------------------------
// emit
// ---------------------------------------------------------------------------

/** Build one face record, shading the fill from the tint/material the way every monomer does. */
function emit(corners, { tint, mat, light, group, faceId, normal }) {
  const n = normal || newellNormal(corners);
  const f = {
    corners,
    fill: shadeHexMat(tint, n, mat, { light }),
    doubleSided: true,
    outNormal: n,
    tint,
  };
  if (group !== undefined) f.group = group;
  if (faceId !== undefined) f.faceId = faceId;
  return mat ? tagFacesWithMaterial([f], mat)[0] : f;
}

// An op's colour intent: explicit tint wins, else the material's own albedo ('gold' LOOKS gold),
// else the parent face's tint, else the shell default. Same precedence the monomers use.
function opTint(op, parent, mat, fallback) {
  return op.tint || (op.material && mat && mat.base) || parent.tint || fallback;
}

function childId(parent, suffix) {
  return parent.faceId === undefined ? undefined : `${parent.faceId}${suffix}`;
}

// ---------------------------------------------------------------------------
// the ops
// ---------------------------------------------------------------------------

function opRecolor(faces, picked, op, ctx) {
  const mat = op.material ? resolveMaterial(op.material) : null;
  const out = faces.slice();
  for (const i of picked) {
    const f = faces[i];
    const tint = opTint(op, f, mat, ctx.tint);
    const next = { ...f, tint, fill: shadeHexMat(tint, faceNormal(f), mat || ctx.mat, { light: ctx.light }) };
    if (op.group !== undefined) next.group = op.group;
    out[i] = mat ? tagFacesWithMaterial([next], mat)[0] : next;
  }
  return out;
}

function opInset(faces, picked, op, ctx, at) {
  const mat = op.material ? resolveMaterial(op.material) : ctx.mat;
  const pick = new Set(picked);
  const out = [];
  for (let i = 0; i < faces.length; i += 1) {
    const f = faces[i];
    if (!pick.has(i)) { out.push(f); continue; }
    const pts = distinctCorners(f);
    const n = faceNormal(f);
    if (pts.length < 3) throw new Error(`${at}: face ${i} is degenerate (${pts.length} corners) — nothing to inset`);
    if (!isConvex(pts, n)) throw new Error(`${at}: face ${i} is concave — inset would self-intersect. Select convex faces (a shell's own faces always are).`);
    const c = centroid(pts);
    // `ratio` shrinks toward the centroid; `by` moves every edge inward a literal distance, which
    // is the same scale factor expressed against the face's inradius.
    let k;
    if (op.ratio !== undefined) k = 1 - op.ratio;
    else {
      const inr = inradiusOf(pts, c);
      if (op.by >= inr - EPS) {
        throw new Error(`${at}: by ${op.by} exceeds face ${i}'s inradius (${inr.toFixed(4)}) — the inset would collapse or invert. Use a smaller \`by\`, or \`ratio\` for a size-independent inset.`);
      }
      k = 1 - op.by / inr;
    }
    const inner = pts.map((p) => add(c, mul(sub(p, c), k)));
    const tint = opTint(op, f, op.material ? mat : null, ctx.tint);
    const rimTint = op.rimTint || f.tint || ctx.tint;
    // the rim ring first, then the inset face — so `group:'inset'` selects the panel, not the rim
    for (let e = 0; e < pts.length; e += 1) {
      const j = (e + 1) % pts.length;
      out.push(emit([pts[e], pts[j], inner[j], inner[e]], {
        tint: rimTint, mat, light: ctx.light, group: op.rimGroup || 'rim', faceId: childId(f, `/r${e}`),
      }));
    }
    out.push(emit(inner, { tint, mat, light: ctx.light, group: op.group || 'inset', faceId: childId(f, '/i'), normal: n }));
  }
  return out;
}

function opExtrude(faces, picked, op, ctx, at) {
  const mat = op.material ? resolveMaterial(op.material) : ctx.mat;
  const sideMat = op.sideMaterial ? resolveMaterial(op.sideMaterial) : mat;
  const pick = new Set(picked);
  const out = [];
  for (let i = 0; i < faces.length; i += 1) {
    const f = faces[i];
    if (!pick.has(i)) { out.push(f); continue; }
    const pts = distinctCorners(f);
    const n = faceNormal(f);
    if (pts.length < 3) throw new Error(`${at}: face ${i} is degenerate (${pts.length} corners) — nothing to extrude`);
    const off = mul(n, op.by);
    const cap = pts.map((p) => add(p, off));
    const tint = opTint(op, f, op.material ? mat : null, ctx.tint);
    const sideTint = op.sideTint || f.tint || ctx.tint;
    for (let e = 0; e < pts.length; e += 1) {
      const j = (e + 1) % pts.length;
      // Wall winding follows the extrusion direction so a recess (negative `by`) still faces out.
      const quad = op.by >= 0 ? [pts[e], pts[j], cap[j], cap[e]] : [pts[j], pts[e], cap[e], cap[j]];
      out.push(emit(quad, {
        tint: sideTint, mat: sideMat, light: ctx.light, group: op.sideGroup || 'wall', faceId: childId(f, `/w${e}`),
      }));
    }
    out.push(emit(cap, { tint, mat, light: ctx.light, group: op.group || 'panel', faceId: childId(f, '/p'), normal: n }));
  }
  return out;
}

function opPort(faces, picked, op, ctx, at) {
  const mat = op.material ? resolveMaterial(op.material) : ctx.mat;
  const sides = Number.isInteger(op.sides) ? op.sides : DEFAULT_PORT_SIDES;
  const out = faces.slice();          // a port is ADDITIVE — the host face survives untouched
  for (const i of picked) {
    const f = faces[i];
    const pts = distinctCorners(f);
    const n = faceNormal(f);
    if (pts.length < 3) throw new Error(`${at}: face ${i} is degenerate (${pts.length} corners) — nothing to seat a port on`);
    const c = centroid(pts);
    const inr = inradiusOf(pts, c);
    if (op.radius >= inr - EPS) {
      throw new Error(`${at}: radius ${op.radius} does not fit on face ${i} (inradius ${inr.toFixed(4)}) — the port would overhang its own face.`);
    }
    const [u, w] = tangentBasis(pts, c, n);
    const ring = [];
    for (let k = 0; k < sides; k += 1) {
      const a = (2 * Math.PI * k) / sides;
      ring.push(add(c, add(mul(u, Math.cos(a) * op.radius), mul(w, Math.sin(a) * op.radius))));
    }
    const off = mul(n, op.depth);
    const top = ring.map((p) => add(p, off));
    const tint = opTint(op, f, op.material ? mat : null, ctx.tint);
    const group = op.group || 'port';
    for (let k = 0; k < sides; k += 1) {
      const j = (k + 1) % sides;
      const quad = op.depth >= 0 ? [ring[k], ring[j], top[j], top[k]] : [ring[j], ring[k], top[k], top[j]];
      out.push(emit(quad, { tint, mat, light: ctx.light, group, faceId: childId(f, `/o${k}`) }));
    }
    out.push(emit(top, { tint, mat, light: ctx.light, group, faceId: childId(f, '/oc'), normal: op.depth >= 0 ? n : mul(n, -1) }));
  }
  return out;
}

const RUNNERS = { inset: opInset, extrude: opExtrude, recolor: opRecolor, port: opPort };

// ---------------------------------------------------------------------------
// applyFaceOps
// ---------------------------------------------------------------------------

/**
 * Run an ordered op list over a face list.
 *
 * @param {Array} faces  the baked face list to operate on
 * @param {Array} ops    `[{ op, select, … }]`, applied in order
 * @param {object} opts  `{ light?, tint?, material?, at? }` — the host's shading defaults
 * @returns {Array} a NEW face list (the input is never mutated)
 */
export function applyFaceOps(faces, ops, opts = {}) {
  if (!Array.isArray(ops) || !ops.length) return faces;
  const light = opts.light || DEFAULT_LIGHT;
  const mat = opts.material ? resolveMaterial(opts.material) : null;
  const ctx = { light, mat, tint: opts.tint || '#9aa3b0' };
  const base = opts.at || 'ops';

  let cur = faces;
  ops.forEach((op, oi) => {
    const at = `${base}[${oi}] (${op && op.op})`;
    const run = RUNNERS[op && op.op];
    if (!run) throw new Error(`${base}[${oi}]: unknown op ${JSON.stringify(op && op.op)} — use one of: ${FACE_OPS.join(', ')}`);
    const picked = selectFaces(cur, op.select);
    // An op that matches nothing is a BROKEN RECIPE, not a no-op: the operator asked for panels and
    // silently got none. Refuse, and say what the face list actually offers so the fix is obvious.
    if (!picked.length) {
      throw new Error(`${at}: select matched no faces — ${summarizeFaces(cur)}. Adjust the selector (or drop the op).`);
    }
    cur = run(cur, picked, op, ctx, at);
    if (cur.length > MAX_OP_FACES) {
      throw new Error(`${at}: produced ${cur.length} faces, over the ${MAX_OP_FACES} ceiling — reduce the selection, the geodesic frequency, or the op count.`);
    }
  });
  return cur;
}

// ---------------------------------------------------------------------------
// validation
// ---------------------------------------------------------------------------

/** Validate an op list → an array of error strings (empty when well-formed). */
export function validateFaceOps(ops, at = 'ops') {
  const errors = [];
  if (ops === undefined) return errors;
  if (!Array.isArray(ops)) { errors.push(`${at} must be an array of ops if provided`); return errors; }
  ops.forEach((op, i) => {
    const where = `${at}[${i}]`;
    if (!op || typeof op !== 'object' || Array.isArray(op)) { errors.push(`${where}: must be an object`); return; }
    if (!FACE_OPS.includes(op.op)) {
      errors.push(`${where}.op must be one of: ${FACE_OPS.join(', ')}${op.op === undefined ? ' (required)' : ` — got ${JSON.stringify(op.op)}`}`);
      return;
    }
    const selErr = validateSelector(op.select, `${where}.select`);
    if (selErr) errors.push(selErr);
    for (const key of ['material', 'sideMaterial']) {
      const e = validateMaterialRef(op[key]);
      if (e) errors.push(`${where}.${key}: ${e}`);
    }
    for (const key of ['tint', 'sideTint', 'rimTint']) {
      if (op[key] !== undefined && !/^#[0-9a-f]{6}$/i.test(String(op[key]))) errors.push(`${where}.${key} must be a '#rrggbb' hex colour if provided`);
    }
    for (const key of ['group', 'sideGroup', 'rimGroup']) {
      if (op[key] !== undefined && typeof op[key] !== 'string') errors.push(`${where}.${key} must be a string if provided`);
    }

    if (op.op === 'inset') {
      const hasBy = op.by !== undefined, hasRatio = op.ratio !== undefined;
      if (hasBy === hasRatio) errors.push(`${where}: set exactly one of \`by\` (an absolute inset distance) or \`ratio\` (a fraction of the face)`);
      if (hasBy && (!Number.isFinite(op.by) || op.by <= 0)) errors.push(`${where}.by must be a positive number`);
      if (hasRatio && (!Number.isFinite(op.ratio) || op.ratio <= 0 || op.ratio >= 1)) errors.push(`${where}.ratio must be a number in (0, 1)`);
    }
    if (op.op === 'extrude') {
      if (!Number.isFinite(op.by) || op.by === 0) errors.push(`${where}.by must be a non-zero number (negative recesses the face)`);
    }
    if (op.op === 'port') {
      if (!Number.isFinite(op.radius) || op.radius <= 0) errors.push(`${where}.radius must be a positive number`);
      if (!Number.isFinite(op.depth) || op.depth === 0) errors.push(`${where}.depth must be a non-zero number (negative recesses the port into the face)`);
      if (op.sides !== undefined && (!Number.isInteger(op.sides) || op.sides < 3 || op.sides > MAX_PORT_SIDES)) {
        errors.push(`${where}.sides must be an integer in [3, ${MAX_PORT_SIDES}] if provided`);
      }
    }
    if (op.op === 'recolor' && op.tint === undefined && op.material === undefined && op.group === undefined) {
      errors.push(`${where}: a recolor needs at least one of \`tint\`, \`material\`, or \`group\` — otherwise it does nothing`);
    }
  });
  return errors;
}

export { DEFAULT_PORT_SIDES, MAX_PORT_SIDES, MAX_OP_FACES };
