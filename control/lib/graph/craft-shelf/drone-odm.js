/**
 * drone-odm — the craft shelf's drone parts, rows as every shelf part is (craft-odm.js's head says what a row holds),
 * merged into CRAFT_ODM. A drone is assembled as a craft is: its frame at the origin, its arms on the frame's points
 * (turned about the vertical by the layout's `yaw`, mirrored in pairs), a motor on each arm's pad, a rotor on each motor's
 * shaft. A new drone part is a row first.
 *
 * Kinds (DRONE_KINDS):
 *   drone-frame    a multirotor's body: a moulded shell (or, later, a plate stack, a ruggedised box). Its points, in
 *                  metres in its own frame (+y the nose, +z up, the body's middle at the origin): where its arms, its
 *                  payload and its mast mount
 *   drone-arm      an arm from the frame to its motor's pad, along +x from its root: a beam (`rise` lifting its tip), a
 *                  folding hinge at the root (`fold: { angle }`, degrees about the vertical when folded), a LED under
 *                  the tip (`led: 'nav' | 'status' | false`), a foot under it (`foot`: its height; where the drone
 *                  stands). Points: `motor` (the pad's top), `contact` (the foot's sole)
 *   drone-motor    an outrunner: its base, its bell and its cooling slots, the prop adapter; or a starship drone's vent.
 *                  Points: `shaft` (the adapter's top)
 *   drone-rotor    the blades on the shaft: `blades`, the diameter, the root's and the tip's pitch, chord and sweep; its
 *                  `hand` ('ccw' | 'cw' seen from above), a mirrored copy turning the other way (a pair counter-rotates)
 *   drone-guard    a prop guard: a ring round the rotor's disc on spokes from the motor
 *   drone-payload  a gimbal camera ('gimbal3'), an EO/IR ball ('eoir', a military look's camera), a starship drone's
 *                  eye ('eye'); its mount on top
 *   drone-mast     a GPS mast and its puck ('gps'), a folding antenna paddle ('paddle')
 *   drone-gear     a skid: two struts down to a tube along the craft ('skid'), mounted in pairs under the frame
 *
 * Frame families: 'shell' (a moulded body, smooth), 'box' (a ruggedised body, flat-paneled), 'plate' (a racer's carbon
 * plate stack: plates on standoffs, the boards between, the battery strapped on top, the camera in its cage), 'hub' (a
 * heavy lifter's round centre: plates, the electronics between, a canopy over). Arm families: 'beam' (moulded), 'plate'
 * (a racer's flat carbon arm), 'tube' (carbon tube, a folding clamp at its root, folding down about its own horizontal
 * when `fold.axis` is 'y'; `coax` a second motor plate under its tip, `motorLow`, for an inverted motor). Rotors may
 * fold their blades (`folding`: a hub bar and the blades' pivots). Payloads: 'gimbal3', 'eye', 'box' (a cargo box, a
 * `winch` point under it), 'winch', 'sprayer' (a tank, its pump and hoses, a boom of nozzles across), 'lidar'.
 *
 * Earth rows are sized to a public class (a folding camera quad of about 0.9 kg); space rows to the starship register,
 * held to the same ruler. Names are generic: a class, never a product.
 */

export const DRONE_KINDS = Object.freeze({
  'drone-frame': 'a multirotor drone\'s body, the frame its arms, payload and mast mount on',
  'drone-arm': 'a drone\'s arm from its frame to its motor (folding, a LED and a foot under its tip)',
  'drone-motor': 'a drone\'s motor: an outrunner\'s bell over its base, or a starship drone\'s vent',
  'drone-rotor': 'a drone\'s rotor: its blades on the motor\'s shaft, handed by the way it turns',
  'drone-guard': 'a prop guard round a drone\'s rotor',
  'drone-payload': 'what a drone carries under it: a gimbal camera, a sensor eye',
  'drone-mast': 'a drone\'s GPS mast and puck, or an antenna paddle',
  'drone-gear': 'a drone\'s landing skid, its struts and tube',
});

// a folding camera quad's body: a moulded shell, flat-faced at the nose and tail where its sensors look out
const CAMERA_SHELL = [[0, 0.55, 0.6, 0], [0.12, 0.92, 0.92, 0], [0.5, 1, 1, 0], [0.85, 0.9, 0.9, 0.05], [1, 0.6, 0.55, 0.1]];
// a ruggedised body: a box with its nose and tail chamfered in
// a flying-wing body's section: wide and flat, its edges sharp, CCW from +x
const BLENDED = [[1, -0.1], [0.55, 0.45], [0.18, 1], [-0.18, 1], [-0.55, 0.45], [-1, -0.1], [-0.7, -0.75], [0.7, -0.75]];
const RUGGED_BOX = [[0, 0.72, 0.66, 0], [0.14, 1, 1, 0], [0.86, 1, 1, 0], [1, 0.78, 0.72, 0]];
// a rotor sold as a pair of part numbers, one per hand
const rotors = (stem, row) => ({
  [`${stem}-ccw`]: { ...row, label: `${row.label}, counter-clockwise`, aliases: row.aliases.map((a) => `${a} ccw`), build: { ...row.build, hand: 'ccw' } },
  [`${stem}-cw`]: { ...row, label: `${row.label}, clockwise`, aliases: row.aliases.map((a) => `${a} cw`), build: { ...row.build, hand: 'cw' } },
});

export const DRONE_ODM = {
  // ===== earth: a folding camera quad =========================================================
  'frame-shell-camera': {
    kind: 'drone-frame', realm: 'earth', label: 'folding camera quad body', classOf: 'folding camera quad class (0.9 kg)',
    aliases: ['camera drone body', 'quad shell'],
    dims: { length: 0.21, width: 0.095, height: 0.075 }, mass: 0.42, mount: 'airframe',
    build: {
      family: 'shell', n: 3.2, belly: 0.9, stations: CAMERA_SHELL,
      // the sensors' windows, the battery on top, the vents along the sides
      sensors: { nose: 2, tail: 2, belly: 2 }, battery: [0.42, 0.94], vents: 3,
      points: { armFront: [0.044, 0.056, 0.012], armRear: [0.045, -0.062, -0.006], gimbal: [0, 0.1, -0.022], mast: [0, -0.02, 0.0375] },
    },
  },
  'arm-fold-camera-front': {
    kind: 'drone-arm', realm: 'earth', label: 'camera quad front arm', classOf: 'folding camera quad class (0.9 kg)',
    aliases: ['folding front arm'],
    dims: { length: 0.135, width: 0.02, height: 0.015 }, mass: 0.05, mount: 'arm-root',
    build: { family: 'beam', rise: 0.006, fold: { angle: -126 }, led: 'nav', foot: 0.03, motorPad: 0.016 },
  },
  'arm-fold-camera-rear': {
    kind: 'drone-arm', realm: 'earth', label: 'camera quad rear arm', classOf: 'folding camera quad class (0.9 kg)',
    aliases: ['folding rear arm'],
    dims: { length: 0.14, width: 0.02, height: 0.015 }, mass: 0.05, mount: 'arm-root',
    build: { family: 'beam', rise: 0.022, fold: { angle: 128 }, led: 'status', foot: 0.028, motorPad: 0.016 },
  },
  'motor-1806': {
    kind: 'drone-motor', realm: 'earth', label: '1806-class outrunner', classOf: '18 mm stator outrunner',
    aliases: ['outrunner', 'brushless motor'],
    dims: { diameter: 0.024, height: 0.017 }, mass: 0.025, perf: { power: 0.12 }, mount: 'motor-pad',
    build: { family: 'outrunner', slots: 6 },
  },
  'rotor-2-9in-ccw': {
    kind: 'drone-rotor', realm: 'earth', label: '9-inch two-blade rotor, counter-clockwise', classOf: '9-inch quick-release prop',
    aliases: ['ccw prop', 'nine inch prop'],
    dims: { diameter: 0.24 }, mass: 0.008, mount: 'prop-shaft',
    build: { family: 'blades', blades: 2, hand: 'ccw', rootChord: 0.016, maxChord: 0.022, tipChord: 0.008, rootPitch: 24, tipPitch: 9, sweep: 0.14, hub: 0.011 },
  },
  'rotor-2-9in-cw': {
    kind: 'drone-rotor', realm: 'earth', label: '9-inch two-blade rotor, clockwise', classOf: '9-inch quick-release prop',
    aliases: ['cw prop'],
    dims: { diameter: 0.24 }, mass: 0.008, mount: 'prop-shaft',
    build: { family: 'blades', blades: 2, hand: 'cw', rootChord: 0.016, maxChord: 0.022, tipChord: 0.008, rootPitch: 24, tipPitch: 9, sweep: 0.14, hub: 0.011 },
  },
  'guard-ring-9in': {
    kind: 'drone-guard', realm: 'earth', label: '9-inch prop guard', classOf: 'clip-on prop guard',
    aliases: ['prop guard', 'propeller guard'],
    dims: { diameter: 0.26, height: 0.022 }, mass: 0.012, mount: 'motor-pad',
    build: { family: 'ring', spokes: 3 },
  },
  'gimbal-3axis-camera': {
    kind: 'drone-payload', realm: 'earth', label: 'three-axis camera gimbal', classOf: 'camera quad gimbal (1-inch sensor)',
    aliases: ['gimbal camera', 'camera gimbal'],
    dims: { width: 0.042, length: 0.04, height: 0.046 }, mass: 0.06, mount: 'gimbal-plate',
    build: { family: 'gimbal3' },
  },
  // the EO/IR balls a military look hangs in place of a camera gimbal, the nearest in size
  'eoir-ball-small': {
    kind: 'drone-payload', realm: 'earth', label: 'small EO/IR ball', classOf: 'small-drone EO/IR turret',
    aliases: ['eo ir ball', 'thermal ball', 'sensor ball'],
    dims: { diameter: 0.05, height: 0.058 }, mass: 0.1, mount: 'gimbal-plate',
    build: { family: 'eoir', windows: 2 },
  },
  'eoir-ball-medium': {
    kind: 'drone-payload', realm: 'earth', label: 'medium EO/IR ball', classOf: 'tactical-drone EO/IR turret',
    aliases: ['medium sensor ball'],
    dims: { diameter: 0.12, height: 0.14 }, mass: 1.1, mount: 'gimbal-plate',
    build: { family: 'eoir', windows: 3 },
  },
  'eoir-ball-large': {
    kind: 'drone-payload', realm: 'earth', label: 'large EO/IR ball', classOf: 'long-endurance drone EO/IR turret',
    aliases: ['large sensor ball', 'targeting ball'],
    dims: { diameter: 0.38, height: 0.44 }, mass: 45, mount: 'gimbal-plate',
    build: { family: 'eoir', windows: 4 },
  },
  'mast-gps-puck': {
    kind: 'drone-mast', realm: 'earth', label: 'GPS mast and puck', classOf: 'folding GPS mast',
    aliases: ['gps mast', 'gps puck'],
    dims: { diameter: 0.05, height: 0.07 }, mass: 0.03, mount: 'mast-socket',
    build: { family: 'gps' },
  },

  // ===== earth: a five-inch racing quad =======================================================
  'frame-plate-fpv': {
    kind: 'drone-frame', realm: 'earth', label: 'five-inch racing frame', classOf: '5-inch freestyle quad class (0.65 kg)',
    aliases: ['fpv frame', 'racing frame', 'carbon frame'],
    dims: { length: 0.15, width: 0.042, height: 0.028 }, mass: 0.12, mount: 'airframe',
    build: { family: 'plate', plate: 0.004, top: 0.002, battery: [0.075, 0.035, 0.03], camTilt: 30, points: { armFront: [0.012, 0.03, -0.004], armRear: [0.012, -0.03, -0.004] } },
  },
  'arm-plate-fpv': {
    kind: 'drone-arm', realm: 'earth', label: 'racing quad arm', classOf: '5-inch freestyle quad class (0.65 kg)',
    aliases: ['carbon arm', 'fpv arm'],
    dims: { length: 0.085, width: 0.024, height: 0.005 }, mass: 0.012, mount: 'arm-root',
    build: { family: 'plate', motorPad: 0.014 },
  },
  'motor-2207': {
    kind: 'drone-motor', realm: 'earth', label: '2207-class outrunner', classOf: '22 mm stator racing motor',
    aliases: ['racing motor', '2207 motor'],
    dims: { diameter: 0.028, height: 0.021 }, mass: 0.032, perf: { power: 0.6 }, mount: 'motor-pad',
    build: { family: 'outrunner', slots: 6 },
  },
  ...rotors('rotor-3-5in', {
    kind: 'drone-rotor', realm: 'earth', label: '5-inch three-blade racing prop', classOf: '5-inch tri-blade prop',
    aliases: ['racing prop', 'tri-blade prop'],
    dims: { diameter: 0.127 }, mass: 0.004, mount: 'prop-shaft',
    build: { family: 'blades', blades: 3, rootChord: 0.011, maxChord: 0.016, tipChord: 0.009, rootPitch: 32, tipPitch: 15, sweep: 0.22, hub: 0.008 },
  }),

  // ===== earth: an enterprise inspection quad =================================================
  'frame-box-enterprise': {
    kind: 'drone-frame', realm: 'earth', label: 'inspection quad body', classOf: 'enterprise inspection quad class (6 kg)',
    aliases: ['enterprise drone body', 'rugged drone body'],
    dims: { length: 0.36, width: 0.22, height: 0.14 }, mass: 1.9, mount: 'airframe',
    build: {
      family: 'box', stations: RUGGED_BOX, sensors: { nose: 2, tail: 2, belly: 2 }, battery: [0.3, 0.86], vents: 4,
      points: { armFront: [0.1, 0.09, 0.03], armRear: [0.1, -0.09, 0.03], gear: [0.07, 0, -0.07], gimbal: [0, 0.13, -0.07], antenna: [0.075, -0.13, 0.07], mast: [0, 0.03, 0.07] },
    },
  },
  'arm-tube-enterprise': {
    kind: 'drone-arm', realm: 'earth', label: 'inspection quad arm', classOf: 'enterprise inspection quad class (6 kg)',
    aliases: ['folding tube arm'],
    dims: { length: 0.36, diameter: 0.025 }, mass: 0.16, mount: 'arm-root',
    build: { family: 'tube', fold: { angle: 82, axis: 'y' }, led: 'nav', motorPad: 0.028 },
  },
  'motor-4114': {
    kind: 'drone-motor', realm: 'earth', label: '4114-class outrunner', classOf: '41 mm stator lift motor',
    aliases: ['lift motor', '4114 motor'],
    dims: { diameter: 0.046, height: 0.03 }, mass: 0.11, perf: { power: 0.5 }, mount: 'motor-pad',
    build: { family: 'outrunner', slots: 9 },
  },
  ...rotors('rotor-2-21in', {
    kind: 'drone-rotor', realm: 'earth', label: '21-inch folding rotor', classOf: '21-inch folding prop',
    aliases: ['21 inch folding prop'],
    dims: { diameter: 0.53 }, mass: 0.03, mount: 'prop-shaft',
    build: { family: 'blades', blades: 2, folding: true, rootChord: 0.028, maxChord: 0.046, tipChord: 0.018, rootPitch: 21, tipPitch: 8, sweep: 0.1, hub: 0.02 },
  }),
  'gimbal-3axis-zoom': {
    kind: 'drone-payload', realm: 'earth', label: 'zoom and thermal gimbal', classOf: 'enterprise gimbal payload',
    aliases: ['zoom gimbal', 'thermal gimbal'],
    dims: { width: 0.12, length: 0.11, height: 0.13 }, mass: 0.9, mount: 'gimbal-plate',
    build: { family: 'gimbal3' },
  },
  'mast-paddle-enterprise': {
    kind: 'drone-mast', realm: 'earth', label: 'folding antenna paddle', classOf: 'enterprise datalink antenna',
    aliases: ['antenna paddle', 'datalink antenna'],
    dims: { width: 0.03, height: 0.11 }, mass: 0.02, mount: 'mast-socket',
    build: { family: 'paddle' },
  },
  'gear-skid-enterprise': {
    kind: 'drone-gear', realm: 'earth', label: 'inspection quad skid', classOf: 'enterprise inspection quad class (6 kg)',
    aliases: ['drone skid', 'landing skid'],
    dims: { height: 0.2, length: 0.32, diameter: 0.016 }, mass: 0.12, mount: 'gear-socket',
    build: { family: 'skid', splay: 0.06 },
  },

  // ===== earth: a heavy-lift hexacopter =======================================================
  'frame-hub-heavy': {
    kind: 'drone-frame', realm: 'earth', label: 'heavy-lift hub', classOf: 'heavy-lift hexacopter class (25 kg)',
    aliases: ['hexacopter hub', 'heavy lift hub'],
    dims: { diameter: 0.36, height: 0.1 }, mass: 3.2, mount: 'airframe',
    build: { family: 'hub', dome: 0.07, points: { armA: [0.09, 0.156, 0.05], armB: [0.18, 0, 0.05], armC: [0.09, -0.156, 0.05], gear: [0.11, 0, 0], bay: [0, 0, 0], mast: [0, -0.07, 0.15] } },
  },
  'arm-tube-heavy': {
    kind: 'drone-arm', realm: 'earth', label: 'heavy-lift arm', classOf: 'heavy-lift hexacopter class (25 kg)',
    aliases: ['heavy tube arm'],
    dims: { length: 0.42, diameter: 0.03 }, mass: 0.35, mount: 'arm-root',
    build: { family: 'tube', fold: { angle: 78, axis: 'y' }, led: 'nav', motorPad: 0.035 },
  },
  'motor-6215': {
    kind: 'drone-motor', realm: 'earth', label: '6215-class outrunner', classOf: '62 mm stator heavy-lift motor',
    aliases: ['heavy lift motor'],
    dims: { diameter: 0.07, height: 0.04 }, mass: 0.42, perf: { power: 1.6 }, mount: 'motor-pad',
    build: { family: 'outrunner', slots: 12 },
  },
  ...rotors('rotor-2-22in', {
    kind: 'drone-rotor', realm: 'earth', label: '22-inch folding heavy-lift rotor', classOf: '22-inch carbon folding prop',
    aliases: ['22 inch folding prop'],
    dims: { diameter: 0.56 }, mass: 0.06, mount: 'prop-shaft',
    build: { family: 'blades', blades: 2, folding: true, rootChord: 0.032, maxChord: 0.05, tipChord: 0.02, rootPitch: 19, tipPitch: 8, sweep: 0.08, hub: 0.026 },
  }),
  'gear-skid-heavy': {
    kind: 'drone-gear', realm: 'earth', label: 'heavy-lift skid', classOf: 'heavy-lift hexacopter class (25 kg)',
    aliases: ['heavy lift skid'],
    dims: { height: 0.38, length: 0.55, diameter: 0.022 }, mass: 0.4, mount: 'gear-socket',
    build: { family: 'skid', splay: 0.12 },
  },
  'box-cargo-heavy': {
    kind: 'drone-payload', realm: 'earth', label: 'underslung cargo box', classOf: 'heavy-lift cargo pod (10 kg)',
    aliases: ['cargo box', 'cargo pod'],
    dims: { width: 0.26, length: 0.32, height: 0.18 }, mass: 1.2, mount: 'payload-rail',
    build: { family: 'box' },
  },

  // ===== earth: a coaxial X8 mapper ===========================================================
  'frame-hub-x8': {
    kind: 'drone-frame', realm: 'earth', label: 'coaxial octocopter hub', classOf: 'coaxial X8 class (15 kg)',
    aliases: ['x8 hub', 'octocopter hub'],
    dims: { diameter: 0.3, height: 0.09 }, mass: 2.4, mount: 'airframe',
    build: { family: 'hub', dome: 0.06, points: { armFront: [0.106, 0.106, 0.045], armRear: [0.106, -0.106, 0.045], gear: [0.09, 0, 0], bay: [0, 0, 0], mast: [0, -0.06, 0.13] } },
  },
  'arm-tube-coax': {
    kind: 'drone-arm', realm: 'earth', label: 'coaxial arm', classOf: 'coaxial X8 class (15 kg)',
    aliases: ['coax arm'],
    dims: { length: 0.38, diameter: 0.028 }, mass: 0.3, mount: 'arm-root',
    build: { family: 'tube', coax: true, fold: { angle: 78, axis: 'y' }, led: 'nav', motorPad: 0.032 },
  },
  'motor-5010': {
    kind: 'drone-motor', realm: 'earth', label: '5010-class outrunner', classOf: '50 mm stator motor',
    aliases: ['5010 motor'],
    dims: { diameter: 0.058, height: 0.028 }, mass: 0.2, perf: { power: 0.9 }, mount: 'motor-pad',
    build: { family: 'outrunner', slots: 9 },
  },
  ...rotors('rotor-2-18in', {
    kind: 'drone-rotor', realm: 'earth', label: '18-inch folding rotor', classOf: '18-inch folding prop',
    aliases: ['18 inch folding prop'],
    dims: { diameter: 0.46 }, mass: 0.03, mount: 'prop-shaft',
    build: { family: 'blades', blades: 2, folding: true, rootChord: 0.026, maxChord: 0.042, tipChord: 0.016, rootPitch: 20, tipPitch: 8, sweep: 0.1, hub: 0.018 },
  }),
  'gear-skid-x8': {
    kind: 'drone-gear', realm: 'earth', label: 'coaxial octocopter skid', classOf: 'coaxial X8 class (15 kg)',
    aliases: ['x8 skid'],
    dims: { height: 0.34, length: 0.5, diameter: 0.02 }, mass: 0.3, mount: 'gear-socket',
    build: { family: 'skid', splay: 0.1 },
  },
  'lidar-puck': {
    kind: 'drone-payload', realm: 'earth', label: 'mapping LiDAR puck', classOf: 'survey LiDAR (1 kg)',
    aliases: ['lidar', 'lidar scanner', 'laser scanner'],
    dims: { width: 0.11, length: 0.11, height: 0.12 }, mass: 1, mount: 'payload-rail',
    build: { family: 'lidar' },
  },

  // ===== earth: an agricultural sprayer =======================================================
  'frame-hub-agri': {
    kind: 'drone-frame', realm: 'earth', label: 'crop sprayer hub', classOf: 'agricultural spray hexacopter class (40 kg)',
    aliases: ['sprayer hub'],
    dims: { diameter: 0.5, height: 0.16 }, mass: 6, mount: 'airframe',
    build: { family: 'hub', dome: 0.1, points: { armA: [0.125, 0.217, 0.08], armB: [0.25, 0, 0.08], armC: [0.125, -0.217, 0.08], gear: [0.17, 0, 0], bay: [0, 0, 0], mast: [0, -0.1, 0.26] } },
  },
  'arm-tube-agri': {
    kind: 'drone-arm', realm: 'earth', label: 'crop sprayer arm', classOf: 'agricultural spray hexacopter class (40 kg)',
    aliases: ['sprayer arm'],
    dims: { length: 0.62, diameter: 0.04 }, mass: 0.7, mount: 'arm-root',
    build: { family: 'tube', fold: { angle: 80, axis: 'y' }, led: 'nav', motorPad: 0.045 },
  },
  'motor-8120': {
    kind: 'drone-motor', realm: 'earth', label: '8120-class outrunner', classOf: '81 mm stator agricultural motor',
    aliases: ['agricultural motor'],
    dims: { diameter: 0.09, height: 0.046 }, mass: 0.6, perf: { power: 2.5 }, mount: 'motor-pad',
    build: { family: 'outrunner', slots: 12 },
  },
  ...rotors('rotor-2-30in', {
    kind: 'drone-rotor', realm: 'earth', label: '30-inch folding rotor', classOf: '30-inch folding agricultural prop',
    aliases: ['30 inch folding prop'],
    dims: { diameter: 0.76 }, mass: 0.12, mount: 'prop-shaft',
    build: { family: 'blades', blades: 2, folding: true, rootChord: 0.042, maxChord: 0.066, tipChord: 0.026, rootPitch: 18, tipPitch: 7, sweep: 0.08, hub: 0.034 },
  }),
  'gear-skid-agri': {
    kind: 'drone-gear', realm: 'earth', label: 'crop sprayer skid', classOf: 'agricultural spray hexacopter class (40 kg)',
    aliases: ['sprayer skid'],
    dims: { height: 0.55, length: 0.8, diameter: 0.03 }, mass: 0.9, mount: 'gear-socket',
    build: { family: 'skid', splay: 0.2 },
  },
  'sprayer-10l': {
    kind: 'drone-payload', realm: 'earth', label: '10-litre spray tank and boom', classOf: 'agricultural spray system (10 L)',
    aliases: ['spray tank', 'spray boom', 'sprayer'],
    dims: { width: 1.5, length: 0.34, height: 0.3 }, mass: 3, mount: 'payload-rail',
    build: { family: 'sprayer', nozzles: 6 },
  },

  // ===== earth: a ducted delivery quad ========================================================
  'frame-box-delivery': {
    kind: 'drone-frame', realm: 'earth', label: 'delivery quad body', classOf: 'parcel delivery quad class (9 kg)',
    aliases: ['delivery drone body'],
    dims: { length: 0.4, width: 0.26, height: 0.13 }, mass: 2.2, mount: 'airframe',
    build: {
      family: 'box', stations: RUGGED_BOX, sensors: { nose: 2, tail: 2, belly: 0 }, battery: [0.25, 0.8], vents: 3,
      points: { armFront: [0.11, 0.1, 0.02], armRear: [0.11, -0.11, 0.02], gear: [0.08, 0, -0.065], bay: [0, 0, -0.06], mast: [0, -0.05, 0.065] },
    },
  },
  'arm-tube-delivery': {
    kind: 'drone-arm', realm: 'earth', label: 'delivery quad arm', classOf: 'parcel delivery quad class (9 kg)',
    aliases: ['delivery arm'],
    dims: { length: 0.3, diameter: 0.028 }, mass: 0.2, mount: 'arm-root',
    build: { family: 'tube', led: 'nav', motorPad: 0.03 },
  },
  ...rotors('rotor-2-15in', {
    kind: 'drone-rotor', realm: 'earth', label: '15-inch rotor', classOf: '15-inch prop',
    aliases: ['15 inch prop'],
    dims: { diameter: 0.38 }, mass: 0.02, mount: 'prop-shaft',
    build: { family: 'blades', blades: 2, rootChord: 0.022, maxChord: 0.034, tipChord: 0.014, rootPitch: 22, tipPitch: 9, sweep: 0.12, hub: 0.016 },
  }),
  'duct-15in': {
    kind: 'drone-guard', realm: 'earth', label: '15-inch rotor duct', classOf: 'ducted rotor shroud',
    aliases: ['rotor duct', 'ducted fan shroud'],
    dims: { diameter: 0.4, height: 0.09 }, mass: 0.18, mount: 'motor-pad',
    build: { family: 'duct', struts: 3 },
  },
  'gear-skid-delivery': {
    kind: 'drone-gear', realm: 'earth', label: 'delivery quad skid', classOf: 'parcel delivery quad class (9 kg)',
    aliases: ['delivery skid'],
    dims: { height: 0.27, length: 0.36, diameter: 0.016 }, mass: 0.15, mount: 'gear-socket',
    build: { family: 'skid', splay: 0.08 },
  },
  'box-parcel': {
    kind: 'drone-payload', realm: 'earth', label: 'parcel box', classOf: 'delivery parcel box (2.5 kg)',
    aliases: ['parcel box', 'delivery box'],
    dims: { width: 0.22, length: 0.3, height: 0.15 }, mass: 0.6, mount: 'payload-rail',
    build: { family: 'box' },
  },
  'winch-parcel': {
    kind: 'drone-payload', realm: 'earth', label: 'parcel winch and hook', classOf: 'delivery tether winch',
    aliases: ['winch', 'tether winch'],
    dims: { diameter: 0.05, height: 0.12 }, mass: 0.3, mount: 'winch-mount',
    build: { family: 'winch' },
  },

  // ===== earth: the fixed wings (the shelf's own kinds at drone sizes) =========================
  // a hand-launched recon drone: a pod and boom, a high wing, a nose motor, a sensor ball under the pod
  'fus-drone-hand': {
    kind: 'craft-fuselage', realm: 'earth', label: 'hand-launched drone pod and boom', classOf: 'hand-launched small UAS class (2 kg)',
    aliases: ['drone pod', 'hand launch fuselage'], dims: { length: 0.95, width: 0.1, height: 0.12 }, mass: 0.5, mount: null,
    build: { family: 'tube', n: 2.6, seams: false, stations: [[0, 0.5, 0.5, 0.5], [0.08, 0.9, 0.9, 0.5], [0.3, 1, 1, 0.52], [0.5, 0.75, 0.7, 0.58], [0.6, 0.28, 0.28, 0.66], [1, 0.18, 0.18, 0.68]], points: { cowl: [0, 0, 0], wingRoot: [0.3, 0, 1], stabRoot: [0.97, 0, 0], finRoot: [0.9, 0, 0.9], sensor: [0.2, 0, -0.9] } },
  },
  'wing-drone-hand': {
    kind: 'craft-wing', realm: 'earth', label: 'hand-launched drone wing panel', classOf: 'hand-launched small UAS class (2 kg)',
    aliases: ['small drone wing'], dims: { span: 0.68 }, mass: 0.2, mount: 'wing-root',
    build: { minThick: 0.003, rootChord: 0.2, tipChord: 0.15, sweep: 0, dihedral: 5, thickness: 0.1, camber: 0.03, hinge: [0.5, 0.95, 0.25], points: { tip: [1, 0.3] } },
  },
  'stab-drone-hand': {
    kind: 'craft-stabilizer', realm: 'earth', label: 'hand-launched drone tailplane', classOf: 'hand-launched small UAS class (2 kg)',
    aliases: ['small drone tailplane'], dims: { span: 0.2 }, mass: 0.03, mount: 'tail-root',
    build: { minThick: 0.003, rootChord: 0.1, tipChord: 0.07, sweep: 5, dihedral: 0, thickness: 0.08, hinge: [0, 0.95, 0.4] },
  },
  'fin-drone-hand': {
    kind: 'craft-fin', realm: 'earth', label: 'hand-launched drone fin', classOf: 'hand-launched small UAS class (2 kg)',
    aliases: ['small drone fin'], dims: { span: 0.14 }, mass: 0.02, mount: 'tail-root',
    build: { minThick: 0.003, vertical: true, rootChord: 0.12, tipChord: 0.07, sweep: 25, thickness: 0.08, hinge: [0, 0.95, 0.35] },
  },
  'eng-drone-electric': {
    kind: 'craft-engine', realm: 'earth', label: 'small drone motor cowling', classOf: 'small UAS electric motor (0.3 kW)',
    aliases: ['drone nose motor'], dims: { length: 0.06, diameter: 0.065 }, mass: 0.15, perf: { power: 0.3 }, mount: 'nose-mount',
    build: { family: 'cowl' },
  },
  'prop-drone-hand': {
    kind: 'craft-propeller', realm: 'earth', label: 'small drone folding propeller', classOf: '11-inch folding prop',
    aliases: ['drone propeller'], dims: { diameter: 0.28 }, mass: 0.02, mount: 'hub-mount',
    build: { blades: 2, hubDiameter: 0.032, spinnerLength: 0.03, rootChord: 0.024, tipChord: 0.014, rootPitch: 30, tipPitch: 12 },
  },

  // a catapult-launched tactical drone: a pod, a high wing, twin booms to an H-tail, a pusher, fixed gear
  'fus-drone-tactical': {
    kind: 'craft-fuselage', realm: 'earth', label: 'tactical drone pod', classOf: 'tactical twin-boom UAS class (200 kg)',
    aliases: ['tactical drone pod'], dims: { length: 2.0, width: 0.34, height: 0.42 }, mass: 45, mount: null,
    build: { family: 'tube', n: 2.6, belly: 0.9, nose: 0.06, stations: [[0, 0.3, 0.3, 0.45], [0.1, 0.85, 0.85, 0.48], [0.3, 1, 1, 0.5], [0.75, 0.9, 0.85, 0.52], [1, 0.45, 0.4, 0.55]], points: { wingRoot: [0.42, 0, 0.95], engine: [1, 0, 0.1], sensor: [0.17, 0, -0.95], noseGear: [0.1, 0, -0.95], mainGear: [0.5, 0.7, -0.95] } },
  },
  'wing-drone-tactical': {
    kind: 'craft-wing', realm: 'earth', label: 'tactical drone wing panel', classOf: 'tactical twin-boom UAS class (200 kg)',
    aliases: ['tactical drone wing'], dims: { span: 2.15 }, mass: 22, mount: 'wing-root',
    build: { minThick: 0.003, rootChord: 0.42, tipChord: 0.32, sweep: 0, dihedral: 2, thickness: 0.14, camber: 0.03, hinge: [0.45, 0.95, 0.25], points: { tip: [1, 0.3], boom: [0.28, 0, 'lower'] } },
  },
  'fus-drone-boom': {
    kind: 'craft-fuselage', realm: 'earth', label: 'tactical drone tail boom', classOf: 'tactical twin-boom UAS class (200 kg)',
    aliases: ['tail boom', 'twin boom'], dims: { length: 1.95, width: 0.065, height: 0.075 }, mass: 4, mount: null,
    build: { family: 'tube', n: 2, seams: false, stations: [[0, 0.5, 0.5, 0.5], [0.06, 1, 1, 0.5], [0.94, 1, 1, 0.5], [1, 0.7, 0.7, 0.5]], points: { stabRoot: [0.9, 0, 0], finRoot: [0.84, 0, 0.9] } },
  },
  'stab-drone-tactical': {
    kind: 'craft-stabilizer', realm: 'earth', label: 'tactical drone H-tail stabilizer', classOf: 'tactical twin-boom UAS class (200 kg)',
    aliases: ['boom tailplane'], dims: { span: 0.6 }, mass: 2, mount: 'tail-root',
    build: { minThick: 0.003, rootChord: 0.26, tipChord: 0.26, sweep: 0, dihedral: 0, thickness: 0.1, hinge: [0, 0.95, 0.35] },
  },
  'fin-drone-tactical': {
    kind: 'craft-fin', realm: 'earth', label: 'tactical drone boom fin', classOf: 'tactical twin-boom UAS class (200 kg)',
    aliases: ['boom fin'], dims: { span: 0.42 }, mass: 1.5, mount: 'tail-root',
    build: { minThick: 0.003, vertical: true, rootChord: 0.34, tipChord: 0.2, sweep: 25, thickness: 0.1, hinge: [0, 0.95, 0.35] },
  },
  'eng-drone-piston': {
    kind: 'craft-engine', realm: 'earth', label: 'tactical drone rotary engine cowling', classOf: 'tactical UAS rotary engine (28 kW)',
    aliases: ['drone pusher engine'], dims: { length: 0.36, diameter: 0.3 }, mass: 14, perf: { power: 28 }, mount: 'nose-mount',
    build: { family: 'cowl' },
  },
  'prop-drone-tactical': {
    kind: 'craft-propeller', realm: 'earth', label: 'tactical drone pusher propeller', classOf: '28-inch pusher prop',
    aliases: ['pusher propeller'], dims: { diameter: 0.72 }, mass: 1.2, mount: 'hub-mount',
    build: { blades: 2, hubDiameter: 0.09, spinnerLength: 0.11, rootChord: 0.06, tipChord: 0.035, rootPitch: 32, tipPitch: 13 },
  },
  'gear-nose-drone-tactical': {
    kind: 'craft-gear', realm: 'earth', label: 'tactical drone nose leg', classOf: 'tactical twin-boom UAS class (200 kg)',
    aliases: ['drone nose leg'], dims: { height: 0.42 }, mass: 2, mount: 'gear-well',
    build: { retract: false, family: 'leg', strut: 0.341, oleo: 0.02, rake: 0.04, tyre: [0.16, 0.06] },
  },
  'gear-main-drone-tactical': {
    kind: 'craft-gear', realm: 'earth', label: 'tactical drone spring main leg', classOf: 'tactical twin-boom UAS class (200 kg)',
    aliases: ['drone spring leg'], dims: { height: 0.42 }, mass: 3, mount: 'gear-well',
    build: { family: 'spring', strut: 0.32, splay: 0.32, tyre: [0.2, 0.07] },
  },

  // a medium-altitude long-endurance recon drone: its satcom's swell over the nose, a long slender wing, a V-tail and a
  // ventral fin, a pusher turboprop, its sensor ball, its stores (modelled, never fired)
  'fus-drone-male': {
    kind: 'craft-fuselage', realm: 'earth', label: 'long-endurance drone fuselage', classOf: 'MALE UAS class (4.7 t)',
    aliases: ['male drone fuselage', 'long endurance fuselage'], dims: { length: 10.5, width: 1.0, height: 1.3 }, mass: 900, mount: null,
    build: { family: 'tube', n: 2.4, belly: 0.85, nose: 0.05, stations: [[0, 0.3, 0.3, 0.55], [0.08, 0.85, 0.95, 0.6], [0.18, 0.95, 1, 0.6], [0.32, 1, 0.85, 0.52], [0.6, 0.85, 0.7, 0.5], [0.85, 0.5, 0.5, 0.5], [1, 0.3, 0.32, 0.5]], points: { wingRoot: [0.42, 0.9, -0.05], tailRoot: [0.86, 0.35, 0.6], ventral: [0.9, 0, -0.75], engine: [1, 0, 0], sensor: [0.11, 0, -0.95], noseGear: [0.12, 0, -0.95], mainGear: [0.45, 0.55, -0.95] } },
  },
  'wing-drone-male': {
    kind: 'craft-wing', realm: 'earth', label: 'long-endurance drone wing panel', classOf: 'MALE UAS class (4.7 t)',
    aliases: ['long endurance wing', 'glider wing'], dims: { span: 9.6 }, mass: 300, mount: 'wing-root',
    build: { minThick: 0.003, planform: [[0, 1.3], [1, 0.55]], sweep: 0, dihedral: 2, thickness: 0.14, camber: 0.03, twist: 2, hinge: [0.1, 0.95, 0.22], points: { tip: [1, 0.3], storeIn: [0.24, 0.3, 'lower'], storeOut: [0.42, 0.3, 'lower'] } },
  },
  'fin-drone-male-v': {
    kind: 'craft-fin', realm: 'earth', label: 'long-endurance drone V-tail', classOf: 'MALE UAS class (4.7 t)',
    aliases: ['drone v tail'], dims: { span: 2.1 }, mass: 30, mount: 'tail-root',
    build: { minThick: 0.003, vertical: true, rootChord: 1.1, tipChord: 0.6, sweep: 30, cant: 45, thickness: 0.1, hinge: [0, 0.95, 0.35] },
  },
  'fin-drone-male-ventral': {
    kind: 'craft-fin', realm: 'earth', label: 'long-endurance drone ventral fin', classOf: 'MALE UAS class (4.7 t)',
    aliases: ['ventral fin'], dims: { span: 0.75 }, mass: 10, mount: 'tail-root',
    build: { minThick: 0.003, vertical: true, rootChord: 0.9, tipChord: 0.55, sweep: 30, thickness: 0.1 },
  },
  'eng-drone-turboprop': {
    kind: 'craft-engine', realm: 'earth', label: 'long-endurance drone turboprop cowling', classOf: 'MALE UAS turboprop (670 kW)',
    aliases: ['drone turboprop'], dims: { length: 0.8, diameter: 0.62 }, mass: 170, perf: { power: 670 }, mount: 'nose-mount',
    build: { family: 'cowl' },
  },
  'prop-drone-male': {
    kind: 'craft-propeller', realm: 'earth', label: 'long-endurance drone pusher propeller', classOf: '3-blade pusher prop (2.9 m)',
    aliases: ['three blade pusher'], dims: { diameter: 2.9 }, mass: 40, mount: 'hub-mount',
    build: { blades: 3, hubDiameter: 0.3, spinnerLength: 0.4, rootChord: 0.2, tipChord: 0.11, rootPitch: 36, tipPitch: 14 },
  },
  'gear-nose-drone-male': {
    kind: 'craft-gear', realm: 'earth', label: 'long-endurance drone nose leg', classOf: 'MALE UAS class (4.7 t)',
    aliases: ['male drone nose leg'], dims: { height: 1.35 }, mass: 25, mount: 'gear-well',
    build: { family: 'leg', strut: 1.2, oleo: 0.05, rake: 0.06, tyre: [0.42, 0.15] },
  },
  'gear-main-drone-male': {
    kind: 'craft-gear', realm: 'earth', label: 'long-endurance drone main leg', classOf: 'MALE UAS class (4.7 t)',
    aliases: ['male drone main leg'], dims: { height: 1.35 }, mass: 45, mount: 'gear-well',
    build: { retract: 'inward', family: 'leg', strut: 1.15, oleo: 0.07, tyre: [0.55, 0.18] },
  },
  'pylon-drone-male': {
    kind: 'craft-pylon', realm: 'earth', label: 'long-endurance drone store pylon', classOf: 'MALE UAS class (4.7 t)',
    aliases: ['drone pylon', 'store pylon'], dims: { length: 0.75, height: 0.22 }, mass: 12, mount: 'wing-store',
    build: { family: 'underwing', forward: 0.3, thickness: 0.12 },
  },
  'missile-agm-drone': {
    kind: 'craft-weapon', realm: 'earth', label: 'air-to-ground missile (modelled, never fired)', classOf: 'small air-to-ground missile class (50 kg)',
    aliases: ['air to ground missile', 'drone missile'], dims: { length: 1.63, diameter: 0.178 }, mass: 50, mount: 'hardpoint',
    build: { family: 'missile' },
  },

  // a flying-wing combat drone: a blended faceted body and a cranked wing, no tail (stealth's role)
  'fus-drone-blended': {
    kind: 'craft-fuselage', realm: 'earth', label: 'flying-wing drone centre body', classOf: 'flying-wing combat UAS class (20 t)',
    aliases: ['blended body', 'flying wing body'], dims: { length: 9.0, width: 2.8, height: 1.05 }, mass: 3500, mount: null,
    build: { family: 'facet', facets: BLENDED, stations: [[0, 0.04, 0.05, 0.5], [0.18, 0.45, 0.6, 0.52], [0.45, 0.9, 1, 0.52], [0.78, 1, 0.75, 0.48], [1, 0.8, 0.22, 0.45]], points: { wingRoot: [0.3, 0.88, -0.2], mainGear: [0.58, 0.45, -1], noseGear: [0.2, 0, -1] } },
  },
  'wing-drone-cranked': {
    kind: 'craft-wing', realm: 'earth', label: 'cranked flying-wing panel', classOf: 'flying-wing combat UAS class (20 t)',
    aliases: ['cranked kite wing', 'flying wing panel'], dims: { span: 4.6 }, mass: 1100, mount: 'wing-root',
    build: { minThick: 0.003, section: 'facet', planform: [[0, 6.0, 0], [0.38, 2.9, 2.7], [1, 0.9, 4.6]], thickness: 0.05, hinge: [0.4, 0.95, 0.18], elevons: true, navLight: false },
  },

  // a VTOL quadplane: a pod and a high wing, two booms carrying four lift rotors, a pusher, an H-tail on the booms
  'fus-drone-quadplane': {
    kind: 'craft-fuselage', realm: 'earth', label: 'quadplane pod', classOf: 'VTOL quadplane class (15 kg)',
    aliases: ['quadplane pod', 'vtol pod'], dims: { length: 1.15, width: 0.17, height: 0.2 }, mass: 3, mount: null,
    build: { family: 'tube', n: 2.6, seams: false, stations: [[0, 0.4, 0.4, 0.5], [0.12, 0.9, 0.9, 0.5], [0.4, 1, 1, 0.52], [0.8, 0.8, 0.7, 0.55], [1, 0.4, 0.35, 0.58]], points: { wingRoot: [0.36, 0, 0.95], engine: [1, 0, 0.15], sensor: [0.2, 0, -0.9], gear: [0.45, 0.55, -0.95] } },
  },
  'wing-drone-quadplane': {
    kind: 'craft-wing', realm: 'earth', label: 'quadplane wing panel', classOf: 'VTOL quadplane class (15 kg)',
    aliases: ['quadplane wing'], dims: { span: 1.45 }, mass: 0.9, mount: 'wing-root',
    build: { minThick: 0.003, rootChord: 0.3, tipChord: 0.22, sweep: 0, dihedral: 2, thickness: 0.13, camber: 0.03, hinge: [0.55, 0.95, 0.25], points: { tip: [1, 0.3], boom: [0.36, 0, 'lower'] } },
  },
  'fus-drone-qp-boom': {
    kind: 'craft-fuselage', realm: 'earth', label: 'quadplane rotor boom', classOf: 'VTOL quadplane class (15 kg)',
    aliases: ['rotor boom'], dims: { length: 1.55, width: 0.045, height: 0.05 }, mass: 0.4, mount: null,
    build: { family: 'tube', n: 2, seams: false, stations: [[0, 0.6, 0.6, 0.5], [0.04, 1, 1, 0.5], [0.96, 1, 1, 0.5], [1, 0.6, 0.6, 0.5]], points: { rotorFront: [0.02, 0, 1], rotorRear: [0.98, 0, 1], stabRoot: [0.93, 0, 0], finRoot: [0.88, 0, 0.9] } },
  },
  'stab-drone-quadplane': {
    kind: 'craft-stabilizer', realm: 'earth', label: 'quadplane H-tail stabilizer', classOf: 'VTOL quadplane class (15 kg)',
    aliases: ['quadplane tailplane'], dims: { span: 0.52 }, mass: 0.08, mount: 'tail-root',
    build: { minThick: 0.003, rootChord: 0.13, tipChord: 0.13, sweep: 0, dihedral: 0, thickness: 0.09, hinge: [0, 0.95, 0.35] },
  },
  'fin-drone-quadplane': {
    kind: 'craft-fin', realm: 'earth', label: 'quadplane boom fin', classOf: 'VTOL quadplane class (15 kg)',
    aliases: ['quadplane fin'], dims: { span: 0.2 }, mass: 0.05, mount: 'tail-root',
    build: { minThick: 0.003, vertical: true, rootChord: 0.17, tipChord: 0.1, sweep: 25, thickness: 0.09, hinge: [0, 0.95, 0.35] },
  },
  'eng-drone-electric-pusher': {
    kind: 'craft-engine', realm: 'earth', label: 'quadplane pusher motor cowling', classOf: 'small UAS electric motor (1.5 kW)',
    aliases: ['quadplane pusher motor'], dims: { length: 0.1, diameter: 0.09 }, mass: 0.3, perf: { power: 1.5 }, mount: 'nose-mount',
    build: { family: 'cowl' },
  },
  'prop-drone-quadplane': {
    kind: 'craft-propeller', realm: 'earth', label: 'quadplane pusher propeller', classOf: '17-inch pusher prop',
    aliases: ['quadplane propeller'], dims: { diameter: 0.43 }, mass: 0.04, mount: 'hub-mount',
    build: { blades: 2, hubDiameter: 0.045, spinnerLength: 0.05, rootChord: 0.035, tipChord: 0.02, rootPitch: 30, tipPitch: 12 },
  },
  'gear-skid-quadplane': {
    kind: 'drone-gear', realm: 'earth', label: 'quadplane skid', classOf: 'VTOL quadplane class (15 kg)',
    aliases: ['quadplane skid'], dims: { height: 0.36, length: 0.5, diameter: 0.014 }, mass: 0.2, mount: 'gear-socket',
    build: { family: 'skid', splay: 0.12 },
  },

  // a tube-launched loitering munition (modelled, never fired): a body tube, tandem wings that swing out of the tube,
  // a pusher; its wings folded along its body by the craft's `fold`
  'fus-drone-loiter': {
    kind: 'craft-fuselage', realm: 'earth', label: 'loitering munition body', classOf: 'tube-launched loitering munition class (2.5 kg)',
    aliases: ['loitering munition body', 'munition body'], dims: { length: 0.6, width: 0.08, height: 0.08 }, mass: 1.6, mount: null,
    build: { family: 'tube', n: 2, seams: false, nose: 0.07, stations: [[0, 0.4, 0.4, 0.5], [0.1, 0.95, 0.95, 0.5], [0.9, 1, 1, 0.5], [1, 0.7, 0.7, 0.5]], points: { wingFront: [0.26, 0, 0.9], wingRear: [0.78, 0, -0.9], engine: [1, 0, 0], finRoot: [0.88, 0, 0.9] } },
  },
  'wing-drone-loiter-front': {
    kind: 'craft-wing', realm: 'earth', label: 'loitering munition front wing', classOf: 'tube-launched loitering munition class (2.5 kg)',
    aliases: ['munition front wing'], dims: { span: 0.3 }, mass: 0.05, mount: 'wing-root',
    build: { minThick: 0.003, rootChord: 0.06, tipChord: 0.05, sweep: 0, dihedral: 0, thickness: 0.07, navLight: false, pivot: { angle: -84 } },
  },
  'wing-drone-loiter-rear': {
    kind: 'craft-wing', realm: 'earth', label: 'loitering munition rear wing', classOf: 'tube-launched loitering munition class (2.5 kg)',
    aliases: ['munition rear wing'], dims: { span: 0.28 }, mass: 0.05, mount: 'wing-root',
    build: { minThick: 0.003, rootChord: 0.055, tipChord: 0.045, sweep: 0, dihedral: 0, thickness: 0.07, navLight: false, hinge: [0.1, 0.95, 0.3], pivot: { angle: 84 } },
  },
  'fin-drone-loiter': {
    kind: 'craft-fin', realm: 'earth', label: 'loitering munition fin', classOf: 'tube-launched loitering munition class (2.5 kg)',
    aliases: ['munition fin'], dims: { span: 0.05 }, mass: 0.01, mount: 'tail-root',
    build: { minThick: 0.003, vertical: true, rootChord: 0.06, tipChord: 0.035, sweep: 30, thickness: 0.08 },
  },
  'eng-drone-electric-tiny': {
    kind: 'craft-engine', realm: 'earth', label: 'loitering munition motor', classOf: 'small UAS electric motor (0.4 kW)',
    aliases: ['munition motor'], dims: { length: 0.03, diameter: 0.05 }, mass: 0.08, perf: { power: 0.4 }, mount: 'nose-mount',
    build: { family: 'cowl' },
  },
  'prop-drone-loiter': {
    kind: 'craft-propeller', realm: 'earth', label: 'loitering munition folding propeller', classOf: '7-inch folding prop',
    aliases: ['munition propeller'], dims: { diameter: 0.18 }, mass: 0.01, mount: 'hub-mount',
    build: { blades: 2, hubDiameter: 0.024, spinnerLength: 0.02, rootChord: 0.016, tipChord: 0.01, rootPitch: 30, tipPitch: 12 },
  },

  // ===== space: a sentry probe (the survey role's starship drone) =============================
  'frame-probe-sentry': {
    kind: 'drone-frame', realm: 'space', label: 'sentry probe hull', classOf: 'sentry probe register',
    aliases: ['probe hull'],
    dims: { length: 0.62, width: 0.5, height: 0.3 }, mass: 22, mount: 'airframe',
    build: {
      family: 'shell', n: 2.2, belly: 1, stations: [[0, 0.5, 0.55, 0], [0.15, 0.95, 0.95, 0], [0.6, 1, 1, 0], [1, 0.45, 0.5, 0.05]],
      sensors: { nose: 0, tail: 2, belly: 0 }, battery: null, vents: 4,
      points: { armFront: [0.22, 0.13, 0], armRear: [0.22, -0.15, 0], gimbal: [0, 0.29, 0.07], mast: [0, -0.1, 0.15] },
    },
  },
  'arm-stub-probe': {
    kind: 'drone-arm', realm: 'space', label: 'probe vent stub', classOf: 'sentry probe register',
    aliases: ['vent stub'],
    dims: { length: 0.16, width: 0.07, height: 0.05 }, mass: 1.5, mount: 'arm-root',
    build: { family: 'beam', rise: 0, led: 'status', foot: 0, motorPad: 0.06 },
  },
  'motor-vent-probe': {
    kind: 'drone-motor', realm: 'space', label: 'probe lift vent', classOf: 'sentry probe register',
    aliases: ['lift vent', 'hover vent'],
    dims: { diameter: 0.1, height: 0.08 }, mass: 2.5, perf: { power: 3 }, mount: 'motor-pad',
    build: { family: 'vent' },
  },
  'eye-probe': {
    kind: 'drone-payload', realm: 'space', label: 'probe sensor eye', classOf: 'sentry probe register',
    aliases: ['sensor eye', 'probe eye'],
    dims: { width: 0.16, length: 0.12, height: 0.16 }, mass: 2, mount: 'gimbal-plate',
    build: { family: 'eye' },
  },

  // ===== space: a dart probe (the racer's starship drone) =====================================
  'frame-probe-dart': {
    kind: 'drone-frame', realm: 'space', label: 'dart probe hull', classOf: 'racing probe register',
    aliases: ['racing probe hull'],
    dims: { length: 0.5, width: 0.22, height: 0.14 }, mass: 6, mount: 'airframe',
    build: {
      family: 'shell', n: 2.4, belly: 0.9, stations: [[0, 0.08, 0.15, 0], [0.3, 0.8, 0.8, 0], [0.7, 1, 1, 0.05], [1, 0.55, 0.5, 0.1]],
      sensors: { nose: 0, tail: 2, belly: 0 }, battery: null, vents: 2,
      points: { armFront: [0.09, 0.07, 0], armRear: [0.09, -0.15, 0], gimbal: [0, 0.2, 0.04], mast: [0, -0.1, 0.07] },
    },
  },
  'arm-stub-dart': {
    kind: 'drone-arm', realm: 'space', label: 'dart probe vent stub', classOf: 'racing probe register',
    aliases: ['dart stub'],
    dims: { length: 0.1, width: 0.04, height: 0.03 }, mass: 0.4, mount: 'arm-root',
    build: { family: 'beam', rise: 0.01, led: 'nav', foot: 0, motorPad: 0.035 },
  },
  'motor-vent-dart': {
    kind: 'drone-motor', realm: 'space', label: 'dart probe vent', classOf: 'racing probe register',
    aliases: ['dart vent'],
    dims: { diameter: 0.06, height: 0.05 }, mass: 0.6, perf: { power: 1.2 }, mount: 'motor-pad',
    build: { family: 'vent' },
  },

  // ===== space: the hauler probes (the delivery and agriculture roles' starship drones) ========
  'frame-probe-hauler': {
    kind: 'drone-frame', realm: 'space', label: 'hauler probe hull', classOf: 'cargo probe register',
    aliases: ['hauler hull'],
    dims: { length: 0.9, width: 0.7, height: 0.36 }, mass: 45, mount: 'airframe',
    build: {
      family: 'box', stations: RUGGED_BOX, sensors: { nose: 2, tail: 0, belly: 0 }, battery: null, vents: 4,
      points: { armFront: [0.3, 0.24, 0], armRear: [0.3, -0.26, 0], bay: [0, 0, -0.17], mast: [0, -0.2, 0.18] },
    },
  },
  'arm-stub-hauler': {
    kind: 'drone-arm', realm: 'space', label: 'hauler vent stub', classOf: 'cargo probe register',
    aliases: ['hauler stub'],
    dims: { length: 0.26, width: 0.1, height: 0.07 }, mass: 3, mount: 'arm-root',
    build: { family: 'beam', rise: 0, led: 'status', foot: 0, motorPad: 0.085 },
  },
  'motor-vent-hauler': {
    kind: 'drone-motor', realm: 'space', label: 'hauler lift vent', classOf: 'cargo probe register',
    aliases: ['hauler vent'],
    dims: { diameter: 0.17, height: 0.13 }, mass: 5, perf: { power: 8 }, mount: 'motor-pad',
    build: { family: 'vent' },
  },
  'pod-cargo-probe': {
    kind: 'drone-payload', realm: 'space', label: 'probe cargo pod', classOf: 'cargo probe register',
    aliases: ['cargo pod probe'],
    dims: { width: 0.5, length: 0.6, height: 0.28 }, mass: 8, mount: 'payload-rail',
    build: { family: 'box' },
  },
  'frame-probe-seeker': {
    kind: 'drone-frame', realm: 'space', label: 'seeker probe hull', classOf: 'seeker probe register',
    aliases: ['seeker hull'],
    dims: { length: 0.42, width: 0.16, height: 0.14 }, mass: 4, mount: 'airframe',
    build: {
      family: 'shell', n: 2.2, belly: 1, stations: [[0, 0.05, 0.05, 0], [0.4, 0.85, 0.85, 0], [0.8, 1, 1, 0], [1, 0.6, 0.6, 0]],
      sensors: { nose: 0, tail: 0, belly: 0 }, battery: null, vents: 2,
      points: { armFront: [0.06, 0.05, 0], armRear: [0.06, -0.13, 0], gimbal: [0, 0.16, 0.06], mast: [0, -0.1, 0.07] },
    },
  },
  'tank-seed-probe': {
    kind: 'drone-payload', realm: 'space', label: 'seeder tank and spreader', classOf: 'seeder probe register',
    aliases: ['seed tank', 'spreader boom'],
    dims: { width: 1.2, length: 0.5, height: 0.28 }, mass: 10, mount: 'payload-rail',
    build: { family: 'sprayer', nozzles: 5 },
  },
};
