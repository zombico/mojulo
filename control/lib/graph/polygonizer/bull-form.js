/**
 * bull-form — THE BULL as a ring plan for the layered kind (`layered-plan-v1`), built by the creature-from-plan loop as
 * the horse and the sphinx were (horse-form.js, sphinx-form.js). Core; the worked example docs/examples/ring-plans/
 * bull.plan.mjs re-exports it and writes bull.plan.json.
 *
 * THESIS  a deep barrel on short straight columns · a quadruped on cloven hooves · the heavy hump over the shoulders,
 *         what makes it a bull from afar · the head carried up and forward at shoulder height, the horns curving out
 *         and up · life size, 2.5 m long, as Sumer's copper guardians stand (the temple-portal record).
 *
 * Frame: metres, +z up, +y its front, x = 0 its mirror plane, its hooves on z = 0. `bullPlan({ scale, palette })`.
 * Pure and deterministic.
 */

/** the groups' colours (a dun bull, dark horns and hooves) */
export const BULL_PALETTE = Object.freeze({ Body: '#8a6b4e', Hump: '#86674a', Head: '#7d6045', Horn: '#d9ccb0', Legs: '#7a5d43', Hooves: '#2e2620', Tail: '#5e4733' });

const r4 = (x) => Math.round(x * 1e4) / 1e4;
/** the midline masses: [y, z, across, deep] stations from rear to front */
const BARREL = [[-1.22, 1.05, 0.27, 0.31], [-0.92, 1.08, 0.38, 0.4], [-0.3, 1.02, 0.42, 0.44], [0.3, 1.05, 0.45, 0.48], [0.68, 1.0, 0.38, 0.45], [0.95, 0.95, 0.24, 0.31]];
const HUMP = [[-0.05, 1.3, 0.24, 0.14], [0.3, 1.38, 0.33, 0.26], [0.62, 1.32, 0.27, 0.2]];
const NECK = [[0.72, 1.22, 0.26, 0.3], [1.0, 1.38, 0.22, 0.25]];
const HEAD = [[1.0, 1.52, 0.19, 0.21], [1.2, 1.4, 0.18, 0.2], [1.38, 1.22, 0.14, 0.15], [1.48, 1.1, 0.13, 0.12]];
const TAIL = [[-1.27, 1.3, 0.045, 0.045], [-1.34, 0.95, 0.035, 0.035], [-1.33, 0.6, 0.03, 0.03], [-1.32, 0.45, 0.06, 0.06]];
/** the side parts (the RIGHT; mirrored): [x, y, z, across, deep] */
const HORN = [[0.14, 1.04, 1.62, 0.06, 0.06], [0.34, 1.0, 1.7, 0.05, 0.05], [0.48, 1.04, 1.86, 0.04, 0.04], [0.5, 1.12, 2.02, 0.02, 0.02]];
const EAR = [[0.17, 0.98, 1.5, 0.03, 0.06], [0.33, 0.95, 1.45, 0.02, 0.04]];
const JOINTS = {
  shoulder: [0.24, 0.55, 0.95], knee: [0.24, 0.6, 0.45], fetlock: [0.23, 0.62, 0.13], toe: [0.23, 0.66, 0.03],
  hip: [0.25, -0.85, 1.0], hock: [0.24, -1.0, 0.48], hFetlock: [0.23, -0.95, 0.13], hToe: [0.23, -0.9, 0.03],
};
const LIMBS = [
  ['foreArmR', 'shoulder', 'knee', [0.13, 0.16], [0.08, 0.09], 'Legs', 0.15],
  ['foreCannonR', 'knee', 'fetlock', [0.065, 0.07], [0.065, 0.07], 'Legs', 0.55],
  ['foreHoofR', 'fetlock', 'toe', [0.07, 0.08], [0.085, 0.09], 'Hooves', 0.55],
  ['thighR', 'hip', 'hock', [0.17, 0.24], [0.08, 0.1], 'Legs', 0.15],
  ['hindCannonR', 'hock', 'hFetlock', [0.065, 0.075], [0.065, 0.07], 'Legs', 0.55],
  ['hindHoofR', 'hFetlock', 'hToe', [0.07, 0.08], [0.085, 0.09], 'Hooves', 0.55],
];

/** The bull ring plan. */
export function bullPlan({ scale = 1, palette = {} } = {}) {
  const k = scale, P = { ...BULL_PALETTE, ...palette };
  const mid = (rows) => rows.map(([y, z, a, b]) => ({ at: [0, r4(y * k), r4(z * k)], r: [r4(a * k), r4(b * k)] }));
  const side = (rows) => rows.map(([x, y, z, a, b]) => ({ at: [r4(x * k), r4(y * k), r4(z * k)], r: [r4(a * k), r4(b * k)] }));
  const loft = (name, stations, group, { slots = 'ring8', mirror = 'plane', e = 2.2 } = {}) => ({ name, kind: 'loft', stations, slots, e, frame: 'keep', group, tint: P[group], mirror });
  return {
    schema: 'layered-plan-v1',
    frame: { up: '+z', front: '+y', note: `1 unit = 1 m; a standing bull, ${r4(2.5 * k)} m long, hooves on z = 0, facing +y` },
    joints: Object.fromEntries(Object.entries(JOINTS).map(([n, p]) => [n, p.map((v) => r4(v * k))])),
    segments: [
      loft('barrel', mid(BARREL), 'Body', { slots: 'ring12' }),
      loft('hump', mid(HUMP), 'Hump', { slots: 'ring10' }),
      loft('neck', mid(NECK), 'Body'),
      loft('head', mid(HEAD), 'Head', { slots: 'ring10', e: 2.5 }),
      loft('tail', mid(TAIL), 'Tail', { slots: 'ring6' }),
      loft('hornR', side(HORN), 'Horn', { mirror: 'name', slots: 'ring6' }),
      loft('earR', side(EAR), 'Head', { mirror: 'name', slots: 'ring6', e: 2.4 }),
      ...LIMBS.map(([name, from, to, rA, rB, group, top]) => ({ name, kind: 'segment', from, to, rA: rA.map((v) => r4(v * k)), rB: rB.map((v) => r4(v * k)), e: 2.1, over: [top, 0.45], group, tint: P[group], mirror: 'name' })),
    ],
    palette: P,
  };
}
