/**
 * New-house draw — what a NEW generated house is, picked from its seed at mint (sketch-mint.js) and written into the
 * recipe as ordinary knobs: a tier and its program (`tier: { base, beds, study, core }`), its storeys (`levels`, with
 * a stair), a footprint sized to that program, and its front (windows, an entry door, a porch or a stoop by style).
 * The render never draws: a minted house holds what was drawn, and every knob the caller gave wins over the draw.
 *
 * One labelled stream per choice (floorplan-styles.js's idea), so adding a choice never reshuffles the others.
 */
import { HOUSE_TIERS } from './floorplan-glyphs.js';
import { houseStyleOpts, houseStyleKey } from './floorplan-styles.js';
import { structurizeHouse } from './floorplan-structure.js';

const fnv1a = (str) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
};
const roll = (seed, label) => {
  let a = fnv1a(`${seed}|house|${label}`);
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const weighted = (r, table) => {
  const total = Object.values(table).reduce((s, w) => s + w, 0);
  let acc = 0;
  for (const [k, w] of Object.entries(table)) { acc += w / total; if (r < acc) return k; }
  return Object.keys(table).at(-1);
};
const pickOf = (r, list) => list[Math.floor(r * list.length) % list.length];

// The odds a new house is drawn with, by tier. A list is uniform (name a value twice to weight it).
export const HOUSE_DRAW = {
  tier: { cottage: 0.3, house: 0.45, villa: 0.25 },
  cottage: { beds: [1, 1, 2], study: 0.15, dining: 0.25, twoStorey: 0.2 },
  house: { beds: [2, 3, 3, 4], study: 0.6, dining: 0.8, twoStorey: 0.5 },
  villa: { beds: [3, 4, 4, 5], study: 0.8, dining: 1, twoStorey: 0.7 },
  // a porch, a stoop or neither, by the house style's family
  front: {
    cottage: { porch: 0.6, stoop: 0.25, none: 0.15 }, brick: { stoop: 0.5, porch: 0.3, none: 0.2 },
    modern: { none: 0.6, stoop: 0.4 }, tofu: { none: 0.7, stoop: 0.3 }, mission: { porch: 0.4, none: 0.4, stoop: 0.2 },
    plain: { none: 0.5, stoop: 0.3, porch: 0.2 },
  },
};

/** Whether a manifest leaves its plan to the generator (no authored rooms or stack, the program generator not refused). */
export function leavesHouseToDraw(m) {
  return !!m && m.kind === 'floorplan' && !(Array.isArray(m.rooms) && m.rooms.length) && !(Array.isArray(m.levels) && m.levels.length)
    && m.storeys == null && m.floors == null && m.program !== false && !m.bsp && m.corridors !== true;
}

/**
 * A new house's draw → the knobs to stamp (only those the manifest leaves out). `m` must carry its seed. Returns {}
 * for a manifest that authors its own plan.
 */
export function drawNewHouse(m) {
  if (!leavesHouseToDraw(m) || m.seed == null) return {};
  const seed = m.seed, out = {};
  let tier = m.tier;
  if (tier === undefined) {
    const base = weighted(roll(seed, 'tier'), HOUSE_DRAW.tier), d = HOUSE_DRAW[base];
    tier = {
      base,
      beds: pickOf(roll(seed, 'beds'), d.beds),
      study: roll(seed, 'study') < d.study,
      core: roll(seed, 'dining') < d.dining ? ['L', 'K', 'D'] : ['L', 'K'],
    };
    out.tier = tier;
  }
  const base = typeof tier === 'string' ? tier : (tier && tier.base) || 'house';
  const d = HOUSE_DRAW[base] || HOUSE_DRAW.house;
  Object.assign(out, fitProgram(m, seed, base, tier, roll(seed, 'storeys') < d.twoStorey, out.tier !== undefined));
  if (m.windows === undefined) out.windows = true;
  if (m.entryDoor === undefined) out.entryDoor = true;
  if (m.porch === undefined && m.stoop === undefined) {
    let family = 'plain';
    try { family = houseStyleOpts(m.style === undefined ? 'auto' : m.style, houseStyleKey(m), undefined).styleName || 'plain'; } catch { /* the mint refuses a bad style */ }
    const front = weighted(roll(seed, 'front'), HOUSE_DRAW.front[family] || HOUSE_DRAW.front.plain);
    if (front !== 'none') out[front] = true;
  }
  return out;
}

// The storeys and footprint that hold the drawn program, checked against the program generator itself (a plan-only
// build is under a millisecond): the generator fits as many bedrooms as a floor affords, and a single floor hangs
// them, the study and a bath in one row capped by the tier, so a drawn program can ask for more than a footprint or a
// row holds. Grow the footprint; on one floor lengthen the bedroom wing (a drawn tier only); last, add a storey.
const STOREYS = (two) => (two ? [{ role: 'ground' }, { role: 'second' }] : [{ role: 'ground' }]);
function fitProgram(m, seed, base, tier, two, drawnTier) {
  const t = HOUSE_TIERS[base] || HOUSE_TIERS.house;
  const program = typeof tier === 'object' && tier ? tier : {};
  const beds = program.beds ?? t.beds, study = program.study ?? t.study;
  // the generator's own count: upstairs a study takes the last bedroom slot of three or more
  const want = (twoStorey) => Math.max(1, beds - (twoStorey && study && beds >= 3 ? 1 : 0));
  const sized = m.width != null || m.height != null;
  const bedroomsOf = (trial) => {
    try {
      const h = structurizeHouse(trial, { ...trial, furnish: false, view: 'cutaway', windows: false, entryDoor: false, facadeDecor: false, wallDecor: false, style: null });
      return h.levels.reduce((n, l) => n + (l.structure?.plan?.rooms || []).filter((r) => r.glyph === 'B').length, 0);
    } catch { return 0; }
  };
  let best = null;
  for (const storeys of two ? [true] : [false, true]) {
    const fp0 = sized ? {} : footprintFor(seed, base, tier, storeys);
    const wing = !storeys && drawnTier ? beds + (study ? 1 : 0) + 1 : null;   // bedrooms, the study and a bath in a row
    const tierHere = wing && wing > t.maxPerRow ? { ...program, maxPerRow: wing } : tier;
    for (const grow of sized ? [1] : [1, 1.12, 1.25, 1.4, 1.6]) {
      const fp = sized ? {} : { width: Math.round(fp0.width * Math.sqrt(grow) * (wing ? 1.08 : 1)), height: Math.round(fp0.height * Math.sqrt(grow)) };
      const knobs = { levels: STOREYS(storeys), ...(storeys && m.stairs === undefined ? { stairs: true } : {}), ...fp, ...(tierHere !== tier ? { tier: tierHere } : {}) };
      const got = bedroomsOf({ ...m, ...(drawnTier ? { tier } : {}), ...knobs });
      if (!best || got > best.got) best = { got, knobs };
      if (got >= want(storeys)) return knobs;
    }
  }
  return best.knobs;
}

// the footprint a program wants: the tier's, grown or shrunk by its rooms, per storey, at a drawn proportion
function footprintFor(seed, base, tier, two) {
  const t = HOUSE_TIERS[base] || HOUSE_TIERS.house;
  const program = typeof tier === 'object' && tier ? tier : {};
  const beds = program.beds ?? t.beds;
  let area = t.footprint.width * t.footprint.height;
  area *= 1 + 0.14 * (beds - t.beds);
  if (program.study === false && t.study) area *= 0.94;
  if (program.core && !program.core.includes('D') && t.core.includes('D')) area *= 0.92;
  area *= 0.9 + 0.22 * roll(seed, 'size');
  if (two) area *= 0.7;                                       // the bedrooms go upstairs: each floor holds less
  const aspect = 1.05 + 0.4 * roll(seed, 'aspect');           // wider than deep, the street front the long side
  const width = Math.max(26, Math.round(Math.sqrt(area * aspect)));
  const height = Math.max(22, Math.round(area / width));
  return { width, height };
}
