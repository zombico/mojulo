/**
 * drone-archetypes — the drones the shelf's drone parts build (drone-odm.js), rows as every craft archetype is
 * (craft-archetypes.js's head says what a row holds), merged into CRAFT_ARCHETYPES. A multirotor's arms are radial: a
 * quad X is two mirrored pairs turned about the vertical by the layout's `yaw` (degrees, + turns +x toward the nose), a
 * motor on each arm's pad, a rotor on each motor's shaft. Its diagonals turn the same way: the rear pair wears the
 * counter-handed rotor, so with the mirror front-right and rear-left turn one way, front-left and rear-right the other.
 *
 * An earth drone names its stock look (`look`, drone-looks.js): the card it wears unless it is asked for another.
 *
 * Every drone role has its earth drone and its starship drone (the shelf's rule: a game swaps the sky for the void and
 * keeps its cast); the starship drone is built from the same kinds of parts in the starship register.
 */

import { DRONE_ODM } from './drone-odm.js';
import { CRAFT_ODM } from './craft-odm.js';

// the drones' jobs (merged into CRAFT_ROLES)
export const DRONE_ROLES = {
  survey: { label: 'survey drone', mission: 'film, map and inspect from the air: a steady eye and a long hover' },
  racer: { label: 'racing drone', mission: 'through the gates and the gaps, fast and flipped: flown from its camera' },
  delivery: { label: 'delivery drone', mission: 'a parcel to a door, lowered on its tether; home again' },
  agriculture: { label: 'agricultural drone', mission: 'spray and spread over a field, row by row, low and slow' },
  recon: { label: 'reconnaissance drone', mission: 'see from far and long: endurance, sensors, a long loiter over the ground' },
  loiter: { label: 'loitering munition', mission: 'wait over the ground, then dive on what it finds (modelled, never fired)' },
};
// a multirotor's layout from its frame: its arms (radial pairs by yaw), a motor and a rotor on each (an X8 a second
// motor and rotor under each arm, inverted), its skids, its payloads and masts
const MULTI = ({ frame, arms, motor, rotor, coax = null, guard = null, gear = null, payloads = [], masts = [] }) => [
  { id: 'frame', sku: frame },
  ...arms.flatMap(([id, sku, at, yaw], i) => {
    // (a coaxial pair: the lower the other hand's part, inverted with its motor; a mirror through its own plane keeps a
    // rotor's turn seen from above, so the other hand turns it against the one above)
    const hand = i % 2 === 0 ? 'ccw' : 'cw', other = hand === 'ccw' ? 'cw' : 'ccw';
    return [
      { id, sku, at: `frame.${at}`, pair: true, yaw },
      { id: `${id}Motor`, sku: motor, at: `${id}.motor`, pair: true },
      { id: `${id}Rotor`, sku: `${rotor}-${hand}`, at: `${id}Motor.shaft`, pair: true },
      ...(guard ? [{ id: `${id}Guard`, sku: guard, at: `${id}.motor`, pair: true }] : []),
      ...(coax ? [{ id: `${id}MotorLow`, sku: motor, at: `${id}.motorLow`, pair: true, flip: 'z' }, { id: `${id}RotorLow`, sku: `${rotor}-${other}`, at: `${id}MotorLow.shaft`, pair: true }] : []),
    ];
  }),
  ...(gear ? [{ id: 'gear', sku: gear, at: 'frame.gear', pair: true }] : []),
  ...payloads.map(([id, sku, at]) => ({ id, sku, at })),
  ...masts.map(([id, sku, at, pair]) => ({ id, sku, at, ...(pair ? { pair: true } : {}) })),
];
// a layout's bill of materials, counted from its rows' kinds
const bomOf = (layout) => layout.reduce((m, e) => { const k = DRONE_ODM[e.sku].kind; m[k] = (m[k] || 0) + (e.pair ? 2 : 1); return m; }, {});
// a fixed wing or a hybrid: its layout written out, the BOM counted from it (its parts the shelf's own kinds and the
// drone kinds both)
const fixed = (row, layout) => ({ ...row, bom: layout.reduce((m, e) => { const k = CRAFT_ODM[e.sku].kind; m[k] = (m[k] || 0) + (e.pair ? 2 : 1); return m; }, {}), layout });
const multirotor = (row, parts) => { const layout = MULTI(parts); return { ...row, bom: bomOf(layout), layout }; };
// a starship drone on four lift vents: its hull, two pairs of stubs, a vent on each, its payload under it
const probe = (row, { frame, arm, vent, yaw: [yf, yr], payload = null, payloadAt = 'bay' }) => {
  const layout = [
    { id: 'frame', sku: frame },
    { id: 'armF', sku: arm, at: 'frame.armFront', pair: true, yaw: yf },
    { id: 'armR', sku: arm, at: 'frame.armRear', pair: true, yaw: yr },
    { id: 'ventF', sku: vent, at: 'armF.motor', pair: true },
    { id: 'ventR', sku: vent, at: 'armR.motor', pair: true },
    ...(payload ? [{ id: 'payload', sku: payload, at: `frame.${payloadAt}` }] : []),
  ];
  return { ...row, bom: bomOf(layout), layout };
};

export const DRONE_ARCHETYPES = {
  // ===== earth =================================================================================
  cameraQuad: {
    realm: 'earth', look: 'consumer', role: 'survey', palette: 'droneConsumer', class: 'camera quad', label: 'folding camera quad', classOf: 'folding camera quad class (0.9 kg)',
    reference: { span: 0.55, length: 0.44, height: 0.12, mtow: 0.9 },
    bom: { 'drone-frame': 1, 'drone-arm': 4, 'drone-motor': 4, 'drone-rotor': 4, 'drone-payload': 1 },
    layout: [
      { id: 'frame', sku: 'frame-shell-camera' },
      { id: 'armF', sku: 'arm-fold-camera-front', at: 'frame.armFront', pair: true, yaw: 38 },
      { id: 'armR', sku: 'arm-fold-camera-rear', at: 'frame.armRear', pair: true, yaw: -38 },
      { id: 'motorF', sku: 'motor-1806', at: 'armF.motor', pair: true },
      { id: 'motorR', sku: 'motor-1806', at: 'armR.motor', pair: true },
      { id: 'rotorF', sku: 'rotor-2-9in-ccw', at: 'motorF.shaft', pair: true },
      { id: 'rotorR', sku: 'rotor-2-9in-cw', at: 'motorR.shaft', pair: true },
      { id: 'gimbal', sku: 'gimbal-3axis-camera', at: 'frame.gimbal' },
    ],
  },
  fpvRacer: multirotor({
    realm: 'earth', look: 'racer', role: 'racer', palette: 'fpvCarbon', class: 'racing quad', label: 'five-inch racing quad', classOf: '5-inch freestyle quad class (0.65 kg)',
    reference: { span: 0.27, length: 0.31, height: 0.1, mtow: 0.65 },
  }, { frame: 'frame-plate-fpv', arms: [['armF', 'arm-plate-fpv', 'armFront', 45], ['armR', 'arm-plate-fpv', 'armRear', -45]], motor: 'motor-2207', rotor: 'rotor-3-5in' }),
  inspectionQuad: multirotor({
    realm: 'earth', look: 'enterprise', role: 'survey', palette: 'droneEnterprise', class: 'inspection quad', label: 'enterprise inspection quad', classOf: 'enterprise inspection quad class (6 kg)',
    reference: { span: 1.24, length: 0.99, height: 0.45, mtow: 6 },
  }, {
    frame: 'frame-box-enterprise', arms: [['armF', 'arm-tube-enterprise', 'armFront', 45], ['armR', 'arm-tube-enterprise', 'armRear', -45]], motor: 'motor-4114', rotor: 'rotor-2-21in',
    gear: 'gear-skid-enterprise', payloads: [['gimbal', 'gimbal-3axis-zoom', 'frame.gimbal']], masts: [['gps', 'mast-gps-puck', 'frame.mast'], ['antenna', 'mast-paddle-enterprise', 'frame.antenna', true]],
  }),
  heavyHex: multirotor({
    realm: 'earth', look: 'enterprise', role: 'transport', palette: 'droneEnterprise', class: 'heavy-lift hexacopter', label: 'heavy-lift hexacopter', classOf: 'heavy-lift hexacopter class (25 kg)',
    reference: { span: 1.58, length: 1.42, height: 0.6, mtow: 25 },
  }, {
    frame: 'frame-hub-heavy', arms: [['armA', 'arm-tube-heavy', 'armA', 60], ['armB', 'arm-tube-heavy', 'armB', 0], ['armC', 'arm-tube-heavy', 'armC', -60]], motor: 'motor-6215', rotor: 'rotor-2-22in',
    gear: 'gear-skid-heavy', payloads: [['cargo', 'box-cargo-heavy', 'frame.bay']], masts: [['gps', 'mast-gps-puck', 'frame.mast']],
  }),
  coaxX8: multirotor({
    realm: 'earth', look: 'enterprise', role: 'survey', palette: 'droneEnterprise', class: 'coaxial octocopter', label: 'coaxial X8 mapper', classOf: 'coaxial X8 class (15 kg)',
    reference: { span: 1.21, length: 1.01, height: 0.54, mtow: 15 },
  }, {
    frame: 'frame-hub-x8', arms: [['armF', 'arm-tube-coax', 'armFront', 45], ['armR', 'arm-tube-coax', 'armRear', -45]], motor: 'motor-5010', rotor: 'rotor-2-18in', coax: true,
    gear: 'gear-skid-x8', payloads: [['lidar', 'lidar-puck', 'frame.bay']], masts: [['gps', 'mast-gps-puck', 'frame.mast']],
  }),
  cropSprayer: multirotor({
    realm: 'earth', look: 'enterprise', role: 'agriculture', palette: 'agriWhite', class: 'crop sprayer', label: 'agricultural spray hexacopter', classOf: 'agricultural spray hexacopter class (40 kg)',
    reference: { span: 2.25, length: 2.03, height: 0.88, mtow: 40 },
  }, {
    frame: 'frame-hub-agri', arms: [['armA', 'arm-tube-agri', 'armA', 60], ['armB', 'arm-tube-agri', 'armB', 0], ['armC', 'arm-tube-agri', 'armC', -60]], motor: 'motor-8120', rotor: 'rotor-2-30in',
    gear: 'gear-skid-agri', payloads: [['sprayer', 'sprayer-10l', 'frame.bay']], masts: [['gps', 'mast-gps-puck', 'frame.mast']],
  }),
  deliveryQuad: multirotor({
    realm: 'earth', look: 'enterprise', role: 'delivery', palette: 'droneParcel', class: 'delivery quad', label: 'ducted parcel delivery quad', classOf: 'parcel delivery quad class (9 kg)',
    reference: { span: 1.12, length: 1.03, height: 0.51, mtow: 9 },
  }, {
    frame: 'frame-box-delivery', arms: [['armF', 'arm-tube-delivery', 'armFront', 40], ['armR', 'arm-tube-delivery', 'armRear', -40]], motor: 'motor-4114', rotor: 'rotor-2-15in', guard: 'duct-15in',
    gear: 'gear-skid-delivery', payloads: [['parcel', 'box-parcel', 'frame.bay'], ['winch', 'winch-parcel', 'parcel.winch']], masts: [['gps', 'mast-gps-puck', 'frame.mast']],
  }),
  // ===== earth: the fixed wings and the hybrids ===============================================
  handLaunch: fixed({
    realm: 'earth', look: 'military', role: 'recon', palette: 'droneMilitary', class: 'hand-launched drone', label: 'hand-launched recon drone', classOf: 'hand-launched small UAS class (2 kg)',
    reference: { span: 1.38, length: 1.11, height: 0.28, mtow: 2 },
  }, [
    { id: 'hull', sku: 'fus-drone-hand' },
    { id: 'engine', sku: 'eng-drone-electric', at: 'hull.cowl' },
    { id: 'prop', sku: 'prop-drone-hand', at: 'engine.propHub' },
    { id: 'wing', sku: 'wing-drone-hand', at: 'hull.wingRoot', pair: true },
    { id: 'stab', sku: 'stab-drone-hand', at: 'hull.stabRoot', pair: true },
    { id: 'fin', sku: 'fin-drone-hand', at: 'hull.finRoot' },
    { id: 'sensor', sku: 'eoir-ball-small', at: 'hull.sensor' },
  ]),
  twinBoom: fixed({
    realm: 'earth', look: 'military', role: 'recon', palette: 'droneMilitary', class: 'twin-boom drone', label: 'catapult-launched twin-boom recon drone', classOf: 'tactical twin-boom UAS class (200 kg)',
    reference: { span: 4.41, length: 2.88, height: 1.27, mtow: 210 },
  }, [
    { id: 'hull', sku: 'fus-drone-tactical' },
    { id: 'wing', sku: 'wing-drone-tactical', at: 'hull.wingRoot', pair: true },
    { id: 'boom', sku: 'fus-drone-boom', at: 'wing.boom', pair: true },
    // (the H-tail's halves run inboard from each boom and meet at the middle)
    { id: 'stab', sku: 'stab-drone-tactical', at: 'boom.stabRoot', pair: true, flip: 'x' },
    { id: 'fin', sku: 'fin-drone-tactical', at: 'boom.finRoot', pair: true },
    // (a pusher: the engine at the pod's tail facing aft, its propeller behind it)
    { id: 'engine', sku: 'eng-drone-piston', at: 'hull.engine', flip: 'y' },
    { id: 'prop', sku: 'prop-drone-tactical', at: 'engine.propHub' },
    { id: 'nose', sku: 'gear-nose-drone-tactical', at: 'hull.noseGear' },
    { id: 'main', sku: 'gear-main-drone-tactical', at: 'hull.mainGear', pair: true },
    { id: 'sensor', sku: 'eoir-ball-medium', at: 'hull.sensor' },
  ]),
  maleRecon: fixed({
    realm: 'earth', look: 'military', role: 'recon', palette: 'droneMilitary', class: 'long-endurance drone', label: 'medium-altitude long-endurance recon drone', classOf: 'MALE UAS class (4.7 t)',
    reference: { span: 20.23, length: 11.71, height: 3.57, mtow: 4760 },
  }, [
    { id: 'hull', sku: 'fus-drone-male' },
    { id: 'wing', sku: 'wing-drone-male', at: 'hull.wingRoot', pair: true },
    { id: 'tail', sku: 'fin-drone-male-v', at: 'hull.tailRoot', pair: true },
    { id: 'ventral', sku: 'fin-drone-male-ventral', at: 'hull.ventral', flip: 'z' },
    { id: 'engine', sku: 'eng-drone-turboprop', at: 'hull.engine', flip: 'y' },
    { id: 'prop', sku: 'prop-drone-male', at: 'engine.propHub' },
    { id: 'nose', sku: 'gear-nose-drone-male', at: 'hull.noseGear' },
    { id: 'main', sku: 'gear-main-drone-male', at: 'hull.mainGear', pair: true },
    { id: 'sensor', sku: 'eoir-ball-large', at: 'hull.sensor' },
    { id: 'pylonIn', sku: 'pylon-drone-male', at: 'wing.storeIn', pair: true },
    { id: 'pylonOut', sku: 'pylon-drone-male', at: 'wing.storeOut', pair: true },
    { id: 'storeIn', sku: 'missile-agm-drone', at: 'pylonIn.carry', pair: true },
    { id: 'storeOut', sku: 'missile-agm-drone', at: 'pylonOut.carry', pair: true },
  ]),
  flyingWing: fixed({
    realm: 'earth', look: 'military', role: 'stealth', palette: 'droneMilitary', class: 'flying-wing drone', label: 'flying-wing combat drone', classOf: 'flying-wing combat UAS class (20 t)',
    reference: { span: 10.8, length: 9, height: 2.23, mtow: 20000 },
  }, [
    { id: 'hull', sku: 'fus-drone-blended' },
    { id: 'wing', sku: 'wing-drone-cranked', at: 'hull.wingRoot', pair: true },
    // (its legs the stealth jet's, the main pair set deeper in their wells so it stands level)
    { id: 'main', sku: 'gear-main-stealth', at: 'hull.mainGear', pair: true, offset: [0, 0, -0.14] },
    { id: 'nose', sku: 'gear-nose-stealth', at: 'hull.noseGear' },
  ]),
  quadplane: fixed({
    realm: 'earth', look: 'enterprise', role: 'survey', palette: 'droneEnterprise', class: 'quadplane', label: 'VTOL quadplane mapper', classOf: 'VTOL quadplane class (15 kg)',
    reference: { span: 2.96, length: 1.77, height: 0.79, mtow: 15 },
  }, [
    { id: 'hull', sku: 'fus-drone-quadplane' },
    { id: 'wing', sku: 'wing-drone-quadplane', at: 'hull.wingRoot', pair: true },
    // (its booms run from ahead of the wing to the tail, a lift rotor at each end)
    { id: 'boom', sku: 'fus-drone-qp-boom', at: 'wing.boom', pair: true, offset: [0, 0.48, 0] },
    { id: 'liftF', sku: 'motor-4114', at: 'boom.rotorFront', pair: true },
    { id: 'liftR', sku: 'motor-4114', at: 'boom.rotorRear', pair: true },
    { id: 'rotorF', sku: 'rotor-2-15in-ccw', at: 'liftF.shaft', pair: true },
    { id: 'rotorR', sku: 'rotor-2-15in-cw', at: 'liftR.shaft', pair: true },
    { id: 'stab', sku: 'stab-drone-quadplane', at: 'boom.stabRoot', pair: true, flip: 'x' },
    { id: 'fin', sku: 'fin-drone-quadplane', at: 'boom.finRoot', pair: true },
    { id: 'engine', sku: 'eng-drone-electric-pusher', at: 'hull.engine', flip: 'y' },
    { id: 'prop', sku: 'prop-drone-quadplane', at: 'engine.propHub' },
    { id: 'gear', sku: 'gear-skid-quadplane', at: 'hull.gear', pair: true },
    { id: 'sensor', sku: 'gimbal-3axis-zoom', at: 'hull.sensor' },
  ]),
  loiterMunition: fixed({
    realm: 'earth', look: 'military', role: 'loiter', palette: 'droneMilitary', class: 'loitering munition', label: 'tube-launched loitering munition', classOf: 'tube-launched loitering munition class (2.5 kg)',
    reference: { span: 0.6, length: 0.66, height: 0.15, mtow: 2.5 },
  }, [
    { id: 'hull', sku: 'fus-drone-loiter' },
    { id: 'wingF', sku: 'wing-drone-loiter-front', at: 'hull.wingFront', pair: true },
    { id: 'wingR', sku: 'wing-drone-loiter-rear', at: 'hull.wingRear', pair: true },
    { id: 'fin', sku: 'fin-drone-loiter', at: 'hull.finRoot' },
    { id: 'engine', sku: 'eng-drone-electric-tiny', at: 'hull.engine', flip: 'y' },
    { id: 'prop', sku: 'prop-drone-loiter', at: 'engine.propHub' },
  ]),
  // ===== space =================================================================================
  sentryProbe: {
    realm: 'space', role: 'survey', palette: 'interceptorSlate', class: 'sentry probe', label: 'four-vent sentry probe', classOf: 'sentry probe register',
    reference: { span: 0.83, length: 0.66, height: 0.31, mtow: 40 },
    bom: { 'drone-frame': 1, 'drone-arm': 4, 'drone-motor': 4, 'drone-payload': 1 },
    layout: [
      { id: 'frame', sku: 'frame-probe-sentry' },
      { id: 'armF', sku: 'arm-stub-probe', at: 'frame.armFront', pair: true, yaw: 30 },
      { id: 'armR', sku: 'arm-stub-probe', at: 'frame.armRear', pair: true, yaw: -30 },
      { id: 'ventF', sku: 'motor-vent-probe', at: 'armF.motor', pair: true },
      { id: 'ventR', sku: 'motor-vent-probe', at: 'armR.motor', pair: true },
      { id: 'eye', sku: 'eye-probe', at: 'frame.gimbal' },
    ],
  },
  dartProbe: probe({
    realm: 'space', role: 'racer', palette: 'scoutIvory', class: 'dart probe', label: 'dart racing probe', classOf: 'racing probe register',
    reference: { span: 0.43, length: 0.5, height: 0.14, mtow: 9 },
  }, { frame: 'frame-probe-dart', arm: 'arm-stub-dart', vent: 'motor-vent-dart', yaw: [25, -35] }),
  cargoProbe: probe({
    realm: 'space', role: 'delivery', palette: 'carrierBlue', class: 'cargo probe', label: 'four-vent cargo probe', classOf: 'cargo probe register',
    reference: { span: 1.22, length: 0.93, height: 0.63, mtow: 80 },
  }, { frame: 'frame-probe-hauler', arm: 'arm-stub-hauler', vent: 'motor-vent-hauler', yaw: [30, -30], payload: 'pod-cargo-probe' }),
  watchProbe: probe({
    realm: 'space', role: 'recon', palette: 'interceptorSlate', class: 'watch probe', label: 'long-eyed watch probe', classOf: 'racing probe register',
    reference: { span: 0.43, length: 0.51, height: 0.2, mtow: 10 },
  }, { frame: 'frame-probe-dart', arm: 'arm-stub-dart', vent: 'motor-vent-dart', yaw: [25, -35], payload: 'eye-probe', payloadAt: 'gimbal' }),
  seekerProbe: probe({
    realm: 'space', role: 'loiter', palette: 'interceptorSlate', class: 'seeker probe', label: 'seeker probe (modelled, never fired)', classOf: 'seeker probe register',
    reference: { span: 0.36, length: 0.42, height: 0.14, mtow: 5 },
  }, { frame: 'frame-probe-seeker', arm: 'arm-stub-dart', vent: 'motor-vent-dart', yaw: [30, -30] }),
  seederProbe: probe({
    realm: 'space', role: 'agriculture', palette: 'colonialSteel', class: 'seeder probe', label: 'four-vent seeder probe', classOf: 'seeder probe register',
    reference: { span: 1.22, length: 0.93, height: 0.76, mtow: 80 },
  }, { frame: 'frame-probe-hauler', arm: 'arm-stub-hauler', vent: 'motor-vent-hauler', yaw: [30, -30], payload: 'tank-seed-probe' }),
};
