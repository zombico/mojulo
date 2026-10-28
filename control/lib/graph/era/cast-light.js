/**
 * The CAST LIGHT: a geocube's light lowered onto a figure, so a hero is lit by the same rules as the level it stands
 * in (sixth-gen `baked-plus-rim`: the level's light baked into the figure's vertex colour, a rim on top).
 *
 *   key      the reference's sun (its colour, elevation and azimuth, sun.js's frame), or the cube's moon when the
 *            reference has none; the moon's gain dims it
 *   ambient  the reference's ambient colour (under a sun, the sky's fill of it, as the stage bakes daylight), its hue
 *            kept and its value lifted to a floor, so the shade side of a figure is a colour (the level's), never black
 *   bounce   the cube's floor colour, warm light off the ground onto faces that look down (daylight only)
 *   rim      the reference's sky at the horizon, a fresnel edge that parts the figure from the level behind it; a cube
 *            that names its `light.rim` wears it in its OWN sky (its written or solved horizon, the sky the page draws
 *            behind the figure) at its strength and power
 *   bands    the cube's register: a banded cube steps the figure's key too
 *
 * The light is plain data (vexar.js shadeHex and castLightFactor read it; the rig pack bakes with it). Deterministic:
 * no dice, no clock.
 */
import { SIXTH_GEN_REFERENCES, resolveLook } from './sixth-gen.js';
import { sunDir } from './sun.js';
import { readGeocube } from './geocube.js';

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** The figure's levels, tuned by eye against the cubes' rooms and landforms (the eyes gate's to move). */
export const CAST_LIGHT = Object.freeze({ ambientFloor: 0.42, dayFill: 0.55, key: 0.62, bounce: 0.14, rim: { strength: 0.45, power: 3 } });

/** A checked cube (geocube.js readGeocube) → the light its cast is baked with. */
export function geocubeCastLight(cube) {
  const ref = SIXTH_GEN_REFERENCES[resolveLook(cube.light.reference)];
  const sun = ref.light.key, k = sun ?? cube.light.moon, gain = sun ? 1 : cube.light.moon.gain;
  const toLight = sunDir(k.elevation, k.azimuth ?? 225).map(r4);
  // daylight's ambient is the sky's fill under the sun, as the stage bakes it (stage.js `sky.fill`); a night's is all the shade has
  const amb0 = rgb(ref.light.ambient).map((v) => v * (sun ? CAST_LIGHT.dayFill : 1)), l0 = Math.max(lum(amb0), 1e-3), lift = Math.max(1, CAST_LIGHT.ambientFloor / l0);
  const ambient = amb0.map((v) => r4(Math.min(1, v * lift)));
  const key = rgb(k.color).map((v) => r4(v * gain * CAST_LIGHT.key));
  const bounce = sun ? rgb(cube.colour.floor).map((v) => r4(v * CAST_LIGHT.bounce)) : [0, 0, 0];
  // (a cube that names its rim: its own sky's horizon, the one the page draws behind the figure)
  const R = cube.light.rim, horizon = R && cube.light.sky ? rgb(cube.light.sky.horizon).map(r4) : ref.air.dome.horizon.map((v) => r4(v / 255));
  const steps = cube.register?.steps ?? 0;
  return {
    dir: toLight.map((v) => -v), toLight,
    ambient: r4(lum(ambient)), diffuse: r4(lum(key)),
    cast: { key, ambient, bounce },
    ...(steps >= 2 ? { bands: steps } : {}),
    rim: [...horizon, R?.strength ?? CAST_LIGHT.rim.strength, R?.power ?? CAST_LIGHT.rim.power],
    from: { geocube: cube.id, reference: cube.light.reference, key: sun ? 'sun' : 'moon' },
  };
}

/** The target a hero record is drawn for: its own, else its cube's; null when it names neither (today's hero, unchanged). */
export function heroTarget(hero) {
  if (hero?.target) return hero.target;
  return hero?.geocube ? readGeocube(hero.geocube).target : null;
}

/** The era a hero record is drawn in: its cube's, else gen-6. */
export const heroEra = (hero) => (hero?.geocube ? readGeocube(hero.geocube).era : 'gen-6');

/** The light a hero record's cube bakes it in, or null without a cube. */
export function heroCastLight(hero) {
  return hero?.geocube ? geocubeCastLight(readGeocube(hero.geocube)) : null;
}
