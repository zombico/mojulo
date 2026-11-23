/**
 * THE STARFIGHTER'S NUMBERS — a space map's craft flown from its cockpit (worlds/controllable/rules-starfighter.js),
 * in the register of the 90s space-combat sims: the class's own speed (its envelope, eye.js), the ship's systems
 * (shields fore and aft over a hull, power, the cannons' charge), its cannons firing bolts that travel (seen, and led:
 * the cockpit HUD's pip), and the camera in its cockpit with a chase to look out from.
 *
 * Each craft flies to its cockpit card's tuning (cockpits.js: general, speed, firepower), a craft with none the general
 * one's.
 *
 *   STARFIGHTER                                    the shared numbers (the bolts, the seat's place, the chase)
 *   cockpitLasers(c, airframe?)                    → the cannons (bolts at the bolts' speed, a charge to fire from)
 *   starfighterPilot(map, pilot, { airframe?, seat? }) → the pilot on the starfighter rule, its systems on its body
 *   cockpitCamera(pilot, chase, airframe?)         → the world's camera: the cockpit (its card named), its chase
 *   chaseFrame(chase)                              → that chase, nearer, the craft low with the space ahead above it
 *
 * Pure: the same craft, the same numbers.
 */
import { cockpitOf, COCKPITS } from './cockpits.js';

const COCKPIT_IDS = Object.keys(COCKPITS);

const r2 = (v) => Math.round(v * 100) / 100;

export const STARFIGHTER = Object.freeze({
  // the bolts: their speed (m/s), how long they fly (s); the rest is each craft's card (cockpits.js)
  lasers: Object.freeze({ speed: 900, fuse: 2, damage: 1 }),
  // how a bolt is drawn (the shot's look, gameworld/feel/round-look.js): its size (m), and the least it is drawn on screen
  // (rad: past where its size would shrink under it, it is drawn that size, so a bolt reads at a kilometre)
  bolt: Object.freeze({ size: 1.4, min: 0.0035 }),
  // a craft blows apart in a blast this many times its size across (its fireball, the craft gone in it)
  blast: 3,
  // the seat: this share of the craft's length ahead of its middle, and of its span above it
  seat: Object.freeze({ ahead: 0.12, up: 0.06 }),
  // the chase: nearer than a flight's (`near` of its distance and height), and looking `ahead` of its distance past the
  // craft, so the craft sits low on the screen (`sit` of the way down, at a view `vfov`° high) with the space it flies
  // into above it, clear of the instruments' strip at the foot (cockpit-hud.js CHASE_SLOTS)
  chase: Object.freeze({ near: 0.8, ahead: 1.25, sit: 0.7, vfov: 60 }),
});

/** The chase a cockpit's world toggles out to (a flight's `follow`, craft.js craftPilot): nearer, and its look point
 *  solved so the craft sits STARFIGHTER.chase.sit of the way down the screen. */
export function chaseFrame(chase) {
  const C = STARFIGHTER.chase, dist = r2((chase.dist ?? 40) * C.near), height = r2((chase.height ?? 10) * C.near), lead = r2(dist * C.ahead);
  // (the craft is atan(height / dist) under the eye; the view's axis is held that less the sit's angle under it)
  const below = Math.atan2(height, dist), off = Math.atan((2 * C.sit - 1) * Math.tan((C.vfov * Math.PI) / 360));
  const lookH = r2(height - Math.tan(below - off) * (dist + lead));
  return { ...chase, dist, height, lead, lookH };
}

/** The cannons: bolts that travel, fired from a charge the lasers' power recharges (the ship's systems). */
export function cockpitLasers(c, airframe) {
  const L = STARFIGHTER.lasers, N = cockpitOf(airframe).numbers.lasers;
  return {
    fireClass: 'lob', auto: true, rof: N.rof, damage: N.damage, impact: 0, range: L.speed * L.fuse, coreAngle: 2, assistAngle: 4, eye: 0,
    lobAngle: 0, projectileSpeed: L.speed, projectileGravity: 0, projRadius: 1.5, splashRadius: 0, fuse: L.fuse, noGround: true, passTeam: true,
    smokeTrail: false, fxColor: 0xff3b2e, fxScale: STARFIGHTER.bolt.size, fxMin: STARFIGHTER.bolt.min, foeRound: true, energyMax: N.energy, energyCost: 1, energyRegen: N.regen, energyUnlockFrac: 0.25,
    magazine: 9999,
  };
}

/** The pilot on the starfighter rule: the class's speed, the turn rates, the seat; its hull and its systems. */
export function starfighterPilot(map, pilot, { airframe, seat } = {}) {
  const c = map.craft, N = cockpitOf(airframe).numbers, R = N.rates, size = r2(Math.max(4, c.max / 25)), top = r2(c.max * N.speedOfMax);
  return {
    ...pilot, team: pilot.team ?? 'player',
    rule: { type: 'starfighter', speed: top, accel: r2(top / 3), pitchRate: R.pitch, yawRate: R.yaw, rollRate: R.roll, throttle: 2 / 3, seat: seat ?? [r2(size * STARFIGHTER.seat.ahead * 2), 0, r2(size * STARFIGHTER.seat.up * 2)], eye: 0 },
    body: { ...pilot.body, hittable: true, hp: N.hull, radius: size, egg: { a: size, c: r2(size * 0.5), cz: 0 }, blast: r2(size * STARFIGHTER.blast), ship: { ...(N.shields ? { shields: { ...N.shields } } : {}), lasers: { regen: N.lasers.regen, links: [...N.lasers.links] } } },
    weapon: cockpitLasers(c, airframe),
  };
}

/** The world's camera: in the cockpit (the craft hidden round the eye), its chase the follow the craft came with. */
export function cockpitCamera(pilot, chase, airframe) {
  return { rule: 'cockpit', target: pilot.id, seat: pilot.rule.seat, hideTarget: true, mouseLook: true, cockpit: COCKPIT_IDS.includes(airframe) ? airframe : 'strikeFoil', chase: { ...chaseFrame(chase), rule: chase.rule ?? 'follow', rollFollow: 1 } };
}
