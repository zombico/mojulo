/**
 * terrain-erosion. Claims under test: priority-flood leaves no pit (every interior cell
 * can drain) and every cell's water reaches the edge; erosion is deterministic; rivers organise — the drained area
 * concentrates into a few trunks — and those trunks are cut down while the relief survives; thermal relaxation
 * reduces the ground steeper than the talus angle; a painted landscape without `erosion` is unchanged, and with it
 * every consumer (the World mesh here) reads the eroded surface, finer-meshed; the spec validates with teaching errors.
 */
import { describe, expect, it } from 'vitest';

import { priorityFlood, drainage, erodeHeightfield, gridSampler, validateErosion } from './terrain-erosion.js';
import { buildTerrainWorldMesh, validatePaintedLandscape } from './painted-landscape.js';

// a test surface: a dome with seeded bumps (no dice: a fixed trigonometric texture)
function dome(nx, ny) {
  const z = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = i / (nx - 1) - 0.5, y = j / (ny - 1) - 0.5;
    z[j * nx + i] = 0.3 * (1 - 2.2 * (x * x + y * y)) + 0.02 * Math.sin(i * 1.7 + j * 0.9) * Math.cos(j * 1.3 - i * 0.4) + 0.01 * Math.sin(i * 3.1) * Math.sin(j * 2.3);   // relief ~0.3 over 1: slopes near the talus angle, as in a landscape
  }
  return z;
}
const NX = 48, NY = 48, CELL = 1 / 47;

describe('drainage', () => {
  it('priority-flood leaves no pit, and all water reaches the edge', () => {
    const z = dome(NX, NY); const f = priorityFlood(z, NX, NY);
    for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
      const k = j * NX + i; let lower = false;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) if (f[(j + dj) * NX + i + di] < f[k]) lower = true;
      expect(lower).toBe(true);
    }
    const { rec, area } = drainage(f, NX, NY, CELL);
    let out = 0; for (let k = 0; k < NX * NY; k++) if (rec[k] < 0) { const i = k % NX, j = (k / NX) | 0; if (i === 0 || j === 0 || i === NX - 1 || j === NY - 1) out += area[k]; }
    expect(out).toBe(NX * NY);
  });
});

describe('erosion', () => {
  const z0 = dome(NX, NY);
  const a = erodeHeightfield(z0, NX, NY, CELL, { steps: 40 });
  it('is deterministic', () => {
    expect(Array.from(erodeHeightfield(z0, NX, NY, CELL, { steps: 40 }).z)).toEqual(Array.from(a.z));
  });
  it('rivers organise into trunks and cut them down; the relief survives', () => {
    const { area } = drainage(priorityFlood(a.z, NX, NY), NX, NY, CELL);
    const sorted = Array.from(area).sort((p, q) => q - p);
    expect(sorted[0]).toBeGreaterThan(0.05 * NX * NY);                               // one catchment drains > 5% of the map
    let cut = 0, cutN = 0; for (let k = 0; k < NX * NY; k++) if (area[k] > 40) { cut += z0[k] - a.z[k]; cutN++; }
    let hill = 0, hillN = 0; for (let k = 0; k < NX * NY; k++) if (area[k] <= 2) { hill += z0[k] - a.z[k]; hillN++; }
    expect(cut / cutN).toBeGreaterThan(2 * (hill / hillN));                         // channels lowered far more than ridges
    const rel = (z) => { let lo = Infinity, hi = -Infinity; for (const v of z) { lo = Math.min(lo, v); hi = Math.max(hi, v); } return hi - lo; };
    expect(rel(a.z)).toBeGreaterThan(0.5 * rel(z0));
  });
  it('thermal relaxation reduces the ground steeper than the talus angle', () => {
    const steep = (z, tal) => { const t = Math.tan((tal * Math.PI) / 180); let n = 0; for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) { const k = j * NX + i; if (Math.abs(z[k + 1] - z[k - 1]) / (2 * CELL) > t) n++; } return n; };
    const hard = erodeHeightfield(z0, NX, NY, CELL, { steps: 40, strength: 1.5, thermal: 0 });
    const soft = erodeHeightfield(z0, NX, NY, CELL, { steps: 40, strength: 1.5, thermal: 0.6, talus: 20 });
    expect(steep(soft.z, 20)).toBeLessThan(steep(hard.z, 20));
  });
  it('gridSampler reproduces the grid at its nodes', () => {
    const g = gridSampler(a.z, NX, NY, 0, 1, 0, 1);
    expect(g.at(0, 0)).toBeCloseTo(a.z[0], 12); expect(g.at(1, 1)).toBeCloseTo(a.z[NX * NY - 1], 12);
    expect(g.at(10 / 47, 5 / 47)).toBeCloseTo(a.z[5 * NX + 10], 12);
  });
});

describe('painted-landscape erosion', () => {
  const M = { kind: 'painted-landscape', heartbeat: 'rocky-irregular', splatch: 'verdure-trio', seed: 'vale' };
  it('absent → unchanged; present → every consumer reads the eroded surface, on a finer mesh', () => {
    const plain = buildTerrainWorldMesh(M);
    expect(JSON.stringify(buildTerrainWorldMesh({ ...M, erosion: undefined }).faces)).toBe(JSON.stringify(plain.faces));
    const eroded = buildTerrainWorldMesh({ ...M, erosion: { res: 64, steps: 20 } });
    expect(eroded.faces.length).toBeGreaterThan(plain.faces.length);
    const again = buildTerrainWorldMesh({ ...M, erosion: { res: 64, steps: 20 } });
    expect(JSON.stringify(again.faces)).toBe(JSON.stringify(eroded.faces));
  });
  it('validation teaches', () => {
    expect(validateErosion(true)).toEqual([]);
    expect(validateErosion({ steps: 0 })[0]).toMatch(/steps must be an integer 1–300/);
    expect(validateErosion({ talus: 80 })[0]).toMatch(/talus must be an angle 10–60/);
    expect(validateErosion({ res: 1000 })[0]).toMatch(/res must be an integer 32–256/);
    expect(validatePaintedLandscape({ ...M, erosion: 'lots' }).join(' ')).toMatch(/erosion must be true or/);
  });
});
