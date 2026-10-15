/**
 * The AIRLESS-PLAIN style card: a world with no air in the isekai look (era/isekai.js; the meadow card's shape) — a
 * moon, an asteroid, an icy body. Nothing grows: no grass, no trees, no fringe on the rocks. The ground is cratered
 * (era/nature.js `craters`: bowls with raised rims, kept off the trail) and strewn with boulders and pebbles. The sky is
 * the void (`void`: the stars out by day, the sun a small white disc, a blue world hanging low), the haze all but gone, the
 * sun low and hard and the fill dark, so every rock throws a long black-blue shadow. Its ramps (style/swatches.js) are
 * a moon's: neutral greys whose shade leans blue (the planet's light), the void, warm paint for what was made.
 */
import { ISEKAI_MEADOW as M } from './isekai-meadow.js';
import { SWATCHES } from './swatches.js';

export const AIRLESS_PLAIN = Object.freeze({
  ...M,
  id: 'airless-plain',
  references: [],
  principles: Object.freeze([
    'No air, no haze: the far crater rims are as crisp as the near ones, a little darker, and the view ends in the void.',
    'The sky is the darkest thing: a tinted void with the stars out by day, the sun a small white disc, a world hanging low.',
    'Hard light: a low white sun and almost no fill, so every boulder throws a long shadow and the shade is the planet\'s colour, never grey.',
    'Craters make the big shapes: bowls with raised rims across the plain, the trail threading between them.',
    'Nothing grows: the ground is regolith in value steps, the colour kept for what was made and for the lights.',
  ]),
  palette: SWATCHES['airless-plain'].land,   // the ramps live in style/swatches.js
  tint: { ground: [0.5, 0.53, 0.54], trail: [0.66, 0.69, 0.7], scree: [0.4, 0.43, 0.44], crown: [0.55, 0.58, 0.6], wood: [0.35, 0.36, 0.34] },
  // gentler mounds than the meadow's, no banks: the craters are the relief
  lumps: { octaves: [[0.3, 0.06], [0.12, 0.2], [0.03, 0.7]] },
  craters: { n: 11, radius: [1.4, 7.5], depth: 0.3, rim: 0.12, clear: 1 },
  rubble: { ...M.rubble, boulders: 18, gate: { sizes: [2.4, 1.9], off: 1.3 }, pebbles: { perMetre: 1.1, size: [0.1, 0.3] } },
  boulder: { ...M.boulder, wobble: 0.2, minHat: 99 },
  grass: null,
  trees: { ...M.trees, clusters: 0, hero: null },
  light: { key: { color: '#fffaf0', elevation: 32, azimuth: 60 }, ambient: '#262c3a', fill: 0.36, bounce: [0.45, 0.45, 0.45], bounceGain: 0.08, sunGain: 1.6 },
  air: { fog: { color: '#17191f', density: 0.0008 } },
  sun: { size: 0.8, glow: 0.45 },
  cumulus: null,
  // THE VOID (isekai.js): the stars out by day, the sun a white disc where the key comes from, a world hanging low
  void: { stars: 1, glow: 0.45, companion: { azimuth: 112, elevation: 24, size: 5, phase: 0.55, color: [128, 168, 224] } },
  // far rims with no tree clumps on them
  layers: M.layers.map(({ clumps: _c, ...L }) => L),
});
