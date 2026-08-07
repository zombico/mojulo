/**
 * earth-temperate — the IDENTITY pack.
 *
 * Empty slots on purpose: composing `{ base:'city', theme:'earth-temperate' }` must
 * reproduce a bare `create_fractal_city({ seed })` byte-for-byte. This is the no-regression
 * anchor that proves the theme layer is lossless before the exotic packs diverge from it.
 */
export default {
  id: 'earth-temperate',
  family: 'earth',
  label: 'Temperate (identity)',
  description: 'A plain modern temperate city — the baseline. Reproduces the default generator output exactly.',
  slots: {},
};
