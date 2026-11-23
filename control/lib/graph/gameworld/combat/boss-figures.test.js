import { describe, expect, it } from 'vitest';
import { bossFigures, bossPlaces } from './boss-figures.js';
import { VEHICLES } from '../../boss/vehicles.js';

// A MECHA BOSS'S FIGURES (boss-figures.js): the walker bosses drawn as their frames, and their parts' boxes standing on
// their own bodies in each form (what a round is judged on is where the body is).

const inside = (box, q, pad = 0.4) => [0, 1, 2].every((k) => q[k] >= box[0][k] - pad && q[k] <= box[1][k] + pad);

describe('the siege walker, drawn and read', () => {
  const P = bossPlaces('siege-walker'), parts = VEHICLES['siege-walker'].parts;
  it('its reloaders on the roots of its tails, its legs over its feet, standing', () => {
    expect(inside(parts['tail-right'].box, P.walker.tailBaseR)).toBe(true);
    expect(inside(parts['tail-left'].box, P.walker.tailSeg1L)).toBe(true);
    expect(inside(parts['leg-right'].box, P.walker.footR)).toBe(true);
    expect(inside(parts['leg-left'].box, P.walker.footL)).toBe(true);
  });
  it('folded: its hips at its sides, its engine at the back of its pack', () => {
    // (each box just outboard of its hip's drum: from its hip's middle out over its face)
    expect(Math.abs(parts['hip-right'].box[1][1] - P.tank.hipR[1])).toBeLessThan(0.3);
    expect(Math.abs(parts['hip-left'].box[0][1] - P.tank.hipL[1])).toBeLessThan(0.3);
    expect(inside(parts['hip-left'].box, [P.tank.hipL[0], parts['hip-left'].box[0][1], P.tank.hipL[2]])).toBe(true);
    expect(parts.grille.box[1][0]).toBeLessThan(P.tank.pack[0]);
  });
  it('its figure walks, reloads with its tails and folds', () => {
    const F = bossFigures('siege-walker')['siege-walker'];
    expect(Object.keys(F.clips)).toEqual(expect.arrayContaining(['forward', 'tails:reload', 'transform:tank', 'tank:forward']));
    for (const p of Object.values(parts)) for (const b of p.bones ?? []) expect(F.bones.some((x) => x.id === b), b).toBe(true);
  });
});

describe('the brood walker, drawn and read', () => {
  const P = bossPlaces('brood-walker'), C = VEHICLES['brood-walker'].carrier;
  it('its drones\' bays under its eggs, its doors in its hull\'s sides', () => {
    for (const [k, b] of [['bayFR', 0], ['bayFL', 1], ['bayRR', 2], ['bayRL', 3]]) { expect(Math.hypot(C.bays[b][0] - P.walker[k][0], C.bays[b][1] - P.walker[k][1])).toBeLessThan(0.2); expect(C.bays[b][2]).toBeLessThan(P.walker[k][2]); }
    expect(C.doors.right[1]).toBeLessThan(0);
    expect(C.doors.left[1]).toBeGreaterThan(0);
    expect(Math.abs(C.doors.right[2] - P.walker.pelvis[2])).toBeLessThan(1.5);
  });
  it('carries its drones\' figure beside its own', () => {
    expect(Object.keys(bossFigures('brood-walker'))).toEqual(['brood-walker', 'brood-walker-drone']);
  });
});
