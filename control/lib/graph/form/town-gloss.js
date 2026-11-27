/**
 * WHAT A TOWN'S GLASS (AND ITS PARKED CARS) GIVES BACK (the form render outdoors, gen-7): a window and a curtain wall are drawn as a surface
 * that mirrors the sky by Fresnel, blurred by how rough it is, with the sun's highlight where the bake says the sun
 * reaches it (scene/channels/form.js `reflect`), in the place of a pane painted flat. A built town (geocity/scene.js,
 * geotown/scene.js) names its glass and how each gives back (`gloss`, carried on its `form.town`); the page that draws
 * it lays the sky it stands under as the environment only where its finish asks to reflect (worlds/world-scene.js), so
 * a page that asks for none carries none of it.
 *
 *   TOWN_GLOSS          { window, curtain, shop, paint, trim }   a window's glass (a room behind it: little of its own, a share of the
 *                       sky's colour, its pane baked as `tint`, a coated glass's grey, so a game's windows are seen to
 *                       give back the sky as a street's do), a curtain wall's (coated: much of the sky, tinted by the
 *                       glass the tower is painted in), a shop's glazing (clear: its own dark colour, the sky over it), a parked car's
 *                       paint under its clear coat and its trim
 *   townReflect(sky, gloss) → { env: { zenith, horizon, ground } (linear), surfaces: gloss } | null   the sky a page
 *                       paints (display rgb 0..255, or '#rrggbb') taken back to the renderer's linear light; null
 *                       without a sky or anything to gloss
 *
 *   glazed(face, gloss, group?) → the face as its glass is baked: its pane's `tint` where its gloss names one (the
 *                       group a repeat's template face is drawn in, where the face carries none)
 *
 * Pure: no dice, no clock.
 */
import { displayToLinear } from '../color-theorist/light.js';
import { SKY_ENV } from '../scene/page-light.js';

export const TOWN_GLOSS = Object.freeze({
  window: Object.freeze({ rough: 0.05, metal: 0.6, tint: '#8a98a4' }),
  curtain: Object.freeze({ rough: 0.03, metal: 0.75 }),
  shop: Object.freeze({ rough: 0.04, metal: 0.5 }),
  // (a parked car's: its paint under a clear coat, a little of a metallic flake's colour in what it gives back; its
  // trim, glass and rubber and chrome as one, softer)
  paint: Object.freeze({ rough: 0.12, metal: 0.25 }),
  trim: Object.freeze({ rough: 0.3, metal: 0.1 }),
});

const r5 = (v) => Math.round(v * 1e5) / 1e5;
const hexOf = (c) => (typeof c === 'string' ? c : '#' + c.slice(0, 3).map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join(''));

export function townReflect(sky, gloss) {
  if (!sky || !sky.zenith || !sky.horizon || !gloss || !Object.keys(gloss).length) return null;
  const zenith = displayToLinear(hexOf(sky.zenith)).map(r5), horizon = displayToLinear(hexOf(sky.horizon)).map(r5);
  return { env: { zenith, horizon, ground: horizon.map((v) => r5(v * SKY_ENV.ground)) }, surfaces: gloss };
}

export function glazed(f, gloss, group = f.group) {
  const G = gloss[group];
  return G && G.tint ? { ...f, fill: G.tint, ...(Array.isArray(f.cornerFills) ? { cornerFills: f.cornerFills.map(() => G.tint) } : {}) } : f;
}
