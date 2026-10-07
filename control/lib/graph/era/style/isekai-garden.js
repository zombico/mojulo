/**
 * The ISEKAI-GARDEN style card: the meadow's grammar planted as a garden. No loose trees: the plants stand in
 * ARRANGEMENTS (era/out-ikebana.js, placed by era/ikebana-place.js) painted along both banks of the trail, each from
 * one root, reading in tiers down to the way (trees, bushes in bloom, flower spikes and plumes, daisies in the grass),
 * its open front toward the walker. Everything else is the meadow's: the land, the light, the sky.
 */
import { ISEKAI_MEADOW as M } from './isekai-meadow.js';
import { SWATCHES } from './swatches.js';

export const ISEKAI_GARDEN = Object.freeze({
  ...M,
  id: 'isekai-garden',
  references: [],
  principles: Object.freeze([
    'Bundled, not scattered: the plants stand in arrangements along the banks, each from one root, never a loose scatter.',
    'Tall behind, short in front: every arrangement reads in tiers down to the way, trees to bushes to flowers to the grass.',
    'The way in is open: each arrangement leaves its front toward the trail open, so the eye and the walker can enter.',
    'Neighbours answer each other: arrangements alternate hands along a bank, and one in each is the odd one out.',
    'Flowers are walked through; trunks and bushes are walked round.',
  ]),
  palette: SWATCHES['isekai-garden'].land,   // the ramps live in style/swatches.js
  // the garden plants its own: no loose groves, no hero tree
  trees: { ...M.trees, clusters: 0, hero: null },
  // a LAWN, cut short, so an arrangement's lower tiers (its flowers, its bushes) read over it
  grass: { ...M.grass, cards: { ...M.grass.cards, height: 0.5 }, field: { ...M.grass.field, reach: 5, height: [0.35, 0.7] } },
  // the ARRANGEMENTS: a close, varied grove on the near banks, a wider, quieter row behind the open side
  ikebana: {
    materials: 'grove', style: 'upright', scale: 5, density: 0.85, variation: 0.6, bend: 0.4, cover: 0.7, walk: 'open', incongruity: 0.5, ma: 28, clear: 1.2, level: 'mid',
    banks: [{ side: 1, off: 2.4, from: 6, width: 2, density: 0.7, cover: 0.45 }, { side: -1, off: 2.4, from: 10, width: 1.5, density: 0.6, cover: 0.45 },
      { side: 1, off: 12, from: 14, width: 3, level: 'far', density: 0.3, cover: 0, scale: 6.5 }],
  },
});
