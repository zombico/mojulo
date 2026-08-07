import { describe, it, expect } from 'vitest';

import { VEH_ARCHETYPES, mapChassisStations, planAssemblyBom, planVehicleBuild } from './assembly-bom.js';
import { resolveVehChassisRecipe } from './veh-chassis.js';
import { resolveVehWheelRecipe } from './veh-wheel.js';
import { resolveVehEngineRecipe } from './veh-engine.js';
import { resolveVehCabinRecipe } from './veh-cabin.js';
import { resolveVehDashRecipe } from './veh-dash.js';
import { resolveVehSteeringRecipe } from './veh-steering.js';
import { resolveVehBodyRecipe } from './veh-body.js';
import { resolveVehLightsRecipe } from './veh-lights.js';
import { resolveVehPayloadRecipe } from './veh-payload.js';

const sedanParts = (seed = 'audit') => {
  const chassis = resolveVehChassisRecipe({ family: 'unibodyPan', seed });
  return {
    chassis,
    parts: [
      chassis,
      ...Array.from({ length: 4 }, () => resolveVehWheelRecipe({ family: 'steelie', seed })),
      resolveVehEngineRecipe({ family: 'inlineFour', seed }),
      resolveVehCabinRecipe({ family: 'twoPlusTwo', seed }),
      resolveVehSteeringRecipe({ family: 'threeSpoke', seed }),
      resolveVehDashRecipe({ family: 'slabCluster', seed }),
      resolveVehBodyRecipe({ family: 'sedanThree', seed }),
      resolveVehLightsRecipe({ family: 'roundDuo', seed }),
      resolveVehLightsRecipe({ family: 'roundDuo', seed, overrides: { function: 'tail' } }),
    ],
  };
};

describe('VEH_ARCHETYPES', () => {
  it('encodes BOM-varies-by-class as data', () => {
    expect(Object.keys(VEH_ARCHETYPES)).toEqual([
      'sedan', 'coupe', 'suv', 'minivan', 'caravanVan', 'towtruck', 'flatbed', 'trailer',
    ]);
    expect(VEH_ARCHETYPES.sedan.bom['veh-engine']).toBe(1);
    expect(VEH_ARCHETYPES.trailer.bom['veh-engine']).toBeUndefined();
    expect(VEH_ARCHETYPES.towtruck.bom['veh-payload']).toBe(1);
    expect(VEH_ARCHETYPES.caravanVan.bom['veh-cabin']).toBe(2);
  });
});

describe('mapChassisStations', () => {
  it('maps a car chassis: 4 hubs + engineBay + cabinDeck + dashRail + rearDeck', () => {
    const stations = mapChassisStations(resolveVehChassisRecipe({ family: 'unibodyPan', seed: 1 }));
    const names = stations.map((s) => s.station);
    expect(names).toEqual(expect.arrayContaining([
      'front-left-hub', 'front-right-hub', 'rear-left-hub', 'rear-right-hub',
      'engineBay', 'cabinDeck', 'dashRail', 'rearDeck',
    ]));
    expect(stations.find((s) => s.station === 'dashRail').expects).toEqual(['veh-dash', 'veh-steering']);
  });

  it('maps a trailer: no engineBay/dashRail, hitch present', () => {
    const names = mapChassisStations(resolveVehChassisRecipe({ family: 'towedFrame', seed: 1 })).map((s) => s.station);
    expect(names).not.toContain('engineBay');
    expect(names).not.toContain('dashRail');
    expect(names).toContain('hitch');
    expect(names).toContain('rearDeck');
  });
});

describe('planAssemblyBom + planVehicleBuild', () => {
  it('passes a complete sedan and maps every required station', () => {
    const { chassis, parts } = sedanParts();
    const build = planVehicleBuild({ archetype: 'sedan', chassis, parts });
    expect(build.audit.ok).toBe(true);
    expect(build.audit.missing).toEqual([]);
    expect(build.warnings).toEqual([]);
    const hubs = build.stations.filter((s) => s.mount === 'hub-mount');
    expect(hubs.every((s) => s.filledBy && s.filledBy.kind === 'veh-wheel')).toBe(true);
    expect(build.stations.find((s) => s.station === 'engineBay').filledBy.family).toBe('inlineFour');
  });

  it('reports the missing component when the engine is left out - the industrial edge', () => {
    const { chassis, parts } = sedanParts();
    const withoutEngine = parts.filter((p) => p.garage.kind !== 'veh-engine');
    const build = planVehicleBuild({ archetype: 'sedan', chassis, parts: withoutEngine });
    expect(build.audit.ok).toBe(false);
    expect(build.audit.missing).toEqual(['veh-engine: have 0, need 1']);
    expect(build.warnings.some((w) => w.includes('engineBay is unfilled'))).toBe(true);
  });

  it('passes a trailer with no engine and flags an engine as surplus, advisorily', () => {
    const chassis = resolveVehChassisRecipe({ family: 'towedFrame', seed: 'camper' });
    const parts = [
      chassis,
      ...Array.from({ length: 4 }, () => resolveVehWheelRecipe({ family: 'heavyDuty', seed: 'camper' })),
      resolveVehPayloadRecipe({ family: 'boxVan', seed: 'camper' }),
    ];
    const build = planVehicleBuild({ archetype: 'trailer', chassis, parts });
    expect(build.audit.ok).toBe(true);
    const withEngine = planAssemblyBom([...parts, resolveVehEngineRecipe({ seed: 1 })], VEH_ARCHETYPES.trailer.bom);
    expect(withEngine.ok).toBe(true); // advisory: surplus never fails the audit
    expect(withEngine.surplus).toEqual(['veh-engine: not in this archetype\'s BOM']);
  });

  it('throws on unknown archetypes', () => {
    const { chassis, parts } = sedanParts();
    expect(() => planVehicleBuild({ archetype: 'hovercraft', chassis, parts })).toThrow(/Unknown vehicle archetype/);
  });
});
