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
import { SILHOUETTES, silhouetteOf, bellyOf, rounded, sideHips, SIDE_HIPS, fronted, FRONT_SILHOUETTES, FRONT_RATIO } from './feature-silhouettes.js';
import { functional, speciesLimbs , speciesTail } from './feature-function.js';
import { PHI, beakOf, beakParts, headOf, plumageOf, extentAlong } from './feature-birds.js';
import { tunedSilhouette, detailClumps, sizesOf } from './feature-tune.js';
import { tuftLocks } from './feature-tufts.js';
import { mulberry32 } from '../vegetation/grow.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const at = (p, d, s) => add(p, mul(d, s));
const sc = (r, k) => r.map((x) => x * k);
const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const rad = (d) => (d * Math.PI) / 180;
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** THE PROPORTION PRINCIPLES (h): heads tall, the seam under the jaw, the head's lift over the neck's pinch, the arms'
 *  least outward share in a clip (so none sinks into the belly), a showing leg's least radii at the thigh and the ankle
 *  (a mascot's round leg; a bird's), a wing's scale (a bird's wing carries its silhouette: big), how far a folded wing
 *  stands proud of the body (so its edge reads in profile, never sunk into the flank), its panels' thickness, and how much
 *  of the fold's outward lean its primaries keep (little: they lie back along the body as the wing's tip, not splayed),
 *  and how far a long neck (a giraffe's) raises the head */
export const FEATURE_PROPORTION = Object.freeze({ heads: 3.3, seam: 0.05, headLift: 0.12, splay: 0.62, leg: [0.27, 0.2], birdLeg: [0.14, 0.1], wing: 1.45, longNeck: 1.45,
  wingProud: 0.12, wingThick: 0.13, tipLean: 0.3 });

/** THE DECORATION DIALS: 1 the designed amount, 0 none (the structure bare), more bolder. `tufts` the fur's and the
 *  feathers' fans (the cheeks, the tail's tip), `crown` the head's own fan, `markings` the coat's layers (the mask, the
 *  stripes, the rings, the inner ears; a coat's zones stay), `horns` horns, antlers and ossicones, `spines` a dorsal
 *  row, plates and quills, `mane` a mane's ring or crest, `fins` fins and flukes */
export const FEATURE_DECOR = Object.freeze({ tufts: 1, crown: 1, markings: 1, horns: 1, spines: 1, mane: 1, fins: 1 });

/** STRIPES (a `stripes` coat: a zebra's, a tiger's): ring bands round the standing figure, from `from` (head units over
 *  the soles) every `pitch` up the neck to `under` below the head (never across the face), at most `most`; their
 *  half-widths in a falling rhythm (`w`, cycled), each ring leaning a little the other way from the last (`lean`), its
 *  edges notched (`teeth` round it, `depth` deep), within `reach` of the body's axis (the arms and the legs striped with
 *  the trunk). Over the legs a stripe is a ring; above them it is an ARC as a body wears one: widest at the spine (the back's
 *  middle), holding its width down each flank and pinching (`taper`: the later, the larger) to a point `end` degrees from it (180: the two meet under the belly,
 *  a zebra's chevrons; a family may stop short, a cat's at its pale belly), its widths by `width`. Cut into the skin as
 *  a zone, a stripe costs only the faces its edges split: within the triangle budget */
export const FEATURE_STRIPES = Object.freeze({ from: 0.28, pitch: 0.32, most: 14, w: [0.09, 0.07, 0.1, 0.06], lean: 0.12, teeth: 8, depth: 0.025, reach: 2.4, under: 0.15, end: 180, taper: 4, width: 1 });

/** A NETWORK of patches (a `reticulated` coat: a giraffe's): seeds on a jittered lattice (`pitch` apart, `jitter` of it,
 *  out to `span` across and from `from` up to `under` below the head; the dice seeded, `seed`), each point the patch of its
 *  nearest seed, the patches parted by lines `line` wide */
export const FEATURE_NETWORK = Object.freeze({ from: 0.2, pitch: 0.64, jitter: 0.7, span: 1.4, line: 0.07, under: 0.15, seed: 7 });

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

/** A BIRD'S RESTING FACE (feature-face.js, the eye's `rest`): a bird's eyes sit round the sides of its head, where a brow
 *  laid as a mammal's wraps down and back over the globe and its lid sits heavy: the face reads sad and droopy whatever
 *  it means. So its lids rest more open (`lid` degrees), its brows sit higher off them (`at`, degrees above the gaze's
 *  level) and their outer ends are lifted (`tilt`: the inner end drops by it), for every expression alike */
export const BIRD_REST = Object.freeze({ lid: 12, at: 62, tilt: 8 });
// (a frog's eyes, bulging on top of its head, rest the same way: FAMILY_TUNE anuran)

/** THE BODY PLANS: what the plan's skin grows (fur, feather, scale, smooth), its hands (fingers, hooves, wings,
 *  flippers), the body's and the head's scales against the stander's, the legs' length, the head's lift and seam, the
 *  eye's place, the muzzle and the tail it falls back on when the kit names none */
export const PLANS = Object.freeze({
  stander: Object.freeze({ skin: 'fur', hands: 'fingers', body: 1, head: 1, legs: 1, lift: 0.12, seam: 0.05, eye: { az: 24, el: 0, r: 0.15 }, muzzle: 'point', tail: 'brush', ruffs: true }),
  hoofed: Object.freeze({ skin: 'fur', hands: 'hooves', body: 0.92, head: 1, legs: 1.35, lift: 0.14, seam: 0.05, eye: { az: 26, el: 2, r: 0.14 }, muzzle: 'long', tail: 'tuft', ruffs: false }),
  bird: Object.freeze({ skin: 'feather', hands: 'wings', body: 1.05, head: 0.9, legs: 1.3, lift: 0.08, seam: 0.05, eye: { az: 30, el: 4, r: 0.16, rest: BIRD_REST }, muzzle: 'beak', tail: 'fan', ruffs: false }),
  reptile: Object.freeze({ skin: 'scale', hands: 'claws', body: 0.95, head: 1, legs: 1.1, lift: 0.08, seam: 0.04, eye: { az: 32, el: 10, r: 0.13 }, muzzle: 'long', tail: 'thick', ruffs: false }),
  orb: Object.freeze({ skin: 'smooth', hands: 'flippers', body: 1.12, head: 1, legs: 0.6, lift: -0.3, seam: 0, eye: { az: 26, el: 8, r: 0.15 }, muzzle: 'round', tail: 'fluke', ruffs: false }),
});

/** a family's tuning of its plan: the body's width, the feet's and the arms' lengths, the fingers (long | short | frog),
 *  its own kit over its card's (`kit`), its hands' kind, its head's shape [long, across, up], its eye and whether the
 *  eyes bulge on domes, the tail its kit falls back on, the belly the roster lacks (feature-silhouettes.js BELLIES), and its own decoration
 *  (dark paws, a ringed tail) */
export const FAMILY_TUNE = Object.freeze({
  procyonid: { fingers: 'long', paws: 'dark', rings: true, belly: 'oval' },
  primate: { fingers: 'long', body: 0.92 },
  // (a rodent's BUCK TEETH: its name, on every species of it)
  rodent: { kit: { teeth: 'buck' }, fingers: 'long', body: 0.95, head: 1.04 },
  ursine: { body: 1.05, tail: 'pom' },
  canine: { body: 0.86, belly: 'bib' },
  mustelid: { body: 0.84 },
  leporid: { feet: 1.6, body: 0.92 },
  macropod: { feet: 1.8, body: 0.92 },
  giraffid: { legs: 1.5 },
  // (a cat's stripes stop short of its pale belly, and are thinner than a zebra's)
  feline: { kit: { muzzle: 'feline' }, body: 0.86, belly: 'underside', stripes: { end: 140, taper: 2.5, width: 0.8 } },
  // (a horse: its long face ending in a soft dark nose, a flowing mane falling to one side with a forelock, a long hair
  // tail, a head longer and narrower than a stander's; a deer: its antlers, its big ears out to the sides, a narrow snout
  // ending in a black nose over a pale chin)
  equine: { kit: { muzzle: 'equine', mane: 'flow', tail: 'horse' }, headShape: [1.1, 0.86, 0.95] },
  cervid: { kit: { muzzle: 'cervid', horns: 'antlers', ears: 'deer' }, headShape: [1.04, 0.9, 0.96] },
  pachyderm: { body: 1.1, legs: 1.1 },
  testudine: { body: 1.05 },
  // (a frog: hands that grip, padded fingers; a wide flat head; big eyes bulging on domes on top of it)
  anuran: { kit: { muzzle: 'frog' }, hands: 'fingers', fingers: 'frog', headShape: [0.92, 1.32, 0.74], eye: { az: 27, el: 42, r: 0.21, proud: 0.66, rest: BIRD_REST }, eyeDomes: true },
});

/** a species' own tuning over its family's (FAMILY_TUNE's words, and `decor`: its own decoration dials): a capybara's long
 *  boxy head, its eyes set high (it swims with them above water) and its coarse short coat (no crown, short tufts), a
 *  hamster's cheek pouches */
export const SPECIES_TUNE = Object.freeze({
  capybara: { headShape: [1.16, 0.96, 0.9], eye: { az: 30, el: 16 }, decor: { crown: 0, tufts: 0.5 } },
  hamster: { pouches: 1.4 },
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
export const SPECIES_KIT = Object.freeze({
  // (the chunky rodents: a blunt muzzle on puffy whisker pads over buck teeth, each its own tail; the hedgehog is no rodent)
  beaver: { muzzle: 'blunt', tail: 'paddle', feet: 'webbed' }, groundhog: { muzzle: 'blunt', tail: 'stub' }, capybara: { muzzle: 'capybara', tail: 'none' },
  guineaPig: { muzzle: 'blunt', tail: 'none' }, hamster: { muzzle: 'blunt', tail: 'none' }, wombat: { muzzle: 'blunt', tail: 'none' }, hedgehog: { teeth: 'none' },
  // (`face`: another species' face worn over its own coat, its nose and its pale muzzle (feature-body.js featurePalette):
  // the house cat's the tiger's, a dark nose over bright whisker pads)
  houseCat: { face: 'tiger' },
  moose: { horns: 'palmate', muzzle: 'moose' }, giraffe: { pattern: 'reticulated' }, zebra: { mane: 'crest', tail: 'tuft' }, donkey: { mane: 'crest', tail: 'tuft' }, squirrel: { tail: 'brush' }, hippo: { muzzle: 'wide' }, rhino: { muzzle: 'wide' }, gorilla: { tail: 'none' }, chimpanzee: { tail: 'none' }, orangutan: { tail: 'none' }, frog: { tail: 'none' }, toad: { tail: 'none' } });

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
function structure(S, P, T, shape = [1, 1, 1], Z = null) {
  // (a tuned head (feature-tune.js) grows about its own centre and is lifted so its jaw stays seated on the neck; tuned
  // feet grow with it)
  const kH = Z?.head ?? 1, hd0 = P.head * (T.head ?? 1), hd = kH === 1 ? hd0 : hd0 * kH, lift = kH === 1 ? 0 : 0.61 * (hd - hd0);
  const bw = T.body ?? 1, ar = T.arms ?? 1, ft = Math.max(T.feet ?? 1, S.footLen ?? 1) * (Z?.feet ?? 1), X = (p) => [p[0] * bw, p[1], p[2]];
  const ARM = S.arm.dir, SPREAD = unit(cross(ARM, [0, 1, 0])), FLAT = unit(cross(ARM, [1, 0, 0]));
  const sh = X(S.arm.sh), el = at(sh, ARM, S.arm.len[0] * ar), wr = at(el, ARM, S.arm.len[1] * ar), kn = at(wr, ARM, 0.22);
  // (the head placed on the silhouette: its shapes are drawn about the raccoon's head, at 2.82 over the soles)
  const head = lift ? (c) => [c[0] * hd, c[1] * hd + S.hy, S.hz + lift + (c[2] - 2.82) * hd] : (c) => [c[0] * hd, c[1] * hd + S.hy, S.hz + (c[2] - 2.82) * hd];
  const eggs = [
    // (the cranium a FOOTBALL: long front to back, a little pointed toward the muzzle, its underside one round curve)
    { name: 'cranium', c: head([0, 0.02, 2.82]), u: [0, 1, -0.1], r: sc([0.63, 0.72, 0.6], hd).map((x, k) => x * shape[k]), e: 0.15, hint: [1, 0, 0], bone: 'head', join: 0.18 },
    // (the head's lower volume filled out round: in profile a figure eight; from the front a football lying across)
    { name: 'jaw', c: head([0, 0.14, 2.57]), u: [0, 1, -0.1], r: sc([0.48, 0.7, 0.36], hd).map((x, k) => x * shape[k]), e: 0.1, hint: [1, 0, 0], bone: 'head', join: 0.2 },
    // (the jowls carrying the football's points out and a little up, never drooping)
    // (a hamster's cheek pouches: the jowls grown, SPECIES_TUNE `pouches`)
    { name: 'jowlR', c: head(T.pouches ? [0.38 * T.pouches, 0.26, 2.52] : [0.38, 0.26, 2.55]), u: [0.86, 0.35, -0.12], r: T.pouches ? sc([0.25, 0.21, 0.19], hd * T.pouches) : sc([0.25, 0.21, 0.19], hd), e: 0.45, hint: [0, 1, 0], bone: 'head', group: 'Belly', join: 0.14 },
    ...(P.ruffs ? [{ name: 'ruffR', c: head([0.5, 0.08, 2.53]), u: [0.84, 0.05, -0.48], r: sc([0.34, 0.3, 0.26], hd), e: 0.85, hint: [0, 1, 0], bone: 'head', join: 0.2 }] : []),
    // (the neck by the silhouette: the pinch where the head's ball meets the body's (a figure eight), a visible slender
    // neck, a long one, or none: the head merged into the body's top)
    ...(S.neck === 'pinch' ? [{ name: 'neck', c: [0, -0.02, S.neckZ + 0.06], u: [0, 0.1, 1], r: [0.16, 0.5 * bw, 0.36], bone: 'neck', join: 0.14 }]
      : S.neckEgg ? [{ name: 'neck', c: S.neckEgg.c, u: unit(S.neckEgg.u ?? [0, 0.1, 1]), r: [S.neckEgg.r[0], S.neckEgg.r[1] * bw, S.neckEgg.r[2] * bw], bone: 'neck', join: 0.16 }] : []),
    // (the body's masses, the silhouette's own; a central mass widens with the family's build)
    ...S.body.map((e) => ({ ...e, c: X(e.c), r: /R$/.test(e.name) ? e.r : [e.r[0], e.r[1] * bw, e.r[2] * bw] })),
  ];
  // the legs: hidden under the haunches, or two cones (the thigh, the shin) from the hip by the knee to the ankle
  // (a leg that shows is a mascot's: round and full, never a stick; a bird's thinner, still round)
  const shinGroup = S.bird ? 'Sock' : undefined, CH = S.bird ? FEATURE_PROPORTION.birdLeg : FEATURE_PROPORTION.leg;
  // (the style's rounding fills the thigh: the volume sits low, feature-silhouettes.js rounded)
  // (a leg proportioned from the front (feature-silhouettes.js fronted) is as broad as its thigh, tapering to the ankle,
  // `FRONT_RATIO.ankle` of it)
  const legR = (S.thighR ? [S.thighR, Math.min(Math.max(S.legR?.[1] ?? 0, CH[1]), S.thighR * FRONT_RATIO.ankle)] : [Math.max(S.legR?.[0] ?? 0, CH[0]) * (S.thighScale ?? 1), Math.max(S.legR?.[1] ?? 0, CH[1])]).map((x) => x * (S.legScale ?? 1) * (S.legGirth ?? 1)), legM = (legR[0] + legR[1]) / 2;
  // (TOED IN from the front, \| |/: a leg proportioned from the front keeps its INNER edge straight down from the thigh,
  // so as it tapers its middle leans in toward the other's, the knee by the thigh's narrowing to it and the ankle by its
  // narrowing to the ankle; the foot goes with the ankle and still points straight ahead)
  const lean = S.thighR ? [(legR[0] - legM) / bw, (legR[0] - legR[1]) / bw] : [0, 0];
  const hip = X(S.hip), fx = S.foot[0] - lean[1], ankle = X([fx - 0.01, 0.05, 0.1]), knee = S.knee ? X([S.knee[0] - lean[0], S.knee[1], S.knee[2]]) : X([fx, 0.08, S.hip[2] * 0.58]);
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
    hipZ: S.hip[2], neckZ: S.neckZ, top: S.hz + lift + 0.6 * hd, kH,
    head: { C: head([0, 0.02, 2.8]), rx: 0.72 * hd, ry: 0.6 * hd, rz: 0.55 * hd }, headAt: head,
  };
}

/** THE HANDS: fingers (fanned, two bones each), hooves, wings, flippers, claws (three short fingers), none (a snake's).
 *  A WING carries a bird's silhouette: folded along the body's side and held a little out from it, so it reads from the
 *  front as from the side; big flat panels on the arm's links and the hand in the wing's own tone, a scalloped row of
 *  secondaries along its trailing edge, and long primaries fanned back past the tail in the flight feathers' tone, so a
 *  bird reads as a bird and never as a mammal with feathered arms */
function hands(B, kind, T, D, plume = {}, kh = 1) {
  const { ARM, SPREAD, FLAT, sh, wr, el } = B, R = (r) => (kh === 1 ? r : r.map((x) => x * kh));
  if (kind === 'none') return;
  if (kind === 'hooves') { B.eggs.push({ name: 'pawR', c: at(wr, ARM, 0.08 * kh), u: ARM, r: R([0.12, 0.13, 0.12]), e: 0.2, hint: SPREAD, bone: 'handR', group: 'Hoof', join: 0.03 }); return; }
  if (kind === 'flippers') { B.eggs.push({ name: 'pawR', c: at(el, ARM, 0.3), u: ARM, r: R([0.42, 0.24, 0.07]), e: 0.4, hint: FLAT, bone: 'handR', join: 0.06 }); return; }
  if (kind === 'wings') {
    const mid = (a, b) => mul(add(a, b), 0.5), L1 = Math.hypot(...el.map((x, k) => x - sh[k])), L2 = Math.hypot(...wr.map((x, k) => x - el[k]));
    const { wing: W, wingProud: pr, wingThick: th, tipLean } = FEATURE_PROPORTION;
    // (the wing's outward face: the panels and their feathers stand proud of the flank along it, so the folded wing is a
    // shape of its own on the body's side in profile, its edge shadowed, never a patch sunk into the body)
    const N0 = unit(cross(ARM, FLAT)), N = N0[0] < 0 ? mul(N0, -1) : N0, out = (p) => at(p, N, pr);
    // (the hand turns at the wrist to lie back along the body: its panel and its primaries in one plane, keeping little of
    // the fold's outward lean, so the wing's tip lies along the flank in profile and never splays sideways from the
    // front; in one plane, no feather grazes the panel it springs from)
    const TIP = unit([ARM[0] * tipLean, ARM[1], ARM[2]]), TF = unit(cross(TIP, [1, 0, 0]));
    B.eggs.push(
      { name: 'wingR', c: out(at(mid(sh, el), FLAT, 0.08)), u: ARM, r: [L1 / 2 + 0.22, 0.52 * W, th], e: 0.2, hint: FLAT, bone: 'upperArmR', group: 'Wing', join: 0.04 },
      { name: 'wingForeR', c: out(at(mid(el, wr), FLAT, 0.04)), u: ARM, r: [L2 / 2 + 0.2, 0.46 * W, th * 0.9], e: 0.3, hint: FLAT, bone: 'foreArmR', group: 'Wing', join: 0.04 },
      { name: 'pawR', c: out(at(wr, TIP, 0.12)), u: TIP, r: [0.26, 0.32 * W, th * 0.8], e: 0.4, hint: TF, bone: 'handR', group: 'Wing', join: 0.04 });
    if (D.tufts > 0) {
      // (the secondaries: a scalloped trailing edge, hanging back and down from the forearm's panel)
      [0.05, 0.35, 0.65, 0.95].forEach((t, i) => B.tufts.push({ name: `secondary${i}R`, root: out(at(at(el, ARM, t * L2), FLAT, -0.22 * W)), aim: unit(add(mul(ARM, 0.75), mul(FLAT, -0.65))), len: (0.32 + 0.05 * i) * W * D.tufts, r: 0.1, tip: 0.25, curl: 10, bend: FLAT, bone: 'foreArmR', group: 'Wing', join: 0.04 }));
      // (the primaries: the fan's falling rhythm, long, overlapping into one feathered tip back along the body past the
      // tail, in the turned hand's plane)
      [[-12, 0.62], [-6, 0.78], [0, 0.86], [6, 0.76], [12, 0.6]].forEach(([fan, len], i) => {
        const f = (fan * Math.PI) / 180, d = unit(add(mul(TIP, Math.cos(f)), mul(TF, Math.sin(f))));
        B.tufts.push({ name: `primary${i}R`, root: out(at(at(wr, TIP, 0.12), TF, (i - 2) * 0.06 * W)), aim: d, len: len * W * D.tufts, r: 0.11, tip: 0.2, curl: 8, bend: TF, bone: 'handR', group: 'Flight', join: 0.05 });
      });
    }
    return;
  }
  B.eggs.push({ name: 'pawR', c: at(wr, ARM, 0.09 * kh), u: ARM, r: R([0.13, 0.13, 0.075]), e: 0.15, hint: SPREAD, bone: 'handR', group: T.paws === 'dark' ? 'Patch' : undefined, join: 0.04 });
  const long = (T.fingers ?? 'short') === 'long', claws = kind === 'claws', frog = T.fingers === 'frog';
  const digits = frog
    // (a frog's: four thin fingers fanned wide, each ending in a round pad)
    ? { from: wr, along: ARM, across: SPREAD, at: [0.12, 0.14, 0.14, 0.12], offset: [-0.07, -0.024, 0.024, 0.07], fan: [-42, -14, 14, 42], len: [0.13, 0.15, 0.15, 0.13], r: [0.03, 0.026, 0.048], join: 0.012 }
    : claws
    ? { from: wr, along: ARM, across: SPREAD, at: [0.13, 0.15, 0.13], offset: [-0.06, 0, 0.06], fan: [-30, 0, 30], len: [0.1, 0.11, 0.1], r: [0.04, 0.034, 0.018], join: 0.01, group: 'Claw' }
    : long
      ? { from: wr, along: ARM, across: SPREAD, at: [0.13, 0.15, 0.16, 0.15, 0.1], offset: [-0.085, -0.04, 0.005, 0.05, 0.09], fan: [-48, -22, 2, 26, 56], len: [0.12, 0.15, 0.16, 0.14, 0.1], r: [0.036, 0.031, 0.022], join: 0.01 }
      : { from: wr, along: ARM, across: SPREAD, at: [0.14, 0.15, 0.15, 0.14], offset: [-0.07, -0.024, 0.024, 0.07], fan: [-24, -8, 8, 24], len: [0.07, 0.08, 0.08, 0.07], r: [0.045, 0.04, 0.03], join: 0.012 };
  // (tuned hands: the palm and the fingers grown together)
  B.digits = kh === 1 ? digits : { ...digits, ...Object.fromEntries(['at', 'offset', 'len', 'r'].map((k) => [k, digits[k].map((x) => r4(x * kh))])) };
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
  // (a horse's: a long face sloping down to a soft round nose in the coat's colour, its dark nostrils at the front, the
  // mouth under it)
  equine: () => ({ eggs: [
    { name: 'muzzle', c: [0, 0.62, 2.52], u: unit([0, 1, -0.3]), r: [0.54, 0.34, 0.3], e: 0.15, hint: [1, 0, 0], bone: 'head', join: 0.14 },
    { name: 'snoutTip', c: [0, 1.08, 2.36], u: unit([0, 1, -0.4]), r: [0.24, 0.33, 0.27], hint: [1, 0, 0], bone: 'head', join: 0.1 },
    { name: 'chin', c: [0, 0.92, 2.2], u: [0, 1, 0], r: [0.18, 0.22, 0.12], hint: [1, 0, 0], bone: 'head', join: 0.08 },
    { name: 'nostrilR', c: [0.15, 1.24, 2.44], u: unit([0.3, 1, 0.3]), r: [0.07, 0.06, 0.035], hint: [0, 0, 1], bone: 'head', group: 'Ink', join: 0.02 }],
    mouth: { nose: [0, 1.25, 2.32], centre: [0, 1.22, 2.2], corner: [0.2, 1.04, 2.22], pivot: [0, 0.92, 2.26] }, nose: null }),
  // (a chunky rodent's: a broad blunt snout, two puffy pale whisker pads and a chin, a small nose at the top of the pads;
  // its buck teeth are its kit's, under the mouth)
  blunt: () => ({ eggs: [
    { name: 'muzzle', c: [0, 0.42, 2.5], u: unit([0, 1, -0.1]), r: [0.28, 0.3, 0.24], e: 0.1, hint: [1, 0, 0], bone: 'head', join: 0.12 },
    { name: 'padR', c: [0.12, 0.6, 2.46], u: unit([0.3, 1, -0.1]), r: [0.15, 0.15, 0.13], hint: [0, 0, 1], bone: 'head', group: 'Belly', join: 0.08 },
    { name: 'chin', c: [0, 0.48, 2.28], u: [0, 1, 0], r: [0.12, 0.13, 0.08], hint: [1, 0, 0], bone: 'head', group: 'Belly', join: 0.08 },
    { name: 'nose', c: [0, 0.69, 2.57], u: unit([0, 0.3, -1]), r: [0.06, 0.1, 0.05], e: 0.5, hint: [1, 0, 0], bone: 'head', group: 'Nose', join: 0.03 }],
    mouth: { nose: [0, 0.72, 2.52], centre: [0, 0.72, 2.4], corner: [0.17, 0.62, 2.4], pivot: [0, 0.45, 2.47] }, nose: 'nose', pale: ['padR', 'padL', 'chin'] }),
  // (a capybara's: a long deep BOXY snout ending square, a wide flat nose high on its front, a deep chin)
  capybara: () => ({ eggs: [
    { name: 'muzzle', c: [0, 0.6, 2.55], u: unit([0, 1, -0.15]), r: [0.5, 0.36, 0.36], e: 0.05, hint: [1, 0, 0], bone: 'head', join: 0.12 },
    { name: 'snoutTip', c: [0, 1.0, 2.5], u: [0, 1, 0], r: [0.2, 0.34, 0.32], hint: [1, 0, 0], bone: 'head', join: 0.1 },
    { name: 'nose', c: [0, 1.17, 2.68], u: unit([0, 0.5, -1]), r: [0.05, 0.16, 0.05], hint: [1, 0, 0], bone: 'head', group: 'Nose', join: 0.03 },
    { name: 'chin', c: [0, 0.82, 2.2], u: [0, 1, 0], r: [0.16, 0.2, 0.1], hint: [1, 0, 0], bone: 'head', join: 0.08 }],
    mouth: { nose: [0, 1.2, 2.5], centre: [0, 1.18, 2.32], corner: [0.2, 0.98, 2.3], pivot: [0, 0.8, 2.35] }, nose: 'nose' }),
  // (a cat's: a bridge down from the brow, two puffy whisker pads and a chin, pale, and an inverted triangle of a nose at
  // the top of the pads, its point down to the mouth's line that parts them)
  feline: () => ({ eggs: [
    { name: 'bridge', c: [0, 0.4, 2.64], u: unit([0, 1, 0.1]), r: [0.3, 0.2, 0.17], e: 0.2, hint: [1, 0, 0], bone: 'head', join: 0.12 },
    { name: 'padR', c: [0.13, 0.54, 2.46], u: unit([0.3, 1, -0.1]), r: [0.17, 0.16, 0.14], hint: [0, 0, 1], bone: 'head', group: 'Belly', join: 0.08 },
    { name: 'chin', c: [0, 0.44, 2.32], u: [0, 1, 0], r: [0.12, 0.13, 0.09], hint: [1, 0, 0], bone: 'head', group: 'Belly', join: 0.08 },
    { name: 'nose', c: [0, 0.68, 2.62], u: unit([0, 0.3, -1]), r: [0.08, 0.13, 0.06], e: 0.6, hint: [1, 0, 0], bone: 'head', group: 'Nose', join: 0.03 }],
    mouth: { nose: [0, 0.7, 2.53], centre: [0, 0.68, 2.41], corner: [0.18, 0.57, 2.41], pivot: [0, 0.42, 2.48] }, nose: 'nose', pale: ['padR', 'padL', 'chin'] }),
  // (a moose's: a long face ending in a big bulbous nose that overhangs and droops past the lip, fat at its foot, its big
  // nostrils on its front; a small lip tucked back under it. (Its bell is not drawn: its head sits low on its shoulders,
  // where a flap under the throat would hang into the chest and never show))
  moose: () => ({ eggs: [
    { name: 'muzzle', c: [0, 0.6, 2.5], u: unit([0, 1, -0.35]), r: [0.52, 0.3, 0.28], e: 0.1, hint: [1, 0, 0], bone: 'head', join: 0.14 },
    { name: 'noseBulb', c: [0, 1.1, 2.14], u: unit([0, -0.45, 1]), r: [0.42, 0.4, 0.35], e: 0.4, hint: [1, 0, 0], bone: 'head', join: 0.12 },
    { name: 'nostrilR', c: [0.16, 1.42, 2.08], u: unit([0.3, 1, -0.2]), r: [0.09, 0.08, 0.045], hint: [0, 0, 1], bone: 'head', group: 'Ink', join: 0.02 },
    { name: 'chin', c: [0, 0.82, 1.9], u: [0, 1, 0], r: [0.15, 0.17, 0.1], hint: [1, 0, 0], bone: 'head', join: 0.08 }],
    mouth: { nose: [0, 1.12, 1.88], centre: [0, 1.08, 1.85], corner: [0.2, 0.86, 1.92], pivot: [0, 0.8, 2.0] }, nose: null }),
  // (a deer's: a narrow snout tapering to a black nose, a pale chin under it)
  cervid: () => ({ eggs: [
    { name: 'muzzle', c: [0, 0.6, 2.52], u: unit([0, 1, -0.28]), r: [0.5, 0.26, 0.24], e: 0.4, hint: [1, 0, 0], bone: 'head', join: 0.12 },
    { name: 'chin', c: [0, 0.72, 2.3], u: unit([0, 1, -0.2]), r: [0.26, 0.18, 0.1], hint: [1, 0, 0], bone: 'head', group: 'Belly', join: 0.08 },
    { name: 'nose', c: [0, 1.05, 2.42], u: unit([0, 1, 0.1]), r: [0.1, 0.13, 0.1], bone: 'head', group: 'Nose', join: 0.04 }],
    mouth: { nose: [0, 1.08, 2.32], centre: [0, 1.04, 2.27], corner: [0.15, 0.82, 2.3], pivot: [0, 0.7, 2.35] }, nose: 'nose', pale: ['chin'] }),
  // (a frog's: no snout, a broad flat upper lip, a pale throat under it, two small nostrils, the mouth's line right across
  // the face, its corners near the head's sides)
  frog: () => ({ eggs: [
    { name: 'muzzle', c: [0, 0.36, 2.5], u: [0, 1, -0.05], r: [0.32, 0.68, 0.22], e: 0.1, hint: [1, 0, 0], bone: 'head', join: 0.12 },
    { name: 'chin', c: [0, 0.28, 2.3], u: [0, 1, 0], r: [0.3, 0.6, 0.16], hint: [1, 0, 0], bone: 'head', group: 'Belly', join: 0.12 },
    { name: 'nose', c: [0, 0.66, 2.66], u: [0, 1, 0.2], r: [0.05, 0.13, 0.04], bone: 'head', group: 'Nose', join: 0.03 }],
    mouth: { nose: [0, 0.68, 2.49], centre: [0, 0.68, 2.46], corner: [0.56, 0.5, 2.5], pivot: [0, 0.4, 2.5] }, nose: 'nose', pale: ['chin'] }),
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
  // (a deer's: big, broad, set out to the sides and a little up, their faces forward)
  deer: () => ({ egg: { name: 'earR', c: [0.66, -0.1, 3.12], u: unit([0.85, -0.15, 0.55]), r: [0.42, 0.25, 0.07], e: 0.55, hint: [0, 0, 1], bone: 'head', join: 0.08 },
    inner: [[0.6, -0.04, 3.1], [0.84, -0.06, 3.24]], ir: [0.15, 0.1] }),
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
  // (a groundhog's: short, bushy and a little flattened, carried low, its tip a tuft)
  stub: () => ({ eggs: [{ name: 'tail0', c: [0, -1.08, 0.55], u: unit([0, -1, -0.3]), r: [0.36, 0.22, 0.16], e: 0.3, hint: [1, 0, 0], bone: 'pelvis', join: 0.12 }],
    tip: { name: 'tailTip', root: [0, -1.36, 0.47], aim: [0, -1, -0.2], len: 0.2, r: 0.12, curl: 15, bend: [0, 0, -1], bone: 'pelvis', join: 0.06 } }),
  // (a beaver's: the broad flat scaly PADDLE, dark, lying on the ground behind)
  paddle: () => ({ ground: true, eggs: [
    { name: 'tailRoot', c: [0, -0.86, 0.36], u: unit([0, -0.3, -1]), r: [0.26, 0.15, 0.11], bone: 'pelvis', group: 'Mane', join: 0.1 },
    { name: 'tail0', c: [0, -1.3, 0.12], u: [0, -1, -0.1], r: [0.62, 0.38, 0.07], e: 0.15, hint: [1, 0, 0], bone: 'pelvis', group: 'Mane', join: 0.12 }] }),
  flat: () => ({ eggs: [{ name: 'tail0', c: [0, -1.25, 0.32], u: [0, -1, -0.2], r: [0.52, 0.32, 0.08], hint: [1, 0, 0], bone: 'pelvis', join: 0.12 }] }),
  brushThin: () => TAILS.brush(),
  fan: () => ({ eggs: [], fan: true }),
  none: () => ({ eggs: [] }),
  // (a horse's: long hair falling from the dock down and back, a lock either side, in the mane's colour)
  horse: () => ({ eggs: [], tufts: [
    { name: 'tail', root: [0, -0.88, 0.62], aim: [0, -0.45, -0.75], len: 1.15, r: 0.2, tip: 0.35, curl: 30, bend: [0, -1, 0], bone: 'pelvis', group: 'Mane', join: 0.08 },
    { name: 'tailSideR', root: [0.07, -0.9, 0.6], aim: [0.22, -0.5, -0.7], len: 0.95, r: 0.15, tip: 0.3, curl: 34, bend: [0, -1, 0], bone: 'pelvis', group: 'Mane', join: 0.06 }] }),
  fluke: () => ({ eggs: [], tufts: [{ name: 'tail', root: [0, -0.7, 0.7], aim: [0, -1, 0.1], len: 0.9, r: 0.32, tip: 0.3, curl: 10, bend: [0, 0, 1], bone: 'pelvis', join: 0.2 }], fluke: true }),
};

/** a decoration kept only by its dial: scaled by it, dropped at 0 */
const dialled = (t, k) => (k > 0 ? { ...t, len: t.len * k, r: t.r * (0.6 + 0.4 * k) } : null);

/** a tail module moved from the raccoon's root to the silhouette's */
const TAIL0 = [0, -0.88, 0.6];
/** THE TAIL OF AN ANIMAL ON ALL FOURS: it rides the pelvis, which tips forward on all fours, so a tail rooted high and
 *  swept up behind the standing animal would aim at the sky, or over the back. Its root sits LOW on the round of the
 *  rump (`low` degrees under the pelvis ball's middle, on its back, `off` behind its surface: where the pelvis tipped on
 *  all fours turns it into the rump, never up the back) and the tail is drooped
 *  back about its root (`droop` degrees): standing it sweeps out behind, on all fours it rises behind */
export const FEATURE_TAIL = Object.freeze({ low: 75, droop: 25, off: 0.04 });
function tailRootOn(S) {
  const b = S.body.find((e) => e.name === 'belly'), a = (FEATURE_TAIL.low * Math.PI) / 180;
  return [0, b.c[1] - b.r[2] * Math.cos(a) - FEATURE_TAIL.off, b.c[2] - b.r[0] * (1 - (b.e ?? 0) / 2) * Math.sin(a)];
}
/** a tuft spec's path as feature-body.js tuft() lays it: its points, root to end (three links, each along the turned
 *  aim at its middle), and its direction along it */
function tuftPath(t, { dirs = false } = {}) {
  const A = unit(t.aim), bend = t.bend ?? [0, 0, -1], B0 = sub3(bend, mul(A, dot(bend, A))), Bn = Math.hypot(...B0) > 1e-9 ? unit(B0) : [0, 0, 0];
  const dirAt = (s) => unit(add(mul(A, Math.cos(((t.curl ?? 0) * s * Math.PI) / 180)), mul(Bn, Math.sin(((t.curl ?? 0) * s * Math.PI) / 180))));
  const pts = [t.root];
  for (let i = 0; i < 3; i++) pts.push(add(pts[i], mul(dirAt((i + 0.5) / 3), t.len / 3)));
  return dirs ? { pts, dirAt } : pts;
}
/** a tuft spec cut in two at its middle, the halves continuing one another (the same path, half the curl each, the
 *  radius met at the cut): the near half and the far half (on `tailEnd`), and the cut */
function halved(t) {
  const { dirAt } = tuftPath(t, { dirs: true }), tip = t.tip ?? 0.22, rm = t.r * (1 - (1 - tip) * Math.pow(0.5, 0.85));
  const near = { ...t, len: t.len / 2, curl: (t.curl ?? 0) / 2, tip: rm / t.r }, mid = tuftPath(near).at(-1);
  const far = { ...t, name: `${t.name}End`, root: mid, aim: dirAt(0.5), len: t.len / 2, curl: (t.curl ?? 0) / 2, r: rm, tip: (t.r * tip) / rm, bone: 'tailEnd' };
  return { near, far, mid };
}

/** a tail module turned back and down about its root by `deg` (its masses, its axes, its locks and its rings) */
function drooped(tl, deg) {
  const a = (-deg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
  const turn = (v) => (v ? [v[0], v[1] * c + v[2] * sn, v[2] * c - v[1] * sn] : v), at = (p) => add(TAIL0, turn(sub3(p, TAIL0)));
  const lock = (t) => ({ ...t, root: at(t.root), ...(t.aim ? { aim: turn(t.aim) } : {}), ...(t.bend ? { bend: turn(t.bend) } : {}) });
  return { ...tl, eggs: tl.eggs.map((e) => ({ ...e, c: at(e.c), ...(e.u ? { u: turn(e.u) } : {}), ...(e.hint ? { hint: turn(e.hint) } : {}) })),
    ...(tl.tufts ? { tufts: tl.tufts.map(lock) } : {}), ...(tl.tip ? { tip: lock(tl.tip) } : {}), ...(tl.rings ? { rings: tl.rings.map(([p, axis, ...x]) => [at(p), turn(axis), ...x]) } : {}) };
}
function tailAt(tl, anchor, k = 1) {
  if (k !== 1) {
    // (a tuned tail: the module grown about its root, its masses, its locks and its rings together)
    const g = (p) => add(TAIL0, mul([p[0] - TAIL0[0], p[1] - TAIL0[1], p[2] - TAIL0[2]], k)), lk = (t) => ({ ...t, root: g(t.root), len: t.len * k, r: t.r * k });
    tl = { ...tl, eggs: tl.eggs.map((e) => ({ ...e, c: g(e.c), r: sc(e.r, k) })), ...(tl.tufts ? { tufts: tl.tufts.map(lk) } : {}), ...(tl.tip ? { tip: lk(tl.tip) } : {}),
      ...(tl.rings ? { rings: tl.rings.map(([c, axis, w, R]) => [g(c), axis, w * k, R * k]) } : {}) };
  }
  const d = [anchor[0] - TAIL0[0], anchor[1] - TAIL0[1], anchor[2] - TAIL0[2]], mv = (p) => add(p, d);
  return { ...tl, eggs: tl.eggs.map((e) => ({ ...e, c: mv(e.c) })), ...(tl.tufts ? { tufts: tl.tufts.map((t) => ({ ...t, root: mv(t.root) })) } : {}),
    ...(tl.tip ? { tip: { ...tl.tip, root: mv(tl.tip.root) } } : {}), ...(tl.rings ? { rings: tl.rings.map(([c, ...x]) => [mv(c), ...x]) } : {}), at: mv };
}

/** a muzzle module stretched front to back from its root (a tuned muzzle: feature-tune.js), in the head's own frame */
const MUZZLE_ROOT = 0.3;
function stretched(mz, k) {
  if (k === 1) return mz;
  const y = (p) => [p[0], MUZZLE_ROOT + (p[1] - MUZZLE_ROOT) * k, p[2]], along = (u) => Math.abs(u[1]) / (Math.hypot(...u) || 1) > 0.7;
  return { ...mz, eggs: mz.eggs.map((e) => ({ ...e, c: y(e.c), r: along(e.u) ? [e.r[0] * k, e.r[1], e.r[2]] : e.r })),
    ...(mz.limbs ? { limbs: mz.limbs.map((l) => ({ ...l, a: y(l.a), b: y(l.b) })) } : {}),
    ...(mz.tufts ? { tufts: mz.tufts.map((t) => ({ ...t, root: y(t.root), len: t.len * k })) } : {}),
    mouth: Object.fromEntries(Object.entries(mz.mouth).map(([n, p]) => [n, y(p)])) };
}

/** `tune` a resolved tune (feature-tune.js resolveTune: { structure, decor, detail }); absent, the species as designed */
/** what a tune did, read back: the dials it moved, the tier, and where the function overrode an ask (a quadruped's arm
 *  asked shorter than reaching the floor allows is lengthened back) */
function tuneRead(tune, fn) {
  const moved = Object.fromEntries(Object.entries(tune.structure).filter(([, v]) => v !== 1)), notes = [];
  if (fn?.held?.includes('arms')) notes.push(`the arms asked ${moved.arms}× are kept as long as the forepaws need to reach the floor on all fours`);
  if (fn?.held?.includes('legs')) notes.push(`the legs asked ${moved.legs}× are kept as long as the trunk needs to clear the floor on all fours`);
  return { structure: moved, decoration: { ...tune.decor }, ...(tune.tuft ? { tuft: tune.tuft } : {}), detail: tune.detail.id, ...(notes.length ? { notes } : {}) };
}

export function featureBuild(card, { decor = {}, tune = null } = {}) {
  // (the structure's sizes: the family's designed ones and the operator's tune, multiplied: feature-tune.js)
  // (the decoration: the style's dials, a species' own (SPECIES_TUNE `decor`), the caller's, the operator's tune)
  const Z = sizesOf(card.family, tune?.structure ?? null), D = { ...FEATURE_DECOR, ...(SPECIES_TUNE[card.id]?.decor ?? {}), ...decor, ...(tune?.decor ?? {}) }, plan = PLAN_OF[card.family] ?? 'stander', P = PLANS[plan];
  // (the family's tuning, a species' own over it: SPECIES_TUNE)
  const T = { ...(FAMILY_TUNE[card.family] ?? {}), ...(SPECIES_TUNE[card.id] ?? {}) };
  // THE SILHOUETTE, read from the species' own body (feature-silhouettes.js)
  // (the style's rounding: every silhouette bottom-heavy and round, feature-silhouettes.js)
  // (side hips, a round animal's own (the tune's `hips: 'below'` for legs from the bottom of its ball): its legs on the
  // sides of its ball, feature-silhouettes.js)
  // (the front's proportion, thigh : body : thigh as 1 : 4 : 1, for a standing four-legged animal: feature-silhouettes.js)
  const silhouette = silhouetteOf(card.id, card.family, plan), Sr0 = rounded(SILHOUETTES[silhouette]);
  const Sr = FRONT_SILHOUETTES.includes(silhouette) && ['stander', 'hoofed', 'reptile'].includes(plan) ? fronted(Sr0, T.body ?? 1) : Sr0;
  const Sd = (tune?.hips ?? 'side') === 'side' && SIDE_HIPS.includes(silhouette) ? sideHips(Sr) : Sr;
  // THE FUNCTION (feature-function.js): a quadruped stands for the acting and drops onto all fours to move, so its
  // silhouette is fitted to its limbs (the species' hind against its fore) and to the floor
  // (a sitter, a frog, sits on its own all fours: SILHOUETTES squat)
  const quad = ['stander', 'hoofed', 'reptile'].includes(plan) && !Sd.limbless && !Sd.sitter;
  // (the operator's tune moves the trunk first, so the function fits the tuned body; a quadruped's legs and arms are asks
  // the function honours as far as the floor allows: feature-tune.js)
  const S0 = Z ? tunedSilhouette(Sd, Z, { quad }) : Sd;
  const fn = quad ? (Z ? functional(S0, speciesLimbs(card.id), { arms: Z.arms, legs: Z.legs, girth: Z.girth }) : functional(S0, speciesLimbs(card.id))) : null, S1 = fn ? fn.S : S0;
  const K = { ...(card.kit ?? {}), ...(T.kit ?? {}), ...(S1.limbless ? { tail: 'thin' } : {}), ...(SPECIES_KIT[card.id] ?? {}) };
  // THE HANDS' KIND; a wing folds back along the body on any silhouette (an owl's too, not down its side as a flipper)
  const handKind = S1.limbless ? 'none' : K.arms === 'flipper' ? 'flippers' : K.arms === 'wing' ? 'wings' : T.hands ?? P.hands;
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
  const headShape = T.headShape ?? hs.shape, B = structure(S, P, T1, headShape, Z), H = B.headAt, onHead = (p) => H(p), kH = B.kH;
  // (a tuned head's own parts grow with it: their places by the head's scale, their sizes here)
  const headEgg = kH === 1 ? (x) => ({ ...x, c: onHead(x.c) }) : (x) => ({ ...x, c: onHead(x.c), r: sc(x.r, kH) });
  const headTuft = kH === 1 ? (x) => ({ ...x, root: onHead(x.root) }) : (x) => (x ? { ...x, root: onHead(x.root), len: x.len * kH, r: x.r * kH } : x);
  // THE MUZZLE (the kit's, else the plan's), its mouth and its pale zone
  const mz0 = bk ? beakParts(bk, B.hd) : (MUZZLES[K.muzzle] ?? MUZZLES[P.muzzle])(), mz = stretched(mz0, Z?.muzzle ?? 1);
  // (a beak is made at the head's scale already; a muzzle module's sizes take the tuned head's)
  const mzEgg = bk ? (x) => ({ ...x, c: onHead(x.c) }) : headEgg, mzTuft = bk ? (x) => ({ ...x, root: onHead(x.root) }) : headTuft, mzR = bk ? 1 : kH;
  // (a raptor's head frowns: a brow ridge over each eye)
  if (hs.brow) B.eggs.push({ name: 'browRidgeR', c: H([0.3, 0.5, 2.99]), u: [1, 0.25, -0.15], r: sc([0.18, 0.1, 0.06], B.hd), hint: [0, 0, 1], bone: 'head', join: 0.06 });
  B.eggs.push(...mz.eggs.map(mzEgg));
  for (const l of mz.limbs ?? []) B.limbs.push(mzR === 1 ? { ...l, a: onHead(l.a), b: onHead(l.b) } : { ...l, a: onHead(l.a), b: onHead(l.b), ra: l.ra * mzR, rb: l.rb * mzR });
  for (const t of mz.tufts ?? []) B.tufts.push(mzTuft(t));
  const mouth = { ...Object.fromEntries(Object.entries(mz.mouth).map(([k, p]) => [k, onHead(p)])), rise: 0.05, sag: 0.012 };
  // (BUCK TEETH, a rodent's: two incisors side by side just under the mouth's middle, standing a little proud of the lip,
  // in the roster's own tooth colour (a beaver's orange))
  if (K.teeth === 'buck') { const m = mz.mouth.centre; B.eggs.push(headEgg({ name: 'incisorR', c: [0.042, m[1] - 0.05, m[2] - 0.09], u: unit([0, 0.25, -1]), r: [0.095, 0.042, 0.03], hint: [1, 0, 0], bone: 'head', group: 'Teeth', join: 0.01 })); }
  // THE EARS
  const ear = K.ears ? EARS[K.ears]?.() : null;
  // (the species' own ears: sized and rounded from its measures, the module's place and aim kept)
  const M = card.id && card.id !== 'raccoon' ? speciesMeasures(card.id) : {};
  const kE = Z?.ears ?? 1, measured = ear && M.ear && ['pointed', 'round', 'tall'].includes(K.ears);
  if (measured) {
    const k = kE === 1 ? M.ear.size : M.ear.size * kE, e0 = ear.egg;
    ear.egg = { ...e0, c: add(e0.c, [0.04 * (k - 1), 0, 0.12 * (k - 1)]), r: [e0.r[0] * k * (1 - 0.35 * M.ear.round), e0.r[1] * k * (1 + 0.25 * M.ear.round), e0.r[2]], e: r4(0.8 * (1 - M.ear.round)) };
    if (ear.inner) { ear.inner = ear.inner.map((q) => add(q, [0.04 * (k - 1), 0, 0.12 * (k - 1)])); ear.ir = ear.ir.map((x) => x * k); }
  } else if (ear && kE !== 1) {
    // (a tuned ear on a species the roster does not measure: the module grown on its own axis, its root kept)
    const e0 = ear.egg, U = unit(e0.u), grow = e0.r[0] * (kE - 1);
    ear.egg = { ...e0, c: at(e0.c, U, grow * 0.8), r: [e0.r[0] * kE, e0.r[1] * Math.sqrt(kE), e0.r[2]] };
    if (ear.inner) { ear.inner = ear.inner.map((q) => at(q, U, grow * 0.8)); ear.ir = ear.ir.map((x) => x * Math.sqrt(kE)); }
    if (ear.tuft) ear.tuft = { ...ear.tuft, root: at(ear.tuft.root, U, grow * 1.6), len: ear.tuft.len * kE };
  }
  if (ear) { B.eggs.push(headEgg(ear.egg)); if (ear.tuft && D.tufts > 0) B.tufts.push(headTuft(dialled(ear.tuft, D.tufts))); }
  // THE TAIL (the kit's, else the plan's)
  // (on an animal that goes on all fours, low on the rump and drooped back: FEATURE_TAIL)
  const kT = Z?.tail ?? 1, tl0 = (TAILS[K.tail] ?? TAILS[T.tail] ?? TAILS[P.tail])(), fourTail = quad && !tl0.ground;
  const root = fourTail ? tailRootOn(S) : S.tail, tl1 = tailAt(fourTail ? drooped(tl0, FEATURE_TAIL.droop) : tl0, root, kT);
  // (an animal on all fours carries its tail as its animal does: the tail rides TWO bones, turned on all fours from its
  // root and from its middle (feature-body.js carried), the near half's shapes on `tail`, the far half's on `tailEnd`, a
  // tuft cut in two at its middle (halved), so a curled tip can be straightened at a run)
  const onTail = (o) => ({ ...o, bone: 'tail' });
  let tl = fourTail ? { ...tl1, eggs: tl1.eggs.map(onTail), ...(tl1.tufts ? { tufts: tl1.tufts.map(onTail) } : {}), ...(tl1.tip ? { tip: onTail(tl1.tip) } : {}) } : tl1;
  if (fourTail) {
    const far = (p) => Math.hypot(...sub3(p, root)), cut = (tl.tufts ?? []).map(halved);
    const ends = [...tl.eggs.map((e) => e.c), ...cut.map((h) => tuftPath(h.far).at(-1)), ...(tl.tip ? [tuftPath(tl.tip).at(-1)] : [])];
    const tip = ends.reduce((a, p) => (far(p) > far(a) ? p : a), root), half = far(tip) / 2;
    if (far(tip) > 0.05) {
      const onEnd = (o) => ({ ...o, bone: 'tailEnd' }), eggs = tl.eggs.map((e) => (far(e.c) > half ? onEnd(e) : e));
      // (the middle joint on the tail itself: a cut tuft's middle, else the egg nearest half the tail's reach)
      const mid = cut.length ? cut[0].mid : tl.eggs.reduce((a, e) => (Math.abs(far(e.c) - half) < Math.abs(far(a) - half) ? e.c : a), tl.eggs[0]?.c ?? add(root, mul(sub3(tip, root), 0.5)));
      tl = { ...tl, eggs, ...(cut.length ? { tufts: cut.flatMap((h) => [h.near, h.far]) } : {}), ...(tl.tip ? { tip: onEnd(tl.tip) } : {}) };
      B.tail = { root, mid, tip, carriage: speciesTail(card.id) };
    }
  }
  // (a tail that rests on the GROUND, a beaver's paddle: laid on the floor however high the body stands, its root
  // spanning down from the rump to it)
  if (tl.ground) {
    const pad = tl.eggs.find((e) => e.name === 'tail0'), root = tl.eggs.find((e) => e.name === 'tailRoot');
    pad.c = [pad.c[0], pad.c[1], pad.r[2] + 0.02];
    const front = [0, pad.c[1] + pad.r[0] * 0.8, pad.c[2]], d = sub3(S.tail, front), L = Math.hypot(...d);
    Object.assign(root, { c: add(front, mul(d, 0.6)), u: unit(d), r: [L * 0.6 + 0.12, root.r[1], root.r[2]] });
  }
  B.eggs.push(...tl.eggs);
  for (const t of tl.tufts ?? []) B.tufts.push(t);
  if (tl.tip && D.tufts > 0) B.tufts.push(dialled(tl.tip, D.tufts));
  // (a bird's tail: a fan along its body's axis, reaching past the body by the head's length over φ)
  const TA = bodyAxis[1] < -0.5 ? bodyAxis : unit([0, -1, -0.35]), [, rear] = extentAlong(bodyMass, TA), belly1 = S.body.find((e) => e.name === 'belly').c;
  const tailRoot = add(belly1, mul(TA, rear - dot(belly1, TA) - 0.25)), tailLen = kT === 1 ? headLen(B.hd) / PHI : (headLen(B.hd) / PHI) * kT;
  if (tl.fan && D.tufts > 0) [-40, -14, 14, 40].forEach((f, i) => {
    const a = (f * Math.PI) / 180, aim = unit(add(mul(TA, Math.cos(a)), [Math.sin(a), 0, 0])), reachOf = tailLen * (1 - Math.abs(f) * 0.004);
    B.tufts.push(dialled({ name: `tailFeather${i}`, root: tailRoot, aim, len: (reachOf + rear - dot(tailRoot, TA)) / dot(aim, TA), r: 0.13, tip: 0.2, curl: 6, bend: [0, 0, -1], bone: 'pelvis', group: plume.tip ? 'Tip' : undefined, join: 0.05 }, D.tufts));
  });
  if (tl.fluke && D.fins > 0) B.tufts.push(dialled({ name: 'flukeR', root: tl.at([0, -1.5, 0.82]), aim: [1, -0.4, 0.1], len: 0.5 * kT, r: 0.14 * kT, tip: 0.2, curl: 20, bend: [0, -1, 0], bone: 'pelvis', join: 0.05 }, D.fins));
  // THE HANDS AND THE FEET
  hands(B, handKind, T, D, plume, Z?.hands ?? 1);
  const foot = B.eggs.find((e) => e.name === 'footR');
  if (K.feet === 'hooves' || P.hands === 'hooves') Object.assign(foot, { r: [0.18, 0.17, 0.12], group: 'Hoof' });
  else if (S.bird) {
    // (a standing bird's foot: three toes forward and one back off a small pad, the leg's colour)
    const a = B.joints.ankle, pad = [a[0], a[1] + 0.04, 0.05];
    Object.assign(foot, { c: pad, r: [0.1, 0.09, 0.055], e: 0, group: 'Sock', join: 0.04 });
    const kF = Z?.feet ?? 1;
    [[-28, 0.24 * kF], [0, 0.28 * kF], [28, 0.24 * kF], [180, 0.14 * kF]].forEach(([fan, len], i) => {
      const f = (fan * Math.PI) / 180, d = [Math.sin(f) * 0.9, Math.cos(f), -0.08];
      B.limbs.push({ name: `toe${i}R`, a: pad, b: add(pad, mul(unit(d), len)), ra: 0.055, rb: 0.035, bone: 'metaR', group: 'Sock', join: 0.03 });
    });
  } else if (K.feet === 'webbed') {
    // (a webbed foot: long and flat, its heel at the ankle and its toes reaching forward, fanned, each ending in a round
    // pad; never a disc lying apart from the leg)
    const a = B.joints.ankle, fwd = unit([0.22, 1, 0]), L0 = 0.36 * B.ft, c = [a[0] + fwd[0] * L0 * 0.8, a[1] + fwd[1] * L0 * 0.8, 0.06];
    Object.assign(foot, { c, u: mul(fwd, -1), r: [L0, 0.26, 0.05], e: 0.4, hint: [1, 0, 0], group: plan === 'bird' ? 'Beak' : undefined });
    const toe0 = at(c, fwd, L0 * 0.8);
    [-30, 0, 30].forEach((fan, i) => { const f = (fan * Math.PI) / 180, d = unit([fwd[0] * Math.cos(f) + Math.sin(f), fwd[1] * Math.cos(f) - fwd[0] * Math.sin(f) * 0.2, 0]);
      B.tufts.push({ name: `webToe${i}R`, root: at(toe0, [Math.sin(f), 0, 0], 0.1), aim: d, len: 0.2 * B.ft, r: 0.045, tip: 1.5, curl: 0, bend: [0, 0, -1], bone: 'metaR', ...(plan === 'bird' ? { group: 'Beak' } : {}), join: 0.03 }); });
  }
  else if (T.paws === 'dark') foot.group = 'Patch';
  // THE SKIN'S POINTED DETAILS, by its kind (round blobs, pointy details: a fan of falling lengths)
  if (P.skin === 'fur' && P.ruffs && D.tufts > 0) for (const t of [
    { name: 'cheekAR', root: [0.66, 0.04, 2.5], aim: [0.92, -0.1, -0.38], len: 0.44, r: 0.17, curl: 22, bend: [0, -0.3, -1], bone: 'head', join: 0.07 },
    { name: 'cheekBR', root: [0.62, 0.0, 2.4], aim: [0.78, -0.35, -0.52], len: 0.36, r: 0.15, curl: 18, bend: [0, -1, -0.2], bone: 'head', join: 0.07 },
    { name: 'cheekCR', root: [0.64, 0.06, 2.64], aim: [0.97, -0.15, 0.1], len: 0.34, r: 0.14, curl: 28, bend: [0, -0.4, -1], bone: 'head', join: 0.07 },
  ]) B.tufts.push(headTuft(dialled(t, D.tufts)));
  // (the crown's fan: asymmetric, overlapping, swept one way; a bird's head stays smooth unless its kit names a crest)
  // (a tuft the operator chose (feature-tufts.js) is worn in its place, on any skin: the head's own look, personal)
  const tuft = tune?.tuft ?? null;
  if (tuft) B.tufts.push(...tuftLocks(tuft, { shape: headShape, dial: D.crown }).map(headTuft));
  else if (P.skin === 'fur' && D.crown > 0 && !K.horns && !['crest', 'flow'].includes(K.mane)) {
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
  // (the detail tier's secondary clumps: a hero model's fuller fur, a wing's coverts, a back's second row: feature-tune.js)
  if (tune?.detail?.clumps) B.tufts.push(...detailClumps({ plan, skin: P.skin, B, S, K, D, headTuft, tail: tl, ruffs: P.ruffs, tuft }));
  // THE KIT'S OWN DECORATION: horns, a mane, a fin, a shell, a long neck, the eyes on top
  if (K.horns === 'antlers' && D.horns > 0) {
    // (antlers: a beam each side rising up and back and curving forward, its tines rising off it: the brow tine forward
    // near its root, two more up along it, falling in length)
    const k = D.horns, beam = { name: 'antlerR', root: [0.24, -0.08, 3.34], aim: unit([0.4, -0.45, 1]), len: 0.8 * k, r: 0.075, tip: 0.5, curl: 45, bend: [0.2, 1, 0], bone: 'head', group: 'Horn', join: 0.04 };
    const A = beam.aim, B0 = sub3(beam.bend, mul(A, dot(beam.bend, A))), Bn = unit(B0), along = (t) => {
      let p = beam.root; const n = 12; for (let i = 0; i < n * t; i++) { const a = rad(beam.curl * ((i + 0.5) / n)); p = add(p, mul(unit(add(mul(A, Math.cos(a)), mul(Bn, Math.sin(a)))), beam.len / n)); } return p; };
    B.tufts.push(headTuft(beam));
    [[0.17, [0.1, 1, 0.45], 0.3], [0.5, [0.3, 0.3, 1], 0.32], [0.8, [0.15, 0.5, 1], 0.24]].forEach(([t, aim, len], i) =>
      B.tufts.push(headTuft({ name: `antlerTine${i}R`, root: along(t), aim: unit(aim), len: len * k, r: 0.05, tip: 0.35, curl: 15, bend: [0, 1, 0], bone: 'head', group: 'Horn', join: 0.03 })));
  } else if (K.horns === 'palmate' && D.horns > 0) {
    // (a moose's: a short beam out from each side of the head carrying a broad flat PALM, spread out and up like an open
    // hand held up, its broad face to the front, points along its outer and upper rim)
    const k = D.horns, root = [0.3, -0.05, 3.3], out = unit([1, -0.15, 0.35]);
    B.tufts.push(headTuft({ name: 'antlerR', root, aim: out, len: 0.42 * k, r: 0.075, tip: 0.8, curl: 0, bend: [0, 0, 1], bone: 'head', group: 'Horn', join: 0.04 }));
    const U = unit([0.85, -0.1, 0.55]), up = [0, -0.3, 1], V = unit(sub3(up, mul(U, dot(up, U)))), c = add(at(root, out, 0.38 * k), mul(U, 0.42 * k)), palm = { name: 'palmR', c, u: U, r: [0.5 * k, 0.34 * k, 0.05], e: 0.25, hint: V, bone: 'head', group: 'Horn', join: 0.05 };
    B.eggs.push(headEgg(palm));
    // (the points: along the rim's outer half, each standing out of it and up)
    const W = unit(cross(U, V));
    [-10, 25, 55, 85, 115].forEach((deg, i) => {
      const t = rad(deg), rim = add(c, add(mul(U, 0.5 * k * 0.85 * Math.cos(t)), mul(V, 0.34 * k * 0.9 * Math.sin(t))));
      const aim = unit(add(add(mul(U, Math.cos(t)), mul(V, Math.sin(t) * 0.8)), mul(W[1] > 0 ? W : mul(W, -1), 0.25)));
      B.tufts.push(headTuft({ name: `palmTine${i}R`, root: rim, aim, len: (0.2 + 0.04 * (2 - Math.abs(i - 2))) * k, r: 0.05, tip: 0.3, curl: 0, bend: [0, 0, 1], bone: 'head', group: 'Horn', join: 0.03 }));
    });
  } else if (K.horns && D.horns > 0) {
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
  // (a long neck, a giraffe's: the head raised high over a slim neck that tapers up to it from shoulders it does not
  // swallow; its base no wider than they are)
  if (K.neck === 'long') {
    const NL = FEATURE_PROPORTION.longNeck;
    headLift += NL;
    B.eggs.push({ name: 'neckLong', c: [0, S.hy + 0.08, S.neckZ + NL / 2 + 0.05], u: unit([0, 0.16, 1]), r: [NL / 2 + 0.22, 0.2, 0.22], e: 0.3, bone: 'neck', join: 0.12 });
    const base = B.eggs.find((e) => e.name === 'neck'); if (base) base.r = [base.r[0], Math.min(base.r[1], 0.3), Math.min(base.r[2], 0.3)];
  }
  // (a tuned neck: the head raised over it, its neck's own mass stretched to meet it; a head merged into the body has none)
  const kN = Z?.neck ?? 1;
  if (kN !== 1 && S.neck !== 'merged') {
    const up = (kN - 1) * 0.45;
    headLift += up;
    for (const e of B.eggs) if (e.name === 'neck' || e.name === 'neckLong') { const U = unit(e.u); e.c = at(e.c, U, up / 2); e.r = [Math.max(0.08, e.r[0] + up / 2), e.r[1], e.r[2]]; }
  }
  // (a flowing mane, a horse's: locks along the neck's crest from the poll to the withers, falling to one side, and a
  // forelock over the brow; laid once the head's lift over the neck is known, the neck's locks on the neck's bone)
  if (K.mane === 'flow' && D.mane > 0) {
    const chest = B.eggs.find((e) => e.name === 'chest'), poll = add(H([0, -0.4, 3.16]), [0, 0, headLift]), withers = [0, chest.c[1] - chest.r[2] * 0.55, chest.c[2] + chest.r[0] * 0.7];
    for (let i = 0; i < 6; i++) {
      const t = i / 5, root = add(add(mul(poll, 1 - t), mul(withers, t)), [0, -0.05, 0]);
      B.tufts.push(dialled({ name: `mane${i}`, root, aim: unit([0.75, -0.3, -0.3]), len: 0.5 - 0.12 * t, r: 0.14, tip: 0.2, curl: 30, bend: [0.3, 0, -1], bone: 'neck', group: 'Mane', join: 0.06 }, D.mane));
    }
    B.tufts.push(headTuft(dialled({ name: 'forelock', root: [0, -0.02, 3.36], aim: [0.1, 0.75, -0.35], len: 0.36, r: 0.12, tip: 0.2, curl: 25, bend: [0, 0, -1], bone: 'head', group: 'Mane', join: 0.05 }, D.mane)));
  }
  const eye0 = { ...P.eye, ...(K.eyes === 'top' ? { el: 32, az: 20 } : {}), proud: 0.42, ...(T.eye ?? {}) }, kY = (Z?.eyes ?? 1) * kH;
  // (eyes bulging on domes: a frog's, on top of its head; each dome on the ray the face seats its globe along, so the
  // globe sits on it: feature-face.js)
  if (T.eyeDomes) {
    const cr = B.eggs.find((e) => e.name === 'cranium'), az = rad(eye0.az), el = rad(eye0.el), d = [Math.cos(el) * Math.sin(az), Math.cos(el) * Math.cos(az), Math.sin(el)];
    const t = 0.82 / Math.hypot(d[0] / cr.r[1], d[1] / cr.r[0], d[2] / cr.r[2]), rD = eye0.r * kY * 1.3;
    B.eggs.push({ name: 'eyeDomeR', c: add(B.head.C, mul(d, t)), u: d, r: [rD, rD, rD], bone: 'head', join: 0.1 });
  }
  const eye = kY === 1 ? eye0 : { ...eye0, r: r4(eye0.r * kY) };
  // THE COAT: zones cut into the skin (the pale muzzle, the nose, the pale belly, the dark paws), layers over it (the
  // pattern's strokes, the inner ears, the tail's rings), the markings' layers by their dial
  const names = new Set([...B.eggs.map((e) => e.name), ...B.eggs.filter((e) => /R$/.test(e.name)).map((e) => e.name.replace(/R$/, 'L'))]);
  const has = (n) => names.has(n);
  const zone = (name, group, eggs) => { const own = eggs.filter(has); if (own.length) B.marks.push({ name, group, eggs: own }); };
  if (mz.eggs.some((e) => e.name === 'muzzle' && e.group === 'Belly')) zone('muzzle', 'Belly', ['muzzle', 'chin', 'jowlR', 'jowlL']);
  if (mz.nose && mz.nose !== 'beak' && mz.nose !== 'bill') zone('nose', 'Nose', [mz.nose]);
  if (mz.pale) zone('throat', 'Belly', mz.pale);
  // (the belly: the species' own, on this silhouette, or none)
  // (a tuned body's belly moves with it: the girth's breadth and depth, and as high as the tuned fit raised the body over
  // the designed one's)
  let table = Sd.belly;
  if (Z) {
    const designedHip = quad ? functional(Sd, speciesLimbs(card.id)).S.hip[2] : Sd.hip[2], dz = S.hip[2] - designedHip;
    table = Object.fromEntries(Object.entries(tunedSilhouette(Sd, { girth: Z.girth }).belly).map(([k, e]) => [k, { ...e, c: [e.c[0], e.c[1], e.c[2] + dz] }]));
  }
  const belly = bellyOf(card.id, silhouette, { plan, pattern: K.pattern, tune: T.belly, table });
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
  // (STRIPES, a zebra's, a tiger's: bold rings round the whole standing figure, from the feet up the neck to under the jaw.
  // On an animal standing up, the stripes that run from its spine down its flank, and those round its legs, all run
  // round it; their widths in a falling rhythm, their edges notched so each ends in points)
  if (K.pattern === 'stripes' && D.markings > 0) {
    // (as a body wears them: each stripe from the spine (the back's middle on an animal standing up) round the flank to a
    // point at the belly, widest at the spine; a zebra's points meet under it in chevrons, a cat's stop short of its pale
    // belly (FAMILY_TUNE `stripes`); the legs' are rings round them)
    const R = { ...FEATURE_STRIPES, ...(T.stripes ?? {}) }, zTop = S.neckZ + headLift - R.under, n = Math.min(R.most, Math.floor((zTop - R.from) / R.pitch) + 1);
    const legTop = S.hip[2] - 0.1;
    // (cut into the skin as a zone along their exact edges, as a big marking is: no layer of faces laid over it)
    B.marks.push({ name: 'stripes', group: 'Patch', cut: true, bands: Array.from({ length: n }, (_, i) => {
      const z = R.from + i * R.pitch, leg = z < legTop;
      return { c: [0, S.hy * 0.5, z], axis: unit([0, R.lean * (i % 2 ? 1 : -1), 1]), w: R.w[i % R.w.length] * R.width, R: R.reach, teeth: R.teeth, depth: R.depth,
        ...(leg ? {} : { arc: { back: [0, -1, 0], end: R.end, taper: R.taper } }) };
    }) });
  }
  // (a NETWORK of patches, a giraffe's: big rounded polygons in the coat's own darker colour, parted by thin lines of the
  // coat, over the body, the legs and the neck to under the head)
  if (K.pattern === 'reticulated' && D.markings > 0) {
    const N = FEATURE_NETWORK, rand = mulberry32(N.seed), top = S.neckZ + headLift - N.under, seeds = [];
    for (let z = N.from; z <= top + N.pitch; z += N.pitch) for (let x = -N.span; x <= N.span + 1e-9; x += N.pitch) for (let y = -N.span; y <= N.span + 1e-9; y += N.pitch)
      seeds.push([x + (rand() - 0.5) * N.jitter * N.pitch, y + (rand() - 0.5) * N.jitter * N.pitch, z + (rand() - 0.5) * N.jitter * N.pitch].map(r4));
    B.marks.push({ name: 'network', group: 'Spot', cut: true, cells: [{ seeds, line: N.line, top }] });
  }
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
    family: card.family, plan, silhouette, belly: belly.kind, ...(K.face ? { face: K.face } : {}), ...(fn ? { fit: fn.fit, fours: fn.fours, dog: fn.dog } : {}),
    ...(tune ? { tune: tuneRead(tune, fn) } : {}),
    heads: S.heads, splay: FEATURE_PROPORTION.splay, ...(handKind === 'wings' ? { fold: B.ARM.map(r4) } : {}), seam: P.seam * S.seam, headLift,
    eggs: B.eggs.filter(Boolean), tufts: B.tufts.filter(Boolean), limbs: B.limbs, ...(B.digits ? { digits: B.digits } : {}), ...(B.tail ? { tail: B.tail } : {}), marks: B.marks,
    eye, mouth, joints: B.joints, hipZ: r4(B.hipZ), neckZ: r4(B.neckZ), top: r4(B.top + (K.ears === 'tall' ? 0.5 : 0)),
    head: B.head, muzzle: muzzle ? { C: muzzle.c, rx: muzzle.r[1], ry: muzzle.r[0], rz: muzzle.r[2] } : { C: onHead([0, 0.5, 2.5]), rx: 0.2, ry: 0.25, rz: 0.16 },
  });
}
