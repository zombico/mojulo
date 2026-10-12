/**
 * THE CITY'S LOOK AND PAINT: the world a city stands in, apart from how it is built.
 *
 *   look:  '<look id>' | { id, cell? }    the world-wide look channel (era/look.js): every kind takes its air and sky
 *                                        there; the city also lights itself by it here, its key (or, with no sun, a
 *                                        moon) and its ambient, because its facades are cards a bake cannot relight
 *   paint: { geocube, amount? }          a level's cube (era/geocube.js) painting the city in its world's colours: the
 *                                        ground, the water, the parks and the walks, and every skin leant toward its
 *                                        stone, trim and accent by `amount` (0.5 by default). A look with no sun is lit
 *                                        by the cube's moon.
 *
 * The same city under another look and paint is the same streets, lots and facades: another place and hour. Pure.
 */
import { resolveLookSpec } from '../../era/look.js';
import { readGeocube, GEOCUBE_PRESETS } from '../../era/geocube.js';
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
  for (const k of Object.keys(paint)) if (!['geocube', 'amount'].includes(k)) no(`paint.${k} is not a paint setting (geocube, amount)`);
  if (paint.geocube === undefined) no('paint.geocube is a geocube preset, a cube, or { from, …changes }');
  let cube;
  try { cube = readGeocube(paint.geocube); } catch (err) { no(`paint.geocube: ${err.message.replace(/^geocube: /, '')}`); }
  const amount = paint.amount ?? 0.5;
  if (!(typeof amount === 'number' && amount >= 0 && amount <= 1)) no('paint.amount is how far the cube\'s colours lean the city, 0 (none) to 1 (all the way)');
  return { cube, amount };
}

const mix = (a, b, t) => rgbToHex(hexToRgb(a).map((v, i) => v + (hexToRgb(b)[i] - v) * t));
const luma = (hex) => { const [r, g, b] = hexToRgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
const fromSky = (elevation, azimuth) => { const e = elevation * DEG, a = azimuth * DEG; return [-cos(e) * cos(a), -cos(e) * sin(a), -sin(e)]; };

/** The city's light under a look: its sun, or with none the paint's cube's moon (else a cold one); its ambient lifted
 *  as the stage lifts a look's, never black, and by night low enough that a lit window (night.js) reads against it. */
export function lookLight(spec, paint) {
  const R = spec.ref, key = R.light.key, amb = luma(R.light.ambient);
  if (key) return { light: makeLight({ direction: fromSky(key.elevation, key.azimuth ?? 225), ambient: Math.min(0.7, 0.3 + amb), diffuse: 0.55 }), night: false };
  const moon = paint?.cube.light.moon || MOON;
  return { light: makeLight({ direction: fromSky(moon.elevation, moon.azimuth), ambient: Math.min(0.5, 0.3 + amb), diffuse: 0.3 * (moon.gain ?? 0.8) }), night: true };
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
