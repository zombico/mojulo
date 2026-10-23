/**
 * THE COLOUR REGISTER — how a cube's world is rendered as a drawing, beside what its colours are. A register was the
 * tone's bands and key (`steps`, `key`); it now also names the inks the World draws over the light, so a style is one
 * choice on the cube:
 *
 *   steps     the tone's bands along each ramp (0 continuous; 3 the cel look's three values)
 *   key       the median value the tone brings the light to
 *   outline   the silhouette line round every form (true, or { width: css px, color }): the cel look's outline
 *   creases   the concave creases inked (the World's crease pass, scene/channels/creases.js: true or its terms)
 *   contrast  the shaping in the vertex the register brings (vertex-contrast.js), when the cube names none of its own
 *
 * A NAME is a preset of the terms (REGISTERS), or `{ from, …changes }`; what the cube writes wins term by term, and a
 * name keeps the key the cube had (or the palette solves). The colour theorist inks it: the outline at a value under
 * every ramp's darkest stop, in the stone's hue; the creases at the same value in the shade's hue (`registerInks`). A
 * register that names no ink is the register it always was: nothing new is drawn.
 *
 *   REGISTERS                      the named registers
 *   expandRegister(r, under, no)   a name or { from, … } → the terms over `under` (the cube's own register); else r
 *   checkRegister(r, no)           the terms, checked
 *   registerInks(cube)             → { outline, creases } #rrggbb, from the cube's colours and shade
 *   registerCreases(cube)          the crease pass's terms the register asks for (inks filled), or null
 *   registerInkLaw(cube)           the `register-ink` law's measure (geocube-laws.js CUBE_LAWS)
 */
import { rampFrom } from './look-facets.js';
import { oklch, lchOf, hexToRgb, rgbToHex } from '../color-theorist/oklab.js';
import { readCreases } from '../scene/channels/creases.js';
import { readContrast } from './vertex-contrast.js';
import { grittyOf } from '../matte-paint/fabric.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const HEX = /^#[0-9a-fA-F]{6}$/;

/** The named registers. `continuous` is every cube's register before names: the light alone, no ink. */
export const REGISTERS = Object.freeze({
  continuous: Object.freeze({ steps: 0 }),
  // three values along each ramp, an outline round every form, the creases a crisp line with little wash
  cel: Object.freeze({ steps: 3, outline: true, creases: Object.freeze({ line: 0.9, wash: 0.25 }) }),
  // the light continuous, the creases a broad wash that pools in the corners, a fine outline
  'ink-wash': Object.freeze({ steps: 0, outline: Object.freeze({ width: 1 }), creases: Object.freeze({ line: 0.5, wash: 0.7, reach: 3 }) }),
  // the Wii-era look: the light shaped in the vertex, the creases soft, no outline
  wii: Object.freeze({ steps: 0, contrast: 'wii', creases: Object.freeze({ line: 0.35, wash: 0.5 }) }),
});
const TERMS = ['name', 'steps', 'key', 'outline', 'creases', 'contrast'];
/** an outline's width by default: css pixels at the page's scale */
export const OUTLINE_WIDTH = 1.5;

/** A name, or { from: name, …changes } → the name's terms over `under` (its key kept), changes winning; else `r` as is. */
export function expandRegister(r, under = {}, no = (m) => { throw new Error(m); }) {
  const spec = typeof r === 'string' ? { from: r } : r;
  if (!isObj(spec) || spec.from === undefined) return r;
  const { from, ...rest } = spec;
  if (!REGISTERS[from]) no(`register '${from}' is not one (registers: ${Object.keys(REGISTERS).join(', ')}); or write { steps, key }`);
  return { ...(under && under.key !== undefined ? { key: under.key } : {}), ...structuredClone(REGISTERS[from]), ...rest, name: from };
}

/** The terms as written, checked; `no` throws with the cube's voice. */
export function checkRegister(r, no) {
  if (!isObj(r)) no('register is a name (continuous, cel, ink-wash, wii), { from: name, …changes }, or { steps, key, outline?, creases?, contrast? }');
  for (const k of Object.keys(r)) if (!TERMS.includes(k)) no(`register.${k} is not a setting (register: ${TERMS.filter((t) => t !== 'name').join(', ')})`);
  if (r.name !== undefined && !REGISTERS[r.name]) no(`register.name '${r.name}' is not a register (${Object.keys(REGISTERS).join(', ')})`);
  if (!(Number.isInteger(r.steps) && r.steps >= 0 && r.steps <= 8)) no('register.steps is the tone\'s bands, 0 (continuous) to 8');
  if (!(r.key > 0 && r.key < 1)) no('register.key is the median value the tone brings the light to, 0..1');
  if (r.outline !== undefined && r.outline !== false && r.outline !== true) {
    if (!isObj(r.outline)) no('register.outline is true, false, or { width, color }');
    for (const k of Object.keys(r.outline)) if (!['width', 'color'].includes(k)) no(`register.outline.${k} is not a setting (outline: width, color)`);
    if (r.outline.width !== undefined && !(typeof r.outline.width === 'number' && r.outline.width >= 0.5 && r.outline.width <= 6)) no('register.outline.width is the line\'s width in css pixels, 0.5 to 6');
    if (r.outline.color !== undefined && !HEX.test(r.outline.color)) no('register.outline.color is a #rrggbb colour');
  }
  if (r.creases !== undefined && r.creases !== false) { try { readCreases(r.creases); } catch (e) { no(`register.${e.message}`); } }
  if (r.contrast !== undefined && r.contrast !== false) { try { readContrast(r.contrast); } catch (e) { no(`register.${e.message}`); } }
}

const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hexOf = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
/** the shade colour a crevice darkens toward: a hue at a soft saturation (the cube's `colour.shade`, 222 by default) */
export function shadeHex(hue) {
  const s = 0.4, l = 0.5, a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + hue / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return hexOf([f(0), f(8), f(4)].map((v) => v * 255));
}
/** how far under the darkest ramp stop the inks sit, as a share of its lightness */
export const INK_DEPTH = 0.6;

/**
 * The register's inks from the cube's colours: the darkest stop over every ramp (each ramp's dark end leaning to the
 * shade hue, as geocubeRamps cuts it) sets the value; the outline takes the stone's hue there, the creases the shade's,
 * each at a quiet chroma. Both sit under every colour the world is painted in, so an ink never reads as a colour.
 */
export function registerInks(cube) {
  const shadow = cube.colour.shade ?? 222;
  const darkest = Object.entries(cube.colour).filter(([k, v]) => k !== 'shade' && HEX.test(v ?? '')).map(([k, v]) => [k, rampFrom(rgbOf(v), 5, { shadow })[0]]);
  const L = Math.min(...darkest.map(([, rgb]) => lchOf(rgb)[0])) * INK_DEPTH;
  const stone = darkest.find(([k]) => k === 'stone')?.[1] ?? darkest[0][1];
  const [, Cs, hs] = lchOf(stone), [, Cd, hd] = lchOf(hexToRgb(shadeHex(shadow)));
  return { outline: rgbToHex(oklch(L, Math.min(Cs, 0.04), hs)), creases: rgbToHex(oklch(L, Math.min(Cd, 0.06), hd)) };
}

/** The crease pass's terms the cube's register asks for — its creases and its outline, inked by the colour theorist
 * where the register names no ink — or null when it asks for neither. A GRITTY cube (grit ≥ GRIT_PIXELS) whose register
 * names no creases draws the wii register's, soft: its built stone panel-lined where it meets itself and the ground,
 * its foliage left alone by the crease roles (scene/crease-roles.js); `creases: false` in its register draws none. */
export function registerCreases(cube) {
  const r = cube.register, own = r.creases !== undefined ? r.creases : grittyOf(cube) !== null ? REGISTERS.wii.creases : undefined;
  const creases = own !== undefined && own !== false, outline = r.outline !== undefined && r.outline !== false;
  if (!creases && !outline) return null;
  const inks = registerInks(cube), o = isObj(r.outline) ? r.outline : {};
  return readCreases({
    ...(creases ? (own === true ? {} : own) : { line: 0, wash: 0 }),
    ink: (isObj(own) && own.ink) || inks.creases,
    ...(outline ? { outline: { ink: o.color ?? inks.outline, width: o.width ?? OUTLINE_WIDTH } } : {}),
  });
}

const hueOff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
/**
 * The `register-ink` law's measure (geocube-laws.js): every ink the register draws sits under the darkest stop of every
 * ramp, so an ink never reads as one of the world's colours, and the creases' ink keeps to the shade's family (within
 * 40° of its hue), so a shadow in a corner reads as the cube's shade. → { ok, value }
 */
export function registerInkLaw(cube) {
  const reg = registerCreases(cube);
  if (!reg) return { ok: true, value: 'the register draws no ink' };
  const shadow = cube.colour.shade ?? 222;
  const darkL = Math.min(...Object.entries(cube.colour).filter(([k, v]) => k !== 'shade' && HEX.test(v ?? '')).map(([, v]) => lchOf(rampFrom(rgbOf(v), 5, { shadow })[0])[0]));
  const inks = [...(reg.line + reg.wash > 0 ? [['creases', reg.ink]] : []), ...(reg.outline ? [['outline', reg.outline.ink]] : [])];
  const bright = inks.filter(([, h]) => lchOf(hexToRgb(h))[0] >= darkL).map(([k]) => k);
  const [, Cc, hc] = lchOf(hexToRgb(reg.ink)), [, , hs] = lchOf(hexToRgb(shadeHex(shadow)));
  const off = reg.line + reg.wash > 0 && Cc > 0.01 ? hueOff(hc, hs) : 0;
  const r2 = (v) => Math.round(v * 100) / 100;
  return { ok: !bright.length && off <= 40,
    value: `${inks.map(([k, h]) => `${k} ${h} (L ${r2(lchOf(hexToRgb(h))[0])})`).join(', ')} under the darkest stop (L ${r2(darkL)})${bright.length ? `: ${bright.join(', ')} not under it` : ''}; the creases ${Math.round(off)}° off the shade's hue` };
}
