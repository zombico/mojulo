/**
 * The ALIEN-NIGHT style card: a night on another world in the isekai look (era/isekai.js; the meadow card's shape).
 * Nothing here is new machinery but the night: the moon is the key, stars and a pale world hang in the sky, and the
 * lantern plants light pools on the ground. Everything else is the meadow's grammar with other numbers: the ramps
 * (style/swatches.js), spires for boulders, stalks for trees, a taller scarp, jagged far ridges.
 */
import { ISEKAI_MEADOW as M } from './isekai-meadow.js';
import { SWATCHES } from './swatches.js';

const { glow, foliage } = SWATCHES['alien-night'].land, hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

export const ALIEN_NIGHT = Object.freeze({
  ...M,
  id: 'alien-night',
  references: [],
  principles: Object.freeze([
    'Night is a palette, not a dimmer: every ramp is dark and coloured; the moon moves a colour a stop up its ramp, never toward grey.',
    'The light is in the world: lantern plants glow, and their light pools on the ground, which climbs its ramp toward the lanterns\' pink.',
    'Spires, not boulders: the rock stands up in tall tapered columns, alien in scale against the walker.',
    'Silhouettes make the depth: the far ridges are flat dark bands, the nearer the darker, under a sky that lightens to the horizon.',
    'The sky is a place: stars, a phase-carved moon where the moonlight comes from, and a pale world hanging low.',
    'Water glows: a stream is the brightest line on the ground.',
  ]),
  palette: SWATCHES['alien-night'].land,   // the ramps live in style/swatches.js
  // moonlit tiles sit a stop lower than the meadow's sunlit ones: night keeps to the dark end of every ramp
  tiles: {
    ...M.tiles,
    cliff: { ...M.tiles.cliff, lit: [1, 2, 3], shade: [0, 1] },
    rock: { ...M.tiles.rock, lit: [1, 2, 3], shade: [0, 1] },
    hat: { ...M.tiles.hat, lit: [1, 2, 3], shade: [0, 1] },
    fringe: { ...M.tiles.fringe, lit: [1, 2, 3], shade: [0, 1] },
    blades: { ...M.tiles.blades, lit: [1, 2, 3], shade: [0, 1] },
  },
  tint: { ground: [0.6, 0.55, 0.85], trail: [0.92, 0.8, 0.75], scree: [0.7, 0.68, 0.85], crown: [1, 0.6, 0.9], wood: [0.5, 0.45, 0.6] },
  landform: { ...M.landform, throw: 22, face: 84, bed: 3.2 },
  rubble: { ...M.rubble, boulders: 12, gate: { sizes: [2.2, 1.8], off: 1.4 } },
  // SPIRES: the boulder's loft run tall and tapering, too narrow at the top to wear a hat
  boulder: { sides: [5, 7], wobble: 0.1, rings: [[0, 1], [0.35, 0.8], [0.75, 0.5], [1, 0.28]], height: [2.2, 3.4], sink: 0.2, lean: 0.06, minHat: 99 },
  grass: { ...M.grass, height: [0.6, 1.15], field: { reach: 6, every: 0.75, height: [0.6, 1.2] } },
  // LANTERN STALKS: the meadow's tree with a thin trunk and a small crown held high — a bulb on a stalk
  trees: { ...M.trees, heights: [5, 8], clusters: 7, perCluster: [1, 3], crown: { height: 0.9, radius: 0.15, masses: [3, 4], squash: 1.25, trunk: 0.03 },
    hero: { y: 47, side: 1, off: 7, h: 13, masses: [5, 6] } },
  light: { key: { color: '#b8a8ff', elevation: 30, azimuth: 60 }, ambient: '#3a2c7a', fill: 0.6, bounce: [0.3, 0.25, 0.5], bounceGain: 0.05, sunGain: 0.9 },
  air: { fog: { color: '#2a1f58', density: 0.004 } },
  sun: null,
  cumulus: null,
  // THE NIGHT (isekai.js): the sky's darkness and stars, the moon drawn where the key comes from, and a pale world
  // (azimuth, elevation in degrees) hanging low
  night: { day: 0.04, stars: 1, moon: { size: 1.6, phase: 0.35 }, planet: { azimuth: 84, elevation: 24, size: 5, glow: 0.45 } },
  // THE GLOW (isekai.js): every lantern crown is a light baked into the ground round it (`radius` m); its faces are
  // self-lit, `lift` stops up their ramp from where the night left them (a lantern is bright in the dark); `halos` of
  // them carry a halo
  glow: { color: hex(foliage[3]), trees: { intensity: 2, radius: 9, hero: 3 }, emissive: { 'isekai:crown': 1.6 }, lift: 2, halos: 24 },
  water: { fill: hex(glow[2]) },
  layers: [
    { at: 45, height: [4, 16], stop: 0, peaks: 9, skirt: [{ ramp: 'grass', stop: 1 }, { ramp: 'grass', stop: 0 }, { ramp: 'far', stop: 0 }, { ramp: 'far', stop: 0 }],
      clumps: { n: 16, trees: [3, 6], spread: 2.5, band: [0.06, 0.32], size: [1.2, 2.2], stops: [1, 2] } },
    { at: 120, height: [20, 60], stop: 1, peaks: 6 }, { at: 260, height: [40, 110], stop: 2, peaks: 4 },
  ],
});
