/**
 * THE LIGHT A PALETTE ASKS FOR (the color theorist owns mood → palette → light; the cube composes, era/cube-light.js):
 * a baked palette's colours are what is seen; under a renderer's light the seen colour is base × light, so a palette's
 * colours are TARGETS and the base colours and one light are solved together.
 *
 *   targets   each role's colour as the palette names it: what a face square to the sun shows (its lit target); its
 *             shade target is the lit one × ONE shade tint, common to every role, so one sun meets them all
 *   sky       the sky's colour: the hue of the light a face in shade gets (the ambient)
 *   sun       the sun's colour: the hue of the key
 *   contrast  the share of the light a sky-lit face keeps: ambient / (ambient + sun), at its own scale
 *
 *   solveLight({ targets, sky, sun, contrast }) → { sun, ambient (linear rgb, base-multiplier units: out = base ×
 *       (ambient + sun × cos θ)), bases: { role: linear rgb }, level, brightest: [role], unreached: { role: want } }
 *     the level is as bright as the brightest base needs to stay a believable material (its luminance BASE_MAX): a light
 *     palette gets a bright light, a dark one a dim one. A base channel that would pass 1 is a colour this sun cannot
 *     reach: held at 1 and named (`unreached`, its wanted base), advice never a refusal
 *   seen(base, light, cos)   the display colour a base shows under the light at cos θ to the sun (0: the sky alone)
 *   toneNeutral(rgb) / untoneNeutral(rgb) / displayToLinear(hex)   the renderer's tone curve (Khronos PBR neutral, as
 *     three's NeutralToneMapping at exposure 1), its inverse, and a display colour taken back through sRGB and the curve
 *
 * A renderer that divides diffuse by π, as three does, sets its lights to π × these. Pure: no dice.
 */

/** The luminance of the brightest base a solved material may have. */
export const BASE_MAX = 0.85;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const hexOf = (c) => '#' + c.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
export const decodeSrgb = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export const encodeSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
export const luminance = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

const START = 0.8 - 0.04, DESAT = 0.15;
export function toneNeutral(rgb) {
  let c = [...rgb];
  const x = Math.min(...c), off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c = c.map((v) => v - off);
  const peak = Math.max(...c);
  if (peak < START) return c;
  const d = 1 - START, np = 1 - (d * d) / (peak + d - START);
  c = c.map((v) => (v * np) / peak);
  const g = 1 - 1 / (DESAT * (peak - np) + 1);
  return c.map((v) => v * (1 - g) + np * g);
}
/** The tone curve undone: the linear rgb it maps onto `rgb` (its slope never above 1, so the plain step converges). */
export function untoneNeutral(rgb) {
  let x = [...rgb];
  for (let i = 0; i < 400; i++) { const y = toneNeutral(x); x = x.map((v, k) => Math.max(0, v + (rgb[k] - y[k]))); }
  return x;
}
// (the curve only nears 1: a display channel at the top is held just under it, or it would ask for endless light)
const TONE_TOP = 0.97, REACH = 1.005;
export const displayToLinear = (hex) => untoneNeutral(rgbOf(hex).map((v) => Math.min(TONE_TOP, decodeSrgb(v))));
const toDisplay = (lin) => hexOf(toneNeutral(lin).map((v) => encodeSrgb(clamp(v, 0, 1))));
// a hue as a linear colour of luminance 1
const hueOf = (hex) => { const c = rgbOf(hex).map(decodeSrgb), y = luminance(c) || 1; return c.map((v) => v / y); };

/** The display colour a base (linear rgb) shows under the light at cos θ to the sun. */
export function seen(base, L, cos = 1) {
  const A = L.ambient, S = L.sun;
  return toDisplay(base.map((b, k) => b * (A[k] + S[k] * Math.max(0, cos))));
}

export function solveLight({ targets, sky, sun, contrast }) {
  if (!(contrast > 0 && contrast < 1)) throw new Error('light: contrast is the share a sky-lit face keeps, between 0 and 1');
  const roles = Object.keys(targets), hA = hueOf(sky), hS = hueOf(sun);
  // the bases at unit light (ambient + sun = 1 in luminance), then the level that brings the brightest to BASE_MAX
  const unit = hA.map((v, k) => contrast * v + (1 - contrast) * hS[k]);
  const raw = Object.fromEntries(roles.map((r) => [r, displayToLinear(targets[r]).map((v, k) => v / unit[k])]));
  const level = Math.max(1e-6, ...roles.map((r) => luminance(raw[r]))) / BASE_MAX;
  const want = Object.fromEntries(roles.map((r) => [r, raw[r].map((v) => v / level)]));
  return {
    sun: hS.map((v) => v * (1 - contrast) * level), ambient: hA.map((v) => v * contrast * level), level,
    bases: Object.fromEntries(roles.map((r) => [r, want[r].map((v) => Math.min(1, v))])),
    brightest: roles.filter((r) => luminance(want[r]) >= BASE_MAX - 1e-9),
    unreached: Object.fromEntries(roles.filter((r) => Math.max(...want[r]) > REACH).map((r) => [r, want[r]])),
  };
}
