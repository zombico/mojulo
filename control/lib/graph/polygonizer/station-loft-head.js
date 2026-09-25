/**
 * station-loft-head — a detailed head as PLAN DATA (JSON), interpreted into the head the detail operators build.
 *
 * `headFromPlan(plan)` turns a head plan into the object `build` / `bakeLayered` (station-loft-detail.js) consume:
 * { recipe, skin, eye, regions, ornaments(), midline(), palette }. Nothing in a head plan is code, so an agent can
 * author a head through the ring plan (`heads: [{ name, plan, expression, shift, bind }]`) instead of wearing a baked
 * include. Species-free: every anatomy lives in the plan.
 *
 * plan = {
 *   schema: 'layered-head-v1', name?, units?: { scale, offset },   // head units → metres (absent: the plan is in metres)
 *   parts: { cranium: { slots, rows: [[id, y, { <slot>: z | [x, z] }]], caps: { back, tip }, …recipe keys }, jaw: … },
 *     // right side authored; a row's [x, z] entry writes the R slot (keyed by its base name, or by its R name when a
 *     // midline slot shares the base) and its mirror L; points are stored in slot order
 *   dials?, creases?,                                           // the base head's own (the jaw hinge …)
 *   refine?: [ { op: 'slot', part, a, b, name, f? } | { op: 'station', part, a, b, fs? } | { op: 'volumize', part, slots, stations, amount } ],
 *   skin: { slots, radius, controls: { <control>: { amp, map: [['st2.brow', w, [dx, dy, dz]]] } } },   // landmarks against the ORIGINAL slots
 *   eye, regions, palette,
 *   landmarks?: { nape: [x, y, z], … },                        // named points in the plan's units; `nape` is where it sits on a neck
 *   ornaments?: [ …per side, in order: { kind: 'sweep' | 'teeth' | 'disc', … } ],
 *   midline?: [ { kind: 'pinned', group, parts: { <name>: { pin, offsets, faces } } } ],   // pins on the UNREFINED base, migrated by address
 * }
 * Ornament kinds:
 *   sweep  { name, part?, at, space?: 'head' | 'world' (spine in head units or metres, placed through the rest frame) | 'local', spine, radii,
 *            alternate?: [even, odd], m, squash?, curl?: { control, axis: { bend: [i, j, k] } }, group, ringCreases?: 'even',
 *            ridges?: { name, rings, height: { base, step }, width, group }, side?: 'R' (one side only) }
 *   teeth  { part, from, to, t, sizes, down, tag? }             // a row of teeth rooted on the bone, sized per tooth
 *   disc   { name, part?, at, rings: [[x, r]], lift, yaw, attitude?: { control, gain }, back, front, groups, bowl?: { name, r, rim, floor, at, groups } }
 * Pure and deterministic; refusals name the field.
 */
import { compileLayered, mirrorFaceId, mirrorPid } from './station-loft.js';
import { placeSurfaceOffset, surfaceLocalOffset } from './surface-pin.js';
import { address, clone, collar, cross, dish, frameAt, loftLabels, loftParts, pinToAddress, pinned, refineSlot, refineStation, ringAt, rot, sub, add, mul, unit, sweep, symmetricFrameAt, volumize } from './station-loft-detail.js';

export const HEAD_SCHEMA = 'layered-head-v1';
const fail = (msg) => { throw new Error(`layered head: ${msg}`); };
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

/** species-neutral expression presets: control values over the regions every head declares */
export const EXPRESSIONS = {
  neutral: {},
  pant: { jawOpen: 22, tongueOut: 1, tongueCurl: -0.5, tongueSway: 0.35, browRaise: 0.3, cornerRetract: 0.5, lidClose: 0.1, earAttitude: 0.2 },
  flick: { jawOpen: 10, tongueOut: 1, tongueCurl: 0.18, tongueSway: -0.2, browFurrow: 0.4, lidClose: 0.3, nostrilFlare: 0.6 },
  surprise: { jawOpen: 9, browRaise: 1, browArch: 1, lidClose: -0.35, nostrilFlare: 0.5, cornerRetract: -0.3, earAttitude: 0.6 },
  snarl: { tongueCurl: 0.35, jawOpen: 16, browFurrow: 1, sneer: 1, cheekBunch: 0.8, cornerRetract: 0.7, nostrilFlare: 1, lidClose: 0.45, hornCurl: 0.35, earAttitude: -1, eyeGaze: [14, -6] },
};
/** an expression is a preset name or control values */
export function resolveExpression(e) { if (e == null) return {}; if (typeof e === 'string') { if (!(e in EXPRESSIONS)) fail(`expression '${e}' is not a preset (have ${Object.keys(EXPRESSIONS).join(', ')})`); return EXPRESSIONS[e]; } if (typeof e === 'object') return e; fail('expression must be a preset name or { control: value }'); }

export function validateHead(plan) {
  if (!plan || typeof plan !== 'object') fail('a head plan is an object { schema, parts, skin, eye, regions, … }');
  if (plan.schema !== HEAD_SCHEMA) fail(`schema must be '${HEAD_SCHEMA}' (got ${JSON.stringify(plan.schema)})`);
  for (const name of ['cranium', 'jaw']) { const P = plan.parts?.[name]; if (!P) fail(`parts.${name} is required`);
    if (!Array.isArray(P.slots) || P.slots.length < 4 || P.slots.length % 2) fail(`parts.${name}.slots must be an even list of at least 4 names`);
    if (!Array.isArray(P.rows) || P.rows.length < 2) fail(`parts.${name}.rows needs at least two [id, y, { slot: z | [x, z] }] rows`);
    if (!P.caps || !Array.isArray(P.caps.back) || !Array.isArray(P.caps.tip)) fail(`parts.${name}.caps needs back and tip`); }
  if (plan.units && !(plan.units.scale > 0 && isVec(plan.units.offset))) fail('units must be { scale > 0, offset: [x, y, z] }');
  if (!plan.skin || !Array.isArray(plan.skin.slots) || !(plan.skin.radius > 0) || typeof plan.skin.controls !== 'object') fail('skin needs { slots, radius, controls }');
  if (!plan.regions || !plan.regions.eye || !plan.regions.orbit) fail('regions needs at least eye and orbit');
  for (const o of plan.ornaments || []) if (!['sweep', 'teeth', 'disc'].includes(o.kind)) fail(`ornament kind '${o.kind}' is not one of sweep / teeth / disc`);
  for (const r of plan.refine || []) if (!['slot', 'station', 'volumize'].includes(r.op)) fail(`refine op '${r.op}' is not one of slot / station / volumize`);
  for (const m of plan.midline || []) if (m.kind !== 'pinned') fail(`midline kind '${m.kind}' is not 'pinned'`);
  for (const [k, v] of Object.entries(plan.landmarks || {})) if (!isVec(v)) fail(`landmark '${k}' must be [x, y, z]`);
  return true;
}

/** the base recipe from station tables: right side authored, left mirrored, points in slot order */
function baseRecipe(plan) {
  const W = plan.units ? ((p) => [p[0] * plan.units.scale + plan.units.offset[0], p[1] * plan.units.scale + plan.units.offset[1], p[2] * plan.units.scale + plan.units.offset[2]]) : (p) => p;
  const part = (spec) => { const { slots, rows, caps, ...rest } = spec; const stations = rows.map(([id, y, pts]) => { const p = {};
      for (const [slot, v] of Object.entries(pts)) { if (typeof v === 'number') { p[slot] = W([0, y, v]); continue; } const r = /R$/.test(slot) && slots.includes(slot) ? slot : `${slot}R`; p[r] = W([v[0], y, v[1]]); p[r.replace(/R$/, 'L')] = W([-v[0], y, v[1]]); }
      for (const sl of slots) if (!p[sl]) fail(`row ${id} gives no point for slot ${sl}`);
      return { id, points: Object.fromEntries(slots.map((sl) => [sl, p[sl]])) }; });
    return { layer: 1, closure: 'closed', slots: [...slots], stations, caps: { back: W(caps.back), tip: W(caps.tip) }, ...clone(rest) }; };
  return { schema: 'layered-station-head-v1', frame: { up: '+z', front: '+y' }, dials: clone(plan.dials || {}), parts: { cranium: part(plan.parts.cranium), jaw: part(plan.parts.jaw) }, creases: clone(plan.creases || {}) };
}
/** skin maps authored by landmark name, compiled to addresses with a falloff radius against the ORIGINAL slots */
function addressMaps({ slots, radius, controls }) { return Object.fromEntries(Object.entries(controls).map(([k, c]) => [k, { ...c, map: c.map.map(([pt, w, dir]) => {
  const [st, sl] = pt.split('.'); const t = slots.indexOf(`${sl}R`) >= 0 ? slots.indexOf(`${sl}R`) : slots.indexOf(sl); if (t < 0) fail(`skin landmark ${pt} names no slot`);
  return { at: [Number(st.slice(2)), t], r: radius, w, dir }; }) }])); }

/** a row of teeth: each a small tapered loft rooted on the bone, aimed `down` in the carrier's right frame */
function teethRow(L1, { part, from, to, t, sizes, down, tag = '' }, side) { const out = {}; const count = sizes.length;
  for (let i = 0; i < count; i++) { const s = from + (to - from) * i / (count - 1); const f = frameAt(L1, part, [s, t], 'R'); const len = sizes[i];
    const ax = unit(surfaceLocalOffset(f, add(f.origin, add(mul(down, len), [0, -0.2 * len, 0])))); const k = cross([0, 0, 1], ax); const ang = Math.acos(Math.max(-1, Math.min(1, ax[2])));
    const m = loftParts([[0, 0, -0.006], [0, 0, len * 0.35], [0, 0, len * 0.7]].map((p, j) => ringAt(p, [0, 0, 1], [0.011, 0.009, 0.005][j] * Math.min(1, len / 0.04 + 0.3), 4, Math.PI / 4)), [0, 0, -0.012], [0, 0, len]);
    out[`tooth${tag}${part === 'jaw' ? 'L' : 'U'}.${i}`] = pinned(L1, part, [s, t], side, { ...m, points: Object.fromEntries(Object.entries(m.points).map(([q, p]) => [q, Math.hypot(...k) > 1e-9 ? rot(p, unit(k), ang) : p])) }, 'Teeth'); }
  return out; }

function ornamentsOf(plan, W) { const list = plan.ornaments || [];
  return ({ bone, rest, side, x, ctl }) => { const out = {};
    for (const o of list) {
      const part = o.part || 'cranium';
      if (o.kind === 'teeth') Object.assign(out, teethRow(bone, o, side));
      else if (o.kind === 'sweep') { if (o.side && o.side !== side) continue;
        let spine = o.spine; if (o.space === 'head' || o.space === 'world') { const f = frameAt(rest, part, o.at, 'R'); spine = o.spine.map((p) => surfaceLocalOffset(f, o.space === 'head' ? W(p) : p)); }
        const radii = o.alternate ? o.radii.map((v, j) => v * o.alternate[j % 2]) : o.radii; const opts = {};
        if (o.curl) { opts.curl = x[o.curl.control] || 0; const [i, j, k] = o.curl.axis.bend; opts.curlAxis = cross(sub(spine[j], spine[i]), sub(spine[k], spine[j])); }
        if (o.squash) opts.squash = o.squash;
        const mesh = sweep(spine, radii, o.m, opts); const extra = o.ringCreases === 'even' ? { creases: mesh.rings.filter((_, j) => j % 2 === 0 && j > 0).flatMap((rr) => rr.map((a, i) => [a, rr[(i + 1) % rr.length]])) } : {};
        out[o.name] = pinned(bone, part, o.at, o.side || side, mesh, o.group, extra);
        if (o.ridges) for (const j of o.ridges.rings) out[`${o.ridges.name}${j}`] = pinned(bone, part, o.at, side, collar(mesh, j, o.ridges.height.base + o.ridges.height.step * j, o.ridges.width), o.ridges.group); }
      else if (o.kind === 'disc') { const a = o.attitude ? o.attitude.gain * ctl(o.attitude.control) : 0; const tilt = (p) => rot(rot(p, [0, 0, 1], o.yaw), [0, 1, 0], -a);
        const disc = loftParts(o.rings.map(([x0, r]) => ringAt([x0, 0, o.lift], [1, 0, 0], r, 10).map(tilt)), tilt([o.back, 0, o.lift]), tilt([o.front, 0, o.lift]));
        out[o.name] = { ...pinned(bone, part, o.at, side, disc, o.groups[0]), faceGroups: loftLabels(disc, () => o.groups[0], o.groups) };
        if (o.bowl) { const b = dish({ r: o.bowl.r, rim: o.bowl.rim, floor: o.bowl.floor }, ([p, q, z]) => tilt([o.bowl.at + z, p, o.lift + q]), o.bowl.groups);
          out[o.bowl.name] = { ...pinned(bone, part, o.at, side, b, o.bowl.groups[0]), faceGroups: b.faceGroups }; } }
    }
    return out; }; }

function midlineOf(plan, L1u) { const list = plan.midline || []; if (!list.length) return undefined;
  return ({ bone }) => { const out = {};
    for (const m of list) for (const [name, p] of Object.entries(m.parts)) {
      const { at, flip } = pinToAddress(L1u[p.pin.parent], p.pin); const host = p.pin.parent; const f = symmetricFrameAt(bone, host, at);
      const pr = address(bone, host, at[0], at[1], 'R'); const n = bone[host].slots.length; const pin = { ...pr, mirror: { face: mirrorFaceId(pr.face, n), tangentEdge: pr.tangentEdge.map(mirrorPid) } };   // the grammar's symmetric pin
      out[name] = { group: m.group, creases: [], pin, points: Object.fromEntries(Object.entries(p.offsets).map(([k, o]) => [k, placeSurfaceOffset(f, flip ? [-o[0], -o[1], o[2]] : o)])), faces: Object.values(p.faces) }; }
    return out; }; }

/** the head `build` consumes, from a head plan */
export function headFromPlan(plan) {
  validateHead(plan);
  const W = plan.units ? ((p) => [p[0] * plan.units.scale + plan.units.offset[0], p[1] * plan.units.scale + plan.units.offset[1], p[2] * plan.units.scale + plan.units.offset[2]]) : (p) => p;
  const recipe = baseRecipe(plan); const L1u = compileLayered(recipe, {}, { details: false, creases: false }).parts;   // the unrefined base, for migrating face pins
  for (const r of plan.refine || []) {
    if (r.op === 'slot') refineSlot(recipe, r.part, r.a, r.b, r.name, r.f ?? 0.5);
    else if (r.op === 'station') refineStation(recipe, r.part, r.a, r.b, r.fs ?? [0.5]);
    else volumize(recipe, r.part, r.slots, r.stations, r.amount); }
  const head = { recipe, skin: addressMaps(plan.skin), eye: clone(plan.eye || {}), regions: clone(plan.regions), ornaments: ornamentsOf(plan, W), palette: clone(plan.palette || {}),
    landmarks: Object.fromEntries(Object.entries(plan.landmarks || {}).map(([k, v]) => [k, W(v)])) };
  const midline = midlineOf(plan, L1u); if (midline) head.midline = midline;
  return head;
}

/** point in a closed part: ray parity along a skewed direction (no axis-aligned degeneracies) */
export function insidePart(P, q) { const d = [0.8726, 0.3313, 0.3589]; let c = 0;
  for (const f of Object.values(P.faces)) { const [A, B, C] = f.map((k) => P.points[k]); const e1 = sub(B, A), e2 = sub(C, A); const p = cross(d, e2); const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2]; if (Math.abs(det) < 1e-14) continue;
    const tv = sub(q, A); const u = (tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]) / det; if (u < 0 || u > 1) continue; const qq = cross(tv, e1); const v = (d[0] * qq[0] + d[1] * qq[1] + d[2] * qq[2]) / det; if (v < 0 || u + v > 1) continue;
    if ((e2[0] * qq[0] + e2[1] * qq[1] + e2[2] * qq[2]) / det > 0) c++; }
  return c % 2 === 1; }
/** the SEAM between a neck and the head worn on it: every point of the neck's last ring and its tip cap must be buried
 * inside the head's L1 parts, so no gap can show at any angle. Measured on the compiled mesh (any dials). */
export function headSeam(mesh, { neck, head = ['cranium', 'jaw'] }) { const N = mesh.parts[neck]; if (!N) fail(`seam: no part '${neck}'`);
  const last = N.stations[N.stations.length - 1].id; const ring = [...N.slots.map((sl) => N.points[`${neck}/${last}.${sl}`]), N.points[`${neck}/tip`]].filter(Boolean);
  const inside = ring.filter((q) => head.some((h) => mesh.parts[h] && insidePart(mesh.parts[h], q))).length; return { points: ring.length, inside, sealed: inside === ring.length }; }
