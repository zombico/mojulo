/**
 * WEAPON ROLES — a weapon as a JOB ON A SIGHTLINE BAND, not a stat block. Each role is the range it wins at (`band`,
 * metres), and its numbers come from that band and the shooter pole's time to kill and hp (shooter-pole.js), so an
 * arena's sightlines (lay-concerns.js arenaSightlines) and a weapon set can be checked against each other: a gun whose
 * band the arena's clear lines hardly fall in is not served by it, and is not laid there.
 *
 *   close   a burst for a corner: two or three rounds drop a body at arm's length, a wide cone, and the damage thins
 *           past a room (falloff); little across a hall
 *   mid     the pole's own rifle (shooterPole().weapon): the gun a body starts with
 *   long    a precise gun for the long lines: a head in one round, a body in two or three, slow; a run or a spray throws it
 *           wide (spread), each shot kicks
 *   area    a launcher (a lob, flat, a splash): rounds that burst where they land, for the stylized end's open fights
 *
 * Which roles a pole carries (poleArmory): the realistic end close, mid and long; the stylized end close, mid and area;
 * between the poles all four. The ones an arena serves are those whose band holds at least SERVED of its clear lines.
 *
 *   WEAPON_ROLES                       the roles: band, the range a mind holds with it (standoff), read
 *   weaponRole(role, pole)             → { name, band, weapon } (a weapon config, combat-ranged.js initWeapon's)
 *   poleArmory(pole)                   → role names the pole carries, mid first
 *   bandShare(lines, band)             → the share of the lines (their lengths) in the band
 *   servedRoles(lines, roles)          → [{ role, share, served }] each role's band against an arena's lines
 *   roleLoadout(pole, pickups)         → a loadout: the mid gun in hand, each pickup role `held: false` (picked up)
 *
 * Pure.
 */
import { shooterPole, readPole } from './shooter-pole.js';

const lerp = (a, b, t) => a + (b - a) * t;
const r2 = (v) => Math.round(v * 100) / 100;

export const SERVED = 0.08;   // a band an arena serves holds at least this share of its clear lines

export const WEAPON_ROLES = Object.freeze({
  close: Object.freeze({ band: [0, 10], standoff: 3, read: 'a burst for a corner: a body in two or three at arm\'s length, little across a hall' }),
  mid: Object.freeze({ band: [6, 35], standoff: 12, read: 'the pole\'s own rifle, the gun a body starts with' }),
  long: Object.freeze({ band: [18, 90], standoff: 24, read: 'a head in one round, a body in two or three; slow, and thrown wide by a run' }),
  area: Object.freeze({ band: [6, 28], standoff: 15, read: 'a launcher: rounds that burst where they land' }),
});

/** A role's weapon at a point on the shooter pole. */
export function weaponRole(role, pole) {
  const R = WEAPON_ROLES[role];
  if (!R) throw new Error(`weapon role: one of ${Object.keys(WEAPON_ROLES).join(', ')}`);
  const p = readPole(pole), P = shooterPole(p), at = (a, b) => r2(lerp(a, b, p));
  const base = { coreAngle: P.weapon.coreAngle, hand: 'right', impact: 0.5 };
  if (role === 'mid') return { name: role, band: R.band.slice(), weapon: { ...P.weapon } };
  if (role === 'close') {
    const shots = Math.round(lerp(2, 3, p));
    return { name: role, band: R.band.slice(), weapon: {
      ...base, fireClass: 'sight', auto: false, burst: 1, cooldown: r2(1 / at(1.1, 1.5)), magazine: Math.round(lerp(6, 8, p)), reserve: Math.round(lerp(24, 32, p)),
      reload: at(2.6, 1.8), damage: Math.ceil(P.hp / shots), range: 30, headshot: at(1.5, 1.25),
      spread: { base: at(2.5, 3), move: at(1.5, 0.3), bloom: 0, recover: 4, max: at(4, 3.5) }, falloff: { from: 5, to: 14, min: 0.2 },
    } };
  }
  if (role === 'long') {
    const shots = Math.round(lerp(2, 3, p));
    return { name: role, band: R.band.slice(), weapon: {
      ...base, fireClass: 'sight', auto: false, burst: 1, cooldown: r2(1 / at(0.8, 1)), magazine: Math.round(lerp(5, 6, p)), reserve: Math.round(lerp(20, 30, p)),
      reload: at(3, 2), damage: Math.ceil(P.hp / shots), range: 100, headshot: shots,
      spread: { base: 0, move: at(6, 2), bloom: at(3, 1), recover: at(1.5, 3), max: 6 }, recoil: { kick: at(2, 1), recover: 3, max: 4 },
    } };
  }
  // area: a flat rocket (no drop), a splash a body's width round; a direct hit and a near one drop a body in two or three
  const shots = Math.round(lerp(2, 3, p));
  return { name: role, band: R.band.slice(), weapon: {
    ...base, fireClass: 'lob', auto: false, burst: 1, cooldown: r2(1 / at(0.9, 1.1)), magazine: Math.round(lerp(3, 5, p)), reserve: Math.round(lerp(9, 20, p)),
    reload: at(2.4, 1.8), damage: Math.ceil(P.hp / shots), range: 60, lobAngle: 0, projectileSpeed: at(30, 35), projectileGravity: 0,
    splashRadius: at(2.2, 3), projRadius: 0.3, armTime: 0.08, fuse: 3,
  } };
}

/** The roles a point on the pole carries, the spawn's gun (mid) first. */
export function poleArmory(pole) {
  const p = readPole(pole);
  return ['mid', 'close', ...(p < 0.66 ? ['long'] : []), ...(p > 0.34 ? ['area'] : [])];
}

/** The share of an arena's clear lines (their lengths, metres) inside a band. */
export function bandShare(lines, band) {
  if (!lines.length) return 0;
  return lines.filter((d) => d >= band[0] && d <= band[1]).length / lines.length;
}

/** Each role's band against an arena's clear lines: its share, and whether the arena serves it (SERVED). */
export function servedRoles(lines, roles) {
  return roles.map((role) => { const share = r2(bandShare(lines, WEAPON_ROLES[role].band)); return { role, share, served: share >= SERVED }; });
}

/** A loadout on the pole: the mid gun in hand, each of `pickups` (role names) not carried until it is picked up. Each
 * slot carries its band, so a mind takes the gun for the range (mind.js), and the range it holds with it (`approach`:
 * the close gun presses in, the long gun keeps back); the long gun `plant`s (its mind stands to shoot it). */
export function roleLoadout(pole, pickups = []) {
  return ['mid', ...pickups.filter((r) => r !== 'mid')].map((role, k) => {
    const W = weaponRole(role, pole);
    const hold = WEAPON_ROLES[role].standoff;
    return { name: role, band: W.band, weapon: W.weapon, ...(hold ? { approach: { standoff: hold } } : {}), ...(role === 'long' ? { plant: true } : {}), ...(k ? { held: false } : {}) };
  });
}
