/**
 * THE LIGHT A ROOM'S PALETTE ASKS FOR (the form render indoors, gen-7): the colour theorist's solve (color-theorist/light.js
 * solveLight) under no sun. A room's look is its paint: what each surface shows under its lamp, at arm's length from it
 * (the sixth generation's bake, or a toned room's ramps, read there). Those colours are TARGETS; the bases (each surface's
 * colour under no light) and one torch's light are solved together, so the room under its real lights reads as its
 * palette where a lamp stands near, and falls to its shade where none does.
 *
 *   ROOM_LIGHT   at     the reference: metres from a lamp at which its surface shows its target, square to it
 *                fall   the falloff's power in linear light: (1 − max(d, near) / radius)² ^ fall (the sixth generation's
 *                       square, in its sRGB corners, is about the same curve decoded)
 *                near   the falloff held flat inside it: a flame doesn't burn the stone behind it white
 *                bounce, reach   what a lightmap's bounce holds: a share of each lamp over a wider reach, its own room only
 *   falloff(d, radius) → the share a lamp gives at d
 *   paintMean(key) → a tile's painted mean (linear rgb, the paint the sixth generation draws): what its colour stands for
 *   solveRoomLight({ targets, ambient, lights, neutral?, contrast? }) → { ambient, keys, bases, level, unreached }
 *     targets   { role: '#rrggbb' } what each surface shows at the reference, its lamp the median one
 *     neutral   a light without hue (a toned room: its colour is its ramps', tone.js), its lamps and ambient too;
 *               `contrast` one asked for
 *     ambient   the paint's ambient (0..1 rgb, era/stage.js ambientOf): the shade's hue, and with the median lamp at the
 *               reference the contrast (how much of the light a surface turned from every lamp keeps)
 *     lights    the placed lights (stage.js: at, color, intensity, radius)
 *     → ambient (linear rgb, base-multiplier units: out = base × light), keys (each lamp's light where its falloff is
 *       whole, linear rgb: its hue, its intensity over the median's; at d it gives key × falloff(d, its radius) × cos), bases ({ role: linear rgb }), level, unreached
 *
 * The levels are solved under a light without hue (each base keeps its paint's hue); the ambient and each lamp carry
 * their own hue, as the paint's light does. The page lights by it (scene/channels/form.js: out = base × (the baked
 * light) + what the near lamps add to the relief);
 * three's lights would be π × these. Pure: no dice.
 */
import { solveLight, decodeSrgb, encodeSrgb, luminance } from '../color-theorist/light.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { decodePng } from '../era/tone.js';

export const ROOM_LIGHT = Object.freeze({ at: 2.5, fall: 2, near: 1.1, bounce: 0.2, reach: 1.5 });
/** The most of the light a surface turned from every lamp keeps (the solve's contrast). */
export const CONTRAST_MOST = 0.6;

export function falloff(d, radius, fall = ROOM_LIGHT.fall) {
  const t = 1 - Math.max(d, ROOM_LIGHT.near) / radius;
  return t <= 0 ? 0 : (t * t) ** fall;
}

const hex = (c) => '#' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
/** A display colour (0..1 sRGB) as the hex the solve takes. */
export const linHex = (lin) => hex(lin.map((v) => encodeSrgb(Math.min(1, Math.max(0, v)))));

const means = new Map();
export function paintMean(key) {
  if (typeof key !== 'string') return [1, 1, 1];
  if (means.has(key)) return means.get(key);
  const d = decodePng(surfaceTexture(key)), m = [0, 0, 0];
  let n = 0;
  if (d) for (let k = 0; k < d.W * d.H; k++) {
    // (a card's clear texels are no part of its colour)
    if (d.alpha && d.px[k * 4 + 3] < 128) continue;
    for (let c = 0; c < 3; c++) m[c] += decodeSrgb(d.px[k * 4 + c] / 255);
    n++;
  }
  const out = n ? m.map((v) => Math.round((v / n) * 1e4) / 1e4) : [1, 1, 1];
  means.set(key, out);
  return out;
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 1; };

/** The median lamp (by intensity, then radius): the one the targets are read under. */
export function referenceLamp(lights) {
  const I = median(lights.map((l) => l.intensity));
  return lights.filter((l) => l.intensity === I).sort((a, b) => a.radius - b.radius)[0] || { color: '#ffffff', intensity: 1, radius: 8 };
}

// the paint's own shoulder (era/stage.js bakeStageLight): its light rolls off before white
const KNEE = 0.75;
const shoulder = (v) => (v <= KNEE ? v : KNEE + (1 - KNEE) * (1 - Math.exp(-(v - KNEE) / (1 - KNEE))));
/** The light the paint lays at the reference from a lamp of `color` at `intensity` and `radius` over its ambient
 *  (0..1, in the paint's own units: what a tint is multiplied by). */
export function paintAtReference(ambient, { color, intensity, radius }) {
  const c = rgbOf(color), g = Math.max(0, 1 - ROOM_LIGHT.at / radius) ** 2;
  return ambient.map((a, k) => shoulder(a + c[k] * intensity * g));
}

export function solveRoomLight({ targets, ambient, lights, neutral = false, contrast: asked }) {
  const ref = referenceLamp(lights), amb = ambient.map(decodeSrgb), at = falloff(ROOM_LIGHT.at, ref.radius);
  // the hues the paint shows: its ambient decoded, and a lamp's what it adds over it at the reference, decoded (the paint
  // mixes its light in display units under its shoulder, so a lamp shows far less saturated than its colour decoded)
  // (an ambient so bright the paint has no room left for a lamp shows none of it: the lamp's colour as written stands in)
  const shown = (l) => { const d = paintAtReference(ambient, { ...l, intensity: ref.intensity }).map((v, k) => decodeSrgb(v) - amb[k]); return luminance(d) > 0.01 ? d : rgbOf(l.color); };
  const lit = paintAtReference(ambient, ref).map(decodeSrgb);
  // the contrast the paint keeps: its ambient against the ambient and the median lamp at the reference (held at
  // CONTRAST_MOST: under no sun the lamps are the light, so a paint whose ambient drowns them, a room toned off an
  // outdoor look's sky, still takes its shape from them)
  const contrast = Math.min(CONTRAST_MOST, Math.max(0.02, asked ?? luminance(amb) / Math.max(1e-4, luminance(lit))));
  // the LEVELS are solved under a light without hue, so each base keeps its paint's own hue (its target is the paint
  // under such a light: era/stage.js formLightFaces); the ambient and each lamp then bring their own hue, as the paint's
  // light does, so a surface by a warm lamp warms and one in the shade cools wherever it is, not only at the reference
  const S = solveLight({ targets, sky: '#ffffff', sun: '#ffffff', contrast });
  const hue = (lin) => { const y = luminance(lin); return y > 1e-6 ? lin.map((v) => Math.max(0, v) / y) : [1, 1, 1]; };
  const ambY = luminance(S.ambient), keyY = luminance(S.sun) / at;
  // each lamp's light where its falloff is whole (square to it, inside `near`): its hue as the paint shows it, the solved
  // key's luminance brought back from the reference, in the median's share
  const keys = lights.map((l) => (neutral ? [1, 1, 1] : hue(shown(l))).map((v) => v * keyY * (l.intensity / ref.intensity)));
  return { ambient: neutral ? S.ambient : hue(amb.map((v) => Math.max(v, 1e-5))).map((v) => v * ambY), keys, bases: S.bases, level: S.level, contrast, unreached: S.unreached };
}
