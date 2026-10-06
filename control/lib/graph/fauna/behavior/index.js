/**
 * behavior — what an animal DOES, said once for every animal, resolved per species to how its body does it.
 *
 * Three layers, the same shape as locomotion (../locomotion/), whose gaits are the `travel` behavior's:
 *  - BEHAVIORS: the plain words (`relax`, `alert`, `eat`, `sleep`), one line each, and whether the clip loops or holds;
 *  - STRATEGIES: one way a body does a behavior, as a MECHANISM in words a principle solver reads (what holds the
 *    body up, where the head goes, what the tail does, the small motion that loops), and what it takes: the body
 *    CAPABILITIES it needs (./capabilities.js, measured from the skeleton) and the TAGS it wants or refuses
 *    (./tags.js, authored habits);
 *  - the RESOLVER: a behavior's strategies are tried in order, most specific first; the first a species qualifies for
 *    wins, and the last needs nothing, so every species resolves every behavior. `why` says what decided it.
 *
 * So `relax` is one word: a sheep folds its legs under and chews the cud, a horse dozes on its feet with a hind hoof
 * cocked, a cat curls nose to tail, a vulture perches with a leg tucked, a python coils, a salmon hovers.
 *
 * Read-time data only: nothing here reaches a plan, and every species builds byte-identically. Posing a strategy is
 * the solvers' work (../gait.js holds the principles they share); this module only decides which strategy.
 */
import { SPECIES } from '../species.js';
import { CAPABILITIES, capabilitiesOf } from './capabilities.js';
import { TAGS, tagsOf } from './tags.js';

export { CAPABILITIES, capabilitiesOf, TAGS, tagsOf };

/** The behavior words. `clip`: 'loop' (a cycle that repeats in place) or 'hold' (a pose held, breathing). */
export const BEHAVIORS = Object.freeze({
  relax: { line: 'at ease and awake, resting its weight', clip: 'loop' },
  alert: { line: 'something is wrong: still, head up, watching', clip: 'loop' },
  eat:   { line: 'feeding, in its own way', clip: 'loop' },
  sleep: { line: 'asleep', clip: 'hold' },
});

/**
 * The mechanism words a strategy is written in: the principles a solver poses. Each word has its one line, so a
 * strategy reads as a sentence and a solver has one meaning to implement.
 */
export const SUPPORT = Object.freeze({
  stand:      'standing square on all its feet',
  cocked:     'standing, one hind leg resting on the tip of its hoof, the hip dropped',
  sternal:    'lying on the chest, the legs folded under the body',
  sphinx:     'lying on the chest, the forelegs out in front',
  side:       'lying flat on its side, the legs out',
  curl:       'lying curled in a ring, nose to tail',
  sit:        'sitting on its haunches, the forelegs or arms free',
  rear:       'up on its hind legs, the forelegs lifted',
  crouch:     'squatting low on bent legs, ready to spring',
  'belly-flat': 'the belly on the ground, legs splayed out to the sides',
  splay:      'standing with the forelegs spread wide to lower the shoulders',
  perch:      'standing on one leg, the other tucked up into the belly feathers',
  sit_bird:   'sitting down over its feet, the belly on the ground or perch',
  upright:    'standing upright on its feet, the body vertical',
  tripod:     'leaning back on the tail, the hind feet flat',
  hang:       'hanging upside down from its feet',
  coil:       'coiled in loops, the head resting on the coils',
  'coil-strike': 'coiled, the front third raised in an S',
  hover:      'holding station in the water',
  cruise:     'swimming slowly on, never stopping',
  float:      'floating at the surface',
  shell:      'drawn into its shell',
  balance:    'standing on its hind legs, the tail held level to balance the head',
});

export const HEAD = Object.freeze({
  low:        'carried low, below the withers',
  level:      'carried level with the back',
  high:       'raised high, ears and eyes forward',
  ground:     'down at the ground',
  reach:      'stretched up and forward to the leaves',
  'on-paws':  'resting on the forepaws',
  'on-flank': 'turned back and resting along the flank',
  tucked:     'turned back and tucked into the shoulder feathers',
  sunk:       'sunk down between the shoulders',
  fixed:      'level and still, the eyes locked on one point',
  'to-hands': 'bent down to the food held in the hands',
  inside:     'tucked inside the coils or shell',
  forward:    'held forward along the line of the body',
});

export const TAIL = Object.freeze({
  rest:    'hanging or lying at rest',
  wrap:    'wrapped round the body or over the nose',
  flag:    'lifted to flash its underside',
  twitch:  'still but for the tip, twitching',
  level:   'held level behind as a counterweight',
  rattle:  'raised and buzzing',
  prop:    'pressed to the ground as a prop',
  scull:   'beating slowly to hold position',
  none:    'no tail to speak of',
});

/** The small motion a clip loops on (or none, for a hold that only breathes). */
export const LOOP = Object.freeze({
  breathe: 'slow breathing, the ribs rising and falling',
  chew:    'the jaw grinding the cud, side to side',
  crop:    'biting and tearing grass, a step now and then',
  strip:   'pulling leaves off with the lips or tongue',
  peck:    'quick pecks at the ground',
  tear:    'pinning food under a foot and pulling with the head',
  gnaw:    'holding food between the forepaws and gnawing',
  nibble:  'turning food in the hands and nibbling',
  root:    'pushing the snout through the soil',
  gape:    'the mouth wide open, straining',
  snap:    'darting forward to snap up a mouthful',
  scan:    'the head turning in short jerks to look about',
  stare:   'no motion: a fixed stare',
  sway:    'the raised forebody swaying',
  tongue:  'the tongue flicking out to taste the air',
  fins:    'the fins sculling gently',
  swim:    'the body\'s own slow swimming wave',
});

/**
 * The strategies, per behavior, tried in this order. A strategy is
 * `{ id, line, needs?: { <capability>: value | [values] }, when?: [tag], unless?: [tag], support, head, tail, loop }`:
 * it qualifies when every `needs` holds, at least one `when` tag is present (if it has any), and no `unless` tag is.
 * The last strategy of every behavior has no needs and no tags: the fallback any body can do.
 */
const LEGS = ['four', 'two'];
export const STRATEGIES = Object.freeze({
  relax: [
    { id: 'roost', needs: { support: 'wingwalk' }, when: ['roosts-hanging'], support: 'hang', head: 'forward', tail: 'none', loop: 'breathe', line: 'hangs from a branch, wings wrapped' },
    { id: 'cruise', needs: { swimmer: true }, when: ['keeps-swimming'], support: 'cruise', head: 'forward', tail: 'scull', loop: 'swim', line: 'swims slowly on, mouth a little open' },
    { id: 'hover', needs: { swimmer: true }, support: 'hover', head: 'forward', tail: 'scull', loop: 'fins', line: 'hangs in the water, fins sculling' },
    { id: 'coil', needs: { legless: true }, support: 'coil', head: 'forward', tail: 'rest', loop: 'tongue', line: 'lies coiled, the head on the coils, tasting the air' },
    { id: 'float', needs: { support: LEGS }, when: ['floats'], support: 'float', head: 'level', tail: 'rest', loop: 'breathe', line: 'floats at the surface' },
    { id: 'perch', needs: { support: 'two', wings: true }, when: ['perches'], support: 'perch', head: 'sunk', tail: 'rest', loop: 'breathe', line: 'perches on one leg, feathers fluffed, head sunk' },
    { id: 'stand-upright', needs: { support: 'two', wings: false, wrapTail: false }, support: 'upright', head: 'level', tail: 'rest', loop: 'breathe', line: 'stands upright, at ease' },
    { id: 'lounge', needs: { support: 'two' }, when: ['lies-on-side'], support: 'side', head: 'level', tail: 'rest', loop: 'breathe', line: 'lies on its side, propped on an elbow' },
    { id: 'doze-standing', needs: { support: 'four' }, when: ['dozes-standing'], support: 'cocked', head: 'low', tail: 'rest', loop: 'breathe', line: 'dozes on its feet, a hind hoof cocked, head low' },
    { id: 'bask', needs: { support: 'four' }, when: ['basks'], support: 'belly-flat', head: 'level', tail: 'rest', loop: 'breathe', line: 'lies belly-flat in the sun' },
    { id: 'shell', needs: { support: 'four' }, when: ['withdraws'], support: 'belly-flat', head: 'forward', tail: 'rest', loop: 'breathe', line: 'rests on its plastron, head out' },
    { id: 'cud', needs: { support: 'four', foldsLegs: true }, when: ['ruminant'], support: 'sternal', head: 'level', tail: 'rest', loop: 'chew', line: 'lies with its legs folded under, chewing the cud' },
    { id: 'sit-up', needs: { support: 'four' }, when: ['sits-upright'], support: 'sit', head: 'level', tail: 'rest', loop: 'breathe', line: 'sits up on its haunches' },
    { id: 'curl', needs: { support: 'four', supple: true, wrapTail: true }, when: ['curls'], support: 'curl', head: 'on-paws', tail: 'wrap', loop: 'breathe', line: 'lies curled, the tail over its nose' },
    { id: 'sprawl', needs: { support: 'four', foldsLegs: true }, when: ['lies-on-side'], support: 'side', head: 'on-paws', tail: 'rest', loop: 'breathe', line: 'sprawls on its side' },
    { id: 'sphinx', needs: { support: 'four', foldsLegs: true, supple: true }, when: ['predator'], support: 'sphinx', head: 'level', tail: 'rest', loop: 'breathe', line: 'lies on its chest, forelegs out, head up' },
    { id: 'balance', needs: { support: 'two', wrapTail: true }, support: 'balance', head: 'level', tail: 'level', loop: 'breathe', line: 'stands at rest, the tail balancing the head' },
    { id: 'lie', needs: { support: 'four', foldsLegs: true }, support: 'sternal', head: 'level', tail: 'rest', loop: 'breathe', line: 'lies with its legs folded under' },
    { id: 'stand', support: 'stand', head: 'level', tail: 'rest', loop: 'breathe', line: 'stands at ease' },
  ],
  alert: [
    { id: 'stall', needs: { swimmer: true }, support: 'hover', head: 'forward', tail: 'scull', loop: 'fins', line: 'stops dead in the water, fins out' },
    { id: 'hood', needs: { legless: true }, when: ['hoods'], support: 'coil-strike', head: 'high', tail: 'rest', loop: 'sway', line: 'rears a third of its length and spreads its hood, swaying' },
    { id: 'rattle', needs: { legless: true }, when: ['rattles'], support: 'coil-strike', head: 'fixed', tail: 'rattle', loop: 'tongue', line: 'coils to strike, the rattle buzzing' },
    { id: 'strike-ready', needs: { legless: true }, support: 'coil-strike', head: 'fixed', tail: 'rest', loop: 'tongue', line: 'draws its neck into an S, ready to strike' },
    { id: 'withdraw', when: ['withdraws'], support: 'shell', head: 'inside', tail: 'rest', loop: 'breathe', line: 'pulls its head and legs into its shell' },
    { id: 'hang-watch', needs: { support: 'wingwalk' }, when: ['roosts-hanging'], support: 'hang', head: 'high', tail: 'none', loop: 'scan', line: 'hangs and looks about, wings tight' },
    { id: 'freeze', needs: { support: 'four' }, when: ['freezes'], support: 'crouch', head: 'level', tail: 'rest', loop: 'stare', line: 'flattens and freezes' },
    { id: 'rear', needs: { support: LEGS }, when: ['rears-to-look'], support: 'rear', head: 'high', tail: 'prop', loop: 'scan', line: 'stands up tall on its hind legs to look' },
    { id: 'flag', needs: { support: 'four' }, when: ['flags-tail'], support: 'stand', head: 'high', tail: 'flag', loop: 'stare', line: 'stands tall, head high, tail flagged white' },
    { id: 'prey-freeze', needs: { support: 'four' }, when: ['prey'], support: 'stand', head: 'high', tail: 'rest', loop: 'stare', line: 'stands stock still, head high, ready to run' },
    { id: 'fix', needs: { support: 'four' }, when: ['predator'], support: 'crouch', head: 'fixed', tail: 'twitch', loop: 'stare', line: 'drops low, eyes locked, the tail tip twitching' },
    { id: 'bird-watch', needs: { support: 'two', wings: true }, support: 'upright', head: 'high', tail: 'rest', loop: 'scan', line: 'stretches tall and turns its head in jerks' },
    { id: 'biped-watch', needs: { support: 'two', wrapTail: true }, support: 'balance', head: 'high', tail: 'level', loop: 'scan', line: 'straightens up, head high, tail level' },
    { id: 'watch', support: 'stand', head: 'high', tail: 'rest', loop: 'scan', line: 'lifts its head and looks about' },
  ],
  eat: [
    { id: 'filter', needs: { swimmer: true }, when: ['filter'], support: 'cruise', head: 'forward', tail: 'scull', loop: 'gape', line: 'swims mouth wide, straining the water' },
    { id: 'bite', needs: { swimmer: true }, support: 'hover', head: 'forward', tail: 'scull', loop: 'snap', line: 'darts forward and snaps' },
    { id: 'swallow', needs: { legless: true }, support: 'coil', head: 'forward', tail: 'rest', loop: 'snap', line: 'works its jaws forward over its prey' },
    { id: 'hang-eat', needs: { support: 'wingwalk' }, when: ['handles-food'], support: 'hang', head: 'to-hands', tail: 'none', loop: 'nibble', line: 'hangs and eats fruit held to its mouth' },
    { id: 'float-eat', needs: { support: 'four' }, when: ['floats'], unless: ['browser'], support: 'float', head: 'to-hands', tail: 'rest', loop: 'nibble', line: 'floats on its back, eating off its chest' },
    { id: 'tear', needs: { support: 'two', wings: true }, when: ['predator', 'scavenger'], support: 'stand', head: 'ground', tail: 'rest', loop: 'tear', line: 'mantles over the food, a foot pinning it, and tears upward' },
    { id: 'tear-biped', needs: { support: 'two', wrapTail: true }, when: ['predator', 'scavenger'], support: 'balance', head: 'ground', tail: 'level', loop: 'tear', line: 'pins the carcass with a foot and tears upward, the tail level' },
    { id: 'foot-feed', needs: { support: 'two', wings: true }, when: ['handles-food'], support: 'perch', head: 'to-hands', tail: 'rest', loop: 'nibble', line: 'holds food up in one foot and bites' },
    { id: 'peck', needs: { support: 'two', wings: true }, support: 'stand', head: 'ground', tail: 'rest', loop: 'peck', line: 'pecks at the ground' },
    { id: 'hand-feed', needs: { support: LEGS }, when: ['handles-food'], support: 'sit', head: 'to-hands', tail: 'rest', loop: 'nibble', line: 'sits up and eats from its hands' },
    { id: 'root', needs: { support: 'four' }, when: ['roots'], support: 'stand', head: 'ground', tail: 'rest', loop: 'root', line: 'roots through the soil with its snout' },
    { id: 'browse', needs: { support: 'four' }, when: ['browser'], support: 'stand', head: 'reach', tail: 'rest', loop: 'strip', line: 'reaches up and strips the leaves' },
    { id: 'graze', needs: { support: 'four', reachesGround: true }, when: ['grazer'], support: 'stand', head: 'ground', tail: 'rest', loop: 'crop', line: 'crops the grass, stepping on' },
    { id: 'splay-graze', needs: { support: 'four' }, when: ['grazer'], support: 'splay', head: 'ground', tail: 'rest', loop: 'crop', line: 'splays its forelegs to get down to the grass' },
    { id: 'crouch-graze', needs: { support: 'two' }, when: ['grazer'], support: 'tripod', head: 'ground', tail: 'prop', loop: 'crop', line: 'leans forward on its arms and tail to graze' },
    { id: 'gnaw', needs: { support: 'four', foldsLegs: true, supple: true }, when: ['predator'], unless: ['basks'], support: 'sphinx', head: 'on-paws', tail: 'rest', loop: 'gnaw', line: 'lies with the meal between its forepaws and gnaws' },
    { id: 'snap-up', needs: { support: 'four' }, support: 'belly-flat', head: 'forward', tail: 'rest', loop: 'snap', line: 'lunges and snaps up a mouthful' },
    { id: 'feed', support: 'stand', head: 'ground', tail: 'rest', loop: 'snap', line: 'lowers its head and feeds' },
  ],
  sleep: [
    { id: 'roost-sleep', needs: { support: 'wingwalk' }, when: ['roosts-hanging'], support: 'hang', head: 'inside', tail: 'none', loop: 'breathe', line: 'hangs wrapped in its wings' },
    { id: 'swim-sleep', needs: { swimmer: true }, when: ['keeps-swimming'], support: 'cruise', head: 'forward', tail: 'scull', loop: 'swim', line: 'swims on slowly, half asleep' },
    { id: 'drift', needs: { swimmer: true }, support: 'hover', head: 'forward', tail: 'rest', loop: 'fins', line: 'drifts still, fins barely moving' },
    { id: 'tight-coil', needs: { legless: true }, support: 'coil', head: 'inside', tail: 'rest', loop: 'breathe', line: 'lies tightly coiled, the head tucked in' },
    { id: 'shell-sleep', when: ['withdraws'], support: 'shell', head: 'inside', tail: 'rest', loop: 'breathe', line: 'sleeps drawn into its shell' },
    { id: 'raft', needs: { support: LEGS }, when: ['floats'], support: 'float', head: 'tucked', tail: 'rest', loop: 'breathe', line: 'sleeps afloat' },
    { id: 'roost-bird', needs: { support: 'two', wings: true }, when: ['perches'], support: 'perch', head: 'tucked', tail: 'rest', loop: 'breathe', line: 'sleeps on one leg, the head tucked into its back' },
    { id: 'sit-sleep-bird', needs: { support: 'two', wings: true }, support: 'sit_bird', head: 'tucked', tail: 'rest', loop: 'breathe', line: 'sits down and tucks its head into its back' },
    { id: 'curl-sleep', needs: { support: 'four', supple: true, wrapTail: true }, when: ['curls'], support: 'curl', head: 'inside', tail: 'wrap', loop: 'breathe', line: 'sleeps curled tight, the tail over its nose' },
    { id: 'stand-sleep', needs: { support: 'four' }, when: ['dozes-standing'], support: 'cocked', head: 'low', tail: 'rest', loop: 'breathe', line: 'sleeps on its feet, head hanging' },
    { id: 'flank-sleep', needs: { support: 'four', foldsLegs: true }, when: ['ruminant'], support: 'sternal', head: 'on-flank', tail: 'rest', loop: 'breathe', line: 'lies folded, the head turned back on its flank' },
    { id: 'side-sleep', needs: { support: LEGS }, when: ['lies-on-side'], support: 'side', head: 'ground', tail: 'rest', loop: 'breathe', line: 'sleeps flat out on its side' },
    { id: 'bask-sleep', needs: { support: 'four' }, when: ['basks'], support: 'belly-flat', head: 'ground', tail: 'rest', loop: 'breathe', line: 'sleeps belly-flat, chin on the ground' },
    { id: 'biped-sleep', needs: { support: 'two' }, support: 'sit_bird', head: 'ground', tail: 'rest', loop: 'breathe', line: 'settles down over its legs, chin to the ground' },
    { id: 'fold-sleep', needs: { support: 'four', foldsLegs: true }, support: 'sternal', head: 'on-paws', tail: 'rest', loop: 'breathe', line: 'lies folded, chin on its paws' },
    { id: 'rest', support: 'stand', head: 'low', tail: 'rest', loop: 'breathe', line: 'stands still, eyes closed' },
  ],
});

const holds = (need, have) => (Array.isArray(need) ? need.includes(have) : need === have);

/** Why strategy `s` does or does not qualify for capabilities `C` and tags `T`: null when it qualifies, else the first reason. */
export function disqualifies(s, C, T) {
  for (const [k, v] of Object.entries(s.needs || {})) if (!holds(v, C[k])) return `needs ${k} ${Array.isArray(v) ? v.join('|') : v}`;
  if (s.when?.length && !s.when.some((t) => T.includes(t))) return `wants one of ${s.when.join(', ')}`;
  const no = (s.unless || []).find((t) => T.includes(t)); if (no) return `refuses ${no}`;
  return null;
}

/**
 * Resolve `behavior` for species `id`: `{ behavior, strategy, line, support, head, tail, loop, clip, why }`. `why`
 * names the capabilities and tags the winning strategy matched, and `passed` the more specific strategies it skipped
 * and the reason each was skipped.
 */
export function resolveBehavior(id, behavior) {
  const s = SPECIES[id]; if (!s) throw new Error(`behavior: unknown species '${id}'`);
  const B = BEHAVIORS[behavior]; if (!B) throw new Error(`behavior: unknown behavior '${behavior}' (have ${Object.keys(BEHAVIORS).join(', ')})`);
  const C = capabilitiesOf(id), T = tagsOf(s.family, id) || [];
  const passed = [];
  for (const st of STRATEGIES[behavior]) {
    const no = disqualifies(st, C, T);
    if (no) { passed.push({ strategy: st.id, because: no }); continue; }
    return {
      behavior, strategy: st.id, line: st.line, support: st.support, head: st.head, tail: st.tail, loop: st.loop, clip: B.clip,
      why: { needs: st.needs || {}, tags: (st.when || []).filter((t) => T.includes(t)), passed },
    };
  }
  throw new Error(`behavior: '${behavior}' has no fallback strategy`);   // unreachable while the vocabulary test holds
}

/** Every species × every behavior: `{ <id>: { <behavior>: <strategy id> } }` — the table a review reads. */
export function behaviorTable() {
  return Object.fromEntries(Object.keys(SPECIES).map((id) => [id,
    Object.fromEntries(Object.keys(BEHAVIORS).map((b) => [b, resolveBehavior(id, b).strategy]))]));
}
