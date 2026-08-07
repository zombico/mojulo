import { describe, it, expect } from 'vitest';
import {
  VEHICLE_FAMILIES, listFamilies, getFamily, familyOfType, typesInFamily,
  describeType, listDecorations, describeFamily, sampleType, sampleInstance,
  buildInstanceFaces, assembleInstanceStudio, planInstance,
} from './meta-fabricator.js';
import { VEHICLE_TYPES, VEHICLE_REGISTRY, vehicleFaces } from './vehicles/vehicles-css3d.js';
import { AIRCRAFT_LIVERY_SCHEMES } from './polygonizer/vehicle-fuselage-net.js';

// deterministic rng (matches the sibling vehicle tests)
function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const finite = (n) => Number.isFinite(n);
const validFace = (f) =>
  Array.isArray(f.corners) && f.corners.length === 4 &&
  f.corners.every((c) => Array.isArray(c) && c.length === 3 && c.every(finite)) &&
  typeof f.fill === 'string';

describe('meta-fabricator family layer', () => {
  it('exposes the three vehicle families', () => {
    expect(listFamilies().sort()).toEqual(['fixed-wing-aircraft', 'ground-box', 'ground-car', 'ground-cycle']);
    expect(getFamily('fixed-wing-aircraft').backend).toBe('plane');
    expect(() => getFamily('spaceships')).toThrow(/unknown family/);
  });

  it('partitions every registered vehicle type into exactly one family', () => {
    const byFamily = listFamilies().flatMap((id) => typesInFamily(id));
    // every type lands in a family...
    expect(byFamily.sort()).toEqual([...VEHICLE_TYPES].sort());
    // ...and no type lands in two
    expect(new Set(byFamily).size).toBe(byFamily.length);
    // every type's backend tag resolves to its family's backend
    for (const t of VEHICLE_TYPES) {
      const fam = VEHICLE_FAMILIES[familyOfType(t)];
      expect(fam.backend).toBe(VEHICLE_REGISTRY[t].family);
    }
  });

  it('groups the known presets under the expected families', () => {
    expect(typesInFamily('fixed-wing-aircraft').sort()).toEqual(['airliner', 'bizjet', 'regional', 'widebody']);
    expect(typesInFamily('ground-car')).toEqual(expect.arrayContaining(['sedan', 'suv', 'taxi', 'opsWagon']));
    expect(typesInFamily('ground-box')).toEqual(expect.arrayContaining(['cityBus', 'boxTruck', 'streetcar', 'beltLoader']));
  });

  it('describes a type with its family, net, weight and contexts', () => {
    const d = describeType('widebody');
    expect(d.family).toBe('fixed-wing-aircraft');
    expect(d.net).toBe('widebody');
    expect(d.weight).toBe(VEHICLE_REGISTRY.widebody.weight);
    expect(d.contexts).toContain('airfield');
    expect(d.footprint.length).toBeGreaterThan(0);          // aircraft get a footprint
    expect(describeType('sedan').footprint).toBeUndefined(); // ground vehicles don't
  });

  it('reports each family decoration vocabulary', () => {
    const air = listDecorations('fixed-wing-aircraft');
    expect(air.kind).toBe('livery');
    expect(air.schemes).toContain('classic');
    const car = listDecorations('ground-car');
    expect(car.kind).toBe('paint+hull');
    expect(car.schemes.length).toBeGreaterThan(0);
    expect(car.hulls).toContain('standard');
    expect(listDecorations('ground-box').kind).toBe('none');
  });

  it('describeFamily returns a full authoring view', () => {
    const f = describeFamily('fixed-wing-aircraft');
    expect(f.label).toMatch(/aircraft/i);
    expect(f.types.length).toBe(4);
    expect(f.tunables).toEqual(expect.arrayContaining(['proportions.length', 'fuselage.profile']));
  });
});

describe('meta-fabricator spawn policy', () => {
  it('samples only types within the family and respects context', () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 50; i += 1) {
      const t = sampleType('fixed-wing-aircraft', rng, { context: 'airfield' });
      expect(typesInFamily('fixed-wing-aircraft')).toContain(t);
    }
    // ground-car has no airfield-eligible members except opsWagon; street pool excludes planes
    const rng2 = mulberry32(7);
    for (let i = 0; i < 50; i += 1) {
      expect(familyOfType(sampleType('ground-car', rng2, { context: 'street' }))).toBe('ground-car');
    }
  });

  it('returns null for an empty (family ∩ context) pool', () => {
    expect(sampleType('fixed-wing-aircraft', mulberry32(1), { context: 'lot' })).toBeNull();
  });

  it('sampleInstance yields a type + a family-appropriate decoration', () => {
    const air = sampleInstance('fixed-wing-aircraft', mulberry32(3));
    expect(air.family).toBe('fixed-wing-aircraft');
    expect(air.decoration.scheme).toBeTruthy();
    expect(typeof air.decoration.scheme.belly).toBe('string');   // a livery palette

    const car = sampleInstance('ground-car', mulberry32(3));
    expect(typeof car.decoration.paint).toBe('string');
    expect(typeof car.decoration.hull).toBe('string');

    const box = sampleInstance('ground-box', mulberry32(3));
    expect(box.decoration).toEqual({});
  });

  it('is deterministic for a given seed', () => {
    const a = sampleInstance('fixed-wing-aircraft', mulberry32(99));
    const b = sampleInstance('fixed-wing-aircraft', mulberry32(99));
    expect(b).toEqual(a);
  });
});

describe('meta-fabricator geometry seam', () => {
  it('builds well-formed faces for a sampled instance of every family', () => {
    for (const id of listFamilies()) {
      const inst = sampleInstance(id, mulberry32(11), id === 'ground-car' ? { context: 'street' } : { context: 'airfield' });
      if (!inst) continue;
      const faces = buildInstanceFaces(inst, { cx: 4, cy: 2 });
      expect(faces.length).toBeGreaterThan(40);
      expect(faces.every(validFace)).toBe(true);
    }
  });

  it('applies the decoration — a named livery matches the equivalent direct vehicleFaces call', () => {
    const teal = AIRCRAFT_LIVERY_SCHEMES.find((s) => s.name === 'teal');
    const viaMeta = buildInstanceFaces({ type: 'airliner', decoration: { scheme: 'teal' } }, { cx: 0, cy: 0 });
    const viaDirect = vehicleFaces({ type: 'airliner', cx: 0, cy: 0, livery: teal });
    expect(viaMeta.map((f) => f.fill)).toEqual(viaDirect.map((f) => f.fill));
  });

  it('rejects an unmapped type', () => {
    expect(() => buildInstanceFaces({ type: 'spaceship' })).toThrow(/unknown\/unmapped/);
  });
});

describe('meta-fabricator workbench preview', () => {
  it('wraps an instance in the measured studio scene (turntable cameras + grid)', () => {
    const inst = { type: 'airliner', decoration: { scheme: 'teal' } };
    const scene = assembleInstanceStudio(inst);
    // shared scene payload shape (assembleBoxCityScene)
    expect(Array.isArray(scene.faces)).toBe(true);
    expect(Array.isArray(scene.cameras)).toBe(true);
    expect(scene.cameras.map((c) => c.name).sort())
      .toEqual(['back', 'front', 'side', 'three-quarter', 'top']);
    expect(scene.cameras.every((c) => c.worldFraming && Array.isArray(c.worldFraming.cameraPosition))).toBe(true);
    // the studio adds the measured grid + ground on top of the instance's own faces
    const instFaces = buildInstanceFaces(inst);
    expect(scene.faces.length).toBeGreaterThan(instFaces.length);
    expect(scene.title).toMatch(/airliner/);
  });

  it('previews an instance of every family', () => {
    for (const id of listFamilies()) {
      const inst = sampleInstance(id, mulberry32(5), id === 'ground-car' ? { context: 'street' } : { context: 'airfield' });
      if (!inst) continue;
      const scene = assembleInstanceStudio(inst);
      expect(scene.faces.length).toBeGreaterThan(40);
      expect(scene.cameras.length).toBe(5);
    }
  });

  it('planInstance validates + reports stats; rejects an unknown type', () => {
    const { stats } = planInstance({ type: 'widebody', decoration: { scheme: 'teal' } });
    expect(stats.family).toBe('fixed-wing-aircraft');
    expect(stats.net).toBe('widebody');
    expect(stats.faces).toBeGreaterThan(40);
    expect(stats.decoration).toEqual({ scheme: 'teal' });
    expect(() => planInstance({ type: 'spaceship' })).toThrow(/unknown\/unmapped/);
  });
});
