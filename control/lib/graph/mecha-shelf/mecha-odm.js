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
 * A leg's bodies are drawn for the right side; the left's are the same rows built mirrored (the builder's `side`): a
 * part number names a design, not a hand. Generic parts of a generic machine: no maker's part number, model or name, and
 * no game's. Pure data.
 */

export const MECHA_KINDS = Object.freeze({
  'mecha-pelvis': 'the pelvis: the frame\'s root, its keel (the battery\'s case, low between the hips), its hip beams, the hip yaw bearings',
  'mecha-hip': 'a hip\'s yaw housing: its rotary drive turning the leg about the vertical, its roll clevis, its roll ram\'s arm',
  'mecha-yoke': 'a hip\'s roll yoke: its roll trunnion, the pitch axle the thigh turns on, the horn the hip ram drives',
  'mecha-thigh': 'a thigh: its box beam from the hip\'s pitch axle to the knee\'s clevis, its rams\' brackets',
  'mecha-shank': 'a shank: its box beam from the knee to the ankle\'s clevis, its knee horn, its ankle ram\'s bracket',
  'mecha-ankle': 'an ankle\'s cross: a universal joint, its pitch and its roll axes meeting, its roll drive, the ankle ram\'s horn',
  'mecha-foot': 'a foot: its plate, its rubber sole pads at the heel and the toe, its toe guard',
  'mecha-seat': 'the rider\'s place astride: the spine, the saddle and its tail, the tank and its knee grips and chest pad, the keel prow and its lamps, the dash, the clip-on bars, the pegs and the boarding step',
  'mecha-cage': 'the rider\'s cabin, open above as a convertible\'s: its tub\'s sides, its framed windshield, its roll hoop behind the saddle, its lamps',
  'mecha-pack': 'the power pack under the tail: the hydraulic power unit (its motor, its pump, its tank) and its cooler',
  'mecha-ram': 'a hydraulic ram across a joint: its barrel and its rod, each a body aimed at the other\'s pin',
});

const R = (kind, label, classOf, dims, mass, build, aliases = []) => Object.freeze({ kind, label, classOf, aliases, dims: Object.freeze(dims), mass, build: Object.freeze(build) });
const ATW = 'all-terrain walker';

export const MECHA_ODM = Object.freeze({
  // ── the all-terrain walker: a seat carried on two six-joint legs ────────────
  'pelvis-atw': R('mecha-pelvis', 'walker pelvis', ATW,
    { hipX: 0.4, keel: { w: 0.4, y0: -0.7, y1: 0.24, z0: -0.16, z1: 0.08 }, drum: { r: 0.11, z0: -0.02, z1: 0.1 }, seat: [0, 0, 0.08], cage: [0, 0, 0.08], pack: [0, -0.56, 0.08], battery: 105 },
    150, { family: 'keel' }, ['pelvis', 'hip frame', 'pelvis frame', 'keel', 'battery', 'battery pack']),
  'hip-atw': R('mecha-hip', 'hip yaw housing', ATW,
    { r: 0.095, drop: 0.1, rollRam: [0.22, 0, 0.08], stop: [-20, 20], torque: 900 },
    15, { family: 'yaw' }, ['hip yaw drive', 'yaw housing', 'hip housing', 'yaw drive']),
  'yoke-atw': R('mecha-yoke', 'hip roll yoke', ATW,
    { drop: 0.08, rollEye: [0.18, 0, -0.24], horn: [0, 0.08, 0] },
    9, { family: 'yoke' }, ['roll yoke', 'hip yoke', 'hip roll']),
  'thigh-atw': R('mecha-thigh', 'walker thigh', ATW,
    { length: 0.5, w: 0.12, d0: 0.16, d1: 0.12, hipRam: [0, 0.13, -0.42], kneeRam: [-0.11, -0.09, -0.08], clevis: 0.15 },
    20, { family: 'box' }, ['thigh', 'femur', 'upper leg']),
  'shank-atw': R('mecha-shank', 'walker shank', ATW,
    { length: 0.48, w: 0.11, d0: 0.14, d1: 0.1, kneeEye: [-0.11, -0.08, -0.09], ankleRam: [0, 0.105, -0.1], clevis: 0.12 },
    14, { family: 'box' }, ['shank', 'shin', 'tibia', 'lower leg']),
  'ankle-atw': R('mecha-ankle', 'ankle cross', ATW,
    { r: 0.05, horn: [0, 0.13, -0.04], stop: [-30, 30], torque: 700 },
    6, { family: 'cross' }, ['ankle', 'ankle cross', 'ankle joint', 'universal joint']),
  'foot-atw': R('mecha-foot', 'walker foot', ATW,
    { length: 0.46, w: 0.25, heel: 0.17, sole: 0.15, plate: 0.04, pad: 0.03 },
    13, { family: 'plate' }, ['foot', 'sole', 'foot plate']),
  // (the rider sits astride: a saddle on the spine, the tank before it to grip with the knees and lean onto, the pegs
  // set back under the hips, clip-on bars ahead and low; the prow ahead of it all, a keel)
  'seat-atw': R('mecha-seat', 'walker saddle', ATW,
    { sit: [0, -0.14, 0.34], grip: [0.25, 0.62, 0.41], peg: [0.245, -0.27, -0.07], step: [0.27, -0.21, -0.4] },
    30, { family: 'straddle' }, ['saddle', 'seat', 'tank', 'prow', 'keel prow', 'handlebars', 'clip-ons', 'footpegs']),
  // (round the rider, a convertible's cabin: the tub's sides, its beltline low beside the saddle, its windshield raked
  // over the dash, its roll hoop behind; open above)
  'cage-atw': R('mecha-cage', 'walker cabin', ATW,
    { tub: { x: 0.34, belt: 0.44, door: 0.1, side: [[-0.42, 0.12], [0.66, 0.12], [0.7, 0.46], [0.5, 0.5], [0.16, 0.44], [-0.12, 0.42], [-0.42, 0.46]] },
      shield: { x: 0.31, y0: 0.72, z0: 0.48, y1: 0.52, z1: 0.82 }, hoop: { x: 0.28, y: -0.5, top: 1.24 }, r: 0.022 },
    22, { family: 'convertible' }, ['cabin', 'cockpit', 'tub', 'windshield', 'windscreen', 'roll hoop', 'roll bar', 'rollover protection', 'cage']),
  'pack-atw': R('mecha-pack', 'walker power pack', ATW,
    { w: 0.44, d: 0.28, h: 0.24 },
    48, { family: 'hpu' }, ['power pack', 'hydraulic power unit', 'hpu', 'pump unit']),
  // (the rams: a hip's roll and pitch, a knee, an ankle, all at the system pressure)
  'ram-roll-atw': R('mecha-ram', 'hip roll ram', ATW, { bore: 0.05, rod: 0.028, closed: 0.308, stroke: 0.203 }, 4, { family: 'double' }, ['hip roll ram', 'roll ram', 'roll cylinder']),
  'ram-hip-atw': R('mecha-ram', 'hip pitch ram', ATW, { bore: 0.063, rod: 0.036, closed: 0.336, stroke: 0.201 }, 6, { family: 'double' }, ['hip ram', 'hip pitch ram', 'hip cylinder']),
  'ram-knee-atw': R('mecha-ram', 'knee ram', ATW, { bore: 0.063, rod: 0.036, closed: 0.313, stroke: 0.189 }, 7, { family: 'double' }, ['knee ram', 'knee cylinder', 'knee actuator']),
  'ram-ankle-atw': R('mecha-ram', 'ankle ram', ATW, { bore: 0.05, rod: 0.028, closed: 0.292, stroke: 0.175 }, 4, { family: 'double' }, ['ankle ram', 'ankle cylinder', 'ankle actuator']),
});
