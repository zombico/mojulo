/**
 * BIOCUBE FAUNA — what lives in a level, beside what grows there (a biocube's `fauna`, era/biocube.js). Fauna are
 * never enemies: an animal that hunts is a gameworld foe. They come in two tiers:
 *   UNIT   an animal that stands in the level and takes up room (a sheep, a deer, a duck): a herd of a species from
 *          the encyclopedia (fauna/), walking on its own gait and minding its own business: a grazer grazes, the rest
 *          wander. Never hostile: whatever the species, its mind is passive, with no weapon and no side
 *   FIELD  scenery that is never in the way (a cloud of gnats, fireflies and their light, butterflies over the grass,
 *          birds crossing overhead now and then)
 * Each field kind stands for a worked animal in the rosters (fauna/, bugs/), and its size class is that animal's,
 * measured (fauna/size-class.js). The colours are the world's: each kind takes a stop of the cube's own ramps.
 *
 *   FIELD_KINDS              each kind's read, the animal it stands for, the ground it keeps to (era/substrate.js), its
 *                            settings ({ default, lo, hi, whole?, range? })
 *   HERD_SETTINGS            a herd's settings: `groups` (how many herds of the species), `size` ([lo, hi] each);
 *                            beside them `killable` (false, true or { hp }: its body takes hits, flinches, falls and
 *                            lies) and `interact` (null or 'pet': the walker in reach presses interact and it stops,
 *                            turns to them and stands content a moment; scene/channels/fauna-pet.js)
 *   unitOf(species)          → what a species is as a unit: its size class, the gait it walks by and that gait's stride,
 *                            whether it grazes, its mind; throws, saying why, for one that cannot stand in a level yet
 *                            (a bug: the field's; a swimmer, a body with no stride on land: not yet)
 *   FAUNA_PRESETS            summer-day (gnats, butterflies, birds), summer-night (fireflies, a few gnats), pasture
 *                            (sheep, butterflies, birds), woodland (deer, rabbits, birds)
 *   readFauna(spec)          a preset id, a document { swarms?: { <kind>: true | { …settings } | null }, herds?:
 *                            { <species>: true | { groups, size } | null } }, or { from: preset, …changes } (each kind
 *                            and species merged over the preset's, null for none) → checked: { id, title, reads,
 *                            swarms, herds } (every setting filled)
 *   faunaOn(substrate)       → the field kinds that keep to a ground
 *   placeFauna(F, at)        → the page's `fauna` (scene/channels/fauna.js): each kind's homes on its ground, its
 *                            colour, its settings; `at` { st, site, trees, seed, formation }
 *   placeHerds(F, at)        → the units: { entities (the controllable runtime's: each animal an `ai` body on its rig,
 *                            hp and hittable when killable, `pet` { reach, hold, species, clip? } when it may be
 *                            petted; the grass a grazer goes to), figures: { fauna:<species>: { species, gait,
 *                            behaviors, reactions? } }
 *                            (the rig each species is drawn by, built where the world is resolved:
 *                            worlds/fauna-units.js) }, or null for none
 *
 * Pure: integer-hash dice over the site. Absent fauna, a level is byte for byte as it was.
 */
import { hash3 } from './dirt.js';
import { r5 } from './geom.js';
import { substrateMap, SUBSTRATE_IDS } from './substrate.js';
import { SPECIES } from '../fauna/species.js';
import { BUG_SPECIES } from '../bugs/species.js';
import { sizeClassOf } from '../fauna/size-class.js';
import { motionGaits, motionBehaviors, motionReactions, gaitStride } from '../fauna/rig.js';
import { tagsOf, capabilitiesOf } from '../fauna/behavior/index.js';

const no = (m) => { throw new Error(`biocube: ${m}`); };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fz = (o) => Object.freeze(o);

export const FIELD_KINDS = fz({
  gnats: fz({ read: 'a cloud of gnats hanging in a column over the grass by the way, jittering', stands: 'mosquito',
    keeps: fz(['wet', 'soil']), settings: fz({ clouds: fz({ default: 4, lo: 1, hi: 24, whole: true }), per: fz({ default: 28, lo: 6, hi: 80, whole: true }) }) }),
  fireflies: fz({ read: 'fireflies drifting low by the trees, each blinking its light: a night\'s', stands: 'firefly',
    keeps: fz(['soil', 'wet']), settings: fz({ count: fz({ default: 70, lo: 1, hi: 400, whole: true }) }) }),
  butterflies: fz({ read: 'butterflies flitting over the grass, wings beating, each on its own wandering loop', stands: 'monarch',
    keeps: fz(['soil']), settings: fz({ count: fz({ default: 8, lo: 1, hi: 60, whole: true }) }) }),
  birds: fz({ read: 'a flock crossing high overhead now and then, in a loose V', stands: 'crow',
    keeps: fz([]), settings: fz({ flock: fz({ default: fz([3, 7]), lo: 1, hi: 24, whole: true, range: true }), every: fz({ default: 40, lo: 8, hi: 600 }),
      height: fz({ default: fz([24, 40]), lo: 8, hi: 150, range: true }) }) }),
});
export const FIELD_KIND_IDS = fz(Object.keys(FIELD_KINDS));

// ── the unit tier ──

export const HERD_SETTINGS = fz({ groups: fz({ default: 1, lo: 1, hi: 6, whole: true }), size: fz({ default: fz([3, 6]), lo: 1, hi: 16, whole: true, range: true }) });
// the gaits a unit walks by, the first a species has (one with a stride on land)
const GROUND_GAITS = fz(['walk', 'waddle', 'amble', 'crawl', 'creep', 'upright', 'hop']);
const EATS = fz(['grazer', 'browser', 'roots']);
export const INTERACTS = fz(['pet']);
// a killable animal's hp, by its size: a rabbit about 25, a sheep about 50, an elephant about 180
const hpOf = (extent) => Math.round(10 + 30 * extent);

const UNITS = new Map();
/** A species as a unit of a level: its size, its gait, whether it grazes, its mind (never hostile). Throws, saying why. */
export function unitOf(id) {
  if (UNITS.has(id)) return UNITS.get(id);
  if (BUG_SPECIES[id]) no(`fauna.herds.${id} is a bug: a mini animal is the field's (a swarm), not a unit`);
  if (!SPECIES[id]) no(`fauna.herds.${id} is not a species of the encyclopedia (get_solid_vocab({ id: 'animals' }) lists them)`);
  const size = sizeClassOf(id), cap = capabilitiesOf(id);
  if (size.class === 'mini') no(`fauna.herds.${id} is mini: a swarm of the field's, not a unit`);
  if (cap.swimmer) no(`fauna.herds.${id} lives in water: a level's water holds no animals yet`);
  const have = motionGaits(id), gait = GROUND_GAITS.find((g) => have.includes(g) && gaitStride(id, g));
  if (!gait) no(`fauna.herds.${id} has no stride on land to walk a level by (it moves: ${have.join(', ')})`);
  // a grazer grazes (the grass laid round its herd is its food); every other animal wanders round its herd's ground. A
  // predator is no hunter here: no animal of a level's fauna has a weapon, a side, or anything but a passive mind
  const eats = (tagsOf(SPECIES[id].family, id) || []).some((t) => EATS.includes(t));
  const does = motionBehaviors(id), reacts = motionReactions(id);
  const u = fz({ species: id, size: size.class, extent: size.extent, gait, stride: gaitStride(id, gait), eats,
    eat: eats && does.includes('eat'), relax: does.includes('relax'), reacts: fz(['flinch', 'fall', 'rise'].filter((w) => reacts.includes(w))),
    mind: fz({ motivation: eats ? 'forage' : 'wander', aggressiveness: 'passive' }) });
  UNITS.set(id, u);
  return u;
}
const HERD_KEYS = fz([...Object.keys(HERD_SETTINGS), 'killable', 'interact']);
function checkHerd(id, h) {
  const u = unitOf(id);
  if (h === true) h = {};
  if (!isObj(h)) no(`fauna.herds.${id} is true, null (none) or { ${HERD_KEYS.join(', ')} }`);
  for (const k of Object.keys(h)) if (!HERD_KEYS.includes(k)) no(`fauna.herds.${id}.${k} is not a setting (${HERD_KEYS.join(', ')})`);
  const out = {};
  for (const [k, S] of Object.entries(HERD_SETTINGS)) { const v = h[k] ?? S.default; checkSetting(v, S, `fauna.herds.${id}.${k}`); out[k] = Array.isArray(v) ? [...v] : v; }
  // (killable: its body takes hits, its hp by its size unless named; it never strikes back)
  const K = h.killable ?? false;
  if (K === true || isObj(K)) {
    if (isObj(K)) { for (const k of Object.keys(K)) if (k !== 'hp') no(`fauna.herds.${id}.killable is true or { hp }`); if (K.hp !== undefined) checkSetting(K.hp, { lo: 1, hi: 2000, whole: true }, `fauna.herds.${id}.killable.hp`); }
    out.killable = { hp: (isObj(K) && K.hp) || hpOf(u.extent) };
  } else if (K !== false) no(`fauna.herds.${id}.killable is false, true or { hp }`);
  else out.killable = false;
  const I = h.interact ?? null;
  if (I !== null && !INTERACTS.includes(I)) no(`fauna.herds.${id}.interact is null or one of ${INTERACTS.join(', ')}`);
  out.interact = I;
  return out;
}

export const FAUNA_PRESETS = fz({
  'summer-day': fz({ title: 'Summer day', reads: 'butterflies over the grass, gnats by the way, a flock crossing now and then',
    swarms: fz({ gnats: fz({ clouds: 3 }), butterflies: fz({}), birds: fz({}) }) }),
  'summer-night': fz({ title: 'Summer night', reads: 'fireflies blinking by the trees, a few gnats still out',
    swarms: fz({ fireflies: fz({}), gnats: fz({ clouds: 2, per: 20 }) }) }),
  pasture: fz({ title: 'Pasture', reads: 'sheep grazing in two flocks (pet one), butterflies over the grass, a flock of birds now and then',
    herds: fz({ sheep: fz({ groups: 2, size: fz([4, 7]), interact: 'pet' }) }), swarms: fz({ butterflies: fz({ count: 6 }), birds: fz({}) }) }),
  woodland: fz({ title: 'Woodland', reads: 'deer wandering among the trees, rabbits in the open, birds overhead',
    herds: fz({ deer: fz({ size: fz([2, 4]) }), rabbit: fz({ groups: 2, size: fz([1, 3]) }) }), swarms: fz({ birds: fz({}) }) }),
});
export const FAUNA_IDS = fz(Object.keys(FAUNA_PRESETS));

/** The field kinds that keep to a ground (era/substrate.js SUBSTRATES). */
export function faunaOn(substrate) {
  if (!SUBSTRATE_IDS.includes(substrate)) throw new Error(`fauna: '${substrate}' is no ground (${SUBSTRATE_IDS.join(', ')})`);
  return FIELD_KIND_IDS.filter((k) => FIELD_KINDS[k].keeps.includes(substrate));
}

function checkSetting(v, S, at) {
  const ok = (x) => Number.isFinite(x) && x >= S.lo && x <= S.hi && (!S.whole || Number.isInteger(x));
  const what = `${S.whole ? 'a whole number' : 'a number'} ${S.lo} to ${S.hi}`;
  if (S.range) { if (!(Array.isArray(v) && v.length === 2 && v.every(ok) && v[0] <= v[1])) no(`${at} is [lo, hi], each ${what}, lo ≤ hi`); }
  else if (!ok(v)) no(`${at} is ${what}`);
}
function checkSwarm(kind, s) {
  const K = FIELD_KINDS[kind];
  if (!K) no(`fauna.swarms.${kind} is not a field kind (${FIELD_KIND_IDS.join(', ')})`);
  if (s === true) s = {};
  if (!isObj(s)) no(`fauna.swarms.${kind} is true, null (none) or { ${Object.keys(K.settings).join(', ')} }`);
  for (const k of Object.keys(s)) if (!K.settings[k]) no(`fauna.swarms.${kind}.${k} is not a setting (${Object.keys(K.settings).join(', ')})`);
  const out = {};
  for (const [k, S] of Object.entries(K.settings)) { const v = s[k] ?? S.default; checkSetting(v, S, `fauna.swarms.${kind}.${k}`); out[k] = Array.isArray(v) ? [...v] : v; }
  return out;
}

/** A biocube's fauna: a preset id, a document, or { from: preset, …changes } → checked, every setting filled. */
export function readFauna(spec) {
  if (typeof spec === 'string') { if (!FAUNA_PRESETS[spec]) no(`fauna '${spec}' is not a preset (${FAUNA_IDS.join(', ')})`); return readFauna({ from: spec }); }
  if (!isObj(spec)) no(`fauna is a preset id (${FAUNA_IDS.join(', ')}), a document { swarms } or { from, …changes }`);
  for (const k of Object.keys(spec)) if (!['id', 'from', 'title', 'reads', 'swarms', 'herds'].includes(k)) no(`fauna.${k} is not a setting (from, title, reads, swarms, herds)`);
  const base = spec.from === undefined ? null : FAUNA_PRESETS[spec.from] ?? no(`fauna from '${spec.from}' is not a preset (${FAUNA_IDS.join(', ')})`);
  if (spec.swarms !== undefined && !isObj(spec.swarms)) no(`fauna.swarms is { <kind>: true | { …settings } | null }, a kind of ${FIELD_KIND_IDS.join(', ')}`);
  if (spec.herds !== undefined && !isObj(spec.herds)) no('fauna.herds is { <species>: true | { groups, size } | null }');
  // (each kind and each species over the preset's: an object merged, true its defaults, null none)
  const merged = (A, B, check, unknown) => {
    const out = {};
    for (const k of [...Object.keys(A), ...Object.keys(B).filter((x) => !(x in A))]) {
      const a = A[k], b = B[k], v = b === undefined ? a : b === null ? null : isObj(a) && isObj(b) ? { ...a, ...b } : b;
      if (v !== null && v !== undefined) out[k] = check(k, v); else unknown(k);
    }
    return out;
  };
  const swarms = merged(base?.swarms ?? {}, spec.swarms ?? {}, checkSwarm, (k) => { if (!FIELD_KINDS[k]) no(`fauna.swarms.${k} is not a field kind (${FIELD_KIND_IDS.join(', ')})`); });
  const herds = merged(base?.herds ?? {}, spec.herds ?? {}, checkHerd, (k) => { if (!SPECIES[k]) unitOf(k); });
  if (!Object.keys(swarms).length && !Object.keys(herds).length) no(`fauna names nothing that lives here: a swarm of ${FIELD_KIND_IDS.join(', ')}, a herd of a species, or fauna: null for none`);
  return { id: spec.id ?? spec.from ?? 'fauna', title: spec.title ?? base?.title ?? 'Fauna', reads: spec.reads ?? base?.reads ?? '', swarms, herds };
}

// ── the field on a stage ──

// a stop of the world's ramp as 0–1 rgb (a ramp the look has not got: the fallback)
const stop = (st, key, i, fb) => { const R = st.palette?.[key]; const c = Array.isArray(R) && R.length ? R[Math.max(0, Math.min(R.length - 1, i < 0 ? R.length + i : i))] : fb; return c.map((v) => r5(v / 255)); };

/**
 * A biocube's fauna placed on an isekai stage's site: the page's `fauna` (scene/channels/fauna.js).
 *   gnats        { colour, per, clouds: [[x, y, z]] }      a cloud's foot, on the ground near the way (the soil's
 *                                                         darkest, darker still: a gnat is a dark speck)
 *   fireflies    { colour, flies: [[x, y, z]] }            each one's home on the ground, by the trees
 *   butterflies  { colours, homes: [[x, y, z]] }           each one's home on the ground, over the grass
 *   birds        { colour, flock, every, height, centre, span }   the site's middle a flock crosses over
 */
// the site's dice: a point of it on one of `keeps` (era/substrate.js), off the way by [near, far] m, clear of what is
// claimed, and whatever `also` asks; up to n of them, as [x, y, z] on the ground
function siteDice({ st, site, seed, formation }) {
  const S = seed | 0, M = substrateMap(st, site, { formation, seed });
  const groundOf = (x, y) => { const i = Math.floor((x - M.x0) / M.cell), j = Math.floor((y - M.y0) / M.cell); return i < 0 || j < 0 || i >= M.nx || j >= M.ny ? null : SUBSTRATE_IDS[M.cells[j * M.nx + i]] ?? null; };
  const offWay = (x, y) => site.trailDist(x, y) - site.halfWAt(y);
  return (keeps, n, salt, near, far, also = () => true) => {
    const out = [];
    for (let i = 0; i < n * 60 && out.length < n; i++) {
      const x = site.W * hash3(i, salt, S + 911), y = site.D * hash3(i, salt + 1, S + 913);
      const g = groundOf(x, y), d = offWay(x, y);
      if (!keeps.includes(g) || d < near || d > far || (site.clear && site.clear(x, y)) || !also(x, y)) continue;
      out.push([r5(x), r5(y), r5(site.ground(x, y))]);
    }
    return out;
  };
}

export function placeFauna(F, { st, site, trees = [], seed = 1, formation = null }) {
  const S = seed | 0, D = siteDice({ st, site, seed, formation });
  const dice = (kind, n, salt, near, far, also) => D(FIELD_KINDS[kind].keeps, n, salt, near, far, also);
  const out = { seed: S };
  const W = F.swarms;
  if (W.gnats) out.gnats = { colour: stop(st, 'soil', 0, [60, 54, 60]).map((v) => r5(v * 0.4)), per: W.gnats.per, clouds: dice('gnats', W.gnats.clouds, 1, 0.8, 9) };
  if (W.fireflies) {
    // by the trees when there are any: within a crown's reach of a trunk and out to the clump's edge
    const byTrees = trees.length ? (x, y) => trees.some((t) => Math.hypot(t.x - x, t.y - y) < 2 + 0.6 * (t.h ?? 8)) : () => true;
    out.fireflies = { colour: stop(st, 'gold', -1, [255, 244, 168]), flies: dice('fireflies', W.fireflies.count, 11, 0.5, 40, byTrees) };
  }
  if (W.butterflies) out.butterflies = { colours: ['gold', 'violet', 'fruit'].map((k, i) => stop(st, k, 2, [[226, 186, 44], [140, 104, 206], [200, 58, 56]][i])), homes: dice('butterflies', W.butterflies.count, 21, 0.6, 14) };
  if (W.birds) {
    const g = site.ground(site.W / 2, site.D / 2);
    out.birds = { colour: stop(st, 'rock', 0, [48, 44, 52]).map((v) => r5(v * 0.6)), flock: [...W.birds.flock], every: W.birds.every, height: [...W.birds.height],
      centre: [r5(site.W / 2), r5(site.D / 2), r5(g)], span: r5(Math.hypot(site.W, site.D) * 0.75 + 40) };
  }
  // (a kind whose ground the site has none of places nothing)
  for (const k of ['gnats', 'fireflies', 'butterflies']) if (out[k] && !(out[k].clouds ?? out[k].flies ?? out[k].homes).length) delete out[k];
  return out;
}

const r2 = (v) => Math.round(v * 100) / 100;
/**
 * A biocube's herds placed on an isekai stage's site: each herd's ground on the soil, off the way, its animals round it
 * (none on a trunk), a grazer's grass laid round them; each animal an `ai` body walking at its gait's own speed, so its
 * feet keep to the ground. Null when the fauna names no herd.
 */
export function placeHerds(F, { st, site, trees = [], seed = 1, formation = null }) {
  const H = F.herds ?? {};
  if (!Object.keys(H).length) return null;
  const S = seed | 0, D = siteDice({ st, site, seed, formation }), entities = [], figures = {};
  const offTrunk = (x, y, m) => trees.every((t) => Math.hypot(t.x - x, t.y - y) > m);
  Object.keys(H).forEach((id, si) => {
    const u = unitOf(id), h = H[id], e = u.extent, gap = 1 + 1.2 * e, fig = `fauna:${id}`;
    const pet = h.interact === 'pet';
    figures[fig] = { species: id, gait: u.gait, behaviors: [...(u.eat ? ['eat'] : []), ...(pet && u.relax ? ['relax'] : [])], ...(h.killable && u.reacts.length ? { reactions: [...u.reacts] } : {}) };
    const homes = D(['soil'], h.groups, 101 + 17 * si, 4 + e, 30 + 2 * e, (x, y) => offTrunk(x, y, 1 + e) && entities.every((o) => Math.hypot(o.transform.pos[0] - x, o.transform.pos[1] - y) > 4 * gap));
    homes.forEach((home, g) => {
      const n = h.size[0] + Math.floor(hash3(g, 3, S + 131 + si) * (h.size[1] - h.size[0] + 1)), spread = gap * Math.sqrt(n);
      const near = (x, y) => Math.hypot(x - home[0], y - home[1]) < spread;
      const spots = D(['soil'], n, 211 + 31 * si + 7 * g, 1 + e * 0.5, 40 + 3 * e, (x, y) => near(x, y) && offTrunk(x, y, 0.6 + 0.4 * e));
      const rule = { type: 'ai', speed: r2(u.stride.speed), stride: u.stride.length, turn: 2.5, wanderRadius: r2(spread + 2 + 2 * e), wanderPause: 3,
        collideHeight: r2(Math.min(4, Math.max(0.6, 0.6 * e))), mind: { ...u.mind },
        ...(u.eats ? { forageRadius: r2(spread + 4), regrow: 20, grazeTime: 5 } : {}) };
      spots.forEach((p, k) => entities.push({ id: `${fig}:${g}:${k}`, fauna: true, transform: { pos: p, heading: r5(6.28318 * hash3(k, g, S + 151 + si)) },
        rule: { ...rule, mind: { ...rule.mind } }, body: { type: 'figure-rig', figure: fig, radius: r2(Math.min(2.5, Math.max(0.2, 0.3 * e))), ...(h.killable ? { hp: h.killable.hp, hittable: true } : {}) },
        ...(pet ? { pet: { reach: r2(1.2 + 0.6 * e), hold: 3, species: id, ...(u.relax ? { clip: 'relax' } : {}) } } : {}) }));
      // (a grazer's grass: tufts round its herd's ground it walks to and crops, each grown back in its own time)
      if (u.eats) D(['soil'], spots.length + 2, 307 + 31 * si + 7 * g, 1, 40 + 3 * e, (x, y) => Math.hypot(x - home[0], y - home[1]) < spread + 3)
        .forEach((p, k) => entities.push({ id: `${fig}:${g}:grass${k}`, fauna: true, rule: { type: 'static' }, food: true, transform: { pos: p, heading: 0 }, body: { type: 'none' } }));
    });
  });
  if (!entities.some((x) => x.rule.type === 'ai')) return null;
  for (const f of Object.keys(figures)) if (!entities.some((x) => x.body.figure === f)) delete figures[f];
  return { entities, figures };
}
