import { describe, expect, it } from 'vitest';

import { planSurfaceScene, assembleSurfaceScene, SURFACE_SCENARIOS } from './surface-view.js';

// the last point of a tracer path, back in math coords (the renderer scales x,y by U=3.0).
const landing = (tracer) => { const e = tracer.path[tracer.path.length - 1]; return [e[0] / 3, e[1] / 3]; };

describe('planSurfaceScene — determinism & payload', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    expect(JSON.stringify(planSurfaceScene({ scenario: 'saddle' }))).toBe(JSON.stringify(planSurfaceScene({ scenario: 'saddle' })));
  });

  it('falls back to bowl on an unknown scenario', () => {
    expect(planSurfaceScene({ scenario: 'wormhole' }).stats.scenario).toBe('bowl');
  });

  it('exposes the five scenarios', () => {
    expect(SURFACE_SCENARIOS).toEqual(['bowl', 'saddle', 'monkey', 'wells', 'ripple']);
  });

  it('bakes a shaded landscape (many quads, relief from varied fills) + descent tracers + a readout', () => {
    const plan = planSurfaceScene({ scenario: 'bowl' });
    const surf = plan.faces.filter((f) => f.group === 'surface');
    expect(surf.length).toBeGreaterThan(1000);
    expect(new Set(surf.map((f) => f.fill)).size).toBeGreaterThan(20);  // relief ⇒ many distinct shaded fills
    expect(plan.tracers.length).toBeGreaterThan(0);
    expect(plan.fields[0].readout.length).toBeGreaterThan(2);
  });
});

describe('surface-view — gradient descent behaves (the calculus)', () => {
  it('bowl: the ball rolls to the single global minimum at the origin', () => {
    const [x, y] = landing(planSurfaceScene({ scenario: 'bowl' }).tracers[0]);
    expect(Math.hypot(x, y)).toBeLessThan(0.1);
  });

  it('saddle: the ball does NOT settle at the origin — it rolls away down the unstable axis', () => {
    for (const t of planSurfaceScene({ scenario: 'saddle' }).tracers) {
      const [x, y] = landing(t);
      expect(Math.hypot(x, y)).toBeGreaterThan(1);   // escaped the critical point
      expect(Math.abs(y)).toBeGreaterThan(Math.abs(x)); // down the y (unstable) direction
    }
  });

  it('wells: two starts settle in two DIFFERENT basins (local minima)', () => {
    const ends = planSurfaceScene({ scenario: 'wells' }).tracers.map(landing);
    expect(ends).toHaveLength(2);
    expect(Math.sign(ends[0][0])).not.toBe(Math.sign(ends[1][0])); // opposite-side wells
  });

  it('ripple: four starts settle in four distinct local minima', () => {
    const ends = planSurfaceScene({ scenario: 'ripple' }).tracers.map(landing);
    const keys = new Set(ends.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`));
    expect(keys.size).toBe(4);
  });
});

describe('assembleSurfaceScene — payload', () => {
  it('threads faces + tracers + a readout, 3/4 camera first, no surfaces channel', () => {
    const payload = assembleSurfaceScene({ scenario: 'monkey' });
    expect(payload.faces.length).toBeGreaterThan(1000);
    expect(payload.tracers.length).toBe(3);
    expect(payload.surfaces).toBeUndefined();
    expect(payload.cameras[0].name).toBe('3/4');
  });
});
