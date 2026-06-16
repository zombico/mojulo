import { describe, it, expect } from 'vitest';
import {
  vehicleFaces, vehicleAntFaces, tramsOnTrack, VEHICLE_TYPES, VEHICLE_REGISTRY,
  isVehicleType, vehicleTypesFor, sampleVehicleType,
} from './vehicles-css3d.js';

// deterministic rng for sampling assertions
function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const finite = (n) => Number.isFinite(n);
const validFace = (f) =>
  Array.isArray(f.corners) && f.corners.length === 4 &&
  f.corners.every((c) => Array.isArray(c) && c.length === 3 && c.every(finite)) &&
  typeof f.fill === 'string';

describe('vehicles-css3d', () => {
  it('exposes a vehicle type registry', () => {
    expect(VEHICLE_TYPES).toEqual(expect.arrayContaining(['sedan', 'suv', 'taxi', 'boxTruck', 'cityBus']));
    expect(isVehicleType('sedan')).toBe(true);
    expect(isVehicleType('spaceship')).toBe(false);
  });

  it('builds well-formed faces for every type (coin wheels on wheeled vehicles)', () => {
    for (const type of VEHICLE_TYPES) {
      const faces = vehicleFaces({ type, cx: 5, cy: 3 });
      expect(faces.length).toBeGreaterThan(40);                  // swept shell = many facets
      expect(faces.every(validFace)).toBe(true);
      // coin wheels on wheeled vehicles only — the plane and the rail-borne tram have none
      if (!['aircraft', 'tram'].includes(VEHICLE_REGISTRY[type].class)) expect(faces.some((f) => f.clip === 'circle(50%)')).toBe(true);
    }
  });

  it('unknown type falls back to sedan rather than throwing', () => {
    expect(vehicleFaces({ type: 'nope' })).toEqual(vehicleFaces({ type: 'sedan' }));
  });

  it('axis/dir orient the same model along x or y', () => {
    const alongX = vehicleFaces({ type: 'sedan', axis: 'x', dir: 1 });
    const alongY = vehicleFaces({ type: 'sedan', axis: 'y', dir: 1 });
    expect(bbox(alongX, 0)).toBeGreaterThan(bbox(alongX, 1));   // long axis follows `axis`
    expect(bbox(alongY, 1)).toBeGreaterThan(bbox(alongY, 0));
  });

  it('scale resizes about the ground anchor', () => {
    const base = vehicleFaces({ type: 'cityBus', cx: 2, cy: 2, scale: 1 });
    const big = vehicleFaces({ type: 'cityBus', cx: 2, cy: 2, scale: 2 });
    expect(bbox(big, 0)).toBeCloseTo(bbox(base, 0) * 2, 4);
    const minZ = (faces) => Math.min(...faces.flatMap((f) => f.corners.map((c) => c[2])));
    expect(minZ(big)).toBeCloseTo(minZ(base) * 2, 4);
  });

  it('annotates every type with class / weight / contexts', () => {
    for (const t of VEHICLE_TYPES) {
      const m = VEHICLE_REGISTRY[t];
      expect(typeof m.class).toBe('string');
      expect(m.weight).toBeGreaterThan(0);
      expect(Array.isArray(m.contexts) && m.contexts.length).toBeTruthy();
    }
  });

  it('the streetcar is a rail vehicle — built by name, but kept out of car contexts', () => {
    expect(isVehicleType('streetcar')).toBe(true);
    expect(VEHICLE_REGISTRY.streetcar.class).toBe('tram');
    const faces = vehicleFaces({ type: 'streetcar', cx: 0, cy: 0 });
    expect(faces.length).toBeGreaterThan(40);
    expect(faces.every(validFace)).toBe(true);
    // it is longer than the bus (more facets / bigger long-axis extent)
    expect(bbox(vehicleFaces({ type: 'streetcar', axis: 'x' }), 0)).toBeGreaterThan(bbox(vehicleFaces({ type: 'cityBus', axis: 'x' }), 0));
    // never sampled into car streets/lots
    expect(vehicleTypesFor('street')).not.toContain('streetcar');
    expect(vehicleTypesFor('lot')).not.toContain('streetcar');
  });

  it('tramsOnTrack places cars on a rail path, nosed along the local tangent', () => {
    const path = [[0, 0], [0, 10], [6, 16]];                       // straight then a curve
    const faces = tramsOnTrack({ path, positions: [0.25, 0.75] });
    expect(faces.length).toBeGreaterThan(80);                      // two trams
    expect(faces.every(validFace)).toBe(true);
    expect(tramsOnTrack({ path: [[0, 0]] })).toEqual([]);          // degenerate path → nothing
    // reversing dir relocates/reorients (return track) — not identical faces
    const fwd = tramsOnTrack({ path, positions: [0.5], dir: 1 });
    const rev = tramsOnTrack({ path, positions: [0.5], dir: -1 });
    expect(JSON.stringify(fwd)).not.toEqual(JSON.stringify(rev));
  });

  it('contexts gate sampling — lots exclude buses/trucks/planes; non-city contexts stay separate', () => {
    const lot = vehicleTypesFor('lot');
    expect(lot).toEqual(expect.arrayContaining(['sedan', 'suv', 'taxi']));
    expect(lot).not.toContain('cityBus');
    expect(lot).not.toContain('boxTruck');
    expect(lot).not.toContain('airliner');                     // the plane never enters a car lot
    expect(vehicleTypesFor('street')).toEqual(expect.arrayContaining(['cityBus', 'boxTruck']));
    // the airfield fleet — every aircraft class, and ONLY aircraft (the annotation keeps planes to their own context)
    expect(vehicleTypesFor('airfield')).toEqual(['airliner', 'widebody', 'regional', 'bizjet']);
    expect(vehicleTypesFor('orbit')).toEqual([]);              // a context nothing is tagged for → nothing
  });

  it('sampleVehicleType respects context and weight', () => {
    const rng = mulberry32(7);
    const counts = {};
    for (let i = 0; i < 5000; i++) { const t = sampleVehicleType(rng, { context: 'lot' }); counts[t] = (counts[t] || 0) + 1; }
    expect(counts.cityBus).toBeUndefined();                     // never sampled into a lot
    expect(counts.boxTruck).toBeUndefined();
    expect(counts.airliner).toBeUndefined();
    expect(counts.sedan).toBeGreaterThan(counts.suv);           // weight 10 > 6
    expect(counts.suv).toBeGreaterThan(counts.taxi);            // weight 6 > 3
    expect(sampleVehicleType(rng, { context: 'orbit' })).toBeNull();
  });

  it('vehicleAntFaces samples + builds, and is empty for an impossible context', () => {
    const rng = mulberry32(3);
    expect(vehicleAntFaces({ rng, context: 'lot', cx: 0, cy: 0 }).length).toBeGreaterThan(40);
    expect(vehicleAntFaces({ rng, context: 'orbit' })).toEqual([]);
  });

  it('paint recolors the body shell but leaves structural fills (glass/wheels) intact', () => {
    const stock = vehicleFaces({ type: 'sedan' });
    const red = vehicleFaces({ type: 'sedan', paint: '#c0202a' });
    expect(red.length).toBe(stock.length);                          // same geometry, different skin
    expect(JSON.stringify(red)).not.toEqual(JSON.stringify(stock)); // the shell is recolored
    // wheels (clipped discs) are structural — paint leaves them untouched
    const discFills = (faces) => faces.filter((f) => f.clip === 'circle(50%)').map((f) => f.fill).sort();
    expect(discFills(red)).toEqual(discFills(stock));
  });

  it('hull variants reshape the silhouette (width / roof / ride)', () => {
    const stock = vehicleFaces({ type: 'sedan', hull: 'standard' });
    const wide = vehicleFaces({ type: 'sedan', hull: 'wide' });
    const lifted = vehicleFaces({ type: 'sedan', hull: 'lifted' });
    const chopped = vehicleFaces({ type: 'sedan', hull: 'chopped' });
    // sedan runs along x by default → width is the y-extent, height the z-extent
    expect(bbox(wide, 1)).toBeGreaterThan(bbox(stock, 1));          // wider body
    const maxZ = (faces) => Math.max(...faces.flatMap((f) => f.corners.map((c) => c[2])));
    expect(maxZ(lifted)).toBeGreaterThan(maxZ(stock));             // raised
    expect(maxZ(chopped)).toBeLessThan(maxZ(stock));              // lower roofline
    expect(wide.every(validFace) && lifted.every(validFace)).toBe(true);
  });

  it('vehicleAntFaces is deterministic and varies paint+hull across instances', () => {
    const draw = (seed) => { const rng = mulberry32(seed); return JSON.stringify(vehicleAntFaces({ rng, context: 'lot', cx: 0, cy: 0 })); };
    expect(draw(11)).toEqual(draw(11));                             // same seed → identical
    const variety = new Set(Array.from({ length: 12 }, (_, i) => draw(100 + i)));
    expect(variety.size).toBeGreaterThan(1);                        // different seeds → different cars
  });
});

function bbox(faces, axis) {
  const vals = faces.flatMap((f) => f.corners.map((c) => c[axis]));
  return Math.max(...vals) - Math.min(...vals);
}
