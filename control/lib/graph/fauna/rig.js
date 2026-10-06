/**
 * rig — a species' skeleton and gaits carried into the layered solid it mints: the plan binds every part to the
 * skeleton's bones, and the World / skinned GLB / Godot read the gait clips as a packed rig figure.
 *
 * Opt-in by `motion`: `withMotion(plan, id, gaits)` returns a copy of the species' plan with
 *  - a `bind` on every plan segment (a limb segment to its bone, its joint rings shared with the bones either side; an
 *    axis loft station by station, each blended with the next bone along its region as it nears that bone's end;
 *    a one-side decoration to its bone), and `heads[0].bind` (the skull and jaw ride `head`);
 *  - `motion: { species, gaits, keys }`, which expandPlan carries onto the recipe.
 * Without `motion` the plan is untouched: every species builds byte-identically.
 *
 * At read time `packFaunaRig` packs the mesh through packLayeredRig (no clips, a stand-in rig of the skeleton's bones,
 * so the humanoid path is untouched) and appends a clip per gait from gait.js: per key per bone the absolute rest →
 * posed quaternion and the posed head, seated like the rest. Each clip carries its stride's duration (`s`), from the
 * speed the stride implies, so a walk plays at a walk's pace. In place: the World's walkers move the body.
 */
import { faunaSkeleton } from './skeleton.js';
import { gaitFrames, prepare } from './gait.js';
import { locomotionFor } from './locomotion/index.js';
import { SPECIES, speciesPlan } from './species.js';
import { packLayeredRig } from '../polygonizer/station-loft-rig.js';

const AXIS = /^(spine|neck|tail)\d+$|^head$/;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const r6 = (v) => Math.round(v * 1e6) / 1e6 + 0;

/** The skeleton as bindLayered and the pack read it: bones in order and their index. */
export function faunaBones(id) {
  const S = faunaSkeleton(id); if (!S) return null;
  return { bones: S.bones, boneIndex: Object.fromEntries(S.bones.map((b, i) => [b.id, i])) };
}

/** A part's station ids and centres, as expandPlan names them (st0…, or the rings' own ids). */
function stationsOf(part, joints) {
  return (part.stations || []).map((s, i) => {
    const c = s.at || (() => { const v = Object.values(s.points); return [0, 1, 2].map((k) => v.reduce((t, p) => t + p[k], 0) / v.length); })();
    return { id: s.id ?? `st${i}`, c };
  });
}

/**
 * The plan-level binds for a species: `{ segments: { <name>: bind }, head: { cranium, jaw } }`. An axis station rides
 * its bone, blending linearly toward the neighbour at the end it is near (half and half at a joint), never across
 * regions; a limb segment shares its end rings with the bones either side (segmentBind).
 */
export function faunaBinds(id) {
  const S = faunaSkeleton(id), by = Object.fromEntries(S.bones.map((b) => [b.id, b]));
  const kids = {}; for (const b of S.bones) if (b.parent) (kids[b.parent] ??= []).push(b.id);
  const region = (bid) => bid.replace(/\d+$/, '');
  const blendAt = (bid, c) => {
    const b = by[bid], d = sub(b.tail, b.head), L2 = dot(d, d) || 1;
    const u = Math.max(0, Math.min(1, dot(sub(c, b.head), d) / L2));
    const nb = u < 0.5 ? (b.parent && AXIS.test(b.parent) && region(b.parent) === region(bid) ? b.parent : null)
      : (kids[bid] || []).find((k) => AXIS.test(k) && region(k) === region(bid)) || null;
    if (!nb) return { [bid]: 1 };
    const w = r6(u < 0.5 ? 0.5 - u : u - 0.5);
    return w > 0 ? { [bid]: r6(1 - w), [nb]: w } : { [bid]: 1 };
  };
  const P = speciesPlan(id), J = P.joints, segments = {};   // the plan the skeleton was derived from
  for (const p of P.segments) {
    const b = S.bind[p.name];
    if (typeof b === 'string') {
      // a limb segment: its joint rings shared with its parent bone and its main-chain child
      if (p.kind === 'segment' && by[b] && !AXIS.test(b)) {
        const next = (kids[b] || []).find((k) => by[k].role) || null;
        segments[p.name] = { bone: b, ...(by[b].parent ? { prev: by[b].parent } : {}), ...(next ? { next } : {}) };
      } else segments[p.name] = b;
      continue;
    }
    if (b.stations) {
      const st = stationsOf(p, J), blend = {};
      st.forEach((s, i) => { blend[s.id] = blendAt(b.stations[i], s.c); });
      if (st.length) { blend.back = { [b.stations[0]]: 1 }; blend.tip = { [b.stations[st.length - 1]]: 1 }; }
      segments[p.name] = { bone: b.stations[0], blend };
      continue;
    }
    // a joint-to-joint axis part: its ends ride the bones at its ends, its middle half and half
    segments[p.name] = b.from === b.to ? b.from : { bone: b.from, blend: { back: { [b.from]: 1 }, st0: { [b.from]: 1 }, st1: { [b.from]: 0.5, [b.to]: 0.5 }, st2: { [b.to]: 1 }, tip: { [b.to]: 1 } } };
  }
  return { segments, head: { cranium: 'head', jaw: 'head' } };
}

/** The gaits a species can be minted with, and the default (all of them). */
export const motionGaits = (id) => Object.keys(locomotionFor(SPECIES[id].family, id).gaits);

/** A copy of `plan` (the species' own) bound to its skeleton and carrying `motion`. Throws on a gait it does not have. */
export function withMotion(plan, id, gaits = motionGaits(id), keys = 24) {
  const have = motionGaits(id);
  for (const g of gaits) if (!have.includes(g)) throw new Error(`'${id}' has no gait '${g}' (it can: ${have.join(', ')})`);
  if (!Number.isInteger(keys) || keys < 4 || keys > 96) throw new Error('motion keys must be an integer in [4, 96]');
  const B = faunaBinds(id), out = structuredClone(plan);
  for (const s of out.segments) if (B.segments[s.name] !== undefined) s.bind = B.segments[s.name];
  if (out.heads?.length) out.heads[0] = { ...out.heads[0], bind: B.head };
  out.motion = { species: id, gaits: [...gaits], keys };
  return out;
}

/** Row-major rotation → quaternion [x, y, z, w] (the rig pack's convention: v' = h + R(q)(v − restHead)). */
export function quatOfRows(m) {
  const t = m[0][0] + m[1][1] + m[2][2];
  let x, y, z, w;
  if (t > 0) { const s = 0.5 / Math.sqrt(t + 1); w = 0.25 / s; x = (m[2][1] - m[1][2]) * s; y = (m[0][2] - m[2][0]) * s; z = (m[1][0] - m[0][1]) * s; }
  else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) { const s = 2 * Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]); w = (m[2][1] - m[1][2]) / s; x = 0.25 * s; y = (m[0][1] + m[1][0]) / s; z = (m[0][2] + m[2][0]) / s; }
  else if (m[1][1] > m[2][2]) { const s = 2 * Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]); w = (m[0][2] - m[2][0]) / s; x = (m[0][1] + m[1][0]) / s; y = 0.25 * s; z = (m[1][2] + m[2][1]) / s; }
  else { const s = 2 * Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]); w = (m[1][0] - m[0][1]) / s; x = (m[0][2] + m[2][0]) / s; y = (m[1][2] + m[2][1]) / s; z = 0.25 * s; }
  const n = Math.hypot(x, y, z, w) || 1;
  return w < 0 ? [-x / n, -y / n, -z / n, -w / n] : [x / n, y / n, z / n, w / n];
}

/** How long one stride of a gait lasts, seconds: stride ÷ the speed it implies (stride/h ≈ 2.3·Fr^0.3). */
export function strideSeconds(id, gait) {
  const ctx = prepare(id), g = ctx.L.gaits[gait];
  if (!g?.stride) return 1;
  const Fr = Math.pow(g.stride / 2.3, 1 / 0.3), v = Math.sqrt(Fr * 9.81 * ctx.h);
  return r4(Math.max(0.25, Math.min(4, (g.stride * ctx.h) / v)));
}

/**
 * Pack a minted animal's mesh and gait clips as a rig figure (the shape packLayeredRig returns): `motion` is the
 * recipe's `{ species, gaits, keys }`, `skin` bindLayered's result over `faunaBones`, `opts` packLayeredRig's
 * (dz, normals, light, …).
 */
export function packFaunaRig(mesh, skin, motion, opts = {}) {
  const { species: id, gaits, keys = 24 } = motion, dz = opts.dz || 0;
  const S = faunaSkeleton(id);
  const stand = { joints: {}, bones: S.bones.map((b) => ({ id: b.id, head: `${b.id}:h`, tail: `${b.id}:t` })) };
  for (const b of S.bones) { stand.joints[`${b.id}:h`] = b.head; stand.joints[`${b.id}:t`] = b.tail; }
  const pack = packLayeredRig(mesh, skin, stand, { ...opts, clips: {} });
  const clips = {};
  for (const g of gaits) {
    const flat = [];
    for (const f of gaitFrames(id, g, keys)) for (const b of S.bones) {
      const p = f.bones[b.id];
      flat.push(...quatOfRows(p.m).map(r4), r4(p.head[0]), r4(p.head[1]), r4(p.head[2] + dz));
    }
    clips[g] = { k: keys, b: flat, s: strideSeconds(id, g) };
  }
  return { ...pack, clips };
}
