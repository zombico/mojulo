// hero-gear — equipment on the hero: `gear: { right?, left?, back?, hip? }` on the hero door, each slot the same build
// words an item takes (equipment/expand.js). An item is placed by its sockets at true size (cm → m, times the figure's
// height over the canonical cast's), held by its class, and rigid on one bone:
//   blade   (dagger, sword, greatsword) the grip through the fist, the tip forward and 45° down out of the fingers'
//           perpendicular (less when the tip would reach the floor), the edge in the plane the arm swings in. The hand
//           bone has no roll, so the rest hold is chosen for where the arc carries it: tip-down at the side swings to
//           upright when the forearm is raised (a guard), where a tip-up rest hold would swing over the shoulder
//   haft    (staff) the same grip, the shaft leaning forward 15° off upright, its heel just above the floor
//   bow     the riser in the fist, leaning forward off upright until its lower tip clears the floor, the string toward
//           the body
//   forearm (shield) its height along the forearm, its face outward, its back grip at the hand
//   back    across the shoulder blades on the torso: a blade hilt-up over the right shoulder, anything else head-up
//   hip     at the left hip on the pelvis, hilt forward and up, the tip back and down
// Gear is placed at the REST pose and carried by its bone's frame, so the stand, the clips, the rig preview and the
// skinned export carry it the same way. The mounting rules come from the mecha arm's hold families (a fixed rotation
// per class, the grip on the wrist line, attach at rest then pose). Pure: no dice, no clock.
import { expandEquipment, validateBuild, LAWS_VERSION } from '../equipment/expand.js';
import { lowerObjectFaces } from '../worlds/workbench.js';
import { faceColorLinear } from '../figures/face-mesh.js';
import * as dmath from '../../util/dmath.js';

export const GEAR_SLOTS = Object.freeze(['right', 'left', 'back', 'hip']);
const HOLD_OF = Object.freeze({ dagger: 'blade', sword: 'blade', greatsword: 'blade', staff: 'haft', bow: 'bow', shield: 'forearm' });
const TILT = Object.freeze({ blade: 45, haft: 75, bow: 78 });
const FLOOR = 0.03;   // m a lower end keeps above the rest floor
const BLADES = new Set(['dagger', 'sword', 'greatsword']);
/** the canonical cast's head top (m): gear scales with the figure's height over it */
export const CANON_HEIGHT = 1.674;
/** an anime hero's gear takes this stylize when its build names none (read at plan time, never stored) */
export const ANIME_STYLIZE = 0.7;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = dmath.hypot(a[0], a[1], a[2]); return l > 1e-12 ? mul(a, 1 / l) : [0, 0, 1]; };
const lerp3 = (a, b, t) => add(a, mul(sub(b, a), t));
const perp = (v, a) => unit(sub(v, mul(a, dot(v, a))));
// a 3×3 as rows; M·v, Mᵀ·v, A·B; columns → rows
const mv = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
const mtv = (m, v) => [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2], m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2], m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]];
const mm = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
const fromColumns = (X, Y, Z) => [[X[0], Y[0], Z[0]], [X[1], Y[1], Z[1]], [X[2], Y[2], Z[2]]];
const r5 = (v) => Math.round(v * 1e5) / 1e5;

/** Why a `gear` is invalid (sentences naming the choices); empty when valid or absent. */
export function validateGear(gear) {
  if (gear === undefined || gear === null) return [];
  if (typeof gear !== 'object' || Array.isArray(gear)) return [`gear: { ${GEAR_SLOTS.map((s) => `${s}?`).join(', ')} }, each an item's build words ({ item, style?, dials?, parts?, gem?, seed? })`];
  const errs = [];
  for (const [slot, spec] of Object.entries(gear)) {
    if (!GEAR_SLOTS.includes(slot)) { errs.push(`gear.${slot}: not a slot — use ${GEAR_SLOTS.join(', ')}`); continue; }
    if (spec === null) continue;
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) { errs.push(`gear.${slot}: an item's build words { item, style?, dials?, parts?, gem?, seed? }`); continue; }
    errs.push(...validateBuild({ ...spec, type: 'equipment' }).map((e) => `gear.${slot}: ${e}`));
  }
  return errs;
}
/** The stored gear: each slot's words with the laws stamped (a later refinement never moves a stored hero's gear). */
export function gearRecord(gear) {
  const out = {};
  for (const slot of GEAR_SLOTS) { const s = gear?.[slot]; if (s) { const { type: _t, ...words } = s; out[slot] = { ...words, laws: words.laws ?? LAWS_VERSION }; } }
  return Object.keys(out).length ? out : null;
}
/** A slot's build as the kernel reads it; an anime hero's gear leans stylized unless the build says otherwise. */
export function gearBuild(spec, hero = {}) {
  const b = { type: 'equipment', seed: 3, ...spec };
  if (hero.head === 'anime' && b.dials?.stylize === undefined) b.dials = { ...(b.dials || {}), stylize: ANIME_STYLIZE };
  return b;
}

/**
 * Where each slot's item sits at REST: its bone, the rotation M from the item's frame (cm, +z along the item) into the
 * figure's, the item-space anchor `o` that lands on the rest point `t`, and the scale `k` (cm → m × height ratio).
 * A rest point p in the figure is t + M·(k·(q − o)) for an item point q.
 */
export function gearMounts(hero, R) {
  const gear = hero?.gear; if (!gear) return [];
  const J = R.joints; const bone = (id) => R.bones.findIndex((b) => b.id === id);
  const height = J.headTop ? J.headTop[2] : CANON_HEIGHT; const k = 0.01 * height / CANON_HEIGHT;
  const out = [];
  for (const slot of GEAR_SLOTS) {
    const spec = gear[slot]; if (!spec) continue;
    const build = gearBuild(spec, hero); const e = expandEquipment(build); const item = build.item; const hold = HOLD_OF[item];
    const grip = e.sockets.grip; const len = e.trace.length;
    let M, o, t, b;
    if (slot === 'right' || slot === 'left') {
      const S = slot === 'right' ? 'R' : 'L';
      const w = J[`wrist${S}`], kn = J[`knuckles${S}`], el = J[`elbow${S}`];
      const a = unit(sub(kn, w)); const f = perp([0, 1, 0], a); const h = lerp3(w, kn, 0.55);
      if (hold === 'forearm') {
        const u = unit(sub(el, w)); const out0 = perp([S === 'R' ? 1 : -1, 0, 0], u);
        const Z = u, Y = mul(out0, -1), X = cross(Y, Z);   // the face (item −y) outward, the height up the forearm
        M = fromColumns(X, Y, Z); o = grip.origin; t = h; b = `foreArm${S}`;
      } else {
        // the tilt out of the fingers' perpendicular: down for a blade (tip forward-down), up for a haft or a bow; the
        // drop from the hand to the lower end (in the fingers' direction, ≈ down) kept above the floor
        const below = (dist) => dmath.asin(Math.min(1, Math.max(0, (h[2] - FLOOR) / Math.max(1e-6, dist * k)))) * 180 / Math.PI;
        const g0 = grip.origin[2]; let deg = TILT[hold]; o = grip.origin;
        if (hold === 'blade') deg = Math.min(deg, below((e.sockets.tip?.origin?.[2] ?? len) - g0));
        if (hold === 'bow') deg = Math.min(deg, below(g0 + 2));
        if (hold === 'haft') o = [0, 0, Math.min(len, (h[2] - FLOOR) / (k * dmath.sin(deg * Math.PI / 180)))];   // slide the grip up the shaft
        const th = deg * Math.PI / 180, sg = hold === 'blade' ? 1 : -1;
        const Z = unit(add(mul(f, dmath.cos(th)), mul(a, sg * dmath.sin(th)))); const X = unit(sub(mul(a, dmath.cos(th)), mul(f, sg * dmath.sin(th))));
        M = fromColumns(X, cross(Z, X), Z); t = h; b = `hand${S}`;
      }
    } else if (slot === 'back') {
      const c = add(lerp3(J.navel, J.neckHub, 0.62), [0, -0.15 * height / CANON_HEIGHT, 0]);
      const Z = BLADES.has(item) ? unit([-0.5, 0, -0.866]) : item === 'shield' ? [0, 0, 1] : unit([0.4, 0, 0.917]);
      const Y = [0, 1, 0]; const X = cross(Y, Z);
      M = fromColumns(X, Y, Z); o = item === 'shield' ? [0, 0, len / 2] : [0, 0, BLADES.has(item) ? len * 0.55 : len / 2]; t = c; b = 'torso';
    } else {
      const hip = J.hipL; const c = add(hip, mul([-0.11, 0.05, 0.03], height / CANON_HEIGHT));
      const Z = unit([0, -0.5, -0.866]); const Y = [-1, 0, 0]; const X = cross(Y, Z);
      M = fromColumns(X, Y, Z); o = e.sockets.guard?.origin || grip.origin; t = c; b = 'pelvis';
    }
    const bi = bone(b); if (bi < 0) continue;
    out.push({ slot, item, hold: slot === 'back' || slot === 'hip' ? slot : hold, build, sockets: e.sockets, trace: e.trace, bone: b, boneIndex: bi, M, o, t, k, length: r5(len * k) });
  }
  return out;
}

/** A rest point of the item (cm) → the figure's rest frame (m). */
export const gearRestPoint = (G, q) => add(G.t, mv(G.M, mul(sub(q, G.o), G.k)));
const ride = (frame, p) => add(frame.head, mv(frame.m, sub(p, frame.restHead)));
/** The light turned into the item's own frame, for a rotation W from item to world: the baked shading reads true. */
function lightIn(light, W) {
  const L = { ...light };
  for (const k of ['dir', 'toLight', 'fillToLight']) if (Array.isArray(light[k])) L[k] = unit(mtv(W, light[k]));
  return L;
}
/** One face carried by (scale k about o, then M and t, then the bone frame when posed), with every geometric field. */
function carry(f, G, frame, dz) {
  const P = (q) => { const p = gearRestPoint(G, q); const w = frame ? ride(frame, p) : p; return [w[0], w[1], w[2] + dz]; };
  const V = (v) => { const w = mv(G.M, v); return frame ? mv(frame.m, w) : w; };
  const out = { ...f, corners: f.corners.map(P) };
  if (Array.isArray(f.outNormal)) out.outNormal = unit(V(f.outNormal));
  if (f.crystal && Array.isArray(f.crystal.c)) out.crystal = { ...f.crystal, c: P(f.crystal.c), ...(Array.isArray(f.crystal.axis) ? { axis: unit(V(f.crystal.axis)) } : {}), ...(Number.isFinite(f.crystal.r) ? { r: f.crystal.r * G.k } : {}) };
  if (f.metal && Array.isArray(f.metal.p)) out.metal = { ...f.metal, p: f.metal.p.map((c) => c.map((v) => r5(v * G.k))) };   // the billet in metres
  return out;
}
function lowered(G, light, W) { return lowerObjectFaces({ kind: 'workbench', units: 'cm', build: G.build }, lightIn(light, W)); }

/**
 * The gear's faces for the static solid: posed by `frames` (boneFrames at the stand; null = the rest pose), seated by
 * `dz`, each face in `group` (the body's, so a clip preview hides it with the body and the pack carries it instead).
 */
export function gearFaces(mounts, { frames = null, light, dz = 0, group = null } = {}) {
  const faces = [];
  for (const G of mounts) {
    const frame = frames ? frames[G.boneIndex] : null; const W = frame ? mm(frame.m, G.M) : G.M;
    for (const f of lowered(G, light, W)) { const c = carry(f, G, frame, dz); faces.push(group ? { ...c, group } : c); }
  }
  return faces;
}
/** The gear for the rig pack: per mount, its bone and its rest triangles (seated by dz) with their baked colours. */
export function gearPackParts(mounts, { light, dz = 0 } = {}) {
  return mounts.map((G) => {
    const tris = [];
    for (const f of lowered(G, light, G.M)) {
      const c = carry(f, G, null, dz).corners; const col = faceColorLinear(f);
      for (let i = 1; i + 1 < c.length; i++) tris.push({ p: [c[0], c[i], c[i + 1]], col });
    }
    return { bone: G.boneIndex, tris };
  });
}
/** The readout: per slot, the item, its hold and bone, its length in metres and as a share of the figure's height. */
export function gearReadout(mounts, R) {
  const height = R.joints.headTop ? R.joints.headTop[2] : CANON_HEIGHT;
  return Object.fromEntries(mounts.map((G) => [G.slot, { item: G.item, style: typeof G.build.style === 'string' ? G.build.style : G.build.style?.id ?? null, hold: G.hold, bone: G.bone, lengthM: G.length, share: r5(G.length / height), ...(G.trace.focal ? { focal: G.trace.focal.gem } : {}) }]));
}
