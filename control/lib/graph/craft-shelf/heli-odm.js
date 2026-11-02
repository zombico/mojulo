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
 *                its exhausts, the transmission's fairing round the mast. Points: `mast`
 *
 * A rotor's figures are its class's (a light single's 10.7 m main rotor); a row is a class, never a type.
 */

export const HELI_KINDS = Object.freeze({
  'heli-rotor': 'a helicopter\'s main rotor: its mast, swashplate, pitch links, hub and blades',
  'heli-tail': 'a helicopter\'s tail rotor or ducted fan',
  'heli-cowl': 'a helicopter\'s roof cowling: its engines\' intakes and exhausts, the transmission\'s fairing',
});

// a light helicopter's cabin running into its boom: a low tub forward under its bubble, the cabin full height behind
// it, the boom tapering aft from its top
const LIGHT_POD = [[0, 0.4, 0.26, 0.26], [0.05, 0.82, 0.38, 0.27], [0.16, 0.98, 0.42, 0.28], [0.27, 1, 0.44, 0.29], [0.31, 0.97, 0.96, 0.52], [0.42, 0.62, 0.6, 0.64], [0.5, 0.2, 0.22, 0.72], [1, 0.12, 0.13, 0.74]];

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
};
