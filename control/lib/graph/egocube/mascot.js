/**
 * THE MASCOT SHEET: the Egocube's `mascot` tuning (docs/mascot.md). A mascot is read from a PROMISE (the one feeling it
 * stands for), not from a life: no age, no motivation, no wear, and it never ages. The sheet has the Egocube's form
 * (notes and derives per channel, the facets, the reads, what the brief left unread, the faults) and its own facets.
 *
 *   readMascot(spec)                                        throws on an unknown facet or value, naming the known ones
 *   rollMascot({ brief?, facets?, seed = 1, path })         → the sheet (`tuning: 'mascot'`)
 *   readMascotBrief(brief)                                  → { facets, read, unread, asks } (`asks`: a mascot word was read)
 *
 * A facet is decided by, in order: an explicit `facets` entry, a brief word, the promise's lean, the seed. Every facet
 * throws its die whether or not it is used, so fixing one never moves another; a new facet's die goes last. A roll that
 * breaks a FAULT is drawn again on the next attempt seed (up to MAX_ATTEMPTS); a fault among asked facets only is the
 * operator's and is kept, marked `held`. Pure and deterministic: the same arguments, the same sheet, byte for byte.
 *
 * DERIVES name the mascot body's own knobs (mascot-form.js MASCOT_DIALS), a direction, never an amount: the compiler
 * decides the amounts, the character loop iterates them.
 */
import { mulberry32 } from '../vegetation/grow.js';

export const MAX_ATTEMPTS = 8;
/** The facets, in the order their dice are thrown: a new facet goes last, so an older seed throws the older ones alike. */
export const MASCOT_KEYS = Object.freeze(['promise', 'form', 'accent', 'eyes', 'hook', 'extremities', 'energy', 'hue', 'being', 'skin', 'expression']);

/** Channel id → what a note there says. In the order a sheet prints them. */
export const MASCOT_CHANNELS = Object.freeze({
  promise:     'the one feeling it stands for',
  frame:       'heads tall, where the mass sits, how big the head is against the body',
  face:        'the eyes: their family, size and height; every other feature reduced',
  silhouette:  'the shape filled black at 64 px: the round core and the one hook',
  extremities: 'hands and feet against the limbs',
  palette:     'the owned colours, the pale front, the accent',
  motion:      'the idle, the stance: how it moves when nothing happens',
});
export const MASCOT_CHANNEL_IDS = Object.freeze(Object.keys(MASCOT_CHANNELS));

/** The knobs a derive may name: `family.key +|-`. The compiler (mascot-form.js) moves each by a fixed step. */
export const MASCOT_DIALS = Object.freeze({
  proportion: ['head', 'body', 'legs', 'arms', 'width'],
  eyes: ['size', 'lift', 'gap', 'pupil'],
  extremities: ['hands', 'feet'],
  palette: ['saturation', 'value'],
  motion: ['lean', 'stance', 'bounce'],
});
const DERIVE = /^([a-z]+)\.([a-z]+) ([+-])$/;
export function readMascotDerive(text) {
  const m = DERIVE.exec(text);
  if (!m || !MASCOT_DIALS[m[1]]?.includes(m[2])) throw new Error(`mascot: a derive is 'family.key +|-' over ${Object.entries(MASCOT_DIALS).map(([f, ks]) => `${f}.{${ks.join(',')}}`).join(' ')} (got '${text}')`);
  return { family: m[1], key: m[2], dir: m[3] };
}

const v = (reads, notes = {}, derives = {}, lean = {}) => Object.freeze({ reads, notes, derives, lean });

/** The promise: what it stands for. `lean` multiplies the seed's priors of the other facets (law 1: it leans them all). */
export const PROMISES = Object.freeze({
  speed: v('speed: it is already moving', { promise: 'speed: everything points back from a forward centre', motion: 'impatient at rest: a foot taps', frame: 'longer legs, a lighter body' },
    { frame: ['proportion.legs +', 'proportion.body -'], motion: ['motion.lean +'] },
    { form: { sprout: 3 }, accent: { spike: 4 }, eyes: { joined: 3 }, hook: { quills: 4, ears: 1.5 }, extremities: { gloves: 3 }, energy: { zippy: 6 }, hue: { blue: 4, red: 1.5, teal: 1.5 }, expression: { determined: 3, grin: 3 } }),
  cheer: v('cheer: glad to see you', { promise: 'cheer: open, up-turned, nothing guarded', face: 'eyes wide and lifted', motion: 'it bounces in place' },
    { face: ['eyes.size +'], motion: ['motion.bounce +'] },
    { form: { orb: 1.5, sprout: 1.5 }, accent: { round: 4 }, eyes: { pair: 3 }, hook: { antenna: 2, tuft: 2, ears: 1.5 }, energy: { bouncy: 6 }, hue: { yellow: 4, orange: 2, pink: 2 }, expression: { happy: 4, grin: 3 } }),
  mischief: v('mischief: up to something', { promise: 'mischief: one thing about it is not quite trustworthy', face: 'the pupils small and sharp', motion: 'it sways, weight on one hip' },
    { face: ['eyes.pupil -'], motion: ['motion.lean -'] },
    { accent: { spike: 2.5 }, eyes: { pair: 2, dots: 2 }, hook: { ears: 3, tail: 3, tuft: 1.5 }, extremities: { paws: 2.5 }, energy: { swaying: 4, zippy: 1.5 }, hue: { purple: 4, green: 2.5, orange: 1.5 }, expression: { smirk: 6, grin: 2 } }),
  might: v('might: small, and stronger than it looks', { promise: 'might: low and planted, the mass up front', frame: 'a big body for its size, short legs', extremities: 'big fists' },
    { frame: ['proportion.body +', 'proportion.width +', 'proportion.legs -'], extremities: ['extremities.hands +'], motion: ['motion.stance +'] },
    { form: { toon: 3 }, accent: { block: 5 }, eyes: { pair: 2 }, hook: { spines: 2.5, ears: 1.5, tuft: 1.5 }, extremities: { gloves: 2, paws: 2 }, energy: { sturdy: 6 }, hue: { red: 4, brown: 2, orange: 2 }, expression: { determined: 5, angry: 2 } }),
  comfort: v('comfort: something to hold', { promise: 'comfort: no edge anywhere; it could be hugged', frame: 'round all over, the head wide', motion: 'it sways slowly' },
    { frame: ['proportion.width +'], face: ['eyes.lift -'] },
    { form: { orb: 4, sprout: 2 }, accent: { round: 6 }, eyes: { pair: 2, dots: 3 }, hook: { ears: 4, none: 2, tail: 1.5 }, extremities: { nubs: 4, paws: 2 }, energy: { swaying: 3, floaty: 3 }, hue: { pink: 4, white: 2.5, brown: 2, yellow: 1.5 }, expression: { content: 5, happy: 2, sleepy: 2 } }),
  pride: v('pride: it carries a crowd\'s colours', { promise: 'pride: it stands for a team and wears its colours', face: 'huge eyes, read from the back row', silhouette: 'a big head that reads from the stands' },
    { frame: ['proportion.head +'], face: ['eyes.size +'], motion: ['motion.stance +'] },
    { form: { toon: 5 }, accent: { round: 2, block: 2 }, eyes: { pair: 4 }, hook: { ears: 2.5, tuft: 2, quills: 1 }, extremities: { gloves: 5 }, energy: { bouncy: 3, sturdy: 2 }, hue: { red: 2, blue: 2, green: 1.5, orange: 1.5 }, expression: { grin: 4, happy: 2 } }),
  wonder: v('wonder: it is from somewhere else', { promise: 'wonder: curious, a little strange, weightless', face: 'eyes set wide and high', motion: 'it floats' },
    { face: ['eyes.gap +', 'eyes.size +'] },
    { form: { orb: 3, sprout: 2 }, accent: { round: 3 }, eyes: { pair: 2, dots: 2 }, hook: { antenna: 5, ears: 1.5 }, extremities: { nubs: 3 }, energy: { floaty: 6 }, hue: { teal: 4, purple: 3, white: 2 }, expression: { surprised: 4, happy: 2 } }),
});

export const FORMS = Object.freeze({
  orb: v('the orb: one ball, the head is the body', { frame: 'one head tall: the face is the whole front', silhouette: 'a ball on two feet' }, {}),
  sprout: v('the sprout: about two heads tall', { frame: 'about two heads tall: the head as big as the rest of it' }, {}),
  toon: v('the toon: about three heads tall', { frame: 'about three heads tall: a big head on a small, readable body' }, {}),
});

export const ACCENTS = Object.freeze({
  round: v('a round accent: harmony', { silhouette: 'circles on a round core: soft, kind, nothing that could hurt', palette: 'the accent a neighbour of the body\'s hue' }, {}),
  spike: v('a spiky accent: contrast', { silhouette: 'points against the round core: speed and attitude held by a friendly centre', palette: 'the accent across the wheel from the body' }, { palette: ['palette.saturation +'] }),
  block: v('a blocky accent: contrast', { silhouette: 'squared forms against the round core: dependable, solid', palette: 'the accent across the wheel from the body' }, { frame: ['proportion.width +'] }),
});

export const EYES = Object.freeze({
  pair: v('a pair of tall ovals', { face: 'two tall ovals, close-set, a big pupil and one glint each' }, {}),
  joined: v('joined eyes in one mask', { face: 'one white mask across both eyes, two pupils looking out of it; a pale muzzle below' }, { face: ['eyes.gap -'] }),
  dots: v('dot eyes', { face: 'small dark ovals with a glint, nothing else drawn: the cheeks carry the face' }, { face: ['eyes.size -'] }),
});

export const HOOKS = Object.freeze({
  none: v('no hook: the shape itself is the mark', { silhouette: 'nothing breaks the outline: the simplicity is the mark' }, {}),
  ears: v('ears', { silhouette: 'two ears above the head, drawn in the accent\'s family' }, {}),
  quills: v('quills', { silhouette: 'a fan of quills swept back off the head' }, {}),
  snout: v('a snout', { silhouette: 'a big round snout forward of the face; the eyes climb above it' }, { face: ['eyes.lift +'] }),
  tuft: v('a tuft', { silhouette: 'one tuft or curl on the crown' }, {}),
  cap: v('a cap', { silhouette: 'a cap with a big bill and an emblem on its crown, in the accent' }, {}),
  moustache: v('a moustache', { silhouette: 'a big moustache under the nose, wider than the mouth' }, {}),
  antenna: v('an antenna', { silhouette: 'an antenna off the crown, a bulb at its tip' }, {}),
  tail: v('a tail', { silhouette: 'a tail that reads beside the body from the front' }, {}),
  spines: v('spines', { silhouette: 'a row of spines down the back of the head and the back' }, {}),
});

export const EXTREMITIES = Object.freeze({
  nubs: v('nubs: stub arms, oval feet', { extremities: 'stub arms with no hands to speak of; big oval feet in the accent' }, { extremities: ['extremities.feet +'] }),
  gloves: v('gloves and shoes', { extremities: 'thin limbs ending in big white gloves and big shoes in the accent' }, { extremities: ['extremities.hands +', 'extremities.feet +'] }),
  paws: v('paws', { extremities: 'mitts and paws in the body\'s own colour, the pads paler' }, {}),
});

export const ENERGIES = Object.freeze({
  bouncy: v('bouncy', { motion: 'the idle bounces on its knees' }, { motion: ['motion.bounce +'] }),
  zippy: v('zippy', { motion: 'the idle taps a foot, leaning in' }, { motion: ['motion.lean +'] }),
  floaty: v('floaty', { motion: 'the idle floats, feet off the ground' }, {}),
  sturdy: v('sturdy', { motion: 'the idle is planted wide and breathes' }, { motion: ['motion.stance +'] }),
  swaying: v('swaying', { motion: 'the idle sways side to side' }, {}),
});

/** What it is: a critter (any body) or a HUMAN in a mascot's proportions (a person drawn by the mascot's laws: a big head,
 *  a small body, big eyes, a nose and ears, hair as one chunky form, the hue on the clothes). */
export const BEINGS = Object.freeze({
  critter: v('a critter', {}, {}),
  human: v('a human, drawn as a mascot', { frame: 'a person in a mascot\'s proportions: the head as big as the body', face: 'a nose and ears; hair as one chunky form, in the accent\'s family', palette: 'skin and hair as given; the hue on the clothes' }, {}),
});
/** A human mascot's skin, with the hair it comes with unless the brief says (law 7: owned, simple colours). */
export const SKINS = Object.freeze({
  porcelain: { skin: '#f6dcc8', hair: '#e2b45a' }, peach: { skin: '#f2c49f', hair: '#7a4a26' }, tan: { skin: '#d9a271', hair: '#3a2416' },
  olive: { skin: '#c68e5e', hair: '#241712' }, brown: { skin: '#9b6440', hair: '#1c120d' }, deep: { skin: '#6b4128', hair: '#141010' },
});
/** The face at rest (mascot-face.js EXPRESSION_FACE): the clips make the others. */
export const EXPRESSIONS = Object.freeze({
  happy: v('happy', { face: 'at rest: a smile, the eyes open' }, {}),
  grin: v('grinning', { face: 'at rest: a wide open grin' }, {}),
  content: v('content', { face: 'at rest: a closed smile, the lids a little down' }, {}),
  determined: v('determined', { face: 'at rest: the brows down at the middle, the mouth set' }, {}),
  smirk: v('smirking', { face: 'at rest: one brow up, one lid down: the face is not symmetric' }, {}),
  surprised: v('surprised', { face: 'at rest: brows up, the mouth an O' }, {}),
  sad: v('sad', { face: 'at rest: the brows up at the middle, the mouth turned down' }, {}),
  angry: v('angry', { face: 'at rest: the brows down hard at the middle, the teeth set' }, {}),
  sleepy: v('sleepy', { face: 'at rest: the lids heavy, the mouth closed' }, {}),
});

/** The hues a mascot owns: the body colour. Saturated and value-separated by design (law 7). */
export const HUES = Object.freeze({
  red: '#e0302c', orange: '#f08a1c', yellow: '#f6cf2a', green: '#4fb848', teal: '#25b3b0', blue: '#1f5fd6',
  purple: '#8a4fd0', pink: '#f28fb4', brown: '#9a6238', white: '#f2efe8',
});

const TABLES = { promise: PROMISES, form: FORMS, accent: ACCENTS, eyes: EYES, hook: HOOKS, extremities: EXTREMITIES, energy: ENERGIES, hue: HUES, being: BEINGS, skin: SKINS, expression: EXPRESSIONS };
const KNOWN = Object.fromEntries(Object.entries(TABLES).map(([k, t]) => [k, Object.keys(t)]));

/** The seed's priors before a promise leans them: weights per value (an absent value weighs 0). */
export const PRIORS = Object.freeze({
  promise: Object.fromEntries(Object.keys(PROMISES).map((p) => [p, 1])),
  form: { orb: 1, sprout: 1.5, toon: 1.5 },
  accent: { round: 1.5, spike: 1, block: 1 },
  eyes: { pair: 2, joined: 1, dots: 1 },
  hook: { none: 0.5, ears: 1.5, quills: 0.5, snout: 0.75, tuft: 1, antenna: 0.75, tail: 1, spines: 0.5, cap: 0.5, moustache: 0.25 },
  extremities: { nubs: 1, gloves: 1.5, paws: 1 },
  energy: { bouncy: 1, zippy: 1, floaty: 1, sturdy: 1, swaying: 1 },
  hue: Object.fromEntries(Object.keys(HUES).map((h) => [h, 1])),
  being: { critter: 3, human: 1 },
  skin: Object.fromEntries(Object.keys(SKINS).map((k) => [k, 1])),
  expression: { happy: 2, grin: 1.5, content: 1.5, determined: 1, smirk: 1, surprised: 1, sad: 0.3, angry: 0.3, sleepy: 0.5 },
});

/** Incoherent rolls: drawn again unless every facet in `on` was asked for. A table to grow at the eyes gate. */
export const FAULTS = Object.freeze([
  { id: 'soft-spike', on: ['promise', 'accent'], when: (f) => ['comfort', 'cheer'].includes(f.promise) && f.accent === 'spike',
    why: 'a soft promise under a spiky accent is a brief (a prickly friend), not a roll' },
  { id: 'round-quills', on: ['accent', 'hook'], when: (f) => f.hook === 'quills' && f.accent === 'round',
    why: 'quills are points: on a round accent they are a brief, not a roll' },
  { id: 'orb-tail', on: ['form', 'hook'], when: (f) => f.form === 'orb' && ['tail', 'spines'].includes(f.hook),
    why: 'the orb\'s ball swallows a tail or spines: the hook would not read from the front' },
  { id: 'orb-gloves', on: ['form', 'extremities'], when: (f) => f.form === 'orb' && f.extremities === 'gloves',
    why: 'gloves need arms to hang from; the orb has stubs' },
  { id: 'human-beast', on: ['being', 'hook'], when: (f) => f.being === 'human' && ['snout', 'tail', 'spines'].includes(f.hook),
    why: 'a snout, a tail or spines on a person is a brief (a costume), not a roll' },
  { id: 'human-paws', on: ['being', 'extremities'], when: (f) => f.being === 'human' && f.extremities === 'paws',
    why: 'a person has hands, gloved or bare, not paws' },
]);

// ══════════ the brief ══════════

/** The words people use for mascots, each a partial sheet. A familiar name is read as a style, never copied. */
export const MASCOT_LEXICON = Object.freeze({
  // the tuning's own words: they ask for a mascot and decide nothing else ('cute' and 'kawaii' are read but ask for
  // nothing: a cute knight is a person; 'chibi' is the hero door's cast word)
  'mascot': {}, 'cartoon': {}, 'cartoony': {}, 'cartoonish': {}, 'toon': {}, 'toony': {}, 'cute': {}, 'kawaii': {},
  'platformer': {}, 'plushie': { promise: 'comfort' }, 'plush': { promise: 'comfort' },
  'team mascot': { promise: 'pride' }, 'sports mascot': { promise: 'pride' }, 'school mascot': { promise: 'pride' },
  // familiar names, as styles
  'sonic-like': { promise: 'speed', form: 'sprout', accent: 'spike', eyes: 'joined', hook: 'quills', extremities: 'gloves', energy: 'zippy', hue: 'blue', expression: 'smirk' },
  'sonic': { promise: 'speed', form: 'sprout', accent: 'spike', eyes: 'joined', hook: 'quills', extremities: 'gloves', energy: 'zippy', hue: 'blue', expression: 'smirk' },
  'kirby-like': { promise: 'comfort', form: 'orb', accent: 'round', eyes: 'pair', hook: 'none', extremities: 'nubs', energy: 'floaty', hue: 'pink', expression: 'happy' },
  'kirby': { promise: 'comfort', form: 'orb', accent: 'round', eyes: 'pair', hook: 'none', extremities: 'nubs', energy: 'floaty', hue: 'pink', expression: 'happy' },
  'mario-like': { promise: 'cheer', form: 'toon', accent: 'round', eyes: 'pair', hook: 'cap', extremities: 'gloves', energy: 'bouncy', hue: 'red', being: 'human', expression: 'happy' },
  'mario': { promise: 'cheer', form: 'toon', accent: 'round', eyes: 'pair', hook: 'cap', extremities: 'gloves', energy: 'bouncy', hue: 'red', being: 'human', expression: 'happy' },
  'yoshi-like': { promise: 'cheer', form: 'toon', accent: 'round', eyes: 'pair', hook: 'snout', extremities: 'paws', energy: 'bouncy', hue: 'green', expression: 'happy' },
  'yoshi': { promise: 'cheer', form: 'toon', accent: 'round', eyes: 'pair', hook: 'snout', extremities: 'paws', energy: 'bouncy', hue: 'green', expression: 'happy' },
  'pikachu-like': { promise: 'cheer', form: 'sprout', accent: 'spike', eyes: 'dots', hook: 'ears', extremities: 'nubs', energy: 'bouncy', hue: 'yellow', expression: 'happy' },
  'pikachu': { promise: 'cheer', form: 'sprout', accent: 'spike', eyes: 'dots', hook: 'ears', extremities: 'nubs', energy: 'bouncy', hue: 'yellow', expression: 'happy' },
  // the promise
  'fast': { promise: 'speed' }, 'speedy': { promise: 'speed' }, 'quick': { promise: 'speed' }, 'racing': { promise: 'speed' },
  'happy': { promise: 'cheer' }, 'cheerful': { promise: 'cheer' }, 'joyful': { promise: 'cheer' }, 'friendly': { promise: 'cheer' },
  'mischievous': { promise: 'mischief' }, 'sneaky': { promise: 'mischief' }, 'cheeky': { promise: 'mischief' }, 'trickster': { promise: 'mischief' },
  'strong': { promise: 'might' }, 'tough': { promise: 'might' }, 'mighty': { promise: 'might' }, 'brave': { promise: 'might' },
  'cuddly': { promise: 'comfort' }, 'soft': { promise: 'comfort' }, 'huggable': { promise: 'comfort' }, 'sleepy': { promise: 'comfort' },
  'curious': { promise: 'wonder' }, 'alien': { promise: 'wonder' }, 'magical': { promise: 'wonder' }, 'dreamy': { promise: 'wonder' },
  // shape and accord
  'round': { accent: 'round' }, 'roundish': { accent: 'round' }, 'blobby': { accent: 'round' }, 'bubbly': { accent: 'round' },
  'spiky': { accent: 'spike' }, 'pointy': { accent: 'spike' }, 'edgy': { accent: 'spike' },
  'boxy': { accent: 'block' }, 'blocky': { accent: 'block' }, 'chunky': { accent: 'block' }, 'square': { accent: 'block' },
  // form
  'ball': { form: 'orb' }, 'blob': { form: 'orb', accent: 'round' }, 'tiny': { form: 'orb' }, 'little': { form: 'sprout' }, 'small': { form: 'sprout' }, 'tall': { form: 'toon' },
  // the hook
  'eared': { hook: 'ears' }, 'bunny': { hook: 'ears' }, 'quilled': { hook: 'quills' }, 'hedgehog': { hook: 'quills', accent: 'spike' },
  'snouted': { hook: 'snout' }, 'dino': { hook: 'snout' }, 'dinosaur': { hook: 'snout' }, 'tufted': { hook: 'tuft' },
  'antenna': { hook: 'antenna' }, 'tailed': { hook: 'tail' }, 'spined': { hook: 'spines' }, 'dragon': { hook: 'spines' },
  // extremities, eyes, energy
  'gloved': { extremities: 'gloves' }, 'stubby': { extremities: 'nubs' }, 'pawed': { extremities: 'paws' },
  'bouncy': { energy: 'bouncy' }, 'zippy': { energy: 'zippy' }, 'floaty': { energy: 'floaty' }, 'floating': { energy: 'floaty' }, 'sturdy': { energy: 'sturdy' }, 'wobbly': { energy: 'swaying' },
  // a person, drawn as a mascot
  'human': { being: 'human' }, 'person': { being: 'human' }, 'people': { being: 'human' }, 'boy': { being: 'human' }, 'girl': { being: 'human' },
  'kid': { being: 'human' }, 'man': { being: 'human' }, 'woman': { being: 'human' }, 'plumber': { being: 'human', hook: 'cap' },
  'critter': { being: 'critter' }, 'creature': { being: 'critter' }, 'animal': { being: 'critter' },
  'capped': { hook: 'cap' }, 'cap': { hook: 'cap' }, 'hat': { hook: 'cap' }, 'moustache': { hook: 'moustache' }, 'mustache': { hook: 'moustache' }, 'mustached': { hook: 'moustache' },
  'pale': { skin: 'porcelain' }, 'fair': { skin: 'porcelain' }, 'freckled': { skin: 'peach' }, 'tanned': { skin: 'tan' }, 'olive-skinned': { skin: 'olive' },
  'brown-skinned': { skin: 'brown' }, 'dark-skinned': { skin: 'deep' },
  // the face at rest
  'smiling': { expression: 'happy' }, 'grinning': { expression: 'grin' }, 'content': { expression: 'content' }, 'calm': { expression: 'content' },
  'determined': { expression: 'determined' }, 'serious': { expression: 'determined' }, 'smug': { expression: 'smirk' }, 'smirking': { expression: 'smirk' },
  'surprised': { expression: 'surprised' }, 'amazed': { expression: 'surprised' }, 'sad': { expression: 'sad' }, 'gloomy': { expression: 'sad' },
  'angry': { expression: 'angry' }, 'grumpy': { expression: 'angry' }, 'drowsy': { expression: 'sleepy' },
  // hues
  ...Object.fromEntries(Object.keys(HUES).map((h) => [h, { hue: h }])),
});

/** The words that ask for the mascot tuning (any word of the lexicon but a bare colour or shape word). */
const ASKING = new Set(['mascot', 'cartoon', 'cartoony', 'cartoonish', 'toon', 'toony', 'platformer', 'plushie', 'plush',
  'team mascot', 'sports mascot', 'school mascot', 'sonic-like', 'sonic', 'kirby-like', 'kirby', 'mario-like', 'mario', 'yoshi-like', 'yoshi', 'pikachu-like', 'pikachu']);
const PHRASE_MAX = Math.max(...Object.keys(MASCOT_LEXICON).map((k) => k.split(' ').length));
const FILLER = new Set(['a', 'an', 'the', 'who', 'and', 'of', 'with', 'is', 'like', 'that', 'in', 'to', 'but', 'very', 'character', 'for', 'my', 'game']);

/** Read a brief: { facets (later words winning), read, unread, asks }. `asks`: a word asked for a mascot. */
export function readMascotBrief(brief = '') {
  const words = String(brief).toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(Boolean);
  const facets = {}, read = [], unread = [];
  for (let i = 0; i < words.length;) {
    let hit = null;
    for (let n = Math.min(PHRASE_MAX, words.length - i); n >= 1 && !hit; n--) {
      const phrase = words.slice(i, i + n).join(' ');
      if (MASCOT_LEXICON[phrase]) hit = { phrase, n };
    }
    if (hit) { Object.assign(facets, MASCOT_LEXICON[hit.phrase]); read.push(hit.phrase); i += hit.n; }
    else { if (!FILLER.has(words[i])) unread.push(words[i]); i += 1; }
  }
  return { facets, read, unread, asks: read.some((w) => ASKING.has(w)) };
}

/** Whether a brief asks for a mascot (the Egocube's kind reads it to choose the tuning when none is named). */
export const asksForMascot = (brief) => readMascotBrief(brief).asks;

// ══════════ the roll ══════════

export function readMascot(spec = {}) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('mascot: the facets are an object');
  for (const [k, val] of Object.entries(spec)) {
    if (!MASCOT_KEYS.includes(k)) throw new Error(`mascot: unknown facet '${k}' (known: ${MASCOT_KEYS.join(', ')}; a mascot has no age, build or archetype)`);
    if (!KNOWN[k].includes(val)) throw new Error(`mascot: unknown ${k} '${val}' (known: ${KNOWN[k].join(', ')})`);
  }
  return spec;
}

function hashSeed(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function pick(rand, weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [val, w] of entries) { if ((r -= w) < 0) return val; }
  return entries[entries.length - 1][0];
}
/** A facet's priors leaned by the promise: each named value's weight multiplied. */
const leaned = (facet, promise) => Object.fromEntries(Object.entries(PRIORS[facet]).map(([val, w]) => [val, w * (PROMISES[promise].lean[facet]?.[val] ?? 1)]));

/** Every facet's die, thrown in a fixed order (the promise first: it leans the rest). */
function throwDice(rand, given) {
  const f = {};
  f.promise = pick(rand, PRIORS.promise);
  const promise = given.promise ?? f.promise;
  for (const k of MASCOT_KEYS.slice(1)) f[k] = pick(rand, leaned(k, promise));
  return f;
}

const lines = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

/** The sources of a sheet's notes, highest priority first. */
function sources(f) {
  return [
    { from: `promise.${f.promise}`, ...PROMISES[f.promise] }, { from: `form.${f.form}`, ...FORMS[f.form] },
    { from: `eyes.${f.eyes}`, ...EYES[f.eyes] }, { from: `hook.${f.hook}`, ...HOOKS[f.hook] }, { from: `accent.${f.accent}`, ...ACCENTS[f.accent] },
    { from: `extremities.${f.extremities}`, ...EXTREMITIES[f.extremities] }, { from: `energy.${f.energy}`, ...ENERGIES[f.energy] },
    { from: `being.${f.being}`, ...BEINGS[f.being] }, { from: `expression.${f.expression}`, ...EXPRESSIONS[f.expression] },
  ];
}

/** Merge per channel: notes in priority order; each knob once, its highest-priority direction. */
function compose(f) {
  const notes = {}, derives = {}, claimed = new Set();
  for (const src of sources(f)) for (const ch of MASCOT_CHANNEL_IDS) {
    for (const line of lines(src.notes?.[ch])) (notes[ch] ||= []).push({ line, from: src.from });
    for (const d of lines(src.derives?.[ch])) {
      const r = readMascotDerive(d), key = `${r.family}.${r.key}`;
      if (claimed.has(key)) continue;
      claimed.add(key);
      (derives[ch] ||= []).push(d);
    }
  }
  (notes.palette ||= []).push(f.being === 'human' ? { line: `${f.hue}: the clothes' colour, owned; ${f.skin} skin`, from: `hue.${f.hue}` } : { line: `${f.hue}: the body's colour, owned`, from: `hue.${f.hue}` });
  const ordered = (o) => Object.fromEntries(MASCOT_CHANNEL_IDS.filter((c) => o[c]).map((c) => [c, o[c]]));
  return { notes: ordered(notes), derives: ordered(derives) };
}

/** The accord the accent reads as (law 5): a round accent is harmony, any other contrast. */
export const accordOf = (accent) => (accent === 'round' ? 'harmony' : 'contrast');

/** Roll one mascot sheet. `path` names it in a cast (it keys the seed). */
export function rollMascot({ brief = '', facets: asked0 = {}, seed = 1, path = 'mascot' } = {}) {
  readMascot(asked0);
  const fromBrief = readMascotBrief(brief);
  readMascot(fromBrief.facets);
  const given = { ...fromBrief.facets, ...asked0 };
  const asked = new Set(Object.keys(given));
  let f, attempt = 0, broken = [];
  for (; attempt < MAX_ATTEMPTS; attempt++) {
    f = { ...throwDice(mulberry32(hashSeed(`${seed}::mascot::${path}::${attempt}`)), given), ...given };
    broken = FAULTS.filter((x) => x.when(f));
    if (broken.every((x) => x.on.every((k) => asked.has(k)))) break;
  }
  if (attempt === MAX_ATTEMPTS) attempt -= 1;
  const { notes, derives } = compose(f);
  const accord = accordOf(f.accent);
  return {
    tuning: 'mascot', path, seed, attempt,
    facets: Object.fromEntries(MASCOT_KEYS.map((k) => [k, f[k]])),
    given: MASCOT_KEYS.filter((k) => k in given),
    accord,
    reads: [PROMISES[f.promise].reads, FORMS[f.form].reads, `${ACCENTS[f.accent].reads}; ${HOOKS[f.hook].reads}`, `${EYES[f.eyes].reads}; ${EXTREMITIES[f.extremities].reads}`, `${ENERGIES[f.energy].reads}, in ${f.hue}`, f.being === 'human' ? `${BEINGS.human.reads}, ${f.skin} skin, ${EXPRESSIONS[f.expression].reads}` : `${BEINGS.critter.reads}, ${EXPRESSIONS[f.expression].reads}`],
    notes, derives,
    unread: { words: fromBrief.unread },
    faults: broken.map((x) => ({ id: x.id, why: x.why, held: x.on.every((k) => asked.has(k)) })),
  };
}
