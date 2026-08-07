import { describe, it, expect } from 'vitest';

import { resolveVehChassisRecipe } from './veh-chassis.js';
import { resolveVehWheelRecipe } from './veh-wheel.js';
import { deriveAxleSockets, deriveBaySockets, planComponentFit } from './veh-garage.js';

const chassis = (opts = {}) => resolveVehChassisRecipe({ family: 'unibodyPan', palette: 'factorySteel', seed: 'garage-test', ...opts });

describe('deriveAxleSockets', () => {
  it('derives four hub sockets at the track/wheelbase corners', () => {
    const sockets = deriveAxleSockets(chassis());
    expect(sockets).toHaveLength(4);
    expect(sockets.map((s) => `${s.axle}-${s.side}`)).toEqual([
      'front-left', 'front-right', 'rear-left', 'rear-right',
    ]);
    for (const s of sockets) {
      expect(Math.abs(s.anchor[0])).toBeCloseTo(2.45, 3); // track 4.9 / 2
      expect(Math.abs(s.anchor[1])).toBeCloseTo(4, 3); // wheelbase 8 / 2
      expect(s.anchor[2]).toBeCloseTo(1, 3); // hubZ = wheel radius
      expect(s.outboard[0]).toBe(s.side === 'right' ? 1 : -1);
      expect(s.up).toEqual([0, 0, 1]);
    }
  });

  it('resolves sides and axles from POSITION, never from id suffixes', () => {
    const recipe = chassis();
    // adversarial rename: give every stub a deliberately WRONG label
    const stubs = recipe.lathes.filter((m) => m.axisFrom.y === m.axisTo.y && m.axisFrom.z === m.axisTo.z);
    stubs[0].id = 'axle_stub_rear_right';
    stubs[1].id = 'axle_stub_rear_left';
    stubs[2].id = 'axle_stub_front_right';
    stubs[3].id = 'axle_stub_front_left';
    const sockets = deriveAxleSockets(recipe);
    const frontLeft = sockets.find((s) => s.axle === 'front' && s.side === 'left');
    expect(frontLeft.anchor[0]).toBeLessThan(0);
    expect(frontLeft.anchor[1]).toBeGreaterThan(0);
  });

  it('rejects non-chassis recipes and malformed chassis', () => {
    expect(() => deriveAxleSockets(resolveVehWheelRecipe({ family: 'steelie', seed: 1 }))).toThrow(/veh-chassis recipe/);
    const broken = chassis();
    broken.lathes = broken.lathes.slice(0, 2);
    expect(() => deriveAxleSockets(broken)).toThrow(/exactly 4/);
  });
});

describe('deriveBaySockets', () => {
  it('gives an engine-nosed chassis an engine bay, cabin deck, and dash rail', () => {
    const bays = deriveBaySockets(chassis());
    expect(bays.engineBay).toBeDefined();
    expect(bays.cabinDeck).toBeDefined();
    expect(bays.dashRail).toBeDefined();
    expect(bays.engineBay.anchor[1]).toBeGreaterThan(bays.cabinDeck.anchor[1]); // bay forward of deck
    expect(bays.dashRail.anchor[2]).toBeGreaterThan(bays.cabinDeck.anchor[2]); // dash above deck
    expect(bays.hitch).toBeUndefined();
  });

  it('gives a towed frame a hitch and NO engine bay - missing bay is data', () => {
    const bays = deriveBaySockets(resolveVehChassisRecipe({ family: 'towedFrame', seed: 'camper' }));
    expect(bays.engineBay).toBeUndefined();
    expect(bays.dashRail).toBeUndefined();
    expect(bays.cabinDeck).toBeDefined();
    expect(bays.hitch).toBeDefined();
    expect(bays.hitch.anchor[1]).toBeGreaterThan(0); // tongue points forward
  });
});

describe('planComponentFit', () => {
  it('seats four wheels on the hub sockets, ground-true, left side flipped', () => {
    const wheel = resolveVehWheelRecipe({ family: 'steelie', palette: 'factorySteel', seed: 'fitment' });
    const { placements, warnings } = planComponentFit(wheel, chassis());
    expect(warnings).toEqual([]);
    expect(placements).toHaveLength(4);
    for (const p of placements) {
      expect(p.at[2]).toBeCloseTo(0, 3); // hubCenter z=1 onto socket z=1 → contact patch on the ground
      expect(Math.abs(p.at[0])).toBeCloseTo(2.45, 3);
      expect(Math.abs(p.at[1])).toBeCloseTo(4, 3);
      if (p.side === 'left') expect(p.flip).toBe('x');
      else expect(p.flip).toBeUndefined();
    }
  });

  it('warns when the wheel radius fights the chassis ride height', () => {
    const heavy = resolveVehWheelRecipe({ family: 'heavyDuty', seed: 'oversize' }); // radius 1.35
    const { warnings } = planComponentFit(heavy, chassis());
    expect(warnings.some((w) => /radius/.test(w))).toBe(true);
  });

  it('throws when a part asks for a bay the chassis does not have', () => {
    const enginePart = { garage: { mountFamily: 'bay-mount', hardpoints: { mount: [0, 0, 0] } } };
    const trailer = resolveVehChassisRecipe({ family: 'towedFrame', seed: 'camper' });
    expect(() => planComponentFit(enginePart, trailer)).toThrow(/no engineBay socket/);
    // ...but the same part seats fine on an engine-nosed chassis
    const { placements } = planComponentFit(enginePart, chassis());
    expect(placements).toHaveLength(1);
    expect(placements[0].socket).toBe('engineBay');
  });

  it('throws clear errors for unknown or missing mount families', () => {
    expect(() => planComponentFit({ garage: { mountFamily: 'banana' } }, chassis())).toThrow(/Unknown mountFamily/);
    expect(() => planComponentFit({ garage: {} }, chassis())).toThrow(/mountFamily/);
    expect(() => planComponentFit({ garage: { mountFamily: 'hub-mount', hardpoints: {} } }, chassis())).toThrow(/hubCenter/);
  });
});
