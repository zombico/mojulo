import { describe, it, expect } from 'vitest';

import { planWorkbench } from '../worlds/workbench.js';
import { generateVehBodyVariants, listVehBodyLanguage, resolveVehBodyRecipe } from './veh-body.js';

const isConvex = (points) => {
  let sign = 0;
  const n = points.length;
  for (let i = 0; i < n; i += 1) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % n];
    const [cx, cy] = points[(i + 2) % n];
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(cross) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
};

describe('resolveVehBodyRecipe', () => {
  it('is deterministic and workbench-valid', () => {
    const a = resolveVehBodyRecipe({ family: 'sedanThree', palette: 'vintageCream', seed: 'shell-01' });
    expect(resolveVehBodyRecipe({ family: 'sedanThree', palette: 'vintageCream', seed: 'shell-01' })).toEqual(a);
    const { stats } = planWorkbench(a);
    expect(stats.extrudes).toBe(a.extrudes.length);
    expect(a.garage.mountFamily).toBeNull();
  });

  it('keeps EVERY profile convex - the probe-proven shelf rule', () => {
    for (const family of Object.keys(listVehBodyLanguage().families)) {
      const recipe = resolveVehBodyRecipe({ family, seed: 5 });
      for (const m of recipe.extrudes) {
        if (m.profile.points) expect(isConvex(m.profile.points), `${family}/${m.id}`).toBe(true);
      }
    }
  });

  it('places arch openings at the wheelbase corners with clearance over the tire', () => {
    const recipe = resolveVehBodyRecipe({ family: 'sedanThree', seed: 3 });
    expect(recipe.garage.dims.archCenters).toEqual([4, -4]);
    const band = recipe.extrudes.find((m) => m.id === 'fender_band_front');
    const bandBottom = Math.min(...band.profile.points.map(([, z]) => z));
    expect(bandBottom).toBeGreaterThanOrEqual(2.2); // tire top is 2.0
    // beltline clears a dressed engine (top ≈ 2.9)
    expect(recipe.garage.dims.beltZ).toBeGreaterThanOrEqual(2.9);
  });

  it('drops the tail for a truck cab and the glass for a panel van', () => {
    const cab = resolveVehBodyRecipe({ family: 'truckCab', seed: 4 });
    expect(cab.extrudes.some((m) => m.id === 'tail_clip')).toBe(false);
    expect(cab.extrudes.some((m) => m.id === 'fender_band_rear')).toBe(false);
    expect(cab.garage.dims.archCenters[1]).toBeNull();
    const van = resolveVehBodyRecipe({ family: 'vanOne', seed: 4 });
    const gh = van.extrudes.find((m) => m.id === 'greenhouse');
    expect(gh.tint).toBe(van.garage.colors.paint); // panel, not glass
  });

  it('generates deterministic variants and throws clear errors', () => {
    const a = generateVehBodyVariants({ count: 4, seed: 'shell-line' });
    expect(generateVehBodyVariants({ count: 4, seed: 'shell-line' })).toEqual(a);
    expect(() => resolveVehBodyRecipe({ family: 'banana' })).toThrow(/Unknown veh-body family/);
  });
});
