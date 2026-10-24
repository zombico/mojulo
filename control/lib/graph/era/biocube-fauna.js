/**
 * BIOCUBE FAUNA — what lives in a level, beside what grows there (a biocube's `fauna`, era/biocube.js). Fauna are
 * never enemies: an animal that hunts is a gameworld foe. They come in two tiers:
 *   UNIT   an animal that stands in the level and takes up room (a sheep, a deer, a duck): not built yet
 *   FIELD  scenery that is never in the way (a cloud of gnats, fireflies and their light, butterflies over the grass,
 *          birds crossing overhead now and then): this module
 * Each field kind stands for a worked animal in the rosters (fauna/, bugs/), and its size class is that animal's,
 * measured (fauna/size-class.js). The colours are the world's: each kind takes a stop of the cube's own ramps.
 *
 *   FIELD_KINDS              each kind's read, the animal it stands for, the ground it keeps to (era/substrate.js), its
 *                            settings ({ default, lo, hi, whole?, range? })
 *   FAUNA_PRESETS            summer-day (gnats, butterflies, birds), summer-night (fireflies, a few gnats)
 *   readFauna(spec)          a preset id, a document { swarms: { <kind>: true | { …settings } | null } }, or
 *                            { from: preset, …changes } (each kind merged over the preset's, null for none) → checked:
 *                            { id, title, reads, swarms: { <kind>: settings } } (every setting filled)
 *   faunaOn(substrate)       → the field kinds that keep to a ground
 *   placeFauna(F, at)        → the page's `fauna` (scene/channels/fauna.js): each kind's homes on its ground, its
 *                            colour, its settings; `at` { st, site, trees, seed, formation }
 *
 * Pure: integer-hash dice over the site. Absent fauna, a level is byte for byte as it was.
 */
import { hash3 } from './dirt.js';
import { r5 } from './geom.js';
import { substrateMap, SUBSTRATE_IDS } from './substrate.js';

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

export const FAUNA_PRESETS = fz({
  'summer-day': fz({ title: 'Summer day', reads: 'butterflies over the grass, gnats by the way, a flock crossing now and then',
    swarms: fz({ gnats: fz({ clouds: 3 }), butterflies: fz({}), birds: fz({}) }) }),
  'summer-night': fz({ title: 'Summer night', reads: 'fireflies blinking by the trees, a few gnats still out',
    swarms: fz({ fireflies: fz({}), gnats: fz({ clouds: 2, per: 20 }) }) }),
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
  for (const k of Object.keys(spec)) if (!['id', 'from', 'title', 'reads', 'swarms'].includes(k)) no(`fauna.${k} is not a setting (from, title, reads, swarms)`);
  const base = spec.from === undefined ? null : FAUNA_PRESETS[spec.from] ?? no(`fauna from '${spec.from}' is not a preset (${FAUNA_IDS.join(', ')})`);
  if (spec.swarms !== undefined && !isObj(spec.swarms)) no(`fauna.swarms is { <kind>: true | { …settings } | null }, a kind of ${FIELD_KIND_IDS.join(', ')}`);
  // (each kind over the preset's: an object merged, true its defaults, null none)
  const S0 = base ? base.swarms : {}, S1 = spec.swarms ?? {}, swarms = {};
  for (const kind of [...Object.keys(S0), ...Object.keys(S1).filter((k) => !(k in S0))]) {
    const a = S0[kind], b = S1[kind];
    const v = b === undefined ? a : b === null ? null : isObj(a) && isObj(b) ? { ...a, ...b } : b;
    if (v !== null && v !== undefined) swarms[kind] = checkSwarm(kind, v);
    else if (!FIELD_KINDS[kind]) no(`fauna.swarms.${kind} is not a field kind (${FIELD_KIND_IDS.join(', ')})`);
  }
  if (!Object.keys(swarms).length) no(`fauna names nothing that lives here: a swarm of ${FIELD_KIND_IDS.join(', ')}, or fauna: null for none`);
  return { id: spec.id ?? spec.from ?? 'fauna', title: spec.title ?? base?.title ?? 'Fauna', reads: spec.reads ?? base?.reads ?? '', swarms };
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
export function placeFauna(F, { st, site, trees = [], seed = 1, formation = null }) {
  const S = seed | 0, M = substrateMap(st, site, { formation, seed });
  const groundOf = (x, y) => { const i = Math.floor((x - M.x0) / M.cell), j = Math.floor((y - M.y0) / M.cell); return i < 0 || j < 0 || i >= M.nx || j >= M.ny ? null : SUBSTRATE_IDS[M.cells[j * M.nx + i]] ?? null; };
  const offWay = (x, y) => site.trailDist(x, y) - site.halfWAt(y);
  // dice a point of the site the kind may stand on: its ground, off the way by [near, far] m, clear of what is claimed
  const dice = (kind, n, salt, near, far, also = () => true) => {
    const keeps = FIELD_KINDS[kind].keeps, out = [];
    for (let i = 0; i < n * 60 && out.length < n; i++) {
      const x = site.W * hash3(i, salt, S + 911), y = site.D * hash3(i, salt + 1, S + 913);
      const g = groundOf(x, y), d = offWay(x, y);
      if (!keeps.includes(g) || d < near || d > far || (site.clear && site.clear(x, y)) || !also(x, y)) continue;
      out.push([r5(x), r5(y), r5(site.ground(x, y))]);
    }
    return out;
  };
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
