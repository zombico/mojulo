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
};
