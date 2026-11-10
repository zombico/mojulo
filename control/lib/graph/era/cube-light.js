/**
 * THE CUBE'S LIGHT — the light the cube's palette asks for at its hour (the color theorist's solve,
 * color-theorist/light.js: the palette's colours are targets, the base colours and one light solved together so the
 * render shows them; the operator, 1026: the palette knows how bright the sun is and what it does to the colours). The
 * cube composes: it hands the theorist its colours (written, or the palette's solve) as the targets, its sky at its own
 * hour as the sky's light, the hour's key as the sun, and its reference's contrast (the share of the light a sky-lit face
 * keeps, the ambient against the ambient and the key), raised where the sky it paints is brighter than that light gives
 * (skyShare), or its own (`light.skyShare`); at another hour the bases stay and the light moves by the hour's
 * key and ambient against the cube's own.
 *
 *   cubeLight(cube, { hour? }) → { hour, own, sun: { color, level, linear, dir, elevation, azimuth }, ambient: { color,
 *       level, linear }, shade, contrast, skyLight, sky, fog, bases: { role: '#rrggbb' }, linearBases, targets: { role: { lit,
 *       shade, reached? } }, checks }
 *     colours hex; `linear` and `level` in base-multiplier units (out = base × (ambient + sun × cos θ)); a renderer that
 *     divides diffuse by π, as three does, sets its lights to π × these. `checks`: the brightest material (it sets the
 *     light's level) and any colour out of the sun's reach (held at the edge: `targets[role].reached` is what it shows),
 *     and a `sky` row where the sky moved the share or the level, or the cube states its own. `skyLight`: skyShare's read
 *   skyShare({ card, own?, painted, level })   the sky's share of the light, and the rule that set it
 *   seen(base, light, cos)   the display colour a base shows under the cube's light
 *   toneNeutral, untoneNeutral, BASE_MAX   the theorist's, passed on
 *
 * Pure: no dice, no clock. The form render's land reads it (form/land-read.js); a painted page reads none of it.
 */
import { hourLight, referenceHour } from './geocube-hours.js';
import { SIXTH_GEN_REFERENCES, resolveLook } from './sixth-gen.js';
import { shadeHex } from './colour-register.js';
import { solveLight, seen as seenUnder, decodeSrgb, encodeSrgb, luminance, untoneNeutral } from '../color-theorist/light.js';

export { toneNeutral, untoneNeutral, BASE_MAX } from '../color-theorist/light.js';
/** The display colour a base (linear rgb) shows under a cube's light (cubeLight's, or the theorist's arrays) at cos θ. */
export const seen = (base, L, cos = 1) => seenUnder(base, { sun: L.sun.linear ?? L.sun, ambient: L.ambient.linear ?? L.ambient }, cos);

const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const hexOf = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const dirOf = (el, az) => { const e = (el * Math.PI) / 180, a = (az * Math.PI) / 180; return [Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)].map(r4); };
const asHex = (lin) => { const m = Math.max(1e-9, ...lin); return hexOf(lin.map((v) => encodeSrgb(v / m))); };

/** How much brighter than the light it gives a painted sky may be seen (the dome's level over the ambient's): past it
 *  the sky's share of the light rises to meet the sky. */
export const SKY_OVER = 1.5;
/** The most of the light the sky may be made to give: a sun, or a moon, is still a key. */
export const SKY_SHARE_MAX = 0.9;

/**
 * THE SKY'S SHARE OF THE LIGHT (the solve's `contrast`): the look card's (its ambient against its ambient and key),
 * raised where the sky the cube paints is brighter than `SKY_OVER` × the ambient that share would give, so the sky a
 * form page draws (its level the ambient's, channels/form-sky.js) is near the sky the look paints; under an overcast
 * sky brighter than anything it lights the share stops at `SKY_SHARE_MAX` and the light's level rises to the sky's, the
 * materials dark under it. A cube that states its own (`light.skyShare`) keeps it, the sky only read against it.
 * → { share, minLevel, rule: 'card' | 'sky' | 'sky-level' | 'own', card, painted, gives, over }: `painted` the dome's
 * level, `gives` the ambient's, `over` painted ÷ gives.
 */
export function skyShare({ card, own, painted, level }) {
  const r4s = (v) => Math.round(v * 1e4) / 1e4, read = (share, minLevel, rule) => {
    const gives = share * Math.max(level, minLevel);
    // (the share and the level as solved, unrounded: a card's share is the solve's as it always was, byte for byte)
    return { share, minLevel, rule, card: r4s(card), painted: r4s(painted), gives: r4s(gives), over: r4s(painted / Math.max(1e-9, gives)) };
  };
  if (own !== undefined) return read(own, 0, 'own');
  const need = painted / SKY_OVER;
  if (card * level >= need) return read(card, 0, 'card');
  if (need <= SKY_SHARE_MAX * level) return read(need / level, 0, 'sky');
  return read(SKY_SHARE_MAX, need / SKY_SHARE_MAX, 'sky-level');
}

export function cubeLight(cube, { hour } = {}) {
  const ref = SIXTH_GEN_REFERENCES[resolveLook(cube.light.reference)], own = referenceHour(ref), h = hour ?? own;
  const K = hourLight(cube, own), Kh = h === own ? K : hourLight(cube, h);
  const yA = luminance(rgbOf(K.ambient).map(decodeSrgb)), yS = luminance(rgbOf(K.key.color).map(decodeSrgb)) * K.gainK;
  const sky = hexOf(K.dome.zenith.map((v, k) => (decodeSrgb(v / 255) + decodeSrgb(K.dome.horizon[k] / 255)) / 2).map(encodeSrgb));
  const roles = Object.keys(cube.colour).filter((k) => k !== 'shade' && /^#[0-9a-f]{6}$/i.test(cube.colour[k]));
  const targets = Object.fromEntries(roles.map((r) => [r, cube.colour[r]]));
  // the share the sky gives: the card's, read against the sky the cube paints at its own hour (skyShare)
  const sunHex = cube.light.sun?.color ?? K.key.color, card = yA / (yA + yS);
  const painted = luminance(untoneNeutral(K.dome.zenith.map((v, k) => (decodeSrgb(v / 255) + decodeSrgb(K.dome.horizon[k] / 255)) / 2)));
  const first = cube.light.skyShare === undefined ? solveLight({ targets, sky, sun: sunHex, contrast: card }).level : 0;
  const SK = skyShare({ card, own: cube.light.skyShare, painted, level: first });
  const S = solveLight({ targets, sky, sun: sunHex, contrast: SK.share, minLevel: SK.minLevel });
  const at = { sun: S.sun, ambient: S.ambient };
  const moved = (from, to) => rgbOf(to).map((v, k) => decodeSrgb(v) / Math.max(1e-6, decodeSrgb(rgbOf(from)[k])));
  const sunL = h === own ? S.sun : S.sun.map((v, k) => v * moved(K.key.color, Kh.key.color)[k] * (Kh.gainK / K.gainK));
  const ambL = h === own ? S.ambient : S.ambient.map((v, k) => v * moved(K.ambient, Kh.ambient)[k]);
  const SKY_SAYS = { sky: 'the sky it paints is brighter than its look\'s ambient gives: the sky\'s share of the light raised to meet it', 'sky-level': 'the sky it paints is brighter than anything it lights: the light\'s level is the sky\'s, its materials dark under it', own: 'the cube states the sky\'s share of its light' };
  const checks = [
    ...(SK.rule === 'card' ? [] : [{ sky: true, rule: SK.rule, says: `${SKY_SAYS[SK.rule]} (${SK.card} → ${r4(SK.share)}; the sky ${SK.over}× the light it gives)` }]),
    ...S.brightest.map((r) => ({ role: r, says: 'the brightest material: its base sets the light\'s level' })),
    ...Object.entries(S.unreached).map(([r, w]) => ({ role: r, unreached: true, says: `its colour is out of this sun's reach (a base channel would be ${Math.round(Math.max(...w) * 100) / 100}): held at 1, it shows ${seen(S.bases[r], at, 1)} for ${cube.colour[r]}` })),
  ];
  return {
    hour: h, own,
    sun: { color: asHex(sunL), level: r4(luminance(sunL)), linear: sunL.map(r4), dir: dirOf(Kh.key.elevation, Kh.key.azimuth), elevation: Kh.key.elevation, azimuth: Kh.key.azimuth },
    ambient: { color: asHex(ambL), level: r4(luminance(ambL)), linear: ambL.map(r4) },
    shade: shadeHex(cube.colour.shade ?? 222), contrast: r4(SK.share), skyLight: { ...SK, share: r4(SK.share), minLevel: r4(SK.minLevel) }, sky: Kh.dome, fog: Kh.fog,
    bases: Object.fromEntries(roles.map((r) => [r, hexOf(S.bases[r].map(encodeSrgb))])),
    linearBases: Object.fromEntries(roles.map((r) => [r, S.bases[r].map(r4)])),
    targets: Object.fromEntries(roles.map((r) => [r, { lit: cube.colour[r], shade: seen(S.bases[r], at, 0), ...(S.unreached[r] ? { reached: seen(S.bases[r], at, 1) } : {}) }])),
    checks,
  };
}
