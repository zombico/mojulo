import { describe, expect, it } from 'vitest';

import { planArchitectureMandala } from './architecture-mandala-planner.js';
import {
  expandCivicGlyph,
  getCivicGlyph,
  listCivicGlyphs,
} from './architecture-civic-glyphs.js';

describe('architecture civic glyphs', () => {
  it('lists and reads civic glyph definitions', () => {
    expect(listCivicGlyphs().map((glyph) => glyph.id)).toEqual(expect.arrayContaining([
      'mixed-skyline-mandala',
      'transit-plaza-grid',
      'market-street-grid',
      'industrial-service-edge',
    ]));
    expect(getCivicGlyph('transit-plaza-grid')?.topology).toBe('orthogonal-transit-hub');
  });

  it('expands semideterministically for the same seed', () => {
    const a = expandCivicGlyph({ glyph: 'transit-plaza-grid', seed: 'city-a', density: 0.7 });
    const b = expandCivicGlyph({ glyph: 'transit-plaza-grid', seed: 'city-a', density: 0.7 });
    const c = expandCivicGlyph({ glyph: 'transit-plaza-grid', seed: 'city-b', density: 0.7 });

    expect(a).toEqual(b);
    expect(a.spawnPlan).not.toEqual(c.spawnPlan);
    expect(a.conceptIds).toEqual(expect.arrayContaining([
      'urban.sidewalk-road',
      'transport.train-station',
      'transport.airport-terminal',
      'facade.storefront-podium',
    ]));
  });

  it('uses density to select more optional urban objects', () => {
    const low = expandCivicGlyph({ glyph: 'market-street-grid', seed: 'market-density', density: 0.25, variation: 0 });
    const high = expandCivicGlyph({ glyph: 'market-street-grid', seed: 'market-density', density: 0.95, variation: 0 });

    expect(high.conceptIds.length).toBeGreaterThan(low.conceptIds.length);
    expect(high.spawnPlan.filter((spawn) => spawn.selected).length).toBeGreaterThan(
      low.spawnPlan.filter((spawn) => spawn.selected).length,
    );
  });

  it('feeds generated surfaces and concepts into the mandala planner', () => {
    const expanded = expandCivicGlyph({ glyph: 'transit-plaza-grid', seed: 'planner-city', density: 0.76 });
    const plan = planArchitectureMandala({
      seed: expanded.seed,
      surfaces: expanded.surfaces,
      conceptIds: expanded.conceptIds,
    });

    expect(plan.allocations.length).toBeGreaterThan(4);
    expect(plan.diagnostics.collisionCount).toBe(0);
    expect(plan.allocations.map((allocation) => allocation.conceptId)).toEqual(expect.arrayContaining([
      'transport.train-station',
      'transport.airport-terminal',
      'urban.sidewalk-road',
    ]));
  });

  it('expands a mixed skyline with rectilinear and radial tower concepts', () => {
    const expanded = expandCivicGlyph({ glyph: 'mixed-skyline-mandala', seed: 'skyline', density: 0.8 });
    expect(expanded.conceptIds).toEqual(expect.arrayContaining([
      'urban.sidewalk-road',
      'building.facade-wrap-tower',
      'building.radial-wrap-tower',
    ]));
    expect(expanded.surfaces.map((surface) => surface.kind)).toEqual(expect.arrayContaining([
      'buildingMass',
      'radialBuildingMass',
    ]));

    const plan = planArchitectureMandala({
      seed: expanded.seed,
      surfaces: expanded.surfaces,
      conceptIds: expanded.conceptIds,
    });

    expect(plan.allocations.map((allocation) => allocation.conceptId)).toEqual(expect.arrayContaining([
      'building.facade-wrap-tower',
      'building.radial-wrap-tower',
    ]));
    expect(plan.allocations.find((allocation) => allocation.conceptId === 'building.radial-wrap-tower')?.wrapNet.kind).toBe('radialWrap');
    expect(plan.diagnostics.collisionCount).toBe(0);
  });
});
