/**
 * THE NATURAL WORLD — what a kit makes of the land, read from its style card: how its cliffs stand, its trees grow
 * and its grass lies, how its water runs, its sky by day or by night (the sun and its clouds, the moon, the stars, a
 * world hanging in the sky), its light and its air, and its far layers. No creatures: what lives on the land is left
 * open with the world's characters.
 *
 * `natureCard(kit)` is the card. `landOfKit(kit)` reads the kit's LAND from its style card: each form of the land
 * index (era/out-land.js) as a variant and a step from little to many, the way the kit already draws it (its cumulus
 * or its clear night, how many boulders it strews, how its cliff is bedded and jointed); `landFor(kit, land)` lays a
 * world's or a level's choices over it; `landToLevel(kit, land, …)` lowers those choices onto the settings a walk's
 * stages draw them by (the other way round from landOfKit), and names each form's gaps. Pure.
 */
import { stageKit } from '../era/stage.js';
import { lookOf } from '../era/style/looks.js';
import { NATURE_STYLES } from '../era/nature.js';
import { ISEKAI_STYLES } from '../era/isekai.js';
import { JUNGLE_STYLES } from '../era/jungle.js';
import { swatchesOf } from '../era/style/swatches.js';
import { LAND_FORMS, LAND_FORM_IDS, manyStep, landDials } from '../era/out-land.js';
import { OUT_TRAIL, landmarkStands } from '../era/out-trail.js';

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

// ── the land in the level ─────────────────────────────────────────────────────────────────────────────────────────
/** The sky a cloud's variant is painted as (matte-paint/sky.js WEATHERS); lenticular has no lens sheet there. */
export const CLOUD_SKY = Object.freeze({ cumulus: 'fair', towering: 'storm', stratus: 'overcast', cirrus: 'high' });
/** The relief card a landscape's variant starts a climb's plain from (noise/relief.js RELIEF_CARDS). */
export const LANDSCAPE_RELIEF = Object.freeze({ meadow: 'rolling', downs: 'rolling', hummocky: 'rolling', terraced: 'terraced', rugged: 'craggy' });
/** The joint pattern a face's variant is cut in (polygonizer/landform.js JOINT_PATTERNS); fluted and crag have none. */
export const FACE_PATTERN = Object.freeze({ columnar: 'columnar', blocky: 'blocky', slabby: 'slabby' });
const within = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const makesOf = (f, v) => LAND_FORMS[f].makes[Object.keys(LAND_FORMS[f].variants).indexOf(v)] ?? v;

/**
 * A world's (or a level's) land lowered onto the settings a walk's stages already draw by: the other way round from
 * landOfKit. Only what `land` names is lowered (a variant its own settings, a step its count); what it leaves out stays
 * the kit's own, and no setting is written for it. → null when `land` names no form, else
 *   { trail?: { ground?: { bump?, cliff? }, rocks? }, meru?: { relief }, clouds?, forms: { <form>: { variant, many,
 *     word, on: [section], became: [line], gaps: [line] } } } (`on`: the sections it is drawn on; `gaps`: what it names
 *     that no stage draws)
 *   landscape  the trails' mounds (`ground.bump`: height and scale) and the climb's plain (`relief`), from the variant's
 *              rails at its step (the kit's step under a named variant); terraces on a trail are a gap
 *   rock       how many boulders the trails strew (`rocks.boulders`); a shape other than boulders is a gap
 *   strata     the trail cliff's beds (`ground.cliff.bed`; `dip` when tilted); graded, folded, unconformity are gaps
 *   face       the trail cliff's joints (`ground.cliff.joint`; `pattern` columnar, blocky, slabby); fluted, crag are gaps
 *   cloud      the level's sky (`clouds`, on every stage its geocube paints); lenticular, and a level no cube paints, gaps
 *   landmark   the trail's landmark stone (`rocks.landmark`, a monolith's height); falls, water off its far cliff
 *              (`ground.water.falls`, era/out-water.js); any other landmark, and company, gaps
 * A climb draws the landscape and the cloud; the rest stand on a trail (a climb's few boulders round its foot are its own). `seed` rolls each variant's dials (out-land.js
 * landDials); `painted`: a geocube paints the level; `sections`: which of trail and meru its walk has; `trail`: the trail
 * settings the style hands down (a bumpiness named there keeps the mounds' height).
 */
export function landToLevel(kit, land = {}, { seed = 1, painted = false, sections = ['trail', 'meru'], trail: written = {} } = {}) {
  const named = LAND_FORM_IDS.filter((f) => land[f] && (land[f].variant !== undefined || land[f].many !== undefined));
  if (!named.length) return null;
  const L = landFor(kit, land), trail = {}, meru = {}, forms = {}, onTrail = sections.includes('trail'), onClimb = sections.includes('meru');
  let clouds = null;
  const dials = (f, many) => landDials(f, L[f].variant, seed, many === undefined ? {} : { many }).X;
  const ground = () => (trail.ground ??= {}), cliff = () => (ground().cliff ??= {}), rocks = () => (trail.rocks ??= {});
  for (const f of named) {
    const own = land[f], o = L[f], became = [], gaps = [];
    if (f === 'landscape') {
      // (terraces only where the variant is terraced: the others' rail rolls them by chance on the index page)
      const X = dials(f, o.many), half = X.relief / 2, terraces = LAND_FORMS.landscape.variants[o.variant].terraces ? X.terraces : 0;
      // (a trail that names its bumpiness keeps its mounds' height: the land sizes them)
      ground().bump = { ...(written.bumpiness === undefined ? { height: r2(within(half, 0, 8)) } : {}), scale: r2(within(12.5 / X.wave, 0.25, 4)) };
      meru.relief = { from: LANDSCAPE_RELIEF[o.variant], height: r2(within(half, 0, 12)), scale: r2(within(X.wave, 8, 400)), ...(terraces >= 1 ? { terrace: { step: r2(within(X.relief / (terraces + 1), 0.1, 10)), riser: 0.3 } } : {}) };
      if (onTrail) became.push(trail.ground.bump.height === undefined ? `the trails' mounds sized to it, their height the trail's own bumpiness (trail.ground.bump.scale)` : `the trails' ground in mounds ${trail.ground.bump.height} m high (trail.ground.bump)`);
      if (onClimb) became.push(`the climb's plain in ${meru.relief.from} relief ${meru.relief.height} m high${meru.relief.terrace ? ', stepped' : ''} (meru.relief)`);
      if (terraces >= 1 && onTrail) gaps.push(`${o.variant}: a trail's ground is not stepped into terraces${onClimb ? ' (the climb\'s plain is)' : ''}`);
    } else if (f === 'rock') {
      if (own.many !== undefined) { rocks().boulders = Math.round(1 + 13 * own.many); if (onTrail) became.push(`${trail.rocks.boulders} boulder${trail.rocks.boulders === 1 ? '' : 's'} strewn beside each trail (trail.rocks.boulders)`); }
      if (own.variant === 'boulders' && own.many === undefined && onTrail) became.push('boulders: the kit\'s own, as drawn');
      if (own.variant !== undefined && own.variant !== 'boulders') gaps.push(`${own.variant}: not drawn; a trail strews boulders, not ${makesOf(f, own.variant)}`);
    } else if (f === 'strata') {
      if (own.many !== undefined) { cliff().bed = r2(14 / dials(f, own.many).beds); if (onTrail) became.push(`the trail cliff bedded every ${trail.ground.cliff.bed} m (trail.ground.cliff.bed)`); }
      if (own.variant === 'tilted') { cliff().dip = r2(dials(f).dip); if (onTrail) became.push(`its beds tilted ${trail.ground.cliff.dip}° (trail.ground.cliff.dip)`); }
      else if (own.variant === 'layered' && own.many === undefined && onTrail) became.push('layered: the kit\'s own beds, as drawn');
      else if (own.variant !== undefined && own.variant !== 'layered') gaps.push(`${own.variant}: not drawn; a cliff's beds are laid even${own.variant === 'unconformity' ? ', all at one tilt' : ''}`);
    } else if (f === 'face') {
      if (own.many !== undefined) { cliff().joint = r2(24 / dials(f, own.many).joints); if (onTrail) became.push(`the trail cliff jointed every ${trail.ground.cliff.joint} m (trail.ground.cliff.joint)`); }
      if (own.variant !== undefined && FACE_PATTERN[own.variant]) { cliff().pattern = FACE_PATTERN[own.variant]; if (onTrail) became.push(`its joints cut ${own.variant} (trail.ground.cliff.pattern)`); }
      else if (own.variant !== undefined) gaps.push(`${own.variant}: not drawn; a cliff's joints are cut blocky, columnar or slabby`);
    } else if (f === 'cloud') {
      if (!CLOUD_SKY[o.variant]) gaps.push(`${o.variant}: not drawn; the sky paints no lens clouds`);
      else if (!painted) gaps.push('no geocube paints this level: its sky is the kit\'s own');
      else { clouds = { kind: CLOUD_SKY[o.variant], cover: r2(o.many) }; became.push(`${/^[aeiou]/.test(clouds.kind) ? 'an' : 'a'} ${clouds.kind} sky at cover ${clouds.cover} over every stage the cube paints (clouds)`); }
    } else if (f === 'landmark') {
      // (a monolith's height, its place on its rail, laid on the trail's own landmark stone: its sizes, at its card's rock unit)
      if (own.variant === 'monolith') { const rail = LAND_FORMS.landmark.variants.monolith.height, S = OUT_TRAIL.landmark.sizes, t = within((dials(f).height - rail[0]) / (rail[1] - rail[0]), 0, 1); rocks().landmark = r2(landmarkStands(cardOf(kit), S[0] + (S[S.length - 1] - S[0]) * t)); if (onTrail) became.push(`the trail's landmark stone, ${trail.rocks.landmark} m tall (trail.rocks.landmark)`); }
      // (falls: water off the trail's far cliff, era/out-water.js: a brook to the lip, the fall, a pool at its foot, the
      // crossing's stream rising from it)
      else if (own.variant === 'falls') { ground().water = { ...(ground().water ?? {}), falls: true }; if (onTrail) became.push('water falling off the trail\'s far cliff into a pool at its foot (trail.ground.water.falls)'); }
      else if (own.variant !== undefined) gaps.push(`${own.variant}: not drawn; the trail keeps its landmark stone`);
      if (own.many !== undefined && dials(f, own.many).satellites > 0) gaps.push(`${o.word}: the landmark stands alone, its company not drawn`);
    }
    // (where it is drawn: a climb draws the lie of its plain and its sky; the rest stand on a trail, beside it or in its cliff)
    const on = ['cloud', 'landscape'].includes(f) ? sections.filter((x) => x === 'trail' || x === 'meru') : sections.filter((x) => x === 'trail');
    if (!onTrail && !['cloud', 'landscape'].includes(f)) gaps.push('the walk has no trail to draw it on');
    forms[f] = { variant: o.variant, many: o.many, word: o.word, on: became.length ? on : [], became, gaps };
  }
  return { ...(Object.keys(trail).length ? { trail } : {}), ...(meru.relief ? { meru } : {}), ...(clouds ? { clouds } : {}), forms };
}
