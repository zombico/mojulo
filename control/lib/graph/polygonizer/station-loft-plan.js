/**
 * station-loft-plan — the RING PLAN: the compact, species-free authoring form of a layered recipe.
 *
 * A layered recipe is coordinates (every ring point of every part, every detail's offsets). A plan is
 * what the seed scripts wrote by hand to produce those coordinates: a joint table, segments along the
 * joints with ring radii, details placed on faces, and the dials / rig / clips as data. `expandPlan`
 * turns a plan into a recipe deterministically; the recipe stays the compatibility promise (compileLayered
 * is untouched), the plan is the authoring record stored beside it.
 *
 * plan = {
 *   schema: 'layered-plan-v1',
 *   frame: { up: '+z', front: '+y', note? },  symmetry?: { plane, policy },
 *   slotFamilies?: { <name>: [slots] },                       // over the built-ins: ring6, ring8, ring10, ring12, limb6
 *   style?: { slots?, limbSlots?, e? },                        // the ART STYLE: the ring family of every trunk (`slots`),
 *                                                              //   of every segment and chain (`limbSlots`), and the superellipse
 *                                                              //   exponent of every ring that names none (2 round … 12 box)
 *   joints: { <name>: [x, y, z] },                             // authored on the RIGHT (or the midline)
 *   segments: [                                                // L1 parts, in recipe order
 *     { name, kind: 'trunk',   slots?, stations: [{ z, r, yc?, e? }], caps: { back, tip }, group, tint, mirror: 'plane' },
 *     { name, kind: 'segment', from, to, rA, rB, slots?, e?, over?, mid?, rMid?, group, tint, mirror: 'plane' | 'name' | null, bind? },
 *     { name, kind: 'chain',   joints: [names], r: [radii], over: { first, last, inner }, group, tint, mirror: 'plane', bind? },
 *     { name, kind: 'loft',    stations: [{ at: [x, y, z], r, e? }], caps?: { back, tip }, slots?, e?, group, tint, mirror: 'plane' | 'name' | null, bind? },
 *       // explicit stations along a polyline, each ring ⟂ the local direction: a thigh that starts at the hip crest
 *       // and carries the pelvis with it, a limb that bends; caps default to a pinch beyond the end rings
 *   ],
 *   include?: [ { name, parts, dials?, creases?, palette?, shift: [x, y, z] } ],   // a baked layered fragment worn at a shift
 *   heads?: [ { name, plan, expression?, on: <joint> (its `nape` landmark sits there) | shift: [x, y, z], at?: <landmark>, bind? } ],
 *     // a head as PLAN DATA (station-loft-head.js), expanded to an include; it exposes ANCHORS read from its own geometry
 *     // (`<part>.back|tip` caps, `<hinge dial>.pivot`, its landmarks) that rig joints name as `at: '<head>.<anchor>'`
 *   details?: [ { name, kind: 'claw', base, dir, length, radius, pin, group, tint, stretch?, mirror? } ],
 *   dials: { <name>: <dial spec> | { op: 'include', name } },  // `parts` entries may carry `$S` (→ R then L)
 *   body?: { refine, volume, creases, tiles, pads, spurs, rows, collars, rigid },   // BODY DETAIL passes (station-loft-body.js):
 *                                                              //   density, masses, bend creases, rigid tiles, pads, rows, collars,
 *                                                              //   baked as pinned L2 parts on the refined rest L1
 *   adorn?: [ { id, mode: 'shell' | 'band' | 'strap', part, …, signature: { kind, … } } ],   // ADORNMENT (station-loft-adorn.js):
 *                                                              //   worn over the detailed figure, baked as pinned L3 parts
 *   creases?, palette?, rig?, clips?,                          // rig joints / bones may carry `$S` and `perSide` blocks
 * }
 *
 * `mirror: 'plane'` — a midline part: the right half is authored, the left half is its mirror by slot name.
 * `mirror: 'name'` — a right-side part: the whole left part is generated with `R ↔ L` renamed on the part
 * and the slot (so `thighL/st0.frontL` is the mirror of `thighR/st0.frontR`), including its bind.
 * `bind: { bone, prev?, next? }` — the segment belongs to `bone`; the overshoot ring at each joint is shared
 * half and half with the neighbour and the cap beyond it belongs to the neighbour outright.
 *
 * Every coordinate is rounded to the micrometre (`r6`), so mirror symmetry is exact after rounding.
 * Pure, deterministic, no dice. Refusals name the plan field and the fix.
 */
import { compileLayered, pinFrame, surfaceLocalOffset, mirrorPid, mirrorFaceId } from './station-loft.js';
import { headFromPlan, resolveExpression, insidePart } from './station-loft-head.js';
import { bakeLayered } from './station-loft-detail.js';
import { bakeBody, validateBody } from './station-loft-body.js';
import { bakeAdorn, validateKit } from './station-loft-adorn.js';

const sub = (a, b) => a.map((x, i) => x - b[i]); const add = (a, b) => a.map((x, i) => x + b[i]); const mul = (a, s) => a.map((x) => x * s);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (v) => Math.hypot(...v); const unit = (v) => { const l = len(v); if (!(l > 1e-12)) throw new Error('layered plan: degenerate direction'); return mul(v, 1 / l); };
const mean = (ps) => mul(ps.reduce(add, [0, 0, 0]), 1 / ps.length);
export const r6 = (x) => Math.round(x * 1e6) / 1e6 + 0;   // + 0 folds -0
export const mirrorX = (p) => [-p[0] + 0, p[1], p[2]];
export const mirrorPartName = (n) => n.replace(/([RL])$/, (m) => (m === 'R' ? 'L' : 'R'));
export const mirrorId = (id) => { const [part, rest] = id.split('/'); return `${mirrorPartName(part)}/${mirrorPid(rest)}`; };
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const fail = (msg) => { throw new Error(`layered plan: ${msg}`); };

export const SLOT_FAMILIES = {
  ring6: ['front', 'frontR', 'backR', 'back', 'backL', 'frontL'],
  ring8: ['front', 'frontR', 'sideR', 'backR', 'back', 'backL', 'sideL', 'frontL'],
  ring10: ['front', 'frontR', 'sideFrontR', 'sideBackR', 'backR', 'back', 'backL', 'sideBackL', 'sideFrontL', 'frontL'],
  ring12: ['front', 'frontR', 'frontSideR', 'sideR', 'backSideR', 'backR', 'back', 'backL', 'backSideL', 'sideL', 'frontSideL', 'frontL'],
  limb6: ['front', 'frontR', 'backR', 'back', 'backL', 'frontL'],
};
const STYLE_KEYS = ['slots', 'limbSlots', 'e'];
export const PLAN_SCHEMA = 'layered-plan-v1';
const SEGMENT_KINDS = ['trunk', 'segment', 'chain', 'loft'];
const DETAIL_KINDS = ['claw'];

// ── ring geometry (the seeds' rules, verbatim) ──
const R2 = (r) => (Array.isArray(r) ? r : [r, r]);
/** A superellipse ring perpendicular to axis `d` at centre `c`: `front` toward +y (or +z when d ∥ y), R toward +x.
 * r = [along R, along front]; e = 2 is an ellipse, more is boxier. The right half is generated and the left half is
 * its exact mirror in the ring's own front plane, so mirror-by-name holds inside the part. */
export function ringPoints(c, d, r, slots, e = 2) {
  d = unit(d); let f = sub([0, 1, 0], mul(d, dot([0, 1, 0], d))); if (len(f) < 1e-6) f = sub([0, 0, 1], mul(d, dot([0, 0, 1], d))); f = unit(f);
  let s = cross(f, d); if (Math.abs(s[0]) < 1e-9) fail('a ring whose axis runs along x has no R side'); if (s[0] < 0) s = mul(s, -1);
  const [rs, rf] = R2(r); const n = slots.length; const pts = {};
  const sg = (x) => (x < 0 ? -1 : 1); const pw = (x) => sg(x) * Math.abs(x) ** (2 / e);
  for (let k = 0; k <= n / 2; k++) { const t = 2 * Math.PI * k / n; const F = mul(f, rf * pw(Math.cos(t))), S = mul(s, rs * pw(Math.sin(t))); pts[slots[k]] = add(c, add(F, S)); if (k && k < n / 2) pts[slots[n - k]] = add(c, sub(F, S)); }
  return pts;
}
/** A straight segment from joint A to joint B: three rings ⟂ (B − A) at A, mid and B, the ends overshooting the
 * joints by `over` × radius so neighbours fuse across the bend; caps pinched on the axis beyond the end rings. */
export function segmentPart(A, B, rA, rB, { slots = SLOT_FAMILIES.limb6, e = 2, over = [0.6, 0.6], mid = 0.5, rMid } = {}) {
  const d = unit(sub(B, A)); const L = len(sub(B, A)); const rad = (r) => (Array.isArray(r) ? Math.max(...r) : r);
  const at = (t) => add(A, mul(d, t));
  const st = [[-over[0] * rad(rA), rA], [mid * L, rMid ?? R2(rA).map((x, i) => (x + R2(rB)[i]) / 2)], [L + over[1] * rad(rB), rB]];
  return { slots, stations: st.map(([t, r], i) => ({ id: `st${i}`, points: ringPoints(at(t), d, r, slots, e) })), caps: { back: at(st[0][0] - 0.45 * rad(rA)), tip: at(st[2][0] + 0.45 * rad(rB)) } };
}
/** Explicit stations for a midline trunk: [{ z, r: [rx, ry], yc, e }] along +z. */
export function trunkPart(stations, caps, slots = SLOT_FAMILIES.ring8, e = 2) {
  return { slots, stations: stations.map((s, i) => ({ id: `st${i}`, points: ringPoints([0, s.yc ?? 0, s.z], [0, 0, 1], s.r, slots, s.e ?? e) })), caps };
}
/** A loft along a polyline of explicit stations: each ring ⟂ the local direction at its centre (the chord between its
 * neighbours), caps pinched beyond the end rings unless given. */
export function loftPart(stations, caps, slots = SLOT_FAMILIES.limb6, e = 2) {
  const C = stations.map((s) => s.at); const n = C.length; const rad = (r) => (Array.isArray(r) ? Math.max(...r) : r);
  const dirAt = (i) => unit(sub(C[Math.min(i + 1, n - 1)], C[Math.max(i - 1, 0)]));
  const sts = stations.map((s, i) => ({ id: `st${i}`, points: ringPoints(s.at, dirAt(i), s.r, slots, s.e ?? e) }));
  const back = caps?.back ?? add(C[0], mul(dirAt(0), -0.45 * rad(stations[0].r))), tip = caps?.tip ?? add(C[n - 1], mul(dirAt(n - 1), 0.45 * rad(stations[n - 1].r)));
  return { slots, stations: sts, caps: { back, tip } };
}
/** Finish an L1 part: round every coordinate; a midline part (`mirrorPlane: 'x'`) takes its left half from the
 * rounded right half by name, so the figure's mirror symmetry is exact after rounding. */
function finish(part, { group, tint, mirrorPlane }) {
  const n = part.slots.length; const stations = part.stations.map((s) => { const pts = {};
    for (let k = 0; k < n; k++) pts[part.slots[k]] = s.points[part.slots[k]].map(r6);
    if (mirrorPlane === 'x') for (let k = n / 2 + 1; k < n; k++) pts[part.slots[k]] = mirrorX(pts[part.slots[n - k]]);
    return { id: s.id, points: pts }; });
  return { layer: 1, closure: 'closed', slots: part.slots, stations, caps: { back: part.caps.back.map(r6), tip: part.caps.tip.map(r6) }, ...(group ? { group } : {}), ...(tint ? { tint } : {}) };
}
/** The left limb: every point mirrored in x, every slot renamed R ↔ L. */
function mirrorPart(p) { return { ...p, stations: p.stations.map((s) => ({ id: s.id, points: Object.fromEntries(Object.entries(s.points).map(([k, v]) => [mirrorPid(k), mirrorX(v)])) })), caps: { back: mirrorX(p.caps.back), tip: mirrorX(p.caps.tip) } }; }
/** A segment's bind: it belongs to `bone`; the overshoot ring at each joint is shared half and half with the
 * neighbour, and the cap beyond it belongs to the neighbour outright. */
export const segmentBind = (prev, self, next) => ({ bone: self, blend: { ...(prev ? { back: { [prev]: 1 }, st0: { [prev]: 0.5, [self]: 0.5 } } : {}), ...(next ? { st2: { [self]: 0.5, [next]: 0.5 }, tip: { [next]: 1 } } : {}) } });
const mirrorBind = (b) => (typeof b === 'string' ? mirrorPartName(b) : { bone: mirrorPartName(b.bone), blend: Object.fromEntries(Object.entries(b.blend).map(([st, w]) => [st, Object.fromEntries(Object.entries(w).map(([bone, x]) => [mirrorPartName(bone), x]))])) });
const resolveBind = (bind, self) => (bind == null ? undefined : typeof bind === 'string' ? bind : bind.blend ? bind : bind.bone || bind.prev || bind.next ? segmentBind(bind.prev || null, bind.bone || self, bind.next || null) : fail(`bind of '${self}' must be a bone name, { bone, prev?, next? } or { bone, blend }`));

// ── `$S` templates: a name carrying `$S` stands for its R and L twins ──
const hasS = (s) => typeof s === 'string' && s.includes('$S');
const side = (s, S) => (typeof s === 'string' ? s.replaceAll('$S', S) : s);
const sideDeep = (v, S) => (typeof v === 'string' ? side(v, S) : Array.isArray(v) ? v.map((x) => sideDeep(x, S)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [side(k, S), sideDeep(x, S)])) : v);
const expandList = (list) => list.flatMap((p) => (hasS(p) ? [side(p, 'R'), side(p, 'L')] : [p]));
const expandDial = (d) => {
  const out = { ...d };
  if (Array.isArray(d.parts)) out.parts = expandList(d.parts);
  if (Array.isArray(d.links)) out.links = d.links.flatMap((l) => (l.perSide ? ['R', 'L'].flatMap((S) => sideDeep(l.perSide, S)) : [{ ...l, ...(Array.isArray(l.parts) ? { parts: expandList(l.parts) } : {}) }]));
  return out;
};

// ── heads: a head plan (JSON) interpreted and baked at its expression, then worn exactly as an include ──
const headCache = new WeakMap();
function headInclude(h, plan) {
  if (headCache.has(h)) return headCache.get(h);
  if (!h || typeof h.name !== 'string' || !h.name) fail('every head needs { name, plan, on | shift }');
  let head, baked; try { head = headFromPlan(h.plan); baked = bakeLayered(head, resolveExpression(h.expression)); } catch (err) { fail(`head '${h.name}': ${err.message}`); }
  // ATTACH BY NAME: the head's landmark (default `nape`) sits on the named joint; an explicit shift is the fallback
  let shift;
  if (h.on != null) { if (h.shift != null) fail(`head '${h.name}' gives both on and shift; give one`); const J = (plan.joints || {})[h.on]; if (!isVec(J)) fail(`head '${h.name}' attaches on joint '${h.on}', which the joint table lacks`);
    const lm = h.at || 'nape'; const p = head.landmarks[lm]; if (!p) fail(`head '${h.name}' attaches by its '${lm}' landmark, which its plan does not declare (have ${Object.keys(head.landmarks).join(', ') || 'none'})`); shift = sub(J, p).map(r6); }
  else if (isVec(h.shift)) shift = h.shift; else fail(`head '${h.name}' needs on: <joint> or shift: [x, y, z]`);
  // ANCHORS, read from the head's own geometry after placement: caps, hinge pivots, landmarks
  const at = (p) => add(p, shift).map(r6); const anchors = {};
  for (const [n, P] of Object.entries(baked.parts)) if (P.layer === 1) { anchors[`${n}.back`] = at(P.caps.back); anchors[`${n}.tip`] = at(P.caps.tip); }
  for (const [k, d] of Object.entries(baked.dials)) if (d.op === 'hinge' && typeof d.pivot === 'string') { const [pn, rest] = d.pivot.split('/'); const [st, sl] = rest.split('.'); const pt = baked.parts[pn]?.stations.find((x) => x.id === st)?.points[sl]; if (pt) anchors[`${k}.pivot`] = at(pt); }
  for (const [k, p] of Object.entries(head.landmarks)) anchors[k] = at(p);
  const inc = { name: h.name, parts: baked.parts, dials: baked.dials, creases: baked.creases, palette: baked.palette, shift, ...(h.bind ? { bind: h.bind } : {}), anchors };
  headCache.set(h, inc); return inc;
}
const includesOf = (plan) => [...(plan.include || []), ...(plan.heads || []).map((h) => headInclude(h, plan))];
/** a rig joint's `at`: a point, or `'<head>.<anchor>'` read from a worn head */
function anchorAt(plan, ref, joint) { if (Array.isArray(ref)) return ref; const i = ref.indexOf('.'); const inc = includesOf(plan).find((x) => x.name === ref.slice(0, i));
  const p = inc?.anchors?.[ref.slice(i + 1)]; if (!p) fail(`rig joint '${joint}' is at '${ref}', which names no head anchor (have ${includesOf(plan).flatMap((x) => Object.keys(x.anchors || {}).map((a) => `${x.name}.${a}`)).join(', ') || 'none'})`); return p; }

// ── validation ──
export function validatePlan(plan) {
  if (!plan || typeof plan !== 'object') fail('a plan is an object { schema, frame, joints, segments, … }');
  if (plan.schema !== PLAN_SCHEMA) fail(`schema must be '${PLAN_SCHEMA}' (got ${JSON.stringify(plan.schema)})`);
  if (!plan.frame || typeof plan.frame !== 'object') fail('frame is required: { up: "+z", front: "+y" }');
  const families = { ...SLOT_FAMILIES, ...(plan.slotFamilies || {}) };
  for (const [k, s] of Object.entries(families)) if (!Array.isArray(s) || s.length < 4 || s.length % 2) fail(`slot family '${k}' needs an even list of at least 4 slot names`);
  if (plan.style != null) {
    if (typeof plan.style !== 'object' || Array.isArray(plan.style)) fail('style must be an object { slots?, limbSlots?, e? }');
    for (const k of Object.keys(plan.style)) if (!STYLE_KEYS.includes(k)) fail(`style.${k} is not a style key (have ${STYLE_KEYS.join(', ')})`);
    for (const k of ['slots', 'limbSlots']) if (plan.style[k] != null && !families[plan.style[k]]) fail(`style.${k} names slot family '${plan.style[k]}', which is not defined (have ${Object.keys(families).join(', ')})`);
    if (plan.style.e != null && !(Number.isFinite(plan.style.e) && plan.style.e >= 1)) fail('style.e must be a number ≥ 1 (2 is round, 12 reads as a box)');
  }
  const joints = plan.joints || {};
  for (const [k, v] of Object.entries(joints)) if (!isVec(v)) fail(`joint '${k}' must be [x, y, z]`);
  if (!Array.isArray(plan.segments) || !plan.segments.length) fail('segments must be a non-empty list');
  const names = new Set();
  const claim = (n, what) => { if (typeof n !== 'string' || !n) fail(`${what} needs a name`); if (names.has(n)) fail(`part name '${n}' is used twice`); names.add(n); };
  const joint = (n, seg) => { if (!(n in joints)) fail(`segment '${seg.name}' names joint '${n}', which the joint table lacks (have ${Object.keys(joints).join(', ') || 'none'})`); return joints[n]; };
  for (const seg of plan.segments) {
    if (!SEGMENT_KINDS.includes(seg.kind)) fail(`segment '${seg.name}' kind must be one of ${SEGMENT_KINDS.join(' / ')}`);
    if (seg.slots != null && !(typeof seg.slots === 'string' ? seg.slots in families : Array.isArray(seg.slots))) fail(`segment '${seg.name}' slots must name a family (${Object.keys(families).join(', ')}) or list slot names`);
    if (seg.mirror != null && !['plane', 'name'].includes(seg.mirror)) fail(`segment '${seg.name}' mirror must be 'plane', 'name' or absent`);
    if (seg.kind === 'trunk') { claim(seg.name, 'a trunk'); if (!Array.isArray(seg.stations) || seg.stations.length < 2) fail(`trunk '${seg.name}' needs at least two stations`); for (const s of seg.stations) if (!Number.isFinite(s.z) || s.r == null) fail(`trunk '${seg.name}': every station needs z and r`); if (!seg.caps || !isVec(seg.caps.back) || !isVec(seg.caps.tip)) fail(`trunk '${seg.name}' needs caps { back, tip }`); if (seg.mirror === 'name') fail(`trunk '${seg.name}' is a midline part; mirror 'name' is for a side part`); }
    const midline = (n, seg) => { if (Math.abs(joint(n, seg)[0]) > 1e-9) fail(`segment '${seg.name}' mirrors in the plane, so joint '${n}' must sit on x = 0 (a side part mirrors by 'name')`); };
    if (seg.kind === 'segment') { claim(seg.name, 'a segment'); joint(seg.from, seg); joint(seg.to, seg); if (seg.rA == null || seg.rB == null) fail(`segment '${seg.name}' needs rA and rB`); if (seg.mirror === 'name' && !/[RL]$/.test(seg.name)) fail(`segment '${seg.name}' mirrors by name, so its name must end in R or L`); if (seg.mirror === 'plane') { midline(seg.from, seg); midline(seg.to, seg); } }
    if (seg.kind === 'loft') { claim(seg.name, 'a loft'); if (!Array.isArray(seg.stations) || seg.stations.length < 2) fail(`loft '${seg.name}' needs at least two stations`); for (const s of seg.stations) if (!isVec(s.at) || s.r == null) fail(`loft '${seg.name}': every station needs at [x, y, z] and r`); if (seg.caps && !(isVec(seg.caps.back) && isVec(seg.caps.tip))) fail(`loft '${seg.name}' caps need back and tip`); if (seg.mirror === 'name' && !/[RL]$/.test(seg.name)) fail(`loft '${seg.name}' mirrors by name, so its name must end in R or L`); if (seg.mirror === 'plane') for (const s of seg.stations) if (Math.abs(s.at[0]) > 1e-9) fail(`loft '${seg.name}' mirrors in the plane, so every station must sit on x = 0`); }
    if (seg.kind === 'chain') { if (!Array.isArray(seg.joints) || seg.joints.length < 2) fail(`chain '${seg.name}' needs at least two joints`); seg.joints.forEach((j) => joint(j, seg)); if (!Array.isArray(seg.r) || seg.r.length !== seg.joints.length) fail(`chain '${seg.name}' needs one radius per joint`); for (let i = 0; i + 1 < seg.joints.length; i++) claim(`${seg.name}${i}`, 'a chain link'); if (seg.mirror === 'name') fail(`chain '${seg.name}' is a midline part; mirror 'name' is for a side part`); if (seg.mirror === 'plane') seg.joints.forEach((j) => midline(j, seg)); }
  }
  for (const inc of includesOf(plan)) { if (!inc.name || !inc.parts || typeof inc.parts !== 'object') fail('every include needs { name, parts, shift }'); if (!isVec(inc.shift)) fail(`include '${inc.name}' needs shift [x, y, z]`); for (const n of Object.keys(inc.parts)) claim(n, `include '${inc.name}' part`); }
  for (const det of plan.details || []) {
    if (!DETAIL_KINDS.includes(det.kind)) fail(`detail '${det.name}' kind must be one of ${DETAIL_KINDS.join(' / ')}`);
    claim(det.name, 'a detail'); if (det.mirror) claim(det.mirror, `the mirror of '${det.name}'`);
    if (!isVec(det.base) || !isVec(det.dir) || !(det.length > 0) || !(det.radius > 0)) fail(`claw '${det.name}' needs base, dir, length > 0, radius > 0`);
    if (!det.pin || !names.has(det.pin.parent) || typeof det.pin.face !== 'string' || !Array.isArray(det.pin.weights) || !Array.isArray(det.pin.tangentEdge)) fail(`claw '${det.name}' needs pin { parent (a segment), face, weights, tangentEdge, handedness }`);
    if (det.stretch != null && !(plan.dials && plan.dials[det.stretch]?.op === 'stretch')) fail(`claw '${det.name}' names stretch dial '${det.stretch}', which must be declared with op 'stretch'`);
  }
  if (plan.body != null && (typeof plan.body !== 'object' || Array.isArray(plan.body))) fail('body must be an object of detail passes { refine?, volume?, creases?, tiles?, pads?, spurs?, rows?, collars? } (station-loft-body.js)');
  if (plan.adorn != null && !Array.isArray(plan.adorn)) fail('adorn must be a list of adornments [{ id, mode, part, …, signature }] (station-loft-adorn.js)');
  if (plan.emissive != null && !(Array.isArray(plan.emissive) && plan.emissive.every((g) => typeof g === 'string'))) fail('emissive must be a list of palette group names (they render full-bright: a lens, a visor slit, a reactor)');
  for (const [k, d] of Object.entries(plan.dials || {})) { if (!d || typeof d !== 'object') fail(`dial '${k}' must be an object`); if (d.op === 'include' && !includesOf(plan).some((i) => i.name === d.name)) fail(`dial '${k}' includes '${d.name}', which no include declares`); }
  return true;
}

// ── expansion ──
export function expandPlan(plan) {
  validatePlan(plan);
  const families = { ...SLOT_FAMILIES, ...(plan.slotFamilies || {}) };
  const style = { slots: 'ring8', limbSlots: 'limb6', e: 2, ...(plan.style || {}) };
  const slotsOf = (seg, which) => (seg.slots == null ? families[style[which]] : typeof seg.slots === 'string' ? families[seg.slots] : seg.slots);
  const eOf = (seg) => seg.e ?? style.e;
  const J = plan.joints || {};
  const parts = {};
  const place = (name, part, seg, bind) => { parts[name] = part; const b = resolveBind(bind, name); if (b !== undefined) parts[name].bind = b; };
  for (const seg of plan.segments) {
    const look = { group: seg.group, tint: seg.tint, mirrorPlane: seg.mirror === 'plane' ? 'x' : undefined };
    if (seg.kind === 'trunk') place(seg.name, finish(trunkPart(seg.stations, seg.caps, slotsOf(seg, 'slots'), eOf(seg)), look), seg, seg.bind);
    else if (seg.kind === 'segment' || seg.kind === 'loft') {
      const raw = seg.kind === 'loft' ? loftPart(seg.stations, seg.caps, slotsOf(seg, 'limbSlots'), eOf(seg)) : segmentPart(J[seg.from], J[seg.to], seg.rA, seg.rB, { slots: slotsOf(seg, 'limbSlots'), e: eOf(seg), over: seg.over, mid: seg.mid, rMid: seg.rMid });
      const right = finish(raw, look); place(seg.name, right, seg, seg.bind);
      if (seg.mirror === 'name') { const left = mirrorPart(right); parts[mirrorPartName(seg.name)] = left; const b = resolveBind(seg.bind, seg.name); if (b !== undefined) left.bind = mirrorBind(b); }
    } else if (seg.kind === 'chain') {
      const n = seg.joints.length - 1; const ov = { first: 0.4, last: 0.3, inner: 0.6, ...(seg.over || {}) };
      for (let i = 0; i < n; i++) {
        const name = `${seg.name}${i}`; const raw = segmentPart(J[seg.joints[i]], J[seg.joints[i + 1]], seg.r[i], seg.r[i + 1], { slots: slotsOf(seg, 'limbSlots'), e: eOf(seg), over: [i === 0 ? ov.first : ov.inner, i === n - 1 ? ov.last : ov.inner] });
        const bind = seg.bind ? segmentBind(i ? `${seg.name}${i - 1}` : seg.bind.root || null, `${seg.name}${i}`, i < n - 1 ? `${seg.name}${i + 1}` : null) : undefined;
        place(name, finish(raw, look), seg, bind);
      }
    }
  }
  // includes: a baked layered fragment worn at a shift (its L1 points translated, L2 offsets rounded and riding their pins)
  const creases = { ...(plan.creases || {}) }; let palette = plan.palette ? { ...plan.palette } : undefined; const includeDials = {};
  for (const inc of includesOf(plan)) {
    const shift = (p) => add(p, inc.shift).map(r6);
    for (const [name, part] of Object.entries(inc.parts)) {
      parts[name] = part.layer === 1
        ? { ...part, stations: part.stations.map((s) => ({ ...s, points: Object.fromEntries(Object.entries(s.points).map(([k, v]) => [k, shift(v)])) })), caps: { back: shift(part.caps.back), tip: shift(part.caps.tip) } }
        : { ...part, offsets: Object.fromEntries(Object.entries(part.offsets).map(([k, o]) => [k, o.map(r6)])) };
    }
    for (const [name, b] of Object.entries(inc.bind || {})) { if (!parts[name]) fail(`include '${inc.name}' binds '${name}', which it does not carry`); parts[name].bind = b; }
    includeDials[inc.name] = Object.fromEntries(Object.entries(inc.dials || {}).map(([k, d]) => [k, d.op === 'scale' && Number.isFinite(d.pivot) ? { ...d, pivot: r6(d.pivot + inc.shift[['x', 'y', 'z'].indexOf(d.axis)]) } : d]));
    Object.assign(creases, inc.creases || {}); if (inc.palette) palette = { ...(palette || {}), ...inc.palette };
  }
  // dials, in plan order; an `include` entry splices that include's dials in place
  const dials = {};
  for (const [k, d] of Object.entries(plan.dials || {})) { if (d.op === 'include') Object.assign(dials, includeDials[d.name]); else dials[k] = expandDial(d); }
  // THE SEAM: a head worn `on` a joint seals the segment that ends there. That segment's last ring is shrunk about its
  // centre by the largest scale (bisection) that keeps every ring point, 5 % beyond, and its tip inside the head's L1 parts, at rest
  // and at each head dial's min and max, so no gap shows whatever the head's shape dials do. Rings that already fit
  // are untouched.
  for (const h of plan.heads || []) { if (h.on == null) continue; const inc = headInclude(h, plan); const hp = Object.keys(inc.parts).filter((n) => parts[n]?.layer === 1);
    const hd = Object.fromEntries(Object.entries(includeDials[inc.name] || {}).filter(([, d]) => (d.parts || [d.part]).some((n) => hp.includes(n))));
    const sets = [{}, ...Object.entries(hd).flatMap(([k, d]) => (Number.isFinite(d.min) && Number.isFinite(d.max) ? [{ [k]: d.min }, { [k]: d.max }] : []))];
    const heads = sets.map((d) => compileLayered({ schema: 'layered-v1', frame: plan.frame, dials: hd, parts: Object.fromEntries(hp.map((n) => [n, parts[n]])) }, d, { details: false, creases: false }).parts);
    const inside = (q) => heads.every((H) => hp.some((n) => insidePart(H[n], q)));
    for (const seg of plan.segments.filter((x) => x.kind === 'segment' && x.to === h.on)) { const P = parts[seg.name]; const st = P.stations[P.stations.length - 1];
      const c = mean(P.slots.map((sl) => st.points[sl])); const ring = (k) => P.slots.map((sl) => add(c, mul(sub(st.points[sl], c), k)));
      const SLACK = 1.05; const fits = (k) => [...ring(k * SLACK), P.caps.tip].every(inside); if (fits(1)) continue;   // sealed with slack: a ring 5 % larger would still be buried
      let lo = 0.2, hi = 1; if (!fits(lo)) continue;   // cannot seal by shrinking: left as authored (the seam gate reports it)
      for (let it = 0; it < 24; it++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
      const R = ring(lo); P.slots.forEach((sl, i) => { st.points[sl] = R[i].map(r6); }); } }
  const recipe = { schema: 'layered-v1', frame: plan.frame, symmetry: plan.symmetry || { plane: 'x=0', policy: 'midline parts: right half authored, left half mirrored by name; side parts: right authored, left mirrored in x with R ↔ L renamed on the part and the slot' }, dials, parts, creases };
  if (palette) recipe.palette = palette;
  if (plan.emissive?.length) recipe.emissive = [...plan.emissive];   // groups that glow: baked full-bright, unshaded
  // details: authored in world space on the L1 form at rest; stored as local offsets in their pin frames
  if ((plan.details || []).length) {
    const l1 = Object.fromEntries(Object.entries(parts).filter(([, p]) => p.layer === 1));
    const base = compileLayered({ schema: 'layered-v1', frame: plan.frame, dials: {}, parts: l1 }, {}, { details: false, creases: false });
    const mirrorFace = (id) => { const [part, rest] = id.split('/'); return mirrorFaceId(`${mirrorPartName(part)}/${rest}`, parts[part].slots.length); };
    const outward = (pts, tris, centre) => tris.map((t) => { const p = t.map((k) => pts[k]); const n = cross(sub(p[1], p[0]), sub(p[2], p[0])); return dot(n, sub(mean(p), centre)) < 0 ? [t[0], t[2], t[1]] : t; });
    const ringAround = (c, r, axis, n) => { const a = unit(axis); let u = cross(a, [0, 0, 1]); if (len(u) < 1e-6) u = cross(a, [0, 1, 0]); u = unit(u); const v = cross(a, u); return Array.from({ length: n }, (_, i) => { const t = 2 * Math.PI * i / n; return add(c, mul(add(mul(u, Math.cos(t)), mul(v, Math.sin(t))), r)); }); };
    const detail = (name, { layer, closure, pin, group, tint, points, faces, stretch, loft, rootOf }, mirror) => {
      if (!base.parts[pin.parent]) fail(`detail '${name}' pins to '${pin.parent}', which is not an L1 part`);
      let f; try { f = pinFrame(base.parts[pin.parent], pin); } catch (err) { fail(`detail '${name}': ${err.message}`); }
      const offsets = Object.fromEntries(Object.entries(points).map(([id, p]) => [id, surfaceLocalOffset(f, p).map(r6)]));
      if (rootOf) offsets.root = mean(rootOf.map((k) => offsets[k]));
      const fs = Object.fromEntries(faces.map((t, i) => [`f${String(i).padStart(2, '0')}`, t])); const groups = Object.fromEntries(Object.keys(fs).map((k) => [k, group]));
      const st = stretch && { dial: stretch.dial, origin: offsets[stretch.origin], axis: unit(sub(offsets[stretch.tip], offsets[stretch.origin])).map(r6) };
      const common = { layer, closure, offsets, groups, tint, ...(st ? { stretch: st } : {}), ...(loft ? { loft } : {}) };
      recipe.parts[name] = { ...common, pin, faces: fs };
      if (mirror) recipe.parts[mirror] = { ...common, pin: { parent: mirrorPartName(pin.parent), face: mirrorFace(pin.face), weights: [...pin.weights].reverse(), tangentEdge: pin.tangentEdge.map(mirrorId), handedness: -1 }, faces: Object.fromEntries(Object.entries(fs).map(([k, t]) => [k, [...t].reverse()])) };
    };
    for (const det of plan.details) {
      if (det.kind === 'claw') {
        const pts = {}; ringAround(det.base, det.radius, det.dir, 3).forEach((p, i) => { pts[`b${i}`] = p; }); pts.apex = add(det.base, mul(unit(det.dir), det.length)); pts.root = mean([pts.b0, pts.b1, pts.b2]);
        const tris = outward(pts, [['b0', 'b1', 'b2'], ['b0', 'b1', 'apex'], ['b1', 'b2', 'apex'], ['b2', 'b0', 'apex']], mean([pts.root, pts.apex]));
        detail(det.name, { layer: 2, closure: 'closed', group: det.group || 'Claws', tint: det.tint, points: pts, faces: tris, stretch: det.stretch ? { dial: det.stretch, origin: 'root', tip: 'apex' } : undefined, loft: { rings: [['b0', 'b1', 'b2']], from: 'root', to: 'apex', axis: 'ring-normal', pinch: { tip: 'apex' } }, pin: det.pin, rootOf: ['b0', 'b1', 'b2'] }, det.mirror);
        if (det.stretch) { const d = dials[det.stretch]; d.parts = [...(d.parts || []), det.name, ...(det.mirror ? [det.mirror] : [])]; }
      }
    }
  }
  // body detail, then adornment: the dragon's passes as data, baked as pinned parts on the refined rest carrier (a
  // pinned part inherits its pin face's weights; refinement extends the bind blends so skinning is unchanged)
  if (plan.body || plan.adorn) {
    const errs = [...(plan.body ? validateBody(plan.body, recipe.parts) : []), ...(plan.adorn ? validateKit(plan.adorn, recipe.parts) : [])];
    if (errs.length) fail(errs.join('; '));
    const source = JSON.parse(JSON.stringify(recipe)); let fig;
    try {
      if (plan.body) { const { recipe: baked, built } = bakeBody(recipe, plan.body); Object.assign(recipe, baked); fig = { mesh: built.mesh, parts: built.parts }; }
      else fig = { mesh: compileLayered(recipe, {}), parts: {} };
      if (plan.adorn?.length) bakeAdorn(recipe, fig, plan.adorn, { source });
    } catch (err) { fail(`${plan.body && plan.adorn ? 'body / adorn' : plan.body ? 'body' : 'adorn'}: ${err.message}`); }
  }
  // rig: joints and bones may carry `$S`; a `perSide` bone block expands to its R bones then its L bones
  if (plan.rig) {
    const R = plan.rig; const joints = {};
    for (const [k, v] of Object.entries(R.joints || {})) {
      const p = anchorAt(plan, v.at, k);
      if (hasS(k)) { for (const S of ['R', 'L']) { const at = S === 'R' ? p : mirrorX(p); joints[side(k, S)] = { ...sideDeep(v, S), at: at.map(r6) }; } }
      else joints[k] = { ...v, at: p.map(r6) };
    }
    const bones = (R.bones || []).flatMap((b) => (b.perSide ? ['R', 'L'].flatMap((S) => b.perSide.map((x) => sideDeep(x, S))) : [b]));
    const chains = Object.fromEntries(Object.entries(R.chains || {}).map(([k, c]) => [k, { ...c, links: (c.links || []).flatMap((l) => (l.perSide ? ['R', 'L'].flatMap((S) => sideDeep(l.perSide, S)) : [l])) }]));
    recipe.rig = { ...R, joints, bones, ...(R.chains ? { chains } : {}) };
  }
  if (plan.clips) recipe.clips = plan.clips;
  return recipe;
}
