import { describe, expect, it } from 'vitest';

import {
  allocationRequestForConcept,
  createDefaultArchitectureSurfaces,
  planArchitectureMandala,
} from './architecture-mandala-planner.js';

function slotOverlaps(a, b) {
  return !(
    a.u + a.w <= b.u ||
    b.u + b.w <= a.u ||
    a.v + a.h <= b.v ||
    b.v + b.h <= a.v
  );
}

describe('architecture mandala planner', () => {
  it('maps registry concepts to explicit surface budget requests', () => {
    const facadeWrapTower = allocationRequestForConcept('building.facade-wrap-tower');
    expect(facadeWrapTower.surfaceKinds).toContain('buildingMass');
    expect(facadeWrapTower.massingKind).toBe('facadeWrap');
    expect(facadeWrapTower.wrapNet.addressSpace).toBe('face + bay + floor');

    const radialWrapTower = allocationRequestForConcept('building.radial-wrap-tower');
    expect(radialWrapTower.surfaceKinds).toContain('radialBuildingMass');
    expect(radialWrapTower.massingKind).toBe('radialWrap');
    expect(radialWrapTower.wrapNet.addressSpace).toBe('theta segment + floor');

    const balcony = allocationRequestForConcept('facade.allocated-balcony');
    expect(balcony.surfaceKinds).toContain('facadeFace');
    expect(balcony.size[0]).toBeLessThan(0.25);

    const busStop = allocationRequestForConcept('urban.bus-stop-shelter');
    expect(busStop.surfaceKinds).toContain('sidewalk');

    const tower = allocationRequestForConcept('infrastructure.cell-tower');
    expect(tower.surfaceKinds).toContain('utilityEasement');

    const bleachers = allocationRequestForConcept('sport.bleacher-terraces');
    expect(bleachers.surfaceKinds).toContain('venue');

    const airport = allocationRequestForConcept('transport.airport-terminal');
    expect(airport.surfaceKinds).toContain('transportApron');

    const train = allocationRequestForConcept('transport.train-station');
    expect(train.surfaceKinds).toContain('railPlatform');
  });

  it('allocates an urban scene onto compatible surfaces without collisions', () => {
    const plan = planArchitectureMandala({
      seed: 'urban-readable',
      conceptIds: [
        'urban.sidewalk-road',
        'facade.storefront-podium',
        'urban.bus-stop-shelter',
        'urban.phone-booth',
        'urban.hydrant-utility',
        'infrastructure.cell-tower',
      ],
    });

    expect(plan.unplaced).toEqual([]);
    expect(plan.diagnostics.readable).toBe(true);
    expect(plan.allocations.map((allocation) => allocation.conceptId)).toEqual(expect.arrayContaining([
      'urban.sidewalk-road',
      'facade.storefront-podium',
      'urban.bus-stop-shelter',
      'urban.phone-booth',
      'urban.hydrant-utility',
      'infrastructure.cell-tower',
    ]));
    expect(plan.allocations.find((allocation) => allocation.conceptId === 'facade.storefront-podium')?.surfaceKind).toBe('facadeFace');
    expect(plan.allocations.find((allocation) => allocation.conceptId === 'urban.bus-stop-shelter')?.surfaceKind).toBe('sidewalk');
    expect(plan.allocations.find((allocation) => allocation.conceptId === 'infrastructure.cell-tower')?.surfaceKind).toBe('utilityEasement');

    for (const surface of plan.surfaces) {
      const allocations = plan.allocations.filter((allocation) => allocation.surfaceId === surface.id);
      for (let i = 0; i < allocations.length; i += 1) {
        for (let j = i + 1; j < allocations.length; j += 1) {
          expect(slotOverlaps(allocations[i].slot, allocations[j].slot)).toBe(false);
        }
      }
    }
  });

  it('keeps allocated balconies inside facade area budget', () => {
    const plan = planArchitectureMandala({
      seed: 'balcony-budget',
      conceptIds: [
        'facade.condo-grid',
        'facade.allocated-balcony',
        'facade.storefront-podium',
        'urban.billboard-signage',
      ],
    });

    const facadeAllocations = plan.allocations.filter((allocation) => allocation.surfaceKind === 'facadeFace');
    expect(facadeAllocations.length).toBeGreaterThanOrEqual(2);
    const facadeDiagnostics = plan.diagnostics.surfaces.filter((surface) => surface.kind === 'facadeFace');
    expect(facadeDiagnostics.some((surface) => surface.coverage > 0)).toBe(true);
    expect(plan.diagnostics.overBudgetSurfaces).toEqual([]);
    expect(plan.diagnostics.collisionCount).toBe(0);
  });

  it('routes from prompt text into a mandala plan', () => {
    const plan = planArchitectureMandala({
      prompt: 'farm with barn, windmill, corrals, plowed field, and farmhouse',
      seed: 'farm-prompt',
    });

    expect(plan.concepts).toEqual(expect.arrayContaining(['farm.farmyard-core', 'farm.tracted-field']));
    expect(plan.allocations.some((allocation) => allocation.surfaceKind === 'field')).toBe(true);
    expect(plan.diagnostics.allocationCount).toBeGreaterThan(0);
  });

  it('allocates mixed rectilinear and radial skyline towers as massing concepts', () => {
    const plan = planArchitectureMandala({
      seed: 'mixed-skyline',
      conceptIds: [
        'urban.sidewalk-road',
        'building.facade-wrap-tower',
        'building.radial-wrap-tower',
      ],
    });

    expect(plan.unplaced).toEqual([]);
    const facade = plan.allocations.find((allocation) => allocation.conceptId === 'building.facade-wrap-tower');
    const radial = plan.allocations.find((allocation) => allocation.conceptId === 'building.radial-wrap-tower');
    expect(facade?.surfaceKind).toBe('buildingMass');
    expect(facade?.massingKind).toBe('facadeWrap');
    expect(facade?.wrapNet.kind).toBe('facadeWrap');
    expect(radial?.surfaceKind).toBe('radialBuildingMass');
    expect(radial?.massingKind).toBe('radialWrap');
    expect(radial?.wrapNet.kind).toBe('radialWrap');
    expect(plan.diagnostics.collisionCount).toBe(0);
  });

  it('reports unplaced concepts when compatible surfaces are oversubscribed', () => {
    const tinySurfaces = [
      {
        id: 'tiny.sidewalk',
        kind: 'sidewalk',
        contract: 'sidewalk.edge',
        rect: { u: 0, v: 0, w: 0.2, h: 0.2 },
        maxCoverage: 0.08,
        note: 'intentionally tiny test surface',
      },
    ];
    const plan = planArchitectureMandala({
      seed: 'oversubscribed',
      surfaces: tinySurfaces,
      conceptIds: [
        'urban.bus-stop-shelter',
        'urban.newsstand-vendor',
        'urban.phone-booth',
        'urban.hydrant-utility',
      ],
    });

    expect(plan.unplaced.length).toBeGreaterThan(0);
    expect(plan.diagnostics.unplacedCount).toBe(plan.unplaced.length);
    expect(plan.diagnostics.readable).toBe(false);
  });

  it('exposes a useful default surface map', () => {
    const surfaces = createDefaultArchitectureSurfaces();
    expect(surfaces.map((surface) => surface.kind)).toEqual(expect.arrayContaining([
      'buildingMass',
      'radialBuildingMass',
      'roadPlane',
      'sidewalk',
      'facadeFace',
      'roofTop',
      'utilityEasement',
      'field',
      'venue',
      'transportApron',
      'railPlatform',
    ]));
  });

  it('allocates transportation hubs onto hub-specific surfaces', () => {
    const plan = planArchitectureMandala({
      seed: 'transport-hub',
      conceptIds: ['transport.airport-terminal', 'transport.train-station', 'urban.sidewalk-road'],
    });

    expect(plan.unplaced).toEqual([]);
    expect(plan.allocations.find((allocation) => allocation.conceptId === 'transport.airport-terminal')?.surfaceKind).toBe('transportApron');
    expect(plan.allocations.find((allocation) => allocation.conceptId === 'transport.train-station')?.surfaceKind).toBe('railPlatform');
    expect(plan.diagnostics.collisionCount).toBe(0);
  });

  it('codifies crosswalks as crossings with paint bars parallel to the road', () => {
    const request = allocationRequestForConcept('urban.sidewalk-road');
    expect(request.axisFrame).toEqual({ roadAxis: 'u', crossAxis: 'v' });
    expect(request.crosswalkPolicy).toEqual({
      crossingAxis: 'v',
      stripeLongAxis: 'u',
      crossingPerpendicularToRoadAxis: true,
    });

    const plan = planArchitectureMandala({
      seed: 'crosswalk-axis',
      conceptIds: ['urban.sidewalk-road'],
    });
    const road = plan.allocations.find((allocation) => allocation.conceptId === 'urban.sidewalk-road');
    expect(road.axisFrame).toEqual({ roadAxis: 'u', crossAxis: 'v' });
    expect(road.crosswalkPolicy.crossingPerpendicularToRoadAxis).toBe(true);
    expect(road.crosswalkPolicy.crossingAxis).toBe(road.axisFrame.crossAxis);
    expect(road.crosswalkPolicy.stripeLongAxis).toBe(road.axisFrame.roadAxis);
  });
});
