/**
 * THE FEATURE GRAMMAR: the feature style's principles as numbers, and the converter that applies them to any animal in
 * the fauna roster (docs/feature-style.md). A species' mascot card (mascot-animals.js animalCard: its family and its kit)
 * goes in; a BUILD comes out (the relations feature-body.js makes one skin of eggs, its face and its coat).
 *
 *   STRUCTURE    the masses (the body, the head, the limbs, the tail's mass): the proportions and the silhouette, rigged,
 *                never optional. Its BODY PLAN is the family's (PLAN_OF): stander (a furred animal standing: the
 *                raccoon's), hoofed, bird, reptile, orb (an animal whose head is its body); a family tunes its plan
 *                (FAMILY_TUNE: the body's width, the feet, the arms, the fingers, its own decoration)
 *   DECORATION   everything laid on the structure to tell the species: the fur's tufts and the crown, the markings, the
 *                horns, the spines, the mane, the fins. Each kind has a dial (FEATURE_DECOR): 1 the designed amount, 0 the
 *                structure bare, more bolder. A dial never moves a mass
 *   KIT          the species' kit (ears, muzzle, tail, pattern, horns, mane, spines, shell, fin, neck, eyes, arms, feet)
 *                chooses its modules; a module is the same on every species that names it
 *
 *   featureBuild(card, { decor }) → the build (head units, h: the head's height; z up from the soles, y front, +x right;
 *                                   a name ending R mirrored to its L twin)
 *   PLANS, PLAN_OF, FAMILY_TUNE, FEATURE_DECOR, FEATURE_PROPORTION
 *
 * The principles (docs/feature-style.md): the body the dominant mass, low on small feet; one skin of eggs; the head
 * stands apart (a football cranium, its lower volume round, the jowls up, a seam under the jaw: a figure eight in profile,
 * an hourglass in front); round masses, pointy details in a falling rhythm; harmonious markings in few strokes, laid as
 * thin layers; an animated face; streamlined limbs and articulate hands; a default game model's budget.
 * Pure and deterministic: data and arithmetic; no dice, no clock.
 */

import { speciesParams } from '../fauna/species.js';
import { SILHOUETTES, silhouetteOf, bellyOf } from './feature-silhouettes.js';
import { functional, speciesLimbs } from './feature-function.js';
import { PHI, beakOf, beakParts, headOf, plumageOf, extentAlong } from './feature-birds.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const at = (p, d, s) => add(p, mul(d, s));
const sc = (r, k) => r.map((x) => x * k);
const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;

/** THE PROPORTION PRINCIPLES (h): heads tall, the seam under the jaw, the head's lift over the neck's pinch, the arms'
 *  least outward share in a clip (so none sinks into the belly), a showing leg's least radii at the thigh and the ankle
 *  (a mascot's round leg; a bird's), a wing's scale (a bird's wing carries its silhouette: big) */
export const FEATURE_PROPORTION = Object.freeze({ heads: 3.3, seam: 0.05, headLift: 0.12, splay: 0.62, leg: [0.27, 0.2], birdLeg: [0.14, 0.1], wing: 1.25 });

/** THE DECORATION DIALS: 1 the designed amount, 0 none (the structure bare), more bolder. `tufts` the fur's and the
 *  feathers' fans (the cheeks, the tail's tip), `crown` the head's own fan, `markings` the coat's layers (the mask, the
 *  stripes, the rings, the inner ears; a coat's zones stay), `horns` horns, antlers and ossicones, `spines` a dorsal
 *  row, plates and quills, `mane` a mane's ring or crest, `fins` fins and flukes */
export const FEATURE_DECOR = Object.freeze({ tufts: 1, crown: 1, markings: 1, horns: 1, spines: 1, mane: 1, fins: 1 });

/** the families the style does not draw: a fish has no body to stand on or limbs to act with (a fish asked for in the
 *  style is drawn in the toon, mascot.js) */
export const FEATURE_EXCLUDES = Object.freeze(['teleost', 'chondrichthyan']);

/** the family's body plan */
export const PLAN_OF = Object.freeze({
  procyonid: 'stander', ursine: 'stander', rodent: 'stander', mustelid: 'stander', primate: 'stander', canine: 'stander', feline: 'stander',
  leporid: 'stander', macropod: 'stander', monotreme: 'stander',
  equine: 'hoofed', cervid: 'hoofed', bovid: 'hoofed', suid: 'hoofed', giraffid: 'hoofed', pachyderm: 'hoofed',
  avian: 'bird', pterosaur: 'bird', chiropteran: 'bird',
  crocodilian: 'reptile', squamate: 'reptile', theropod: 'reptile', ceratopsian: 'reptile', hadrosaur: 'reptile', sauropod: 'reptile', thyreophoran: 'reptile', testudine: 'reptile',
  anuran: 'orb', cetacean: 'orb', chondrichthyan: 'orb', teleost: 'orb', pinniped: 'orb', plesiosaur: 'orb', cephalopod: 'orb',
});

/** THE BODY PLANS: what the plan's skin grows (fur, feather, scale, smooth), its hands (fingers, hooves, wings,
 *  flippers), the body's and the head's scales against the stander's, the legs' length, the head's lift and seam, the
 *  eye's place, the muzzle and the tail it falls back on when the kit names none */
export const PLANS = Object.freeze({
  stander: Object.freeze({ skin: 'fur', hands: 'fingers', body: 1, head: 1, legs: 1, lift: 0.12, seam: 0.05, eye: { az: 24, el: 0, r: 0.15 }, muzzle: 'point', tail: 'brush', ruffs: true }),
  hoofed: Object.freeze({ skin: 'fur', hands: 'hooves', body: 0.92, head: 1, legs: 1.35, lift: 0.14, seam: 0.05, eye: { az: 26, el: 2, r: 0.14 }, muzzle: 'long', tail: 'tuft', ruffs: false }),
  bird: Object.freeze({ skin: 'feather', hands: 'wings', body: 1.05, head: 0.9, legs: 1.3, lift: 0.08, seam: 0.05, eye: { az: 30, el: 4, r: 0.16 }, muzzle: 'beak', tail: 'fan', ruffs: false }),
  reptile: Object.freeze({ skin: 'scale', hands: 'claws', body: 0.95, head: 1, legs: 1.1, lift: 0.08, seam: 0.04, eye: { az: 32, el: 10, r: 0.13 }, muzzle: 'long', tail: 'thick', ruffs: false }),
  orb: Object.freeze({ skin: 'smooth', hands: 'flippers', body: 1.12, head: 1, legs: 0.6, lift: -0.3, seam: 0, eye: { az: 26, el: 8, r: 0.15 }, muzzle: 'round', tail: 'fluke', ruffs: false }),
});

/** a family's tuning of its plan: the body's width, the feet's and the arms' lengths, the fingers (long | short), the
 *  tail its kit falls back on, the belly the roster lacks (feature-silhouettes.js BELLIES), and its own decoration
 *  (dark paws, a ringed tail) */
export const FAMILY_TUNE = Object.freeze({
  procyonid: { fingers: 'long', paws: 'dark', rings: true, belly: 'oval' },
  primate: { fingers: 'long', body: 0.92 },
  rodent: { fingers: 'long', body: 0.95, head: 1.04 },
  ursine: { body: 1.05, tail: 'pom' },
  canine: { body: 0.86, belly: 'bib' },
  feline: { body: 0.86, belly: 'underside' },
  mustelid: { body: 0.84 },
  leporid: { feet: 1.6, body: 0.92 },
  macropod: { feet: 1.8, body: 0.92 },
  giraffid: { legs: 1.5 },
  pachyderm: { body: 1.1, legs: 1.1 },
  testudine: { body: 1.05 },
});

/** A SPECIES' OWN MEASURES, read from the fauna roster's realistic animal (fauna/species.js speciesParams): its ears'
 *  size against its head, against the raccoon's (the style's designed reference), and their roundness (how little the
 *  ear's profile tapers to its tip: 0 a point, 1 a disc). They size and shape the ear module (never below its designed
 *  size: the roster's head scales differ, so a measure is trusted to grow an ear, not to shrink one), so a mouse's ears are big
 *  and round and a raccoon's pointed, from data, not by hand. */
export function speciesMeasures(id) {
  let p = null; try { p = speciesParams(id); } catch { return {}; }
  const R = Array.isArray(p?.earR) ? p.earR : null, hs = p?.headScale;
  if (!R || !hs || Math.max(...R) < 0.012) return {};
  const ref = 0.036 / 0.5, size = Math.max(1, Math.min(2.6, Math.max(...R) / hs / ref)), round = Math.max(0, Math.min(1, R[R.length - 1] / Math.max(...R)));
  return { ear: { size: r4(size), round: r4(round) } };
}

/** a species' own kit over its family card's, where its name is a feature the family's rule misses (the squirrel is its
 *  brush) or gets wrong (a hippo has no trunk; a great ape no tail) */
export const SPECIES_KIT = Object.freeze({ squirrel: { tail: 'brush' }, hippo: { muzzle: 'wide' }, rhino: { muzzle: 'wide' }, gorilla: { tail: 'none' }, chimpanzee: { tail: 'none' }, orangutan: { tail: 'none' }, frog: { tail: 'none' }, toad: { tail: 'none' } });

/** a wing's fold on a silhouette that is not a standing bird's (an owl's teardrop): back and down along the side */
const WING_FOLD = unit([0.4, -0.55, -0.73]);

/** the head's two masses at a scale, about the raccoon's head (structure's own): the side silhouette's head is measured
 *  on them */
const HEAD0 = {
  cranium: (hd, shape) => ({ c: [0, 0.02 * hd, 0], u: [0, 1, -0.1], r: sc([0.63, 0.72, 0.6], hd).map((x, k) => x * shape[k]), hint: [1, 0, 0] }),
  jaw: (hd, shape) => ({ c: [0, 0.14 * hd, -0.25 * hd], u: [0, 1, -0.1], r: sc([0.48, 0.7, 0.36], hd).map((x, k) => x * shape[k]), hint: [1, 0, 0] }),
};

/** the structure of a silhouette (feature-silhouettes.js), tuned by the plan and the family: the masses, the limbs, the
 *  joints, the head's ellipsoid (the face's) */
function structure(S, P, T, shape = [1, 1, 1]) {
  const bw = T.body ?? 1, hd = P.head * (T.head ?? 1), ar = T.arms ?? 1, ft = Math.max(T.feet ?? 1, S.footLen ?? 1), X = (p) => [p[0] * bw, p[1], p[2]];
  const ARM = S.arm.dir, SPREAD = unit(cross(ARM, [0, 1, 0])), FLAT = unit(cross(ARM, [1, 0, 0]));
  const sh = X(S.arm.sh), el = at(sh, ARM, S.arm.len[0] * ar), wr = at(el, ARM, S.arm.len[1] * ar), kn = at(wr, ARM, 0.22);
  // (the head placed on the silhouette: its shapes are drawn about the raccoon's head, at 2.82 over the soles)
  const head = (c) => [c[0] * hd, c[1] * hd + S.hy, S.hz + (c[2] - 2.82) * hd];
  const eggs = [
    // (the cranium a FOOTBALL: long front to back, a little pointed toward the muzzle, its underside one round curve)
    { name: 'cranium', c: head([0, 0.02, 2.82]), u: [0, 1, -0.1], r: sc([0.63, 0.72, 0.6], hd).map((x, k) => x * shape[k]), e: 0.15, hint: [1, 0, 0], bone: 'head', join: 0.18 },
    // (the head's lower volume filled out round: in profile a figure eight; from the front a football lying across)
    { name: 'jaw', c: head([0, 0.14, 2.57]), u: [0, 1, -0.1], r: sc([0.48, 0.7, 0.36], hd).map((x, k) => x * shape[k]), e: 0.1, hint: [1, 0, 0], bone: 'head', join: 0.2 },
    // (the jowls carrying the football's points out and a little up, never drooping)
    { name: 'jowlR', c: head([0.38, 0.26, 2.55]), u: [0.86, 0.35, -0.12], r: sc([0.25, 0.21, 0.19], hd), e: 0.45, hint: [0, 1, 0], bone: 'head', group: 'Belly', join: 0.14 },
    ...(P.ruffs ? [{ name: 'ruffR', c: head([0.5, 0.08, 2.53]), u: [0.84, 0.05, -0.48], r: sc([0.34, 0.3, 0.26], hd), e: 0.85, hint: [0, 1, 0], bone: 'head', join: 0.2 }] : []),
    // (the neck by the silhouette: the pinch where the head's ball meets the body's (a figure eight), a visible slender
    // neck, a long one, or none: the head merged into the body's top)
    ...(S.neck === 'pinch' ? [{ name: 'neck', c: [0, -0.02, S.neckZ + 0.06], u: [0, 0.1, 1], r: [0.16, 0.5 * bw, 0.36], bone: 'neck', join: 0.14 }]
      : S.neckEgg ? [{ name: 'neck', c: S.neckEgg.c, u: unit(S.neckEgg.u ?? [0, 0.1, 1]), r: [S.neckEgg.r[0], S.neckEgg.r[1] * bw, S.neckEgg.r[2] * bw], bone: 'neck', join: 0.16 }] : []),
    // (the body's masses, the silhouette's own; a central mass widens with the family's build)
    ...S.body.map((e) => ({ ...e, c: X(e.c), r: /R$/.test(e.name) ? e.r : [e.r[0], e.r[1] * bw, e.r[2] * bw] })),
  ];
  // the legs: hidden under the haunches, or two cones (the thigh, the shin) from the hip by the knee to the ankle
  const hip = X(S.hip), fx = S.foot[0], ankle = X([fx - 0.01, 0.05, 0.1]), knee = S.knee ? X(S.knee) : X([fx, 0.08, S.hip[2] * 0.58]);
  // (a leg that shows is a mascot's: round and full, never a stick; a bird's thinner, still round)
  const shinGroup = S.bird ? 'Sock' : undefined, CH = S.bird ? FEATURE_PROPORTION.birdLeg : FEATURE_PROPORTION.leg;
  const legR = [Math.max(S.legR?.[0] ?? 0, CH[0]), Math.max(S.legR?.[1] ?? 0, CH[1])].map((x) => x * (S.legScale ?? 1)), legM = (legR[0] + legR[1]) / 2;
  const legs = S.legs === 'cones' ? [
    { name: 'thighR', a: hip, b: knee, ra: legR[0], rb: legM, bone: 'thighR', join: 0.1 },
    { name: 'shinR', a: knee, b: ankle, ra: legM, rb: legR[1], bone: 'shinR', group: shinGroup, join: 0.08 }] : [];
  if (S.legs !== 'cones') eggs.push({ name: 'shinR', c: X([fx - 0.01, 0.08, 0.18]), u: [0, 0, 1], r: [0.14, 0.15, 0.15], bone: 'shinR', join: 0.1 });
  eggs.push({ name: 'footR', c: [fx * bw, S.foot[1] * ft, 0.07], u: [0.2, 1, 0], r: [0.24 * ft, 0.16, 0.075], e: 0.25, hint: [1, 0, 0], bone: 'metaR', join: 0.07 });
  const limbs = [
    { name: 'upperArmR', a: sh, b: el, ra: S.arm.r[0], rb: S.arm.r[1], bone: 'upperArmR', join: 0.05 },
    { name: 'foreArmR', a: el, b: wr, ra: S.arm.r[1], rb: S.arm.r[2], bone: 'foreArmR', join: 0.04 },
    ...legs,
  ];
  return {
    eggs, limbs, tufts: [], marks: [], ARM, SPREAD, FLAT, sh, el, wr, kn, bw, hd, ft, S,
    joints: { hip, knee, ankle, toeBase: [r4((fx + 0.01) * bw), r4((S.foot[1] + 0.04) * ft), 0.05], toeTip: [r4((fx + 0.03) * bw), r4((S.foot[1] + 0.2) * ft), 0.03], shoulder: sh, elbow: el, wrist: wr, knuckles: kn },
    hipZ: S.hip[2], neckZ: S.neckZ, top: S.hz + 0.6 * hd,
    head: { C: head([0, 0.02, 2.8]), rx: 0.72 * hd, ry: 0.6 * hd, rz: 0.55 * hd }, headAt: head,
  };
}

/** THE HANDS: fingers (fanned, two bones each), hooves, wings, flippers, claws (three short fingers), none (a snake's).
 *  A WING carries a bird's silhouette: folded along the body's side and held a little out from it, so it reads from the
 *  front as from the side; big flat panels on the arm's links and the hand in the wing's own tone, a scalloped row of
 *  secondaries along its trailing edge, and long primaries fanned back past the tail in the flight feathers' tone, so a
 *  bird reads as a bird and never as a mammal with feathered arms */
function hands(B, kind, T, D, plume = {}) {
  const { ARM, SPREAD, FLAT, sh, wr, el } = B;
  if (kind === 'none') return;
  if (kind === 'hooves') { B.eggs.push({ name: 'pawR', c: at(wr, ARM, 0.08), u: ARM, r: [0.12, 0.13, 0.12], e: 0.2, hint: SPREAD, bone: 'handR', group: 'Hoof', join: 0.03 }); return; }
  if (kind === 'flippers') { B.eggs.push({ name: 'pawR', c: at(el, ARM, 0.3), u: ARM, r: [0.42, 0.24, 0.07], e: 0.4, hint: FLAT, bone: 'handR', join: 0.06 }); return; }
  if (kind === 'wings') {
    const mid = (a, b) => mul(add(a, b), 0.5), L1 = Math.hypot(...el.map((x, k) => x - sh[k])), L2 = Math.hypot(...wr.map((x, k) => x - el[k]));
    const W = FEATURE_PROPORTION.wing;
    B.eggs.push(
      { name: 'wingR', c: at(mid(sh, el), FLAT, 0.08), u: ARM, r: [L1 / 2 + 0.22, 0.52 * W, 0.1], e: 0.2, hint: FLAT, bone: 'upperArmR', group: 'Wing', join: 0.04 },
      { name: 'wingForeR', c: at(mid(el, wr), FLAT, 0.04), u: ARM, r: [L2 / 2 + 0.2, 0.46 * W, 0.09], e: 0.3, hint: FLAT, bone: 'foreArmR', group: 'Wing', join: 0.04 },
      { name: 'pawR', c: at(wr, ARM, 0.12), u: ARM, r: [0.26, 0.32 * W, 0.08], e: 0.4, hint: FLAT, bone: 'handR', group: 'Wing', join: 0.04 });
    if (D.tufts > 0) {
      // (the secondaries: a scalloped trailing edge, hanging back and down from the forearm's panel)
      [0.05, 0.35, 0.65, 0.95].forEach((t, i) => B.tufts.push({ name: `secondary${i}R`, root: at(at(el, ARM, t * L2), FLAT, -0.22 * W), aim: unit(add(mul(ARM, 0.75), mul(FLAT, -0.65))), len: (0.32 + 0.05 * i) * W * D.tufts, r: 0.1, tip: 0.25, curl: 10, bend: FLAT, bone: 'foreArmR', group: 'Wing', join: 0.04 }));
      // (the primaries: the fan's falling rhythm, long, overlapping into one feathered tip back along the fold past the tail)
      [[-12, 0.62], [-6, 0.78], [0, 0.86], [6, 0.76], [12, 0.6]].forEach(([fan, len], i) => {
        const f = (fan * Math.PI) / 180, d = unit(add(mul(ARM, Math.cos(f)), mul(FLAT, Math.sin(f))));
        B.tufts.push({ name: `primary${i}R`, root: at(at(wr, ARM, 0.12), FLAT, (i - 2) * 0.06 * W), aim: d, len: len * W * D.tufts, r: 0.11, tip: 0.2, curl: 8, bend: FLAT, bone: 'handR', group: 'Flight', join: 0.05 });
      });
    }
    return;
  }
  B.eggs.push({ name: 'pawR', c: at(wr, ARM, 0.09), u: ARM, r: [0.13, 0.13, 0.075], e: 0.15, hint: SPREAD, bone: 'handR', group: T.paws === 'dark' ? 'Patch' : undefined, join: 0.04 });
  const long = (T.fingers ?? 'short') === 'long', claws = kind === 'claws';
  B.digits = claws
    ? { from: wr, along: ARM, across: SPREAD, at: [0.13, 0.15, 0.13], offset: [-0.06, 0, 0.06], fan: [-30, 0, 30], len: [0.1, 0.11, 0.1], r: [0.04, 0.034, 0.018], join: 0.01, group: 'Claw' }
    : long
      ? { from: wr, along: ARM, across: SPREAD, at: [0.13, 0.15, 0.16, 0.15, 0.1], offset: [-0.085, -0.04, 0.005, 0.05, 0.09], fan: [-48, -22, 2, 26, 56], len: [0.12, 0.15, 0.16, 0.14, 0.1], r: [0.036, 0.031, 0.022], join: 0.01 }
      : { from: wr, along: ARM, across: SPREAD, at: [0.14, 0.15, 0.15, 0.14], offset: [-0.07, -0.024, 0.024, 0.07], fan: [-24, -8, 8, 24], len: [0.07, 0.08, 0.08, 0.07], r: [0.045, 0.04, 0.03], join: 0.012 };
}

/** THE MUZZLES: each the masses, its nose, the mouth's place on it (the nose's foot, the line's middle and right corner,
 *  the pivot it opens about) and the zone it paints pale */
const MUZZLES = {
  point: () => ({ eggs: [
    { name: 'muzzle', c: [0, 0.48, 2.54], u: [0, 1, -0.12], r: [0.3, 0.22, 0.18], e: 0.45, bone: 'head', group: 'Belly', join: 0.12 },
    { name: 'chin', c: [0, 0.38, 2.42], u: [0, 1, 0], r: [0.14, 0.15, 0.1], bone: 'head', group: 'Belly', join: 0.1 },
    { name: 'nose', c: [0, 0.79, 2.58], u: [0, 1, 0.2], r: [0.09, 0.11, 0.08], bone: 'head', group: 'Nose', join: 0.03 }],
    mouth: { nose: [0, 0.82, 2.48], centre: [0, 0.77, 2.41], corner: [0.17, 0.63, 2.42], pivot: [0, 0.42, 2.52] }, nose: 'nose' }),
  round: () => ({ eggs: [
    { name: 'muzzle', c: [0, 0.44, 2.52], u: [0, 1, -0.1], r: [0.26, 0.26, 0.21], e: 0.2, bone: 'head', group: 'Belly', join: 0.12 },
    { name: 'chin', c: [0, 0.36, 2.4], u: [0, 1, 0], r: [0.14, 0.16, 0.1], bone: 'head', group: 'Belly', join: 0.1 },
    { name: 'nose', c: [0, 0.7, 2.6], u: [0, 1, 0.2], r: [0.08, 0.12, 0.08], bone: 'head', group: 'Nose', join: 0.03 }],
    mouth: { nose: [0, 0.72, 2.5], centre: [0, 0.69, 2.41], corner: [0.18, 0.58, 2.42], pivot: [0, 0.4, 2.5] }, nose: 'nose' }),
  long: () => ({ eggs: [
    { name: 'muzzle', c: [0, 0.62, 2.52], u: [0, 1, -0.1], r: [0.46, 0.22, 0.18], e: 0.35, bone: 'head', group: 'Belly', join: 0.12 },
    { name: 'chin', c: [0, 0.5, 2.4], u: [0, 1, 0], r: [0.2, 0.15, 0.1], bone: 'head', group: 'Belly', join: 0.1 },
    { name: 'nose', c: [0, 1.08, 2.55], u: [0, 1, 0.2], r: [0.09, 0.11, 0.08], bone: 'head', group: 'Nose', join: 0.03 }],
    mouth: { nose: [0, 1.1, 2.46], centre: [0, 1.04, 2.41], corner: [0.17, 0.72, 2.43], pivot: [0, 0.55, 2.52] }, nose: 'nose' }),
  button: () => ({ eggs: [
    { name: 'chin', c: [0, 0.4, 2.44], u: [0, 1, 0], r: [0.14, 0.16, 0.1], bone: 'head', group: 'Belly', join: 0.1 },
    { name: 'nose', c: [0, 0.62, 2.62], u: [0, 1, 0.2], r: [0.07, 0.09, 0.06], bone: 'head', group: 'Nose', join: 0.03 }],
    mouth: { nose: [0, 0.62, 2.55], centre: [0, 0.6, 2.48], corner: [0.15, 0.53, 2.48], pivot: [0, 0.3, 2.55] }, nose: 'nose' }),
  wide: () => ({ eggs: [
    { name: 'muzzle', c: [0, 0.4, 2.5], u: [0, 1, -0.1], r: [0.22, 0.5, 0.16], bone: 'head', group: 'Belly', join: 0.14 },
    { name: 'nose', c: [0, 0.6, 2.58], u: [0, 1, 0.2], r: [0.05, 0.07, 0.04], bone: 'head', group: 'Nose', join: 0.03 }],
    mouth: { nose: [0, 0.6, 2.54], centre: [0, 0.6, 2.46], corner: [0.42, 0.42, 2.48], pivot: [0, 0.3, 2.52] }, nose: 'nose' }),
  disc: () => ({ eggs: [
    { name: 'muzzle', c: [0, 0.55, 2.5], u: [0, 1, -0.05], r: [0.3, 0.24, 0.22], bone: 'head', join: 0.1 },
    { name: 'nose', c: [0, 0.84, 2.5], u: [0, 1, 0], r: [0.06, 0.2, 0.17], bone: 'head', group: 'Nose', join: 0.04 }],
    mouth: { nose: [0, 0.78, 2.32], centre: [0, 0.72, 2.3], corner: [0.18, 0.56, 2.34], pivot: [0, 0.45, 2.45] }, nose: 'nose' }),
  beak: () => ({ eggs: [], limbs: [{ name: 'beak', a: [0, 0.42, 2.54], b: [0, 0.98, 2.46], ra: 0.2, rb: 0.035, bone: 'head', group: 'Beak', join: 0.06 }],
    mouth: { nose: [0, 0.7, 2.56], centre: [0, 0.86, 2.48], corner: [0.14, 0.5, 2.5], pivot: [0, 0.3, 2.56] }, nose: 'beak' }),
  bill: () => ({ eggs: [{ name: 'bill', c: [0, 0.66, 2.5], u: [0, 1, -0.1], r: [0.42, 0.28, 0.08], hint: [1, 0, 0], bone: 'head', group: 'Beak', join: 0.06 }],
    mouth: { nose: [0, 0.9, 2.52], centre: [0, 1.0, 2.47], corner: [0.22, 0.42, 2.48], pivot: [0, 0.3, 2.52] }, nose: 'bill' }),
  trunk: () => ({ eggs: [
    { name: 'muzzle', c: [0, 0.46, 2.52], u: [0, 1, -0.1], r: [0.26, 0.26, 0.22], e: 0.2, bone: 'head', join: 0.12 }],
    tufts: [{ name: 'trunk', root: [0, 0.62, 2.5], aim: [0, 0.6, -1], len: 0.95, r: 0.13, tip: 0.6, curl: 50, bend: [0, 1, 0], bone: 'head', join: 0.06 }],
    mouth: { nose: [0, 0.6, 2.36], centre: [0, 0.58, 2.3], corner: [0.15, 0.48, 2.34], pivot: [0, 0.3, 2.45] }, nose: null }),
};

/** THE EARS: a mass each, its inner stroke (a layer) */
const EARS = {
  pointed: () => ({ egg: { name: 'earR', c: [0.46, -0.1, 3.24], u: [0.38, -0.1, 1], r: [0.27, 0.21, 0.08], e: 0.75, hint: [1, 0, 0], bone: 'head', join: 0.08 },
    inner: [[0.44, 0.0, 3.08], [0.5, -0.02, 3.3], [0.55, -0.05, 3.48]], ir: [0.1, 0.08, 0.02] }),
  tall: () => ({ egg: { name: 'earR', c: [0.3, -0.12, 3.62], u: [0.15, -0.1, 1], r: [0.55, 0.18, 0.08], e: 0.35, hint: [1, 0, 0], bone: 'head', join: 0.08 },
    inner: [[0.3, -0.03, 3.2], [0.32, -0.04, 3.6], [0.34, -0.05, 4.0]], ir: [0.09, 0.1, 0.02] }),
  round: () => ({ egg: { name: 'earR', c: [0.55, -0.08, 3.18], u: [0.5, -0.1, 1], r: [0.2, 0.22, 0.08], hint: [1, 0, 0], bone: 'head', join: 0.08 },
    inner: [[0.53, 0.0, 3.12], [0.57, 0.0, 3.22]], ir: [0.11, 0.08] }),
  flap: () => ({ egg: { name: 'earR', c: [0.82, -0.05, 2.82], u: [0.9, -0.2, -0.3], r: [0.5, 0.45, 0.07], hint: [0, 0, 1], bone: 'head', join: 0.08 },
    inner: [[0.7, 0.04, 2.86], [0.95, 0.02, 2.76]], ir: [0.25, 0.2] }),
  tufts: () => ({ egg: { name: 'earR', c: [0.42, -0.04, 3.2], u: [0.4, -0.1, 1], r: [0.2, 0.15, 0.07], e: 0.8, hint: [1, 0, 0], bone: 'head', join: 0.06 },
    tuft: { name: 'earTuftR', root: [0.48, -0.06, 3.36], aim: [0.45, -0.1, 1], len: 0.26, r: 0.07, curl: 20, bend: [1, 0, 0], bone: 'head', join: 0.04 } }),
};

/** THE TAILS: the masses, a tip tuft (a decoration), the zone of its tip */
const TAILS = {
  brush: () => ({ eggs: [
    { name: 'tail0', c: [0, -1.05, 0.62], u: [0, -1, 0.3], r: [0.4, 0.36, 0.36], bone: 'pelvis', join: 0.3 },
    { name: 'tail1', c: [0, -1.55, 0.84], u: [0, -0.9, 0.45], r: [0.5, 0.5, 0.48], bone: 'pelvis', join: 0.3 },
    { name: 'tail2', c: [0, -1.95, 1.22], u: [0, -0.6, 0.8], r: [0.5, 0.5, 0.48], bone: 'pelvis', join: 0.3 },
    { name: 'tail3', c: [0, -2.12, 1.72], u: [0, -0.15, 1], r: [0.42, 0.4, 0.38], e: 0.5, bone: 'pelvis', join: 0.3 }],
    tip: { name: 'tailTip', root: [0, -2.16, 2.02], aim: [0, -0.35, 1], len: 0.34, r: 0.2, curl: 30, bend: [0, -1, 0], bone: 'pelvis', join: 0.1 },
    rings: [[[0, -1.5, 0.82], [0, -0.9, 0.45], 0.09, 0.65], [[0, -1.92, 1.2], [0, -0.6, 0.8], 0.09, 0.65], [[0, -2.12, 1.68], [0, -0.2, 1], 0.08, 0.55]] }),
  thin: () => ({ eggs: [], tufts: [{ name: 'tail', root: [0, -0.88, 0.6], aim: [0, -1, 0.15], len: 1.5, r: 0.11, tip: 0.3, curl: 75, bend: [0, 0, 1], bone: 'pelvis', join: 0.08 }] }),
  pom: () => ({ eggs: [{ name: 'tail0', c: [0, -1.02, 0.7], u: [0, -1, 0.3], r: [0.24, 0.24, 0.24], bone: 'pelvis', group: 'Belly', join: 0.1 }] }),
  tuft: () => ({ eggs: [], tufts: [{ name: 'tail', root: [0, -0.88, 0.62], aim: [0, -1, -0.2], len: 1.2, r: 0.09, tip: 0.5, curl: 40, bend: [0, 0, 1], bone: 'pelvis', join: 0.08 }],
    tip: { name: 'tailTip', root: [0, -1.78, 0.72], aim: [0, -0.6, 0.8], len: 0.3, r: 0.13, curl: 20, bend: [0, -1, 0], bone: 'pelvis', join: 0.06, group: 'Mane' } }),
  thick: () => ({ eggs: [], tufts: [{ name: 'tail', root: [0, -0.78, 0.6], aim: [0, -1, -0.25], len: 1.7, r: 0.36, tip: 0.12, curl: 22, bend: [0, 0, 1], bone: 'pelvis', join: 0.2 }] }),
  flat: () => ({ eggs: [{ name: 'tail0', c: [0, -1.25, 0.32], u: [0, -1, -0.2], r: [0.52, 0.32, 0.08], hint: [1, 0, 0], bone: 'pelvis', join: 0.12 }] }),
  brushThin: () => TAILS.brush(),
  fan: () => ({ eggs: [], fan: true }),
  none: () => ({ eggs: [] }),
  fluke: () => ({ eggs: [], tufts: [{ name: 'tail', root: [0, -0.7, 0.7], aim: [0, -1, 0.1], len: 0.9, r: 0.32, tip: 0.3, curl: 10, bend: [0, 0, 1], bone: 'pelvis', join: 0.2 }], fluke: true }),
};

/** a decoration kept only by its dial: scaled by it, dropped at 0 */
const dialled = (t, k) => (k > 0 ? { ...t, len: t.len * k, r: t.r * (0.6 + 0.4 * k) } : null);

/** a tail module moved from the raccoon's root to the silhouette's */
const TAIL0 = [0, -0.88, 0.6];
function tailAt(tl, anchor) {
  const d = [anchor[0] - TAIL0[0], anchor[1] - TAIL0[1], anchor[2] - TAIL0[2]], mv = (p) => add(p, d);
  return { ...tl, eggs: tl.eggs.map((e) => ({ ...e, c: mv(e.c) })), ...(tl.tufts ? { tufts: tl.tufts.map((t) => ({ ...t, root: mv(t.root) })) } : {}),
    ...(tl.tip ? { tip: { ...tl.tip, root: mv(tl.tip.root) } } : {}), ...(tl.rings ? { rings: tl.rings.map(([c, ...x]) => [mv(c), ...x]) } : {}), at: mv };
}

export function featureBuild(card, { decor = {} } = {}) {
  const D = { ...FEATURE_DECOR, ...decor }, plan = PLAN_OF[card.family] ?? 'stander', P = PLANS[plan], T = FAMILY_TUNE[card.family] ?? {};
  // THE SILHOUETTE, read from the species' own body (feature-silhouettes.js)
  const silhouette = silhouetteOf(card.id, card.family, plan), S0 = SILHOUETTES[silhouette];
  // THE FUNCTION (feature-function.js): a quadruped stands for the acting and drops onto all fours to move, so its
  // silhouette is fitted to its limbs (the species' hind against its fore) and to the floor
  const quad = (['stander', 'hoofed', 'reptile'].includes(plan) && !S0.limbless) || silhouette === 'squat';
  const fn = quad ? functional(S0, speciesLimbs(card.id)) : null, S1 = fn ? fn.S : S0;
  const K = { ...(card.kit ?? {}), ...(S1.limbless ? { tail: 'thin' } : {}), ...(SPECIES_KIT[card.id] ?? {}) };
  // THE HANDS' KIND; a wing folds back along the body on any silhouette (an owl's too, not down its side as a flipper)
  const handKind = S1.limbless ? 'none' : K.arms === 'flipper' ? 'flippers' : K.arms === 'wing' ? 'wings' : P.hands;
  const S = handKind === 'wings' && !S1.bird ? { ...S1, arm: { ...S1.arm, dir: WING_FOLD } } : S1;
  // (a bird's plumage: the colours that are its pattern, feature-birds.js)
  const plume = plan === 'bird' ? plumageOf(card.id) : {};
  // A BIRD'S HEAD: matched to its own beak (feature-birds.js), and sized so the side silhouette's head is the body's
  // length over φ (the beak apart)
  const beaked = ['beak', 'bill'].includes(K.muzzle ?? P.muzzle), bk = plan === 'bird' && beaked ? beakOf(card.id) : null, hs = headOf(bk);
  const bodyAxis = unit(S.body.find((e) => e.name === 'belly').u), bodyMass = S.body.filter((e) => !/R$/.test(e.name));
  const headLen = (hd) => { const [lo, hi] = extentAlong(['cranium', 'jaw'].map((n) => HEAD0[n](hd, hs.shape)), [0, 1, 0]); return hi - lo; };
  let T1 = T;
  if (plan === 'bird') { const [lo, hi] = extentAlong(bodyMass, bodyAxis); T1 = { ...T, head: (hi - lo) / PHI / headLen(1) / P.head }; }
  const B = structure(S, P, T1, hs.shape), H = B.headAt, onHead = (p) => H(p);
  const headEgg = (x) => ({ ...x, c: onHead(x.c) });
  const headTuft = (x) => ({ ...x, root: onHead(x.root) });
  // THE MUZZLE (the kit's, else the plan's), its mouth and its pale zone
  const mz = bk ? beakParts(bk, B.hd) : (MUZZLES[K.muzzle] ?? MUZZLES[P.muzzle])();
  // (a raptor's head frowns: a brow ridge over each eye)
  if (hs.brow) B.eggs.push({ name: 'browRidgeR', c: H([0.3, 0.5, 2.99]), u: [1, 0.25, -0.15], r: sc([0.18, 0.1, 0.06], B.hd), hint: [0, 0, 1], bone: 'head', join: 0.06 });
  B.eggs.push(...mz.eggs.map(headEgg));
  for (const l of mz.limbs ?? []) B.limbs.push({ ...l, a: onHead(l.a), b: onHead(l.b) });
  for (const t of mz.tufts ?? []) B.tufts.push(headTuft(t));
  const mouth = { ...Object.fromEntries(Object.entries(mz.mouth).map(([k, p]) => [k, onHead(p)])), rise: 0.05, sag: 0.012 };
  // THE EARS
  const ear = K.ears ? EARS[K.ears]?.() : null;
  // (the species' own ears: sized and rounded from its measures, the module's place and aim kept)
  const M = card.id && card.id !== 'raccoon' ? speciesMeasures(card.id) : {};
  if (ear && M.ear && ['pointed', 'round', 'tall'].includes(K.ears)) {
    const k = M.ear.size, e0 = ear.egg;
    ear.egg = { ...e0, c: add(e0.c, [0.04 * (k - 1), 0, 0.12 * (k - 1)]), r: [e0.r[0] * k * (1 - 0.35 * M.ear.round), e0.r[1] * k * (1 + 0.25 * M.ear.round), e0.r[2]], e: r4(0.8 * (1 - M.ear.round)) };
    if (ear.inner) { ear.inner = ear.inner.map((q) => add(q, [0.04 * (k - 1), 0, 0.12 * (k - 1)])); ear.ir = ear.ir.map((x) => x * k); }
  }
  if (ear) { B.eggs.push(headEgg(ear.egg)); if (ear.tuft && D.tufts > 0) B.tufts.push(headTuft(dialled(ear.tuft, D.tufts))); }
  // THE TAIL (the kit's, else the plan's)
  const tl = tailAt((TAILS[K.tail] ?? TAILS[T.tail] ?? TAILS[P.tail])(), S.tail);
  B.eggs.push(...tl.eggs);
  for (const t of tl.tufts ?? []) B.tufts.push(t);
  if (tl.tip && D.tufts > 0) B.tufts.push(dialled(tl.tip, D.tufts));
  // (a bird's tail: a fan along its body's axis, reaching past the body by the head's length over φ)
  const TA = bodyAxis[1] < -0.5 ? bodyAxis : unit([0, -1, -0.35]), [, rear] = extentAlong(bodyMass, TA), belly1 = S.body.find((e) => e.name === 'belly').c;
  const tailRoot = add(belly1, mul(TA, rear - dot(belly1, TA) - 0.25)), tailLen = headLen(B.hd) / PHI;
  if (tl.fan && D.tufts > 0) [-40, -14, 14, 40].forEach((f, i) => {
    const a = (f * Math.PI) / 180, aim = unit(add(mul(TA, Math.cos(a)), [Math.sin(a), 0, 0])), reachOf = tailLen * (1 - Math.abs(f) * 0.004);
    B.tufts.push(dialled({ name: `tailFeather${i}`, root: tailRoot, aim, len: (reachOf + rear - dot(tailRoot, TA)) / dot(aim, TA), r: 0.13, tip: 0.2, curl: 6, bend: [0, 0, -1], bone: 'pelvis', group: plume.tip ? 'Tip' : undefined, join: 0.05 }, D.tufts));
  });
  if (tl.fluke && D.fins > 0) B.tufts.push(dialled({ name: 'flukeR', root: tl.at([0, -1.5, 0.82]), aim: [1, -0.4, 0.1], len: 0.5, r: 0.14, tip: 0.2, curl: 20, bend: [0, -1, 0], bone: 'pelvis', join: 0.05 }, D.fins));
  // THE HANDS AND THE FEET
  hands(B, handKind, T, D, plume);
  const foot = B.eggs.find((e) => e.name === 'footR');
  if (K.feet === 'hooves' || P.hands === 'hooves') Object.assign(foot, { r: [0.18, 0.17, 0.12], group: 'Hoof' });
  else if (S.bird) {
    // (a standing bird's foot: three toes forward and one back off a small pad, the leg's colour)
    const a = B.joints.ankle, pad = [a[0], a[1] + 0.04, 0.05];
    Object.assign(foot, { c: pad, r: [0.1, 0.09, 0.055], e: 0, group: 'Sock', join: 0.04 });
    [[-28, 0.24], [0, 0.28], [28, 0.24], [180, 0.14]].forEach(([fan, len], i) => {
      const f = (fan * Math.PI) / 180, d = [Math.sin(f) * 0.9, Math.cos(f), -0.08];
      B.limbs.push({ name: `toe${i}R`, a: pad, b: add(pad, mul(unit(d), len)), ra: 0.055, rb: 0.035, bone: 'metaR', group: 'Sock', join: 0.03 });
    });
  } else if (K.feet === 'webbed') Object.assign(foot, { r: [0.28, 0.24, 0.05], group: plan === 'bird' ? 'Beak' : undefined });
  else if (T.paws === 'dark') foot.group = 'Patch';
  // THE SKIN'S POINTED DETAILS, by its kind (round blobs, pointy details: a fan of falling lengths)
  if (P.skin === 'fur' && P.ruffs && D.tufts > 0) for (const t of [
    { name: 'cheekAR', root: [0.66, 0.04, 2.5], aim: [0.92, -0.1, -0.38], len: 0.44, r: 0.17, curl: 22, bend: [0, -0.3, -1], bone: 'head', join: 0.07 },
    { name: 'cheekBR', root: [0.62, 0.0, 2.4], aim: [0.78, -0.35, -0.52], len: 0.36, r: 0.15, curl: 18, bend: [0, -1, -0.2], bone: 'head', join: 0.07 },
    { name: 'cheekCR', root: [0.64, 0.06, 2.64], aim: [0.97, -0.15, 0.1], len: 0.34, r: 0.14, curl: 28, bend: [0, -0.4, -1], bone: 'head', join: 0.07 },
  ]) B.tufts.push(headTuft(dialled(t, D.tufts)));
  // (the crown's fan: asymmetric, overlapping, swept one way; a bird's head stays smooth unless its kit names a crest)
  if (P.skin === 'fur' && D.crown > 0 && !K.horns && K.mane !== 'crest') {
    const swept = [1, 0.1, -0.4];
    for (const t of [
      { name: 'crownA', root: [-0.14, 0.16, 3.3], aim: [0.42, 0.28, 1], len: 0.4, r: 0.12, curl: 24, bend: swept, bone: 'head', join: 0.05 },
      { name: 'crownB', root: [-0.01, 0.06, 3.34], aim: [0.5, 0.2, 1], len: 0.33, r: 0.11, curl: 22, bend: swept, bone: 'head', join: 0.05 },
      { name: 'crownC', root: [0.12, -0.04, 3.32], aim: [0.6, 0.12, 1], len: 0.26, r: 0.095, curl: 20, bend: swept, bone: 'head', join: 0.05 },
    ]) B.tufts.push(headTuft(dialled(t, D.crown)));
  }
  // (a scaled skin's points: a dorsal row of spines in the same falling rhythm, from the crown down the silhouette's back
  // to the tail; a snake's and a shelled animal's back stay smooth)
  if ((K.spines || (P.skin === 'scale' && !S.limbless && !K.shell)) && D.spines > 0) [...S.back, [S.tail[2] - 0.1, S.tail[1] - 0.7]].forEach(([z, y], i) => {
    const len = [0.2, 0.26, 0.3, 0.26, 0.22, 0.17][i];
    B.tufts.push(dialled({ name: `spine${i}`, root: [0, y, z], aim: [0, -0.35, 1], len, r: len * 0.42, tip: 0.15, curl: 10, bend: [0, -1, 0], bone: i < 2 ? 'head' : i < 4 ? 'torso' : 'pelvis', group: plan === 'reptile' ? 'Patch' : 'Body', join: 0.05 }, D.spines));
  });
  // THE KIT'S OWN DECORATION: horns, a mane, a fin, a shell, a long neck, the eyes on top
  if (K.horns && D.horns > 0) {
    const oss = K.horns === 'ossicones';
    B.tufts.push(headTuft(dialled({ name: 'hornR', root: [0.26, 0.02, 3.3], aim: oss ? [0.15, -0.1, 1] : [0.7, 0.25, 0.75], len: oss ? 0.3 : 0.55, r: oss ? 0.07 : 0.12, tip: oss ? 0.9 : 0.15, curl: oss ? 0 : 55, bend: [0, -0.6, 0.2], bone: 'head', group: 'Horn', join: 0.04 }, D.horns)));
  }
  if (K.mane === 'ring' && D.mane > 0) [[0.62, 0.0, 2.85, [0.8, -0.2, 0.55]], [0.7, -0.05, 2.65, [1, -0.2, 0.05]], [0.62, -0.1, 2.38, [0.8, -0.25, -0.55]], [0.32, -0.12, 2.25, [0.4, -0.3, -0.9]], [0.36, -0.1, 3.1, [0.5, -0.3, 0.8]]].forEach(([x, y, z, aim], i) =>
    B.tufts.push(headTuft(dialled({ name: `mane${i}R`, root: [x, y, z], aim, len: 0.42, r: 0.17, curl: 18, bend: [0, -1, 0], bone: 'head', group: 'Mane', join: 0.08 }, D.mane))));
  if (K.mane === 'crest' && D.mane > 0) [[3.3, 0.05, 0.32], [3.12, -0.3, 0.3], [2.8, -0.5, 0.28], [2.45, -0.55, 0.24]].forEach(([z, y, len], i) =>
    B.tufts.push(dialled({ name: `crest${i}`, root: i < 2 ? H([i % 2 ? 0.05 : -0.05, y, z]) : [i % 2 ? 0.05 : -0.05, y + S.hy, S.neckZ + (z - 2.3)], aim: [0, -0.6, 0.8], len, r: 0.11, curl: 25, bend: [0, -1, -0.3], bone: i < 2 ? 'head' : 'neck', group: 'Mane', join: 0.06 }, D.mane)));
  if (K.fin && D.fins > 0) B.tufts.push(dialled({ name: 'dorsalFin', root: [0, S.back[2][1] * 0.75, S.back[2][0]], aim: [0, -0.5, 1], len: 0.6, r: 0.22, tip: 0.1, curl: 30, bend: [0, -1, 0], bone: 'torso', join: 0.08 }, D.fins));
  const belly0 = B.eggs.find((e) => e.name === 'belly');
  if (K.shell) B.eggs.push({ name: 'shell', c: [0, belly0.c[1] - 0.34, belly0.c[2] + 0.28], u: [0, 0, 1], r: [belly0.r[0], belly0.r[1] * 0.98, belly0.r[2] * 1.06], e: 0.2, bone: 'torso', group: 'Shell', join: 0.06 });
  let headLift = S.neck === 'merged' ? 0 : P.lift;
  if (K.neck === 'long') { headLift += 1.1; B.eggs.push({ name: 'neckLong', c: [0, 0.02 + S.hy, S.neckZ + 0.65], u: [0, 0.15, 1], r: [0.8, 0.34, 0.32], bone: 'neck', join: 0.18 }); }
  const eye = { ...P.eye, ...(K.eyes === 'top' ? { el: 32, az: 20 } : {}), proud: 0.42 };
  // THE COAT: zones cut into the skin (the pale muzzle, the nose, the pale belly, the dark paws), layers over it (the
  // pattern's strokes, the inner ears, the tail's rings), the markings' layers by their dial
  const names = new Set([...B.eggs.map((e) => e.name), ...B.eggs.filter((e) => /R$/.test(e.name)).map((e) => e.name.replace(/R$/, 'L'))]);
  const has = (n) => names.has(n);
  const zone = (name, group, eggs) => { const own = eggs.filter(has); if (own.length) B.marks.push({ name, group, eggs: own }); };
  if (mz.eggs.some((e) => e.name === 'muzzle' && e.group === 'Belly')) zone('muzzle', 'Belly', ['muzzle', 'chin', 'jowlR', 'jowlL']);
  if (mz.nose && mz.nose !== 'beak' && mz.nose !== 'bill') zone('nose', 'Nose', [mz.nose]);
  // (the belly: the species' own, on this silhouette, or none)
  const belly = bellyOf(card.id, silhouette, { plan, pattern: K.pattern, tune: T.belly });
  if (belly.regions.length) B.marks.push({ name: 'belly', group: 'Belly', regions: belly.regions.map((E) => ({ ...E, c: [E.c[0], E.c[1] * B.bw, E.c[2]], r: [E.r[0], E.r[1] * B.bw, E.r[2]] })) });
  const fingers = B.digits ? B.digits.at.flatMap((_, i) => ['a', 'b'].flatMap((l) => [`digit${i + 1}${l}R`, `digit${i + 1}${l}L`])) : [];
  if (T.paws === 'dark' || K.pattern === 'socks') zone('paws', 'Patch', ['pawR', 'pawL', 'footR', 'footL', ...(K.pattern === 'socks' ? ['foreArmR', 'foreArmL', 'shinR', 'shinL'] : [])]);
  if (B.digits && (T.paws === 'dark' || K.pattern === 'socks')) B.marks.find((m) => m.name === 'paws').eggs.push(...fingers);
  if (K.pattern === 'patches') { zone('limbs', 'Patch', ['pawR', 'pawL', 'footR', 'footL', 'haunchR', 'haunchL', 'shinR', 'shinL', 'earR', 'earL']); }
  if (tl.tip && T.rings) zone('tailTip', 'Patch', ['tailTip']);
  // (a bird's plumage: its head a crown of its own colour (a hood down the neck where the neck shares it), its neck a band)
  if (plume.crown) zone('crown', 'Crown', ['cranium', 'jaw', 'jowlR', 'jowlL', 'browRidgeR', 'browRidgeL', ...(plume.hood ? ['neck'] : [])]);
  if (plume.neck) zone('neckBand', 'Mane', ['neck']);
  // (every decoration that names a colour of its own and is in no zone yet: the hooves, a beak or a bill, horns, a mane, a
  // shell, the spines; its zone is its shapes' territory)
  const zoned = new Set(B.marks.flatMap((m) => m.eggs ?? [])), byGroup = {};
  for (const x of [...B.eggs, ...B.tufts, ...B.limbs]) if (x?.group && !['Body', 'Belly'].includes(x.group)) for (const n of /R$/.test(x.name) ? [x.name, x.name.replace(/R$/, 'L')] : [x.name]) if (!zoned.has(n)) (byGroup[x.group] ??= []).push(n);
  for (const [g, eggs] of Object.entries(byGroup)) B.marks.push({ name: `zone${g}`, group: g, eggs });
  const layers = [];
  if (K.pattern === 'mask') layers.push(
    { name: 'mask', group: 'Patch', on: 'head', strokes: [{ both: true, points: [[0.04, 0.68, 2.8], [0.3, 0.56, 2.79], [0.5, 0.38, 2.62], [0.66, 0.22, 2.44]].map(onHead), r: [0.1, 0.19, 0.13, 0.025] }] },
    { name: 'stripe', group: 'Patch', on: 'head', strokes: [{ points: [[0, 0.7, 2.92], [0, 0.55, 3.18], [0, 0.2, 3.36]].map(onHead), r: [0.05, 0.08, 0.02] }] });
  if (K.pattern === 'patches') layers.push({ name: 'patches', group: 'Patch', on: 'head', strokes: [{ both: true, points: [[0.16, 0.66, 2.86], [0.32, 0.54, 2.76], [0.4, 0.44, 2.64]].map(onHead), r: [0.12, 0.16, 0.05] }] });
  // (the stripes wrap the body's own masses, from its flank's foot to its chest)
  const chest0 = B.eggs.find((e) => e.name === 'chest'), zs = [0, 1, 2].map((i) => belly0.c[2] - 0.15 + (i / 2) * (chest0.c[2] - belly0.c[2] + 0.2));
  const wx = belly0.r[1] / 1.2, wy = belly0.r[2] / 1.02;
  if (K.pattern === 'stripes') layers.push({ name: 'stripes', group: 'Patch', strokes: zs.flatMap((z) => [false, true].map((left) => {
    const m = (p) => (left ? [-p[0], p[1], p[2]] : p); return { points: [[0.02, -0.95 * wy + belly0.c[1] - 0.12, z + 0.25], [0.85 * wx, -0.35 * wy + belly0.c[1] - 0.12, z], [1.05 * wx, 0.25 * wy + belly0.c[1] - 0.12, z - 0.2]].map(m), r: [0.1, 0.08, 0.015] }; })) });
  if (ear?.inner) layers.push({ name: 'ears', group: 'EarInner', on: 'head', strokes: [{ both: true, points: ear.inner.map(onHead), r: ear.ir }] });
  if (tl.rings && T.rings) layers.push({ name: 'rings', group: 'Patch', levels: 0, bands: tl.rings.map(([c, axis, w, R]) => ({ c, axis, w, R, teeth: 9, depth: 0.035 })) });
  // (a bird's wing bars: two strokes across the folded wing's coverts, a value step of its own greys)
  const wing = B.eggs.find((e) => e.name === 'wingR');
  if (plume.bar && wing) {
    const U = unit(wing.u), V0 = unit(wing.hint), V = unit(add(V0, mul(U, -dot(V0, U)))), N0 = unit(cross(U, V)), N = N0[0] < 0 ? mul(N0, -1) : N0;
    layers.push({ name: 'wingBars', group: 'Bar', strokes: [0.25, -0.2].map((t) => {
      const p = add(add(wing.c, mul(U, t * wing.r[0])), mul(N, wing.r[2] * 0.9));
      return { both: true, points: [-0.75, 0, 0.75].map((k) => add(p, mul(V, k * wing.r[1]))), r: [0.045, 0.06, 0.045] };
    }) });
  }
  if (D.markings > 0) B.marks.push(...layers);
  // (the marks' strokes are given in the head's frame already: `on: 'head'` lifts them with the head over the neck)
  const muzzle = mz.eggs.find((e) => e.name === 'muzzle');
  return Object.freeze({
    family: card.family, plan, silhouette, belly: belly.kind, ...(fn ? { fit: fn.fit, fours: fn.fours } : {}),
    heads: S.heads, splay: FEATURE_PROPORTION.splay, ...(handKind === 'wings' ? { fold: B.ARM.map(r4) } : {}), seam: P.seam * S.seam, headLift,
    eggs: B.eggs.filter(Boolean), tufts: B.tufts.filter(Boolean), limbs: B.limbs, ...(B.digits ? { digits: B.digits } : {}), marks: B.marks,
    eye, mouth, joints: B.joints, hipZ: r4(B.hipZ), neckZ: r4(B.neckZ), top: r4(B.top + (K.ears === 'tall' ? 0.5 : 0)),
    head: B.head, muzzle: muzzle ? { C: muzzle.c, rx: muzzle.r[1], ry: muzzle.r[0], rz: muzzle.r[2] } : { C: onHead([0, 0.5, 2.5]), rx: 0.2, ry: 0.25, rz: 0.16 },
  });
}
