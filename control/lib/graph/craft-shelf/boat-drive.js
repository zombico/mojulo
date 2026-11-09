/**
 * boat-drive — the boats as a helm drives them: each of the shelf's boats at its class's published figures, lowered to
 * the boat rule (worlds/controllable/rules-boat.js), and what it does to the water at each speed (boat-wake.js, through
 * `assembleCraft(id, { underway })`), so a page can draw its wake as it speeds up and slows down.
 *
 *   BOAT_DRIVE[archetype]  { power (kW at the shaft), top (m/s, its top speed loaded), drive ('outboard' | 'jet' |
 *                          'screw': an outboard's or a jet's thrust is turned to steer, so it turns standing; a screw's
 *                          rudder needs way on it), circle (its turning circle at speed, in its lengths) }
 *   boatDrive(archetype)   → { rule, afloat, wakes, waterline }: the rule's numbers, where it floats (its draft and its
 *                          waterline over its keel), its wake at a ladder of speeds
 *
 * The figures, by class (the shelf's classes; their loaded mass the shelf's own reference):
 *   motorSkiff      a 14 ft utility skiff, 20 hp tiller: about 20 mph with two aboard
 *   jonBoat         a 12 ft jon boat, 9.9 hp: about 15 mph
 *   ribTender       a 3.1 m RIB tender, 20 hp: about 25 mph
 *   ccRunabout      a 17 ft centre console, 90 hp: about 38 mph
 *   ccTTop          the same with its T-top: a little slower
 *   cuddyCabin      a 19 ft cuddy cabin, 150 hp: about 45 mph
 *   combatRhib      a 7.5 m combat RHIB, twin 150 hp: about 40 knots
 *   riverinePatrol  a 10 m riverine patrol boat, twin waterjets of about 440 hp: about 35 knots
 *   landingCraft    a 22 m mechanised landing craft, twin diesels of about 650 hp: about 12 knots
 *   navalPatrol     a 25 m navy patrol boat, twin diesels of about 2,400 hp: about 35 knots
 *   destroyer       a 150 m destroyer, gas turbines of 100,000 shp: about 30 knots
 *   aircraftCarrier a 300 m carrier, steam turbines of 260,000 shp: about 32 knots
 *   attackSub       a 110 m attack submarine surfaced, its reactor's 30,000 shp: about 15 knots on the surface
 *
 * Pure; an assembly at each speed is the slow part.
 */
import { assembleCraft } from './index.js';
import { CRAFT_ARCHETYPES } from './craft-archetypes.js';

const KN = 0.514444, MPH = 0.44704;
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
export const BOAT_DRIVE = Object.freeze({
  motorSkiff: Object.freeze({ power: 15, top: 20 * MPH, drive: 'outboard', circle: 4 }),
  jonBoat: Object.freeze({ power: 7.4, top: 15 * MPH, drive: 'outboard', circle: 4 }),
  ribTender: Object.freeze({ power: 15, top: 25 * MPH, drive: 'outboard', circle: 3.5 }),
  ccRunabout: Object.freeze({ power: 67, top: 38 * MPH, drive: 'outboard', circle: 4 }),
  ccTTop: Object.freeze({ power: 67, top: 37 * MPH, drive: 'outboard', circle: 4 }),
  cuddyCabin: Object.freeze({ power: 112, top: 45 * MPH, drive: 'outboard', circle: 4.5 }),
  combatRhib: Object.freeze({ power: 224, top: 40 * KN, drive: 'outboard', circle: 4.5 }),
  riverinePatrol: Object.freeze({ power: 650, top: 35 * KN, drive: 'jet', circle: 4 }),
  landingCraft: Object.freeze({ power: 970, top: 12 * KN, drive: 'screw', circle: 5 }),
  navalPatrol: Object.freeze({ power: 3600, top: 35 * KN, drive: 'screw', circle: 5 }),
  destroyer: Object.freeze({ power: 75000, top: 30 * KN, drive: 'screw', circle: 6 }),
  aircraftCarrier: Object.freeze({ power: 194000, top: 32 * KN, drive: 'screw', circle: 6 }),
  attackSub: Object.freeze({ power: 22000, top: 15 * KN, drive: 'screw', circle: 6 }),
});

// the speeds a wake is worked out at (shares of the top speed): enough that a page reads the one under its speed
const LADDER = Object.freeze([0.08, 0.16, 0.25, 0.35, 0.45, 0.55, 0.7, 0.85, 1]);

/** A boat as the boat rule drives it, where it floats, and its wake at each rung of its speeds. */
export function boatDrive(archetype) {
  const D = BOAT_DRIVE[archetype], A = CRAFT_ARCHETYPES[archetype];
  if (!D || !A) throw new Error(`boat drive: one of ${Object.keys(BOAT_DRIVE).join(', ')}`);
  const wakes = LADDER.map((s) => {
    const u = assembleCraft(archetype, { underway: { speed: D.top * s } }).readout.underway;
    return { speed: u.speed, froude: u.froude, regime: u.regime, angle: u.angle, crest: u.crest, reach: u.reach, bowWave: u.bowWave, sternWake: u.sternWake, ...(u.rooster ? { rooster: u.rooster } : {}) };
  });
  const { readout } = assembleCraft(archetype, { underway: { speed: D.top } }), af = readout.afloat, wl = readout.underway.waterline;
  const mass = A.reference.mtow, planing = wakes.some((w) => w.regime !== 'displacement');
  const rule = {
    type: 'boat', mass, power: D.power * 1000, top: r3(D.top), lw: wl.length, beam: wl.beam, volume: af.volume, draft: af.draft, waterline: af.waterline,
    planing, vector: D.drive !== 'screw', circle: r3(D.circle * A.reference.length), lever: true,
  };
  return { rule, afloat: { draft: af.draft, waterline: af.waterline, volume: af.volume }, waterline: wl, wakes };
}
