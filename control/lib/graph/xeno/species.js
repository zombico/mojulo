/**
 * STARTER SPECIES: `xenoSpecies`, a non-human the agent starts from: a skull and the appliances on it (the xeno make-up's
 * cards and words, ./index.js), the skin's colour, and what else reads it (`also`: the eyes, the build, the voice: words
 * the hero door already has, said, not set). Named for what the creature is, never a franchise; `like` names the screen
 * alien it recalls, for the character protocol's X-like stamp.
 *
 *   xenoSpecies: '<species>'
 *
 * It lowers into the hero's own words (speciesWorn, read by xenoWorn wherever the hero is built): its appliances ahead of
 * the hero's own `xenoHeaddress` (a skull the hero names takes the species' skull's place), and its skin's colour where
 * the hero names none (the palette's Skin; the realistic skin's `skin.tone`). The person's words always win, and each of
 * the species' is theirs to change: the readout says what it gave.
 */

const ANTENNAE = Object.freeze({ family: 'horn', at: Object.freeze({ az: 14, el: 70 }), pair: true, length: 0.2, width: 0.012, tip: 0.003, lift: 0.95, sweep: 35, spread: 22 });
const crown = (az, el, length) => Object.freeze({ family: 'horn', at: Object.freeze({ az, el }), pair: true, length, width: 0.024, tip: 0.004, lift: 0.7, sweep: 25, spread: 5 });

export const XENO_SPECIES = Object.freeze({
  'grey-visitor': Object.freeze({
    reads: 'a slight grey visitor with a swollen tall cranium',
    like: 'the big-headed grey visitors of 70s–90s abduction films',
    headdress: Object.freeze(['tall-cranium']), skin: '#9ea7aa',
    also: 'large dark eyes and a small mouth (the face\'s eye and mouth words), a slight build',
  }),
  'ridged-warrior': Object.freeze({
    reads: 'a heavy warrior with a keeled skull and ridges up the forehead',
    like: 'a warrior race of 90s TV sci-fi with ridged foreheads',
    headdress: Object.freeze(['keeled-skull', 'forehead-ridges']), skin: '#8c5b45',
    also: 'a heavy brow and a broad build; long dark hair is the hero\'s own to add back (the skull lays a bald cap)',
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
    also: 'a lithe build; a headband or a wrap over the cap',
  }),
  'montral-hunter': Object.freeze({
    reads: 'a hunter with banded hollow horns and head-tails falling over the shoulders and down the back',
    like: 'the horned, head-tailed predator race of 2000s space-opera animation',
    headdress: Object.freeze(['horned-tails']), skin: '#c0533a',
    also: 'pale facial markings over the brow and the cheeks (the face\'s paint), a lithe build',
  }),
  'crested-diplomat': Object.freeze({
    reads: 'a poised humanoid whose scalp is a crest of two plated lobes falling to the shoulders, with ridges down the cheeks',
    like: 'the crested, blue-skinned all-female race of 2000s space-opera games',
    headdress: Object.freeze(['chitin-crest', 'cheek-ridges']), skin: '#7f9fc4',
    also: 'markings over the brows (the face\'s paint), a poised stance',
  }),
  'plated-insectoid': Object.freeze({
    reads: 'an insectoid with a banded skull, fine antennae and ridges down the cheeks, its plates hard',
    like: 'the insectoid aliens of 90s sci-fi',
    headdress: Object.freeze([{ card: 'segmented-skull', coat: Object.freeze({ color: 'Skin', cover: 'chitin' }) }, ANTENNAE, 'cheek-ridges']), skin: '#77874a',
    also: 'small eyes set wide, a narrow jaw, a lean build',
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
    headdress: Object.freeze(['bilobed-brain']), skin: '#a9c98f',
    also: 'large staring eyes, a lipless grin, a small body',
  }),
  'domed-telepath': Object.freeze({
    reads: 'a pale telepath with a high domed forehead and fine ridges down the cheeks',
    like: 'the domed-browed telepaths of 60s TV sci-fi',
    headdress: Object.freeze(['domed-brow', 'cheek-ridges']), skin: '#e2cfc6',
    also: 'a slight build, a long robe',
  }),
  'horn-crowned': Object.freeze({
    reads: 'a warrior with a crown of short horns round the top of a bald cap',
    like: 'the horn-crowned warriors of 90s–2000s space-opera cinema',
    headdress: Object.freeze([{ card: 'domed-brow', size: 0.5 }, crown(14, 64, 0.05), crown(42, 54, 0.045), crown(70, 42, 0.04), crown(98, 30, 0.035)]), skin: '#b8452f',
    also: 'facial markings in black over the skin (the face\'s paint), a lean athletic build',
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
  return out;
}

/** What the species gave: its name, what it reads as and recalls, its skin, and what else reads it. */
export function speciesReadout(hero) {
  const S = XENO_SPECIES[hero?.xenoSpecies]; if (!S) return null;
  return { species: hero.xenoSpecies, reads: S.reads, like: S.like, ...(S.skin ? { skin: S.skin } : {}), also: S.also };
}
