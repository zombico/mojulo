/**
 * vehicles — every class a driving game can put on a road, as numbers someone could look up, and what it can do
 * DERIVED from them, never stated: a launch capped by grip on its driven wheels, pull from its power over speed, a top
 * speed where its power meets drag and rolling resistance, braking and cornering capped by grip, a rollover where its
 * track and centre of gravity say it tips before it slides. The drive rule (worlds/controllable/rules-drive.js) plays
 * them: `vehicleRule(id, { tuning, conditions })`.
 *
 * A row: mass (kg, with its driver or crew; a loaded truck its load), power (kW at the crank), drive ('front' | 'rear'
 * | 'all') and `share` (the static weight on the driven wheels), wheelbase, track (0: two wheels), wheel radius, CdA
 * (m², drag area), Crr (rolling), cgH (m, centre of gravity), L × W × H, eye (m over the road), a governor (m/s) where
 * one is real, `band` (the share of peak power a gearbox holds on average: 0.75 a car's, 0.85 a many-geared diesel's),
 * `grip` (its tyres' μ on dry asphalt), `brakeEff` (the share of grip its brakes use: ABS 0.95, air brakes 0.65),
 * `turn` (m, kerb-to-kerb turning radius). A tracked class says `running: 'track'` (its wheelbase the track's length
 * on the ground, its wheel a road wheel): it is drawn and parked, not yet driven (skid steer is not built). A
 * three-wheeler says its `layout` (sidecar | delta | tadpole: wheelLayout); its track is its two side-by-side wheels'.
 *
 * Sources: published specifications for a representative of each class (rental kart, Corolla, Camry, RAV4, F-150,
 * Transit, 911 Carrera, a Rally2 car, a Dakar SSV, a trophy truck, a 450 motocross bike, a sport ATV, a box truck, a
 * city bus, a Class 8 tractor with a 53 ft trailer empty and at 80,000 lb; the cycles: a 700 cc standard, a litre sport
 * bike, a grand prix prototype, a big V-twin cruiser, a 150 cc scooter, a 110 cc underbone, a pedelec, a commuter on an
 * upright bicycle, a flat-twin outfit, a delta trike, an LPG auto rickshaw, a pedicab, a box trike), each with its rider,
 * rounded: [E], estimates for a class, not a model's data sheet. The spike's reference sheet sets the bands they are held to (vehicles.test.js).
 *
 * Launch is weight-transferred (launchShare): accelerating loads the rear axle, so a rear-driven class pushes with more
 * than its static share and a front-driven one with less; a rear-driven two-wheeler lifts its front wheel first.
 *
 * Tuning: 'sim' plays the derived envelope as it is; 'arcade' lifts grip and steering, drives every wheel, brakes
 * as hard as the tyres allow, forgives the grass and softens landings. One rule, two presets. Conditions scale grip:
 * dry 1, wet 0.62, snow 0.28, ice 0.1.
 */

const G = 9.81, RHO = 1.225;
const DRIVELINE = 0.85;              // the share of crank power that reaches the road
const kmh = (v) => v / 3.6;
const r3 = (v) => Math.round(v * 1000) / 1000;

export const VEHICLES = Object.freeze({
  kart:          Object.freeze({ words: 'a rental kart', mass: 165, power: 6.6, drive: 'rear', share: 0.58, wheelbase: 1.04, track: 1.14, wheelRadius: 0.14, CdA: 0.55, Crr: 0.018, cgH: 0.28, L: 1.82, W: 1.3, H: 1.0, eye: 0.8, grip: 1.0, brakeEff: 0.9, turn: 3.5 }),
  compact:       Object.freeze({ words: 'a compact car', mass: 1415, power: 126, drive: 'front', share: 0.61, wheelbase: 2.7, track: 1.55, wheelRadius: 0.315, CdA: 0.62, Crr: 0.011, cgH: 0.54, L: 4.55, W: 1.8, H: 1.42, eye: 1.1, grip: 0.95, brakeEff: 0.95, turn: 5.4 }),
  midsize:       Object.freeze({ words: 'a midsize sedan', mass: 1605, power: 151, drive: 'front', share: 0.6, wheelbase: 2.83, track: 1.59, wheelRadius: 0.33, CdA: 0.64, Crr: 0.011, cgH: 0.55, L: 4.89, W: 1.84, H: 1.44, eye: 1.12, grip: 0.95, brakeEff: 0.95, turn: 5.7 }),
  crossover:     Object.freeze({ words: 'a crossover', mass: 1715, power: 150, drive: 'all', share: 1, wheelbase: 2.69, track: 1.6, wheelRadius: 0.36, CdA: 0.82, Crr: 0.012, cgH: 0.66, L: 4.6, W: 1.86, H: 1.69, eye: 1.3, grip: 0.9, brakeEff: 0.95, turn: 5.5 }),
  pickup:        Object.freeze({ words: 'a full-size pickup', mass: 2345, power: 298, drive: 'rear', share: 0.45, wheelbase: 3.68, track: 1.74, wheelRadius: 0.42, CdA: 1.25, Crr: 0.013, cgH: 0.78, L: 5.89, W: 2.03, H: 1.96, eye: 1.5, grip: 0.85, brakeEff: 0.95, turn: 7.3 }),
  van:           Object.freeze({ words: 'a cargo van', mass: 2275, power: 140, drive: 'rear', share: 0.5, wheelbase: 3.66, track: 1.72, wheelRadius: 0.38, CdA: 1.3, Crr: 0.012, cgH: 0.85, L: 5.95, W: 2.02, H: 2.55, eye: 1.6, grip: 0.85, brakeEff: 0.95, turn: 6.8 }),
  sports:        Object.freeze({ words: 'a sports car', mass: 1580, power: 283, drive: 'rear', share: 0.61, wheelbase: 2.45, track: 1.56, wheelRadius: 0.35, CdA: 0.62, Crr: 0.011, cgH: 0.45, L: 4.52, W: 1.85, H: 1.3, eye: 1.0, grip: 1.1, brakeEff: 0.95, turn: 5.5 }),
  rally:         Object.freeze({ words: 'a rally car', mass: 1380, power: 213, drive: 'all', share: 1, wheelbase: 2.55, track: 1.6, wheelRadius: 0.33, CdA: 0.78, Crr: 0.012, cgH: 0.48, L: 4.1, W: 1.82, H: 1.45, eye: 1.05, grip: 1.0, brakeEff: 0.95, turn: 5.2 }),
  buggy:         Object.freeze({ words: 'a desert buggy', mass: 1100, power: 147, drive: 'all', share: 1, wheelbase: 3.0, track: 1.9, wheelRadius: 0.45, CdA: 1.0, Crr: 0.025, cgH: 0.6, L: 3.9, W: 2.0, H: 1.8, eye: 1.3, grip: 0.9, brakeEff: 0.9, turn: 5.5 }),
  trophyTruck:   Object.freeze({ words: 'a trophy truck', mass: 2870, power: 597, drive: 'rear', share: 0.5, wheelbase: 3.4, track: 2.1, wheelRadius: 0.53, CdA: 1.7, Crr: 0.025, cgH: 0.9, L: 5.6, W: 2.2, H: 2.0, eye: 1.7, grip: 0.9, brakeEff: 0.9, turn: 7.0 }),
  dirtBike:      Object.freeze({ words: 'a motocross bike', mass: 192, power: 40, drive: 'rear', share: 0.55, wheelbase: 1.48, track: 0, wheelRadius: 0.35, CdA: 0.55, Crr: 0.02, cgH: 0.9, L: 2.2, W: 0.83, H: 1.27, eye: 1.5, grip: 1.0, brakeEff: 0.85, turn: 2.6 }),
  atv:           Object.freeze({ words: 'a sport ATV', mass: 260, power: 30, drive: 'rear', share: 0.55, wheelbase: 1.25, track: 0.95, wheelRadius: 0.28, CdA: 0.75, Crr: 0.022, cgH: 0.6, L: 1.85, W: 1.2, H: 1.15, eye: 1.3, grip: 0.9, brakeEff: 0.85, turn: 3.2 }),
  straightTruck: Object.freeze({ words: 'a loaded box truck', mass: 11800, power: 224, drive: 'rear', share: 0.7, wheelbase: 5.4, track: 2.0, wheelRadius: 0.5, CdA: 6.0, Crr: 0.007, cgH: 1.45, L: 9.2, W: 2.59, H: 3.9, eye: 2.3, grip: 0.8, brakeEff: 0.65, turn: 9.5, band: 0.85, governor: kmh(105) }),
  bus:           Object.freeze({ words: 'a city bus', mass: 13600, power: 250, drive: 'rear', share: 0.62, wheelbase: 6.2, track: 2.1, wheelRadius: 0.5, CdA: 6.5, Crr: 0.007, cgH: 1.15, L: 12.2, W: 2.59, H: 3.2, eye: 2.0, grip: 0.8, brakeEff: 0.7, turn: 11.5, band: 0.85, governor: kmh(100) }),
  tractorTrailer: Object.freeze({ words: 'a tractor-trailer, empty', mass: 14500, power: 373, drive: 'rear', share: 0.55, wheelbase: 5.9, track: 2.0, wheelRadius: 0.52, CdA: 6.5, Crr: 0.006, cgH: 1.5, L: 22.5, W: 2.59, H: 4.1, eye: 2.33, grip: 0.8, brakeEff: 0.65, turn: 13.5, band: 0.9, governor: kmh(105) }),
  tractorTrailerLoaded: Object.freeze({ words: 'a tractor-trailer at 80,000 lb', mass: 36300, power: 373, drive: 'rear', share: 0.32, wheelbase: 5.9, track: 2.0, wheelRadius: 0.52, CdA: 6.5, Crr: 0.006, cgH: 2.1, L: 22.5, W: 2.59, H: 4.1, eye: 2.33, grip: 0.8, brakeEff: 0.65, turn: 13.5, band: 0.9, governor: kmh(105) }),
  // (the field's: a light utility 4x4, a six-wheeled cargo truck, an eight-wheeled armoured personnel carrier; their
  // tyres cross-country, so less grip on asphalt and more rolling; governed as their manuals are)
  utility4x4:    Object.freeze({ words: 'a military light utility 4x4', mass: 2400, power: 110, drive: 'all', share: 1, wheelbase: 2.75, track: 1.62, wheelRadius: 0.41, CdA: 1.9, Crr: 0.018, cgH: 0.82, L: 4.4, W: 1.95, H: 1.9, eye: 1.65, grip: 0.78, brakeEff: 0.9, turn: 6.6, band: 0.8, governor: kmh(110) }),
  cargo6x6:      Object.freeze({ words: 'a six-wheeled military cargo truck', mass: 9500, power: 220, drive: 'all', share: 1, wheelbase: 4.6, track: 2.0, wheelRadius: 0.6, CdA: 6.0, Crr: 0.02, cgH: 1.3, L: 7.6, W: 2.45, H: 3.0, eye: 2.3, grip: 0.7, brakeEff: 0.7, turn: 11, band: 0.85, governor: kmh(90) }),
  apc8x8:        Object.freeze({ words: 'an eight-wheeled armoured personnel carrier', mass: 19000, power: 330, drive: 'all', share: 1, wheelbase: 5.0, track: 2.3, wheelRadius: 0.6, CdA: 7.5, Crr: 0.022, cgH: 1.35, L: 7.8, W: 2.9, H: 2.6, eye: 2.2, grip: 0.72, brakeEff: 0.75, turn: 10.5, band: 0.85, governor: kmh(100) }),
  // (the field's tracked: a light tank and a tracked carrier. `running: 'track'` says what they run on: their wheelbase
  // the track's length on the ground, their track the tracks' centres apart, their wheel a road wheel; Crr a track's;
  // their length the hull's, a tank's gun reaching past it. Drawn and parked; driven when skid steer is built)
  lightTank:     Object.freeze({ words: 'a tracked light tank', mass: 25000, power: 440, drive: 'all', share: 1, wheelbase: 3.9, track: 2.3, wheelRadius: 0.32, CdA: 7.0, Crr: 0.045, cgH: 1.1, L: 6.4, W: 2.9, H: 2.5, eye: 2.3, grip: 0.75, brakeEff: 0.8, turn: 5, band: 0.8, governor: kmh(70), running: 'track' }),
  trackedCarrier: Object.freeze({ words: 'a tracked armoured personnel carrier', mass: 15000, power: 300, drive: 'all', share: 1, wheelbase: 3.6, track: 2.2, wheelRadius: 0.3, CdA: 6.5, Crr: 0.045, cgH: 1.1, L: 6.0, W: 2.8, H: 2.3, eye: 2.1, grip: 0.75, brakeEff: 0.8, turn: 5, band: 0.8, governor: kmh(65), running: 'track' }),
  // (the cycles: a rider astride, steering by a bar; built by the cycle shelf, cycle-shelf/. Two in line (track 0): a
  // standard road bike, a sport bike, a grand prix prototype on slicks, a V-twin cruiser, a 150 cc scooter, a 110 cc
  // underbone, a pedelec cut off at 25 km/h, an upright bicycle. A pedalled class's power is its rider's, held as a rider
  // holds it (band 1). Three wheels say their `layout`: a heavy flat twin with its chair empty, a delta motor trike, an
  // LPG auto rickshaw, a pedicab, a box trike)
  streetBike:    Object.freeze({ words: 'a standard road motorcycle', mass: 265, power: 55, drive: 'rear', share: 0.55, wheelbase: 1.4, track: 0, wheelRadius: 0.315, CdA: 0.45, Crr: 0.015, cgH: 0.75, L: 2.09, W: 0.75, H: 1.1, eye: 1.45, grip: 1.0, brakeEff: 0.9, turn: 2.9, band: 0.85 }),
  sportBike:     Object.freeze({ words: 'a litre sport bike', mass: 275, power: 140, drive: 'rear', share: 0.52, wheelbase: 1.41, track: 0, wheelRadius: 0.315, CdA: 0.33, Crr: 0.015, cgH: 0.72, L: 2.07, W: 0.72, H: 1.15, eye: 1.3, grip: 1.05, brakeEff: 0.92, turn: 3.3, band: 0.85, governor: kmh(299) }),
  raceBike:      Object.freeze({ words: 'a grand prix prototype on slicks', mass: 232, power: 200, drive: 'rear', share: 0.52, wheelbase: 1.45, track: 0, wheelRadius: 0.3, CdA: 0.28, Crr: 0.015, cgH: 0.68, L: 2.05, W: 0.7, H: 1.12, eye: 1.25, grip: 1.35, brakeEff: 0.95, turn: 3.5, band: 0.85 }),
  cruiserBike:   Object.freeze({ words: 'a V-twin cruiser', mass: 380, power: 65, drive: 'rear', share: 0.6, wheelbase: 1.65, track: 0, wheelRadius: 0.33, CdA: 0.7, Crr: 0.016, cgH: 0.65, L: 2.45, W: 0.95, H: 1.15, eye: 1.4, grip: 0.95, brakeEff: 0.85, turn: 3.3, band: 0.85 }),
  scooter:       Object.freeze({ words: 'a 150 cc scooter', mass: 205, power: 11, drive: 'rear', share: 0.6, wheelbase: 1.35, track: 0, wheelRadius: 0.27, CdA: 0.6, Crr: 0.016, cgH: 0.7, L: 1.95, W: 0.73, H: 1.15, eye: 1.4, grip: 0.9, brakeEff: 0.85, turn: 2.0, band: 0.9 }),
  moped:         Object.freeze({ words: 'a 110 cc underbone', mass: 175, power: 6, drive: 'rear', share: 0.6, wheelbase: 1.23, track: 0, wheelRadius: 0.29, CdA: 0.55, Crr: 0.015, cgH: 0.7, L: 1.92, W: 0.7, H: 1.08, eye: 1.35, grip: 0.9, brakeEff: 0.75, turn: 1.9 }),
  eBike:         Object.freeze({ words: 'a pedelec, its assist cut at 25 km/h', mass: 100, power: 0.4, drive: 'rear', share: 0.6, wheelbase: 1.12, track: 0, wheelRadius: 0.35, CdA: 0.5, Crr: 0.006, cgH: 1.0, L: 1.85, W: 0.65, H: 1.1, eye: 1.6, grip: 0.9, brakeEff: 0.85, turn: 2.5, band: 1, governor: kmh(25) }),
  bicycle:       Object.freeze({ words: 'an upright bicycle, pedalled', mass: 90, power: 0.2, drive: 'rear', share: 0.6, wheelbase: 1.08, track: 0, wheelRadius: 0.35, CdA: 0.55, Crr: 0.006, cgH: 1.0, L: 1.8, W: 0.6, H: 1.1, eye: 1.6, grip: 0.9, brakeEff: 0.8, turn: 2.5, band: 1 }),
  sidecarOutfit: Object.freeze({ words: 'a flat-twin with its sidecar, the chair empty', mass: 415, power: 30, drive: 'rear', share: 0.45, wheelbase: 1.5, track: 1.1, wheelRadius: 0.33, CdA: 1.0, Crr: 0.018, cgH: 0.65, L: 2.6, W: 1.7, H: 1.1, eye: 1.4, grip: 0.85, brakeEff: 0.75, turn: 5.0, layout: 'sidecar' }),
  motorTrike:    Object.freeze({ words: 'a motor trike, one wheel ahead of two', mass: 530, power: 60, drive: 'rear', share: 0.7, wheelbase: 2.0, track: 1.3, wheelRadius: 0.33, CdA: 0.9, Crr: 0.015, cgH: 0.6, L: 3.0, W: 1.45, H: 1.3, eye: 1.4, grip: 0.9, brakeEff: 0.85, turn: 5.5, layout: 'delta' }),
  tukTuk:        Object.freeze({ words: 'an auto rickshaw', mass: 420, power: 7, drive: 'rear', share: 0.7, wheelbase: 2.0, track: 1.15, wheelRadius: 0.2, CdA: 1.6, Crr: 0.018, cgH: 0.75, L: 2.65, W: 1.3, H: 1.7, eye: 1.45, grip: 0.85, brakeEff: 0.7, turn: 4.3, layout: 'delta' }),
  cycleRickshaw: Object.freeze({ words: 'a pedicab, its seat empty', mass: 150, power: 0.2, drive: 'rear', share: 0.75, wheelbase: 1.7, track: 1.0, wheelRadius: 0.33, CdA: 1.2, Crr: 0.012, cgH: 0.85, L: 2.6, W: 1.15, H: 1.9, eye: 1.65, grip: 0.85, brakeEff: 0.6, turn: 4.0, band: 1, layout: 'delta' }),
  cargoTrike:    Object.freeze({ words: 'a box trike, two wheels ahead of one', mass: 120, power: 0.18, drive: 'rear', share: 0.45, wheelbase: 1.75, track: 0.85, wheelRadius: 0.25, CdA: 0.7, Crr: 0.01, cgH: 0.75, L: 2.3, W: 0.9, H: 1.15, eye: 1.6, grip: 0.85, brakeEff: 0.7, turn: 3.5, band: 1, layout: 'tadpole' }),
});

/** How a class stands on its wheels: two in line (track 0), a three-wheeler's `layout` (sidecar | delta | tadpole), or
 *  axles (two wheels or a track each side of every axle: a car, a truck, a tank). */
export const WHEEL_LAYOUTS = Object.freeze(['inline', 'sidecar', 'delta', 'tadpole', 'axles']);
export const wheelLayout = (v) => (v.layout ?? (v.track ? 'axles' : 'inline'));

export const CONDITIONS = Object.freeze({ dry: 1, wet: 0.62, snow: 0.28, ice: 0.1 });
export const TUNINGS = Object.freeze(['sim', 'arcade']);
const ARCADE = Object.freeze({ grip: 1.35, steer: 1.3, landKeep: 0.92, surfaceSoft: 0.5 });

const row = (id) => {
  const v = VEHICLES[id];
  if (!v) throw new Error(`roadway: vehicle '${id}' is not one of ${Object.keys(VEHICLES).join(', ')}`);
  return v;
};
/** The share of its weight a class pushes with as it launches: its driven wheels' static share, plus the load that
 *  shifts back under acceleration (rear drive gains it, front drive loses it: a·h/(wheelbase·g)), a rear-driven
 *  two-wheeler or kart capped where its front wheel lifts (a ≤ g·b/h, b the centre of gravity ahead of the rear axle). */
export function launchShare(v, grip = v.grip) {
  const tr = v.drive === 'rear' ? v.cgH / v.wheelbase : v.drive === 'front' ? -v.cgH / v.wheelbase : 0;
  let s = v.share / (1 - grip * tr);
  if (v.drive === 'rear') s = Math.min(s, (v.wheelbase * (1 - v.share)) / (v.cgH * grip));
  return Math.min(1, s);
}
/** Power at the wheels, on average through the gears (W). */
export const wheelPower = (v) => v.power * 1000 * DRIVELINE * (v.band ?? 0.75);

/** What a class can do, from its numbers: launch (m/s² at grip on its driven wheels), top speed (m/s, where wheel
 *  power meets drag and rolling, or its governor), braking (m/s²), cornering (m/s², lateral at grip), and whether it
 *  rolls before it slides (static stability factor track / 2h under its grip). At `mu` (dry 1). */
export function envelope(id, { mu = 1 } = {}) { return envelopeOf(row(id), { mu }); }
/** The envelope of a row that is not in VEHICLES (a machine whose numbers were derived from what was built: the car
 *  designer's racers), in VEHICLES' shape. */
export function envelopeOf(v, { mu = 1 } = {}) {
  const grip = v.grip * mu, P = wheelPower(v), drag = 0.5 * RHO * v.CdA, roll = v.Crr * v.mass * G;
  // top speed: P = drag·u³ + roll·u, solved by bisection
  let lo = 0, hi = 200;
  for (let k = 0; k < 80; k++) { const u = (lo + hi) / 2; if (drag * u ** 3 + roll * u < P) lo = u; else hi = u; }
  const top = Math.min(lo, v.governor ?? Infinity), ssf = v.track ? v.track / (2 * v.cgH) : null;
  return {
    launch: r3(grip * G * launchShare(v, grip)), top: r3(top), brake: r3(grip * G * v.brakeEff), corner: r3(grip * G),
    ...(ssf ? { stability: r3(ssf), rollsBeforeSliding: ssf < grip } : { leans: true }),
  };
}

/** The drive rule a class plays by, at a tuning and in conditions. */
export function vehicleRule(id, opts = {}) { return ruleOf(row(id), { ...opts, vehicle: id }); }
/** The drive rule of a row that is not in VEHICLES, in VEHICLES' shape (`vehicle` names it in the rule). */
export function ruleOf(v, { tuning = 'sim', conditions = 'dry', vehicle: id } = {}) {
  if (!TUNINGS.includes(tuning)) throw new Error(`roadway: tuning '${tuning}' is not one of ${TUNINGS.join(', ')}`);
  if (!(conditions in CONDITIONS)) throw new Error(`roadway: conditions '${conditions}' is not one of ${Object.keys(CONDITIONS).join(', ')}`);
  const arcade = tuning === 'arcade';
  return {
    type: 'drive', vehicle: id, tuning, conditions,
    mass: v.mass, horsepower: r3(wheelPower(v) / 745.7),
    grip: r3(v.grip * (arcade ? ARCADE.grip : 1)), muScale: CONDITIONS[conditions],
    drivenShare: arcade ? 1 : r3(launchShare(v)), brakeForce: r3(v.mass * G * 1.5), brakeEff: arcade ? 1 : v.brakeEff,
    drag: r3(0.5 * RHO * v.CdA), rollResist: v.Crr,
    wheelbase: v.wheelbase, wheelRadius: v.wheelRadius,
    steerMax: r3(Math.atan(v.wheelbase / v.turn) * (arcade ? ARCADE.steer : 1)), steerTighten: 0,
    ...(v.governor ? { topSpeed: r3(v.governor) } : {}),
    lateralGrip: true, surfaceGrip: true, air: true,
    ...(arcade ? { landKeep: ARCADE.landKeep, surfaceSoft: ARCADE.surfaceSoft } : {}),
    ...(v.track ? {} : { wheels: 2 }),
    eye: 0, collideRadius: r3(v.W / 2), collideHeight: v.H,
  };
}
