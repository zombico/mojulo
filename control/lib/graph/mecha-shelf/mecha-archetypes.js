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
 *   posture          how its rider sits it (cycle-shelf/cycle-rider.js POSTURES)
 *   envelope         the rider's space in the pelvis's frame, boxes ({ x: half width, y: [aft, fore], z: [low, high] }):
 *                    the legs never enter it
 *   joints           { name: { kind, axis?, ram?, drive?, near? } } (con-chain.js; `drive` a rotary drive's body: its
 *                    row's `stop` the joint's range, its `torque` its rating)
 *   layout           the bodies on their joints and the rams across them (con-chain.js's entries; `side` a leg's hand)
 *   legs             { r: { hip, roll, pitch, knee, ankle, foot, joints: { yaw, roll, pitch, knee, anklePitch, ankleRoll } } }:
 *                    the bodies and joints of each leg, by what they are (mecha-ik.js solves them)
 *   stances          named stances (mecha-ik.js): what its pelvis and its feet do, solved to joint values
 *   laws             the bands it is held to (mecha-laws.js)
 *   bom              its parts by kind
 *
 * Pure data. An archetype is a compatibility promise over what is minted.
 */

const leg = (S) => {
  const s = S.toLowerCase();
  return {
    joints: {
      [`hipYaw${S}`]: Object.freeze({ kind: 'slew', drive: `hip${S}` }),
      [`hipRoll${S}`]: Object.freeze({ kind: 'hinge', axis: Object.freeze([0, 1, 0]), ram: `rollRam${S}`, near: 0 }),
      [`hipPitch${S}`]: Object.freeze({ kind: 'hinge', ram: `hipRam${S}`, near: 30 }),
      [`knee${S}`]: Object.freeze({ kind: 'hinge', axis: Object.freeze([-1, 0, 0]), ram: `kneeRam${S}`, near: 60 }),
      [`anklePitch${S}`]: Object.freeze({ kind: 'hinge', ram: `ankleRam${S}`, near: 10 }),
      [`ankleRoll${S}`]: Object.freeze({ kind: 'hinge', axis: Object.freeze([0, 1, 0]), drive: `ankle${S}` }),
    },
    layout: [
      { id: `hip${S}`, sku: 'hip-atw', side: s, on: `pelvis.hip.${s}`, joint: `hipYaw${S}` },
      { id: `yoke${S}`, sku: 'yoke-atw', side: s, on: `hip${S}.roll`, joint: `hipRoll${S}` },
      { id: `thigh${S}`, sku: 'thigh-atw', side: s, on: `yoke${S}.pitch`, joint: `hipPitch${S}` },
      { id: `shank${S}`, sku: 'shank-atw', side: s, on: `thigh${S}.knee`, joint: `knee${S}` },
      { id: `ankle${S}`, sku: 'ankle-atw', side: s, on: `shank${S}.ankle`, joint: `anklePitch${S}` },
      { id: `foot${S}`, sku: 'foot-atw', side: s, on: `ankle${S}.roll`, joint: `ankleRoll${S}` },
      // (each ram's barrel at the body nearer the hip, its rod toward the foot: the leg's mass kept high)
      { id: `rollRam${S}`, sku: 'ram-roll-atw', side: s, ram: [`hip${S}.rollRam`, `yoke${S}.rollEye`] },
      { id: `hipRam${S}`, sku: 'ram-hip-atw', side: s, ram: [`yoke${S}.horn`, `thigh${S}.hipRam`] },
      { id: `kneeRam${S}`, sku: 'ram-knee-atw', side: s, ram: [`thigh${S}.kneeRam`, `shank${S}.kneeEye`] },
      { id: `ankleRam${S}`, sku: 'ram-ankle-atw', side: s, ram: [`shank${S}.ankleRam`, `ankle${S}.horn`] },
    ],
    legs: {
      hip: `hip${S}`, roll: `yoke${S}`, pitch: `thigh${S}`, knee: `shank${S}`, ankle: `ankle${S}`, foot: `foot${S}`,
      joints: { yaw: `hipYaw${S}`, roll: `hipRoll${S}`, pitch: `hipPitch${S}`, knee: `knee${S}`, anklePitch: `anklePitch${S}`, ankleRoll: `ankleRoll${S}` },
    },
  };
};
const R = leg('R'), L = leg('L');

export const MECHA_ARCHETYPES = Object.freeze({
  // the all-terrain walker: one rider astride a saddle on a pelvis, leaning onto clip-on bars as on a sport motorcycle, its
  // knees round the tank, its feet on pegs set back under the hips, a crash frame round it; two legs of six joints each
  // (hip yaw, roll and pitch, the knee, the ankle's pitch and roll), the battery low in the keel between the hips, the
  // hydraulic power unit under the tail; it stands with its knees bent and crouches to be boarded
  allTerrainWalker: Object.freeze({
    label: 'all-terrain walker',
    classOf: 'ridden biped walker, one rider astride',
    palette: 'proving',
    mass: 450,
    rider: Object.freeze({ mass: 95, com: Object.freeze([0, 0.12, 0.3]) }),
    // (it is ridden astride, leaning onto the bars as on a sport machine: cycle-shelf/cycle-rider.js's posture card)
    posture: 'sport',
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
      // (crouched for the rider to climb in: the feet set forward, the pelvis down until the knees are near their stop)
      board: Object.freeze({ knee: 110, fore: 0.1, track: 0.5 }),
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
      arcs: Object.freeze({ hipRoll: [40, 64], hipPitch: [110, 140], knee: [100, 125], anklePitch: [60, 85] }),
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
});
export const MECHA_ARCHETYPE_IDS = Object.freeze(Object.keys(MECHA_ARCHETYPES));
