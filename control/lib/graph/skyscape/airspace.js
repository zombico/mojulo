/**
 * airspace — the `airspace` world kind: a map (map.js) and its ground (ground.js), carried to the World page by the
 * terrain channel with the LOD and haze the pilot's eye planned. A flight game's level is one, as a racing game's is
 * a roadway.
 *
 * manifest: { kind: 'airspace', map?: { form?, field?, craft?, ceiling?, lands? }, ground?: { land?, heartbeat?, scale?,
 *             pads?, cities?, geocube?, seed? }, seed?, spawn?: [x, y, z] metres, viewBox?, fly?: true | { craft? }, assist?: 'arcade' | 'sim',
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
 * masses do not mesh with the terrain.
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

import { seatCraft, craftPilot } from './craft.js';
import { planCourse } from './course.js';
import { craftOf } from './eye.js';
import { planSpace, spaceField, spaceSeat, courseTubes, spaceLaws, validateSpace } from './space.js';
import { trenchField } from './trench.js';
import { readPaletteSpec } from '../color-theorist/solve.js';

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
    const field = spaceField(map, { asteroids: manifest.space?.asteroids ?? 'field', seed, keep: courseTubes(map, course, spaceSeat(map, course)) });
    field.loop = course;   // the lanes kept open: a level with no course still starts on its run-in (craft.js)
    return { map, field };
  }
  const map = planMap({ ...(manifest.map || {}), ...(craft ? { craft } : {}), seed });
  const field = mapGround(map, { seed: manifest.seed, ...(manifest.ground || {}) }, { palette: manifest.palette || undefined });
  return { map, field };
}

export function assembleAirspace(manifest, { title = 'mojulo airspace', live = false } = {}) {
  if (isSpace(manifest)) return assembleSpace(manifest, { title });
  const { map, field } = airspaceOf(manifest);
  const channel = terrainPageChannel(field, { n: map.lod.n, split: map.lod.split, minSize: map.lod.minSize, horizonScale: map.lod.horizonScale });
  channel.hazeHeight = map.haze.hazeHeight;
  if (field.water && channel.water) channel.water = { ...channel.water, color: field.water };
  // a city's painted streets read only where the mesh is finer than they are: over its footprint a node splits, while
  // the eye is near enough to see them, down to CITY_PIN m between vertices (the terrain world's pin)
  const towns = field.report.cities || [];
  if (towns.length) channel.pins = towns.map((c) => ({ rect: [c.center[0] - c.size[0] / 2, c.center[0] + c.size[0] / 2, c.center[1] - c.size[1] / 2, c.center[1] + c.size[1] / 2], size: CITY_PIN * map.lod.n, split: map.lod.split }));
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
    // each city from a low pass off its corner, a little above its tallest roof
    ...(field.report.cities || []).map((c, i) => { const [x, y] = c.center, R = dmath.hypot(c.size[0], c.size[1]), gz = field.groundAt(x, y); return { name: i ? `city-${i + 1}` : 'city', worldFraming: { cameraPosition: over(x - 0.7 * R, y - 0.7 * R, gz + c.tallest + 2 * low), lookAt: [x, y, gz + 0.3 * c.tallest], horizontalFov: 60 } }; }),
  ];
  // the craft, seated (`fly`): on the departure threshold, its nose down the pad; a craft with no engine launched aloft
  const pilot = manifest.fly ? craftPilot(map, seat) : null;
  const s = field.meta.sky;
  const sky = { zenith: s.zenith, horizon: s.horizon, day: s.day, stars: 0, seed: 1, center: spawn, radius: 290 };
  const bg = rgbHex(s.horizon);
  const b = field.bounds;
  return {
    faces: [...(live ? [] : bakeTerrainFaces(field, { spacing: 2 * map.grid.cell, patches: field.pads.map((p) => ({ x0: p.x0, y0: p.y0, w: p.x1 - p.x0, d: p.y1 - p.y0 })) })), ...(live ? field.cityFormed : field.cityFaces), ...(course ? course.faces : [])],
    // the live page's city masses: instanced unit boxes (city.js), a few numbers each
    ...(live && field.cityRepeats.length ? { repeats: field.cityRepeats } : {}),
    terrain: channel, cameras, sky, bg, title,
    // the haze IS the map's edge cheat: the density the map planned, thinned with height by the channel's hazeHeight
    haze: { color: bg, density: map.haze.density },
    // the free walk and fly, unless a craft is seated (its pilot has the keys)
    ...(pilot ? {} : { walk: { speed: channel.speeds.walk, spawn, radius: 0.4, minEye: 1.7, gravity: 20, jump: 6 } }),
    viewBox: manifest.viewBox && manifest.viewBox.width ? manifest.viewBox : { width: 1120, height: 760 },
    ...(pilot || {}),
    meta: {
      map: { form: map.form, craft: map.craft.key, ceiling: map.ceiling, rings: map.rings, haze: map.haze, lod: map.lod, grid: map.grid },
      laws: mapLaws(map),
      ground: field.report,
      pads: field.pads.map((p) => ({ id: p.id, kind: p.kind, center: p.center, along: p.along, size: [p.length, p.width], datum: p.datum, ...(p.depart ? { depart: p.depart, gradient: p.gradient } : {}) })),
      ...(course ? { course: { gates: course.gates, finish: course.finish, laps: course.laps, laws: course.laws } } : {}),
      bounds: b, rootSize: channel.root.size,
    },
  };
}

/** The space map on the World page (space.js): stars all round, the rocks instanced, the course's gates, no ground. */
function assembleSpace(manifest, { title }) {
  const { map, field } = airspaceOf(manifest);
  const course = manifest.course ? planCourse(map, field, { ...(manifest.course === true ? {} : manifest.course), seed: manifest.seed ?? 1 }) : null;
  const seat = seatCraft(map, field, course, { assist: manifest.assist }), p = seat.transform.pos, R = map.rings.reach;
  const pilot = manifest.fly ? craftPilot(map, seat) : null;
  const ahead = [p[0] + Math.cos(seat.transform.heading) * 400, p[1] + Math.sin(seat.transform.heading) * 400, p[2]];
  const cameras = [
    { name: 'start', worldFraming: { cameraPosition: [p[0] - Math.cos(seat.transform.heading) * 60, p[1] - Math.sin(seat.transform.heading) * 60, p[2] + 15], lookAt: ahead, horizontalFov: 70 } },
    { name: 'field', worldFraming: { cameraPosition: [-R.hx, -R.hy, R.hz], lookAt: [0, 0, 0], horizontalFov: 60 } },
  ];
  const laws = [...spaceLaws(map, field, course, seat.transform), ...(course ? course.laws : [])];
  return {
    faces: [...(field.faces || []), ...(course ? course.faces : [])], repeats: field.repeats, cameras, title,
    sky: { space: true, seed: 7, center: [0, 0, 0], radius: 7000 }, bg: '#03040a',
    ...(pilot ? {} : { walk: { speed: 20, spawn: p, radius: 0.4, minEye: 1.7, gravity: 0, jump: 0 } }),
    viewBox: manifest.viewBox && manifest.viewBox.width ? manifest.viewBox : { width: 1120, height: 760 },
    ...(pilot || {}),
    meta: {
      map: { form: 'void', craft: map.craft.key, rings: map.rings },
      laws, space: field.report, ...(field.trench ? { trench: { ...field.trench, port: field.port, turrets: field.turrets.length } } : {}),
      ...(course ? { course: { gates: course.gates, finish: null, laps: course.laps, laws: course.laws } } : {}),
    },
  };
}
