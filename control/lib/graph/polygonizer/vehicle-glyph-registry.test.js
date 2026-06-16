import { describe, expect, it } from 'vitest';

import {
  findVehicleGlyphConceptsForPrompt,
  getVehicleGlyphConcept,
  instantiateVehicleGlyphPlan,
  listVehicleGlyphConcepts,
  rigVehicleFootprint,
  VEHICLE_GLYPH_VERSION,
} from './vehicle-glyph-registry.js';

describe('vehicle glyph registry', () => {
  it('exposes the bus as a reusable vehicle primitive', () => {
    expect(VEHICLE_GLYPH_VERSION).toMatch(/^vehicle-glyphs-/);
    const concepts = listVehicleGlyphConcepts({ family: 'bus' });
    expect(concepts.map((concept) => concept.id)).toContain('vehicle.bus.side-slab');
    expect(listVehicleGlyphConcepts({ family: 'chassis' }).map((concept) => concept.id)).toContain('vehicle.chassis.grounded-manji');
    expect(listVehicleGlyphConcepts({ family: 'rectangular-vehicle' }).map((concept) => concept.id)).toContain('vehicle.rectangular-wheeled.payload');
    expect(listVehicleGlyphConcepts({ family: 'truck' }).map((concept) => concept.id)).toContain('vehicle.truck.long-haul');
  });

  it('looks up long-haul truck concepts by freight aliases', () => {
    const truck = getVehicleGlyphConcept('semi truck');
    expect(truck.id).toBe('vehicle.truck.long-haul');
    expect(truck.composeWith).toContain('vehicle.rectangular-wheeled.payload');
    expect(truck.basis.body).toContain('split cab plus trailer');
    expect(truck.basis.cargoHybrid).toContain('train-cart-compatible');
  });

  it('looks up the rectangular wheeled vehicle parent by train-like aliases', () => {
    const segment = getVehicleGlyphConcept('train segment');
    expect(segment.id).toBe('vehicle.rectangular-wheeled.payload');
    expect(segment.composeWith).toContain('vehicle.chassis.grounded-manji');
    expect(segment.basis.payload).toContain('rectangular body mass');
    expect(segment.basis.facadeSlots).toContain('wheel keep-outs');
    expect(segment.renderHints.join(' ')).toContain('specialize into bus, train segment, tram, or van');
  });

  it('looks up the bus by alias and records wheel/body structure', () => {
    const bus = getVehicleGlyphConcept('city bus');
    expect(bus.id).toBe('vehicle.bus.side-slab');
    expect(bus.composeWith).toContain('vehicle.rectangular-wheeled.payload');
    expect(bus.basis.parent).toBe('vehicle.rectangular-wheeled.payload');
    expect(bus.composeWith).toContain('vehicle.chassis.grounded-manji');
    expect(bus.basis.chassis).toBe('vehicle.chassis.grounded-manji');
    expect(bus.basis.body).toContain('rectangle');
    expect(bus.basis.wheels).toContain('inherited');
    expect(bus.placement.support).toContain('road-plane');
  });

  it('retrieves concepts from bus/train prompt text', () => {
    const busHeavy = findVehicleGlyphConceptsForPrompt('city bus at a curb lane with another bus behind it');
    expect(busHeavy[0].id).toBe('vehicle.bus.side-slab');

    const railPrompt = findVehicleGlyphConceptsForPrompt('high speed train head car on rail platform');
    expect(railPrompt.map((entry) => entry.id)).toContain('vehicle.rectangular-wheeled.payload');

    const freightPrompt = findVehicleGlyphConceptsForPrompt('long haul cargo truck with semi trailer');
    expect(freightPrompt[0].id).toBe('vehicle.truck.long-haul');
  });

  it('instantiates a grounded chassis manji with axle frame support', () => {
    const chassis = instantiateVehicleGlyphPlan('vehicle chassis', { seed: 'curb-bus', variant: 0 });
    expect(chassis.conceptId).toBe('vehicle.chassis.grounded-manji');
    expect(chassis.structuralBasis.planView).toContain('top-down');
    expect(chassis.structuralBasis.wheelPair).toContain('axle');
    expect(chassis.structuralBasis.frame).toContain('stacked frame');
    expect(chassis.placement.support).toContain('road-plane');
  });

  it('instantiates deterministic bus variation parameters', () => {
    const a = instantiateVehicleGlyphPlan('bus', { seed: 'curb-bus', variant: 1 });
    const b = instantiateVehicleGlyphPlan('bus', { seed: 'curb-bus', variant: 1 });
    expect(a).toEqual(b);
    expect(a.parameters.windowCount).toBeGreaterThanOrEqual(3);
    expect(a.parameters.windowCount).toBeLessThanOrEqual(8);
    expect([2, 3]).toContain(a.parameters.wheelCount);
    expect(a.parent.conceptId).toBe('vehicle.rectangular-wheeled.payload');
    expect(a.chassis.conceptId).toBe('vehicle.chassis.grounded-manji');
    expect(a.chassis.parameters.wheelCount).toBe(a.parameters.wheelCount);
  });

  it('instantiates deterministic rectangular wheeled vehicle variation parameters', () => {
    const a = instantiateVehicleGlyphPlan('rail car segment', { seed: 'metro-car', variant: 3 });
    const b = instantiateVehicleGlyphPlan('rectangular vehicle', { seed: 'metro-car', variant: 3 });
    expect(a).toEqual(b);
    expect(a.conceptId).toBe('vehicle.rectangular-wheeled.payload');
    expect(['bus-like', 'train-car', 'tram-car', 'box-van']).toContain(a.parameters.segmentClass);
    expect([2, 3, 4]).toContain(a.parameters.axleCount);
    expect(a.chassis.conceptId).toBe('vehicle.chassis.grounded-manji');
    expect(a.placement.support).toContain('road axis');
  });

  it('instantiates deterministic long-haul truck variation parameters', () => {
    const a = instantiateVehicleGlyphPlan('long haul truck', { seed: 'interstate-freight', variant: 2 });
    const b = instantiateVehicleGlyphPlan('cargo truck', { seed: 'interstate-freight', variant: 2 });
    expect(a).toEqual(b);
    expect(a.conceptId).toBe('vehicle.truck.long-haul');
    expect([3, 4, 5]).toContain(a.parameters.axleCount);
    expect(['box-trailer', 'reefer-trailer', 'flatbed-trailer']).toContain(a.parameters.trailerProfile);
    expect(['none', 'train-cart-compatible']).toContain(a.parameters.cargoHybrid);
    expect(a.parent.conceptId).toBe('vehicle.rectangular-wheeled.payload');
  });

  it('rigs a flat chassis footprint into a body box, wheels, and raised axles', () => {
    const bus = instantiateVehicleGlyphPlan('bus', { seed: 'curb-bus', variant: 1 });
    const rig = rigVehicleFootprint(bus, {
      origin: [10, 12, 0],
      length: 6,
      width: 2.4,
      bodyHeight: 1.7,
      wheelCellSize: 0.68,
      wheelRoadLength: 1.02,
      wheelHeight: 0.82,
    });
    expect(rig.orientation).toBe('road-parallel');
    expect(rig.orientationPolicy).toEqual({
      default: 'road-parallel',
      roadAxis: 'x',
      mayOverride: false,
    });
    expect(rig.footprint).toEqual({ x: 10, y: 12, z: 0, width: 6, length: 2.4 });
    expect(rig.bodyBox.height).toBe(1.7);
    expect(rig.bodyBox.z).toBeCloseTo(0.41 * 1.45);
    expect(rig.wheelPairs).toHaveLength(2);
    for (const pair of rig.wheelPairs) {
      expect(pair.left.center[2]).toBeCloseTo(0.41);
      expect(pair.right.center[2]).toBeCloseTo(0.41);
      expect(pair.left.width).toBeCloseTo(1.02);
      expect(pair.left.depth).toBeCloseTo(0.68);
      expect(pair.left.height).toBeCloseTo(0.82);
      expect(pair.right.width).toBeCloseTo(1.02);
      expect(pair.right.depth).toBeCloseTo(0.68);
      expect(pair.left.radius).toBeCloseTo(pair.left.height / 2);
      expect(pair.left.helperKind).toBe('square-wheel-cell');
      expect(pair.left.visibleKind).toBe('square-wheel-box');
      expect(pair.left.faceCenters.roadNear[1]).toBe(pair.left.center[1]);
      expect(pair.left.faceCenters.roadFar[1]).toBe(pair.left.center[1]);
      expect(pair.left.faceCenters.roadNear[0]).toBeLessThan(pair.left.faceCenters.roadFar[0]);
      expect(pair.left.contactCenters.roadNear[2]).toBe(rig.footprint.z);
      expect(pair.left.contactCenters.roadNear[2]).toBeLessThan(pair.left.faceCenters.roadNear[2]);
      expect(pair.axle.z).toBeCloseTo(pair.left.center[2]);
      expect(pair.axle.from[2]).toBe(pair.axle.to[2]);
    }
    expect(rig.frameBlocks).toHaveLength(2);
  });
});
