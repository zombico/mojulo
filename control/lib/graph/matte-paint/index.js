/**
 * MICRO MATTE PAINTING — an element's face painted from its relief: a seeded height field (relief.js), lit from one
 * direction (light.js), coloured by sampling ramps at the values the light gives (paint.js), and cut to the element's
 * outline as an RGBA PNG. A lightweight, art-driven take on how a modern engine draws stone, without the 3D: sixth-gen
 * painted surfaces with that engine's drawing principles. The one rule: no line is drawn; every mark is relief the light
 * finds.
 *
 *   paintSurface(spec) → { W, H, png, url }      the face, painted and cut (`url` a data:image/png)
 *   readMatte(spec)    → the spec, checked and filled with its defaults (throws naming the setting and its range)
 *   MATTE_RAILS        every setting's range; MATTE_DEFAULTS the layers a spec that names none takes
 *
 * A spec: { outline: { shape: 'block', w, h, round? }, ppm?, grit?, seed?, light?, relief?, paint: { ramp, … } }.
 * A relief or paint layer left out takes its default; `false` leaves it out. A ramp is five or so stops, dark to light,
 * each '#rrggbb' or [r, g, b].
 *
 * Pure: seeded dice only (noise/noise.js, integer-exact). The bytes a spec paints are a compatibility promise over every
 * element that stores one.
 */
import { encodePngRgba } from '../landscape/surface-textures.js';
import { reliefField } from './relief.js';
import { lightRelief } from './light.js';
import { paintRelief } from './paint.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const no = (m) => { throw new Error(`matte: ${m}`); };
const num = (lo, hi) => ({ lo, hi }), int = (lo, hi) => ({ lo, hi, int: true });

export const MATTE_RAILS = Object.freeze({
  outline: { w: num(0.05, 3), h: num(0.05, 3), round: num(0, 0.1) },
  top: { ppm: int(32, 512), grit: num(0, 1), seed: int(1, 99999) },
  light: { az: num(-360, 360), el: num(5, 90), ambient: num(0, 0.9), wrap: num(0, 1), reach: num(0, 0.2), soft: num(0.0002, 0.01), floor: num(0, 1), radius: num(0.002, 0.05), cavity: num(0, 1), edge: num(0, 0.5) },
  relief: {
    form: { chamfer: num(0, 0.1), depth: num(0, 0.04), pillow: num(-0.01, 0.02), rag: num(0, 0.03) },
    rough: { amp: num(0, 0.02), scale: num(0.02, 1), grain: num(0, 0.004) },
    tool: { kind: { of: ['tooled', 'pitched'] }, spacing: num(0.003, 0.05), angle: num(-90, 90), amp: num(0, 0.01), size: num(0.02, 0.4) },
    spall: { count: int(0, 12), size: num(0.02, 0.5), depth: num(0, 0.06), cut: num(0.005, 0.06) },
    groove: { count: int(0, 8), width: num(0.001, 0.02), depth: num(0, 0.02), branch: num(0, 1) },
    pit: { size: num(0.002, 0.05), density: num(0, 1), depth: num(0, 1) },
  },
  paint: {
    contrast: num(0, 2),
    mottle: { amount: num(0, 1), tone: num(0, 0.5), scale: num(0.05, 2) },
    fleck: { size: num(0.003, 0.05), density: num(0, 1) },
    damp: { amount: num(0, 0.5) },
    dirt: { amount: num(0, 1), cavity: num(0, 2), foot: num(0, 2) },
    moss: { amount: num(0, 1) },
  },
});

export const MATTE_DEFAULTS = Object.freeze({
  ppm: 256, grit: 0.5, seed: 1,
  light: { az: 135, el: 38, ambient: 0.35, wrap: 0.2, reach: 0.05, soft: 0.0015, floor: 0.3, radius: 0.012, cavity: 0.45, edge: 0.1 },
  relief: {
    form: { chamfer: 0.03, depth: 0.012, pillow: 0.003, rag: 0.008 },
    rough: { amp: 0.004, scale: 0.25, grain: 0.0006 },
    tool: false,
    spall: { count: 4, size: 0.18, depth: 0.018, cut: 0.014 },
    groove: { count: 2, width: 0.01, depth: 0.006, branch: 0.4 },
    pit: { size: 0.012, density: 0.35, depth: 0.35 },
  },
  paint: { contrast: 0.9, mottle: { amount: 0.4, tone: 0.12, scale: 0.35 }, fleck: { size: 0.008, density: 0.08 }, damp: { amount: 0.12 }, dirt: { amount: 0.5, cavity: 0.8, foot: 0.35 }, moss: false },
});
const TOOL_DEFAULTS = { tooled: { spacing: 0.012, angle: 60, amp: 0.0008 }, pitched: { size: 0.09, amp: 0.006 } };

function check(v, r, at) {
  if (r.of) { if (!r.of.includes(v)) no(`${at} is one of ${r.of.join(', ')}`); return v; }
  if (typeof v !== 'number' || !Number.isFinite(v) || v < r.lo || v > r.hi || (r.int && !Number.isInteger(v))) no(`${at} is ${r.int ? 'a whole number' : 'a number'} from ${r.lo} to ${r.hi}`);
  return v;
}
function settings(v, rails, dflt, at) {
  if (!isObj(v)) no(`${at} is { ${Object.keys(rails).join('?, ')}? }`);
  for (const k of Object.keys(v)) if (!rails[k]) no(`${at}.${k} is not a setting (${Object.keys(rails).join(', ')})`);
  const out = { ...dflt };
  for (const [k, r] of Object.entries(rails)) if (v[k] !== undefined) out[k] = check(v[k], r, `${at}.${k}`);
  return out;
}
const HEX = /^#[0-9a-f]{6}$/i;
function readRamp(r, at) {
  if (!Array.isArray(r) || r.length < 2 || r.length > 9) no(`${at} is a ramp: 2 to 9 stops, dark to light, each '#rrggbb' or [r, g, b]`);
  return r.map((c, i) => {
    if (typeof c === 'string' && HEX.test(c)) return [1, 3, 5].map((o) => parseInt(c.slice(o, o + 2), 16));
    if (Array.isArray(c) && c.length === 3 && c.every((x) => Number.isInteger(x) && x >= 0 && x <= 255)) return c.slice();
    return no(`${at}[${i}] is '#rrggbb' or [r, g, b]`);
  });
}

/** The spec, checked and filled. */
export function readMatte(spec) {
  if (!isObj(spec)) no('a surface is { outline, paint: { ramp }, ppm?, grit?, seed?, light?, relief? }');
  for (const k of Object.keys(spec)) if (!['outline', 'ppm', 'grit', 'seed', 'light', 'relief', 'paint'].includes(k)) no(`${k} is not part of a surface (outline, ppm, grit, seed, light, relief, paint)`);
  if (!isObj(spec.outline) || spec.outline.shape !== 'block') no("outline is { shape: 'block', w, h, round? } (metres)");
  const { shape, ...o } = spec.outline;
  if (o.w === undefined || o.h === undefined) no('outline.w and outline.h are the face\'s size in metres');
  const outline = { shape, ...settings(o, MATTE_RAILS.outline, {}, 'outline') };
  const top = {};
  for (const [k, r] of Object.entries(MATTE_RAILS.top)) top[k] = spec[k] === undefined ? MATTE_DEFAULTS[k] : check(spec[k], r, k);
  const W = Math.round(outline.w * top.ppm), H = Math.round(outline.h * top.ppm);
  if (W > 1024 || H > 1024) no(`the face is ${W}×${H} texels; at most 1024 a side (lower ppm, or a smaller outline)`);
  const light = settings(spec.light ?? {}, MATTE_RAILS.light, MATTE_DEFAULTS.light, 'light');
  const R = spec.relief ?? {};
  if (!isObj(R)) no(`relief is { ${Object.keys(MATTE_RAILS.relief).join('?, ')}? }, each a layer or false`);
  for (const k of Object.keys(R)) if (!MATTE_RAILS.relief[k]) no(`relief.${k} is not a layer (${Object.keys(MATTE_RAILS.relief).join(', ')})`);
  const relief = {};
  for (const [k, rails] of Object.entries(MATTE_RAILS.relief)) {
    const v = R[k] === undefined ? MATTE_DEFAULTS.relief[k] : R[k];
    if (v === false) { relief[k] = false; continue; }
    if (k === 'tool') { if (!isObj(v) || !TOOL_DEFAULTS[v.kind]) no("relief.tool is { kind: 'tooled' | 'pitched', … } or false"); relief[k] = settings(v, rails, TOOL_DEFAULTS[v.kind], 'relief.tool'); continue; }
    relief[k] = settings(v, rails, MATTE_DEFAULTS.relief[k] || {}, `relief.${k}`);
  }
  const Pn = spec.paint;
  if (!isObj(Pn) || Pn.ramp === undefined) no('paint is { ramp, contrast?, mottle?, fleck?, damp?, dirt?, moss? }: the ramp is the material');
  for (const k of Object.keys(Pn)) if (k !== 'ramp' && !MATTE_RAILS.paint[k]) no(`paint.${k} is not a layer (ramp, ${Object.keys(MATTE_RAILS.paint).join(', ')})`);
  const paint = { ramp: readRamp(Pn.ramp, 'paint.ramp'), contrast: Pn.contrast === undefined ? MATTE_DEFAULTS.paint.contrast : check(Pn.contrast, MATTE_RAILS.paint.contrast, 'paint.contrast') };
  for (const k of ['mottle', 'fleck', 'damp', 'dirt', 'moss']) {
    const v = Pn[k] === undefined ? MATTE_DEFAULTS.paint[k] : Pn[k];
    if (v === false) { paint[k] = false; continue; }
    if (!isObj(v)) no(`paint.${k} is a layer { … } or false`);
    const { ramp, ...rest } = v, base = isObj(MATTE_DEFAULTS.paint[k]) ? MATTE_DEFAULTS.paint[k] : {};
    // a layer that paints from its own ramp needs one; mottle without one only drifts the tone
    if ((k === 'dirt' || k === 'moss') && ramp === undefined) { if (Pn[k] === undefined) { paint[k] = false; continue; } no(`paint.${k}.ramp is the colour it lays in`); }
    paint[k] = { ...settings(rest, MATTE_RAILS.paint[k], base, `paint.${k}`), ...(ramp !== undefined ? { ramp: readRamp(ramp, `paint.${k}.ramp`) } : {}) };
  }
  return { outline, ...top, light, relief, paint };
}

/** The face, painted and cut: { W, H, png, url }. */
export function paintSurface(spec) {
  const S = readMatte(spec);
  const field = reliefField({ outline: S.outline, ppm: S.ppm, relief: S.relief, grit: S.grit, seed: S.seed });
  const lit = lightRelief(field, S.light);
  const rgba = paintRelief(field, lit, S.paint, { grit: S.grit, seed: S.seed });
  const png = encodePngRgba(rgba, field.W, field.H);
  return { W: field.W, H: field.H, png, url: `data:image/png;base64,${png.toString('base64')}` };
}
