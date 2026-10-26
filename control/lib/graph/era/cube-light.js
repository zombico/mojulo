/**
 * THE CUBE'S LIGHT — the palette solves the light (the operator, 1026: the palette knows how bright the sun is and what it
 * does to the colours; a baked palette has one register, this one is base and sun giving the desired hue). Gen-6's
 * colours are what is seen, the light baked in; gen-7's seen colour is base × light. So the cube's colours (written, or
 * the color theorist's solve) are TARGETS, and the base colours and the light are solved together at the cube's own hour:
 *
 *   lit target     a role's colour as the cube names it: what a face square to the sun shows
 *   shade target   the lit one × ONE shade tint T, common to every role (a sky-lit face keeps T of the light), so one sun
 *                  meets them all
 *   ambient A      the cube's sky at its hour (its dome, zenith and horizon: the palette's sky when solved) at level
 *                  a: what lights a face in shade is the sky (the palette's shadow hue is how shade looks, not its light;
 *                  as the light it over-tints, putting a sky-blue accent out of reach under a purple shadow)
 *   sun S          the palette's light hue (`light.sun.color` where the cube carries it, else the hour's key) at level s,
 *                  s / (a + s) the share of the light the hour's key gives over its ambient (the reference's contrast)
 *   bases          lit / (A + S), each channel; the level a solved so the brightest base's luminance is BASE_MAX (a
 *                  believable material): a light palette gets a bright light, a dark one a dim one. A base channel that
 *                  would pass 1 is a target this sun cannot reach: it is held at 1 and named in `checks` (advice, never
 *                  a refusal), and its target as reached is the one `seen` gives
 *
 * The targets are display colours: undone through sRGB and the renderer's tone curve (Khronos PBR neutral, `toneNeutral`)
 * before any division, and the solve's own forward pass gives them back (`seen`). At another hour the bases stay and the
 * light moves by the hour's key and ambient against the cube's own.
 *
 *   cubeLight(cube, { hour? }) → { hour, own, sun: { color, level, dir, elevation, azimuth }, ambient: { color, level },
 *       shade, contrast, sky, fog, bases: { role: '#rrggbb' }, targets: { role: { lit, shade } }, checks }
 *     colours are hex; `level`s are linear light in base-multiplier units (out = base × (ambient + sun × cos θ)): a
 *     renderer that divides diffuse by π, as three does, sets its lights to π × these
 *   toneNeutral(rgb) / untoneNeutral(rgb)   the tone curve on linear rgb, and its inverse
 *   seen(base, light, cos)   the display colour a base shows under the light at cos θ to the sun (0: sky-lit only)
 *
 * Pure: no dice, no clock. Nothing reads it yet (a payload is as it was).
 */
import { hourLight, referenceHour } from './geocube-hours.js';
import { SIXTH_GEN_REFERENCES, resolveLook } from './sixth-gen.js';
import { shadeHex } from './colour-register.js';

/** The luminance of the brightest base a solved material may have. */
export const BASE_MAX = 0.85;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const hexOf = (c) => '#' + c.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
const decode = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const encode = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
const Y = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const r4 = (v) => Math.round(v * 1e4) / 1e4;

// Khronos PBR neutral (three's NeutralToneMapping at exposure 1)
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
const toLinear = (hex) => untoneNeutral(rgbOf(hex).map((v) => Math.min(TONE_TOP, decode(v))));
const toDisplay = (lin) => hexOf(toneNeutral(lin).map((v) => encode(clamp(v, 0, 1))));
// a hue as a linear colour of luminance 1
const hueOf = (hex) => { const c = rgbOf(hex).map(decode), y = Y(c) || 1; return c.map((v) => v / y); };
const dirOf = (el, az) => { const e = (el * Math.PI) / 180, a = (az * Math.PI) / 180; return [Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)].map(r4); };

/** The display colour a base (linear rgb) shows under the light at cos θ to the sun. */
export function seen(base, L, cos = 1) {
  const A = L.ambient.linear, S = L.sun.linear;
  return toDisplay(base.map((b, k) => b * (A[k] + S[k] * Math.max(0, cos))));
}

export function cubeLight(cube, { hour } = {}) {
  const ref = SIXTH_GEN_REFERENCES[resolveLook(cube.light.reference)], own = referenceHour(ref), h = hour ?? own;
  const K = hourLight(cube, own), Kh = h === own ? K : hourLight(cube, h);
  // the reference's contrast: the share of the light a sky-lit face keeps (the ambient against the ambient and the key)
  const yA = Y(rgbOf(K.ambient).map(decode)), yS = Y(rgbOf(K.key.color).map(decode)) * K.gainK, contrast = yA / (yA + yS);
  const shade = shadeHex(cube.colour.shade ?? 222), skyLight = hexOf(K.dome.zenith.map((v, k) => (decode(v / 255) + decode(K.dome.horizon[k] / 255)) / 2).map(encode));
  const hA = hueOf(skyLight), hS = hueOf(cube.light.sun?.color ?? K.key.color);
  const roles = Object.keys(cube.colour).filter((k) => k !== 'shade' && /^#[0-9a-f]{6}$/i.test(cube.colour[k]));
  // the bases at unit light (a + s = 1), then the level that brings the brightest to BASE_MAX
  const unit = hA.map((v, k) => contrast * v + (1 - contrast) * hS[k]);
  const lits = Object.fromEntries(roles.map((r) => [r, toLinear(cube.colour[r])]));
  const raw = Object.fromEntries(roles.map((r) => [r, lits[r].map((v, k) => v / unit[k])]));
  const level = Math.max(1e-6, ...roles.map((r) => Y(raw[r]))) / BASE_MAX;
  const a = contrast * level, s = (1 - contrast) * level;
  const light = { ambient: { linear: hA.map((v) => v * a) }, sun: { linear: hS.map((v) => v * s) } };
  const want = Object.fromEntries(roles.map((r) => [r, raw[r].map((v) => v / level)]));
  const bases = Object.fromEntries(roles.map((r) => [r, want[r].map((v) => Math.min(1, v))]));
  // at another hour the materials stay and the light moves by the hour's key and ambient against the own hour's
  const moved = (from, to) => rgbOf(to).map((v, k) => decode(v) / Math.max(1e-6, decode(rgbOf(from)[k])));
  const sunL = h === own ? light.sun.linear : light.sun.linear.map((v, k) => v * moved(K.key.color, Kh.key.color)[k] * (Kh.gainK / K.gainK));
  const ambL = h === own ? light.ambient.linear : light.ambient.linear.map((v, k) => v * moved(K.ambient, Kh.ambient)[k]);
  const out = { sun: { linear: sunL }, ambient: { linear: ambL } };
  const checks = [
    ...roles.filter((r) => Y(bases[r]) >= BASE_MAX - 1e-9).map((r) => ({ role: r, says: `the brightest material: its base sets the light's level (luminance ${BASE_MAX})` })),
    ...roles.filter((r) => Math.max(...want[r]) > REACH).map((r) => ({ role: r, unreached: true, says: `its colour is out of this sun's reach (a base channel would be ${Math.round(Math.max(...want[r]) * 100) / 100}): held at 1, it shows ${seen(bases[r], light, 1)} for ${cube.colour[r]}` })),
  ];
  const mx = (c) => Math.max(1e-9, ...c);
  return {
    hour: h, own,
    sun: { color: hexOf(sunL.map((v) => encode(v / mx(sunL)))), level: r4(Y(sunL)), linear: sunL.map(r4), dir: dirOf(Kh.key.elevation, Kh.key.azimuth), elevation: Kh.key.elevation, azimuth: Kh.key.azimuth },
    ambient: { color: hexOf(ambL.map((v) => encode(v / mx(ambL)))), level: r4(Y(ambL)), linear: ambL.map(r4) },
    shade, contrast: r4(contrast), sky: Kh.dome, fog: Kh.fog,
    bases: Object.fromEntries(roles.map((r) => [r, hexOf(bases[r].map(encode))])),
    linearBases: Object.fromEntries(roles.map((r) => [r, bases[r].map(r4)])),
    targets: Object.fromEntries(roles.map((r) => [r, { lit: cube.colour[r], shade: seen(bases[r], light, 0), ...(Math.max(...want[r]) > REACH ? { reached: seen(bases[r], light, 1) } : {}) }])),
    checks,
  };
}
