/**
 * mecha-odm — the mecha shelf's inventory: one row per part, a part number (its sku) the layouts name.
 *
 * A row:
 *   kind     MECHA_KINDS: what it is, which builder draws it (mecha-parts.js)
 *   label    what it is called; aliases the words people say for it (findMechaPart)
 *   classOf  the frame it is made for
 *   dims     its numbers (metres): its pivots and the pins its rams meet it at, in its own frame; a ram's closed
 *            pin-to-pin length, its stroke, its bore and its rod; a rotary drive's stops (degrees) and its rated torque
 *   mass     kg; the laws place it where it is posed
 *   build    { family, … } the builder's own words
 *
 * A limb's bodies are drawn for the right side; the left's are the same rows built mirrored (the builder's `side`): a
 * part number names a design, not a hand. Generic parts of a generic machine: no maker's part number, model or name, and
 * no game's. Pure data.
 */

export const MECHA_KINDS = Object.freeze({
  'mecha-pelvis': 'the pelvis: the frame\'s root, its keel (the battery\'s case, low between the hips), its hip beams, the hip yaw bearings',
  'mecha-hip': 'a hip\'s yaw housing: its rotary drive turning the leg about the vertical, its roll clevis, its roll ram\'s arm',
  'mecha-yoke': 'a hip\'s roll yoke: its roll trunnion, the pitch axle the thigh turns on, the horn the hip ram drives',
  'mecha-thigh': 'a thigh: its box beam from the hip\'s pitch axle to the knee\'s clevis, its rams\' brackets',
  'mecha-shank': 'a shank: its box beam from the knee to the ankle\'s clevis, its knee horn, its ankle ram\'s bracket behind',
  'mecha-ankle': 'an ankle\'s cross: a universal joint, its pitch and its roll axes meeting, its roll drive, the ankle ram\'s heel horn',
  'mecha-foot': 'a foot: its plate, its rubber sole pads at the heel and the toe, its toe guard',
  'mecha-seat': 'the rider\'s place: astride, the spine, the saddle and its tail, the tank and its knee grips and chest pad, the nose and its lamps, the clip-on bars, the pegs and the boarding step',
  'mecha-cage': 'the rider\'s cabin, open above as a convertible\'s (its tub\'s sides, its framed windshield, its roll hoop behind the saddle, its lamps), or a torso frame round a standing operator (its posts, its shoulders, its hoop)',
  'mecha-pack': 'the power pack under the tail: the hydraulic power unit (its motor, its pump, its tank) and its cooler',
  'mecha-shoulder': 'an arm\'s shoulder: its yaw drive on the torso, its pitch clevis, the horn its shoulder ram drives',
  'mecha-upperarm': 'an upper arm: its box beam from the shoulder\'s axle to the elbow\'s clevis, its rams\' brackets',
  'mecha-forearm': 'a forearm: its box beam from the elbow to the wrist, its elbow horn',
  'mecha-wrist': 'a wrist: its rotary drive turning the hand about the forearm\'s end',
  'mecha-claw': 'a hand: a two-fingered claw, its palm, its fingers and their pads',
  'mecha-ram': 'a hydraulic ram across a joint: its barrel and its rod, each a body aimed at the other\'s pin',
});

const R = (kind, label, classOf, dims, mass, build, aliases = []) => Object.freeze({ kind, label, classOf, aliases, dims: Object.freeze(dims), mass, build: Object.freeze(build) });
const ATW = 'all-terrain walker';
const UW = 'utility walker';

export const MECHA_ODM = Object.freeze({
  // ── the all-terrain walker: a seat carried on two six-joint legs ────────────
  'pelvis-atw': R('mecha-pelvis', 'walker pelvis', ATW,
    { hipX: 0.4, keel: { w: 0.4, y0: -0.7, y1: 0.24, z0: -0.16, z1: 0.08 }, drum: { r: 0.11, z0: -0.02, z1: 0.1 }, seat: [0, 0, 0.08], cage: [0, 0, 0.08], pack: [0, -0.56, 0.08], battery: 105 },
    150, { family: 'keel' }, ['pelvis', 'hip frame', 'pelvis frame', 'keel', 'battery', 'battery pack']),
  'hip-atw': R('mecha-hip', 'hip yaw housing', ATW,
    { r: 0.095, drop: 0.1, rollRam: [0.22, 0, 0.08], stop: [-20, 20], torque: 900 },
    15, { family: 'yaw' }, ['hip yaw drive', 'yaw housing', 'hip housing', 'yaw drive']),
  'yoke-atw': R('mecha-yoke', 'hip roll yoke', ATW,
    { drop: 0.08, rollEye: [0.18, 0, -0.24], horn: [0, -0.08, 0] },
    9, { family: 'yoke' }, ['roll yoke', 'hip yoke', 'hip roll']),
  'thigh-atw': R('mecha-thigh', 'walker thigh', ATW,
    { length: 0.5, w: 0.12, d0: 0.16, d1: 0.12, hipRam: [0, -0.13, -0.42], kneeRam: [-0.11, 0.09, -0.08], clevis: 0.15 },
    20, { family: 'box' }, ['thigh', 'femur', 'upper leg']),
  'shank-atw': R('mecha-shank', 'walker shank', ATW,
    { length: 0.48, w: 0.11, d0: 0.14, d1: 0.1, kneeEye: [-0.11, 0.08, -0.09], ankleRam: [0, -0.12, -0.12], clevis: 0.12 },
    14, { family: 'box' }, ['shank', 'shin', 'tibia', 'lower leg']),
  'ankle-atw': R('mecha-ankle', 'ankle cross', ATW,
    { r: 0.05, horn: [0, -0.09, -0.08], stop: [-30, 30], torque: 700 },
    6, { family: 'cross' }, ['ankle', 'ankle cross', 'ankle joint', 'universal joint']),
  'foot-atw': R('mecha-foot', 'walker foot', ATW,
    { length: 0.46, w: 0.25, heel: 0.17, sole: 0.15, plate: 0.04, pad: 0.03 },
    13, { family: 'plate' }, ['foot', 'sole', 'foot plate']),
  // (the rider sits astride: a saddle on the spine, the tank before it to grip with the knees and lean onto, the pegs
  // set back under the hips, clip-on bars ahead and low; the nose ahead of it all, one shape from the cabin to its edge)
  'seat-atw': R('mecha-seat', 'walker saddle', ATW,
    { sit: [0, -0.14, 0.34], grip: [0.25, 0.62, 0.41], peg: [0.245, -0.27, -0.07], step: [0.27, -0.21, -0.4] },
    30, { family: 'straddle' }, ['saddle', 'seat', 'tank', 'nose', 'nose cone', 'handlebars', 'clip-ons', 'footpegs']),
  // (round the rider, a convertible's cabin: the tub's sides, its beltline low beside the saddle, its windshield raked
  // over the dash, its roll hoop behind; open above)
  'cage-atw': R('mecha-cage', 'walker cabin', ATW,
    { tub: { x: 0.34, belt: 0.44, door: 0.1, side: [[-0.42, 0.12], [0.68, 0.12], [0.68, 0.48], [0.5, 0.5], [0.16, 0.44], [-0.12, 0.42], [-0.42, 0.46]] },
      shield: { x: 0.31, y0: 0.72, z0: 0.48, y1: 0.52, z1: 0.82 }, hoop: { x: 0.28, y: -0.5, top: 1.24 }, r: 0.022 },
    22, { family: 'convertible' }, ['cabin', 'cockpit', 'tub', 'windshield', 'windscreen', 'roll hoop', 'roll bar', 'rollover protection', 'cage']),
  'pack-atw': R('mecha-pack', 'walker power pack', ATW,
    { w: 0.44, d: 0.28, h: 0.24 },
    48, { family: 'hpu' }, ['power pack', 'hydraulic power unit', 'hpu', 'pump unit']),
  // (the rams: a hip's roll and pitch, a knee, an ankle, all at the system pressure)
  'ram-roll-atw': R('mecha-ram', 'hip roll ram', ATW, { bore: 0.05, rod: 0.028, closed: 0.308, stroke: 0.203 }, 4, { family: 'double' }, ['hip roll ram', 'roll ram', 'roll cylinder']),
  'ram-hip-atw': R('mecha-ram', 'hip pitch ram', ATW, { bore: 0.063, rod: 0.036, closed: 0.336, stroke: 0.201 }, 6, { family: 'double' }, ['hip ram', 'hip pitch ram', 'hip cylinder']),
  'ram-knee-atw': R('mecha-ram', 'knee ram', ATW, { bore: 0.063, rod: 0.036, closed: 0.313, stroke: 0.189 }, 7, { family: 'double' }, ['knee ram', 'knee cylinder', 'knee actuator']),
  'ram-ankle-atw': R('mecha-ram', 'ankle ram', ATW, { bore: 0.05, rod: 0.028, closed: 0.285, stroke: 0.176 }, 4, { family: 'double' }, ['ankle ram', 'ankle cylinder', 'ankle actuator']),
  // ── the utility walker: an operator standing in a torso frame on two forward-kneed legs, two arms for the work ─────
  // (its legs the walker's with the knee forward: the rams in front of the thigh and behind it as a human's muscles lie,
  // bored up for the heavier frame; its foot larger, for its weight and its load)
  'pelvis-uw': R('mecha-pelvis', 'utility walker pelvis', UW,
    { hipX: 0.4, keel: { w: 0.44, y0: -0.4, y1: 0.36, z0: -0.18, z1: 0.08 }, drum: { r: 0.12, z0: -0.02, z1: 0.1 }, seat: [0, 0, 0.08], cage: [0, 0, 0.08], pack: [0, -0.5, 0.86], battery: 140 },
    185, { family: 'keel' }, ['work pelvis']),
  'hip-uw': R('mecha-hip', 'utility hip yaw housing', UW, { r: 0.105, drop: 0.1, rollRam: [0.22, 0, 0.08], stop: [-20, 20], torque: 1400 }, 18, { family: 'yaw' }, ['work hip']),
  'yoke-uw': R('mecha-yoke', 'utility hip roll yoke', UW, { drop: 0.08, rollEye: [0.18, 0, -0.24], horn: [0, 0.08, 0] }, 11, { family: 'yoke' }, ['work yoke']),
  'thigh-uw': R('mecha-thigh', 'utility thigh', UW, { length: 0.5, w: 0.13, d0: 0.17, d1: 0.13, hipRam: [0, 0.13, -0.42], kneeRam: [-0.12, -0.09, -0.08], clevis: 0.15 }, 24, { family: 'box' }, ['work thigh']),
  'shank-uw': R('mecha-shank', 'utility shank', UW, { length: 0.48, w: 0.12, d0: 0.15, d1: 0.11, kneeEye: [-0.12, -0.08, -0.09], ankleRam: [0, 0.105, -0.1], clevis: 0.12 }, 17, { family: 'box' }, ['work shank']),
  'ankle-uw': R('mecha-ankle', 'utility ankle cross', UW, { r: 0.055, horn: [0, 0.13, -0.04], stop: [-30, 30], torque: 1100 }, 7, { family: 'cross' }, ['work ankle']),
  'foot-uw': R('mecha-foot', 'utility foot', UW, { length: 0.52, w: 0.3, heel: 0.19, sole: 0.15, plate: 0.04, pad: 0.03 }, 18, { family: 'plate' }, ['work foot']),
  'ram-roll-uw': R('mecha-ram', 'utility hip roll ram', UW, { bore: 0.063, rod: 0.036, closed: 0.308, stroke: 0.203 }, 6, { family: 'double' }, ['work roll ram']),
  'ram-hip-uw': R('mecha-ram', 'utility hip pitch ram', UW, { bore: 0.08, rod: 0.045, closed: 0.336, stroke: 0.201 }, 9, { family: 'double' }, ['work hip ram']),
  'ram-knee-uw': R('mecha-ram', 'utility knee ram', UW, { bore: 0.08, rod: 0.045, closed: 0.313, stroke: 0.189 }, 9, { family: 'double' }, ['work knee ram']),
  'ram-ankle-uw': R('mecha-ram', 'utility ankle ram', UW, { bore: 0.063, rod: 0.036, closed: 0.292, stroke: 0.175 }, 6, { family: 'double' }, ['work ankle ram']),
  // (the operator stands on a platform over the pelvis, leaning back on a hip pad, a guardrail ahead at the waist, the
  // arms worked from a console at each hand)
  'platform-uw': R('mecha-seat', 'operator platform', UW,
    { plate: { x: 0.3, y0: -0.3, y1: 0.34, z: 0.06 }, sit: [0, -0.2, 0.8], grip: [0.25, 0.3, 1.02], peg: [0.12, 0.02, 0.07], step: [0.2, -0.36, -0.42], rung: -0.16, rail: 1.08 },
    34, { family: 'standing' }, ['operator platform', 'platform', 'hip pad', 'guardrail', 'consoles']),
  'torso-uw': R('mecha-cage', 'utility torso frame', UW,
    { post: { x: 0.36, y: -0.06 }, shoulder: [0.52, 0.02, 1.4], top: 1.98, r: 0.028, pack: { y: -0.36, z: [0.84, 1.16] } },
    58, { family: 'torso' }, ['torso', 'torso frame', 'operator cage', 'shoulder beam']),
  'pack-uw': R('mecha-pack', 'utility power pack', UW, { w: 0.5, d: 0.26, h: 0.42 }, 62, { family: 'hpu' }, ['work power pack', 'backpack']),
  // (the arms: a shoulder's yaw on the torso, its pitch and the elbow on rams, a rotary wrist, a two-fingered claw)
  'shoulder-uw': R('mecha-shoulder', 'utility shoulder', UW, { r: 0.09, drop: 0.0, horn: [0.11, 0.1, 0.04], stop: [-25, 40], torque: 1200 }, 16, { family: 'yaw' }, ['shoulder', 'shoulder drive', 'shoulder housing']),
  'upperarm-uw': R('mecha-upperarm', 'utility upper arm', UW, { length: 0.55, w: 0.11, d0: 0.15, d1: 0.12, shoulderRam: [0.11, -0.12, -0.44], elbowRam: [-0.11, -0.08, -0.12], clevis: 0.13 }, 17, { family: 'box' }, ['upper arm', 'arm', 'boom arm']),
  'forearm-uw': R('mecha-forearm', 'utility forearm', UW, { length: 0.52, w: 0.1, d0: 0.13, d1: 0.1, elbowEye: [-0.11, 0.08, -0.08] }, 13, { family: 'box' }, ['forearm', 'lower arm']),
  'wrist-uw': R('mecha-wrist', 'utility wrist', UW, { r: 0.06, drop: 0.1, stop: [-110, 110], torque: 600 }, 6, { family: 'rotary' }, ['wrist', 'wrist drive']),
  'claw-uw': R('mecha-claw', 'utility claw', UW, { w: 0.2, finger: 0.24, gap: 0.24 }, 12, { family: 'twin' }, ['claw', 'gripper', 'hand', 'grabber']),
  'ram-shoulder-uw': R('mecha-ram', 'shoulder ram', UW, { bore: 0.063, rod: 0.036, closed: 0.352, stroke: 0.203 }, 6, { family: 'double' }, ['shoulder ram', 'arm lift ram', 'shoulder cylinder']),
  'ram-elbow-uw': R('mecha-ram', 'elbow ram', UW, { bore: 0.063, rod: 0.036, closed: 0.335, stroke: 0.197 }, 6, { family: 'double' }, ['elbow ram', 'elbow cylinder']),
});
