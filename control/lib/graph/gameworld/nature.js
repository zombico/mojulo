/**
 * THE NATURAL WORLD — what a kit makes of the land, read from its style card: how its cliffs stand, its trees grow
 * and its grass lies, how its water runs, its sky by day or by night (the sun and its clouds, the moon, the stars, a
 * world hanging in the sky), its light and its air, and its far layers. No creatures: what lives on the land is left
 * open with the world's characters.
 *
 * `natureCard(kit)` is the card. `landOfKit(kit)` reads the kit's LAND from its style card: each form of the land
 * index (era/out-land.js) as a variant and a step from little to many, the way the kit already draws it (its cumulus
 * or its clear night, how many boulders it strews, how its cliff is bedded and jointed); `landFor(kit, land)` lays a
 * world's or a level's choices over it. Pure.
 */
import { stageKit } from '../era/stage.js';
import { lookOf } from '../era/style/looks.js';
import { NATURE_STYLES } from '../era/nature.js';
import { ISEKAI_STYLES } from '../era/isekai.js';
import { JUNGLE_STYLES } from '../era/jungle.js';
import { swatchesOf } from '../era/style/swatches.js';
import { LAND_FORMS, LAND_FORM_IDS, manyStep } from '../era/out-land.js';

const SHELLS = { nature: NATURE_STYLES, isekai: ISEKAI_STYLES, jungle: JUNGLE_STYLES };
const r2 = (v) => Math.round(v * 100) / 100;
const range = (a) => (Array.isArray(a) ? `${a[0]}–${a[1]}` : `${a}`);
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** What each ramp of a palette paints. */
export const RAMP_KEY = Object.freeze({
  grass: 'the ground, the grass and the near hills', soil: 'the trail and bare earth', rock: 'cliffs, boulders and scree',
  foliage: 'tree crowns and shrubs', bark: 'trunks and branches', far: 'the far layers', sky: 'the sky dome', cloud: 'clouds',
  timber: 'what is built of wood', stone: 'what is built of stone', plaster: 'plastered walls', thatch: 'thatch', tile: 'roof tiles',
  glow: 'what glows: water, lantern plants, lit crowns', lens: 'lit lenses and lamps', rope: 'rope and cord', paint: 'paint on what is built',
});

const cardOf = (kit) => { const K = stageKit(kit); return SHELLS[K.shell][K.style] ?? lookOf(kit)?.card; };

/** A kit's natural world, read from its style card. */
export function natureCard(kit) {
  const K = stageKit(kit), S = cardOf(kit), L = S.landform || {}, T = S.trees || {}, G = S.grass || {}, N = S.night || null;
  const glows = !!S.glow, water = S.water?.fill ?? '#7f95ab';
  return {
    kind: 'nature', id: kit, look: K.style, principles: [...(S.principles || [])],
    cliffs: L.face ? `a face of ${L.face}°, thrown ${L.throw} m back, its beds every ${L.bed} m and its joints every ${L.joint} m, a talus ${S.cliff?.talus ?? 3} m wide at its foot` : 'the kit\'s own',
    trees: T.heights ? `${T.clusters} stands of ${range(T.perCluster)}, ${range(T.heights)} m tall, crowns of ${range(T.crown?.masses ?? [])} masses${T.crown?.squash > 1 ? ', drawn tall' : ''}${glows ? ', their crowns glowing' : ''}; one hero tree ${T.hero?.h ?? '—'} m` : 'the kit\'s own',
    grass: G.height ? `${range(G.height)} m tall, tussocks on the fringe, meadow inside, sedge under the cliff` : 'the kit\'s own',
    water: { fill: water, read: `a painted ribbon, ${water}, a little under half see-through${glows ? '; it glows, the brightest line on the ground' : ''}` },
    sky: N
      ? { time: 'night', read: `night: stars${N.moon ? `, a moon (size ${N.moon.size}, phase ${N.moon.phase})` : ''}${N.planet ? `, a world hanging ${N.planet.elevation}° up, ${N.planet.size} times the moon` : ''}` }
      : { time: 'day', read: `day: ${S.sun ? `a sun (size ${S.sun.size}, glow ${S.sun.glow})` : 'no sun'}${S.cumulus ? `, cumulus in ${S.cumulus.tiers.length} tiers leaning toward it` : ''}${S.companion ? `, a world hanging ${S.companion.elevation}° up in the day, ${S.companion.size} times the moon` : ''}` },
    light: S.light ? `key ${S.light.key.color} from ${S.light.key.elevation}° up, ambient ${S.light.ambient}` : 'the kit\'s own',
    air: S.air?.fog ? `fog ${S.air.fog.color}, density ${S.air.fog.density}` : 'clear',
    far: Array.isArray(S.layers) ? `${S.layers.length} far layers, the nearest ${range(S.layers[0].height)} m high at ${S.layers[0].at} m` : 'none',
  };
}

/** A kit's palette as a key: each ramp, shadow to light, and what it paints. */
export function colorKey(kit) {
  const K = stageKit(kit), sw = swatchesOf(K.style) || {}, out = [];
  for (const [part, ramps] of [['land', sw.land || {}], ['made', sw.made || {}]]) for (const [name, r] of Object.entries(ramps)) {
    const stops = Array.isArray(r) && Array.isArray(r[0]) ? r : typeof r === 'string' && Array.isArray(sw.land?.[r]) ? sw.land[r] : null;
    if (stops) out.push({ part, name, stops: stops.map(hex), paints: RAMP_KEY[name] ?? name, shared: typeof r === 'string' ? r : null });
  }
  return { kit, ramps: out };
}

const step = (rail, v) => Math.max(0, Math.min(1, (v - rail[0]) / (rail[1] - rail[0])));

/** A kit's land as its style card already draws it: each form a variant and a step from little to many. */
export function landOfKit(kit) {
  const S = cardOf(kit), L = S.landform || {}, R = LAND_FORMS;
  const beds = L.bed ? 14 / L.bed : 6, joints = L.joint ? 24 / L.joint : 7, boulders = S.rubble?.boulders ?? 6;
  return {
    landscape: { variant: (L.throw ?? 15) > 18 ? 'hummocky' : 'meadow', many: 0.5 },
    rock: { variant: 'boulders', many: r2(step(R.rock.rails.count, Math.min(14, boulders))) },
    strata: { variant: 'layered', many: r2(step(R.strata.rails.beds, beds)) },
    face: { variant: 'blocky', many: r2(step(R.face.rails.joints, joints)) },
    cloud: { variant: 'cumulus', many: S.cumulus ? 0.5 : 0 },
    landmark: { variant: 'monolith', many: 0 },
  };
}

/** A kit's land with a world's or a level's choices laid over it, each form's step named. */
export function landFor(kit, land = {}) {
  const base = landOfKit(kit);
  return Object.fromEntries(LAND_FORM_IDS.map((f) => {
    const o = { ...base[f], ...(land[f] || {}) };
    return [f, { ...o, word: LAND_FORMS[f].many.words[manyStep(o.many)], own: !!land[f] }];
  }));
}
