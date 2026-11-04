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
 * part number names a design, not a hand. A part at another size is another row's design scaled (its `dims.scale`),
 * drawn at the design's size and scaled whole. Generic parts of a generic machine: no maker's part number, model or name, and
 * no game's. Pure data.
 */

import { MAKER_PARTS, MECHA_MAKER_IDS, makerRows } from './mecha-gap-makers.js';

export const MECHA_KINDS = Object.freeze({
  'mecha-pelvis': 'the pelvis: the frame\'s root, its keel (the battery\'s case, low between the hips), its hip beams, the hip yaw bearings',
  'mecha-hip': 'a hip\'s yaw housing: its rotary drive turning the leg about the vertical, its roll clevis, its roll ram\'s arm',
  'mecha-yoke': 'a hip\'s roll yoke: its roll trunnion, the pitch axle the thigh turns on, the horn the hip ram drives',
  'mecha-thigh': 'a thigh: its box beam from the hip\'s pitch axle to the knee\'s clevis, its rams\' brackets',
  'mecha-shank': 'a shank: its box beam from the knee to the ankle\'s clevis, its knee horn, its ankle ram\'s bracket behind',
  'mecha-ankle': 'an ankle\'s cross: a universal joint, its pitch and its roll axes meeting, its roll drive, the ankle ram\'s heel horn',
  'mecha-foot': 'a foot: its plate, its rubber sole pads at the heel and the toe, its toe guard',
  'mecha-toe': 'a segment of a clawed foot\'s toe: its knuckle drive, its armour, its pad, at its tip its claw',
  'mecha-seat': 'the rider\'s place: astride, the spine, the saddle and its tail, the tank and its knee grips and chest pad, the nose and its lamps, the clip-on bars, the pegs and the boarding step; or seated at the controls, a platform, its work seat and belt, its consoles, its pedals, its rail and its steps',
  'mecha-cage': 'the rider\'s cabin, open above as a convertible\'s (its tub\'s sides, its framed windshield, its roll hoop behind the saddle, its lamps), or a torso frame round a seated operator (its posts, its shoulders, its hoop), or a closed cab (its falling-object roof on four pillars, its glass and its guard bars, its door)',
  'mecha-pack': 'the power pack under the tail: the hydraulic power unit (its motor, its pump, its tank) and its cooler; or a giant arm pack, its frame, its power unit and its towers up to its arms\' shoulders',
  'mecha-shoulder': 'an arm\'s shoulder: its yaw drive on the torso, its pitch clevis, the horn its shoulder ram drives; a giant arm\'s armoured over it',
  'mecha-upperarm': 'an upper arm: its box beam from the shoulder\'s axle to the elbow\'s clevis, its rams\' brackets',
  'mecha-forearm': 'a forearm: its box beam from the elbow to the wrist, its elbow horn',
  'mecha-wrist': 'a wrist: its rotary drive turning the hand about the forearm\'s end',
  'mecha-claw': 'a hand: a two-fingered claw, its palm, its fingers and their pads',
  'mecha-tool': 'a tool on an arm\'s quick coupler in a claw\'s place: a bucket, a breaker, a crusher, forks, an auger, a vacuum lifter, a magnet, a hook; on a giant arm, a hand, a spreader, a prop, a shear, a vibratory driver, a clamshell',
  'mecha-mount': 'a payload\'s mount on a backpack: its traverse ring and yoke, or its elevation cradle and tray',
  'mecha-weapon': 'a backpack\'s payload on its cradle (a gun and its ammunition box, a launcher and its pod; a sensor mast, a drone launcher, a smoke discharger, a cargo carrier, a winch), or a spare magazine in its rack',
  'mecha-tail': 'a backpack\'s service tail: its yaw drum, its armoured segments, its gripping head',
  'mecha-wheel': 'a wheel a legged frame rolls on with its legs collapsed: its knobbed tyre, its rim, its hub motor',
  'mecha-ram': 'a hydraulic ram across a joint: its barrel and its rod, each a body aimed at the other\'s pin; or an electric screw actuator in its place',
});

const R = (kind, label, classOf, dims, mass, build, aliases = []) => Object.freeze({ kind, label, classOf, aliases, dims: Object.freeze(dims), mass, build: Object.freeze(build) });
const ATW = 'all-terrain walker';
const UW = 'utility walker';
const HW = 'heavy walker';
const GW = 'giant arm walker';

// (what a part's size does not scale: its stops' angles, the battery's mass, the scale itself; a rotary drive's torque
// is rated again for its size, a screw actuator's force is its own rating)
export const UNSCALED = Object.freeze(['stop', 'torque', 'force', 'battery', 'scale']);
/** Every length in a part's numbers times k (its angles and its ratings as they are). */
export function scaleDims(d, k) {
  if (Array.isArray(d)) return d.map((v) => scaleDims(v, k));
  if (d && typeof d === 'object') return Object.fromEntries(Object.entries(d).map(([key, v]) => [key, UNSCALED.includes(key) ? v : scaleDims(v, k)]));
  return typeof d === 'number' ? Math.round(d * k * 10000) / 10000 : d;
}
/** A part at another size (`from`, the row it is drawn from): another row's design at `k` times its lengths (its mass at k³, a drive's rated torque at k⁴:
 *  its load's weight and its lever both grown), its `dims` in true metres; `scale` says the design it was drawn from. */
const S = (base, k, label, classOf, aliases, over = {}) => {
  const b = BASE[base], dims = { ...scaleDims(b.dims, k), ...over, scale: k };
  if (Number.isFinite(b.dims.torque) && over.torque === undefined) dims.torque = Math.round(b.dims.torque * k ** 4);
  return Object.freeze({ ...b, label, classOf, aliases, from: base, dims: Object.freeze(dims), mass: Math.round(b.mass * k ** 3) });
};
let BASE = null;

const ROWS = {
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
  // ── the utility walker: an operator seated in a torso frame on two forward-kneed legs, two arms for the work ──────
  // (its legs the walker's with the knee forward: the rams in front of the thigh and behind it as a human's muscles lie,
  // bored up for the heavier frame; its foot larger, for its weight and its load)
  'pelvis-uw': R('mecha-pelvis', 'utility walker pelvis', UW,
    { hipX: 0.4, keel: { w: 0.44, y0: -0.4, y1: 0.36, z0: -0.18, z1: 0.08 }, drum: { r: 0.12, z0: -0.02, z1: 0.1 }, seat: [0, 0, 0.08], cage: [0, 0, 0.08], pack: [0, -0.54, 0.62], battery: 140 },
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
  // (the operator sits at the controls: a suspension work seat on the platform over the pelvis, its belt, a console on
  // each armrest working the arms, pedals at the feet for the walking, a rail round it at the waist)
  'platform-uw': R('mecha-seat', 'operator station', UW,
    { plate: { x: 0.3, y0: -0.34, y1: 0.42, z: 0.06 }, sit: [0, -0.04, 0.52], back: 0.6, grip: [0.27, 0.2, 0.74], peg: [0.13, 0.36, 0.07], step: [0.2, -0.4, -0.42], rung: -0.16, rail: 0.98 },
    46, { family: 'seated' }, ['operator station', 'operator seat', 'work seat', 'suspension seat', 'consoles', 'joysticks']),
  'torso-uw': R('mecha-cage', 'utility torso frame', UW,
    { post: { x: 0.36, y: -0.12 }, shoulder: [0.52, 0.02, 1.14], top: 1.66, r: 0.028, pack: { y: -0.4, z: [0.6, 0.92] } },
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
};
BASE = ROWS;

// ── the heavy walker: the utility walker's frame drawn larger for heavy construction, its operator in a closed cab ───
// (its legs, its pelvis and its arms the utility walker's designs at 1.4 times their lengths: its rams and their arcs
// with them; its feet at 1.6, for its weight on soft ground; its power pack at 1.5, a counterweight to its arms)
const K = 1.4;
const HEAVY = {
  'pelvis-hw': S('pelvis-uw', K, 'heavy walker pelvis', HW, ['heavy pelvis']),
  'hip-hw': S('hip-uw', K, 'heavy hip yaw housing', HW, ['heavy hip']),
  'yoke-hw': S('yoke-uw', K, 'heavy hip roll yoke', HW, ['heavy yoke']),
  'thigh-hw': S('thigh-uw', K, 'heavy thigh', HW, ['heavy thigh']),
  'shank-hw': S('shank-uw', K, 'heavy shank', HW, ['heavy shank']),
  'ankle-hw': S('ankle-uw', K, 'heavy ankle cross', HW, ['heavy ankle']),
  'foot-hw': S('foot-uw', 1.6, 'heavy foot', HW, ['heavy foot', 'heavy sole', 'track pad']),
  // (its hip roll ram bored up past its design's: on one foot it holds the frame's sway with its heaviest tools on)
  'ram-roll-hw': S('ram-roll-uw', K, 'heavy hip roll ram', HW, ['heavy roll ram'], { bore: 0.1, rod: 0.056 }),
  'ram-hip-hw': S('ram-hip-uw', K, 'heavy hip pitch ram', HW, ['heavy hip ram']),
  'ram-knee-hw': S('ram-knee-uw', K, 'heavy knee ram', HW, ['heavy knee ram']),
  'ram-ankle-hw': S('ram-ankle-uw', K, 'heavy ankle ram', HW, ['heavy ankle ram']),
  // (its pump's flow shared by the arms' tools, l/min: a breaker's hammer, an auger's motor, a crusher's jaws)
  'pack-hw': S('pack-uw', 1.5, 'heavy power pack', HW, ['heavy power pack', 'counterweight pack'], { flow: 110 }),
  'shoulder-hw': S('shoulder-uw', K, 'heavy shoulder', HW, ['heavy shoulder']),
  'upperarm-hw': S('upperarm-uw', K, 'heavy upper arm', HW, ['heavy upper arm', 'heavy arm']),
  'forearm-hw': S('forearm-uw', K, 'heavy forearm', HW, ['heavy forearm']),
  // (its wrist a heavy-duty rotary actuator, rated past its design's: the tools hang their whole weight off it)
  'wrist-hw': S('wrist-uw', K, 'heavy wrist', HW, ['heavy wrist'], { torque: 6000 }),
  'claw-hw': S('claw-uw', K, 'heavy grapple', HW, ['grapple', 'heavy claw', 'heavy gripper', 'grab']),
  // (a long-reach arm: the forearm drawn a third longer on the same elbow, its wrist farther out; reach traded for lift)
  'forearm-hw-long': S('forearm-uw', K, 'heavy long-reach forearm', HW, ['long forearm', 'long reach forearm', 'extended forearm'], { length: 0.97 }),
  'ram-shoulder-hw': S('ram-shoulder-uw', K, 'heavy shoulder ram', HW, ['heavy shoulder ram']),
  'ram-elbow-hw': S('ram-elbow-uw', K, 'heavy elbow ram', HW, ['heavy elbow ram']),
  // (the tools on an arm's quick coupler, each at its own size: what each is for, what it weighs and holds, and the
  // flow it draws, are its card's: mecha-tools.js)
  'bucket-hw': R('mecha-tool', 'heavy walker bucket', HW, { w: 0.46, depth: 0.36, length: 0.5, teeth: 5 }, 75, { family: 'bucket' }, ['bucket', 'digging bucket', 'trenching bucket']),
  'breaker-hw': R('mecha-tool', 'heavy walker breaker', HW, { w: 0.2, body: 0.68, length: 0.98 }, 120, { family: 'breaker' }, ['breaker', 'hydraulic breaker', 'hammer', 'rock breaker', 'jackhammer']),
  'crusher-hw': R('mecha-tool', 'heavy walker crusher', HW, { w: 0.2, gap: 0.34, length: 0.66 }, 100, { family: 'crusher' }, ['crusher', 'concrete crusher', 'demolition jaws', 'pulveriser', 'shear']),
  'forks-hw': R('mecha-tool', 'heavy walker forks', HW, { w: 0.42, spread: 0.34, length: 0.82 }, 55, { family: 'forks' }, ['forks', 'pallet forks', 'fork tines']),
  'auger-hw': R('mecha-tool', 'heavy walker auger', HW, { r: 0.13, length: 1.15 }, 90, { family: 'auger' }, ['auger', 'earth drill', 'post hole auger', 'drill']),
  'vacuum-hw': R('mecha-tool', 'heavy walker vacuum lifter', HW, { w: 0.62, d: 0.42, length: 0.32 }, 45, { family: 'vacuum' }, ['vacuum lifter', 'suction pad', 'glass lifter', 'panel lifter']),
  'magnet-hw': R('mecha-tool', 'heavy walker magnet', HW, { r: 0.28, length: 0.42 }, 95, { family: 'magnet' }, ['magnet', 'lifting magnet', 'electromagnet']),
  'hook-hw': R('mecha-tool', 'heavy walker hook', HW, { length: 0.4 }, 18, { family: 'hook' }, ['hook', 'lifting hook', 'crane hook']),
  // (the operator stays a person's size: the work seat in its harness, its consoles, an emergency stop at the right
  // hand, the pedals; a side ladder up to the cab's door)
  'station-hw': R('mecha-seat', 'heavy operator station', HW,
    { plate: { x: 0.3, y0: -0.34, y1: 0.42, z: 0.06 }, sit: [0, -0.04, 0.52], back: 0.6, grip: [0.27, 0.2, 0.74], peg: [0.13, 0.36, 0.07], side: 'l', step: [0.5, 0.1, -0.86], rungs: [-0.86, -0.6, -0.34, -0.08], harness: true, estop: true },
    52, { family: 'seated' }, ['heavy operator seat', 'harness seat', 'emergency stop']),
  // (the cab round the operator: an angled shell, its windshield raked back under a visor, its sides drawn in to the
  // roof, framed glass all round, guard bars along the windshield's rake, a falling-object roof, a door on the left, the
  // shoulders carried out from its sides)
  'cab-hw': R('mecha-cage', 'heavy walker cab', HW,
    { base: { x: 0.46, y0: -0.47, y1: 0.58 }, belt: { z: 0.62, x: 0.46, y0: -0.47, y1: 0.66 }, roof: { z: 1.62, x: 0.4, y0: -0.4, y1: 0.41 }, z0: 0.02, visor: 0.12,
      post: 0.06, door: [-0.14, 0.4], lowerWindow: [0.4, 0.86], shoulder: [0.73, 0.02, 1.14], mount: 1.44, pack: { y: -0.6, z: [0.62, 1.12] } },
    360, { family: 'cab' }, ['cab', 'operator cab', 'protective cab', 'closed cab', 'falling object guard', 'front guard']),
};
BASE = { ...ROWS, ...HEAVY };

// ── the giant arm walker: a frame built to carry a giant arm pack on its back ────────────────────────────────────
// (its pelvis and its legs the utility walker's designs at 1.6 times, more robust than the heavy walker's: their rams
// with them, the hip's roll ram and the knee's bored up past their design's; its feet at 2.2, for its weight with the
// pack's on soft ground)
const G = 1.6, GA = 2;
/** A scaled row with another builder's family (a design drawn larger, and dressed by its own builder). */
const dressed = (row, family, over = {}) => Object.freeze({ ...row, build: Object.freeze({ ...row.build, family }), dims: Object.freeze({ ...row.dims, ...over }) });
const GIANT = {
  'pelvis-gw': S('pelvis-uw', G, 'giant arm walker pelvis', GW, ['giant pelvis', 'robust pelvis']),
  'hip-gw': S('hip-uw', G, 'giant arm walker hip yaw housing', GW, ['giant hip']),
  'yoke-gw': S('yoke-uw', G, 'giant arm walker hip roll yoke', GW, ['giant yoke']),
  'thigh-gw': S('thigh-uw', G, 'giant arm walker thigh', GW, ['giant thigh', 'robust thigh']),
  'shank-gw': S('shank-uw', G, 'giant arm walker shank', GW, ['giant shank', 'robust shank']),
  'ankle-gw': S('ankle-uw', G, 'giant arm walker ankle cross', GW, ['giant ankle']),
  'foot-gw': S('foot-uw', 2.2, 'giant arm walker foot', GW, ['giant foot', 'giant sole']),
  'ram-roll-gw': S('ram-roll-uw', G, 'giant arm walker hip roll ram', GW, ['giant roll ram'], { bore: 0.145, rod: 0.08 }),
  'ram-hip-gw': S('ram-hip-uw', G, 'giant arm walker hip pitch ram', GW, ['giant hip ram']),
  // (its knee rams bored up past their design's too: the crouch holds the frame and its pack on them)
  'ram-knee-gw': S('ram-knee-uw', G, 'giant arm walker knee ram', GW, ['giant knee ram'], { bore: 0.145, rod: 0.08 }),
  'ram-ankle-gw': S('ram-ankle-uw', G, 'giant arm walker ankle ram', GW, ['giant ankle ram']),
  // (its station the heavy walker's, its side ladder longer for the taller frame)
  'station-gw': R('mecha-seat', 'giant arm walker operator station', GW,
    { ...BASE['station-hw'].dims, step: [0.5, 0.1, -1.1], rungs: [-1.1, -0.84, -0.58, -0.32] },
    56, { family: 'seated' }, ['giant operator seat']),
  // (the giant arm pack on its back: a frame behind the cab, its own power unit and cooler, two towers up to the giant
  // arms' shoulders over the cab's roof; its pump feeds every arm's tools)
  'gap-gw': R('mecha-pack', 'giant arm pack', GW,
    { w: 0.9, d: 0.5, h: 0.62, tower: { x: 0.98, y: 0.42, z: 1.0, w: 0.22 }, shoulder: [1.06, 0.42, 1.06], flow: 240 },
    620, { family: 'giant' }, ['giant arm pack', 'giant arm backpack', 'gap', 'gau pack', 'arm pack', 'backpack arms']),
  // (the giant arms: the utility walker's arm drawn twice as large; their shoulders armoured blocks over the pack's
  // towers; their wrists heavy-duty rotary actuators; their hands three-fingered)
  'shoulder-gw': dressed(S('shoulder-uw', GA, 'giant arm shoulder', GW, ['giant shoulder', 'armoured shoulder']), 'armoured', { block: [0.62, 0.7, 0.5] }),
  'upperarm-gw': S('upperarm-uw', GA, 'giant upper arm', GW, ['giant upper arm', 'giant arm']),
  'forearm-gw': S('forearm-uw', GA, 'giant forearm', GW, ['giant forearm']),
  'wrist-gw': S('wrist-uw', GA, 'giant wrist', GW, ['giant wrist'], { torque: 30000 }),
  'ram-shoulder-gw': S('ram-shoulder-uw', GA, 'giant shoulder ram', GW, ['giant shoulder ram']),
  'ram-elbow-gw': S('ram-elbow-uw', GA, 'giant elbow ram', GW, ['giant elbow ram']),
  // (the giant arms' tools, on their own larger coupler)
  'hand-gw': R('mecha-tool', 'giant hand', GW, { palm: [0.36, 0.3, 0.26], finger: 0.42, thumb: 0.34, r: 0.05 }, 210, { family: 'hand' }, ['giant hand', 'three fingered hand', 'manipulator hand', 'big hand']),
  'grapple-gw': S('claw-uw', GA, 'giant grapple', GW, ['giant grapple', 'giant claw']),
  'spreader-gw': R('mecha-tool', 'giant rescue spreader', GW, { w: 0.3, arm: 0.9, open: 0.34 }, 240, { family: 'spreader' }, ['rescue spreader', 'spreader', 'jaws of life', 'hydraulic spreader']),
  'prop-gw': R('mecha-tool', 'giant shoring prop', GW, { r: 0.09, length: 1.5, pad: [0.5, 0.36] }, 170, { family: 'prop' }, ['shoring prop', 'prop', 'shoring jack', 'support jack']),
  'shear-gw': R('mecha-tool', 'giant shear', GW, { w: 0.26, length: 1.0, gap: 0.5 }, 320, { family: 'shear' }, ['tree shear', 'giant shear', 'steel shear', 'felling head']),
  'vibro-gw': R('mecha-tool', 'giant vibratory driver', GW, { w: 0.5, d: 0.4, h: 0.62, jaw: 0.3 }, 380, { family: 'vibro' }, ['vibratory hammer', 'pile driver', 'vibro hammer', 'vibratory driver']),
  'clamshell-gw': R('mecha-tool', 'giant clamshell', GW, { w: 0.7, r: 0.42, length: 0.95 }, 300, { family: 'clamshell' }, ['clamshell', 'clamshell grab', 'grab bucket', 'orange peel']),
  'hook-gw': S('hook-hw', G, 'giant hook', GW, ['giant hook', 'heavy lifting hook']),
};
// ── the field walker: the all-terrain walker's frame hardened for rugged ground, a military all-terrain transport ──
// (its pelvis and its legs the walker's designs at 1.2 times, for the clearance and the step rough ground asks; its
// beams guarded, its belly under a skid plate, its feet at 1.5 and cleated; its rider's saddle and cabin a person's
// size, the cabin behind a brush guard; its power pack in a cargo rack. Unarmed: a transport)
const KF = 1.2, FW = 'field walker';
const FIELD = {
  'pelvis-fw': dressed(S('pelvis-atw', KF, 'field walker pelvis', FW, ['armoured pelvis', 'skid plate', 'belly plate', 'recovery points']), 'armoured'),
  'hip-fw': S('hip-atw', KF, 'field walker hip yaw housing', FW, ['field hip']),
  'yoke-fw': S('yoke-atw', KF, 'field walker hip roll yoke', FW, ['field yoke']),
  'thigh-fw': dressed(S('thigh-atw', KF, 'field walker thigh', FW, ['guarded thigh', 'field thigh']), 'guarded'),
  'shank-fw': dressed(S('shank-atw', KF, 'field walker shank', FW, ['guarded shank', 'field shank', 'shin guard']), 'guarded'),
  'ankle-fw': S('ankle-atw', KF, 'field walker ankle cross', FW, ['field ankle']),
  'foot-fw': dressed(S('foot-atw', 1.5, 'field walker foot', FW, ['lugged foot', 'cleated foot', 'field foot', 'cleated sole']), 'lugged'),
  'ram-roll-fw': S('ram-roll-atw', KF, 'field walker hip roll ram', FW, ['field roll ram']),
  'ram-hip-fw': S('ram-hip-atw', KF, 'field walker hip pitch ram', FW, ['field hip ram']),
  'ram-knee-fw': S('ram-knee-atw', KF, 'field walker knee ram', FW, ['field knee ram']),
  'ram-ankle-fw': S('ram-ankle-atw', KF, 'field walker ankle ram', FW, ['field ankle ram']),
  // (the walker's cabin behind a brush guard round its nose, a second bar across its hoop; where its field kit is
  // fitted: its pioneer tools down the left of the tub, its antenna on the hoop, its number each side)
  'cage-fw': R('mecha-cage', 'field walker cabin', FW,
    { ...BASE['cage-atw'].dims, guard: { x: 0.3, y0: 0.62, y1: 1.18, z0: 0.12, z1: 0.46 }, kit: { tools: [0.352, 0.08, 0.27], antenna: [0.3, -0.52, 0.72], mark: [0.348, 0.42, 0.3] } },
    28, { family: 'field' }, ['field cabin', 'brush guard', 'bull bar', 'grille guard', 'field cage']),
  // (the closed armoured cabin, an option in the open cabin's place: a shell of plates round the rider, no glass; its
  // vision slits at the rider's eye level under armoured lids; a camera unit on the roof, the main vision, on a monitor
  // inside; a door on the boarding side, a hatch in the roof; the brush guard as the open cabin's)
  'cabin-fw': R('mecha-cage', 'field walker armoured cabin', FW,
    { base: { x: 0.37, y0: -0.46, y1: 0.74 }, belt: { z: 0.7, x: 0.38, y0: -0.5, y1: 0.78 }, roof: { z: 1.32, x: 0.3, y0: -0.42, y1: 0.5 }, z0: 0.1, post: 0.04,
      slits: { v: [0.42, 0.5], front: [[0.1, 0.32], [0.39, 0.61], [0.68, 0.9]], side: [0.66, 0.9] }, camera: { y: 0.36, h: 0.13 }, monitor: { w: 0.3, y: 0.6, z0: 0.84, z1: 0.98 },
      door: [-0.22, 0.4], hatch: { y: 0.02, r: 0.2 }, guard: { x: 0.3, y0: 0.66, y1: 1.18, z0: 0.12, z1: 0.46 } },
    150, { family: 'armoured' }, ['armoured cabin', 'armored cabin', 'closed cabin', 'armoured cab', 'armored cab', 'vision slits', 'camera unit', 'periscope camera']),
  // (the walker's saddle, its boarding step hung lower: the frame stands taller, crouched it is still a step up)
  'seat-fw': R('mecha-seat', 'field walker saddle', FW, { ...BASE['seat-atw'].dims, step: [0.27, -0.21, -0.64] }, 31, { family: 'straddle' }, ['field saddle', 'field seat']),
  'pack-fw': dressed(S('pack-atw', KF, 'field walker power pack', FW, ['cargo rack', 'field power pack', 'load rack']), 'rack'),
};
BASE = { ...BASE, ...FIELD };

// ── the backpacks (mecha-backpacks.js): a frame's back fitted for a function, its parts a person's tools' size ──────
// (the weapons backpack first: the power pack under a magazine bay, a pylon each side to a weapon mount, a spare
// magazine racked each side, a scorpion's service tail on the bay's top that swaps a magazine from behind)
const BP = 'backpack';
const BACKPACK = {
  'pack-wpn': R('mecha-pack', 'weapons backpack', BP,
    { hpu: { w: 0.5, d: 0.34, h: 0.28 }, bay: { w: 0.52, y0: -0.4, y1: -0.04, z0: 0.28, z1: 0.98 }, mount: [0.62, 0.42, 0.66], spare: [0.27, -0.22, 0.52], tail: [0, -0.22, 1.04], drop: [0, -0.74, 0.3], flow: 60 },
    120, { family: 'weapons' }, ['weapons backpack', 'weapon pack', 'hardpoint backpack', 'combat backpack', 'weapon pylons', 'magazine bay']),
  'mount-wpn': R('mecha-mount', 'weapon traverse ring', BP, { r: 0.08, cradle: [0, 0, 0.13], stop: [-20, 20], torque: 600 }, 14, { family: 'ring' }, ['weapon mount', 'traverse ring', 'turret ring']),
  'cradle-wpn': R('mecha-mount', 'weapon elevation cradle', BP, { gun: [0, 0, 0.05], stop: [-10, 55], torque: 900 }, 12, { family: 'cradle' }, ['weapon cradle', 'elevation cradle']),
  'minigun-wpn': R('mecha-weapon', 'rotary machine gun', BP, { barrels: 6, length: 0.72, r: 0.013, cluster: 0.038, axis: 0.08, box: [0.15, 0.3, 0.24] }, 68, { family: 'rotary' }, ['minigun', 'rotary machine gun', 'gatling gun', 'rotary gun', 'chain gun']),
  'rockets-wpn': R('mecha-weapon', 'five-round rocket launcher', BP, { pod: [0.34, 0.82, 0.26], at: [0, 0.1, 0], r: 0.045, tubes: [[-0.1, 0.055], [0, 0.055], [0.1, 0.055], [-0.05, -0.055], [0.05, -0.055]] }, 62, { family: 'launcher' }, ['rocket launcher', 'rocket pod', 'five round rocket launcher', 'missile pod', 'rocket rack']),
  'cannon-wpn': R('mecha-weapon', 'autocannon', BP, { length: 1.1, r: 0.028, axis: 0.1, box: [0.17, 0.34, 0.26] }, 96, { family: 'cannon' }, ['autocannon', 'cannon', 'auto cannon', 'chain cannon']),
  'ammobox-wpn': R('mecha-weapon', 'spare ammunition box', BP, { box: [0.15, 0.3, 0.24] }, 30, { family: 'ammo' }, ['spare ammunition box', 'ammo box', 'spare ammo']),
  'cannonmag-wpn': R('mecha-weapon', 'spare box magazine', BP, { box: [0.17, 0.34, 0.26] }, 40, { family: 'ammo' }, ['spare box magazine', 'cannon magazine', 'spare cannon magazine']),
  'rocketpod-wpn': R('mecha-weapon', 'spare rocket pod', BP, { pod: [0.34, 0.82, 0.26], r: 0.045, tubes: [[-0.1, 0.055], [0, 0.055], [0.1, 0.055], [-0.05, -0.055], [0.05, -0.055]] }, 50, { family: 'pod' }, ['spare rocket pod', 'spare rockets']),
  // (the service tail: a yaw drum, two armoured segments and a gripping head, each joint an electric rotary drive)
  // (a frame carrying a backpack stands on heavy-duty hip roll rams: on one foot they hold its sway with the pack on)
  'ram-roll-fw-hd': S('ram-roll-atw', KF, 'field walker heavy-duty hip roll ram', FW, ['heavy duty roll ram', 'backpack roll ram'], { bore: 0.08, rod: 0.045 }),
  // (the functional payloads, on the same mounts: generic, invented; each its magazine the tail swaps, racked spare)
  'sensor-wpn': R('mecha-weapon', 'sensor mast', BP, { base: [0.16, 0.22, 0.1], mast: [0.035, 0.85], head: 0.07, panel: [0.2, 0.12], battery: [0.12, 0.2, 0.16] }, 48, { family: 'mast' }, ['sensor mast', 'surveillance mast', 'periscope mast', 'sensor head', 'optics mast']),
  'battery-wpn': R('mecha-weapon', 'spare battery cassette', BP, { box: [0.12, 0.2, 0.16] }, 25, { family: 'ammo' }, ['battery cassette', 'spare battery']),
  'drones-wpn': R('mecha-weapon', 'four-drone launcher', BP, { box: [0.3, 0.42, 0.26], cells: [2, 2], tilt: 0.12 }, 52, { family: 'drones' }, ['drone launcher', 'drone rack', 'drone pod', 'drones', 'scout drones']),
  'dronecase-wpn': R('mecha-weapon', 'spare four-drone cassette', BP, { box: [0.3, 0.42, 0.26] }, 40, { family: 'ammo' }, ['drone cassette', 'spare drones']),
  'smoke-wpn': R('mecha-weapon', 'smoke discharger', BP, { plate: [0.22, 0.2, 0.05], cups: 4, r: 0.03, length: 0.16, fan: 40, rake: 35 }, 28, { family: 'smoke' }, ['smoke discharger', 'smoke launcher', 'smoke grenades', 'smoke screen']),
  'smokecase-wpn': R('mecha-weapon', 'spare eight-cup cassette', BP, { box: [0.22, 0.2, 0.12] }, 20, { family: 'ammo' }, ['smoke cassette', 'spare smoke']),
  'aam-wpn': R('mecha-weapon', 'four-cell anti-air launcher', BP, { pods: 1, pod: [0.26, 0.9, 0.26], cells: [2, 2], r: 0.045 }, 78, { family: 'missiles' }, ['anti-air launcher', 'anti air missiles', 'air defence missiles', 'aa missiles', 'sam pod']),
  'aampod-wpn': R('mecha-weapon', 'spare four-cell missile pod', BP, { pod: [0.26, 0.9, 0.26], cells: [2, 2], r: 0.045 }, 60, { family: 'missilePod' }, ['spare anti-air pod', 'spare aa missiles']),
  // (a payload's mass with its magazine aboard: the cargo carrier's with its crate, the winch's with its cable)
  'cargo-wpn': R('mecha-weapon', 'cargo carrier', BP, { tray: [0.32, 0.44, 0.03], crate: [0.26, 0.36, 0.22], post: 0.26 }, 70, { family: 'cargo' }, ['cargo carrier', 'cargo basket', 'supply carrier', 'crate carrier', 'supply crate']),
  'crate-wpn': R('mecha-weapon', 'spare supply crate', BP, { box: [0.26, 0.36, 0.22] }, 45, { family: 'ammo' }, ['spare crate', 'spare supply crate']),
  'winch-wpn': R('mecha-weapon', 'recovery winch', BP, { drum: [0.09, 0.2], cheek: [0.04, 0.26, 0.24], fairlead: 0.32, hook: 0.5 }, 75, { family: 'winch' }, ['recovery winch', 'winch', 'tow winch', 'cable winch', 'recovery hook']),
  'reel-wpn': R('mecha-weapon', 'spare cable reel', BP, { box: [0.22, 0.24, 0.2] }, 40, { family: 'ammo' }, ['cable reel', 'spare cable']),
  'tailbase-wpn': R('mecha-tail', 'service tail base', BP, { r: 0.1, pivot: [0, 0, 0.17], stop: [-200, 200], torque: 900 }, 14, { family: 'base' }, ['service tail', 'scorpion tail', 'reload arm', 'tail arm', 'loader arm']),
  'tailseg1-wpn': R('mecha-tail', 'service tail root segment', BP, { length: 0.56, w0: 0.12, w1: 0.1, stop: [0, 215], torque: 900 }, 12, { family: 'segment' }, ['tail segment', 'tail root']),
  'tailseg2-wpn': R('mecha-tail', 'service tail outer segment', BP, { length: 0.5, w0: 0.1, w1: 0.08, stop: [-165, 25], torque: 600 }, 9, { family: 'segment' }, ['outer tail segment']),
  'tailhead-wpn': R('mecha-tail', 'service tail head', BP, { length: 0.24, stop: [-130, 130], torque: 300 }, 6, { family: 'head' }, ['tail head', 'tail gripper', 'stinger']),
};

// ── the rover walker: the field walker's frame on wheels, its legs collapsed to roll as a four-wheeler does ─────────
// (a wheel on each knee's axis and one on each ankle's, outboard, each coaxial with its joint: in its stride they ride
// clear of the ground, the ankles' over taller feet; collapsed, the thighs rake back toward level and the knees fold
// until the shanks lie level, both wheels on the ground, the feet folded up ahead as fenders. Its knees are rotary drives,
// not rams: a ram's stroke cannot fold a knee that far. Its shanks are longer, a four-wheeler's wheelbase, their ankle
// rams with them; each wheel on its hub motor, the pair each side skid-steered)
const RW = 'rover walker', KR = 1.35;
// (drawn larger than the field walker, 1.35 times the walker's designs: collapsed, a small armoured car, not an armed
// quad; its wheels a light armoured car's; its shanks a wheelbase long; each shank's skirt over the top of its wheels
// and between them, the hull's lower side when it rolls; its rams bored up for its weight)
const ROVER = {
  'pelvis-rw': dressed(S('pelvis-atw', KR, 'rover walker pelvis', RW, ['rover pelvis', 'rover belly plate']), 'armoured'),
  'hip-rw': S('hip-atw', KR, 'rover walker hip yaw housing', RW, ['rover hip'], { torque: 3000 }),
  'yoke-rw': S('yoke-atw', KR, 'rover walker hip roll yoke', RW, ['rover yoke']),
  'thigh-rw': dressed(S('thigh-atw', KR, 'rover walker thigh', RW, ['rover thigh']), 'guarded'),
  'shank-rw': dressed(S('shank-atw', KR, 'rover walker shank', RW, ['wheeled shank', 'rover shank', 'folding knee', 'side skirt', 'wheel skirt'], { length: 0.95, stop: [5, 165], torque: 12000 }), 'wheeled', { wheel: [0.36, 0, 0], skirt: { h: 0.4, over: [0.46, 0.28], w: 0.3 } }),
  'ankle-rw': dressed(S('ankle-atw', KR, 'rover walker ankle cross', RW, ['wheeled ankle', 'rover ankle'], { torque: 2500 }), 'wheeled', { wheel: [0.36, 0, 0] }),
  'foot-rw': dressed(S('foot-atw', 1.7, 'rover walker foot', RW, ['rover foot', 'fender foot'], { sole: 0.62 }), 'lugged'),
  'ram-roll-rw': S('ram-roll-atw', KR, 'rover walker hip roll ram', RW, ['rover roll ram'], { bore: 0.1, rod: 0.056 }),
  'ram-hip-rw': S('ram-hip-atw', KR, 'rover walker hip pitch ram', RW, ['rover hip ram'], { bore: 0.1, rod: 0.056 }),
  'ram-ankle-rw': S('ram-ankle-atw', KR, 'rover walker ankle ram', RW, ['rover ankle ram'], { bore: 0.08, rod: 0.045, closed: Math.round((BASE['ram-ankle-atw'].dims.closed * KR + 0.95 - BASE['shank-atw'].dims.length * KR) * 1000) / 1000, stroke: Math.round((BASE['ram-ankle-atw'].dims.stroke * KR + 0.04) * 1000) / 1000 }),
  'wheel-rw': R('mecha-wheel', 'rover walker wheel', RW, { r: 0.34, width: 0.26, rim: 0.2, lugs: 20 }, 42, { family: 'atv' }, ['atv wheel', 'quad wheel', 'walker wheel', 'knobby tyre', 'knobby tire', 'hub motor']),
};

// ── the design houses' giant arm packs: each house's philosophy solved into its pack and its giant arms ──────────
// (mecha-gap-makers.js: solved the first time one of its rows is read, then kept; a house's rows are its own, never
// another frame's)
let MAKERS = null;
const makers = () => (MAKERS ??= makerRows(R, scaleDims));
BASE = { ...BASE, ...BACKPACK, ...ROVER };

// ── the siege walker: the rover walker's principles at 2.5 times its size ───────────────────────────────────────────
// (its legs and pelvis 3.375 times the walker's designs; three wheels a side, the middle on its long shank; its pelvis
// carrying a keel out ahead, the cockpit on it, human-sized; its siege backpack's payloads a howitzer and a missile
// launcher, a scorpion's tail each side to serve them; a rotary machine gun on the cockpit's side)
const SW = 'siege walker', KS = 3.375, KB = 2.5, SHANK_SW = 2.9;
// (its toes' segments, true metres: each hinged at its knuckle, its pin `floor` above the ground its pad stands on; a
// rotary drive in each knuckle, curling it down and under, its stop its clench)
const TOE_FLOOR = 0.28;
const TOE1 = Object.freeze({ length: 0.62, w: 0.5, h0: 0.6, h1: 0.56, floor: TOE_FLOOR, pad: 0.08, stop: Object.freeze([-105, 10]), torque: 60000 });
const TOE2 = Object.freeze({ length: 0.56, w: 0.46, h0: 0.54, h1: 0.3, floor: TOE_FLOOR, pad: 0.08, claw: 0.22, stop: Object.freeze([-110, 10]), torque: 30000 });
const SIEGE = {
  // (its hull between the backpack and the cockpit: an armoured superstructure on the keel, so it reads as a vehicle's
  // body and not a frame; a sponson each side, a box of plates out from the hull's side over the hip and the top of the
  // thigh, open below: its side reads as a tank's, one armoured side above its wheels)
  'pelvis-sw': dressed(S('pelvis-atw', KS, 'siege walker pelvis', SW, ['siege pelvis', 'siege keel', 'prow', 'cockpit keel', 'siege hull', 'sponson', 'radar dome', 'radome', 'radar'], { seat: [0, 3.3, 0.42], cage: [0, 3.3, 0.42] }), 'keeled', { prow: { y0: 0.5, y1: 5.0, top: 0.42, chine: -0.45, bottom: -1.0, w0: 1.6, w1: 1.1 }, hull: { y0: -1.9, y1: 2.72, w: 2.3, top: 1.55, front: 1.05 }, sponson: { x0: 1.0, x1: 2.24, y0: -1.4, y1: 1.75, top: 1.05, bottom: -0.3, rake: 0.4, lean: 0.12 }, radome: { y: 0.85, r: 0.58 }, sidegun: [0.7, 3.05, 1.15] }),
  'hip-sw': S('hip-atw', KS, 'siege walker hip yaw housing', SW, ['siege hip'], { torque: 260000 }),
  'yoke-sw': S('yoke-atw', KS, 'siege walker hip roll yoke', SW, ['siege yoke']),
  // (its thighs heavier and distinct, front armour plates over them; its shanks shorter, a T-rex's; its feet long and
  // pushed forward of the ankle, three toes ahead for its balance, reaching ahead of its front wheels when it rolls)
  'thigh-sw': dressed(S('thigh-atw', KS, 'siege walker thigh', SW, ['siege thigh', 'thigh armour', 'cuisse'], { w: 0.56, d0: 0.8, d1: 0.62 }), 'plated'),
  // (its three wheels in line along the shank, the front one well above the ankle: collapsed, the ankle stands a
  // wheel's height up and its foot lies out ahead, crawling forward; walking, the front wheel rides up the shin. Its
  // ankle cranked forward of its axis: rolling, that is up, the ankle higher over the ground for its toes to clench)
  'shank-sw': dressed(S('shank-atw', KS, 'siege walker shank', SW, ['siege shank', 'siege skirt'], { length: SHANK_SW, stop: [5, 170], torque: 2.2e6, ankleRam: [0, 0.42, -0.45] }), 'wheeled', { wheel: [0.9, 0, 0], wheelMid: 1.08, wheelFront: 2.16, ankleFwd: 0.45, skirt: { h: 0.76, over: [0.78, -0.3], w: 0.56 } }),
  // (its ankle ram's horn raised behind the cross: its ankle low over its shallow foot, the ram's eye clear of the ground)
  'ankle-sw': S('ankle-atw', KS, 'siege walker ankle cross', SW, ['siege ankle'], { torque: 350000, horn: [0, 0.45, 0.2] }),
  // (its feet clawed: a broad palm, a heel spur behind, two thick toes ahead, each of two segments on knuckle drives:
  // flat on the ground walking, its toes' pads under them; collapsed, clenched under the palm's front)
  'foot-sw': Object.freeze({ ...dressed(S('foot-atw', 5, 'siege walker foot', SW, ['siege foot', 'clawed foot', 'palm', 'heel spur'], { sole: 0.45, length: 2.15, heel: 0.25 }), 'clawed', { claws: { spread: 0.33, floor: TOE_FLOOR, gap: 0.03, w: TOE1.w, reach: TOE1.length + TOE2.length + TOE2.claw, spur: 0.3 } }), mass: 1250 }),
  'toe1-sw': R('mecha-toe', 'siege walker toe root segment', SW, TOE1, 150, { family: 'proximal' }, ['toe', 'toes', 'forward toes', 'siege toe', 'knuckle']),
  'toe2-sw': R('mecha-toe', 'siege walker toe claw segment', SW, TOE2, 110, { family: 'distal' }, ['toe claw', 'toe tip', 'clawed toe']),
  'ram-roll-sw': S('ram-roll-atw', KS, 'siege walker hip roll ram', SW, ['siege roll ram'], { bore: 0.34, rod: 0.19 }),
  'ram-hip-sw': S('ram-hip-atw', KS, 'siege walker hip pitch ram', SW, ['siege hip ram'], { bore: 0.34, rod: 0.19 }),
  // (its ankle ram down the shin's front to a horn ahead of and above the cross: its length rising the whole way over the
  // ankle's working arc, the foot laid level collapsed and stood flat walking, sized from that curve)
  'ram-ankle-sw': S('ram-ankle-atw', KS, 'siege walker ankle ram', SW, ['siege ankle ram'], { bore: 0.26, rod: 0.15, closed: 2.0, stroke: 0.93 }),
  'wheel-sw': R('mecha-wheel', 'siege walker wheel', SW, { r: 0.5, width: 0.52, rim: 0.3, lugs: 20 }, 380, { family: 'atv' }, ['siege wheel', 'armoured car wheel', 'big knobby tyre']),
  // (its cockpit: the armoured cabin, its camera augmented by the radar dome on the hull behind it; its saddle's step a
  // ladder's foot)
  'cabin-sw': R('mecha-cage', 'siege walker armoured cockpit', SW, { ...BASE['cabin-fw'].dims }, 180, { family: 'armoured' }, ['siege cockpit']),
  'seat-sw': R('mecha-seat', 'siege walker saddle', SW, { ...BASE['seat-atw'].dims, step: [0.27, -0.21, -0.64] }, 31, { family: 'straddle' }, ['siege saddle']),
  // (its siege backpack: the weapons backpack's frame at 2.5 times, a tail seat each side; its mounts and tails with it)
  // (its weapons mounted low and wide, out on its pylons beside the hull: a lower profile)
  'pack-sw': S('pack-wpn', KB, 'siege backpack', 'backpack', ['siege backpack', 'artillery backpack'], { tails: [0.62, -0.55, 2.6], mount: [2.3, 1.4, 0.9] }),
  'mount-sw': S('mount-wpn', KB, 'siege weapon traverse ring', 'backpack', ['siege traverse ring'], { torque: 400000 }),
  'cradle-sw': S('cradle-wpn', KB, 'siege weapon elevation cradle', 'backpack', ['siege cradle'], { torque: 600000 }),
  'tailbase-sw': S('tailbase-wpn', KB, 'siege service tail base', 'backpack', ['siege tail', 'twin tails']),
  // (its tails longer than the weapons backpack's drawn larger: they reach its weapons, mounted low and wide)
  'tailseg1-sw': S('tailseg1-wpn', KB, 'siege service tail root segment', 'backpack', ['siege tail root'], { torque: 160000, length: 1.8 }),
  'tailseg2-sw': S('tailseg2-wpn', KB, 'siege service tail outer segment', 'backpack', ['siege tail outer'], { torque: 100000, length: 1.6 }),
  'tailhead-sw': S('tailhead-wpn', KB, 'siege service tail head', 'backpack', ['siege tail head']),
  'howitzer-sw': R('mecha-weapon', 'howitzer', 'backpack', { length: 5.2, r: 0.1, axis: 0.42, breech: [0.62, 1.3, 0.62], mag: [0.55, 0.9, 0.5] }, 5600, { family: 'howitzer' }, ['howitzer', 'artillery', 'artillery gun', 'big cannon', 'field gun']),
  'missiles-sw': R('mecha-weapon', 'eighteen-cell missile launcher', 'backpack', { pods: 3, pod: [0.62, 2.1, 0.66], cells: [3, 2], r: 0.085 }, 3300, { family: 'missiles' }, ['missile launcher', 'missile system', 'missile battery', 'missiles']),
  'shellmag-sw': R('mecha-weapon', 'spare shell cassette', 'backpack', { box: [0.55, 0.9, 0.5] }, 600, { family: 'ammo' }, ['shell cassette', 'spare shells']),
  'missilepod-sw': R('mecha-weapon', 'spare six-cell missile pod', 'backpack', { pod: [0.62, 2.1, 0.66], cells: [3, 2], r: 0.085 }, 700, { family: 'missilePod' }, ['spare missile pod', 'six cell missile pod']),
};
const ODM = { ...ROWS, ...HEAVY, ...GIANT, ...FIELD, ...BACKPACK, ...ROVER, ...SIEGE };
for (const house of MECHA_MAKER_IDS) for (const part of MAKER_PARTS) Object.defineProperty(ODM, `${part}-${house}`, { enumerable: true, get: () => makers()[`${part}-${house}`] });
export const MECHA_ODM = Object.freeze(ODM);

