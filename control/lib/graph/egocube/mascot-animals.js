/**
 * ANIMAL MASCOTS: a real species (the fauna roster, fauna/species.js) made into a mascot by the operational principles
 * in docs/mascot-animals.md. Eight species were CRAFTED by hand first (fox, giant panda, rabbit, frog, emperor penguin,
 * elephant, great horned owl, lion); the rules they shared are distilled into one card per FAMILY, so every species
 * in the roster has a mascot reading, and the crafted cards are what a family's rule alone would miss.
 *
 *   animalCard(id)          → the resolved card: the family's rule, the species' craft over it, the identity budget applied
 *   animalPalette(id, card) → the mascot palette groups read off the species' own coat (law 7 applied to it)
 *   ANIMAL_WORDS            → brief words: every species by its id and its spoken name, and the everyday names
 *
 * A card: { folk, promise, energy, form, extremities, identity: [outline features, ranked], kit: { ears, muzzle, tail,
 * mane, horns, shell, fin, neck, pattern, eyes, arms, feet }, drops, craft? }. The KIT is geometry the body compiler
 * draws (mascot-form.js animalParts); the IDENTITY is the ranked list of outline features, of which only the first
 * IDENTITY_BUDGET are drawn (principle A1). Pure data and pure functions.
 */
import { SPECIES, speciesParams } from '../fauna/species.js';

/** Principle A1: a mascot keeps at most three outline identifiers of its species, the strongest first. */
export const IDENTITY_BUDGET = 3;
/** The features that change the outline (counted against the budget); a pattern, the eyes, the arms and the feet are
 *  the coat's and the limbs' and ride free (A6, A3). */
export const OUTLINE = Object.freeze(['ears', 'muzzle', 'tail', 'mane', 'horns', 'shell', 'fin', 'neck', 'spines', 'quills']);

/** The kit's vocabulary: what each feature can be. */
export const KIT = Object.freeze({
  ears: ['pointed', 'tall', 'round', 'flap', 'tufts'],
  muzzle: ['point', 'round', 'beak', 'bill', 'trunk', 'disc', 'long', 'button', 'wide'],
  tail: ['brush', 'pom', 'tuft', 'thin', 'flat', 'fluke', 'thick'],
  mane: ['ring', 'crest'], horns: ['horns', 'ossicones'], shell: ['dome'], fin: ['dorsal'], neck: ['long'], spines: ['row'], quills: ['coat'],
  pattern: ['patches', 'tuxedo', 'mask', 'stripes', 'socks'],
  eyes: ['top', 'disc'], arms: ['flipper', 'wing'], feet: ['webbed', 'hooves'],
});

const c = (folk, promise, energy, form, extremities, identity, kit, drops) => Object.freeze({ folk, promise, energy, form, extremities, identity, kit, drops });

/** A7: an animal's mass becomes the weight of its mascot's limbs (a bear's, an elephant's are thick; a fox's thin), a
 *  multiple of the form's own limb; a family not named is 1. */
export const LIMB_WEIGHT = Object.freeze({ ursine: 1.75, pachyderm: 1.9, bovid: 1.5, suid: 1.5, theropod: 1.6, ceratopsian: 1.7, sauropod: 1.8, thyreophoran: 1.7,
  hadrosaur: 1.4, testudine: 1.5, equine: 1.25, macropod: 1.3, primate: 1.2, crocodilian: 1.4, mustelid: 1.15, pinniped: 1.4, cetacean: 1.3 });

/**
 * THE DISTILLED RULES, one card per family. `folk` is the reading people give the animal (A8: the promise comes from
 * the folk reading, not the biology); the energy is its locomotion turned into an idle (A9); the form is its mass read
 * as an attitude (A7); the identity is what names it from its silhouette (A1, A2), and `drops` is what the mascot lets go.
 */
export const FAMILY_MASCOT = Object.freeze({
  canine: c('loyal, eager', 'cheer', 'bouncy', 'sprout', 'paws', ['ears', 'tail', 'muzzle'], { ears: 'pointed', muzzle: 'round', tail: 'brush', pattern: 'socks' }, 'the long legs, the deep chest, the long back'),
  feline: c('proud, a little aloof', 'mischief', 'swaying', 'sprout', 'paws', ['ears', 'tail', 'muzzle'], { ears: 'pointed', muzzle: 'button', tail: 'thin' }, 'the long supple trunk, the slung belly'),
  equine: c('free, fast', 'speed', 'zippy', 'toon', 'paws', ['muzzle', 'mane', 'ears'], { ears: 'pointed', muzzle: 'round', mane: 'crest', tail: 'brush', feet: 'hooves' }, 'the long legs, the long head (cut to a bulb)'),
  cervid: c('gentle, watchful', 'wonder', 'swaying', 'sprout', 'paws', ['horns', 'ears', 'tail'], { ears: 'pointed', horns: 'horns', tail: 'pom', feet: 'hooves' }, 'the long legs, the long neck'),
  bovid: c('steady, stubborn', 'might', 'sturdy', 'toon', 'paws', ['horns', 'muzzle', 'ears'], { ears: 'flap', horns: 'horns', muzzle: 'round', feet: 'hooves' }, 'the barrel, the long head, the dewlap'),
  ursine: c('big, warm, huggable', 'comfort', 'sturdy', 'toon', 'paws', ['ears', 'muzzle'], { ears: 'round', muzzle: 'round' }, 'the hump, the long skull, the claws'),
  pachyderm: c('gentle giant, never forgets', 'comfort', 'sturdy', 'toon', 'paws', ['muzzle', 'ears', 'tail'], { ears: 'flap', muzzle: 'trunk', tail: 'thin' }, 'the size (a big animal becomes a soft round one), the wrinkles, the column legs'),
  procyonid: c('a masked bandit', 'mischief', 'zippy', 'sprout', 'paws', ['ears', 'tail', 'muzzle'], { ears: 'pointed', muzzle: 'point', tail: 'brush', pattern: 'mask' }, 'the arched back, the long fingers'),
  macropod: c('bouncing, a boxer', 'speed', 'bouncy', 'toon', 'paws', ['ears', 'tail'], { ears: 'tall', tail: 'thick', muzzle: 'round' }, 'the long hind feet (kept as big shoes), the long face'),
  rodent: c('small, quick, curious', 'mischief', 'zippy', 'sprout', 'paws', ['ears', 'tail', 'muzzle'], { ears: 'round', muzzle: 'point', tail: 'thin' }, 'the long body low to the ground, the tiny eyes (made big)'),
  mustelid: c('slippery, playful', 'mischief', 'zippy', 'sprout', 'paws', ['tail', 'ears', 'muzzle'], { ears: 'round', muzzle: 'round', tail: 'thick' }, 'the long low body'),
  monotreme: c('an odd one out', 'wonder', 'swaying', 'sprout', 'paws', ['muzzle', 'tail'], { muzzle: 'bill', tail: 'flat', feet: 'webbed' }, 'the sprawl, the long low body'),
  avian: c('bright, light, free', 'cheer', 'bouncy', 'orb', 'nubs', ['muzzle', 'tail'], { muzzle: 'beak', arms: 'wing', feet: 'webbed' }, 'the long legs and neck, the feathers as cards (one smooth form)'),
  crocodilian: c('a grinning predator', 'mischief', 'sturdy', 'toon', 'paws', ['muzzle', 'tail', 'spines'], { muzzle: 'long', tail: 'thick', spines: 'row' }, 'the sprawl, the scutes as tiles (kept as one row)'),
  testudine: c('slow and wise', 'comfort', 'sturdy', 'sprout', 'paws', ['shell'], { shell: 'dome', muzzle: 'button' }, 'the sprawl, the scutes (one smooth dome)'),
  leporid: c('quick, soft, jumpy', 'speed', 'bouncy', 'sprout', 'paws', ['ears', 'tail'], { ears: 'tall', tail: 'pom', muzzle: 'button' }, 'the crouch, the long hind legs (kept as big feet)'),
  suid: c('jolly, greedy', 'cheer', 'bouncy', 'toon', 'paws', ['muzzle', 'ears', 'tail'], { ears: 'pointed', muzzle: 'disc', tail: 'pom', feet: 'hooves' }, 'the long barrel, the tusks'),
  giraffid: c('tall, gentle, a head above', 'wonder', 'swaying', 'toon', 'paws', ['neck', 'horns', 'ears'], { neck: 'long', horns: 'ossicones', ears: 'pointed', feet: 'hooves' }, 'the long legs (the neck is kept: it is the name)'),
  primate: c('clever, cheeky', 'mischief', 'swaying', 'toon', 'paws', ['ears', 'muzzle', 'tail'], { ears: 'round', muzzle: 'round', tail: 'thin' }, 'the long arms (cut to a mascot\'s), the brow ridge'),
  squamate: c('sly, sinuous', 'mischief', 'swaying', 'sprout', 'paws', ['tail', 'muzzle', 'spines'], { muzzle: 'round', tail: 'thick' }, 'the sprawl, the scales (one smooth skin)'),
  anuran: c('a jumper with a big grin', 'cheer', 'bouncy', 'orb', 'paws', [], { eyes: 'top', muzzle: 'wide', feet: 'webbed' }, 'the long folded legs (kept as big webbed feet), the warts'),
  chiropteran: c('a night flier, spooky-cute', 'mischief', 'floaty', 'orb', 'nubs', ['ears'], { ears: 'pointed', arms: 'wing', muzzle: 'button' }, 'the membrane wings spread (kept folded as arms)'),
  chondrichthyan: c('the toothy menace, softened', 'might', 'swaying', 'orb', 'nubs', ['fin', 'tail'], { fin: 'dorsal', tail: 'fluke', arms: 'flipper', muzzle: 'wide' }, 'the long torpedo body (the head and body are one ball)'),
  teleost: c('bright, darting', 'cheer', 'floaty', 'orb', 'nubs', ['fin', 'tail'], { fin: 'dorsal', tail: 'fluke', arms: 'flipper', muzzle: 'wide' }, 'the long body, the scales'),
  theropod: c('a roaring kid-dinosaur', 'might', 'sturdy', 'toon', 'paws', ['muzzle', 'tail', 'spines'], { muzzle: 'round', tail: 'thick', spines: 'row' }, 'the horizontal spine (stood up), the tiny arms (made mascot arms)'),
  ceratopsian: c('a stubborn little tank', 'might', 'sturdy', 'toon', 'paws', ['horns', 'muzzle', 'tail'], { horns: 'horns', muzzle: 'beak', tail: 'thick' }, 'the four-legged stance (stood up)'),
  hadrosaur: c('a gentle honker', 'cheer', 'swaying', 'toon', 'paws', ['muzzle', 'tail'], { muzzle: 'bill', tail: 'thick' }, 'the long tail held level'),
  sauropod: c('a long-necked gentle giant', 'comfort', 'swaying', 'toon', 'paws', ['neck', 'tail'], { neck: 'long', tail: 'thick', muzzle: 'button' }, 'the size, the long tail (kept short)'),
  thyreophoran: c('an armoured plodder', 'might', 'sturdy', 'toon', 'paws', ['spines', 'tail'], { spines: 'row', tail: 'thick' }, 'the four-legged stance, the plates (a row of spines)'),
  pterosaur: c('a crested glider', 'wonder', 'floaty', 'sprout', 'nubs', ['muzzle', 'horns'], { muzzle: 'beak', horns: 'horns', arms: 'wing' }, 'the long wings (folded as arms)'),
  plesiosaur: c('the lake monster, shy', 'wonder', 'swaying', 'sprout', 'nubs', ['neck', 'tail'], { neck: 'long', tail: 'thick', arms: 'flipper', feet: 'webbed' }, 'the four flippers (two arms, two feet)'),
  cetacean: c('smart, playful, singing', 'cheer', 'floaty', 'orb', 'nubs', ['fin', 'tail', 'muzzle'], { fin: 'dorsal', tail: 'fluke', arms: 'flipper', muzzle: 'round' }, 'the long body (one ball)'),
  pinniped: c('a clown of the shore', 'cheer', 'swaying', 'sprout', 'nubs', ['muzzle', 'tail'], { muzzle: 'round', arms: 'flipper', feet: 'webbed' }, 'the long body hauled on the ground (stood up)'),
  cephalopod: c('clever, many-armed, strange', 'wonder', 'floaty', 'orb', 'nubs', [], { arms: 'flipper' }, 'the arms past two (the mascot keeps two and the feet), the mantle (the head is the body)'),
});

/**
 * THE CRAFTED EIGHT: what each species needed over its family's rule. `craft` says the decisions in words.
 */
export const SPECIES_MASCOT = Object.freeze({
  fox: { promise: 'mischief', energy: 'swaying', identity: ['ears', 'tail', 'muzzle'], kit: { muzzle: 'point', tail: 'brush', pattern: 'socks' }, tipTail: true,
    craft: 'kept the tall pointed ears, the white-tipped brush and a pointed muzzle in the pale chest\'s colour; the black socks are the coat\'s second zone. The folk fox is a trickster: mischief, not a dog\'s cheer.' },
  giantPanda: { energy: 'swaying', form: 'sprout', identity: ['ears', 'muzzle'], kit: { pattern: 'patches' },
    craft: 'the shape is any bear\'s; the PATTERN is the name. Black ears, eye patches and limbs on white, nothing else: no muzzle colour, no accent but the pattern.' },
  rabbit: { promise: 'cheer', identity: ['ears', 'tail'], kit: { ears: 'tall', tail: 'pom' },
    craft: 'two identifiers do it: the tall ears (longer than the head) and a cotton pom. The hind legs became big feet.' },
  frog: { form: 'orb', identity: [], kit: { eyes: 'top', muzzle: 'wide', feet: 'webbed' },
    craft: 'no outline identifier at all: the eyes on top, the wide mouth and the webbed feet are the frog. The body is already a mascot: one squat ball.' },
  emperorPenguin: { form: 'sprout', promise: 'comfort', energy: 'swaying', identity: ['muzzle'], kit: { muzzle: 'beak', pattern: 'tuxedo', arms: 'flipper', feet: 'webbed' }, colors: { Body: '#1d1f2a', Belly: '#f4f1ea', Beak: '#f2a020' },
    craft: 'the tuxedo is the name: a dark back and head, a white front and face, a bright beak and feet. It already stands upright; it waddles (swaying).' },
  elephant: { identity: ['muzzle', 'ears'], kit: { muzzle: 'trunk', ears: 'flap' },
    craft: 'the trunk and the fanned ears are kept and the tusks dropped (two identifiers carry it). The largest land animal becomes a round baby: size read as softness, not threat.' },
  greatHornedOwl: { form: 'orb', promise: 'wonder', energy: 'sturdy', identity: ['ears', 'muzzle'], kit: { ears: 'tufts', muzzle: 'beak', eyes: 'disc', arms: 'wing' },
    craft: 'the owl\'s eyes are its name, so its eyes break law 4\'s family rule: forward discs in pale facial dishes with a yellow iris. Ear tufts and a small beak; the wings are arms.' },
  lion: { promise: 'pride', energy: 'sturdy', form: 'toon', identity: ['mane', 'tail', 'ears'], kit: { mane: 'ring', tail: 'tuft', ears: 'round', muzzle: 'round' },
    craft: 'the mane is the lion: a ring round the face in the mane\'s colour, and the tail\'s tuft to match. The ears shrink to round (they hide in the mane); the muzzle is a pale round bulb.' },
});

/** A species NAMED BY ITS COAT (A2: a pattern identifier): the family's rule plus its pattern. Not crafted, one line each. */
export const COAT_IDENTITY = Object.freeze({ tiger: 'stripes', zebra: 'stripes', giantPanda: 'patches', raccoon: 'mask', redPanda: 'mask' });

/** The everyday names people use for species, beside each id and its spoken form. */
const ALIASES = Object.freeze({
  panda: 'giantPanda', bunny: 'rabbit', penguin: 'emperorPenguin', owl: 'greatHornedOwl', cat: 'houseCat', kitty: 'houseCat', kitten: 'houseCat',
  puppy: 'dog', doggo: 'dog', bear: 'brownBear', teddy: 'brownBear', duck: 'mallard', duckling: 'mallard', turtle: 'pondTurtle', monkey: 'capuchin',
  dino: 'tRex', dinosaur: 'tRex', 't-rex': 'tRex', trex: 'tRex', shark: 'greatWhiteShark', whale: 'humpbackWhale', dolphin: 'bottlenoseDolphin',
  seal: 'harborSeal', bat: 'fruitBat', fish: 'goldfish', piggy: 'pig', cow: 'dairyCow', eagle: 'baldEagle', lizard: 'gecko', croc: 'crocodile',
  'red panda': 'redPanda', 'polar bear': 'polarBear', 'sea turtle': 'seaTurtle', 'house cat': 'houseCat', otter: 'riverOtter',
});
const spoken = (id) => id.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
/** brief word → { animal: id } */
export const ANIMAL_WORDS = Object.freeze(Object.fromEntries([
  ...Object.keys(SPECIES).flatMap((id) => [[id.toLowerCase(), id], [spoken(id), id]]),
  ...Object.entries(ALIASES),
].map(([w, id]) => [w, { animal: id }])));

/** The resolved card for a species: its family's rule with the craft over it, the identity budget applied. */
export function animalCard(id) {
  const s = SPECIES[id];
  if (!s) throw new Error(`mascot: unknown animal '${id}' (the fauna roster: ${Object.keys(SPECIES).slice(0, 12).join(', ')} …)`);
  const fam = FAMILY_MASCOT[s.family];
  if (!fam) throw new Error(`mascot: no mascot rule for the family '${s.family}'`);
  const sp = SPECIES_MASCOT[id] ?? {};
  const identity = sp.identity ?? fam.identity;
  const kit0 = { ...fam.kit, ...(COAT_IDENTITY[id] ? { pattern: COAT_IDENTITY[id] } : {}), ...(sp.kit ?? {}) };
  // A1: only the first IDENTITY_BUDGET outline features are drawn; the rest of the outline is let go
  // a wide mouth and a button nose are the face's, not the outline's: they ride free
  const outline = (k) => OUTLINE.includes(k) && !(k === 'muzzle' && ['wide', 'button'].includes(kit0[k]));
  const kept = identity.filter((k) => kit0[k] && outline(k)).slice(0, IDENTITY_BUDGET);
  const kit = Object.fromEntries(Object.entries(kit0).filter(([k]) => !outline(k) || kept.includes(k)));
  const dropped = Object.keys(kit0).filter((k) => outline(k) && !kept.includes(k));
  // a muzzle past the budget leaves its nose: the face still needs a centre (A4)
  if (dropped.includes('muzzle') && kit0.muzzle !== 'wide') kit.muzzle = 'button';
  return {
    id, family: s.family, crafted: !!SPECIES_MASCOT[id], folk: fam.folk,
    promise: sp.promise ?? fam.promise, energy: sp.energy ?? fam.energy, form: sp.form ?? fam.form, extremities: sp.extremities ?? fam.extremities,
    identity: kept, kit, dropped, drops: fam.drops, limbs: LIMB_WEIGHT[s.family] ?? 1, ...(sp.craft ? { craft: sp.craft } : {}), ...(sp.tipTail ? { tipTail: true } : {}), ...(sp.colors ? { colors: sp.colors } : {}),
  };
}

/** The sheet facets an animal decides (under any the operator asks for). */
export function animalFacets(card) {
  const hook = card.identity[0] === 'ears' ? 'ears' : card.identity[0] === 'tail' ? 'tail' : card.identity[0] === 'spines' ? 'spines' : card.identity[0] === 'muzzle' && card.kit.muzzle !== 'trunk' ? 'snout' : 'none';
  // A2/law 5: the animal's own shapes are its accent: points (pointed or tufted ears, horns, spines, a beak) are a
  // spiky contrast, anything else a round harmony
  const K = card.kit, spiky = ['pointed', 'tufts'].includes(K.ears) || K.horns || K.spines || K.fin;
  return { being: 'critter', accent: spiky ? 'spike' : 'round', promise: card.promise, energy: card.energy, form: card.form, extremities: card.extremities, hook };
}

// ══════════ the coat (A6: the real markings as two or three flat zones; law 7 applied to them) ══════════

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const hex = (c3) => `#${c3.map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('')}`;
const light = (h) => { const [r, g, b] = rgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const sat = (h) => { const c3 = rgb(h), mx = Math.max(...c3), mn = Math.min(...c3); return mx === 0 ? 0 : (mx - mn) / mx; };
/** law 7 on a real coat: a chromatic coat is pushed toward a mascot's saturation; a near-grey one (a panda, a zebra,
 *  a shark) keeps its value, because its identity is light against dark, not a hue */
export function saturate(h, amount = 0.45) {
  if (sat(h) < 0.12) return h;
  const c3 = rgb(h), m = (c3[0] + c3[1] + c3[2]) / 3;
  return hex(c3.map((x) => m + (x - m) * (1 + amount)).map((x) => x * 1.08));
}

/** The palette groups an animal's coat gives: Body (the coat), Belly (its pale zone), Patch (its dark zone), Tip, Mane,
 *  Nose, Beak, Iris, Horn, Shell. */
export function animalPalette(id, card) {
  const C = speciesParams(id)?.colors ?? {};
  const coat = C.coat ?? '#8a7a64';
  const pales = [C.ash, C.belly, C.snout, C.tip].filter(Boolean).sort((a, b) => light(b) - light(a));
  const pale = pales.find((p) => light(p) - light(coat) > 0.12) ?? null;
  const darks = [C.sock, C.brow, C.tip, C.mane, C.ears].filter(Boolean).sort((a, b) => light(a) - light(b));
  const dark = darks.find((p) => light(coat) - light(p) > 0.15) ?? darks[0] ?? '#2a2220';
  const out = {
    Body: saturate(coat), Belly: pale ? saturate(pale, 0.2) : null, Patch: dark, Tip: C.tip ?? dark,
    Mane: saturate(C.mane ?? C.brow ?? dark, 0.3), Nose: C.nose ?? '#2a2020', Beak: saturate(C.snout ?? C.nose ?? '#e8a030', 0.5),
    Iris: C.iris ?? '#c8973a', Horn: C.horn ?? '#e8dcc0', Shell: saturate(C.ash ?? C.sock ?? coat, 0.3), Hoof: C.hoof ?? '#3a2e28',
    ...(card.colors ?? {}),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v));
}
