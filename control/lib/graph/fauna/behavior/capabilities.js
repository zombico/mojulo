/**
 * capabilities — what a species' body CAN do, measured from the skeleton it already builds (./skeleton.js) and the
 * locomotion entry it already carries. Nothing here is authored per species: a strategy that needs a body ability
 * asks for it here, and a species gets it or not by its bones. Habits the bones cannot tell (a horse dozes standing)
 * are tags (./tags.js), never capabilities.
 *
 * Pure and deterministic.
 */
import { faunaSkeleton } from '../skeleton.js';
import { speciesParams, stanceOf, SPECIES } from '../species.js';
import { locomotionFor } from '../locomotion/index.js';

/** The capability words a strategy's `needs` may name, each with what it measures. */
export const CAPABILITIES = Object.freeze({
  support:   'what holds the body up: four | two | wingwalk | fins | none',
  wings:     'flight wings (wing.* bones)',
  swimmer:   'lives suspended in water (fish, sharks, rays, plesiosaurs)',
  legless:   'no limbs and no fins (snakes)',
  foldsLegs: 'every leg has three or more bones in its main chain, so it can fold under the body',
  reachesGround: 'standing, the neck and head reach the ground (a grazer\'s mouth to the grass)',
  wrapTail:  'a tail long and loose enough to wrap round the body when curled',
  supple:    'a back that bends: high spine flexion or a body wave',
});

/**
 * The share of the neck base's standing height the neck + head must span to put the mouth on the ground. Below 1:
 * a grazer gets the rest by splaying and flexing its forelegs, so the shoulders sink (a sheep measures 0.84, a horse
 * 0.92, a goat 0.78); an elephant (0.67, the trunk does it) or a cheetah (0.59, it crouches) falls short.
 */
export const REACH = 0.75;
/** The share of the trunk's length a tail must reach to wrap round a curled body. */
export const WRAP = 0.7;

const len = (b) => Math.hypot(b.tail[0] - b.head[0], b.tail[1] - b.head[1], b.tail[2] - b.head[2]);
const sum = (bs) => bs.reduce((m, b) => m + len(b), 0);

const CACHE = new Map();   // species data is frozen and this is pure: one skeleton build per species

/** The capabilities of species `id`, with the measurements that decided them (`measured`). Frozen; computed once. */
export function capabilitiesOf(id) {
  if (!CACHE.has(id)) CACHE.set(id, SPECIES[id] ? Object.freeze(measure(id)) : null);
  return CACHE.get(id);
}

function measure(id) {
  const s = SPECIES[id];
  const S = faunaSkeleton(id), p = speciesParams(id), L = locomotionFor(s.family, id);
  const role = (re) => S.bones.filter((b) => b.role && re.test(b.role));
  const of = (re) => S.bones.filter((b) => re.test(b.id));
  const fore = role(/^fore\./), hind = role(/^hind\./), wing = role(/^wing\./), fins = of(/^(pectoral|pelvic|flipper)[RL]$/);
  const stance = stanceOf(id);

  const swimmer = p.pose === 'swim' || (!fore.length && !hind.length && fins.length > 0);
  const legless = !swimmer && !fore.length && !hind.length && !wing.length && !fins.length;
  const support = swimmer ? 'fins' : legless ? 'none'
    : stance === 'crawling on folded wings' ? 'wingwalk'
    : (L.rig === 'biped' || stance.startsWith('two') || stance.startsWith('upright') || !fore.length) ? 'two' : 'four';

  // the mouth reaches the ground when the neck and head, hung from where the neck leaves the body, are as long as
  // that point is high (on legs only: a swimmer or a snake has no ground to reach down to)
  const neck = of(/^neck\d+$/), headBone = of(/^head$/)[0];
  const base = neck[0] ? neck[0].head : headBone?.head;
  const height = support === 'fins' || support === 'none' || !base ? 0 : base[2];
  const neckHead = sum(neck) + (headBone ? len(headBone) : 0);
  const trunk = sum(of(/^spine\d+$/)), tail = sum(of(/^tail\d+$/));
  const chainOk = (bs) => ['R', 'L'].every((side) => bs.filter((b) => b.id.endsWith(side)).length >= 3);

  const measured = { height: +height.toFixed(3), reach: height ? +(neckHead / height).toFixed(2) : null, tail: trunk ? +(tail / trunk).toFixed(2) : 0 };
  return {
    support,
    wings: wing.length > 0,
    swimmer,
    legless,
    foldsLegs: support === 'four' ? chainOk(fore) && chainOk(hind) : support === 'two' ? chainOk(hind) : false,
    reachesGround: height > 0 && neckHead / height >= REACH,
    wrapTail: measured.tail >= WRAP && ['fur', 'flesh'].includes(L.axial.tailBuild),
    supple: (L.axial.flex || 0) >= 0.4 || (L.axial.wave && L.axial.wave !== 'none'),
    measured,
  };
}
