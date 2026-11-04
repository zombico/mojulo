/**
 * versus hero — a character's OWN moves in the fight: the hero door's strikes (hero-strike.js: the jab, the cross; hero-
 * box.js: the hook, the uppercut, the body hook) solved on the character's own rig and laid into the fight plane, so a
 * fighter who is a character throws the punches it was made with, not a stick figure's.
 *
 *   • THE PLANE. A hero's posed skeleton seen from its side: the rig's forward (+y) the fight's +x, its up (+z) the
 *     fight's y, millimetres, the guard's pelvis the origin. Its lead side (the guard's, right-led: the jab's hand) is
 *     the fight's F, the rear B. Each segment's direction in the plane is read back as the fight's own pose angles
 *     (versus-rig.js: a limb 0 down and +90 forward, the trunk 0 up and + forward), so the sim lays its boxes and its
 *     round body draws it as it draws any pose, on the fighter's own lengths.
 *   • A TRACK is a move sampled evenly over its clip's phase, its contact's share, and its striking hand; plain data, so
 *     the roster carries it to a page that compiles the fighter (versus-compile.js `compileHeroNormal`). The compiler
 *     RETIMES it to frame data, as a fighting game's animation is authored to its frames: the clip to its contact over
 *     the startup, held through the active frames, the rest over the recovery.
 *   • THE GUARD the character stands in (hero-stance.js `guard`) is its rest in the fight: where every move starts and
 *     comes home.
 *
 *   HERO_MOVES               the strikes a fighter can take from its hero: word → its solver
 *   HERO_MOVE_SLOTS          the boxer's slots, `moves: 'hero'`: the jab, the cross, the hook, the body hook, the uppercut
 *   readHeroMoves(v)         → { <slot>: word }   'hero' or { <slot>: word } (a ground normal's slot, a strike word)
 *   planePose(R, pose, x0)   → the fight's pose of a hero pose (x0: the guard pelvis's forward, metres)
 *   heroTrack(R, word, { samples }) → { word, hand: 'F' | 'B', contact (share), poses: [pose …] }
 *   heroGuard(R)             → { pose, x0 }   the guard in the plane, and its pelvis's forward (metres)
 *   heroFight(R, moves)      → { guard, normals: { <slot>: { hero: track } } }
 *
 * Server side (it solves on the rig); pure and deterministic.
 */
import { rigNodesAt } from '../polygonizer/station-loft-rig.js';
import { heroStrike, STRIKES } from '../polygonizer/hero-strike.js';
import { heroBox, BOX_STRIKES } from '../polygonizer/hero-box.js';
import { heroStance } from '../polygonizer/hero-stance.js';
import { NORMAL_SLOTS } from './versus-library.js';

export const HERO_MOVES = Object.freeze({
  ...Object.fromEntries(Object.keys(STRIKES).map((w) => [w, 'strike'])),
  ...Object.fromEntries(Object.keys(BOX_STRIKES).map((w) => [w, 'box'])),
});
/** the boxer's slots: the light the jab, the medium the cross, the heavy the lead hook; low, the body hook and the
 * uppercut (thrown from the guard: a crouching fighter rises into them) */
export const HERO_MOVE_SLOTS = Object.freeze({ 'stand.L': 'jab', 'stand.M': 'cross', 'stand.H': 'hook', 'crouch.M': 'bodyHook', 'crouch.H': 'uppercut' });
const GROUND_SLOTS = NORMAL_SLOTS.filter((s) => !s.startsWith('air.'));

/** A fighter's `moves` word read: 'hero' (the boxer's slots) or { <slot>: a strike word }. Throws naming the fault. */
export function readHeroMoves(v, where = 'moves') {
  if (v === 'hero') return { ...HERO_MOVE_SLOTS };
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${where} is 'hero' (the character's own punches in the boxer's slots: ${Object.entries(HERO_MOVE_SLOTS).map(([s, w]) => `${s} ${w}`).join(', ')}) or { <slot>: a strike }`);
  for (const [slot, w] of Object.entries(v)) {
    if (!GROUND_SLOTS.includes(slot)) throw new Error(`${where}.${slot}: a ground normal's slot (${GROUND_SLOTS.join(', ')})`);
    if (!HERO_MOVES[w]) throw new Error(`${where}.${slot}: '${w}' is not a strike the hero throws (${Object.keys(HERO_MOVES).join(', ')})`);
  }
  return { ...v };
}

const DEG = 180 / Math.PI, r1 = (x) => Math.round(x * 10) / 10 + 0;
/** a limb's angle in the plane (0 down, + forward) and a trunk's (0 up, + forward), from a to b */
const limbAng = (a, b) => r1(Math.atan2(b[0] - a[0], -(b[1] - a[1])) * DEG);
const trunkAng = (a, b) => r1(Math.atan2(b[0] - a[0], b[1] - a[1]) * DEG);
const SIDES = { F: 'R', B: 'L' };
/** the share of a segment's length its projection on the plane must keep for its direction there to be read */
const WEAK = 0.35;

/** A hero pose in the fight plane: its joints seen from the side (forward +x, up y, mm, x0 the origin's forward), read
 * back as the fight's angles; the pelvis's forward shift as `hip` */
export function planePose(R, pose, x0 = 0, { weak = null } = {}) {
  const n = rigNodesAt(R, pose).nodes, P = (j) => [(n[j][1] - x0) * 1000, n[j][2] * 1000];
  // (a segment seen nearly end-on, square to the plane, has no direction there worth reading: its projection under
  // WEAK of its length; `weak` collects those channels, 'armF.1' the lead forearm, for the track to fill)
  const seen = (a, b, k) => { if (!weak) return; const A = n[a], B = n[b], L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), l = Math.hypot(B[1] - A[1], B[2] - A[2]); if (l < WEAK * L) weak.add(k); };
  const pelvis = P('pelvisHub'), neck = P('neckHub'), head = P('headTop');
  const sh = [(n.shoulderR[1] + n.shoulderL[1]) / 2, (n.shoulderR[2] + n.shoulderL[2]) / 2].map((v, i) => (i ? v * 1000 : (v - x0) * 1000));
  const out = { torso: trunkAng(pelvis, neck), head: trunkAng(neck, head), hip: [Math.round(pelvis[0]), 0] };
  for (const [F, S] of Object.entries(SIDES)) {
    const knuck = n[`middleMcp${S}`] ? P(`middleMcp${S}`) : P(`wrist${S}`), L = R.legs[S];
    out[`arm${F}`] = [limbAng(sh, P(`elbow${S}`)), limbAng(P(`elbow${S}`), knuck)];
    seen(`shoulder${S}`, `elbow${S}`, `arm${F}.0`); seen(`elbow${S}`, n[`middleMcp${S}`] ? `middleMcp${S}` : `wrist${S}`, `arm${F}.1`);
    out[`leg${F}`] = [limbAng(pelvis, P(L.knee)), limbAng(P(L.knee), P(L.hock)), limbAng(P(L.hock), P(L.toeTip))];
  }
  return out;
}

/** a pose's angles each brought within half a turn of a reference pose's (the same direction, the nearer way round) */
export function unwrapped(pose, ref) {
  const near = (a, b) => (b === undefined ? a : r1(a + 360 * Math.round((b - a) / 360)));
  const out = { ...pose, torso: near(pose.torso, ref.torso), head: near(pose.head, ref.head) };
  for (const k of ['armF', 'armB', 'legF', 'legB']) out[k] = pose[k].map((a, i) => near(a, ref[k]?.[i]));
  return out;
}
/** the guard, in the plane: its held pose (the fight's rest) and its pelvis's forward (the plane's origin) */
export function heroGuard(R) {
  const g = heroStance('guard', R).clip.fn(1), x0 = rigNodesAt(R, g).nodes.pelvisHub[1];
  return { pose: planePose(R, g, x0), x0 };
}

/** A strike's track: its clip sampled evenly over its phase (`samples` + 1 poses, from the guard back to it), its
 * contact's share of the clip, its hand (F the lead's, B the rear's) */
export function heroTrack(R, word, { samples = 48 } = {}) {
  const fam = HERO_MOVES[word]; if (!fam) throw new Error(`versus-hero: '${word}' is not a strike the hero throws (${Object.keys(HERO_MOVES).join(', ')})`);
  const K = fam === 'box' ? heroBox(word, R) : heroStrike(word, R), { x0 } = heroGuard(R);
  // (each angle unwrapped from the one before it, the first from the guard's: a forearm standing up reads 179° one sample
  // and −179° the next, and a blend between them swung it down through the floor)
  let last = heroGuard(R).pose;
  const weak = [], raw = Array.from({ length: samples + 1 }, (_, i) => { const w = new Set(); const p = planePose(R, K.clip.fn(i / samples), x0, { weak: w }); weak.push(w); return p; });
  const poses = raw.map((p) => (last = unwrapped(p, last)));
  // (a channel seen end-on is filled from its nearest samples either side where it is seen, straight between them, and
  // the track unwrapped again: the hook's forearm crosses the body square to the plane)
  for (const k of ['armF.0', 'armF.1', 'armB.0', 'armB.1']) {
    const [ch, j] = k.split('.'), J = Number(j), ok = poses.map((_, i) => !weak[i].has(k));
    for (let i = 0; i < poses.length; i++) {
      if (ok[i]) continue;
      let a = i - 1; while (a >= 0 && !ok[a]) a--;
      let b = i + 1; while (b < poses.length && !ok[b]) b++;
      const va = a >= 0 ? poses[a][ch][J] : null, vb = b < poses.length ? poses[b][ch][J] : null;
      const v = va === null ? vb : vb === null ? va : va + (vb - va) * ((i - a) / (b - a));
      if (v !== null) poses[i] = { ...poses[i], [ch]: poses[i][ch].map((x, q) => (q === J ? r1(v) : x)) };
    }
  }
  last = heroGuard(R).pose;
  for (let i = 0; i < poses.length; i++) poses[i] = last = unwrapped(poses[i], last);
  return { word, hand: K.hand === 'R' ? 'F' : 'B', contact: Math.round((K.contact.t / K.seconds) * 1e4) / 1e4, poses };
}

/** A character's fight from its hero: its guard and a track per slot */
export function heroFight(R, moves) {
  const slots = readHeroMoves(moves);
  return { guard: heroGuard(R).pose, normals: Object.fromEntries(Object.entries(slots).map(([slot, w]) => [slot, { hero: heroTrack(R, w) }])) };
}
