/**
 * LOST NOMAD — the cinematic action rail's template (rails.js `lost-nomad`, after Uncharted): an action movie a person
 * makes their own, its set pieces the scenes and its hero the star. The template is never the game.
 *
 *   TARIQ    the star, in the hero door's words (create_character's spec): a Levantine man in his thirties on the
 *            realistic body, in the basic adventurer's clothes (a henley with its sleeves pushed up, straight jeans, work
 *            boots, a belt with a pouch on the thigh), stubble, short swept hair; his motion the free runner's
 *   lostNomadWorld({ name?, seed? }) → the template movie: a designed world of three set-piece levels in order (the
 *            souk's rooftops, the fall of the tower, the cliffs, the scree, the convoy), each a kind (set-piece-kinds.js) laid on its own site,
 *            Tariq its hero (his looks the hero page's fragments, composed into his spec), the cinematic action feel
 *   lostNomadStart(world) → { world, says } the starter under what a person wrote (every key of theirs wins), or null
 *            for a world that already has levels
 *   LOST_NOMAD   the rail's name and the starter's title (a person's movie takes its own)
 *
 * Pure.
 */
export const TARIQ = Object.freeze({
  cast: 'male',
  form: 'realistic',
  physique: 'athletic',
  hair: 'swept',
  outfit: {
    type: 'outfit',
    style: 'adventurer',
    language: {
      // (the henley: a fitted knit, its band collar the open placket, the sleeves pushed to the forearm)
      top: { family: 'knit', sleeve: 'threeQuarter', hem: 'hip', fit: 'fitted', collar: 'band', cloth: 'jersey' },
      bottom: { family: 'woven', leg: 'long', cut: 'straight', cloth: 'denim' },
      feet: 'boots', tuck: false, focal: 'belt',
    },
    // (a belt and, on the thigh, the pouch that stands for the drop-leg holster)
    pieces: [{ kind: 'belt' }, { kind: 'thighPouch' }],
  },
  palette: {
    Top: '#d6cbb3', Bottom: '#394860', Shoes: '#5a3b24', Leather: '#4a2f1c', Buckle: '#8a7a5a',
    OutfitTrim: '#b9ad94', OutfitSecond: '#4a2f1c', Hair: '#1c1511', HairHighlight: '#32251b',
  },
  // (seed 1116 of the Levantine face: a strong chin, a classical nose, sculpted cheeks, deep-set eyes under thick brows,
  // stubble: a leading man's)
  face: { seed: 1116, ethnicity: 'levantine', age: 34 },
  motion: { jog: true, sprint: true, stepVault: true, speedVault: true, hurdle: true, rollForward: true, throwOverhand: true },
});

export const LOST_NOMAD = 'Lost Nomad';
// the movie's reel: each level a set piece of a kind, in order (a person's movie changes the kinds, the words, the order)
export const REEL = Object.freeze([
  ['souk', 'The souk rooftops', { kind: 'rooftop-run' }],
  ['tower', 'The fall of the tower', { kind: 'collapse' }],
  ['cliffs', 'The cliffs', { kind: 'climb' }],
  ['scree', 'The scree', { kind: 'slide' }],
  ['convoy', 'The convoy', { kind: 'truck-top' }],
]);

/** The template movie (see the header). */
/** THE PLACE the template's set pieces stand in: a Levantine country of limewashed medinas and ochre rock, under a low
 *  golden sun (a geocube composed from the island's noon: its desert, its light the dusk's, its towns the Moorish
 *  medina's). Every level of the movie wears it (set-piece-dress.js); a person's movie names its own. */
export const LEVANT = Object.freeze({
  from: 'island-noon', title: 'Levant', reads: 'Limewashed medinas and ochre rock under a low golden sun, the desert beyond',
  biocube: 'desert', light: { reference: 'desert-dusk', outsideFog: 1 },
  colour: { stone: '#dcc59c', floor: '#a47b52', trim: '#eadcbf', accent: '#2d6e70', grass: '#9a9a5a', foliage: '#6f7a44', water: '#3f8aa0', sand: '#d6bb8a' },
  settlements: { medina: { style: 'moorish-medina' } },
});

export function lostNomadWorld({ name = LOST_NOMAD, seed = 7 } = {}) {
  const T = JSON.parse(JSON.stringify(TARIQ));
  return {
    id: 'lost-nomad', name, seed, mode: 'autonomous', feel: 'lost-nomad',
    style: { geocube: JSON.parse(JSON.stringify(LEVANT)) },
    intent: { from: 'cinematic-action' },
    characters: {
      direction: { tradition: 'western' },
      // (Tariq as the hero page's fragments: composed, they are his spec, hero-looks.js composeHero)
      hero: { looks: { body: { cast: T.cast, form: T.form, physique: T.physique }, head: { face: T.face }, hair: { hair: { style: T.hair } }, colour: { palette: T.palette }, underlayer: T.outfit },
        motion: { vibe: ['bold', 'athletic'] } },
    },
    levels: Object.fromEntries(REEL.map(([id, title, stunt]) => [id, { name: title, stunt: { ...stunt } }])),
    start: REEL[0][0],
    links: REEL.slice(1).map(([id], i) => ({ from: REEL[i][0], to: id, kind: 'road' })),
    topology: 'linear',
  };
}

// the workflow's own keys: a starter never brings them over what the creator wrote
const OWN = ['rail', 'intake', 'brief', 'review', 'made'];
/** The starter under a person's world (see the header). */
export function lostNomadStart(world) {
  if (!world || typeof world !== 'object' || Array.isArray(world) || world.levels !== undefined) return null;
  const S = lostNomadWorld({ ...(typeof world.name === 'string' && world.name.trim() ? { name: world.name } : {}), ...(Number.isInteger(world.seed) ? { seed: world.seed } : {}) });
  const starter = Object.fromEntries(Object.entries(S).filter(([k]) => !OWN.includes(k)));
  return { world: { ...starter, ...world }, says: `${LOST_NOMAD}'s starter: an action movie of ${REEL.length} set pieces (${REEL.map(([, t]) => t.toLowerCase()).join(', ')}), Tariq its star, every one a word of the book: theirs to change, reorder or replace` };
}
