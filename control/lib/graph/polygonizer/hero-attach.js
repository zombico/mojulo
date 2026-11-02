// hero-attach — anything the operator makes, worn by the hero: `attach: [{ object | ref, at, … }]` on the hero door. Gear
// (hero-gear.js) is a catalogue held by its class; an ATTACHMENT is an object of the operator's own (a workbench recipe:
// lathes, extrudes, sweeps, lofts, fields, shells, a program, cuts; or a solid minted elsewhere, by its sketch `ref`) worn
// rigid on one bone, placed by the words figure-attach.js proved on the protoform figure:
//
//   { id?,                     a name (the readout's, a patch's handle); attach<i> when absent
//     object | ref,            the object: a workbench recipe inline, or the ref of a workbench solid (mint_solid), copied
//                              into the hero at the door (`resolved`), so a later edit of that solid never moves this
//                              hero until its ref is set again: the hero stays its own recipe
//     at,                      a rig joint (shoulderR, wristL, headTop, neckHub, hipL, ankleR …), or [a, b] with `t`
//     t?       = 0.5,          how far along an [a, b] pair
//     bone?,                   the bone it rides (default: the bone that starts at `at`, else the one that ends there;
//                              for a pair, the bone from a to b)
//     size?,                   its extent in metres along `fit`; absent, its own size (the recipe's `units`)
//     fit?     = 'height',     which extent `size` means: height | width | depth | max
//     anchor?  = 'center',     which point of the object lands on the mount: center | base | top
//     offset?  = [0, 0, 0],    a nudge in metres in the figure's frame (x right, y forward, z up), after placing
//     rotate?  = [0, 0, 0],    degrees about the object's own axes, before fitting (Z, then Y, then X)
//     align?,                  'bone': the object's +z along the bone's direction (a pair's a → b, or `bone`'s)
//     mirror? }                true: worn on the other side as well, reflected (an R joint's L twin, the offset's x turned)
//
// Placed at the REST pose and carried by its bone's frame, exactly as gear is (hero-gear.js gearFaces, gearPackParts), so
// the stand, the clips, the rig preview and the skinned export carry it the same way. A worn object is part of the look,
// not the catalogue: it is never a held item (no grip, no swing) and never a garment (it is rigid). An object that lowers
// to nothing is refused at the door; at render, one that fails costs only itself. Pure: no dice, no clock.
import { lowerObjectFaces } from '../worlds/workbench.js';
import { DEFAULT_LIGHT } from './vexar.js';
import { UNIT_TO_M } from '../scene/world-units.js';

export const ATTACH_ANCHORS = Object.freeze(['center', 'base', 'top']);
export const ATTACH_FITS = Object.freeze(['height', 'width', 'depth', 'max']);
export const ATTACH_KEYS = Object.freeze(['id', 'object', 'ref', 'resolved', 'at', 't', 'bone', 'size', 'fit', 'anchor', 'offset', 'rotate', 'align', 'mirror']);
/** how many objects one hero wears at most (a mirrored one counts once) */
export const ATTACH_MOST = 24;
/** the recipe keys an inline object may carry: the workbench's own (worlds/workbench.js lowerObjectFaces) */
export const OBJECT_KEYS = Object.freeze(['kind', 'units', 'title', 'lathes', 'extrudes', 'sweeps', 'lofts', 'fields', 'shells', 'drapes', 'reliefs', 'frames', 'program', 'cuts', 'build', 'materials']);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const triple = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const ID = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;
const REF = /^[A-Za-z0-9_-]{1,64}$/;

/** The object an entry wears: its own recipe, or the copy its ref resolved to. */
export const objectOf = (e) => (e?.object ?? e?.resolved?.object ?? null);

/** the faces an object lowers to (its own frame and units), or [] when it lowers to nothing or fails */
function lowerSafe(object, light = DEFAULT_LIGHT) {
  try { const f = lowerObjectFaces({ kind: 'workbench', ...object }, light); return Array.isArray(f) ? f.filter((x) => Array.isArray(x?.corners) && x.corners.length >= 3) : []; } catch { return []; }
}

/**
 * Why an `attach` is invalid (sentences naming the choices); empty when valid or absent. `joints` (a set of rig joint
 * names) checks `at` when the caller has a rig; absent, any word is taken and an unknown one wears nothing.
 */
export function validateAttach(list, { joints = null, resolving = false } = {}) {
  if (list === undefined || list === null) return [];
  const words = `attach: a list of { object | ref, at, t?, bone?, size?, fit?, anchor?, offset?, rotate?, align?, mirror? } (an object of your own worn on a bone: \`object\` a workbench recipe { units?, lathes?, extrudes?, sweeps?, lofts?, fields?, shells?, program?, cuts? }, or \`ref\` a workbench solid's sketch ref)`;
  if (!Array.isArray(list)) return [words];
  if (list.length > ATTACH_MOST) return [`attach: at most ${ATTACH_MOST} objects (${list.length} given)`];
  const errs = [], ids = new Set(), known = joints instanceof Set ? joints : joints ? new Set(joints) : null;
  list.forEach((e, i) => {
    const at = `attach[${i}]`;
    if (!isObj(e)) { errs.push(`${at}: ${words}`); return; }
    for (const k of Object.keys(e)) if (!ATTACH_KEYS.includes(k)) errs.push(`${at}.${k} is not an attachment's (${ATTACH_KEYS.filter((x) => x !== 'resolved').join(', ')})`);
    if (e.id !== undefined) { if (typeof e.id !== 'string' || !ID.test(e.id)) errs.push(`${at}.id is a word (letters, digits, - and _)`); else if (ids.has(e.id)) errs.push(`${at}.id '${e.id}' is worn twice; each attachment is its own`); else ids.add(e.id); }
    const has = (e.object !== undefined) + (e.ref !== undefined);
    if (has !== 1) errs.push(`${at}: one of \`object\` (a workbench recipe of your own) or \`ref\` (a workbench solid's sketch ref)`);
    if (e.object !== undefined) {
      if (!isObj(e.object)) errs.push(`${at}.object is a workbench recipe { units?, lathes?, extrudes?, sweeps?, lofts?, fields?, shells?, program?, cuts? }`);
      else {
        const extra = Object.keys(e.object).filter((k) => !OBJECT_KEYS.includes(k));
        if (extra.length) errs.push(`${at}.object.${extra[0]} is not a workbench recipe's (${OBJECT_KEYS.join(', ')})`);
        else if (e.object.kind !== undefined && e.object.kind !== 'workbench') errs.push(`${at}.object.kind is 'workbench' (or left out)`);
        else if (e.object.units !== undefined && !UNIT_TO_M[e.object.units]) errs.push(`${at}.object.units is ${Object.keys(UNIT_TO_M).join(' | ')}`);
        else if (!lowerSafe(e.object).length) errs.push(`${at}.object draws nothing: give it a monomer that lowers to faces (a lathe, an extrude, a sweep, a loft, a field, a shell)`);
      }
    }
    if (e.ref !== undefined) {
      if (typeof e.ref !== 'string' || !REF.test(e.ref)) errs.push(`${at}.ref is a sketch ref (a workbench solid made with mint_solid)`);
      else if (!resolving && !(isObj(e.resolved) && e.resolved.ref === e.ref && isObj(e.resolved.object))) errs.push(`${at}.ref '${e.ref}' is not resolved: the door copies the solid in when it reads it`);
    }
    const jointOk = (n) => typeof n === 'string' && (!known || known.has(n));
    if (typeof e.at === 'string') { if (!jointOk(e.at)) errs.push(`${at}.at: no joint '${e.at}'${known ? ` (the rig's: ${[...known].slice(0, 24).join(', ')}…)` : ''}`); }
    else if (Array.isArray(e.at)) { if (e.at.length !== 2 || !e.at.every(jointOk)) errs.push(`${at}.at: a pair is [a, b], two rig joints, the object placed \`t\` of the way along`); }
    else errs.push(`${at}.at: a rig joint (shoulderR, wristL, headTop, neckHub, hipL …), or [a, b] with t`);
    if (e.t !== undefined && !(Number.isFinite(e.t) && e.t >= 0 && e.t <= 1)) errs.push(`${at}.t is 0 to 1, how far along the pair`);
    if (e.t !== undefined && !Array.isArray(e.at)) errs.push(`${at}.t places an object along a pair: at [a, b]`);
    if (e.bone !== undefined && (typeof e.bone !== 'string' || !e.bone)) errs.push(`${at}.bone is a rig bone's id (handR, foreArmL, torso, head, pelvis …)`);
    if (e.size !== undefined && !(Number.isFinite(e.size) && e.size > 0 && e.size <= 5)) errs.push(`${at}.size is its extent in metres, above 0 and at most 5`);
    if (e.fit !== undefined && !ATTACH_FITS.includes(e.fit)) errs.push(`${at}.fit is ${ATTACH_FITS.join(' | ')}`);
    if (e.anchor !== undefined && !ATTACH_ANCHORS.includes(e.anchor)) errs.push(`${at}.anchor is ${ATTACH_ANCHORS.join(' | ')}`);
    for (const k of ['offset', 'rotate']) if (e[k] !== undefined && !triple(e[k])) errs.push(`${at}.${k} is [x, y, z]${k === 'offset' ? ' in metres' : ' in degrees'}`);
    if (e.offset !== undefined && triple(e.offset) && e.offset.some((v) => Math.abs(v) > 2)) errs.push(`${at}.offset is a nudge: at most 2 m on an axis`);
    if (e.align !== undefined && e.align !== 'bone') errs.push(`${at}.align is 'bone' (the object's +z along the bone)`);
    if (e.mirror !== undefined && typeof e.mirror !== 'boolean') errs.push(`${at}.mirror is true (worn on the other side as well) or false`);
  });
  return errs;
}

/**
 * The stored `attach`: each entry as given, a `ref` copied in (`resolved: { ref, object }`) by `lookup(ref)` → the
 * solid's manifest or null; an entry whose stamp already stands for its ref keeps it. Throws naming a ref that is not a
 * workbench solid. Null when the list is empty.
 */
export function attachRecord(list, { lookup = null } = {}) {
  if (!Array.isArray(list) || !list.length) return null;
  return list.map((e, i) => {
    if (e.ref === undefined) { const { resolved: _r, ...rest } = e; return rest; }
    if (isObj(e.resolved) && e.resolved.ref === e.ref && isObj(e.resolved.object)) return e;
    const m = lookup ? lookup(e.ref) : null;
    if (!m) throw new Error(`attach[${i}].ref: no sketch '${e.ref}' on this machine (make the object with mint_solid { kind: 'workbench' }, then attach its ref)`);
    if (m.kind !== 'workbench') throw new Error(`attach[${i}].ref: '${e.ref}' is a ${m.kind}, not a workbench solid (mint_solid { kind: 'workbench' })`);
    const object = Object.fromEntries(Object.entries(m).filter(([k]) => OBJECT_KEYS.includes(k) && k !== 'kind' && k !== 'title'));
    if (!lowerSafe(object).length) throw new Error(`attach[${i}].ref: '${e.ref}' draws nothing to wear`);
    return { ...e, resolved: { ref: e.ref, object } };
  });
}

// ─── placing ──────────────────────────────────────────────────────────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const mv = (m, v) => [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
const mtv = (m, v) => [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2], m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2], m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]];
const mm = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
const DEG = Math.PI / 180;
function euler([rx, ry, rz]) {
  const cx = Math.cos(rx * DEG), sx = Math.sin(rx * DEG), cy = Math.cos(ry * DEG), sy = Math.sin(ry * DEG), cz = Math.cos(rz * DEG), sz = Math.sin(rz * DEG);
  return [[cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx], [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx], [-sy, cy * sx, cy * cx]];
}
/** the rotation taking +z onto d */
function zTo(d) {
  const l = Math.hypot(d[0], d[1], d[2]) || 1, v = [d[0] / l, d[1] / l, d[2] / l], c = v[2];
  if (c > 0.999999) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  if (c < -0.999999) return [[1, 0, 0], [0, -1, 0], [0, 0, -1]];
  const ax = [-v[1], v[0], 0], s2 = ax[0] * ax[0] + ax[1] * ax[1], k = (1 - c) / s2;
  return [[1 - k * ax[1] * ax[1], k * ax[0] * ax[1], ax[1]], [k * ax[0] * ax[1], 1 - k * ax[0] * ax[0], -ax[0]], [-ax[1], ax[0], 1 - k * s2]];
}
/** a joint's or a bone's twin on the other side (an R or L suffix turned) */
const twin = (n) => (typeof n !== 'string' ? n : /R$/.test(n) ? n.replace(/R$/, 'L') : /L$/.test(n) ? n.replace(/L$/, 'R') : n);
const r6 = (v) => Math.round(v * 1e6) / 1e6;

/** the bone an entry rides: its own, the pair's a → b, the one starting at `at`, else the one ending there */
function boneOf(R, e) {
  if (e.bone) return R.bones.findIndex((b) => b.id === e.bone);
  if (Array.isArray(e.at)) {
    const i = R.bones.findIndex((b) => b.head === e.at[0] && b.tail === e.at[1]);
    if (i >= 0) return i;
    const j = R.bones.findIndex((b) => b.head === e.at[1] && b.tail === e.at[0]);
    return j >= 0 ? j : R.bones.findIndex((b) => b.head === e.at[0]);
  }
  const i = R.bones.findIndex((b) => b.head === e.at);
  return i >= 0 ? i : R.bones.findIndex((b) => b.tail === e.at);
}

/** One entry's mount on one side: gear's shape (hero-gear.js: M, o, t, k on a bone) carrying its object, or null. */
function mountOf(R, e, id, mirrored) {
  const object = objectOf(e); if (!object) return null;
  const J = R.joints;
  const E = mirrored ? { ...e, at: Array.isArray(e.at) ? e.at.map(twin) : twin(e.at), ...(e.bone ? { bone: twin(e.bone) } : {}), ...(e.offset ? { offset: [-e.offset[0], e.offset[1], e.offset[2]] } : {}) } : e;
  const at = Array.isArray(E.at) ? E.at : [E.at];
  if (!at.every((n) => Array.isArray(J[n]))) return null;   // a joint this rig lacks: worn nowhere, never fatal
  const bi = boneOf(R, E); if (bi < 0) return null;
  const B = R.bones[bi];
  const t = Array.isArray(E.at) ? add(J[at[0]], mul(sub(J[at[1]], J[at[0]]), E.t ?? 0.5)) : J[at[0]];
  // orient: the object's own turn, then (align) its +z down the pair or the bone, always on the side it was written for
  // (a mirrored copy is that one reflected, below)
  let M = euler(e.rotate ?? [0, 0, 0]);
  if (e.align === 'bone') {
    const B0 = mirrored ? R.bones[boneOf(R, e)] : B;
    if (Array.isArray(e.at) && J[e.at[0]] && J[e.at[1]]) M = mm(zTo(sub(J[e.at[1]], J[e.at[0]])), M);
    else if (B0) M = mm(zTo(sub(J[B0.tail], J[B0.head])), M);
  }
  // measure as oriented, so `size` is the extent the author sees
  const faces = lowerSafe(object); if (!faces.length) return null;
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) { const p = mv(M, c); for (let a = 0; a < 3; a++) { if (p[a] < lo[a]) lo[a] = p[a]; if (p[a] > hi[a]) hi[a] = p[a]; } }
  const ext = sub(hi, lo), fit = E.fit ?? 'height';
  const span = fit === 'width' ? ext[0] : fit === 'depth' ? ext[1] : fit === 'max' ? Math.max(...ext) : ext[2];
  const k = E.size !== undefined ? E.size / (span || 1) : UNIT_TO_M[object.units ?? 'cm'];
  const anchor = E.anchor ?? 'center';
  const ap = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, anchor === 'base' ? lo[2] : anchor === 'top' ? hi[2] : (lo[2] + hi[2]) / 2];
  // a mirrored copy is the first reflected across the figure's middle (x): its rotation's first row turned, its faces wound back
  if (mirrored) M = [M[0].map((v) => -v), M[1], M[2]];
  const o = mtv(mirrored ? [M[0].map((v) => -v), M[1], M[2]] : M, ap);
  return { slot: `attach:${id}${mirrored ? ':mirror' : ''}`, item: id, attach: true, object, bone: B.id, boneIndex: bi, M, o, t: add(t, E.offset ?? [0, 0, 0]), k, flip: mirrored, length: r6(Math.max(...ext) * k), from: e.ref ?? null };
}

/** Every worn object's mount at rest (each mirrored one twice), in the list's order. */
export function attachMounts(hero, R) {
  const list = hero?.attach; if (!Array.isArray(list) || !list.length || !R) return [];
  const out = [];
  list.forEach((e, i) => {
    const id = e.id ?? `attach${i}`;
    const a = mountOf(R, e, id, false); if (a) out.push(a);
    if (e.mirror) { const b = mountOf(R, e, id, true); if (b) out.push(b); }
  });
  return out;
}

/** The readout: per worn object, where it rides and its size in metres and as a share of the figure's height. */
export function attachReadout(mounts, R) {
  const height = R.joints.headTop ? R.joints.headTop[2] : 1.75;
  return mounts.map((G) => ({ id: G.item, bone: G.bone, ...(G.flip ? { mirrored: true } : {}), ...(G.from ? { ref: G.from } : {}), lengthM: G.length, share: r6(G.length / height) }));
}
