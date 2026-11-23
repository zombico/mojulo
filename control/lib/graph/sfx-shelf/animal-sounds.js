/**
 * sfx-shelf/animal-sounds — which animal is heard as which voice class (animal-voices.js), read from the catalogs the
 * animals are made from, so every species there is heard and a new one is heard by its family: the fauna roster by its
 * `family` (fauna/species.js), the insects by their `order` (bugs/species.js), a few species by their own way of being
 * heard (a fox screams, a hyena laughs, a donkey brays), the foe classes by the species they stand on (foes/index.js
 * `standIn`), the RPG's bestiary by its monsters (playscape/rpg/presets.js FOE_PRESETS), and the words a game writes
 * (a 'dragon', a 'slime', 'wolves').
 *
 *   animalVoice(word)          the voice class of a species id (camelCase or not), a foe class, a monster or a word; or null
 *   animalSounds(word)         { voice, call, alert, hurt, death, moves? } shelf words, or null for an animal with no voice of
 *                              its own (a fish: `moves` only)
 *   animalRecorded(voice)      whether the library records that class (its alert): a page asks before it plays it
 *   FAMILY_VOICE, ORDER_VOICE, SPECIES_VOICE, MONSTER_VOICE   the tables (a new family, order or monster is a row)
 *
 * Pure but for animalRecorded (it reads the library's index); timeless.
 */
import { SPECIES } from '../fauna/species.js';
import { BUG_SPECIES } from '../bugs/species.js';
import { FOE_CLASSES } from '../foes/index.js';
import { recordedFor } from '../sound-library/library.js';
import { ANIMAL_CLASSES, MOVES } from './animal-voices.js';

// a fauna family's voice (null: heard by its moves only, a fish's); a species in SPECIES_VOICE is its own
export const FAMILY_VOICE = Object.freeze({
  canine: 'canine', feline: 'big-cat', equine: 'equine', cervid: 'deer', bovid: 'cattle', ursine: 'bear', pachyderm: 'elephant',
  procyonid: 'small-mammal', macropod: 'small-mammal', rodent: 'small-mammal', mustelid: 'small-mammal', monotreme: 'small-mammal', leporid: 'small-mammal',
  avian: 'songbird', crocodilian: 'crocodilian', testudine: 'reptile', suid: 'pig', giraffid: 'deer', primate: 'monkey', squamate: 'reptile',
  anuran: 'frog', chiropteran: 'bat', chondrichthyan: null, teleost: null, cephalopod: null, cetacean: 'dolphin', pinniped: 'seal',
  theropod: 'dinosaur', ceratopsian: 'dinosaur', hadrosaur: 'dinosaur', sauropod: 'dinosaur', thyreophoran: 'dinosaur', pterosaur: 'pterosaur', plesiosaur: 'sea-monster',
});
export const SPECIES_VOICE = Object.freeze({
  fox: 'fox', hyena: 'hyena', houseCat: 'house-cat', donkey: 'donkey', camel: 'camelid', llama: 'camelid', gazelle: 'deer',
  ram: 'caprine', sheep: 'caprine', goat: 'caprine', wombat: 'small-mammal', koala: 'small-mammal', hippo: 'heavy-herbivore', rhino: 'heavy-herbivore',
  chimpanzee: 'great-ape', gorilla: 'great-ape', orangutan: 'great-ape', sloth: 'small-mammal',
  vulture: 'raptor', baldEagle: 'raptor', greatHornedOwl: 'owl', crow: 'corvid', raven: 'corvid', macaw: 'parrot', toucan: 'parrot',
  chicken: 'poultry', rooster: 'poultry', turkey: 'poultry', peacock: 'poultry', mallard: 'waterfowl', swan: 'waterfowl', canadaGoose: 'waterfowl',
  ostrich: 'large-bird', emu: 'large-bird', flamingo: 'large-bird', emperorPenguin: 'large-bird',
  snake: 'snake', kingCobra: 'snake', rattlesnake: 'snake', greenMamba: 'snake', anaconda: 'snake', seaSerpent: 'sea-monster',
  humpbackWhale: 'whale', velociraptor: 'raptor-dino',
});
// an insect's order's voice
export const ORDER_VOICE = Object.freeze({
  Hymenoptera: 'insect-buzz', Diptera: 'insect-buzz', Coleoptera: 'insect-buzz', Lepidoptera: 'insect-buzz', Culicidae: 'insect-buzz', Odonata: 'insect-buzz',
  Neuroptera: 'insect-buzz', Ephemeroptera: 'insect-buzz', Curculionidae: 'insect-buzz', Hemiptera: 'insect-buzz',
  Orthoptera: 'insect-chirp', Cicadidae: 'insect-chirp',
  Formicidae: 'crawler', Mantodea: 'crawler', Araneae: 'crawler', Blattodea: 'crawler', Chilopoda: 'crawler', Diplopoda: 'crawler', Isopoda: 'crawler',
  Scorpiones: 'crawler', Brachyura: 'crawler', Phasmida: 'crawler', Dermaptera: 'crawler', Siphonaptera: 'crawler', Ixodida: 'crawler', Opiliones: 'crawler',
  Astacidea: 'crawler', Xiphosura: 'crawler', Achelata: 'crawler',
});
// monsters and the words games write: the RPG's bestiary (FOE_PRESETS ids) among them
export const MONSTER_VOICE = Object.freeze({
  slime: 'slime', ooze: 'slime', jelly: 'slime', shroom: 'slime', fungoid: 'slime', mushroom: 'slime',
  golem: 'golem', gargoyle: 'golem', wisp: 'wisp', spirit: 'wisp', ghost: 'wisp', phantom: 'wisp',
  skeleton: 'undead', zombie: 'undead', ghoul: 'undead', mummy: 'undead', lich: 'undead',
  drake: 'dragon', dragon: 'dragon', wyvern: 'dragon', wyrm: 'dragon', kaiju: 'dinosaur', dinosaur: 'dinosaur', rex: 'dinosaur',
  bat: 'bat', spider: 'crawler', scorpion: 'crawler', wolf: 'canine', wolves: 'canine', dog: 'canine', hound: 'canine', jackal: 'canine',
  cat: 'house-cat', kitten: 'house-cat', lion: 'big-cat', tiger: 'big-cat', panther: 'big-cat', bear: 'bear', boar: 'pig',
  horse: 'equine', pony: 'equine', bird: 'songbird', eagle: 'raptor', hawk: 'raptor', falcon: 'raptor', serpent: 'snake', viper: 'snake',
  bee: 'insect-buzz', wasp: 'insect-buzz', fly: 'insect-buzz', cricket: 'insect-chirp', crab: 'crawler', whale: 'whale', shark: null, fish: null,
});

const lower = Object.fromEntries([...Object.keys(SPECIES), ...Object.keys(BUG_SPECIES), ...Object.keys(SPECIES_VOICE)].map((id) => [id.toLowerCase(), id]));
const NONE = Symbol('no voice');

function voiceOfSpecies(id) {
  if (id in SPECIES_VOICE) return SPECIES_VOICE[id];
  if (SPECIES[id]) return SPECIES[id].family in FAMILY_VOICE ? FAMILY_VOICE[SPECIES[id].family] ?? NONE : undefined;
  if (BUG_SPECIES[id]) return ORDER_VOICE[BUG_SPECIES[id].order];
  return undefined;
}

export function animalVoice(word) {
  if (typeof word !== 'string' || !word) return null;
  const id = lower[word.toLowerCase()] ?? word;
  let v = voiceOfSpecies(id);
  if (v === undefined && FOE_CLASSES[id]) v = voiceOfSpecies(FOE_CLASSES[id].standIn);
  if (v === undefined) {
    const key = word.toLowerCase();
    if (key in MONSTER_VOICE) v = MONSTER_VOICE[key] ?? NONE;
    // (a phrase: its last word that names one, 'a giant cave spider', 'wolves')
    else for (const w of key.split(/[^a-z]+/).filter(Boolean).reverse()) { if (w in MONSTER_VOICE) { v = MONSTER_VOICE[w] ?? NONE; break; } const s = lower[w]; if (s) { v = voiceOfSpecies(s); if (v !== undefined) break; } }
  }
  return v && v !== NONE && ANIMAL_CLASSES[v] ? v : null;
}

const FLIERS = new Set(['raptor', 'owl', 'corvid', 'songbird', 'parrot', 'waterfowl', 'poultry', 'bat', 'insect-buzz']);
const GREAT_WINGS = new Set(['raptor', 'pterosaur', 'dragon']);

export function animalSounds(word) {
  const voice = animalVoice(word);
  const key = typeof word === 'string' ? lower[word.toLowerCase()] ?? word : null;
  const fish = key && ((SPECIES[key] && FAMILY_VOICE[SPECIES[key].family] === null) || MONSTER_VOICE[String(word).toLowerCase()] === null);
  if (!voice) return fish ? { voice: null, moves: { swim: MOVES.swim } } : null;
  const moves = {
    ...(GREAT_WINGS.has(voice) ? { fly: MOVES.flap } : FLIERS.has(voice) ? { fly: MOVES.flutter } : {}),
    ...(voice === 'snake' ? { crawl: MOVES.slither } : {}),
    ...(voice === 'whale' || voice === 'dolphin' ? { swim: MOVES.breach } : {}),
    ...(voice === 'insect-buzz' ? { swarm: MOVES.swarm } : {}),
  };
  return { voice, call: `${voice}-call`, alert: `${voice}-alert`, hurt: `${voice}-hurt`, death: `${voice}-death`, ...(Object.keys(moves).length ? { moves } : {}) };
}

export function animalRecorded(voice) {
  return !!(voice && ANIMAL_CLASSES[voice] && recordedFor(`${voice}-alert`));
}
