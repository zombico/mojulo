/**
 * heli-odm — the craft shelf's helicopter parts, rows as every shelf part is (craft-odm.js's head says what a row
 * holds), merged into CRAFT_ODM. A helicopter is assembled as a craft is: its cabin and boom at the origin, its roof's
 * cowling on the cabin, its main rotor on the cowling's mast, its tail rotor on the boom's end, its stabilizer and fins
 * on the boom, its skids under the cabin. A new helicopter part is a row first.
 *
 * Kinds (HELI_KINDS):
 *   heli-rotor   a main rotor from its mount up: the mast, the swashplate's two rings, a pitch link from the upper ring to
 *                each blade's horn, the scissors, the hub and its cap, each blade's grip and bearing, the blades (long,
 *                cambered, twisted, drooping at rest toward their tips, their tips swept and banded). Its `hand` ('ccw' |
 *                'cw' seen from above; a mirrored copy turns the other way). Spun by `pose.rotor`; its blades fold aft
 *                by the craft's `fold`. Points: `hub`
 *   heli-tail    a tail rotor ('rotor': its gearbox out from the fin, its hub, its blades turning about the craft's x,
 *                its pitch-change spider) or a ducted fan ('fan': the shroud's walls and lips, the fan's blades, the
 *                stators behind it, the fin's root on top)
 *   heli-cowl    the roof's engine cowling ('single' | 'twin' exhausts): the cowling, its intakes' grilles each side,
 *                its exhausts, the transmission's fairing round the mast; or a tandem's rotor pylon ('pylon': a fairing
 *                rising from the roof to its mast, its engines' pods each side when it carries them). Points: `mast`
 *   heli-kit     what hangs on a helicopter: a rocket pod ('rockets'), a missile rack ('rack'), a chin gun ('chin'), each
 *                mounted on its top. Modelled, never fired
 *
 * A rotor's figures are its class's (a light single's 10.7 m main rotor); a row is a class, never a type.
 */

export const HELI_KINDS = Object.freeze({
  'heli-rotor': 'a helicopter\'s main rotor: its mast, swashplate, pitch links, hub and blades',
  'heli-tail': 'a helicopter\'s tail rotor or ducted fan',
  'heli-cowl': 'a helicopter\'s roof cowling: its engines\' intakes and exhausts, the transmission\'s fairing',
  'heli-kit': 'a helicopter\'s kit on its pylons or its nose: a rocket pod, a missile rack, a chin gun (modelled, never fired)',
});

// a light helicopter's cabin running into its boom: a low tub forward under its bubble, the cabin full height behind
// it, the boom tapering aft from its top
const LIGHT_POD = [[0, 0.4, 0.26, 0.26], [0.05, 0.82, 0.38, 0.27], [0.16, 0.98, 0.42, 0.28], [0.27, 1, 0.44, 0.29], [0.31, 0.97, 0.96, 0.52], [0.42, 0.62, 0.6, 0.64], [0.5, 0.2, 0.22, 0.72], [1, 0.12, 0.13, 0.74]];

// a medium twin's cabin: a glazed cockpit's tub forward, the cabin's slab-sided box, the boom rising aft from its top
const UTILITY_BODY = [[0, 0.34, 0.3, 0.36], [0.04, 0.7, 0.52, 0.38], [0.1, 0.88, 0.7, 0.42], [0.17, 0.95, 0.88, 0.47], [0.22, 1, 1, 0.5], [0.48, 1, 1, 0.5], [0.56, 0.62, 0.64, 0.62], [0.66, 0.27, 0.3, 0.7], [0.9, 0.18, 0.22, 0.72], [1, 0.15, 0.2, 0.73]];
// an attack helicopter's armoured hull: flat slabs chamfered at their corners, narrow under its tandem seats, wide at its
// engines, its boom tapering aft
const ARMOUR = [[1, -0.62], [1, 0.42], [0.66, 1], [-0.66, 1], [-1, 0.42], [-1, -0.62], [-0.62, -1], [0.62, -1]];
const ATTACK_BODY = [[0, 0.34, 0.34, 0.42], [0.035, 0.56, 0.52, 0.42], [0.1, 0.66, 0.6, 0.42], [0.2, 0.7, 0.66, 0.45], [0.28, 0.92, 1, 0.5], [0.5, 1, 1, 0.5], [0.58, 0.5, 0.56, 0.58], [0.72, 0.3, 0.36, 0.62], [1, 0.22, 0.28, 0.64]];
// a tandem-rotor transport's long box: its flight deck's tub forward, the hold straight, its tail rising over its ramp
const TANDEM_BODY = [[0, 0.14, 0.14, 0.42], [0.015, 0.52, 0.44, 0.44], [0.04, 0.78, 0.66, 0.47], [0.08, 0.93, 0.87, 0.49], [0.12, 1, 1, 0.5], [0.8, 1, 1, 0.5], [0.9, 0.98, 0.78, 0.61], [1, 0.95, 0.5, 0.75]];

export const HELI_ODM = {
  // ===== a light single-engine helicopter =====================================================
  'fus-heli-light': {
    kind: 'craft-fuselage', realm: 'earth', label: 'light helicopter cabin and boom', classOf: 'light single-engine helicopter class (1.4 t)',
    aliases: ['helicopter cabin', 'light helicopter fuselage'], dims: { length: 9.3, width: 1.75, height: 1.85 }, mass: 420, mount: null,
    build: {
      family: 'tube', n: 2.6, belly: 0.85, seams: 1.2, stations: LIGHT_POD,
      // (the cockpit's tub open under its bubble, its walls up to the sill; the cabin closed from its bulkhead aft)
      open: { from: 0.05, to: 0.29, sill: 0.9, wall: 0.035 },
      // (its rear doors framed in the cabin's sides; the front glazed under its bubble)
      doors: [[0.36, 0.05, 0.62, 0.9]],
      points: { canopy: [0.012, 0, 0.92], cockpit: [0.07, 0, -0.62], cowl: [0.37, 0, 0.98], tailRotor: [0.985, 0, 0.6], stabRoot: [0.86, 0, 0], finRoot: [0.9, 0, 0.9], ventral: [0.94, 0, -0.9], skid: [0.2, 0.62, -0.92] },
    },
  },
  'canopy-heli-bubble': {
    kind: 'craft-canopy', realm: 'earth', label: 'light helicopter bubble', classOf: 'light single-engine helicopter class (1.4 t)',
    aliases: ['helicopter bubble', 'cockpit bubble'], dims: { length: 2.75, width: 1.72, height: 1.06 }, mass: 40, mount: 'sill',
    build: { family: 'bubble', opens: false, stations: [[0, 0.42, 0.2], [0.14, 0.86, 0.68], [0.42, 1, 0.98], [0.85, 0.99, 1], [1, 0.96, 0.95]] },
  },
  'cockpit-heli-light': {
    kind: 'craft-cockpit', realm: 'earth', label: 'light helicopter cockpit', classOf: 'light single-engine helicopter class (1.4 t)',
    aliases: ['helicopter cockpit', 'helicopter cabin interior'], dims: { length: 2.75, width: 1.45, height: 1.15 }, mass: 60, mount: 'cabin-floor',
    build: { layout: 'side', seats: 2, panel: 'glass', controls: 'heli', bench: 3 },
  },
  'cowl-heli-light': {
    kind: 'heli-cowl', realm: 'earth', label: 'light helicopter roof cowling', classOf: 'light single-engine helicopter class (1.4 t)',
    aliases: ['engine cowling', 'roof cowling'], dims: { length: 2.3, width: 0.95, height: 0.5 }, mass: 60, mount: 'roof',
    build: { family: 'single', mastAt: 0.32, intakeAt: 0.42, exhaustAt: 0.9 },
  },
  'rotor-heli-light': {
    kind: 'heli-rotor', realm: 'earth', label: 'light helicopter main rotor', classOf: 'three-blade 10.7 m main rotor',
    aliases: ['main rotor', 'helicopter rotor'], dims: { diameter: 10.7, mast: 0.7 }, mass: 110, mount: 'mast',
    build: { family: 'articulated', blades: 3, hand: 'ccw', chord: 0.3, root: 0.1, rootPitch: 10, tipPitch: 2, droop: 1.6, tipSweep: 0.18, thickness: 0.12, camber: 0.02, hub: 0.24 },
  },
  'tail-rotor-light': {
    kind: 'heli-tail', realm: 'earth', label: 'light helicopter tail rotor', classOf: 'two-blade 1.7 m tail rotor',
    aliases: ['tail rotor', 'anti-torque rotor'], dims: { diameter: 1.7, offset: 0.28 }, mass: 12, mount: 'tail-gearbox',
    build: { family: 'rotor', blades: 2, chord: 0.14, pitch: 12, hub: 0.07 },
  },
  'fan-heli-ducted': {
    kind: 'heli-tail', realm: 'earth', label: 'ducted tail fan', classOf: 'ten-blade ducted tail fan (0.75 m)',
    aliases: ['ducted fan', 'fan tail', 'shrouded tail rotor'], dims: { diameter: 0.75, depth: 0.34 }, mass: 18, mount: 'tail-gearbox',
    build: { family: 'fan', blades: 10, stators: 9, hub: 0.12 },
  },
  'stab-heli-light': {
    kind: 'craft-stabilizer', realm: 'earth', label: 'light helicopter stabilizer', classOf: 'light single-engine helicopter class (1.4 t)',
    aliases: ['helicopter stabilizer'], dims: { span: 0.95 }, mass: 6, mount: 'tail-root',
    build: { rootChord: 0.42, tipChord: 0.38, sweep: 0, dihedral: 0, thickness: 0.12, camber: -0.02, winglet: { height: 0.32, root: 0.95, tip: 0.7, sweep: 25, cant: 0 } },
  },
  'fin-heli-light': {
    kind: 'craft-fin', realm: 'earth', label: 'light helicopter fin', classOf: 'light single-engine helicopter class (1.4 t)',
    aliases: ['helicopter fin', 'helicopter tail fin'], dims: { span: 1.05 }, mass: 5, mount: 'tail-root',
    build: { vertical: true, rootChord: 0.9, tipChord: 0.45, sweep: 38, thickness: 0.12, camber: 0.04 },
  },
  'fin-heli-ventral': {
    kind: 'craft-fin', realm: 'earth', label: 'helicopter ventral fin and tail skid', classOf: 'light single-engine helicopter class (1.4 t)',
    aliases: ['helicopter ventral fin', 'tail skid'], dims: { span: 0.42 }, mass: 2, mount: 'tail-root',
    build: { vertical: true, rootChord: 0.55, tipChord: 0.3, sweep: 30, thickness: 0.12 },
  },
  'skid-heli-light': {
    kind: 'drone-gear', realm: 'earth', label: 'light helicopter skid', classOf: 'light single-engine helicopter class (1.4 t)',
    aliases: ['helicopter skid', 'landing skids'], dims: { height: 0.62, length: 2.6, diameter: 0.075 }, mass: 25, mount: 'gear-socket',
    build: { family: 'skid', splay: 0.38 },
  },

  // ===== a medium twin utility helicopter ======================================================
  'fus-heli-utility': {
    kind: 'craft-fuselage', realm: 'earth', label: 'utility helicopter cabin and boom', classOf: 'medium twin utility helicopter class (10 t)',
    aliases: ['utility helicopter cabin', 'utility helicopter fuselage'], dims: { length: 15.3, width: 2.36, height: 2.1 }, mass: 2600, mount: null,
    build: {
      family: 'tube', n: 2.9, belly: 0.9, seams: 1.4, stations: UTILITY_BODY,
      open: { from: 0.03, to: 0.2, sill: 0.25, wall: 0.04 },
      // (its sliding doors framed in the cabin's sides, its windows behind them)
      doors: [[0.31, -0.05, 1.5, 1.35]],
      windows: { from: 0.42, to: 0.47, pitch: 0.6, zf: 0.3, w: 0.42, h: 0.42 },
      points: { canopy: [0.03, 0, 0.25], cockpit: [0.07, 0, -0.6], cowl: [0.26, 0, 1], finRoot: [0.9, 0, 0.7], stabRoot: [0.95, 0.85, -0.3], mainGear: [0.2, 0.95, -0.55], tailGear: [0.86, 0, -1] },
    },
  },
  'canopy-heli-utility': {
    kind: 'craft-canopy', realm: 'earth', label: 'utility helicopter cockpit glazing', classOf: 'medium twin utility helicopter class (10 t)',
    aliases: ['utility helicopter windscreen', 'helicopter windscreen'], dims: { length: 2.9, width: 2.3, height: 1.2 }, mass: 90, mount: 'sill',
    build: { family: 'bubble', facets: true, opens: false, bows: [0.35, 0.7], stations: [[0, 0.5, 0.25], [0.12, 0.85, 0.7], [0.4, 0.97, 0.95], [1, 1, 1]] },
  },
  'cockpit-heli-utility': {
    kind: 'craft-cockpit', realm: 'earth', label: 'utility helicopter cockpit', classOf: 'medium twin utility helicopter class (10 t)',
    aliases: ['utility helicopter cockpit'], dims: { length: 1.9, width: 1.7, height: 1.3 }, mass: 120, mount: 'cabin-floor',
    build: { layout: 'side', seats: 2, panel: 'glass', controls: 'heli' },
  },
  'cowl-heli-twin': {
    kind: 'heli-cowl', realm: 'earth', label: 'twin-engine roof cowling', classOf: 'medium twin utility helicopter class (10 t)',
    aliases: ['twin engine cowling'], dims: { length: 4.4, width: 1.5, height: 0.72 }, mass: 160, mount: 'roof',
    build: { family: 'twin', mastAt: 0.32, intakeAt: 0.3, exhaustAt: 0.9 },
  },
  'rotor-heli-medium': {
    kind: 'heli-rotor', realm: 'earth', label: 'medium helicopter main rotor', classOf: 'four-blade 16.4 m main rotor',
    aliases: ['four blade rotor', 'medium main rotor'], dims: { diameter: 16.4, mast: 0.95 }, mass: 700, mount: 'mast',
    build: { family: 'articulated', blades: 4, hand: 'ccw', chord: 0.53, root: 0.1, rootPitch: 10, tipPitch: 2, droop: 1.3, tipSweep: 0.35, thickness: 0.1, camber: 0.02, hub: 0.38 },
  },
  'tail-rotor-medium': {
    kind: 'heli-tail', realm: 'earth', label: 'medium helicopter tail rotor', classOf: 'four-blade 3.2 m tail rotor',
    aliases: ['four blade tail rotor'], dims: { diameter: 3.2, offset: 0.45 }, mass: 60, mount: 'tail-gearbox',
    build: { family: 'rotor', blades: 4, chord: 0.25, pitch: 12, hub: 0.13 },
  },
  'fin-heli-utility': {
    kind: 'craft-fin', realm: 'earth', label: 'utility helicopter tail pylon', classOf: 'medium twin utility helicopter class (10 t)',
    aliases: ['tail pylon', 'helicopter tail pylon'], dims: { span: 2.1 }, mass: 60, mount: 'tail-root',
    build: { vertical: true, rootChord: 1.5, tipChord: 0.9, sweep: 35, thickness: 0.16, camber: 0.03, points: { rotor: [0.75, 0.45] } },
  },
  'stab-heli-utility': {
    kind: 'craft-stabilizer', realm: 'earth', label: 'utility helicopter stabilator', classOf: 'medium twin utility helicopter class (10 t)',
    aliases: ['helicopter stabilator', 'utility helicopter stabilator'], dims: { span: 1.9 }, mass: 25, mount: 'tail-root',
    build: { rootChord: 0.75, tipChord: 0.6, sweep: 4, dihedral: 0, thickness: 0.12, camber: -0.02 },
  },
  'gear-heli-utility-main': {
    kind: 'craft-gear', realm: 'earth', label: 'utility helicopter main wheel', classOf: 'medium twin utility helicopter class (10 t)',
    aliases: ['helicopter main wheel'], dims: { height: 0.78 }, mass: 70, mount: 'gear-socket',
    build: { retract: false, family: 'leg', strut: 0.45, oleo: 0.07, tyre: [0.66, 0.22] },
  },
  'gear-heli-utility-tail': {
    kind: 'craft-gear', realm: 'earth', label: 'utility helicopter tail wheel', classOf: 'medium twin utility helicopter class (10 t)',
    aliases: ['helicopter tail wheel'], dims: { height: 1.53 }, mass: 25, mount: 'gear-socket',
    build: { retract: false, family: 'leg', strut: 1.32, oleo: 0.05, rake: -0.1, tyre: [0.42, 0.14] },
  },

  // ===== an armoured tandem attack helicopter ==================================================
  'fus-heli-attack': {
    kind: 'craft-fuselage', realm: 'earth', label: 'attack helicopter armoured hull', classOf: 'tandem attack helicopter class (8 t)',
    aliases: ['attack helicopter hull', 'armoured helicopter hull'], dims: { length: 14.6, width: 1.5, height: 1.95 }, mass: 2400, mount: null,
    build: {
      family: 'facet', facets: ARMOUR, seams: 1.4, stations: ATTACK_BODY,
      open: { from: 0.02, to: 0.28, sill: 0.45, wall: 0.03 },
      points: { canopy: [0.02, 0, 0.45], cockpit: [0.045, 0, -0.55], sensor: [0.004, 0, -0.2], gun: [0.07, 0, -1], cowl: [0.3, 0, 1], stubRoot: [0.33, 0.95, -0.3], finRoot: [0.9, 0, 0.8], stabRoot: [0.95, 0.9, 0], mainGear: [0.17, 0.9, -0.9], tailGear: [0.92, 0, -1] },
    },
  },
  'canopy-heli-tandem': {
    kind: 'craft-canopy', realm: 'earth', label: 'tandem flat-paned canopy', classOf: 'tandem attack helicopter class (8 t)',
    aliases: ['helicopter tandem canopy', 'flat plate canopy'], dims: { length: 3.9, width: 1.0, height: 1.2 }, mass: 80, mount: 'sill',
    build: { family: 'bubble', facets: true, opens: false, bows: [0.47], stations: [[0, 0.5, 0.26], [0.12, 0.88, 0.58], [0.4, 1, 0.7], [0.5, 1, 0.92], [0.85, 1, 1], [1, 0.96, 0.92]] },
  },
  'cockpit-heli-tandem': {
    kind: 'craft-cockpit', realm: 'earth', label: 'tandem attack helicopter cockpit', classOf: 'tandem attack helicopter class (8 t)',
    aliases: ['tandem cockpit', 'gunner and pilot cockpit'], dims: { length: 3.2, width: 0.9, height: 1.2 }, mass: 110, mount: 'cabin-floor',
    build: { layout: 'tandem', seats: 2, panel: 'glass', controls: 'heli', rake: 0.35 },
  },
  'cowl-heli-attack': {
    kind: 'heli-cowl', realm: 'earth', label: 'attack helicopter engine cowling', classOf: 'tandem attack helicopter class (8 t)',
    aliases: ['attack helicopter cowling'], dims: { length: 4.6, width: 1.7, height: 0.7 }, mass: 180, mount: 'roof',
    build: { family: 'twin', mastAt: 0.3, intakeAt: 0.3, exhaustAt: 0.9 },
  },
  'rotor-heli-attack': {
    kind: 'heli-rotor', realm: 'earth', label: 'attack helicopter main rotor', classOf: 'four-blade 14.6 m main rotor',
    aliases: ['attack helicopter rotor'], dims: { diameter: 14.6, mast: 1.0 }, mass: 650, mount: 'mast',
    build: { family: 'articulated', blades: 4, hand: 'ccw', chord: 0.53, root: 0.1, rootPitch: 9, tipPitch: 1, droop: 1.3, tipSweep: 0.3, thickness: 0.1, camber: 0.02, hub: 0.36 },
  },
  'tail-rotor-attack': {
    kind: 'heli-tail', realm: 'earth', label: 'attack helicopter tail rotor', classOf: 'four-blade 2.8 m tail rotor',
    aliases: ['attack helicopter tail rotor'], dims: { diameter: 2.8, offset: 0.4 }, mass: 50, mount: 'tail-gearbox',
    build: { family: 'rotor', blades: 4, chord: 0.25, pitch: 12, hub: 0.12 },
  },
  'fin-heli-attack': {
    kind: 'craft-fin', realm: 'earth', label: 'attack helicopter tail pylon', classOf: 'tandem attack helicopter class (8 t)',
    aliases: ['attack helicopter tail pylon'], dims: { span: 1.9 }, mass: 50, mount: 'tail-root',
    build: { vertical: true, rootChord: 1.4, tipChord: 0.8, sweep: 40, thickness: 0.15, camber: 0.03, points: { rotor: [0.8, 0.5] } },
  },
  'stab-heli-attack': {
    kind: 'craft-stabilizer', realm: 'earth', label: 'attack helicopter stabilator', classOf: 'tandem attack helicopter class (8 t)',
    aliases: ['attack helicopter stabilator'], dims: { span: 1.6 }, mass: 20, mount: 'tail-root',
    build: { rootChord: 0.7, tipChord: 0.55, sweep: 4, dihedral: 0, thickness: 0.12, camber: -0.02 },
  },
  'wing-heli-stub': {
    kind: 'craft-wing', realm: 'earth', label: 'helicopter stub wing', classOf: 'tandem attack helicopter class (8 t)',
    aliases: ['helicopter stub wing', 'weapons wing'], dims: { span: 1.7 }, mass: 90, mount: 'wing-root',
    build: { rootChord: 1.05, tipChord: 0.85, sweep: 0, dihedral: -6, thickness: 0.16, camber: 0.02, points: { inboard: [0.42, 0.42, 'lower'], outboard: [0.86, 0.42, 'lower'] } },
  },
  'pylon-heli-stub': {
    kind: 'craft-pylon', realm: 'earth', label: 'stub wing store pylon', classOf: 'tandem attack helicopter class (8 t)',
    aliases: ['helicopter store pylon', 'stub wing pylon'], dims: { length: 0.7, height: 0.26 }, mass: 15, mount: 'wing-station',
    build: { family: 'underwing', forward: 0.05, thickness: 0.14 },
  },
  'rockets-heli-19': {
    kind: 'heli-kit', realm: 'earth', label: 'nineteen-tube rocket pod', classOf: '70 mm rocket pod class',
    aliases: ['rocket pod', 'rocket launcher pod'], dims: { length: 1.7, diameter: 0.4 }, mass: 280, mount: 'store',
    build: { family: 'rockets', tubes: 19 },
  },
  'rack-heli-missiles': {
    kind: 'heli-kit', realm: 'earth', label: 'four-round missile rack', classOf: 'anti-armour missile rack class',
    aliases: ['helicopter missile rack', 'anti tank missiles'], dims: { length: 1.65, diameter: 0.18 }, mass: 230, mount: 'store',
    build: { family: 'rack', rows: 2 },
  },
  'gun-heli-chin': {
    kind: 'heli-kit', realm: 'earth', label: 'chin gun turret', classOf: '30 mm chain gun turret class',
    aliases: ['helicopter chin gun', 'chin turret', 'chain gun'], dims: { length: 1.7, diameter: 0.5 }, mass: 150, mount: 'chin',
    build: { family: 'chin' },
  },
  'eoir-heli-nose': {
    kind: 'drone-payload', realm: 'earth', label: 'helicopter nose sensor turret', classOf: 'attack helicopter targeting turret',
    aliases: ['nose sensor', 'targeting turret', 'nose turret'], dims: { diameter: 0.64, height: 0.74 }, mass: 230, mount: 'nose',
    build: { family: 'eoir', windows: 4 },
  },
  'gear-heli-attack-main': {
    kind: 'craft-gear', realm: 'earth', label: 'attack helicopter main wheel', classOf: 'tandem attack helicopter class (8 t)',
    aliases: ['attack helicopter main wheel'], dims: { height: 0.9 }, mass: 60, mount: 'gear-socket',
    build: { retract: false, family: 'leg', strut: 0.6, oleo: 0.07, tyre: [0.6, 0.2] },
  },
  'gear-heli-attack-tail': {
    kind: 'craft-gear', realm: 'earth', label: 'attack helicopter tail wheel', classOf: 'tandem attack helicopter class (8 t)',
    aliases: ['attack helicopter tail wheel'], dims: { height: 1.46 }, mass: 20, mount: 'gear-socket',
    build: { retract: false, family: 'leg', strut: 1.28, oleo: 0.05, rake: -0.1, tyre: [0.38, 0.13] },
  },

  // ===== a heavy tandem-rotor transport ========================================================
  'fus-heli-tandem': {
    kind: 'craft-fuselage', realm: 'earth', label: 'tandem-rotor transport hull', classOf: 'heavy tandem-rotor transport class (22 t)',
    aliases: ['tandem rotor hull', 'heavy lift helicopter hull'], dims: { length: 15.6, width: 2.7, height: 3.0 }, mass: 5200, mount: null,
    build: {
      family: 'tube', n: 3.4, seams: 1.6, stations: TANDEM_BODY,
      open: { from: 0.012, to: 0.15, sill: 0.15, wall: 0.04 },
      ramp: { from: 0.8, to: 0.985, w: 0.8 },
      doors: [[0.18, -0.2, 0.9, 1.7]],
      windows: { from: 0.26, to: 0.7, pitch: 1.3, zf: 0.25, w: 0.42, h: 0.42 },
      points: { canopy: [0.012, 0, 0.15], cockpit: [0.035, 0, -0.62], frontPylon: [0.1, 0, 1], rearPylon: [0.87, 0, 1], sponson: [0.2, 0.92, -0.75] },
    },
  },
  'canopy-heli-deck': {
    kind: 'craft-canopy', realm: 'earth', label: 'transport helicopter flight deck glazing', classOf: 'heavy tandem-rotor transport class (22 t)',
    aliases: ['flight deck glazing', 'transport helicopter windscreen'], dims: { length: 2.3, width: 2.6, height: 1.32 }, mass: 110, mount: 'sill',
    build: { family: 'bubble', facets: true, opens: false, bows: [0.4], stations: [[0, 0.42, 0.34], [0.12, 0.74, 0.66], [0.4, 0.93, 0.93], [1, 1, 1]] },
  },
  'cockpit-heli-deck': {
    kind: 'craft-cockpit', realm: 'earth', label: 'transport helicopter flight deck', classOf: 'heavy tandem-rotor transport class (22 t)',
    aliases: ['helicopter flight deck'], dims: { length: 1.75, width: 2.2, height: 1.5 }, mass: 150, mount: 'cabin-floor',
    build: { layout: 'side', seats: 2, panel: 'glass', controls: 'heli' },
  },
  'sponson-heli-tandem': {
    kind: 'craft-fuselage', realm: 'earth', label: 'transport helicopter fuel sponson', classOf: 'heavy tandem-rotor transport class (22 t)',
    aliases: ['fuel sponson', 'helicopter sponson'], dims: { length: 9.2, width: 0.75, height: 1.2 }, mass: 300, mount: 'hull-side',
    build: { family: 'tube', n: 2.6, seams: false, stations: [[0, 0.3, 0.6, 0.5], [0.08, 0.9, 0.95, 0.5], [0.2, 1, 1, 0.5], [0.85, 1, 1, 0.5], [1, 0.5, 0.7, 0.5]], points: { front: [0.1, 0, -1], rear: [0.9, 0, -1] } },
  },
  'pylon-heli-tandem-front': {
    kind: 'heli-cowl', realm: 'earth', label: 'tandem forward rotor pylon', classOf: 'heavy tandem-rotor transport class (22 t)',
    aliases: ['forward rotor pylon'], dims: { length: 3.2, width: 1.6, height: 0.55 }, mass: 300, mount: 'roof',
    build: { family: 'pylon', mastAt: 0.5 },
  },
  'pylon-heli-tandem-aft': {
    kind: 'heli-cowl', realm: 'earth', label: 'tandem aft rotor pylon and engines', classOf: 'heavy tandem-rotor transport class (22 t)',
    aliases: ['aft rotor pylon'], dims: { length: 3.6, width: 1.8, height: 1.2 }, mass: 900, mount: 'roof',
    build: { family: 'pylon', mastAt: 0.45, pods: { diameter: 0.9, length: 2.6, at: 0.55 } },
  },
  'rotor-heli-tandem': {
    kind: 'heli-rotor', realm: 'earth', label: 'tandem helicopter rotor', classOf: 'three-blade 18.3 m tandem rotor',
    aliases: ['tandem rotor'], dims: { diameter: 18.3, mast: 0.75 }, mass: 1500, mount: 'mast',
    build: { family: 'articulated', blades: 3, hand: 'ccw', chord: 0.81, root: 0.1, rootPitch: 10, tipPitch: 2, droop: 1.2, tipSweep: 0.1, thickness: 0.1, camber: 0.02, hub: 0.5 },
  },
  'gear-heli-tandem-front': {
    kind: 'craft-gear', realm: 'earth', label: 'transport helicopter forward gear', classOf: 'heavy tandem-rotor transport class (22 t)',
    aliases: ['helicopter forward gear'], dims: { height: 1.03 }, mass: 120, mount: 'gear-socket',
    build: { retract: false, family: 'leg', strut: 0.6, oleo: 0.08, wheels: 2, tyre: [0.86, 0.25] },
  },
  'gear-heli-tandem-rear': {
    kind: 'craft-gear', realm: 'earth', label: 'transport helicopter aft gear', classOf: 'heavy tandem-rotor transport class (22 t)',
    aliases: ['helicopter aft gear'], dims: { height: 1.03 }, mass: 80, mount: 'gear-socket',
    build: { retract: false, family: 'leg', strut: 0.6, oleo: 0.08, tyre: [0.86, 0.25] },
  },
};
