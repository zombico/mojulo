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
 *   drone-payload  a gimbal camera ('gimbal3'), a starship drone's eye ('eye'); its mount on top
 *   drone-mast     a GPS mast and its puck ('gps')
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
  'drone-mast': 'a drone\'s GPS mast and puck',
});

// a folding camera quad's body: a moulded shell, flat-faced at the nose and tail where its sensors look out
const CAMERA_SHELL = [[0, 0.55, 0.6, 0], [0.12, 0.92, 0.92, 0], [0.5, 1, 1, 0], [0.85, 0.9, 0.9, 0.05], [1, 0.6, 0.55, 0.1]];

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
  'mast-gps-puck': {
    kind: 'drone-mast', realm: 'earth', label: 'GPS mast and puck', classOf: 'folding GPS mast',
    aliases: ['gps mast', 'gps puck'],
    dims: { diameter: 0.05, height: 0.07 }, mass: 0.03, mount: 'mast-socket',
    build: { family: 'gps' },
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
};
