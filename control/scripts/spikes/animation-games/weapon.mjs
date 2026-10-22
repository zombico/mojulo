/**
 * animation-games — WEAPON: a strike with a held weapon, in the four registers. The swing is the hero library's
 * (hero-swing.js: a verb's keys at its item's class, law 8 "the swing follows the mass": a light item drops the coil, a
 * heavy one adds a held load), its keys resolved by the rig's own clip player (`layeredClip`) and played the way that
 * player plays them (each key a smoothstep to the next), so the realistic register IS the rig's clip.
 *
 * The register decides what the weapon's weight looks like and what it hands on:
 *   realistic    the swing as the rig plays it, its length by the item's class (light 0.5 s, normal 0.75, heavy 1.1)
 *   action       the class's difference exaggerated (`spread` 1.6: a heavy blade much slower, a dagger quicker), a heavy
 *                blade CHARGED (held at the cock), a trail behind the blade through the drive, the freeze by the blow
 *   platformer   the class's difference flattened (`spread` 0.3: every weapon one snappy swing), a boop
 *   pinball      the swing at the body's speed, a trail, a ricochet
 *
 * THE PROMISE: at contact the blade's tip is where the swing puts it, in every register. The blade is drawn along the
 * forearm from the wrist (the grip's own angle is left out: hero-gear mounts the real item; this is its line).
 *
 * THE FORCE: the tip's speed into contact times the weapon and the forearm behind it (`effective` kg: the item's mass +
 * 1.5 kg of arm, a two-handed swing 3), so a heavier weapon hands on more though it swings slower. The tip's speed is the
 * body's real swing (`bodySeconds`, the realistic length), whatever the register shows; pinball's ricochet is off the tip.
 *
 *   ITEMS, WEAPON_REGISTERS, swingTake(word, item, R, register) → a take flavor.mjs renders (its own player, point, mass)
 *   bladeOf(take, nodes) → [grip, tip] · trails(take, rendered, nodes) → per frame, whether the blade leaves a trail
 *   swingPhases() → for each class, where the library says the strike is and where its player puts the strike key
 *
 * Pure and deterministic. A spike: nothing registers.
 */
import { swingKeys, SWING_HAND } from '../../../lib/graph/polygonizer/hero-swing.js';
import { layeredClip } from '../../../lib/graph/polygonizer/station-loft-rig.js';
import { FLAVOR_NAMES } from './flavor.mjs';

const r4 = (x) => Math.round(x * 1e4) / 1e4;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

/** the items: their class (hero-swing's law 8), a real mass (kg) and blade length (m), and the realistic swing's seconds */
export const ITEMS = Object.freeze({
  dagger: { cls: 'light', kg: 0.4, blade: 0.3, seconds: 0.5 },
  sword: { cls: 'normal', kg: 1.3, blade: 0.9, seconds: 0.75 },
  greatsword: { cls: 'heavy', kg: 2.8, blade: 1.35, seconds: 1.1 },
});
const ARM = 1.5;   // kg of forearm and hand behind a one-handed swing (two hands: twice)

/** a register's weapon dials: `spread` how much the class's length shows (seconds = the sword's × (the class's ÷ the
 * sword's)^spread), `charge` seconds a class holds at the cock, `trail` metres a frame the tip must sweep to leave one */
export const WEAPON_REGISTERS = Object.freeze({
  realistic: { spread: 1, charge: { light: 0, normal: 0, heavy: 0 }, trail: null },
  action: { spread: 1.6, charge: { light: 0, normal: 0.07, heavy: 0.3 }, trail: 0.12 },
  platformer: { spread: 0.3, charge: { light: 0, normal: 0, heavy: 0 }, trail: null },
  pinball: { spread: 1, charge: { light: 0, normal: 0, heavy: 0 }, trail: 0.08 },
});

// a resolved key, with the rig's string channels set aside (the player puts `support` back)
const strip = ({ support, ...pose }) => pose;
/** the rig's own clip player, as a one-shot over keys at their own times: each key a smoothstep to the next */
function blendPose(a, b, t) { const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = a[k], y = b[k]; if (typeof x === 'string' || typeof y === 'string') o[k] = t < 0.5 ? (x ?? y) : (y ?? x); else if ((x && typeof x === 'object') || (y && typeof y === 'object')) o[k] = blendPose(x || {}, y || {}, t); else o[k] = (x || 0) * (1 - t) + (y || 0) * t; } return o; }
function swingPlayer(keys, seconds) {
  return { seconds, fn: (s) => {
    const u = Math.max(0, Math.min(1, s)); let i = 0; while (i < keys.length - 2 && keys[i + 1].t <= u) i++;
    const a = keys[i], b = keys[i + 1], t0 = (u - a.t) / (b.t - a.t || 1), t = t0 * t0 * (3 - 2 * t0);
    return { ...blendPose(a.pose, b.pose, Math.max(0, Math.min(1, t))), support: 'both' };
  } };
}

/** the blade: from the gripping wrist along the forearm, its length */
export function bladeOf(take, n) {
  const S = take.hand, w = n[`wrist${S}`], e = n[`elbow${S}`], d = sub(w, e), l = len(d) || 1;
  return [w, [w[0] + (d[0] / l) * take.blade, w[1] + (d[1] / l) * take.blade, w[2] + (d[2] / l) * take.blade]];
}

/**
 * A swing as a take for flavor.mjs: the verb at the item's class, its keys the rig's player's (each at its own phase,
 * the loop's return to ready the last), its beats the cock (the wind-up), the STRIKE (contact, the promise), the
 * follow-through; its length the register's for the class; the blade's tip its contact point; the weapon and the arm its
 * striking mass; a heavy weapon's charge its wind-up hold.
 */
export function swingTake(word, item, R, register = 'realistic') {
  const I = ITEMS[item], W = WEAPON_REGISTERS[register]; if (!I) throw new Error(`animation-games: no item '${item}' (have ${Object.keys(ITEMS).join(', ')})`);
  const S = swingKeys(word, I.cls), fn = layeredClip(S.keys, R), N = S.keys.length;
  const keys = [...S.keys.map((_, i) => ({ t: r4(i / N), pose: strip(fn(i / N)) })), { t: 1, pose: strip(fn(0)) }];
  const strike = N - 3, at = (i) => keys[i].t;
  const seconds = r4(ITEMS.sword.seconds * (I.seconds / ITEMS.sword.seconds) ** W.spread);
  const hand = SWING_HAND[word] === 'left' ? 'L' : 'R', twoHands = word === 'cleave';
  const take = {
    kind: 'swing', name: `${word} (${item})`, word, item, cls: I.cls, hand, blade: I.blade, seconds, keys,
    effective: I.kg + ARM * (twoHands ? 2 : 1), windHold: W.charge[I.cls], bodySeconds: I.seconds, ricochetFromPoint: true,
    beats: [{ id: 'ready', at: 0 }, { id: 'load', at: at(strike - 1), role: 'wind' }, { id: 'contact', at: at(strike), role: 'act', promise: true, deals: true },
      { id: 'follow', at: at(strike + 1), role: 'after' }, { id: 'ready', at: 1, role: 'settle' }],
    clip: (ks) => swingPlayer(ks, seconds),
    library: { strike: S.strike, keyAt: at(strike) },
  };
  take.point = (n) => bladeOf(take, n)[1];
  return take;
}

/** per frame, whether the blade leaves a trail: its tip sweeping further than the register's `trail` in that frame */
export function trails(take, register, nodes) {
  const T = WEAPON_REGISTERS[register].trail; if (!T) return nodes.map(() => false);
  return nodes.map((n, i) => i > 0 && len(sub(bladeOf(take, n)[1], bladeOf(take, nodes[i - 1])[1])) > T);
}

/** where the library says each class's strike falls (`swingKeys().strike`) and where its own player puts the strike key */
export function swingPhases() {
  return Object.fromEntries(['light', 'normal', 'heavy'].map((cls) => { const S = swingKeys('chop', cls), N = S.keys.length; return [cls, { says: S.strike, plays: r4((N - 3) / N), window: S.window }]; }));
}
export const REGISTERS = FLAVOR_NAMES;
