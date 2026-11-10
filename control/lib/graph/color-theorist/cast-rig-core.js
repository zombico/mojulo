/**
 * THE CAST RIG'S CORE — the rig's laws, its card and its making, with the solve passed in. This module reads none of
 * the era's (only the theorist's pure light math), so a page's channel can carry the card from inside the era's import
 * cycle. `castRig` (cast-rig.js) is this with the cube's light solve (era/cube-light.js); what a rig is, is written there.
 *
 *   castRigOf(cube, { hour?, register?, palette? }, solve)   the rig: `solve(cube, { hour })` the cube's light where
 *     there is a cube; with none, the card, and no solve asked for
 *   castCard(register, { palette? })   the card as a rig
 *   CAST_REGISTERS, CAST_RIG_LAWS, CAST_BANDS, CAST_CARD
 */
import { decodeSrgb, encodeSrgb, luminance } from './light.js';

export const CAST_REGISTERS = Object.freeze(['western', 'anime']);
/** The rig's laws (the eyes gate's to move): the key side at least `form` × the shade side and at most `depth` ×; the
 *  body's own key lifted no more than `keyGain` × the world's; the face the key side is read on (its cosine to the key). */
// (`form`, `separation` and `rimLift` are the hero light's own, HERO_LIGHT_LAWS, and `rim` the baked cast light's,
// CAST_LIGHT.rim, written here: this module reads no other of the era's, so a page's channel can carry the card from
// inside the era's import cycle; cast-rig.test.js holds them to the ones they stand for)
export const CAST_RIG_LAWS = Object.freeze({ form: 1.6, depth: 6, keyGain: 3, keyCos: 0.8, separation: 0.12, rimLift: 0.25, rim: Object.freeze({ strength: 0.45, power: 3 }) });
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

export function castRigOf(cube, { hour, register = 'western', palette = null } = {}, solve = null) {
  readRegister(register);
  const LAW = CAST_RIG_LAWS, why = [];
  let toLight, sun, sky, ground, horizon, strength, power, from;
  if (cube) {
    if (typeof solve !== 'function') throw new Error('cast rig: a cube\'s rig is solved by its light (castRig, cast-rig.js); the core alone gives the card');
    const L = solve(cube, hour === undefined ? {} : { hour });
    toLight = L.sun.dir; sun = L.sun.linear; sky = L.ambient.linear;
    // the floor's bounce: its base under the light it stands in (the sky's, and the sun by how high it stands)
    const floor = L.linearBases.floor ?? L.linearBases.grass ?? [GREY, GREY, GREY];
    ground = floor.map((b, k) => b * (sky[k] + sun[k] * Math.max(0, toLight[2])));
    horizon = L.sky.horizon.map((v) => decodeSrgb(v / 255));
    strength = cube.light.rim?.strength ?? LAW.rim.strength; power = cube.light.rim?.power ?? LAW.rim.power;
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
  const gap = Math.abs(Lof(albedo * wall * hemiGain) - Lof(luminance(horizon))), sepOk = gap >= LAW.separation;
  if (!sepOk) strength = Math.min(1, strength + LAW.rimLift);
  reads.push({ law: 'separation', ok: sepOk, gap: r4(gap), want: LAW.separation,
    note: sepOk ? `the shade side stands ${r4(gap)} L off the horizon: the rim is an accent` : `the shade side is ${r4(gap)} L off the horizon (want ${LAW.separation}): the rim carries the outline, raised to ${r4(strength)}` });

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

/** The card as a rig: the fight rig's own, in a register (no cube, nothing solved). */
export const castCard = (register = 'western', { palette = null } = {}) => castRigOf(null, { register, palette });
