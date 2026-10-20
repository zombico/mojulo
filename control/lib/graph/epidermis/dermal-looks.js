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
 *
 *   readAncestry({ id, sex, seed })  a person of one of the egocube's human ancestries (egocube/ancestry.js
 *                   HUMAN_ANCESTRIES), rolled inside its ranges as the egocube rolls: the tone, the undertone, the hair's
 *                   colour and texture (straight, wavy, curly, coily → the scalp's types, a style that suits the texture),
 *                   and its eye note through its own derive (`sculpt.lidCover +`: the lid's cover, rolled among the
 *                   `EYE_SHAPES` — an in-fold, a monolid, a parallel crease, a hooded lid — never a slant; `eyeShape`
 *                   names one). The face's structure stays the individual's: an ancestry is never drawn
 *                   as a caricature of itself.
 */
import { HUMAN_ANCESTRIES } from '../egocube/ancestry.js';
import { streamOf } from '../city/plan/dice.js';

/** the head's relations as a game's creator carves them: crisper planes and stronger bone (head-relational.js RELATIONS) */
export const GAME_FACE = Object.freeze({
  male: Object.freeze({ skinWave: 0.024, brow: 1.25, browProjection: 0.041, malarDepth: 0.037, jaw: 0.78, chin: 0.008, fissure: 0.032, nasionDepth: 0.03 }),
  female: Object.freeze({ skinWave: 0.026, brow: 1.05, malarDepth: 0.037, jaw: 0.74, fissure: 0.035, nasionDepth: 0.028 }),
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

/**
 * The eye's COVER shapes, as the relational eye rig's channels (head-relational-eye.js): the upper lid's crease (its
 * depth, height and course), the fold over it, the epicanthic fold over the inner corner, the lid's fullness and its
 * cover of the iris. Words, never a slant: the canthi stay where the face's relations put them.
 */
export const EYE_SHAPES = Object.freeze({
  monolid: { note: 'no crease: the fold rests on the lashes, a full lid, the inner corner covered', crease: 0, hood: 1, creaseHeight: 0.55, epicanthus: 0.75, fullness: 0.6, open: 0.86 },
  'inner-fold': { note: 'a low crease tapering into the inner corner (an in-fold double lid), the corner partly covered', crease: 0.45, hood: 0.45, creaseHeight: 0.6, creaseShape: 1, epicanthus: 0.5, fullness: 0.35, open: 0.92 },
  parallel: { note: 'a low crease running parallel to the lashes to the inner corner, outside a slight fold', crease: 0.55, hood: 0.25, creaseHeight: 0.72, creaseShape: -0.8, epicanthus: 0.2, fullness: 0.25 },
  hooded: { note: 'a crease the fold hangs over, a full lid', crease: 0.3, hood: 0.92, creaseHeight: 0.8, epicanthus: 0.3, fullness: 0.45, open: 0.9 },
});
/** the egocube's derives read on the relational eye: `sculpt.lidCover +` names the lid's cover, and the person rolls which
 * of the cover shapes theirs is (the in-fold the likeliest) */
const EYE_DERIVES = Object.freeze({ 'sculpt.lidCover +': ['inner-fold', 'inner-fold', 'monolid', 'parallel', 'hooded'] });
/** the styles a texture wears, by sex (the seed picks among them) */
const TEXTURE_STYLES = Object.freeze({
  straight: { male: [{ style: 'short' }, { style: 'undercut' }], female: [{ style: 'long' }, { style: 'bob' }, { style: 'shoulder' }] },
  wavy: { male: [{ style: 'short', type: 'wavy' }], female: [{ style: 'shoulder', type: 'wavy' }, { style: 'layers', type: 'wavy' }] },
  curly: { male: [{ style: 'twa', type: 'curly' }, { style: 'short', type: 'curly', stand: 0.3 }], female: [{ style: 'curls' }, { style: 'afro', type: 'curly' }] },
  coily: { male: [{ style: 'twa' }, { style: 'afro' }], female: [{ style: 'afro' }, { style: 'twa' }] },
});

/** A person of an egocube ancestry, rolled inside its ranges: { sex, relations, eyes, dermis, scalp, epidermis, rolled }. */
export function readAncestry({ id, sex = 'male', seed = 1, game = false, eyeShape = null } = {}) {
  const A = HUMAN_ANCESTRIES[id];
  if (!A) throw new Error(`ancestry: unknown '${id}' (have ${Object.keys(HUMAN_ANCESTRIES).join(', ')})`);
  const d = streamOf(seed, 'dermal-ancestry', `${id}/${sex}`), pick = (list) => list[Math.floor(d() * list.length) % list.length];
  const tone = A.tones[0] + Math.floor(d() * (A.tones[1] - A.tones[0] + 1)), undertone = pick(A.undertones), texture = pick(A.textures), hair = pick(A.hair);
  if (eyeShape && !EYE_SHAPES[eyeShape]) throw new Error(`ancestry: eyeShape '${eyeShape}' (have ${Object.keys(EYE_SHAPES).join(', ')})`);
  const shapes = (A.derives?.eyes || []).flatMap((k) => EYE_DERIVES[k] || []), shape = eyeShape || (shapes.length ? pick(shapes) : null);
  const { note: _n, ...eyes } = shape ? EYE_SHAPES[shape] : {};
  const scalp = { ...pick(TEXTURE_STYLES[texture]?.[sex] || TEXTURE_STYLES.straight[sex]), seed };
  return {
    sex, relations: game ? { ...GAME_FACE[sex] } : {}, eyes,
    dermis: { from: sex, tone, undertone, hairColour: hair, freckles: tone <= 2 ? Math.round(d() * 50) / 100 : 0, seed },
    scalp, epidermis: { hair: { colour: hair } },
    rolled: { ancestry: A.reads, tone, undertone, texture, hair, eyes: shape, eyeNote: shape ? EYE_SHAPES[shape].note : null },
  };
}
