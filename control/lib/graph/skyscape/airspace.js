/**
 * airspace — the `airspace` world kind: a map (map.js) and its ground (ground.js), carried to the World page by the
 * terrain channel with the LOD and haze the pilot's eye planned. A flight game's level is one, as a racing game's is
 * a roadway.
 *
 * manifest: { kind: 'airspace', map?: { form?, field?, craft?, ceiling?, lands? }, ground?: { land?, heartbeat?, scale?,
 *             pads?, cities?, country?, geocube?, gorge?, seed? }, seed?, spawn?: [x, y, z] metres, viewBox?, fly?: true | { craft? }, assist?: 'arcade' | 'sim',
 *             course?: true | { gates?, laps?, land? }, palette? }
 *
 * `palette` (a color-theorist spec: pick_palette's, a preset such as 'coastal-noon', or a gameworld level's, moved by
 * its script) colours the land, the sky, the haze and the sea (ground.js); without it the map is painted as it always
 * was, from its geocube under a day sky. The haze stays the sky's horizon (it hides the map's edge). A space map keeps
 * its void.
 *
 * `course` plans a gate course on the map (course.js): its ring gates drawn, its gates, finish and laws in `meta.course`
 * (the checkpoints a level's `laps` mechanic takes).
 *
 * `fly` seats the map's craft (or the one named) on the fly rule its class gives (craft.js), on the first pad's
 * threshold looking down it (a craft with no engine starts aloft, flying), followed by a chase camera that banks with
 * it. A game level seats its own pilot instead (its `entities`, `camera` and `game` ride the manifest as on any
 * level's kind), so only airspace's own keys are checked here.
 *
 * A city on the ground (`ground.cities`, city.js) comes as instanced boxes on the live page and as faces in exports: its
 * masses do not mesh with the terrain. The country (`ground.country`, country.js) comes to the live page as the terrain
 * channel's `aerial` (aerial.js: the land's cover and plan in the ground's shader, the buildings under a facade shader,
 * the pylons and their lines) and to exports as its buildings' faces.
 *
 * The payload carries no ground faces on the live page (it meshes them round the camera); exports and stills get the
 * ground baked at twice the map's grid cell. Bookmarks: the first pad's threshold looking down it, the field from a
 * low pass, and the whole map from the ceiling. `meta` carries the map's rings, haze and laws and the ground's report,
 * so an agent reads what was built without opening the page.
 */
import { planMap, mapLaws, validateMap } from './map.js';
import { mapGround, readGroundAsk } from './ground.js';
import { terrainPageChannel, bakeTerrainFaces } from '../terrain/terrain-world.js';
import * as dmath from '../../util/dmath.js';

import { seatCraft, craftPilot, airframeOf } from './craft.js';
import { planCourse } from './course.js';
import { craftOf } from './eye.js';
import { planSpace, spaceField, spaceSeat, courseTubes, spaceLaws, validateSpace, SPACE_STAR } from './space.js';
import { planBackdrop } from './backdrop.js';
import { fleetWorld, layFleet, toward } from './space-fleet.js';
import { trenchField } from './trench.js';
import { railPath, railKeep, planRailStage } from './rail-stage.js';
import { rockPool, rockRepeats } from '../polygonizer/rock-pool.js';
import { makeLight } from '../polygonizer/vexar.js';
import { readPaletteSpec } from '../color-theorist/solve.js';
import { aerialPageConfig } from './aerial.js';
import { readSkyAsk, flightSky } from './sky.js';
import { nightLightsConfig } from './night-lights.js';
import { AQUA_PRESETS } from '../materials/aqua-look.js';
import { countryFaces } from './country.js';

/** A space manifest: its map's form is 'void', or its craft is a space craft (the fighter), whose map is space. */
export function isSpace(m) {
  const craft = (m.fly && typeof m.fly === 'object' && m.fly.craft) || m.map?.craft;
  let space = false; try { space = !!(craft && craftOf(craft).space); } catch { /* the validator says so */ }
  return m.map?.form === 'void' || space;
}
const rgbHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const r2 = (v) => Math.round(v * 100) / 100;
/** The spacing (m) a city's ground is meshed at near it: a street's width, so the painted plan reads. */
const CITY_PIN = 8;
/** The spacing (m) a country's settlement is meshed at, and from how many of its nodes off (its whole extent is seen
 *  from a flyover's distance): a block's ground, so a quay and a grade hold. */
const COUNTRY_PIN = 16, COUNTRY_SPLIT = 10;

/** Errors (strings) for an airspace manifest; [] when it builds. */
export function validateAirspace(m) {
  if (!m || typeof m !== 'object') return ['airspace must be an object { kind: \'airspace\', map?, ground?, seed?, spawn? }'];
  const e = [];
  if (isSpace(m)) {
    // space: a field and its rocks, no ground (space.js)
    if (m.map !== undefined) { const { form: _f, ...rest } = m.map; void _f; e.push(...validateMap(rest).filter((x) => !/map\.field/.test(x)), ...validateSpace(m.map, m.space || {})); }
    if (m.ground !== undefined) e.push('airspace.ground: space has no ground (its contents are `space: { asteroids }`)');
    if (m.space !== undefined && !(m.space && typeof m.space === 'object')) e.push('airspace.space must be { asteroids? }');
  } else {
    if (m.map !== undefined) e.push(...validateMap(m.map));
    if (m.ground !== undefined) e.push(...readGroundAsk(m.ground));
    if (m.space !== undefined) e.push("airspace.space belongs to a space map (map.form: 'void', or a space craft)");
  }
  if (m.spawn !== undefined && !(Array.isArray(m.spawn) && m.spawn.length === 3 && m.spawn.every(Number.isFinite))) e.push('airspace.spawn must be [x, y, z] in metres');
  if (m.fly !== undefined && m.fly !== true && !(m.fly && typeof m.fly === 'object')) e.push('airspace.fly must be true or { craft? }: seat a craft to fly the map');
  if (m.assist !== undefined && !['arcade', 'sim'].includes(m.assist)) e.push("airspace.assist must be 'arcade' (never stalls, the wings level quickly) or 'sim' (the bank holds where it is put)");
  if (m.course !== undefined && m.course !== true && m.course !== false && !(m.course && typeof m.course === 'object')) e.push('airspace.course must be true or { gates?, laps?, land? }: plan a gate course on the map (false: none)');
  if (m.fly && typeof m.fly === 'object' && m.fly.craft !== undefined) { try { craftOf(m.fly.craft); } catch (err) { e.push(`airspace.fly: ${err.message}`); } }
  if (m.palette !== undefined) { try { readPaletteSpec(m.palette, 'airspace.palette'); } catch (err) { e.push(err.message); } }
  if (m.sky !== undefined) { if (isSpace(m)) e.push('airspace.sky: space has no weather (its sky is `space.backdrop`)'); else e.push(...readSkyAsk(m.sky)); }
  if (m.airframe !== undefined && m.airframe !== false) { try { airframeOf({ key: null }, m.airframe); } catch (err) { e.push(err.message); } }
  // a rail stage (rail-stage.js): down a canyon's floor, or through a field of rocks in space
  if (m.rail !== undefined) {
    if (m.rail !== true && !(m.rail && typeof m.rail === 'object' && Object.keys(m.rail).every((k) => ['speed', 'waves', 'per'].includes(k)))) e.push('airspace.rail is true or { speed?, waves?, per? }: a stage flown down a path');
    if (!isSpace(m) && (m.map?.form ?? 'island') !== 'canyon') e.push("airspace.rail: a ground stage runs down a canyon (map.form: 'canyon'); a space stage needs a space craft or map.form 'void'");
    if (m.course) e.push('airspace.rail: a rail stage has its path, not a course');
    if (m.space?.trench) e.push('airspace.rail: a trench is its own run (space.trench), not a rail stage');
  }
  // a cockpit (starfighter.js): the craft flown from its seat in the 90s space-combat register, in space
  if (m.cockpit !== undefined) {
    if (typeof m.cockpit !== 'boolean') e.push('airspace.cockpit is true or false: the craft flown from its cockpit (a space combat sim)');
    else if (m.cockpit && !isSpace(m)) e.push('airspace.cockpit: a cockpit flies in space (a space craft, or map.form \'void\'); a craft over a ground flies on the fly rule');
    else if (m.cockpit && m.rail) e.push('airspace.cockpit: a rail stage is flown down its path, not from a cockpit');
  }
  return e;
}

/** The map and its ground for a manifest (the pieces a flight level reads: the course, the pilotable's spawn). */
export function airspaceOf(manifest) {
  const errs = validateAirspace(manifest); if (errs.length) throw new Error(`airspace: ${errs.join('; ')}`);
  // a seated craft (`fly.craft`) is the one the map is planned for: its reach, its haze, its ground's detail
  const craft = (manifest.fly && typeof manifest.fly === 'object' && manifest.fly.craft) || manifest.map?.craft;
  const seed = manifest.seed ?? manifest.map?.seed ?? 1;
  if (isSpace(manifest)) {
    // space: the course is planned on the empty field first, so the rocks keep clear of it (and of the start)
    const map = planSpace({ field: manifest.map?.field, craft: craft || 'fighter', seed });
    // a battle station's trench (trench.js): its own ground and its own run, no rocks
    if (manifest.space?.trench) return { map, field: trenchField(map, { seed }) };
    const course = planCourse(map, spaceField(map, { asteroids: 'none' }), { ...(manifest.course && manifest.course !== true ? manifest.course : {}), seed });
    // (a rail stage's way laid first too, and its rocks kept off it: rail-stage.js, the stage's own laid on this field)
    const rail = manifest.rail ? railKeep(railPath(map, null, { seed, ...(manifest.rail.speed ? { speed: manifest.rail.speed } : {}) })) : [];
    // (and its capital ships and stations, space-fleet.js: the rocks keep clear of each)
    const fleet = manifest.space?.fleet ? fleetWorld(manifest.space.fleet, spaceSeat(map, course)).map((f) => [f.center, f.center, f.radius]) : [];
    const field = spaceField(map, { asteroids: manifest.space?.asteroids ?? 'field', seed, keep: [...courseTubes(map, course, spaceSeat(map, course)), ...rail, ...fleet] });
    field.loop = course;   // the lanes kept open: a level with no course still starts on its run-in (craft.js)
    return { map, field };
  }
  const map = planMap({ ...(manifest.map || {}), ...(craft ? { craft } : {}), seed });
  // (a rail stage down a canyon runs down a gorge cut along it: ground.js `gorge`, unless the ground says otherwise)
  const gorge = manifest.rail && map.form === 'canyon' && manifest.ground?.gorge === undefined ? { gorge: true } : {};
  // the weather (sky.js): its sun and light the ground's, its clouds and sea the page's
  const sky = flightSky(manifest.sky, { map, seed });
  const field = mapGround(map, { seed: manifest.seed, ...gorge, ...(manifest.ground || {}) }, { palette: manifest.palette || undefined, sky });
  return { map, field };
}

/** A rail stage's hazards drawn as the land's own rocks (rail-stage.js): a rock in space where it stands, a pillar a
 *  stack of them from the canyon's floor to above the way. The stage is planned as the level plans it (the same seed,
 *  the same ask), so what is drawn is what the stage's hazard mechanic hurts. [] without a rail. */
function railHazardRepeats(manifest, map, field, { light, tone, rock = 'granite' }) {
  if (!manifest.rail) return [];
  const S = planRailStage(map, field, { seed: manifest.seed ?? 1, ...(manifest.rail === true ? {} : manifest.rail) }), items = [];
  for (const h of S.hazards) {
    if (!h.size) { items.push({ x: h.at[0], y: h.at[1], z0: r2(h.at[2] - h.radius), size: r2(2 * h.radius) }); continue; }
    for (let z = h.base - h.radius * 0.4, top = h.base + h.size[2], k = 0; z < top; z += h.radius * 0.6, k++) items.push({ x: r2(h.at[0] + (k % 2 ? 0.15 : -0.15) * h.radius), y: h.at[1], z0: r2(z), size: r2(2.3 * h.radius) });
  }
  return items.length ? rockRepeats(rockPool({ rock, variants: 4, detail: 1, tone, seed: `rail::hazards::${manifest.seed ?? 1}`, light, group: 'hazards' }), items, { sink: 0, group: 'hazards' }) : [];
}

/** The flight sky for the page (flight-sky.js): its light and colours, its layers, its cumulus packed. */
function skyPageConfig(S, field) {
  const F = new Float32Array(S.clouds.flat());
  // (the towns' light at night, thrown up into the air and onto the clouds over them: each settlement's middle, its
  // reach and its strength by its size)
  const strength = { metro: 1, town: 0.45, village: 0.15 };
  const glows = (field.report.country?.settlements || []).map((c) => [c.center[0], c.center[1], r2(Math.max(...c.size) * 0.6), strength[c.kind] ?? 0.2]);
  return { sun: S.sun.dir, sunCol: S.sun.color, zenith: S.colours.zenith, horizon: S.colours.horizon, cloudLit: S.colours.cloudLit, cloudShade: S.colours.cloudShade,
    aloft: S.aloft,
    clear: S.light.gain > 0.3 ? 1 : 0.15, wind: S.wind.dir, windSpeed: S.wind.speed, layers: S.layers.map((L) => ({ type: L.type, form: L.form ?? null, base: L.base, depth: Array.isArray(L.depth) ? L.depth[1] : L.depth ?? 0, cover: L.cover })),
    clouds: { n: S.clouds.length, data: Buffer.from(F.buffer).toString('base64') }, domain: S.domain, shadow: true,
    night: S.night, moon: { dir: S.moon.dir, color: S.moon.color, phase: S.moon.phase }, lightning: S.lightning, glows, glowCol: '#ffb062' };
}
/** The ocean for the page (ocean.js): the sea's colours (a palette's water where one paints it), its trains, its wind,
 *  the rect its depth is baked over, the aqua look's ripples. */
function oceanPageConfig(field, S) {
  const b = field.bounds, A = AQUA_PRESETS.ocean;
  // (by night the moon's glint, its path across the water)
  const moonlit = S.night > 0.5;
  return { z: field.meta.sea, deep: moonlit ? S.colours.sea : field.water ?? S.colours.sea, shallow: moonlit ? S.colours.sea : S.colours.seaShallow, foam: moonlit ? '#5a6270' : '#eef2f0', zenith: S.colours.zenith, horizon: S.colours.horizon,
    sun: moonlit ? S.moon.dir : S.sun.dir, sunCol: moonlit ? S.moon.color : S.sun.color,
    glint: moonlit ? 0.5 * S.moon.phase : S.light.gain > 0.3 ? 1 : 0.2, waves: S.sea.waves, wind: S.wind.speed, rect: [b.x[0], b.y[0], b.x[1], b.y[1]].map(r2), res: 256,
    look: { rough: A.rough, nScale: A.nScale * 0.5, nAmp: A.nAmp * (0.6 + Math.min(1, S.wind.speed / 12)), nSpeed: A.nSpeed, froth: A.froth } };
}

export function assembleAirspace(manifest, { title = 'mojulo airspace', live = false } = {}) {
  if (isSpace(manifest)) return assembleSpace(manifest, { title });
  const { map, field } = airspaceOf(manifest);
  const channel = terrainPageChannel(field, { n: map.lod.n, split: map.lod.split, minSize: map.lod.minSize, horizonScale: map.lod.horizonScale });
  channel.hazeHeight = map.haze.hazeHeight;
  if (field.water && channel.water) channel.water = { ...channel.water, color: field.water };
  // the country (country.js): its cover, its plan and its city drawn by the terrain channel's aerial script (aerial.js)
  if (live && field.aerial) channel.aerial = aerialPageConfig(field, map);
  // the weather's sky and clouds (flight-sky.js) and the sea with its waves (ocean.js), on the live page
  if (live && field.sky) {
    channel.sky = skyPageConfig(field.sky, field);
    if (field.meta.sea !== null) channel.ocean = oceanPageConfig(field, field.sky);
    // (from the dusk on: the runway's lights, the beacons, the traffic: night-lights.js)
    const lights = nightLightsConfig(field); if (lights) channel.lights = lights;
  }
  // a city's painted streets read only where the mesh is finer than they are: over its footprint a node splits, while
  // the eye is near enough to see them, down to CITY_PIN m between vertices (the terrain world's pin)
  const towns = field.report.cities || [];
  if (towns.length) channel.pins = towns.map((c) => ({ rect: [c.center[0] - c.size[0] / 2, c.center[0] + c.size[0] / 2, c.center[1] - c.size[1] / 2, c.center[1] + c.size[1] / 2], size: CITY_PIN * map.lod.n, split: map.lod.split }));
  // the country's settlements (and a metro's harbour) likewise, at COUNTRY_PIN: their quays and grades stay steps, never
  // a coarse chunk's slope out of the water
  if (live && field.aerial) {
    const pins = field.country.settlements.map((s) => ({ rect: [s.origin[0] - 60, s.origin[0] + s.extent[0] + 60, s.origin[1] - 60, s.origin[1] + s.extent[1] + 60], size: COUNTRY_PIN * map.lod.n, split: Math.max(map.lod.split, COUNTRY_SPLIT) }));
    channel.pins = [...(channel.pins || []), ...pins];
  }
  // the free camera flies at the craft's speeds: its stall at the ground, faster with height
  channel.speeds = { walk: 4.5, flyMin: map.craft.stall, flyPerAlt: r2(map.craft.cruise / Math.max(1, map.ceiling / 4)) };
  const F = map.rings.field;
  const course = manifest.course ? planCourse(map, field, { ...(manifest.course === true ? {} : manifest.course), seed: manifest.seed ?? 1 }) : null;
  // the departure threshold of the first pad, looking down it (craft.js seatCraft); else the field's south edge
  const seat = seatCraft(map, field, course, { assist: manifest.assist }), look = seat.end;
  const spawn = Array.isArray(manifest.spawn) ? manifest.spawn : [seat.transform.pos[0], seat.transform.pos[1], seat.ground + 2];
  const low = map.craft.lowPass, top = map.ceiling, fieldR = dmath.hypot(F.hx, F.hy);
  // a bookmark over the land stands clear of it: at its height, or two low passes over the ground under it
  const over = (x, y, z) => [x, y, Math.max(z, field.groundAt(x, y) + 2 * low)];
  const cameras = [
    { name: 'threshold', worldFraming: { cameraPosition: [spawn[0], spawn[1], spawn[2] + 2], lookAt: [look[0], look[1], look[2] + 2], horizontalFov: 70 } },
    { name: 'low-pass', worldFraming: { cameraPosition: [-F.hx * 0.9, -F.hy * 0.9, field.groundAt(-F.hx * 0.9, -F.hy * 0.9) + 2 * low], lookAt: [0, 0, field.groundAt(0, 0)], horizontalFov: 65 } },
    { name: 'ceiling', worldFraming: { cameraPosition: over(0, -fieldR * 1.6, top), lookAt: [0, 0, field.groundAt(0, 0)], horizontalFov: 60 } },
    // each of the country's settlements from an approach off its corner, a flyover's height over it
    ...(field.report.country?.settlements || []).map((c) => { const [x, y] = c.center, R = dmath.hypot(c.size[0], c.size[1]), gz = field.groundAt(x, y), up = (c.kind === 'metro' ? 0.18 : 0.3) * R; return { name: c.id, worldFraming: { cameraPosition: over(x - 0.75 * R, y - 0.75 * R, gz + up), lookAt: [x, y, gz], horizontalFov: 60 } }; }),
    // each city from a low pass off its corner, a little above its tallest roof
    ...(field.report.cities || []).map((c, i) => { const [x, y] = c.center, R = dmath.hypot(c.size[0], c.size[1]), gz = field.groundAt(x, y); return { name: i ? `city-${i + 1}` : 'city', worldFraming: { cameraPosition: over(x - 0.7 * R, y - 0.7 * R, gz + c.tallest + 2 * low), lookAt: [x, y, gz + 0.3 * c.tallest], horizontalFov: 60 } }; }),
  ];
  // the craft, seated (`fly`): on the departure threshold, its nose down the pad; a craft with no engine launched aloft
  const pilot = manifest.fly ? craftPilot(map, seat, { airframe: false }) : null;   // (a slab: a payload resolves no figures; a level's pilot flies its airframe)
  const s = field.meta.sky;
  const sky = { zenith: s.zenith, horizon: s.horizon, day: s.day, stars: 0, seed: 1, center: spawn, radius: 290 };
  const bg = rgbHex(s.horizon);
  const b = field.bounds;
  return {
    faces: [...(live ? [] : bakeTerrainFaces(field, { spacing: 2 * map.grid.cell, patches: field.pads.map((p) => ({ x0: p.x0, y0: p.y0, w: p.x1 - p.x0, d: p.y1 - p.y0 })) })), ...(live ? field.cityFormed : field.cityFaces), ...(!live && field.aerial ? countryFaces(field.aerial, { dir: field.K.light, ambient: field.K.lambert.ambient, gain: field.K.lambert.gain }) : []), ...(course ? course.faces : [])],
    // the live page's city masses: instanced unit boxes (city.js), a few numbers each
    ...((R) => (R.length ? { repeats: R } : {}))([...(live ? field.cityRepeats : []), ...railHazardRepeats(manifest, map, field, { light: makeLight({ direction: field.K.light.map((v) => -v), ambient: 0.5, diffuse: 0.6 }), tone: '#' + field.K.ramps.stone.stops[3].map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''), rock: field.meta.rock || 'granite' })]),
    terrain: channel, cameras, sky, bg, title,
    // the haze IS the map's edge cheat: the density the map planned, thinned with height by the channel's hazeHeight
    haze: { color: bg, density: Number((map.haze.density * (field.sky ? field.sky.hazeMul : 1)).toPrecision(6)) },
    // the free walk and fly, unless a craft is seated (its pilot has the keys)
    ...(pilot ? {} : { walk: { speed: channel.speeds.walk, spawn, radius: 0.4, minEye: 1.7, gravity: 20, jump: 6 } }),
    viewBox: manifest.viewBox && manifest.viewBox.width ? manifest.viewBox : { width: 1120, height: 760 },
    ...(pilot || {}),
    meta: {
      map: { form: map.form, craft: map.craft.key, ceiling: map.ceiling, rings: map.rings, haze: map.haze, lod: map.lod, grid: map.grid },
      laws: mapLaws(map),
      ground: field.report,
      // the weather as a pilot is briefed on it (sky.js): its kind, its hour, its METAR, its sea
      ...(field.sky ? { sky: { kind: field.sky.kind, hour: field.sky.hour, metar: field.sky.metar, wind: field.sky.wind, sea: { height: field.sky.sea.height, peak: field.sky.sea.peak }, clouds: field.sky.clouds.length } } : {}),
      pads: field.pads.map((p) => ({ id: p.id, kind: p.kind, center: p.center, along: p.along, size: [p.length, p.width], datum: p.datum, ...(p.depart ? { depart: p.depart, gradient: p.gradient } : {}) })),
      ...(course ? { course: { gates: course.gates, finish: course.finish, laps: course.laps, laws: course.laws } } : {}),
      bounds: b, rootSize: channel.root.size,
    },
  };
}

/** A space map's backdrop (backdrop.js): its nebula, planets and far sun, seeded by the map (its own `backdrop.seed`,
 *  else the map's); `space.backdrop: false` a sky of stars alone; `space.backdrop.toward` { bearing, elevation } the large
 *  world's place from the pilot's start. */
function backdropOf(manifest, seat) {
  const B = manifest.space && manifest.space.backdrop;
  if (B === false) return {};
  const o = B && typeof B === 'object' ? B : {};
  // (the large world where a mission set it: a bearing and an elevation from the start, space-fleet.js toward)
  return { backdrop: planBackdrop({ star: SPACE_STAR.dir, seed: o.seed ?? manifest.seed ?? 1, ...(o.toward && seat ? { toward: toward(seat, o.toward) } : {}), ...(o.planets !== undefined ? { planets: o.planets } : {}), ...(o.nebula !== undefined ? { nebula: o.nebula } : {}), ...(o.suns !== undefined ? { suns: o.suns } : {}), ...(Array.isArray(o.worlds) ? { worlds: o.worlds } : {}), ...(o.proximity ? { proximity: o.proximity } : {}) }) };
}

/** The space map on the World page (space.js): stars all round, the rocks instanced, the course's gates, no ground. */
function assembleSpace(manifest, { title }) {
  const { map, field } = airspaceOf(manifest);
  const course = manifest.course ? planCourse(map, field, { ...(manifest.course === true ? {} : manifest.course), seed: manifest.seed ?? 1 }) : null;
  const seat = seatCraft(map, field, course, { assist: manifest.assist }), p = seat.transform.pos, R = map.rings.reach;
  const pilot = manifest.fly ? craftPilot(map, seat, { airframe: false }) : null;   // (a slab: a payload resolves no figures; a level's pilot flies its airframe)
  const ahead = [p[0] + Math.cos(seat.transform.heading) * 400, p[1] + Math.sin(seat.transform.heading) * 400, p[2]];
  const cameras = [
    { name: 'start', worldFraming: { cameraPosition: [p[0] - Math.cos(seat.transform.heading) * 60, p[1] - Math.sin(seat.transform.heading) * 60, p[2] + 15], lookAt: ahead, horizontalFov: 70 } },
    { name: 'field', worldFraming: { cameraPosition: [-R.hx, -R.hy, R.hz], lookAt: [0, 0, 0], horizontalFov: 60 } },
  ];
  const laws = [...spaceLaws(map, field, course, seat.transform), ...(course ? course.laws : [])];
  // capital ships and stations (space-fleet.js): their faces under the star, their hulls colliders, a bookmark on each
  const fleet = manifest.space?.fleet ? layFleet(manifest.space.fleet, seat.transform, { sun: SPACE_STAR.dir }) : null;
  if (fleet) cameras.push(...fleet.cameras);
  return {
    faces: [...(field.faces || []), ...(course ? course.faces : []), ...(fleet ? fleet.faces : [])],
    ...(fleet ? { colliders: fleet.colliders } : {}), repeats: [...field.repeats, ...railHazardRepeats(manifest, map, field, { light: makeLight({ direction: [-0.45, 0.35, -0.82], ambient: 0.32, diffuse: 0.78 }), tone: '#7d756c' })], cameras, title,
    // (the star the craft are lit by, where the rocks' light comes from: space.js SPACE_STAR; the sky at infinity, flown
    // through and never past)
    sky: { space: true, seed: 7, center: [0, 0, 0], radius: 7000, follow: true, sun: { dir: [...SPACE_STAR.dir], size: SPACE_STAR.size, glow: SPACE_STAR.glow }, ...backdropOf(manifest, seat.transform) }, bg: '#03040a',
    ...(pilot ? {} : { walk: { speed: 20, spawn: p, radius: 0.4, minEye: 1.7, gravity: 0, jump: 0 } }),
    // (a fleet's ships and stations, fleet/: their blocks to the world's build, destructible under physical)
    ...(Array.isArray(manifest.fleet) && manifest.fleet.length ? { physicalFleet: manifest.fleet } : {}),
    viewBox: manifest.viewBox && manifest.viewBox.width ? manifest.viewBox : { width: 1120, height: 760 },
    ...(pilot || {}),
    meta: {
      map: { form: 'void', craft: map.craft.key, rings: map.rings },
      laws, space: field.report, ...(fleet ? { fleet: fleet.report } : {}), ...(field.trench ? { trench: { ...field.trench, port: field.port, turrets: field.turrets.length } } : {}),
      ...(course ? { course: { gates: course.gates, finish: null, laps: course.laps, laws: course.laws } } : {}),
    },
  };
}
