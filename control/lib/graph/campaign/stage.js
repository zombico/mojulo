/**
 * AN ARCADE STAGE'S DESIGN — a Wolf Squadron stage as one designed thing before its level is built, the arcade sibling of
 * a cockpit mission's design (mission.js): where it is, the route the squadron is flown down, the waves that come at it
 * and where, the boss at the end, and how it is told on the holo table. Approved by the person on its briefing, it is
 * compiled onto a rail stage (skyscape/rail-stage.js, its `plan`) and built. Tuned for arcade play, not a sim: the stage
 * sets the speed and the way, the player steers about it, boosts, brakes and rolls; every fighter and every boss part
 * is worth points, the boss down wins it, and its medal is its score's.
 *
 *   stage = {
 *     id, name, status?: 'draft' | 'approved',
 *     place:  { system, cluster, station, moon, star?, seed? }   (theatre.js readPlace; its third part names the stage's
 *             zone: a canyon, a field of rocks), read widest first, "Kessa System | Varn Cluster | Red Canyon | Moon IV"
 *     route:  { ground: 'canyon' | 'space', world?: <planet kind>, speed?: m/s, hazards?: 'none' | 'few' | 'some' | 'many',
 *               segments?: [{ kind: 'canyon' | 'open' | 'colony', seconds }], sky?: <a flight sky> }
 *             down a canyon on the moon, or through rocks over it; its speed (a canyon's 120, a field's 60); its hazards
 *             how thick the pillars or the rocks let into the way stand. A ground route's `segments` lay it as one long
 *             route in stretches (a canyon walled, open country, a colony on the way), its ground the world's colours,
 *             under its `sky` (an afternoon's fair-weather cloud by default)
 *     waves:  [{ id, name, count: 1–6, at: share of the way 0.05–0.85, formation?: 'line' | 'vee' | 'echelon' | 'swarm',
 *              say? }]   each woken as the squadron passes its mark, in its formation ahead of the craft
 *     boss:   { name, guns?: 1–6, armour?: 'light' | 'heavy', hull?: <a capital class, its miniature on the table>, say? }
 *     medals?: { gold, silver, bronze }   points; absent, shares of all the stage holds (SCORE.medals)
 *     steps:  [{ title, say, show: [ids], routes?: [[from, to]…] }]   ids: 'squad', 'boss', the waves', 'start', 'end',
 *             and 'route' (the way drawn as a ribbon); after the place's opening (the system, the cluster, the moon)
 *   }
 *
 *   readStage(v)            → the stage read (throws, teaching, naming the field)
 *   stageLaws(S)            → [{ law, ok, says }]   the machine gate: every step shows what exists, every wave and the
 *                             boss shown before launch, the waves spaced along the way, the medals reachable, the briefing
 *                             a length a pilot sits through; advisory, never refusing
 *   stagePoints(S)          → the most the stage holds (every fighter, every gun, the core)
 *   compileStage(S, { airframe?, design? }) → { level, build, approved }   the rail stage a gameworld lays: its map and its
 *                             rail with the design's plan (its waves at their marks in their formations, its hazards, its
 *                             boss's guns and armour, its score and medals), the design to brief it with
 *                             (`airspace.briefing`), its goal a stage
 *   stagePlace(S)           → the stage's place as one line (its zone as written)
 *   stageBriefingData(S, { ground? }) → the holo table's data (campaign/briefing.js's shape: the place, the orrery, the
 *                             theatre, the things, the steps, the roster, the orders), so the stage is told on the same
 *                             table; `ground` (stage-ground.js) a ground stage's real land under it as terrain, the way as
 *                             flown, each wave where it is posted, the boss where it waits; else the route's schematic
 *   routeGround(S)          → a ground route's map, ground and sky (its segments laid as one long route)
 *   worldGeocube(kind)      → a world's ground as a geocube (its land's colours)
 *   SEGMENTS
 *   STAGE_GROUNDS · FORMATIONS · HAZARDS · SCORE
 *
 * Pure: the same design, the same stage.
 */
import { readPlace, placeParts as stationParts, orrery, roman, STAR_KINDS } from './theatre.js';
import { craftMini, capitalMini } from './holo-minis.js';
import { CAPITAL_CLASSES } from '../fleet/classes.js';
import { PLANET_KINDS } from '../skyscape/planet-gen.js';
import { readSkyAsk } from '../skyscape/sky.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r1 = (v) => Math.round(v * 10) / 10;
export const STAGE_GROUNDS = Object.freeze(['canyon', 'space']);
export const FORMATIONS = Object.freeze(['line', 'vee', 'echelon', 'swarm']);
/** How thick a stage's hazards stand: seconds of the way between them (none: never). */
export const HAZARDS = Object.freeze({ none: 0, few: 7, some: 4, many: 2.5 });
/** The points: a fighter, a boss's gun, its core; the medals' shares of all a stage holds. */
export const SCORE = Object.freeze({ fighter: 100, gun: 250, core: 1000, medals: Object.freeze([0.85, 0.65, 0.4]) });
// (each ground's map, as the rail stage lays it: a canyon's corridor, a field of rocks in space)
const GROUND = Object.freeze({
  canyon: Object.freeze({ map: Object.freeze({ form: 'canyon', craft: 'multirole' }), speed: 120 }),
  space: Object.freeze({ map: Object.freeze({ craft: 'fighter', field: 6000 }), speed: 60 }),
});
const ROCKS = Object.freeze({ none: 'none', few: 'sparse', some: 'field', many: 'dense' });
/** A ground route's stretches (`route.segments`, skyscape/ground.js SEGMENT_KINDS): a canyon walled, open country, a
 *  colony on the way; each its seconds of the way. The map laid as one long route, its width WIDTH m, a lead-in and the
 *  boss's arena past them (rail-stage.js: the way starts a breath in and ends in the arena). */
export const SEGMENTS = Object.freeze({ kinds: Object.freeze(['canyon', 'open', 'colony']), seconds: Object.freeze([10, 90]), most: 8, width: 4000, lead: 5, arena: 6, span: 0.9 });
/** A ground route's sky when none is said: an afternoon of fair-weather cloud (skyscape/sky.js). */
const GROUND_SKY = Object.freeze({ kind: 'fair', hour: 15 });
const hexMix = (a, b, t) => '#' + [1, 3, 5].map((k) => Math.round(parseInt(a.slice(k, k + 2), 16) * (1 - t) + parseInt(b.slice(k, k + 2), 16) * t).toString(16).padStart(2, '0')).join('');
/** A world's ground as a geocube: its land's colours (planet-gen.js) over the island's light, so a rust moon's canyon
 *  is its dust and its red rock, not an island's grass. */
export function worldGeocube(kind) {
  const C = PLANET_KINDS[kind].colors;
  return { from: 'island-noon', colour: { stone: hexMix(C.land0, '#000000', 0.15), floor: C.land0, grass: hexMix(C.land1, C.vegC, 0.35), foliage: C.vegC, sand: C.land1, water: C.sea } };
}
const STEPS = Object.freeze({ least: 2, most: 8 });
// (a stage's place: the system and the cluster as a mission's, its third part the zone as it is written (a canyon, a
// field: not a station), its moon by its numeral)
const placeParts = (P) => stationParts(P).map((p, i) => (i === 2 ? { kind: 'zone', name: P.station } : p));
const placeLine = (P) => placeParts(P).map((p) => p.name).join(' | ');
/** The stage's place as one line. */
export const stagePlace = (S) => placeLine(S.place);
const ID = /^[a-z][a-z0-9-]*$/;

/** A stage's design read: every fault said, naming its field. */
export function readStage(v) {
  const fail = (m) => { throw new Error(`campaign: stage${m}`); };
  if (!isObj(v)) fail(' is { id, name, place, route, waves, boss, steps, medals?, status? }');
  for (const k of Object.keys(v)) if (!['id', 'name', 'status', 'place', 'route', 'waves', 'boss', 'medals', 'steps'].includes(k)) fail(`.${k} is not part of a stage's design (id, name, status, place, route, waves, boss, medals, steps)`);
  if (typeof v.id !== 'string' || !ID.test(v.id)) fail('.id is a short name (stage-1)');
  if (typeof v.name !== 'string' || !v.name) fail('.name is the stage\'s name');
  if (v.status !== undefined && !['draft', 'approved'].includes(v.status)) fail('.status is draft (the default) or approved (the person approved its briefing)');
  const place = readPlace(v.place);
  const R = v.route;
  if (!isObj(R)) fail('.route is { ground: canyon | space, world?, speed?, hazards? }');
  for (const k of Object.keys(R)) if (!['ground', 'world', 'speed', 'hazards', 'segments', 'sky'].includes(k)) fail(`.route.${k} is not a route's (ground, world, speed, hazards, segments, sky)`);
  if (!STAGE_GROUNDS.includes(R.ground)) fail(`.route.ground is ${STAGE_GROUNDS.join(' or ')}: down a canyon on the moon, or through rocks over it`);
  if (R.world !== undefined && !PLANET_KINDS[R.world]) fail(`.route.world is a planet's kind (${Object.keys(PLANET_KINDS).join(', ')})`);
  if (R.speed !== undefined && !(Number.isFinite(R.speed) && R.speed >= 40 && R.speed <= 180)) fail('.route.speed is m/s, 40–180 (a canyon\'s 120, a field\'s 60)');
  if (R.hazards !== undefined && HAZARDS[R.hazards] === undefined) fail(`.route.hazards is ${Object.keys(HAZARDS).join(', ')}`);
  let segments = null;
  if (R.segments !== undefined) {
    if (R.ground !== 'canyon') fail('.route.segments are a ground route\'s (ground: canyon): its stretches down the moon');
    if (!Array.isArray(R.segments) || !R.segments.length || R.segments.length > SEGMENTS.most) fail(`.route.segments are 1 to ${SEGMENTS.most} stretches { kind, seconds }`);
    segments = R.segments.map((g, i) => {
      const at = `.route.segments[${i}]`;
      if (!isObj(g)) fail(`${at} is { kind, seconds }`);
      for (const k of Object.keys(g)) if (!['kind', 'seconds'].includes(k)) fail(`${at}.${k} is not a stretch's (kind, seconds)`);
      if (!SEGMENTS.kinds.includes(g.kind)) fail(`${at}.kind is ${SEGMENTS.kinds.join(', ')}: a canyon walled, open country, a colony on the way`);
      if (!(Number.isFinite(g.seconds) && g.seconds >= SEGMENTS.seconds[0] && g.seconds <= SEGMENTS.seconds[1])) fail(`${at}.seconds is how long it is flown, ${SEGMENTS.seconds[0]}–${SEGMENTS.seconds[1]} s`);
      return { kind: g.kind, seconds: g.seconds };
    });
  }
  if (R.sky !== undefined) { const e = readSkyAsk(R.sky, 'route.sky'); if (e.length) fail(`.${e[0]}`); if (R.ground !== 'canyon') fail('.route.sky is a ground route\'s: space has none'); }
  const route = { ground: R.ground, world: R.world ?? (R.ground === 'canyon' ? 'desert' : 'barren'), speed: R.speed ?? GROUND[R.ground].speed, hazards: R.hazards ?? 'some', ...(segments ? { segments } : {}), ...(R.sky !== undefined ? { sky: R.sky } : {}) };
  if (!Array.isArray(v.waves) || !v.waves.length || v.waves.length > 8) fail('.waves are 1 to 8 waves: { id, name, count, at, formation?, say? }');
  const seen = new Set(['squad', 'boss', 'start', 'end', 'route']);
  const waves = v.waves.map((w, i) => {
    const at = `.waves[${i}]`;
    if (!isObj(w)) fail(`${at} is { id, name, count, at, formation?, say? }`);
    for (const k of Object.keys(w)) if (!['id', 'name', 'count', 'at', 'formation', 'say'].includes(k)) fail(`${at}.${k} is not a wave's (id, name, count, at, formation, say)`);
    if (typeof w.id !== 'string' || !ID.test(w.id)) fail(`${at}.id is a short name`);
    if (seen.has(w.id)) fail(`${at}.id '${w.id}' is taken`);
    seen.add(w.id);
    if (!(Number.isInteger(w.count) && w.count >= 1 && w.count <= 6)) fail(`${at}.count is 1 to 6 fighters`);
    if (!(Number.isFinite(w.at) && w.at >= 0.05 && w.at <= 0.85)) fail(`${at}.at is its mark, a share of the way, 0.05–0.85 (the last stretch is the boss's)`);
    if (w.formation !== undefined && !FORMATIONS.includes(w.formation)) fail(`${at}.formation is ${FORMATIONS.join(', ')}`);
    return { id: w.id, name: typeof w.name === 'string' && w.name ? w.name : w.id, count: w.count, at: w.at, formation: w.formation ?? 'line', ...(typeof w.say === 'string' ? { say: w.say } : {}) };
  });
  for (let i = 1; i < waves.length; i++) if (waves[i].at <= waves[i - 1].at) fail(`.waves[${i}].at comes after the wave before it (${waves[i - 1].at}): waves are written in the order they come`);
  const B = v.boss;
  if (!isObj(B) || typeof B.name !== 'string' || !B.name) fail('.boss is { name, guns?, armour?, hull?, say? }');
  for (const k of Object.keys(B)) if (!['name', 'guns', 'armour', 'hull', 'say'].includes(k)) fail(`.boss.${k} is not a boss's (name, guns, armour, hull, say)`);
  if (B.guns !== undefined && !(Number.isInteger(B.guns) && B.guns >= 1 && B.guns <= 6)) fail('.boss.guns is 1 to 6 guns round its core');
  if (B.armour !== undefined && !['light', 'heavy'].includes(B.armour)) fail('.boss.armour is light or heavy');
  if (B.hull !== undefined && !CAPITAL_CLASSES[B.hull]) fail(`.boss.hull is a capital ship's class (${Object.keys(CAPITAL_CLASSES).join(', ')}): its miniature on the table`);
  const boss = { name: B.name, guns: B.guns ?? 2, armour: B.armour ?? 'light', hull: B.hull ?? 'corvette', ...(typeof B.say === 'string' ? { say: B.say } : {}) };
  const S0 = { waves, boss };
  if (v.medals !== undefined) {
    const M = v.medals;
    if (!(isObj(M) && ['gold', 'silver', 'bronze'].every((k) => Number.isFinite(M[k]) && M[k] > 0) && M.gold >= M.silver && M.silver >= M.bronze)) fail('.medals is { gold, silver, bronze }, points, gold the most');
  }
  const most = stagePoints(S0), medals = v.medals ? { gold: v.medals.gold, silver: v.medals.silver, bronze: v.medals.bronze }
    : Object.fromEntries(['gold', 'silver', 'bronze'].map((k, i) => [k, Math.round((most * SCORE.medals[i]) / 50) * 50]));
  if (!Array.isArray(v.steps) || !v.steps.length) fail('.steps are the briefing\'s steps: { title, say, show, routes? }');
  const steps = v.steps.map((s, i) => {
    const at = `.steps[${i}]`;
    if (!isObj(s) || typeof s.title !== 'string' || typeof s.say !== 'string') fail(`${at} is { title, say, show: [ids], routes? }`);
    if (!Array.isArray(s.show)) fail(`${at}.show is a list of what the step shows (squad, boss, route, start, end, the waves)`);
    for (const id of s.show) if (!seen.has(id)) fail(`${at}.show names '${id}': not in the stage (${[...seen].join(', ')})`);
    const routes = s.routes ?? [];
    if (!Array.isArray(routes) || !routes.every((r) => Array.isArray(r) && r.length === 2 && r.every((id) => seen.has(id) && id !== 'route'))) fail(`${at}.routes are [[from, to]…], each one of the stage's (squad, boss, start, end, the waves)`);
    return { title: s.title, say: s.say, show: s.show.slice(), routes: routes.map((r) => r.slice()) };
  });
  return { id: v.id, name: v.name, status: v.status ?? 'draft', place, route, waves, boss, medals, steps };
}

/** The most a stage holds: every fighter, every gun, the core. */
export function stagePoints(S) {
  return S.waves.reduce((s, w) => s + w.count * SCORE.fighter, 0) + S.boss.guns * SCORE.gun + SCORE.core;
}

/** The stage's machine gate: advisory, each law with what it found. */
export function stageLaws(S) {
  const shown = new Set(S.steps.flatMap((s) => s.show)), laws = [];
  const unshown = S.waves.filter((w) => !shown.has(w.id)).map((w) => w.name);
  laws.push({ law: 'every-wave-shown', ok: !unshown.length, says: unshown.length ? `never shown on the table: ${unshown.join(', ')}` : 'every wave is shown before launch' });
  laws.push({ law: 'boss-shown', ok: shown.has('boss'), says: shown.has('boss') ? `the ${S.boss.name} is shown before launch` : `the ${S.boss.name} is never shown: a pilot meets it cold` });
  const tight = S.waves.slice(1).filter((w, i) => w.at - S.waves[i].at < 0.06).map((w) => w.name);
  laws.push({ law: 'waves-spaced', ok: !tight.length, says: tight.length ? `on the heels of the wave before: ${tight.join(', ')} (keep 0.06 of the way between)` : 'each wave has its own stretch of the way' });
  const most = stagePoints(S);
  laws.push({ law: 'medals-reachable', ok: S.medals.gold <= most, says: S.medals.gold <= most ? `gold at ${S.medals.gold} of the ${most} the stage holds` : `gold at ${S.medals.gold}: the stage holds ${most}` });
  const n = S.steps.length;
  laws.push({ law: 'briefing-length', ok: n >= STEPS.least && n <= STEPS.most, says: `${n} steps after the opening (${STEPS.least}–${STEPS.most}: arcade, short)` });
  return laws;
}

/** The rail stage a gameworld lays from the design: its map, its rail and its plan, its briefing, its goal. */
export function compileStage(S, { airframe = 'strikeFoil', design = null } = {}) {
  const G = GROUND[S.route.ground], space = S.route.ground === 'space';
  const plan = {
    waves: S.waves.map((w) => ({ at: w.at, count: w.count, formation: w.formation })),
    hazards: HAZARDS[S.route.hazards],
    boss: { guns: S.boss.guns, armour: S.boss.armour },
    score: { fighter: SCORE.fighter, gun: SCORE.gun, core: SCORE.core, medals: [S.medals.gold, S.medals.silver, S.medals.bronze] },
  };
  const laid = S.route.segments ? routeGround(S) : null;
  const airspace = {
    map: { ...G.map, ...(laid ? laid.map : {}) },
    ...(laid ? { ground: laid.ground, sky: laid.sky } : {}),
    ...(space ? { space: { asteroids: ROCKS[S.route.hazards], backdrop: { worlds: [S.route.world], proximity: 'near' } } } : {}),
    rail: { speed: S.route.speed, plan },
    airframe,
    ...(design ? { briefing: design } : {}),
  };
  const level = { name: S.name, airspace, goal: { flight: 'stage' } };
  const build = [
    laid ? `a route down ${placeParts(S.place)[3].name}, ${Math.round(laid.map.field[0] / 100) / 10} km at ${S.route.speed} m/s: ${S.route.segments.map((g) => `${g.kind} ${g.seconds} s`).join(', ')}; its hazards ${S.route.hazards}`
      : `a ${space ? 'field of rocks over' : 'canyon on'} ${placeParts(S.place)[3].name} at ${S.route.speed} m/s, its hazards ${S.route.hazards}`,
    ...S.waves.map((w) => `${w.name}: ${w.count} in a ${w.formation} at ${Math.round(w.at * 100)}% of the way`),
    `the ${S.boss.name}: a core and ${S.boss.guns} gun${S.boss.guns === 1 ? '' : 's'}, ${S.boss.armour} armour`,
    `medals at ${S.medals.gold} · ${S.medals.silver} · ${S.medals.bronze} of ${stagePoints(S)} points`,
  ];
  return { level, build, approved: S.status === 'approved' };
}

/** A ground route laid as its map: one long route (map.js `route`), its stretches as the ground's segments at their
 *  shares of the way, a colony in the colony style, the world's ground colours, its sky. */
export function routeGround(S) {
  const v = S.route.speed, total = S.route.segments.reduce((a, g) => a + g.seconds, 0), T = SEGMENTS.lead + total + SEGMENTS.arena;
  const length = Math.round((v * T) / SEGMENTS.span / 100) * 100;
  // (the way runs the middle SEGMENTS.span of the field: a stretch's share of the field from its seconds down the way;
  // the first opens the field and the last closes it)
  const edge = (1 - SEGMENTS.span) / 2, share = (sec) => edge + SEGMENTS.span * (sec / T);
  let at = SEGMENTS.lead;
  const segments = S.route.segments.map((g, i) => {
    const from = i === 0 ? 0 : share(at); at += g.seconds;
    return { kind: g.kind, from: Math.round(from * 1e4) / 1e4, to: i === S.route.segments.length - 1 ? 1 : Math.round(share(at) * 1e4) / 1e4 };
  });
  const colony = segments.some((g) => g.kind === 'colony');
  return {
    map: { field: [length, SEGMENTS.width], route: true },
    // (no airfield: a stage is flown in, not taken off from)
    ground: { segments, geocube: worldGeocube(S.route.world), pads: [], ...(colony ? { country: { style: 'colony', roads: true, power: false } } : {}) },
    sky: S.route.sky ?? { ...GROUND_SKY },
  };
}

// ── THE HOLO TABLE: the route schematic, at the table's own metres (x across, y ahead, z up) ──
const ROUTE = Object.freeze({ seconds: 80, points: 12, weave: 0.06 });
const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];
const FORM_WORDS = Object.freeze({ line: 'in line abreast', vee: 'in a vee', echelon: 'in echelon', swarm: 'in a swarm' });

/** The stage on the holo table: its route as a ribbon of nav points, its waves at their marks, the boss at the end. */
export function stageBriefingData(S, { ground = null } = {}) {
  const parts = placeParts(S.place), space = S.route.ground === 'space', G = ground;
  const L = S.route.speed * ROUTE.seconds, field = G ? G.field : Math.round(L * 1.25), w = L * ROUTE.weave;
  // (on its ground, stage-ground.js: the way as it is flown, sampled; else the schematic's weave)
  const pathAt = (u) => { const P = G.path, f = Math.min(P.length - 1, u * (P.length - 1)), i = Math.min(P.length - 2, Math.floor(f)), t = f - i; return [0, 1, 2].map((k) => r1(P[i][k] + (P[i + 1][k] - P[i][k]) * t)); };
  const along = G ? pathAt : (u) => [r1(w * Math.sin(u * 5.2)), r1(-L / 2 + u * L), r1(space ? w * 0.5 * Math.sin(u * 4.1 + 1) : 0)];
  const nav = Array.from({ length: ROUTE.points + 1 }, (_, i) => ({ id: `r${i}`, name: '', at: along(i / ROUTE.points) }));
  nav.push({ id: 'start', name: 'Start', at: along(0) }, { id: 'end', name: 'The arena', at: along(1) });
  const O = orrery(S.place, { moonKind: S.route.world });
  const things = [
    { id: 'squad', name: 'Wolf Squadron', side: 'friend', kind: 'group', label: 'Strike foil', at: along(0), heading: 0, count: 1, pilot: true, mini: craftMini('strikeFoil') },
    ...S.waves.map((x, i) => ({ id: x.id, name: x.name, side: 'foe', kind: 'group', label: `${x.count} ${FORM_WORDS[x.formation]}`, at: G && G.waves[i] ? G.waves[i] : along(x.at), heading: 180, count: x.count, arrives: true, mini: craftMini('twinPanel') })),
    { id: 'boss', name: S.boss.name, side: 'foe', kind: 'capital', label: `a core and ${S.boss.guns} gun${S.boss.guns === 1 ? '' : 's'}`, at: G ? G.boss : along(1.15), heading: 180, mini: capitalMini(S.boss.hull) },
  ];
  // (the hazards on the table: rocks crowding the way in space, pillars standing in it in a canyon)
  const rocks = G ? G.rocks.map((r) => r.slice()) : [], gap = HAZARDS[S.route.hazards];
  if (gap && !G) for (let u = 0.08, k = 0; u < 0.88; u += gap / ROUTE.seconds, k++) { const p = along(u), side = k % 2 ? 1 : -1; rocks.push([r1(p[0] + side * w * 0.6), p[1], p[2], r1(space ? 40 : 26)]); }
  const ribbon = nav.slice(0, ROUTE.points).map((n, i) => [n.id, nav[i + 1].id]);
  const star = STAR_KINDS[O.star.kind].label;
  const opening = [
    { id: 'system', stage: 'orrery', focus: 'system', part: 0, title: parts[0].name, say: `${star.replace(/^\w/, (c) => c.toUpperCase())} and ${O.planets.length} worlds. The squadron goes in at the ${ORD[O.home]}.`, show: [], routes: [] },
    { id: 'cluster', stage: 'orrery', focus: 'cluster', part: 1, title: parts[1].name, say: `In through the ${parts[1].name}, fast and low.`, show: [], routes: [] },
    { id: 'moon', stage: 'orrery', focus: 'moon', part: 3, title: parts[3].name, say: space ? `${parts[2].name} hangs over Moon ${roman(S.place.moon)}: rocks all the way down.` : `${parts[2].name} cuts across Moon ${roman(S.place.moon)}: down it at full speed.`, show: [], routes: [] },
  ];
  const steps = [...opening, ...S.steps.map((s, k) => ({ id: `step-${k + 1}`, stage: 'theatre', part: 2, title: s.title, say: s.say,
    show: s.show.filter((id) => id !== 'route'), routes: [...(s.show.includes('route') ? ribbon : []), ...s.routes] }))];
  return {
    id: S.id, name: S.name, status: S.status,
    place: { line: placeLine(S.place), parts: parts.map((p) => p.name) },
    orrery: { ...O, homeMoons: O.planets[O.home].moons.length },
    // (on the ground: the land under the way as terrain, its heights stretched `vertical` times, the colony's masses)
    theatre: { field, moon: { kind: S.route.world, bearing: 0, elevation: space ? 22 : 8, size: 'near' }, rocks, nav,
      ...(G ? { terrain: G.terrain, vertical: G.vertical, masses: G.masses } : {}) },
    things,
    steps,
    roster: [{ id: 'squad', name: 'Wolf Squadron', craft: 'Strike foil', count: 1, side: 'friend' },
      ...S.waves.map((x) => ({ id: x.id, name: x.name, craft: 'Fighter', count: x.count, side: 'foe' })),
      { id: 'boss', name: S.boss.name, craft: 'Boss', count: 1, side: 'foe' }],
    goals: [{ text: `Destroy the ${S.boss.name}` }, { text: `Every fighter ${SCORE.fighter}, a gun ${SCORE.gun}, the core ${SCORE.core}` },
      { text: `Gold ${S.medals.gold} · silver ${S.medals.silver} · bronze ${S.medals.bronze}` }],
  };
}
