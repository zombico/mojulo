import { describe, it, expect } from 'vitest';
import { compileTerrainPlan, validateTerrainPlan, BIOMES, biomeIds } from './terrain-plan.js';
import { validateFields, buildFieldResolver } from './fields.js';
import { renderManjiTreeToSvg } from './manji-svg.js';

const PLAN = {
  title: 'test-valley',
  regions: [
    { role: 'north-hill', center: { x: -7, y: -4 }, radius: 15, biome: 'forest', peak: 5 },
    { role: 'east-ridge', center: { x: 9, y: 5 }, radius: 12, biome: 'rock', peak: 6 },
    { role: 'south-lake', center: { x: 3, y: 13 }, radius: 9, biome: 'water', peak: 4 },
  ],
  rivers: [{ waypoints: [{ x: -7, y: -4 }, { x: 0, y: 4 }, { x: 3, y: 11 }], width: 2.4, depth: 1.6 }],
};

describe('terrain-plan — validation', () => {
  it('accepts a well-formed plan', () => {
    expect(validateTerrainPlan(PLAN)).toEqual([]);
  });
  it('rejects unknown biome, empty regions, bad river', () => {
    expect(validateTerrainPlan({ regions: [] }).some((e) => e.includes('non-empty'))).toBe(true);
    expect(validateTerrainPlan({ regions: [{ role: 'a', center: { x: 0, y: 0 }, radius: 5, biome: 'swamp' }] })
      .some((e) => e.includes('biome'))).toBe(true);
    expect(validateTerrainPlan({ regions: [{ role: 'a', center: { x: 0, y: 0 }, radius: 5, biome: 'forest' }],
      rivers: [{ waypoints: [{ x: 0, y: 0 }] }] }).some((e) => e.includes('waypoints'))).toBe(true);
  });
  it('rejects duplicate roles', () => {
    const dup = { regions: [
      { role: 'a', center: { x: 0, y: 0 }, radius: 5, biome: 'forest' },
      { role: 'a', center: { x: 5, y: 5 }, radius: 5, biome: 'rock' },
    ] };
    expect(validateTerrainPlan(dup).some((e) => e.includes('duplicate role'))).toBe(true);
  });
});

describe('terrain-plan — compilation', () => {
  const manifest = compileTerrainPlan(PLAN);

  it('emits one terrain-region field per region, a grounded river dip chain, + elevation sum', () => {
    expect(manifest.fields['region_north-hill'].kind).toBe('terrain-region');
    expect(manifest.fields['region_east-ridge'].kind).toBe('terrain-region');
    expect(manifest.fields['region_south-lake'].kind).toBe('terrain-region');
    // The river is a chain of negative terrain-region dips (grounded), not a
    // raw curve-distance term (which would lift the whole map off baseline).
    const riverDips = Object.entries(manifest.fields).filter(([id]) => id.startsWith('river_0_'));
    expect(riverDips.length).toBeGreaterThan(1);
    expect(riverDips.every(([, f]) => f.kind === 'terrain-region' && f.peak < 0)).toBe(true);
    expect(manifest.fields.elevation.kind).toBe('sum');
    expect(manifest.fields.elevation.components.length).toBe(3 + riverDips.length);
  });

  it('binds each region to its biome waveform and peak sign', () => {
    // water dips below baseline (negative peak), hill rises above.
    expect(manifest.fields['region_north-hill'].peak).toBeGreaterThan(0);
    expect(manifest.fields['region_south-lake'].peak).toBeLessThan(0);
    // rock region carries the jagged biome waveform.
    expect(manifest.fields['region_east-ridge'].waves).toEqual(BIOMES.rock.waveform.map((w) => ({ ...w })));
  });

  it('lays a water plane for the lake region and a terrain surface', () => {
    // first waveField is the terrain surface (heightField), then one water plane.
    expect(manifest.waveFields[0].heightField).toBe('elevation');
    expect(manifest.waveFields.length).toBe(2);
    expect(manifest.waveFields[1].style.stroke).toBe('#3a6ea5');
  });

  it('scatters only forest/meadow regions (not rock/water)', () => {
    // north-hill (forest) scatters; east-ridge (rock) + south-lake (water) do not.
    expect(manifest.tree.children.length).toBe(1);
    expect(manifest.tree.children[0].node.replicate.offsets.length).toBeGreaterThan(0);
  });

  it('compiles to a manifest whose fields validate and which renders', () => {
    expect(validateFields(manifest.fields, [])).toEqual([]);
    // elevation is resolvable and grounded far outside every region.
    const elev = buildFieldResolver(manifest.fields, [])('elevation');
    expect(elev({ x: 19, y: -19, z: 0 })).toBeCloseTo(0, 6);
    const svg = renderManjiTreeToSvg(manifest);
    expect(svg).toMatch(/<line /);
  });
});

describe('terrain-plan — biome table', () => {
  it('exposes the closed biome set', () => {
    expect(biomeIds().sort()).toEqual(['forest', 'meadow', 'rock', 'water']);
  });
});
