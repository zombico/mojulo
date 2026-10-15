/**
 * craft-odm — the ODM inventory of the craft shelf: one row per off-the-shelf flight part, the
 * catalogue an airframer (or a starfighter yard) builds from. A new part is a row first.
 *
 * Two realms on one shelf, one ruler (metres, kilograms, kilonewtons, kilowatts):
 *  - `earth`: parts sized to the real class they are named for (`classOf`): a CFM56-class fan
 *    is 1.73 m across, a 172-class wing spans 11 m. Figures are the public class figures, rounded;
 *    a row is a class, not a type certificate.
 *  - `space`: starfighter and shuttle parts in the register of film and game spacecraft
 *    (snubfighters, twin-panel interceptors, colonial vipers, carrier heavy fighters), held to
 *    the same ruler: a cockpit fits a 1.8 m pilot, a strut carries the hull's mass, a drive's
 *    thrust gives a plausible few g. Names are generic: a register, never a franchise's ship.
 *
 * A row:
 *   kind      the part kind (`craft-fuselage`, `craft-wing`, …): the BOM key, the builder
 *   realm     'earth' | 'space'
 *   label     what the part is called in prose
 *   classOf   the real class (earth) or the register (space) it is sized from
 *   aliases   the words people say for it
 *   dims      its envelope in metres (kind-specific keys: length/width/height, span, diameter …)
 *   mass      kilograms, the part as delivered (structure only for an airframe section)
 *   perf      what it does: { thrust } kN, { power } kW, { rounds } per minute …, when it does
 *   mount     the mount family it fits (`wing-root`, `pod-mount`, `hub-mount`, `gear-well` …)
 *   build     the builder's dials (craft-parts.js reads them); `points` are named hardpoints
 *
 * Fuselage station rows are `[s, width, height, centre]` — fractions of length (0 nose → 1
 * tail), of the width and height dims, and the section centre over the height. Fuselage points
 * are `[s, xf, zf]` on the local section; wing points `[span fraction, chord fraction, face]`.
 */

export const CRAFT_KINDS = {
  'craft-fuselage': 'the fuselage or hull: the airframe every other part hangs from',
  'craft-wing': 'a wing panel, a starfighter foil or a panel wing (one side; the other is its mirror)',
  'craft-stabilizer': 'a horizontal tail panel (one side)',
  'craft-fin': 'a vertical tail fin',
  'craft-engine': 'a powerplant: piston, turboprop, turbofan, or a spacecraft drive',
  'craft-propeller': 'a propeller: hub, spinner and blades',
  'craft-gear': 'a landing gear leg, bogie or landing strut',
  'craft-canopy': 'a canopy or cockpit window',
  'craft-pylon': 'a pylon, stub or arm that carries an engine or a wing off the airframe',
  'craft-weapon': 'a gun, cannon, missile, launcher or turret on a hardpoint',
  'craft-thruster': 'a reaction-control thruster block',
};

export const CRAFT_REALMS = ['earth', 'space'];

// Shared station tables: a family of airframes is one shape at another size.
const AIRLINER_BARREL = [[0, 0.02, 0.02, 0.45], [0.03, 0.5, 0.52, 0.45], [0.08, 0.92, 0.94, 0.49], [0.14, 1, 1, 0.5], [0.7, 1, 1, 0.5], [0.86, 0.62, 0.66, 0.6], [1, 0.1, 0.22, 0.78]];

export const CRAFT_ODM = {
  // ===== earth: fuselages ======================================================================
  'fus-light-single': {
    kind: 'craft-fuselage', realm: 'earth', label: 'light single cabin fuselage', classOf: 'Cessna 172 class',
    aliases: ['light aircraft fuselage', 'cabin fuselage', 'trainer fuselage'],
    dims: { length: 6.3, width: 1.12, height: 1.45 }, mass: 190, mount: null,
    build: {
      family: 'tube', n: 3.2,
      stations: [[0, 0.9, 0.8, 0.5], [0.08, 1, 1, 0.5], [0.35, 1, 1, 0.52], [0.55, 0.62, 0.62, 0.56], [0.85, 0.28, 0.4, 0.58], [1, 0.12, 0.3, 0.6]],
      windscreen: [0.05, 0.16],
      points: { cowl: [0, 0, -0.05], wingRoot: [0.1, 0, 0.98], mainGear: [0.33, 0.85, -1], noseGear: [0.02, 0, -0.85], stabRoot: [0.92, 0, -0.2], finRoot: [0.85, 0, 0.75] },
    },
  },
  'fus-warbird': {
    kind: 'craft-fuselage', realm: 'earth', label: 'piston fighter fuselage', classOf: 'P-51D class',
    aliases: ['warbird fuselage', 'piston fighter fuselage'],
    dims: { length: 9.0, width: 0.95, height: 1.55 }, mass: 640, mount: null,
    build: {
      family: 'tube', n: 2.4,
      stations: [[0, 0.85, 0.78, 0.52], [0.1, 0.95, 0.94, 0.52], [0.3, 1, 1, 0.5], [0.45, 1, 1, 0.5], [0.62, 0.8, 0.86, 0.52], [0.85, 0.38, 0.6, 0.58], [1, 0.1, 0.36, 0.62]],
      points: { engine: [0.25, 0, 0], wingRoot: [0.3, 0.78, -0.55], canopy: [0.33, 0, 0.88], stabRoot: [0.9, 0, 0], finRoot: [0.82, 0, 0.7], tailGear: [0.9, 0, -0.85] },
    },
  },
  'fus-jet-fighter': {
    kind: 'craft-fuselage', realm: 'earth', label: 'single-engine jet fighter fuselage', classOf: 'F-16 class',
    aliases: ['jet fighter fuselage', 'fighter fuselage'],
    dims: { length: 14.5, width: 1.6, height: 1.9 }, mass: 2900, mount: null,
    build: {
      family: 'tube', n: 2.6, belly: 0.8,
      stations: [[0, 0.02, 0.02, 0.62], [0.08, 0.42, 0.48, 0.62], [0.2, 0.75, 0.8, 0.58], [0.35, 1, 1, 0.5], [0.6, 1, 0.95, 0.5], [0.85, 0.85, 0.75, 0.52], [1, 0.62, 0.6, 0.52]],
      points: { canopy: [0.12, 0, 0.82], wingRoot: [0.42, 0.85, -0.05], engine: [0.707, 0, 0], stabRoot: [0.86, 0.85, -0.05], finRoot: [0.7, 0, 0.92], mainGear: [0.55, 0.55, -1], noseGear: [0.3, 0, -1], gun: [0.27, -0.75, 0.3] },
    },
  },
  'fus-bizjet': {
    kind: 'craft-fuselage', realm: 'earth', label: 'business jet fuselage', classOf: 'Learjet 45 class',
    aliases: ['bizjet fuselage', 'private jet fuselage', 'business jet fuselage'],
    dims: { length: 17.5, width: 1.75, height: 1.9 }, mass: 1700, mount: null,
    build: {
      family: 'tube', n: 2,
      stations: [[0, 0.02, 0.02, 0.45], [0.06, 0.55, 0.55, 0.45], [0.16, 0.95, 0.95, 0.5], [0.25, 1, 1, 0.5], [0.62, 1, 1, 0.5], [0.82, 0.6, 0.62, 0.6], [1, 0.12, 0.2, 0.75]],
      windscreen: [0.1, 0.17],
      points: { wingRoot: [0.45, 0.82, -0.6], engineStub: [0.74, 0.62, 0.15], finRoot: [0.84, 0, 0.6], mainGear: [0.5, 0.3, -1], noseGear: [0.1, 0, -0.9] },
    },
  },
  'fus-regional': {
    kind: 'craft-fuselage', realm: 'earth', label: 'regional turboprop fuselage', classOf: 'ATR 72 class',
    aliases: ['regional fuselage', 'commuter fuselage', 'turboprop fuselage'],
    dims: { length: 27.0, width: 2.87, height: 2.9 }, mass: 4300, mount: null,
    build: {
      family: 'tube', n: 2,
      stations: [[0, 0.02, 0.02, 0.45], [0.05, 0.6, 0.6, 0.45], [0.12, 0.98, 0.98, 0.5], [0.18, 1, 1, 0.5], [0.7, 1, 1, 0.5], [0.85, 0.62, 0.7, 0.6], [1, 0.12, 0.25, 0.78]],
      windscreen: [0.06, 0.1],
      points: { wingRoot: [0.43, 0, 0.98], finRoot: [0.86, 0, 0.6], mainGear: [0.5, 0.9, -0.8], noseGear: [0.07, 0, -0.9] },
    },
  },
  'fus-narrowbody': {
    kind: 'craft-fuselage', realm: 'earth', label: 'narrowbody airliner fuselage', classOf: 'A320 / 737 class',
    aliases: ['narrowbody fuselage', 'single-aisle fuselage', 'airliner fuselage'],
    dims: { length: 37.6, width: 3.95, height: 4.14 }, mass: 9800, mount: null,
    build: { family: 'tube', n: 2, stations: AIRLINER_BARREL, windscreen: [0.045, 0.075], points: { wingRoot: [0.4, 0.92, -0.6], stabRoot: [0.9, 0.2, 0.1], finRoot: [0.82, 0, 0.75], noseGear: [0.06, 0, -0.9] } },
  },
  'fus-widebody': {
    kind: 'craft-fuselage', realm: 'earth', label: 'widebody airliner fuselage', classOf: '777 class',
    aliases: ['widebody fuselage', 'twin-aisle fuselage', 'jumbo fuselage'],
    dims: { length: 63.7, width: 6.19, height: 6.2 }, mass: 32000, mount: null,
    build: { family: 'tube', n: 2, stations: AIRLINER_BARREL, windscreen: [0.03, 0.05], points: { wingRoot: [0.4, 0.92, -0.6], stabRoot: [0.9, 0.2, 0.1], finRoot: [0.82, 0, 0.75], noseGear: [0.06, 0, -0.9] } },
  },

  // ===== earth: wings, tails ===================================================================
  'wing-light-high': {
    kind: 'craft-wing', realm: 'earth', label: 'high wing panel, light single', classOf: 'Cessna 172 class',
    aliases: ['high wing', 'light aircraft wing'], dims: { span: 5.5 }, mass: 110, mount: 'wing-root',
    build: { rootChord: 1.63, tipChord: 1.12, sweep: 0, dihedral: 1.7, thickness: 0.12, camber: 0.02, twist: 3, hinge: [0.1, 0.95, 0.25], points: { tip: [1, 0.3] } },
  },
  'wing-warbird': {
    kind: 'craft-wing', realm: 'earth', label: 'laminar-flow low wing panel', classOf: 'P-51D class',
    aliases: ['fighter wing', 'warbird wing'], dims: { span: 5.19 }, mass: 420, mount: 'wing-root',
    build: { rootChord: 2.6, tipChord: 1.1, sweep: 2, dihedral: 5, thickness: 0.15, tipThickness: 0.11, camber: 0.015, twist: 2, hinge: [0.05, 0.95, 0.24], points: { gear: [0.22, 0.25, 'lower'], gun: [0.42, 0.62] } },
  },
  'wing-fighter-delta': {
    kind: 'craft-wing', realm: 'earth', label: 'cropped-delta fighter wing panel', classOf: 'F-16 class',
    aliases: ['delta wing', 'jet fighter wing'], dims: { span: 3.95 }, mass: 600, mount: 'wing-root',
    build: { rootChord: 4.8, tipChord: 1.0, sweep: 40, dihedral: 0, thickness: 0.04, hinge: [0.05, 0.62, 0.22], points: { tip: [1, 0.5], station: [0.55, 0.4, 'lower'] } },
  },
  'wing-bizjet': {
    kind: 'craft-wing', realm: 'earth', label: 'swept business jet wing panel', classOf: 'Learjet 45 class',
    aliases: ['bizjet wing'], dims: { span: 6.6 }, mass: 640, mount: 'wing-root',
    build: { rootChord: 2.9, tipChord: 1.0, sweep: 16, dihedral: 2.5, thickness: 0.13, tipThickness: 0.1, camber: 0.015, twist: 2, hinge: [0.08, 0.95, 0.25], points: { gear: [0.12, 0.45, 'lower'] } },
  },
  'wing-regional': {
    kind: 'craft-wing', realm: 'earth', label: 'straight high wing panel, regional', classOf: 'ATR 72 class',
    aliases: ['turboprop wing', 'regional wing'], dims: { span: 13.5 }, mass: 1500, mount: 'wing-root',
    build: { rootChord: 2.57, tipChord: 1.4, sweep: 2, dihedral: 2, thickness: 0.18, tipThickness: 0.13, camber: 0.02, twist: 2, hinge: [0.08, 0.95, 0.26], points: { engine: [0.3, 0.02, 'lower'] } },
  },
  'wing-narrowbody': {
    kind: 'craft-wing', realm: 'earth', label: 'swept airliner wing panel, single aisle', classOf: 'A320 class',
    aliases: ['airliner wing', 'narrowbody wing'], dims: { span: 16.05 }, mass: 4400, mount: 'wing-root',
    build: { rootChord: 6.1, tipChord: 1.5, sweep: 27, dihedral: 5.1, thickness: 0.15, tipThickness: 0.11, camber: 0.02, twist: 3, hinge: [0.05, 0.95, 0.22], points: { engine: [0.243, 0.05, 'lower'], gear: [0.12, 0.62, 'lower'] } },
  },
  'wing-widebody': {
    kind: 'craft-wing', realm: 'earth', label: 'swept airliner wing panel, twin aisle', classOf: '777 class',
    aliases: ['widebody wing', 'jumbo wing'], dims: { span: 27.4 }, mass: 17000, mount: 'wing-root',
    build: { rootChord: 11.5, tipChord: 2.3, sweep: 34, dihedral: 6, thickness: 0.14, tipThickness: 0.1, camber: 0.02, twist: 3, hinge: [0.05, 0.95, 0.2], points: { engine: [0.237, 0.05, 'lower'], gear: [0.09, 0.6, 'lower'] } },
  },
  'stab-light': {
    kind: 'craft-stabilizer', realm: 'earth', label: 'horizontal stabilizer, light single', classOf: 'Cessna 172 class',
    aliases: ['tailplane', 'stabilizer'], dims: { span: 1.7 }, mass: 14, mount: 'tail-root',
    build: { rootChord: 1.2, tipChord: 0.85, sweep: 5, dihedral: 0, thickness: 0.09, hinge: [0, 0.95, 0.4] },
  },
  'stab-warbird': {
    kind: 'craft-stabilizer', realm: 'earth', label: 'horizontal stabilizer, piston fighter', classOf: 'P-51D class',
    aliases: ['warbird tailplane'], dims: { span: 2.05 }, mass: 30, mount: 'tail-root',
    build: { rootChord: 1.25, tipChord: 0.6, sweep: 6, dihedral: 0, thickness: 0.1, hinge: [0, 0.95, 0.38] },
  },
  'stab-fighter': {
    kind: 'craft-stabilizer', realm: 'earth', label: 'all-moving stabilator, jet fighter', classOf: 'F-16 class',
    aliases: ['stabilator', 'all-moving tail'], dims: { span: 2.0 }, mass: 160, mount: 'tail-root',
    build: { rootChord: 2.4, tipChord: 0.9, sweep: 40, dihedral: -10, thickness: 0.04 },
  },
  'stab-bizjet': {
    kind: 'craft-stabilizer', realm: 'earth', label: 'T-tail stabilizer, business jet', classOf: 'Learjet 45 class',
    aliases: ['T-tail stabilizer'], dims: { span: 2.5 }, mass: 70, mount: 'tail-root',
    build: { rootChord: 1.4, tipChord: 0.7, sweep: 28, dihedral: -2, thickness: 0.1, hinge: [0, 0.95, 0.32] },
  },
  'stab-regional': {
    kind: 'craft-stabilizer', realm: 'earth', label: 'T-tail stabilizer, regional', classOf: 'ATR 72 class',
    aliases: ['regional tailplane'], dims: { span: 3.6 }, mass: 180, mount: 'tail-root',
    build: { rootChord: 1.8, tipChord: 1.1, sweep: 8, dihedral: 0, thickness: 0.11, hinge: [0, 0.95, 0.32] },
  },
  'stab-narrowbody': {
    kind: 'craft-stabilizer', realm: 'earth', label: 'horizontal stabilizer, single aisle', classOf: 'A320 class',
    aliases: ['airliner tailplane'], dims: { span: 6.2 }, mass: 640, mount: 'tail-root',
    build: { rootChord: 3.5, tipChord: 1.4, sweep: 32, dihedral: 6, thickness: 0.1, hinge: [0, 0.95, 0.3] },
  },
  'stab-widebody': {
    kind: 'craft-stabilizer', realm: 'earth', label: 'horizontal stabilizer, twin aisle', classOf: '777 class',
    aliases: ['widebody tailplane'], dims: { span: 10.8 }, mass: 2400, mount: 'tail-root',
    build: { rootChord: 6.0, tipChord: 2.0, sweep: 35, dihedral: 7, thickness: 0.1, hinge: [0, 0.95, 0.28] },
  },
  'fin-light': {
    kind: 'craft-fin', realm: 'earth', label: 'vertical fin, light single', classOf: 'Cessna 172 class',
    aliases: ['fin', 'tail fin', 'vertical stabilizer'], dims: { span: 1.15 }, mass: 12, mount: 'tail-root',
    build: { vertical: true, rootChord: 1.6, tipChord: 0.7, sweep: 35, thickness: 0.09, hinge: [0, 0.95, 0.35] },
  },
  'fin-warbird': {
    kind: 'craft-fin', realm: 'earth', label: 'vertical fin, piston fighter', classOf: 'P-51D class',
    aliases: ['warbird fin'], dims: { span: 1.35 }, mass: 20, mount: 'tail-root',
    build: { vertical: true, rootChord: 1.5, tipChord: 0.5, sweep: 30, thickness: 0.1, hinge: [0, 0.95, 0.35] },
  },
  'fin-fighter': {
    kind: 'craft-fin', realm: 'earth', label: 'vertical fin, jet fighter', classOf: 'F-16 class',
    aliases: ['fighter fin'], dims: { span: 2.25 }, mass: 120, mount: 'tail-root',
    build: { vertical: true, rootChord: 3.6, tipChord: 1.1, sweep: 47, thickness: 0.05, hinge: [0.05, 0.9, 0.25] },
  },
  'fin-bizjet': {
    kind: 'craft-fin', realm: 'earth', label: 'T-tail fin, business jet', classOf: 'Learjet 45 class',
    aliases: ['T-tail fin'], dims: { span: 1.85 }, mass: 90, mount: 'tail-root',
    build: { vertical: true, rootChord: 2.6, tipChord: 1.4, sweep: 40, thickness: 0.11, hinge: [0, 0.85, 0.3], points: { tip: [1, 0.1] } },
  },
  'fin-regional': {
    kind: 'craft-fin', realm: 'earth', label: 'T-tail fin, regional', classOf: 'ATR 72 class',
    aliases: ['regional fin'], dims: { span: 4.2 }, mass: 260, mount: 'tail-root',
    build: { vertical: true, rootChord: 4.2, tipChord: 2.2, sweep: 35, thickness: 0.12, hinge: [0, 0.88, 0.3], points: { tip: [1, 0.2] } },
  },
  'fin-narrowbody': {
    kind: 'craft-fin', realm: 'earth', label: 'vertical fin, single aisle', classOf: 'A320 class',
    aliases: ['airliner fin'], dims: { span: 5.9 }, mass: 560, mount: 'tail-root',
    build: { vertical: true, rootChord: 5.9, tipChord: 2.1, sweep: 40, thickness: 0.1, hinge: [0, 0.95, 0.3] },
  },
  'fin-widebody': {
    kind: 'craft-fin', realm: 'earth', label: 'vertical fin, twin aisle', classOf: '777 class',
    aliases: ['widebody fin'], dims: { span: 9.0 }, mass: 1800, mount: 'tail-root',
    build: { vertical: true, rootChord: 10, tipChord: 3.2, sweep: 42, thickness: 0.1, hinge: [0, 0.95, 0.28] },
  },

  // ===== earth: powerplants, propellers ========================================================
  'eng-piston-flat4': {
    kind: 'craft-engine', realm: 'earth', label: 'air-cooled flat-four with cowling', classOf: 'Lycoming O-360 class',
    aliases: ['flat four', 'piston engine', 'boxer engine'], dims: { length: 1.0, diameter: 1.0 }, mass: 135, perf: { power: 134 }, mount: 'nose-mount',
    build: { family: 'cowl' },
  },
  'eng-piston-v12': {
    kind: 'craft-engine', realm: 'earth', label: 'liquid-cooled V12', classOf: 'Merlin / V-1650 class',
    aliases: ['v12', 'inline engine', 'merlin class engine'], dims: { length: 2.25, width: 0.74, height: 0.95 }, mass: 745, perf: { power: 1120 }, mount: 'bay-mount',
    build: { family: 'inline' },
  },
  'eng-turboprop': {
    kind: 'craft-engine', realm: 'earth', label: 'turboprop in underwing nacelle', classOf: 'PW127 class',
    aliases: ['turboprop', 'turboprop nacelle'], dims: { length: 4.5, diameter: 1.25 }, mass: 480, perf: { power: 2050 }, mount: 'pod-mount',
    build: { family: 'turboprop', mountAt: 0.25 },
  },
  'eng-turbofan-small': {
    kind: 'craft-engine', realm: 'earth', label: 'small turbofan in aft-mounted nacelle', classOf: 'TFE731 class',
    aliases: ['small turbofan', 'bizjet engine'], dims: { length: 2.9, diameter: 1.05 }, mass: 450, perf: { thrust: 16.5 }, mount: 'pod-mount',
    build: { family: 'turbofan', fanDiameter: 0.72, mountAt: 0.45, mountFace: 'inboard' },
  },
  'eng-turbofan-narrow': {
    kind: 'craft-engine', realm: 'earth', label: 'high-bypass turbofan powerplant', classOf: 'CFM56-5B class',
    aliases: ['turbofan', 'airliner engine', 'high bypass turbofan'], dims: { length: 4.4, diameter: 2.15 }, mass: 2380, perf: { thrust: 120 }, mount: 'pod-mount',
    build: { family: 'turbofan', fanDiameter: 1.73, mountAt: 0.35 },
  },
  'eng-turbofan-wide': {
    kind: 'craft-engine', realm: 'earth', label: 'large high-bypass turbofan powerplant', classOf: 'GE90 class',
    aliases: ['large turbofan', 'widebody engine'], dims: { length: 7.3, diameter: 3.9 }, mass: 7550, perf: { thrust: 417 }, mount: 'pod-mount',
    build: { family: 'turbofan', fanDiameter: 3.12, mountAt: 0.35 },
  },
  'eng-turbofan-afterburning': {
    kind: 'craft-engine', realm: 'earth', label: 'afterburning low-bypass turbofan', classOf: 'F100 / F110 class',
    aliases: ['afterburning turbofan', 'fighter engine', 'jet engine'], dims: { length: 4.85, diameter: 1.18 }, mass: 1700, perf: { thrust: 79, wet: 129 }, mount: 'bay-mount',
    build: { family: 'core' },
  },
  'prop-2-fixed': {
    kind: 'craft-propeller', realm: 'earth', label: 'two-blade fixed-pitch propeller', classOf: '76 in metal prop',
    aliases: ['two blade propeller', 'fixed pitch prop'], dims: { diameter: 1.93 }, mass: 14, mount: 'hub-mount',
    build: { blades: 2, hubDiameter: 0.32, spinnerLength: 0.42, rootChord: 0.16, tipChord: 0.09, rootPitch: 38, tipPitch: 14 },
  },
  'prop-4-constant': {
    kind: 'craft-propeller', realm: 'earth', label: 'four-blade constant-speed propeller', classOf: 'Hamilton Standard 11 ft class',
    aliases: ['four blade propeller', 'constant speed prop'], dims: { diameter: 3.4 }, mass: 240, mount: 'hub-mount',
    build: { blades: 4, hubDiameter: 0.62, spinnerLength: 0.8, rootChord: 0.3, tipChord: 0.17, rootPitch: 45, tipPitch: 20 },
  },
  'prop-6-composite': {
    kind: 'craft-propeller', realm: 'earth', label: 'six-blade composite propeller', classOf: '568F class',
    aliases: ['six blade propeller', 'composite prop'], dims: { diameter: 3.93 }, mass: 210, mount: 'hub-mount',
    build: { blades: 6, hubDiameter: 0.7, spinnerLength: 0.95, rootChord: 0.32, tipChord: 0.12, rootPitch: 48, tipPitch: 18 },
  },

  // ===== earth: undercarriage ==================================================================
  'gear-spring-light': {
    kind: 'craft-gear', realm: 'earth', label: 'spring-steel main leg', classOf: 'light single, 6.00-6 tyre',
    aliases: ['spring gear', 'main gear leg'], dims: { height: 0.64 }, mass: 18, mount: 'gear-well',
    build: { family: 'spring', strut: 0.42, splay: 0.45, tyre: [0.44, 0.15] },
  },
  'gear-nose-light': {
    kind: 'craft-gear', realm: 'earth', label: 'nose oleo, light single', classOf: 'light single, 5.00-5 tyre',
    aliases: ['nose gear'], dims: { height: 0.81 }, mass: 9, mount: 'gear-well',
    build: { family: 'leg', strut: 0.63, oleo: 0.035, rake: 0.08, tyre: [0.36, 0.13] },
  },
  'gear-main-warbird': {
    kind: 'craft-gear', realm: 'earth', label: 'retractable main leg, piston fighter', classOf: 'P-51D class, 27 in tyre',
    aliases: ['warbird main gear'], dims: { height: 1.55 }, mass: 75, mount: 'gear-well',
    build: { family: 'leg', strut: 1.21, oleo: 0.07, rake: 0.12, tyre: [0.69, 0.22] },
  },
  'gear-tail-warbird': {
    kind: 'craft-gear', realm: 'earth', label: 'tailwheel', classOf: 'P-51D class',
    aliases: ['tail wheel', 'tailwheel'], dims: { height: 0.71 }, mass: 12, mount: 'gear-well',
    build: { family: 'leg', strut: 0.55, oleo: 0.04, rake: -0.12, tyre: [0.32, 0.1] },
  },
  'gear-main-fighter': {
    kind: 'craft-gear', realm: 'earth', label: 'main leg, jet fighter', classOf: 'F-16 class, 27.75 in tyre',
    aliases: ['fighter main gear'], dims: { height: 1.3 }, mass: 110, mount: 'gear-well',
    build: { family: 'leg', strut: 0.95, oleo: 0.08, tyre: [0.7, 0.22] },
  },
  'gear-nose-fighter': {
    kind: 'craft-gear', realm: 'earth', label: 'nose leg, jet fighter', classOf: 'F-16 class, 18 in tyre',
    aliases: ['fighter nose gear'], dims: { height: 1.37 }, mass: 45, mount: 'gear-well',
    build: { family: 'leg', strut: 1.14, oleo: 0.06, rake: 0.1, tyre: [0.46, 0.15] },
  },
  'gear-main-bizjet': {
    kind: 'craft-gear', realm: 'earth', label: 'twin-wheel main leg, business jet', classOf: 'Learjet 45 class',
    aliases: ['bizjet main gear'], dims: { height: 0.98 }, mass: 85, mount: 'gear-well',
    build: { family: 'leg', strut: 0.7, oleo: 0.07, wheels: 2, tyre: [0.56, 0.17] },
  },
  'gear-nose-bizjet': {
    kind: 'craft-gear', realm: 'earth', label: 'twin-wheel nose leg, business jet', classOf: 'Learjet 45 class',
    aliases: ['bizjet nose gear'], dims: { height: 1.02 }, mass: 30, mount: 'gear-well',
    build: { family: 'leg', strut: 0.79, oleo: 0.05, wheels: 2, rake: 0.1, tyre: [0.45, 0.14] },
  },
  'gear-main-regional': {
    kind: 'craft-gear', realm: 'earth', label: 'twin-wheel sponson leg, regional', classOf: 'ATR 72 class',
    aliases: ['regional main gear'], dims: { height: 1.2 }, mass: 220, mount: 'gear-well',
    build: { family: 'leg', strut: 0.8, oleo: 0.1, wheels: 2, tyre: [0.81, 0.25] },
  },
  'gear-nose-regional': {
    kind: 'craft-gear', realm: 'earth', label: 'twin-wheel nose leg, regional', classOf: 'ATR 72 class',
    aliases: ['regional nose gear'], dims: { height: 1.36 }, mass: 70, mount: 'gear-well',
    build: { family: 'leg', strut: 1.06, oleo: 0.07, wheels: 2, rake: 0.12, tyre: [0.56, 0.18] },
  },
  'gear-main-narrowbody': {
    kind: 'craft-gear', realm: 'earth', label: 'twin-wheel main leg, single aisle', classOf: 'A320 class, 46 in tyre',
    aliases: ['airliner main gear'], dims: { height: 2.75 }, mass: 1100, mount: 'gear-well',
    build: { family: 'leg', strut: 2.15, oleo: 0.16, wheels: 2, tyre: [1.17, 0.43] },
  },
  'gear-nose-narrowbody': {
    kind: 'craft-gear', realm: 'earth', label: 'twin-wheel nose leg, single aisle', classOf: 'A320 class, 30 in tyre',
    aliases: ['airliner nose gear'], dims: { height: 2.66 }, mass: 280, mount: 'gear-well',
    build: { family: 'leg', strut: 2.28, oleo: 0.1, wheels: 2, rake: 0.2, tyre: [0.76, 0.22] },
  },
  'gear-bogie-widebody': {
    kind: 'craft-gear', realm: 'earth', label: 'six-wheel main bogie, twin aisle', classOf: '777 class, 50 in tyre',
    aliases: ['bogie', 'main bogie', 'six wheel truck'], dims: { height: 4.36 }, mass: 4800, mount: 'gear-well',
    build: { family: 'bogie', strut: 3.7, oleo: 0.22, rows: 3, tyre: [1.32, 0.51] },
  },
  'gear-nose-widebody': {
    kind: 'craft-gear', realm: 'earth', label: 'twin-wheel nose leg, twin aisle', classOf: '777 class, 43 in tyre',
    aliases: ['widebody nose gear'], dims: { height: 4.38 }, mass: 900, mount: 'gear-well',
    build: { family: 'leg', strut: 3.83, oleo: 0.14, wheels: 2, rake: 0.25, tyre: [1.09, 0.39] },
  },

  // ===== earth: canopies, pylons, weapons ======================================================
  'canopy-bubble-warbird': {
    kind: 'craft-canopy', realm: 'earth', label: 'bubble canopy, piston fighter', classOf: 'P-51D class',
    aliases: ['bubble canopy'], dims: { length: 1.9, width: 0.78, height: 0.58 }, mass: 45, mount: 'sill',
    build: { family: 'bubble', bows: [0.22] },
  },
  'canopy-bubble-fighter': {
    kind: 'craft-canopy', realm: 'earth', label: 'frameless bubble canopy, jet fighter', classOf: 'F-16 class',
    aliases: ['fighter canopy', 'frameless canopy'], dims: { length: 3.2, width: 0.95, height: 0.78 }, mass: 90, mount: 'sill',
    build: { family: 'bubble', stations: [[0, 0.2, 0.15], [0.25, 0.85, 0.85], [0.55, 1, 1], [0.85, 0.85, 0.75], [1, 0.4, 0.3]] },
  },
  'pylon-underwing-narrowbody': {
    kind: 'craft-pylon', realm: 'earth', label: 'underwing engine pylon, single aisle', classOf: 'A320 class',
    aliases: ['engine pylon', 'strut'], dims: { length: 4.2, height: 0.2 }, mass: 600, mount: 'wing-store',
    build: { family: 'underwing', forward: 2.3, thickness: 0.18 },
  },
  'pylon-underwing-widebody': {
    kind: 'craft-pylon', realm: 'earth', label: 'underwing engine pylon, twin aisle', classOf: '777 class',
    aliases: ['widebody pylon'], dims: { length: 7.0, height: 0.1 }, mass: 1900, mount: 'wing-store',
    build: { family: 'underwing', forward: 3.6, thickness: 0.18 },
  },
  'pylon-aft-stub': {
    kind: 'craft-pylon', realm: 'earth', label: 'aft-fuselage engine stub', classOf: 'Learjet 45 class',
    aliases: ['engine stub', 'aft pylon'], dims: { length: 0.45, chord: 1.5 }, mass: 60, mount: 'hull-store',
    build: { family: 'stub', thickness: 0.16 },
  },
  'gun-rotary-20': {
    kind: 'craft-weapon', realm: 'earth', label: 'six-barrel 20 mm rotary cannon', classOf: 'M61 class',
    aliases: ['rotary cannon', 'gatling', 'vulcan class cannon'], dims: { length: 1.88, diameter: 0.4 }, mass: 112, perf: { rounds: 6000 }, mount: 'hardpoint',
    build: { family: 'rotary' },
  },
  'gun-heavy-mg': {
    kind: 'craft-weapon', realm: 'earth', label: '.50 calibre wing gun', classOf: 'M2 aircraft class',
    aliases: ['machine gun', 'wing gun', '50 cal'], dims: { length: 1.65, diameter: 0.06 }, mass: 29, perf: { rounds: 800 }, mount: 'hardpoint',
    build: { family: 'cannon', body: 0.45 },
  },
  'missile-aam-short': {
    kind: 'craft-weapon', realm: 'earth', label: 'short-range air-to-air missile on rail', classOf: 'AIM-9 class',
    aliases: ['missile', 'sidewinder class missile', 'heat seeker'], dims: { length: 2.87, diameter: 0.127 }, mass: 86, mount: 'hardpoint',
    build: { family: 'missile' },
  },

  // ===== space: hulls ==========================================================================
  'hull-snub-wedge': {
    kind: 'craft-fuselage', realm: 'space', label: 'snubfighter wedge hull', classOf: 'strike-foil snubfighter register',
    aliases: ['snubfighter hull', 'starfighter hull', 'x foil hull'], dims: { length: 11.0, width: 1.7, height: 1.8 }, mass: 5200, mount: null,
    build: {
      family: 'tube', n: 1.6,
      stations: [[0, 0.22, 0.16, 0.42], [0.42, 0.52, 0.48, 0.45], [0.55, 0.85, 0.85, 0.5], [0.66, 1, 1, 0.5], [1, 1, 1, 0.5]],
      points: { canopy: [0.5, 0, 0.82], foilUpper: [0.86, 0.9, 0.35], foilLower: [0.86, 0.9, -0.35], noseGear: [0.3, 0, -0.9], mainGear: [0.8, 0.55, -1], rcs: [0.95, 0, 1], droid: [0.62, 0, 0.98] },
    },
  },
  'hull-ball-pod': {
    kind: 'craft-fuselage', realm: 'space', label: 'ball cockpit pod', classOf: 'twin-panel interceptor register',
    aliases: ['ball cockpit', 'interceptor pod'], dims: { length: 2.8 }, mass: 2100, mount: null,
    build: { family: 'ball', points: { window: [0, 0, 0], arm: [0.5, 0.92, 0], vents: [1, 0, 0.1], chin: [0.18, 0.3, -0.75] } },
  },
  'hull-colonial-dart': {
    kind: 'craft-fuselage', realm: 'space', label: 'colonial dart hull', classOf: 'colonial viper register',
    aliases: ['viper hull', 'dart hull', 'colonial fighter hull'], dims: { length: 8.5, width: 1.6, height: 1.4 }, mass: 3600, mount: null,
    build: {
      family: 'tube', n: 1.7,
      stations: [[0, 0.03, 0.03, 0.5], [0.25, 0.5, 0.45, 0.5], [0.5, 0.85, 0.8, 0.5], [0.7, 1, 1, 0.5], [1, 0.95, 0.95, 0.5]],
      points: { canopy: [0.3, 0, 0.82], wingRoot: [0.62, 0.85, -0.2], finRoot: [0.7, 0, 0.9], engineTop: [1, 0, 0.5], engineLow: [1, 0.55, -0.4], gun: [0.32, 0.75, -0.2], noseGear: [0.25, 0, -0.9], mainGear: [0.75, 0.6, -1] },
    },
  },
  'hull-heavy-fighter': {
    kind: 'craft-fuselage', realm: 'space', label: 'lifting-body heavy fighter hull', classOf: 'carrier heavy fighter register',
    aliases: ['heavy fighter hull', 'carrier fighter hull'], dims: { length: 18.0, width: 3.2, height: 2.4 }, mass: 14000, mount: null,
    build: {
      family: 'tube', n: 1.8, belly: 0.8,
      stations: [[0, 0.04, 0.03, 0.45], [0.2, 0.55, 0.5, 0.45], [0.45, 0.9, 0.85, 0.5], [0.7, 1, 1, 0.5], [1, 0.85, 0.8, 0.5]],
      points: { canopy: [0.22, 0, 0.8], wingRoot: [0.5, 0.88, -0.3], finRoot: [0.78, 0.55, 0.8], engine: [0.97, 0.5, 0], noseGear: [0.25, 0, -0.9], mainGear: [0.62, 0.6, -1], rcs: [0.4, 0, 1] },
    },
  },
  'hull-pod-spine': {
    kind: 'craft-fuselage', realm: 'space', label: 'cockpit pod and spine hull', classOf: 'twin-nacelle bomber register',
    aliases: ['bomber hull', 'pod and spine hull'], dims: { length: 16.0, width: 2.4, height: 1.9 }, mass: 9000, mount: null,
    build: {
      family: 'tube', n: 2.2,
      stations: [[0, 0.06, 0.06, 0.5], [0.08, 0.7, 0.6, 0.5], [0.2, 1, 1, 0.5], [0.3, 0.8, 0.8, 0.5], [0.36, 0.35, 0.42, 0.5], [0.62, 0.35, 0.42, 0.5], [0.68, 0.9, 0.8, 0.5], [0.8, 0.9, 0.8, 0.5], [0.84, 0.3, 0.3, 0.5], [1, 0.3, 0.3, 0.5]],
      points: { canopy: [0.08, 0, 0.55], turret: [0.2, 0, 0.98], crossbar: [0.74, 0.7, 0], launcher: [0.14, 0, -0.95], noseGear: [0.18, 0, -0.95], mainGear: [0.74, 0.6, -0.95] },
    },
  },
  'hull-utility-shuttle': {
    kind: 'craft-fuselage', realm: 'space', label: 'utility shuttle hull', classOf: 'colonial raptor register',
    aliases: ['utility shuttle hull', 'raptor hull', 'dropship hull'], dims: { length: 8.6, width: 3.2, height: 2.6 }, mass: 8000, mount: null,
    build: {
      family: 'tube', n: 4,
      stations: [[0, 0.4, 0.35, 0.42], [0.12, 0.85, 0.8, 0.48], [0.3, 1, 1, 0.5], [0.85, 1, 0.95, 0.52], [1, 0.8, 0.7, 0.55]],
      windscreen: [0.03, 0.15],
      points: { stub: [0.72, 0.9, -0.2], skidFront: [0.2, 0.6, -1], skidRear: [0.8, 0.7, -1], rcs: [0.6, 0, 1] },
    },
  },

  // ===== space: foils and panels ===============================================================
  'foil-strike': {
    kind: 'craft-wing', realm: 'space', label: 'split strike foil', classOf: 'strike-foil snubfighter register',
    aliases: ['s-foil', 'strike foil', 'x foil'], dims: { span: 4.6 }, mass: 700, mount: 'wing-root',
    build: { section: 'slab', rootChord: 2.3, tipChord: 1.2, sweep: 4, dihedral: 13, thickness: 0.07, points: { pod: [0.1, 0.25], tip: [1, 0.55] } },
  },
  'panel-hex': {
    kind: 'craft-wing', realm: 'space', label: 'hexagonal panel wing', classOf: 'twin-panel interceptor register',
    aliases: ['hex panel', 'solar panel wing', 'panel wing'], dims: { span: 0.24, height: 7.2, chord: 6.25 }, mass: 900, mount: 'wing-root',
    build: { family: 'hexPanel' },
  },
  'wing-colonial-stub': {
    kind: 'craft-wing', realm: 'space', label: 'swept stub wing', classOf: 'colonial viper register',
    aliases: ['stub wing', 'viper wing'], dims: { span: 2.2 }, mass: 260, mount: 'wing-root',
    build: { section: 'slab', rootChord: 3.4, tipChord: 1.1, sweep: 45, dihedral: 0, thickness: 0.06 },
  },
  'wing-heavy-fighter': {
    kind: 'craft-wing', realm: 'space', label: 'swept lifting wing, heavy fighter', classOf: 'carrier heavy fighter register',
    aliases: ['heavy fighter wing'], dims: { span: 6.0 }, mass: 1500, mount: 'wing-root',
    build: { rootChord: 7.0, tipChord: 1.6, sweep: 52, dihedral: -4, thickness: 0.06, hinge: [0.1, 0.85, 0.2], points: { gun: [0.08, 0.05, 'mid'], store: [0.5, 0.4, 'lower'] } },
  },
  'fin-colonial': {
    kind: 'craft-fin', realm: 'space', label: 'dorsal fin, colonial dart', classOf: 'colonial viper register',
    aliases: ['dorsal fin'], dims: { span: 1.1 }, mass: 80, mount: 'tail-root',
    build: { vertical: true, section: 'slab', rootChord: 2.8, tipChord: 0.9, sweep: 50, thickness: 0.06 },
  },
  'fin-heavy-fighter': {
    kind: 'craft-fin', realm: 'space', label: 'twin tail fin, heavy fighter', classOf: 'carrier heavy fighter register',
    aliases: ['twin fin'], dims: { span: 2.4 }, mass: 160, mount: 'tail-root',
    build: { vertical: true, section: 'slab', rootChord: 3.6, tipChord: 1.2, sweep: 45, thickness: 0.06 },
  },

  // ===== space: drives, thrusters ==============================================================
  'drive-pod-light': {
    kind: 'craft-engine', realm: 'space', label: 'fusion drive pod, light fighter', classOf: 'strike-foil snubfighter register',
    aliases: ['drive pod', 'fusion engine', 'sublight engine'], dims: { length: 3.6, diameter: 1.0 }, mass: 900, perf: { thrust: 90 }, mount: 'pod-mount',
    build: { family: 'pod' },
  },
  'drive-pod-heavy': {
    kind: 'craft-engine', realm: 'space', label: 'fusion drive pod, heavy fighter', classOf: 'carrier heavy fighter register',
    aliases: ['heavy drive pod'], dims: { length: 4.6, diameter: 1.6 }, mass: 2600, perf: { thrust: 300 }, mount: 'pod-mount',
    build: { family: 'pod' },
  },
  'drive-pod-shuttle': {
    kind: 'craft-engine', realm: 'space', label: 'vectoring drive pod, utility shuttle', classOf: 'colonial raptor register',
    aliases: ['shuttle drive pod'], dims: { length: 2.6, diameter: 1.1 }, mass: 700, perf: { thrust: 110 }, mount: 'pod-mount',
    build: { family: 'pod' },
  },
  'drive-ion-twin': {
    kind: 'craft-engine', realm: 'space', label: 'twin ion vent', classOf: 'twin-panel interceptor register',
    aliases: ['ion engine', 'twin ion engine', 'ion vents'], dims: { length: 0.35, diameter: 0.36 }, mass: 500, perf: { thrust: 75 }, mount: 'hull-store',
    build: { family: 'ionVent', gap: 0.75 },
  },
  'drive-bell-main': {
    kind: 'craft-engine', realm: 'space', label: 'main drive bell', classOf: 'colonial viper register',
    aliases: ['main engine', 'drive bell', 'thruster bell'], dims: { length: 1.4, diameter: 0.8 }, mass: 420, perf: { thrust: 60 }, mount: 'hull-store',
    build: { family: 'bell' },
  },
  'drive-nacelle-long': {
    kind: 'craft-engine', realm: 'space', label: 'long drive nacelle', classOf: 'twin-nacelle bomber register',
    aliases: ['nacelle', 'engine nacelle'], dims: { length: 8.5, diameter: 1.3 }, mass: 2200, perf: { thrust: 160 }, mount: 'pod-mount',
    build: { family: 'nacelle' },
  },
  'rcs-quad': {
    kind: 'craft-thruster', realm: 'space', label: 'reaction-control quad', classOf: 'all registers',
    aliases: ['rcs', 'maneuvering thruster', 'attitude thruster'], dims: { width: 0.35 }, mass: 25, perf: { thrust: 2 }, mount: 'hull-patch',
    build: {},
  },

  // ===== space: struts, mounts, cockpits, weapons ==============================================
  'strut-light': {
    kind: 'craft-gear', realm: 'space', label: 'landing strut, light fighter', classOf: 'starfighter',
    aliases: ['landing strut', 'landing leg', 'skid'], dims: { height: 1.1 }, mass: 40, mount: 'gear-well',
    build: { family: 'skid', strut: 1.1, oleo: 0.06, pad: [0.5] },
  },
  'strut-light-nose': {
    kind: 'craft-gear', realm: 'space', label: 'long nose strut, light fighter', classOf: 'starfighter',
    aliases: ['nose strut'], dims: { height: 1.58 }, mass: 45, mount: 'gear-well',
    build: { family: 'skid', strut: 1.58, oleo: 0.06, pad: [0.45] },
  },
  'strut-heavy': {
    kind: 'craft-gear', realm: 'space', label: 'landing strut, heavy craft', classOf: 'shuttle / heavy fighter',
    aliases: ['heavy landing strut'], dims: { height: 1.0 }, mass: 120, mount: 'gear-well',
    build: { family: 'skid', strut: 1.0, oleo: 0.1, pad: [0.8] },
  },
  'gear-carrier-light': {
    kind: 'craft-gear', realm: 'space', label: 'carrier deck leg', classOf: 'colonial viper register',
    aliases: ['deck gear', 'carrier gear'], dims: { height: 0.65 }, mass: 45, mount: 'gear-well',
    build: { family: 'leg', strut: 0.45, oleo: 0.05, tyre: [0.4, 0.14] },
  },
  'gear-carrier-light-nose': {
    kind: 'craft-gear', realm: 'space', label: 'carrier deck nose leg', classOf: 'colonial viper register',
    aliases: ['deck nose gear'], dims: { height: 1.06 }, mass: 40, mount: 'gear-well',
    build: { family: 'leg', strut: 0.86, oleo: 0.05, rake: 0.08, tyre: [0.4, 0.14] },
  },
  'gear-carrier-heavy': {
    kind: 'craft-gear', realm: 'space', label: 'carrier deck leg, heavy', classOf: 'carrier heavy fighter register',
    aliases: ['heavy deck gear'], dims: { height: 1.55 }, mass: 160, mount: 'gear-well',
    build: { family: 'leg', strut: 1.2, oleo: 0.09, tyre: [0.7, 0.24] },
  },
  'gear-carrier-heavy-nose': {
    kind: 'craft-gear', realm: 'space', label: 'carrier deck nose leg, heavy', classOf: 'carrier heavy fighter register',
    aliases: ['heavy deck nose gear'], dims: { height: 1.88 }, mass: 120, mount: 'gear-well',
    build: { family: 'leg', strut: 1.53, oleo: 0.08, rake: 0.1, tyre: [0.7, 0.24] },
  },
  'arm-panel': {
    kind: 'craft-pylon', realm: 'space', label: 'panel wing arm', classOf: 'twin-panel interceptor register',
    aliases: ['wing arm', 'panel pylon'], dims: { length: 1.45, diameter: 0.5 }, mass: 160, mount: 'hull-store',
    build: { family: 'arm' },
  },
  'crossbar-nacelle': {
    kind: 'craft-pylon', realm: 'space', label: 'nacelle crossbar', classOf: 'twin-nacelle bomber register',
    aliases: ['crossbar', 'engine crossbar'], dims: { length: 2.55, chord: 1.2 }, mass: 300, mount: 'hull-store',
    build: { family: 'crossbar', thickness: 0.3 },
  },
  'stub-shuttle': {
    kind: 'craft-pylon', realm: 'space', label: 'engine stub, utility shuttle', classOf: 'colonial raptor register',
    aliases: ['shuttle stub'], dims: { length: 0.9, chord: 1.8 }, mass: 150, mount: 'hull-store',
    build: { family: 'stub', thickness: 0.2 },
  },
  'canopy-snub': {
    kind: 'craft-canopy', realm: 'space', label: 'framed canopy, snubfighter', classOf: 'strike-foil snubfighter register',
    aliases: ['starfighter canopy', 'framed canopy'], dims: { length: 2.3, width: 0.95, height: 0.68 }, mass: 70, mount: 'sill',
    build: { family: 'bubble', bows: [0.3, 0.6] },
  },
  'canopy-ball-window': {
    kind: 'craft-canopy', realm: 'space', label: 'round spoked viewport', classOf: 'twin-panel interceptor register',
    aliases: ['viewport', 'round window', 'cockpit window'], dims: { length: 0.16, width: 1.3, height: 1.3 }, mass: 60, mount: 'sill',
    build: { family: 'roundWindow', spokes: 8 },
  },
  'canopy-dart': {
    kind: 'craft-canopy', realm: 'space', label: 'teardrop canopy, colonial dart', classOf: 'colonial viper register',
    aliases: ['teardrop canopy'], dims: { length: 1.9, width: 0.8, height: 0.55 }, mass: 50, mount: 'sill',
    build: { family: 'bubble', bows: [0.35] },
  },
  'canopy-armored': {
    kind: 'craft-canopy', realm: 'space', label: 'armoured canopy, heavy fighter', classOf: 'carrier heavy fighter register',
    aliases: ['armoured canopy', 'armored canopy'], dims: { length: 2.6, width: 1.1, height: 0.75 }, mass: 130, mount: 'sill',
    build: { family: 'bubble', bows: [0.3, 0.65] },
  },
  'cannon-laser-long': {
    kind: 'craft-weapon', realm: 'space', label: 'long-barrel laser cannon', classOf: 'strike-foil snubfighter register',
    aliases: ['laser cannon', 'wingtip cannon', 'blaster cannon'], dims: { length: 4.2, diameter: 0.16 }, mass: 180, mount: 'hardpoint',
    build: { family: 'cannon', body: 0.3 },
  },
  'cannon-chin-short': {
    kind: 'craft-weapon', realm: 'space', label: 'short chin cannon', classOf: 'twin-panel interceptor register',
    aliases: ['chin gun', 'chin cannon'], dims: { length: 1.0, diameter: 0.1 }, mass: 60, mount: 'hardpoint',
    build: { family: 'cannon', body: 0.3 },
  },
  'cannon-kinetic': {
    kind: 'craft-weapon', realm: 'space', label: 'kinetic autocannon', classOf: 'colonial viper register',
    aliases: ['kinetic cannon', 'mass driver', 'autocannon'], dims: { length: 1.8, diameter: 0.08 }, mass: 70, mount: 'hardpoint',
    build: { family: 'cannon', body: 0.35 },
  },
  'cannon-heavy-laser': {
    kind: 'craft-weapon', realm: 'space', label: 'heavy laser cannon', classOf: 'carrier heavy fighter register',
    aliases: ['heavy laser', 'heavy cannon'], dims: { length: 2.6, diameter: 0.14 }, mass: 160, mount: 'hardpoint',
    build: { family: 'cannon', body: 0.35 },
  },
  'launcher-torpedo': {
    kind: 'craft-weapon', realm: 'space', label: 'twin torpedo launcher', classOf: 'all registers',
    aliases: ['torpedo launcher', 'missile launcher', 'warhead launcher'], dims: { length: 1.6, width: 0.7, diameter: 0.45 }, mass: 220, mount: 'hardpoint',
    build: { family: 'launcher', tubes: 2 },
  },
  'rack-missile-triple': {
    kind: 'craft-weapon', realm: 'space', label: 'triple missile rack', classOf: 'carrier heavy fighter register',
    aliases: ['missile rack', 'missile pod'], dims: { length: 2.4, width: 0.75, diameter: 0.4 }, mass: 300, mount: 'hardpoint',
    build: { family: 'launcher', tubes: 3 },
  },
  'turret-ion-dorsal': {
    kind: 'craft-weapon', realm: 'space', label: 'dorsal twin ion turret', classOf: 'twin-nacelle bomber register',
    aliases: ['ion turret', 'dorsal turret', 'turret'], dims: { length: 1.6, width: 0.9, diameter: 0.5 }, mass: 260, mount: 'hardpoint',
    build: { family: 'turret' },
  },
};
