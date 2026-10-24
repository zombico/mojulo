// hero-grip — HOLDING A SWORD: the sword placed first, the body solved to serve it. A guard names the sword's frame in
// the TARGET's frame (the grip's place by a landmark of the posed body, the point's aim at a mark on an opponent of the
// figure's own size or along a direction, the edge's facing), on one of the ready stances (hero-stance.js). Then:
//   • each hand closes on its station on the grip with gear's own hold (hero-gear.js gearMounts: the item's rest frame M
//     on the hand, the fist's grip centre t): the hand's frame wanted is the sword's frame times Mᵀ, and the wrist goes
//     where that frame puts the grip centre on the station;
//   • the arm reaches the wrist elbows down (hero-stance reachArm), its swivel then searched so the WRIST stays in range
//     (an elbow rises before a wrist breaks), and the wrist (flex, deviation, twist about the hand's rest axes, applied
//     in that order: W = Rt·Rd·Rf) turns the rest of the way: W = Fᵀ·m, F the forearm's frame;
//   • two hands close the chain: the upper hand a palm's width behind the guard, the lower a palm further toward the
//     pommel (or cupping the pommel on a grip shorter than two palms), both with the same rotation.
// The two REGIMES differ in the laws checked, not the solve: SKILLED holds keep the wrist in its functional range
// and the sword's weight carried close (its lever about the shoulder a small share of the worst, the arm out level);
// WEIGHTLESS holds (the anime) drop the weight and the lever and keep the hard body: the wrist's whole range, the blade
// clear of the body, the balance. A `Left` guard is its right-handed twin mirrored (the sword reflected through the
// figure's mid-plane, its flat side kept: the same item, not its mirror image). Pure: no dice, no clock.
import { rigNodesAt, boneFrames, solveTwoBone, HAND_POSES } from './station-loft-rig.js';
import { gearMounts } from './hero-gear.js';
import { keyedClip, mirrored } from './hero-jump.js';
import { elbowsDown } from './hero-elbow.js';
import { heroStance, reachArm, comOf, hull, margin } from './hero-stance.js';

/** the wrist's anatomical range, degrees [toward −, toward +] in the rig's signs (flex + the back of the hand up:
 * flexion 80, extension 70; deviation + toward the thumb: ulnar 35, radial 20; twist + palm down: supination and
 * pronation 85 from the thumb-up neutral): the hard body never passes it */
export const WRIST_RANGE = Object.freeze({ flex: [-80, 70], deviation: [-35, 20], twist: [-85, 85] });
/** the wrist's FUNCTIONAL range, where the hand works at ease: the ranges daily tasks use (Ryu et al. 1991: flexion 54,
 * extension 60, radial 17, ulnar 40 — here capped at the anatomical 35; the forearm's turn, Morrey et al. 1981: 50 each
 * way). A skilled held guard keeps inside it */
export const WRIST_EASE = Object.freeze({ flex: [-54, 60], deviation: [-35, 17], twist: [-50, 50] });
/** a strapped shield's hand (enarmes: the forearm through a strap, the fist on a grip): the straps lock the wrist's bend,
 * the forearm still turns */
export const STRAPPED = Object.freeze({ flex: [-8, 8], deviation: [-8, 8], twist: [-50, 50] });
/** kilograms: a body by its height (a body-mass index of 22), a sword by its class times its mass dial */
const BMI = 22;
const SWORD_KG = Object.freeze({ dagger: 0.35, sword: 1.1, greatsword: 2.4 });
/** a cutting sword balances about this share of its blade's length past the guard */
const BALANCE = 0.15;
/** the hands' spacing on a grip: a palm's width (the index to the little finger's knuckle) and this much more */
const PALM_GAP = 1.15;

/**
 * The guards: design words, every one right-handed (a `Left` twin is its mirror).
 *   regime  'skilled' | 'weightless'       stance  a hero-stance name (its Left twin for a left-foot lead)
 *   hands   2 (both on one grip, R the upper) | 1 (R alone) — a dual guard names `off`, a shield guard `shield`
 *   grip    a GRIPS word: handshake (the default) | hammer | reverse | reverseHammer
 *   at      the grip's middle (between the two hands; the one hand's fist): { at: belly | navel | chest | chin | forehead |
 *           shoulderR | shoulderL | hipR | hipL, fwd, up, side (metres: toward the target, up, toward the right),
 *           line: true measured from the target line }
 *   point   the blade's aim: { at: eyes | throat | chest | knees, far (metres from the pelvis to an opponent of the
 *           figure's own size) } or a direction { fwd, up, side }
 *   edge    the true edge's facing, a direction { fwd, up, side } (taken square to the blade)
 *   sword   the item's build words (equipment/expand.js)          tradition  where the guard comes from
 *   trunk   the guard's own turn on its stance's spine: { turn, lean, bow } (withTrunk)
 */
const KATANA = Object.freeze({ item: 'sword', style: 'eastern' });
const ARMING = Object.freeze({ item: 'sword', style: 'historical' });
export const GUARDS = Object.freeze({
  // ── SKILLED, TWO HANDS ──
  chudan: { regime: 'skilled', stance: 'centre', hands: 2, sword: KATANA, tradition: 'chūdan · Pflug · posta breve',
    at: { at: 'belly', fwd: 0.4, up: -0.03, side: 0, line: true }, point: { at: 'throat', far: 1.7 }, edge: { up: -1 } },
  jodan: { regime: 'skilled', stance: 'centre', hands: 2, sword: KATANA, tradition: 'jōdan · vom Tag (above) · posta di finestra',
    at: { at: 'forehead', fwd: 0.16, up: 0.06, side: 0, line: true }, point: { fwd: -0.5, up: 0.86, side: 0.06 }, edge: { up: 1, fwd: 0.6 } },
  hasso: { regime: 'skilled', stance: 'centreLeft', hands: 2, sword: KATANA, tradition: 'hassō · vom Tag (at the shoulder)',
    at: { at: 'shoulderR', fwd: 0.2, up: 0.04, side: -0.06 }, point: { fwd: -0.25, up: 1, side: 0.05 }, edge: { fwd: 1 } },
  gedan: { regime: 'skilled', stance: 'centre', hands: 2, sword: KATANA, tradition: 'gedan · Alber · dente di zenghiaro',
    at: { at: 'belly', fwd: 0.36, up: -0.16, side: 0, line: true }, point: { at: 'knees', far: 1.5 }, edge: { up: -1 } },
  // the trunk turned toward the sword (the stance's turn back to the target eased) and bowed a little over it, the hilt
  // out past the right hip so the back arm stands apart from the waist, its elbow lifted out
  waki: { regime: 'skilled', stance: 'guardLeft', hands: 2, sword: KATANA, tradition: 'waki · Nebenhut · Schrankhut', trunk: { turn: -0.4, bow: 0.2 },
    at: { at: 'hipR', fwd: 0.2, up: 0.22, side: 0.44 }, point: { fwd: -0.6, up: -0.5, side: 0.8 }, edge: { up: -1, side: 1 } },
  // ── SKILLED, ONE HAND ──
  terza: { regime: 'skilled', stance: 'fencing', hands: 1, sword: ARMING, tradition: 'terza (rapier, arming sword)',
    at: { at: 'shoulderR', fwd: 0.32, up: -0.28, side: 0, line: true }, point: { at: 'eyes', far: 1.9 }, edge: { up: -1 } },
  hanging: { regime: 'skilled', stance: 'guard', hands: 1, sword: ARMING, tradition: 'prima · hanging guard (sabre)',
    at: { at: 'shoulderR', fwd: 0.36, up: 0.24, side: -0.16 }, point: { fwd: 0.5, up: -0.7, side: -0.5 }, edge: { up: 1 } },
  // ── SKILLED, DUAL: the long sword and the short, their points converging on the face (Niten Ichi-ryū) ──
  niten: { regime: 'skilled', stance: 'centre', hands: 1, sword: KATANA, off: { sword: { item: 'dagger', style: 'eastern' }, at: { at: 'belly', fwd: 0.34, up: 0, side: -0.2, line: true } },
    tradition: 'Niten Ichi-ryū (both in chūdan) · sword and dagger',
    at: { at: 'belly', fwd: 0.34, up: 0, side: 0.12, line: true }, point: { at: 'eyes', far: 1.7 }, edge: { up: -1 } },
  // ── SKILLED, SHIELD: the shield leads on the left forearm, the sword high behind its rim, the point over it ──
  shield: { regime: 'skilled', stance: 'guardLeft', hands: 1, sword: ARMING, shield: { sword: { item: 'shield', style: 'historical' }, at: { at: 'chest', fwd: 0.22, up: 0, side: 0.04, line: true }, face: { fwd: 1 }, up: { up: 1 }, strap: 10 },
    tradition: 'high guard over the shield (round or heater shield)',
    at: { at: 'shoulderR', fwd: 0.12, up: 0.32, side: 0.28 }, point: { fwd: 1, up: 0.12, side: 0 }, edge: { up: 1, side: 1 } },
  // ── WEIGHTLESS (the anime): the blade costs nothing to hold out ──
  challenge: { regime: 'weightless', stance: 'fencing', hands: 1, sword: KATANA, tradition: 'the outstretched challenge',
    at: { at: 'shoulderR', fwd: 0.56, up: -0.04, side: 0, line: true }, point: { at: 'eyes', far: 2.2 }, edge: { up: -1 } },
  reverse: { regime: 'weightless', stance: 'low', hands: 1, grip: 'reverseHammer', sword: KATANA, tradition: 'the reverse grip',
    at: { at: 'chest', fwd: 0.38, up: -0.08, side: 0.2 }, point: { fwd: -0.45, up: -0.35, side: 0.82 }, edge: { side: 1, up: 0.3 } },
  trailing: { regime: 'weightless', stance: 'guard', hands: 1, sword: KATANA, tradition: 'the trailing low blade (the dash)',
    at: { at: 'hipR', fwd: -0.12, up: -0.15, side: 0.26 }, point: { fwd: -0.6, up: -0.5, side: 0.8 }, edge: { side: -1 } },
});
export const GUARD_NAMES = Object.freeze(Object.keys(GUARDS).flatMap((n) => [n, `${n}Left`]));

// ─── a small vector and matrix kit (3×3 as rows; M·v; columns → rows) ───────────────────────────────────────────────
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]), unit = (a) => mul(a, 1 / (len(a) || 1)), dist = (a, b) => len(sub(a, b));
const mv = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
const T = (m) => [0, 1, 2].map((i) => [m[0][i], m[1][i], m[2][i]]);
const mm = (a, b) => a.map((row) => [0, 1, 2].map((j) => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
const fromColumns = (X, Y, Z) => [[X[0], Y[0], Z[0]], [X[1], Y[1], Z[1]], [X[2], Y[2], Z[2]]];
const col = (m, j) => [m[0][j], m[1][j], m[2][j]];
const deg = (r) => (r * 180) / Math.PI;
const angle = (a, b) => deg(Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))));
/** the angle (degrees) of the rotation taking frame a to frame b */
const turnBetween = (a, b) => { const r = mm(T(a), b); return deg(Math.acos(Math.max(-1, Math.min(1, (r[0][0] + r[1][1] + r[2][2] - 1) / 2)))); };
const r1 = (x) => +x.toFixed(1), r4 = (x) => +x.toFixed(4);
const MIRROR = [[-1, 0, 0], [0, 1, 0], [0, 0, 1]];
/** a direction in the target's frame ({ fwd, up, side }) in the rig's: +y the target, +x the right */
const dirOf = (v) => unit([v.side || 0, v.fwd || 0, v.up || 0]);
export const liteOf = (R) => ({ ...R, rides: {}, chains: {}, folds: undefined });

/** a landmark on the posed body (the rig's frame) */
export function landmark(n, at) {
  const mid = (a, b) => mul(add(a, b), 0.5);
  // the belly button: about a fifth of the way from the hip joints up to the neck's base (the rig's `navel` is the
  // spine's middle joint, a hand higher)
  if (at === 'belly') return add(n.pelvisHub, mul(sub(n.neckHub, n.pelvisHub), 0.22));
  if (at === 'navel') return [...n.navel];
  if (at === 'chest') return add(mid(n.shoulderL, n.shoulderR), [0, 0, -0.12]);
  if (at === 'chin') return add(n.headBase, [0, 0, -0.03]);
  if (at === 'forehead') return add(n.headBase, mul(sub(n.headTop, n.headBase), 0.7));
  if (at === 'eyes') return add(n.headBase, mul(sub(n.headTop, n.headBase), 0.45));
  if (at === 'throat') return add(n.neckHub, mul(sub(n.headBase, n.neckHub), 0.5));
  if (at === 'knees') return mid(n.kneeL, n.kneeR);
  if (/^(shoulder|hip)[LR]$/.test(at)) return [...n[at]];
  throw new Error(`hero-grip: no landmark '${at}' (belly, navel, chest, chin, forehead, eyes, throat, knees, shoulderR/L, hipR/L)`);
}
// (`reach` < 1: a shorter arm's guard, the place drawn in toward the shoulders' midpoint by the arm's shortening; 1 is
// the place as the words put it)
const placeOf = (n, h, reach = 1) => {
  const lm = landmark(n, h.at), p = [(h.line ? 0 : lm[0]) + (h.side || 0), lm[1] + (h.fwd || 0), lm[2] + (h.up || 0)];
  if (reach === 1) return p;
  const c = mul(add(n.shoulderL, n.shoulderR), 0.5);
  return add(c, mul(sub(p, c), reach));
};
/** where an `at` aim points: the same mark on an opponent of the figure's own size, `far` metres before its pelvis */
const markOf = (n, p) => { const lm = landmark(n, p.at); return [0, n.pelvisHub[1] + p.far, lm[2]]; };

// ─── the sword in the hand ────────────────────────────────────────────────────────────────────────────────────────────
/**
 * THE GRIPS: the blade's angle off the hand's long axis (the wrist to the knuckles), in the thumb's plane. The hilt lies
 * across the palm; how far it rolls toward the heel of the hand is the grip:
 *   hammer     45°: the fist closed square round the hilt (gear's own hold, hero-gear.js): the cut's grip
 *   handshake  25°: the hilt rolled along the palm, the pommel at its heel (the sabre's, the rapier's, the tenouchi of
 *              the Japanese two-hand grip): the point's grip, the blade nearer the forearm's line
 * and either REVERSED (`reverse` the handshake's, `reverseHammer` the hammer's): the blade out of the little finger's
 * side, turned half about the edge.
 */
export const GRIPS = Object.freeze({ hammer: { angle: 45 }, handshake: { angle: 25 }, reverse: { angle: 25, reverse: true }, reverseHammer: { angle: 45, reverse: true } });
const GEAR_ANGLE = 45;
/** each hand's mount of an item (gearMounts' rest hold) for a grip: the hilt rolled about the palm's normal (the item's
 * y) through the grip centre, so the blade turns toward the hand's axis; a reverse grip then turned half about the edge */
export function mountOf(R, build, side, grip = 'handshake') {
  const G = gearMounts({ head: 'anime', gear: { [side === 'R' ? 'right' : 'left']: build } }, R)[0];
  const g = GRIPS[grip]; if (!g) throw new Error(`hero-grip: no grip '${grip}' (have ${Object.keys(GRIPS).join(', ')})`);
  const d = ((GEAR_ANGLE - g.angle) * Math.PI) / 180, c = Math.cos(d), sn = Math.sin(d);
  let M = mm(G.M, [[c, 0, sn], [0, 1, 0], [-sn, 0, c]]);
  if (g.reverse) M = mm(M, [[1, 0, 0], [0, -1, 0], [0, 0, -1]]);
  return { ...G, M, grip };
}
/** a strapped shield in the hand: gear's forearm hold (its height along the forearm, its face out) turned in the board's
 * plane so the forearm crosses the board, the elbow out to the shield's outer edge `strap` degrees below level; carried
 * by the HAND (its fist on the grip), so the forearm's turn turns it */
function shieldMount(R, build, side, strap = 30) {
  const G = gearMounts({ head: 'anime', gear: { [side === 'R' ? 'right' : 'left']: build } }, R)[0];
  const a = (-(90 + strap) * (side === 'L' ? 1 : -1) * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
  return { ...G, M: mm(G.M, [[c, 0, sn], [0, 1, 0], [-sn, 0, c]]), bone: `hand${side}`, boneIndex: R.boneIndex[`hand${side}`] };
}
/** the item's stations (its own cm, along +z): the hands' grip centres, the guard, the tip, the balance; `pommel` when the
 * lower hand cups the pommel (a grip shorter than two palms) */
export function stationsOf(G, R, hands) {
  const g = G.sockets.grip, z0 = g.origin[2] - g.length / 2, z1 = g.origin[2] + g.length / 2, guard = G.sockets.guard?.origin?.[2] ?? z1;
  const palm = (PALM_GAP * dist(R.joints.indexMcpR ?? R.joints.knucklesR, R.joints.littleMcpR ?? R.joints.knucklesR)) / G.k;
  const upper = Math.max(z0 + palm / 2, Math.min(z1, guard) - palm / 2);
  const lower = hands === 2 ? upper - palm : null; const pommel = hands === 2 && lower - palm / 2 < z0 - 1e-9;
  const tip = G.sockets.tip?.origin ?? [0, 0, G.trace.length];
  return { upper, ...(hands === 2 ? { lower: pommel ? z0 : lower, pommel } : {}), guard, tip, balance: guard + BALANCE * (tip[2] - guard), z0, z1 };
}
/** an item's point (its cm) in the world for a sword frame { W (item → rig rotation), at (the world point of item z = s) } */
const itemPoint = (F, G, q) => add(F.at, mv(F.W, mul(sub(q, [0, 0, F.s]), G.k)));
/** the sword's frame from the guard's words on the posed body: the grip's middle at `at`, the blade's CHORD (the guard
 * to the tip: a curved blade's point is off its grip's line) along the aim, the edge square to it as the words face it */
function swordFrame(n, words, G, st, reach = 1) {
  const mid = placeOf(n, words.at, reach);
  const aim = words.point.at ? unit(sub(markOf(n, words.point), mid)) : dirOf(words.point);
  const e = dirOf(words.edge); let edge = sub(e, mul(aim, dot(e, aim)));
  if (len(edge) < 1e-6) throw new Error('hero-grip: the edge lies along the blade');
  edge = unit(edge);
  const c = unit(sub(st.tip, [0, 0, st.guard])), x = unit(sub([1, 0, 0], mul(c, c[0])));
  const W = mm(fromColumns(edge, cross(aim, edge), aim), T(fromColumns(x, cross(c, x), c)));
  const s = st.lower !== undefined && st.lower !== null ? (st.upper + st.lower) / 2 : st.upper;
  return { W, at: mid, s, aim, edge, x };
}
/** a hand's wanted frame and wrist for its station on a sword frame */
function handWant(R, G, F, station, side) {
  const m = mm(F.W, T(G.M)); const P = itemPoint(F, G, [0, 0, station]);
  return { m, P, wrist: sub(P, mv(m, sub(G.t, R.joints[`wrist${side}`]))) };
}

// ─── the wrist ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** the wrist channel that turns a hand from the forearm's frame F to the frame m: W = Fᵀ·m = Rt(twist)·Rd(dev)·Rf(flex)
 * about the hand's rest axes (flex × deviation = twist, a right-handed set), read as Z-Y-X angles in that basis */
export function wristFor(R, side, F, m) {
  const A = R.hands[side].axes, B = fromColumns(A.flex, A.deviation, A.twist);
  const L = mm(T(B), mm(mm(T(F), m), B));
  const dev = -Math.asin(Math.max(-1, Math.min(1, L[2][0])));
  return { flex: deg(Math.atan2(L[2][1], L[2][2])), deviation: deg(dev), twist: deg(Math.atan2(L[1][0], L[0][0])) };
}
/** a frame turning rest vectors (a0, b0) onto posed (a1, b1): a exactly, b as near as square to a allows */
const alignFrame = (a0, b0, a1, b1) => {
  const basis = (a, b) => { const x = unit(a), z = unit(cross(x, b)); return fromColumns(x, cross(z, x), z); };
  return mm(basis(a1, b1), T(basis(a0, b0)));
};
/**
 * THE ANATOMICAL FOREARM (rest → posed): the rig's forearm frame is the shortest turn of its line, which forgets the
 * upper arm's own roll; the wrist's laws are read against the forearm as the elbow carries it. The mid-prone thumb lies
 * in the elbow's flexion plane, square to the forearm, away from the upper arm (the hinge axis h = upper × forearm;
 * the thumb h × forearm); a nearly straight arm takes h from the shoulder line instead (the swivel carries the rest's),
 * blended in over 10–30° of bend. The rest is the same rule on the rest arm (the hand hangs mid-prone, thumb forward).
 */
export function anatomicalForearm(R, n, side) {
  const thumb = (sh, el, wr, lat) => {
    const u = unit(sub(el, sh)), a = unit(sub(wr, el)), bend = angle(u, a), hp = cross(u, a);
    const w = Math.max(0, Math.min(1, (bend - 10) / 20)), k = w * w * (3 - 2 * w);
    const h = unit(add(mul(unit(lat), 1 - k), mul(len(hp) > 1e-9 ? unit(hp) : unit(lat), k)));
    return [a, cross(h, a)];
  };
  const J = R.joints;
  const [a0, t0] = thumb(J[`shoulder${side}`], J[`elbow${side}`], J[`wrist${side}`], sub(J.shoulderR, J.shoulderL));
  const [a1, t1] = thumb(n[`shoulder${side}`], n[`elbow${side}`], n[`wrist${side}`], sub(n.shoulderR, n.shoulderL));
  return alignFrame(a0, t0, a1, t1);
}
/** the upper arm's turn about its own line, degrees (+ outward), and its anatomical range: a shoulder rotates the humerus
 * about 90° each way from neutral, so the elbow's crease faces forward-and-in, never back */
export const HUMERAL_RANGE = Object.freeze([-90, 90]);
/**
 * THE HUMERUS'S TURN on a posed body: the elbow's hinge axis (upper × forearm: the flexion plane's normal) against the
 * neutral one, the shoulder line carried from the hanging arm to this one by the shortest turn (a hanging arm with its
 * forearm bent forward reads 0); + outward (the forearm swung away from the belly). A nearly straight arm has no plane: 0.
 */
export function humeralTurn(n, side) {
  const u = unit(sub(n[`elbow${side}`], n[`shoulder${side}`])), a = unit(sub(n[`wrist${side}`], n[`elbow${side}`]));
  if (angle(u, a) < 15) return 0;
  const h = unit(cross(u, a));
  const down = mul(unit(sub(n.neckHub, n.pelvisHub)), -1), lat = unit(sub(n.shoulderR, n.shoulderL));
  // carry the shoulder line by the shortest turn from hanging (down the trunk) to the upper arm
  const k = cross(down, u), s = len(k), c = dot(down, u);
  let h0 = lat;
  if (s > 1e-9) { const kk = mul(k, 1 / s); h0 = add(add(mul(lat, c), mul(cross(kk, lat), s)), mul(kk, dot(kk, lat) * (1 - c))); }
  h0 = unit(sub(h0, mul(u, dot(h0, u))));
  const ang = deg(Math.atan2(dot(cross(h0, h), u), dot(h0, h)));
  return side === 'R' ? ang : -ang;
}
/**
 * THE ARM CLEAR OF THE TRUNK: the nearest the upper arm and the forearm (their lines) come to the trunk's (the pelvis to
 * the neck), less what a slim trunk and an arm take up (a third of the shoulder span, and 4 cm of arm at the canonical
 * height): metres, + clear. An arm pressed into the waist reads as a collision, and a held guard shows the arm apart.
 */
export function armClear(R, n, side) {
  const segDist = (p1, q1, p2, q2) => { let best = Infinity; for (let i = 0; i <= 16; i++) { const p = add(p1, mul(sub(q1, p1), i / 16)), ab = sub(q2, p2), t = Math.max(0, Math.min(1, dot(sub(p, p2), ab) / dot(ab, ab))); best = Math.min(best, dist(p, add(p2, mul(ab, t)))); } return best; };
  const need = 0.32 * dist(R.joints.shoulderR, R.joints.shoulderL) + 0.04 * ((R.joints.headTop?.[2] ?? 1.674) / 1.674);
  // the upper arm from a little below its shoulder (the joint itself sits on the trunk's edge)
  const sh = add(n[`shoulder${side}`], mul(sub(n[`elbow${side}`], n[`shoulder${side}`]), 0.35));
  return Math.min(segDist(sh, n[`elbow${side}`], n.pelvisHub, n.neckHub), segDist(n[`elbow${side}`], n[`wrist${side}`], n.pelvisHub, n.neckHub)) - need;
}
/** how far a wrist strays past a band (degrees, summed in quadrature) */
const strayOf = (w, band) => Math.hypot(...Object.entries(band).map(([k, [lo, hi]]) => Math.max(0, lo - w[k], w[k] - hi)));

/** Levenberg–Marquardt on a residual f(x) (an array) from x0, inside [lo, hi]: → { x, c (the squared residual) } */
function lm(f, x0, lo, hi, iters = 40) {
  const clampX = (x) => x.map((v, i) => Math.max(lo[i], Math.min(hi[i], v)));
  let x = clampX(x0), r = f(x), c = r.reduce((a, v) => a + v * v, 0), lam = 1e-3; const N = x.length;
  for (let it = 0; it < iters; it++) {
    const J = []; for (let j = 0; j < N; j++) { const xp = [...x]; xp[j] += 0.05; const rp = f(clampX(xp)); J.push(rp.map((v, i) => (v - r[i]) / 0.05)); }
    const A = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => J[i].reduce((a, v, k) => a + v * J[j][k], 0)));
    const g = J.map((Ji) => Ji.reduce((a, v, k) => a + v * r[k], 0));
    let moved = false;
    for (let tries = 0; tries < 8 && !moved; tries++) {
      const M = A.map((row, i) => row.map((v, j) => v + (i === j ? lam * (A[i][i] + 1e-9) : 0))), b = g.map((v) => -v);
      for (let i = 0; i < N; i++) { let p = i; for (let k = i + 1; k < N; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k; [M[i], M[p]] = [M[p], M[i]]; [b[i], b[p]] = [b[p], b[i]]; for (let k = i + 1; k < N; k++) { const q = M[k][i] / (M[i][i] || 1e-12); for (let l = i; l < N; l++) M[k][l] -= q * M[i][l]; b[k] -= q * b[i]; } }
      const dx = Array(N).fill(0); for (let i = N - 1; i >= 0; i--) { let v = b[i]; for (let l = i + 1; l < N; l++) v -= M[i][l] * dx[l]; dx[i] = v / (M[i][i] || 1e-12); }
      const xn = clampX(x.map((v, i) => v + dx[i])), rn = f(xn), cn = rn.reduce((a, v) => a + v * v, 0);
      if (cn < c) { const step = Math.hypot(...xn.map((v, i) => v - x[i])); x = xn; r = rn; c = cn; lam = Math.max(1e-7, lam / 3); moved = true; if (step < 1e-3) return { x, c }; }
      else lam *= 4;
    }
    if (!moved) break;
  }
  return { x, c };
}

/**
 * One arm to a hand frame: the wrist to `goal` (the rig's frame), the elbow's swivel chosen so the wrist turns least past
 * its functional range (and never past its anatomical one) with the elbow as low as that allows, the wrist then the rest of the
 * way. → { sh, elbow, lift (m, the elbow off its elbows-down place), wrist (the channel), anatomy (the wrist the laws read), err (m),
 * stray (degrees past the functional range) }. `pole` bends the elbow another way first (a shield arm's, out); `range`
 * weighs a degree past the wrist's anatomical range against the fist's millimetres (a guard's √½: as one), `clear` a
 * metre of the arm pressed into the trunk (a guard's 100: a centimetre as a millimetre).
 */
export function holdArm(R, body, side, goal, m, { pole = null, skilled = true, band = WRIST_EASE, range = Math.SQRT1_2, clear = 100 } = {}) {
  const lite = liteOf(R), fa = { bones: [R.bones[R.boneIndex[`foreArm${side}`]]] };
  const l1 = dist(R.joints[`shoulder${side}`], R.joints[`elbow${side}`]), l2 = dist(R.joints[`elbow${side}`], R.joints[`wrist${side}`]);
  const nodesOf = (x) => rigNodesAt(lite, elbowsDown(R, { ...body, [`sh${side}`]: { pitch: x[0], yaw: x[1], roll: x[3] }, [`elbow${side}`]: x[2] })).nodes;
  // the channel (what the rig turns the hand by, off its own forearm frame) and the anatomy (what the laws read)
  const read = (n) => ({ ch: wristFor(R, side, boneFrames(fa, R.joints, n)[0].m, m), w: wristFor(R, side, anatomicalForearm(R, n, side), m) });
  const LO = [-40, -100, 0, -160], HI = [175, 100, 150, 160];
  // THE SWIVEL: with the wrist placed the arm has one freedom left, the elbow's turn about the shoulder → wrist line; the
  // one kept lifts the elbow least (off its elbows-down place) for the wrist's ease. Elbows
  // down is a style, the wrist's range a law: a degree of wrist past its anatomical range weighs as a metre of the elbow
  // off its down place (the hard body: a wrist never breaks); past its functional range, for a skilled hold, as ten
  // centimetres (a held guard is at ease: the elbow lifts first), for a weightless one as one
  const down = pole ?? [side === 'R' ? 0.25 : -0.25, 0, -1];
  const elbowFor = (n, P) => { const sh = n[`shoulder${side}`]; const d = dist(sh, goal), k = Math.min(1, (0.999 * (l1 + l2)) / d); const sol = solveTwoBone(sh, add(sh, mul(sub(goal, sh), k)), l1, l2, P); return sol.ok ? sol.mid : n[`elbow${side}`]; };
  const reachTo = (P, x0) => lm((x) => { const n = nodesOf(x); const w = sub(n[`wrist${side}`], goal), e = mul(sub(n[`elbow${side}`], elbowFor(n, P)), 0.3); return [...w, ...e]; }, x0, LO, HI);
  const a0 = reachArm(R, body, side, goal, null, { pole: down });
  const x0 = reachTo(down, [a0.sh.pitch, a0.sh.yaw ?? 0, a0.elbow, a0.sh.roll ?? 0]).x;
  const E0 = nodesOf(x0)[`elbow${side}`];
  // the whole score as residuals (its square is the score), so a final Levenberg–Marquardt can trade every term at once;
  // the fist lands before all (a millimetre off weighs as a degree past the wrist's anatomical range); the humerus turns
  // no further than a shoulder can (the elbow never folds backward), weighed as the wrist's range; the arm keeps clear of
  // the trunk (a centimetre in weighs as a degree past the wrist's range: the elbow lifts and swings out first)
  const ease = skilled ? 5e-3 : 5e-5;
  const over = (w, band, k) => Object.entries(band).map(([a, [lo, hi]]) => k * Math.max(0, lo - w[a], w[a] - hi));
  const resid = (x) => { const n = nodesOf(x); const { w } = read(n); return [...mul(sub(n[`wrist${side}`], goal), 1000), ...mul(sub(n[`elbow${side}`], E0), Math.SQRT1_2), ...over(w, band, Math.sqrt(ease)), ...over(w, WRIST_RANGE, range), Math.SQRT1_2 * Math.max(0, HUMERAL_RANGE[0] - humeralTurn(n, side), humeralTurn(n, side) - HUMERAL_RANGE[1]), clear * Math.max(0, -armClear(R, n, side))]; };
  const score = (x) => resid(x).reduce((a, v) => a + v * v, 0);
  // the arm reaches a wrist in several separate ways (the roll's range and the elbow's one-way hinge split them), so the
  // seeds are elbows-down's and the best distinct ways a coarse grid finds to reach the wrist, each settled on the whole
  // score by Levenberg–Marquardt
  const grid = [];
  for (let p = -30; p <= 170; p += 20) for (let y = -90; y <= 90; y += 30) for (let e = 0; e <= 150; e += 30) for (let r = -150; r <= 150; r += 50) grid.push({ x: [p, y, e, r], d: dist(nodesOf([p, y, e, r])[`wrist${side}`], goal) });
  grid.sort((a, b) => a.d - b.d);
  const seeds = [x0];
  for (const g of grid) { if (seeds.length >= 9) break; if (seeds.every((q) => Math.abs(q[2] - g.x[2]) > 25 || Math.abs(q[3] - g.x[3]) > 40 || Math.abs(q[1] - g.x[1]) > 25)) seeds.push(g.x); }
  let best = null;
  for (const sd of seeds) { const r = lm(resid, sd, LO, HI, 60); if (!best || r.c < best.c) best = { x: r.x, phi: sd === x0 ? 0 : null, c: r.c }; }
  const x = best.x.map(r1); const n = nodesOf(x); const { ch, w } = read(n);
  return { sh: { pitch: x[0], yaw: x[1], roll: x[3] }, elbow: x[2], lift: r4(dist(n[`elbow${side}`], E0)), wrist: { flex: r1(ch.flex), deviation: r1(ch.deviation), twist: r1(ch.twist) },
    anatomy: { flex: r1(w.flex), deviation: r1(w.deviation), twist: r1(w.twist) }, err: r4(dist(n[`wrist${side}`], goal)), stray: r1(strayOf(w, band)) };
}

// ─── the guard ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** a guard's own TRUNK on its stance's: `turn` (share of the spine's axial range, + to the body's left), `lean` (its side
 * bend, + to the right), `bow` (its forward bend), each added to the stance's spine */
export const withTrunk = (body, t) => {
  if (!t) return body;
  const sp = body.spine || { sagittal: 0, lateral: 0, axial: 0 }; const c = (v) => Math.max(-1, Math.min(1, v));
  return { ...body, spine: { sagittal: c((sp.sagittal || 0) + (t.bow || 0)), lateral: c((sp.lateral || 0) + (t.lean || 0)), axial: c((sp.axial || 0) + (t.turn || 0)) } };
};
const ARM_KEYS = ['shL', 'shR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'fingersL', 'fingersR'];
const without = (pose, keys) => Object.fromEntries(Object.entries(pose).filter(([k]) => !keys.includes(k)));

/** a guard solved right-handed: { G (mounts by side), st (stations), frame, arms (the arm, wrist and finger channels),
 * held (the whole held pose), stance, off / shield (their frames) } */
function solveGuard(K, R, reach = 1) {
  const stance = heroStance(K.stance, R); const body = withTrunk(without(stance.hold, ARM_KEYS), K.trunk);
  const n0 = rigNodesAt(liteOf(R), elbowsDown(R, body)).nodes;
  const G = { R: mountOf(R, K.sword, 'R', K.grip) }; if (K.hands === 2) G.L = mountOf(R, K.sword, 'L', K.grip);
  const st = stationsOf(G.R, R, K.hands);
  const frame = swordFrame(n0, K, G.R, st, reach);
  const arms = {}; const holds = {};
  const want = { R: handWant(R, G.R, frame, st.upper, 'R') };
  if (K.hands === 2) want.L = handWant(R, G.L, frame, st.lower, 'L');
  let off = null, shield = null;
  if (K.off) {
    // the second blade: its own guard words (the point and edge the main guard's), on the left hand
    G.L = mountOf(R, K.off.sword, 'L'); const so = stationsOf(G.L, R, 1);
    off = swordFrame(n0, { ...K, at: K.off.at }, G.L, so, reach); off.st = so;
    want.L = handWant(R, G.L, off, so.upper, 'L');
  }
  for (const side of Object.keys(want)) {
    const a = holdArm(R, body, side, want[side].wrist, want[side].m, { skilled: K.regime === 'skilled' }); holds[side] = a;
    Object.assign(arms, { [`sh${side}`]: a.sh, [`elbow${side}`]: a.elbow, [`wrist${side}`]: a.wrist, [`fingers${side}`]: { ...HAND_POSES.grip } });
  }
  if (K.shield) {
    // the shield placed first like the sword (its grip, the fist, where the words say; its face and its top as they say),
    // then held by the left hand on its grip, the wrist locked by the straps
    G.L = shieldMount(R, K.shield.sword, 'L', K.shield.strap);
    const face = dirOf(K.shield.face ?? { fwd: 1 }), up0 = dirOf(K.shield.up ?? { up: 1 }), up = unit(sub(up0, mul(face, dot(up0, face))));
    const Y = mul(face, -1), W = fromColumns(cross(Y, up), Y, up);
    const m = mm(W, T(G.L.M)), P = placeOf(n0, K.shield.at, reach);
    want.L = { m, P, wrist: sub(P, mv(m, sub(G.L.t, R.joints.wristL))) };
    const a = holdArm(R, body, 'L', want.L.wrist, m, { skilled: K.regime === 'skilled', band: STRAPPED }); holds.L = a;
    Object.assign(arms, { shL: a.sh, elbowL: a.elbow, wristL: a.wrist, fingersL: { ...HAND_POSES.grip } });
    shield = true;
  }
  const held = { ...body, ...arms };
  return { stance, body, G, st, frame, off, shield, want, holds, arms, held };
}

/** the sword's frame as the posed hand carries it (the hand bone's frame times the hold), for the card and the checks:
 * { W, at (the station's world point), s } */
export function carriedFrame(R, frames, G, side, station) {
  const f = frames[R.boneIndex[`hand${side}`]]; const W = mm(f.m, G.M);
  const at = add(f.head, mv(f.m, sub(G.t, R.joints[`wrist${side}`])));
  return { W, at, s: station };
}
/** an item's posed world point (its cm) */
export const swordPoint = itemPoint;

/**
 * A guard on a rig: { name, regime, stance, tradition, hands, grip, clip (the stance's enter, the arms closing into the
 * guard), hold (the held pose), swords: [{ side, G, station, item }] (what each hand carries: carriedFrame), mounts (the
 * same as gear mounts, for gearFaces), checks }. `reach` (1) is the arm's length over the one the guard words were
 * placed for: a hero whose arm took hero-form ARM_LENGTH (laws 5) holds every guard drawn in by it (hero-form armReach).
 */
export function heroGuard(name, R, { seconds = 0.9, left: asLeft = false, reach = 1 } = {}) {
  // a guard by name, or its words themselves (an authored guard: `left` asks its mirror)
  const own = typeof name === 'object' && name;
  const left = own ? asLeft : /Left$/.test(name) && GUARDS[name.slice(0, -4)]; const base = own ? 'own' : left ? name.slice(0, -4) : name;
  const K = own || GUARDS[base]; if (!K) throw new Error(`hero-grip: no guard '${name}' (have ${GUARD_NAMES.join(', ')})`);
  if (own) name = left ? 'ownLeft' : 'own';
  const S = solveGuard(K, R, reach);
  // the enter: the stance's own steps, the last key's arms the guard's, its wrists and fingers closing on the grip
  const keysR = S.stance.keys.map((k, i, all) => (i === all.length - 1 ? { ...k, pose: { ...withTrunk(without(k.pose, ARM_KEYS), K.trunk), ...S.arms } } : k));
  const keys = left ? mirrored(keysR) : keysR;
  const clip = keyedClip({ seconds, keys }, R); const hold = clip.fn(1);
  const flip = (s) => (left ? (s === 'R' ? 'L' : 'R') : s);
  const swords = [{ side: flip('R'), G: left ? mountOf(R, K.sword, 'L', K.grip) : S.G.R, station: S.st.upper, item: K.sword.item }];
  if (K.off) swords.push({ side: flip('L'), G: left ? mountOf(R, K.off.sword, 'R') : S.G.L, station: S.off.st.upper, item: K.off.sword.item });
  if (K.shield) swords.push({ side: flip('L'), G: left ? shieldMount(R, K.shield.sword, 'R', K.shield.strap) : S.G.L, shield: true, item: 'shield' });
  // the frame each hand should hold, mirrored with the guard (the sword reflected, its flat kept: an item, not its image)
  const mirrorFrame = (F) => (left ? { ...F, W: mm(mm(MIRROR, F.W), [[1, 0, 0], [0, -1, 0], [0, 0, 1]]), at: mv(MIRROR, F.at), aim: mv(MIRROR, F.aim), edge: mv(MIRROR, F.edge) } : F);
  const want = Object.fromEntries(Object.entries(S.want).map(([s, w]) => [flip(s), { m: left ? mm(mm(MIRROR, w.m), MIRROR) : w.m, P: left ? mv(MIRROR, w.P) : w.P }]));
  // each hand's mount on what it holds (the lower hand of two on the same sword; the off hand on its own blade)
  const second = K.hands === 2 ? K.sword : K.off ? K.off.sword : null;
  const byHand = { [flip('R')]: swords[0].G, ...(second ? { [flip('L')]: left ? mountOf(R, second, 'R', K.hands === 2 ? K.grip : 'handshake') : S.G.L } : {}), ...(K.shield ? { [flip('L')]: swords.at(-1).G } : {}) };
  const checks = guardChecks(R, hold, { K, swords, mounts: byHand, frame: mirrorFrame(S.frame), st: S.st, want });
  // what the card and a pack carry: each item's mount as gear places it (hero-gear gearFaces), the fist's grip centre on
  // the item's station (a shield's own forearm mount as gear has it)
  const mounts = swords.map((sw) => (sw.shield ? sw.G : { ...sw.G, o: [0, 0, sw.station] }));
  return { name, regime: K.regime, stance: left ? (K.stance.endsWith('Left') ? K.stance.slice(0, -4) : `${K.stance}Left`) : K.stance, tradition: K.tradition, hands: K.hands, grip: K.grip ?? 'handshake', clip, keys, hold, swords, mounts, checks };
}

// ─── the checks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** the body as capsules (joint, joint, radius in metres at the canonical height): the blade must clear them */
const CAPSULES = [['pelvisHub', 'neckHub', 0.12], ['headBase', 'headTop', 0.1], ['shoulderL', 'elbowL', 0.045], ['shoulderR', 'elbowR', 0.045],
  ['elbowL', 'wristL', 0.035], ['elbowR', 'wristR', 0.035], ['hipL', 'kneeL', 0.07], ['hipR', 'kneeR', 0.07], ['kneeL', 'ankleL', 0.05], ['kneeR', 'ankleR', 0.05]];
const segDist = (p, a, b) => { const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1))); return dist(p, add(a, mul(ab, t))); };

/**
 * The machine gate on a held guard: per hand { hilt: { at (m, the fist's grip centre off its station), turn (degrees,
 * the hand's frame off the one the sword wants) }, wrist { flex, deviation, twist }, stray (degrees past the
 * functional range), inRange, wrap (degrees the rig's channel twists past the anatomy: a wrist-skin wrap) }; point (degrees the blade's line misses its aim, or the direction asked); edge
 * (degrees off its facing); clearance (m, the blade's nearest approach to the body's capsules, − inside); lever (the
 * sword's weight's horizontal lever about the holding shoulders, a share of the worst: the arm and the blade out level);
 * balance (m, the centre of mass with the sword's inside the footprint); laws (the regime's: which pass).
 */
export function guardChecks(R, pose, { K, swords, mounts, frame, st, want }) {
  const { nodes: n } = rigNodesAt(R, pose); const frames = boneFrames(R, R.joints, n);
  const hScale = (R.joints.headTop?.[2] ?? 1.674) / 1.674;
  const hands = {};
  for (const [side, w] of Object.entries(want)) {
    const f = frames[R.boneIndex[`hand${side}`]];
    const at = add(f.head, mv(f.m, sub(mounts[side].t, R.joints[`wrist${side}`])));
    // the wrist as the anatomy reads it (off the forearm the elbow carries), and the channel's twist past that: the roll
    // the rig's forearm (its shortest turn) misses, which the skin at the wrist shows as a wrap
    const an = wristFor(R, side, anatomicalForearm(R, n, side), f.m); const wr = { flex: r1(an.flex), deviation: r1(an.deviation), twist: r1(an.twist) };
    const ch = pose[`wrist${side}`]?.twist ?? 0;
    const band = K.shield && side !== swords[0].side ? STRAPPED : WRIST_EASE;
    const hum = humeralTurn(n, side), clear = armClear(R, n, side);
    hands[side] = { hilt: { at: r4(dist(at, w.P)), turn: r1(turnBetween(f.m, w.m)) }, wrist: wr, stray: r1(strayOf(wr, band)), inRange: strayOf(wr, WRIST_RANGE) < 0.5, humerus: r1(hum), elbowOk: hum >= HUMERAL_RANGE[0] - 0.5 && hum <= HUMERAL_RANGE[1] + 0.5, armClear: r4(clear), wrap: r1(Math.abs(((ch - wr.twist + 540) % 360) - 180)) };
  }
  // the blade as the main hand carries it
  const main = swords[0]; const cf = carriedFrame(R, frames, main.G, main.side, st.upper);
  const guardP = itemPoint(cf, main.G, [0, 0, st.guard]), tipP = itemPoint(cf, main.G, st.tip);
  const blade = sub(tipP, guardP);
  let point;
  if (K.point.at) { const mark = markOf(n, K.point); const ab = unit(blade); const v = sub(mark, guardP); point = r1(deg(Math.atan2(len(sub(v, mul(ab, dot(v, ab)))), dot(v, ab)))); }
  else point = r1(angle(blade, frame.aim));
  const edge = r1(angle(mv(cf.W, frame.x), frame.edge));
  // clearance: samples along every carried blade (guard → tip) against the capsules
  let clearance = Infinity;
  const blades = swords.filter((s) => !s.shield).map((s) => { const F = s === main ? cf : carriedFrame(R, frames, s.G, s.side, s.station); const ss = stationsOf(s.G, R, 1); return [itemPoint(F, s.G, [0, 0, ss.guard]), itemPoint(F, s.G, ss.tip)]; });
  for (const [a, b] of blades) for (let i = 0; i <= 24; i++) { const p = add(a, mul(sub(b, a), i / 24)); for (const [j, k, r] of CAPSULES) clearance = Math.min(clearance, segDist(p, n[j], n[k]) - r * hScale); }
  // the lever: the moment the sword's weight puts on each holding shoulder (the balance point's horizontal reach from
  // their mean, shared between the hands that hold), over the worst one arm is asked (one hand, the arm out level, the
  // blade out level beyond it)
  const holding = K.hands === 2 ? ['L', 'R'] : [main.side];
  const shoulder = mul(holding.map((s) => n[`shoulder${s}`]).reduce(add), 1 / holding.length);
  const bal = itemPoint(cf, main.G, [0, 0, st.balance]); const armLen = dist(R.joints.shoulderR, R.joints.elbowR) + dist(R.joints.elbowR, R.joints.wristR);
  const worst = armLen + dist(R.joints[`wrist${main.side}`], main.G.t) + main.G.k * (st.balance - st.upper);
  const lever = r4(Math.hypot(bal[0] - shoulder[0], bal[1] - shoulder[1]) / worst / holding.length);
  // balance: the body's centre of mass (BMI 22 at its height) with each carried item's at its balance point
  const bodyKg = BMI * (R.joints.headTop?.[2] ?? 1.674) ** 2; const c = comOf(n);
  let gx = c[0] * bodyKg, gy = c[1] * bodyKg, kg = bodyKg;
  for (const s of swords) {
    const m = s.shield ? 4 : (SWORD_KG[s.item] ?? 1) * (s.G.trace.dials?.mass ?? 1);
    const p = s.shield ? frames[R.boneIndex[`hand${s.side}`]].head : s === main ? bal : itemPoint(carriedFrame(R, frames, s.G, s.side, s.station), s.G, [0, 0, stationsOf(s.G, R, 1).balance]);
    gx += p[0] * m; gy += p[1] * m; kg += m;
  }
  const pts = []; for (const S of ['L', 'R']) { const L = R.legs[S]; pts.push(n[L.toeBase], n[L.toeTip]); if (n[L.hock][2] - R.joints[L.hock][2] < 0.02) pts.push(n[L.hock]); }
  const balance = r4(margin(hull(pts.map((p) => [p[0], p[1]])), [gx / kg, gy / kg]));
  const skilled = K.regime === 'skilled';
  const laws = {
    hilt: Object.values(hands).every((h) => h.hilt.at < 0.006 && h.hilt.turn < 2),
    wrist: Object.values(hands).every((h) => (skilled ? h.stray < 1 : h.inRange)),
    elbow: Object.values(hands).every((h) => h.elbowOk), apart: Object.values(hands).every((h) => h.armClear > -0.003),
    point: point < 2.5, edge: edge < 3, clear: clearance > 0.005, balance: balance > 0.003,
    ...(skilled ? { carried: lever < LEVER } : {}),
  };
  return { hands, point, edge, clearance: r4(clearance), lever, balance, laws };
}
/** a skilled held guard keeps each holding shoulder's moment under two thirds of the worst (one hand, the arm and the
 * blade out level): a guard is held, not a thrust's end */
export const LEVER = 2 / 3;
