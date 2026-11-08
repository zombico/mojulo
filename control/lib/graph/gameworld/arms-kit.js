// gameworld/arms-kit — a shooter's CARRIED ARMS: the guns (and the bow) a player holds in a first-person or an arena
// shooter, by the words a person says (`rifle`, `sniper`, `handgun`, `bow` …) or an arm's own build words, each lowered
// onto the controllable world's weapon row (worlds/controllable/combat-ranged.js initWeapon) and the gunplay its slot
// carries (worlds/controllable/gunplay.js and the page's gunplay block):
//
//   AIM DOWN THE SIGHTS  the sight brought to the eye over the arm's own `aimTime` (arms/handling.js): the view closes
//                        to its sight's power (an open sight a little, a scope its 4× or 8×), the cone tightens, the feet
//                        slow; moving and strafing still fire, wider on the move
//   SWAY                 the held muzzle's wander (the arm's milliradians), larger from the hip and on the move; with a
//                        scope, the breath held (Shift) steadies it for a few seconds before the body wants air
//   SWITCHING            the outgoing arm stowed over its `swapOut`, the incoming drawn over its `swapIn` (the slot's
//                        switch ready-time is their sum: nothing fires until the new one is up)
//   RELOAD               R, on any partly spent magazine (the old way, empty, still reloads by itself)
//   THE BOW              the string drawn while the button is held (its `draw` seconds to full), the arrow loosed on
//                        release: faster and harder the further it was drawn, and falling as it flies
// The numbers are a game's, by the arm's archetype (an assault rifle's automatic fire, a sniper's bolt, a shotgun's
// pellets thinning with range), scaled to the goal's own base round (a shoot level's foe takes four, a pole's damage
// its time to kill) so a kit fits the game it is carried in. Pure data and arithmetic; no dice.
import { armHandling, armBoxes } from '../equipment/arms/handling.js';
import { ARM_MODELS } from '../equipment/arms/models.js';

const r2 = (v) => Math.round(v * 100) / 100 + 0, r3 = (v) => Math.round(v * 1000) / 1000 + 0;

/**
 * THE KIT'S WORDS: each an arm of the arms kernel (its build) and the archetype its numbers follow; `bow` the bow.
 * Archetype numbers: `dmg` a multiple of the goal's base round, `rof` (automatic, rounds a second) or `cooldown`
 * (seconds between pulls), the magazine, the reserve, the reload, the cone (degrees: hip, on the move, its bloom), the
 * climb a round, the range, a head's multiple, damage falling off with range.
 */
export const ARMS_KIT = Object.freeze({
  rifle: { arm: { item: 'rifle', model: 'assault' }, as: 'auto' },
  carbine: { arm: { item: 'carbine', model: 'assault' }, as: 'auto' },
  bullpup: { arm: { item: 'rifle', model: 'bullpup' }, as: 'auto' },
  smg: { arm: { item: 'smg', model: 'compact' }, as: 'spray' },
  pdw: { arm: { item: 'smg', model: 'pdw' }, as: 'spray' },
  shotgun: { arm: { item: 'shotgun', model: 'pump' }, as: 'pump' },
  breacher: { arm: { item: 'shotgun', model: 'breacher' }, as: 'pump' },
  marksman: { arm: { item: 'rifle', model: 'marksman' }, as: 'marksman' },
  sniper: { arm: { item: 'rifle', model: 'sniper' }, as: 'bolt' },
  coilgun: { arm: { item: 'rifle', model: 'coilgun' }, as: 'marksman' },
  caseless: { arm: { item: 'rifle', model: 'caseless' }, as: 'auto' },
  handgun: { arm: { item: 'pistol', model: 'service' }, as: 'sidearm' },
  revolver: { arm: { item: 'pistol', model: 'revolver' }, as: 'magnum' },
  bow: { bow: true, as: 'bow' },
});
export const ARMS_KIT_WORDS = Object.freeze(Object.keys(ARMS_KIT));
/** the carried slots' limit (the page's keys 1–5) */
export const ARMS_MAX = 5;

// (an automatic's bloom and climb `wait` for the trigger to rest before they settle, so a held spray builds at its own
// rate of fire; `blow` the joules a round carries, about its cartridge's at the muzzle, what it marks a wall with or
// breaks it by (rupa.js); `pellets` the shot a shell parts into)
const ARCHETYPES = Object.freeze({
  auto: { auto: true, rof: 9, dmg: 0.5, magazine: 30, reserve: 90, reload: 2.4, range: 70, blow: 1750, spread: { base: 0.6, move: 3, bloom: 0.45, recover: 5, max: 4, wait: 0.15 }, recoil: { kick: 0.45, recover: 4, max: 4, wait: 0.15 } },
  spray: { auto: true, rof: 13, dmg: 0.33, magazine: 30, reserve: 120, reload: 2, range: 35, blow: 550, spread: { base: 0.9, move: 2.2, bloom: 0.35, recover: 6, max: 5, wait: 0.15 }, recoil: { kick: 0.3, recover: 5, max: 3, wait: 0.15 }, falloff: { from: 15, to: 35, min: 0.5 } },
  pump: { cooldown: 0.9, dmg: 2.5, magazine: 6, reserve: 24, reload: 3.2, range: 25, coreAngle: 4, blow: 3200, pellets: 9, spread: { base: 2.2, move: 1.5, bloom: 0, recover: 6, max: 4 }, recoil: { kick: 4, recover: 5, max: 6 }, falloff: { from: 6, to: 18, min: 0.2 } },
  marksman: { cooldown: 0.45, dmg: 1.6, magazine: 10, reserve: 40, reload: 2.6, range: 120, headshot: 2, blow: 3300, spread: { base: 1.6, move: 5, bloom: 1, recover: 4, max: 6 }, recoil: { kick: 1.2, recover: 3, max: 4 } },
  bolt: { cooldown: 1.3, dmg: 4, magazine: 5, reserve: 20, reload: 3.2, range: 200, headshot: 2, coreAngle: 0.6, blow: 6000, spread: { base: 4, move: 6, bloom: 0, recover: 4, max: 8 }, recoil: { kick: 3, recover: 2.5, max: 4 } },
  sidearm: { cooldown: 0.25, dmg: 0.75, magazine: 15, reserve: 45, reload: 1.6, range: 40, blow: 500, spread: { base: 0.8, move: 1.8, bloom: 0.8, recover: 5, max: 4 }, recoil: { kick: 1, recover: 5, max: 3 } },
  magnum: { cooldown: 0.5, dmg: 1.4, magazine: 6, reserve: 24, reload: 2.8, range: 50, headshot: 2, blow: 750, spread: { base: 0.8, move: 2.2, bloom: 1.4, recover: 4, max: 5 }, recoil: { kick: 2.4, recover: 4, max: 5 } },
});
/** how much aiming down the sights takes of the hip's cone, its slowing of the feet, and its share of the move's cone */
export const ADS = Object.freeze({ spread: 0.35, move: 0.55, moveSpread: 0.5, scopedSpread: 0.02 });
/** the view's power at the eye for an open sight (irons, a red dot, a holographic sight): a game's closing-in */
const OPEN_ZOOM = 1.3;
/** the bow: the draw (s to full), the arrow's speed and damage from a twitch to full (m/s; multiples of the base round),
 * one arrow on the string and the nock's time for the next, the arrow's fall (m/s²), its quiver */
export const BOW = Object.freeze({ draw: 0.9, speed: [22, 68], dmg: [0.6, 3.5], nock: 0.55, gravity: 9.8, quiver: 30, aimTime: 0.24, swapOut: 0.3, swapIn: 0.45, sway: 2.6, zoom: 1.25, length: 1.5 });

/** Why a kit is invalid (sentences naming the choices); empty when valid. */
export function validateArmsKit(arms) {
  if (!Array.isArray(arms) || !arms.length || arms.length > ARMS_MAX) return [`arms: 1 to ${ARMS_MAX} of ${ARMS_KIT_WORDS.join(', ')} (or an arm's build words { item, model?, line?, parts? }), one a slot`];
  const errs = [];
  arms.forEach((a, i) => {
    if (typeof a === 'string') { if (!ARMS_KIT[a]) errs.push(`arms[${i}]: '${a}' is not a word of the kit (${ARMS_KIT_WORDS.join(', ')})`); return; }
    if (!a || typeof a !== 'object' || Array.isArray(a)) { errs.push(`arms[${i}]: a word or an arm's build words`); return; }
    if (!ARM_MODELS[a.item] || a.item === 'knife') { errs.push(`arms[${i}].item: a gun of the arms kernel (${Object.keys(ARM_MODELS).filter((k) => k !== 'knife').join(', ')})`); return; }
    if (a.model !== undefined && !ARM_MODELS[a.item].models[a.model]) errs.push(`arms[${i}].model: '${a.model}' is not a ${a.item} model (${Object.keys(ARM_MODELS[a.item].models).join(', ')})`);
  });
  return errs;
}

/** an arm's archetype when it is named by its build words: its item and its sight say */
function archetypeOf(arm, h) {
  if (arm.item === 'pistol') return arm.model === 'revolver' ? 'magnum' : 'sidearm';
  if (arm.item === 'shotgun') return 'pump';
  if (arm.item === 'smg') return 'spray';
  return h.stations.sight.zoom >= 6 ? 'bolt' : h.stations.sight.zoom >= 3 ? 'marksman' : 'auto';
}

/**
 * One slot of a kit on a base round (`base`: the goal's weapon row, whose `damage` and `coreAngle` a kit scales to;
 * `eye`, `hand`, `converge`: where its rounds leave from, as the goal's own gun). → a loadout slot { name, weapon,
 * switchReady, gunplay } (the platform rule's loadout, maneuvers.js; `gunplay` is the slot's own: the sights, the
 * sway, the switch's two halves, the bow's draw, and the viewmodel's shape).
 */
export function kitSlot(word, base, { eye = 0, hand = null, converge = false } = {}) {
  const K = typeof word === 'string' ? ARMS_KIT[word] : { arm: word };
  const name = typeof word === 'string' ? word : `${word.item}${word.model ? ` ${word.model}` : ''}`;
  const where = { eye, ...(hand ? { hand } : {}), ...(converge ? { converge: true } : {}) };
  const dmg0 = base.damage ?? 1;
  if (K.bow) {
    const weapon = { fireClass: 'lob', auto: false, chargeTime: BOW.draw, magazine: 1, reserve: BOW.quiver, reload: BOW.nock, cooldown: 0.05, damage: r3(BOW.dmg[0] * dmg0), chargedDamage: r3(BOW.dmg[1] * dmg0), impact: 1,
      projectileSpeed: BOW.speed[0], projectileGravity: BOW.gravity, lobAngle: 0, splashRadius: 0, projRadius: 0.15, armTime: 0.02, fuse: 6, smokeTrail: false, fxScale: 0.25, range: 120, coreAngle: base.coreAngle ?? 1.5, ...where };
    return { name, weapon, switchReady: r2(BOW.swapOut + BOW.swapIn), gunplay: {
      kind: 'bow', ads: { zoom: BOW.zoom, time: BOW.aimTime, spread: 1, move: ADS.move, moveSpread: 1 }, sway: BOW.sway, swap: { out: BOW.swapOut, in: BOW.swapIn },
      draw: { speed: BOW.speed, damage: [r3(BOW.dmg[0] * dmg0), r3(BOW.dmg[1] * dmg0)] }, view: { kind: 'bow', length: BOW.length } } };
  }
  const arm = K.arm, h = armHandling(arm), A = ARCHETYPES[K.as ?? archetypeOf(arm, h)], st = h.stations, hd = h.handling;
  const scope = st.sight.zoom >= 3;
  const weapon = { fireClass: 'sight', auto: !!A.auto, ...(A.auto ? { rof: A.rof } : { cooldown: A.cooldown }), magazine: A.magazine, reserve: A.reserve, reload: A.reload, damage: r3(A.dmg * dmg0), impact: 1,
    range: A.range, coreAngle: A.coreAngle ?? base.coreAngle ?? 1.5, ...(A.headshot ? { headshot: A.headshot } : {}), spread: { ...A.spread }, recoil: { ...A.recoil, kick: r2(A.recoil.kick * (hd.recoil / 2)) }, ...(A.falloff ? { falloff: { ...A.falloff } } : {}),
    ...(A.blow ? { blow: A.blow } : {}), ...(A.pellets ? { pellets: A.pellets } : {}), ...where };
  // the viewmodel: the arm as its parts' boxes (cm), the fist's place, the sight line and the eye's relief
  const view = { kind: h.class === 'handgun' ? 'handgun' : 'long', boxes: armBoxes(arm).map(([lo, hi, c, part]) => [lo.map((v) => r2(v)), hi.map((v) => r2(v)), c, part]),
    grip: st.strong.at.map(r2), sight: { y: st.sight.y, rear: st.sight.rear, front: st.sight.front }, ...(st.sight.relief ? { relief: st.sight.relief } : {}), muzzle: st.muzzle.at[2], ...(st.magazine ? { mag: st.magazine.at.map(r2) } : {}) };
  return { name, weapon, switchReady: r2(hd.swapOut + hd.swapIn), gunplay: {
    kind: view.kind, arm, ads: { zoom: scope ? st.sight.zoom : st.sight.zoom > 1 ? st.sight.zoom : OPEN_ZOOM, time: hd.aimTime, spread: scope ? ADS.scopedSpread : ADS.spread, move: ADS.move, moveSpread: ADS.moveSpread, ...(scope ? { scope: true } : {}) },
    sway: hd.sway, swap: { out: hd.swapOut, in: hd.swapIn }, view } };
}

/** A kit's loadout on a base round: its slots in order (kitSlot). */
export const armsLoadout = (arms, base, where = {}) => arms.map((w) => kitSlot(w, base, where));
/** A kit's legend (the keys it adds). */
export const ARMS_LEGEND = 'click  fire · right click  aim · Shift  steady (scoped) · R  reload · 1-5 or wheel  switch';
