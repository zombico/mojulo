/**
 * station-loft — the LAYERED station/slot grammar: a solid whose primary form is named rings along a
 * spine, whose details are pinned to named faces, and whose dials regenerate everything.
 *
 * L0  frame: +z up, +y front, x = 0 the mirror plane. Units are the recipe's (metres by convention).
 * L1  parts (`layer: 1`): `slots` (an even count, ordered so slot j mirrors slot (n − j) % n: a midline
 *     slot first, the right half, a midline slot, the left half), `stations` (each `{ id, points: { slot:
 *     [x,y,z] } }`, in spine order), `caps: { back, tip }`. Faces are generated for the RIGHT half
 *     (slots 0 … n/2 − 1 bands) and mirrored BY NAME (mirrored slot names, reversed winding), so the
 *     left half is the exact mirror when the points are, and stays well-formed when they are not.
 *     Every point is `<part>/<station>.<slot>` or `<part>/back|tip`; every face
 *     `<part>/<stA>-<stB>.k<slot>.<a|b>` or `<part>/<back|tip>.k<slot>`. Identity is the name.
 * L2/L3 parts (`layer: 2 | 3`): geometry as local offsets in the frame of a PIN on a lower layer's named
 *     face (surface-pin.js; `pin.mirror` makes a symmetric pin for a midline detail: the average of a
 *     face frame and its mirror). `stretch: { dial, origin, axis }` scales the part along its own local
 *     axis under a dial. `closure: 'closed' | 'open'` (+ `boundary` for open patches). `loft` (optional)
 *     tells the workbench lowering how to express the part as one loft.
 * Dials (`recipe.dials`): `{ name: { min, max, rest, doc, op, … } }`, applied in recipe order:
 *     scale   { axis, pivot?, parts, blend: { <station|back|tip>: w } }  v' = pivot + (v − pivot)(1 + (d − 1)w)
 *     offset  { axis, slots, parts, blend }                               v' = v + d·w  (for the named slots)
 *     hinge   { part, pivot: <pointId>, axis, sign? }                     rigid rotation of the whole part
 *     stretch { parts }                                                   each part's own `stretch` axis
 * Creases (`recipe.creases`): `{ id: { parent, edge: [pointId, pointId] } }` → feature edges.
 * Channels: `details` (L2/L3 geometry) and `creases`; off ⇒ zero bytes from that channel.
 *
 * Pure, deterministic, no dice. Output: the compiled mesh (indexed vertices/faces/groups, point and
 * face ids, provenance, feature edges, pins, parts) that wire-svg.js draws and station-loft-workbench.js
 * lowers. The reference recipe is docs/examples/dragon-layered; its species rules live in its seed.
 */
import { surfacePinFrame, placeSurfaceOffset, surfaceLocalOffset } from './surface-pin.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]); if (!(l > 1e-12)) throw new Error('station-loft: degenerate vector'); return mul(v, 1 / l); };
const mean = (ps) => mul(ps.reduce(add, [0, 0, 0]), 1 / ps.length);
const AXIS = { x: 0, y: 1, z: 2 };
const byName = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0);

/** `…R` ↔ `…L` on a point id's last segment (the slot name or a local point name). */
export const mirrorPid = (p) => p.replace(/([RL])$/, (m) => (m === 'R' ? 'L' : 'R'));
/** The mirror of a generated L1 face id for a part with `n` slots. */
export const mirrorFaceId = (id, n) => id.replace(/\.k(\d+)(\.[ab])?$/, (m, k, ab) => `.k${n - 1 - Number(k)}${ab || ''}`);

export function resolveLayeredDials(spec = {}, values = {}) {
  if (!spec || typeof spec !== 'object') throw new Error('station-loft: recipe.dials must be an object');
  for (const k of Object.keys(values || {})) if (!(k in spec)) throw new Error(`station-loft: unknown dial '${k}' (have ${Object.keys(spec).join(', ') || 'none'})`);
  const out = {};
  for (const [k, s] of Object.entries(spec)) {
    const v = values?.[k] ?? s.rest;
    if (!Number.isFinite(v) || v < s.min || v > s.max) throw new Error(`station-loft: dial ${k}=${v} outside [${s.min}, ${s.max}]`);
    out[k] = v;
  }
  return out;
}

const stationOf = (id) => { const m = id.match(/\/(st[^.]+)\.[^.]+$/); if (m) return m[1]; const c = id.match(/\/(back|tip)$/); return c ? c[1] : null; };
const slotOf = (id) => id.match(/\/[^.]+\.([^.]+)$/)?.[1] ?? null;

/** A closed station loft: right half generated, left half mirrored by name; outward winding per family. */
function loft(name, part) {
  const slots = part.slots; const n = slots.length; const half = n / 2;
  if (!Array.isArray(slots) || n < 4 || n % 2) throw new Error(`station-loft: ${name}.slots must be an even list of ≥ 4 slot names`);
  if (!Array.isArray(part.stations) || part.stations.length < 2) throw new Error(`station-loft: ${name} needs ≥ 2 stations`);
  if (!part.caps?.back || !part.caps?.tip) throw new Error(`station-loft: ${name} needs caps.back and caps.tip`);
  const points = {}; const faces = {}; const groups = {};
  for (const st of part.stations) for (const s of slots) { const p = st.points?.[s]; if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite)) throw new Error(`station-loft: ${name}/${st.id}.${s} missing or not finite`); points[`${name}/${st.id}.${s}`] = [p[0], p[1], p[2]]; }
  points[`${name}/back`] = [...part.caps.back]; points[`${name}/tip`] = [...part.caps.tip];
  const rings = part.stations; const pid = (i, k) => `${name}/${rings[i].id}.${slots[k % n]}`;
  const bandGroup = (i, k) => part.bandGroups?.[`${rings[i].id}-${rings[i + 1].id}`]?.[k] ?? part.group ?? 'Body';
  const capGroup = (c) => part.capGroups?.[c] ?? part.group ?? 'Body';
  const right = [];
  for (let i = 0; i + 1 < rings.length; i++) for (let k = 0; k < half; k++) {
    const band = `${rings[i].id}-${rings[i + 1].id}`; const g = bandGroup(i, k);
    right.push({ id: `${name}/${band}.k${k}.a`, tri: [pid(i, k), pid(i, k + 1), pid(i + 1, k + 1)], family: 'band', ring: i, group: g });
    right.push({ id: `${name}/${band}.k${k}.b`, tri: [pid(i, k), pid(i + 1, k + 1), pid(i + 1, k)], family: 'band', ring: i, group: g });
  }
  const L = rings.length - 1;
  for (let k = 0; k < half; k++) {
    right.push({ id: `${name}/back.k${k}`, tri: [pid(0, k), pid(0, k + 1), `${name}/back`], family: 'back', ring: 0, group: capGroup('back') });
    right.push({ id: `${name}/tip.k${k}`, tri: [pid(L, k), pid(L, k + 1), `${name}/tip`], family: 'tip', ring: L, group: capGroup('tip') });
  }
  const ringCentre = (i) => mean(slots.map((s) => points[`${name}/${rings[i].id}.${s}`]));
  const flip = {};
  for (const fam of ['band', 'back', 'tip']) {
    const f = right.find((x) => x.family === fam); const p = f.tri.map((id) => points[id]);
    const nrm = cross(sub(p[1], p[0]), sub(p[2], p[0])); const c = fam === 'band' ? mean([ringCentre(f.ring), ringCentre(f.ring + 1)]) : ringCentre(f.ring);
    flip[fam] = dot(nrm, sub(mean(p), c)) < 0;
  }
  for (const f of right) {
    const tri = flip[f.family] ? [...f.tri].reverse() : f.tri; faces[f.id] = tri; groups[f.id] = f.group;
    const mid = mirrorFaceId(f.id, n); faces[mid] = [...tri].reverse().map(mirrorPid); groups[mid] = f.group;
  }
  return { points, faces, groups };
}

/** A pin's frame; `pin.mirror` averages the frame with its mirror so a midline detail stays on x = 0. */
export function pinFrame(parent, pin) {
  const f = surfacePinFrame(parent, pin);
  if (!pin.mirror) return f;
  const g = surfacePinFrame(parent, { face: pin.mirror.face, weights: [...pin.weights].reverse(), tangentEdge: pin.mirror.tangentEdge, handedness: -1 });
  const normal = unit(add(f.normal, g.normal)); const tangent = unit(add(f.tangent, g.tangent)); const bitangent = unit(cross(normal, tangent));
  return { origin: mean([f.origin, g.origin]), tangent, bitangent, normal, handedness: 1, symmetric: true };
}

function applyDial(op, name, d, built, recipe) {
  const parts = (op.parts || []).map((p) => { if (!built[p]) throw new Error(`station-loft: dial '${name}' names unknown part '${p}'`); return built[p]; });
  if (op.op === 'scale' || op.op === 'offset') {
    const ax = AXIS[op.axis]; if (ax === undefined) throw new Error(`station-loft: dial '${name}' axis must be x|y|z`);
    const blend = op.blend || {}; const pivot = Number.isFinite(op.pivot) ? op.pivot : 0; const slots = op.slots ? new Set(op.slots) : null;
    for (const part of parts) for (const [id, p] of Object.entries(part.points)) {
      const w = blend[stationOf(id)] ?? 0; if (!w) continue;
      if (slots && !slots.has(slotOf(id))) continue;
      const q = [...p]; q[ax] = op.op === 'scale' ? pivot + (q[ax] - pivot) * (1 + (d - 1) * w) : q[ax] + d * w; part.points[id] = q;
    }
  } else if (op.op === 'hinge') {
    if (d === 0) return; const part = built[op.part]; if (!part) throw new Error(`station-loft: hinge '${name}' names unknown part '${op.part}'`);
    const h = part.points[op.pivot] ?? built[op.pivot?.split('/')[0]]?.points?.[op.pivot]; if (!h) throw new Error(`station-loft: hinge '${name}' pivot '${op.pivot}' is not a point`);
    const ax = AXIS[op.axis]; if (ax === undefined) throw new Error(`station-loft: hinge '${name}' axis must be x|y|z`);
    const a = (op.sign ?? 1) * d * Math.PI / 180; const c = Math.cos(a), s = Math.sin(a); const [i, j] = [(ax + 1) % 3, (ax + 2) % 3];
    for (const [id, p] of Object.entries(part.points)) { const u = p[i] - h[i], v = p[j] - h[j]; const q = [...p]; q[i] = h[i] + u * c - v * s; q[j] = h[j] + u * s + v * c; part.points[id] = q; }
  } else if (op.op !== 'stretch') throw new Error(`station-loft: dial '${name}' has unknown op '${op.op}'`);
}

/**
 * compileLayered(recipe, dials?, channels?) → the compiled mesh.
 * @param recipe { frame, parts, creases?, dials? }
 * @param dials dial values (missing ⇒ rest); unknown or out-of-range throws
 * @param channels { details = true, creases = true }
 */
export function compileLayered(recipe, dials = {}, { details = true, creases = true } = {}) {
  if (!recipe || typeof recipe !== 'object' || !recipe.parts || typeof recipe.parts !== 'object') throw new Error('station-loft: recipe needs a parts object');
  const D = resolveLayeredDials(recipe.dials || {}, dials);
  const built = {};
  for (const [name, part] of Object.entries(recipe.parts)) if (part.layer === 1) built[name] = { ...part, ...loft(name, part) };
  if (!Object.keys(built).length) throw new Error('station-loft: recipe has no layer-1 part');
  for (const [name, op] of Object.entries(recipe.dials || {})) if (op.op !== 'stretch') applyDial(op, name, D[name], built, recipe);
  const pins = {};
  for (const [name, part] of Object.entries(recipe.parts).sort(([a, x], [b, y]) => x.layer - y.layer || byName([a], [b]))) {
    if (part.layer === 1) continue;
    if (!details) continue;
    if (!part.pin) throw new Error(`station-loft: ${name} (layer ${part.layer}) needs a pin`);
    const parent = built[part.pin.parent]; if (!parent) throw new Error(`station-loft: ${name}: missing parent ${part.pin.parent}`);
    if (parent.layer >= part.layer) throw new Error(`station-loft: ${name} must address a lower layer`);
    const frame = pinFrame(parent, part.pin); pins[name] = { ...frame, parent: part.pin.parent, face: part.pin.face };
    const k = part.stretch ? D[part.stretch.dial] : 1; if (part.stretch && !(part.stretch.dial in D)) throw new Error(`station-loft: ${name}.stretch names unknown dial ${part.stretch.dial}`);
    const points = {};
    for (const [id, o] of Object.entries(part.offsets || {})) {
      let local = o;
      if (part.stretch && k !== 1) { const { origin, axis } = part.stretch; const rel = sub(o, origin); const along = dot(rel, axis); local = add(add(origin, sub(rel, mul(axis, along))), mul(axis, along * k)); }
      points[id] = placeSurfaceOffset(frame, local);
    }
    built[name] = { ...part, points };
  }
  const vertices = [], pointIds = [], provenance = [], faces = [], faceIds = [], groups = [], index = {};
  for (const [name, part] of Object.entries(built)) {
    const gid = (id) => (part.layer === 1 ? id : `${name}/${id}`);
    for (const [id, v] of Object.entries(part.points).sort(byName)) {
      index[gid(id)] = vertices.length; pointIds.push(gid(id)); vertices.push(v);
      const st = part.layer === 1 ? stationOf(id) : null; const sl = part.layer === 1 ? slotOf(id) : null;
      provenance.push({ id: gid(id), layer: part.layer, part: name, ...(st && sl ? { station: st, slot: sl } : {}), anchor: part.pin ? part.pin.face : gid(id) });
    }
    for (const [id, f] of Object.entries(part.faces || {}).sort(byName)) { faceIds.push(gid(id)); faces.push(f.map((p) => { if (index[gid(p)] === undefined) throw new Error(`station-loft: missing point ${p} in ${gid(id)}`); return index[gid(p)]; })); groups.push(part.groups?.[id] ?? part.group ?? 'Detail'); }
  }
  const featureEdges = [], featureIds = [];
  if (creases) for (const [id, c] of Object.entries(recipe.creases || {})) {
    const parent = built[c.parent]; if (!parent) throw new Error(`station-loft: missing crease parent ${c.parent}`);
    if (!Object.values(parent.faces).some((f) => c.edge.every((v) => f.includes(v)))) throw new Error(`station-loft: crease ${id} is not a surface edge`);
    featureEdges.push(c.edge.map((p) => index[p])); featureIds.push(id);
  }
  return { schema: 'layered-compiled-v1', frame: recipe.frame || { up: '+z', front: '+y' }, dials: D, channels: { details, creases }, vertices, faces, groups, pointIds, faceIds, provenance, featureEdges, featureIds, pins, parts: built };
}

/** Per-part topology audit: declared closure, non-manifold, winding balance, degenerate triangles. */
export function auditLayered(mesh) {
  const report = {};
  for (const [name, p] of Object.entries(mesh.parts)) {
    const edges = new Map(); let degenerate = 0;
    for (const f of Object.values(p.faces || {})) {
      const [a, b, c] = f.map((k) => p.points[k]); if (Math.hypot(...cross(sub(b, a), sub(c, a))) < 1e-12) degenerate++;
      for (let i = 0; i < 3; i++) { const u = f[i], v = f[(i + 1) % 3], key = [u, v].sort().join('|'); const e = edges.get(key) || { count: 0, balance: 0 }; e.count++; e.balance += u < v ? 1 : -1; edges.set(key, e); }
    }
    const boundary = [...edges].filter(([, e]) => e.count === 1).map(([k]) => k).sort(); const expected = (p.boundary || []).map((e) => [...e].sort().join('|')).sort();
    const nonManifold = [...edges.values()].filter((e) => e.count > 2).length; const windingErrors = [...edges.values()].filter((e) => e.count === 2 && e.balance !== 0).length;
    const boundaryValid = p.closure === 'closed' ? boundary.length === 0 : JSON.stringify(boundary) === JSON.stringify(expected);
    report[name] = { layer: p.layer, closure: p.closure, boundaryEdges: boundary.length, boundaryValid, nonManifold, windingErrors, degenerate, pass: boundaryValid && !nonManifold && !windingErrors && !degenerate };
  }
  return report;
}

export { surfaceLocalOffset };
