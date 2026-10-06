/**
 * locomotion — how each animal moves, by the biomechanics of its family: the data a gait compiler reads, and the
 * gait list an encyclopedia entry shows. Nothing here reaches a plan; every species builds byte-identically.
 *
 * Three layers, so the plain word stays in front and the mechanism stays behind it:
 *  - GAITS: the plain words agents and people say (walk, trot, gallop, hop, slither, swim, …), one line each;
 *  - PATTERNS: the mechanism a word points at: a FOOTFALL pattern (phase offset per foot, a fraction of one stride,
 *    0 = left-hind touchdown; Hildebrand's convention) or a BODY WAVE / STROKE (fish, snakes, wings, flippers);
 *  - the RIG files (one per shared rig, `./<rig>.js`): each family's entry, with species overrides.
 *
 * A family entry: `{ spine, gaits, axial, note, source, species? }`.
 *  - spine  `{ trunk, neck, tail }` bone counts, FIXED PER FAMILY (a category thing); a species overrides it only
 *           where a family holds two body plans (the monitor lizard among the snakes, the manta among the sharks).
 *  - gaits  `{ <plain word>: { pattern, duty?, stride?, fr?, …wave } }`, slowest first. `duty` is the fraction of
 *           the stride a foot is down (> .5 walking, < .5 a flight phase); `stride` is stride length / hip height;
 *           `fr` the speed band as Froude number v²/(g·h) — gaits change at about the same Fr whatever the size
 *           (Alexander & Jayes 1983), so one table drives a fox and an elephant. Wave gaits carry wave numbers.
 *  - axial  how the body rides the stride: `flex` (up-and-down spine flexion, 0..1), `lateral` (sideways bend,
 *           0..1), `wave` ('none' | 'standing' | 'travelling'), `roll` / `yaw` (girdle rotation, 0..1), `head`
 *           ('steady' | 'nod' | 'thrust' | 'sway' | 'reach'), `tail` ('none' | 'still' | 'trail' | 'counter' |
 *           'prop' | 'drive').
 *  - species `{ <id>: { gaits?, axial?, spine?, note? } }`: merged over the family; a gait set to null is removed.
 *
 * Numbers are textbook approximations that make an animal read right, not measured data. Where scientists disagree,
 * the entry takes the more visual reading and says so in a `// disputed:` comment beside it (operator, 2026-10-06).
 */
import { RIG as QDIG, FAMILIES as QDIG_F } from './cursorial.js';
import { RIG as QUNG, FAMILIES as QUNG_F } from './hoofed.js';
import { RIG as QPLANT, FAMILIES as QPLANT_F } from './flatfooted.js';
import { RIG as QGRAV, FAMILIES as QGRAV_F } from './graviportal.js';
import { RIG as QSPRAWL, FAMILIES as QSPRAWL_F } from './sprawling.js';
import { RIG as SHOP, FAMILIES as SHOP_F } from './saltatorial.js';
import { RIG as BDIG, FAMILIES as BDIG_F } from './biped.js';
import { RIG as WWALK, FAMILIES as WWALK_F } from './wingwalker.js';
import { RIG as AXIAL, FAMILIES as AXIAL_F } from './axial.js';

/** The plain words, each with the one line that says what it looks like. */
export const GAITS = Object.freeze({
  walk:       'four-beat stepping, always a foot or more down',
  stalk:      'a low, slow, crouched walk, placing each foot',
  crawl:      'a low walk with the belly near or on the ground',
  waddle:     'short steps with the body rolling side to side',
  upright:    'a few steps walking upright on the hind legs',
  amble:      'a fast walk, never all feet off the ground',
  pace:       'the two legs on one side step together',
  trot:       'diagonal legs step together',
  canter:     'a three-beat rocking run',
  gallop:     'the fastest run: four beats and a flight phase',
  bound:      'the front pair, then the back pair, the back arching',
  pronk:      'all four feet leave and land together (a display leap)',
  run:        'a two-legged run',
  hop:        'both hind feet push off and land together',
  slither:    'side-to-side waves pass down the body',
  sidewind:   'the body lifts and lands in angled bars, moving sideways',
  concertina: 'bunches up, anchors, and stretches forward',
  creep:      'moves straight, belly scales walking the body along',
  slide:      'tobogganing on the belly',
  swim:       'swims',
  fly:        'flies by flapping',
  glide:      'soars or glides on still wings',
});

const q = (LH, LF, RH, RF) => ({ LH, LF, RH, RF });

/**
 * The mechanisms. `feet` patterns give each foot's touchdown phase; the gallops show the right-lead (mirror for the
 * left). `wave` patterns give the default body wave: `waves` wavelengths on the body, `amp` peak amplitude as a
 * fraction of body length, `from` where bending starts (0 = the head), `plane` lateral or vertical.
 */
export const PATTERNS = Object.freeze({
  // four feet (Hildebrand 1965 symmetrical, 1977 asymmetrical gaits)
  lateralWalk:      { kind: 'feet', feet: q(0, 0.25, 0.5, 0.75) },
  diagonalWalk:     { kind: 'feet', feet: q(0, 0.75, 0.5, 0.25) },   // primates
  trot:             { kind: 'feet', feet: q(0, 0.5, 0.5, 0) },
  pace:             { kind: 'feet', feet: q(0, 0, 0.5, 0.5) },
  canter:           { kind: 'feet', feet: q(0, 0.3, 0.3, 0.6) },     // trailing hind, diagonal pair, leading fore
  transverseGallop: { kind: 'feet', feet: q(0, 0.5, 0.1, 0.6) },     // horse: fore and hind leads on the same side
  rotaryGallop:     { kind: 'feet', feet: q(0, 0.6, 0.1, 0.5) },     // dog, cheetah: the footfalls go round
  halfBound:        { kind: 'feet', feet: q(0, 0.45, 0.05, 0.55) },
  bound:            { kind: 'feet', feet: q(0, 0.5, 0, 0.5) },
  pronk:            { kind: 'feet', feet: q(0, 0, 0, 0) },
  saltation:        { kind: 'feet', feet: q(0, 0.45, 0, 0.45) },     // frog: hinds launch, fores catch
  pentapedal:       { kind: 'feet', feet: { LF: 0, RF: 0, tail: 0, LH: 0.5, RH: 0.5 } },   // kangaroo slow walk
  // two feet
  bipedWalk:        { kind: 'feet', feet: { L: 0, R: 0.5 } },
  bipedRun:         { kind: 'feet', feet: { L: 0, R: 0.5 } },
  bipedHop:         { kind: 'feet', feet: { L: 0, R: 0 } },
  // body waves (Gray 1968; Jayne 1986 for snakes; Breder 1926 and Lauder & Tytell 2005 for fish)
  lateralUndulation: { kind: 'wave', waves: 2, amp: 0.08, from: 0, plane: 'lateral' },     // snake: travelling
  sidewinding:       { kind: 'wave', waves: 1.5, amp: 0.12, from: 0, plane: 'lateral', lift: true },
  concertina:        { kind: 'wave', waves: 2, amp: 0.1, from: 0, plane: 'lateral', anchors: 2 },
  rectilinear:       { kind: 'wave', waves: 3, amp: 0.01, from: 0, plane: 'vertical' },    // belly scales only
  verticalHumps:     { kind: 'wave', waves: 2.5, amp: 0.1, from: 0.1, plane: 'vertical' }, // otter swim, sea serpent
  anguilliform:      { kind: 'wave', waves: 1.5, amp: 0.1, from: 0, plane: 'lateral' },    // eel: the whole body
  subcarangiform:    { kind: 'wave', waves: 1, amp: 0.1, from: 0.3, plane: 'lateral' },    // salmon, goldfish
  carangiform:       { kind: 'wave', waves: 0.8, amp: 0.08, from: 0.5, plane: 'lateral' }, // the rear half
  thunniform:        { kind: 'wave', waves: 0.6, amp: 0.1, from: 0.7, plane: 'lateral' },  // stiff body, tail beats
  tailDrive:         { kind: 'wave', waves: 1, amp: 0.12, from: 0.45, plane: 'lateral' },  // crocodile, lizard swim
  // strokes (paired limbs or fins as the propulsor)
  labriform:     { kind: 'stroke', limbs: 'pectoral', phase: 0, note: 'rows with the pectoral fins' },
  medianPaired:  { kind: 'stroke', limbs: 'fins', phase: 0, note: 'sculls with the dorsal, anal and pectoral fins' },
  mobuliform:    { kind: 'stroke', limbs: 'pectoral', phase: 0, waves: 0.5, note: 'the pectoral wings flap with a wave along the span' },
  flipperFlight: { kind: 'stroke', limbs: 'flippers', phase: 0.5, note: 'four flippers fly underwater; hind half a beat behind the fore' },
  forelimbRow:   { kind: 'stroke', limbs: 'fore', phase: 0.5, note: 'the fore paddles row alternately' },
  frogKick:      { kind: 'stroke', limbs: 'hind', phase: 0, note: 'both hind legs kick together' },
  wingRow:       { kind: 'stroke', limbs: 'wings', phase: 0, note: 'the flipper-wings beat together underwater' },
  paddle:        { kind: 'stroke', limbs: 'hind', phase: 0.5, note: 'the webbed hind feet paddle alternately' },
  wingbeat:      { kind: 'stroke', limbs: 'wings', phase: 0, note: 'downstroke spread, upstroke folded' },
  soar:          { kind: 'stroke', limbs: 'wings', phase: 0, still: true, note: 'wings held spread' },
  belly:         { kind: 'stroke', limbs: 'wings', phase: 0.5, note: 'on the belly, pushed by the feet and flippers' },
});

/** The nine shared rigs: one bone table and one solver each; families inside a rig differ only in numbers. */
export const RIGS = Object.freeze(Object.fromEntries([QDIG, QUNG, QPLANT, QGRAV, QSPRAWL, SHOP, BDIG, WWALK, AXIAL].map((r) => [r.id, r])));

const ALL = [[QDIG, QDIG_F], [QUNG, QUNG_F], [QPLANT, QPLANT_F], [QGRAV, QGRAV_F], [QSPRAWL, QSPRAWL_F],
  [SHOP, SHOP_F], [BDIG, BDIG_F], [WWALK, WWALK_F], [AXIAL, AXIAL_F]];

/** Every family's locomotion entry, tagged with its rig. */
export const LOCOMOTION = Object.freeze(Object.fromEntries(ALL.flatMap(([rig, fams]) =>
  Object.entries(fams).map(([family, e]) => [family, { rig: rig.id, ...e }]))));

/** A family entry with one species' overrides merged over it (a gait set to null drops out). */
export function mergeLocomotion(entry, over) {
  const { species: _s, ...base } = entry;
  if (!over) return { ...base, gaits: orderGaits(base.gaits) };
  const gaits = { ...base.gaits };
  for (const [g, v] of Object.entries(over.gaits || {})) {
    if (v === null) delete gaits[g];
    else gaits[g] = { ...(base.gaits[g] || {}), ...v };
  }
  return {
    ...base,
    rig: over.rig || base.rig,
    spine: over.spine ? { ...base.spine, ...over.spine } : base.spine,
    axial: over.axial ? { ...base.axial, ...over.axial } : base.axial,
    gaits: orderGaits(gaits),
    note: over.note || base.note,
  };
}

/**
 * Gaits slowest first, so a card reads the same way for every animal: the legged gaits by their speed band (where
 * it starts, then where it ends), then the rest (swim, fly, …) in the GAITS order.
 */
function orderGaits(gaits) {
  const order = Object.keys(GAITS);
  const key = ([w, g]) => [g.fr ? g.fr[0] : Infinity, g.fr ? g.fr[1] : Infinity, order.indexOf(w)];
  return Object.fromEntries(Object.entries(gaits).sort((a, b) => {
    const A = key(a), B = key(b);
    return A[0] - B[0] || A[1] - B[1] || A[2] - B[2];
  }));
}

/** A species' locomotion, given its family id. */
export function locomotionFor(family, id) {
  const e = LOCOMOTION[family]; if (!e) return null;
  return mergeLocomotion(e, e.species?.[id]);
}

/** The plain gait words a species has, slowest first: what an encyclopedia entry lists. */
export function gaitWords(family, id) {
  const L = locomotionFor(family, id);
  return L ? Object.keys(L.gaits) : [];
}
