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
  'craft-intake': 'an air intake on the fuselage (a chin scoop, a side duct, a half-cone with its shock cone)',
};

export const CRAFT_REALMS = ['earth', 'space'];

// Flat-paneled hull sections (craft-common facetSection), CCW from +x. Spacecraft hulls are built from
// plates, not turned: a chamfered box (the snubfighter's), a chined diamond (the colonial dart's), a
// lifting-body wedge (the heavy fighter's).
const BOX_CHAMFER = [[1, -0.72], [1, 0.72], [0.72, 1], [-0.72, 1], [-1, 0.72], [-1, -0.72], [-0.72, -1], [0.72, -1]];
const BOX_BEVEL = [[1, -0.45], [1, 0.45], [0.55, 1], [-0.55, 1], [-1, 0.45], [-1, -0.45], [-0.55, -1], [0.55, -1]];
const CHINE = [[1, 0], [0.5, 1], [-0.5, 1], [-1, 0], [-0.55, -1], [0.55, -1]];
const WEDGE = [[1, -0.2], [0.7, 0.6], [0.25, 1], [-0.25, 1], [-0.7, 0.6], [-1, -0.2], [-0.8, -1], [0.8, -1]];
const STEALTH = [[1, -0.55], [0.55, 0.25], [0.12, 1], [-0.12, 1], [-0.55, 0.25], [-1, -0.55], [-0.85, -1], [0.85, -1]];

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
      windows: { from: 0.2, to: 0.3, pitch: 0.6, zf: 0.42, w: 0.55, h: 0.42 },
      doors: [[0.15, -0.05, 0.85, 0.9]],
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
      antennas: [[0.5, 0, 1, 0.45, 'blade']],
      points: { engine: [0.25, 0, 0], wingRoot: [0.3, 0.78, -0.55], canopy: [0.33, 0, 0.88], stabRoot: [0.9, 0, 0], finRoot: [0.82, 0, 0.7], tailGear: [0.9, 0, -0.85] },
    },
  },
  'fus-jet-fighter': {
    kind: 'craft-fuselage', realm: 'earth', label: 'single-engine jet fighter fuselage', classOf: 'F-16 class',
    aliases: ['jet fighter fuselage', 'fighter fuselage'],
    dims: { length: 14.5, width: 1.6, height: 1.9 }, mass: 2900, mount: null,
    build: {
      family: 'tube', n: 2.6, belly: 0.8, nose: 0.08,
      stations: [[0, 0.02, 0.02, 0.62, 2], [0.08, 0.42, 0.48, 0.62, 2], [0.2, 0.75, 0.8, 0.58, 2.2], [0.35, 1, 1, 0.5], [0.6, 1, 0.95, 0.5, 3], [0.85, 0.85, 0.75, 0.52, 2.6], [1, 0.62, 0.6, 0.52, 2]],
      antennas: [[0, 0, 0, 0.7, 'pitot'], [0.5, 0, 1, 0.25, 'blade']],
      points: { canopy: [0.12, 0, 0.82], intake: [0.27, 0, -0.85], wingRoot: [0.42, 0.85, -0.05], engine: [0.707, 0, 0], stabRoot: [0.86, 0.85, -0.05], finRoot: [0.7, 0, 0.92], mainGear: [0.55, 0.55, -1], noseGear: [0.3, 0, -1], gun: [0.27, -0.75, 0.3] },
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
      windows: { from: 0.24, to: 0.56, pitch: 0.82, zf: 0.22, w: 0.36, h: 0.42 },
      doors: [[0.19, 0.05, 0.7, 1.45]],
      antennas: [[0.6, 0, 1, 0.22, 'blade']],
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
      windows: { from: 0.16, to: 0.7, pitch: 0.75, zf: 0.2, w: 0.27, h: 0.36 },
      doors: [[0.11, 0.02, 0.72, 1.75], [0.8, 0.02, 0.72, 1.75]],
      points: { wingRoot: [0.43, 0, 0.98], finRoot: [0.86, 0, 0.6], mainGear: [0.5, 0.9, -0.8], noseGear: [0.07, 0, -0.9] },
    },
  },
  'fus-narrowbody': {
    kind: 'craft-fuselage', realm: 'earth', label: 'narrowbody airliner fuselage', classOf: 'A320 / 737 class',
    aliases: ['narrowbody fuselage', 'single-aisle fuselage', 'airliner fuselage'],
    dims: { length: 37.6, width: 3.95, height: 4.14 }, mass: 9800, mount: null,
    build: {
      family: 'tube', n: 2, stations: AIRLINER_BARREL, windscreen: [0.045, 0.075],
      windows: { from: 0.11, to: 0.82, pitch: 0.533, zf: 0.26, w: 0.25, h: 0.33 },
      doors: [[0.075, 0.08, 0.81, 1.85], [0.885, 0.08, 0.81, 1.85], [0.415, 0.2, 0.51, 0.96]],
      antennas: [[0.3, 0, 1, 0.32, 'blade'], [0.55, 0, -1, 0.28, 'blade']],
      points: { wingRoot: [0.4, 0.92, -0.6], stabRoot: [0.9, 0.2, 0.1], finRoot: [0.82, 0, 0.75], noseGear: [0.06, 0, -0.9] } },
  },
  'fus-widebody': {
    kind: 'craft-fuselage', realm: 'earth', label: 'widebody airliner fuselage', classOf: '777 class',
    aliases: ['widebody fuselage', 'twin-aisle fuselage', 'jumbo fuselage'],
    dims: { length: 63.7, width: 6.19, height: 6.2 }, mass: 32000, mount: null,
    build: {
      family: 'tube', n: 2, stations: AIRLINER_BARREL, windscreen: [0.03, 0.05],
      windows: { from: 0.08, to: 0.86, pitch: 0.533, zf: 0.3, w: 0.27, h: 0.38 },
      doors: [[0.06, 0.08, 1.07, 1.93], [0.3, 0.08, 1.07, 1.93], [0.6, 0.08, 1.07, 1.93], [0.885, 0.08, 1.07, 1.93]],
      antennas: [[0.25, 0, 1, 0.38, 'blade'], [0.5, 0, -1, 0.32, 'blade']],
      points: { wingRoot: [0.4, 0.92, -0.6], stabRoot: [0.9, 0.2, 0.1], finRoot: [0.82, 0, 0.75], noseGear: [0.06, 0, -0.9] } },
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
    // the strake runs the root forward along the fuselage to the cockpit
    build: { planform: [[0, 7.6, -2.8], [0.08, 4.8, 0.26], [1, 1.0]], sweep: 40, dihedral: 0, thickness: 0.04, hinge: [0.08, 0.62, 0.22], points: { tip: [1, 0.5], station: [0.55, 0.4, 'lower'] } },
  },
  'wing-bizjet': {
    kind: 'craft-wing', realm: 'earth', label: 'swept business jet wing panel', classOf: 'Learjet 45 class',
    aliases: ['bizjet wing'], dims: { span: 6.6 }, mass: 640, mount: 'wing-root',
    build: { rootChord: 2.9, tipChord: 1.0, sweep: 16, dihedral: 2.5, thickness: 0.13, tipThickness: 0.1, camber: 0.015, twist: 2, hinge: [0.08, 0.95, 0.25], winglet: { height: 1.0, root: 0.9, tip: 0.5, sweep: 35, cant: 12 }, points: { gear: [0.12, 0.45, 'lower'] } },
  },
  'wing-regional': {
    kind: 'craft-wing', realm: 'earth', label: 'straight high wing panel, regional', classOf: 'ATR 72 class',
    aliases: ['turboprop wing', 'regional wing'], dims: { span: 13.5 }, mass: 1500, mount: 'wing-root',
    build: { rootChord: 2.57, tipChord: 1.4, sweep: 2, dihedral: 2, thickness: 0.18, tipThickness: 0.13, camber: 0.02, twist: 2, hinge: [0.08, 0.95, 0.26], points: { engine: [0.3, 0.02, 'lower'] } },
  },
  'wing-narrowbody': {
    kind: 'craft-wing', realm: 'earth', label: 'swept airliner wing panel, single aisle', classOf: 'A320 class',
    aliases: ['airliner wing', 'narrowbody wing'], dims: { span: 16.05 }, mass: 4400, mount: 'wing-root',
    build: {
      planform: [[0, 6.1], [0.3, 3.9], [1, 1.5]], sweep: 27, dihedral: 5.1, thickness: 0.15, tipThickness: 0.11, camber: 0.02, twist: 3, hinge: [0.05, 0.95, 0.22],
      fairings: [0.15, 0.3, 0.45], winglet: { height: 2.4, root: 0.85, tip: 0.35, sweep: 40, cant: 10 }, points: { engine: [0.243, 0.05, 'lower'], gear: [0.12, 0.62, 'lower'] },
    },
  },
  'wing-widebody': {
    kind: 'craft-wing', realm: 'earth', label: 'swept airliner wing panel, twin aisle', classOf: '777 class',
    aliases: ['widebody wing', 'jumbo wing'], dims: { span: 27.4 }, mass: 17000, mount: 'wing-root',
    build: {
      // the yehudi crank inboard, a raked tip outboard
      planform: [[0, 11.5], [0.3, 7.0], [0.92, 2.9], [1, 1.3, 20.1]], sweep: 34, dihedral: 6, thickness: 0.14, tipThickness: 0.1, camber: 0.02, twist: 3, hinge: [0.05, 0.92, 0.2], fairings: [0.13, 0.27, 0.41],
      points: { engine: [0.237, 0.05, 'lower'], gear: [0.09, 0.6, 'lower'] },
    },
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
    build: { retract: false, family: 'leg', strut: 0.63, oleo: 0.035, rake: 0.08, tyre: [0.36, 0.13] },
  },
  'gear-main-warbird': {
    kind: 'craft-gear', realm: 'earth', label: 'retractable main leg, piston fighter', classOf: 'P-51D class, 27 in tyre',
    aliases: ['warbird main gear'], dims: { height: 1.55 }, mass: 75, mount: 'gear-well',
    build: { retract: 'inward', family: 'leg', strut: 1.21, oleo: 0.07, rake: 0.12, tyre: [0.69, 0.22] },
  },
  'gear-tail-warbird': {
    kind: 'craft-gear', realm: 'earth', label: 'tailwheel', classOf: 'P-51D class',
    aliases: ['tail wheel', 'tailwheel'], dims: { height: 0.71 }, mass: 12, mount: 'gear-well',
    build: { retract: 'aft', family: 'leg', strut: 0.55, oleo: 0.04, rake: -0.12, tyre: [0.32, 0.1] },
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
    build: { retract: 'inward', family: 'leg', strut: 0.7, oleo: 0.07, wheels: 2, tyre: [0.56, 0.17] },
  },
  'gear-nose-bizjet': {
    kind: 'craft-gear', realm: 'earth', label: 'twin-wheel nose leg, business jet', classOf: 'Learjet 45 class',
    aliases: ['bizjet nose gear'], dims: { height: 1.02 }, mass: 30, mount: 'gear-well',
    build: { family: 'leg', strut: 0.79, oleo: 0.05, wheels: 2, rake: 0.1, tyre: [0.45, 0.14] },
  },
  'gear-main-regional': {
    kind: 'craft-gear', realm: 'earth', label: 'twin-wheel sponson leg, regional', classOf: 'ATR 72 class',
    aliases: ['regional main gear'], dims: { height: 1.2 }, mass: 220, mount: 'gear-well',
    build: { retract: 'inward', family: 'leg', strut: 0.8, oleo: 0.1, wheels: 2, tyre: [0.81, 0.25] },
  },
  'gear-nose-regional': {
    kind: 'craft-gear', realm: 'earth', label: 'twin-wheel nose leg, regional', classOf: 'ATR 72 class',
    aliases: ['regional nose gear'], dims: { height: 1.36 }, mass: 70, mount: 'gear-well',
    build: { family: 'leg', strut: 1.06, oleo: 0.07, wheels: 2, rake: 0.12, tyre: [0.56, 0.18] },
  },
  'gear-main-narrowbody': {
    kind: 'craft-gear', realm: 'earth', label: 'twin-wheel main leg, single aisle', classOf: 'A320 class, 46 in tyre',
    aliases: ['airliner main gear'], dims: { height: 2.75 }, mass: 1100, mount: 'gear-well',
    build: { retract: 'inward', family: 'leg', strut: 2.15, oleo: 0.16, wheels: 2, tyre: [1.17, 0.43] },
  },
  'gear-nose-narrowbody': {
    kind: 'craft-gear', realm: 'earth', label: 'twin-wheel nose leg, single aisle', classOf: 'A320 class, 30 in tyre',
    aliases: ['airliner nose gear'], dims: { height: 2.66 }, mass: 280, mount: 'gear-well',
    build: { family: 'leg', strut: 2.28, oleo: 0.1, wheels: 2, rake: 0.2, tyre: [0.76, 0.22] },
  },
  'gear-bogie-widebody': {
    kind: 'craft-gear', realm: 'earth', label: 'six-wheel main bogie, twin aisle', classOf: '777 class, 50 in tyre',
    aliases: ['bogie', 'main bogie', 'six wheel truck'], dims: { height: 4.36 }, mass: 4800, mount: 'gear-well',
    build: { retract: 'inward', family: 'bogie', strut: 3.7, oleo: 0.22, rows: 3, tyre: [1.32, 0.51] },
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
    build: { family: 'bubble', opens: 'slide', bows: [0.22] },
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
      // the long box nose of a snubfighter: square plates tapering to a flat wedge, a stepped cockpit
      family: 'facet', facets: BOX_CHAMFER,
      greebles: { top: 14, sides: 10, span: [0.5, 0.96] },
      stations: [[0, 0.2, 0.12, 0.4], [0.4, 0.46, 0.42, 0.44], [0.5, 0.7, 0.78, 0.49], [0.62, 1, 1, 0.5], [1, 1, 1, 0.5]],
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
      family: 'facet', facets: CHINE,
      greebles: { top: 6, sides: 6, span: [0.45, 0.95] },
      stations: [[0, 0.03, 0.03, 0.5], [0.25, 0.5, 0.45, 0.5], [0.5, 0.85, 0.8, 0.5], [0.7, 1, 1, 0.5], [1, 0.95, 0.95, 0.5]],
      points: { canopy: [0.3, 0, 0.82], wingRoot: [0.62, 0.85, -0.2], finRoot: [0.7, 0, 0.9], engineTop: [1, 0, 0.5], engineLow: [1, 0.55, -0.4], gun: [0.32, 0.75, -0.2], noseGear: [0.25, 0, -0.9], mainGear: [0.75, 0.6, -1] },
    },
  },
  'hull-heavy-fighter': {
    kind: 'craft-fuselage', realm: 'space', label: 'lifting-body heavy fighter hull', classOf: 'carrier heavy fighter register',
    aliases: ['heavy fighter hull', 'carrier fighter hull'], dims: { length: 18.0, width: 3.2, height: 2.4 }, mass: 14000, mount: null,
    build: {
      family: 'facet', facets: WEDGE,
      greebles: { top: 16, sides: 10, span: [0.35, 0.95] },
      stations: [[0, 0.04, 0.03, 0.45], [0.2, 0.55, 0.5, 0.45], [0.45, 0.9, 0.85, 0.5], [0.7, 1, 1, 0.5], [1, 0.85, 0.8, 0.5]],
      points: { canopy: [0.22, 0, 0.8], wingRoot: [0.5, 0.88, -0.3], finRoot: [0.78, 0.55, 0.8], engine: [0.97, 0.5, 0], noseGear: [0.25, 0, -0.9], mainGear: [0.62, 0.6, -1], rcs: [0.4, 0, 1] },
    },
  },
  'hull-pod-spine': {
    kind: 'craft-fuselage', realm: 'space', label: 'cockpit pod and spine hull', classOf: 'twin-nacelle bomber register',
    aliases: ['bomber hull', 'pod and spine hull'], dims: { length: 16.0, width: 2.4, height: 1.9 }, mass: 9000, mount: null,
    build: {
      family: 'facet', facets: BOX_BEVEL,
      greebles: { top: 12, sides: 10, span: [0.62, 0.98] },
      stations: [[0, 0.06, 0.06, 0.5], [0.08, 0.7, 0.6, 0.5], [0.2, 1, 1, 0.5], [0.3, 0.8, 0.8, 0.5], [0.36, 0.35, 0.42, 0.5], [0.62, 0.35, 0.42, 0.5], [0.68, 0.9, 0.8, 0.5], [0.8, 0.9, 0.8, 0.5], [0.84, 0.3, 0.3, 0.5], [1, 0.3, 0.3, 0.5]],
      points: { canopy: [0.08, 0, 0.55], turret: [0.2, 0, 0.98], crossbar: [0.74, 0.7, 0], launcher: [0.14, 0, -0.95], noseGear: [0.18, 0, -0.95], mainGear: [0.74, 0.6, -0.95] },
    },
  },
  'hull-utility-shuttle': {
    kind: 'craft-fuselage', realm: 'space', label: 'utility shuttle hull', classOf: 'colonial raptor register',
    aliases: ['utility shuttle hull', 'raptor hull', 'dropship hull'], dims: { length: 8.6, width: 3.2, height: 2.6 }, mass: 8000, mount: null,
    build: {
      family: 'facet', facets: BOX_CHAMFER,
      greebles: { top: 10, sides: 14, span: [0.2, 0.92] },
      stations: [[0, 0.4, 0.35, 0.42], [0.12, 0.85, 0.8, 0.48], [0.3, 1, 1, 0.5], [0.85, 1, 0.95, 0.52], [1, 0.8, 0.7, 0.55]],
      windscreen: [0.03, 0.15],
      points: { stub: [0.72, 0.9, -0.2], skidFront: [0.2, 0.6, -1], skidRear: [0.8, 0.7, -1], rcs: [0.6, 0, 1] },
    },
  },

  // ===== space: foils and panels ===============================================================
  'foil-strike': {
    kind: 'craft-wing', realm: 'space', label: 'split strike foil', classOf: 'strike-foil snubfighter register',
    aliases: ['s-foil', 'strike foil', 'x foil'], dims: { span: 4.6 }, mass: 700, mount: 'wing-root',
    // the foils split open to 13° for combat and close flat for cruise and landing: a fold at the root
    build: { section: 'facet', rootChord: 2.3, tipChord: 1.2, sweep: 4, dihedral: 13, thickness: 0.07, fold: { at: 0, angle: -13 }, stripes: [[0.6, 0.7]], points: { pod: [0.1, 0.25], tip: [1, 0.55] } },
  },
  'panel-hex': {
    kind: 'craft-wing', realm: 'space', label: 'hexagonal panel wing', classOf: 'twin-panel interceptor register',
    aliases: ['hex panel', 'solar panel wing', 'panel wing'], dims: { span: 0.24, height: 7.2, chord: 6.25 }, mass: 900, mount: 'wing-root',
    build: { family: 'panel', outline: 'hex' },
  },
  'wing-colonial-stub': {
    kind: 'craft-wing', realm: 'space', label: 'swept stub wing', classOf: 'colonial viper register',
    aliases: ['stub wing', 'viper wing'], dims: { span: 2.2 }, mass: 260, mount: 'wing-root',
    build: { section: 'facet', rootChord: 3.4, tipChord: 1.1, sweep: 45, dihedral: 0, thickness: 0.06, stripes: [[0.62, 0.78]] },
  },
  'wing-heavy-fighter': {
    kind: 'craft-wing', realm: 'space', label: 'swept lifting wing, heavy fighter', classOf: 'carrier heavy fighter register',
    aliases: ['heavy fighter wing'], dims: { span: 6.0 }, mass: 1500, mount: 'wing-root',
    // folds at mid span for the carrier's hangar deck
    build: { section: 'facet', rootChord: 7.0, tipChord: 1.6, sweep: 52, dihedral: -4, thickness: 0.06, hinge: [0.1, 0.85, 0.2], elevons: true, fold: { at: 0.5, angle: 105 }, points: { gun: [0.08, 0.05, 'mid'], store: [0.4, 0.4, 'lower'] } },
  },
  'fin-colonial': {
    kind: 'craft-fin', realm: 'space', label: 'dorsal fin, colonial dart', classOf: 'colonial viper register',
    aliases: ['dorsal fin'], dims: { span: 1.1 }, mass: 80, mount: 'tail-root',
    build: { vertical: true, section: 'facet', rootChord: 2.8, tipChord: 0.9, sweep: 50, thickness: 0.06 },
  },
  'fin-heavy-fighter': {
    kind: 'craft-fin', realm: 'space', label: 'twin tail fin, heavy fighter', classOf: 'carrier heavy fighter register',
    aliases: ['twin fin'], dims: { span: 2.4 }, mass: 160, mount: 'tail-root',
    build: { vertical: true, section: 'facet', rootChord: 3.6, tipChord: 1.2, sweep: 45, thickness: 0.06, cant: 12 },
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
    build: { family: 'bubble', facets: true, bows: [0.3, 0.6] },
  },
  'canopy-ball-window': {
    kind: 'craft-canopy', realm: 'space', label: 'round spoked viewport', classOf: 'twin-panel interceptor register',
    aliases: ['viewport', 'round window', 'cockpit window'], dims: { length: 0.16, width: 1.3, height: 1.3 }, mass: 60, mount: 'sill',
    build: { family: 'roundWindow', spokes: 8 },
  },
  'canopy-dart': {
    kind: 'craft-canopy', realm: 'space', label: 'teardrop canopy, colonial dart', classOf: 'colonial viper register',
    aliases: ['teardrop canopy'], dims: { length: 1.9, width: 0.8, height: 0.55 }, mass: 50, mount: 'sill',
    build: { family: 'bubble', facets: true, bows: [0.35] },
  },
  'canopy-armored': {
    kind: 'craft-canopy', realm: 'space', label: 'armoured canopy, heavy fighter', classOf: 'carrier heavy fighter register',
    aliases: ['armoured canopy', 'armored canopy'], dims: { length: 2.6, width: 1.1, height: 0.75 }, mass: 130, mount: 'sill',
    build: { family: 'bubble', facets: true, bows: [0.3, 0.65] },
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
  // ===== earth: the second wave (interceptor, carrier, attack, transport, stealth) ===============
  'fus-delta-interceptor': {
    kind: 'craft-fuselage', realm: 'earth', label: 'tailless delta interceptor fuselage', classOf: 'Mirage III class',
    aliases: ['delta fighter fuselage', 'interceptor fuselage'], dims: { length: 14.2, width: 1.55, height: 1.75 }, mass: 2400, mount: null,
    build: {
      family: 'tube', n: 2.4, nose: 0.08,
      stations: [[0, 0.02, 0.02, 0.56, 2], [0.07, 0.3, 0.32, 0.56, 2], [0.18, 0.58, 0.6, 0.56, 2], [0.3, 0.7, 0.85, 0.54, 2.2], [0.45, 1, 1, 0.5, 2.6], [0.8, 0.95, 0.9, 0.5, 2.4], [1, 0.62, 0.6, 0.5, 2]],
      antennas: [[0, 0, 0, 1.3, 'pitot']],
      points: { canopy: [0.19, 0, 0.82], intake: [0.3, 0.75, 0], wingRoot: [0.42, 0.85, -0.45], engine: [0.6, 0, 0], finRoot: [0.62, 0, 0.9], noseGear: [0.25, 0, -0.9], gun: [0.33, 0.6, -0.6] },
    },
  },
  'wing-delta-tailless': {
    kind: 'craft-wing', realm: 'earth', label: 'tailless delta wing panel', classOf: 'Mirage III class',
    aliases: ['tailless delta', 'pure delta wing'], dims: { span: 3.36 }, mass: 700, mount: 'wing-root',
    build: { rootChord: 6.3, tipChord: 0.6, sweep: 60, dihedral: -1, thickness: 0.045, hinge: [0.05, 0.95, 0.15], elevons: true, points: { gear: [0.3, 0.45, 'lower'], tip: [1, 0.4] } },
  },
  'fin-delta': {
    kind: 'craft-fin', realm: 'earth', label: 'swept fin, delta interceptor', classOf: 'Mirage III class',
    aliases: ['delta fin'], dims: { span: 2.0 }, mass: 110, mount: 'tail-root',
    build: { vertical: true, rootChord: 3.9, tipChord: 0.9, sweep: 55, thickness: 0.05, hinge: [0, 0.8, 0.25] },
  },
  'eng-turbojet-ab': {
    kind: 'craft-engine', realm: 'earth', label: 'afterburning turbojet', classOf: 'Atar 9C class',
    aliases: ['turbojet', 'afterburning turbojet'], dims: { length: 5.9, diameter: 1.0 }, mass: 1456, perf: { thrust: 42, wet: 60.8 }, mount: 'bay-mount',
    build: { family: 'core' },
  },
  'intake-half-cone': {
    kind: 'craft-intake', realm: 'earth', label: 'half-cone side intake', classOf: 'Mirage III class',
    aliases: ['half cone intake', 'shock cone intake'], dims: { length: 3.5, width: 0.55, height: 0.8 }, mass: 60, mount: 'hull-patch',
    build: { family: 'halfCone', n: 2.4 },
  },
  'intake-chin': {
    kind: 'craft-intake', realm: 'earth', label: 'chin intake', classOf: 'F-16 class',
    aliases: ['chin intake', 'belly intake'], dims: { length: 4.0, width: 1.0, height: 0.7 }, mass: 90, mount: 'hull-patch',
    build: { family: 'chin', n: 3 },
  },
  'intake-side-d': {
    kind: 'craft-intake', realm: 'earth', label: 'D-shaped side intake', classOf: 'F/A-18 class',
    aliases: ['side intake', 'cheek intake'], dims: { length: 3.2, width: 0.6, height: 0.75 }, mass: 70, mount: 'hull-patch',
    build: { family: 'side', n: 3 },
  },
  'canopy-framed-low': {
    kind: 'craft-canopy', realm: 'earth', label: 'low framed canopy', classOf: 'Mirage III class',
    aliases: ['low canopy', 'delta canopy'], dims: { length: 2.2, width: 0.75, height: 0.55 }, mass: 55, mount: 'sill',
    build: { family: 'bubble', bows: [0.2, 0.55] },
  },
  'gun-revolver-30': {
    kind: 'craft-weapon', realm: 'earth', label: '30 mm revolver cannon', classOf: 'DEFA 552 class',
    aliases: ['revolver cannon', '30 mm cannon'], dims: { length: 2.0, diameter: 0.2 }, mass: 85, perf: { rounds: 1300 }, mount: 'hardpoint',
    build: { family: 'cannon', body: 0.5 },
  },
  'gear-main-delta': {
    kind: 'craft-gear', realm: 'earth', label: 'main leg, delta interceptor', classOf: 'Mirage III class',
    aliases: ['delta main gear'], dims: { height: 1.4 }, mass: 90, mount: 'gear-well',
    build: { retract: 'inward', family: 'leg', strut: 0.87, oleo: 0.07, tyre: [0.75, 0.21] },
  },
  'gear-nose-delta': {
    kind: 'craft-gear', realm: 'earth', label: 'nose leg, delta interceptor', classOf: 'Mirage III class',
    aliases: ['delta nose gear'], dims: { height: 1.3 }, mass: 35, mount: 'gear-well',
    build: { family: 'leg', strut: 1.08, oleo: 0.05, rake: 0.1, tyre: [0.45, 0.15] },
  },

  'fus-carrier-twin': {
    kind: 'craft-fuselage', realm: 'earth', label: 'twin-engine carrier fighter fuselage', classOf: 'F/A-18 class',
    aliases: ['carrier fighter fuselage', 'naval fighter fuselage'], dims: { length: 16.6, width: 2.3, height: 2.0 }, mass: 4100, mount: null,
    build: {
      family: 'tube', n: 2.6, nose: 0.06,
      stations: [[0, 0.02, 0.02, 0.6, 2], [0.06, 0.3, 0.33, 0.62, 2], [0.16, 0.46, 0.55, 0.6, 2], [0.3, 0.58, 0.75, 0.55, 2.4], [0.45, 0.9, 0.92, 0.5, 3], [0.7, 1, 0.9, 0.5, 3.2], [0.92, 0.85, 0.7, 0.5, 3], [1, 0.75, 0.55, 0.5, 3]],
      antennas: [[0.45, 0, 1, 0.25, 'blade'], [0.5, 0, -1, 0.22, 'blade']],
      points: { canopy: [0.17, 0, 0.8], gun: [0.12, 0, 0.35], intake: [0.4, 0.62, -0.45], wingRoot: [0.27, 0.8, 0], engine: [0.77, 0.42, 0], stabRoot: [0.84, 0.8, 0], finRoot: [0.62, 0.55, 0.85], mainGear: [0.58, 0.75, -1], noseGear: [0.15, 0, -1] },
    },
  },
  'wing-carrier-fold': {
    kind: 'craft-wing', realm: 'earth', label: 'folding wing with leading-edge extension', classOf: 'F/A-18 class',
    aliases: ['folding wing', 'lex wing', 'naval wing'], dims: { span: 5.5 }, mass: 900, mount: 'wing-root',
    // the LEX runs from the apex (the mount) to the main wing's leading edge; the outer panel folds up
    build: {
      planform: [[0, 9.0, 0, 0], [0.09, 4.3, 4.9], [1, 1.7, 7.4]], dihedral: -3, thickness: 0.05, hinge: [0.12, 0.95, 0.25],
      fold: { at: 0.55, angle: 100 }, points: { tip: [1, 0.4], station: [0.4, 0.35, 'lower'] },
    },
  },
  'stab-carrier': {
    kind: 'craft-stabilizer', realm: 'earth', label: 'all-moving stabilator, carrier fighter', classOf: 'F/A-18 class',
    aliases: ['naval stabilator'], dims: { span: 2.7 }, mass: 170, mount: 'tail-root',
    build: { rootChord: 2.6, tipChord: 1.1, sweep: 42, dihedral: -2, thickness: 0.04 },
  },
  'fin-carrier-canted': {
    kind: 'craft-fin', realm: 'earth', label: 'canted twin fin', classOf: 'F/A-18 class',
    aliases: ['canted fin', 'twin tail'], dims: { span: 2.1 }, mass: 130, mount: 'tail-root',
    build: { vertical: true, rootChord: 3.3, tipChord: 1.3, sweep: 35, cant: 20, thickness: 0.05, hinge: [0.05, 0.85, 0.25] },
  },
  'eng-turbofan-ab-small': {
    kind: 'craft-engine', realm: 'earth', label: 'small afterburning turbofan', classOf: 'F404 class',
    aliases: ['small afterburning turbofan'], dims: { length: 4.03, diameter: 0.88 }, mass: 1036, perf: { thrust: 48.9, wet: 79 }, mount: 'bay-mount',
    build: { family: 'core' },
  },
  'gear-main-carrier': {
    kind: 'craft-gear', realm: 'earth', label: 'carrier main leg', classOf: 'F/A-18 class',
    aliases: ['carrier main gear'], dims: { height: 1.1 }, mass: 160, mount: 'gear-well',
    build: { retract: 'aft', family: 'leg', strut: 0.65, oleo: 0.09, tyre: [0.76, 0.24] },
  },
  'gear-nose-carrier': {
    kind: 'craft-gear', realm: 'earth', label: 'catapult nose leg', classOf: 'F/A-18 class',
    aliases: ['catapult nose gear', 'launch bar nose gear'], dims: { height: 1.75 }, mass: 80, mount: 'gear-well',
    build: { family: 'leg', strut: 1.34, oleo: 0.07, wheels: 2, rake: 0.15, tyre: [0.56, 0.17] },
  },

  'fus-corsair': {
    kind: 'craft-fuselage', realm: 'earth', label: 'carrier piston fighter fuselage', classOf: 'F4U Corsair class',
    aliases: ['corsair fuselage'], dims: { length: 8.2, width: 1.15, height: 1.75 }, mass: 700, mount: null,
    build: {
      family: 'tube', n: 2.2,
      stations: [[0, 0.95, 0.9, 0.52], [0.12, 1, 1, 0.5], [0.42, 0.95, 1, 0.5], [0.65, 0.7, 0.8, 0.52], [0.88, 0.32, 0.55, 0.58, 2], [1, 0.1, 0.32, 0.62, 2]],
      points: { cowl: [0, 0, 0], canopy: [0.4, 0, 0.88], wingRoot: [0.16, 0.8, -0.62], stabRoot: [0.9, 0, 0], finRoot: [0.82, 0, 0.62], tailGear: [0.88, 0, -0.9] },
    },
  },
  'wing-gull-fold': {
    kind: 'craft-wing', realm: 'earth', label: 'inverted gull wing, folding', classOf: 'F4U Corsair class',
    aliases: ['gull wing', 'inverted gull wing'], dims: { span: 5.6 }, mass: 520, mount: 'wing-root',
    // dips 13° to the crank (short main gear stands there), climbs 9° out; folds up just outboard of the crank
    build: {
      planform: [[0, 2.6, 0, 0], [0.3, 2.45, 0.09, -0.42], [1, 1.2, 0.3, 0.2]], thickness: 0.15, tipThickness: 0.1, camber: 0.02, twist: 2,
      hinge: [0.05, 0.95, 0.24], fold: { at: 0.36, angle: 120 }, points: { gear: [0.3, 0.3, 'lower'], gun: [0.33, 0.62] },
    },
  },
  'stab-corsair': {
    kind: 'craft-stabilizer', realm: 'earth', label: 'horizontal stabilizer, carrier piston fighter', classOf: 'F4U Corsair class',
    aliases: ['corsair tailplane'], dims: { span: 2.4 }, mass: 35, mount: 'tail-root',
    build: { rootChord: 1.55, tipChord: 0.8, sweep: 5, thickness: 0.1, hinge: [0, 0.95, 0.36] },
  },
  'fin-corsair': {
    kind: 'craft-fin', realm: 'earth', label: 'vertical fin, carrier piston fighter', classOf: 'F4U Corsair class',
    aliases: ['corsair fin'], dims: { span: 1.55 }, mass: 25, mount: 'tail-root',
    build: { vertical: true, rootChord: 1.7, tipChord: 0.8, sweep: 25, thickness: 0.1, hinge: [0, 0.95, 0.36] },
  },
  'eng-radial-18': {
    kind: 'craft-engine', realm: 'earth', label: '18-cylinder radial with cowl', classOf: 'R-2800 class',
    aliases: ['radial engine', 'double wasp class radial'], dims: { length: 1.45, diameter: 1.32 }, mass: 1070, perf: { power: 1566 }, mount: 'nose-mount',
    build: { family: 'radial' },
  },
  'prop-4-corsair': {
    kind: 'craft-propeller', realm: 'earth', label: 'four-blade 13 ft propeller', classOf: 'F4U-4 class',
    aliases: ['corsair propeller'], dims: { diameter: 4.0 }, mass: 280, mount: 'hub-mount',
    build: { blades: 4, hubDiameter: 0.5, spinnerLength: 0.5, rootChord: 0.3, tipChord: 0.18, rootPitch: 45, tipPitch: 20 },
  },
  'gear-main-corsair': {
    kind: 'craft-gear', realm: 'earth', label: 'short main leg at the gull crank', classOf: 'F4U Corsair class',
    aliases: ['corsair main gear'], dims: { height: 1.2 }, mass: 90, mount: 'gear-well',
    build: { retract: 'aft', family: 'leg', strut: 0.8, oleo: 0.08, rake: 0.1, tyre: [0.81, 0.25] },
  },
  'gear-tail-corsair': {
    kind: 'craft-gear', realm: 'earth', label: 'tailwheel and hook', classOf: 'F4U Corsair class',
    aliases: ['corsair tailwheel'], dims: { height: 0.6 }, mass: 14, mount: 'gear-well',
    build: { retract: 'aft', family: 'leg', strut: 0.75, oleo: 0.04, rake: -0.12, tyre: [0.32, 0.1] },
  },

  'fus-attack': {
    kind: 'craft-fuselage', realm: 'earth', label: 'armoured attack fuselage', classOf: 'A-10 class',
    aliases: ['attack fuselage', 'tank buster fuselage'], dims: { length: 14.0, width: 1.6, height: 2.2 }, mass: 3600, mount: null,
    build: {
      family: 'tube', n: 2.8,
      stations: [[0, 0.35, 0.42, 0.42, 2.4], [0.06, 0.8, 0.82, 0.48, 2.8], [0.2, 1, 1, 0.5, 3], [0.55, 0.95, 0.9, 0.5, 3], [0.85, 0.5, 0.6, 0.55, 2.6], [1, 0.18, 0.3, 0.62, 2]],
      points: { canopy: [0.11, 0, 0.82], gun: [0.357, 0, -0.55], wingRoot: [0.42, 0.85, -0.75], engineStub: [0.7, 0.5, 0.8], stabRoot: [0.94, 0, 0.1], noseGear: [0.1, 0.3, -1] },
    },
  },
  'wing-attack-straight': {
    kind: 'craft-wing', realm: 'earth', label: 'straight thick wing with gear pods', classOf: 'A-10 class',
    aliases: ['straight wing', 'attack wing'], dims: { span: 7.95 }, mass: 1700, mount: 'wing-root',
    build: {
      planform: [[0, 3.04, 0, 0], [0.35, 2.85, 0, 0], [1, 1.95, 0.25, 0.63]], thickness: 0.16, tipThickness: 0.13, camber: 0.03,
      hinge: [0.05, 0.95, 0.25], points: { gear: [0.33, 0.3, 'lower'], store: [0.55, 0.35, 'lower'] },
    },
  },
  'stab-attack': {
    kind: 'craft-stabilizer', realm: 'earth', label: 'H-tail stabilizer', classOf: 'A-10 class',
    aliases: ['h tail', 'twin boom tailplane'], dims: { span: 2.85 }, mass: 160, mount: 'tail-root',
    build: { rootChord: 2.0, tipChord: 2.0, sweep: 0, thickness: 0.1, hinge: [0, 0.9, 0.35], points: { tip: [1, 0.15] } },
  },
  'fin-attack': {
    kind: 'craft-fin', realm: 'earth', label: 'end-plate fin', classOf: 'A-10 class',
    aliases: ['end plate fin'], dims: { span: 2.1 }, mass: 70, mount: 'tail-root',
    build: { vertical: true, rootChord: 2.1, tipChord: 1.5, sweep: 10, thickness: 0.1, hinge: [0, 0.95, 0.35] },
  },
  'eng-turbofan-attack': {
    kind: 'craft-engine', realm: 'earth', label: 'high-bypass turbofan on aft pylon', classOf: 'TF34 class',
    aliases: ['podded turbofan', 'attack engine'], dims: { length: 3.6, diameter: 1.32 }, mass: 653, perf: { thrust: 40.3 }, mount: 'pod-mount',
    build: { family: 'turbofan', fanDiameter: 1.1, mountAt: 0.45, mountFace: 'inboard' },
  },
  'pylon-attack-stub': {
    kind: 'craft-pylon', realm: 'earth', label: 'aft engine pylon, attack', classOf: 'A-10 class',
    aliases: ['attack engine pylon'], dims: { length: 0.35, chord: 2.2 }, mass: 90, mount: 'hull-store',
    build: { family: 'stub', thickness: 0.18 },
  },
  'gun-rotary-30': {
    kind: 'craft-weapon', realm: 'earth', label: 'seven-barrel 30 mm rotary cannon', classOf: 'GAU-8 class',
    aliases: ['avenger class cannon', '30 mm rotary cannon'], dims: { length: 6.0, diameter: 0.6 }, mass: 1830, perf: { rounds: 3900 }, mount: 'hardpoint',
    build: { family: 'rotary' },
  },
  'canopy-bubble-attack': {
    kind: 'craft-canopy', realm: 'earth', label: 'bubble canopy, attack', classOf: 'A-10 class',
    aliases: ['attack canopy'], dims: { length: 2.4, width: 0.95, height: 0.8 }, mass: 110, mount: 'sill',
    build: { family: 'bubble', opens: 'hinge', bows: [0.25] },
  },
  'gear-main-attack': {
    kind: 'craft-gear', realm: 'earth', label: 'pod-mounted main leg', classOf: 'A-10 class',
    aliases: ['attack main gear'], dims: { height: 1.3 }, mass: 180, mount: 'gear-well',
    build: { family: 'leg', strut: 0.85, oleo: 0.1, tyre: [0.91, 0.3] },
  },
  'gear-nose-attack': {
    kind: 'craft-gear', realm: 'earth', label: 'offset nose leg', classOf: 'A-10 class',
    aliases: ['offset nose gear'], dims: { height: 1.3 }, mass: 70, mount: 'gear-well',
    build: { family: 'leg', strut: 1.0, oleo: 0.07, rake: 0.1, tyre: [0.61, 0.2] },
  },

  'fus-tactical-transport': {
    kind: 'craft-fuselage', realm: 'earth', label: 'tactical transport fuselage with ramp', classOf: 'C-130 class',
    aliases: ['transport fuselage', 'cargo fuselage'], dims: { length: 29.3, width: 4.3, height: 4.7 }, mass: 14000, mount: null,
    build: {
      family: 'tube', n: 2.8, nose: 0.035,
      stations: [[0, 0.05, 0.05, 0.42, 2], [0.04, 0.55, 0.55, 0.45, 2.2], [0.1, 0.92, 0.9, 0.5, 2.8], [0.16, 1, 1, 0.5], [0.66, 1, 1, 0.5], [0.8, 0.85, 0.72, 0.62], [0.93, 0.55, 0.38, 0.8, 2.4], [1, 0.25, 0.18, 0.88, 2]],
      windscreen: [0.045, 0.09],
      windows: { from: 0.14, to: 0.62, pitch: 2.1, zf: 0.32, w: 0.4, h: 0.4 },
      doors: [[0.12, -0.25, 0.9, 1.8], [0.74, -0.2, 0.9, 1.8]],
      antennas: [[0.25, 0, 1, 0.4, 'blade'], [0.6, 0, 1, 0.3, 'blade']],
      points: { wingRoot: [0.36, 0, 1], finRoot: [0.84, 0, 0.75], stabRoot: [0.93, 0.3, 0], mainGear: [0.47, 0.98, -0.85], noseGear: [0.08, 0, -0.9] },
    },
  },
  'wing-transport-high': {
    kind: 'craft-wing', realm: 'earth', label: 'high wing panel, four-engine transport', classOf: 'C-130 class',
    aliases: ['transport wing'], dims: { span: 20.2 }, mass: 4300, mount: 'wing-root',
    build: {
      planform: [[0, 4.88], [0.45, 4.6], [1, 2.44]], sweep: 2, dihedral: 2.5, thickness: 0.17, tipThickness: 0.12, camber: 0.025, twist: 2,
      hinge: [0.05, 0.95, 0.26], points: { engineIn: [0.243, 0.0, 'lower'], engineOut: [0.505, 0.02, 'lower'] },
    },
  },
  'stab-transport': {
    kind: 'craft-stabilizer', realm: 'earth', label: 'horizontal stabilizer, transport', classOf: 'C-130 class',
    aliases: ['transport tailplane'], dims: { span: 7.3 }, mass: 600, mount: 'tail-root',
    build: { rootChord: 3.9, tipChord: 2.0, sweep: 8, thickness: 0.11, hinge: [0, 0.95, 0.32] },
  },
  'fin-transport': {
    kind: 'craft-fin', realm: 'earth', label: 'vertical fin, transport', classOf: 'C-130 class',
    aliases: ['transport fin'], dims: { span: 6.2 }, mass: 500, mount: 'tail-root',
    build: { vertical: true, rootChord: 6.6, tipChord: 2.9, sweep: 30, thickness: 0.12, hinge: [0, 0.95, 0.3] },
  },
  'eng-turboprop-t56': {
    kind: 'craft-engine', realm: 'earth', label: 'turboprop in long underwing nacelle', classOf: 'T56 class',
    aliases: ['transport turboprop'], dims: { length: 5.8, diameter: 1.35 }, mass: 880, perf: { power: 3430 }, mount: 'pod-mount',
    build: { family: 'turboprop', mountAt: 0.28 },
  },
  'prop-4-transport': {
    kind: 'craft-propeller', realm: 'earth', label: 'four-blade paddle propeller', classOf: '54H60 class',
    aliases: ['paddle propeller'], dims: { diameter: 4.11 }, mass: 500, mount: 'hub-mount',
    build: { blades: 4, hubDiameter: 0.75, spinnerLength: 1.1, rootChord: 0.33, tipChord: 0.26, rootPitch: 48, tipPitch: 22 },
  },
  'gear-tandem-transport': {
    kind: 'craft-gear', realm: 'earth', label: 'tandem sponson main gear', classOf: 'C-130 class',
    aliases: ['tandem gear', 'sponson gear'], dims: { height: 1.2 }, mass: 700, mount: 'gear-well',
    build: { retract: 'inward', family: 'bogie', strut: 0.62, oleo: 0.14, rows: 2, single: true, tyre: [1.14, 0.39] },
  },
  'gear-nose-transport': {
    kind: 'craft-gear', realm: 'earth', label: 'twin-wheel nose leg, transport', classOf: 'C-130 class',
    aliases: ['transport nose gear'], dims: { height: 1.3 }, mass: 250, mount: 'gear-well',
    build: { family: 'leg', strut: 0.96, oleo: 0.1, wheels: 2, rake: 0.1, tyre: [0.99, 0.3] },
  },

  'fus-stealth-facet': {
    kind: 'craft-fuselage', realm: 'earth', label: 'faceted stealth fuselage', classOf: 'F-117 class',
    aliases: ['faceted fuselage', 'stealth fuselage'], dims: { length: 19.6, width: 3.4, height: 1.7 }, mass: 4800, mount: null,
    build: {
      family: 'facet', facets: STEALTH,
      stations: [[0, 0.03, 0.03, 0.45], [0.12, 0.28, 0.4, 0.48], [0.28, 0.5, 0.85, 0.5], [0.45, 0.72, 1, 0.5], [0.75, 1, 0.8, 0.48], [0.92, 0.85, 0.55, 0.45], [1, 0.7, 0.25, 0.42]],
      points: { canopy: [0.17, 0, 0.72], wingRoot: [0.15, 0.9, -0.5], engine: [0.45, 0.45, -0.1], finRoot: [0.7, 0.55, 0.55], mainGear: [0.55, 0.6, -1], noseGear: [0.2, 0, -1] },
    },
  },
  'wing-stealth-facet': {
    kind: 'craft-wing', realm: 'earth', label: 'faceted arrowhead wing panel', classOf: 'F-117 class',
    aliases: ['faceted wing', 'flat panel wing', 'stealth wing'], dims: { span: 6.1 }, mass: 1300, mount: 'wing-root',
    build: { section: 'facet', planform: [[0, 13.0], [1, 1.2]], sweep: 67.5, thickness: 0.06, hinge: [0.3, 0.95, 0.15], elevons: true },
  },
  'fin-stealth-vtail': {
    kind: 'craft-fin', realm: 'earth', label: 'faceted V-tail ruddervator', classOf: 'F-117 class',
    aliases: ['v tail', 'ruddervator'], dims: { span: 2.6 }, mass: 140, mount: 'tail-root',
    build: { vertical: true, section: 'facet', rootChord: 3.2, tipChord: 1.5, sweep: 50, cant: 50, thickness: 0.06 },
  },
  'eng-turbofan-buried': {
    kind: 'craft-engine', realm: 'earth', label: 'non-afterburning turbofan, buried', classOf: 'F404 (dry) class',
    aliases: ['buried turbofan'], dims: { length: 4.0, diameter: 0.88 }, mass: 1000, perf: { thrust: 48 }, mount: 'bay-mount',
    build: { family: 'core' },
  },
  'canopy-facet': {
    kind: 'craft-canopy', realm: 'earth', label: 'faceted flat-pane canopy', classOf: 'F-117 class',
    aliases: ['faceted canopy', 'flat pane canopy'], dims: { length: 2.8, width: 1.0, height: 0.6 }, mass: 120, mount: 'sill',
    build: { family: 'bubble', facets: true, stations: [[0, 0.3, 0.2], [0.35, 1, 0.9], [0.75, 0.95, 1], [1, 0.55, 0.45]] },
  },
  'gear-main-stealth': {
    kind: 'craft-gear', realm: 'earth', label: 'main leg, stealth strike', classOf: 'F-117 class',
    aliases: ['stealth main gear'], dims: { height: 1.4 }, mass: 150, mount: 'gear-well',
    build: { retract: 'forward', family: 'leg', strut: 0.7, oleo: 0.08, tyre: [0.75, 0.23] },
  },
  'gear-nose-stealth': {
    kind: 'craft-gear', realm: 'earth', label: 'nose leg, stealth strike', classOf: 'F-117 class',
    aliases: ['stealth nose gear'], dims: { height: 1.3 }, mass: 60, mount: 'gear-well',
    build: { family: 'leg', strut: 1.1, oleo: 0.06, rake: 0.1, tyre: [0.55, 0.17] },
  },

  // ===== space: the second wave ===============================================================
  'hull-arrow-wedge': {
    kind: 'craft-fuselage', realm: 'space', label: 'arrowhead wedge hull', classOf: 'arrowhead interceptor register',
    aliases: ['wedge hull', 'arrowhead hull'], dims: { length: 7.8, width: 3.6, height: 1.25 }, mass: 3000, mount: null,
    build: {
      family: 'facet', facets: WEDGE,
      greebles: { top: 6, sides: 0, span: [0.5, 0.95] },
      stations: [[0, 0.05, 0.2, 0.5], [0.25, 0.35, 0.6, 0.5], [0.6, 0.75, 0.95, 0.5], [1, 1, 1, 0.5]],
      points: { canopy: [0.35, 0, 0.7], wingRoot: [0.62, 0.9, 0], noseGear: [0.3, 0, -0.9], mainGear: [0.85, 0.5, -1] },
    },
  },
  'wing-arrow-facet': {
    kind: 'craft-wing', realm: 'space', label: 'flat-panel pod wing', classOf: 'arrowhead interceptor register',
    aliases: ['pod wing'], dims: { span: 1.4 }, mass: 300, mount: 'wing-root',
    build: { section: 'facet', planform: [[0, 3.6], [1, 3.0]], sweep: 25, thickness: 0.12, points: { pod: [1, 0.45], gun: [1, 0.05] } },
  },
  'drive-pod-arrow': {
    kind: 'craft-engine', realm: 'space', label: 'oversized drive pod, interceptor', classOf: 'arrowhead interceptor register',
    aliases: ['interceptor drive pod'], dims: { length: 4.4, diameter: 1.15 }, mass: 900, perf: { thrust: 70 }, mount: 'pod-mount',
    build: { family: 'pod' },
  },
  'fin-pod': {
    kind: 'craft-fin', realm: 'space', label: 'pod fin', classOf: 'arrowhead interceptor register',
    aliases: ['pod fin', 'stabiliser fin'], dims: { span: 1.1 }, mass: 40, mount: 'tail-root',
    build: { vertical: true, section: 'facet', rootChord: 2.6, tipChord: 1.0, sweep: 40, thickness: 0.06 },
  },
  'canopy-arrow': {
    kind: 'craft-canopy', realm: 'space', label: 'low canopy, interceptor', classOf: 'arrowhead interceptor register',
    aliases: ['interceptor canopy'], dims: { length: 2.0, width: 0.9, height: 0.5 }, mass: 50, mount: 'sill',
    build: { family: 'bubble', facets: true, bows: [0.4] },
  },
  'strut-short': {
    kind: 'craft-gear', realm: 'space', label: 'short landing strut', classOf: 'starfighter',
    aliases: ['short strut'], dims: { height: 0.7 }, mass: 30, mount: 'gear-well',
    build: { family: 'skid', strut: 0.7, oleo: 0.05, pad: [0.45] },
  },

  'hull-panel-advanced': {
    kind: 'craft-fuselage', realm: 'space', label: 'elongated cockpit pod', classOf: 'bent-panel fighter register',
    aliases: ['elongated pod', 'advanced pod'], dims: { length: 9.0, width: 2.7, height: 2.6 }, mass: 3400, mount: null,
    build: {
      family: 'tube', n: 2,
      stations: [[0, 0.3, 0.3, 0.5], [0.08, 0.8, 0.8, 0.5], [0.2, 1, 1, 0.5], [0.35, 0.95, 0.95, 0.5], [0.7, 0.6, 0.55, 0.5, 2.4], [1, 0.45, 0.35, 0.5, 2.6]],
      points: { window: [0.03, 0, 0], wingRoot: [0.36, 0.85, 0], vents: [1, 0, 0], chin: [0.12, 0.35, -0.8] },
    },
  },
  'panel-bent': {
    kind: 'craft-wing', realm: 'space', label: 'bent flat panel wing', classOf: 'bent-panel fighter register',
    aliases: ['bent panel', 'folded panel wing'], dims: { span: 4.2 }, mass: 700, mount: 'wing-root',
    // a flat panel, flaring wider outboard, bent down at its crease: the fold is the shape, not a stance
    build: { section: 'facet', planform: [[0, 3.0, 0, 0], [0.45, 4.2, -0.6, 0], [1, 5.4, -1.2, 0]], thickness: 0.05, fold: { at: 0.45, angle: -78, fixed: true } },
  },

  'hull-command-shuttle': {
    kind: 'craft-fuselage', realm: 'space', label: 'command shuttle hull', classOf: 'tri-wing command shuttle register',
    aliases: ['command shuttle hull', 'shuttle hull'], dims: { length: 15.0, width: 4.6, height: 4.2 }, mass: 22000, mount: null,
    build: {
      family: 'facet', facets: BOX_BEVEL,
      greebles: { top: 10, sides: 12, span: [0.3, 0.92] },
      stations: [[0, 0.5, 0.45, 0.42, 3], [0.12, 0.85, 0.8, 0.48], [0.25, 1, 1, 0.5, 4], [0.85, 1, 0.95, 0.5, 4], [1, 0.85, 0.8, 0.52]],
      windscreen: [0.02, 0.1],
      points: { finRoot: [0.45, 0, 0.98], wingRoot: [0.5, 0.95, -0.55], engine: [0.98, 0.45, 0], gun: [0.06, 0.6, -0.6], noseGear: [0.15, 0, -1], mainGear: [0.8, 0.6, -1] },
    },
  },
  'fin-shuttle-dorsal': {
    kind: 'craft-fin', realm: 'space', label: 'tall dorsal wing', classOf: 'tri-wing command shuttle register',
    aliases: ['dorsal wing', 'shuttle fin'], dims: { span: 9.0 }, mass: 2200, mount: 'tail-root',
    build: { vertical: true, section: 'facet', planform: [[0, 9.0, 0], [1, 5.0, -0.8]], thickness: 0.06 },
  },
  'wing-shuttle-fold': {
    kind: 'craft-wing', realm: 'space', label: 'folding shuttle wing', classOf: 'tri-wing command shuttle register',
    aliases: ['shuttle wing', 'folding shuttle wing'], dims: { span: 8.4 }, mass: 2600, mount: 'wing-root',
    // hangs 40° down in flight; the whole wing turns about its root to stand up for landing
    build: { section: 'facet', planform: [[0, 8.0, 0], [1, 4.6, 1.0]], dihedral: -40, thickness: 0.06, fold: { at: 0, angle: 125 } },
  },
  'drive-pod-command': {
    kind: 'craft-engine', realm: 'space', label: 'drive pod, command shuttle', classOf: 'tri-wing command shuttle register',
    aliases: ['command shuttle drive'], dims: { length: 3.4, diameter: 1.5 }, mass: 1600, perf: { thrust: 260 }, mount: 'pod-mount',
    build: { family: 'pod' },
  },

  'hull-starliner': {
    kind: 'craft-fuselage', realm: 'space', label: 'starliner hull', classOf: 'starliner register',
    aliases: ['starliner hull', 'liner hull'], dims: { length: 44.0, width: 5.6, height: 5.2 }, mass: 60000, mount: null,
    build: {
      family: 'facet', facets: CHINE,
      greebles: { top: 10, sides: 8, span: [0.5, 0.9] },
      stations: [[0, 0.02, 0.02, 0.5], [0.08, 0.45, 0.4, 0.5], [0.2, 0.8, 0.75, 0.5], [0.4, 1, 1, 0.5], [0.7, 0.95, 0.9, 0.52], [0.9, 0.6, 0.55, 0.55], [1, 0.25, 0.25, 0.56]],
      windscreen: [0.05, 0.09],
      points: { wingRoot: [0.42, 0.85, -0.3], finRoot: [0.78, 0, 0.85], engineStub: [0.76, 0.75, 0.2], noseGear: [0.12, 0, -0.95] },
    },
  },
  'wing-starliner': {
    kind: 'craft-wing', realm: 'space', label: 'swept starliner wing', classOf: 'starliner register',
    aliases: ['starliner wing'], dims: { span: 12.0 }, mass: 14000, mount: 'wing-root',
    build: { section: 'facet', rootChord: 14.0, tipChord: 3.0, sweep: 52, dihedral: 3, thickness: 0.08, winglet: { height: 2.4, root: 0.9, tip: 0.5, sweep: 45, cant: 15 }, points: { gear: [0.12, 0.6, 'lower'] } },
  },
  'fin-starliner': {
    kind: 'craft-fin', realm: 'space', label: 'dorsal fin, starliner', classOf: 'starliner register',
    aliases: ['starliner fin'], dims: { span: 7.0 }, mass: 3000, mount: 'tail-root',
    build: { section: 'facet', vertical: true, rootChord: 9.0, tipChord: 3.0, sweep: 55, thickness: 0.08 },
  },
  'stub-liner': {
    kind: 'craft-pylon', realm: 'space', label: 'drive stub, starliner', classOf: 'starliner register',
    aliases: ['liner stub'], dims: { length: 1.4, chord: 5.0 }, mass: 1200, mount: 'hull-store',
    build: { family: 'stub', thickness: 0.2 },
  },
  'drive-pod-liner': {
    kind: 'craft-engine', realm: 'space', label: 'main drive pod, starliner', classOf: 'starliner register',
    aliases: ['liner drive'], dims: { length: 11.0, diameter: 3.2 }, mass: 9000, perf: { thrust: 1100 }, mount: 'pod-mount',
    build: { family: 'pod' },
  },
  'strut-liner': {
    kind: 'craft-gear', realm: 'space', label: 'landing strut, starliner', classOf: 'starliner register',
    aliases: ['liner strut'], dims: { height: 2.2 }, mass: 900, mount: 'gear-well',
    build: { family: 'skid', strut: 2.2, oleo: 0.22, pad: [1.6] },
  },

  'hull-trainer': {
    kind: 'craft-fuselage', realm: 'space', label: 'tandem trainer hull', classOf: 'two-seat flight trainer register',
    aliases: ['trainer hull'], dims: { length: 7.0, width: 1.3, height: 1.4 }, mass: 1400, mount: null,
    build: {
      family: 'facet', facets: BOX_BEVEL, nose: 0.06,
      greebles: { top: 4, sides: 4, span: [0.5, 0.95] },
      stations: [[0, 0.05, 0.05, 0.5], [0.15, 0.6, 0.6, 0.5], [0.35, 1, 1, 0.5, 2.2], [0.75, 0.9, 0.85, 0.5, 2.4], [1, 0.55, 0.5, 0.5, 2.4]],
      points: { canopy: [0.18, 0, 0.85], wingRoot: [0.45, 0.85, -0.4], finRoot: [0.75, 0, 0.85], engine: [1, 0, 0], noseGear: [0.2, 0, -0.9], mainGear: [0.55, 0.85, -0.9] },
    },
  },
  'canopy-tandem': {
    kind: 'craft-canopy', realm: 'space', label: 'tandem canopy', classOf: 'two-seat flight trainer register',
    aliases: ['tandem canopy', 'two seat canopy'], dims: { length: 2.8, width: 0.75, height: 0.55 }, mass: 60, mount: 'sill',
    build: { family: 'bubble', facets: true, bows: [0.45, 0.8] },
  },
  'wing-trainer': {
    kind: 'craft-wing', realm: 'space', label: 'straight trainer wing', classOf: 'two-seat flight trainer register',
    aliases: ['trainer wing'], dims: { span: 2.9 }, mass: 200, mount: 'wing-root',
    build: { section: 'facet', rootChord: 2.0, tipChord: 1.2, sweep: 12, dihedral: 4, thickness: 0.07 },
  },
  'fin-trainer': {
    kind: 'craft-fin', realm: 'space', label: 'trainer fin', classOf: 'two-seat flight trainer register',
    aliases: ['trainer fin'], dims: { span: 1.2 }, mass: 30, mount: 'tail-root',
    build: { vertical: true, section: 'facet', rootChord: 1.6, tipChord: 0.7, sweep: 40, thickness: 0.07 },
  },

  'hull-facet-raider': {
    kind: 'craft-fuselage', realm: 'space', label: 'faceted raider hull', classOf: 'faceted raider register',
    aliases: ['raider hull', 'faceted hull'], dims: { length: 15.0, width: 4.2, height: 1.8 }, mass: 9000, mount: null,
    build: {
      family: 'facet', facets: STEALTH,
      stations: [[0, 0.03, 0.03, 0.45], [0.2, 0.4, 0.55, 0.48], [0.45, 0.8, 1, 0.5], [0.8, 1, 0.75, 0.48], [1, 0.85, 0.4, 0.45]],
      points: { canopy: [0.22, 0, 0.78], wingRoot: [0.35, 0.9, -0.4], finRoot: [0.8, 0.5, 0.6], vents: [1, 0, -0.1], noseGear: [0.25, 0, -1], mainGear: [0.62, 0.6, -1] },
    },
  },
  'wing-facet-raider': {
    kind: 'craft-wing', realm: 'space', label: 'faceted diamond wing', classOf: 'faceted raider register',
    aliases: ['diamond wing', 'faceted diamond wing'], dims: { span: 5.0 }, mass: 1600, mount: 'wing-root',
    // a diamond planform: the leading edge swept back 40°, the trailing edge swept forward as far
    build: { section: 'facet', planform: [[0, 7.6], [1, 1.2]], sweep: 40, thickness: 0.06 },
  },
  'fin-facet-vtail': {
    kind: 'craft-fin', realm: 'space', label: 'faceted V-tail', classOf: 'faceted raider register',
    aliases: ['faceted v tail'], dims: { span: 2.2 }, mass: 120, mount: 'tail-root',
    build: { vertical: true, section: 'facet', rootChord: 3.0, tipChord: 1.2, sweep: 58, cant: 55, thickness: 0.06 },
  },
  'drive-vent-wide': {
    kind: 'craft-engine', realm: 'space', label: 'wide twin drive vent', classOf: 'faceted raider register',
    aliases: ['wide drive vent'], dims: { length: 0.4, diameter: 0.5 }, mass: 1400, perf: { thrust: 300 }, mount: 'hull-store',
    build: { family: 'ionVent', gap: 1.6 },
  },
  'canopy-facet-slit': {
    kind: 'craft-canopy', realm: 'space', label: 'faceted slit canopy', classOf: 'faceted raider register',
    aliases: ['slit canopy'], dims: { length: 2.2, width: 0.8, height: 0.45 }, mass: 80, mount: 'sill',
    build: { family: 'bubble', facets: true, stations: [[0, 0.3, 0.2], [0.35, 1, 0.9], [0.75, 0.95, 1], [1, 0.55, 0.45]] },
  },
  // ===== space: the twin-panel family (ball pods and flat panels) ==============================
  'panel-dagger': {
    kind: 'craft-wing', realm: 'space', label: 'dagger panel wing', classOf: 'dagger-panel interceptor register',
    aliases: ['dagger panel', 'dagger wing'], dims: { span: 0.22, height: 7.0, chord: 5.4 }, mass: 650, mount: 'wing-root',
    // two blades reach forward past a notched leading edge, bent a little inboard; a gun at each blade tip
    build: { family: 'panel', outline: 'dagger', bend: 12, points: { tipTop: [0.95, 0.95], tipLow: [0.95, -0.95] } },
  },
  'panel-bomber-bent': {
    kind: 'craft-wing', realm: 'space', label: 'creased panel wing', classOf: 'twin-pod bomber register',
    aliases: ['creased panel', 'bent hex panel'], dims: { span: 0.24, height: 6.6, chord: 5.4 }, mass: 850, mount: 'wing-root',
    build: { family: 'panel', outline: 'hex', bend: 28 },
  },
  'hull-bomber-cockpit': {
    kind: 'craft-fuselage', realm: 'space', label: 'bomber cockpit pod', classOf: 'twin-pod bomber register',
    aliases: ['bomber cockpit pod'], dims: { length: 7.8, width: 2.4, height: 2.4 }, mass: 3000, mount: null,
    build: {
      family: 'tube', n: 2,
      stations: [[0, 0.35, 0.35, 0.5], [0.06, 0.82, 0.82, 0.5], [0.16, 1, 1, 0.5], [0.85, 0.95, 0.95, 0.5], [1, 0.7, 0.7, 0.5]],
      points: { window: [0.02, 0, 0], yoke: [0.42, 0.9, 0], wingOut: [0.42, -0.92, 0], vents: [1, 0, 0], chin: [0.12, 0.25, -0.85] },
    },
  },
  'hull-bomber-ordnance': {
    kind: 'craft-fuselage', realm: 'space', label: 'ordnance pod', classOf: 'twin-pod bomber register',
    aliases: ['ordnance pod', 'bomb pod'], dims: { length: 7.2, width: 2.2, height: 2.2 }, mass: 3500, mount: null,
    build: {
      family: 'tube', n: 2.2,
      stations: [[0, 0.55, 0.55, 0.5], [0.08, 0.92, 0.92, 0.5], [0.2, 1, 1, 0.5], [0.85, 0.95, 0.95, 0.5], [1, 0.72, 0.72, 0.5]],
      points: { wingOut: [0.45, 0.92, 0], vents: [1, 0, 0], bay: [0.1, 0, -0.6] },
    },
  },
  'yoke-bomber': {
    kind: 'craft-pylon', realm: 'space', label: 'pod yoke', classOf: 'twin-pod bomber register',
    aliases: ['pod yoke', 'twin pod yoke'], dims: { length: 1.7, chord: 1.4 }, mass: 300, mount: 'hull-store',
    build: { family: 'crossbar', thickness: 0.35 },
  },
  'hull-defender': {
    kind: 'craft-fuselage', realm: 'space', label: 'ball pod with drive section', classOf: 'tri-wing defender register',
    aliases: ['defender hull', 'ball pod with tail'], dims: { length: 8.4, width: 2.8, height: 2.8 }, mass: 4200, mount: null,
    build: {
      family: 'tube', n: 2,
      stations: [[0, 0.3, 0.3, 0.5], [0.08, 0.82, 0.82, 0.5], [0.2, 1, 1, 0.5], [0.34, 0.92, 0.92, 0.5], [0.45, 0.55, 0.55, 0.5, 2.6], [1, 0.62, 0.62, 0.5, 2.6]],
      points: { window: [0.03, 0, 0], arm: [0.62, 0, 0], vents: [1, 0, 0], chin: [0.14, 0.3, -0.85] },
    },
  },
  'arm-defender': {
    kind: 'craft-pylon', realm: 'space', label: 'wing arm, defender', classOf: 'tri-wing defender register',
    aliases: ['defender arm'], dims: { length: 1.9, diameter: 0.45 }, mass: 140, mount: 'hull-store',
    build: { family: 'arm' },
  },
  'wing-defender': {
    kind: 'craft-wing', realm: 'space', label: 'flared flat wing, defender', classOf: 'tri-wing defender register',
    aliases: ['defender wing', 'flared wing'], dims: { span: 3.2 }, mass: 420, mount: 'wing-root',
    // a flat plate flaring forward and aft toward its tip, three of them at 120° about the hull
    build: { section: 'facet', planform: [[0, 2.2, 0], [0.55, 4.8, -1.3], [1, 3.6, -0.6]], thickness: 0.07, points: { gun: [1, 0.05] } },
  },
};
