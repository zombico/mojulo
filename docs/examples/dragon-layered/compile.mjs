/** dragon-layered/compile.mjs — a head born layered.
 *
 * L0  frame (+z up, +y front, x=0 mirror plane), unit scale, station names.
 * L1  two closed station lofts, `cranium` (8 slots) and `jaw` (6 slots): every point is
 *     `<part>/<station>.<slot>`, every face `<part>/<stA>-<stB>.k<slot>.<a|b>` or `<part>/<cap>.k<slot>`.
 *     The right half is generated; the left half is its exact mirror (mirrored names, reversed winding).
 * L2  closed details (horns, eyes, teeth, crest spikes) pinned to NAMED L1 faces through
 *     surface-pin.js; their geometry is local offsets in the pin frame. A `stretch` scales a detail
 *     along its own local axis under a dial. A midline detail uses a symmetric pin: the average of a
 *     face frame and its mirror, so it stays on x=0 under every dial.
 * L3  open patches (nostrils) pinned the same way, and brow creases as feature edges on L1 slot edges.
 * Dials regenerate L1 from the station table; L2/L3 follow through their pins. Jaw opens by a rigid
 * rotation of the jaw part about its hinge slot; lower teeth ride it because their pins are on it.
 * Nothing here is a registered Mojulo kind; it is the reference for a station/slot loft grammar.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { surfacePinFrame, placeSurfaceOffset, surfaceLocalOffset } from '../../../control/lib/graph/polygonizer/surface-pin.js';

export const DIALS = {
  skullWidth:  { min: 0.8, max: 1.3, rest: 1, doc: 'x scale of the skull stations, blended out along the snout' },
  snoutLength: { min: 0.7, max: 1.4, rest: 1, doc: 'y scale of the snout stations about the eye station' },
  browDrop:    { min: 0,   max: 0.05, rest: 0, doc: 'metres the brow slots drop at the crown, eye and root stations' },
  crestHeight: { min: 0,   max: 1.6, rest: 1, doc: 'stretch of the crest spikes along their own axis' },
  hornSweep:   { min: 0.6, max: 1.5, rest: 1, doc: 'stretch of the horns along their own axis' },
  toothLength: { min: 0.5, max: 1.6, rest: 1, doc: 'stretch of every tooth along its own axis' },
  jawOpen:     { min: 0,   max: 35,  rest: 0, doc: 'degrees the jaw part rotates about its hinge slot' },
};
export function resolveDials(d = {}) {
  for (const k of Object.keys(d)) if (!(k in DIALS)) throw new Error(`unknown dial ${k}`);
  const out = {};
  for (const [k, s] of Object.entries(DIALS)) { const v = d[k] ?? s.rest; if (!Number.isFinite(v) || v < s.min || v > s.max) throw new Error(`dial ${k}=${v} outside [${s.min}, ${s.max}]`); out[k] = v; }
  return out;
}

const sub = (a, b) => a.map((x, i) => x - b[i]); const add = (a, b) => a.map((x, i) => x + b[i]); const mul = (a, s) => a.map(x => x * s);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = v => { const l = Math.hypot(...v); if (!(l > 1e-12)) throw new Error('degenerate vector'); return v.map(x => x / l); };
const mean = ps => mul(ps.reduce(add, [0, 0, 0]), 1 / ps.length);

export const CRANIUM_SLOTS = ['top', 'browR', 'sideR', 'lipR', 'palate', 'lipL', 'sideL', 'browL'];
export const JAW_SLOTS = ['gum', 'gumR', 'jawR', 'bottom', 'jawL', 'gumL'];
export const mirrorPid = (p) => p.replace(/([RL])$/, (m) => (m === 'R' ? 'L' : 'R'));
const mirrorFid = (id, n) => id.replace(/\.k(\d+)(\.[ab])?$/, (m, k, ab) => `.k${n - 1 - Number(k)}${ab || ''}`);
export const mirrorFace = (id) => mirrorFid(id, id.startsWith('jaw/') ? JAW_SLOTS.length : CRANIUM_SLOTS.length);

/** A closed station loft: right half generated, left half mirrored; outward winding per family. */
function loft(name, slots, rings, caps, groupOf) {
  const n = slots.length, half = n / 2, points = {}, faces = {}, groups = {};
  for (const r of rings) for (const s of slots) points[`${name}/${r.station}.${s}`] = r.pts[s];
  points[`${name}/back`] = caps.back; points[`${name}/tip`] = caps.tip;
  const pid = (i, k) => `${name}/${rings[i].station}.${slots[k % n]}`;
  const right = [];
  for (let i = 0; i + 1 < rings.length; i++) for (let k = 0; k < half; k++) {
    const band = `${rings[i].station}-${rings[i + 1].station}`;
    right.push({ id: `${name}/${band}.k${k}.a`, tri: [pid(i, k), pid(i, k + 1), pid(i + 1, k + 1)], family: 'band', ring: i, k });
    right.push({ id: `${name}/${band}.k${k}.b`, tri: [pid(i, k), pid(i + 1, k + 1), pid(i + 1, k)], family: 'band', ring: i, k });
  }
  const L = rings.length - 1;
  for (let k = 0; k < half; k++) {
    right.push({ id: `${name}/back.k${k}`, tri: [pid(0, k), pid(0, k + 1), `${name}/back`], family: 'back', ring: 0, k });
    right.push({ id: `${name}/tip.k${k}`, tri: [pid(L, k), pid(L, k + 1), `${name}/tip`], family: 'tip', ring: L, k });
  }
  // orientation: each family is consistently wound by construction; flip a whole family if its first face is inward
  const ringCentre = (i) => mean(slots.map((s) => points[`${name}/${rings[i].station}.${s}`]));
  const flip = {};
  for (const fam of ['band', 'back', 'tip']) {
    const f = right.find((x) => x.family === fam); const p = f.tri.map((id) => points[id]);
    const nrm = cross(sub(p[1], p[0]), sub(p[2], p[0])); const c = fam === 'band' ? mean([ringCentre(f.ring), ringCentre(f.ring + 1)]) : ringCentre(f.ring);
    flip[fam] = dot(nrm, sub(mean(p), c)) < 0;
  }
  for (const f of right) {
    const tri = flip[f.family] ? [...f.tri].reverse() : f.tri;
    faces[f.id] = tri; groups[f.id] = groupOf(f);
    const mid = mirrorFid(f.id, n);
    faces[mid] = [...tri].reverse().map(mirrorPid); groups[mid] = groupOf(f);   // exact mirror, outward
  }
  return { points, faces, groups };
}

/** L1 from the station table and dials, in world units. */
export function buildPrimary(recipe, dials) {
  const D = resolveDials(dials); const { scale: S, origin: O } = recipe.frame; const R = recipe.l1.rules;
  const W = (x, y, z) => [x * S + O[0], y * S + O[1], z * S + O[2]];
  const st = recipe.l1.stations.map((s, i) => {
    const wx = 1 + (D.skullWidth - 1) * R.widthBlend[i]; const y = i >= R.snoutFrom ? R.snoutPivotY + (s.y - R.snoutPivotY) * D.snoutLength : s.y;
    return { station: s.station, y, top: s.top, brow: [s.brow[0] * wx, s.brow[1] - D.browDrop / S * R.browBlend[i]], side: [s.side[0] * wx, s.side[1]], lip: [s.lip[0] * wx, s.lip[1]], bottom: s.bottom };
  });
  const snoutY = (y) => R.snoutPivotY + (y - R.snoutPivotY) * D.snoutLength;
  const cranium = loft('cranium', CRANIUM_SLOTS, st.map((s) => ({ station: s.station, pts: {
    top: W(0, s.y, s.top), browR: W(s.brow[0], s.y, s.brow[1]), sideR: W(s.side[0], s.y, s.side[1]), lipR: W(s.lip[0], s.y, s.lip[1]),
    palate: W(0, s.y, s.lip[1] + R.palateLift), lipL: W(-s.lip[0], s.y, s.lip[1]), sideL: W(-s.side[0], s.y, s.side[1]), browL: W(-s.brow[0], s.y, s.brow[1]) } })),
    { back: W(0, R.craniumBack[0], R.craniumBack[1]), tip: W(0, snoutY(R.craniumTip[0]), R.craniumTip[1]) },
    (f) => f.family === 'back' ? 'Skull' : f.family === 'tip' ? 'Snout' : f.k <= 1 ? (f.ring < R.snoutFrom - 1 ? 'Skull' : 'Snout') : f.k === 2 ? 'Lip' : 'Palate');
  const jaw = loft('jaw', JAW_SLOTS, st.map((s) => { const gz = s.lip[1] - R.gumDrop, jz = s.lip[1] + (s.bottom - s.lip[1]) * R.jawSlotFrac; return { station: s.station, pts: {
    gum: W(0, s.y, gz), gumR: W(s.lip[0] - R.gumInset, s.y, gz), jawR: W(s.lip[0] * R.jawSlotWidth, s.y, jz), bottom: W(0, s.y, s.bottom), jawL: W(-s.lip[0] * R.jawSlotWidth, s.y, jz), gumL: W(-(s.lip[0] - R.gumInset), s.y, gz) } }; }),
    { back: W(0, R.jawBack[0], st[0].lip[1] + R.jawBack[1]), tip: W(0, snoutY(R.jawTip[0]), R.jawTip[1]) }, () => 'Jaw');
  // jaw hinge: rigid rotation about the x axis through the rear gum slot, front going down
  if (D.jawOpen > 0) {
    const h = jaw.points['jaw/st0.gum']; const a = D.jawOpen * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    for (const [id, p] of Object.entries(jaw.points)) { const dy = p[1] - h[1], dz = p[2] - h[2]; jaw.points[id] = [p[0], h[1] + dy * c + dz * s, h[2] - dy * s + dz * c]; }
  }
  return { cranium: { layer: 1, closure: 'closed', ...cranium }, jaw: { layer: 1, closure: 'closed', ...jaw } };
}

/** A pin's frame; a symmetric pin averages a face frame with its mirror so a midline detail stays on x = 0. */
export function pinFrame(parent, pin) {
  const f = surfacePinFrame(parent, pin);
  if (!pin.mirror) return f;
  const g = surfacePinFrame(parent, { face: pin.mirror.face, weights: [...pin.weights].reverse(), tangentEdge: pin.mirror.tangentEdge, handedness: -1 });
  const normal = unit(add(f.normal, g.normal)), tangent = unit(add(f.tangent, g.tangent)); const bitangent = unit(cross(normal, tangent));
  return { origin: mean([f.origin, g.origin]), tangent, bitangent, normal, handedness: 1, symmetric: true };
}

export function compile(recipe, dials = {}, { details = true, creases = true } = {}) {
  const D = resolveDials(dials);
  const built = buildPrimary(recipe, D); const pins = {};
  for (const [name, part] of Object.entries(recipe.parts).sort(([a, x], [b, y]) => x.layer - y.layer || (a < b ? -1 : a > b ? 1 : 0))) {
    if (!details) continue;
    const parent = built[part.pin.parent]; if (!parent) throw new Error(`missing parent ${part.pin.parent} for ${name}`);
    if (parent.layer >= part.layer) throw new Error(`attachment ${name} must address a lower layer`);
    const frame = pinFrame(parent, part.pin); pins[name] = { ...frame, parent: part.pin.parent, face: part.pin.face };
    const k = part.stretch ? D[part.stretch.dial] : 1; const points = {};
    for (const [id, o] of Object.entries(part.offsets)) {
      let local = o;
      if (part.stretch && k !== 1) { const { origin, axis } = part.stretch; const rel = sub(o, origin); const along = dot(rel, axis); local = add(add(origin, sub(rel, mul(axis, along))), mul(axis, along * k)); }
      points[id] = placeSurfaceOffset(frame, local);
    }
    built[name] = { ...part, points };
  }
  const vertices = [], pointIds = [], provenance = [], faces = [], faceIds = [], groups = [], index = {};
  for (const [name, part] of Object.entries(built)) {
    const gid = (id) => (part.layer === 1 ? id : `${name}/${id}`);   // L1 ids carry their part already; details are local names
    for (const [id, v] of Object.entries(part.points).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      index[gid(id)] = vertices.length; pointIds.push(gid(id)); vertices.push(v);
      const m = id.match(/^[^/]+\/(st\d+)\.(\w+)$/); provenance.push({ id: gid(id), layer: part.layer, part: name, ...(m ? { station: m[1], slot: m[2] } : {}), anchor: part.pin ? part.pin.face : gid(id) });
    }
    for (const [id, f] of Object.entries(part.faces).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) { faceIds.push(gid(id)); faces.push(f.map((p) => { if (index[gid(p)] === undefined) throw new Error(`missing point ${p} in ${gid(id)}`); return index[gid(p)]; })); groups.push(part.groups[id]); }
  }
  const featureEdges = [], featureIds = [];
  if (creases) for (const [id, c] of Object.entries(recipe.creases)) {
    const parent = built[c.parent]; if (!parent) throw new Error(`missing crease parent ${c.parent}`);
    if (!Object.values(parent.faces).some((f) => c.edge.every((v) => f.includes(v)))) throw new Error(`crease ${id} is not a surface edge`);
    featureEdges.push(c.edge.map((p) => index[p])); featureIds.push(id);
  }
  return { schema: 'layered-head-compiled-v1', frame: { up: '+z', front: '+y' }, dials: D, channels: { details, creases }, vertices, faces, groups, pointIds, faceIds, provenance, featureEdges, featureIds, pins, parts: built };
}

/** Per-part topology audit (Codex's contract): declared closure, non-manifold, winding balance, degenerate. */
export function audit(mesh) {
  const report = {};
  for (const [name, p] of Object.entries(mesh.parts)) {
    const edges = new Map(); let degenerate = 0;
    for (const f of Object.values(p.faces)) {
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

export const recipePath = new URL('./recipe.json', import.meta.url);
export function loadRecipe() { return JSON.parse(readFileSync(recipePath, 'utf8')); }
export { surfaceLocalOffset };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dials = process.argv[2] ? JSON.parse(process.argv[2]) : {}; const name = process.argv[3] || 'baseline';
  const outDir = process.argv[4] ? resolve(process.argv[4]) : fileURLToPath(new URL('.', import.meta.url));
  const mesh = compile(loadRecipe(), dials); writeFileSync(resolve(outDir, `${name}.json`), JSON.stringify(mesh) + '\n');
  const a = audit(mesh); console.log(JSON.stringify({ dials: mesh.dials, vertices: mesh.vertices.length, faces: mesh.faces.length, pass: Object.values(a).every((r) => r.pass), parts: Object.fromEntries(Object.entries(a).map(([k, r]) => [k, r.pass ? 'ok' : r])) }));
}
