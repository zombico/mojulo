/**
 * The ISEKAI-SAKURA style card: a small sakura grove in the isekai look (era/isekai.js; the meadow card's shape, with
 * its own palette, site and tree form). Machine checks in isekai-groves.test.js. Draft agreed with the operator 10-05.
 */
import { ISEKAI_MEADOW as M } from './isekai-meadow.js';

export const ISEKAI_SAKURA = Object.freeze({
  ...M,
  id: 'isekai-sakura',
  principles: Object.freeze([
    'The blossom is the subject: clumps of flowers locked to a pink ramp, their skin packed flowers and their edges broken into sprigs, the shade a pink-lavender, the lights near white.',
    'A sakura is grown: a dark trunk with banded bark leans and forks, its limbs split into branches spreading wide and flat, blossom at their tips, the limbs and the sky showing between; the heroes grown deepest.',
    'Petals lie where they fell: notched petals pixel-locked to the blossom ramp, under and past each crown and over the path; live, they lie round the walker in 3-D, caught in the grass, and lift in the gusts.',
    'Spring light: fresh grass, a soft warm sun, the far ranges lilac and blue.',
  ]),
  palette: {
    grass: [[44, 96, 96], [72, 140, 84], [124, 184, 70], [176, 214, 86], [222, 238, 150]],
    soil: [[110, 96, 112], [162, 132, 106], [212, 178, 132], [238, 218, 176]],
    rock: [[86, 92, 132], [116, 120, 154], [150, 150, 170], [186, 180, 180], [218, 210, 198], [240, 234, 220]],
    foliage: [[30, 78, 82], [52, 118, 66], [96, 164, 58], [156, 204, 78], [206, 232, 132]],
    blossom: [[168, 124, 184], [218, 150, 194], [242, 182, 210], [252, 212, 228], [255, 238, 244]],
    bark: [[44, 34, 54], [72, 54, 70], [106, 82, 92], [150, 122, 126]],
    far: [[150, 156, 200], [168, 180, 220], [186, 204, 236], [206, 222, 244]],
    sky: [[64, 128, 222], [140, 188, 238], [204, 228, 246]],
    cloud: [[150, 170, 220], [196, 210, 238], [232, 238, 250], [255, 255, 255]],
  },
  tiles: { ...M.tiles, petals: { ramp: 'blossom', lit: [2, 3, 4], shade: [0, 1, 2] }, bark: { ramp: 'bark', lit: [1, 2, 3], shade: [0, 1, 2], scale: 0.9 },
    bloom: { ramp: 'blossom', lit: [2, 3, 4], shade: [0, 1, 2], scale: 2.4 }, sprig: { ramp: 'blossom', lit: [2, 3, 4], shade: [0, 1, 2] } },
  lock: { ...M.lock, 'isekai:blossom': 'blossom', 'isekai:sprig': 'blossom' },
  tint: { ...M.tint, ground: [0.6, 0.86, 0.32], blossom: [1.3, 0.92, 1.05], wood: [0.36, 0.28, 0.3] },
  site: { w: 30, d: 44, cell: 1 },
  focus: [{ name: 'entrance', y: 5, r: 8 }, { name: 'hero', y: 24, r: 9, gate: true }],
  trail: { ...M.trail, width: 1.8, fringe: 0.6, sway: [4, 0.08, 2, 0.18], x: 0.52 },
  lumps: { octaves: [[0.45, 0.07], [0.15, 0.22], [0.04, 0.8]], banks: { h: 0.2, w: 2 } },
  landform: { ...M.landform, back: 8, throw: 4, keep: [6, 10] },
  rubble: { ...M.rubble, maxScree: 10, boulders: 4, gate: { sizes: [1.9, 1.5], off: 1 }, pebbles: { perMetre: 0.3, size: [0.1, 0.22] } },
  // SAKURA, GROWN: a trunk leaning up to `lean`° forks at `fork` of the height into `limbs`; each branch splits into
  // `split` children, to `depth` generations, each `ratio` of its parent's length and rising `rise`° (by generation)
  // over the level, the tips turning down `droop`. Blossom CLUMPS of radius `clump` m at every tip (`perTip`) and along
  // the last generation (`along`, a chance), each wearing `sprigs` crossed sprig cards `sprig` × its radius. A TIER per
  // tree: `hero` for the `heroes`, `grove` for the rest (the haircut: fewer, bigger clumps, the limbs in the gaps).
  // PETAL litter: `per` cards `size` m within `reach` × the crown's spread of the trunk.
  trees: { form: 'blossom', variants: 3, clusters: 6, perCluster: [1, 3], spread: 4, heights: [5, 7.5], clearTrail: 2.6, clearCliff: 3,
    crown: { height: 0.72, radius: 0.46, masses: [6, 8], squash: 0.7, trunk: 0.04, lean: 12, fork: 0.4, limbs: [2, 3] },
    sakura: {
      hero: { depth: 3, split: [2, 3], ratio: [0.38, 0.28, 0.2], rise: [48, 26, 12], droop: 0.25, clump: [0.6, 0.9], perTip: 3, along: 0.8, joints: 1, detail: 1, sprigs: 6, sprig: 1.7 },
      grove: { depth: 2, split: [2, 3], ratio: [0.42, 0.32], rise: [44, 20], droop: 0.2, clump: [0.85, 1.25], perTip: 3, along: 0.9, joints: 1, detail: 1, sprigs: 5, sprig: 1.6 },
      probe: 1, cel: 0.06,
    },
    hero: { y: 25, side: -1, off: 4.5, h: 9, masses: [9, 11] },
    heroes: [{ y: 22, side: -1, off: 5, h: 9.5 }, { y: 31, side: 1, off: 5.5, h: 8.5 }], heroClear: 6,
    petals: { per: 40, size: [0.6, 1.1], reach: 1.1 } },
  grass: { ...M.grass, clusters: 40, field: { reach: 5, every: 0.75, height: [0.35, 0.7] } },
  // live: the crowns sway, and PETALS fall — `per` from each crown, `size` m long, falling `fall` m/s with a `flutter`,
  // carried `drift` × the wind, lying `rest` s where they land before the crown lets go of them again; the CARPET: 3-D
  // petals lying round the walker out to `radius` (thinning past `near`), `density` a square metre under a crown and out
  // to `reach` × its spread, heaped in PILES — drifts where a patch noise (`drift`: from, to, per metre) runs high,
  // within `edge` m of the trail's edge, within `base` m of a trunk — and only a `grass` share on open grass and a
  // `trodden` share on the trail's middle; in a
  // cell a `heap` share [of them, within m] round one centre; a `caught` share of those over grass resting up to `rest`
  // m up in it; a gust over the mean by `lift` raising and skipping them
  live: { ...M.live, crowns: { ...M.live.crowns, groups: ['isekai:blossom', 'isekai:sprig', 'isekai:wood'], phi: 0.4, full: 5 },
    petals: { per: 70, size: 0.1, fall: 0.9, flutter: 0.35, drift: 0.45, rest: 4,
      carpet: { radius: 12, near: 6, density: 110, reach: 1.7, size: [0.08, 0.13], lift: 0.2, tile: 4, caught: 0.5, rest: 0.25,
        drift: [0.5, 0.72, 0.4], edge: 0.35, base: 1.4, grass: 0.12, trodden: 0.4, heap: [0.75, 0.4] } } },
  light: { key: { color: '#fff0dc', elevation: 40, azimuth: 55 }, ambient: '#9aa8dc', fill: 0.64, bounce: [0.76, 0.74, 0.56], bounceGain: 0.12, sunGain: 1.1 },
  air: { fog: { color: '#c8d6f0', density: 0.0015 } },
  layers: [
    { at: 30, height: [3, 9], stop: 0, peaks: 5, skirt: [{ ramp: 'grass', stop: 2 }, { ramp: 'grass', stop: 1 }, { ramp: 'far', stop: 0 }],
      clumps: { n: 14, trees: [2, 4], spread: 2.5, band: [0.06, 0.3], size: [1.8, 3], stops: [1, 2] } },
    { at: 110, height: [14, 36], stop: 1, peaks: 3.5 }, { at: 240, height: [24, 62], stop: 2, peaks: 2.5 },
  ],
  // the HERO frame: from the trail `back` m short of the first hero, looking up into its crown
  frame: { look: 24, top: { y: 18, lookY: 36 }, hero: { tree: 0, back: 12, eye: 1.4, fov: 70 } },
});
