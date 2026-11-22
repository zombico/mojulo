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
//   A HAND GRENADE       thrown (frag, stun, chaff: worlds/controllable/throw.js): the press starts the throw and the round
//                        leaves the hand at its release, on the arc through the crosshair as a launcher's does
//   A LAUNCHER           its round travels (worlds/controllable/combat-ranged.js the lob): over the shoulder it is
//                        launched on the arc that passes the point under the crosshair, and bursts where it lands, all
//                        inside its reach dealt whole
// The numbers are a game's, by the arm's archetype (an assault rifle's automatic fire, a sniper's bolt, a shotgun's
// pellets thinning with range), scaled to the goal's own base round (a shoot level's foe takes four, a pole's damage
// its time to kill) so a kit fits the game it is carried in. Pure data and arithmetic; no dice.
import { armHandling, armBoxes, armMesh } from '../equipment/arms/handling.js';
import { ARM_MODELS } from '../equipment/arms/models.js';
import { roundOf } from './rounds.js';

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
  // (the SLEEP DART GUN: a service pistol firing one dart a load, quiet; its dart stuns, never hurts: worlds/controllable/knockout.js)
  dart: { arm: { item: 'pistol', model: 'service' }, as: 'dart', name: 'dart gun' },
  // (a 40 mm revolving GRENADE LAUNCHER: a round lobbed on an arc that bursts where it lands)
  launcher: { arm: { item: 'launcher', model: 'grenade' }, as: 'grenade', name: 'grenade launcher' },
  // (a ROCKET LAUNCHER, a bazooka: one rocket a load, flying flat and fast enough to lead, a bigger burst)
  bazooka: { arm: { item: 'launcher', model: 'rocket' }, as: 'rocket' },
  // (the HAND GRENADES, thrown (worlds/controllable/throw.js), quietly (no shot is heard): the same throw, three bursts. A FRAG's shrapnel hurts all round
  // it; a STUN's flash knocks out whoever sees it go off; a CHAFF's cloud of foil jams the radios and the radar round it)
  frag: { thrown: 'frag', as: 'thrown', name: 'frag grenade' },
  stun: { thrown: 'stun', as: 'thrown', name: 'stun grenade' },
  chaff: { thrown: 'chaff', as: 'thrown', name: 'chaff grenade' },
  bow: { bow: true, as: 'bow' },
  // (a LAND MINE, laid at the feet and left (worlds/controllable/mines.js): armed after a moment, it goes off under the next
  // body of another team over it, or under a vehicle's track (a vehicle boss: lib/graph/boss/vehicles.js))
  mine: { placed: 'mine', as: 'placed', name: 'land mine' },
});
export const ARMS_KIT_WORDS = Object.freeze(Object.keys(ARMS_KIT));
/** the carried slots' limit (the page's keys 1–5) */
export const ARMS_MAX = 5;

// (an automatic's bloom and climb `wait` for the trigger to rest before they settle, so a held spray builds at its own
// rate of fire; `blow` the joules a round carries, about its cartridge's at the muzzle, what it marks a wall with or
// breaks it by (rupa.js); `pellets` the shot a shell parts into)
// each archetype's round (gameworld/rounds.js): what the page draws of it going off
const ROUND_OF = Object.freeze({ auto: 'rifle', spray: 'smg', pump: 'shotgun', marksman: 'marksman', bolt: 'sniper', sidearm: 'pistol', magnum: 'magnum', dart: 'pistol', grenade: 'grenade', rocket: 'rocket' });
const ARCHETYPES = Object.freeze({
  auto: { auto: true, rof: 9, dmg: 0.5, magazine: 30, reserve: 90, reload: 2.4, range: 70, blow: 1750, spread: { base: 0.6, move: 3, bloom: 0.45, recover: 5, max: 4, wait: 0.15 }, recoil: { kick: 0.45, recover: 4, max: 4, wait: 0.15 } },
  spray: { auto: true, rof: 13, dmg: 0.33, magazine: 30, reserve: 120, reload: 2, range: 35, blow: 550, spread: { base: 0.9, move: 2.2, bloom: 0.35, recover: 6, max: 5, wait: 0.15 }, recoil: { kick: 0.3, recover: 5, max: 3, wait: 0.15 }, falloff: { from: 15, to: 35, min: 0.5 } },
  pump: { cooldown: 0.9, dmg: 2.5, magazine: 6, reserve: 24, reload: 3.2, range: 25, coreAngle: 4, blow: 3200, pellets: 9, spread: { base: 2.2, move: 1.5, bloom: 0, recover: 6, max: 4 }, recoil: { kick: 4, recover: 5, max: 6 }, falloff: { from: 6, to: 18, min: 0.2 } },
  marksman: { cooldown: 0.45, dmg: 1.6, magazine: 10, reserve: 40, reload: 2.6, range: 120, headshot: 2, blow: 3300, spread: { base: 1.6, move: 5, bloom: 1, recover: 4, max: 6 }, recoil: { kick: 1.2, recover: 3, max: 4 } },
  // (a bolt's climb settles inside its cycle, its most in a second, so the scope is back on the mark as the next round is
  // chambered)
  bolt: { cooldown: 1.3, dmg: 4, magazine: 5, reserve: 20, reload: 3.2, range: 200, headshot: 2, coreAngle: 0.6, blow: 6000, spread: { base: 4, move: 6, bloom: 0, recover: 4, max: 8 }, recoil: { kick: 3, recover: 4, max: 4 } },
  sidearm: { cooldown: 0.25, dmg: 0.75, magazine: 15, reserve: 45, reload: 1.6, range: 40, blow: 500, spread: { base: 0.8, move: 1.8, bloom: 0.8, recover: 5, max: 4 }, recoil: { kick: 1, recover: 5, max: 3 } },
  // (a dart: one a load and a slow reload, its `dmg` the stun it carries (four base rounds: a body's whole most), twice in
  // the head; `drowse` the seconds its sleep takes to come on, quiet, `stun`: knockout.js gives back what it hurt)
  dart: { cooldown: 0.6, dmg: 4, magazine: 1, reserve: 15, reload: 1.4, range: 45, headshot: 2, blow: 60, stun: true, quiet: true, drowse: 3, spread: { base: 0.6, move: 1.6, bloom: 0, recover: 5, max: 3 }, recoil: { kick: 0.5, recover: 5, max: 2 } },
  // (a LAUNCHER's round travels: `lob` its flight, `speed` (m/s) and `gravity` (m/s²), `splash` its burst's reach (m),
  // `dmg` dealt whole inside it; a 40 mm grenade a little over half its real speed, so its arc is seen and its reach a yard's)
  // (a rocket flies straight, without gravity, a little slower than a grenade launched so it is seen and can be led; one
  // a load, its tube reloaded in three seconds)
  rocket: { lob: { speed: 38, gravity: 0, splash: 4, projRadius: 0.08, armTime: 0.08, fuse: 5 }, cooldown: 0.4, dmg: 6, magazine: 1, reserve: 4, reload: 3, range: 180, spread: { base: 0.5, move: 2.5, bloom: 0, recover: 4, max: 3 }, recoil: { kick: 1, recover: 3, max: 4 } },
  grenade: { lob: { speed: 45, gravity: 9.8, splash: 3, projRadius: 0.05, armTime: 0.05, fuse: 6 }, cooldown: 0.65, dmg: 4, magazine: 6, reserve: 12, reload: 4.2, range: 150, spread: { base: 0.6, move: 2, bloom: 0, recover: 4, max: 3 }, recoil: { kick: 1, recover: 4, max: 5 } },
  magnum: { cooldown: 0.5, dmg: 1.4, magazine: 6, reserve: 24, reload: 2.8, range: 50, headshot: 2, blow: 750, spread: { base: 0.8, move: 2.2, bloom: 1.4, recover: 4, max: 5 }, recoil: { kick: 2.4, recover: 4, max: 5 } },
});
/** how much aiming down the sights takes of the hip's cone, its slowing of the feet, its share of the move's cone, and its
 * share of a held trigger's bloom (a round's and its most) */
export const ADS = Object.freeze({ spread: 0.35, move: 0.55, moveSpread: 0.5, scopedSpread: 0.02, bloom: 0.5 });
/** the view's power at the eye for an open sight (irons, a red dot, a holographic sight): a game's closing-in */
const OPEN_ZOOM = 1.3;
/**
 * THE HAND GRENADES: thrown at `speed` (m/s) under `gravity`, three to a slot (one in hand, two more), the next in hand
 * in `reload` s. Each its burst: `splash` (m) its reach, `dmg` (base rounds) what a frag deals inside it whole, `jam` a
 * chaff's cloud ({ r: m, for: s }). The throw: `dur` (s, press to follow-through) and its `release` (a share of it),
 * where a hero's overhand lets go (hero-throw.js).
 */
export const GRENADES = Object.freeze({
  frag: Object.freeze({ splash: 4, dmg: 4 }),
  stun: Object.freeze({ splash: 6, dmg: 0 }),
  chaff: Object.freeze({ splash: 0, dmg: 0, jam: Object.freeze({ r: 15, for: 15 }) }),
});
/** THE LAND MINE: armed `arm` seconds after it is laid, tripped by a body within `trip` metres (a vehicle by its
 *  footprint), its burst `splash` metres, `dmg` times the base round; one laid at a time, `reserve` more */
export const MINE = Object.freeze({ arm: 1.5, trip: 1.4, splash: 3.5, dmg: 8, reserve: 3, reload: 0.8, cooldown: 0.5 });
export const THROWN = Object.freeze({ speed: 16, gravity: 9.8, magazine: 1, reserve: 2, reload: 0.6, cooldown: 0.2, dur: 1.0, release: 0.5, aimTime: 0.2, swapOut: 0.2, swapIn: 0.35 });
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
  if (arm.item === 'launcher') return arm.model === 'rocket' ? 'rocket' : 'grenade';
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
  const name = typeof word === 'string' ? (K.name ?? word) : `${word.item}${word.model ? ` ${word.model}` : ''}`;
  const where = { eye, ...(hand ? { hand } : {}), ...(converge ? { converge: true } : {}) };
  const dmg0 = base.damage ?? 1;
  if (K.thrown) {
    // a hand grenade (THROWN, GRENADES): a lob thrown, not fired; nothing drawn in the hand till it is thrown (the throw's
    // clip carries its own grenade)
    const G = GRENADES[K.thrown];
    const weapon = { fireClass: 'lob', auto: false, cooldown: THROWN.cooldown, magazine: THROWN.magazine, reserve: THROWN.reserve, reload: THROWN.reload, damage: r3(G.dmg * dmg0), impact: G.dmg > 0 ? 1 : 0,
      range: 60, coreAngle: base.coreAngle ?? 1.5, spread: { base: 1, move: 2, bloom: 0, recover: 4, max: 3 }, projectileSpeed: THROWN.speed, projectileGravity: THROWN.gravity, lobAngle: 0, splashRadius: G.splash, projRadius: 0.05,
      armTime: 0.1, fuse: 6, smokeTrail: false, fxScale: 0.2, round: roundOf(K.thrown), effect: K.thrown, ...(G.jam ? { jam: { ...G.jam } } : {}), quiet: true, throw: { dur: THROWN.dur, release: THROWN.release }, ...where };
    return { name, weapon, switchReady: r2(THROWN.swapOut + THROWN.swapIn), gunplay: {
      kind: 'throw', ads: { zoom: 1.1, time: THROWN.aimTime, spread: 1, move: 0.8, moveSpread: 1 }, sway: 0, swap: { out: THROWN.swapOut, in: THROWN.swapIn }, view: { kind: 'throw' } } };
  }
  if (K.placed) {
    // a land mine (MINE): laid, never fired (mines.js takes the trigger); its slot a magazine of one, a few in reserve
    const weapon = { fireClass: 'lob', auto: false, cooldown: MINE.cooldown, magazine: 1, reserve: MINE.reserve, reload: MINE.reload, damage: 0, impact: 0,
      range: 2, coreAngle: base.coreAngle ?? 1.5, spread: { base: 1, move: 2, bloom: 0, recover: 4, max: 3 }, projectileSpeed: 0, projectileGravity: 9.8, lobAngle: 0, splashRadius: 0, projRadius: 0.05,
      armTime: 0.1, fuse: 6, smokeTrail: false, fxScale: 0.2, quiet: true, place: { arm: MINE.arm, trip: MINE.trip, splash: MINE.splash, dmg: r3(MINE.dmg * dmg0) }, ...where };
    return { name, weapon, switchReady: r2(THROWN.swapOut + THROWN.swapIn), gunplay: {
      kind: 'throw', ads: { zoom: 1, time: 0.1, spread: 1, move: 1, moveSpread: 1 }, sway: 0, swap: { out: THROWN.swapOut, in: THROWN.swapIn }, view: { kind: 'throw' } } };
  }
  if (K.bow) {
    const weapon = { fireClass: 'lob', auto: false, chargeTime: BOW.draw, magazine: 1, reserve: BOW.quiver, reload: BOW.nock, cooldown: 0.05, damage: r3(BOW.dmg[0] * dmg0), chargedDamage: r3(BOW.dmg[1] * dmg0), impact: 1,
      projectileSpeed: BOW.speed[0], projectileGravity: BOW.gravity, lobAngle: 0, splashRadius: 0, projRadius: 0.15, armTime: 0.02, fuse: 6, smokeTrail: false, fxScale: 0.25, range: 120, coreAngle: base.coreAngle ?? 1.5, ...where };
    return { name, weapon, switchReady: r2(BOW.swapOut + BOW.swapIn), gunplay: {
      kind: 'bow', ads: { zoom: BOW.zoom, time: BOW.aimTime, spread: 1, move: ADS.move, moveSpread: 1 }, sway: BOW.sway, swap: { out: BOW.swapOut, in: BOW.swapIn },
      draw: { speed: BOW.speed, damage: [r3(BOW.dmg[0] * dmg0), r3(BOW.dmg[1] * dmg0)] }, view: { kind: 'bow', length: BOW.length } } };
  }
  const arm = K.arm, h = armHandling(arm), as = K.as ?? archetypeOf(arm, h), A = ARCHETYPES[as], st = h.stations, hd = h.handling;
  const scope = st.sight.zoom >= 3;
  const weapon = { fireClass: A.lob ? 'lob' : 'sight', auto: !!A.auto, ...(A.auto ? { rof: A.rof } : { cooldown: A.cooldown }), magazine: A.magazine, reserve: A.reserve, reload: A.reload, damage: r3(A.dmg * dmg0), impact: 1,
    range: A.range, coreAngle: A.coreAngle ?? base.coreAngle ?? 1.5, ...(A.headshot ? { headshot: A.headshot } : {}), spread: { ...A.spread }, recoil: { ...A.recoil, kick: r2(A.recoil.kick * (hd.recoil / 2)) }, ...(A.falloff ? { falloff: { ...A.falloff } } : {}),
    ...(A.blow ? { blow: A.blow } : {}), ...(A.pellets ? { pellets: A.pellets } : {}), ...(A.stun ? { stun: true, quiet: true, drowse: A.drowse } : {}), ...(ROUND_OF[as] ? { round: roundOf(ROUND_OF[as]) } : {}),
    ...(A.lob ? { projectileSpeed: A.lob.speed, projectileGravity: A.lob.gravity, lobAngle: 0, splashRadius: A.lob.splash, projRadius: A.lob.projRadius, armTime: A.lob.armTime, fuse: A.lob.fuse, smokeTrail: false, fxScale: 0.25 } : {}), ...where };
  // the viewmodel: the arm as its parts' boxes (cm), the fist's place, the sight line and the eye's relief
  const view = { kind: h.class === 'handgun' ? 'handgun' : 'long', boxes: armBoxes(arm).map(([lo, hi, c, part]) => [lo.map((v) => r2(v)), hi.map((v) => r2(v)), c, part]),
    grip: st.strong.at.map(r2), sight: { y: st.sight.y, rear: st.sight.rear, front: st.sight.front, ...(st.sight.x != null ? { x: st.sight.x } : {}) }, ...(st.sight.relief ? { relief: st.sight.relief } : {}), muzzle: st.muzzle.at[2], ...(st.magazine ? { mag: st.magazine.at.map(r2) } : {}),
    hands: handsOf(st) };
  return { name, weapon, switchReady: r2(hd.swapOut + hd.swapIn), gunplay: {
    kind: view.kind, arm, ads: { zoom: scope ? st.sight.zoom : st.sight.zoom > 1 ? st.sight.zoom : OPEN_ZOOM, time: hd.aimTime, spread: scope ? ADS.scopedSpread : ADS.spread, move: ADS.move, moveSpread: ADS.moveSpread, bloom: ADS.bloom, ...(scope ? { scope: true } : {}) },
    sway: hd.sway, swap: { out: hd.swapOut, in: hd.swapIn }, view } };
}

// where a body's hands close on the arm and where it meets the shoulder (arms/handling.js stations: a fist's centre, the
// line out of its index side, its long axis), for a body that carries it (the page's gunplay view, over the shoulder)
const station = (s) => ({ at: s.at.map(r2), c: s.c.map(r3), a: s.a.map(r3) });
function handsOf(st) {
  const sup = st.support;
  return { strong: station(st.strong), ...(sup ? { support: { ...station(sup), ...(sup.alt ? { alt: station(sup.alt) } : {}) } } : {}), ...(st.butt ? { butt: st.butt.at.map(r2) } : {}) };
}

/**
 * THE ARM ITSELF IN THE HANDS (opt-in). A slot's view is the arm's proxy: its parts' boxes. A slot that asks
 * (`gunplay.view.detail: 'arm'`) is drawn by the page as the arms library builds it (equipment/arms: every part's own
 * faces, its rail, its controls, its muzzle), on the same stations, sights and hands. The recipe carries the ask and the
 * arm's build words (`gunplay.arm`), never the mesh: the page's resolve builds it (worlds/world-scene.js), so a level
 * stays its recipe. A slot with no arm of the library (a graybox weapon, a bow) keeps its boxes.
 *   armDetailed(slot)        → the slot asking for its arm (identity where it has none)
 *   withArmMeshes(entities)  → the entities with each asking slot's `view.mesh` built (the same array where none asks)
 */
export const ARM_DETAIL = 'arm';
const asksArm = (slot) => !!slot && !!slot.gunplay?.arm && slot.gunplay.view?.detail === ARM_DETAIL && !slot.gunplay.view.mesh;
export const armDetailed = (slot) => (slot?.gunplay?.arm && Array.isArray(slot.gunplay.view?.boxes) ? { ...slot, gunplay: { ...slot.gunplay, view: { ...slot.gunplay.view, detail: ARM_DETAIL } } } : slot);
export function withArmMeshes(entities) {
  if (!Array.isArray(entities) || !entities.some((e) => Array.isArray(e?.rule?.loadout) && e.rule.loadout.some(asksArm))) return entities;
  return entities.map((e) => (Array.isArray(e?.rule?.loadout) && e.rule.loadout.some(asksArm)
    ? { ...e, rule: { ...e.rule, loadout: e.rule.loadout.map((slot) => (asksArm(slot) ? { ...slot, gunplay: { ...slot.gunplay, view: { ...slot.gunplay.view, mesh: armMesh(slot.gunplay.arm) } } } : slot)) } }
    : e));
}

/** A kit's loadout on a base round: its slots in order (kitSlot). */
export const armsLoadout = (arms, base, where = {}) => arms.map((w) => kitSlot(w, base, where));
// THE QUICK KNIFE a kit's body carries in its free hand (worlds/controllable/gunplay.js `rule.knife`): a cut reaches
// 1.3 m from the hips across a 50 degree cone, the blade in it from 0.3 to 0.55 of its half second, a rest of 0.35 s
// after; two cuts drop a body of `hp`. Its look is the arms kernel's combat knife (its parts' boxes, cm), held round the
// handle with the blade out of the index side (`hold`: the fist's centre, its index side, its long axis), for the page
// to draw in the hand.
export const KNIFE = Object.freeze({ reach: 1.3, cone: 50, dur: 0.5, window: Object.freeze([0.3, 0.55]), cooldown: 0.35, impact: 1 });
let knifeView = null;
/** A blade's look from its build words ({ item: 'knife', model?, parts? }; the combat knife by default): its parts' boxes
 * and its hold, round the middle of its handle. */
export function bladeLook(build = null) {
  if (!build && knifeView) return knifeView;
  const boxes = armBoxes(build ?? { item: 'knife', model: 'combat' }).map(([lo, hi, c, part]) => [lo.map((v) => r2(v)), hi.map((v) => r2(v)), c, part]);
  const handle = boxes.find((b) => b[3] === 'handle'), mid = handle ? r2((handle[0][2] + handle[1][2]) / 2) : 6;
  const look = { boxes, hold: { at: [0, 0, mid], c: [0, 0, 1], a: [0, 1, 0] } };
  if (!build) knifeView = look;
  return look;
}
const knifeLook = () => bladeLook();
/** The quick knife against bodies of `hp` (a fresh object: a rule is the world's to change). */
export const knifeOf = (hp) => ({ ...KNIFE, window: [...KNIFE.window], damage: Math.ceil(hp / 2), view: knifeLook() });

/** A kit's legend (the keys it adds). */
export const ARMS_LEGEND = 'click  fire · right click  aim · Shift  steady (scoped) · R  reload · 1-5 or wheel  switch';
