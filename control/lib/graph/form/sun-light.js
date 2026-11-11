/**
 * THE SUN AS A BAKED LIGHT (the form render outdoors, gen-7): a building's faces baked as a room's are (era/stage.js
 * formLightFaces), their colour and their light apart, under the light a cube solves (era/cube-light.js) in the place
 * of a room's lamps. Each corner carries its BASE (the colour its paint asks for under no light) and the LIGHT the day
 * lays there (linear): the sky by how much of it the corner's face sees, what the ground throws back onto a face turned
 * down, and the sun by its cosine where the sun can see the corner. The page multiplies the two and lights only the
 * relief near the eye (scene/channels/form.js).
 *
 *   SUN_LIGHT    ground   what a face turned down takes of the light the ground stands in, where no ground is given
 *                lift     how far off a corner's face its shadow test starts (m), so a wall does not shade itself
 *   skyAt(n, light)       the light a face of normal `n` takes without the sun: the sky on a face turned up, the
 *                         ground's on one turned down, their mean on a wall (the cast rig's hemisphere, the same law)
 *   baseOf(hex, light)    the base a paint's colour asks for: that colour, shown square to the sun under the whole
 *                         sky (the land's reference, era/cube-light.js), over the light there. → { base (linear),
 *                         unreached } (a channel past 1 held at 1: the colour is out of this light's reach)
 *   sunLitFaces(faces, light, { shadow?, ground?, keep? }) → { faces, unreached: [group] }
 *     faces     each with `corners`, `normal` and a `fill` (its paint, as it shows lit: a value never darkened by its turn
 *               to the sun); one in `keep` (a group left as painted: glass, a sign's glow) or with no normal is returned
 *               as it came
 *     light     { sun: [r,g,b], ambient: [r,g,b], dir: [x,y,z] } linear, in the solve's units (out = base × light);
 *               `dir` toward the sun
 *     shadow    (p, n) → 0..1, how much of the sun reaches p (era/sun.js makeSunShadow over what stands round it);
 *               absent, every corner the sun faces is lit
 *     ground    the ground's base (linear) under the building; absent, SUN_LIGHT.ground of the light it stands in
 *     lift      how far off its face a corner's shadow test starts (SUN_LIGHT.lift; a building dressed in thin
 *               layers over its walls, its courses, surrounds and panels, asks for more, so its own dress does not shade it)
 *     → each face its `fill` and `cornerFills` the base, `cornerLight` one linear [r,g,b] a corner, and `sunShare` one
 *       a corner: the share of that light the sun gives (0 in a baked shadow), by which a live shadow darkens it
 *       (scene/live-light.js)
 *
 * Pure: no dice, no clock. Nothing reads it yet.
 */
import { displayToLinear, encodeSrgb, luminance } from '../color-theorist/light.js';

export const SUN_LIGHT = Object.freeze({ ground: 0.35, lift: 0.05 });

const r5 = (v) => Math.round(v * 1e5) / 1e5, r3 = (v) => Math.round(v * 1e3) / 1e3;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const hexOf = (lin) => '#' + lin.map((v) => Math.round(Math.max(0, Math.min(1, encodeSrgb(Math.max(0, v)))) * 255).toString(16).padStart(2, '0')).join('');

// what the ground throws back: its base under the light it stands in (the sky's, and the sun by how high it stands)
const groundOf = (light, ground) => {
  const up = Math.max(0, light.dir[2]);
  return [0, 1, 2].map((k) => (ground ? ground[k] : SUN_LIGHT.ground) * (light.ambient[k] + light.sun[k] * up));
};

export function skyAt(n, light, ground = null) {
  const G = groundOf(light, ground), t = 0.5 + 0.5 * Math.max(-1, Math.min(1, n[2]));
  return [0, 1, 2].map((k) => G[k] + (light.ambient[k] - G[k]) * t);
}

export function baseOf(hex, light) {
  const want = displayToLinear(hex).map((v, k) => v / Math.max(1e-6, light.ambient[k] + light.sun[k]));
  return { base: want.map((v) => Math.min(1, v)), unreached: Math.max(...want) > 1.005 };
}

export function sunLitFaces(faces, light, { shadow = null, ground = null, keep = null, lift = SUN_LIGHT.lift } = {}) {
  const bases = new Map(), unreached = new Set();
  const based = (f) => {
    if (bases.has(f.fill)) return bases.get(f.fill);
    const B = baseOf(f.fill, light), out = { hex: hexOf(B.base), unreached: B.unreached };
    bases.set(f.fill, out);
    return out;
  };
  const out = faces.map((f) => {
    if (!f || !Array.isArray(f.corners) || !Array.isArray(f.normal) || typeof f.fill !== 'string' || !/^#[0-9a-f]{6}$/i.test(f.fill) || (keep && keep.has(f.group))) return f;
    const n = f.normal, B = based(f), sky = skyAt(n, light, ground), cos = Math.max(0, dot(n, light.dir));
    if (B.unreached) unreached.add(f.group ?? '');
    const cornerLight = [], sunShare = [];
    for (const c of f.corners) {
      const s = cos > 0 ? (shadow ? shadow([c[0] + n[0] * lift, c[1] + n[1] * lift, c[2] + n[2] * lift], n) : 1) : 0;
      const sun = light.sun.map((v) => v * cos * s), all = sky.map((v, k) => v + sun[k]), y = luminance(all);
      cornerLight.push(all.map(r5));
      sunShare.push(y > 1e-9 ? r3(Math.min(1, luminance(sun) / y)) : 0);
    }
    return { ...f, fill: B.hex, cornerFills: f.corners.map(() => B.hex), cornerLight, sunShare };
  });
  return { faces: out, unreached: [...unreached].sort() };
}
