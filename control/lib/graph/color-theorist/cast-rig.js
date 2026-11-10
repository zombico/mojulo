/**
 * THE CAST RIG — the one light every body is drawn under (a hero, a fighter, a brawler, a piloted vehicle), as plain
 * data, in both eras. A fight's rig has the shape (versus/versus-arena.client.js fightRig: a key the room shares, a sky
 * over a ground, a rim from behind) and works there because the room is unlit; here it is solved from the world's own
 * light, so a body's material can carry it over paint and over form alike: the KEY is the world's one sun (the cube's
 * solve, era/cube-light.js), the HEMISPHERE is that solve's sky light over what its floor throws back, and the RIM is
 * the horizon behind the figure. Only the key is a light a page owns; the hemisphere and the rim are terms a body's own
 * material adds, so they light nothing else.
 *
 *   castRig(cube, { hour?, register?, palette? }) → { from, register, key, hemi, rim, bands?, tone, reads, why }
 *     cube      a checked geocube (era/geocube.js readGeocube), or null: the card (a greybox, a studio: CAST_CARD, the
 *               fight rig's own numbers)
 *     hour      the hour the level is lit at (the cube's own where absent); the sun does not move within a level
 *     register  'western' (lit as an engine lights it) | 'anime' (cel: the same rig, its tones stepped); a register of
 *               the body, never of the world: an anime world is lit as any other
 *     palette   the body's groups → hex (its albedo), for the separation read; a middle grey where absent
 *   key    { toLight, linear, level, color, gain }   the world's sun (or moon): `linear` and `level` the solve's, shared
 *          with the land; `gain` the body's own lift over it (1 unless the form read asks for more)
 *   hemi   { sky, ground, gain }   linear: a face turned up takes `sky` (the solve's ambient), one turned down `ground`
 *          (the floor's base under the light it stands in), a wall their mean; `gain` the body's own fill (1 unless the
 *          shade side would be a hole). The card's gains are 1: it is written, and lights as the fight rig does
 *   rim    { linear, color, strength, power }   a fresnel edge in the horizon's hue; at strength 1 it is as bright as
 *          the key side. Raised where the figure's shade side sits on the horizon's value
 *   bands  (anime) { steps, ramp }   the cel's tones, the shade side to the light
 *   tone   { curve, exposure, form, paint }   one rule an era: on a form page the renderer's curve tones the body with
 *          the land ('renderer'); on a painted page the body tones itself to the paint's range ('body')
 *   reads  the rig's laws, each { law, ok, …, note }: form (the key side over the shade side, held between FORM and
 *          DEPTH by the two gains), separation (the shade side against the horizon)
 *
 * Units are the solve's: out = base × light. A renderer that divides diffuse by π, as three does, sets its lights to π ×
 * these. Pure: no dice, no clock; the same cube and hour, the same rig, byte for byte. Nothing in a mint or a page reads
 * it yet.
 */
import { cubeLight } from '../era/cube-light.js';
import { CAST_LIGHT } from '../era/cast-light.js';
import { HERO_LIGHT_LAWS } from './hero-light.js';
import { decodeSrgb, encodeSrgb, luminance } from './light.js';

export const CAST_REGISTERS = Object.freeze(['western', 'anime']);
/** The rig's laws (the eyes gate's to move): the key side at least `form` × the shade side and at most `depth` ×; the
 *  body's own key lifted no more than `keyGain` × the world's; the face the key side is read on (its cosine to the key). */
// (`form` is the hero light's own, written here: nothing of another module is read as this one loads)
export const CAST_RIG_LAWS = Object.freeze({ form: 1.6, depth: 6, keyGain: 3, keyCos: 0.8 });
/** The cel's tones (the fight rig's ramp: the shadow side, the turn, the light). */
export const CAST_BANDS = Object.freeze({ steps: 3, ramp: Object.freeze([0.36, 0.65, 1]) });
/** A body with no palette is read as a middle grey. */
const GREY = 0.3;

const r4 = (v) => Math.round(v * 1e4) / 1e4;
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const linOf = (h) => rgbOf(h).map(decodeSrgb);
const hexOf = (lin) => { const m = Math.max(1e-9, ...lin); return '#' + lin.map((v) => Math.round(Math.max(0, Math.min(1, encodeSrgb(v / m))) * 255).toString(16).padStart(2, '0')).join(''); };
const scaled = (c, k) => c.map((v) => v * k);
// (the lightness of a linear luminance: OKLab's L of a grey is its luminance's cube root)
const Lof = (y) => Math.cbrt(Math.max(0, Math.min(1, y)));

/**
 * THE CARD: the rig a body takes where no cube lights it (a greybox, a studio), the fight rig's own lights
 * (versus-arena.client.js fightRig) in the solve's units (three's intensities ÷ π): its key from the camera's side and
 * above, its sky over a dark ground with the low cool fill folded in, a white rim. `toLight` is in the lane's frame.
 * Its rim's strength and power are written here (the baked cast light's own, era/cast-light.js CAST_LIGHT.rim): the card
 * reads no other module as this one loads, so a page's channel can carry it from inside the era's import cycle.
 */
const three = (hex, intensity) => scaled(linOf(hex), intensity / Math.PI);
const plus = (a, b) => a.map((v, k) => v + b[k]);
export const CAST_CARD = Object.freeze({
  western: Object.freeze({ toLight: [-0.35, -0.6, 0.72], key: three('#ffeedb', 3.3), sky: plus(three('#dfe7f2', 0.3), three('#b9ccff', 0.14)), ground: three('#2e2925', 0.3), rim: '#ffffff', strength: 0.45, power: 3 }),
  anime: Object.freeze({ toLight: [-0.35, -0.6, 0.72], key: three('#fff6ea', 2.4), sky: three('#c6d2ff', 0.75), ground: three('#5c5068', 0.75), rim: '#ffffff', strength: 0.35, power: 3 }),
});

function readRegister(register) {
  if (!CAST_REGISTERS.includes(register)) throw new Error(`cast rig: register is ${CAST_REGISTERS.join(' | ')} (the body's look under the one light: lit as an engine lights it, or cel; got '${register}')`);
  return register;
}

export function castRig(cube, { hour, register = 'western', palette = null } = {}) {
  readRegister(register);
  const LAW = CAST_RIG_LAWS, why = [];
  let toLight, sun, sky, ground, horizon, strength, power, from;
  if (cube) {
    const L = cubeLight(cube, hour === undefined ? {} : { hour });
    toLight = L.sun.dir; sun = L.sun.linear; sky = L.ambient.linear;
    // the floor's bounce: its base under the light it stands in (the sky's, and the sun by how high it stands)
    const floor = L.linearBases.floor ?? L.linearBases.grass ?? [GREY, GREY, GREY];
    ground = floor.map((b, k) => b * (sky[k] + sun[k] * Math.max(0, toLight[2])));
    horizon = L.sky.horizon.map((v) => decodeSrgb(v / 255));
    strength = cube.light.rim?.strength ?? CAST_LIGHT.rim.strength; power = cube.light.rim?.power ?? CAST_LIGHT.rim.power;
    from = { geocube: cube.id ?? null, hour: L.hour };
    why.push(`The key is the world's own ${L.sun.elevation > 0 ? 'light' : 'key'} at ${L.hour} h, the solve the land is lit by; the sky's light over the floor's bounce fills it; the horizon rims it.`);
  } else {
    const K = CAST_CARD[register];
    toLight = K.toLight; sun = K.key; sky = K.sky; ground = K.ground; horizon = linOf(K.rim); strength = K.strength; power = K.power;
    from = { card: register };
    why.push('No cube lights it: the fight rig\'s own card, a key from the camera\'s side and above, a sky over a dark ground, a white rim.');
  }
  const yS = luminance(sun), yA = luminance(sky), yG = luminance(ground), reads = [];

  // FORM: the key side (a face three quarters to the key) over the shade side (a wall: the hemisphere's mean), held
  // between the laws by the body's own gains. A fight draws its bodies under a key and a fill of their own; so does this
  const wall = (yA + yG) / 2, ratioAt = (kg, hg) => (wall * hg + LAW.keyCos * yS * kg) / Math.max(1e-9, wall * hg);
  let keyGain = 1, hemiGain = 1;
  const raw = ratioAt(1, 1);
  // (the card is written, not solved: it lights a body as the fight rig always has, its deep shade its own; only read)
  if (cube && raw < LAW.form) keyGain = Math.min(LAW.keyGain, ((LAW.form - 1) * wall) / Math.max(1e-9, LAW.keyCos * yS));
  else if (cube && raw > LAW.depth) hemiGain = (LAW.keyCos * yS) / Math.max(1e-9, (LAW.depth - 1) * wall);
  const ratio = ratioAt(keyGain, hemiGain), formOk = ratio >= LAW.form - 1e-6 && ratio <= LAW.depth + 1e-6;
  reads.push({ law: 'form', ok: formOk, ratio: r4(ratio), world: r4(raw), want: [LAW.form, LAW.depth],
    note: !cube && !formOk ? `the card's own: the key side ${r4(ratio)}× the shade side, its shade kept deep as a fight's is`
      : keyGain > 1 ? `the world's light turns a body only ${r4(raw)}× (a sky-lit level): the body's own key raised ${r4(keyGain)}×${formOk ? '' : `, its most, for ${r4(ratio)}× (want ${LAW.form}×)`}`
      : hemiGain > 1 ? `the world's light leaves the shade side a hole (${r4(raw)}×): the body's own fill raised ${r4(hemiGain)}×, the key side ${LAW.depth}× the shade` : `the key side is ${r4(ratio)}× the shade side: the form turns` });

  // SEPARATION: the figure's shade side against the horizon behind it; too close, and the rim carries the outline
  const albedo = palette ? (() => { const a = Object.values(palette).filter((h) => typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h)).map((h) => luminance(linOf(h))); return a.length ? a.reduce((s, v) => s + v, 0) / a.length : GREY; })() : GREY;
  const gap = Math.abs(Lof(albedo * wall * hemiGain) - Lof(luminance(horizon))), sepOk = gap >= HERO_LIGHT_LAWS.separation;
  if (!sepOk) strength = Math.min(1, strength + HERO_LIGHT_LAWS.rimLift);
  reads.push({ law: 'separation', ok: sepOk, gap: r4(gap), want: HERO_LIGHT_LAWS.separation,
    note: sepOk ? `the shade side stands ${r4(gap)} L off the horizon: the rim is an accent` : `the shade side is ${r4(gap)} L off the horizon (want ${HERO_LIGHT_LAWS.separation}): the rim carries the outline, raised to ${r4(strength)}` });

  // the rim: the horizon's hue, as bright as the key side at strength 1
  const lit = wall * hemiGain + LAW.keyCos * yS * keyGain, rimLin = scaled(horizon, lit / Math.max(1e-9, luminance(horizon)));
  if (register === 'anime') why.push('Cel: the same rig, its tones stepped and its rim in bands; the world is lit as any other.');
  return {
    from, register,
    key: { toLight: toLight.map(r4), linear: sun.map(r4), level: r4(yS), color: hexOf(sun), gain: r4(keyGain) },
    hemi: { sky: sky.map(r4), ground: ground.map(r4), gain: r4(hemiGain) },
    rim: { linear: rimLin.map(r4), color: hexOf(horizon), strength: r4(strength), power },
    ...(register === 'anime' ? { bands: { steps: CAST_BANDS.steps, ramp: [...CAST_BANDS.ramp] } } : {}),
    tone: { curve: 'neutral', exposure: 1, form: 'renderer', paint: 'body' },
    reads, why,
  };
}
