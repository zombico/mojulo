/**
 * The LOOKS a cast is drawn in off the console ladder (eras.js is the ladder: a generation's light and surface). A look
 * is a style a hero opts into by word, its conventions one line each with a status (`built`: mojulo makes it today;
 * `planned`: named so a readout can say it is missing, never claimed). Data, not code paths.
 *
 *   LOOKS[id]          { reads, word, conventions }
 *   lookReadout(id)    the readout's line: the look, its built conventions and the planned ones still missing
 */
export const LOOKS = Object.freeze({
  'painterly-toon': Object.freeze({
    reads: 'a painterly toon look (a painted face on a smooth head, a soft warm two-tone light, a rim from the air)',
    word: 'painterly',
    conventions: Object.freeze([
      { id: 'painted-face', line: 'Eyes, lashes, brows and the mouth are painted into a texture on a smooth face, not built as slabs.', status: 'built' },
      { id: 'soft-edge', line: 'The light meets the shade over a soft band, not on a line.', status: 'built' },
      { id: 'warm-shade', line: 'The skin\'s shade is warm, never grey.', status: 'built' },
      { id: 'rim-from-the-air', line: 'A rim in the sky\'s colour parts the figure from the level behind it.', status: 'built' },
      { id: 'painted-albedo', line: 'Cloth and skin carry painted strokes and folds in their colour.', status: 'planned' },
      { id: 'ribbon-hair', line: 'Hair as a few large ribbon masses with painted strand highlights.', status: 'planned' },
      { id: 'haze-on-figure', line: 'The level\'s haze tints the figure with its distance.', status: 'planned' },
      { id: 'painted-face-in-motion', line: 'The painted face changes with the expression and travels on the rig and to the engines.', status: 'built' },
    ]),
  }),
});
export const LOOK_IDS = Object.freeze(Object.keys(LOOKS));

/** The readout's line for a look: `{ look, reads, built: [ids], planned: [ids] }`. */
export function lookReadout(id) {
  const L = LOOKS[id];
  return { look: id, reads: L.reads, built: L.conventions.filter((c) => c.status === 'built').map((c) => c.id), planned: L.conventions.filter((c) => c.status === 'planned').map((c) => c.id) };
}
