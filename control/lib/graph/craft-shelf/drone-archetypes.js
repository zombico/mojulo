/**
 * drone-archetypes — the drones the shelf's drone parts build (drone-odm.js), rows as every craft archetype is
 * (craft-archetypes.js's head says what a row holds), merged into CRAFT_ARCHETYPES. A multirotor's arms are radial: a
 * quad X is two mirrored pairs turned about the vertical by the layout's `yaw` (degrees, + turns +x toward the nose), a
 * motor on each arm's pad, a rotor on each motor's shaft. Its diagonals turn the same way: the rear pair wears the
 * counter-handed rotor, so with the mirror front-right and rear-left turn one way, front-left and rear-right the other.
 *
 * Every drone role has its earth drone and its starship drone (the shelf's rule: a game swaps the sky for the void and
 * keeps its cast); the starship drone is built from the same kinds of parts in the starship register.
 */

// the drones' jobs (merged into CRAFT_ROLES)
export const DRONE_ROLES = {
  survey: { label: 'survey drone', mission: 'film, map and inspect from the air: a steady eye and a long hover' },
};

export const DRONE_ARCHETYPES = {
  // ===== earth =================================================================================
  cameraQuad: {
    realm: 'earth', role: 'survey', palette: 'droneConsumer', class: 'camera quad', label: 'folding camera quad', classOf: 'folding camera quad class (0.9 kg)',
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
};
