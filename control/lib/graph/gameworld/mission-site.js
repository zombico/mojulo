/**
 * A MISSION ON A GEOCUBE'S SITE — the mission laid on a place the geocube builds whole: a base building seated on its
 * land (era/stage-buildings.js), its yard of containers on a slab under floodlights, a walker parked in its hall, read
 * in the seventh generation at an hour and under a weather. The place is the geocube's own recipe and nothing of it is
 * drawn here; the mission is laid on it AS IT STANDS: its page's colliders read onto the arena grid
 * (arena-map/read-colliders.js), the phases placed from that map's own measures (arena-map/phases.js), the laws said
 * as advice (arena-map/laws.js). So what is fought over is what is walked.
 *
 *   SITE                       what a site is when it names nothing: its building, its yard, its hour, its weather
 *   readSite(v, at?)           a site as written → { use, containers, floods, floodsAt, hour, weather, parked, cube? };
 *                              throws, teaching
 *   siteRecipe(G, site, { parked? }) → the geocube recipe of the place ({ kind: 'geocube', cube, show, buildings, … })
 *   missionSiteLevel(G, { site?, spec?, seed?, refs?, resolve? }) → Promise<{ manifest, mission, laws, map, brief, site }>
 *                              the playable level: the recipe with the mission's cast, tasks and page on it
 *
 * The place is resolved to be read (twice, where something is parked: once to find the hall it stands in, once with it
 * standing there), so this is a builder, not a pure stage: a level of a game carries what it returns.
 * Said: the map is the ground storey and the yard, its edge open to the land (`bounded` says so); a hold's wave comes
 * on the ground.
 */
import { missionBrief, readMission } from '../mission/index.js';
import { missionCast, missionMechanics, missionUi, missionCube } from './mission-level.js';
import { feelRule } from './feel/lower.js';
import { readCollidersMap } from '../arena-map/read-colliders.js';
import { phasesOnMap, phaseLaws } from '../arena-map/phases.js';
import { mapLaws, kitOf } from '../arena-map/laws.js';
import { PROGRAM_IDS, PROGRAMS } from '../era/programs.js';
import { STATES } from '../weather/weather.js';
import { readHour } from '../era/geocube-hours.js';

export const SITE = Object.freeze({ use: 'warehouse', containers: 12, floods: 4, floodsAt: 'middle', hour: 'night', weather: 'rain', parked: Object.freeze(['siege-walker']) });
/** The open ground kept past a trail's far side for the site (m). */
const SITE_ROOM = 40;
/** Where its door stands on the site and the way it faces (m): its yard before it toward the trail, its hall and its
 *  wings behind it in the open ground, the whole of it inside the site's edges. */
const SITE_AT = Object.freeze({ x: 30, y: 46, facing: '-x' });
const KEYS = ['use', 'containers', 'floods', 'floodsAt', 'hour', 'weather', 'parked', 'cube'];

/** A site as written (see the header). */
export function readSite(v = {}, at = 'site') {
  const no = (m) => { throw new Error(`mission: ${at}${m}`); };
  if (v === true) v = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) no(` is true or { ${KEYS.join('?, ')}? }`);
  const bad = Object.keys(v).find((k) => !KEYS.includes(k));
  if (bad) no(`.${bad} is not a site's word (${KEYS.join(', ')})`);
  const S = { ...SITE, ...v, parked: v.parked === undefined ? SITE.parked.slice() : v.parked === false ? [] : v.parked };
  const halls = PROGRAM_IDS.filter((u) => PROGRAMS[u].annex);
  if (!halls.includes(S.use)) no(`.use is a building with a hall on a yard: ${halls.join(', ')}`);
  if (!(Number.isInteger(S.containers) && S.containers >= 0 && S.containers <= 40)) no('.containers is how many stand in its yard, 0 to 40');
  if (!(Number.isInteger(S.floods) && S.floods >= 0 && S.floods <= 8)) no('.floods is how many floodlights stand over its yard, 0 to 8');
  if (!['edge', 'middle'].includes(S.floodsAt)) no('.floodsAt is edge (along its yard\'s outer edge) or middle');
  try { readHour(S.hour); } catch (e) { no(`.${e.message}`); }
  if (S.weather !== null && S.weather !== false && !(typeof S.weather === 'string' && STATES[S.weather])) no(`.weather is the air over it (${Object.keys(STATES).join(', ')}), or false`);
  if (!Array.isArray(S.parked) || S.parked.some((w) => typeof w !== 'string')) no('.parked is the vehicles standing in its hall, by their words ([\'siege-walker\']), or false');
  return S;
}

/** The place's recipe: the geocube's own words, the mission's cube (the seventh generation unless the world names its era). */
export function siteRecipe(G, site, { parked = null } = {}) {
  const yard = { ...(site.containers ? { containers: site.containers } : {}), ...(site.floods ? { floods: site.floods, floodsAt: site.floodsAt } : {}) };
  return {
    // (a hall and its yard are wider than a trail's own site: open ground past its far side, `ground.room`, so the
    // site's edge stands clear of the building and of its apron)
    kind: 'geocube', cube: site.cube ?? missionCube(G), show: 'path', trail: { ground: { room: SITE_ROOM } }, hour: site.hour, ...(site.weather ? { weather: site.weather } : {}), shadows: { actors: true, hour: true },
    // (a hall kept clear for what is parked in it: the `garage` dressing, era/bay.js)
    buildings: [{ use: site.use, at: { ...SITE_AT }, look: { construction: 'utility', ...(site.parked.length ? { dressing: 'garage' } : {}) }, ...(Object.keys(yard).length ? { yard } : {}), apron: 'slab' }],
    ...(parked && parked.length ? { parked } : {}),
  };
}

const EYE = 1.7;
/** The mission on the site, playable (see the header). */
export async function missionSiteLevel(G, { site: siteIn = {}, spec = {}, seed = null, refs = {}, resolve = null } = {}) {
  const site = readSite(siteIn), brief = missionBrief(G, readMission(spec));
  if (!brief) throw new Error('mission: this world carries no gun (a quick shooter\'s arms, a hero\'s carried gun, or a feel template that shoots)');
  const res = resolve ?? (await import('../worlds/world-scene.js')).resolveWorldScene, dice = seed ?? (Number.isInteger(G?.seed) ? G.seed : 1);
  const view = { era: missionCube(G).era ?? 'gen-7', live: true };
  // the place as it stands, to find its hall; then with what is parked standing in it
  let recipe = siteRecipe(G, site), { payload: P } = await res({ ref: 'mission-site', title: 'site', manifest: { ...recipe, seed: dice } }, view);
  const A = (P.anchors || []).find((a) => a.kind === 'building'), B = (P.buildings || [])[0];
  if (!A || !B?.site?.apron) throw new Error('mission: the site stood no building on an apron');
  if (site.parked.length) {
    // (the hall: its tallest room; a walker at its middle, its nose down its length, the next beside it)
    const hall = A.rooms.reduce((a, b) => (b.box.max[2] - b.box.min[2] > a.box.max[2] - a.box.min[2] ? b : a)), mn = hall.box.min, mx = hall.box.max, alongX = mx[0] - mn[0] >= mx[1] - mn[1];
    const parked = site.parked.map((vehicle, k) => {
      const u = (k + 1) / (site.parked.length + 1), at = alongX ? [mn[0] + (mx[0] - mn[0]) * u, (mn[1] + mx[1]) / 2, mn[2]] : [(mn[0] + mx[0]) / 2, mn[1] + (mx[1] - mn[1]) * u, mn[2]];
      return { vehicle, at: at.map((v) => Math.round(v * 100) / 100), heading: alongX ? Math.PI / 2 : 0 };
    });
    recipe = siteRecipe(G, site, { parked });
    ({ payload: P } = await res({ ref: 'mission-site', title: 'site', manifest: { ...recipe, seed: dice } }, view));
  }
  // THE MAP: the apron and what stands on it, at the building's floor
  const rect = B.site.apron.slice(0, 4), z = A.floor;
  const map = readCollidersMap(P.colliders, { rect, z: z - 0.15 }), kit = kitOf(brief);
  const M = phasesOnMap(brief, map, { seed: dice, at: [rect[0], rect[1], z] });
  // (walked as a building is: on the place's own colliders at its floor, the runtime's nav, since a doorway seldom
  // stands on a cell's middle and a cell-to-cell walk would meet the wall beside it; `frame` its one floor, no stair)
  M.on = 'building';
  M.frame = { origin: [rect[0], rect[1]].map((v) => Math.round(v * 1000) / 1000), cell: map.read.cell, floors: [Math.round(z * 1000) / 1000], stairs: [] };
  const laws = [...phaseLaws(M, map), ...mapLaws(map, kit).laws.map((l) => ({ law: `map:${l.law}`, holds: l.holds, says: l.says }))];
  // THE LEVEL: the place's recipe with the mission's cast on it, the pilot at the eye on the platform rule
  const C = missionCast(G, M, { refs, quiet: true }), felt = G?.feel != null ? feelRule(G.feel) : null;
  const rule = { type: 'platform', speed: 4.5, walkSpeed: 1.6, turn: 2.4, eye: EYE, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, ...(felt ?? {}), turnMode: 'look', lookPitch: true, strafe: 1, ...C.pilot.rule };
  const sp = M.anchors.spawn, player = { id: 'player', pilotable: true, rule, ...(C.pilot.weapon ? { weapon: C.pilot.weapon } : {}), body: { type: 'none', ...C.pilot.body }, transform: { pos: [sp[0], sp[1], sp[2] + EYE], heading: M.heading } };
  const name = G?.name ?? G?.id ?? 'game';
  const manifest = {
    ...recipe, seed: dice, title: `Mission · ${name}`,
    figures: C.figures, entities: [player, ...C.entities], camera: C.eyeCamera,
    events: { hud: [{ text: `W / S  walk · A / D  step aside · mouse  look · ${C.legend}${C.pilot.rule.knife ? ' · V  knife' : ''}`, ttl: 20 }] },
    ...(C.audio ? { audio: C.audio } : {}),
    mission: missionUi(G, M, brief, { laws }),
    game: { levelRef: `${G?.id ?? 'game'}-mission`, mechanics: missionMechanics(M, { lift: EYE }), fall: { mode: 'respawn' }, complete: false },
  };
  return { manifest, mission: M, laws, map, brief, site, recipe };
}
