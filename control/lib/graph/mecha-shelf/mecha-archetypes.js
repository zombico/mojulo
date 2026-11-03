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
/** An arm on one side, on the torso's shoulder: its yaw drive, its pitch and elbow on rams, a rotary wrist, a claw. */
const arm = (S) => {
  const s = S.toLowerCase();
  return {
    joints: {
      [`shoulderYaw${S}`]: Object.freeze({ kind: 'slew', drive: `shoulder${S}` }),
      [`shoulderPitch${S}`]: Object.freeze({ kind: 'hinge', ram: `shoulderRam${S}`, near: 40 }),
      [`elbow${S}`]: Object.freeze({ kind: 'hinge', ram: `elbowRam${S}`, near: 60 }),
      [`wrist${S}`]: Object.freeze({ kind: 'hinge', drive: `wrist${S}` }),
    },
    layout: [
      { id: `shoulder${S}`, sku: 'shoulder-uw', side: s, on: `cage.shoulder.${s}`, joint: `shoulderYaw${S}` },
      { id: `upperArm${S}`, sku: 'upperarm-uw', side: s, on: `shoulder${S}.pitch`, joint: `shoulderPitch${S}` },
      { id: `foreArm${S}`, sku: 'forearm-uw', side: s, on: `upperArm${S}.elbow`, joint: `elbow${S}` },
      { id: `wrist${S}`, sku: 'wrist-uw', side: s, on: `foreArm${S}.wrist`, joint: `wrist${S}` },
      { id: `claw${S}`, sku: 'claw-uw', side: s, on: `wrist${S}.claw` },
      { id: `shoulderRam${S}`, sku: 'ram-shoulder-uw', side: s, ram: [`shoulder${S}.horn`, `upperArm${S}.shoulderRam`] },
      { id: `elbowRam${S}`, sku: 'ram-elbow-uw', side: s, ram: [`upperArm${S}.elbowRam`, `foreArm${S}.elbowEye`] },
    ],
    arms: {
      shoulder: `shoulder${S}`, upper: `upperArm${S}`, fore: `foreArm${S}`, wrist: `wrist${S}`, claw: `claw${S}`,
      joints: { yaw: `shoulderYaw${S}`, pitch: `shoulderPitch${S}`, elbow: `elbow${S}`, wrist: `wrist${S}` },
    },
  };
};
const R = leg('R'), L = leg('L');
const UR = leg('R', UW_LEG, 'forward'), UL = leg('L', UW_LEG, 'forward'), AR = arm('R'), AL = arm('L');

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
  // the utility walker: a general-purpose work frame, its operator standing on a platform in a torso frame, leaning back on
  // a hip pad behind a waist rail, working two arms from a console at each hand; its legs knee-forward as a person's,
  // bored up for its weight and its load; its battery low in the keel, its power pack on the torso's back
  utilityWalker: Object.freeze({
    label: 'utility walker',
    classOf: 'standing-operator biped work frame, two arms',
    palette: 'proving',
    mass: 760,
    rider: Object.freeze({ mass: 95, com: Object.freeze([0, 0.08, 0.15]) }),
    posture: 'operator',
    station: 'platform',
    bend: 'forward',
    // (its operator's space: the body standing over the platform, the head under the hoop)
    envelope: Object.freeze([
      Object.freeze({ x: 0.24, y: Object.freeze([-0.27, 0.36]), z: Object.freeze([0.95, 1.9]) }),
      Object.freeze({ x: 0.22, y: Object.freeze([-0.22, 0.3]), z: Object.freeze([0.16, 0.95]) }),
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
    // (the arms' poses: each wrist's place from its shoulder's axle in the arm's plane [ahead, up], and its claw's angle
    // from hanging (90°: its fingers ahead))
    armPoses: Object.freeze({
      rest: Object.freeze({ wrist: Object.freeze([0.14, -0.94]), claw: 10 }),
      carry: Object.freeze({ wrist: Object.freeze([0.62, -0.42]), claw: 90 }),
      raise: Object.freeze({ wrist: Object.freeze([0.55, 0.45]), claw: 120 }),
    }),
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
      seat: [1.9, 2.4],
      board: [1.5, 1.9],
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
});
export const MECHA_ARCHETYPE_IDS = Object.freeze(Object.keys(MECHA_ARCHETYPES));
