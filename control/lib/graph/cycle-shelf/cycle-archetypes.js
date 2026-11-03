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

/** The bill of materials counted from a layout: a kind for each part, a pair two. */
const bomOf = (layout) => Object.freeze(layout.reduce((b, e) => { const k = CYCLE_ODM[e.sku].kind; b[k] = (b[k] ?? 0) + (e.pair ? 2 : 1); return b; }, {}));
const L = (id, sku, more = {}) => ({ id, sku, ...more });
const F = { steers: true, slot: 'front' };

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
  streetBike: archetype('standard motorcycle', '700 cc standard', 'streetBike', 'roadRed', STREET_CHASSIS,
    { trail: [0.09, 0.11], seat: [0.78, 0.84], clearance: 0.13, lean: 45, stand: [5, 12] }, [
      L('frame', 'frame-trellis-street'), L('fork', 'fork-usd-41', { steers: true }), L('wheelF', 'wheel-cast-120-17', F), L('brakeF', 'brake-twin-310', F),
      L('swingarm', 'swingarm-road'), L('wheelR', 'wheel-cast-180-17', { slot: 'rear' }), L('brakeR', 'brake-disc-245', { slot: 'rear' }), L('shock', 'shock-road'),
      L('engine', 'engine-twin-700'), L('radiator', 'radiator-front-road'), L('drive', 'drive-chain-525'), L('exhaust', 'exhaust-street-2into1'),
      L('tank', 'tank-street'), L('seat', 'seat-street'), L('tail', 'tail-street'), L('bars', 'bars-street', { steers: true }),
      L('fenderF', 'fender-street-front', F), L('fenderR', 'fender-street-rear', { slot: 'rear' }), L('headLamp', 'lamp-head-round', { steers: true }), L('tailLamp', 'lamp-tail-led'),
      L('peg', 'peg-road', { pair: true }), L('stand', 'stand-side-road'),
    ]),
  sportBike: archetype('sport bike', '1000 cc sport', 'sportBike', 'sportBlue', SPORT_CHASSIS,
    { trail: [0.09, 0.11], seat: [0.8, 0.86], clearance: 0.12, lean: 50, stand: [5, 12] }, [
      L('frame', 'frame-spar-sport'), L('fork', 'fork-usd-43', { steers: true }), L('wheelF', 'wheel-cast-120-17', F), L('brakeF', 'brake-twin-320', F),
      L('swingarm', 'swingarm-road'), L('wheelR', 'wheel-cast-180-17', { slot: 'rear' }), L('brakeR', 'brake-disc-245', { slot: 'rear' }), L('shock', 'shock-road'),
      L('engine', 'engine-four-1000'), L('radiator', 'radiator-front-road'), L('drive', 'drive-chain-525'), L('exhaust', 'exhaust-sport-4into1'),
      L('tank', 'tank-street'), L('seat', 'seat-sport'), L('tail', 'tail-street'), L('bars', 'bars-clipon', { steers: true }),
      L('fairing', 'fairing-sport-upper'), L('sides', 'fairing-sport-side'), L('belly', 'fairing-sport-belly'), L('screen', 'screen-sport'),
      L('fenderF', 'fender-street-front', F), L('fenderR', 'fender-street-rear', { slot: 'rear' }), L('headLamp', 'lamp-head-fairing'), L('tailLamp', 'lamp-tail-led'),
      L('peg', 'peg-road', { pair: true }), L('stand', 'stand-side-road'),
    ]),
  raceBike: archetype('grand prix race bike', 'grand prix', 'raceBike', 'raceWhite', RACE_CHASSIS,
    { trail: [0.09, 0.11], seat: [0.82, 0.9], clearance: 0.12, lean: 55 }, [
      L('frame', 'frame-spar-sport'), L('fork', 'fork-usd-43', { steers: true }), L('wheelF', 'wheel-slick-120-17', F), L('brakeF', 'brake-twin-320', F),
      L('swingarm', 'swingarm-road'), L('wheelR', 'wheel-slick-200-17', { slot: 'rear' }), L('brakeR', 'brake-disc-245', { slot: 'rear' }), L('shock', 'shock-road'),
      L('engine', 'engine-four-1000'), L('radiator', 'radiator-front-road'), L('drive', 'drive-chain-525'), L('exhaust', 'exhaust-race-high'),
      L('tank', 'tank-street'), L('seat', 'seat-sport'), L('tail', 'tail-street'), L('bars', 'bars-clipon', { steers: true }),
      L('fairing', 'fairing-sport-upper'), L('sides', 'fairing-sport-side'), L('belly', 'fairing-sport-belly'), L('screen', 'screen-sport'), L('number', 'number-race'),
      L('fenderF', 'fender-street-front', F), L('peg', 'peg-road', { pair: true }),
    ]),
  cruiserBike: archetype('cruiser motorcycle', 'V-twin cruiser', 'cruiserBike', 'cruiserBlack', CRUISER_CHASSIS,
    { trail: [0.12, 0.16], seat: [0.64, 0.74], clearance: 0.12, lean: 30, stand: [5, 12] }, [
      L('frame', 'frame-cradle-cruiser'), L('fork', 'fork-tele-41', { steers: true }), L('wheelF', 'wheel-wire-19', F), L('brakeF', 'brake-disc-300', F),
      L('swingarm', 'swingarm-cruiser'), L('wheelR', 'wheel-wire-16', { slot: 'rear' }), L('brakeR', 'brake-disc-245', { slot: 'rear' }), L('shock', 'shock-twin-cruiser', { pair: true }),
      L('engine', 'engine-vee-1800'), L('drive', 'drive-belt-cruiser'), L('exhaust', 'exhaust-cruiser-staggered'),
      L('tank', 'tank-teardrop-cruiser'), L('seat', 'seat-cruiser-solo'), L('bars', 'bars-pullback', { steers: true }),
      L('fenderF', 'fender-cruiser-front', F), L('fenderR', 'fender-cruiser-rear', { slot: 'rear' }), L('headLamp', 'lamp-head-chrome', { steers: true }), L('tailLamp', 'lamp-tail-led'),
      L('peg', 'peg-road', { pair: true }), L('stand', 'stand-side-road'),
    ]),
  scooter: archetype('scooter', '150 cc scooter', 'scooter', 'scooterMint', SCOOTER_CHASSIS,
    { trail: [0.07, 0.1], seat: [0.76, 0.84], clearance: 0.12, lean: 38, stand: [5, 12] }, [
      L('frame', 'frame-spine-scooter'), L('fork', 'fork-tele-scooter', { steers: true }), L('wheelF', 'wheel-cast-12', F), L('brakeF', 'brake-disc-220', F),
      L('engine', 'engine-scooter-150'), L('wheelR', 'wheel-cast-12', { slot: 'rear' }), L('brakeR', 'brake-drum-110', { slot: 'rear' }), L('shock', 'shock-scooter'),
      L('exhaust', 'exhaust-scooter'), L('seat', 'seat-scooter'), L('bars', 'bars-scooter', { steers: true }), L('headLamp', 'cowl-scooter', { steers: true }),
      L('shield', 'shield-scooter'), L('rearBody', 'body-scooter-rear'), L('fenderF', 'fender-scooter-front', F), L('floor', 'floor-scooter'),
      L('tailLamp', 'lamp-tail-led'), L('stand', 'stand-side-small'),
    ]),
  moped: archetype('moped', '110 cc underbone', 'moped', 'mopedBlue', MOPED_CHASSIS,
    { trail: [0.06, 0.09], seat: [0.74, 0.8], clearance: 0.15, lean: 40, stand: [5, 12] }, [
      L('frame', 'frame-spine-moped'), L('fork', 'fork-tele-moped', { steers: true }), L('wheelF', 'wheel-wire-17-moped', F), L('brakeF', 'brake-drum-110', F),
      L('swingarm', 'swingarm-moped'), L('wheelR', 'wheel-wire-17-moped', { slot: 'rear' }), L('brakeR', 'brake-drum-110', { slot: 'rear' }), L('shock', 'shock-twin-moped', { pair: true }),
      L('engine', 'engine-flat-110'), L('drive', 'drive-chain-428'), L('exhaust', 'exhaust-moped'), L('seat', 'seat-moped'),
      L('bars', 'bars-moped', { steers: true }), L('headLamp', 'cowl-scooter', { steers: true }), L('shield', 'shield-moped'), L('rearBody', 'body-moped-covers'),
      L('fenderF', 'fender-moped-front', F), L('fenderR', 'fender-moped-rear', { slot: 'rear' }), L('tailLamp', 'lamp-tail-led'),
      L('peg', 'peg-road', { pair: true }), L('stand', 'stand-side-small'),
    ]),
  bicycle: archetype('bicycle', 'upright bicycle', 'bicycle', 'bikeGreen', BICYCLE_CHASSIS,
    { trail: [0.05, 0.08], seat: [0.95, 1.08], clearance: 0.2, lean: 40, stand: [5, 12] }, [
      L('frame', 'frame-diamond-road'), L('fork', 'fork-rigid-700', { steers: true }), L('wheelF', 'wheel-wire-700', F), L('brakeF', 'brake-disc-160', F),
      L('wheelR', 'wheel-wire-700', { slot: 'rear' }), L('brakeR', 'brake-disc-160', { slot: 'rear' }), L('drive', 'drive-pedal-road'),
      L('seat', 'saddle-road'), L('bars', 'bars-flat-bicycle', { steers: true }), L('stand', 'stand-kick-bicycle'),
    ]),
  eBike: archetype('e-bike', 'pedelec', 'eBike', 'ebikeGrey', EBIKE_CHASSIS,
    { trail: [0.06, 0.09], seat: [0.95, 1.08], clearance: 0.2, lean: 40, stand: [5, 12] }, [
      L('frame', 'frame-step-ebike'), L('fork', 'fork-rigid-ebike', { steers: true }), L('wheelF', 'wheel-wire-700', F), L('brakeF', 'brake-disc-160', F),
      L('wheelR', 'wheel-wire-700', { slot: 'rear' }), L('brakeR', 'brake-disc-160', { slot: 'rear' }), L('drive', 'drive-pedal-ebike'), L('motor', 'motor-mid-250'),
      L('battery', 'battery-downtube-500'), L('seat', 'saddle-comfort'), L('bars', 'bars-riser-ebike', { steers: true }),
      L('fenderF', 'fender-ebike-front', F), L('fenderR', 'fender-ebike-rear', { slot: 'rear' }), L('headLamp', 'lamp-head-bicycle', { steers: true }), L('tailLamp', 'lamp-tail-bicycle'),
      L('stand', 'stand-kick-bicycle'),
    ]),
});

function archetype(label, classOf, physics, palette, chassis, laws, layout) {
  return Object.freeze({ label, classOf, physics, palette, chassis, laws: Object.freeze(laws), bom: bomOf(layout), layout: Object.freeze(layout) });
}
