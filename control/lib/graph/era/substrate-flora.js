/**
 * SUBSTRATE FLORA — what belongs on each kind of ground (era/substrate.js), by role, and what of it the library has:
 * the ecology a biocube grows through, and the gaps it shows.
 *
 *   ROLES            cover (the carpet), clump (tufts and cushions), accent (flowers, shrubs), interspacing (what lies
 *                    between: the stones, the shells, the litter), canopy (what stands over it)
 *   CLIMATES         the climates a kind suits (terrain-plants.js PLANT_CLIMATES' names)
 *   SUBSTRATE_FLORA  { <substrate>: { <role>: [[ref, climates], …] } }: a ref is in the library (`grass:sedge`,
 *                    `flower:poppy`, `species:reed`, `form:fingers/saguaro`, `shrub`, `patch:puddle`, `stone:strewn`,
 *                    `stone:edge`, `strand:shells`, `rock:stonecrop`, `cut:sand`) or wanted, not yet built (`want:marram`, its read in WANTS)
 *   floraLibrary()   → the library's refs, read off its own registries
 *   measuredShares() → { <substrate>: share } of a level, over the cube presets
 *   floraGaps({ shares }) → { matrix: [{ substrate, role, have, want }], gaps: [{ want, read, substrates, climates, slots,
 *                    fills, score }] (ranked: the ground a kind would cover, by `shares`, its climates, and the empty
 *                    slots it fills), empty
 *                    (the slots nothing in the library fills yet), dangling } (a ref naming nothing in the library: a fault)
 *
 * Pure: read off the registries. The report a page is made of (docs/flora-gaps.md, scripts/flora-gaps.mjs).
 */
// (the stage first, as every other reader loads it: the era's modules import one another in a ring)
import './stage.js';
import { GRASSES } from '../vegetation/grass.js';
import { WILDFLOWERS } from '../vegetation/wildflowers.js';
import { SPECIES } from '../vegetation/species.js';
import { FLORA_FORMS } from './out-flora.js';
import { PATCH_KINDS } from './trail-dress.js';
import { STRAND } from './strand.js';
import { ROCK_FLORA } from './rock-flora.js';
import { GEOCUBE_PRESETS } from './geocube.js';
import { substrateOf } from './substrate-of.js';
import { GROUND_CUTS } from './gritty-flora.js';
import { SUBSTRATE_IDS } from './substrate.js';

export const ROLES = Object.freeze(['cover', 'clump', 'accent', 'interspacing', 'canopy']);
export const CLIMATES = Object.freeze(['temperate', 'alpine', 'boreal', 'arid', 'tropical']);
const ALL = CLIMATES, T = ['temperate'], TB = ['temperate', 'boreal'], TA = ['temperate', 'alpine'], AB = ['alpine', 'boreal'];
const TT = ['temperate', 'tropical'], TBT = ['temperate', 'boreal', 'tropical'], WET = ['temperate', 'alpine', 'boreal', 'tropical'];

/** The kinds wanted and not yet in the library: what each is. */
export const WANTS = Object.freeze({
  'steppe-grass': 'short dry bunchgrass over bare earth',
  'leaf-litter': 'fallen leaves and twigs drifted under the trees',
  'fallen-log': 'a trunk down in the grass, mossed and split',
  'alpine-flower': 'gentian, edelweiss and alpine poppy in the gaps',
  'scree-runner': 'creeping stems running over the stones and rooting where they touch',
  krummholz: 'wind-cropped dwarf pines hugging the ground',
  'rock-moss': 'moss cushions where the rock stays damp',
  'rock-flower': 'thrift, rock rose and harebell from the crevices',
  'desert-scrub': 'saltbush and creosote, each a ring of bare sand round it',
  'sea-lyme': 'blue-grey lyme grass in clumps behind the beach',
  'sea-holly': 'blue thistle-heads of sea holly and the pink cushions of thrift',
  'beach-pea': 'a mat of sea pea and sandwort over the sand',
  'desert-bloom': 'the brief flowers after rain',
  tumbleweed: 'dry balls of brush caught against the stones',
  sphagnum: 'a bog\'s moss carpet, red and green',
  rush: 'stiff dark tufts of rush',
  cattail: 'bulrushes, their brown heads over the water',
  'marsh-marigold': 'yellow cups of marsh marigold at the water\'s edge',
  iris: 'yellow flag iris in the shallows',
  'water-lily': 'lilies flowering on still water',
  'lily-pads': 'round pads floating on still water',
  willow: 'a willow leaning over the bank',
  alder: 'alders along the stream',
  'path-weeds': 'plantain and dandelion where the feet miss',
});

const r = (ref, climates = ALL) => Object.freeze([ref, Object.freeze([...climates])]);
export const SUBSTRATE_FLORA = Object.freeze({
  soil: {
    cover: [r('grass:meadow', T), r('grass:lawn', T), r('grass:fescue', AB), r('grass:elephant', ['tropical']), r('want:steppe-grass', ['arid'])],
    clump: [r('grass:tussock', ['temperate', 'alpine', 'boreal']), r('grass:fountain', ['temperate', 'arid']), r('grass:pampas', TT), r('form:tuft/flowering')],
    accent: [r('flower:daisy', T), r('flower:buttercup', T), r('flower:clover', T), r('flower:lupine', TA), r('flower:poppy', ['temperate', 'arid']), r('shrub'), r('form:flower/spike'), r('form:flower/umbel'), r('form:flower/plume')],
    interspacing: [r('form:mushroom/toadstool', TB), r('form:fungi/puffball', TB), r('form:ground/mound'), r('want:leaf-litter', TBT), r('want:fallen-log', TBT)],
    canopy: [r('species:oak', T), r('species:beech', T), r('species:cherry', T), r('species:fir', AB), r('species:spruce', AB), r('species:silverfir', AB), r('species:pine', AB),
      r('species:schefflera', ['tropical']), r('species:banyan', ['tropical']), r('species:rubberfig', ['tropical']), r('species:treefern', ['tropical']), r('species:moso', TT), r('form:broccoli/lollipop')],
  },
  scree: {
    cover: [r('rock:lichen-crust', ['temperate', 'alpine', 'boreal']), r('cut:scree')],
    clump: [r('grass:needlegrass', ['alpine', 'arid']), r('rock:cushion-plant', AB)],
    accent: [r('want:alpine-flower', ['alpine']), r('want:scree-runner', TA)],
    interspacing: [r('stone:strewn'), r('stone:edge'), r('form:stone/stack')],
    canopy: [r('species:pine', ['alpine']), r('want:krummholz', AB)],
  },
  bedrock: {
    cover: [r('rock:lichen-crust'), r('cut:karst'), r('want:rock-moss', TBT)],
    clump: [r('rock:crevice-fern', TT), r('rock:stonecrop', ['temperate', 'arid', 'alpine']), r('rock:cushion-plant', ['alpine'])],
    accent: [r('want:rock-flower', TA), r('form:fingers/tubes', ['arid'])],
    interspacing: [r('form:stone/slab'), r('form:stone/outcrop'), r('form:stone/boulder'), r('stone:strewn')],
    canopy: [r('species:pine', ['temperate', 'alpine', 'boreal']), r('species:strangler', ['tropical'])],
  },
  sand: {
    cover: [r('grass:marram', TB), r('cut:sand'), r('want:desert-scrub', ['arid'])],
    clump: [r('want:sea-lyme', TB), r('form:fingers/saguaro', ['arid']), r('form:fingers/pads', ['arid']), r('grass:needlegrass', ['arid'])],
    accent: [r('want:sea-holly', T), r('want:beach-pea', TB), r('want:desert-bloom', ['arid']), r('form:flower/plume', ['arid'])],
    interspacing: [r('strand:shells', TT), r('strand:driftwood', TBT), r('strand:sea-pebbles', TB), r('form:stone/slab', ['arid']), r('want:tumbleweed', ['arid'])],
    canopy: [r('species:coconut', ['tropical']), r('species:date', ['arid']), r('species:washingtonia', ['arid', 'tropical']), r('species:pine', T)],
  },
  wet: {
    cover: [r('grass:sedge', WET), r('want:sphagnum', TB)],
    clump: [r('species:reed', TT), r('want:rush', ['temperate', 'alpine', 'boreal']), r('want:cattail', TT)],
    accent: [r('want:marsh-marigold', TB), r('want:iris', T), r('want:water-lily', TT)],
    interspacing: [r('want:lily-pads', TT), r('form:stone/slab'), r('patch:puddle', WET)],
    canopy: [r('want:willow', TB), r('want:alder', TB), r('species:treefern', ['tropical'])],
  },
  path: {
    cover: [r('patch:worn'), r('patch:damp'), r('patch:gravel')],
    clump: [r('patch:crown', TB), r('grass:tussock', T)],
    accent: [r('want:path-weeds', T)],
    interspacing: [r('stone:edge'), r('patch:puddle', WET)],
    canopy: [],
  },
});

/** The library's refs, read off its own registries. */
export function floraLibrary() {
  const refs = new Set(['shrub', 'stone:strewn', 'stone:edge']);
  for (const k of Object.keys(GRASSES)) refs.add(`grass:${k}`);
  for (const k of Object.keys(WILDFLOWERS)) refs.add(`flower:${k}`);
  for (const k of Object.keys(SPECIES)) refs.add(`species:${k}`);
  for (const [f, F] of Object.entries(FLORA_FORMS)) for (const v of Object.keys(F.variants || {})) refs.add(`form:${f}/${v}`);
  for (const k of PATCH_KINDS) refs.add(`patch:${k}`);
  for (const k of Object.keys(STRAND)) refs.add(`strand:${k}`);
  for (const k of Object.keys(ROCK_FLORA)) refs.add(`rock:${k}`);
  // (a ground's own cut, drawn on a gritty land: era/gritty-flora.js)
  for (const C of Object.values(GROUND_CUTS)) refs.add(`cut:${C.cut}`);
  return refs;
}

/**
 * How much of a level each ground covers: its share of a cube's stage land (a trail's, era/substrate-of.js), averaged
 * over the cube presets that have an outside (era/geocube.js GEOCUBE_PRESETS), each read with its own base, grit and
 * formation. → { <substrate>: share }
 */
export function measuredShares() {
  const sums = Object.fromEntries(SUBSTRATE_IDS.map((k) => [k, 0]));
  let n = 0;
  for (const cube of Object.values(GEOCUBE_PRESETS)) {
    if (!cube.outside?.base) continue;
    const skin = cube.outside.land?.skin, S = substrateOf({ kind: 'stage', kit: cube.outside.base, trail: {}, shading: { grit: cube.grit ?? 0.5, ...(skin ? { skin } : {}) } });
    for (const k of SUBSTRATE_IDS) sums[k] += S.shares[k];
    n++;
  }
  return Object.fromEntries(SUBSTRATE_IDS.map((k) => [k, n ? Math.round((sums[k] / n) * 1e4) / 1e4 : 0]));
}
// a ground no preset lays yet still counts this much (a stream's wet bank, a desert's sand)
export const SHARE_FLOOR = 0.02;

/**
 * The matrix, the gaps ranked, and any dangling ref. A gap's score is the ground it would cover: over the substrates it
 * belongs on, each one's share of a level (`shares`, measured: at least SHARE_FLOOR) × the share of the climates it
 * suits, doubled on a substrate where it fills an empty slot; × 100.
 */
export function floraGaps({ shares = null } = {}) {
  const lib = floraLibrary(), matrix = [], wanted = new Map(), dangling = [];
  for (const sub of SUBSTRATE_IDS) for (const role of ROLES) {
    const have = [], want = [];
    for (const [ref, climates] of SUBSTRATE_FLORA[sub]?.[role] ?? []) {
      if (ref.startsWith('want:')) {
        const w = ref.slice(5);
        if (!WANTS[w]) dangling.push(`${sub}.${role}: ${ref}`);
        want.push(w);
        const g = wanted.get(w) ?? { want: w, read: WANTS[w] ?? '', substrates: new Set(), climates: new Set(), slots: [] };
        g.substrates.add(sub); for (const c of climates) g.climates.add(c); g.slots.push(`${sub}.${role}`);
        wanted.set(w, g);
      } else if (lib.has(ref)) have.push(ref);
      else dangling.push(`${sub}.${role}: ${ref}`);
    }
    matrix.push({ substrate: sub, role, have, want });
  }
  // (a slot with nothing in it yet is the sharpest gap: a kind that fills one counts three for it)
  const empty = new Set(matrix.filter((m) => !m.have.length && m.want.length).map((m) => `${m.substrate}.${m.role}`));
  const sh = shares ?? Object.fromEntries(SUBSTRATE_IDS.map((k) => [k, 1 / SUBSTRATE_IDS.length]));
  const gaps = [...wanted.values()].map((g) => {
    const fills = g.slots.filter((x) => empty.has(x)), cl = CLIMATES.filter((c) => g.climates.has(c));
    const score = [...g.substrates].reduce((a, s) => a + Math.max(sh[s] ?? 0, SHARE_FLOOR) * (cl.length / CLIMATES.length) * (fills.some((x) => x.startsWith(`${s}.`)) ? 2 : 1), 0);
    return { want: g.want, read: g.read, substrates: [...g.substrates], climates: cl, slots: g.slots, fills, score: Math.round(score * 1000) / 10 };
  }).sort((a, b) => b.score - a.score || a.want.localeCompare(b.want));
  return { matrix, gaps, empty: [...empty], dangling };
}
