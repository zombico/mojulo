/**
 * STARTER SPECIES: `xenoSpecies`, a non-human the agent starts from: a skull and the appliances on it (the xeno make-up's
 * cards and words, ./index.js), the skin's colour, its EYES and its BUILD in each head's own words (`heads`), and what
 * else reads it (`also`: markings, dress, stance: said, not set). Named for what the creature is, never a franchise;
 * `like` names the screen alien it recalls, for the character protocol's X-like stamp.
 *
 * `heads` (SPECIES_HEADS) per head the hero wears:
 *   landmark   face: { eyeSize, eyeSpacing, … } (humanoid-head.js FACE), tune: a move or { shoulders, … }
 *   anime      face: { eyeWidth, eyeHeight, iris, spacing, tilt, … } (anime-head.js ANIME_FACE), body: slim | base | hulking
 *              (the anime body's codename for the hero's sex: anime-bodies.js)
 *   realistic  face: { want: { eyes: open | large | almond | deep | hooded | soft }, character? }, physique
 * and `eyes: { sclera?, iris?, pupil? }` its eyes' colours on any head (the palette's Sclera, Iris and Pupil).
 *
 *   xenoSpecies: '<species>'
 *
 * It lowers into the hero's own words (speciesWorn, read by xenoWorn wherever the hero is built): its appliances ahead of
 * the hero's own `xenoHeaddress` (a skull the hero names takes the species' skull's place), and its skin's colour where
 * the hero names none (the palette's Skin; the realistic skin's `skin.tone`), and its eyes and build under the hero's own:
 * a face the hero gives is laid after the species' (a list: its keys over the species'), a build the hero gives (`tune`,
 * `animeBody`, `physique`) in its place. The person's words always win, and each of the species' is theirs to change: the
 * readout says what it gave.
 */

const ANTENNAE = Object.freeze({ family: 'horn', at: Object.freeze({ az: 14, el: 70 }), pair: true, length: 0.2, width: 0.012, tip: 0.003, lift: 0.95, sweep: 35, spread: 22 });
const crown = (az, el, length) => Object.freeze({ family: 'horn', at: Object.freeze({ az, el }), pair: true, length, width: 0.024, tip: 0.004, lift: 0.7, sweep: 25, spread: 5 });

export const XENO_SPECIES = Object.freeze({
  'grey-visitor': Object.freeze({
    reads: 'a slight grey visitor with a swollen tall cranium',
    like: 'the big-headed grey visitors of 70s–90s abduction films',
    headdress: Object.freeze(['tall-cranium', 'no-ears']), skin: '#9ea7aa',
    eyes: Object.freeze({ sclera: '#111114', iris: '#111114', pupil: '#000000' }),
    heads: Object.freeze({
      landmark: { face: { eyeSize: 1.2, eyeSpacing: 1.1, noseSize: 0.85, mouthWidth: 0.8, jawWidth: 0.85 }, tune: { shoulders: 0.9, stature: 0.95 } },
      anime: { face: { eyeWidth: 1.1, eyeHeight: 1.12, iris: 1.1, nose: 0.6, chin: 0.8 }, body: 'slim' },
      realistic: { face: { want: { eyes: 'large' } }, physique: 'skinny' },
    }),
    also: 'a plain close-fitting suit',
  }),
  'ridged-warrior': Object.freeze({
    reads: 'a heavy warrior with a keeled skull and ridges up the forehead',
    like: 'a warrior race of 90s TV sci-fi with ridged foreheads',
    headdress: Object.freeze(['keeled-skull', 'forehead-ridges']), skin: '#8c5b45',
    eyes: Object.freeze({ sclera: '#eadcbc', iris: '#5a3a1e', pupil: '#0b0b0b' }),
    heads: Object.freeze({
      landmark: { face: { browRidge: 1.15, jawWidth: 1.15, eyeSize: 0.92 }, tune: 'athletic' },
      anime: { face: { eyeHeight: 0.88, tilt: 0.05, jaw: 1.1 }, body: 'hulking' },
      realistic: { face: { want: { eyes: 'deep' }, character: [0.6, 0.8] }, physique: 'jacked' },
    }),
    also: 'long dark hair is the hero\'s own to add back (the skull lays a bald cap); armour, a sash',
  }),
  'ridge-nosed': Object.freeze({
    reads: 'a person in all but the fine ridges across the bridge of the nose',
    like: 'a spiritual people of 90s TV sci-fi',
    headdress: Object.freeze(['nose-ridges']), skin: null,
    also: 'the hero\'s own skin and hair; an earring on one ear',
  }),
  'lekku-dancer': Object.freeze({
    reads: 'a dancer with two thick head-tails down the back over a bald cap',
    like: 'the head-tailed dancers of 70s–80s space-opera cinema',
    headdress: Object.freeze(['head-tails']), skin: '#5f9e8c',
    eyes: Object.freeze({ iris: '#b8742a' }),
    heads: Object.freeze({
      landmark: { face: { eyeSize: 1.05 }, tune: 'long-legs' },
      anime: { face: { tilt: 0.04, eyeWidth: 1.04 }, body: 'slim' },
      realistic: { face: { want: { eyes: 'almond' } }, physique: 'athletic' },
    }),
    also: 'a headband or a wrap over the cap, a dancer\'s dress',
  }),
  'montral-hunter': Object.freeze({
    reads: 'a hunter with banded hollow horns and head-tails falling over the shoulders and down the back',
    like: 'the horned, head-tailed predator race of 2000s space-opera animation',
    headdress: Object.freeze(['horned-tails', 'pale-mask']), skin: '#c0533a',
    eyes: Object.freeze({ iris: '#3d7fa8' }),
    heads: Object.freeze({
      landmark: { face: { eyeSize: 1.05, cheekbone: 1.1 }, tune: 'athletic' },
      anime: { face: { tilt: 0.06, eyeHeight: 0.94 }, body: 'slim' },
      realistic: { face: { want: { eyes: 'almond' } }, physique: 'athletic' },
    }),
    also: 'a hunter\'s gear, a lithe stance',
  }),
  'crested-diplomat': Object.freeze({
    reads: 'a poised humanoid whose scalp is a crest of two plated lobes falling to the shoulders, with ridges down the cheeks',
    like: 'the crested, blue-skinned all-female race of 2000s space-opera games',
    headdress: Object.freeze(['chitin-crest', 'cheek-ridges', Object.freeze({ card: 'brow-chevrons', coat: Object.freeze({ color: '#e9eefa' }) })]), skin: '#7f9fc4',
    eyes: Object.freeze({ sclera: '#f2f4ff', iris: '#3b4f8a' }),
    heads: Object.freeze({
      landmark: { face: { eyeSize: 1.06 } },
      anime: { face: { eyeHeight: 1.04, iris: 1.03 }, body: 'base' },
      realistic: { face: { want: { eyes: 'open' } }, physique: 'athletic' },
    }),
    also: 'a poised stance, a long fitted dress or armour',
  }),
  'plated-insectoid': Object.freeze({
    reads: 'an insectoid with a banded skull, fine antennae and ridges down the cheeks, its plates hard',
    like: 'the insectoid aliens of 90s sci-fi',
    headdress: Object.freeze([{ card: 'segmented-skull', coat: Object.freeze({ color: 'Skin', cover: 'chitin' }) }, ANTENNAE, 'cheek-ridges', 'no-ears', 'eye-cluster', 'slit-nostrils']), skin: '#77874a',
    eyes: Object.freeze({ sclera: '#2a2f12', iris: '#c9a227', pupil: '#0a0a00' }),
    heads: Object.freeze({
      landmark: { face: { eyeSize: 0.88, eyeSpacing: 1.12, jawWidth: 0.85, chinProjection: 0.9 }, tune: { shoulders: 0.92 } },
      anime: { face: { eyeWidth: 0.86, eyeHeight: 0.82, iris: 0.8, spacing: 1.08, jaw: 0.8 }, body: 'slim' },
      realistic: { face: { want: { eyes: 'deep' } }, physique: 'skinny' },
    }),
    also: 'a hard, plated suit; mandibles are not made yet',
  }),
  'cone-elder': Object.freeze({
    reads: 'a mild elder whose skull rises to a cone',
    like: 'the cone-headed visitors of 70s sketch comedy',
    headdress: Object.freeze(['cone-skull']), skin: null,
    also: 'the hero\'s own skin; a plain, formal outfit',
  }),
  'brain-invader': Object.freeze({
    reads: 'an invader with a swollen two-lobed brain for a skull',
    like: 'the big-brained invaders of 50s B-movies',
    headdress: Object.freeze(['bilobed-brain', 'no-ears']), skin: '#a9c98f',
    eyes: Object.freeze({ sclera: '#fbfbf2', iris: '#a01818', pupil: '#000000' }),
    heads: Object.freeze({
      landmark: { face: { eyeSize: 1.2, mouthWidth: 0.8 }, tune: { stature: 0.92 } },
      anime: { face: { eyeWidth: 1.1, eyeHeight: 1.12, iris: 0.8 }, body: 'slim' },
      realistic: { face: { want: { eyes: 'open' } }, physique: 'skinny' },
    }),
    also: 'a lipless grin (the expression), a glass helmet is not made yet',
  }),
  'domed-telepath': Object.freeze({
    reads: 'a pale telepath with a high domed forehead and fine ridges down the cheeks',
    like: 'the domed-browed telepaths of 60s TV sci-fi',
    headdress: Object.freeze(['domed-brow', 'cheek-ridges', 'forehead-mark']), skin: '#e2cfc6',
    eyes: Object.freeze({ sclera: '#f4efe9', iris: '#c8d6e0', pupil: '#3a4a58' }),
    heads: Object.freeze({
      landmark: { face: { eyeSize: 0.95 } },
      anime: { face: { eyeHeight: 0.9, tilt: -0.03 }, body: 'slim' },
      realistic: { face: { want: { eyes: 'hooded' } }, physique: 'skinny' },
    }),
    also: 'a long robe, a calm expression',
  }),
  'horn-crowned': Object.freeze({
    reads: 'a warrior with a crown of short horns round the top of a bald cap',
    like: 'the horn-crowned warriors of 90s–2000s space-opera cinema',
    headdress: Object.freeze([{ card: 'domed-brow', size: 0.5 }, crown(14, 64, 0.05), crown(42, 54, 0.045), crown(70, 42, 0.04), crown(98, 30, 0.035), 'tribal-lines']), skin: '#b8452f',
    eyes: Object.freeze({ sclera: '#efd65a', iris: '#c04010', pupil: '#000000' }),
    heads: Object.freeze({
      landmark: { face: { browRidge: 1.1, jawWidth: 1.1 }, tune: 'athletic' },
      anime: { face: { tilt: 0.07, eyeHeight: 0.88 }, body: 'base' },
      realistic: { face: { want: { eyes: 'deep' } }, physique: 'athletic' },
    }),
    also: 'a warrior\'s robes, a double-bladed weapon',
  }),
  'pointed-eared': Object.freeze({
    reads: 'a composed humanoid with pointed ears and upswept brows',
    like: 'the pointed-eared logicians of 60s TV sci-fi',
    headdress: Object.freeze(['pointed-ears']), skin: null,
    heads: Object.freeze({
      landmark: { face: { browHeight: 1.08 } },
      anime: { face: { tilt: 0.04 } },
      realistic: { face: { character: [0.4, 0.2] } },
    }),
    also: 'a straight-cut fringe, a calm expression, a uniform',
  }),
  'tusked-brute': Object.freeze({
    reads: 'a heavy brute with wide temples, tusks from the lower jaw and pointed ears',
    like: 'the tusked brutes of fantasy and 80s space opera',
    headdress: Object.freeze(['wide-temples', 'tusks', 'pointed-ears']), skin: '#6f8a4e',
    eyes: Object.freeze({ sclera: '#e9dfb8', iris: '#b5761f', pupil: '#0b0b0b' }),
    heads: Object.freeze({
      landmark: { face: { jawWidth: 1.2, browRidge: 1.15, eyeSize: 0.9 }, tune: { shoulders: 1.1 } },
      anime: { face: { jaw: 1.15, eyeHeight: 0.86, tilt: 0.05 }, body: 'hulking' },
      realistic: { face: { want: { eyes: 'deep' }, character: [0.7, 0.9] }, physique: 'heavyset' },
    }),
    also: 'crude armour and furs, a heavy weapon',
  }),
  'three-eyed-seer': Object.freeze({
    reads: 'a pale, slight seer with a domed brow and a third eye in the middle of the forehead, spots down the temples',
    like: 'the three-eyed seers of 70s–80s sci-fi and myth',
    headdress: Object.freeze([{ card: 'domed-brow', size: 0.6 }, 'third-eye', 'spot-trails']), skin: '#c9b6d6',
    eyes: Object.freeze({ iris: '#8a4fb0' }),
    heads: Object.freeze({
      landmark: { face: { eyeSize: 0.95 } },
      anime: { face: { eyeHeight: 0.9, tilt: -0.02 }, body: 'slim' },
      realistic: { face: { want: { eyes: 'hooded' } }, physique: 'skinny' },
    }),
    also: 'a long robe, a calm expression',
  }),
  'snouted-guard': Object.freeze({
    reads: 'a heavy guard with a broad snout, tusks and long lobes',
    like: 'the pig-snouted guards of 80s space-opera cinema',
    headdress: Object.freeze(['snout', 'tusks', 'lobe-drops']), skin: '#7d8a54',
    eyes: Object.freeze({ iris: '#3a2a1a' }),
    heads: Object.freeze({
      landmark: { face: { jawWidth: 1.2, eyeSize: 0.88 }, tune: { shoulders: 1.12 } },
      anime: { face: { jaw: 1.15, eyeHeight: 0.84, iris: 0.85 }, body: 'hulking' },
      realistic: { face: { want: { eyes: 'deep' }, character: [0.6, 0.9] }, physique: 'heavyset' },
    }),
    also: 'crude armour, an axe',
  }),
  'beaked-avian': Object.freeze({
    reads: 'a bird-person with a hooked beak, a keeled skull and no outer ears',
    like: 'the beaked bird-people of 80s space-opera cinema and comics',
    headdress: Object.freeze([{ card: 'keeled-skull', size: 0.8 }, 'beak', 'no-ears']), skin: '#d6c2a0',
    eyes: Object.freeze({ sclera: '#e8b020', iris: '#e8b020', pupil: '#000000' }),
    heads: Object.freeze({
      landmark: { face: { eyeSize: 1.1, eyeSpacing: 1.1 }, tune: { shoulders: 0.94 } },
      anime: { face: { eyeWidth: 0.95, eyeHeight: 1.02, iris: 1.08, spacing: 1.06 }, body: 'slim' },
      realistic: { face: { want: { eyes: 'open' } }, physique: 'skinny' },
    }),
    also: 'feathered cloaks or a crest (the anime head\'s feathered hair, or a lobe written whole), a sharp stance',
  }),
});
export const XENO_SPECIES_IDS = Object.freeze(Object.keys(XENO_SPECIES));

/** Error strings for a hero's `xenoSpecies` (empty = valid) */
export function validateXenoSpecies(v, at = 'xenoSpecies') {
  if (v === undefined || v === null) return [];
  return XENO_SPECIES[v] ? [] : [`${at}: a starter species (${XENO_SPECIES_IDS.join(', ')})`];
}

/** The appliance list a hero wears with its species: the species' ahead of the hero's own, a skull the hero names in
 * place of the species' (`isSkull(entry)` says which entry is one). No species: the hero's own list. */
export function speciesHeaddress(hero, isSkull) {
  const S = XENO_SPECIES[hero?.xenoSpecies], own = Array.isArray(hero?.xenoHeaddress) ? hero.xenoHeaddress : [];
  if (!S) return own;
  const ownSkull = own.some(isSkull);
  return [...S.headdress.filter((e) => !(ownSkull && isSkull(e))), ...own];
}

/** The hero as its species makes it: its appliances (speciesHeaddress) and its skin's colour where the hero names none.
 * No species: the hero as given. */
export function speciesWorn(hero, isSkull) {
  const S = XENO_SPECIES[hero?.xenoSpecies];
  if (!S) return hero;
  // (the word lowered and dropped, so wearing the hero twice gives the same hero)
  const { xenoSpecies: _s, ...rest } = hero, out = { ...rest, xenoHeaddress: speciesHeaddress(hero, isSkull) };
  const own = hero.palette?.Skin || (hero.skin && typeof hero.skin === 'object' && hero.skin.tone);
  if (S.skin && !own) {
    if (hero.form === 'realistic') out.skin = { ...(hero.skin && typeof hero.skin === 'object' ? hero.skin : {}), tone: S.skin };
    else out.palette = { ...(hero.palette || {}), Skin: S.skin };
  }
  // its EYES' colours, each where the hero names none (the palette's Sclera, Iris and Pupil: every head paints its eyes so)
  const eyes = Object.entries(S.eyes || {}).filter(([k]) => !hero.palette?.[EYE_GROUP[k]]);
  if (eyes.length) out.palette = { ...(out.palette || hero.palette || {}), ...Object.fromEntries(eyes.map(([k, v]) => [EYE_GROUP[k], v])) };
  return { ...out, ...speciesHeadWords(hero, S) };
}

/** an eye colour's palette group */
const EYE_GROUP = Object.freeze({ sclera: 'Sclera', iris: 'Iris', pupil: 'Pupil' });
/** which of a species' heads the hero wears: 'landmark' | 'anime' | 'realistic', or null (a blank trunk, an include) */
export const speciesHeadOf = (hero) => (hero?.form === 'realistic' ? 'realistic' : hero?.head === 'anime' ? 'anime' : hero?.head === undefined || hero?.head === 'landmark' ? 'landmark' : null);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** the anime body a build kind names, for the hero's sex (anime-bodies.js codenames) */
const ANIME_BUILD = Object.freeze({ slim: { female: 'maki', male: 'satoru' }, base: { female: 'mizuki', male: 'toji' }, hulking: { female: 'kale', male: 'armstrong' } });
const femaleOf = (hero) => hero?.cast === 'female' || hero?.cast?.pole === 'female';

/** The words a species' head sets on the hero, under the hero's own: its face laid first (the hero's after it, so its keys
 * win; the realistic face's words merged, the hero's over the species'), its build where the hero names none. */
export function speciesHeadWords(hero, S) {
  const head = speciesHeadOf(hero), W = head ? S?.heads?.[head] : null;
  if (!W) return {};
  const out = {};
  if (W.face) {
    if (head === 'realistic') {
      const own = isObj(hero.face) ? hero.face : {};
      out.face = { ...W.face, ...own, ...(W.face.want || own.want ? { want: { ...(W.face.want || {}), ...(own.want || {}) } } : {}) };
    } else out.face = hero.face === undefined || hero.face === null ? W.face : [W.face, ...(Array.isArray(hero.face) ? hero.face : [hero.face])];
  }
  if (head === 'landmark' && W.tune !== undefined && hero.tune === undefined) out.tune = W.tune;
  if (head === 'anime' && W.body && hero.animeBody === undefined) out.animeBody = ANIME_BUILD[W.body][femaleOf(hero) ? 'female' : 'male'];
  if (head === 'realistic' && W.physique && hero.physique === undefined) out.physique = W.physique;
  return out;
}

/** What the species gave: its name, what it reads as and recalls, its skin, and what else reads it. */
export function speciesReadout(hero) {
  const S = XENO_SPECIES[hero?.xenoSpecies]; if (!S) return null;
  const head = speciesHeadOf(hero), set = speciesHeadWords(hero, S);
  // (what it set on this head, the hero's own words left out: the face the species laid, the build it chose)
  const gave = { ...(S.heads?.[head]?.face ? { face: S.heads[head].face } : {}), ...(set.tune !== undefined ? { tune: set.tune } : {}), ...(set.animeBody ? { animeBody: set.animeBody } : {}), ...(set.physique ? { physique: set.physique } : {}) };
  return { species: hero.xenoSpecies, reads: S.reads, like: S.like, ...(S.skin ? { skin: S.skin } : {}), ...(S.eyes ? { eyes: S.eyes } : {}), ...(head && Object.keys(gave).length ? { [head]: gave } : {}), also: S.also };
}
