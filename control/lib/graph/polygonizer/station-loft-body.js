/**
 * station-loft-body — the BODY detail passes, species-free: the head's detail principles one scale over, on a body's
 * segments. Lifted from the dragon body's example (docs/examples/body-detail) when the hero became its second body;
 * every anatomy word is BODY DATA a caller supplies, and the dragon's old constants are the defaults.
 *
 * The fact the passes read: each segment's bind declares where the body bends and where it is rigid (a limb's end
 * stations are blends with the neighbouring bone, its middle is its own bone).
 *
 *   refine    named density: stations halved, ring slots refined (explicit triplets or 'halve'); pins migrated by address
 *   volume    volumize by name (a chest, a biceps, a quadriceps)
 *   creases   per joint: rows either side of the bend, one strip per ring quadrant per half, height ∝ how much the
 *             quadrant faces the INSIDE of the bend × the bend angle, both read from the compiled mesh; `floor` is the
 *             least a crease stands (a garment's fold at rest), `lift` / `width` its size in ring radii
 *   tiles     grown only where ONE bone dominates the whole footprint (≥ `rigid`), seeded per tile id
 *   pads      dishes on the side a joint flexes toward, a world direction, or away from a bend
 *   spurs     sweeps on the outside of a bend
 *   rows      a midline row on symmetric frames (the dorsal spines; `shape: 'stud'` for a row of flat studs)
 *   collars   a raised band round a station (tail rings, cuffs, boot tops)
 *
 * `detailBody(src, body, dials)` builds at render time (the dragon's way: a mesh and loose parts, nothing written);
 * `bakeBody(src, body)` writes the same parts into the recipe as pinned L2 parts on the refined rest L1, so the World
 * page, exports, the exposure ledger and the rig see them; baked parts `follow` (they move with the dials as the
 * surface under their pin does, not rigidly). A pinned part inherits its pin face's weights, so baking
 * also extends every refined part's BIND blends by `u` (a refined joint station is its neighbours' blend).
 * Deterministic: the only dice are `mulberry32`, seeded per tile id.
 */
import { compileLayered, pinFrame } from './station-loft.js';
import { placeSurfaceOffset, surfaceLocalOffset } from './surface-pin.js';
import { mulberry32 } from './floorplan-glyphs.js';
import { address, frameAt, strip, sweep, loftParts, loftLabels, pinned, refineStation, refineSlot, volumize, pinToAddress, symmetricFrameAt, ringAt, freezeParams, clone, vec } from './station-loft-detail.js';
import * as dmath from '../../util/dmath.js';

const { sub, add, mul, dot, unit, mean } = vec;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const r6 = (x) => Math.round(x * 1e6) / 1e6;
export const RIGID = 0.8;
/** the dragon's ring refinement: the three half-ring bands of a limb6 ring */
export const LIMB6_SLOTS = [['front', 'front', 'fq'], ['front', 'backR', 'mid'], ['back', 'back', 'bq']];
export const BODY_KEYS = ['refine', 'volume', 'creases', 'tiles', 'pads', 'spurs', 'rows', 'collars', 'rigid'];

// ─── reads off a part ───
/** dominant bind weight along s, from a part's bind (ORIGINAL station ids st<i> at u = i; unlisted stations are the part's own bone) */
export function dominance(part) { const b = part.bind; const n = part.stations.length;
  const at = (i) => b?.blend?.[`st${i}`] ?? { [b?.bone ?? 'self']: 1 };
  return (s) => { const i = clamp(Math.floor(s), 0, n - 2), f = clamp(s - i, 0, 1); const A = at(i), B = at(i + 1); const bones = new Set([...Object.keys(A), ...Object.keys(B)]);
    let best = 0, bone = null; for (const k of bones) { const w = (A[k] ?? 0) * (1 - f) + (B[k] ?? 0) * f; if (w > best) { best = w; bone = k; } } return { w: best, bone }; }; }
const H = (P) => P.slotT ? Math.max(...Object.values(P.slotT)) : P.slots.length / 2;
const sMax = (P) => { const s = P.stations[P.stations.length - 1]; return s.u ?? P.stations.length - 1; };
const ringCentre = (L1, p, st) => mean(L1[p].slots.map((sl) => L1[p].points[`${p}/${st}.${sl}`]));
const radius = (L1, p) => { const P = L1[p], st = P.stations[Math.floor(P.stations.length / 2)].id, c = ringCentre(L1, p, st); return mean(P.slots.map((sl) => [dmath.hypot(...sub(P.points[`${p}/${st}.${sl}`], c))]))[0]; };
/** a joint's bend, read from the compiled mesh: angle between the two segments' axes, and the INSIDE (concave) direction */
export function bend(L1, a, b) { const ax = (p) => { const S = L1[p].stations; return unit(sub(ringCentre(L1, p, S[S.length - 1].id), ringCentre(L1, p, S[0].id))); };
  const dA = ax(a), dB = ax(b); const ang = dmath.acos(clamp(dot(dA, dB), -1, 1)); return { ang, inside: ang > 1e-4 ? unit(sub(dB, dA)) : [0, 0, 0] }; }
/** the address on part p at station s whose surface faces `dir` best (both ring halves scanned) */
export function facing(L1, p, s, dir) { const h = H(L1[p]); let best = null; for (const side of ['R', 'L']) for (let t = 0; t <= h + 1e-9; t += h / 12) { const n = frameAt(L1, p, [s, t], side).normal; const d = dot(n, dir); if (!best || d > best.d) best = { d, at: [s, t], side }; } return best; }

// ─── recipe-level: density and volume ───
/** a ring's R-half bands as refineSlot triplets, named h<k>: 'halve' on any slot family */
function halveSlots(P) { const half = P.slots.slice(0, P.slots.length / 2 + 1); const out = [];
  for (let k = 0; k + 1 < half.length; k++) { const [x, y] = [half[k], half[k + 1]]; out.push(x.endsWith('R') ? [x.slice(0, -1), y, `h${k}`] : [y.slice(0, -1), x, `h${k}`]); } return out; }
function densify(r, part, { stations = true, slots = LIMB6_SLOTS } = {}) {
  if (stations) { const ids = r.parts[part].stations.map((s) => s.id); for (let i = 0; i + 1 < ids.length; i++) refineStation(r, part, ids[i], ids[i + 1]); }
  if (slots) for (const [a, b, name] of slots === 'halve' ? halveSlots(r.parts[part]) : slots) refineSlot(r, part, a, b, name);
}
function extendBlends(r) { for (const d of Object.values(r.dials || {})) { if (!d.blend) continue; for (const pn of d.parts || []) { const P = r.parts[pn]; if (!P) continue;
  for (const st of P.stations) { if (d.blend[st.id] !== undefined || st.u === undefined || Number.isInteger(st.u)) continue; const t = st.u - Math.floor(st.u);
    d.blend[st.id] = (d.blend[`st${Math.floor(st.u)}`] ?? 0) * (1 - t) + (d.blend[`st${Math.ceil(st.u)}`] ?? 0) * t; } } } }
/** a refined station's SKIN weights: the blend of its neighbours' by u (an unlisted station is the part's own bone) */
function extendBinds(r, refined) { for (const pn of refined) { const P = r.parts[pn]; const b = P.bind; if (!b || typeof b !== 'object' || !b.blend) continue;
  const at = (i) => b.blend[`st${i}`] ?? { [b.bone]: 1 };
  for (const st of P.stations) { if (b.blend[st.id] !== undefined || st.u === undefined || Number.isInteger(st.u)) continue; const lo = at(Math.floor(st.u)), hi = at(Math.ceil(st.u)), t = st.u - Math.floor(st.u);
    const w = {}; for (const k of [...new Set([...Object.keys(lo), ...Object.keys(hi)])].sort()) { const v = r6((lo[k] ?? 0) * (1 - t) + (hi[k] ?? 0) * t); if (v > 0) w[k] = v; }
    if (!(Object.keys(w).length === 1 && w[b.bone] === 1)) b.blend[st.id] = w; } } }
/** re-pin L2 parts whose parent was refined: face pin → (s,t) on the unrefined carrier → face pin on the refined one */
function migratePins(before, r, refined) { const L1u = compileLayered(before, {}, { details: false, creases: false }).parts, L1r = compileLayered(r, {}, { details: false, creases: false }).parts;
  for (const P of Object.values(r.parts)) { if (!P.pin || !refined.has(P.pin.parent)) continue; const { at, flip } = pinToAddress(L1u[P.pin.parent], P.pin);
    P.pin = address(L1r, P.pin.parent, at[0], at[1], P.pin.handedness === -1 ? 'L' : 'R'); if (flip) P.offsets = Object.fromEntries(Object.entries(P.offsets).map(([k, o]) => [k, [-o[0], -o[1], o[2]]])); } }
/** volume, then named refinement (parameters frozen on every refined part first, so addresses keep their meaning) */
export function detailRecipe(src, body, { binds = false } = {}) { const r = clone(src); for (const [p, sw, stw, amt] of body.volume || []) volumize(r, p, sw, stw, amt);
  const plan = (body.refine || []).flatMap((e) => e.parts.map((p) => [p, e])); for (const [p] of plan) freezeParams(r.parts[p]); const before = clone(r);
  const refined = new Set(plan.map(([p]) => p)); for (const [p, e] of plan) densify(r, p, { stations: e.stations !== false, slots: e.slots === undefined ? LIMB6_SLOTS : e.slots });
  extendBlends(r); if (binds) extendBinds(r, refined); migratePins(before, r, refined); return r; }

// ─── the passes' shapes ───
/** BEND CREASES: rows either side of a joint; each row is one strip per ring quadrant per half; a strip rises
 * with (how much it faces the inside of the bend) × (the bend angle / 90°), never below `floor`. Always emitted. */
function creases(L1, a, b, id, { lift: LIFT = 0.3, width: WIDTH = 0.08, floor = 0.04, group = 'Crease' } = {}) { const { ang, inside } = bend(L1, a, b); const out = {}; const k = Math.min(1, ang / (Math.PI / 2));
  for (const [p, s] of [[a, sMax(L1[a]) - 0.3], [b, 0.3]]) { const h = H(L1[p]), R = radius(L1, p);
    for (const side of ['R', 'L']) for (const [q0, q1] of [[0, h / 2], [h / 2, h]]) { const addrs = [0.15, 0.5, 0.85].map((f) => [s, q0 + (q1 - q0) * f]);
      const face = Math.max(0, dot(frameAt(L1, p, addrs[1], side).normal, inside)); const lift = LIFT * R * Math.max(floor, face * k), w = WIDTH * R;
      const m = strip(L1, p, addrs, side, (j) => { const tp = dmath.sin(Math.PI * (j + 0.5) / 3); return [[-w * tp, -0.002], [0, lift * tp], [w * tp, -0.002], [0, -0.004]]; });
      out[`${id}.${p}.${side}${q0 ? 'b' : 'f'}`] = { ...m, group }; } }
  return out; }
/** TILES with a RIGID gate: a tile grows only if its whole footprint sits where one bone dominates (≥ rigid) */
function rigidTiles(L1, name, side, T, idBase, dom, keep = [], RIGID_W = RIGID) {
  const out = {}, anchors = {}; const [s0, s1] = T.s, [t0, t1] = T.t, [ns, nt] = T.grid; const ds = (s1 - s0) / ns, dt = (t1 - t0) / nt; let gated = 0;
  const sides = T.sides ?? 4, cover = T.coverage ?? 0.9, fade = T.edgeFade ?? 0; const cS = (v) => clamp(v, s0, s1), cT = (v) => clamp(v, t0, t1);
  const hash = (str) => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
  for (let j = 0; j < nt; j++) { const off = T.brick && j % 2 ? 0.5 : 0;
    for (let i = 0; i < ns; i++) { if (s0 + (i + off + 1) * ds > s1 + 1e-9) continue; const id = `${idBase}.${i}.${j}`; const rng = mulberry32(hash(id)); const [r1, r2, r3, r4] = [rng(), rng(), rng(), rng()];
      const sc = s0 + (i + off + 0.5 + (T.wobble ?? 0) * (r1 - 0.5)) * ds, tc = t0 + (j + 0.5 + (T.wobble ?? 0) * (r2 - 0.5)) * dt;
      const ring = Array.from({ length: sides }, (_, k) => { const a = 2 * Math.PI * k / sides + Math.PI / sides; return [cS(sc + dmath.cos(a) * ds / 2 * cover), cT(tc + dmath.sin(a) * dt / 2 * cover)]; });
      const bones = new Set(ring.map(([s]) => dom(s).bone)); if (bones.size > 1 || ring.some(([s]) => dom(s).w < RIGID_W)) { gated++; continue; }   // rigid-on-rigid
      let edge = fade > 0 ? Math.min(1, Math.min(sc - s0, s1 - sc) / (fade * (s1 - s0)), Math.min(tc - t0, t1 - tc) / (fade * (t1 - t0))) : 1;
      const F0 = frameAt(L1, name, [sc, tc], side); const n = F0.normal, c = F0.origin;
      const room = Math.min(Infinity, ...keep.map((z) => dmath.hypot(...sub(c, z.p)) - z.r)); if (room <= 0 || r4 < (T.thin ?? 0) * (1 - Math.min(1, edge))) continue; edge = Math.min(edge, room / 0.02);
      const O = ring.map((a) => frameAt(L1, name, a, side).origin); const along = unit(sub(frameAt(L1, name, [cS(sc + ds / 4), tc], side).origin, frameAt(L1, name, [cS(sc - ds / 4), tc], side).origin));
      const h = T.height * (1 + (T.jitter ?? 0) * (2 * r3 - 1)) * (0.2 + 0.8 * Math.max(0, edge)); const lean = (T.lean ?? 0) * h;
      const base = O.map((o) => sub(o, mul(n, 0.002))); const top = O.map((o) => add(add(add(c, mul(sub(o, c), 1 - T.inset)), mul(n, h)), mul(along, lean)));
      out[id] = { ...loftParts([base, top], sub(c, mul(n, 0.004)), add(mean(top), mul(n, h * 0.2))), group: T.group[(i + j) % T.group.length], bone: dom(sc).bone, rigidW: Math.min(...ring.map(([s]) => dom(s).w)) };
      anchors[id] = { part: name, at: [sc, tc], side }; } }
  return { tiles: out, gated, anchors }; }
/** COLLAR round station j of a compiled part (rings read from its named points) */
function collar(L1, p, j, height, width = 0.35) { const P = L1[p]; const ring = (i) => P.slots.map((sl) => P.points[`${p}/${P.stations[i].id}.${sl}`]);
  const R = ring(j), c = mean(R), prev = mean(ring(Math.max(0, j - 1))), next = mean(ring(Math.min(P.stations.length - 1, j + 1)));
  const ax = unit(sub(next, prev)), half = width * dmath.hypot(...sub(next, prev)) / 2; const at = (d, s) => R.map((q) => add(add(c, mul(sub(q, c), s)), mul(ax, d)));
  return loftParts([at(-half, 0.97), at(0, 1 + height), at(half, 0.97)], add(c, mul(ax, -half * 1.3)), add(c, mul(ax, half * 1.3))); }
function dish({ r, rim, floor, m = 10 }, [outer, inner] = ['Pad', 'PadInner']) { const ring = (rr, z) => ringAt([0, 0, z], [0, 0, 1], rr, m);
  const mesh = loftParts([ring(r * 1.08, -0.001), ring(r, rim), ring(r * 0.62, floor)], [0, 0, -0.004], [0, 0, floor * 0.8]); return { ...mesh, faceGroups: loftLabels(mesh, (j) => (j === 0 ? outer : inner), [outer, inner]) }; }
/** SPUR: a sweep out of the surface, raked back toward the parent (−tangent), sized by the segment radius */
function spur(R, rake = 1) { const L = 1.1 * R; return sweep([[0, 0, -0.2 * R], [-0.25 * L * rake, 0, 0.35 * L], [-0.6 * L * rake, 0, 0.65 * L], [-1.0 * L * rake, 0, 0.8 * L]], [0.28 * R, 0.18 * R, 0.08 * R], 5); }
/** STUD: a flat, slightly domed disc standing on the surface (a toggle, a rivet, a button), pin-local */
function stud(r, h, m = 8) { const ring = (rr, z) => ringAt([0, 0, z], [0, 0, 1], rr, m); return loftParts([ring(r, -0.002), ring(r, h * 0.7), ring(r * 0.7, h)], [0, 0, -0.004], [0, 0, h * 1.1]); }

// ─── the build ───
/** Detail a layered recipe with BODY DATA. Returns the refined recipe `r`, the compiled mesh at `dials`, the detail
 * `parts` (world points), `anchors` (each part's carrier address, for a bake) and `stats`. */
export function detailBody(src, body, dials = {}, { binds = false } = {}) {
  const r = detailRecipe(src, body, { binds }); const mesh = compileLayered(r, dials); const L1 = mesh.parts; const parts = {}, anchors = {}; const stats = { gatedTiles: 0 };
  const RIGID_W = body.rigid ?? RIGID; const C = body.creases || {};
  for (const [a, b, group] of C.joints || []) Object.assign(parts, creases(L1, a, b, `crease.${a}-${b}`, { lift: C.lift, width: C.width, floor: C.floor, group: group ?? C.group }));
  const keep = [];
  // a pad faces the ground, or the side its joint FLEXES toward: the bend read at the drive's extreme, turned into an
  // address there (addresses are pose-free), then pinned on the current carrier; `away` is the outside of a bend
  const flexed = {}; const atDrive = (d) => (flexed[JSON.stringify(d)] ??= compileLayered(r, { ...dials, ...d }, { details: false, creases: false }).parts);
  for (const P of body.pads || []) { const T = P.toward; const L = T.world ? L1 : atDrive(T.drive || {}); const dir = T.world || (T.away ? mul(bend(L, ...T.away).inside, -1) : bend(L, ...T.flex).inside); const f = facing(L, P.part, P.s, dir); const R = radius(L1, P.part);
    // the dish's per-face groups (its wall, its inside) ride through the pin: `pinned` carries points and faces only
    const d = dish({ r: P.r * R, rim: (P.rim ?? 0.12) * R, floor: (P.floor ?? 0.05) * R, m: P.m }, P.groups);
    parts[P.id ?? `pad.${P.part}`] = { ...pinned(L1, P.part, f.at, f.side, d), faceGroups: d.faceGroups, group: (P.groups || ['Pad'])[0] }; keep.push({ p: frameAt(L1, P.part, f.at, f.side).origin, r: P.r * R * 1.2 }); }
  for (const S of body.spurs || []) { const { inside } = bend(L1, ...S.away); const f = facing(L1, S.part, S.s, mul(inside, -1)); const R = radius(L1, S.part);
    parts[`spur.${S.part}`] = { ...pinned(L1, S.part, f.at, f.side, spur(R)), group: S.group ?? 'Spur' }; keep.push({ p: frameAt(L1, S.part, f.at, f.side).origin, r: 0.5 * R }); }
  // a tile window may name itself (`id`), so two windows on one part grow apart; generated ids never collide
  for (const T of body.tiles || []) for (const p of T.parts) { const dom = dominance(src.parts[p]); for (const side of ['R', 'L']) { const g = rigidTiles(L1, p, side, T, T.id ? `tile.${T.id}.${p}.${side}` : `tile.${p}.${side}`, dom, keep, RIGID_W);
    for (const k of Object.keys(g.tiles)) if (parts[k]) throw new Error(`body: tile ${k} is grown twice — give each tile window on ${p} its own id`);
    Object.assign(parts, g.tiles); Object.assign(anchors, g.anchors); stats.gatedTiles += g.gated; } }
  for (const S of body.rows || []) { const P = L1[S.part], dom = dominance(src.parts[S.part]); const t = P.slotT?.[S.t] ?? H(P); const R = radius(L1, S.part); const kind = S.shape ?? 'spur';
    for (let s = S.s[0], i = 0; s <= S.s[1] + 1e-9; s += S.step, i++) { if (dom(s).w < RIGID_W) continue; const f = symmetricFrameAt(L1, S.part, [s, t]); const m = kind === 'stud' ? stud(S.r, S.h ?? S.r * 0.6, S.m) : spur(S.r ?? R * S.size, S.rake);
      const id = `${kind === 'spur' ? 'spine' : kind}.${S.part}.${i}`; parts[id] = { group: S.group ?? 'Spine', points: Object.fromEntries(Object.entries(m.points).map(([k, o]) => [k, placeSurfaceOffset(f, o)])), faces: m.faces }; anchors[id] = { part: S.part, at: [s, t], side: 'R' }; } }
  for (const C2 of body.collars || []) { const P = L1[C2.part]; const j = P.stations.findIndex((s) => s.id === (C2.at ?? 'st1')); if (j < 0) throw new Error(`body: collar on ${C2.part} names station '${C2.at}', which it does not have`);
    const id = C2.id ?? `ring.${C2.part}`; parts[id] = { ...collar(L1, C2.part, j, C2.height, C2.width), group: C2.group ?? 'Ring' }; anchors[id] = { part: C2.part, at: [P.stations[j].u ?? j, 0], side: 'R' }; }
  return { mesh, parts, anchors, stats, r };
}

// ─── the bake ───
/** a world-space closed part → a pinned layered part: offsets in its pin's frame on the rest carrier */
export function bakePart(L1, part, pin, layer = 2, { follow = false } = {}) {
  if (!L1[pin.parent]) throw new Error(`bake: ${pin.parent} is not a carrier`);
  const f = pinFrame(L1[pin.parent], pin);
  const offsets = Object.fromEntries(Object.entries(part.points).map(([k, p]) => [k, surfaceLocalOffset(f, p).map(r6)]));
  const faces = {}, groups = {}; part.faces.forEach((t, i) => { const id = `f${String(i).padStart(3, '0')}`; faces[id] = t; groups[id] = part.faceGroups ? part.faceGroups[i] : part.group; });
  return { layer, closure: 'closed', group: part.group, pin, ...(follow ? { follow: true } : {}), offsets, faces, groups };
}
/** the pin a generated part rides: its own (strips, pads, spurs) or its anchor's address on the rest carrier */
export const pinOf = (L1, name, part, anchors) => part.pin ?? (anchors[name] ? address(L1, anchors[name].part, anchors[name].at[0], anchors[name].at[1], anchors[name].side) : null);
/** BODY DATA into the recipe: the refined L1 (bind blends extended) and every detail as a pinned L2 part */
export function bakeBody(src, body) {
  const B = detailBody(src, body, {}, { binds: true }); const out = B.r; const L1 = compileLayered(out, {}, { details: false, creases: false }).parts;
  for (const [name, part] of Object.entries(B.parts)) { const pin = pinOf(L1, name, part, B.anchors); if (!pin) throw new Error(`body: ${name} has no carrier address`); out.parts[name] = bakePart(L1, part, pin, 2, { follow: true }); }
  return { recipe: out, built: B };
}

/** Error strings for BODY DATA against the recipe's L1 parts (form only; the passes judge the numbers). */
export function validateBody(body, parts) {
  const errs = []; if (!body || typeof body !== 'object' || Array.isArray(body)) return ['body: an object of passes'];
  for (const k of Object.keys(body)) if (!BODY_KEYS.includes(k) && k !== 'palette') errs.push(`body.${k}: not a pass (have ${BODY_KEYS.join(', ')})`);
  const l1 = (p) => parts[p] && (parts[p].layer ?? 1) === 1; const need = (p, where) => { if (!l1(p)) errs.push(`${where}: '${p}' is not an L1 part (have ${Object.keys(parts).filter(l1).join(', ')})`); };
  for (const [i, e] of (body.refine || []).entries()) { if (!Array.isArray(e.parts)) errs.push(`body.refine[${i}].parts: a list of part names`); else e.parts.forEach((p) => need(p, `body.refine[${i}]`)); }
  for (const [i, v] of (body.volume || []).entries()) if (!Array.isArray(v) || v.length !== 4) errs.push(`body.volume[${i}]: [part, slotWeights, stationWeights, metres]`); else need(v[0], `body.volume[${i}]`);
  for (const [i, j] of (body.creases?.joints || []).entries()) if (!Array.isArray(j) || j.length < 2) errs.push(`body.creases.joints[${i}]: [partA, partB, group?]`); else { need(j[0], `body.creases.joints[${i}]`); need(j[1], `body.creases.joints[${i}]`); }
  for (const [i, T] of (body.tiles || []).entries()) { if (!Array.isArray(T.parts) || !Array.isArray(T.s) || !Array.isArray(T.t) || !Array.isArray(T.grid) || !Array.isArray(T.group) || !Number.isFinite(T.height) || !Number.isFinite(T.inset)) errs.push(`body.tiles[${i}]: { parts, s: [s0, s1], t: [t0, t1], grid: [ns, nt], height, inset, group: [names] }`); else T.parts.forEach((p) => need(p, `body.tiles[${i}]`)); }
  for (const [i, P] of (body.pads || []).entries()) { if (!P.part || !Number.isFinite(P.s) || !Number.isFinite(P.r) || !P.toward || !(P.toward.world || P.toward.flex || P.toward.away)) errs.push(`body.pads[${i}]: { part, s, r, toward: { world } | { flex: [a, b], drive? } | { away: [a, b] } }`); else need(P.part, `body.pads[${i}]`); }
  for (const [i, S] of (body.rows || []).entries()) { if (!S.part || !Array.isArray(S.s) || !(S.step > 0)) errs.push(`body.rows[${i}]: { part, t, s: [s0, s1], step, shape?: 'spur' | 'stud', r }`); else need(S.part, `body.rows[${i}]`); }
  for (const [i, C] of (body.collars || []).entries()) { if (!C.part || !Number.isFinite(C.height)) errs.push(`body.collars[${i}]: { part, at: <station id>, height, width? }`); else need(C.part, `body.collars[${i}]`); }
  for (const [i, S] of (body.spurs || []).entries()) { if (!S.part || !Number.isFinite(S.s) || !Array.isArray(S.away)) errs.push(`body.spurs[${i}]: { part, s, away: [a, b] }`); else need(S.part, `body.spurs[${i}]`); }
  return errs;
}
