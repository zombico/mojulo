/**
 * THE CAVERN'S COLOUR KEY — the colour theorist's offer to a cave (era/cavern.js): one key the whole cave is painted and
 * lit in, solved from the world's own colours, so its lamps, its dark, its rock's bounce, its formations and whatever is
 * set in it read as one picture, and as this world's. The theorist offers; the set designer (era/cavern-set.js) picks.
 *
 * The REGISTER names a family of light (era/cave.js CAVE_LIGHTS): firelight amber, a tube's cold white, a growth's glow.
 * The world turns it inside its family, never out of it (a torch in a world of red earth burns redder, never green):
 *   torch        toward the world's soil (the earth it is lit over)
 *   fluorescent  toward the world's sky (the white the world's daylight is)
 *   bio          toward the world's accent nearest round the wheel (its strange colour), the farthest a family turns
 * The SHADE is the temperature opposite the key's: a warm key casts a cool shade, a cold one a warm shade (a painter's
 * rule, and the light plot's: compose-plot.js keys a room against its fill). The cave's dark and its rock's bounce take
 * it, the rock's own hue mixed in as far as the rock has one.
 *
 *   CAVE_KEYS   { register: { turn, span, words } }: what the world turns the register toward, how far it may
 *   cavernKey(palette, light) → { light, fixture, glow, shade, crack, formation, accent, made, read, laws }
 *     palette  the stage's ramps (rgb 0…255, a ramp's middle its key colour): rock, soil, sky, and the accents it has
 *              (accent, accent2, fruit, gold, violet)
 *     light    the register: 'torch' | 'fluorescent' | 'bio' | 'daylight' (no lamps: the key the crack's daylight)
 *     → light     the lamps' colour, a multiplier in 0…1, its brightest channel 1 (as CAVE_LIGHTS' are); null daylight
 *       fixture   the lamp drawn (its flame, its tube, its crystals) '#rrggbb'; glow, a growth's second colour
 *       shade     the dark's and the bounce's colour, a multiplier of luminance 1 (it moves hue, not level)
 *       crack     a crack's and a skylight's daylight, from the world's sky: a multiplier, brightest channel 1
 *       formation the formations' albedo, 0…1: the rock lifted toward the soil (flowstone reads paler than the wall)
 *       accent    the set's paint '#rrggbb': the world's accent farthest round the wheel from the key
 *       made      { metal, stone, wood, drab, cloth } '#rrggbb': what a set is built of, in the key
 *       read      words and hues: what the key is, for a readout
 *       laws      [{ id, ok, value }]: the key's laws, measured (advice: none refuses)
 *   KEY_LAWS    the laws' ids and what each holds
 *
 * Pure: the same palette and register make the same key.
 */
import { lchOf, oklch, hueGap, mixHue, rgbToHex, hexToRgb } from '../color-theorist/oklab.js';
import { CAVE_LIGHTS, CRACK } from './cave.js';

export const CAVE_KEYS = Object.freeze({
  torch: Object.freeze({ turn: 'soil', share: 0.5, span: 22, words: 'firelight amber' }),
  fluorescent: Object.freeze({ turn: 'sky', share: 0.5, span: 50, words: 'a tube\'s cold white' }),
  bio: Object.freeze({ turn: 'accent', share: 0.5, span: 50, words: 'a growth\'s glow' }),
});
export const KEY_LAWS = Object.freeze({
  temperature: 'the shade the temperature opposite the key\'s: a warm key a cool shade, a cold key a warm one',
  family: 'the key inside its register\'s family: the world turns it, never out of it',
  accent: 'the set\'s accent far round the wheel from the key (60° at least), so it reads against the light it stands in',
  lifted: 'the formations paler than the wall they grow on',
});
// how far the accent stands from the key (degrees), how much paler a formation than the wall (OKLab L), how far apart
// the key's and the shade's warmth
const APART = 60, LIFT = 0.06, WARMTH = 0.1;

const mid = (r) => (r && r.length ? r[Math.floor(r.length / 2)] : null);
const r3 = (v) => Math.round(v * 1000) / 1000;
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
// a colour as a lamp's multiplier: its brightest channel 1; as a shade's: its luminance 1
const peak = (rgb) => { const m = Math.max(...rgb, 1e-6); return rgb.map((v) => r3(v / m)); };
const level = (rgb) => { const c = rgb.map((v) => v / 255), l = Math.max(1e-6, lum(c)); return c.map((v) => r3(v / l)); };
const signed = (a, b) => ((b - a + 540) % 360) - 180;
/** How warm a light or a tint reads: red over blue against its brightest channel, > 0 warm, < 0 cool. */
export const warmth = (c) => (c[0] - c[2]) / Math.max(...c, 1e-6);
const asHex = (c) => (typeof c === 'string' ? c : rgbToHex(c));

/** The cave's key from the world's palette and the register it is lit by. */
export function cavernKey(palette = {}, light = 'torch') {
  const P = palette ?? {}, rock = mid(P.rock) ?? [128, 124, 118], soil = mid(P.soil) ?? [120, 96, 72], sky = mid(P.sky) ?? [120, 176, 236];
  const accents = ['accent', 'accent2', 'fruit', 'gold', 'violet'].map((k) => [k, mid(P[k])]).filter(([, c]) => c);
  const L = CAVE_LIGHTS[light], K = CAVE_KEYS[light];
  // the KEY: the register's hue, turned toward the world's colour its family turns to, held inside its span
  let keyHue, light01 = null, fixture = null, glow = null, turned = 0;
  if (L) {
    const [Ll, Lc, Lh] = lchOf(L.colour.map((v) => v * 255));
    const near = accents.map(([, c]) => c).filter((c) => lchOf(c)[1] > 0.04).sort((a, b) => hueGap(Lh, lchOf(a)[2]) - hueGap(Lh, lchOf(b)[2]))[0];
    const toward = K.turn === 'accent' ? (near ?? null) : K.turn === 'sky' ? sky : soil;
    const [, tc, th] = toward ? lchOf(toward) : [0, 0, Lh];
    // (a grey colour has no hue to turn toward)
    turned = tc > 0.02 ? Math.max(-K.span, Math.min(K.span, signed(Lh, th) * K.share)) : 0;
    keyHue = (Lh + turned + 360) % 360;
    light01 = peak(oklch(Ll, Lc, keyHue).map((v) => v / 255));
    const turn = (hex) => { const [l, c, h] = lchOf(hexToRgb(hex)); return rgbToHex(oklch(l, c, (h + turned + 360) % 360)); };
    fixture = turn(L.fixture);
    glow = light === 'bio' ? turn('#4fe0b0') : null;
  }
  // (daylight: the key the crack's, the world's sky lifted toward white)
  const [, skyC, skyH] = lchOf(sky), [crL, crC, crH] = lchOf(CRACK.colour.map((v) => v * 255));
  const crack = peak(oklch(crL, Math.min(Math.max(crC, skyC * 0.3), 0.045), skyC > 0.02 ? skyH : crH).map((v) => v / 255));
  if (keyHue === undefined) keyHue = lchOf(crack.map((v) => v * 255))[2];
  const keyRgb = light01 ?? crack;
  // the SHADE: the temperature opposite the key's (its complement), the rock's own hue mixed in as far as it has one
  const [rl, rc, rh] = lchOf(rock), [, sc, sh] = lchOf(soil), comp = (keyHue + 180) % 360;
  const shadeHue = rc > 0.03 ? mixHue(rh, comp, 0.6) : comp, shade = level(oklch(0.6, 0.045, shadeHue));
  // the FORMATIONS: the wall's rock lifted, its hue toward the soil (flowstone's calcite, stained by the earth over it)
  const fh = rc > 0.02 ? mixHue(rh, sh, 0.5) : sh, formation = oklch(Math.min(0.9, rl + 0.1), Math.min(0.05, Math.max(rc, sc * 0.5)), fh).map((v) => r3(v / 255));
  // the ACCENT: the world's accent farthest from the key (else the key's complement turned a little), held to a paint's
  const pick = accents.map(([k, c]) => ({ k, c, h: lchOf(c)[2], C: lchOf(c)[1] })).filter((a) => a.C > 0.04).sort((a, b) => hueGap(keyHue, b.h) - hueGap(keyHue, a.h))[0];
  const accentHue = pick ? pick.h : (comp + 30) % 360, accent = rgbToHex(oklch(0.58, Math.min(0.13, pick ? pick.C : 0.12), accentHue));
  // what a set is built of, in the key: a dark metal in the shade's hue, stone the rock's, wood the soil's, an olive drab
  const made = {
    metal: rgbToHex(oklch(0.34, 0.012, shadeHue)), stone: rgbToHex(oklch(Math.min(0.72, rl), Math.min(0.03, rc + 0.01), rc > 0.02 ? rh : sh)),
    wood: rgbToHex(oklch(0.42, Math.min(0.06, Math.max(0.035, sc)), sh)), drab: rgbToHex(oklch(0.48, 0.03, mixHue(rc > 0.02 ? rh : sh, 115, 0.6))), cloth: accent,
  };
  const laws = [
    (() => { const a = warmth(keyRgb), b = warmth(shade), ok = a * b < 0 && Math.abs(a - b) >= WARMTH; return { id: 'temperature', ok, value: `key ${a >= 0 ? 'warm' : 'cool'} (${r3(a)}), shade ${b >= 0 ? 'warm' : 'cool'} (${r3(b)})` }; })(),
    (() => { if (!L) return { id: 'family', ok: true, value: 'daylight: the world\'s sky' }; const g = Math.abs(turned); return { id: 'family', ok: g <= K.span + 1e-9, value: `${K.words}, turned ${r3(turned)}° of ${K.span}°` }; })(),
    (() => { const g = hueGap(keyHue, accentHue); return { id: 'accent', ok: g >= APART, value: `the accent ${Math.round(g)}° from the key` }; })(),
    (() => { const d = lchOf(formation.map((v) => v * 255))[0] - rl; return { id: 'lifted', ok: d >= LIFT, value: `the formations ${r3(d)} paler than the wall` }; })(),
  ];
  return {
    register: light, light: light01, fixture, glow, shade, crack, formation, accent, made,
    read: { words: `${L ? K.words : 'daylight'}${L && Math.abs(turned) > 2 ? `, turned toward the world's ${K.turn}` : ''}; its shade ${warmth(shade) >= 0 ? 'warm' : 'cool'}; the set's accent ${pick ? `the world's ${pick.k}` : 'the key\'s complement'}`,
      key: Math.round(keyHue), shade: Math.round(shadeHue), accent: Math.round(accentHue) },
    laws,
  };
}

/** The key as the readout a cavern's anchor carries: its colours as #hex and its laws. */
export function keyReadout(K) {
  const hex = (c) => (c ? asHex(c.map((v) => Math.max(0, Math.min(255, Math.round(v * 255))))) : null);
  return { register: K.register, light: hex(K.light), shade: hex(K.shade.map((v) => v / Math.max(...K.shade))), crack: hex(K.crack), formation: hex(K.formation), accent: K.accent, made: K.made, read: K.read, laws: K.laws };
}
