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
 * A class that does not turn by its front wheels says its `steer` (STEERS: rear | all | articulated | skid; steerOf,
 * a crawler's skid): a word for its builders and its page, which the drive rule does not read (it turns every class on
 * its turning radius); a skid-steered class is drawn and parked, as a tracked one is.
 *
 * Sources: published specifications for a representative of each class (rental kart, Corolla, Camry, RAV4, F-150,
 * Transit, 911 Carrera, a Rally2 car, a Dakar SSV, a trophy truck, a 450 motocross bike, a sport ATV, a box truck, a
 * city bus, a Class 8 tractor with a 53 ft trailer empty and at 80,000 lb; the cycles: a 700 cc standard, a litre sport
 * bike, a grand prix prototype, a big V-twin cruiser, a 150 cc scooter, a 110 cc underbone, a pedelec, a commuter on an
 * upright bicycle, a flat-twin outfit, a delta trike, an LPG auto rickshaw, a pedicab, a box trike; the site's machines: a
 * 20 t crawler excavator, a 2.7 t mini excavator, a 19 t wheeled excavator, a 20 t crawler dozer, a 15 t wheel loader, an
 * 8.5 t backhoe loader, a 3.3 t skid steer, a 4.3 t compact track loader, a 4 t, 14 m telehandler, a 2.5 t counterbalance
 * forklift, an 8x4 tipper and an 8x4 mixer loaded, a 30 t articulated dump truck and a 100 t rigid haul truck loaded, a
 * five-axle all-terrain crane, a 10 t tandem roller, a 17 t motor grader), each with its rider or operator, rounded: [E], estimates for a class, not a model's data sheet. The spike's reference sheet sets the bands they are held to (vehicles.test.js).
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
  // (the personal and family cars the car shelf builds, classes and not models, [E]: an A-segment city car, a tall kei
  // car, a two-seat microcar, a B-segment supermini, a full-size luxury saloon, a two-door coupe, a two-seat roadster, a
  // V8 muscle coupe, a people carrier, a midsize three-row SUV, a full-size body-on-frame SUV, a short boxy off-roader)
  cityCar:       Object.freeze({ words: 'an A-segment city car', mass: 1010, power: 51, drive: 'front', share: 0.62, wheelbase: 2.37, track: 1.41, wheelRadius: 0.29, CdA: 0.62, Crr: 0.011, cgH: 0.55, L: 3.6, W: 1.65, H: 1.49, eye: 1.15, grip: 0.92, brakeEff: 0.95, turn: 4.7 }),
  keiCar:        Object.freeze({ words: 'a tall kei car', mass: 960, power: 47, drive: 'front', share: 0.62, wheelbase: 2.46, track: 1.3, wheelRadius: 0.28, CdA: 0.78, Crr: 0.011, cgH: 0.66, L: 3.395, W: 1.475, H: 1.7, eye: 1.3, grip: 0.9, brakeEff: 0.95, turn: 4.5 }),
  microcar:      Object.freeze({ words: 'a two-seat microcar', mass: 900, power: 52, drive: 'rear', share: 0.62, wheelbase: 1.87, track: 1.43, wheelRadius: 0.29, CdA: 0.65, Crr: 0.011, cgH: 0.6, L: 2.7, W: 1.66, H: 1.55, eye: 1.2, grip: 0.9, brakeEff: 0.95, turn: 3.5 }),
  subcompact:    Object.freeze({ words: 'a B-segment supermini', mass: 1180, power: 74, drive: 'front', share: 0.62, wheelbase: 2.56, track: 1.5, wheelRadius: 0.305, CdA: 0.6, Crr: 0.011, cgH: 0.54, L: 4.06, W: 1.74, H: 1.46, eye: 1.1, grip: 0.93, brakeEff: 0.95, turn: 5.1 }),
  fullsize:      Object.freeze({ words: 'a full-size luxury saloon', mass: 2000, power: 250, drive: 'rear', share: 0.5, wheelbase: 3.07, track: 1.63, wheelRadius: 0.36, CdA: 0.6, Crr: 0.011, cgH: 0.55, L: 5.18, W: 1.9, H: 1.48, eye: 1.13, grip: 0.95, brakeEff: 0.95, turn: 6.0 }),
  coupe:         Object.freeze({ words: 'a two-door coupe', mass: 1500, power: 180, drive: 'front', share: 0.6, wheelbase: 2.7, track: 1.57, wheelRadius: 0.335, CdA: 0.6, Crr: 0.011, cgH: 0.5, L: 4.65, W: 1.82, H: 1.37, eye: 1.05, grip: 0.97, brakeEff: 0.95, turn: 5.5 }),
  roadster:      Object.freeze({ words: 'a two-seat roadster', mass: 1080, power: 135, drive: 'rear', share: 0.5, wheelbase: 2.31, track: 1.5, wheelRadius: 0.3, CdA: 0.62, Crr: 0.011, cgH: 0.46, L: 3.92, W: 1.73, H: 1.23, eye: 0.95, grip: 1.0, brakeEff: 0.95, turn: 4.7 }),
  muscle:        Object.freeze({ words: 'a V8 muscle coupe', mass: 1800, power: 345, drive: 'rear', share: 0.47, wheelbase: 2.72, track: 1.6, wheelRadius: 0.36, CdA: 0.7, Crr: 0.011, cgH: 0.52, L: 4.8, W: 1.92, H: 1.38, eye: 1.05, grip: 0.98, brakeEff: 0.95, turn: 5.8 }),
  minivan:       Object.freeze({ words: 'a people carrier', mass: 2050, power: 210, drive: 'front', share: 0.58, wheelbase: 3.03, track: 1.71, wheelRadius: 0.36, CdA: 0.95, Crr: 0.011, cgH: 0.68, L: 5.17, W: 1.99, H: 1.78, eye: 1.38, grip: 0.9, brakeEff: 0.95, turn: 5.8 }),
  midSuv:        Object.freeze({ words: 'a midsize three-row SUV', mass: 2050, power: 220, drive: 'all', share: 1, wheelbase: 2.85, track: 1.68, wheelRadius: 0.38, CdA: 0.95, Crr: 0.012, cgH: 0.72, L: 4.95, W: 1.95, H: 1.75, eye: 1.42, grip: 0.9, brakeEff: 0.95, turn: 5.9 }),
  largeSuv:      Object.freeze({ words: 'a full-size body-on-frame SUV', mass: 2600, power: 265, drive: 'all', share: 1, wheelbase: 3.07, track: 1.74, wheelRadius: 0.4, CdA: 1.15, Crr: 0.012, cgH: 0.8, L: 5.35, W: 2.06, H: 1.93, eye: 1.55, grip: 0.88, brakeEff: 0.95, turn: 6.2 }),
  offroader:     Object.freeze({ words: 'a short boxy off-roader', mass: 2000, power: 200, drive: 'all', share: 1, wheelbase: 2.46, track: 1.6, wheelRadius: 0.41, CdA: 1.2, Crr: 0.014, cgH: 0.78, L: 4.35, W: 1.9, H: 1.86, eye: 1.55, grip: 0.88, brakeEff: 0.95, turn: 5.5 }),
  // (the field's: a light utility 4x4, a six-wheeled cargo truck, an eight-wheeled armoured personnel carrier; their
  // tyres cross-country, so less grip on asphalt and more rolling; governed as their manuals are)
  utility4x4:    Object.freeze({ words: 'a military light utility 4x4', mass: 2400, power: 110, drive: 'all', share: 1, wheelbase: 2.75, track: 1.62, wheelRadius: 0.41, CdA: 1.9, Crr: 0.018, cgH: 0.82, L: 4.4, W: 1.95, H: 1.9, eye: 1.65, grip: 0.78, brakeEff: 0.9, turn: 6.6, band: 0.8, governor: kmh(110) }),
  // (the field's heavy utility 4x4: wide, low and heavy-tyred, a buffed-up jeep; governed as its manual is)
  heavy4x4:      Object.freeze({ words: 'a heavy military utility 4x4', mass: 3500, power: 140, drive: 'all', share: 1, wheelbase: 3.3, track: 1.82, wheelRadius: 0.47, CdA: 3.4, Crr: 0.02, cgH: 0.95, L: 4.6, W: 2.16, H: 1.83, eye: 1.75, grip: 0.77, brakeEff: 0.85, turn: 7.6, band: 0.8, governor: kmh(105) }),
  cargo6x6:      Object.freeze({ words: 'a six-wheeled military cargo truck', mass: 9500, power: 220, drive: 'all', share: 1, wheelbase: 4.6, track: 2.0, wheelRadius: 0.6, CdA: 6.0, Crr: 0.02, cgH: 1.3, L: 7.6, W: 2.45, H: 3.0, eye: 2.3, grip: 0.7, brakeEff: 0.7, turn: 11, band: 0.85, governor: kmh(90) }),
  apc8x8:        Object.freeze({ words: 'an eight-wheeled armoured personnel carrier', mass: 19000, power: 330, drive: 'all', share: 1, wheelbase: 5.0, track: 2.3, wheelRadius: 0.6, CdA: 7.5, Crr: 0.022, cgH: 1.35, L: 7.8, W: 2.9, H: 2.6, eye: 2.2, grip: 0.72, brakeEff: 0.75, turn: 10.5, band: 0.85, governor: kmh(100) }),
  // (the field's missile launcher: an eight-wheeled transporter-erector carrying a 14 m missile; its height the truck's
  // own, its cab's, the missile above it its load; its wheelbase its first axle to its last)
  launcher8x8:   Object.freeze({ words: 'an eight-wheeled missile launcher truck', mass: 38000, power: 390, drive: 'all', share: 1, wheelbase: 11.6, track: 2.4, wheelRadius: 0.68, CdA: 9.0, Crr: 0.022, cgH: 1.9, L: 15.6, W: 2.9, H: 2.8, eye: 2.5, grip: 0.68, brakeEff: 0.7, turn: 15, band: 0.85, governor: kmh(65) }),
  // (the airfield's ground crew, classes and not replicas: a catering hi-loader, a belt loader, a passenger stair truck;
  // smooth tyres on concrete, governed to the apron's walking pace and a little over)
  cateringTruck: Object.freeze({ words: 'an airside catering hi-loader truck', mass: 13500, power: 160, drive: 'rear', share: 0.62, wheelbase: 4.5, track: 2.0, wheelRadius: 0.47, CdA: 7.5, Crr: 0.009, cgH: 1.7, L: 8.6, W: 2.5, H: 3.9, eye: 2.2, grip: 0.8, brakeEff: 0.7, turn: 8.5, band: 0.85, governor: kmh(30) }),
  beltLoader:    Object.freeze({ words: 'an airside belt loader', mass: 3300, power: 45, drive: 'rear', share: 0.5, wheelbase: 2.6, track: 1.62, wheelRadius: 0.3, CdA: 2.2, Crr: 0.012, cgH: 0.7, L: 7.5, W: 1.96, H: 1.92, eye: 1.4, grip: 0.8, brakeEff: 0.8, turn: 5.5, band: 0.8, governor: kmh(25) }),
  // (and what tows, pushes and fuels: a baggage tug and its cart, a towbarless pushback tug, a refueller)
  baggageTug:    Object.freeze({ words: 'an airside baggage tug', mass: 3000, power: 40, drive: 'rear', share: 0.55, wheelbase: 1.65, track: 1.1, wheelRadius: 0.29, CdA: 2.0, Crr: 0.012, cgH: 0.55, L: 2.95, W: 1.42, H: 2.06, eye: 1.5, grip: 0.8, brakeEff: 0.85, turn: 3.2, band: 0.8, governor: kmh(25) }),
  baggageCart:   Object.freeze({ words: 'an airside baggage cart, towed', mass: 650, power: 1, drive: 'rear', share: 0.5, wheelbase: 1.55, track: 1.2, wheelRadius: 0.2, CdA: 2.5, Crr: 0.015, cgH: 0.7, L: 3.3, W: 1.55, H: 1.95, eye: 1.2, grip: 0.8, brakeEff: 0.5, turn: 3.0, band: 0.8, governor: kmh(25) }),
  pushbackTug:   Object.freeze({ words: 'an airside towbarless pushback tug', mass: 20000, power: 180, drive: 'all', share: 1, wheelbase: 3.1, track: 2.2, wheelRadius: 0.5, CdA: 4.5, Crr: 0.012, cgH: 0.8, L: 6.6, W: 2.9, H: 1.94, eye: 1.55, grip: 0.85, brakeEff: 0.8, turn: 6.5, band: 0.8, governor: kmh(32) }),
  fuelTruck:     Object.freeze({ words: 'an airside refueller truck', mass: 28000, power: 240, drive: 'rear', share: 0.62, wheelbase: 4.4, track: 2.0, wheelRadius: 0.5, CdA: 7.5, Crr: 0.009, cgH: 1.9, L: 9.6, W: 2.5, H: 3.06, eye: 2.3, grip: 0.8, brakeEff: 0.7, turn: 9.0, band: 0.85, governor: kmh(30) }),
  stairTruck:    Object.freeze({ words: 'an airside passenger stair truck', mass: 6800, power: 100, drive: 'rear', share: 0.6, wheelbase: 3.8, track: 1.9, wheelRadius: 0.42, CdA: 6.0, Crr: 0.009, cgH: 1.5, L: 8.2, W: 2.3, H: 3.72, eye: 2.0, grip: 0.8, brakeEff: 0.75, turn: 7.5, band: 0.85, governor: kmh(25) }),
  // (the city's utility vehicles, classes and not replicas: a rear-loading refuse truck loaded, a plough truck and gritter
  // its spreader full (its width the blade's, angled), a truck-mounted street sweeper; road tyres, governed as their
  // fleets are)
  refuseTruck:   Object.freeze({ words: 'a rear-loading refuse truck, loaded', mass: 26000, power: 240, drive: 'rear', share: 0.7, wheelbase: 4.8, track: 2.0, wheelRadius: 0.52, CdA: 8.0, Crr: 0.009, cgH: 1.6, L: 10.2, W: 2.55, H: 3.6, eye: 2.25, grip: 0.78, brakeEff: 0.7, turn: 9.5, band: 0.85, governor: kmh(90) }),
  snowPlow:      Object.freeze({ words: 'a plough truck and gritter, its spreader loaded', mass: 18000, power: 260, drive: 'all', share: 1, wheelbase: 4.6, track: 2.0, wheelRadius: 0.53, CdA: 9.0, Crr: 0.01, cgH: 1.5, L: 9.4, W: 3.24, H: 3.23, eye: 2.4, grip: 0.75, brakeEff: 0.7, turn: 9.5, band: 0.85, governor: kmh(80) }),
  streetSweeper: Object.freeze({ words: 'a truck-mounted street sweeper', mass: 15000, power: 170, drive: 'rear', share: 0.62, wheelbase: 3.9, track: 1.95, wheelRadius: 0.46, CdA: 6.5, Crr: 0.009, cgH: 1.4, L: 7.2, W: 2.45, H: 3.0, eye: 2.15, grip: 0.8, brakeEff: 0.75, turn: 7.5, band: 0.85, governor: kmh(80) }),
  // (and its emergency vehicles: a pumper fire engine, a box ambulance on a van cab, a high-roofed paramedic van; governed
  // as their services are)
  fireEngine:    Object.freeze({ words: 'a pumper fire engine, its tank full', mass: 18500, power: 336, drive: 'rear', share: 0.62, wheelbase: 5.0, track: 2.0, wheelRadius: 0.54, CdA: 7.5, Crr: 0.009, cgH: 1.5, L: 10.0, W: 2.55, H: 3.17, eye: 2.3, grip: 0.8, brakeEff: 0.75, turn: 10.5, band: 0.85, governor: kmh(110) }),
  ambulance:     Object.freeze({ words: 'a box ambulance on a van cab', mass: 6800, power: 220, drive: 'rear', share: 0.62, wheelbase: 4.0, track: 1.75, wheelRadius: 0.4, CdA: 5.5, Crr: 0.01, cgH: 1.2, L: 7.0, W: 2.4, H: 2.95, eye: 1.9, grip: 0.8, brakeEff: 0.85, turn: 7.5, band: 0.8, governor: kmh(130) }),
  paramedicVan:  Object.freeze({ words: 'a high-roofed paramedic van', mass: 4300, power: 130, drive: 'front', share: 0.6, wheelbase: 3.66, track: 1.72, wheelRadius: 0.37, CdA: 3.9, Crr: 0.01, cgH: 1.1, L: 6.2, W: 2.05, H: 2.75, eye: 1.85, grip: 0.82, brakeEff: 0.9, turn: 6.5, band: 0.8, governor: kmh(140) }),
  // (and its aerial lifts: a rear-mount aerial ladder truck on three axles, a utility's bucket truck)
  ladderTruck:   Object.freeze({ words: 'a rear-mount aerial ladder truck', mass: 30000, power: 380, drive: 'rear', share: 0.7, wheelbase: 5.6, track: 2.0, wheelRadius: 0.54, CdA: 8.5, Crr: 0.009, cgH: 1.8, L: 12.0, W: 2.55, H: 3.7, eye: 2.3, grip: 0.78, brakeEff: 0.72, turn: 12.5, band: 0.85, governor: kmh(100) }),
  bucketTruck:   Object.freeze({ words: 'a utility bucket truck, its boom folded', mass: 13500, power: 220, drive: 'rear', share: 0.65, wheelbase: 4.8, track: 2.0, wheelRadius: 0.5, CdA: 7.0, Crr: 0.009, cgH: 1.6, L: 9.0, W: 2.45, H: 3.05, eye: 2.35, grip: 0.8, brakeEff: 0.75, turn: 9.0, band: 0.85, governor: kmh(100) }),
  // (and the refuse fleet's other models: a front loader, an automated side loader, a roll-off hook-lift truck with its
  // container, a skip loader carrying its skip; loaded)
  frontLoader:   Object.freeze({ words: 'a front-loading refuse truck, loaded', mass: 27000, power: 270, drive: 'rear', share: 0.7, wheelbase: 5.6, track: 2.0, wheelRadius: 0.52, CdA: 8.5, Crr: 0.009, cgH: 1.7, L: 10.6, W: 2.55, H: 3.95, eye: 2.25, grip: 0.78, brakeEff: 0.7, turn: 10.0, band: 0.85, governor: kmh(90) }),
  sideLoader:    Object.freeze({ words: 'an automated side-loading refuse truck, loaded', mass: 24000, power: 240, drive: 'rear', share: 0.7, wheelbase: 4.9, track: 2.0, wheelRadius: 0.5, CdA: 8.0, Crr: 0.009, cgH: 1.6, L: 9.2, W: 2.55, H: 3.6, eye: 2.0, grip: 0.78, brakeEff: 0.7, turn: 9.0, band: 0.85, governor: kmh(90) }),
  rollOff:       Object.freeze({ words: 'a roll-off hook-lift truck carrying its container', mass: 25000, power: 300, drive: 'rear', share: 0.68, wheelbase: 4.9, track: 2.0, wheelRadius: 0.52, CdA: 7.5, Crr: 0.009, cgH: 1.6, L: 9.6, W: 2.55, H: 3.14, eye: 2.3, grip: 0.78, brakeEff: 0.7, turn: 10.0, band: 0.85, governor: kmh(100) }),
  skipLoader:    Object.freeze({ words: 'a skip loader carrying its skip', mass: 16000, power: 200, drive: 'rear', share: 0.65, wheelbase: 3.9, track: 2.0, wheelRadius: 0.5, CdA: 7.0, Crr: 0.009, cgH: 1.5, L: 7.6, W: 2.5, H: 3.72, eye: 2.2, grip: 0.8, brakeEff: 0.72, turn: 8.0, band: 0.85, governor: kmh(90) }),
  // (and its delivery fleet, laden: a postal delivery van driven from the right, a courier's high-roofed van, a walk-in
  // step van, a light box truck on dual rear tyres, a kei truck)
  mailTruck:     Object.freeze({ words: 'a postal delivery van', mass: 2400, power: 100, drive: 'rear', share: 0.55, wheelbase: 2.84, track: 1.66, wheelRadius: 0.36, CdA: 2.6, Crr: 0.011, cgH: 1.0, L: 4.9, W: 2.0, H: 2.35, eye: 1.7, grip: 0.82, brakeEff: 0.9, turn: 5.5, band: 0.8, governor: kmh(110) }),
  courierVan:    Object.freeze({ words: 'a courier\'s high-roofed panel van, laden', mass: 3300, power: 120, drive: 'rear', share: 0.55, wheelbase: 3.66, track: 1.72, wheelRadius: 0.36, CdA: 3.4, Crr: 0.011, cgH: 1.05, L: 6.0, W: 2.05, H: 2.6, eye: 1.85, grip: 0.82, brakeEff: 0.9, turn: 6.6, band: 0.8, governor: kmh(140) }),
  stepVan:       Object.freeze({ words: 'a walk-in step van, laden', mass: 6500, power: 150, drive: 'rear', share: 0.65, wheelbase: 3.9, track: 1.95, wheelRadius: 0.4, CdA: 5.5, Crr: 0.01, cgH: 1.25, L: 6.8, W: 2.4, H: 3.0, eye: 2.0, grip: 0.8, brakeEff: 0.85, turn: 7.2, band: 0.85, governor: kmh(105) }),
  lightTruck:    Object.freeze({ words: 'a light box truck with a tail lift, laden', mass: 7000, power: 130, drive: 'rear', share: 0.66, wheelbase: 4.0, track: 1.85, wheelRadius: 0.4, CdA: 5.5, Crr: 0.009, cgH: 1.3, L: 7.2, W: 2.3, H: 3.3, eye: 2.0, grip: 0.8, brakeEff: 0.8, turn: 7.5, band: 0.85, governor: kmh(100) }),
  keiTruck:      Object.freeze({ words: 'a kei truck with its box', mass: 1000, power: 47, drive: 'rear', share: 0.5, wheelbase: 1.9, track: 1.16, wheelRadius: 0.28, CdA: 1.4, Crr: 0.012, cgH: 0.75, L: 3.4, W: 1.48, H: 1.95, eye: 1.4, grip: 0.85, brakeEff: 0.9, turn: 3.6, band: 0.8, governor: kmh(110) }),
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
  sidecarOutfit: Object.freeze({ words: 'a road twin with its sidecar, the chair empty', mass: 415, power: 30, drive: 'rear', share: 0.45, wheelbase: 1.4, track: 1.1, wheelRadius: 0.33, CdA: 1.0, Crr: 0.018, cgH: 0.65, L: 2.1, W: 1.55, H: 1.1, eye: 1.4, grip: 0.85, brakeEff: 0.75, turn: 5.0, layout: 'sidecar' }),
  motorTrike:    Object.freeze({ words: 'a motor trike, one wheel ahead of two', mass: 530, power: 60, drive: 'rear', share: 0.7, wheelbase: 2.0, track: 1.3, wheelRadius: 0.33, CdA: 0.9, Crr: 0.015, cgH: 0.6, L: 3.0, W: 1.45, H: 1.3, eye: 1.4, grip: 0.9, brakeEff: 0.85, turn: 5.5, layout: 'delta' }),
  tukTuk:        Object.freeze({ words: 'an auto rickshaw', mass: 420, power: 7, drive: 'rear', share: 0.7, wheelbase: 2.0, track: 1.15, wheelRadius: 0.2, CdA: 1.6, Crr: 0.018, cgH: 0.75, L: 2.65, W: 1.3, H: 1.7, eye: 1.45, grip: 0.85, brakeEff: 0.7, turn: 4.3, layout: 'delta' }),
  cycleRickshaw: Object.freeze({ words: 'a pedicab, its seat empty', mass: 150, power: 0.2, drive: 'rear', share: 0.75, wheelbase: 1.7, track: 1.0, wheelRadius: 0.33, CdA: 1.2, Crr: 0.012, cgH: 0.85, L: 2.6, W: 1.15, H: 1.9, eye: 1.65, grip: 0.85, brakeEff: 0.6, turn: 4.0, band: 1, layout: 'delta' }),
  cargoTrike:    Object.freeze({ words: 'a box trike, two wheels ahead of one', mass: 120, power: 0.18, drive: 'rear', share: 0.45, wheelbase: 1.75, track: 0.85, wheelRadius: 0.25, CdA: 0.7, Crr: 0.01, cgH: 0.75, L: 2.3, W: 0.9, H: 1.15, eye: 1.6, grip: 0.85, brakeEff: 0.7, turn: 3.5, band: 1, layout: 'tadpole' }),
  // (the site's machines, built by the construction shelf. A crawler's wheelbase is its track's length on the ground
  // (idler to sprocket), its track the tracks' centres apart (the gauge), its wheel a bottom roller; a machine's length,
  // width and height its transport size (its boom or its bucket folded, its blade on); its eye the operator's. Crawlers
  // and skid steers are drawn and parked until skid steer is built; the travel speed a governor, a site machine's
  // published top gear. A haul truck's, a tipper's and a mixer's mass is loaded. `site`: its body is the construction
  // shelf's, never the car sheet's)
  crawlerExcavator: Object.freeze({ words: 'a 20 t crawler excavator', mass: 21000, power: 110, drive: 'all', share: 1, wheelbase: 3.65, track: 2.2, wheelRadius: 0.12, CdA: 8.0, Crr: 0.05, cgH: 1.1, L: 9.5, W: 2.8, H: 3.0, eye: 2.4, grip: 0.75, brakeEff: 0.8, turn: 2.5, band: 0.7, governor: kmh(5.5), running: 'track', site: true }),
  miniExcavator: Object.freeze({ words: 'a 2.7 t mini excavator, its tail inside its tracks', mass: 2700, power: 15, drive: 'all', share: 1, wheelbase: 1.6, track: 1.25, wheelRadius: 0.08, CdA: 3.0, Crr: 0.05, cgH: 0.6, L: 4.4, W: 1.55, H: 2.45, eye: 1.9, grip: 0.75, brakeEff: 0.8, turn: 1.2, band: 0.7, governor: kmh(4.4), running: 'track', site: true }),
  wheeledExcavator: Object.freeze({ words: 'a 19 t wheeled excavator, the 20 t front', mass: 19000, power: 105, drive: 'all', share: 1, wheelbase: 2.6, track: 1.95, wheelRadius: 0.5, CdA: 7.5, Crr: 0.02, cgH: 1.3, L: 8.4, W: 2.55, H: 3.1, eye: 2.4, grip: 0.75, brakeEff: 0.8, turn: 6.8, band: 0.75, governor: kmh(37), site: true }),
  crawlerDozer: Object.freeze({ words: 'a 20 t crawler dozer, its blade and its ripper', mass: 20500, power: 160, drive: 'all', share: 1, wheelbase: 2.9, track: 1.98, wheelRadius: 0.13, CdA: 9.0, Crr: 0.05, cgH: 1.1, L: 6.6, W: 3.4, H: 3.2, eye: 2.6, grip: 0.8, brakeEff: 0.8, turn: 2.0, band: 0.7, governor: kmh(11), running: 'track', site: true }),
  wheelLoader:   Object.freeze({ words: 'a 15 t wheel loader, its frame articulated', mass: 15000, power: 140, drive: 'all', share: 1, wheelbase: 3.3, track: 2.2, wheelRadius: 0.8, CdA: 8.5, Crr: 0.025, cgH: 1.4, L: 8.2, W: 2.9, H: 3.4, eye: 2.6, grip: 0.75, brakeEff: 0.8, turn: 6.2, band: 0.75, governor: kmh(38), steer: 'articulated', site: true }),
  backhoeLoader: Object.freeze({ words: 'an 8.5 t backhoe loader', mass: 8500, power: 70, drive: 'all', share: 1, wheelbase: 2.2, track: 1.9, wheelRadius: 0.65, CdA: 6.5, Crr: 0.025, cgH: 1.2, L: 5.9, W: 2.35, H: 3.85, eye: 2.3, grip: 0.75, brakeEff: 0.8, turn: 4.2, band: 0.75, governor: kmh(40), site: true }),
  skidSteer:     Object.freeze({ words: 'a 3.3 t skid steer loader', mass: 3300, power: 55, drive: 'all', share: 1, wheelbase: 1.1, track: 1.5, wheelRadius: 0.4, CdA: 3.5, Crr: 0.025, cgH: 0.75, L: 3.5, W: 1.8, H: 2.05, eye: 1.6, grip: 0.75, brakeEff: 0.8, turn: 1.8, band: 0.75, governor: kmh(12), steer: 'skid', site: true }),
  compactTrackLoader: Object.freeze({ words: 'a 4.3 t compact track loader', mass: 4300, power: 70, drive: 'all', share: 1, wheelbase: 1.5, track: 1.5, wheelRadius: 0.1, CdA: 3.8, Crr: 0.05, cgH: 0.75, L: 3.7, W: 1.95, H: 2.1, eye: 1.6, grip: 0.8, brakeEff: 0.8, turn: 1.9, band: 0.7, governor: kmh(13), running: 'track', site: true }),
  telehandler:   Object.freeze({ words: 'a telehandler, 4 t to 14 m, every wheel steered', mass: 10500, power: 75, drive: 'all', share: 1, wheelbase: 2.9, track: 1.95, wheelRadius: 0.62, CdA: 6.0, Crr: 0.025, cgH: 1.1, L: 6.7, W: 2.4, H: 2.45, eye: 2.0, grip: 0.75, brakeEff: 0.8, turn: 3.8, band: 0.75, governor: kmh(40), steer: 'all', site: true }),
  forklift:      Object.freeze({ words: 'a 2.5 t counterbalance forklift, steered by its rear wheels', mass: 4200, power: 40, drive: 'front', share: 0.4, wheelbase: 1.6, track: 0.97, wheelRadius: 0.33, CdA: 2.5, Crr: 0.02, cgH: 0.75, L: 3.6, W: 1.15, H: 2.15, eye: 1.85, grip: 0.75, brakeEff: 0.8, turn: 2.3, band: 0.75, governor: kmh(19), steer: 'rear', site: true }),
  tipperTruck:   Object.freeze({ words: 'an 8x4 tipper, loaded', mass: 32000, power: 330, drive: 'rear', share: 0.6, wheelbase: 5.4, track: 2.05, wheelRadius: 0.53, CdA: 7.0, Crr: 0.008, cgH: 1.9, L: 9.6, W: 2.55, H: 3.3, eye: 2.4, grip: 0.7, brakeEff: 0.65, turn: 10.5, band: 0.85, governor: kmh(90), site: true }),
  mixerTruck:    Object.freeze({ words: 'an 8x4 concrete mixer, loaded', mass: 32000, power: 300, drive: 'rear', share: 0.6, wheelbase: 5.0, track: 2.05, wheelRadius: 0.53, CdA: 8.0, Crr: 0.008, cgH: 2.1, L: 10.0, W: 2.55, H: 3.95, eye: 2.4, grip: 0.7, brakeEff: 0.65, turn: 10, band: 0.85, governor: kmh(90), site: true }),
  articulatedDumpTruck: Object.freeze({ words: 'a 30 t articulated dump truck, loaded', mass: 53000, power: 280, drive: 'all', share: 1, wheelbase: 4.4, track: 2.3, wheelRadius: 0.8, CdA: 10, Crr: 0.02, cgH: 2.0, L: 10.5, W: 3.0, H: 3.6, eye: 2.8, grip: 0.7, brakeEff: 0.7, turn: 8.5, band: 0.85, governor: kmh(55), steer: 'articulated', site: true }),
  haulTruck:     Object.freeze({ words: 'a 100 t rigid haul truck, loaded', mass: 165000, power: 780, drive: 'rear', share: 0.66, wheelbase: 4.6, track: 4.1, wheelRadius: 1.35, CdA: 25, Crr: 0.015, cgH: 2.6, L: 10.5, W: 6.1, H: 5.2, eye: 4.5, grip: 0.7, brakeEff: 0.7, turn: 10.2, band: 0.85, governor: kmh(64), site: true }),
  mobileCrane:   Object.freeze({ words: 'a five-axle all-terrain crane, every axle steered', mass: 60000, power: 400, drive: 'all', share: 1, wheelbase: 9.2, track: 2.15, wheelRadius: 0.67, CdA: 10, Crr: 0.01, cgH: 1.9, L: 14.5, W: 2.75, H: 3.95, eye: 2.6, grip: 0.7, brakeEff: 0.7, turn: 11, band: 0.85, governor: kmh(85), steer: 'all', site: true }),
  roadRoller:    Object.freeze({ words: 'a 10 t tandem roller, its two drums', mass: 10000, power: 85, drive: 'all', share: 1, wheelbase: 3.4, track: 1.7, wheelRadius: 0.6, CdA: 5.0, Crr: 0.03, cgH: 1.1, L: 4.6, W: 1.85, H: 3.0, eye: 2.4, grip: 0.7, brakeEff: 0.8, turn: 5.5, band: 0.75, governor: kmh(12), steer: 'articulated', site: true }),
  motorGrader:   Object.freeze({ words: 'a 17 t motor grader, its moldboard on its circle', mass: 17000, power: 160, drive: 'rear', share: 0.72, wheelbase: 6.2, track: 2.1, wheelRadius: 0.75, CdA: 8.0, Crr: 0.025, cgH: 1.3, L: 9.0, W: 2.5, H: 3.3, eye: 2.8, grip: 0.75, brakeEff: 0.8, turn: 7.4, band: 0.8, governor: kmh(45), steer: 'articulated', site: true }),
});

/** How a class stands on its wheels: two in line (track 0), a three-wheeler's `layout` (sidecar | delta | tadpole), or
 *  axles (two wheels or a track each side of every axle: a car, a truck, a tank). */
export const WHEEL_LAYOUTS = Object.freeze(['inline', 'sidecar', 'delta', 'tadpole', 'axles']);
export const wheelLayout = (v) => (v.layout ?? (v.track ? 'axles' : 'inline'));
/** How a class turns: by its front wheels (the default), its rear (a forklift), every axle (a telehandler, an
 *  all-terrain crane), its frame bending between its halves (a loader, a dump truck, a roller, a grader), or by skid,
 *  each side's wheels or track driven apart (a skid steer, every crawler). */
export const STEERS = Object.freeze(['front', 'rear', 'all', 'articulated', 'skid']);
export const steerOf = (v) => v.steer ?? (v.running === 'track' ? 'skid' : 'front');
/** A site's machine (`site: true`): its body is the construction shelf's (construction-shelf/), never the car sheet's. */
export const siteClass = (v) => Boolean(v?.site);

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
