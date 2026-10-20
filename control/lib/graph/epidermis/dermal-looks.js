/**
 * CREATOR LOOKS — the realistic register stylized the way a game's character creator draws a head (a fantasy RPG's
 * slider set): the relational head's relations pushed toward crisp, angular planes (`GAME_FACE`: a firmer skin wave, a
 * heavier brow ridge, cheekbones forward, a squarer jaw, deeper-set eyes), and the dermal texturizer's sliders set as a
 * creator's presets set them (the face's lines, the dirt, war paint, freckles, a beard's length, the brows' weight) with a
 * groom (a cut, its moves, the hair gathered into pieces as cards read). A look is DATA: four documents the existing
 * readers take (`relationalHead`'s relations, `readDermis`, `readScalp`, `readEpidermis`), nothing of its own built.
 *
 *   readLook(spec)  a look's name, or { from, sex?, relations?, dermis?, scalp?, epidermis? } (each merged over the
 *                   look's) → { sex, relations, dermis, scalp, epidermis }
 *
 * Archetypes, never peoples: a look names a role in a story (a warrior, a scholar), and every skin tone, hair texture and
 * colour is a dial any look takes.
 */

/** the head's relations as a game's creator carves them: crisper planes and stronger bone (head-relational.js RELATIONS) */
export const GAME_FACE = Object.freeze({
  male: Object.freeze({ skinWave: 0.024, brow: 1.25, browProjection: 0.041, malarDepth: 0.037, jaw: 0.78, chin: 0.008, fissure: 0.041, nasionDepth: 0.03 }),
  female: Object.freeze({ skinWave: 0.026, brow: 1.05, malarDepth: 0.037, jaw: 0.74, fissure: 0.042, nasionDepth: 0.028 }),
});

export const LOOKS = Object.freeze({
  warrior: {
    note: 'a weathered fighter: heavy brow, war paint across the eyes, road grime, a short beard, an undercut in pieces',
    sex: 'male', relations: { jaw: 0.8, brow: 1.35 },
    dermis: { tone: 3, age: 0.55, lines: 0.75, dirt: 0.5, flush: 1.25, stubble: 5, paint: { pattern: 'eyes', colour: 'woad', amount: 0.85 } },
    scalp: { style: 'undercut', moves: ['chunky'] }, epidermis: { hair: { brows: { shape: 'thick' } } },
  },
  shieldmaiden: {
    note: 'freckled and windburned, claw stripes of soot down one cheek, long wavy hair in pieces',
    sex: 'female', relations: {},
    dermis: { tone: 2, freckles: 0.7, lines: 0.25, dirt: 0.3, flush: 1.3, paint: { pattern: 'stripes', colour: 'soot', amount: 0.8 } },
    scalp: { style: 'long', type: 'wavy', moves: ['chunky'] }, epidermis: { hair: { brows: { shape: 'natural' } } },
  },
  scholar: {
    note: 'an older reader: deep lines, a clean short cut combed sleek, a grey stubble',
    sex: 'male', relations: { jaw: 0.74 },
    dermis: { tone: 5, age: 0.8, lines: 0.95, stubble: 2, hairColour: '#7d7368' },
    scalp: { style: 'short', moves: ['sleek'] }, epidermis: { hair: { colour: '#7d7368' } },
  },
  rogue: {
    note: 'a soot mask over the eyes and down the nose, a side-swept bob in pieces',
    sex: 'female', relations: { jaw: 0.72 },
    dermis: { tone: 7, lines: 0.2, dirt: 0.2, paint: { pattern: 'mask', colour: 'soot', amount: 0.7 } },
    scalp: { style: 'bob', moves: ['chunky', 'swept-bangs'] }, epidermis: { hair: { brows: { shape: 'arched' } } },
  },
  elder: {
    note: 'white-haired and deeply lined, a long beard, the hair long and loose',
    sex: 'male', relations: { brow: 1.3 },
    dermis: { tone: 2, age: 1, lines: 1, stubble: 14, hairColour: '#c9c4bb', flush: 1.2 },
    scalp: { style: 'shoulder', moves: ['messy', 'chunky'] }, epidermis: { hair: { colour: '#c9c4bb', brows: { shape: 'thick' } } },
  },
});

/** A look: a name, or { from, …documents merged over the look's }. */
export function readLook(spec) {
  const doc = typeof spec === 'string' ? { from: spec } : spec || {};
  const L = LOOKS[doc.from];
  if (!L) throw new Error(`look: unknown look '${doc.from}' (have ${Object.keys(LOOKS).join(', ')})`);
  const sex = doc.sex || L.sex;
  const merge = (a = {}, b = {}) => ({ ...a, ...b });
  return {
    sex,
    relations: { ...GAME_FACE[sex], ...L.relations, ...(doc.relations || {}) },
    dermis: { from: sex, ...merge(L.dermis, doc.dermis) },
    scalp: merge(L.scalp, doc.scalp),
    epidermis: { hair: merge(L.epidermis?.hair, doc.epidermis?.hair), ...(doc.epidermis?.skin ? { skin: doc.epidermis.skin } : {}) },
  };
}
