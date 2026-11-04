import { MECHA_BACKPACKS, MECHA_WEAPONS, TAIL_POSES, backpackLayout } from './mecha-backpacks.js';

/**
 * mecha-archetypes — whole frames laid out on the chain (construction-shelf/con-chain.js), each joint driven by the
 * actuator across it: a ram's stroke gives a pitch or a roll joint its range, a rotary drive's stops a yaw's.
 *
 * An archetype:
 *   label, classOf   what it is
 *   palette          its default (mecha-common.js MECHA_PALETTES)
 *   mass             its class's mass, dry (kg): the parts are held to it
 *   rider            { mass, com }: the rider it is rated for (a large adult in kit), and where the seated rider's
 *                    mass sits from the saddle's sit point
 *   posture          how its rider sits or stands in it (cycle-shelf/cycle-rider.js POSTURES); station, what it
 *                    sits or stands on ('saddle' | 'platform')
 *   bend             which way its knees bend: 'back' (digitigrade) or 'forward' (a person's)
 *   arms, armPoses   its arms' bodies and joints by what they are, and their named poses (mecha-ik.js solves them)
 *   mount            a modular frame's: the tools its wrists' couplers take, the arm kits its elbows take, and its own
 *                    loadout ({ r: { tool, arm }, l }: mecha-tools.js)
 *   envelope         the rider's space in the pelvis's frame, boxes ({ x: half width, y: [aft, fore], z: [low, high] }):
 *                    the legs never enter it
 *   joints           { name: { kind, axis?, ram?, drive?, near? } } (con-chain.js; `drive` a rotary drive's body: its
 *                    row's `stop` the joint's range, its `torque` its rating)
 *   layout           the bodies on their joints and the rams across them (con-chain.js's entries; `side` a leg's hand)
 *   legs             { r: { hip, roll, pitch, knee, ankle, foot, joints: { yaw, roll, pitch, knee, anklePitch, ankleRoll } } }:
 *                    the bodies and joints of each leg, by what they are (mecha-ik.js solves them)
 *   stances          named stances (mecha-ik.js): what its pelvis, its feet and its arms do, and a load in its claws,
 *                    solved to joint values
 *   cabins           a frame's cabins by name ({ sku, label, mass?, laws? }: the open one its own; another's mass on the
 *                    class's, its laws on the frame's): the door's `cabin`, an armoured one's vision slits its `slits`
 *   wheels           a frame that rolls: its wheels' bodies ({ id, axle: 'rear' | 'front', side }), on the ground in
 *                    its `roll` stance (mecha-ik.js)
 *   backpack         a backpack it carries as built (its `weapons`, `tail`, `payloads`), its payloads swapped by `weapons`
 *   dress            a frame dressed in a styling library's look at its faces ({ style: 'military', livery, wear, kit }:
 *                    mecha-military.js), its kit each fitting's anchor on a body (its hardpoint, the surface's out and up)
 *   laws             the bands it is held to (mecha-laws.js)
 *   bom              its parts by kind
 *
 * Pure data. An archetype is a compatibility promise over what is minted.
 */

// (a leg's parts, by frame: the walker's, and the utility walker's bored up for its weight)
const ATW_LEG = Object.freeze({ hip: 'hip-atw', yoke: 'yoke-atw', thigh: 'thigh-atw', shank: 'shank-atw', ankle: 'ankle-atw', foot: 'foot-atw', roll: 'ram-roll-atw', hipRam: 'ram-hip-atw', kneeRam: 'ram-knee-atw', ankleRam: 'ram-ankle-atw' });
const HW_LEG = Object.freeze({ hip: 'hip-hw', yoke: 'yoke-hw', thigh: 'thigh-hw', shank: 'shank-hw', ankle: 'ankle-hw', foot: 'foot-hw', roll: 'ram-roll-hw', hipRam: 'ram-hip-hw', kneeRam: 'ram-knee-hw', ankleRam: 'ram-ankle-hw' });
const FW_LEG = Object.freeze({ hip: 'hip-fw', yoke: 'yoke-fw', thigh: 'thigh-fw', shank: 'shank-fw', ankle: 'ankle-fw', foot: 'foot-fw', roll: 'ram-roll-fw', hipRam: 'ram-hip-fw', kneeRam: 'ram-knee-fw', ankleRam: 'ram-ankle-fw' });
const UW_LEG = Object.freeze({ hip: 'hip-uw', yoke: 'yoke-uw', thigh: 'thigh-uw', shank: 'shank-uw', ankle: 'ankle-uw', foot: 'foot-uw', roll: 'ram-roll-uw', hipRam: 'ram-hip-uw', kneeRam: 'ram-knee-uw', ankleRam: 'ram-ankle-uw' });
/** A leg of six joints on one side: its parts (a set above), its knee bent `back` (digitigrade) or `forward` (human). */
const leg = (S, P = ATW_LEG, bend = 'back') => {
  const s = S.toLowerCase(), fwd = bend === 'forward';
  return {
    joints: {
      [`hipYaw${S}`]: Object.freeze({ kind: 'slew', drive: `hip${S}` }),
      [`hipRoll${S}`]: Object.freeze({ kind: 'hinge', axis: Object.freeze([0, 1, 0]), ram: `rollRam${S}`, near: 0 }),
      [`hipPitch${S}`]: Object.freeze({ kind: 'hinge', ram: `hipRam${S}`, near: fwd ? 30 : -30 }),
      // (the knee's bend is + whichever way it bends: about −x when the shank swings back under a forward knee)
      [`knee${S}`]: Object.freeze({ kind: 'hinge', ...(fwd ? { axis: Object.freeze([-1, 0, 0]) } : {}), ram: `kneeRam${S}`, near: 60 }),
      [`anklePitch${S}`]: Object.freeze({ kind: 'hinge', ram: `ankleRam${S}`, near: fwd ? 10 : -10 }),
      [`ankleRoll${S}`]: Object.freeze({ kind: 'hinge', axis: Object.freeze([0, 1, 0]), drive: `ankle${S}` }),
    },
    layout: [
      { id: `hip${S}`, sku: P.hip, side: s, on: `pelvis.hip.${s}`, joint: `hipYaw${S}` },
      { id: `yoke${S}`, sku: P.yoke, side: s, on: `hip${S}.roll`, joint: `hipRoll${S}` },
      { id: `thigh${S}`, sku: P.thigh, side: s, on: `yoke${S}.pitch`, joint: `hipPitch${S}` },
      { id: `shank${S}`, sku: P.shank, side: s, on: `thigh${S}.knee`, joint: `knee${S}` },
      { id: `ankle${S}`, sku: P.ankle, side: s, on: `shank${S}.ankle`, joint: `anklePitch${S}` },
      { id: `foot${S}`, sku: P.foot, side: s, on: `ankle${S}.roll`, joint: `ankleRoll${S}` },
      // (each ram's barrel at the body nearer the hip, its rod toward the foot: the leg's mass kept high)
      { id: `rollRam${S}`, sku: P.roll, side: s, ram: [`hip${S}.rollRam`, `yoke${S}.rollEye`] },
      { id: `hipRam${S}`, sku: P.hipRam, side: s, ram: [`yoke${S}.horn`, `thigh${S}.hipRam`] },
      { id: `kneeRam${S}`, sku: P.kneeRam, side: s, ram: [`thigh${S}.kneeRam`, `shank${S}.kneeEye`] },
      { id: `ankleRam${S}`, sku: P.ankleRam, side: s, ram: [`shank${S}.ankleRam`, `ankle${S}.horn`] },
    ],
    legs: {
      hip: `hip${S}`, roll: `yoke${S}`, pitch: `thigh${S}`, knee: `shank${S}`, ankle: `ankle${S}`, foot: `foot${S}`,
      joints: { yaw: `hipYaw${S}`, roll: `hipRoll${S}`, pitch: `hipPitch${S}`, knee: `knee${S}`, anklePitch: `anklePitch${S}`, ankleRoll: `ankleRoll${S}` },
    },
  };
};
// (an arm's parts, by frame)
const UW_ARM = Object.freeze({ shoulder: 'shoulder-uw', upper: 'upperarm-uw', fore: 'forearm-uw', wrist: 'wrist-uw', claw: 'claw-uw', shoulderRam: 'ram-shoulder-uw', elbowRam: 'ram-elbow-uw' });
const GW_LEG = Object.freeze({ hip: 'hip-gw', yoke: 'yoke-gw', thigh: 'thigh-gw', shank: 'shank-gw', ankle: 'ankle-gw', foot: 'foot-gw', roll: 'ram-roll-gw', hipRam: 'ram-hip-gw', kneeRam: 'ram-knee-gw', ankleRam: 'ram-ankle-gw' });
const GW_ARM = Object.freeze({ shoulder: 'shoulder-gw', upper: 'upperarm-gw', fore: 'forearm-gw', wrist: 'wrist-gw', claw: 'hand-gw', shoulderRam: 'ram-shoulder-gw', elbowRam: 'ram-elbow-gw' });
const HW_ARM = Object.freeze({ shoulder: 'shoulder-hw', upper: 'upperarm-hw', fore: 'forearm-hw', wrist: 'wrist-hw', claw: 'claw-hw', shoulderRam: 'ram-shoulder-hw', elbowRam: 'ram-elbow-hw' });
/** An arm on one side, on the torso's shoulder: its yaw drive, its pitch and elbow on rams, a rotary wrist, a claw. */
/** An arm on one side: its yaw drive, its pitch and elbow on rams, a rotary wrist, a claw; on the torso's shoulder (the
 *  cab's, `cage.shoulder`), or another body's (`on`: a giant arm pack's), its bodies and joints named under `prefix`. */
const arm = (S, P = UW_ARM, { prefix = '', on = 'cage.shoulder' } = {}) => {
  const s = S.toLowerCase(), n = (w) => (prefix ? `${prefix}${w[0].toUpperCase()}${w.slice(1)}` : w) + S;
  return {
    joints: {
      [n('shoulderYaw')]: Object.freeze({ kind: 'slew', drive: n('shoulder') }),
      [n('shoulderPitch')]: Object.freeze({ kind: 'hinge', ram: n('shoulderRam'), near: 40 }),
      [n('elbow')]: Object.freeze({ kind: 'hinge', ram: n('elbowRam'), near: 60 }),
      [n('wrist')]: Object.freeze({ kind: 'hinge', drive: n('wrist') }),
    },
    layout: [
      { id: n('shoulder'), sku: P.shoulder, side: s, on: `${on}.${s}`, joint: n('shoulderYaw') },
      { id: n('upperArm'), sku: P.upper, side: s, on: `${n('shoulder')}.pitch`, joint: n('shoulderPitch') },
      { id: n('foreArm'), sku: P.fore, side: s, on: `${n('upperArm')}.elbow`, joint: n('elbow') },
      { id: n('wrist'), sku: P.wrist, side: s, on: `${n('foreArm')}.wrist`, joint: n('wrist') },
      { id: n('claw'), sku: P.claw, side: s, on: `${n('wrist')}.claw` },
      { id: n('shoulderRam'), sku: P.shoulderRam, side: s, ram: [`${n('shoulder')}.horn`, `${n('upperArm')}.shoulderRam`] },
      { id: n('elbowRam'), sku: P.elbowRam, side: s, ram: [`${n('upperArm')}.elbowRam`, `${n('foreArm')}.elbowEye`] },
    ],
    arms: {
      shoulder: n('shoulder'), upper: n('upperArm'), fore: n('foreArm'), wrist: n('wrist'), claw: n('claw'),
      joints: { yaw: n('shoulderYaw'), pitch: n('shoulderPitch'), elbow: n('elbow'), wrist: n('wrist') },
    },
  };
};
const R = leg('R'), L = leg('L'), FR = leg('R', FW_LEG), FL = leg('L', FW_LEG);
// (an arm's poses, its wrist's place as shares of its length: the same pose on a short arm and a long one)
export const ARM_POSES = Object.freeze({
  rest: Object.freeze({ wrist: Object.freeze([0.28, -0.7]), claw: 20 }),
  carry: Object.freeze({ wrist: Object.freeze([0.58, -0.393]), claw: 90 }),
  raise: Object.freeze({ wrist: Object.freeze([0.514, 0.42]), claw: 120 }),
  // (folded up, the hands ahead at the chest: a giant arm's carried so, walking)
  stow: Object.freeze({ wrist: Object.freeze([0.36, -0.34]), claw: 100 }),
});
const UR = leg('R', UW_LEG, 'forward'), UL = leg('L', UW_LEG, 'forward'), AR = arm('R'), AL = arm('L');
const HR = leg('R', HW_LEG, 'forward'), HL = leg('L', HW_LEG, 'forward'), HAR = arm('R', HW_ARM), HAL = arm('L', HW_ARM);
const GR = leg('R', GW_LEG, 'forward'), GL = leg('L', GW_LEG, 'forward');
const GPR = arm('R', GW_ARM, { prefix: 'giant', on: 'pack.shoulder' }), GPL = arm('L', GW_ARM, { prefix: 'giant', on: 'pack.shoulder' });

const BASE_ARCHETYPES = Object.freeze({
  // the all-terrain walker: one rider astride a saddle on a pelvis, leaning onto clip-on bars as on a sport motorcycle, its
  // knees round the tank, its feet on pegs set back under the hips, a convertible's cabin round it, one nose ahead; two
  // legs of six joints each (hip yaw, roll and pitch, the knee bent backward, the ankle's pitch and roll), the battery low in the keel between the hips, the
  // hydraulic power unit under the tail; it stands with its knees bent and crouches to be boarded
  allTerrainWalker: Object.freeze({
    label: 'all-terrain walker',
    classOf: 'ridden biped walker, one rider astride',
    palette: 'proving',
    mass: 450,
    rider: Object.freeze({ mass: 95, com: Object.freeze([0, 0.12, 0.3]) }),
    // (it is ridden astride, leaning onto the bars as on a sport machine, the head up: cycle-shelf/cycle-rider.js's card)
    posture: 'walker',
    station: 'saddle',
    bend: 'back',
    // (its rider's space: the leaning trunk and the head over the saddle, the thighs and knees round the tank, the feet
    // on the pegs set back under the hips)
    envelope: Object.freeze([
      Object.freeze({ x: 0.22, y: Object.freeze([-0.32, 0.45]), z: Object.freeze([0.42, 1.03]) }),
      Object.freeze({ x: 0.12, y: Object.freeze([-0.1, 0.45]), z: Object.freeze([1.03, 1.26]) }),
      Object.freeze({ x: 0.22, y: Object.freeze([-0.3, 0.3]), z: Object.freeze([0.12, 0.5]) }),
      Object.freeze({ x: 0.3, y: Object.freeze([-0.4, -0.13]), z: Object.freeze([-0.03, 0.12]) }),
    ]),
    joints: Object.freeze({ ...R.joints, ...L.joints }),
    layout: Object.freeze([
      { id: 'pelvis', sku: 'pelvis-atw' },
      { id: 'seat', sku: 'seat-atw', on: 'pelvis.seat' },
      { id: 'cage', sku: 'cage-atw', on: 'pelvis.cage' },
      { id: 'pack', sku: 'pack-atw', on: 'pelvis.pack' },
      ...R.layout, ...L.layout,
    ].map(Object.freeze)),
    legs: Object.freeze({ r: Object.freeze(R.legs), l: Object.freeze(L.legs) }),
    // the soles' track at its ease (between the ankles' centres): narrower than the hips, so its sway over a foot is short
    track: 0.46,
    stances: Object.freeze({
      // (ready: the knees bent 45°, away from the straight leg's singularity, the feet under the hips)
      stand: Object.freeze({ knee: 45 }),
      // (crouched for the rider to climb in: the feet set back under the folded knees, the pelvis down until the knees
      // are near their stop)
      board: Object.freeze({ knee: 110, fore: -0.1, track: 0.5 }),
      // (mid-stride on both feet: the right ahead, the left behind, the pelvis at its standing height)
      stride: Object.freeze({ height: 'stand', feet: Object.freeze({ r: Object.freeze({ y: 0.3 }), l: Object.freeze({ y: -0.3 }) }) }),
      // (a static step: the pelvis swayed over the left sole and lowered to keep its knee bent, the right foot lifted and
      // carried forward)
      lift: Object.freeze({ knee: 40, sway: 'l', feet: Object.freeze({ r: Object.freeze({ y: 0.15, lift: 0.22 }) }) }),
      // (turning on the spot: both feet yawed by the hips' drives)
      turn: Object.freeze({ knee: 45, feet: Object.freeze({ r: Object.freeze({ yaw: 15 }), l: Object.freeze({ yaw: 15 }) }) }),
    }),
    rest: 'stand',
    laws: Object.freeze({
      // (a backward-bent leg folds its ankle further than a human's: its arc the wider)
      arcs: Object.freeze({ hipRoll: [40, 64], hipPitch: [110, 140], knee: [100, 125], anklePitch: [70, 100] }),
      knee: [25, 60],
      stability: [0.05, 1],
      sway: [0.02, 1],
      actuators: [0, 0.8],
      groundPressure: [25, 70],
      step: [0.3, 0.8],
      stride: [0.3, 0.6],
      seat: [1.4, 1.8],
      board: [1.0, 1.4],
      stepIn: [0.3, 0.6],
      tipover: [0.03, 9],
      clearance: [0.01, 9],
      mass: 0.1,
      distal: [0, 0.45],
    }),
    bom: Object.freeze({ 'mecha-pelvis': 1, 'mecha-seat': 1, 'mecha-cage': 1, 'mecha-pack': 1, 'mecha-hip': 2, 'mecha-yoke': 2, 'mecha-thigh': 2, 'mecha-shank': 2, 'mecha-ankle': 2, 'mecha-foot': 2, 'mecha-ram': 8 }),
  }),
  // the field walker: the all-terrain walker hardened as a military all-terrain transport, unarmed. Its frame the
  // walker's at 1.2 times for the clearance and the step rough ground asks, its knees bent backward, its beams guarded,
  // its belly under a skid plate, its feet cleated; its rider astride as on the walker, behind a brush guard, its kit
  // carried (its dress: car-designer's military styling, a livery, its fittings, its wear)
  fieldWalker: Object.freeze({
    label: 'field walker',
    classOf: 'ridden biped walker, one rider astride, a military all-terrain transport',
    palette: 'oliveDrab',
    mass: 800,
    rider: Object.freeze({ mass: 110, com: Object.freeze([0, 0.12, 0.3]) }),
    posture: 'walker',
    station: 'saddle',
    bend: 'back',
    envelope: Object.freeze([
      Object.freeze({ x: 0.22, y: Object.freeze([-0.32, 0.45]), z: Object.freeze([0.44, 1.05]) }),
      Object.freeze({ x: 0.12, y: Object.freeze([-0.1, 0.45]), z: Object.freeze([1.05, 1.28]) }),
      Object.freeze({ x: 0.22, y: Object.freeze([-0.3, 0.3]), z: Object.freeze([0.14, 0.52]) }),
      Object.freeze({ x: 0.3, y: Object.freeze([-0.4, -0.13]), z: Object.freeze([-0.01, 0.14]) }),
    ]),
    joints: Object.freeze({ ...FR.joints, ...FL.joints }),
    layout: Object.freeze([
      { id: 'pelvis', sku: 'pelvis-fw' },
      { id: 'seat', sku: 'seat-fw', on: 'pelvis.seat' },
      { id: 'cage', sku: 'cage-fw', on: 'pelvis.cage' },
      { id: 'pack', sku: 'pack-fw', on: 'pelvis.pack' },
      ...FR.layout, ...FL.layout,
    ].map(Object.freeze)),
    legs: Object.freeze({ r: Object.freeze(FR.legs), l: Object.freeze(FL.legs) }),
    track: 0.56,
    stances: Object.freeze({
      stand: Object.freeze({ knee: 45 }),
      board: Object.freeze({ knee: 110, fore: -0.12, track: 0.6 }),
      stride: Object.freeze({ height: 'stand', feet: Object.freeze({ r: Object.freeze({ y: 0.36 }), l: Object.freeze({ y: -0.36 }) }) }),
      lift: Object.freeze({ knee: 40, sway: 'l', feet: Object.freeze({ r: Object.freeze({ y: 0.18, lift: 0.3 }) }) }),
      turn: Object.freeze({ knee: 45, feet: Object.freeze({ r: Object.freeze({ yaw: 15 }), l: Object.freeze({ yaw: 15 }) }) }),
    }),
    rest: 'stand',
    // (its cabins: open as the walker's, or closed and armoured, its vision slits open or shut (`cabin`, `slits`:
    // index.js composeFrame); the armoured one's mass on the class's, its rider held inside its walls by the cab law)
    cabins: Object.freeze({
      open: Object.freeze({ sku: 'cage-fw', label: 'its open cabin' }),
      armoured: Object.freeze({ sku: 'cabin-fw', label: 'its armoured cabin', mass: 120, laws: Object.freeze({ cab: Object.freeze([0.03, 1]) }) }),
    }),
    // (its backpacks, each in its power pack's place (`backpack`: mecha-backpacks.js): the weapons backpack, a payload
    // each side and a service tail)
    backpacks: Object.freeze(['weapons']),
    // (its dress: the military styling library's, at the faces (mecha-military.js): a livery, olive drab unless asked, cut
    // into its paint; its field kit on its bodies' anchors; its wear)
    dress: Object.freeze({
      style: 'military', livery: 'mono', wear: 'used',
      kit: Object.freeze([
        ['tools.l', 'cage', 'flank', [-1, 0, 0], [0, 0, 1], 'pioneerTools'],
        ['antenna.r', 'cage', 'flank', [1, 0, 0], [0, 0, 1], 'antenna', { lean: -1, whip: 1.4 }],
        ['cans.l', 'pack', 'panel', [-1, 0, 0], [0, 0, 1], 'jerryCans', { count: 1 }],
        ['cans.r', 'pack', 'panel', [1, 0, 0], [0, 0, 1], 'jerryCans', { count: 1 }],
        ['top', 'pack', 'top', [0, 0, 1], [0, -1, 0], 'tarpRoll', { width: 0.6 }],
        ['recovery.fr', 'pelvis', 'bumper', [0, 1, 0], [0, 0, 1], 'shackle'],
        ['recovery.fl', 'pelvis', 'bumper', [0, 1, 0], [0, 0, 1], 'shackle'],
        ['recovery.rr', 'pelvis', 'bumper', [0, -1, 0], [0, 0, 1], 'shackle'],
        ['recovery.rl', 'pelvis', 'bumper', [0, -1, 0], [0, 0, 1], 'shackle'],
        ['mark.r', 'cage', 'mark', [1, 0, 0], [0, 0, 1], null, { role: 'number', h: 0.07 }],
        ['mark.l', 'cage', 'mark', [-1, 0, 0], [0, 0, 1], null, { role: 'number', h: 0.07 }],
      ].map(([id, body, kind, out, up, card, opts = {}]) => Object.freeze({ id, body, kind, out, up, card, opts }))),
    }),
    laws: Object.freeze({
      arcs: Object.freeze({ hipRoll: [40, 64], hipPitch: [110, 140], knee: [100, 125], anklePitch: [70, 100] }),
      knee: [25, 60],
      stability: [0.05, 1],
      sway: [0.02, 1],
      actuators: [0, 0.8],
      groundPressure: [20, 60],
      // (rough ground: a foot set down on a higher step, its belly clear of the rocks it walks over)
      step: [0.34, 1.0],
      stride: [0.4, 0.8],
      belly: [0.8, 1.5],
      seat: [1.6, 2.2],
      board: [1.1, 1.6],
      stepIn: [0.3, 0.6],
      tipover: [0.03, 9],
      clearance: [0.01, 9],
      mass: 0.1,
      distal: [0, 0.45],
    }),
    bom: Object.freeze({ 'mecha-pelvis': 1, 'mecha-seat': 1, 'mecha-cage': 1, 'mecha-pack': 1, 'mecha-hip': 2, 'mecha-yoke': 2, 'mecha-thigh': 2, 'mecha-shank': 2, 'mecha-ankle': 2, 'mecha-foot': 2, 'mecha-ram': 8 }),
  }),
  // the utility walker: a general-purpose work frame, its operator belted into a work seat in a torso frame, a rail round
  // it, working two arms from the console on each armrest, walking it by its pedals; its legs knee-forward as a person's,
  // bored up for its weight and its load; its battery low in the keel, its power pack on the torso's back
  utilityWalker: Object.freeze({
    label: 'utility walker',
    classOf: 'seated-operator biped work frame, two arms',
    palette: 'proving',
    mass: 760,
    rider: Object.freeze({ mass: 95, com: Object.freeze([0, 0.08, 0.15]) }),
    posture: 'operator',
    station: 'seat',
    bend: 'forward',
    // (its operator's space: the trunk and head over the seat under the hoop, the thighs and shins down to the pedals)
    envelope: Object.freeze([
      Object.freeze({ x: 0.24, y: Object.freeze([-0.3, 0.3]), z: Object.freeze([0.62, 1.52]) }),
      Object.freeze({ x: 0.22, y: Object.freeze([-0.2, 0.5]), z: Object.freeze([0.16, 0.62]) }),
    ]),
    joints: Object.freeze({ ...UR.joints, ...UL.joints, ...AR.joints, ...AL.joints }),
    layout: Object.freeze([
      { id: 'pelvis', sku: 'pelvis-uw' },
      { id: 'seat', sku: 'platform-uw', on: 'pelvis.seat' },
      { id: 'cage', sku: 'torso-uw', on: 'pelvis.cage' },
      { id: 'pack', sku: 'pack-uw', on: 'pelvis.pack' },
      ...UR.layout, ...UL.layout, ...AR.layout, ...AL.layout,
    ].map(Object.freeze)),
    legs: Object.freeze({ r: Object.freeze(UR.legs), l: Object.freeze(UL.legs) }),
    arms: Object.freeze({ r: Object.freeze(AR.arms), l: Object.freeze(AL.arms) }),
    // (the arms' poses: each wrist's place from its shoulder's axle in the arm's plane [ahead, up], as shares of the arm's
    // length (its upper arm's and its forearm's), and its claw's angle from hanging (90°: its fingers ahead))
    armPoses: ARM_POSES,
    track: 0.5,
    stances: Object.freeze({
      stand: Object.freeze({ knee: 45, arms: 'rest' }),
      board: Object.freeze({ knee: 110, fore: 0.1, track: 0.54, arms: 'rest' }),
      stride: Object.freeze({ height: 'stand', arms: 'rest', feet: Object.freeze({ r: Object.freeze({ y: 0.3 }), l: Object.freeze({ y: -0.3 }) }) }),
      lift: Object.freeze({ knee: 40, sway: 'l', arms: 'rest', feet: Object.freeze({ r: Object.freeze({ y: 0.15, lift: 0.22 }) }) }),
      turn: Object.freeze({ knee: 45, arms: 'rest', feet: Object.freeze({ r: Object.freeze({ yaw: 15 }), l: Object.freeze({ yaw: 15 }) }) }),
      // (a load held ahead in both claws, the forearms level)
      carry: Object.freeze({ knee: 50, arms: 'carry', load: 100 }),
      // (the claws raised over the head: a beam lifted into place)
      reach: Object.freeze({ knee: 45, arms: 'raise' }),
    }),
    rest: 'stand',
    laws: Object.freeze({
      arcs: Object.freeze({ hipRoll: [40, 64], hipPitch: [110, 140], knee: [100, 125], anklePitch: [60, 85], shoulderPitch: [120, 150], elbow: [100, 130] }),
      knee: [25, 60],
      stability: [0.05, 1],
      sway: [0.02, 1],
      actuators: [0, 0.8],
      groundPressure: [25, 70],
      step: [0.3, 0.8],
      stride: [0.3, 0.6],
      seat: [1.6, 2.1],
      board: [1.2, 1.7],
      stepIn: [0.3, 0.6],
      tipover: [0.03, 9],
      clearance: [0.01, 9],
      reach: [0.9, 1.6],
      lift: [100, 400],
      mass: 0.1,
      distal: [0, 0.45],
    }),
    bom: Object.freeze({ 'mecha-pelvis': 1, 'mecha-seat': 1, 'mecha-cage': 1, 'mecha-pack': 1, 'mecha-hip': 2, 'mecha-yoke': 2, 'mecha-thigh': 2, 'mecha-shank': 2, 'mecha-ankle': 2, 'mecha-foot': 2, 'mecha-shoulder': 2, 'mecha-upperarm': 2, 'mecha-forearm': 2, 'mecha-wrist': 2, 'mecha-claw': 2, 'mecha-ram': 12 }),
  }),
  // the heavy walker: the utility walker's frame drawn larger for heavy construction (its legs, its pelvis and its arms
  // at 1.4 times, its feet at 1.6), its operator a person's size in a closed cab: a falling-object roof on four pillars,
  // glass all round, guard bars ahead of the windshield, a door up a side ladder, a harness and an emergency stop
  heavyWalker: Object.freeze({
    label: 'heavy walker',
    // (its arms modular: any tool on its wrists' quick couplers, a standard or a long-reach arm, by task or by hand
    // (mecha-tools.js); a grapple on each standard arm its own)
    mount: Object.freeze({ tools: Object.freeze(['grapple', 'bucket', 'breaker', 'crusher', 'forks', 'auger', 'vacuum', 'magnet', 'hook']), arms: Object.freeze(['standard', 'long']), loadout: Object.freeze({ r: Object.freeze({ tool: 'grapple', arm: 'standard' }), l: Object.freeze({ tool: 'grapple', arm: 'standard' }) }) }),
    classOf: 'heavy construction biped, closed cab, two arms',
    palette: 'siteYellow',
    mass: 2300,
    rider: Object.freeze({ mass: 95, com: Object.freeze([0, 0.08, 0.15]) }),
    posture: 'operator',
    station: 'seat',
    bend: 'forward',
    // (its operator's space in the cab: the trunk and head over the seat, the thighs and shins down to the pedals)
    envelope: Object.freeze([
      Object.freeze({ x: 0.24, y: Object.freeze([-0.3, 0.3]), z: Object.freeze([0.65, 1.56]) }),
      Object.freeze({ x: 0.22, y: Object.freeze([-0.2, 0.5]), z: Object.freeze([0.19, 0.65]) }),
    ]),
    joints: Object.freeze({ ...HR.joints, ...HL.joints, ...HAR.joints, ...HAL.joints }),
    layout: Object.freeze([
      { id: 'pelvis', sku: 'pelvis-hw' },
      { id: 'seat', sku: 'station-hw', on: 'pelvis.seat' },
      { id: 'cage', sku: 'cab-hw', on: 'pelvis.cage' },
      { id: 'pack', sku: 'pack-hw', on: 'pelvis.pack' },
      ...HR.layout, ...HL.layout, ...HAR.layout, ...HAL.layout,
    ].map(Object.freeze)),
    legs: Object.freeze({ r: Object.freeze(HR.legs), l: Object.freeze(HL.legs) }),
    arms: Object.freeze({ r: Object.freeze(HAR.arms), l: Object.freeze(HAL.arms) }),
    armPoses: ARM_POSES,
    track: 0.7,
    stances: Object.freeze({
      stand: Object.freeze({ knee: 45, arms: 'rest' }),
      board: Object.freeze({ knee: 110, fore: 0.14, track: 0.76, arms: 'rest' }),
      stride: Object.freeze({ height: 'stand', arms: 'rest', feet: Object.freeze({ r: Object.freeze({ y: 0.42 }), l: Object.freeze({ y: -0.42 }) }) }),
      lift: Object.freeze({ knee: 40, sway: 'l', arms: 'rest', feet: Object.freeze({ r: Object.freeze({ y: 0.21, lift: 0.3 }) }) }),
      turn: Object.freeze({ knee: 45, arms: 'rest', feet: Object.freeze({ r: Object.freeze({ yaw: 15 }), l: Object.freeze({ yaw: 15 }) }) }),
      // (a load held ahead in both grapples, the forearms level: a kerb stone, a pipe, a pallet of blocks)
      carry: Object.freeze({ knee: 50, arms: 'carry', load: 400 }),
      reach: Object.freeze({ knee: 45, arms: 'raise' }),
    }),
    rest: 'stand',
    laws: Object.freeze({
      arcs: Object.freeze({ hipRoll: [40, 64], hipPitch: [110, 140], knee: [100, 125], anklePitch: [60, 85], shoulderPitch: [120, 150], elbow: [100, 130] }),
      knee: [25, 60],
      stability: [0.05, 1],
      sway: [0.02, 1],
      actuators: [0, 0.8],
      groundPressure: [25, 70],
      step: [0.4, 1.1],
      stride: [0.4, 0.85],
      seat: [2.0, 2.8],
      board: [1.6, 2.3],
      stepIn: [0.3, 0.6],
      tipover: [0.03, 9],
      clearance: [0.01, 9],
      cab: [0.03, 1],
      flow: [0, 1],
      reach: [1.6, 3.2],
      lift: [100, 1500],
      mass: 0.1,
      distal: [0, 0.45],
    }),
    bom: Object.freeze({ 'mecha-pelvis': 1, 'mecha-seat': 1, 'mecha-cage': 1, 'mecha-pack': 1, 'mecha-hip': 2, 'mecha-yoke': 2, 'mecha-thigh': 2, 'mecha-shank': 2, 'mecha-ankle': 2, 'mecha-foot': 2, 'mecha-shoulder': 2, 'mecha-upperarm': 2, 'mecha-forearm': 2, 'mecha-wrist': 2, 'mecha-claw': 2, 'mecha-ram': 12 }),
  }),
  // the giant arm walker: the heavy walker's cab, its station and its modular arms, on a more robust pelvis and legs (the
  // utility walker's designs at 1.6 times, its feet at 2.2), carrying a giant arm pack on its back: two giant arms on
  // armoured shoulders over the cab's roof, fed by the pack's own power unit, fitted by their own tasks
  giantArmWalker: Object.freeze({
    label: 'giant arm walker',
    mount: Object.freeze({ tools: Object.freeze(['grapple', 'bucket', 'breaker', 'crusher', 'forks', 'auger', 'vacuum', 'magnet', 'hook']), arms: Object.freeze(['standard', 'long']), loadout: Object.freeze({ r: Object.freeze({ tool: 'grapple', arm: 'standard' }), l: Object.freeze({ tool: 'grapple', arm: 'standard' }) }) }),
    packMount: Object.freeze({ tools: Object.freeze(['giantHand', 'giantGrapple', 'spreader', 'prop', 'shear', 'vibro', 'clamshell', 'giantHook']), loadout: Object.freeze({ r: Object.freeze({ tool: 'giantHand' }), l: Object.freeze({ tool: 'giantHand' }) }) }),
    classOf: 'heavy construction biped, closed cab, two arms and a giant arm pack',
    palette: 'siteYellow',
    mass: 4900,
    rider: Object.freeze({ mass: 95, com: Object.freeze([0, 0.08, 0.15]) }),
    posture: 'operator',
    station: 'seat',
    bend: 'forward',
    envelope: Object.freeze([
      Object.freeze({ x: 0.24, y: Object.freeze([-0.3, 0.3]), z: Object.freeze([0.67, 1.58]) }),
      Object.freeze({ x: 0.22, y: Object.freeze([-0.2, 0.5]), z: Object.freeze([0.21, 0.67]) }),
    ]),
    joints: Object.freeze({ ...GR.joints, ...GL.joints, ...HAR.joints, ...HAL.joints, ...GPR.joints, ...GPL.joints }),
    layout: Object.freeze([
      { id: 'pelvis', sku: 'pelvis-gw' },
      { id: 'seat', sku: 'station-gw', on: 'pelvis.seat' },
      { id: 'cage', sku: 'cab-hw', on: 'pelvis.cage' },
      { id: 'pack', sku: 'gap-gw', on: 'pelvis.pack' },
      ...GR.layout, ...GL.layout, ...HAR.layout, ...HAL.layout, ...GPR.layout, ...GPL.layout,
    ].map(Object.freeze)),
    legs: Object.freeze({ r: Object.freeze(GR.legs), l: Object.freeze(GL.legs) }),
    arms: Object.freeze({ r: Object.freeze(HAR.arms), l: Object.freeze(HAL.arms) }),
    packArms: Object.freeze({ r: Object.freeze(GPR.arms), l: Object.freeze(GPL.arms) }),
    armPoses: ARM_POSES,
    track: 0.8,
    stances: Object.freeze({
      stand: Object.freeze({ knee: 45, arms: 'rest', packArms: 'stow' }),
      board: Object.freeze({ knee: 110, fore: 0.16, track: 0.86, arms: 'rest', packArms: 'stow' }),
      stride: Object.freeze({ height: 'stand', arms: 'rest', packArms: 'stow', feet: Object.freeze({ r: Object.freeze({ y: 0.48 }), l: Object.freeze({ y: -0.48 }) }) }),
      lift: Object.freeze({ knee: 40, sway: 'l', arms: 'rest', packArms: 'stow', feet: Object.freeze({ r: Object.freeze({ y: 0.24, lift: 0.34 }) }) }),
      turn: Object.freeze({ knee: 45, arms: 'rest', packArms: 'stow', feet: Object.freeze({ r: Object.freeze({ yaw: 15 }), l: Object.freeze({ yaw: 15 }) }) }),
      carry: Object.freeze({ knee: 50, arms: 'carry', packArms: 'stow', load: 400 }),
      // (a heavy load ahead in the giant arms' hands, the frame's own arms at rest: a beam, a slab, a section of pipe)
      heave: Object.freeze({ knee: 50, arms: 'rest', packArms: 'carry', load: 2000, loadOn: 'packArms' }),
      // (the giant arms raised high: a load lifted into place overhead)
      hoist: Object.freeze({ knee: 45, arms: 'rest', packArms: 'raise' }),
    }),
    rest: 'stand',
    laws: Object.freeze({
      arcs: Object.freeze({ hipRoll: [40, 64], hipPitch: [110, 140], knee: [100, 125], anklePitch: [60, 85], shoulderPitch: [120, 150], elbow: [100, 130], giantShoulderPitch: [120, 150], giantElbow: [100, 130] }),
      knee: [25, 60],
      stability: [0.05, 1],
      sway: [0.02, 1],
      actuators: [0, 0.8],
      groundPressure: [25, 70],
      step: [0.45, 1.4],
      stride: [0.5, 1.0],
      seat: [2.3, 3.1],
      board: [1.8, 2.6],
      stepIn: [0.3, 0.6],
      tipover: [0.03, 9],
      clearance: [0.01, 9],
      cab: [0.03, 1],
      flow: [0, 1],
      reach: [1.6, 3.2],
      lift: [100, 1500],
      // (a reach-first house's long forearm with a shoring prop on it reaches past 4 m)
      packReach: [2.0, 4.5],
      packLift: [500, 6000],
      mass: 0.1,
      distal: [0, 0.45],
    }),
    bom: Object.freeze({ 'mecha-pelvis': 1, 'mecha-seat': 1, 'mecha-cage': 1, 'mecha-pack': 1, 'mecha-hip': 2, 'mecha-yoke': 2, 'mecha-thigh': 2, 'mecha-shank': 2, 'mecha-ankle': 2, 'mecha-foot': 2, 'mecha-shoulder': 4, 'mecha-upperarm': 4, 'mecha-forearm': 4, 'mecha-wrist': 4, 'mecha-claw': 2, 'mecha-tool': 2, 'mecha-ram': 16 }),
  }),
});

// the rover walker: the field walker on four wheels, armed. Each knee carries a wheel on its own axis, outboard, and each
// foot a wheel on a fork ahead of its toe; walking, they ride clear of the ground. Collapsed (its `roll` stance), the
// thighs rake back and the knees fold until the rear wheels take the ground, the feet pitch toe-down onto the front
// wheels, the cleated soles lifted clear: it rolls as a four-wheeler does, its hub motors skid-steering each side. It
// carries the heavy weapons backpack as built (an autocannon right, the five-round rocket launcher left, the service
// tail), on heavy-duty hip roll rams
const RW_LEG = Object.freeze({ hip: 'hip-rw', yoke: 'yoke-rw', thigh: 'thigh-rw', shank: 'shank-rw', ankle: 'ankle-rw', foot: 'foot-rw', roll: 'ram-roll-rw', hipRam: 'ram-hip-rw', kneeRam: null, ankleRam: 'ram-ankle-rw' });
/** A leg whose knee is a rotary drive in its shank, not a ram (it folds past what a ram's stroke allows). */
const driveKnee = (L, S) => ({
  ...L,
  joints: { ...L.joints, [`knee${S}`]: Object.freeze({ ...L.joints[`knee${S}`], ram: undefined, drive: `shank${S}` }) },
  layout: L.layout.filter((e) => e.id !== `kneeRam${S}`),
});
const WR = driveKnee(leg('R', RW_LEG), 'R'), WL = driveKnee(leg('L', RW_LEG), 'L'), HEAVY_PACK = MECHA_BACKPACKS.heavyWeapons, ROVER_PACK = backpackLayout(HEAVY_PACK, HEAVY_PACK.loadout);
const wheelsOf = (S) => { const s = S.toLowerCase(); return [
  { id: `rearWheel${S}`, sku: 'wheel-rw', side: s, on: `shank${S}.wheel`, wheel: 'rear' },
  { id: `frontWheel${S}`, sku: 'wheel-rw', side: s, on: `ankle${S}.wheel`, wheel: 'front' },
]; };
const F0 = BASE_ARCHETYPES.fieldWalker;
const roverWalker = Object.freeze({
  ...F0,
  label: 'rover walker',
  classOf: 'ridden biped walker on four wheels, armed, its rider in an armoured cabin: it walks, or collapses its legs and rolls as an armoured car',
  // (its armoured cabin its own; the field walker's open one in its place, lighter, as the option)
  cabins: Object.freeze({
    armoured: Object.freeze({ sku: 'cabin-fw', label: 'its armoured cabin' }),
    open: Object.freeze({ sku: 'cage-fw', label: 'its open cabin', mass: -120, laws: Object.freeze({ cab: undefined }) }),
  }),
  mass: 1700,
  joints: Object.freeze({ ...WR.joints, ...WL.joints, ...ROVER_PACK.joints }),
  layout: Object.freeze([
    { id: 'pelvis', sku: 'pelvis-rw' },
    ...F0.layout.filter((e) => e.id === 'seat'),
    // (its armoured cabin as built: the hull it rolls as)
    { id: 'cage', sku: 'cabin-fw', on: 'pelvis.cage' },
    { id: 'pack', sku: HEAVY_PACK.sku, on: 'pelvis.pack' },
    ...WR.layout, ...WL.layout, ...wheelsOf('R'), ...wheelsOf('L'), ...ROVER_PACK.layout,
  ].map(Object.freeze)),
  legs: Object.freeze({ r: Object.freeze(WR.legs), l: Object.freeze(WL.legs) }),
  wheels: Object.freeze(['R', 'L'].flatMap((S) => wheelsOf(S).map((e) => Object.freeze({ id: e.id, axle: e.wheel, side: e.side })))),
  backpacks: Object.freeze([]),
  // (it fires collapsed on its wheels, its longest, lowest footing: the recoil law reads it there)
  fireStance: 'roll',
  backpack: 'heavyWeapons', weapons: HEAVY_PACK.loadout, tail: ROVER_PACK.tail, payloads: ROVER_PACK.payloads,
  stances: Object.freeze({
    ...F0.stances,
    brace: HEAVY_PACK.brace,
    ...Object.fromEntries(Object.keys(TAIL_POSES).filter((k) => k !== 'stow').map((k) => [k, Object.freeze({ knee: 45, tail: k })])),
    // (collapsed to roll: the thighs raked back toward level, the knees folded until the shanks lie level)
    roll: Object.freeze({ roll: true, pitch: -72 }),
    // (it is boarded collapsed, as a four-wheeler is: its saddle low, its step a short one up)
    board: Object.freeze({ roll: true, pitch: -72 }),
  }),
  dress: Object.freeze({ ...F0.dress, kit: Object.freeze(F0.dress.kit.filter((k) => k.body !== 'pack')) }),
  laws: Object.freeze({
    ...F0.laws, ...HEAVY_PACK.laws,
    // (rolling: its four wheels on the ground, what it carries clear above it, steady on its wheels, its legs' rams
    // holding it there)
    // (taller than the field walker standing, on its longer shanks and taller feet; boarded collapsed, lower; its ankle
    // rams' longer stroke folds its feet up as fenders)
    seat: Object.freeze([2.2, 2.9]), board: Object.freeze([0.9, 1.6]), stepIn: Object.freeze([0.15, 0.6]), belly: Object.freeze([1.2, 2.0]),
    arcs: Object.freeze({ ...F0.laws.arcs, anklePitch: Object.freeze([70, 135]) }),
    cab: Object.freeze([0.03, 1]),
    rollContact: Object.freeze([0, 0.01]), rollClearance: Object.freeze([0.1, 9]), rollStability: Object.freeze([0.05, 9]), rollActuators: Object.freeze([0, 0.8]),
  }),
  bom: Object.freeze({ 'mecha-pelvis': 1, 'mecha-seat': 1, 'mecha-cage': 1, 'mecha-pack': 1, 'mecha-hip': 2, 'mecha-yoke': 2, 'mecha-thigh': 2, 'mecha-shank': 2, 'mecha-ankle': 2, 'mecha-foot': 2, 'mecha-ram': 6, 'mecha-wheel': 4, 'mecha-mount': 4, 'mecha-weapon': 4, 'mecha-tail': 4 }),
});
// the siege walker: the rover walker's principles at 2.5 times its size. Its legs collapse far out: shanks long enough
// to carry a third wheel between the knee's and the ankle's, so it rolls on six, its footprint reaching well ahead of
// and behind its hips. Its cockpit, human-sized, rides out ahead on a keel, a V-bottomed armoured prow off its pelvis,
// the camera on the cockpit's roof augmented by a spherical radar dome, a rotary machine gun on the cockpit's side. Its
// siege backpack carries a howitzer right and an eighteen-cell missile launcher left, a scorpion's tail each side to
// reload them from behind
const SW_LEG = Object.freeze({ hip: 'hip-sw', yoke: 'yoke-sw', thigh: 'thigh-sw', shank: 'shank-sw', ankle: 'ankle-sw', foot: 'foot-sw', roll: 'ram-roll-sw', hipRam: 'ram-hip-sw', kneeRam: null, ankleRam: 'ram-ankle-sw' });
const SR = driveKnee(leg('R', SW_LEG), 'R'), SL = driveKnee(leg('L', SW_LEG), 'L'), SIEGE_PACK = MECHA_BACKPACKS.siege, SIEGE_LAYOUT = backpackLayout(SIEGE_PACK, SIEGE_PACK.loadout);
const siegeWheels = (S) => { const s = S.toLowerCase(); return [
  { id: `rearWheel${S}`, sku: 'wheel-sw', side: s, on: `shank${S}.wheel`, wheel: 'rear' },
  { id: `midWheel${S}`, sku: 'wheel-sw', side: s, on: `shank${S}.wheelMid`, wheel: 'mid' },
  { id: `frontWheel${S}`, sku: 'wheel-sw', side: s, on: `shank${S}.wheelFront`, wheel: 'front' },
]; };
// (its clawed feet's toes: two a foot, a root segment on the palm's knuckle and a claw segment on its end, each on its
// knuckle's drive; flat walking, `curl` their clench collapsed, down and under the palm's front)
const siegeToes = (S) => { const s = S.toLowerCase(), out = { joints: {}, layout: [], bodies: [], ids: [] };
  for (const T of ['A', 'B']) {
    const root = `toe${T}${S}`, claw = `claw${T}${S}`;
    out.joints[root] = Object.freeze({ kind: 'hinge', drive: `toeRoot${T}${S}`, toe: true, curl: -40 });
    out.joints[claw] = Object.freeze({ kind: 'hinge', drive: `toeClaw${T}${S}`, toe: true, curl: -110 });
    out.layout.push(
      { id: `toeRoot${T}${S}`, sku: 'toe1-sw', side: s, on: `foot${S}.toe.${T.toLowerCase()}`, joint: root },
      { id: `toeClaw${T}${S}`, sku: 'toe2-sw', side: s, on: `toeRoot${T}${S}.end`, joint: claw },
    );
    out.bodies.push(`toeRoot${T}${S}`, `toeClaw${T}${S}`); out.ids.push(root, claw);
  }
  return out;
};
const STR = siegeToes('R'), STL = siegeToes('L');
// (the rider's space where the cockpit rides on its keel: the walker's, carried out to it)
const KEEL = Object.freeze([0, 3.3, 0.42 - 0.096]);
const siegeWalker = Object.freeze({
  ...F0,
  label: 'siege walker',
  classOf: 'ridden biped walker on six wheels, its cockpit out on a keel, a howitzer and a missile launcher on its back: it walks, or collapses its legs and rolls',
  mass: 32000,
  cabins: undefined,
  rider: Object.freeze({ mass: 110, com: Object.freeze([0, 3.3 + 0.12, 0.42 + 0.3]) }),
  envelope: Object.freeze(F0.envelope.map((E) => Object.freeze({ x: E.x, y: Object.freeze(E.y.map((y) => y + KEEL[1])), z: Object.freeze(E.z.map((z) => z + KEEL[2])) }))),
  joints: Object.freeze({
    ...SR.joints, ...SL.joints, ...STR.joints, ...STL.joints, ...SIEGE_LAYOUT.joints,
    traverseC: Object.freeze({ kind: 'slew', drive: 'mountC' }), elevateC: Object.freeze({ kind: 'hinge', drive: 'cradleC' }),
  }),
  layout: Object.freeze([
    { id: 'pelvis', sku: 'pelvis-sw' },
    { id: 'seat', sku: 'seat-sw', on: 'pelvis.seat' },
    { id: 'cage', sku: 'cabin-sw', on: 'pelvis.cage' },
    { id: 'pack', sku: SIEGE_PACK.sku, on: 'pelvis.pack' },
    ...SR.layout, ...SL.layout, ...STR.layout, ...STL.layout, ...siegeWheels('R'), ...siegeWheels('L'), ...SIEGE_LAYOUT.layout,
    // (the cockpit's gun: a rotary machine gun on its own ring and cradle off the keel's side)
    { id: 'mountC', sku: 'mount-wpn', side: 'r', on: 'pelvis.sidegun', joint: 'traverseC' },
    { id: 'cradleC', sku: 'cradle-wpn', side: 'r', on: 'mountC.cradle', joint: 'elevateC' },
    { id: 'weaponC', sku: MECHA_WEAPONS.minigun.sku, side: 'r', on: 'cradleC.gun' },
  ].map(Object.freeze)),
  legs: Object.freeze({ r: Object.freeze(SR.legs), l: Object.freeze(SL.legs) }),
  toes: Object.freeze({ r: Object.freeze({ bodies: Object.freeze(STR.bodies), joints: Object.freeze(STR.ids) }), l: Object.freeze({ bodies: Object.freeze(STL.bodies), joints: Object.freeze(STL.ids) }) }),
  wheels: Object.freeze(['R', 'L'].flatMap((S) => siegeWheels(S).map((e) => Object.freeze({ id: e.id, axle: e.wheel, side: e.side })))),
  backpacks: Object.freeze([]),
  fireStance: 'roll',
  backpack: 'siege', weapons: SIEGE_PACK.loadout, tail: undefined, tails: SIEGE_LAYOUT.tails,
  payloads: Object.freeze({ ...SIEGE_LAYOUT.payloads, c: MECHA_WEAPONS.minigun }),
  track: 0.56 * 2.8,
  stances: Object.freeze({
    ...Object.fromEntries(Object.entries(F0.stances).map(([k, st]) => [k, st.feet ? Object.freeze({ ...st, feet: Object.freeze(Object.fromEntries(Object.entries(st.feet).map(([S, f]) => [S, Object.freeze({ ...f, ...(f.y !== undefined ? { y: f.y * 2.8 } : {}), ...(f.lift !== undefined ? { lift: f.lift * 2.8 } : {}) })]))) }) : st])),
    brace: SIEGE_PACK.brace,
    ...Object.fromEntries(Object.keys(TAIL_POSES).filter((k) => k !== 'stow').map((k) => [k, Object.freeze({ knee: 45, tail: k })])),
    // (collapsed: the thighs raked back toward level, the knees folded until the shanks lie level, three wheels a side down)
    // (its toes clenched under its palms, each foot tilted up from level until they clear the ground)
    roll: Object.freeze({ roll: true, pitch: -76, foot: 'level', clear: 0.15 }),
    board: Object.freeze({ roll: true, pitch: -76, foot: 'level', clear: 0.15 }),
    // (it stands as a T-rex balances: its knees bent deep, its long toes ahead under its keel)
    stand: Object.freeze({ knee: 62 }),
  }),
  dress: Object.freeze({ ...F0.dress, kit: Object.freeze(F0.dress.kit.filter((k) => k.body !== 'pack')) }),
  laws: Object.freeze({
    ...roverWalker.laws,
    // (its ankle's arc wider, to lay its foot level collapsed)
    arcs: Object.freeze({ ...roverWalker.laws.arcs, anklePitch: Object.freeze([70, 160]) }),
    stability: Object.freeze([0.05, 5]), knee: Object.freeze([25, 70]), seat: Object.freeze([4, 9]), board: Object.freeze([1, 4]), stepIn: Object.freeze([0.3, 3]), belly: Object.freeze([2, 8]),
    step: Object.freeze([0.6, 3]), stride: Object.freeze([0.8, 3]), groundPressure: Object.freeze([20, 200]), clearance: Object.freeze([0.01, 20]),
  }),
  bom: Object.freeze({ 'mecha-pelvis': 1, 'mecha-seat': 1, 'mecha-cage': 1, 'mecha-pack': 1, 'mecha-hip': 2, 'mecha-yoke': 2, 'mecha-thigh': 2, 'mecha-shank': 2, 'mecha-ankle': 2, 'mecha-foot': 2, 'mecha-toe': 8, 'mecha-ram': 6, 'mecha-wheel': 6, 'mecha-mount': 6, 'mecha-weapon': 5, 'mecha-tail': 8 }),
});
export const MECHA_ARCHETYPES = Object.freeze({ ...BASE_ARCHETYPES, roverWalker, siegeWalker });
export const MECHA_ARCHETYPE_IDS = Object.freeze(Object.keys(MECHA_ARCHETYPES));
