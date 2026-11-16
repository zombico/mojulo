/**
 * THE MARINE ROSTER: every thing that grows on a seabed and does not swim, one row each (the swimmers and the crawlers are
 * the fauna's, era/biocube-fauna.js). A row is a way of growing (marine/forms.js) at a size, in its colours, where it
 * lives:
 *
 *   says     the words people say for it
 *   grow     its primitive (forms.js)
 *   h, w     its height and its spread in metres, [lo, hi] (a template is grown at the middle, a copy scaled in the range)
 *   n        its count (forks, fingers, tentacles, blades), where its primitive takes one
 *   sway     how far its free end moves in the current, metres (0: rigid)
 *   depth    [lo, hi] metres of water it lives under (light for what makes its food from it, cold dark for what does not)
 *   seat     where it sits in a composition: `rock` (the hardscape itself), `on` (grown on a rock), `foot` (round a
 *            rock's foot), `stand` (standing in groups of its own on the bed), `carpet` (in drifts over open sand)
 *   colours  [base, tip] pairs (#rrggbb): a copy takes one by its dice
 *
 * A MIX is a composition by name, the way an aquarium is laid: the rock first, what grows on it, what sits round its
 * foot, what stands apart, what carpets the sand between; each a weight by kind. A new thing is a row; a new composition
 * is a mix.
 *
 *   readMarine(spec, { zone?, depth? })   a biocube's `flora.marine`: a mix's word, true (the mix its sea's zone
 *                                         grows), or { mix?, density?, kinds?, seed? } → the composition, each seat's
 *                                         kinds weighed and those that do not live at the depth left out and named
 */
import { MARINE_GROWS } from './forms.js';

const fz = Object.freeze;
const row = (o) => fz({ ...o, says: fz(o.says), h: fz(o.h), w: fz(o.w), depth: fz(o.depth), colours: fz(o.colours.map(fz)) });

export const MARINE_SEATS = fz(['rock', 'on', 'foot', 'stand', 'carpet']);

export const MARINE_KINDS = fz({
  bommie: row({ says: ['bommie', 'reef rock', 'coral head', 'outcrop'], grow: 'rock', h: [0.45, 1.3], w: [1.4, 3.4], sway: 0, depth: [0, 11000], seat: 'rock', reads: 'a lumpy mound of reef rock, mottled: the hardscape the rest is set on',
    colours: [['#b3a892', '#d9a3b4'], ['#a59f8c', '#9fb46e'], ['#9c9388', '#cbb38a']] }),
  staghorn: row({ says: ['staghorn', 'branching coral', 'antler coral'], grow: 'branch', h: [0.5, 1.2], w: [0.5, 1.2], n: 5, sway: 0, depth: [0, 35], seat: 'on', reads: 'forking branches, pale at their tips',
    colours: [['#e07a2e', '#ffe9c2'], ['#5f8fe0', '#e6f0ff'], ['#e0b81e', '#fff6b8']] }),
  table: row({ says: ['table coral', 'plate coral', 'acropora'], grow: 'table', h: [0.25, 0.6], w: [0.7, 1.8], sway: 0, depth: [0, 30], seat: 'on', reads: 'a wide plate on a stalk, its rim irregular',
    colours: [['#d9954a', '#ffe6a8'], ['#4fae6a', '#d6f2a4'], ['#b06ad0', '#f0d0f5']] }),
  brain: row({ says: ['brain coral', 'boulder coral', 'massive coral'], grow: 'dome', h: [0.25, 0.7], w: [0.4, 1.2], sway: 0, depth: [0, 45], seat: 'on', reads: 'a boulder ribbed in meanders',
    colours: [['#c9a424', '#fbe77a'], ['#4f9a4a', '#c6e278'], ['#d0604a', '#f7b48c']] }),
  pillar: row({ says: ['pillar coral', 'finger coral'], grow: 'fingers', h: [0.5, 1.4], w: [0.45, 0.95], n: 8, sway: 0, depth: [0, 40], seat: 'on', reads: 'a cluster of upright round-topped fingers',
    colours: [['#d99a4a', '#fbe6b0'], ['#e0607c', '#ffd4dc'], ['#6a7ae0', '#dce2ff']] }),
  fan: row({ says: ['sea fan', 'gorgonian', 'fan coral'], grow: 'fan', h: [0.7, 1.8], w: [0.6, 1.6], sway: 0.07, depth: [3, 300], seat: 'on', reads: 'a lattice forking in one plane, square to the current',
    colours: [['#8e3fa0', '#d59ae0'], ['#c8432e', '#f2a071'], ['#c9a227', '#f5e08a']] }),
  whip: row({ says: ['sea whip', 'whip coral', 'wire coral'], grow: 'whips', h: [0.8, 2.4], w: [0.3, 0.8], n: 5, sway: 0.22, depth: [10, 900], seat: 'stand', reads: 'a few long thin rods bending in the current',
    colours: [['#b4452f', '#f0b08a'], ['#d9cdb4', '#ffffff'], ['#c7902c', '#f4dc9a']] }),
  barrel: row({ says: ['barrel sponge', 'vase sponge'], grow: 'barrel', h: [0.4, 1.3], w: [0.4, 1.1], sway: 0, depth: [5, 600], seat: 'foot', reads: 'a ribbed vase, open at the top',
    colours: [['#7a4a3a', '#b98466'], ['#6a5a7a', '#a898b8'], ['#8a6a3a', '#c8a86a']] }),
  tube: row({ says: ['tube sponge', 'pipe sponge'], grow: 'tubes', h: [0.3, 0.9], w: [0.3, 0.7], n: 4, sway: 0, depth: [3, 800], seat: 'foot', reads: 'a cluster of open pipes',
    colours: [['#c9a21f', '#f6e27a'], ['#7c4fb0', '#c7a6ea'], ['#c4572a', '#f3a878']] }),
  anemone: row({ says: ['anemone', 'sea anemone'], grow: 'anemone', h: [0.25, 0.6], w: [0.35, 0.8], n: 30, sway: 0.05, depth: [0, 6000], seat: 'foot', reads: 'a column and a crown of tentacles waving',
    colours: [['#b8674a', '#ffd9c2'], ['#4f9a6a', '#d8f5c0'], ['#8a4fa8', '#f0c8ff'], ['#c9c0b0', '#ffffff']] }),
  tubeworm: row({ says: ['tube worm', 'tubeworm', 'vent worm'], grow: 'worms', h: [0.5, 1.6], w: [0.4, 1], n: 8, sway: 0.04, depth: [300, 11000], seat: 'on', reads: 'pale tubes in a clump, a red plume at each mouth',
    colours: [['#8e1f1a', '#e2463a'], ['#a8301f', '#f06a4a']] }),
  seapen: row({ says: ['sea pen', 'seapen'], grow: 'pen', h: [0.3, 0.9], w: [0.15, 0.45], n: 12, sway: 0.08, depth: [15, 6000], seat: 'stand', reads: 'a feather on a stalk, standing in soft ground',
    colours: [['#c26a3a', '#ffd0a0'], ['#d9d2c4', '#ffffff'], ['#a8507a', '#f4bcd6']] }),
  kelp: row({ says: ['kelp', 'giant kelp', 'seaweed', 'kelp forest'], grow: 'kelp', h: [3, 9], w: [0.6, 1.6], n: 3, sway: 0.7, depth: [2, 35], seat: 'stand', reads: 'stipes rising in a slow curve, blades hanging from them',
    colours: [['#6b6a22', '#b3a23c'], ['#5a5a1e', '#9c8a34'], ['#4f6a2a', '#9ab04a']] }),
  seagrass: row({ says: ['seagrass', 'eelgrass', 'turtle grass'], grow: 'grass', h: [0.3, 0.8], w: [0.3, 0.6], n: 20, sway: 0.12, depth: [0, 25], seat: 'carpet', reads: 'a tuft of ribbon blades',
    colours: [['#2f7a3a', '#6fc04a'], ['#3a8a4a', '#86cc5a'], ['#4a7a2e', '#8ab848']] }),
  lettuce: row({ says: ['sea lettuce', 'ulva', 'algae'], grow: 'lettuce', h: [0.12, 0.3], w: [0.35, 0.8], n: 6, sway: 0.03, depth: [0, 20], seat: 'carpet', reads: 'low ruffled fronds',
    colours: [['#4a9a3a', '#b4ec7a'], ['#7a3a4a', '#d98a9a'], ['#6a8a2a', '#cfe07a']] }),
});
export const MARINE_KIND_IDS = fz(Object.keys(MARINE_KINDS));

const mix = (o) => fz({ ...o, on: fz(o.on), foot: fz(o.foot), stand: fz(o.stand), carpet: fz(o.carpet) });
/** The compositions. `rock`: the share of its patches that are set on a rock; `patches`: patches a hundred square metres;
 *  `stands`: groups standing apart a hundred square metres; `cover`: the share of the open sand its drifts cover. */
export const MARINE_MIXES = fz({
  reef: mix({ reads: 'a coral reef: rocks crowded with hard corals, fans on their flanks, anemones and sponges at their feet, grass on the sand between',
    rock: 0.9, patches: 2.4, stands: 0.5, cover: 0.2, on: { staghorn: 3, table: 2, brain: 2, pillar: 1.5, fan: 1.2 }, foot: { anemone: 2, tube: 1.5, barrel: 1, lettuce: 1 }, stand: { kelp: 1, whip: 1 }, carpet: { seagrass: 3, lettuce: 1 } }),
  kelp: mix({ reads: 'a kelp forest: tall stipes in groves over low rock, lettuce and anemones under them',
    rock: 0.5, patches: 1.2, stands: 2.6, cover: 0.15, on: { brain: 1, pillar: 0.6 }, foot: { anemone: 2, lettuce: 2, tube: 1 }, stand: { kelp: 6 }, carpet: { lettuce: 2, seagrass: 1 } }),
  meadow: mix({ reads: 'a seagrass meadow: open sand under drifts of grass, a rock here and there',
    rock: 0.6, patches: 0.8, stands: 0.2, cover: 0.5, on: { brain: 2, pillar: 1, staghorn: 1 }, foot: { anemone: 2, lettuce: 1 }, stand: { kelp: 1 }, carpet: { seagrass: 5, lettuce: 1 } }),
  wall: mix({ reads: 'the blue\'s garden: sponges, fans and whips on rock, nothing that needs the sun',
    rock: 0.95, patches: 2, stands: 1.1, cover: 0, on: { fan: 3, pillar: 0.5, brain: 0.5 }, foot: { barrel: 2, tube: 2, anemone: 1 }, stand: { whip: 3, seapen: 1 }, carpet: {} }),
  deep: mix({ reads: 'the twilight\'s bed: whips and pens standing in soft ground, pale anemones on bare rock',
    rock: 0.7, patches: 1.1, stands: 1.7, cover: 0, on: { fan: 1 }, foot: { anemone: 2, tube: 1, barrel: 1 }, stand: { seapen: 3, whip: 2 }, carpet: {} }),
  vents: mix({ reads: 'the midnight\'s oases: rock crowded with tube worms, anemones round it, pens on the ooze',
    rock: 1, patches: 1.2, stands: 0.9, cover: 0, on: { tubeworm: 4 }, foot: { anemone: 2, tubeworm: 1 }, stand: { seapen: 2 }, carpet: {} }),
});
export const MARINE_MIX_IDS = fz(Object.keys(MARINE_MIXES));
/** The mix each of the sea's zones grows (scene/channels/sea.js SEA.zones) where a recipe names none. */
export const MARINE_OF_ZONE = fz({ shallows: 'reef', reef: 'reef', blue: 'wall', twilight: 'deep', midnight: 'vents' });
/** A page's most: copies in all, and triangles (a kind past its share is thinned, never cut whole). */
export const MARINE_BUDGET = fz({ items: 1500, tris: 520000 });

const KEYS = ['mix', 'density', 'kinds', 'seed'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** A biocube's `flora.marine`, checked: a mix's word, true, or { mix?, density? (0.2–3: how crowded, × the mix's), kinds?
 *  ({ <kind>: 0–5 }: its weight × the mix's; 0 takes it out; a kind the mix lacks is added to its own seat), seed? }.
 *  → { mix: <id> | null (its zone's), density, kinds, seed? }. Absent / false / null → null. */
export function checkMarine(v) {
  if (v === undefined || v === null || v === false) return null;
  const say = `flora.marine is a mix (${MARINE_MIX_IDS.join(', ')}), true (what its sea's zone grows), or { ${KEYS.join(', ')} }: what grows on the bed and does not swim`;
  const o = v === true ? {} : typeof v === 'string' ? { mix: v } : isObj(v) ? v : null;
  if (!o) throw new Error(say);
  for (const k of Object.keys(o)) if (!KEYS.includes(k)) throw new Error(`flora.marine.${k} is not a setting (${KEYS.join(', ')})`);
  if (o.mix !== undefined && !Object.hasOwn(MARINE_MIXES, o.mix)) throw new Error(`flora.marine.mix is one of: ${MARINE_MIX_IDS.join(', ')}`);
  const density = o.density ?? 1;
  if (!(typeof density === 'number' && density >= 0.2 && density <= 3)) throw new Error('flora.marine.density is how crowded the bed is, 0.2 to 3 (× the mix\'s own)');
  if (o.kinds !== undefined) {
    if (!isObj(o.kinds)) throw new Error(`flora.marine.kinds is { <kind>: weight 0–5 }, the kinds of: ${MARINE_KIND_IDS.join(', ')}`);
    for (const [k, w] of Object.entries(o.kinds)) {
      if (!Object.hasOwn(MARINE_KINDS, k)) throw new Error(`flora.marine.kinds.${k} is not a marine kind (${MARINE_KIND_IDS.join(', ')})`);
      if (!(typeof w === 'number' && w >= 0 && w <= 5)) throw new Error(`flora.marine.kinds.${k} is its weight, 0 (none) to 5`);
    }
  }
  if (o.seed !== undefined && !Number.isInteger(o.seed)) throw new Error('flora.marine.seed is a whole number');
  return { mix: o.mix ?? null, density, kinds: { ...(o.kinds ?? {}) }, ...(o.seed !== undefined ? { seed: o.seed } : {}) };
}

/** The composition a checked marine grows under `depth` metres of water in the sea's `zone` (no sea: the reef's, at its
 *  depth): each seat's kinds and weights, with those that do not live at the depth left out and named in `left`
 *  ([{ kind, why }]: advice, never a refusal). → { mix, reads, depth, rock, patches, stands, cover, seats, left, seed? } */
export function readMarine(spec, { zone = null, depth = null } = {}) {
  const C = checkMarine(spec);
  if (!C) return null;
  const id = C.mix ?? MARINE_OF_ZONE[zone] ?? 'reef', X = MARINE_MIXES[id], d = depth ?? 14, left = [], seats = {};
  for (const seat of MARINE_SEATS.slice(1)) {
    const W = { ...X[seat] };
    for (const [k, w] of Object.entries(C.kinds)) if (MARINE_KINDS[k].seat === seat) W[k] = (W[k] ?? 1) * w;
    seats[seat] = {};
    for (const [k, w] of Object.entries(W)) {
      if (!(w > 0)) continue;
      const [lo, hi] = MARINE_KINDS[k].depth;
      if (d < lo || d > hi) { left.push({ kind: k, why: `lives under ${lo} to ${hi} m of water, not ${d}` }); continue; }
      seats[seat][k] = w;
    }
  }
  const rock = C.kinds.bommie === 0 ? 0 : X.rock;
  return { mix: id, reads: X.reads, depth: d, rock, patches: X.patches * C.density, stands: X.stands * C.density, cover: Math.min(0.9, X.cover * C.density), seats, left, ...(C.seed !== undefined ? { seed: C.seed } : {}) };
}

// (every row names a way of growing the kernel has: a row that does not is refused where the roster is read)
for (const [id, K] of Object.entries(MARINE_KINDS)) if (!MARINE_GROWS.includes(K.grow) || !MARINE_SEATS.includes(K.seat)) throw new Error(`marine roster: '${id}' names a way of growing or a seat that is not one`);
