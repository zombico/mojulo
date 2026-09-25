/** body-detail/body-detail.mjs — the head's detail principles on the dragon body's segments, as a post-compile
 * layer over the dragon body recipe, through the core detail operators (station-loft-detail.js).
 *   node body-detail.mjs      → body-detail.png (rest / posed, before / after) + stats.json in the spike tree
 * Species-free passes (BODY DATA at the bottom names the anatomy):
 *   density   refine joint zones (stations) and limb rings (slots); claw pins migrated by address
 *   volume    volumize by name (chest, biceps, thigh)
 *   creases   per joint: rows either side of the bend, one strip per ring quadrant, height ∝ how much that
 *             quadrant faces the INSIDE of the bend × the bend angle, both read from the compiled mesh
 *   rigid     tiles/spines/collars only where the dominant bone's bind weight ≥ RIGID over the footprint
 *   pads      dishes on the side a joint's bend faces (palm) or the ground faces (sole)
 *   spurs     sweeps on the outside of a bend, in the rigid zone
 *   spines    a dorsal row on symmetric midline frames
 *   collars   tail rings at the rigid mid-station */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const CORE = new URL('../../../control/lib/graph/polygonizer/', import.meta.url).href;
const { compileLayered } = await import(`${CORE}station-loft.js`);
const D = await import(`${CORE}station-loft-detail.js`);
const { placeSurfaceOffset } = await import(`${CORE}surface-pin.js`);
const { mulberry32 } = await import(`${CORE}floorplan-glyphs.js`);
const { orbitCamera, projectVertices } = await import(new URL('../../../control/lib/graph/scene/wire-svg.js', import.meta.url).href);
const { address, frameAt, strip, sweep, loftParts, loftLabels, pinned, refineStation, refineSlot, volumize, pinToAddress, symmetricFrameAt, ringAt, clone, vec } = D;
const { sub, add, mul, dot, cross, unit, mean } = vec;
const OUT = () => { const o = resolve(process.env.MOJULO_SPIKE_OUT || fileURLToPath(new URL('../../../lite-template/integration/0924/spike-output/body-detail/', import.meta.url))); mkdirSync(o, { recursive: true }); return o; };
const RECIPE = JSON.parse(readFileSync(new URL('../dragon-body/recipe.json', import.meta.url), 'utf8'));
const RIGID = 0.8;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mirrorName = (n) => n.replace(/([RL])$/, (m) => (m === 'R' ? 'L' : 'R'));
const both = (names) => names.flatMap((n) => (/[RL]$/.test(n) ? [n, mirrorName(n)] : [n]));

// ═══════════ CORE (species-free) ═══════════
/** dominant bind weight along s, from a part's bind (ORIGINAL station ids st<i> at u = i; unlisted stations are the part's own bone) */
function dominance(part) { const b = part.bind; const n = part.stations.length;
  const at = (i) => b?.blend?.[`st${i}`] ?? { [b?.bone ?? 'self']: 1 };
  return (s) => { const i = clamp(Math.floor(s), 0, n - 2), f = clamp(s - i, 0, 1); const A = at(i), B = at(i + 1); const bones = new Set([...Object.keys(A), ...Object.keys(B)]);
    let best = 0, bone = null; for (const k of bones) { const w = (A[k] ?? 0) * (1 - f) + (B[k] ?? 0) * f; if (w > best) { best = w; bone = k; } } return { w: best, bone }; }; }
/** refine a part's stations everywhere (joint zones included) and its ring slots; extend dial blends by u */
function densify(r, part, { stations = true, slots = true } = {}) {
  if (stations) { const ids = r.parts[part].stations.map((s) => s.id); for (let i = 0; i + 1 < ids.length; i++) refineStation(r, part, ids[i], ids[i + 1]); }
  if (slots) { refineSlot(r, part, 'front', 'front', 'fq'); refineSlot(r, part, 'front', 'backR', 'mid'); refineSlot(r, part, 'back', 'back', 'bq'); }
}
function extendBlends(r) { for (const d of Object.values(r.dials)) { if (!d.blend) continue; for (const pn of d.parts || []) { const P = r.parts[pn]; if (!P) continue;
  for (const st of P.stations) { if (d.blend[st.id] !== undefined || st.u === undefined || Number.isInteger(st.u)) continue; const t = st.u - Math.floor(st.u);
    d.blend[st.id] = (d.blend[`st${Math.floor(st.u)}`] ?? 0) * (1 - t) + (d.blend[`st${Math.ceil(st.u)}`] ?? 0) * t; } } } }
/** re-pin L2 parts whose parent was refined: face pin → (s,t) on the unrefined carrier → face pin on the refined one */
function migratePins(before, after, r, refined) { const L1u = compileLayered(before, {}, { details: false, creases: false }).parts, L1r = compileLayered(r, {}, { details: false, creases: false }).parts;
  for (const [name, P] of Object.entries(r.parts)) { if (!P.pin || !refined.has(P.pin.parent)) continue; const { at, flip } = pinToAddress(L1u[P.pin.parent], P.pin);
    P.pin = address(L1r, P.pin.parent, at[0], at[1], P.pin.handedness === -1 ? 'L' : 'R'); if (flip) P.offsets = Object.fromEntries(Object.entries(P.offsets).map(([k, o]) => [k, [-o[0], -o[1], o[2]]])); } }
const H = (P) => P.slotT ? Math.max(...Object.values(P.slotT)) : P.slots.length / 2;
const sMax = (P) => { const s = P.stations[P.stations.length - 1]; return s.u ?? P.stations.length - 1; };
const ringCentre = (L1, p, st) => mean(L1[p].slots.map((sl) => L1[p].points[`${p}/${st}.${sl}`]));
const radius = (L1, p) => { const P = L1[p], st = P.stations[Math.floor(P.stations.length / 2)].id, c = ringCentre(L1, p, st); return mean(P.slots.map((sl) => [Math.hypot(...sub(P.points[`${p}/${st}.${sl}`], c))]))[0]; };
/** a joint's bend, read from the compiled mesh: angle between the two segments' axes, and the INSIDE (concave) direction */
function bend(L1, a, b) { const ax = (p) => { const S = L1[p].stations; return unit(sub(ringCentre(L1, p, S[S.length - 1].id), ringCentre(L1, p, S[0].id))); };
  const dA = ax(a), dB = ax(b); const ang = Math.acos(clamp(dot(dA, dB), -1, 1)); return { ang, inside: ang > 1e-4 ? unit(sub(dB, dA)) : [0, 0, 0] }; }
/** the address on part p at station s whose surface faces `dir` best (both ring halves scanned) */
function facing(L1, p, s, dir) { const h = H(L1[p]); let best = null; for (const side of ['R', 'L']) for (let t = 0; t <= h + 1e-9; t += h / 12) { const n = frameAt(L1, p, [s, t], side).normal; const d = dot(n, dir); if (!best || d > best.d) best = { d, at: [s, t], side }; } return best; }
/** BEND CREASES: rows either side of a joint; each row is one strip per ring quadrant per half; a strip rises
 * with (how much it faces the inside of the bend) × (the bend angle / 90°). Always emitted: the set is fixed. */
function creases(L1, a, b, id) { const { ang, inside } = bend(L1, a, b); const out = {}; const k = Math.min(1, ang / (Math.PI / 2));
  for (const [p, s] of [[a, sMax(L1[a]) - 0.3], [b, 0.3]]) { const h = H(L1[p]), R = radius(L1, p);
    for (const side of ['R', 'L']) for (const [q0, q1] of [[0, h / 2], [h / 2, h]]) { const addrs = [0.15, 0.5, 0.85].map((f) => [s, q0 + (q1 - q0) * f]);
      const face = Math.max(0, dot(frameAt(L1, p, addrs[1], side).normal, inside)); const lift = 0.3 * R * Math.max(0.04, face * k), w = 0.08 * R;
      const m = strip(L1, p, addrs, side, (j) => { const tp = Math.sin(Math.PI * (j + 0.5) / 3); return [[-w * tp, -0.002], [0, lift * tp], [w * tp, -0.002], [0, -0.004]]; });
      out[`${id}.${p}.${side}${q0 ? 'b' : 'f'}`] = { ...m, group: 'Crease' }; } }
  return out; }
/** TILES with a RIGID gate: a tile grows only if its whole footprint sits where one bone dominates (≥ RIGID) */
function rigidTiles(L1, name, side, T, idBase, dom, keep = []) {
  const out = {}; const [s0, s1] = T.s, [t0, t1] = T.t, [ns, nt] = T.grid; const ds = (s1 - s0) / ns, dt = (t1 - t0) / nt; let gated = 0;
  const sides = T.sides ?? 4, cover = T.coverage ?? 0.9, fade = T.edgeFade ?? 0; const cS = (v) => clamp(v, s0, s1), cT = (v) => clamp(v, t0, t1);
  const hash = (str) => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
  for (let j = 0; j < nt; j++) { const off = T.brick && j % 2 ? 0.5 : 0;
    for (let i = 0; i < ns; i++) { if (s0 + (i + off + 1) * ds > s1 + 1e-9) continue; const id = `${idBase}.${i}.${j}`; const rng = mulberry32(hash(id)); const [r1, r2, r3, r4] = [rng(), rng(), rng(), rng()];
      const sc = s0 + (i + off + 0.5 + (T.wobble ?? 0) * (r1 - 0.5)) * ds, tc = t0 + (j + 0.5 + (T.wobble ?? 0) * (r2 - 0.5)) * dt;
      const ring = Array.from({ length: sides }, (_, k) => { const a = 2 * Math.PI * k / sides + Math.PI / sides; return [cS(sc + Math.cos(a) * ds / 2 * cover), cT(tc + Math.sin(a) * dt / 2 * cover)]; });
      const bones = new Set(ring.map(([s]) => dom(s).bone)); if (bones.size > 1 || ring.some(([s]) => dom(s).w < RIGID)) { gated++; continue; }   // rigid-on-rigid
      let edge = fade > 0 ? Math.min(1, Math.min(sc - s0, s1 - sc) / (fade * (s1 - s0)), Math.min(tc - t0, t1 - tc) / (fade * (t1 - t0))) : 1;
      const F0 = frameAt(L1, name, [sc, tc], side); const n = F0.normal, c = F0.origin;
      const room = Math.min(Infinity, ...keep.map((z) => Math.hypot(...sub(c, z.p)) - z.r)); if (room <= 0 || r4 < (T.thin ?? 0) * (1 - Math.min(1, edge))) continue; edge = Math.min(edge, room / 0.02);
      const O = ring.map((a) => frameAt(L1, name, a, side).origin); const along = unit(sub(frameAt(L1, name, [cS(sc + ds / 4), tc], side).origin, frameAt(L1, name, [cS(sc - ds / 4), tc], side).origin));
      const h = T.height * (1 + (T.jitter ?? 0) * (2 * r3 - 1)) * (0.2 + 0.8 * Math.max(0, edge)); const lean = (T.lean ?? 0) * h;
      const base = O.map((o) => sub(o, mul(n, 0.002))); const top = O.map((o) => add(add(add(c, mul(sub(o, c), 1 - T.inset)), mul(n, h)), mul(along, lean)));
      out[id] = { ...loftParts([base, top], sub(c, mul(n, 0.004)), add(mean(top), mul(n, h * 0.2))), group: T.group[(i + j) % T.group.length], bone: dom(sc).bone, rigidW: Math.min(...ring.map(([s]) => dom(s).w)) }; } }
  return { tiles: out, gated }; }
/** COLLAR round station j of a compiled part (rings read from its named points) */
function collar(L1, p, j, height, width = 0.35) { const P = L1[p]; const ring = (i) => P.slots.map((sl) => P.points[`${p}/${P.stations[i].id}.${sl}`]);
  const R = ring(j), c = mean(R), prev = mean(ring(Math.max(0, j - 1))), next = mean(ring(Math.min(P.stations.length - 1, j + 1)));
  const ax = unit(sub(next, prev)), half = width * Math.hypot(...sub(next, prev)) / 2; const at = (d, s) => R.map((q) => add(add(c, mul(sub(q, c), s)), mul(ax, d)));
  return loftParts([at(-half, 0.97), at(0, 1 + height), at(half, 0.97)], add(c, mul(ax, -half * 1.3)), add(c, mul(ax, half * 1.3))); }
function dish({ r, rim, floor, m = 10 }, [outer, inner] = ['Pad', 'PadInner']) { const ring = (rr, z) => ringAt([0, 0, z], [0, 0, 1], rr, m);
  const mesh = loftParts([ring(r * 1.08, -0.001), ring(r, rim), ring(r * 0.62, floor)], [0, 0, -0.004], [0, 0, floor * 0.8]); return { ...mesh, faceGroups: loftLabels(mesh, (j) => (j === 0 ? outer : inner), [outer, inner]) }; }
/** SPUR: a sweep out of the surface, raked back toward the parent (−tangent), sized by the segment radius */
function spur(R, rake = 1) { const L = 1.1 * R; return sweep([[0, 0, -0.2 * R], [-0.25 * L * rake, 0, 0.35 * L], [-0.6 * L * rake, 0, 0.65 * L], [-1.0 * L * rake, 0, 0.8 * L]], [0.28 * R, 0.18 * R, 0.08 * R], 5); }

// ═══════════ BODY DATA (the dragon body; species lives here) ═══════════
const FINGERS = ['A', 'B', 'C'];
const LIMB_PARTS = both(['upperArmR', 'foreArmR', 'handR', 'thighR', 'shinR', 'metaR', 'toesR', ...FINGERS.flatMap((X) => [`finger${X}1R`, `finger${X}2R`])]);
const TAIL = [0, 1, 2, 3, 4].map((i) => `tail${i}`);
const JOINTS = [['pelvis', 'torso'], ['torso', 'neck'], ...TAIL.slice(1).map((t, i) => [TAIL[i], t]),
  ...['R', 'L'].flatMap((S) => [[`upperArm${S}`, `foreArm${S}`], [`foreArm${S}`, `hand${S}`], [`thigh${S}`, `shin${S}`], [`shin${S}`, `meta${S}`], [`meta${S}`, `toes${S}`],
    ...FINGERS.flatMap((X) => [[`hand${S}`, `finger${X}1${S}`], [`finger${X}1${S}`, `finger${X}2${S}`]])])];
const TILES = [
  // belly scutes: one wide column each side of the ventral midline (torso `front` faces +y), shingled downward
  { parts: ['torso'], s: [0.1, 3.9], t: [0, 0.95], grid: [10, 1], sides: 4, coverage: 1.02, inset: 0.1, height: 0.016, lean: -0.5, group: ['Scute', 'ScuteAlt'] },
  { parts: ['pelvis'], s: [0.1, 1.9], t: [0, 0.95], grid: [5, 1], sides: 4, coverage: 1.02, inset: 0.1, height: 0.016, lean: -0.5, group: ['Scute', 'ScuteAlt'] },
  // tail underside scutes (tail `front` faces down)
  { parts: TAIL, s: [0.05, 1.95], t: [0, 0.7], grid: [4, 1], sides: 4, coverage: 1.02, inset: 0.12, height: 0.012, lean: 0.5, group: ['Scute', 'ScuteAlt'] },
  // hex scales on the outer forearm, shin and thigh; plates on the shoulder
  { parts: ['foreArmR', 'foreArmL'], s: [0.2, 1.8], t: [0.9, 3], grid: [6, 3], brick: true, sides: 6, coverage: 1.2, inset: 0.35, height: 0.008, lean: -0.8, thin: 0.4, wobble: 0.2, jitter: 0.3, edgeFade: 0.2, group: ['Scales', 'ScalesAlt'] },
  { parts: ['shinR', 'shinL'], s: [0.2, 1.8], t: [0.6, 2.6], grid: [6, 3], brick: true, sides: 6, coverage: 1.2, inset: 0.35, height: 0.008, lean: -0.8, thin: 0.4, wobble: 0.2, jitter: 0.3, edgeFade: 0.2, group: ['Scales', 'ScalesAlt'] },
  { parts: ['thighR', 'thighL'], s: [0.3, 1.7], t: [1.0, 2.4], grid: [4, 2], brick: true, sides: 6, coverage: 1.15, inset: 0.3, height: 0.012, lean: -0.6, wobble: 0.15, jitter: 0.2, edgeFade: 0.2, group: ['Plates'] },
  { parts: ['upperArmR', 'upperArmL'], s: [0.3, 1.7], t: [0.9, 2.3], grid: [3, 2], brick: true, sides: 6, coverage: 1.2, inset: 0.3, height: 0.014, lean: -0.7, wobble: 0.1, group: ['Plates'] },
];
const VOLUME = [ // [part, slots, stations, metres]
  ['torso', { 'front*': 0.8, 'side*': 0.4 }, { st3: 1, st2: 0.4 }, 0.045],                   // pectorals
  ...['R', 'L'].flatMap((S) => [[`upperArm${S}`, { front: 1, 'front*': 0.6 }, { st1: 1 }, 0.03],    // biceps
    [`thigh${S}`, { front: 1, 'front*': 0.7 }, { st1: 1, st0: 0.3 }, 0.035],                           // quadriceps
    [`shin${S}`, { back: 1, 'back*': 0.6 }, { st0: 0.6, st1: 1 }, 0.025]])];                          // calf
const PADS = [ // palm: the inside of the knuckle bend; soles and fingertips: the ground / grip side
  ...['R', 'L'].flatMap((S) => [{ part: `hand${S}`, s: 1.3, toward: { flex: [`hand${S}`, `fingerB1${S}`], drive: { grip: 45 } }, r: 0.5 },
    { part: `toes${S}`, s: 1.0, toward: { world: [0, 0, -1] }, r: 0.55 }, { part: `meta${S}`, s: 1.2, toward: { world: [0, 0, -1] }, r: 0.5 },
    ...FINGERS.map((X) => ({ part: `finger${X}2${S}`, s: 1.0, toward: { flex: [`finger${X}1${S}`, `finger${X}2${S}`], drive: { grip: 45 } }, r: 0.6 }))])];
const SPURS = ['R', 'L'].flatMap((S) => [{ part: `foreArm${S}`, s: 0.62, away: [`upperArm${S}`, `foreArm${S}`] }, { part: `meta${S}`, s: 0.62, away: [`shin${S}`, `meta${S}`] }]);
const SPINES = [{ part: 'torso', t: 'back', s: [1.9, 3.5], step: 0.3, r: 0.07, rake: 1 }, ...TAIL.map((p) => ({ part: p, t: 'back', s: [0.6, 1.4], step: 0.4, size: 0.55, rake: -1 }))];
const COLLARS = TAIL.map((p) => ({ part: p, at: 'mid', height: 0.07 }));
const PALETTE = { Crease: '#34402d', Scute: '#b8b08a', ScuteAlt: '#aea57f', Scales: '#56664b', ScalesAlt: '#617257', Plates: '#6d7d60', Pad: '#4d5a44', PadInner: '#3a3530', Spur: '#e3dcc6', Spine: '#cfc5a6', Ring: '#5d6e52' };

// ═══════════ build ═══════════
function detailRecipe(src) { const r = clone(src); for (const [p, sw, stw, amt] of VOLUME) volumize(r, p, sw, stw, amt);
  const refined0 = [...LIMB_PARTS, ...TAIL, 'torso']; for (const p of refined0) D.freezeParams(r.parts[p]); const before = clone(r); const refined = new Set([...LIMB_PARTS, ...TAIL, 'torso']); for (const p of refined) densify(r, p, { slots: p !== 'torso' }); extendBlends(r); migratePins(before, r, r, refined); return r; }
function build(src, dials = {}, detail = true) {
  const r = detail ? detailRecipe(src) : src; const mesh = compileLayered(r, dials); const L1 = mesh.parts; const parts = {}; const stats = { gatedTiles: 0 };
  if (!detail) return { mesh, parts, stats, r };
  for (const [a, b] of JOINTS) Object.assign(parts, creases(L1, a, b, `crease.${a}-${b}`));
  const keep = [];
  // a pad faces the ground, or the side its joint FLEXES toward: the bend read at the drive's extreme, turned into an
  // address there (addresses are pose-free), then pinned on the current carrier
  const flexed = {}; const atDrive = (d) => (flexed[JSON.stringify(d)] ??= compileLayered(r, { ...dials, ...d }, { details: false, creases: false }).parts);
  for (const P of PADS) { const L = P.toward.world ? L1 : atDrive(P.toward.drive); const dir = P.toward.world || bend(L, ...P.toward.flex).inside; const f = facing(L, P.part, P.s, dir); const R = radius(L1, P.part);
    parts[`pad.${P.part}`] = { ...pinned(L1, P.part, f.at, f.side, dish({ r: P.r * R, rim: 0.12 * R, floor: 0.05 * R })), group: 'Pad' }; keep.push({ p: frameAt(L1, P.part, f.at, f.side).origin, r: P.r * R * 1.2 }); }
  for (const S of SPURS) { const { inside } = bend(L1, ...S.away); const f = facing(L1, S.part, S.s, mul(inside, -1)); const R = radius(L1, S.part);
    parts[`spur.${S.part}`] = { ...pinned(L1, S.part, f.at, f.side, spur(R)), group: 'Spur' }; keep.push({ p: frameAt(L1, S.part, f.at, f.side).origin, r: 0.5 * R }); }
  for (const T of TILES) for (const p of T.parts) { const dom = dominance(src.parts[p]); for (const side of ['R', 'L']) { const { tiles, gated } = rigidTiles(L1, p, side, T, `tile.${p}.${side}`, dom, keep); Object.assign(parts, tiles); stats.gatedTiles += gated; } }
  for (const S of SPINES) { const P = L1[S.part], dom = dominance(src.parts[S.part]); const t = P.slotT?.[S.t] ?? H(P); const R = radius(L1, S.part);
    for (let s = S.s[0], i = 0; s <= S.s[1] + 1e-9; s += S.step, i++) { if (dom(s).w < RIGID) continue; const f = symmetricFrameAt(L1, S.part, [s, t]); const m = spur(S.r ?? R * S.size, S.rake);
      parts[`spine.${S.part}.${i}`] = { group: 'Spine', points: Object.fromEntries(Object.entries(m.points).map(([k, o]) => [k, placeSurfaceOffset(f, o)])), faces: m.faces }; } }
  for (const C of COLLARS) { const P = L1[C.part]; const j = P.stations.findIndex((s) => s.id === 'st1'); parts[`ring.${C.part}`] = { ...collar(L1, C.part, j, C.height), group: 'Ring' }; }
  return { mesh, parts, stats, r };
}

// ═══════════ source, audit, raster ═══════════
function toSource({ mesh, parts }, palette) { const V = [...mesh.vertices], F = [...mesh.faces], C = []; let open = 0, wind = 0;
  const tintOf = Object.fromEntries(Object.entries(mesh.parts).map(([k, p]) => [k, p.tint])); const pal = { ...(RECIPE.palette || {}), ...palette };
  mesh.faces.forEach((f, i) => C.push(pal[mesh.groups[i]] || tintOf[mesh.provenance[f[0]].part] || '#8a8f96'));
  for (const d of Object.values(parts)) { const idx = {}; for (const [k, p] of Object.entries(d.points)) { idx[k] = V.length; V.push(p); } const fg = d.faceGroups;
    d.faces.forEach((f, i) => { F.push(f.map((k) => idx[k])); C.push(pal[fg ? fg[i] : d.group] || '#ff00ff'); });
    const E = new Map(); for (const f of d.faces) for (let i = 0; i < 3; i++) { const a = f[i], b = f[(i + 1) % 3]; const key = a < b ? `${a}|${b}` : `${b}|${a}`; const e = E.get(key) || [0, 0]; e[0]++; e[1] += a < b ? 1 : -1; E.set(key, e); }
    for (const [c, bal] of E.values()) { if (c !== 2) open++; else if (bal) wind++; } }
  return { vertices: V, faces: F, colors: C, audit: { detailParts: Object.keys(parts).length, open, wind } }; }
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const LIGHT = unit([0.35, -0.55, 0.75]); const BG = [247, 245, 239];
function raster(src, cam, size, ss = 2) { const P = projectVertices(src.vertices, cam); const N = size * ss; const img = new Uint8Array(N * N * 3); const zb = new Float64Array(N * N).fill(Infinity);
  for (let i = 0; i < N * N; i++) img.set(BG, 3 * i);
  src.faces.forEach((f, fi) => { const [a, b, c] = f.map((k) => src.vertices[k]); const k = 0.5 + 0.55 * Math.max(0, dot(unit(cross(sub(b, a), sub(c, a))), LIGHT)); const col = hex(src.colors[fi]).map((x) => Math.min(255, Math.round(x * k)));
    const [[ax, ay, az], [bx, by, bz], [cx, cy, cz]] = f.map((v) => [P[v][0] * ss, P[v][1] * ss, P[v][2]]); const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-12) return;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(N - 1, Math.ceil(Math.max(ax, bx, cx))), y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(N - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const px = x + 0.5, py = y + 0.5; const w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den, w2 = 1 - w0 - w1;
      if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue; const z = 1 / (w0 / az + w1 / bz + w2 / cz); const idx = y * N + x; if (z < zb[idx]) { zb[idx] = z; img.set(col, 3 * idx); } } });
  const M = size, out = new Uint8Array(M * M * 3); for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) for (let ch = 0; ch < 3; ch++) { let t = 0; for (let dy = 0; dy < ss; dy++) for (let dx = 0; dx < ss; dx++) t += img[3 * ((y * ss + dy) * N + x * ss + dx) + ch]; out[3 * (y * M + x) + ch] = Math.round(t / (ss * ss)); }
  return out; }
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function png(rgb, w, h) { const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); }
function sheet(cells, cols, size) { const rows = Math.ceil(cells.length / cols); const W = cols * size, out = new Uint8Array(W * rows * size * 3).fill(BG[0]);
  cells.forEach((c, i) => { const ox = (i % cols) * size, oy = Math.floor(i / cols) * size; for (let y = 0; y < size; y++) out.set(c.subarray(y * size * 3, (y + 1) * size * 3), 3 * ((oy + y) * W + ox)); }); return png(out, W, rows * size); }

export { build, toSource, bend, dominance, facing, RECIPE, PALETTE, JOINTS, RIGID };
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const t0 = Date.now(); const poses = { rest: {}, grip: { grip: 45, tailCurl: 20, lean: 15 } };
  const S = 520; const views = [['front34', 150, 8, [0, 0.1, 1.3], 3.9], ['side', 90, 5, [0, -0.3, 1.1], 5.0], ['back34', 330, 12, [0, -0.3, 1.3], 3.9], ['hand', 120, -5, [0.66, 0.35, 0.72], 1.3], ['foot', 110, 10, [0.32, 0.1, 0.25], 1.4], ['tail', 250, 25, [0, -1.1, 0.7], 2.6]];
  const stats = {}; const cells = [];
  for (const [pname, dials] of Object.entries(poses)) for (const detail of [false, true]) { const B = build(RECIPE, dials, detail); const src = toSource(B, PALETTE);
    stats[`${pname}-${detail ? 'after' : 'before'}`] = { faces: src.faces.length, ...src.audit, gatedTiles: B.stats.gatedTiles };
    for (const [, az, el, tgt, dist] of views) cells.push(raster(src, orbitCamera({ azimuthDegrees: az, elevationDegrees: el, target: tgt, distance: dist, focalPixels: 1200, size: S }), S)); }
  // rows: rest-before, rest-after, grip-before, grip-after; columns: views
  writeFileSync(`${OUT()}/body-detail.png`, sheet(cells, views.length, S)); writeFileSync(`${OUT()}/stats.json`, JSON.stringify(stats, null, 1));
  console.log(JSON.stringify(stats), `${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
