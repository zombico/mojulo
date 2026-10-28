/**
 * WHAT THE FRAME ADDS to a beast-kin on the tiered body: a tail, wings on the arms, a second pair of arms (the egocube's
 * topology notes, egocube/plan.js `biped`, carried from the creature biped onto the hero's own body). Each is a word on
 * the hero's `beast` (`tail`, `wings`, `arms`), its default the kin's card's where it has one.
 *
 *   beastTopology(plan, hero)  → the plan before the tiered passes, with:
 *     - the TAIL (`thin` | `thick` | `brush` | `stub`, the creature biped's TAILS: their radii, length and carriage): a
 *       loft from the back of the pelvis at the hip's height, its joints the carriage's scaled to the hero, its stations
 *       each half and half between the tail's bones at its joints; the bones ride the pelvis (no clip poses a tail yet,
 *       so it is carried as the pelvis goes, and every clip plays)
 *     - the ARM-WINGS (`wings: 'arms'`): the biped's five flight feathers, flat vanes trailing down and back from the
 *       hand (the primaries) and the forearm (the secondaries), on the hero's own elbow and knuckles, riding those bones
 *     - the SECOND ARMS (`arms: 4`): a smaller pair under the first, folded forward at rest (an insect's working hands):
 *       an upper arm on the torso's side, a forearm and a hand, their joints riding the torso (no clip poses them yet)
 *   beastSockets(plan, hero)   → after the tiered passes: the tail's root and the second arms' shoulders welded to their
 *                                trunk by the generic socket (./socket.js rootWeb)
 *   topologyJoints(hero)       → the second arms' elbow and wrist, bridged as the hero's are (no fold: their bend is held)
 *
 * Absent each word, nothing of it. Pure.
 */
import { beastCard } from './tiered.js';
import { rootWeb } from './socket.js';
import { TAILS, shade } from '../egocube/plan.js';

const r3 = (x) => Math.round(x * 1000) / 1000;
const r6 = (x) => Math.round(x * 1e6) / 1e6 + 0;
const add = (a, b) => a.map((x, i) => x + b[i]);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const mul = (a, s) => a.map((x) => x * s);
const unit = (v) => mul(v, 1 / (Math.hypot(...v) || 1));
const HANG = [[0, -0.17, 0.95], [0, -0.36, 0.83], [0, -0.52, 0.67], [0, -0.64, 0.5], [0, -0.72, 0.35], [0, -0.76, 0.22]];

export const BEAST_TAILS = Object.freeze(['none', 'thin', 'thick', 'brush', 'stub']);   // (TAILS' words, egocube/plan.js)
export const BEAST_WINGS = Object.freeze(['none', 'arms']);
export const BEAST_ARMS = Object.freeze([2, 4]);
/** the creature biped's flight feathers: name, the bone it rides, its share of the way from the elbow to the knuckles, its
 * way out (metres at 2 m tall), its width at the root and the tip (the vane's flat side front to back) */
const VANES = Object.freeze([['wingPrim1', 'hand', 0.92, [0.1, -0.08, -0.4], [0.042, 0.02]], ['wingPrim2', 'hand', 0.8, [0.13, -0.14, -0.4], [0.044, 0.02]], ['wingPrim3', 'foreArm', 0.66, [0.14, -0.19, -0.38], [0.075, 0.045]],
  ['wingSec1', 'foreArm', 0.45, [0.125, -0.22, -0.35], [0.075, 0.045]], ['wingSec2', 'foreArm', 0.22, [0.105, -0.23, -0.31], [0.075, 0.045]]]);
/** the second arms' joints at 2 m tall (the biped's), the shoulder's x held to the torso's side at its height */
const ARMS2 = Object.freeze({ shoulder2: [0.17, 0.03, 1.27], elbow2: [0.29, 0.09, 1.1], wrist2: [0.23, 0.27, 1.07], knuckles2: [0.19, 0.34, 1.03] });
const TOPOLOGY_JOINTS = Object.freeze([
  Object.freeze({ bridge: 'elbow2BridgeR', upper: 'upperArm2R', lower: 'foreArm2R', fold: null, reach: 0.6 }),
  Object.freeze({ bridge: 'wrist2BridgeR', upper: 'foreArm2R', lower: 'hand2R', fold: null, reach: 1.2 }),
]);

/** the hero's own words for what its frame adds, the card's defaults under them */
export function topologyOf(hero) {
  const card = beastCard(hero); if (!card) return null;
  return { tail: hero.beast.tail ?? card.tail ?? 'none', wings: hero.beast.wings ?? 'none', arms: hero.beast.arms ?? 2 };
}
export const topologyJoints = (hero) => (topologyOf(hero)?.arms === 4 ? TOPOLOGY_JOINTS : []);

// the hero's scale against the biped's 2 m template, from its head's top
const scaleOf = (plan) => { const J = plan.joints, top = plan.rig?.joints?.headTop?.at ?? add(J.headBase, [0, 0, 0.135]); return (top[2] + 0.06) / 2; };
// a trunk's section at height z: its centre's y and its half width and depth (the stations blended)
function sectionAt(seg, z) {
  const S = seg.stations, i = Math.max(0, S.findIndex((st, j) => j < S.length - 1 && z <= S[j + 1].z)), a = S[Math.min(i, S.length - 2)], b = S[Math.min(i + 1, S.length - 1)];
  const t = b.z === a.z ? 0 : Math.max(0, Math.min(1, (z - a.z) / (b.z - a.z))), r = (st) => (Array.isArray(st.r) ? st.r : [st.r, st.r]);
  return { yc: (a.yc ?? 0) + ((b.yc ?? 0) - (a.yc ?? 0)) * t, rx: r(a)[0] + (r(b)[0] - r(a)[0]) * t, ry: r(a)[1] + (r(b)[1] - r(a)[1]) * t };
}

export function beastTopology(plan, hero) {
  const T = topologyOf(hero);
  if (!T || (T.tail === 'none' && T.wings === 'none' && T.arms === 2)) return plan;
  const k = scaleOf(plan), J = { ...plan.joints }, RJ = { ...plan.rig.joints }, segments = [...plan.segments], skin = plan.palette?.Skin ?? '#8a7a6a';
  let bones = [...plan.rig.bones], dials = Object.fromEntries(Object.entries(plan.dials ?? {}).map(([id, d]) => [id, Array.isArray(d.parts) ? { ...d, parts: [...d.parts] } : d]));
  const palette = { ...(plan.palette ?? {}) };
  // THE TAIL: from the back of the pelvis at the hip's height, the carriage's joints scaled to the hero
  if (T.tail !== 'none') {
    const D = TAILS[T.tail], carry = D.carry ?? HANG, pelvis = segments.find((s) => s.name === 'pelvis'), hz = J.hip[2], X = sectionAt(pelvis, hz);
    const root = [0, r6(X.yc - X.ry + 0.5 * D.r[0] * k), r6(hz + 0.03 * k)];
    const pts = carry.map((p, i) => (i === 0 ? root : add(root, mul(sub(p, carry[0]), D.len * k)).map(r6)));
    pts.forEach((p, i) => { RJ[`tail${i}`] = { at: p, rides: 'pelvis' }; });
    bones = [...bones, ...pts.slice(0, -1).map((_, i) => ({ id: `tail${i}`, head: `tail${i}`, tail: `tail${i + 1}` }))];
    const n = pts.length - 1, blend = { back: { pelvis: 1 }, st0: { pelvis: 0.5, tail0: 0.5 }, [`st${n}`]: { [`tail${n - 1}`]: 1 }, tip: { [`tail${n - 1}`]: 1 } };
    for (let i = 1; i < n; i++) blend[`st${i}`] = { [`tail${i - 1}`]: 0.5, [`tail${i}`]: 0.5 };
    const end = add(pts[n], mul(unit(sub(pts[n], pts[n - 1])), D.r[n] * k * 0.8)).map(r6);
    segments.push({ name: 'tail', kind: 'loft', slots: 'ring8', mirror: 'plane', group: 'Skin', stations: pts.map((at, i) => ({ at, r: r6(D.r[i] * k) })),
      caps: { back: add(root, [0, D.r[0] * k * 0.8, 0]).map(r6), tip: end }, bind: { bone: 'tail0', blend } });
  }
  // THE ARM-WINGS: the flight feathers along the forearm and the hand, on the hero's elbow and knuckles
  if (T.wings === 'arms') {
    const along = (t) => add(J.elbow, mul(sub(J.knuckles, J.elbow), t));
    for (const [i, [n, bone, t, d, [wA, wB]]] of VANES.entries()) {
      J[`${n}b`] = along(t).map(r6); J[`${n}t`] = add(J[`${n}b`], mul(d, k * 1.05)).map(r6);
      segments.push({ name: `${n}R`, kind: 'segment', from: `${n}b`, to: `${n}t`, rA: [r3(0.008 * k), r3(wA * k)], rB: [r3(0.005 * k), r3(wB * k)], group: i % 2 ? 'FlightAlt' : 'Flight', mirror: 'name', bind: { bone: `${bone}R` } });
    }
    Object.assign(palette, { Flight: palette.Flight ?? shade(skin, -0.12), FlightAlt: palette.FlightAlt ?? shade(skin, 0.06) });
    for (const d of Object.values(dials)) if (Array.isArray(d.parts) && d.parts.includes('foreArm$S')) d.parts.push(...VANES.map(([n]) => `${n}$S`));
  }
  // THE SECOND ARMS: under the first, folded forward, riding the torso; the shoulder at the torso's side at its height
  if (T.arms === 4) {
    const torso = segments.find((s) => s.name === 'torso'), z = ARMS2.shoulder2[2] * k, X = sectionAt(torso, z);
    const sh = [r6(0.85 * X.rx), r6(X.yc + ARMS2.shoulder2[1] * k), r6(z)];
    for (const [n, p] of Object.entries(ARMS2)) { J[n] = n === 'shoulder2' ? sh : add(sh, mul(sub(p, ARMS2.shoulder2), k)).map(r6); RJ[`${n}$S`] = { at: J[n], rides: 'torso' }; }
    const R = (r) => (Array.isArray(r) ? r.map((x) => r3(x * k)) : r3(r * k));
    segments.push(
      { name: 'upperArm2R', kind: 'segment', from: 'shoulder2', to: 'elbow2', rA: R(0.055), rB: R(0.044), over: [0.6, 0.6], mid: 0.45, rMid: R([0.052, 0.054]), group: 'Skin', mirror: 'name', bind: { bone: 'upperArm2R', prev: 'torso', next: 'foreArm2R' } },
      { name: 'foreArm2R', kind: 'segment', from: 'elbow2', to: 'wrist2', rA: R(0.046), rB: R(0.034), over: [0.6, 0.6], group: 'Skin', mirror: 'name', bind: { bone: 'foreArm2R', prev: 'upperArm2R', next: 'hand2R' } },
      { name: 'hand2R', kind: 'segment', from: 'wrist2', to: 'knuckles2', rA: R([0.04, 0.03]), rB: R([0.045, 0.02]), over: [0.4, 0.3], group: 'Skin', mirror: 'name', bind: { bone: 'hand2R', prev: 'foreArm2R' } });
    bones = bones.map((b) => (b.perSide && b.perSide.some((x) => x.id === 'upperArm$S') ? { ...b, perSide: [...b.perSide,
      { id: 'upperArm2$S', head: 'shoulder2$S', tail: 'elbow2$S' }, { id: 'foreArm2$S', head: 'elbow2$S', tail: 'wrist2$S' }, { id: 'hand2$S', head: 'wrist2$S', tail: 'knuckles2$S' }] } : b));
    for (const d of Object.values(dials)) if (Array.isArray(d.parts) && d.parts.includes('upperArm$S')) d.parts.push('upperArm2$S', 'foreArm2$S', 'hand2$S');
  }
  return { ...plan, joints: J, segments, dials, palette, rig: { ...plan.rig, joints: RJ, bones } };
}

export function beastSockets(plan, hero) {
  const T = topologyOf(hero);
  if (!T || (T.tail === 'none' && T.arms === 2)) return plan;
  const webs = [];
  // (the tail's root ring sits on the pelvis's skin and the tail swells past it: its socket ends on that first ring, where
  // one ending further out ran under the tail's own swell and showed it through as a slit)
  if (T.tail !== 'none') webs.push(rootWeb(plan, { trunk: 'pelvis', limb: 'tail', ring: 'st0', trunkBone: 'pelvis', limbBone: 'tail0', name: 'tailSocket' }));
  if (T.arms === 4) webs.push(rootWeb(plan, { trunk: 'torso', limb: 'upperArm2R', trunkBone: 'torso', limbBone: 'upperArm2R', name: 'arm2SocketR' }));
  const made = webs.filter(Boolean);
  if (!made.length) return plan;
  const dials = Object.fromEntries(Object.entries(plan.dials ?? {}).map(([id, d]) => [id, Array.isArray(d.parts) && d.parts.includes('upperArm2$S') && made.some((w) => w.name === 'arm2SocketR') ? { ...d, parts: [...d.parts, 'arm2Socket$S'] } : d]));
  return { ...plan, segments: [...plan.segments, ...made], dials };
}
