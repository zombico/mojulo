// PUSHES: the reading of a game creature laid over a species, not a field guide's. Every push moves ring radii, the
// head's own rows and ornaments, the palette and paint, or adds a midline ornament; none moves a joint the species has,
// so its skeleton and rig stay its own. The principles are the house's (docs/mascot.md, the creature catalyst's art
// direction, the stylism tuner): one dominant mass and one hook that breaks the outline, contrast spent at the eyes
// and the mouth, three values, and a push that exaggerates the animal's proportions but never reverses them.
//
// MASS
//   wedge    { fore, hind, broad }   the trunk's rings, hind (rump) → fore (chest and withers): the brute's wedge;
//            `broad` widens the fore rings' side radius again (shoulders that read from the front)
//   neck     k                 the neck's rings
//   limbs    { fore, hind, paws }   each leg's rings by the girdle it hangs from; the foot (a chain's last row) by paws
// HEAD
//   head     { skull: { width, height }, muzzle: { width, height }, brow, eye, pace }   the head's rows moved
//            (creature-heads deriveHead: a low wide skull, a heavier muzzle; never its length, so the head bone keeps
//            its own), the brow strip's size, the eye's radius; `pace`: the head keeps pace with the chest the wedge
//            builds, grown by that gain to this power (a head that reads small against the torso is a proportion
//            problem no detail fixes)
//   ears     { height, sweep, drop, none }   the ear spine's length, its upper points laid back (sweep: run per rise),
//            laid down the skull (drop: degrees, the fauna builder's `earDrop`), or no ears at all (none: true)
//   fangs    k                 a few decisive teeth, upper and lower, on a head with teeth: the canines × k, the rest
//            left small
//   expression { <control>: v }   the head's rest face (station-loft-head.js controls: jawOpen, sneer, browFurrow, …)
// THE HOOK
//   hackles  { count, height, lean, color, glow }   spikes along the dorsal line, nape to mid-back (height in back
//            depths): fur, ice, crystal, vertebrae or fins by their colour and glow
// SURFACE
//   coat     darken            the coat's colours toward black
//   desaturate d               the coat's colours toward their own grey
//   tint     { color, amount, light }   the coat mixed toward a colour (the light values by `light` × amount, default
//            half); several oozes' tints apply in list order
//   marks    [ marking, … ]    painted regions (the fauna builder's `markings`: band, stripes, patch, spots), each with
//            `group` and `color`, `glow: true` to draw it full-bright; spots are placed by the creature's seed
//   surfaces { <group> | '*': material }   a shelf material per palette group (gunmetal, steel, glass, stone, …)
//   eyes     { color, glow, open, socket }   the iris's colour, mixed in by strength; glow draws the whole eye
//            full-bright (the sclera a deeper shade, the pupil dark); `open` widens the lids; `socket`: a dark socket
//            round a glowing pupil (the sclera black and unlit)
//
// In every layer the coat's colours keep their values apart: the light ones (belly, cheek, throat) take half of a
// darkening and `light` of a tint. Composition (several oozes): multipliers multiply, each raised to its ooze's strength;
// sweeps, drops and the face's controls add, scaled by strength; a spike's height is the tallest asked; darkening and
// greying compound; tints and marks stack in list order (marks from strength 0.35); a word (a colour, a count, a
// material) is the last ooze's.
import { deriveHead } from '../creature-heads/derive.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import * as dmath from '../../util/dmath.js';

const LEAVES = {
  'wedge.fore': 'mul', 'wedge.hind': 'mul', 'wedge.broad': 'mul', neck: 'mul', 'limbs.fore': 'mul', 'limbs.hind': 'mul', 'limbs.paws': 'mul',
  'head.skull.width': 'mul', 'head.skull.height': 'mul', 'head.muzzle.width': 'mul', 'head.muzzle.height': 'mul', 'head.brow': 'mul',
  'head.eye': 'mul', 'head.pace': 'max', 'ears.height': 'mul', 'ears.sweep': 'add', 'ears.drop': 'add', 'ears.none': 'last', fangs: 'mul',
  'hackles.count': 'last', 'hackles.height': 'max', 'hackles.lean': 'last', 'hackles.color': 'last', 'hackles.glow': 'glow',
  coat: 'compound', desaturate: 'compound', 'eyes.color': 'last', 'eyes.glow': 'glow', 'eyes.open': 'mul', 'eyes.socket': 'last',
};
const LISTS = ['tint', 'marks'];   // stacked in list order, not merged
const leafOf = (path) => LEAVES[path] ?? (path.startsWith('expression.') ? 'add' : path.startsWith('surfaces.') ? 'last' : null);
const MUL_CLAMP = [0.3, 3];
const HEX = /^#[0-9a-f]{6}$/i;
const MARK_KINDS = ['band', 'belly', 'stripes', 'patch', 'spots'];
const TRUNK_DENSITY = 5, LEG_DENSITY = 3, PART_DENSITY = 3;   // rings per station interval under a mark

const fnv = (str) => { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const flatten = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => (!pre && LISTS.includes(k) ? [] : v && typeof v === 'object' && !Array.isArray(v) ? flatten(v, `${pre}${k}.`) : [[`${pre}${k}`, v]]));
function unflatten(pairs) {
  const out = {};
  for (const [path, v] of pairs) { const ks = path.split('.'); let o = out; ks.slice(0, -1).forEach((k) => { o = o[k] ??= {}; }); o[ks.at(-1)] = v; }
  return out;
}

/** Error strings for a row's push (empty = valid): every leaf one this module reads. */
export function pushErrors(push, label = 'push') {
  if (push === undefined) return [];
  if (!push || typeof push !== 'object') return [`${label}: an object of pushes`];
  const errs = flatten(push).filter(([p]) => !leafOf(p)).map(([p]) => `${label}.${p}: not a push (have ${Object.keys(LEAVES).join(', ')}, tint, marks, surfaces.<group>, expression.<control>)`);
  if (push.tint !== undefined && !(push.tint && HEX.test(push.tint.color) && Number.isFinite(push.tint.amount))) errs.push(`${label}.tint: { color: '#rrggbb', amount, light? }`);
  for (const [i, m] of (push.marks ?? []).entries()) if (!m || !MARK_KINDS.includes(m.kind) || !m.on || !m.group) errs.push(`${label}.marks[${i}]: { on, kind: ${MARK_KINDS.join(' | ')}, group, color?, glow?, … }`);
  for (const [g, m] of Object.entries(push.surfaces ?? {})) if (typeof m !== 'string') errs.push(`${label}.surfaces.${g}: a material name`);
  return errs;
}

/** Normalized oozes over a shelf → the one push they compose to (`null` when none pushes). `seed` places the marks. */
export function composePush(list, shelf, seed = 0) {
  const acc = new Map(), mix = { v: 0 }, tints = [], marks = [];
  for (const { id, strength: s } of list) {
    const push = shelf[id].push || {};
    for (const [path, v] of flatten(push)) {
      const kind = leafOf(path), a = acc.get(path);
      if (kind === 'mul') acc.set(path, (a ?? 1) * dmath.pow(v, s));
      else if (kind === 'add') acc.set(path, (a ?? 0) + v * s);
      else if (kind === 'max') acc.set(path, Math.max(a ?? 0, v * s));
      else if (kind === 'compound') acc.set(path, 1 - (1 - (a ?? 0)) * (1 - v * s));
      else if (kind === 'glow') acc.set(path, (a ?? false) || (v === true && s >= 0.5));
      else { acc.set(path, v); if (path === 'eyes.color') mix.v = s; }
    }
    if (push.tint) tints.push({ color: push.tint.color, amount: push.tint.amount * s, light: push.tint.light ?? 0.5 });
    // each mark's dice keyed by the creature's seed, its ooze and its place in that ooze's row: another ooze moves none
    if (push.marks && s >= 0.35) marks.push(...push.marks.map((m, i) => ({ ...m, seed: (m.seed ?? 0) + (fnv(`${seed}|${id}|${i}`) % 10007) })));
  }
  if (!acc.size && !tints.length && !marks.length) return null;
  const pairs = [...acc].map(([p, v]) => [p, leafOf(p) === 'mul' ? Math.min(MUL_CLAMP[1], Math.max(MUL_CLAMP[0], v)) : v]);
  if (acc.has('eyes.color')) pairs.push(['eyes.mix', mix.v]);
  return { ...unflatten(pairs), ...(tints.length ? { tints } : {}), ...(marks.length ? { marks } : {}) };
}

// ── colour ──
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;
const darken = (h, f) => (typeof h === 'string' && HEX.test(h) ? hex(rgb(h).map((x) => x * (1 - f))) : h);
const mixHex = (a, b, t) => (typeof a === 'string' && HEX.test(a) ? hex(rgb(a).map((x, i) => x + (rgb(b)[i] - x) * t)) : b);
const grey = (h, d) => { if (typeof h !== 'string' || !HEX.test(h)) return h; const c = rgb(h), y = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; return hex(c.map((x) => x + (y - x) * d)); };
const mul = (r, m) => (Array.isArray(r) ? r.map((x) => x * m) : r * m);
const smooth = (t) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
const LIGHT = ['ash', 'ashAlt', 'belly'];   // the light values: half a darkening, `light` of a tint, so the body keeps three values
const FACE = ['iris', 'sclera', 'teeth', 'mouth', 'nose', 'ink'];   // the face's own colours: the eyes and mouth keep their contrast
// the beaked and billed families: every family names a tooth colour, so the families without fangs are named here
const TOOTHLESS = new Set(['avian', 'testudine', 'monotreme']);

/** A worn head mesh (fauna build.js `wearHeadMesh`, sized in metres nape to nose) grown by k. */
export const growMesh = (H, k) => ({ ...H, ...(H.length ? { length: H.length * k } : {}), ...(H.lift ? { lift: H.lift * k } : {}) });

/** Species params with a push's param-level half laid over them (a new object). */
export function pushParams(P, push) {
  if (!push) return P;
  const out = { ...P };
  if (push.wedge && Array.isArray(P.torso)) {
    const ys = P.torso.map((st) => st.at[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const { fore = 1, hind = 1, broad = 1 } = push.wedge;
    out.torso = P.torso.map((st) => {
      const f = smooth((st.at[1] - y0) / (y1 - y0 || 1)), r = mul(st.r, hind + (fore - hind) * f), b = 1 + (broad - 1) * f;
      return { ...st, r: Array.isArray(r) ? [r[0] * b, r[1]] : b === 1 ? r : [r * b, r] };
    });
    const gain = push.head?.pace ? dmath.pow(fore * dmath.pow(broad, 0.5), push.head.pace) : 1;
    if (gain !== 1 && P.headScale) out.headScale = P.headScale * gain;
    if (gain !== 1 && P.headMesh) out.headMesh = growMesh(P.headMesh, gain);
  }
  if (push.neck) for (const k of ['neckRA', 'neckRB', 'neckRMid']) if (P[k] !== undefined) out[k] = mul(P[k], push.neck);
  if (push.limbs && Array.isArray(P.legs) && P.joints) out.legs = pushLimbs(P, push.limbs);
  if (push.ears?.none) out.ears = false;
  else if (push.ears && Array.isArray(P.earSpine) && P.ears !== false) {
    const { height = 1, sweep = 0, drop = 0 } = push.ears, z0 = P.earSpine[1]?.[2] ?? 0;
    out.earH = (P.earH ?? 1) * height;
    out.earSpine = P.earSpine.map(([x, y, z], i) => [i < 2 ? x : x - sweep * Math.max(0, z - z0) * out.earH, y, z]);
    if (drop) out.earDrop = Math.min(120, (P.earDrop === true ? 100 : P.earDrop || 0) + drop);
  }
  if (P.colors) out.colors = pushColors(P.colors, push);
  if (out.headMesh?.palette) out.headMesh = { ...out.headMesh, palette: pushMeshColors(out.headMesh.palette, push) };
  // a mark aimed at legs on a body without them (a snake, a fish) paints nothing there
  const LEGS = ['legs', 'foreLegs', 'hindLegs'], legged = (P.legs || []).length > 0;
  const marks = (push.marks || []).map((m) => ({ ...m, on: legged ? m.on : [m.on].flat().filter((o) => !LEGS.includes(o)) }))
    .filter((m) => [m.on].flat().length).map((m) => (Array.isArray(m.on) && m.on.length === 1 ? { ...m, on: m.on[0] } : m));
  if (marks.length) {
    out.markings = [...(P.markings || []), ...marks.map(({ glow, ...m }) => m)];
    // finer rings where the marks land (the builder's `markDensity`, per part): a mark narrower than a band floods it
    const D = { ...(P.markDensity || {}) }, want = (k, n) => { D[k] = Math.max(D[k] ?? 0, n); };
    for (const m of marks) for (const on of [m.on].flat()) {
      if (['legs', 'foreLegs', 'hindLegs'].includes(on)) want('legs', LEG_DENSITY);
      else want(on, on === 'torso' ? TRUNK_DENSITY : PART_DENSITY);
    }
    out.markDensity = D;
  }
  return out;
}

function pushColors(C0, push) {
  const C = { ...C0 }, body = Object.keys(C).filter((k) => !FACE.includes(k));
  if (push.coat) for (const k of body) C[k] = darken(C[k], LIGHT.includes(k) ? push.coat / 2 : push.coat);
  if (push.desaturate) for (const k of body) C[k] = grey(C[k], push.desaturate);
  for (const t of push.tints || []) for (const k of body) C[k] = mixHex(C[k], t.color, LIGHT.includes(k) ? t.amount * t.light : t.amount);
  const E = push.eyes || {};
  if (E.color) C.iris = mixHex(C0.iris, E.color, E.mix ?? 1);
  if (E.socket) C.sclera = '#0b0907';
  else if (E.color && E.glow) C.sclera = darken(C.iris, 0.35);
  return C;
}

// a worn head mesh's palette (its own group names) through the same colour layers: its light planes as the light values,
// its eyeball as the eye
const MESH_FACE = ['Socket', 'Eyes', 'Pupil', 'Nose', 'Mouth'], MESH_LIGHT = ['Muzzle', 'EarInset', 'FacePlanes', 'Whiskers'];
function pushMeshColors(C0, push) {
  const C = { ...C0 }, body = Object.keys(C).filter((k) => !MESH_FACE.includes(k)), lit = (k) => MESH_LIGHT.includes(k);
  if (push.coat) for (const k of body) C[k] = darken(C[k], lit(k) ? push.coat / 2 : push.coat);
  if (push.desaturate) for (const k of body) C[k] = grey(C[k], push.desaturate);
  for (const t of push.tints || []) for (const k of body) C[k] = mixHex(C[k], t.color, lit(k) ? t.amount * t.light : t.amount);
  const E = push.eyes || {};
  if (E.color && C.Eyes) C.Eyes = mixHex(C0.Eyes, E.color, E.mix ?? 1);
  if (E.socket && C.Socket) C.Socket = '#0b0907';
  return C;
}

// each leg chain by the girdle it hangs from (its root joint ahead of the trunk's middle is fore), its foot the last row
function pushLimbs(P, { fore = 1, hind = 1, paws = 1 }) {
  const ys = (P.torso || []).map((st) => st.at[1]), mid = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
  const byTo = new Map(P.legs.map((r) => [r[2], r])), froms = new Set(P.legs.map((r) => r[1]));
  const rootOf = (r) => { let j = r[1]; for (let i = 0; i < 16 && byTo.has(j); i++) j = byTo.get(j)[1]; return j; };
  return P.legs.map((row) => {
    const [name, from, to, rA, rB, group, over, rMid, ...rest] = row;
    const root = P.joints[rootOf(row)], k = root && root[1] > mid ? fore : hind;
    const foot = !froms.has(to), ankle = !foot && P.legs.some((r) => r[1] === to && !froms.has(r[2]));
    const ka = foot ? k * paws : k, kb = foot ? k * paws : ankle ? k * dmath.pow(paws, 0.5) : k;
    return [name, from, to, mul(rA, ka), mul(rB, kb), group, over, rMid === undefined ? rMid : mul(rMid, (ka + kb) / 2), ...rest].slice(0, row.length);
  });
}

/**
 * A built plan with a push's plan-level half laid over it (the plan given is not touched). The face (`head` and
 * `expression`) is seated as the fauna builder seats an eye (build.js `seatOrbit`): a head too small or too tight for
 * the whole push cannot place its lids, so the face steps back (three quarters, half, a quarter, none) until it seats.
 * `report.face` says how much of the face was drawn.
 */
export function pushPlan(plan, push, P, report = {}) {
  if (!push) return plan;
  const faced = push.head || push.expression;
  for (const f of faced ? [1, 0.75, 0.5, 0.25, 0] : [1]) {
    const out = pushOnce(plan, f === 1 ? push : faceAt(push, f), P);
    if (!faced) return out;
    try { expandPlan(out); report.face = f; return out; } catch (err) { if (!/projectOnto: no hit/.test(String(err?.message)) || f === 0) throw err; }
  }
  return plan;
}

// the face's pushes at a share f: its multipliers raised to f, its controls × f (`pace` is the body's: it stays)
function faceAt(push, f) {
  const { head, expression, ...rest } = push;
  const H = head && unflatten(flatten(head).map(([k, v]) => [k, k === 'pace' ? v : dmath.pow(v, f)]));
  const E = expression && Object.fromEntries(Object.entries(expression).map(([k, v]) => [k, v * f]));
  return { ...rest, ...(f > 0 && H ? { head: H } : {}), ...(f > 0 && E ? { expression: E } : {}) };
}

function pushOnce(plan, push, P) {
  const out = structuredClone(plan), H = out.heads?.[0];
  if (H && (push.head || push.fangs)) H.plan = pushHead(H.plan, push, P);
  if (H && push.expression) H.expression = Object.fromEntries(Object.entries(push.expression).map(([k, v]) => [k, +v.toFixed(4)]));
  if (push.hackles?.count && push.hackles.height > 0) hackles(out, push.hackles, P);
  const glow = [
    ...(push.eyes?.glow ? (push.eyes.socket ? ['Iris', 'Limbus'] : ['Sclera', 'Iris', 'Limbus']) : []),
    ...(push.eyes?.glow && P.headMesh?.palette?.Eyes ? ['Eyes'] : []),
    ...(push.hackles?.glow && push.hackles.count ? ['Hackle'] : []),
    ...(push.marks || []).filter((m) => m.glow).map((m) => m.group),
  ];
  if (glow.length) out.emissive = [...new Set([...(out.emissive || []), ...glow])];
  if (push.surfaces) out.surfaces = { ...(out.surfaces || {}), ...push.surfaces };
  return out;
}

function pushHead(head, push, P) {
  const rows = head.parts.cranium.rows, pivot = rows[Math.min(P.muzzleFrom ?? 3, rows.length - 1)][1];
  const h = push.head || {}, moves = [];
  if (h.skull) moves.push({ op: 'skull', pivot, width: h.skull.width ?? 1, height: h.skull.height ?? 1 });
  if (h.muzzle) moves.push({ op: 'muzzle', pivot, length: 1, width: h.muzzle.width ?? 1, height: h.muzzle.height ?? 1 });
  const D = { moves };
  if (h.eye) D.eye = { R: +(head.regions.eye.R * h.eye).toFixed(5) };
  if (h.brow && head.regions.brow) D.regions = { brow: { w: +(head.regions.brow.w * h.brow).toFixed(5), h: +(head.regions.brow.h * h.brow).toFixed(5) } };
  // FANGS: a toothed head with a jaw of three rows or more takes two short rows, a big canine leading the incisors, on
  // the lip line of the muzzle (the wolf library head's rows, placed by row count)
  if (push.fangs && !TOOTHLESS.has(P.family) && head.parts.jaw.rows.length >= 3) {
    const nc = rows.length - 1, nj = head.parts.jaw.rows.length - 1, f = push.fangs;
    D.ornaments = { add: [
      { kind: 'teeth', part: 'cranium', from: +(nc * 0.7).toFixed(3), to: +(nc * 0.93).toFixed(3), t: 5.5, sizes: [+(0.036 * f).toFixed(4), 0.014, 0.012], down: [0, 0, -1], tag: 'fang' },
      { kind: 'teeth', part: 'jaw', from: +(nj * 0.68).toFixed(3), to: +(nj * 0.94).toFixed(3), t: 0.88, sizes: [+(0.026 * f).toFixed(4), 0.012], down: [0, 0, 1], tag: 'fangLow' },
    ] };
  }
  return deriveHead(head, D);
}

// HACKLES: spikes along the dorsal line, from just behind the nape over the withers to mid-back, tallest over the
// shoulders; each a cone leaning back, rooted under the skin. Midline ornaments on joints of their own (`ooze…`): they
// ride the spine bones nearest them, and no species joint moves.
function hackles(plan, { count, height, lean = 0.5, color }, P) {
  const J = plan.joints, torso = plan.segments.find((g) => g.name === 'torso'), neck = plan.segments.find((g) => g.name === 'neck');
  if (!torso) return;
  const front = (r) => (Array.isArray(r) ? r[1] : r);
  const line = [];
  if (neck && J.neckTop && J.neckBase) {
    line.push([J.neckTop[1], J.neckTop[2] + 0.8 * front(neck.rB)]);
    line.push([J.neckBase[1], J.neckBase[2] + front(neck.rA)]);
  }
  // a trunk station's top [y, z] and half depth: its centre and radius, or (stable rings) its front and back points
  const top = (st) => (st.points?.front ? [st.points.front[1], st.points.front[2]] : [st.at[1], st.at[2] + front(st.r)]);
  const half = (st) => (st.points?.front ? (st.points.back ? (st.points.front[2] - st.points.back[2]) / 2 : 0) : front(st.r));
  const sts = [...torso.stations].sort((a, b) => top(b)[0] - top(a)[0]);
  const yMid = (top(sts[0])[0] + top(sts.at(-1))[0]) / 2;
  for (const st of sts) if (top(st)[0] >= yMid) line.push(top(st));
  if (line.length < 2) return;
  const segL = line.slice(1).map((p, i) => Math.hypot(p[0] - line[i][0], p[1] - line[i][1])), total = segL.reduce((a, b) => a + b, 0);
  const at = (u) => { let d = u * total; for (let i = 0; i < segL.length; i++) { if (d <= segL[i] || i === segL.length - 1) { const f = segL[i] ? Math.min(1, d / segL[i]) : 0; return line[i].map((x, c) => x + (line[i + 1][c] - x) * f); } d -= segL[i]; } return line.at(-1); };
  const depth = Math.max(...torso.stations.map(half)), n = Math.max(1, Math.round(count));
  plan.palette = { ...plan.palette, Hackle: color ?? darken(P.colors?.tip ?? P.colors?.coat ?? '#333333', 0.2) };
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : 0.1 + (0.8 * i) / (n - 1), [y, z] = at(u);
    const hgt = height * depth * (0.55 + 0.45 * dmath.sin(Math.PI * Math.min(1, u * 1.25)));
    const a = `oozeHackle${i}A`, b = `oozeHackle${i}B`;
    J[a] = [0, +y.toFixed(6), +(z - 0.3 * hgt).toFixed(6)];
    J[b] = [0, +(y - lean * hgt).toFixed(6), +(z + hgt).toFixed(6)];
    plan.segments.push({ name: `oozeHackle${i}`, kind: 'segment', from: a, to: b, rA: [0.24 * hgt, 0.32 * hgt], rB: [0.02 * hgt, 0.02 * hgt], slots: 'ring12', group: 'Hackle', mirror: 'plane', over: [0.3, 0.2] });
  }
}
