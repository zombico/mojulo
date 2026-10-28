/**
 * THE EGOCUBE'S ANCESTRY: who a character's people are, read for what it gives the body. Two kinds, one shape:
 *
 *   HUMAN ancestries, broad regional groups, each a RANGE of skin tone, undertone, hair texture, hair colour and eye
 *   colour. An ancestry is never one look: the seed picks inside the range, and variation within any group is wider
 *   than between groups. It writes colouring and hair only; the face's structure is the individual's (the roll's), so
 *   an ancestry is never drawn as a caricature of itself.
 *
 *   LINEAGES, non-human peoples, built on the creature loop's vocabulary (the creature-from-plan catalyst and the dragon
 *   body, docs/examples/dragon-body): its thesis (silhouette, legs, head, the one iconic feature) and its detail passes
 *   (ornaments, grown patches, correctives, hair, colour). A lineage is a band of HUMANITY h (1 human … 0 creature) and
 *   a list of CUES, each shown at or below an h (of cues sharing a `slot`, only the deepest shown: the long snout
 *   replaces the short); `{pick}` in a cue's line is chosen by the seed from its `pick` list. So a
 *   lineage too is a range, and rolling it again gives a variation of the same people. Under DOOR_H the body leaves the
 *   hero door for the creature loop (a snout, scales all over, digitigrade legs are passes the hero grammar lacks).
 *
 * Skin tones are the ten swatches of the Monk Skin Tone scale (Ellis Monk; published by Google under CC BY 4.0), by
 * number. A custom lineage is the same data (readLineage), so a people established once can be rolled for variations.
 */
import { CHANNEL_IDS, readDerive } from './channels.js';
import { BUILDS } from './facets.js';
import { UNDEAD_FORMS, UNDEAD_LAYERS } from '../undead/cards.js';
// the forms ported to the tiered body so far (the rest on the creature loop until theirs land)
const TIERED_UNDEAD = (lin) => !lin.layers?.length;

/** The Monk Skin Tone scale, lightest (1) to deepest (10). */
export const MST = Object.freeze(['#f6ede4', '#f3e7db', '#f7ead0', '#eadaba', '#d7bd96', '#a07e56', '#825c43', '#604134', '#3a312a', '#292420']);
export const UNDERTONES = Object.freeze(['cool', 'neutral', 'warm', 'olive']);
export const HAIR_COLOURS = Object.freeze({
  black: '#1c1714', 'dark-brown': '#3b2a20', brown: '#5a3c28', 'light-brown': '#8a6442', blonde: '#c9a66b', red: '#8f3b1b', auburn: '#6e2c1a',
});
export const HAIR_TEXTURES = Object.freeze({
  straight: { derives: ['hair.wave -'] },
  wavy: { derives: ['hair.wave +'] },
  curly: { derives: ['hair.wave +'] },
  coily: { derives: ['hair.wave +'], gap: 'coily hair: the hair library has no coily texture or protective styles (an afro, locs, twists, cornrows) yet' },
});
export const EYE_COLOURS = Object.freeze(['dark-brown', 'brown', 'amber', 'hazel', 'green', 'blue', 'grey']);

/** Human ancestries: broad on purpose. Lists may repeat a value to weight it. */
export const HUMAN_ANCESTRIES = Object.freeze({
  african: { reads: 'African', tones: [6, 10], undertones: ['neutral', 'warm', 'cool'], textures: ['coily', 'coily', 'curly'], hair: ['black', 'black', 'dark-brown'], eyes: ['dark-brown', 'dark-brown', 'brown'] },
  european: { reads: 'European', tones: [1, 5], undertones: ['cool', 'neutral', 'warm'], textures: ['straight', 'wavy', 'wavy', 'curly'], hair: ['dark-brown', 'brown', 'light-brown', 'blonde', 'red', 'black'], eyes: ['brown', 'hazel', 'green', 'blue', 'blue', 'grey'] },
  'east-asian': { reads: 'East Asian', tones: [2, 5], undertones: ['neutral', 'warm', 'olive'], textures: ['straight', 'straight', 'wavy'], hair: ['black', 'black', 'dark-brown'], eyes: ['dark-brown', 'brown'],
    notes: { eyes: 'the upper-lid crease often low or absent: draw this person\'s eye, never a slant' }, derives: { eyes: ['sculpt.lidCover +'] } },
  'southeast-asian': { reads: 'Southeast Asian', tones: [4, 7], undertones: ['warm', 'olive', 'neutral'], textures: ['straight', 'wavy'], hair: ['black', 'dark-brown'], eyes: ['dark-brown', 'brown'] },
  'south-asian': { reads: 'South Asian', tones: [4, 9], undertones: ['warm', 'olive', 'neutral'], textures: ['straight', 'wavy', 'wavy', 'curly'], hair: ['black', 'dark-brown'], eyes: ['dark-brown', 'brown', 'brown', 'hazel', 'green'] },
  'middle-eastern-north-african': { reads: 'Middle Eastern or North African', tones: [3, 7], undertones: ['olive', 'warm', 'neutral'], textures: ['wavy', 'curly', 'straight'], hair: ['black', 'dark-brown', 'brown'], eyes: ['dark-brown', 'brown', 'hazel', 'green'] },
  'indigenous-american': { reads: 'Indigenous American', tones: [4, 8], undertones: ['warm', 'neutral'], textures: ['straight', 'straight', 'wavy'], hair: ['black', 'dark-brown'], eyes: ['dark-brown', 'brown'] },
  'pacific-islander': { reads: 'Pacific Islander', tones: [5, 9], undertones: ['warm', 'neutral'], textures: ['wavy', 'curly', 'straight'], hair: ['black', 'dark-brown'], eyes: ['dark-brown', 'brown'] },
  'latin-american': { reads: 'Latin American (of any mix)', tones: [3, 9], undertones: ['warm', 'olive', 'neutral'], textures: ['straight', 'wavy', 'curly', 'coily'], hair: ['black', 'dark-brown', 'brown', 'light-brown'], eyes: ['dark-brown', 'brown', 'hazel', 'green'] },
  mixed: { reads: 'of mixed ancestry', tones: [1, 10], undertones: UNDERTONES, textures: Object.keys(HAIR_TEXTURES), hair: Object.keys(HAIR_COLOURS), eyes: EYE_COLOURS },
});
export const HUMAN_IDS = Object.freeze(Object.keys(HUMAN_ANCESTRIES));

/** Below this humanity the body leaves the hero door for the creature loop. */
export const DOOR_H = 0.5;

/**
 * Lineages. `humanity` [lo, hi]; `skin`: an MST span (a human-like skin) or `cover`: the people's own swatches by word;
 * `cues`: { at, ch, line, slot?, pick?, derives?, plan? } shown when h ≤ at (`plan`: structure for the sheet-to-plan
 * function, egocube/plan.js — `tail`, `claws`, `cover: { kind, where }` — gated by humanity like the line); `builds`: the builds the people has (a rolled build
 * outside them is drawn again, egocube.js FAULTS); `built`: what the creature loop already has for it.
 */
export const LINEAGES = Object.freeze({
  draconic: {
    reads: 'draconic (dragon-kin)', humanity: [0.15, 0.6],
    cover: { bronze: '#8c6a3c', verdigris: '#4f7a6a', crimson: '#8a2a23', obsidian: '#22212a', ivory: '#d9cfb8', cobalt: '#2c4a7a' },
    built: 'the dragon head (head-detail heads/dragon) and body (docs/examples/dragon-body); the membrane wing (docs/examples/wings)',
    cues: [
      { at: 1, ch: 'eyes', line: 'slit pupils; the iris a metal colour' },
      { at: 0.95, ch: 'ornament', line: 'horns {pick}', pick: ['swept back from the brow', 'curled like a ram\'s', 'ridged and forward, a bull\'s', 'a crown of short spikes'], derives: ['pass = ornaments'] },
      { at: 0.8, ch: 'cover', slot: 'scales', line: 'scale patches at the temples, along the jaw, on the backs of the hands', derives: ['pass = patches'], plan: { cover: { kind: 'scales', where: ['forearm'] } } },
      { at: 0.7, ch: 'ornament', line: 'claws at the fingertips', plan: { claws: 'long' } },
      { at: 0.6, ch: 'structure', slot: 'snout', line: 'a short snout: nose and mouth pushed forward together', derives: ['door = creature'] },
      { at: 0.6, ch: 'frame', line: 'a tail, thick at the root', plan: { tail: 'thick' } },
      { at: 0.5, ch: 'cover', slot: 'scales', line: 'scales all over; scutes down the chest, broad over the ribs, narrow at the waist', derives: ['pass = patches'], plan: { cover: { kind: 'scales', where: ['belly', 'forearm', 'shin', 'thigh', 'tail'] } } },
      { at: 0.45, ch: 'silhouette', line: '{pick}', pick: ['a crest of spikes down the nape and spine', 'a frill behind the jaw', 'folded membrane wings'], derives: ['pass = ornaments'] },
      { at: 0.35, ch: 'structure', slot: 'snout', line: 'the long dragon snout, teeth showing at rest, a forked tongue', derives: ['door = creature', 'head = dragon', 'pass = regions'] },
      { at: 0.3, ch: 'frame', line: 'digitigrade legs: the heel raised, a hulking trunk', derives: ['legs = digitigrade'] },
    ],
  },
  sylvan: {
    reads: 'sylvan (elf-kin)', humanity: [0.85, 0.95], skin: [1, 8], builds: ['lithe', 'canonical'],
    built: 'the hero door carries it: proportions and face; the ear is the one new part',
    cues: [
      { at: 1, ch: 'frame', line: 'long-limbed and light; taller than they look', derives: ['tune.legs +', 'tune.neck +'] },
      { at: 0.95, ch: 'ornament', line: 'ears {pick}', pick: ['long and swept back', 'leaf-pointed, short', 'long and drooping slightly'] },
      { at: 0.95, ch: 'structure', line: 'fine bones; the face narrow and long', derives: ['trait = sharp'] },
      { at: 0.9, ch: 'eyes', line: 'eyes a shade too large and too bright', derives: ['sculpt.catchlight +'] },
    ],
  },
  dwarven: {
    reads: 'dwarven', humanity: [0.85, 0.95], skin: [2, 9], builds: ['stout', 'brute'],
    built: 'the hero door carries it: the stout cast and the hair',
    cues: [
      { at: 1, ch: 'frame', line: 'short, broad and deep: built to carry stone', derives: ['cast = stout', 'tune.stature -'] },
      { at: 0.95, ch: 'hair', line: '{pick}', pick: ['a beard braided and banded', 'a beard to the belt', 'hair and beard braided into one'], derives: ['hair.volume +'] },
      { at: 0.9, ch: 'structure', line: 'a broad nose and a heavy brow', derives: ['trait = mature'] },
    ],
  },
  orcish: {
    reads: 'orcish', humanity: [0.7, 0.85], builds: ['brute', 'heroic', 'stout'], cover: { moss: '#5d6b3e', ash: '#7a7a6e', olive: '#6b6a3a', slate: '#4d5458' },
    built: 'the brute cast on the hero door; tusks are an ornament the hero grammar lacks',
    cues: [
      { at: 1, ch: 'frame', line: 'mass first: wide shoulders, a short neck', derives: ['cast = brute'] },
      { at: 0.85, ch: 'ornament', line: 'tusks {pick}', pick: ['from the lower jaw, short', 'from the lower jaw, long and chipped', 'one broken'], derives: ['pass = ornaments'] },
      { at: 0.85, ch: 'structure', line: 'a heavy jaw and brow ridge; a flat broad nose', derives: ['trait = sharp'] },
      { at: 0.8, ch: 'ornament', line: 'ears pointed and notched' },
    ],
  },
  infernal: {
    reads: 'infernal (fiend-touched)', humanity: [0.65, 0.85], cover: { crimson: '#7a2420', violet: '#4a2c5a', ash: '#5a5a62', ember: '#9a4a2a' },
    built: 'the hero door for the body; horns and the tail are ornaments the hero grammar lacks',
    cues: [
      { at: 1, ch: 'eyes', line: 'eyes one solid colour, no white', derives: ['sculpt.catchlight -'] },
      { at: 0.85, ch: 'ornament', line: 'horns {pick}', pick: ['curving back over the skull', 'straight up, a goat\'s', 'small and forward, a bull\'s'], derives: ['pass = ornaments'] },
      { at: 0.8, ch: 'frame', line: 'a thin tail, tufted or barbed at the tip' },
      { at: 0.7, ch: 'ornament', line: 'clawed fingertips; small spurs at the elbows' },
    ],
  },
  undead: {
    reads: 'undead', humanity: [0.6, 0.9], builds: ['lithe', 'canonical'], cover: { ashen: '#9a9a90', bone: '#c8bfa8', blue: '#7a8a9a', green: '#8a9a7a' },
    built: 'the hero door; sunken flesh and exposed bone are correctives and regions the hero grammar lacks',
    cues: [
      { at: 1, ch: 'eyes', line: 'a light where the eyes should be, or eyes clouded white', derives: ['sculpt.catchlight +'] },
      { at: 0.9, ch: 'structure', line: 'the flesh drawn back: cheekbones, temples and jaw too sharp', derives: ['trait = sharp', 'pass = correctives'] },
      { at: 0.75, ch: 'cover', line: 'bone showing {pick}', pick: ['at the jaw', 'at the knuckles', 'through the ribs'], derives: ['pass = regions'] },
      { at: 0.65, ch: 'frame', line: 'thin to the point of wrongness', derives: ['tune.waist -'] },
    ],
  },
  feline: {
    reads: 'feline (cat-kin)', humanity: [0.3, 0.7], cover: { tawny: '#b08a52', grey: '#8a8a88', black: '#1e1c1c', cream: '#e6d6b8', ginger: '#c0703a' },
    built: 'the felid head (creature-heads/derive.js: the wolf skull with the muzzle pulled in)',
    cues: [
      { at: 1, ch: 'eyes', line: 'slit pupils; a bright iris', derives: ['sculpt.catchlight +'] },
      { at: 0.95, ch: 'ornament', line: 'cat ears high on the head' },
      { at: 0.8, ch: 'frame', line: 'a long tail that answers the mood', plan: { tail: 'thin' } },
      { at: 0.7, ch: 'cover', line: 'fur {pick}', pick: ['plain', 'striped (tabby)', 'spotted', 'with a pale throat and belly'], derives: ['pass = patches'], plan: { cover: { kind: 'fur', where: ['forearm', 'thigh', 'tail'] }, claws: 'long' } },
      { at: 0.6, ch: 'structure', line: 'a short muzzle with whiskers', derives: ['door = creature', 'pass = hair'] },
      { at: 0.45, ch: 'frame', line: 'digitigrade legs; padded hands', derives: ['legs = digitigrade'] },
    ],
  },
  lupine: {
    reads: 'lupine (wolf-kin)', humanity: [0.3, 0.7], cover: { grey: '#7a7670', black: '#24221f', brown: '#6a5038', white: '#dedad2' },
    built: 'the wolf head (creature-heads/wolf), first drawn for the Pale Warden',
    cues: [
      { at: 1, ch: 'eyes', line: 'amber or pale eyes', derives: ['sculpt.catchlight +'] },
      { at: 0.95, ch: 'ornament', line: 'pointed ears, mobile' },
      { at: 0.8, ch: 'frame', line: 'a thick brush tail', plan: { tail: 'brush' } },
      { at: 0.7, ch: 'cover', line: 'a ruff of fur at the neck and shoulders', derives: ['pass = patches'], plan: { cover: { kind: 'fur', where: ['ruff', 'forearm', 'thigh', 'tail'] }, claws: 'blunt' } },
      { at: 0.6, ch: 'structure', line: 'a long muzzle', derives: ['door = creature', 'head = wolf'] },
      { at: 0.45, ch: 'frame', line: 'digitigrade legs; a forward-leaning trunk', derives: ['legs = digitigrade'] },
    ],
  },
  ursine: {
    reads: 'ursine (bear-kin)', humanity: [0.2, 0.5], builds: ['brute', 'stout'], cover: { brown: '#5a4030', black: '#1f1c1a', cinnamon: '#8a5a38', white: '#e2ddd2' },
    built: 'the bear head (head-detail heads/bear)',
    cues: [
      { at: 1, ch: 'frame', line: 'enormous: wide, round-shouldered, heavy-handed', derives: ['cast = brute'] },
      { at: 0.6, ch: 'cover', line: 'thick fur, longer at the shoulders', derives: ['pass = patches'], plan: { cover: { kind: 'fur', where: ['ruff', 'forearm', 'thigh'] }, tail: 'stub' } },
      { at: 0.5, ch: 'structure', line: 'the bear\'s head: a broad skull, small round ears, a heavy muzzle', derives: ['head = bear', 'door = creature'] },
      { at: 0.4, ch: 'ornament', line: 'blunt curved claws', derives: ['pass = ornaments'], plan: { claws: 'blunt' } },
    ],
  },
  avian: {
    reads: 'avian (bird-kin)', humanity: [0.2, 0.6], cover: { umber: '#5a4632', slate: '#4a5260', snow: '#e8e6e0', crimson: '#9a2a24', iridescent: '#2a4a4a' },
    built: 'the beaked head (creature-heads/derive.js: the wolf muzzle drawn to a point); the feathered wing (docs/examples/wings) on the vulture',
    cues: [
      { at: 1, ch: 'eyes', line: 'round eyes, set to the side, unblinking' },
      { at: 0.9, ch: 'hair', line: 'feathers instead of hair: {pick}', pick: ['a crest', 'swept-back plumes', 'a short cap'], derives: ['pass = hair'] },
      { at: 0.7, ch: 'silhouette', line: 'wings {pick}', pick: ['folded at the back', 'on the arms, the flight feathers trailing from the wrists'], derives: ['wings = feather'] },
      { at: 0.55, ch: 'structure', line: 'a beak in place of nose and mouth', derives: ['door = creature'] },
      { at: 0.45, ch: 'frame', line: 'scaled legs ending in talons', derives: ['legs = digitigrade'], plan: { claws: 'long', cover: { kind: 'scales', where: ['shin'] } } },
    ],
  },
  insectoid: {
    reads: 'insectoid', humanity: [0.1, 0.4], cover: { chitin: '#2a2a22', jade: '#3a6a4a', amber: '#9a6a20', cobalt: '#22385a' },
    built: 'the mandibled head (creature-heads/derive.js: the bear skull shortened and pitched down); the bug builder (lib/graph/bugs) makes insects, not upright kin',
    cues: [
      { at: 1, ch: 'eyes', line: 'compound eyes, no lids' },
      { at: 0.6, ch: 'ornament', line: 'antennae {pick}', pick: ['long and thin', 'feathered', 'short and clubbed'], derives: ['pass = ornaments'] },
      { at: 0.5, ch: 'cover', line: 'a chitin shell in plates, the joints showing between', derives: ['door = creature', 'pass = patches'], plan: { cover: { kind: 'chitin', where: ['belly', 'forearm', 'shin', 'thigh'] } } },
      { at: 0.4, ch: 'structure', line: 'mandibles where the mouth is' },
      { at: 0.3, ch: 'frame', line: 'a second pair of arms', derives: ['pass = masses'] },
    ],
  },
  // THE UNDEAD FORMS (lib/graph/undead): no humanity left to roll a face from, so always the creature door; the body is
  // the form library's, its variation by the build (a brute's zombie the hulk, its skeleton the giant)
  zombie: {
    reads: 'the walking dead', humanity: [0, 0.2], form: 'zombie', cover: { grey: '#9a9a90', green: '#8a9a7a', blue: '#7a8a9a' },
    built: 'the undead form library (lib/graph/undead): wasted or swollen, hunched, the arms out, a seeded loss; the gaunt head (creature-heads/derive.js)',
    cues: [
      { at: 1, ch: 'frame', line: 'a body kept and wrong: {pick}', pick: ['wasted to the bone', 'swollen', 'hunched and reaching'] },
      { at: 1, ch: 'structure', line: 'a dead face: sunken eyes, the jaw slack' },
    ],
  },
  skeleton: {
    reads: 'a walking skeleton', humanity: [0, 0.05], form: 'skeleton', cover: { bone: '#d6cfbd', old: '#c8bfa8', grey: '#b8b4aa' },
    built: 'the undead form library (lib/graph/undead): a spine, curved ribs, a pelvis basin, knobbed bones; the skull head (creature-heads/derive.js)',
    cues: [
      { at: 1, ch: 'frame', line: 'bare bone: no flesh at all' },
      { at: 1, ch: 'structure', line: 'a skull: empty sockets, the teeth bared' },
    ],
  },
  // a form with LAYERS (lib/graph/undead UNDEAD_LAYERS) laid over its card: the skeleton in what is left of its clothes
  ragged: {
    reads: 'a skeleton in rags', humanity: [0, 0.05], form: 'skeleton', layers: ['shreds'], cover: { bone: '#d6cfbd', old: '#c8bfa8', grey: '#b8b4aa' },
    built: 'the undead form library (lib/graph/undead): the skeleton, and its clothes in torn strips from the shoulders, the hips and the arms (undead/shreds.js)',
    cues: [
      { at: 1, ch: 'frame', line: 'bare bone hung with the rags of its clothes' },
      { at: 1, ch: 'structure', line: 'a skull: empty sockets, the teeth bared' },
    ],
  },
  // the corpse with its bone showing: a gaunt zombie, parts of it gone back to the skeleton
  rotting: {
    reads: 'a gaunt corpse, bone bared where the flesh is gone', humanity: [0, 0.15], form: 'zombie', layers: ['bared'], cover: { grey: '#9a9a90', green: '#8a9a7a', blue: '#7a8a9a' },
    built: 'the undead form library (lib/graph/undead): the zombie drawn in, and parts of it bone again: its skull, an arm, a leg, one side\'s ribs (undead/bared.js)',
    cues: [
      { at: 1, ch: 'frame', line: 'flesh gone to the bone: {pick}', pick: ['a bare arm', 'the ribs through the chest', 'a leg of bone'] },
      { at: 1, ch: 'structure', line: 'a dead face, or the skull under it' },
    ],
  },
  // the dead between the zombie and the bone: gaunt flesh rotting back on the skeleton, in its rags
  decayed: {
    reads: 'a rotting corpse, half bone', humanity: [0, 0.08], form: 'skeleton', layers: ['decayed', 'shreds'], cover: { bone: '#d6cfbd', old: '#c8bfa8', grey: '#b8b4aa' },
    built: 'the undead form library (lib/graph/undead): the skeleton, gaunt rotted flesh back on it (undead/decay.js), its clothes in rags (undead/shreds.js)',
    cues: [
      { at: 1, ch: 'frame', line: 'flesh rotted back to the bone: {pick}', pick: ['the ribs through a shrunken chest', 'sinew on bare bone', 'the chest rotted open'] },
      { at: 1, ch: 'structure', line: 'a skull under dried skin, the sockets empty' },
    ],
  },
});

export function ancestryIds(custom = {}) { return [...HUMAN_IDS, ...Object.keys(LINEAGES), ...Object.keys(custom)]; }

const HEX = /^#[0-9a-f]{6}$/i;
export const PLAN_HINTS = Object.freeze(['tail', 'claws', 'cover']);

/** Validate a lineage (a built one or a custom one): throws naming the field. */
export function readLineage(id, lin) {
  const at = `egocube: lineage '${id}'`;
  if (!lin || typeof lin !== 'object') throw new Error(`${at} is an object`);
  if (typeof lin.reads !== 'string') throw new Error(`${at}: reads is a line`);
  const [lo, hi] = lin.humanity || [];
  if (!(lo >= 0 && hi <= 1 && lo <= hi)) throw new Error(`${at}: humanity is [lo, hi] within 0 … 1`);
  if (!lin.skin === !lin.cover) throw new Error(`${at}: give skin (an MST span [a, b]) or cover (swatches by word), not both`);
  if (lin.skin && !(lin.skin[0] >= 1 && lin.skin[1] <= 10 && lin.skin[0] <= lin.skin[1])) throw new Error(`${at}: skin is an MST span within 1 … 10`);
  if (lin.cover) for (const [w, hex] of Object.entries(lin.cover)) if (!HEX.test(hex)) throw new Error(`${at}: cover '${w}' is a #rrggbb colour`);
  for (const b of lin.builds || []) if (!BUILDS[b]) throw new Error(`${at}: unknown build '${b}' (known: ${Object.keys(BUILDS).join(', ')})`);
  if (lin.form !== undefined && !UNDEAD_FORMS[lin.form]) throw new Error(`${at}: unknown form '${lin.form}' (known: ${Object.keys(UNDEAD_FORMS).join(', ')})`);
  if (lin.layers !== undefined) { if (!lin.form) throw new Error(`${at}: layers lie over a form; give form too`); for (const l of lin.layers) if (!UNDEAD_LAYERS[l]) throw new Error(`${at}: unknown layer '${l}' (known: ${Object.keys(UNDEAD_LAYERS).join(', ')})`); }
  if (!Array.isArray(lin.cues) || !lin.cues.length) throw new Error(`${at}: cues is a list`);
  for (const c of lin.cues) {
    if (!CHANNEL_IDS.includes(c.ch)) throw new Error(`${at}: unknown channel '${c.ch}' (known: ${CHANNEL_IDS.join(', ')})`);
    if (!(c.at >= 0 && c.at <= 1)) throw new Error(`${at}: a cue's at is 0 … 1`);
    if (c.line.includes('{pick}') !== Array.isArray(c.pick)) throw new Error(`${at}: '{pick}' and a pick list go together ('${c.line}')`);
    for (const d of c.derives || []) readDerive(d);
    if (c.plan) for (const k of Object.keys(c.plan)) if (!PLAN_HINTS.includes(k)) throw new Error(`${at}: a cue's plan takes ${PLAN_HINTS.join(', ')} (got '${k}')`);
  }
  return lin;
}

const choose = (rand, list) => list[Math.floor(rand() * list.length)];

/**
 * Read an ancestry for one roll: { kind, reads, humanity?, door, colours, notes, derives, gaps }. `rand` is the
 * ancestry's own stream, so the archetype or the role never moves a tone. `h` is the rolled humanity (lineages only).
 */
export function resolveAncestry(id, rand, h, custom = {}) {
  const human = HUMAN_ANCESTRIES[id];
  if (human) {
    const tone = human.tones[0] + Math.floor(rand() * (human.tones[1] - human.tones[0] + 1));
    const undertone = choose(rand, human.undertones), texture = choose(rand, human.textures);
    const hair = choose(rand, human.hair), eyes = choose(rand, human.eyes);
    const tex = HAIR_TEXTURES[texture];
    return {
      kind: 'human', reads: human.reads, door: 'hero',
      colours: { Skin: MST[tone - 1], Hair: HAIR_COLOURS[hair], eyes },
      notes: {
        colouring: [`skin MST ${tone} (${MST[tone - 1]}), ${undertone} undertone; ${hair} hair; ${eyes} eyes`],
        hair: [`${texture} hair`],
        ...Object.fromEntries(Object.entries(human.notes || {}).map(([ch, l]) => [ch, [l]])),
      },
      derives: { hair: tex.derives, ...(human.derives || {}) },
      gaps: tex.gap ? [tex.gap] : [],
    };
  }
  const lin = custom[id] || LINEAGES[id];
  const notes = {}, derives = {};
  let door = h < DOOR_H ? 'creature' : 'hero';
  const colours = {};
  if (lin.skin) {
    const tone = lin.skin[0] + Math.floor(rand() * (lin.skin[1] - lin.skin[0] + 1));
    colours.Skin = MST[tone - 1];
    (notes.colouring ||= []).push(`skin MST ${tone} (${MST[tone - 1]})`);
  } else {
    const word = choose(rand, Object.keys(lin.cover));
    colours.Skin = lin.cover[word];
    (notes.colouring ||= []).push(`${word} (${lin.cover[word]}), a paler underside`);
  }
  const planHints = {};
  const deepest = {};
  for (const c of lin.cues) if (c.slot && h <= c.at && !(deepest[c.slot]?.at <= c.at)) deepest[c.slot] = c;
  for (const c of lin.cues) {
    const picked = c.pick ? choose(rand, c.pick) : null;   // every pick throws, shown or not: h never moves a later pick
    if (h > c.at || (c.slot && deepest[c.slot] !== c)) continue;
    (notes[c.ch] ||= []).push(picked ? c.line.replace('{pick}', picked) : c.line);
    if (c.plan) for (const [k, v] of Object.entries(c.plan)) planHints[k] = k === 'cover' && planHints.cover ? { kind: v.kind, where: [...new Set([...planHints.cover.where, ...v.where])] } : v;
    for (const d of c.derives || []) {
      if (d === 'door = creature') { door = 'creature'; continue; }
      (derives[c.ch] ||= []).push(d);
    }
  }
  const gaps = door === 'hero' && lin.cues.some((c) => h <= c.at && /ornament|cover/.test(c.ch))
    ? [`${lin.reads} on the hero door: ${lin.built}`] : [];
  // (a form, the undead's: the body is its library's, so the creature door whatever the roll)
  // (a form stands on the tiered hero body where it is ported there, lib/graph/undead/tiered.js; else the creature loop's)
  if (lin.form) door = TIERED_UNDEAD(lin) ? 'hero' : 'creature';
  return { kind: 'lineage', reads: `${lin.reads}, humanity ${h}`, humanity: h, door, colours, notes, derives, gaps, plan: planHints, ...(lin.form ? { form: lin.form } : {}), ...(lin.layers?.length ? { layers: [...lin.layers] } : {}) };
}
