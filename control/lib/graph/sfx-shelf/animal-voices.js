/**
 * sfx-shelf/animal-voices — the animals heard, as VOICE CLASSES: a class is a way an animal is heard (a big cat, a
 * canine, a bird of prey, a buzzing insect, a dragon), and every class has the same four calls, so any animal can be
 * asked for any of them:
 *
 *   call    its own voice at rest: a lion's roar, a wolf's howl, a crow's caw, a cricket's chirp
 *   alert   its threat or its attack: a snarl, a hiss, a charging bellow, a screech
 *   hurt    a blow taken: a yelp, a squeal, a pained grunt
 *   death   its last: a dying cry, a fading groan
 *
 * and what moves without a voice (`MOVES`: small wings, great wings, a slither, a fish's splash, a whale's, a swarm).
 * Every word is a shelf row (`ANIMAL_ROWS`, roster.js lays them), `recorded`, silent until the sound library records
 * it: a page without the library hears what it heard before. Which species is in which class: animal-sounds.js.
 *
 * Pure data; no clock, no dice.
 */

const freeze = (o) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.freeze(v)])));

export const ANIMAL_CALLS = Object.freeze(['call', 'alert', 'hurt', 'death']);

// each class: what it is, what it is made of (facets.js matter), how heavy (WEIGHTS)
export const ANIMAL_CLASSES = freeze({
  'big-cat': { label: 'a big cat (lion, tiger, leopard)', weight: 'heavy' },
  'house-cat': { label: 'a house cat', weight: 'light' },
  canine: { label: 'a canine (wolf, dog, coyote)', weight: 'mid' },
  fox: { label: 'a fox', weight: 'light' },
  hyena: { label: 'a hyena', weight: 'mid' },
  bear: { label: 'a bear', weight: 'heavy' },
  'small-mammal': { label: 'a small mammal (a rodent, a rabbit, a badger)', weight: 'light' },
  equine: { label: 'a horse or a zebra', weight: 'heavy' },
  donkey: { label: 'a donkey', weight: 'mid' },
  camelid: { label: 'a camel or a llama', weight: 'heavy' },
  deer: { label: 'a deer, an elk, an antelope', weight: 'mid' },
  cattle: { label: 'cattle (a bull, a cow, a bison)', weight: 'heavy' },
  caprine: { label: 'a sheep or a goat', weight: 'mid' },
  pig: { label: 'a pig or a boar', weight: 'mid' },
  elephant: { label: 'an elephant or a mammoth', weight: 'heavy' },
  'heavy-herbivore': { label: 'a rhino or a hippo', weight: 'heavy' },
  'great-ape': { label: 'a great ape (gorilla, chimpanzee)', weight: 'heavy' },
  monkey: { label: 'a monkey or a lemur', weight: 'light' },
  raptor: { label: 'a bird of prey (eagle, hawk, vulture)', weight: 'mid' },
  owl: { label: 'an owl', weight: 'light' },
  corvid: { label: 'a crow or a raven', weight: 'light' },
  songbird: { label: 'a songbird or a pigeon', weight: 'light' },
  parrot: { label: 'a parrot or a toucan', weight: 'light' },
  waterfowl: { label: 'a duck, a goose, a swan', weight: 'mid' },
  poultry: { label: 'poultry (a chicken, a rooster, a turkey)', weight: 'light' },
  'large-bird': { label: 'a large bird (an ostrich, a penguin, a flamingo)', weight: 'mid' },
  crocodilian: { label: 'a crocodile or an alligator', weight: 'heavy' },
  reptile: { label: 'a lizard or a turtle', weight: 'light' },
  snake: { label: 'a snake', weight: 'light' },
  frog: { label: 'a frog or a toad', weight: 'light' },
  bat: { label: 'a bat', weight: 'light' },
  'insect-buzz': { label: 'a buzzing insect (a bee, a fly, a beetle)', weight: 'light' },
  'insect-chirp': { label: 'a chirping insect (a cricket, a cicada)', weight: 'light' },
  crawler: { label: 'a crawler (a spider, a scorpion, a crab)', weight: 'light' },
  dolphin: { label: 'a dolphin or a toothed whale', weight: 'heavy' },
  whale: { label: 'a great whale', weight: 'heavy' },
  seal: { label: 'a seal, a sea lion, a walrus', weight: 'heavy' },
  dinosaur: { label: 'a great dinosaur', weight: 'heavy' },
  'raptor-dino': { label: 'a raptor dinosaur', weight: 'mid' },
  pterosaur: { label: 'a pterosaur', weight: 'mid' },
  'sea-monster': { label: 'a sea monster (a sea serpent, a plesiosaur)', weight: 'heavy' },
  dragon: { label: 'a dragon or a drake', weight: 'heavy' },
  slime: { label: 'a slime or a fungoid', weight: 'light' },
  golem: { label: 'a golem of stone', weight: 'heavy' },
  wisp: { label: 'a wisp or a spirit', weight: 'light' },
  undead: { label: 'the undead (a skeleton, a zombie)', weight: 'mid' },
});
export const ANIMAL_CLASS_IDS = Object.freeze(Object.keys(ANIMAL_CLASSES));

// what moves without a voice
export const MOVES = Object.freeze({ flutter: 'wings-flutter', flap: 'wings-heavy', slither: 'slither', swim: 'fish-splash', breach: 'whale-breach', swarm: 'insect-swarm' });

const CREATURE_MATTER = Object.freeze({ golem: ['stone', 'creature'], slime: ['water', 'creature'], wisp: ['energy', 'creature'], undead: ['creature', 'voice'] });
const CALL_LABEL = Object.freeze({ call: 'its call', alert: 'its threat, an attack', hurt: 'a blow taken', death: 'its dying cry' });
const words = (cls) => cls.replace(/-/g, ' ');
export const ANIMAL_ROWS = Object.freeze([
  ...Object.entries(ANIMAL_CLASSES).flatMap(([cls, C]) => ANIMAL_CALLS.map((call) => Object.freeze({
    id: `${cls}-${call}`, category: 'creature', slot: 'on', label: `${C.label}: ${CALL_LABEL[call]}`,
    aliases: [`${words(cls)} ${call}`, `${words(cls)} ${call === 'call' ? 'cry' : call === 'alert' ? 'threat' : call === 'hurt' ? 'pain' : 'dying'}`],
    matter: CREATURE_MATTER[cls] ?? ['creature'], weight: C.weight,
  }))),
  Object.freeze({ id: 'wings-flutter', category: 'movement', slot: 'on', label: 'small wings fluttering up: a bird taking off', aliases: ['wings flutter', 'bird takeoff', 'wing flutter'], matter: ['air', 'creature'], weight: 'light' }),
  Object.freeze({ id: 'wings-heavy', category: 'movement', slot: 'on', label: 'great wings beating: an eagle, a dragon', aliases: ['wings heavy', 'great wings', 'wing beats'], matter: ['air', 'creature'], weight: 'heavy' }),
  Object.freeze({ id: 'slither', category: 'movement', slot: 'on', label: 'a body slithering over the ground', aliases: ['slithering', 'snake slither'], matter: ['earth', 'creature'], weight: 'light' }),
  Object.freeze({ id: 'fish-splash', category: 'movement', slot: 'on', label: 'a fish darting and splashing at the surface', aliases: ['fish splash', 'fish jump'], matter: ['water', 'creature'], weight: 'light' }),
  Object.freeze({ id: 'whale-breach', category: 'movement', slot: 'on', label: 'a whale breaching: a huge body crashing into the sea', aliases: ['whale breach', 'whale splash'], matter: ['water', 'creature'], weight: 'heavy' }),
  Object.freeze({ id: 'insect-swarm', category: 'creature', slot: 'hold', label: 'a swarm of insects buzzing, by how near', aliases: ['insect swarm', 'swarm buzz', 'buzzing swarm'], matter: ['creature', 'air'], weight: 'light' }),
]);
