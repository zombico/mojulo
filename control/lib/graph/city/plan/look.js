/**
 * THE CITY'S LOOK AND PAINT: the world a city stands in, apart from how it is built.
 *
 *   look:  '<look id>' | { id, cell? }    the world-wide look channel (era/look.js): every kind takes its air and sky
 *                                        there; the city also lights itself by it here, its key (or, with no sun, a
 *                                        moon) and its ambient, because its facades are cards a bake cannot relight
 *   paint: { geocube, amount?, hour?, clouds? }   a level's cube (era/geocube.js) painting the city in its world's
 *                                        colours: the ground, the water, the parks and the walks, and every skin leant
 *                                        toward its stone, trim and accent by `amount` (0.5 by default). A look with no
 *                                        sun is lit by the cube's moon. With `hour` or `clouds` (and no look of the
 *                                        recipe's own), the cube lights it at that hour under those clouds, as it does
 *                                        its land (era/geocube-hours.js): its sun on the hour's arc or its moon past dusk
 *                                        (the windows lit), its dome, air and clouds the hour's. `materials` ('modern', a
 *                                        city's by default, or 'ancient') the class a gritty cube dresses it in (dress.js).
 *
 * The same city under another look and paint is the same streets, lots and facades: another place and hour. Pure.
 */
import { resolveLookSpec, LOOK_CELL } from '../../era/look.js';
import { readGeocube, GEOCUBE_PRESETS } from '../../era/geocube.js';
import { hourAir, readHour, referenceHour } from '../../era/geocube-hours.js';
import { readClouds } from '../../matte-paint/sky.js';
import { SIXTH_GEN_REFERENCES, resolveLook } from '../../era/sixth-gen.js';
import { makeLight, hexToRgb, rgbToHex } from '../../polygonizer/vexar.js';
import { cos, sin } from '../../../util/dmath.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const no = (msg) => { throw new Error(`city: ${msg}`); };
const DEG = Math.PI / 180;
// the moon a look with no sun is lit by when no cube names one
const MOON = Object.freeze({ color: '#9fb0e0', elevation: 34, azimuth: 300, gain: 0.8 });
/** How much of a look's air a city keeps: its fog is a room's, and a city is seen across a kilometre. */
export const CITY_HAZE = 0.12;

/** A recipe's `look` (the world-wide channel's forms), checked → its spec, or null. */
export function readCityLook(look) {
  try { return resolveLookSpec(look); } catch (err) { return no(err.message); }
}

/** A recipe's `paint`, checked → { cube, amount }, or null. */
export function readPaint(paint) {
  if (paint === undefined || paint === null) return null;
  if (!isObj(paint)) no(`paint is { geocube: <${Object.keys(GEOCUBE_PRESETS).join(' | ')} | a cube | { from, … }>, amount? }`);
  for (const k of Object.keys(paint)) if (!['geocube', 'amount', 'hour', 'clouds', 'materials'].includes(k)) no(`paint.${k} is not a paint setting (geocube, amount, hour, clouds, materials)`);
  if (paint.materials !== undefined && !['ancient', 'modern'].includes(paint.materials)) no(`paint.materials is 'ancient' (hand-worked, lime-bound) or 'modern' (machine-made, cement-bound), got ${JSON.stringify(paint.materials)}`);
  if (paint.geocube === undefined) no('paint.geocube is a geocube preset, a cube, or { from, …changes }');
  let cube;
  try { cube = readGeocube(paint.geocube); } catch (err) { no(`paint.geocube: ${err.message.replace(/^geocube: /, '')}`); }
  const amount = paint.amount ?? 0.5;
  if (!(typeof amount === 'number' && amount >= 0 && amount <= 1)) no('paint.amount is how far the cube\'s colours lean the city, 0 (none) to 1 (all the way)');
  let hour, clouds;
  try { hour = paint.hour === undefined ? undefined : readHour(paint.hour); clouds = paint.clouds === undefined ? undefined : readClouds(paint.clouds); } catch (err) { no(`paint.${err.message}`); }
  return { cube, amount, ...(hour !== undefined ? { hour } : {}), ...(clouds ? { clouds } : {}), ...(paint.materials !== undefined ? { materials: paint.materials } : {}) };
}

/**
 * The look a paint's cube lights the city by: its reference's, or at the paint's hour under its clouds the reference
 * card relit (the key on the hour's arc, none past dusk so the moon takes it; the ambient, the air and the dome the
 * hour's), with the hour's air (`A`) for the sky. → a look spec, as readCityLook gives.
 */
export function cubeLookSpec(P) {
  const id = P.cube.light.reference, refId = resolveLook(id), ref = SIXTH_GEN_REFERENCES[refId];
  if (P.hour === undefined && !P.clouds) return { id, refId, ref, cell: LOOK_CELL };
  const A = hourAir(P.cube, P.hour ?? referenceHour(ref), P.clouds), H = A.H;
  const relit = { ...ref, light: { ...ref.light, key: H.moonlit ? null : H.key, ambient: A.ambient }, air: { ...ref.air, fog: { ...ref.air.fog, color: A.fog.color, density: +(A.fog.density / P.cube.light.outsideFog).toFixed(5) }, dome: A.dome } };
  return { id, refId, ref: relit, cell: LOOK_CELL, air: A };
}

const mix = (a, b, t) => rgbToHex(hexToRgb(a).map((v, i) => v + (hexToRgb(b)[i] - v) * t));
const luma = (hex) => { const [r, g, b] = hexToRgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
const fromSky = (elevation, azimuth) => { const e = elevation * DEG, a = azimuth * DEG; return [-cos(e) * cos(a), -cos(e) * sin(a), -sin(e)]; };

/** The city's light under a look: its sun, or with none the paint's cube's moon (else a cold one); its ambient lifted
 *  as the stage lifts a look's, never black, and by night low enough that a lit window (night.js) reads against it. */
export function lookLight(spec, paint) {
  // (a cube's hour weakens its key by the hour's gain: a low sun, a young moon, a sky under cloud)
  const R = spec.ref, key = R.light.key, amb = luma(R.light.ambient), g = spec.air ? spec.air.gain : 1;
  if (key) return { light: makeLight({ direction: fromSky(key.elevation, key.azimuth ?? 225), ambient: Math.min(0.7, 0.3 + amb), diffuse: 0.55 * g }), night: false };
  const moon = paint?.cube.light.moon || MOON;
  return { light: makeLight({ direction: fromSky(moon.elevation, moon.azimuth), ambient: Math.min(0.5, 0.3 + amb), diffuse: 0.3 * (moon.gain ?? 0.8) * g }), night: true };
}

/** The ground's colours under a paint: the cube's, leant by `amount`. */
export function paintGround(P, base) {
  if (!P || !P.amount) return base;
  const c = P.cube.colour, t = P.amount;
  return { ...base, ground: mix(base.ground, c.grass, t), park: mix(base.park, c.foliage, t), water: mix(base.water, c.water, t), walk: mix(base.walk, c.floor, t), plaza: mix(base.plaza, c.floor, t), road: mix(base.road, mix(c.floor, '#000000', 0.55), t * 0.6) };
}

/** A skin leant toward the cube's colours by `amount`: its body toward stone (glass's mullions toward trim), its roof
 *  toward trim, its awning toward accent. Glass keeps its panes. */
export function paintSkin(P, skin) {
  if (!P || !P.amount) return skin;
  const c = P.cube.colour, t = P.amount, out = { ...skin };
  out.frame = mix(skin.frame, skin.material === 'glass' ? c.trim : c.stone, t);
  if (skin.roof) out.roof = mix(skin.roof, c.trim, t);
  if (skin.awningTint) out.awningTint = mix(skin.awningTint, c.accent, t);
  if (skin.roofCap) out.roofCap = { ...skin.roofCap, tint: mix(skin.roofCap.tint, c.trim, t) };
  return out;
}
