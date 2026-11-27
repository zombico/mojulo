/**
 * THE CAVE'S CAST RIG — the one light a body is drawn under in a place with no sky (a boss's lair, gameworld/lair.js):
 * the cast rig (cast-rig-core.js castRigOf, its laws and all) solved from the place's own light instead of a geocube's
 * sun. Its KEY is the fire's (warm, from where its light is thrown), its HEMISPHERE the rock's cold light over what its
 * floor throws back, its RIM the walls' hue behind the figure; the rig's laws then hold the body's form, value and
 * separation in it as they do under any sun.
 *
 *   CAVE_LIGHT_KEYS          the words a cave's light is given in (castLight: { cave: { … } }, worlds/world-scene.js)
 *   readCave(words)          → the words checked (throws naming the fault)
 *   caveRig(cave, { register?, palette? }) → the rig (cast-rig-core.js's shape)
 *
 *     fire     '#rrggbb'    the key's hue (the fire's)
 *     key      number       its level, linear (a noon sun is about 0.65)
 *     ambient  number       the rock's own light's level, linear (a noon sky is about 0.4; a cave's far under it)
 *     tint     [r, g, b]    the rock light's hue over white (a cave's cooled)
 *     floor    '#rrggbb'    the floor's colour: what it throws back up
 *     wall     '#rrggbb'    the walls' colour: the rim's hue
 *     toLight  [x, y, z]    where the key comes from, the way toward it (normalized here)
 *     rim?     number       the rim's strength, 0 to 1 (a cave's is the walls' faint bounce, under a sky's horizon; the
 *                           rig's own where absent, and raised by its separation law where the body would be lost)
 *
 * Pure.
 */
import { castRigOf } from './cast-rig-core.js';

export const CAVE_LIGHT_KEYS = Object.freeze(['fire', 'key', 'ambient', 'tint', 'floor', 'wall', 'toLight', 'rim']);

const HEX = /^#[0-9a-f]{6}$/i;
const no = (m) => { throw new Error(`cave light: ${m}`); };
const lin = (hex) => [1, 3, 5].map((i) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const vec3 = (v) => Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && Number.isFinite(x));

export function readCave(w) {
  if (!w || typeof w !== 'object' || Array.isArray(w)) no(`{ ${CAVE_LIGHT_KEYS.join(', ')} }`);
  for (const k of Object.keys(w)) if (!CAVE_LIGHT_KEYS.includes(k)) no(`${k} is not one of ${CAVE_LIGHT_KEYS.join(', ')}`);
  for (const k of ['fire', 'floor', 'wall']) if (typeof w[k] !== 'string' || !HEX.test(w[k])) no(`${k} is a colour, '#rrggbb'`);
  for (const k of ['key', 'ambient']) if (typeof w[k] !== 'number' || !(w[k] > 0) || w[k] > 4) no(`${k} is a level of light, over 0 and 4 or under`);
  if (!vec3(w.tint) || w.tint.some((x) => x <= 0)) no('tint is [r, g, b], each over 0');
  if (!vec3(w.toLight) || Math.hypot(...w.toLight) < 1e-6) no('toLight is the way toward the key, [x, y, z]');
  if (w.rim !== undefined && !(typeof w.rim === 'number' && w.rim >= 0 && w.rim <= 1)) no('rim is its strength, 0 to 1');
  return w;
}

/** The place's light as the rig's solve: the fire's hue at its level, the rock's tinted light, the floor, the walls. */
function caveSolve(C) {
  const f = lin(C.fire), fl = lum(f) || 1, n = Math.hypot(...C.toLight), dir = C.toLight.map((v) => r4(v / n));
  const t = C.tint, tl = lum(t) || 1;
  return {
    hour: 'cave',
    sun: { dir, linear: f.map((v) => r4((v / fl) * C.key)), elevation: Math.round((Math.asin(Math.max(-1, Math.min(1, dir[2]))) * 180) / Math.PI) },
    ambient: { linear: t.map((v) => r4((v / tl) * C.ambient)) },
    linearBases: { floor: lin(C.floor).map(r4) },
    sky: { horizon: [1, 3, 5].map((i) => parseInt(C.wall.slice(i, i + 2), 16)) },
  };
}

/** A cave's rim: the walls' bounce, as bright as the place's own light on the body (the rig scales it to the body's key
 * side, lifted by its value law: a dark body lifted 6× in a dark cave would have its edges, and a thin wing seen edge-on
 * whole, lit white), and tight to the silhouette (`power`). */
export const CAVE_RIM = Object.freeze({ power: 5 });

export function caveRig(cave, { register = 'western', palette = null } = {}) {
  const C = readCave(cave), L = caveSolve(C);
  const rig = castRigOf({ id: 'cave', light: { rim: { ...(C.rim !== undefined ? { strength: C.rim } : {}), power: CAVE_RIM.power } } }, { register, palette }, () => L);
  const lift = Math.max(1, rig.key.gain);
  return { ...rig, rim: { ...rig.rim, linear: rig.rim.linear.map((v) => r4(v / lift)) }, from: { cave: true }, why: [`The key is the place's fire, thrown from ${C.toLight.map(r4).join(', ')}; the rock's cold light over the floor's bounce fills it; the walls rim it.`, ...rig.why.slice(1)] };
}
