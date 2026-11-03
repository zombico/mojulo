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
 *   posture            how its rider sits it (cycle-rider.js POSTURES)
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
import { CYCLE_ODM } from './cycle-odm.js';

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

// ── the road machines ─────────────────────────────────────────────────────
const STREET_CHASSIS = Object.freeze({
  rake: 24.8,
  offset: 0.035,
  fork: { half: 0.095, length: 0.76, sLo: 0.56, sHi: 0.72 },
  bars: { rise: 0.03, forward: 0.02 },
  swingarm: { length: 0.56, height: 0.42, half: 0.135 },
  frame: {
    trellis: { upper: [[0.045, 1.09, 0.9], [0.13, 0.86, 0.8], [0.12, 0.6, 0.62]], lower: [[0.045, 1.12, 0.8], [0.14, 0.93, 0.6], [0.12, 0.62, 0.48]], n: 6, r: 0.013 },
    tubes: [
      { id: 'sub', pts: [[0.12, 0.62, 0.66], [0.09, 0.0, 0.79], [0.07, -0.18, 0.82]], r: 0.011, pair: true },
      { id: 'strut', pts: [[0.12, 0.58, 0.5], [0.09, 0.06, 0.77]], r: 0.01, pair: true, bend: 0 },
    ],
    cross: [{ at: [0, 0.56, 0.68], half: 0.12 }],
  },
  shock: { top: [0, 0.56, 0.68], bottom: [0, 0.4, 0.33], link: [[0, 0.36, 0.38], [0, 0.4, 0.33], [0, 0.6, 0.3]] },
  engine: { at: [0, 0.82, 0.38], half: [0.13, 0.17, 0.12] },
  radiator: { at: [0, 1.07, 0.55], lean: 12 },
  drive: { x: -0.112, front: [0.66, 0.36] },
  exhaust: { pipes: [
    { pts: [[0.045, 1.0, 0.65], [0.05, 1.05, 0.48], [0.03, 0.97, 0.22], [0.06, 0.66, 0.2], [0.13, 0.46, 0.27]] },
    { pts: [[-0.045, 1.0, 0.65], [-0.05, 1.05, 0.48], [-0.02, 0.97, 0.23], [0.04, 0.8, 0.21]] },
    { pts: [[0.13, 0.46, 0.27], [0.14, 0.43, 0.28]], can: [[0.14, 0.44, 0.28], [0.16, 0.16, 0.38]], canR: 0.055 },
  ] },
  tank: { stations: [{ y: 0.64, z: 0.82, w: 0.18, h: 0.05 }, { y: 0.7, z: 0.85, w: 0.3, h: 0.13 }, { y: 0.88, z: 0.89, w: 0.36, h: 0.17 }, { y: 1.0, z: 0.88, w: 0.26, h: 0.13 }, { y: 1.06, z: 0.86, w: 0.12, h: 0.07 }], cap: [0, 0.9, 0.972] },
  seat: { stations: [{ y: -0.12, z: 0.83, w: 0.1, h: 0.04 }, { y: 0.02, z: 0.835, w: 0.2, h: 0.05 }, { y: 0.22, z: 0.83, w: 0.24, h: 0.06 }, { y: 0.3, z: 0.77, w: 0.27, h: 0.07 }, { y: 0.56, z: 0.775, w: 0.3, h: 0.07 }, { y: 0.66, z: 0.79, w: 0.2, h: 0.05 }], ride: 0.45, z: 0.81 },
  tail: { stations: [{ y: -0.3, z: 0.84, w: 0.05, h: 0.03 }, { y: -0.18, z: 0.82, w: 0.14, h: 0.06 }, { y: 0.02, z: 0.78, w: 0.22, h: 0.09 }, { y: 0.28, z: 0.72, w: 0.24, h: 0.08 }] },
  fenderFront: { mount: [0, 1.19, 0.55], crown: [0, 1.5, 0.7], tip: [0, 1.71, 0.44] },
  fenderRear: { mount: [0, -0.14, 0.74], crown: [0, -0.26, 0.72], tip: [0, -0.32, 0.6] },
  headLamp: { at: [0, 1.255, 0.88], dir: [0, 1, -0.08] },
  tailLamp: { at: [0, -0.305, 0.84] },
  peg: { at: [0.14, 0.47, 0.34], out: 0.08, hanger: [[0.4, 0.31], [0.56, 0.33], [0.56, 0.44], [0.46, 0.42]] },
  stand: { pivot: [-0.13, 0.5, 0.3], down: [-0.31, 0.54, 0.045], up: [-0.15, 0.2, 0.34] },
  brakes: { front: { x: 0.068, caliper: 140 }, rear: { x: 0.085, caliper: -110 } },
  hubs: { front: [-0.055, 0.055], rear: [-0.09, 0.09] },
});

const SPORT_CHASSIS = Object.freeze({
  rake: 23.5,
  offset: 0.03,
  fork: { half: 0.1, length: 0.74, sLo: 0.55, sHi: 0.7 },
  bars: { rise: 0.03, forward: 0.02 },
  swingarm: { length: 0.58, height: 0.42, half: 0.135 },
  frame: {
    tubes: [
      { id: 'spar', pts: ['head.hi', [0.12, 0.95, 0.8], [0.135, 0.7, 0.64], [0.13, 0.58, 0.46]], r: 0.032, pair: true, bend: 0.08, sides: 10 },
      { id: 'lower', pts: ['head.lo', [0.1, 1.02, 0.62], [0.12, 0.8, 0.5]], r: 0.02, pair: true },
      { id: 'sub', pts: [[0.11, 0.64, 0.68], [0.08, 0.0, 0.82], [0.06, -0.2, 0.88]], r: 0.012, pair: true },
    ],
    cross: [{ at: [0, 0.58, 0.68], half: 0.12 }],
  },
  shock: { top: [0, 0.58, 0.68], bottom: [0, 0.42, 0.34], link: [[0, 0.38, 0.39], [0, 0.42, 0.34], [0, 0.62, 0.32]] },
  engine: { at: [0, 0.84, 0.4], half: [0.15, 0.17, 0.12] },
  radiator: { at: [0, 1.08, 0.5], lean: 15 },
  drive: { x: -0.115, front: [0.68, 0.38] },
  exhaust: { pipes: [
    { pts: [[0.06, 1.03, 0.62], [0.07, 1.08, 0.45], [0.03, 0.98, 0.25], [0.06, 0.66, 0.23], [0.13, 0.46, 0.32]] },
    { pts: [[-0.06, 1.03, 0.62], [-0.07, 1.08, 0.45], [-0.02, 0.98, 0.26], [0.04, 0.8, 0.24]] },
    { pts: [[0.13, 0.46, 0.32], [0.14, 0.42, 0.35]], can: [[0.14, 0.44, 0.34], [0.16, 0.1, 0.52]], canR: 0.06 },
  ] },
  tank: { stations: [{ y: 0.64, z: 0.86, w: 0.2, h: 0.05 }, { y: 0.72, z: 0.88, w: 0.32, h: 0.14 }, { y: 0.9, z: 0.9, w: 0.36, h: 0.18 }, { y: 1.04, z: 0.88, w: 0.24, h: 0.13 }], cap: [0, 0.9, 0.99] },
  seat: { stations: [{ y: 0.1, z: 0.86, w: 0.18, h: 0.04 }, { y: 0.28, z: 0.8, w: 0.26, h: 0.06 }, { y: 0.55, z: 0.8, w: 0.28, h: 0.06 }, { y: 0.66, z: 0.82, w: 0.2, h: 0.05 }], ride: 0.42, z: 0.83 },
  tail: { stations: [{ y: -0.32, z: 0.92, w: 0.04, h: 0.03 }, { y: -0.2, z: 0.89, w: 0.14, h: 0.08 }, { y: 0.05, z: 0.84, w: 0.24, h: 0.12 }, { y: 0.3, z: 0.77, w: 0.26, h: 0.1 }] },
  fairing: { stations: [{ y: 1.0, z: 0.74, w: 0.42, h: 0.3, r: 0.1 }, { y: 1.2, z: 0.79, w: 0.38, h: 0.26, r: 0.1 }, { y: 1.36, z: 0.79, w: 0.24, h: 0.16, r: 0.07 }, { y: 1.47, z: 0.77, w: 0.06, h: 0.05, r: 0.02 }] },
  sides: { stations: [{ y: 0.72, z: 0.6, w: 0.3, h: 0.18, r: 0.08 }, { y: 0.86, z: 0.6, w: 0.4, h: 0.3, r: 0.1 }, { y: 1.04, z: 0.63, w: 0.42, h: 0.34, r: 0.12 }, { y: 1.12, z: 0.66, w: 0.4, h: 0.3, r: 0.12 }] },
  belly: { stations: [{ y: 0.56, z: 0.32, w: 0.2, h: 0.08 }, { y: 0.75, z: 0.31, w: 0.34, h: 0.13 }, { y: 1.02, z: 0.4, w: 0.38, h: 0.18 }, { y: 1.13, z: 0.48, w: 0.32, h: 0.16 }] },
  screen: { at: [0, 1.22, 1.0], tilt: 32 },
  fenderFront: { mount: [0, 1.2, 0.55], crown: [0, 1.51, 0.7], tip: [0, 1.72, 0.44] },
  fenderRear: { mount: [0, -0.1, 0.8], crown: [0, -0.2, 0.76], tip: [0, -0.27, 0.66] },
  headLamp: { at: [0, 1.43, 0.79], dir: [0, 1, 0] },
  tailLamp: { at: [0, -0.33, 0.91] },
  peg: { at: [0.15, 0.4, 0.38], out: 0.08, hanger: [[0.34, 0.35], [0.5, 0.4], [0.5, 0.5], [0.4, 0.46]] },
  stand: { pivot: [-0.13, 0.52, 0.3], down: [-0.31, 0.56, 0.045], up: [-0.15, 0.22, 0.34] },
  brakes: { front: { x: 0.068, caliper: 140 }, rear: { x: 0.085, caliper: -110 } },
  hubs: { front: [-0.055, 0.055], rear: [-0.09, 0.09] },
});

// (the grand prix machine: the sport bike's chassis on slicks, its bodywork and pegs raised for lean, no lamp or stand)
const RACE_CHASSIS = Object.freeze({
  ...SPORT_CHASSIS,
  rake: 23,
  offset: 0.025,
  seat: { stations: [{ y: 0.1, z: 0.9, w: 0.16, h: 0.05 }, { y: 0.28, z: 0.83, w: 0.24, h: 0.05 }, { y: 0.52, z: 0.83, w: 0.26, h: 0.05 }, { y: 0.64, z: 0.85, w: 0.18, h: 0.04 }], ride: 0.4, z: 0.855 },
  tail: { stations: [{ y: -0.3, z: 0.96, w: 0.04, h: 0.04 }, { y: -0.18, z: 0.93, w: 0.16, h: 0.1 }, { y: 0.05, z: 0.87, w: 0.24, h: 0.12 }, { y: 0.3, z: 0.8, w: 0.24, h: 0.1 }] },
  belly: { stations: [{ y: 0.6, z: 0.37, w: 0.18, h: 0.07 }, { y: 0.78, z: 0.36, w: 0.3, h: 0.1 }, { y: 1.02, z: 0.43, w: 0.34, h: 0.15 }, { y: 1.13, z: 0.5, w: 0.3, h: 0.14 }] },
  sides: { stations: [{ y: 0.72, z: 0.62, w: 0.28, h: 0.18, r: 0.08 }, { y: 0.86, z: 0.62, w: 0.38, h: 0.28, r: 0.1 }, { y: 1.04, z: 0.65, w: 0.4, h: 0.32, r: 0.12 }, { y: 1.12, z: 0.68, w: 0.38, h: 0.28, r: 0.12 }] },
  number: { stations: [{ y: 1.4, z: 0.8, w: 0.12, h: 0.12 }, { y: 1.46, z: 0.795, w: 0.13, h: 0.11 }] },
  exhaust: { pipes: [
    { pts: [[0.06, 1.03, 0.62], [0.07, 1.08, 0.48], [0.05, 0.98, 0.34], [0.09, 0.66, 0.4], [0.13, 0.46, 0.52]] },
    { pts: [[-0.06, 1.03, 0.62], [-0.07, 1.08, 0.48], [-0.02, 0.98, 0.35], [0.06, 0.8, 0.38]] },
    { pts: [[0.13, 0.46, 0.52], [0.14, 0.4, 0.58]], can: [[0.14, 0.42, 0.57], [0.15, 0.08, 0.74]], canR: 0.055 },
  ] },
  peg: { at: [0.14, 0.36, 0.44], out: 0.075, hanger: [[0.3, 0.41], [0.46, 0.46], [0.46, 0.56], [0.36, 0.52]] },
  fenderFront: { mount: [0, 1.24, 0.55], crown: [0, 1.55, 0.69], tip: [0, 1.74, 0.45] },
});

const CRUISER_CHASSIS = Object.freeze({
  rake: 32,
  offset: 0.055,
  fork: { half: 0.11, length: 0.88, sLo: 0.68, sHi: 0.84 },
  bars: { rise: 0.05, forward: 0.02 },
  swingarm: { length: 0.62, height: 0.4, half: 0.15 },
  frame: {
    tint: 'trim',
    tubes: [
      { id: 'backbone', pts: ['head.hi', [0, 1.0, 0.94], [0, 0.72, 0.84], [0, 0.62, 0.78]], r: 0.026, bend: 0.1 },
      { id: 'down', pts: ['head.lo', [0.08, 1.12, 0.5], [0.09, 1.04, 0.16], [0.09, 0.62, 0.15], [0.12, 0.58, 0.4], [0.1, 0.58, 0.72], [0, 0.62, 0.78]], r: 0.017, pair: true, bend: 0.07 },
      { id: 'rear', pts: [[0.1, 0.58, 0.68], [0.13, 0.15, 0.72], [0.13, -0.12, 0.76]], r: 0.014, pair: true },
    ],
    cross: [{ at: [0, 0.6, 0.15], half: 0.09 }],
  },
  shock: { x: 0.165, bottom: [0.1, 0.37], top: [0.16, 0.73] },
  engine: { at: [0, 0.94, 0.32], half: [0.11, 0.2, 0.13] },
  drive: { x: 0.125, front: [0.72, 0.3] },
  exhaust: { pipes: [
    { pts: [[0.05, 1.07, 0.66], [0.12, 1.12, 0.52], [0.17, 0.98, 0.27], [0.18, 0.42, 0.23]], can: [[0.18, 0.42, 0.23], [0.19, -0.28, 0.29]], canR: 0.048 },
    { pts: [[0.05, 0.82, 0.66], [0.14, 0.76, 0.52], [0.18, 0.6, 0.37], [0.18, 0.42, 0.37]], can: [[0.18, 0.42, 0.37], [0.19, -0.24, 0.43]], canR: 0.045 },
  ] },
  tank: { stations: [{ y: 0.72, z: 0.92, w: 0.22, h: 0.06 }, { y: 0.82, z: 0.95, w: 0.34, h: 0.14 }, { y: 1.0, z: 0.98, w: 0.38, h: 0.18 }, { y: 1.12, z: 0.99, w: 0.28, h: 0.14 }, { y: 1.18, z: 0.99, w: 0.14, h: 0.08 }], cap: [0, 0.97, 1.068] },
  seat: { stations: [{ y: 0.12, z: 0.74, w: 0.16, h: 0.06 }, { y: 0.3, z: 0.68, w: 0.34, h: 0.08 }, { y: 0.55, z: 0.66, w: 0.36, h: 0.07 }, { y: 0.72, z: 0.72, w: 0.2, h: 0.05 }], ride: 0.45, z: 0.7 },
  fenderFront: { mount: [0, 1.4, 0.64], crown: [0, 1.74, 0.79], tip: [0, 1.99, 0.48] },
  fenderRear: { mount: [0, 0.3, 0.71], crown: [0, -0.02, 0.8], tip: [0, -0.37, 0.5] },
  headLamp: { at: [0, 1.36, 0.93], dir: [0, 1, -0.05] },
  tailLamp: { at: [0, -0.33, 0.63] },
  peg: { at: [0.14, 1.0, 0.36], out: 0.11 },
  stand: { pivot: [-0.14, 0.75, 0.22], down: [-0.36, 0.8, 0.05], up: [-0.15, 0.4, 0.26] },
  brakes: { front: { x: -0.07, caliper: 140 }, rear: { x: -0.09, caliper: -110 } },
  hubs: { front: [-0.06, 0.06], rear: [-0.1, 0.1] },
});

// ── the step-throughs ─────────────────────────────────────────────────────
const SCOOTER_CHASSIS = Object.freeze({
  rake: 26,
  offset: 0.042,
  fork: { half: 0.075, length: 0.62, sLo: 0.48, sHi: 0.7 },
  bars: { rise: 0.03, forward: 0.02 },
  frame: { tubes: [{ id: 'spine', pts: ['head.lo', [0, 1.0, 0.36], [0, 0.5, 0.31], [0, 0.36, 0.5], [0, -0.12, 0.62]], r: 0.024, bend: 0.08 }] },
  cowl: { stations: [{ y: 0.9, z: 0.95, w: 0.24, h: 0.1 }, { y: 1.0, z: 0.97, w: 0.32, h: 0.14 }, { y: 1.1, z: 0.95, w: 0.2, h: 0.1 }] },
  headLamp: { at: [0, 1.11, 0.95], dir: [0, 1, 0] },
  tailLamp: { at: [0, -0.36, 0.68] },
  shield: { x: [-0.24, 0.24], outline: [[1.02, 0.36], [1.12, 0.41], [1.1, 0.9], [1.02, 0.95], [0.96, 0.9], [0.98, 0.41]] },
  rearBody: { stations: [{ y: -0.35, z: 0.68, w: 0.14, h: 0.12 }, { y: -0.2, z: 0.66, w: 0.34, h: 0.26 }, { y: 0.05, z: 0.62, w: 0.44, h: 0.34 }, { y: 0.3, z: 0.55, w: 0.4, h: 0.34 }, { y: 0.48, z: 0.46, w: 0.24, h: 0.18 }] },
  floor: { width: 0.32, outline: [[0.45, 0.29], [0.98, 0.29], [0.98, 0.335], [0.45, 0.335]], feet: 0.75 },
  seat: { stations: [{ y: -0.22, z: 0.82, w: 0.2, h: 0.07 }, { y: 0.0, z: 0.8, w: 0.34, h: 0.09 }, { y: 0.35, z: 0.78, w: 0.36, h: 0.09 }, { y: 0.52, z: 0.8, w: 0.26, h: 0.07 }], ride: 0.32, z: 0.825 },
  engine: { at: [0, 0.4, 0.3], caseX: -0.1 },
  shock: { top: [0.11, 0.1, 0.6], bottom: [0.11, -0.02, 0.32] },
  exhaust: { pipes: [{ pts: [[0, 0.58, 0.27], [0.06, 0.55, 0.2], [0.13, 0.35, 0.24]], can: [[0.13, 0.35, 0.26], [0.15, 0.02, 0.38]], canR: 0.05 }] },
  fenderFront: { mount: [0, 1.15, 0.5], crown: [0, 1.42, 0.62], tip: [0, 1.6, 0.4] },
  stand: { pivot: [-0.12, 0.45, 0.22], down: [-0.3, 0.5, 0.04], up: [-0.14, 0.2, 0.28] },
  brakes: { front: { x: -0.05, caliper: 140 }, rear: { x: 0.04 } },
  hubs: { front: [-0.05, 0.05], rear: [-0.07, 0.06] },
});

const MOPED_CHASSIS = Object.freeze({
  rake: 26.5,
  offset: 0.062,
  fork: { half: 0.08, length: 0.7, sLo: 0.56, sHi: 0.7 },
  bars: { rise: 0.03, forward: 0.02 },
  swingarm: { length: 0.52, height: 0.34, half: 0.1 },
  frame: {
    tint: 'trim',
    tubes: [{ id: 'spine', pts: ['head.lo', [0, 0.8, 0.55], [0, 0.55, 0.5], [0, 0.4, 0.6], [0, 0.0, 0.72]], r: 0.03, bend: 0.08 }, { id: 'loop', pts: [[0, 0.42, 0.58], [0.09, 0.2, 0.64], [0.1, -0.12, 0.68]], r: 0.012, pair: true }],
  },
  cowl: { stations: [{ y: 0.78, z: 0.93, w: 0.2, h: 0.1 }, { y: 0.9, z: 0.95, w: 0.26, h: 0.13 }, { y: 0.98, z: 0.94, w: 0.16, h: 0.1 }] },
  headLamp: { at: [0, 0.99, 0.94], dir: [0, 1, -0.05] },
  tailLamp: { at: [0, -0.25, 0.7] },
  shield: { x: [-0.18, 0.18], outline: [[0.86, 0.45], [0.92, 0.5], [0.9, 0.85], [0.84, 0.88], [0.8, 0.8], [0.82, 0.5]] },
  rearBody: { stations: [{ y: -0.22, z: 0.66, w: 0.1, h: 0.08 }, { y: 0.0, z: 0.64, w: 0.24, h: 0.16 }, { y: 0.3, z: 0.6, w: 0.26, h: 0.2 }, { y: 0.56, z: 0.58, w: 0.2, h: 0.16 }] },
  seat: { stations: [{ y: -0.12, z: 0.76, w: 0.18, h: 0.07 }, { y: 0.05, z: 0.755, w: 0.26, h: 0.08 }, { y: 0.4, z: 0.75, w: 0.27, h: 0.08 }, { y: 0.58, z: 0.76, w: 0.22, h: 0.06 }], ride: 0.35, z: 0.79 },
  engine: { at: [0, 0.62, 0.32], half: [0.09, 0.13, 0.1] },
  shock: { x: 0.11, bottom: [0.06, 0.33], top: [0.12, 0.66] },
  drive: { x: -0.08, front: [0.6, 0.3] },
  exhaust: { pipes: [{ pts: [[0, 0.8, 0.3], [0.04, 0.78, 0.2], [0.11, 0.55, 0.22]], can: [[0.11, 0.55, 0.23], [0.13, 0.05, 0.34]], canR: 0.042 }] },
  fenderFront: { mount: [0, 1.0, 0.5], crown: [0, 1.33, 0.64], tip: [0, 1.52, 0.38] },
  fenderRear: { mount: [0, 0.15, 0.62], crown: [0, -0.15, 0.66], tip: [0, -0.34, 0.44] },
  peg: { at: [0.11, 0.55, 0.28], out: 0.09 },
  stand: { pivot: [-0.11, 0.48, 0.25], down: [-0.28, 0.52, 0.04], up: [-0.12, 0.2, 0.3] },
  brakes: { front: { x: -0.03 }, rear: { x: 0.03 } },
  hubs: { front: [-0.045, 0.045], rear: [-0.06, 0.06] },
});

// ── pedalled ────────────────────────────────────────────────────────────────
const BICYCLE_CHASSIS = Object.freeze({
  rake: 18,
  offset: 0.051,
  fork: { half: 0.05, length: 0.4, sLo: 0.43, sHi: 0.58 },
  bb: [0, 0.424, 0.28],
  frame: {
    tint: 'paint',
    head: 0.019,
    tubes: [
      { id: 'top', pts: ['head.hi', [0, 0.26, 0.815]], r: 0.016, bend: 0 },
      { id: 'down', pts: ['head.lo', 'bb'], r: 0.019, bend: 0 },
      { id: 'seat', pts: ['bb', [0, 0.25, 0.85]], r: 0.015, bend: 0 },
      { id: 'seatstay', pts: [[0.02, 0.26, 0.8], [0.065, 0, 0.35]], r: 0.008, pair: true, bend: 0 },
      { id: 'chainstay', pts: [[0.03, 0.424, 0.28], [0.065, 0, 0.35]], r: 0.009, pair: true, bend: 0 },
    ],
  },
  seat: { post: [[0, 0.255, 0.83], [0, 0.215, 0.96]], stations: [{ y: 0.09, z: 0.985, w: 0.15, h: 0.04 }, { y: 0.17, z: 0.985, w: 0.13, h: 0.045 }, { y: 0.27, z: 0.98, w: 0.06, h: 0.035 }, { y: 0.36, z: 0.975, w: 0.035, h: 0.03 }], ride: 0.17, z: 1.005 },
  drive: { x: 0.045, crank: 0 },
  stand: { pivot: [-0.05, 0.3, 0.27], down: [-0.22, 0.25, 0.03], up: [-0.06, 0.02, 0.33] },
  brakes: { front: { x: -0.058, caliper: 135 }, rear: { x: -0.058, caliper: 70 } },
  hubs: { front: [-0.05, 0.05], rear: [-0.065, 0.065] },
});

const EBIKE_CHASSIS = Object.freeze({
  rake: 20,
  offset: 0.049,
  fork: { half: 0.055, length: 0.42, sLo: 0.45, sHi: 0.62 },
  bb: [0, 0.455, 0.28],
  frame: {
    tint: 'trim',
    head: 0.022,
    tubes: [
      { id: 'down', pts: ['head.lo', [0, 0.72, 0.42], 'bb'], r: 0.024, bend: 0.15 },
      { id: 'seat', pts: ['bb', [0, 0.3, 0.8]], r: 0.017, bend: 0 },
      { id: 'seatstay', pts: [[0.02, 0.31, 0.76], [0.07, 0, 0.35]], r: 0.009, pair: true, bend: 0 },
      { id: 'chainstay', pts: [[0.035, 0.455, 0.28], [0.07, 0, 0.35]], r: 0.011, pair: true, bend: 0 },
      { id: 'rack', pts: [[0.075, 0.24, 0.78], [0.08, -0.26, 0.8], [0.075, -0.02, 0.37]], r: 0.007, pair: true, bend: 0.03 },
    ],
    cross: [{ at: [0, 0.0, 0.795], half: 0.08, r: 0.006 }, { at: [0, -0.2, 0.8], half: 0.08, r: 0.006 }],
  },
  battery: { along: [[0, 0.88, 0.71], [0, 0.73, 0.47]] },
  seat: { post: [[0, 0.3, 0.8], [0, 0.255, 0.95]], stations: [{ y: 0.14, z: 0.98, w: 0.22, h: 0.06 }, { y: 0.22, z: 0.98, w: 0.2, h: 0.065 }, { y: 0.32, z: 0.975, w: 0.1, h: 0.05 }, { y: 0.4, z: 0.97, w: 0.05, h: 0.035 }], ride: 0.22, z: 1.01 },
  drive: { x: 0.05, crank: 0 },
  fenderFront: { mount: [0, 0.92, 0.696], crown: [0, 1.17, 0.85], tip: [0, 1.5, 0.49] },
  fenderRear: { mount: [0, 0.2, 0.696], crown: [0, -0.12, 0.86], tip: [0, -0.39, 0.42] },
  headLamp: { at: [0, 0.99, 0.76], dir: [0, 1, -0.05] },
  tailLamp: { at: [0, -0.275, 0.8] },
  stand: { pivot: [-0.05, 0.33, 0.27], down: [-0.22, 0.28, 0.03], up: [-0.06, 0.02, 0.33] },
  brakes: { front: { x: -0.058, caliper: 135 }, rear: { x: -0.06, caliper: 70 } },
  hubs: { front: [-0.05, 0.05], rear: [-0.07, 0.07] },
});

// ── three wheels and four ───────────────────────────────────────────────
const TRIKE_CHASSIS = Object.freeze({
  rake: 30,
  offset: 0.05,
  axle: 'rear',
  fork: { half: 0.11, length: 0.86, sLo: 0.66, sHi: 0.82 },
  bars: { rise: 0.09, forward: 0.02 },
  frame: {
    tint: 'trim',
    tubes: [
      { id: 'backbone', pts: ['head.hi', [0, 1.25, 0.95], [0, 0.75, 0.8], [0, 0.35, 0.72]], r: 0.026, bend: 0.1 },
      { id: 'down', pts: ['head.lo', [0.09, 1.55, 0.45], [0.1, 1.4, 0.22], [0.12, 0.45, 0.24], [0.12, 0.3, 0.42], [0.1, 0.35, 0.72], [0, 0.4, 0.74]], r: 0.018, pair: true, bend: 0.07 },
    ],
    cross: [{ at: [0, 0.42, 0.26], half: 0.12 }],
  },
  engine: { at: [0, 1.15, 0.38], half: [0.11, 0.2, 0.13] },
  drive: { x: -0.16, front: [0.98, 0.3] },
  exhaust: { pipes: [
    { pts: [[0.05, 1.27, 0.7], [0.14, 1.32, 0.55], [0.2, 1.18, 0.3], [0.24, 0.9, 0.3]], can: [[0.24, 0.9, 0.3], [0.27, 0.15, 0.33]], canR: 0.045 },
    { pts: [[0.05, 1.02, 0.7], [0.15, 0.96, 0.55], [0.2, 0.85, 0.36], [0.22, 0.75, 0.36]], can: [[0.22, 0.75, 0.36], [0.25, 0.15, 0.36]], canR: 0.042 },
  ] },
  tank: { stations: [{ y: 1.05, z: 0.97, w: 0.22, h: 0.06 }, { y: 1.15, z: 1.0, w: 0.34, h: 0.14 }, { y: 1.32, z: 1.02, w: 0.36, h: 0.17 }, { y: 1.45, z: 1.02, w: 0.24, h: 0.12 }, { y: 1.5, z: 1.01, w: 0.12, h: 0.06 }], cap: [0, 1.3, 1.105] },
  seat: { stations: [{ y: 0.4, z: 0.8, w: 0.3, h: 0.1 }, { y: 0.55, z: 0.74, w: 0.38, h: 0.08 }, { y: 0.85, z: 0.74, w: 0.36, h: 0.07 }, { y: 0.98, z: 0.78, w: 0.2, h: 0.05 }], ride: 0.72, z: 0.78 },
  deck: { stations: [{ y: -0.5, z: 0.6, w: 0.7, h: 0.3 }, { y: -0.3, z: 0.62, w: 0.95, h: 0.4 }, { y: 0.25, z: 0.62, w: 0.95, h: 0.4 }, { y: 0.42, z: 0.66, w: 0.6, h: 0.3 }] },
  fenderRear: { mount: [0.65, -0.3, 0.55], crown: [0.65, 0.0, 0.8], tip: [0.65, 0.32, 0.55] },
  fenderFront: { mount: [0, 1.75, 0.64], crown: [0, 2.08, 0.78], tip: [0, 2.33, 0.48] },
  headLamp: { at: [0, 1.74, 0.95], dir: [0, 1, -0.05] },
  tailLamp: { at: [0, -0.51, 0.64] },
  peg: { at: [0.15, 1.32, 0.34], out: 0.1 },
  brakes: { front: { x: -0.07, caliper: 140 } },
  hubs: { front: [-0.06, 0.06], rear: [-0.1, 0.1] },
});

const TUKTUK_CHASSIS = Object.freeze({
  rake: 24,
  offset: 0.04,
  axle: 'rear',
  fork: { half: 0.075, length: 0.72, sLo: 0.52, sHi: 0.7 },
  bars: { rise: 0.03, forward: 0.02 },
  frame: {
    tint: 'trim',
    tubes: [
      { id: 'spine', pts: ['head.lo', [0, 1.55, 0.3], [0, 0.5, 0.28], [0, -0.35, 0.34]], r: 0.03, bend: 0.1 },
      { id: 'rail', pts: [[0.47, 1.6, 0.3], [0.47, -0.38, 0.32]], r: 0.02, pair: true, bend: 0 },
    ],
    cross: [{ at: [0, 1.5, 0.3], half: 0.47 }, { at: [0, 0.4, 0.29], half: 0.47 }, { at: [0, -0.36, 0.33], half: 0.47 }],
  },
  cowl: { stations: [{ y: 1.58, z: 0.9, w: 0.24, h: 0.1 }, { y: 1.68, z: 0.92, w: 0.3, h: 0.13 }, { y: 1.78, z: 0.9, w: 0.18, h: 0.1 }] },
  shield: { x: [-0.55, 0.55], outline: [[1.74, 0.33], [1.84, 0.36], [1.84, 1.18], [1.76, 1.2], [1.7, 1.15], [1.7, 0.36]] },
  cab: {
    roof: [{ y: -0.38, z: 1.62, w: 1.15, h: 0.08 }, { y: 0.0, z: 1.65, w: 1.28, h: 0.1 }, { y: 1.2, z: 1.66, w: 1.28, h: 0.1 }, { y: 1.85, z: 1.6, w: 1.2, h: 0.08 }],
    pillars: [[0.6, 1.8, 0.4, 1.8, 1.6], [0.62, 0.85, 0.5, 0.85, 1.62], [0.6, -0.36, 0.5, -0.36, 1.6]],
    screen: { at: [0, 1.82, 1.4], w: 1.05, h: 0.38 },
    bench: [{ y: -0.3, z: 0.74, w: 1.05, h: 0.12 }, { y: 0.1, z: 0.74, w: 1.1, h: 0.14 }],
    back: [{ y: -0.36, z: 0.98, w: 1.05, h: 0.4 }, { y: -0.3, z: 1.0, w: 1.05, h: 0.42 }],
    body: [{ y: -0.4, z: 0.5, w: 0.9, h: 0.3 }, { y: 0.1, z: 0.5, w: 0.95, h: 0.34 }, { y: 0.5, z: 0.46, w: 0.6, h: 0.24 }],
    panel: { x: 0.58, outline: [[-0.4, 0.35], [-0.34, 0.35], [-0.34, 1.25], [-0.4, 1.28]] },
    passenger: [0, -0.1, 0.81],
  },
  seat: { stations: [{ y: 0.95, z: 0.8, w: 0.32, h: 0.1 }, { y: 1.22, z: 0.8, w: 0.34, h: 0.1 }, { y: 1.38, z: 0.78, w: 0.24, h: 0.08 }], ride: 1.12, z: 0.85 },
  floor: { width: 0.6, outline: [[1.35, 0.3], [1.68, 0.3], [1.68, 0.34], [1.35, 0.34]], feet: 1.55 },
  engine: { at: [0, 0.35, 0.38], half: [0.1, 0.14, 0.1] },
  drive: { x: -0.16, front: [0.42, 0.34] },
  fenderFront: { mount: [0, 1.85, 0.38], crown: [0, 2.03, 0.62], tip: [0, 2.24, 0.26] },
  headLamp: { at: [0, 1.86, 1.02], dir: [0, 1, 0] },
  tailLamp: { at: [0, -0.41, 0.7] },
  brakes: { front: { x: -0.05, caliper: 140 } },
  hubs: { front: [-0.045, 0.045], rear: [-0.06, 0.06] },
});

const RICKSHAW_CHASSIS = Object.freeze({
  rake: 18,
  offset: 0.051,
  axle: 'rear',
  fork: { half: 0.05, length: 0.4, sLo: 0.43, sHi: 0.58 },
  bb: [0, 1.044, 0.28],
  frame: {
    tint: 'paint',
    head: 0.019,
    tubes: [
      { id: 'top', pts: ['head.hi', [0, 0.88, 0.815]], r: 0.016, bend: 0 },
      { id: 'down', pts: ['head.lo', 'bb'], r: 0.019, bend: 0 },
      { id: 'seat', pts: ['bb', [0, 0.87, 0.85]], r: 0.015, bend: 0 },
      { id: 'boom', pts: [[0.02, 0.9, 0.78], [0.15, 0.45, 0.6], [0.42, 0.05, 0.42]], r: 0.016, pair: true, bend: 0.05 },
      { id: 'lower', pts: [[0.02, 1.0, 0.3], [0.2, 0.5, 0.33], [0.42, 0.05, 0.35]], r: 0.014, pair: true, bend: 0.05 },
    ],
  },
  carriage: {
    bench: [{ y: -0.38, z: 0.78, w: 0.95, h: 0.12 }, { y: 0.18, z: 0.78, w: 0.95, h: 0.12 }],
    back: [{ y: -0.42, z: 1.02, w: 0.95, h: 0.42 }, { y: -0.36, z: 1.04, w: 0.95, h: 0.44 }],
    foot: { x: 0.45, outline: [[0.25, 0.5], [0.62, 0.5], [0.62, 0.53], [0.25, 0.53]] },
    hood: { w: 0.56, z0: 0.95, h: 0.9, ribs: [-0.42, -0.2, 0.02] },
    passenger: [0, -0.1, 0.84],
  },
  seat: { post: [[0, 0.875, 0.83], [0, 0.835, 0.96]], stations: [{ y: 0.71, z: 0.985, w: 0.15, h: 0.04 }, { y: 0.79, z: 0.985, w: 0.13, h: 0.045 }, { y: 0.89, z: 0.98, w: 0.06, h: 0.035 }, { y: 0.98, z: 0.975, w: 0.035, h: 0.03 }], ride: 0.79, z: 1.005 },
  drive: { x: 0.045, crank: 0 },
  fenderRear: { mount: [0.5, -0.3, 0.5], crown: [0.5, 0, 0.82], tip: [0.5, 0.3, 0.5] },
  brakes: { front: { x: -0.058, caliper: 135 } },
  hubs: { front: [-0.05, 0.05], rear: [-0.06, 0.06] },
});

// (a box trike steers its box: the steering axis upright through its front axle, the bar on a rod back from the kingpin)
const BOXTRIKE_CHASSIS = Object.freeze({
  rake: 0,
  offset: 0,
  axle: 'front',
  fork: { half: 0.425, length: 0.65, sLo: 0.42, sHi: 0.65 },
  bb: [0, 0.8, 0.28],
  frame: {
    tint: 'paint',
    head: 0.024,
    tubes: [
      { id: 'boom', pts: ['head.lo', [0, 1.3, 0.62], [0, 0.95, 0.4], 'bb'], r: 0.024, bend: 0.08 },
      { id: 'top', pts: ['head.hi', [0, 1.35, 0.8], [0, 0.66, 0.8]], r: 0.018, bend: 0.06 },
      { id: 'seat', pts: ['bb', [0, 0.62, 0.84]], r: 0.016, bend: 0 },
      { id: 'seatstay', pts: [[0.02, 0.64, 0.8], [0.065, 0, 0.35]], r: 0.009, pair: true, bend: 0 },
      { id: 'chainstay', pts: [[0.03, 0.8, 0.28], [0.065, 0, 0.35]], r: 0.01, pair: true, bend: 0 },
    ],
  },
  box: { y: [1.4, 2.08], z: [0.3, 0.62], w: 0.74 },
  seat: { post: [[0, 0.62, 0.84], [0, 0.58, 0.96]], stations: [{ y: 0.46, z: 0.98, w: 0.22, h: 0.06 }, { y: 0.54, z: 0.98, w: 0.2, h: 0.065 }, { y: 0.64, z: 0.975, w: 0.1, h: 0.05 }, { y: 0.72, z: 0.97, w: 0.05, h: 0.035 }], ride: 0.54, z: 1.01 },
  drive: { x: 0.045, crank: 0 },
  brakes: { rear: { x: -0.058, caliper: 70 } },
  hubs: { front: [-0.04, 0.04], rear: [-0.065, 0.065] },
});

// (a quad: its front wheels on A-arms, each turning on its kingpin, steered from a column; its rear on a solid axle on a
// swingarm; its rider astride, the feet on its footrests)
const ATV_CHASSIS = Object.freeze({
  rake: 15,
  offset: 0.25,
  axle: 'both',
  fork: { half: 0.1, length: 0.8, sLo: 0.45, sHi: 0.72 },
  bars: { rise: 0.04, forward: 0.02 },
  swingarm: { length: 0.5, height: 0.36, half: 0.12 },
  frame: {
    tint: 'trim',
    tubes: [
      { id: 'upper', pts: [[0.14, 1.42, 0.5], [0.15, 0.95, 0.62], [0.15, 0.4, 0.68], [0.14, -0.25, 0.7]], r: 0.016, pair: true, bend: 0.06 },
      { id: 'lower', pts: [[0.13, 1.45, 0.24], [0.13, 0.62, 0.22], [0.12, 0.49, 0.36]], r: 0.016, pair: true, bend: 0.05 },
      { id: 'front', pts: [[0.13, 1.45, 0.24], [0.14, 1.42, 0.5]], r: 0.016, pair: true, bend: 0 },
      { id: 'post', pts: [[0.15, 0.95, 0.62], 'head.lo'], r: 0.014, pair: true, bend: 0 },
      { id: 'rackR', pts: [[0.35, -0.3, 0.84], [0.35, 0.18, 0.84]], r: 0.012, pair: true, bend: 0 },
      { id: 'rackF', pts: [[0.32, 1.12, 0.78], [0.32, 1.5, 0.78]], r: 0.012, pair: true, bend: 0 },
      { id: 'rackStay', pts: [[0.35, -0.2, 0.84], [0.15, -0.15, 0.7]], r: 0.01, pair: true, bend: 0 },
    ],
    cross: [{ at: [0, -0.3, 0.84], half: 0.35 }, { at: [0, 0.18, 0.84], half: 0.35 }, { at: [0, 1.5, 0.78], half: 0.32 }, { at: [0, 1.12, 0.78], half: 0.32 }],
  },
  arms: { inner: 0.15, knuckle: 0.08, lower: 0.22, upper: 0.42, shockTop: 0.62 },
  shock: { top: [0, 0.55, 0.66], bottom: [0, 0.32, 0.3] },
  engine: { at: [0, 0.75, 0.42], half: [0.1, 0.17, 0.13] },
  exhaust: { port: [0, 0.95, 0.75], pipes: [{ pts: [[0, 0.95, 0.75], [0.05, 1.0, 0.65], [0.16, 0.9, 0.5], [0.2, 0.5, 0.52], [0.22, 0.12, 0.55]], can: [[0.22, 0.12, 0.55], [0.24, -0.3, 0.58]], canR: 0.05 }] },
  drive: { x: -0.2, front: [0.62, 0.36] },
  seat: { stations: [{ y: 0.1, z: 0.84, w: 0.3, h: 0.1 }, { y: 0.4, z: 0.84, w: 0.34, h: 0.1 }, { y: 0.72, z: 0.82, w: 0.26, h: 0.08 }], ride: 0.42, z: 0.89 },
  podFront: { stations: [{ y: 0.95, z: 0.6, w: 0.9, h: 0.08 }, { y: 1.12, z: 0.66, w: 1.18, h: 0.1 }, { y: 1.38, z: 0.64, w: 1.18, h: 0.1 }, { y: 1.55, z: 0.52, w: 0.9, h: 0.08 }] },
  podRear: { stations: [{ y: -0.33, z: 0.64, w: 0.95, h: 0.08 }, { y: -0.15, z: 0.7, w: 1.18, h: 0.1 }, { y: 0.15, z: 0.7, w: 1.18, h: 0.1 }, { y: 0.35, z: 0.62, w: 0.95, h: 0.08 }] },
  headLamp: { at: [0, 1.56, 0.56], dir: [0, 1, 0] },
  peg: { at: [0.16, 0.6, 0.3], out: 0.2 },
  hubs: { front: [-0.07, 0.07], rear: [-0.09, 0.09] },
});

// ── the add-ons: what a machine takes to become another ──────────────────
/** A sidecar's card: its chair on the right, its wheel the outfit class's track off the centreline and its lead ahead of
 *  the rear axle (cycle-chassis.js). */
const SIDECAR_CARD = Object.freeze({ track: 1.1, chair: Object.freeze({ side: 'r', lead: 0.25 }) });
const SIDECAR_LAYOUT = Object.freeze([{ id: 'chair', sku: 'sidecar-touring' }, { id: 'wheelC', sku: 'wheel-chair-17', slot: 'chair' }]);

/** The bill of materials counted from a layout: a kind for each part, a pair two. */
const bomOf = (layout) => Object.freeze(layout.reduce((b, e) => { const k = CYCLE_ODM[e.sku].kind; b[k] = (b[k] ?? 0) + (e.pair ? 2 : 1); return b; }, {}));
const L = (id, sku, more = {}) => ({ id, sku, ...more });
const F = { steers: true, slot: 'front' };

/**
 * The add-ons the door takes on a machine (`addons` on assembleCycle and on the studio grid): each the parts it brings,
 * its card, the kinds it takes away (an outfit stands on its three wheels, not a stand), the layout it makes and the
 * layout it goes on.
 */
export const CYCLE_ADDONS = Object.freeze({
  sidecar: Object.freeze({ label: 'a sidecar on the right', on: 'inline', makes: 'sidecar', layout: SIDECAR_LAYOUT, card: SIDECAR_CARD, drops: Object.freeze(['cycle-stand']) }),
});

export const CYCLE_ARCHETYPES = Object.freeze({
  dirtBike: Object.freeze({
    label: 'motocross bike',
    classOf: '450 cc motocross',
    physics: 'dirtBike',
    palette: 'mxRed',
    posture: 'mx',
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
  streetBike: archetype('standard motorcycle', '700 cc standard', 'streetBike', 'roadRed', STREET_CHASSIS,
    { trail: [0.09, 0.11], seat: [0.78, 0.84], clearance: 0.13, lean: 45, stand: [5, 12] }, [
      L('frame', 'frame-trellis-street'), L('fork', 'fork-usd-41', { steers: true }), L('wheelF', 'wheel-cast-120-17', F), L('brakeF', 'brake-twin-310', F),
      L('swingarm', 'swingarm-road'), L('wheelR', 'wheel-cast-180-17', { slot: 'rear' }), L('brakeR', 'brake-disc-245', { slot: 'rear' }), L('shock', 'shock-road'),
      L('engine', 'engine-twin-700'), L('radiator', 'radiator-front-road'), L('drive', 'drive-chain-525'), L('exhaust', 'exhaust-street-2into1'),
      L('tank', 'tank-street'), L('seat', 'seat-street'), L('tail', 'tail-street'), L('bars', 'bars-street', { steers: true }),
      L('fenderF', 'fender-street-front', F), L('fenderR', 'fender-street-rear', { slot: 'rear' }), L('headLamp', 'lamp-head-round', { steers: true }), L('tailLamp', 'lamp-tail-led'),
      L('peg', 'peg-road', { pair: true }), L('stand', 'stand-side-road'),
    ], 'upright'),
  sportBike: archetype('sport bike', '1000 cc sport', 'sportBike', 'sportBlue', SPORT_CHASSIS,
    { trail: [0.09, 0.11], seat: [0.8, 0.86], clearance: 0.12, lean: 50, stand: [5, 12] }, [
      L('frame', 'frame-spar-sport'), L('fork', 'fork-usd-43', { steers: true }), L('wheelF', 'wheel-cast-120-17', F), L('brakeF', 'brake-twin-320', F),
      L('swingarm', 'swingarm-road'), L('wheelR', 'wheel-cast-180-17', { slot: 'rear' }), L('brakeR', 'brake-disc-245', { slot: 'rear' }), L('shock', 'shock-road'),
      L('engine', 'engine-four-1000'), L('radiator', 'radiator-front-road'), L('drive', 'drive-chain-525'), L('exhaust', 'exhaust-sport-4into1'),
      L('tank', 'tank-street'), L('seat', 'seat-sport'), L('tail', 'tail-street'), L('bars', 'bars-clipon', { steers: true }),
      L('fairing', 'fairing-sport-upper'), L('sides', 'fairing-sport-side'), L('belly', 'fairing-sport-belly'), L('screen', 'screen-sport'),
      L('fenderF', 'fender-street-front', F), L('fenderR', 'fender-street-rear', { slot: 'rear' }), L('headLamp', 'lamp-head-fairing'), L('tailLamp', 'lamp-tail-led'),
      L('peg', 'peg-road', { pair: true }), L('stand', 'stand-side-road'),
    ], 'sport'),
  raceBike: archetype('grand prix race bike', 'grand prix', 'raceBike', 'raceWhite', RACE_CHASSIS,
    { trail: [0.09, 0.11], seat: [0.82, 0.9], clearance: 0.12, lean: 55 }, [
      L('frame', 'frame-spar-sport'), L('fork', 'fork-usd-43', { steers: true }), L('wheelF', 'wheel-slick-120-17', F), L('brakeF', 'brake-twin-320', F),
      L('swingarm', 'swingarm-road'), L('wheelR', 'wheel-slick-200-17', { slot: 'rear' }), L('brakeR', 'brake-disc-245', { slot: 'rear' }), L('shock', 'shock-road'),
      L('engine', 'engine-four-1000'), L('radiator', 'radiator-front-road'), L('drive', 'drive-chain-525'), L('exhaust', 'exhaust-race-high'),
      L('tank', 'tank-street'), L('seat', 'seat-sport'), L('tail', 'tail-street'), L('bars', 'bars-clipon', { steers: true }),
      L('fairing', 'fairing-sport-upper'), L('sides', 'fairing-sport-side'), L('belly', 'fairing-sport-belly'), L('screen', 'screen-sport'), L('number', 'number-race'),
      L('fenderF', 'fender-street-front', F), L('peg', 'peg-road', { pair: true }),
    ], 'race'),
  cruiserBike: archetype('cruiser motorcycle', 'V-twin cruiser', 'cruiserBike', 'cruiserBlack', CRUISER_CHASSIS,
    { trail: [0.12, 0.16], seat: [0.64, 0.74], clearance: 0.12, lean: 30, stand: [5, 12] }, [
      L('frame', 'frame-cradle-cruiser'), L('fork', 'fork-tele-41', { steers: true }), L('wheelF', 'wheel-wire-19', F), L('brakeF', 'brake-disc-300', F),
      L('swingarm', 'swingarm-cruiser'), L('wheelR', 'wheel-wire-16', { slot: 'rear' }), L('brakeR', 'brake-disc-245', { slot: 'rear' }), L('shock', 'shock-twin-cruiser', { pair: true }),
      L('engine', 'engine-vee-1800'), L('drive', 'drive-belt-cruiser'), L('exhaust', 'exhaust-cruiser-staggered'),
      L('tank', 'tank-teardrop-cruiser'), L('seat', 'seat-cruiser-solo'), L('bars', 'bars-pullback', { steers: true }),
      L('fenderF', 'fender-cruiser-front', F), L('fenderR', 'fender-cruiser-rear', { slot: 'rear' }), L('headLamp', 'lamp-head-chrome', { steers: true }), L('tailLamp', 'lamp-tail-led'),
      L('peg', 'peg-road', { pair: true }), L('stand', 'stand-side-road'),
    ], 'cruiser'),
  scooter: archetype('scooter', '150 cc scooter', 'scooter', 'scooterMint', SCOOTER_CHASSIS,
    { trail: [0.07, 0.1], seat: [0.76, 0.84], clearance: 0.12, lean: 38, stand: [5, 12] }, [
      L('frame', 'frame-spine-scooter'), L('fork', 'fork-tele-scooter', { steers: true }), L('wheelF', 'wheel-cast-12', F), L('brakeF', 'brake-disc-220', F),
      L('engine', 'engine-scooter-150'), L('wheelR', 'wheel-cast-12', { slot: 'rear' }), L('brakeR', 'brake-drum-110', { slot: 'rear' }), L('shock', 'shock-scooter'),
      L('exhaust', 'exhaust-scooter'), L('seat', 'seat-scooter'), L('bars', 'bars-scooter', { steers: true }), L('headLamp', 'cowl-scooter', { steers: true }),
      L('shield', 'shield-scooter'), L('rearBody', 'body-scooter-rear'), L('fenderF', 'fender-scooter-front', F), L('floor', 'floor-scooter'),
      L('tailLamp', 'lamp-tail-led'), L('stand', 'stand-side-small'),
    ], 'scooter'),
  moped: archetype('moped', '110 cc underbone', 'moped', 'mopedBlue', MOPED_CHASSIS,
    { trail: [0.06, 0.09], seat: [0.74, 0.8], clearance: 0.15, lean: 40, stand: [5, 12] }, [
      L('frame', 'frame-spine-moped'), L('fork', 'fork-tele-moped', { steers: true }), L('wheelF', 'wheel-wire-17-moped', F), L('brakeF', 'brake-drum-110', F),
      L('swingarm', 'swingarm-moped'), L('wheelR', 'wheel-wire-17-moped', { slot: 'rear' }), L('brakeR', 'brake-drum-110', { slot: 'rear' }), L('shock', 'shock-twin-moped', { pair: true }),
      L('engine', 'engine-flat-110'), L('drive', 'drive-chain-428'), L('exhaust', 'exhaust-moped'), L('seat', 'seat-moped'),
      L('bars', 'bars-moped', { steers: true }), L('headLamp', 'cowl-scooter', { steers: true }), L('shield', 'shield-moped'), L('rearBody', 'body-moped-covers'),
      L('fenderF', 'fender-moped-front', F), L('fenderR', 'fender-moped-rear', { slot: 'rear' }), L('tailLamp', 'lamp-tail-led'),
      L('peg', 'peg-road', { pair: true }), L('stand', 'stand-side-small'),
    ], 'upright'),
  bicycle: archetype('bicycle', 'upright bicycle', 'bicycle', 'bikeGreen', BICYCLE_CHASSIS,
    { trail: [0.05, 0.08], seat: [0.95, 1.08], clearance: 0.2, lean: 40, stand: [5, 12] }, [
      L('frame', 'frame-diamond-road'), L('fork', 'fork-rigid-700', { steers: true }), L('wheelF', 'wheel-wire-700', F), L('brakeF', 'brake-disc-160', F),
      L('wheelR', 'wheel-wire-700', { slot: 'rear' }), L('brakeR', 'brake-disc-160', { slot: 'rear' }), L('drive', 'drive-pedal-road'),
      L('seat', 'saddle-road'), L('bars', 'bars-flat-bicycle', { steers: true }), L('stand', 'stand-kick-bicycle'),
    ], 'cyclist'),
  eBike: archetype('e-bike', 'pedelec', 'eBike', 'ebikeGrey', EBIKE_CHASSIS,
    { trail: [0.06, 0.09], seat: [0.95, 1.08], clearance: 0.2, lean: 40, stand: [5, 12] }, [
      L('frame', 'frame-step-ebike'), L('fork', 'fork-rigid-ebike', { steers: true }), L('wheelF', 'wheel-wire-700', F), L('brakeF', 'brake-disc-160', F),
      L('wheelR', 'wheel-wire-700', { slot: 'rear' }), L('brakeR', 'brake-disc-160', { slot: 'rear' }), L('drive', 'drive-pedal-ebike'), L('motor', 'motor-mid-250'),
      L('battery', 'battery-downtube-500'), L('seat', 'saddle-comfort'), L('bars', 'bars-riser-ebike', { steers: true }),
      L('fenderF', 'fender-ebike-front', F), L('fenderR', 'fender-ebike-rear', { slot: 'rear' }), L('headLamp', 'lamp-head-bicycle', { steers: true }), L('tailLamp', 'lamp-tail-bicycle'),
      L('stand', 'stand-kick-bicycle'),
    ], 'upright'),
  sidecarOutfit: archetype('sidecar outfit', 'road twin and sidecar', 'sidecarOutfit', 'classicCream', { ...STREET_CHASSIS, ...SIDECAR_CARD, hubs: { ...STREET_CHASSIS.hubs, chair: [-0.05, 0.05] } },
    { trail: [0.09, 0.11], seat: [0.78, 0.84], clearance: 0.13, stability: 0.25 }, [
      ...[
        L('frame', 'frame-trellis-street'), L('fork', 'fork-usd-41', { steers: true }), L('wheelF', 'wheel-cast-120-17', F), L('brakeF', 'brake-twin-310', F),
        L('swingarm', 'swingarm-road'), L('wheelR', 'wheel-cast-180-17', { slot: 'rear' }), L('brakeR', 'brake-disc-245', { slot: 'rear' }), L('shock', 'shock-road'),
        L('engine', 'engine-twin-700'), L('radiator', 'radiator-front-road'), L('drive', 'drive-chain-525'), L('exhaust', 'exhaust-street-2into1'),
        L('tank', 'tank-street'), L('seat', 'seat-street'), L('tail', 'tail-street'), L('bars', 'bars-street', { steers: true }),
        L('fenderF', 'fender-street-front', F), L('fenderR', 'fender-street-rear', { slot: 'rear' }), L('headLamp', 'lamp-head-round', { steers: true }), L('tailLamp', 'lamp-tail-led'),
        L('peg', 'peg-road', { pair: true }),
      ],
      ...SIDECAR_LAYOUT,
    ], 'upright'),
  motorTrike: archetype('motor trike', 'V-twin trike', 'motorTrike', 'cruiserBlack', TRIKE_CHASSIS,
    { trail: [0.1, 0.16], seat: [0.72, 0.84], clearance: 0.12, stability: 0.5 }, [
      L('frame', 'frame-trike'), L('fork', 'fork-tele-41', { steers: true }), L('wheelF', 'wheel-wire-19', F), L('brakeF', 'brake-disc-300', F),
      L('wheelRL', 'wheel-wire-16', { slot: 'rear.l' }), L('wheelRR', 'wheel-wire-16', { slot: 'rear.r' }), L('axle', 'axle-live-trike'),
      L('engine', 'engine-vee-1800'), L('drive', 'drive-chain-525'), L('exhaust', 'exhaust-trike'),
      L('tank', 'tank-teardrop-cruiser'), L('seat', 'seat-trike'), L('deck', 'deck-trike'), L('bars', 'bars-pullback', { steers: true }),
      L('fenderF', 'fender-cruiser-front', F), L('fenderR', 'fender-trike-rear', { pair: true }), L('headLamp', 'lamp-head-chrome', { steers: true }), L('tailLamp', 'lamp-tail-led'),
      L('peg', 'peg-road', { pair: true }),
    ], 'cruiser'),
  tukTuk: archetype('tuk-tuk', 'auto rickshaw', 'tukTuk', 'tuktukGreen', TUKTUK_CHASSIS,
    { trail: [0.03, 0.08], seat: [0.8, 0.9], clearance: 0.15, stability: 0.4 }, [
      L('frame', 'frame-tuktuk'), L('fork', 'fork-tele-scooter', { steers: true }), L('wheelF', 'wheel-cast-10', F), L('brakeF', 'brake-disc-220', F),
      L('wheelRL', 'wheel-cast-10', { slot: 'rear.l' }), L('wheelRR', 'wheel-cast-10', { slot: 'rear.r' }), L('axle', 'axle-live-tuktuk'),
      L('engine', 'engine-flat-110'), L('drive', 'drive-chain-428'), L('cab', 'cab-tuktuk'), L('fascia', 'fascia-tuktuk'),
      L('seat', 'seat-tuktuk'), L('floor', 'floor-scooter'), L('bars', 'bars-scooter', { steers: true }),
      L('fenderF', 'fender-scooter-front', F), L('headLamp', 'lamp-head-round'), L('tailLamp', 'lamp-tail-led'),
    ], 'scooter'),
  cycleRickshaw: archetype('cycle rickshaw', 'pedicab', 'cycleRickshaw', 'rickshawBlue', RICKSHAW_CHASSIS,
    { trail: [0.05, 0.08], seat: [0.95, 1.08], clearance: 0.2, stability: 0.3 }, [
      L('frame', 'frame-rickshaw'), L('fork', 'fork-rigid-700', { steers: true }), L('wheelF', 'wheel-wire-700', F), L('brakeF', 'brake-disc-160', F),
      L('wheelRL', 'wheel-wire-700', { slot: 'rear.l' }), L('wheelRR', 'wheel-wire-700', { slot: 'rear.r' }), L('axle', 'axle-light-rickshaw'),
      L('drive', 'drive-pedal-road'), L('carriage', 'carriage-rickshaw'), L('seat', 'saddle-road'), L('bars', 'bars-flat-bicycle', { steers: true }),
      L('fenderR', 'fender-ebike-rear', { pair: true }),
    ], 'cyclist'),
  cargoTrike: archetype('box trike', 'box trike', 'cargoTrike', 'bikeGreen', BOXTRIKE_CHASSIS,
    { trail: [-0.01, 0.03], seat: [0.95, 1.08], clearance: 0.2, stability: 0.2 }, [
      L('frame', 'frame-boxtrike'), L('box', 'box-cargo', { steers: true }), L('wheelFL', 'wheel-wire-20', { slot: 'front.l', steers: true }), L('wheelFR', 'wheel-wire-20', { slot: 'front.r', steers: true }),
      L('wheelR', 'wheel-wire-700', { slot: 'rear' }), L('brakeR', 'brake-disc-160', { slot: 'rear' }),
      L('drive', 'drive-pedal-road'), L('seat', 'saddle-comfort'), L('bars', 'bars-boxtrike', { steers: true }),
    ], 'cyclist'),
  atv: archetype('quad bike', 'sport quad', 'atv', 'mxRed', ATV_CHASSIS,
    { seat: [0.84, 0.92], clearance: 0.18, stability: 0.5 }, [
      L('frame', 'frame-atv'), L('column', 'column-atv', { steers: true }), L('arms', 'arms-atv', { pair: true }),
      L('wheelFL', 'wheel-atv-front', { slot: 'front.l', steers: 'kingpin' }), L('wheelFR', 'wheel-atv-front', { slot: 'front.r', steers: 'kingpin' }),
      L('swingarm', 'swingarm-road'), L('shock', 'shock-road'), L('wheelRL', 'wheel-atv-rear', { slot: 'rear.l' }), L('wheelRR', 'wheel-atv-rear', { slot: 'rear.r' }), L('axle', 'axle-solid-atv'),
      L('engine', 'engine-single-450'), L('drive', 'drive-chain-520'), L('exhaust', 'exhaust-atv'),
      L('seat', 'seat-atv'), L('bars', 'bars-atv', { steers: true }), L('fenderF', 'fender-atv-front'), L('fenderR', 'fender-atv-rear'),
      L('headLamp', 'lamp-head-fairing'), L('peg', 'peg-road', { pair: true }),
    ], 'upright'),
});

function archetype(label, classOf, physics, palette, chassis, laws, layout, posture) {
  return Object.freeze({ label, classOf, physics, palette, posture, chassis, laws: Object.freeze(laws), bom: bomOf(layout), layout: Object.freeze(layout) });
}
