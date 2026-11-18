/**
 * THE ARENA MAP'S GROUND AS MATERIAL — the blocks laid as a level (ground.js mapGround) and read by the seventh
 * generation: every face wears a tile by what it is (a floor, a wall, a mass, a ramp), mapped in metres, and is baked
 * under the light a cube solves (era/cube-light.js) as a town's buildings are (form/sun-light.js): its colour and the
 * day's light apart, the sun's shadow tested against the map's own blocks. The page draws it through the form render's
 * channel (scene/channels/form.js, `form.town`). The geometry, the colliders and the climbs are mapGround's, untouched.
 *
 *   MAP_FORM                 { <dress>: { <part>: tile } }: the tiles a map wears, by what the map is (an arena grown
 *                            from a template, a town's or a city's cut); a new dress is a row
 *   mapDress(M)              → the dress a map wears: a place's cut its own (read-town.js `read.cut`), else the arena's
 *   mapFormGround(M, { cube, hour?, at? }) → { faces, colliders, entities, form: { town }, dress }
 *     cube   a geocube recipe (`'valley-morning'`, `{ from, … }`): the day the map stands in
 *
 * Water (a place's cut) and a ladder keep their paint: the form render draws neither as material yet.
 * Pure: a function of the map and the cube.
 */
import { mapGround } from './ground.js';
import { readGeocube } from '../era/geocube.js';
import { cubeLight } from '../era/cube-light.js';
import { makeSunShadow } from '../era/sun.js';
import { sunLitFaces, skyAt } from '../form/sun-light.js';
import { paintMean, linHex } from '../form/room-light.js';

export const MAP_FORM = Object.freeze({
  arena: Object.freeze({ ground: 'flagstone-slate-a', floor: 'concrete-board', wall: 'stone-wall-bluestone-a', low: 'stone-wall-bluestone-b', solid: 'stone-wall-a', ramp: 'concrete-board', under: 'concrete-board' }),
  place: Object.freeze({ ground: 'asphalt-aged', floor: 'concrete-board', wall: 'concrete-board', low: 'concrete-board', solid: 'brick', ramp: 'concrete-board', under: 'concrete-board' }),
});
/** A tile's repeat, metres: a cell's side, so a panel's joints fall on the grid's. */
const REPEAT = 3;
const KEEP = Object.freeze(['map:water', 'map:ladder']);
const r5 = (v) => Math.round(v * 1e5) / 1e5;
const partOf = (g) => (g === 'map:floor:0' ? 'ground' : g.startsWith('map:floor') ? 'floor' : g === 'map:wall' ? 'wall' : g === 'map:low-wall' ? 'low' : g === 'map:solid' ? 'solid' : g.startsWith('map:ramp') ? 'ramp' : g === 'map:under' || g === 'map:edge' ? 'under' : null);
const normalOf = (c) => {
  const a = [c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]], b = [c[2][0] - c[0][0], c[2][1] - c[0][1], c[2][2] - c[0][2]];
  const n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], l = Math.hypot(...n) || 1;
  return n.map((v) => r5(v / l));
};

export const mapDress = (M) => (M?.read?.cut ? 'place' : 'arena');

/** The map's ground as material under a cube's day (see the header). */
export function mapFormGround(M, { cube = 'valley-morning', hour, at } = {}) {
  const G = mapGround(M, at ? { at } : {}), dress = mapDress(M), T = MAP_FORM[dress], fills = {};
  const faces = G.faces.map((f) => {
    const part = typeof f.group === 'string' ? partOf(f.group) : null, n = normalOf(f.corners);
    if (!part || KEEP.includes(f.group)) return { ...f, normal: n };
    const key = T[part], up = Math.abs(n[2]) > 0.7, alongX = Math.abs(n[1]) >= Math.abs(n[0]);
    // (mapped in metres: a flat face by its plan, a standing one along its run and up its height)
    const uv = f.corners.map((c) => (up ? [r5(c[0] / REPEAT), r5(c[1] / REPEAT)] : [r5((alongX ? c[0] : c[1]) / REPEAT), r5(c[2] / REPEAT)]));
    return { ...f, normal: n, texture: key, uv, fill: (fills[key] ??= linHex(paintMean(key))) };
  });
  const C = readGeocube(typeof cube === 'string' ? { from: cube } : cube), CL = cubeLight(C, hour !== undefined ? { hour } : {});
  const light = { sun: CL.sun.linear, ambient: CL.ambient.linear, dir: CL.sun.dir }, keep = new Set(KEEP);
  const ground = CL.linearBases?.stone ?? CL.linearBases?.floor ?? null;
  const B = sunLitFaces(faces, light, { shadow: makeSunShadow(faces.filter((f) => !keep.has(f.group)), light.dir), keep, ...(ground ? { ground } : {}) });
  const town = { lights: [{ at: light.dir.map((v) => r5(v * 1e6)), key: light.sun, radius: 1e9, live: true }], ambient: light.ambient, fall: 2, sun: { ground: skyAt([0, 0, -1], light, ground).map(r5) }, keep: [...KEEP], panes: [], ...(B.unreached.length ? { unreached: B.unreached } : {}) };
  return { faces: B.faces, colliders: G.colliders, entities: G.entities, form: { town }, dress };
}
