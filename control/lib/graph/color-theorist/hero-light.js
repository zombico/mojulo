/**
 * HERO LIGHT — the seventh generation's light on a hero, set the way the colour theorist would set it. Gen-6 bakes a
 * cube's light into the figure's vertex colour (era/cast-light.js `baked-plus-rim`); gen-7 is the form render (the
 * surface carries its material, the renderer lights it), so the same light becomes a RIG the renderer draws, and the
 * theorist's job moves from painting the value into the colour to checking the value AS LIT. An exploration: nothing in
 * the mint or the World page reads it yet (docs/hero-form-light.md says what is missing before one can).
 *
 *   heroFormLight(cube, { palette, surfaces, K }) → { era, rig, groups, reads, why }
 *     cube      a checked geocube (era/geocube.js readGeocube): its reference's sun (or its moon), its sky, its floor
 *     palette   the hero's groups → hex (the albedo: gen-7 draws it under no light)
 *     surfaces  the hero's groups → material (materials/dress-materials.js dressSurfaces, a hero's `recipe.surfaces`):
 *               the RESPONSE each group answers the light with; a group none names is cloth (matte)
 *     K         optional, a solved palette (color-theorist/solve.js): the key, fill and rim take its hues
 *               (adapters.js skinDirection's light) at the cube's levels, and its key sets the exposure
 *   rig      { key: { color, intensity, toLight }, fill: { sky, ground, intensity }, rim: { color, strength, power },
 *            exposure }: the cube's cast light as lights, not a bake (colours hex, intensities linear, toLight z-up)
 *   groups   per group: { response: 'cloth' | 'sheen' | 'metal' | 'glow', lit, shade } (lightness, OKLab L) under the
 *            rig, a three-quarter face to the key and a face turned from it
 *   reads    the theorist's laws on the lit figure, each { law, ok, … , note }:
 *              form        the figure turns: the key side a clear ratio over the shade side (the rig's key to its fill)
 *              shade       no group's shade side is a hole: near black is lost, whatever the albedo
 *              focal       the emblem and its trim hold a clear step from the base on BOTH sides of the light; a step the
 *                          paint held and the light closes is named
 *              separation  the figure's shade side against the horizon: too close, and the rim carries the outline
 *                          (the rig's rim is raised to do so, and the read says so)
 * Values are a proxy (a Lambert key, a hemisphere fill, a metal reflecting its sky), deterministic, never a render: the
 * machine gate. How it looks lit is the eyes gate's.
 */
import { geocubeCastLight } from '../era/cast-light.js';
import { resolveMaterial } from '../polygonizer/materials.js';
import { hexToRgb, rgbToHex, lchOf, oklch } from './oklab.js';
import { skinDirection } from './adapters.js';

const r3 = (x) => Math.round(x * 1000) / 1000;
const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const Y = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
const yOfHex = (hex) => Y(hexToRgb(hex).map(lin));
// (the lightness of a linear luminance: OKLab's L of a grey is its luminance's cube root)
const Lof = (y) => r3(Math.cbrt(Math.max(0, Math.min(1, y))));
const hexOf = (c) => rgbToHex(c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255)));
const peak = (c) => Math.max(...c, 1e-6);

/** The laws' thresholds (OKLab L steps; the form a luminance ratio), the eyes gate's to move. */
export const HERO_LIGHT_LAWS = Object.freeze({ form: 1.6, shadeFloor: 0.12, focal: 0.1, separation: 0.12, rimLift: 0.25 });
// the faces the read samples: a three-quarter face to the key, and the face turned from it
const KEY_COS = 0.8;
// the groups that carry the eye (the emblem, its trim) and the ones they sit on (the suit, the plate), by the pack and
// door names; the glows draw full-bright and are left out of the light's laws
const FOCAL = ['Emblem', 'OutfitAccent', 'OutfitTrim', 'Accent', 'Trim'];
const BASE = ['OutfitBase', 'Top', 'Plate', 'Suit', 'Lacquer', 'Outer'];
const GLOW = new Set(['Lens', 'Reactor', 'Light', 'EyeGlow', 'Visor', 'Socket']);

/** a group's response to the light, from its material: metal reflects its sky; a satin or a glass takes a sheen; cloth
 * (and a group no surface names) is matte */
function responseOf(m) {
  if (m === undefined || m === null) return { response: 'cloth', spec: 0 };
  const R = resolveMaterial(m);
  if (R.emissive) return { response: 'glow', spec: 0 };
  if (R.metal) return { response: 'metal', spec: R.specular ?? 0.6 };
  return R.specular >= 0.2 ? { response: 'sheen', spec: R.specular } : { response: 'cloth', spec: R.specular ?? 0 };
}

export function heroFormLight(cube, { palette = {}, surfaces = {}, K = null } = {}) {
  const C = geocubeCastLight(cube), L = HERO_LIGHT_LAWS;
  // THE RIG: the cast light's channels as lights. The theorist's palette, when given, lends them its hues (the key its
  // light, the fill its sky-and-shadow, the rim its sky's edge) at the cube's own levels, so a palette never relights a
  // scene brighter or darker than its cube, only warmer or cooler
  const D = K ? skinDirection(K, 'none').light : null;
  // (a light's colour at its peak, its strength apart; a palette's hue and chroma at that colour's own lightness)
  const norm = (c) => c.map((v) => v / peak(c));
  const hued = (hex, like) => { const [, Ch, h] = lchOf(hexToRgb(hex)); return rgbToHex(oklch(lchOf(norm(like).map((v) => v * 255))[0], Ch, h)); };
  // (the cast light's channels are display fractions, as the bake multiplies them; the read takes them linear)
  const keyC = C.cast.key, fillC = C.cast.ambient, groundC = C.cast.bounce.some((v) => v > 0) ? C.cast.bounce : fillC.map((v) => v * 0.35);
  const key = { color: D ? hued(D.key, keyC) : hexOf(norm(keyC)), intensity: r3(peak(keyC)), toLight: C.toLight };
  const fill = { sky: D ? hued(D.fill, fillC) : hexOf(norm(fillC)), ground: hexOf(norm(groundC)), intensity: r3(peak(fillC)) };
  const horizon = C.rim.slice(0, 3);
  const rim = { color: D ? D.rim : hexOf(horizon), strength: C.rim[3], power: C.rim[4] };
  const exposure = D ? D.exposure : 1;

  // THE GROUPS AS LIT: the albedo under the key at three quarters plus the sky's fill (the lit side), the fill alone
  // (the shade side); a metal reflects the sky on both and catches the key in its specular
  const linY = (c) => Y(c.map((v) => lin(v * 255))), kY = linY(keyC), fY = linY(fillC), gY = linY(groundC) * 0.5;
  const groups = {};
  for (const [g, hex] of Object.entries(palette)) {
    if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) continue;
    const { response, spec } = GLOW.has(g) ? { response: 'glow', spec: 0 } : responseOf(surfaces[g] ?? surfaces['*']);
    const a = yOfHex(hex);
    if (response === 'glow') { groups[g] = { response, lit: Lof(a), shade: Lof(a) }; continue; }
    const lit = response === 'metal' ? a * (fY + spec * kY) : a * (KEY_COS * kY + fY) + spec * 0.04 * kY;
    const shade = response === 'metal' ? a * (fY + gY) * 0.8 : a * (fY + gY);
    groups[g] = { response, lit: Lof(lit * exposure), shade: Lof(shade * exposure) };
  }

  // THE LAWS on the lit figure
  const reads = [];
  const lit = Object.entries(groups).filter(([, v]) => v.response !== 'glow');
  // (the form is the rig's: every matte group turns by the same key-to-fill ratio, whatever its albedo)
  const ratio = r3((KEY_COS * kY + fY) / Math.max(fY + gY, 1e-6));
  reads.push({ law: 'form', ok: ratio >= L.form, ratio, want: L.form,
    note: ratio >= L.form ? `the key side is ${ratio}× the shade side: the form turns` : `the key side is only ${ratio}× the shade side (want ${L.form}×): the fill is near the key and the figure reads flat; raise the key or deepen the fill` });
  const black = lit.filter(([, v]) => v.shade < L.shadeFloor).map(([g]) => g);
  reads.push({ law: 'shade', ok: !black.length, groups: black, want: L.shadeFloor,
    note: black.length ? `${black.join(', ')} fall${black.length === 1 ? 's' : ''} under ${L.shadeFloor} L in the shade: a hole, not a colour; lift the fill, or the rim must find ${black.length === 1 ? 'its' : 'their'} edge` : 'the shade side is a colour everywhere' });
  const base = BASE.find((g) => groups[g] && groups[g].response !== 'glow');
  if (base) for (const g of FOCAL.filter((f) => groups[f] && groups[f].response !== 'glow' && palette[f] !== palette[base])) {
    const painted = Math.abs(Lof(yOfHex(palette[g])) - Lof(yOfHex(palette[base]))), onLit = Math.abs(groups[g].lit - groups[base].lit), onShade = Math.abs(groups[g].shade - groups[base].shade);
    const ok = onLit >= L.focal && onShade >= L.focal;
    reads.push({ law: 'focal', ok, groups: [g, base], step: { painted: r3(painted), lit: r3(onLit), shade: r3(onShade) }, want: L.focal,
      note: ok ? `${g} holds its step from ${base} on both sides of the light` : `${g} against ${base}: ${r3(onLit)} L lit, ${r3(onShade)} in the shade (want ${L.focal})${painted >= L.focal ? '; the paint held it, the light closes it (a metal reflecting the same sky as its ground, or a shade that swallows both)' : '; the paint never held it'}` });
  }
  const figure = lit.length ? lit.reduce((s, [, v]) => s + v.shade, 0) / lit.length : null, bg = Lof(linY(horizon));
  if (figure !== null) {
    const gap = r3(Math.abs(figure - bg)), ok = gap >= L.separation;
    if (!ok) rim.strength = r3(Math.min(1, rim.strength + L.rimLift));
    reads.push({ law: 'separation', ok, gap, want: L.separation,
      note: ok ? `the figure's shade side stands ${gap} L off the horizon: the rim is an accent` : `the figure's shade side is ${gap} L off the horizon (want ${L.separation}): the rim carries the outline, raised to ${rim.strength}` });
  }
  const why = [
    `The ${C.from.key} of ${C.from.reference} as the key, the sky's fill and the ${C.from.key === 'sun' ? 'floor\'s bounce' : 'dark ground'} as a hemisphere, the horizon as the rim: the cube's cast light drawn live, not baked.`,
    ...(K ? [`Its hues the palette's (${K.id}), at the cube's levels; exposure ${exposure} for a ${K.read.key} key.`] : []),
    `A group's response is its material: ${[...new Set(Object.values(groups).map((v) => v.response))].join(', ')}.`,
  ];
  return { era: cube.era ?? 'gen-6', rig: { key, fill, rim, exposure }, groups, reads, why };
}
