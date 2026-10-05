/**
 * The ISEKAI-BAMBOO style card: a small bamboo grove in the isekai look (era/isekai.js; the meadow card's shape, with
 * its own palette, site and tree form). Machine checks in isekai-groves.test.js. Draft agreed with the operator 10-05.
 */
import { ISEKAI_MEADOW as M } from './isekai-meadow.js';

export const ISEKAI_BAMBOO = Object.freeze({
  ...M,
  id: 'isekai-bamboo',
  principles: Object.freeze([
    'A grove is clumps of poles: culms from one rhizome stand together, leaning a little apart, with open ground between the clumps and the path.',
    'A culm is a pixel-locked pole: striped, ringed at every node, two-toned by the sun — the light in the choice of tile, the colour only the culm ramp\'s stops.',
    'The leaves are sprays, high: drooping lance leaves fanned from the upper culm, and the sun through them dapples the floor.',
    'Jade and teal: the grove is cool, the shade a blue-green, the path the one warm value.',
  ]),
  palette: {
    grass: [[34, 88, 92], [56, 124, 86], [98, 164, 76], [148, 198, 88], [200, 228, 140]],
    soil: [[96, 92, 104], [146, 124, 100], [196, 168, 124], [228, 210, 168]],
    rock: [[72, 92, 120], [102, 122, 144], [138, 150, 160], [176, 182, 176], [212, 210, 194], [236, 232, 214]],
    foliage: [[28, 76, 80], [46, 112, 78], [84, 154, 84], [140, 196, 100], [196, 228, 146]],
    culm: [[44, 90, 82], [68, 126, 90], [106, 162, 98], [156, 198, 116], [210, 228, 158]],
    bark: [[64, 58, 78], [112, 90, 82], [156, 128, 104]],
    far: [[86, 150, 138], [112, 168, 190], [156, 198, 224], [194, 222, 240]],
    sky: [[48, 118, 214], [128, 184, 234], [190, 224, 242]],
    cloud: [[136, 172, 214], [182, 208, 234], [224, 236, 248], [255, 255, 255]],
  },
  tiles: {
    ...M.tiles,
    culm: { ramp: 'culm', lit: [2, 3, 4], shade: [0, 1, 2] },
    spray: { ramp: 'foliage', lit: [2, 3, 4], shade: [0, 1, 2] },
  },
  lock: { ...M.lock },
  tint: { ...M.tint, ground: [0.5, 0.78, 0.36], crown: [0.5, 0.86, 0.42] },
  site: { w: 30, d: 44, cell: 1 },
  focus: [{ name: 'entrance', y: 5, r: 8 }, { name: 'bend', y: 24, r: 8, gate: true }],
  trail: { ...M.trail, width: 1.6, fringe: 0.5, sway: [4, 0.09, 2, 0.2], x: 0.52 },
  lumps: { octaves: [[0.35, 0.08], [0.12, 0.25], [0.04, 0.8]], banks: { h: 0.2, w: 1.8 } },
  landform: { ...M.landform, back: 8, throw: 5, keep: [6, 10] },
  rubble: { ...M.rubble, maxScree: 12, boulders: 4, gate: { sizes: [1.8, 1.4], off: 0.9 }, pebbles: { perMetre: 0.3, size: [0.1, 0.22] } },
  // BAMBOO: clumps (`clusters`, `perCluster` culms within `spread` m, `gap` apart) clear of the path and the bank; a culm
  // `r` m in radius, `sides` facets, leaning up to `lean`°, bowed `bow` m at its top, a node every `node` m; SPRAYS from
  // `from` of its height up, `per` of them, `len` m long, `width` × that, tipped `droop` down
  trees: { form: 'bamboo', variants: 3, clusters: 15, perCluster: [7, 14], spread: 1.5, gap: 0.3, heights: [8, 13], clearTrail: 1.4, clearCliff: 2.5,
    culm: { r: [0.045, 0.08], sides: 6, lean: 6, bow: 0.5, node: 0.45 }, spray: { from: 0.5, per: 12, len: [1.8, 2.8], width: 0.95, droop: 0.5 } },
  grass: { ...M.grass, clusters: 24, perCluster: [4, 10], scatter: 0.08, field: { reach: 3.5, every: 0.85, height: [0.35, 0.7] } },
  live: { ...M.live, density: 2.5, height: [0.3, 0.65], crowns: { ...M.live.crowns, groups: ['isekai:culm', 'isekai:spray'], phi: 0.3, from: 2, full: 11 } },
  light: { key: { color: '#fff4dc', elevation: 58, azimuth: 70 }, ambient: '#7eaecc', fill: 0.58, bounce: [0.6, 0.78, 0.55], bounceGain: 0.1, sunGain: 1.1 },
  air: { fog: { color: '#bcdcd8', density: 0.004 } },
  layers: [
    { at: 30, height: [8, 16], stop: 0, peaks: 7, skirt: [{ ramp: 'grass', stop: 1 }, { ramp: 'far', stop: 0 }, { ramp: 'far', stop: 0 }],
      clumps: { n: 22, trees: [4, 7], spread: 2, band: [0.1, 0.6], size: [2.5, 4], stops: [1, 2] } },
    { at: 110, height: [16, 40], stop: 1, peaks: 3.5 }, { at: 240, height: [28, 64], stop: 2, peaks: 2.5 },
  ],
  cumulus: { ...M.cumulus, tiers: [{ n: 10, at: [360, 440], base: [24, 52], width: [130, 210], tall: 0.85 }] },
  frame: { look: 24, top: { y: 18, lookY: 36 } },
});
