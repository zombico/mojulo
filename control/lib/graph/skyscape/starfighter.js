/**
 * THE STARFIGHTER'S NUMBERS — a space map's craft flown from its cockpit (worlds/controllable/rules-starfighter.js),
 * in the register of the 90s space-combat sims: the class's own speed (its envelope, eye.js), the ship's systems
 * (shields fore and aft over a hull, power, the cannons' charge), its cannons firing bolts that travel (seen, and led:
 * the cockpit HUD's pip), and the camera in its cockpit with a chase to look out from.
 *
 * Each craft flies to its cockpit card's tuning (cockpits.js: general, speed, firepower), a craft with none the general
 * one's.
 *
 *   STARFIGHTER                                    the shared numbers (the bolts, the seat's place)
 *   cockpitLasers(c, airframe?)                    → the cannons (bolts at the bolts' speed, a charge to fire from)
 *   starfighterPilot(map, pilot, { airframe?, seat? }) → the pilot on the starfighter rule, its systems on its body
 *   cockpitCamera(pilot, chase, airframe?)         → the world's camera: the cockpit (its card named), its chase
 *
 * Pure: the same craft, the same numbers.
 */
import { cockpitOf, COCKPITS } from './cockpits.js';

const COCKPIT_IDS = Object.keys(COCKPITS);

const r2 = (v) => Math.round(v * 100) / 100;

export const STARFIGHTER = Object.freeze({
  // the bolts: their speed (m/s), how long they fly (s); the rest is each craft's card (cockpits.js)
  lasers: Object.freeze({ speed: 900, fuse: 2, damage: 1 }),
  // the seat: this share of the craft's length ahead of its middle, and of its span above it
  seat: Object.freeze({ ahead: 0.12, up: 0.06 }),
});

/** The cannons: bolts that travel, fired from a charge the lasers' power recharges (the ship's systems). */
export function cockpitLasers(c, airframe) {
  const L = STARFIGHTER.lasers, N = cockpitOf(airframe).numbers.lasers;
  return {
    fireClass: 'lob', auto: true, rof: N.rof, damage: N.damage, impact: 0, range: L.speed * L.fuse, coreAngle: 2, assistAngle: 4, eye: 0,
    lobAngle: 0, projectileSpeed: L.speed, projectileGravity: 0, projRadius: 1.5, splashRadius: 0, fuse: L.fuse, noGround: true, passTeam: true,
    smokeTrail: false, fxColor: 0xff3b2e, fxScale: 1.6, energyMax: N.energy, energyCost: 1, energyRegen: N.regen, energyUnlockFrac: 0.25,
    magazine: 9999,
  };
}

/** The pilot on the starfighter rule: the class's speed, the turn rates, the seat; its hull and its systems. */
export function starfighterPilot(map, pilot, { airframe, seat } = {}) {
  const c = map.craft, N = cockpitOf(airframe).numbers, R = N.rates, size = r2(Math.max(4, c.max / 25)), top = r2(c.max * N.speedOfMax);
  return {
    ...pilot, team: pilot.team ?? 'player',
    rule: { type: 'starfighter', speed: top, accel: r2(top / 3), pitchRate: R.pitch, yawRate: R.yaw, rollRate: R.roll, throttle: 2 / 3, seat: seat ?? [r2(size * STARFIGHTER.seat.ahead * 2), 0, r2(size * STARFIGHTER.seat.up * 2)], eye: 0 },
    body: { ...pilot.body, hittable: true, hp: N.hull, radius: size, egg: { a: size, c: r2(size * 0.5), cz: 0 }, ship: { ...(N.shields ? { shields: { ...N.shields } } : {}), lasers: { regen: N.lasers.regen, links: [...N.lasers.links] } } },
    weapon: cockpitLasers(c, airframe),
  };
}

/** The world's camera: in the cockpit (the craft hidden round the eye), its chase the follow the craft came with. */
export function cockpitCamera(pilot, chase, airframe) {
  return { rule: 'cockpit', target: pilot.id, seat: pilot.rule.seat, hideTarget: true, mouseLook: true, cockpit: COCKPIT_IDS.includes(airframe) ? airframe : 'strikeFoil', chase: { ...chase, rule: chase.rule ?? 'follow', rollFollow: 1 } };
}
