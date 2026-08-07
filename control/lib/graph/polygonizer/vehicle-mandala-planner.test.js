import { describe, expect, it } from 'vitest';

import {
  allocationRequestForVehicleConcept,
  createDefaultVehicleSurfaces,
  planVehicleMandala,
} from './vehicle-mandala-planner.js';

function slotOverlaps(a, b) {
  return !(
    a.u + a.w <= b.u
    || b.u + b.w <= a.u
    || a.v + a.h <= b.v
    || b.v + b.h <= a.v
  );
}

describe('vehicle mandala planner', () => {
  it('maps bus and train-ready concepts to explicit support surfaces', () => {
    const bus = allocationRequestForVehicleConcept('vehicle.bus.side-slab');
    expect(bus.surfaceKinds).toContain('roadPlane');
    expect(bus.priority).toBeGreaterThan(70);

    const rectangular = allocationRequestForVehicleConcept('vehicle.rectangular-wheeled.payload');
    expect(rectangular.surfaceKinds).toContain('railPlane');
    expect(rectangular.surfaceKinds).toContain('platformEdge');

    const truck = allocationRequestForVehicleConcept('vehicle.truck.long-haul');
    expect(truck.surfaceKinds).toContain('roadPlane');
    expect(truck.surfaceKinds).toContain('yardPad');
    expect(truck.priority).toBeGreaterThan(bus.priority);
  });

  it('allocates bus and rectangular payload without collisions', () => {
    const plan = planVehicleMandala({
      seed: 'vehicle-planner-readable',
      conceptIds: ['vehicle.bus.side-slab', 'vehicle.rectangular-wheeled.payload'],
    });

    expect(plan.unplaced).toEqual([]);
    expect(plan.diagnostics.collisionCount).toBe(0);
    expect(plan.diagnostics.readable).toBe(true);
    expect(plan.allocations.map((allocation) => allocation.conceptId)).toEqual(expect.arrayContaining([
      'vehicle.bus.side-slab',
      'vehicle.rectangular-wheeled.payload',
    ]));

    for (const surface of plan.surfaces) {
      const allocations = plan.allocations.filter((allocation) => allocation.surfaceId === surface.id);
      for (let i = 0; i < allocations.length; i += 1) {
        for (let j = i + 1; j < allocations.length; j += 1) {
          expect(slotOverlaps(allocations[i].slot, allocations[j].slot)).toBe(false);
        }
      }
    }
  });

  it('allocates trucks as large road or yard vehicles without collisions', () => {
    const plan = planVehicleMandala({
      seed: 'vehicle-planner-truck-readable',
      conceptIds: ['vehicle.truck.long-haul', 'vehicle.bus.side-slab', 'vehicle.rectangular-wheeled.payload'],
    });

    const truck = plan.allocations.find((allocation) => allocation.conceptId === 'vehicle.truck.long-haul');
    expect(truck).toBeDefined();
    expect(['roadPlane', 'yardPad']).toContain(truck.surfaceKind);
    expect(truck.area).toBeGreaterThan(0.18);
    expect(plan.unplaced).toEqual([]);
    expect(plan.diagnostics.collisionCount).toBe(0);
    expect(plan.diagnostics.readable).toBe(true);
  });

  it('reports unplaced concepts when surfaces are oversubscribed', () => {
    const tinySurfaces = [{
      id: 'tiny-road',
      kind: 'roadPlane',
      contract: 'road.axis',
      rect: { u: 0, v: 0, w: 0.2, h: 0.2 },
      maxCoverage: 0.05,
      note: 'tiny oversubscription test',
    }];
    const plan = planVehicleMandala({
      seed: 'vehicle-oversubscribed',
      surfaces: tinySurfaces,
      conceptIds: [
        'vehicle.bus.side-slab',
        'vehicle.rectangular-wheeled.payload',
        'vehicle.chassis.grounded-manji',
      ],
    });
    expect(plan.unplaced.length).toBeGreaterThan(0);
    expect(plan.diagnostics.unplacedCount).toBe(plan.unplaced.length);
    expect(plan.diagnostics.readable).toBe(false);
  });

  it('exposes a default surface map with road and rail supports', () => {
    const surfaces = createDefaultVehicleSurfaces();
    expect(surfaces.map((surface) => surface.kind)).toEqual(expect.arrayContaining([
      'roadPlane',
      'railPlane',
      'platformEdge',
      'yardPad',
    ]));
  });
});
