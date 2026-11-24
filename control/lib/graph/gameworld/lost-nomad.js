/**
 * LOST NOMAD — the cinematic action rail's template (rails.js `lost-nomad`, after Uncharted): an action movie a person
 * makes their own, its set pieces the scenes and its hero the star. The template is never the game.
 *
 *   TARIQ    the star, in the hero door's words (create_character's spec): a Levantine man in his thirties on the
 *            realistic body, in the basic adventurer's clothes (a henley with its sleeves pushed up, straight jeans, work
 *            boots, a belt with a pouch on the thigh), stubble, short swept hair; his motion the free runner's
 *   CASTING  the star's word to a person's own: their hero stands in his place wherever the template lays him
 *
 * Pure data.
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
