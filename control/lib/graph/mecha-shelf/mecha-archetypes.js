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
 *   laws             the bands it is held to (mecha-laws.js)
 *   bom              its parts by kind
 *
 * Pure data. An archetype is a compatibility promise over what is minted.
 */

// (a leg's parts, by frame: the walker's, and the utility walker's bored up for its weight)
const ATW_LEG = Object.freeze({ hip: 'hip-atw', yoke: 'yoke-atw', thigh: 'thigh-atw', shank: 'shank-atw', ankle: 'ankle-atw', foot: 'foot-atw', roll: 'ram-roll-atw', hipRam: 'ram-hip-atw', kneeRam: 'ram-knee-atw', ankleRam: 'ram-ankle-atw' });
const HW_LEG = Object.freeze({ hip: 'hip-hw', yoke: 'yoke-hw', thigh: 'thigh-hw', shank: 'shank-hw', ankle: 'ankle-hw', foot: 'foot-hw', roll: 'ram-roll-hw', hipRam: 'ram-hip-hw', kneeRam: 'ram-knee-hw', ankleRam: 'ram-ankle-hw' });
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
const R = leg('R'), L = leg('L');
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

export const MECHA_ARCHETYPES = Object.freeze({
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
export const MECHA_ARCHETYPE_IDS = Object.freeze(Object.keys(MECHA_ARCHETYPES));
