/**
 * THE UNDEAD ON THE TIERED BODY: the dead built on the hero's own game body (polygonizer/tiered-form.js), so a corpse has
 * a person's shoulders, hips, hands and face, and is rigged, animated and dressed as any hero is. A hero carries the form
 * as `undead: { form, build, seed, layers?, hobble? }` (the hero door's field; an undead lineage's sheet writes it).
 *
 *   undeadWords(spec)         → the hero's words for its form, under the spec's own (the hero door records them at mint,
 *                               layered.js heroRecord, so an edit reaches them): bald, the body bare (no clothes but its
 *                               own skin; the feet bare), one tone, the face drawn gaunt, its rest; under the `armed`
 *                               layer the card's weapons as its gear (a lost hand's moved to the free one)
 *   undeadFlesh(plan, hero)   → the hero's plan, before the tiered passes (so the joints' bridges and the shoulders'
 *                               balls are built on the body as it is now), with its card's flesh passes: wasted, bloated
 *   undeadRest(hero)          → the rest the card stands in (./passes.js posture) as the hero's pose words: the hunch, the
 *                               knees, the arms held out, the head hung and cocked, the jaw slack; undeadWords lays it
 *                               on as the hero's gesture, its idle and its walk's tilt
 *   undeadWalk(hero)          → the walk its card walks (./gaits.js) as the hero's walk dials, hobbled or not (the
 *                               hero's `undead.hobble`, else the walk's odds on its dice); undeadWords lays it on as the
 *                               hero's `motion.walk`, under the operator's own dials
 *
 * Absent `undead`, every function returns what it was given. FORM ONLY: the palette is one tone, decay is the dressing
 * layer's. Pure: the dice are the hero's `undead.seed`.
 */
import { UNDEAD_CARDS } from './cards.js';
import { variantOf } from './index.js';
import { posture } from './passes.js';
import { mulberry32 } from '../polygonizer/floorplan-glyphs.js';
import { pickBared } from './bared.js';
import { gaitOf, walkDials, UNDEAD_GAITS } from './gaits.js';
import { HERO_WALK } from '../polygonizer/hero-gaits.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const scaleR = (r, s) => (Array.isArray(r) ? r.map((x) => r6(x * s)) : r6(r * s));
// the hero's parts by what they are (its names: polygonizer/hero-form.js heroPlan)
const LIMB = /^(upperArm|foreArm|hand|thumb|index|middle|ring|little|thigh|shank|foot|toes)[RL]$/;
const TRUNK = new Set(['torso', 'pelvis']);
// the most the trunk's scale may stand from the limbs' (a person's proportions under any card)
export const EVEN_RATIO = 1.15;
// the belly's swell: its share of the card's gut, and its half span up and down the trunk (metres)
const BELLY_GUT = 0.55, BELLY_SPAN = 0.16;

/** the card a hero's undead form stands for (its variation by the build) */
export const undeadCard = (hero) => (hero?.undead ? UNDEAD_CARDS[variantOf(hero.undead.form, hero.undead.build ?? 'canonical')] : null);

/** the hero's seeded choices, each on its own stream: { lost: { part, side } | null } the card's loss (a forearm or a
 * hand gone from the skin, the rig whole), { bared: [{ part, side }] } what goes back to bone (the `bared` layer, over
 * flesh; never a lost forearm) */
export function undeadPicks(hero) {
  const card = undeadCard(hero);
  if (!card) return { lost: null, bared: [] };
  const seed = (hero.undead.seed ?? 1) >>> 0;
  let lost = null;
  if (card.loss) { const rand = mulberry32(seed ^ 0x7f4a7c15), roll = rand(), part = card.loss.parts[Math.floor(rand() * card.loss.parts.length)], side = rand() < 0.5 ? 'R' : 'L'; if (roll < card.loss.odds) lost = { part, side }; }
  const bared = hero.undead.layers?.includes('bared') && card.form === 'flesh' ? pickBared(card.bared ?? { count: [1, 2], parts: ['foreArm', 'ribs', 'shin', 'skull'] }, mulberry32(seed ^ 0x165667b1), lost) : [];
  return { lost, bared };
}

// the card's weapons as the hero's gear: a hand the loss took drops what it held to the other hand, if that one is free
function armedGear(armed, lost) {
  const gear = { ...armed }, gone = lost && (lost.part === 'hand' || lost.part === 'foreArm') ? (lost.side === 'R' ? 'right' : 'left') : null;
  if (gone && gear[gone]) { const other = gone === 'right' ? 'left' : 'right'; if (!gear[other]) gear[other] = gear[gone]; delete gear[gone]; }
  return gear;
}

// a corpse's face on the landmark head (its `face` ratios, 1 the fitted head): the cheeks hollow under cheekbones that
// stand out, the face and the jaw drawn narrow, the brow heavy over the eyes
const GAUNT_FACE = { cheek: 0.82, cheekbone: 1.18, faceWidth: 0.9, jawWidth: 0.9, browRidge: 1.15 };
const r3 = (x) => Math.round(x * 1000) / 1000;

/** the rest the card stands in, as the hero's pose words: the hunch a `hinge` over the hips, the knees a `crouch`, each
 * arm its own direction (a reaching corpse leads with one), the head hung (`pitch` down) and cocked (`yaw`, the side
 * tilt), the jaw slack (the head's `jawOpen`) */
// the ATTACK skeleton's stand: crouched low under a hunch, both clawed hands up and forward to strike (the lead one
// higher), the elbows bent, the head up and watching
const STRIKE = { hinge: 22, crouch: 0.28, armR: { x: 0.45, y: 0.75, z: -0.15 }, armL: { x: -0.5, y: 0.6, z: 0.05 }, elbowR: 75, elbowL: 95, neck: { pitch: 6 }, head: { yaw: 0, pitch: 8 } };

export function undeadRest(hero) {
  const card = undeadCard(hero);
  if (!card) return null;
  if (card.form === 'bone' && hero.undead.layers?.includes('attack')) return { gesture: { ...STRIKE }, jaw: Math.min(25, (card.jaw ?? 0) + 8), lean: STRIKE.hinge };
  const P = posture(card, mulberry32(((hero.undead.seed ?? 1) >>> 0) ^ 0x9e3779b9)), h = card.head ?? { drop: 0, tilt: 0 };
  const tilt = r3(Math.sign(P.head.x) * h.tilt * 22);
  const gesture = { hinge: r3(card.lean ?? 0), crouch: r3(Math.min(1, (card.crouch ?? 0) * 0.4)), armR: P.arms.R, armL: P.arms.L, elbowL: 'slight', elbowR: 'slight',
    neck: { pitch: r3(-h.drop * 18) }, head: { yaw: tilt, pitch: r3(-h.drop * 30) } };
  return { gesture, jaw: Math.min(25, card.jaw ?? 0), lean: card.lean ?? 0 };
}

export function undeadWords(hero) {
  if (!hero?.undead) return hero;
  const tone = hero.palette?.Skin ?? '#9a9a90', rest = undeadRest(hero), card = undeadCard(hero);
  // (a bared skull hangs from its base, not from a face built out from the nape: a third of the card's drop, else the
  // card's drop would swing it into the chest)
  const skull = undeadPicks(hero).bared.some((x) => x.part === 'skull');
  const G = skull ? { ...rest.gesture, neck: { pitch: r3(rest.gesture.neck.pitch * 0.3) }, head: { ...rest.gesture.head, pitch: r3(rest.gesture.head.pitch * 0.3) } } : rest.gesture;
  // (its idle breathes in the rest; its walk keeps the hunch, as the walk's own tilt of the trunk)
  // (a skeleton's jaw is its own bone: its idle hangs it the card's degrees, the separation showing)
  const jaw = card.form === 'bone' && rest.jaw ? { jaw: rest.jaw } : {};
  const idle = [{ ...G, ...jaw }, { ...G, ...jaw, crouch: r3(Math.min(1, G.crouch + 0.05)), head: { ...G.head, pitch: r3(G.head.pitch * 0.7) } }];
  return {
    ...hero, hair: hero.hair ?? 'none', detail: hero.detail ?? 'none',
    // (one tone over every group the body is painted in: its skin, the top and bottom its own clothes would be, its
    // feet, the brows the landmark head always builds)
    palette: { Top: tone, Bottom: tone, Shoes: tone, Hair: tone, Brow: tone, ...(hero.palette ?? {}), Skin: tone },
    ...(card.form === 'flesh' ? { face: { ...GAUNT_FACE, ...(hero.face ?? {}) } } : {}),
    ...(card.form === 'flesh' ? { expression: { jawOpen: rest.jaw, mouthCorner: -0.005, blink: 0.3, ...(hero.expression && typeof hero.expression === 'object' ? hero.expression : {}) } } : {}),
    gesture: hero.gesture ?? G,
    clips: { idle, ...(hero.clips ?? {}) },
    ...(hero.undead.layers?.includes('armed') && card.armed && hero.gear === undefined ? { gear: armedGear(card.armed, undeadPicks(hero).lost) } : {}),
    motion: { ...(hero.motion ?? {}), walk: { ...undeadWalk(hero, card), ...(rest.lean > 0 ? { tilt: Math.min(35, rest.lean) } : {}), ...(hero.motion?.walk && typeof hero.motion.walk === 'object' ? hero.motion.walk : {}) } },
  };
}

/** the walk the card walks (./gaits.js), as the hero's walk dials: its stride the hero's own × the walk's share; HOBBLED
 * when the hero's `undead.hobble` says so, else by the walk's own odds on the hero's dice, on the side its heavy arm
 * hangs (a giant's corpse drags the leg under its club), else a seeded side */
export function undeadWalk(hero, card = undeadCard(hero)) {
  if (!card) return {};
  const word = gaitOf(card, hero.undead.layers ?? []), rand = mulberry32(((hero.undead.seed ?? 1) >>> 0) ^ 0x2545f491);
  const roll = rand(), side = card.heavy ? (card.heavy.side === 'L' ? -1 : 1) : rand() < 0.5 ? -1 : 1;
  const hobbled = typeof hero.undead.hobble === 'boolean' ? hero.undead.hobble : roll < (UNDEAD_GAITS[word].hobble?.odds ?? 0);
  return walkDials(word, { hobbled, side, stride: HERO_WALK.strideLength });
}

// a rings station's points scaled toward a centre (its own, or the trunk's axis at its height)
function scaleRing(points, s, about) {
  const P = Object.values(points), c = about ?? [0, 1, 2].map((k) => P.reduce((t, p) => t + p[k], 0) / P.length);
  return Object.fromEntries(Object.entries(points).map(([sl, p]) => [sl, [r6(c[0] + (p[0] - c[0]) * s), r6(c[1] + (p[1] - c[1]) * s), about ? p[2] : r6(c[2] + (p[2] - c[2]) * s)]]));
}
// the torso's centre forward at height z (the chest's rings thin about the trunk they lie on, so they stay on it)
function trunkCentre(torso, z) {
  const S = torso.stations, i = Math.max(0, S.findIndex((st, j) => j < S.length - 1 && z <= S[j + 1].z)), a = S[Math.min(i, S.length - 2)], b = S[Math.min(i + 1, S.length - 1)];
  const t = b.z === a.z ? 0 : Math.max(0, Math.min(1, (z - a.z) / (b.z - a.z)));
  return [0, (a.yc ?? 0) + ((b.yc ?? 0) - (a.yc ?? 0)) * t, z];
}

export function undeadFlesh(plan, hero) {
  const card = undeadCard(hero);
  if (!card || card.form !== 'flesh') return plan;
  const W = card.waste ?? { limbs: 1, trunk: 1 }, B = card.bloat ?? null;
  // (EVEN, whatever the silhouette: the trunk never pulls away from the limbs past EVEN_RATIO either way; past it both are
  // drawn to their geometric mean, so a swollen corpse's limbs swell with its trunk and a wasted one's trunk keeps
  // with its limbs, the body's overall size as the card says and its proportions a person's)
  let kT = W.trunk * (B ? B.trunk : 1), kL = W.limbs * (B ? B.limbs : 1);
  const ratio = kT / kL;
  if (ratio > EVEN_RATIO || ratio < 1 / EVEN_RATIO) { const m = Math.sqrt(kT * kL), q = Math.sqrt(ratio > 1 ? EVEN_RATIO : 1 / EVEN_RATIO); kT = m * q; kL = m / q; }
  const kN = (kT + kL) / 2;
  const torso = plan.segments.find((s) => s.name === 'torso' && s.kind === 'trunk');
  // (the card's gut, metres at 2 m tall, laid on at BELLY_GUT of it: the creature biped's belly stood out from a smaller trunk)
  const waist = torso ? torso.stations[0].z : 1, gut = (B?.gut ?? 0) * BELLY_GUT;
  const segments = plan.segments.map((s) => {
    if (TRUNK.has(s.name) && s.kind === 'trunk') {
      // (the swollen belly a smooth swell centred on the waist, where the torso meets the pelvis: each section deeper,
      // wider and its centre brought forward, falling off evenly above and below, so it rounds instead of shelving; a
      // swollen trunk's sections round off, the tiered torso's squared ones would read as a box)
      return { ...s, stations: s.stations.map((st) => {
        const w = Math.exp(-(((st.z - waist) / BELLY_SPAN) ** 2)), G = gut * w, [rx, ry] = Array.isArray(st.r) ? scaleR(st.r, kT) : [scaleR(st.r, kT), scaleR(st.r, kT)];
        if (!G) return { ...st, r: scaleR(st.r, kT), ...(B && B.trunk > 1 ? { e: 2 } : {}) };
        return { ...st, r: [r6(rx + G * 0.35), r6(ry + G * 0.7)], yc: r6((st.yc ?? 0) + G * 0.5), e: 2 };
      }) };
    }
    if (s.name === 'neck') return s.kind === 'loft' ? { ...s, stations: s.stations.map((st) => ({ ...st, r: scaleR(st.r, kN) })) } : { ...s, rA: scaleR(s.rA, kN), rB: scaleR(s.rB, kN) };
    if (s.kind === 'rings' && torso && !LIMB.test(s.name)) return { ...s, stations: s.stations.map((st) => { const P = Object.values(st.points), z = P.reduce((t, p) => t + p[2], 0) / P.length; return { ...st, points: scaleRing(st.points, kT, trunkCentre(torso, z)) }; }) };
    if (!LIMB.test(s.name)) return s;
    if (s.kind === 'segment') return { ...s, rA: scaleR(s.rA, kL), rB: scaleR(s.rB, kL), ...(s.rMid ? { rMid: scaleR(s.rMid, kL) } : {}), ...(s.shape ? { shape: s.shape.map((x) => ({ ...x, r: scaleR(x.r, kL) })) } : {}) };
    if (s.kind === 'loft') return { ...s, stations: s.stations.map((st) => ({ ...st, r: scaleR(st.r, kL) })) };
    if (s.kind === 'rings') return { ...s, stations: s.stations.map((st) => ({ ...st, points: scaleRing(st.points, kL) })) };
    return s;
  });
  return { ...plan, segments };
}
