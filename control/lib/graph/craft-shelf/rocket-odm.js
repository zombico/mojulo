/**
 * rocket-odm — the craft shelf's launch vehicle parts, rows as every shelf part is (craft-odm.js's head says what a row
 * holds), merged into CRAFT_ODM, in their own realm (`launch`): what lifts from a pad to orbit and what comes back. A
 * launcher is assembled as a craft is, along its own +y from its tail (its first stage at the origin, its upper stage on
 * the first's top, its fairing or its capsule on the upper's), and stood on its tail by its archetype (`stand:
 * 'vertical'`). A new launch part is a row first.
 *
 * Kinds (ROCKET_KINDS):
 *   rocket-stage    a stage's body from its tail up: a core (a painted tank, its raceway, its interstage over the stage
 *                   above's engine, its engine section's skirt; a side core's nose cone), a foam tank (an external tank's
 *                   ogive and spike, its intertank's ribs, its orbiter's and its boosters' attach fittings; a heavy core's
 *                   engine section and its flat top), or a stainless hull (its chines, its hot-staging ring; a ship's nose
 *                   and its heat shield's tiles down its windward side). Points: `top`, `engines`, `fins`, `legs`,
 *                   `side` (a strap-on's or a side core's axis), `orbiter` (the orbiter's belly fitting), `flapsFore`,
 *                   `flapsAft`
 *   rocket-booster  a solid booster: its nose cone, its segments and their joints, its attach rings, its aft skirt flared
 *                   round its nozzle
 *   rocket-engine   an engine cluster under a stage, its bells out below its mount: one, an octagonal nine, a triangle of
 *                   three, a square of four, rings of thirty-three, a ship's three and three
 *   rocket-fairing  a payload fairing: its boat-tail from the stage's diameter, its barrel, its ogive, its split line
 *   rocket-capsule  a crew capsule: its trunk, its heat shield, its cone and its windows, its nose cap; a deep-space
 *                   capsule's service module and its launch abort tower
 *   rocket-fins     a stage's grid fins (stowed flat against it, or out: `pose.fins`), or a ship's flaps, two a set
 *   rocket-legs     landing legs folded up a stage's tail (or splayed: `pose.legs`), their feet
 *   rocket-orbiter  the winged orbiter: its fuselage and flight deck, its double-delta wing, its fin and split rudder, its
 *                   manoeuvring pods, its three main engines, its body flap, its tiles black under and white over, its
 *                   gear down on the ground (`pose.gear`: 1 up). Points: `mount` (its belly's fitting to the tank)
 *
 * A row's figures are its class's (a reusable medium launcher's 3.66 m core, a winged orbiter's 23.8 m span); a row is a
 * class, never a type, and wears no agency's or company's markings.
 */

export const ROCKET_KINDS = Object.freeze({
  'rocket-stage': 'a launch vehicle stage: its tank, its interstage, its engine section (a core, a foam tank, a stainless hull)',
  'rocket-booster': 'a solid rocket booster strapped to a core: its nose, segments, attach rings and aft skirt',
  'rocket-engine': 'a stage\'s engines: one bell, or a cluster of them under its mount',
  'rocket-fairing': 'a payload fairing on an upper stage',
  'rocket-capsule': 'a crew capsule on an upper stage: its trunk or service module, its heat shield, its cone, an abort tower',
  'rocket-fins': 'a stage\'s grid fins, or a ship\'s flaps',
  'rocket-legs': 'a reusable stage\'s landing legs',
  'rocket-orbiter': 'a winged orbiter: fuselage, double-delta wing, fin, pods, main engines, tiles, gear',
});

const L = 'launch';
export const ROCKET_ODM = {
  // ===== the reusable medium launcher: a 3.66 m two-stage kerosene launcher, its first stage landing on its legs =====
  'stage-medium-1': {
    kind: 'rocket-stage', realm: L, label: 'reusable first stage', classOf: 'reusable medium launcher first stage (3.66 m)',
    aliases: ['first stage', 'booster stage', 'reusable first stage'], dims: { length: 47.0, diameter: 3.66 }, mass: 25600, mount: null,
    build: { family: 'core', interstage: 6.6, skirt: 1.4, raceway: true, bands: [[0.02, 0.05]], points: { fins: 46.2, legs: 0.5 } },
  },
  // (a three-core heavy's side core: the same stage, a nose cone where its interstage was)
  'stage-medium-side': {
    kind: 'rocket-stage', realm: L, label: 'heavy launcher side core', classOf: 'three-core heavy launcher side core (3.66 m)',
    aliases: ['side core', 'side booster core', 'strap-on core'], dims: { length: 47.0, diameter: 3.66 }, mass: 25600, mount: null,
    build: { family: 'core', nose: 6.0, skirt: 1.4, raceway: true, bands: [[0.02, 0.05]], points: { fins: 40.2, legs: 0.5 } },
  },
  // (a heavy's centre core: the same stage, its side cores' attach points)
  'stage-medium-centre': {
    kind: 'rocket-stage', realm: L, label: 'heavy launcher centre core', classOf: 'three-core heavy launcher centre core (3.66 m)',
    aliases: ['centre core', 'center core'], dims: { length: 47.0, diameter: 3.66 }, mass: 27000, mount: null,
    build: { family: 'core', interstage: 6.6, skirt: 1.4, raceway: true, bands: [[0.02, 0.05]], side: 0.42, points: { fins: 46.2, legs: 0.5 } },
  },
  'stage-medium-2': {
    kind: 'rocket-stage', realm: L, label: 'upper stage', classOf: 'reusable medium launcher second stage (3.66 m)',
    aliases: ['second stage', 'upper stage'], dims: { length: 9.6, diameter: 3.66 }, mass: 4500, mount: null,
    build: { family: 'core', skirt: 0, raceway: true, bands: [] },
  },
  // ===== the stainless super-heavy: a 9 m booster and its ship ==========================================================
  'stage-super-booster': {
    kind: 'rocket-stage', realm: L, label: 'super heavy booster', classOf: 'fully reusable super-heavy booster (9 m)',
    aliases: ['super heavy booster', 'stainless booster', 'megarocket booster'], dims: { length: 71.0, diameter: 9.0 }, mass: 200000, mount: null,
    build: { family: 'stainless', hotStage: 1.8, chines: true, skirt: 2.0, points: { fins: 66.5 } },
  },
  'stage-super-ship': {
    kind: 'rocket-stage', realm: L, label: 'stainless ship', classOf: 'fully reusable super-heavy upper stage (9 m)',
    aliases: ['stainless ship', 'starship stage', 'reusable ship'], dims: { length: 50.0, diameter: 9.0 }, mass: 100000, mount: null,
    build: { family: 'stainless', nose: 17.0, tiles: true, skirt: 1.6, points: { flapsFore: 41.0, flapsAft: 4.0 } },
  },
  // ===== the winged orbiter's stack: its external tank and two solid boosters ==========================================
  'stage-external-tank': {
    kind: 'rocket-stage', realm: L, label: 'external tank', classOf: 'winged orbiter external tank (8.4 m)',
    aliases: ['external tank', 'orange tank', 'shuttle tank'], dims: { length: 46.9, diameter: 8.4 }, mass: 26500, mount: null,
    build: { family: 'tank', nose: 10.5, spike: 1.3, intertank: [28.6, 35.4], foam: '#c56a2a', side: 6.4, sideAt: -7.0, orbiter: { at: 4.4, gap: 1.45 } },
  },
  // ===== the heavy-lift crew rocket: its orange core, its upper stage on its adapter ===================================
  'stage-heavy-core': {
    kind: 'rocket-stage', realm: L, label: 'heavy-lift core stage', classOf: 'heavy-lift crew rocket core stage (8.4 m)',
    aliases: ['core stage', 'heavy lift core', 'orange core'], dims: { length: 64.6, diameter: 8.4 }, mass: 85000, mount: null,
    build: { family: 'tank', intertank: [41.0, 47.2], foam: '#c56a2a', side: 6.4, sideAt: -3.0, engineSection: 6.0 },
  },
  'stage-heavy-upper': {
    kind: 'rocket-stage', realm: L, label: 'cryogenic upper stage on its adapter', classOf: 'heavy-lift crew rocket upper stage (5 m)',
    aliases: ['cryogenic upper stage', 'interim upper stage'], dims: { length: 13.7, diameter: 5.0 }, mass: 9000, mount: null,
    build: { family: 'core', adapter: { from: 8.4, len: 8.6 }, skirt: 0, raceway: false, bands: [] },
  },
  // ===== solid boosters ===================================================================================
  'srb-four': {
    kind: 'rocket-booster', realm: L, label: 'four-segment solid rocket booster', classOf: 'winged orbiter solid rocket booster (3.7 m, 4 segments)',
    aliases: ['solid rocket booster', 'srb', 'shuttle booster'], dims: { length: 45.6, diameter: 3.71 }, mass: 91000, perf: { thrust: 12500 }, mount: null,
    build: { family: 'solid', segments: 4, nose: 5.4, skirt: 3.6, flare: 5.2 },
  },
  'srb-five': {
    kind: 'rocket-booster', realm: L, label: 'five-segment solid rocket booster', classOf: 'heavy-lift crew rocket solid rocket booster (3.7 m, 5 segments)',
    aliases: ['five segment booster', 'five-segment srb'], dims: { length: 54.0, diameter: 3.71 }, mass: 100000, perf: { thrust: 16000 }, mount: null,
    build: { family: 'solid', segments: 5, nose: 6.0, skirt: 3.6, flare: 5.2 },
  },
  // ===== engines ===================================================================================
  'eng-octaweb-9': {
    kind: 'rocket-engine', realm: L, label: 'nine-engine octaweb', classOf: 'reusable medium launcher first stage engines (9 × kerosene)',
    aliases: ['octaweb', 'nine engines', 'first stage engines'], dims: { length: 1.6, diameter: 3.66 }, mass: 4300, perf: { thrust: 7600 }, mount: 'engine-mount',
    build: { family: 'cluster', pattern: 'octaweb', bell: [0.46, 1.5], ring: 1.28 },
  },
  'eng-vacuum-1': {
    kind: 'rocket-engine', realm: L, label: 'vacuum engine', classOf: 'medium launcher upper stage vacuum engine',
    aliases: ['vacuum engine', 'upper stage engine'], dims: { length: 4.2, diameter: 3.3 }, mass: 500, perf: { thrust: 980 }, mount: 'engine-mount',
    build: { family: 'cluster', pattern: 'single', bell: [1.6, 4.2], ring: 0 },
  },
  'eng-raptor-33': {
    kind: 'rocket-engine', realm: L, label: 'thirty-three-engine cluster', classOf: 'super-heavy booster engines (33 × methane)',
    aliases: ['thirty three engines', '33 engines', 'booster engines'], dims: { length: 1.8, diameter: 9.0 }, mass: 53000, perf: { thrust: 74000 }, mount: 'engine-mount',
    build: { family: 'cluster', pattern: 'rings33', bell: [0.62, 1.6], ring: 0 },
  },
  'eng-raptor-6': {
    kind: 'rocket-engine', realm: L, label: 'ship engines', classOf: 'super-heavy ship engines (3 sea-level, 3 vacuum)',
    aliases: ['ship engines', 'vacuum and sea level engines'], dims: { length: 3.2, diameter: 9.0 }, mass: 9600, perf: { thrust: 14000 }, mount: 'engine-mount',
    build: { family: 'cluster', pattern: 'ship', bell: [0.62, 1.6], vac: [1.15, 3.2], ring: 0 },
  },
  'eng-core-4': {
    kind: 'rocket-engine', realm: L, label: 'four-engine core cluster', classOf: 'heavy-lift crew rocket core engines (4 × hydrogen)',
    aliases: ['four engines', 'core engines'], dims: { length: 2.5, diameter: 8.4 }, mass: 14000, perf: { thrust: 8800 }, mount: 'engine-mount',
    build: { family: 'cluster', pattern: 'square4', bell: [1.15, 2.5], ring: 2.0 },
  },
  // ===== fairing, capsules ==========================================================================
  'fairing-medium': {
    kind: 'rocket-fairing', realm: L, label: 'payload fairing', classOf: 'medium launcher payload fairing (5.2 m)',
    aliases: ['payload fairing', 'nose fairing', 'fairing'], dims: { length: 13.1, diameter: 5.2 }, mass: 1900, mount: 'stage-top',
    build: { family: 'ogive', base: 3.66, tail: 1.6, barrel: 5.4 },
  },
  'capsule-crew': {
    kind: 'rocket-capsule', realm: L, label: 'crew capsule and trunk', classOf: 'commercial crew capsule (4 m, four seats)',
    aliases: ['crew capsule', 'capsule', 'four seat capsule'], dims: { length: 8.1, diameter: 4.0 }, mass: 12500, mount: 'stage-top',
    build: { family: 'capsule', trunk: 3.7, base: 3.66, cone: 3.6, nose: 0.8, windows: 4, pushers: true },
  },
  'capsule-deep': {
    kind: 'rocket-capsule', realm: L, label: 'deep-space capsule, service module and abort tower', classOf: 'deep-space crew capsule (5 m) and launch abort system',
    aliases: ['deep space capsule', 'deep-space capsule', 'abort tower'], dims: { length: 19.3, diameter: 5.0 }, mass: 34000, mount: 'stage-top',
    build: { family: 'capsule', trunk: 4.8, base: 5.0, cone: 3.3, nose: 0, windows: 4, tower: 9.3, wings: true },
  },
  // ===== fins, legs ===================================================================================
  'gridfins-medium': {
    kind: 'rocket-fins', realm: L, label: 'grid fins', classOf: 'reusable first stage grid fins (4)',
    aliases: ['grid fins', 'lattice fins'], dims: { span: 1.5, chord: 1.2, diameter: 3.66 }, mass: 400, mount: 'fin-ring',
    build: { family: 'grid', n: 4, cells: [6, 5] },
  },
  'gridfins-super': {
    kind: 'rocket-fins', realm: L, label: 'super heavy grid fins', classOf: 'super-heavy booster grid fins (4)',
    aliases: ['super heavy grid fins', 'booster grid fins'], dims: { span: 3.2, chord: 4.5, diameter: 9.0 }, mass: 12000, mount: 'fin-ring',
    build: { family: 'grid', n: 4, cells: [5, 7], at: 45 },
  },
  'flaps-ship-fore': {
    kind: 'rocket-fins', realm: L, label: 'forward flaps', classOf: 'super-heavy ship forward flaps (2)',
    aliases: ['forward flaps', 'nose flaps'], dims: { span: 3.0, chord: 6.0, diameter: 7.4 }, mass: 3000, mount: 'fin-ring',
    build: { family: 'flap', n: 2, taper: 0.55 },
  },
  'flaps-ship-aft': {
    kind: 'rocket-fins', realm: L, label: 'aft flaps', classOf: 'super-heavy ship aft flaps (2)',
    aliases: ['aft flaps', 'rear flaps'], dims: { span: 4.0, chord: 9.0, diameter: 9.0 }, mass: 6000, mount: 'fin-ring',
    build: { family: 'flap', n: 2, taper: 0.8 },
  },
  'legs-medium': {
    kind: 'rocket-legs', realm: L, label: 'landing legs', classOf: 'reusable first stage landing legs (4)',
    aliases: ['landing legs', 'rocket legs'], dims: { length: 9.5, diameter: 3.66 }, mass: 2000, mount: 'leg-ring',
    build: { family: 'folded', n: 4 },
  },
  // ===== the winged orbiter ===================================================================================
  'orbiter-winged': {
    kind: 'rocket-orbiter', realm: L, label: 'winged orbiter', classOf: 'winged reusable orbiter (37 m, double delta)',
    aliases: ['orbiter', 'space shuttle orbiter', 'winged orbiter', 'shuttle orbiter'], dims: { length: 37.24, span: 23.79, height: 17.25 }, mass: 78000, perf: { thrust: 6000 }, mount: 'tank-fitting',
    build: { family: 'orbiter', fuselage: { width: 5.2, height: 5.8 } },
  },
  // (the same orbiter on its tank: its gear stowed)
  'orbiter-stacked': {
    kind: 'rocket-orbiter', realm: L, label: 'winged orbiter, stacked', classOf: 'winged reusable orbiter class, on its external tank',
    aliases: ['stacked orbiter', 'orbiter on its tank'], dims: { length: 37.24, span: 23.79, height: 17.25 }, mass: 78000, perf: { thrust: 6000 }, mount: 'tank-fitting',
    build: { family: 'orbiter', stacked: true, fuselage: { width: 5.2, height: 5.8 } },
  },

  // ===== the older launchers ====================================================================================
  // (the three-stage moon rocket: its 10 m first stage, its roll pattern's black quadrants, its five engines under their
  // fairings and four fins; its second stage; its third stage on its cone up from the second's diameter, its adapter
  // tapering over the lander it carries; its command module and service module under its escape tower)
  'stage-moon-1': {
    kind: 'rocket-stage', realm: L, label: 'moon rocket first stage', classOf: 'three-stage moon rocket first stage (10.1 m)',
    aliases: ['moon rocket first stage', 'kerosene first stage'], dims: { length: 36.5, diameter: 10.1 }, mass: 131000, mount: null,
    build: { family: 'core', skirt: 0, raceway: false, rings: [[35.4, 36.5]], stripes: [{ from: 0.4, to: 8.5, start: 0, n: 2, width: 90 }, { from: 25.0, to: 33.5, start: 90, n: 2, width: 90 }], points: { fins: 0 } },
  },
  'stage-moon-2': {
    kind: 'rocket-stage', realm: L, label: 'moon rocket second stage', classOf: 'three-stage moon rocket second stage (10.1 m)',
    aliases: ['moon rocket second stage'], dims: { length: 24.9, diameter: 10.1 }, mass: 36000, mount: null,
    build: { family: 'core', skirt: 0, raceway: false, rings: [[0, 0.5]] },
  },
  'stage-moon-3': {
    kind: 'rocket-stage', realm: L, label: 'moon rocket third stage and lander adapter', classOf: 'three-stage moon rocket third stage (6.6 m) and lander adapter',
    aliases: ['moon rocket third stage', 'lander adapter'], dims: { length: 27.2, diameter: 6.6 }, mass: 15200, mount: null,
    build: { family: 'core', adapter: { from: 10.1, len: 5.0 }, taperTop: { to: 3.9, len: 8.5 }, raceway: false, rings: [[17.8, 18.7]], stripes: [{ from: 5.0, to: 8.4, start: 0, n: 1, width: 180 }] },
  },
  'eng-moon-5': {
    kind: 'rocket-engine', realm: L, label: 'five big kerosene engines', classOf: 'three-stage moon rocket first stage engines (5 × 1.5 Mlbf)',
    aliases: ['five engines', 'five big engines'], dims: { length: 5.6, diameter: 10.1 }, mass: 42000, perf: { thrust: 34000 }, mount: 'engine-mount',
    build: { family: 'cluster', pattern: 'quincunx', bell: [1.78, 5.6], ring: 3.25 },
  },
  'fins-moon-tail': {
    kind: 'rocket-fins', realm: L, label: 'moon rocket tail fins and engine fairings', classOf: 'three-stage moon rocket fins (4) and engine fairings',
    aliases: ['tail fins', 'moon rocket fins', 'engine fairings'], dims: { span: 4.6, chord: 6.0, diameter: 10.1 }, mass: 4000, mount: 'fin-ring',
    build: { family: 'tail', n: 4, at: 45, tip: 2.0, sweep: 0.2, foot: -1.5, thick: 0.3, fairing: { at: 3.25, y0: -1.6, y1: 4.8, r0: 2.0, r1: 1.0 } },
  },
  'capsule-moon': {
    kind: 'rocket-capsule', realm: L, label: 'command and service module under its escape tower', classOf: 'three-man lunar command and service module (3.9 m) and escape tower',
    aliases: ['command module', 'command and service module', 'lunar capsule'], dims: { length: 17.6, diameter: 3.9 }, mass: 30000, mount: 'stage-top',
    build: { family: 'capsule', trunk: 3.9, base: 3.9, cone: 3.2, nose: 0, windows: 0, tower: 8.6, towerR: 0.32, trunkFins: false },
  },
  // (the early single-seat capsule rocket: its finned stage, its capsule's cone and its slim escape tower)
  'stage-early': {
    kind: 'rocket-stage', realm: L, label: 'early finned single stage', classOf: 'early single-stage crew launcher (1.78 m)',
    aliases: ['early finned stage', 'single stage booster'], dims: { length: 17.7, diameter: 1.78 }, mass: 4000, mount: null,
    build: { family: 'core', skirt: 0, raceway: false, rings: [[16.4, 17.7]], points: { fins: 0 } },
  },
  'eng-early-1': {
    kind: 'rocket-engine', realm: L, label: 'early single engine', classOf: 'early single-stage crew launcher engine',
    aliases: ['early single engine'], dims: { length: 0.8, diameter: 1.78 }, mass: 600, perf: { thrust: 350 }, mount: 'engine-mount',
    build: { family: 'cluster', pattern: 'single', bell: [0.42, 0.8], ring: 0 },
  },
  'fins-early-tail': {
    kind: 'rocket-fins', realm: L, label: 'early stage tail fins', classOf: 'early single-stage crew launcher fins (4)',
    aliases: ['early tail fins', 'small tail fins'], dims: { span: 0.95, chord: 2.6, diameter: 1.78 }, mass: 150, mount: 'fin-ring',
    build: { family: 'tail', n: 4, at: 45, tip: 1.4, sweep: 0.1, foot: -0.3, thick: 0.1 },
  },
  'capsule-early': {
    kind: 'rocket-capsule', realm: L, label: 'single-seat capsule and escape tower', classOf: 'single-seat capsule (1.9 m) and escape tower',
    aliases: ['single seat capsule', 'one man capsule'], dims: { length: 7.3, diameter: 1.89 }, mass: 1400, mount: 'stage-top',
    build: { family: 'capsule', trunk: 0.35, base: 1.78, taper: true, cone: 1.9, nose: 0.75, windows: 1, tower: 4.0, towerR: 0.16 },
  },
  // (the two-seat capsule rocket: two stages and a two-chamber engine, its capsule on its adapter)
  'stage-twoseat-1': {
    kind: 'rocket-stage', realm: L, label: 'two-seat capsule rocket first stage', classOf: 'two-stage crew launcher first stage (3.05 m)',
    aliases: ['two seat rocket first stage'], dims: { length: 17.2, diameter: 3.05 }, mass: 7000, mount: null,
    build: { family: 'core', skirt: 0.6, raceway: true, rings: [[16.2, 17.2]] },
  },
  'stage-twoseat-2': {
    kind: 'rocket-stage', realm: L, label: 'two-seat capsule rocket second stage', classOf: 'two-stage crew launcher second stage (3.05 m)',
    aliases: ['two seat rocket second stage'], dims: { length: 8.0, diameter: 3.05 }, mass: 2500, mount: null,
    build: { family: 'core', skirt: 0, raceway: true, bands: [] },
  },
  'eng-twoseat-pair': {
    kind: 'rocket-engine', realm: L, label: 'two-chamber engine', classOf: 'two-stage crew launcher first stage engine (2 chambers)',
    aliases: ['two chamber engine', 'twin chamber engine'], dims: { length: 2.2, diameter: 3.05 }, mass: 1500, perf: { thrust: 1900 }, mount: 'engine-mount',
    build: { family: 'cluster', pattern: 'pair', bell: [0.72, 2.2], ring: 0.76 },
  },
  'capsule-twoseat': {
    kind: 'rocket-capsule', realm: L, label: 'two-seat capsule on its adapter', classOf: 'two-seat capsule (2.3 m) on its adapter',
    aliases: ['two seat capsule', 'two man capsule'], dims: { length: 5.9, diameter: 2.3 }, mass: 3800, mount: 'stage-top',
    build: { family: 'capsule', trunk: 2.3, base: 3.05, taper: true, cone: 2.2, nose: 1.1, windows: 2 },
  },
  // (the four-booster cluster rocket: its waisted core between four tapered strap-ons, its upper stage on its truss, its
  // fairing under its escape tower and its grid finlets)
  'stage-cluster-core': {
    kind: 'rocket-stage', realm: L, label: 'cluster rocket core', classOf: 'four-booster cluster crew launcher core (2.95 m, waisted)',
    aliases: ['cluster rocket core', 'waisted core'], dims: { length: 27.8, diameter: 2.95 }, mass: 6500, mount: null,
    build: { family: 'core', skirt: 0, raceway: false, profile: [[0, 0.7], [0.66, 0.7], [0.86, 1], [1, 1]], rings: [[27.1, 27.8]], sides: [['side', 2.37, 45, 0], ['sideB', 2.37, -45, 0]] },
  },
  'eng-cluster-core': {
    kind: 'rocket-engine', realm: L, label: 'four-chamber core engine', classOf: 'four-booster cluster crew launcher core engine (4 chambers)',
    aliases: ['four chamber engine', 'core four chamber engine'], dims: { length: 1.3, diameter: 2.06 }, mass: 1300, perf: { thrust: 990 }, mount: 'engine-mount',
    build: { family: 'cluster', pattern: 'square4', bell: [0.3, 1.3], ring: 0.55 },
  },
  'booster-cluster': {
    kind: 'rocket-booster', realm: L, label: 'tapered strap-on booster', classOf: 'four-booster cluster crew launcher strap-on (2.68 m at its base)',
    aliases: ['tapered strap on', 'tapered booster', 'cone booster'], dims: { length: 19.6, diameter: 2.68 }, mass: 3800, perf: { thrust: 1000 }, mount: null,
    build: { family: 'conic', top: 0.9, nose: 3.0 },
  },
  'stage-cluster-upper': {
    kind: 'rocket-stage', realm: L, label: 'cluster rocket upper stage', classOf: 'four-booster cluster crew launcher upper stage (2.66 m)',
    aliases: ['cluster rocket upper stage'], dims: { length: 6.7, diameter: 2.66 }, mass: 2400, mount: null,
    build: { family: 'core', skirt: 0, raceway: false, bands: [] },
  },
  'fairing-cluster': {
    kind: 'rocket-fairing', realm: L, label: 'crew fairing under its escape tower', classOf: 'four-booster cluster crew launcher fairing (3 m) and escape tower',
    aliases: ['crew fairing', 'escape tower fairing'], dims: { length: 11.0, diameter: 3.0 }, mass: 4500, mount: 'stage-top',
    build: { family: 'ogive', base: 2.66, tail: 0.6, barrel: 3.6, tower: 3.8, towerR: 0.22, finlets: true },
  },
  // (the side-mount orbiter stack: a heavy core with its four strap-ons, the winged orbiter on its side, its own main
  // engines none: it rides on the core's)
  'stage-heavy-core-side': {
    kind: 'rocket-stage', realm: L, label: 'heavy core for a side-mounted orbiter', classOf: 'side-mount orbiter heavy core (7.75 m)',
    aliases: ['heavy core', 'side mount core'], dims: { length: 55.7, diameter: 7.75 }, mass: 70000, mount: null,
    build: { family: 'core', skirt: 0, raceway: false, nose: 9.0, rings: [[0, 5.0]], sides: [['side', 6.04, -15, 0], ['sideB', 6.04, 35, 0]], orbiter: { at: 6.0, gap: 1.6, span: 22.0 } },
  },
  'eng-heavy-core-4': {
    kind: 'rocket-engine', realm: L, label: 'four hydrogen engines', classOf: 'side-mount orbiter heavy core engines (4 × hydrogen)',
    aliases: ['four hydrogen engines'], dims: { length: 3.0, diameter: 7.75 }, mass: 14000, perf: { thrust: 7600 }, mount: 'engine-mount',
    build: { family: 'cluster', pattern: 'square4', bell: [1.1, 3.0], ring: 2.3 },
  },
  'stage-strapon-side': {
    kind: 'rocket-stage', realm: L, label: 'liquid strap-on', classOf: 'side-mount orbiter heavy core strap-on (3.92 m)',
    aliases: ['liquid strap on', 'liquid booster'], dims: { length: 39.5, diameter: 3.92 }, mass: 35000, mount: null,
    build: { family: 'core', skirt: 0, raceway: false, nose: 4.5, rings: [[0, 3.0]] },
  },
  'eng-strapon-4': {
    kind: 'rocket-engine', realm: L, label: 'four-chamber kerosene engine', classOf: 'side-mount orbiter strap-on engine (4 chambers)',
    aliases: ['four chamber kerosene engine'], dims: { length: 1.8, diameter: 3.92 }, mass: 9800, perf: { thrust: 7900 }, mount: 'engine-mount',
    build: { family: 'cluster', pattern: 'square4', bell: [0.55, 1.8], ring: 0.85 },
  },
  'orbiter-side-stacked': {
    kind: 'rocket-orbiter', realm: L, label: 'winged orbiter without main engines, stacked', classOf: 'second winged orbiter class (36 m), on its heavy core',
    aliases: ['orbiter without main engines', 'unpowered orbiter'], dims: { length: 36.37, span: 23.92, height: 16.35 }, mass: 62000, perf: { thrust: 0 }, mount: 'tank-fitting',
    build: { family: 'orbiter', stacked: true, mainEngines: false, dragChute: true, fuselage: { width: 5.6, height: 5.6 } },
  },
};
