/**
 * cycle-shelf/cycle-archetypes — the whole machines of the cycle shelf: the vehicles a rider sits astride and steers by
 * a bar (motorcycles, scooters and mopeds, bicycles and e-bikes, the ATV) and the three-wheelers a base machine becomes
 * with its add-ons (a sidecar, a trike axle, a cab, a carriage, a cargo box). The craft shelf's architecture on a shelf
 * of its own: a kind of part is a builder, a part is a row, a machine is a layout of parts, a look is a card.
 *
 * The vehicle registry's `cycle` handle (vehicle-registry/roster.js) names a key of this table; each key is claimed by
 * exactly one row (roster.test.js). A new machine is a registry row first, its archetype here after it.
 *
 * An archetype:
 *   label, classOf     what it is
 *   physics            its class in roads/vehicles.js: the wheelbase the chassis is solved to, the figures it is held to
 *   palette            its stock palette (cycle-common.js)
 *   chassis            its card: the steering geometry (rake, the fork's offset), and where on THIS machine each part
 *                      sits (cycle-chassis.js solves the rest)
 *   laws               the bands its geometry is held to (cycle-laws.js)
 *   bom                the kinds it is built of, and how many
 *   layout             [{ id, sku, slot?, pair?, steers? }]: each part, `slot` the end it is on (front | rear), `pair` a
 *                      part built on both sides (its left copy the mirror of its right), `steers` a part that turns with
 *                      the bars about the steering axis
 *
 * Pure data: no clock, no dice.
 */

const MX_CHASSIS = Object.freeze({
  rake: 27,
  offset: 0.045,
  fork: { half: 0.105, length: 0.94, sLo: 0.62, sHi: 0.86 },
  bars: { rise: 0.035, forward: 0.02 },
  swingarm: { length: 0.58, height: 0.47, half: 0.13 },
  frame: {
    // (each side's spar, head to pivot plate; the right side's points, the left its mirror)
    spar: [[0.035, 1.13, 0.99], [0.11, 0.95, 0.9], [0.115, 0.72, 0.74], [0.115, 0.6, 0.62], [0.115, 0.58, 0.4]],
    down: [[0, 1.03, 0.55]],
    cradle: [[0.045, 0.99, 0.33], [0.045, 0.64, 0.32], [0.115, 0.58, 0.4]],
    sub: [[0.112, 0.73, 0.79], [0.085, 0.02, 0.89], [0.07, -0.16, 0.93]],
    strut: [[0.115, 0.6, 0.56], [0.085, 0.05, 0.885]],
  },
  shock: { top: [0, 0.5, 0.86], bottom: [0, 0.4, 0.36] },
  engine: { at: [0, 0.8, 0.47], half: [0.1, 0.17, 0.13] },
  radiator: { at: [0.13, 1.0, 0.74], lean: 18 },
  drive: { x: -0.105, front: [0.645, 0.45] },
  exhaust: { port: [0, 1.0, 0.79], header: [[0.04, 1.08, 0.68], [0.1, 1.05, 0.56], [0.15, 0.86, 0.56], [0.165, 0.62, 0.66], [0.17, 0.42, 0.78]], can: [[0.17, 0.4, 0.79], [0.17, -0.12, 0.93]] },
  tank: { y: [0.78, 1.08], z: [0.84, 0.98], width: 0.24 },
  seat: { y: [-0.14, 1.02], z: 0.965, nose: 1.0, ride: 0.35 },
  fenderFront: { mount: [0, 1.18, 0.86], crown: [0, 1.55, 0.885], tip: [0, 1.93, 0.8] },
  fenderRear: { mount: [0, 0.12, 0.885], crown: [0, -0.12, 0.93], tip: [0, -0.36, 0.99] },
  plateFront: { s: 0.8, ahead: 0.1 },
  plateSide: { x: 0.105, outline: [[-0.1, 0.7], [0.28, 0.72], [0.3, 0.9], [-0.12, 0.92]] },
  shroud: { x: 0.155, outline: [[0.8, 0.93], [1.05, 1.02], [1.2, 1.0], [1.2, 0.8], [1.08, 0.64], [0.95, 0.66]] },
  peg: { at: [0.115, 0.5, 0.38], out: 0.12 },
  stand: { pivot: [-0.12, 0.52, 0.37], down: [-0.33, 0.56, 0.05], up: [-0.15, 0.15, 0.44] },
  brakes: { front: { x: -0.055, caliper: 145 }, rear: { x: 0.075, caliper: -120 } },
  hubs: { front: [-0.06, 0.06], rear: [-0.1, 0.085] },
});

export const CYCLE_ARCHETYPES = Object.freeze({
  dirtBike: Object.freeze({
    label: 'motocross bike',
    classOf: '450 cc motocross',
    physics: 'dirtBike',
    palette: 'mxRed',
    chassis: MX_CHASSIS,
    // the bands a motocross machine is held to (cycle-laws.js)
    laws: Object.freeze({ trail: [0.09, 0.15], seat: [0.92, 1.0], clearance: 0.3, lean: 50, stand: [5, 12] }),
    bom: Object.freeze({
      'cycle-frame': 1, 'cycle-fork': 1, 'cycle-swingarm': 1, 'cycle-shock': 1, 'cycle-wheel': 2, 'cycle-brake': 2, 'cycle-engine': 1,
      'cycle-radiator': 2, 'cycle-drive': 1, 'cycle-exhaust': 1, 'cycle-tank': 1, 'cycle-seat': 1, 'cycle-bars': 1, 'cycle-body': 7,
      'cycle-peg': 2, 'cycle-stand': 1,
    }),
    layout: Object.freeze([
      { id: 'frame', sku: 'frame-mx-spar' },
      { id: 'fork', sku: 'fork-usd-48', steers: true },
      { id: 'wheelF', sku: 'wheel-mx-21', slot: 'front', steers: true },
      { id: 'brakeF', sku: 'brake-disc-270', slot: 'front', steers: true },
      { id: 'swingarm', sku: 'swingarm-mx' },
      { id: 'wheelR', sku: 'wheel-mx-19', slot: 'rear' },
      { id: 'brakeR', sku: 'brake-disc-240', slot: 'rear' },
      { id: 'shock', sku: 'shock-mx' },
      { id: 'engine', sku: 'engine-single-450' },
      { id: 'radiator', sku: 'radiator-mx', pair: true },
      { id: 'drive', sku: 'drive-chain-520' },
      { id: 'exhaust', sku: 'exhaust-mx-single' },
      { id: 'tank', sku: 'tank-mx' },
      { id: 'seat', sku: 'seat-mx' },
      { id: 'bars', sku: 'bars-mx', steers: true },
      { id: 'fenderF', sku: 'fender-mx-front', slot: 'front', steers: true },
      { id: 'fenderR', sku: 'fender-mx-rear', slot: 'rear' },
      { id: 'plateF', sku: 'plate-mx-front', steers: true },
      { id: 'plateS', sku: 'plate-mx-side', pair: true },
      { id: 'shroud', sku: 'shroud-mx', pair: true },
      { id: 'peg', sku: 'peg-mx', pair: true },
      { id: 'stand', sku: 'stand-side-mx' },
    ]),
  }),
});
