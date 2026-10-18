/**
 * head-field-view — the instrument that reads the head field. The calipers and the sections are checked on analytic
 * fields whose answers are known (a sphere, an ellipsoid); the head itself only for the concept: the readings come
 * off the field, deterministically, and a knob that moves a mass moves its reading.
 */
import { describe, expect, it } from 'vitest';

import { rayIn, caliper, headSection, headFieldOf, headMeasures, MM } from './head-field-view.js';
import { DIMORPH } from './figure-rig.js';

const ellipsoid = (r) => (p) => Math.hypot(p.x / r.x, p.y / r.y, p.z / r.z) - 1;   // zero set exact; sign right

describe('calipers on a known field', () => {
  const field = ellipsoid({ x: 0.05, y: 0.07, z: 0.06 });
  it('a ray from outside stops at the surface', () => {
    const hit = rayIn(field, { x: 0, y: 0, z: 0 }, [0, 1, 0]);
    expect(hit.y).toBeCloseTo(0.07, 5);
    expect(rayIn(field, { x: 0, y: 0, z: 0.5 }, [0, 1, 0])).toBeNull();   // misses
  });
  it('a caliper over a band takes the extreme', () => {
    const band = { y: [-0.02, 0.02], z: [-0.02, 0.02] };
    expect(caliper(field, 'x', 1, band).x).toBeCloseTo(0.05, 5);
    expect(caliper(field, 'x', -1, band).x).toBeCloseTo(-0.05, 5);
  });
});

describe('sections', () => {
  it('a plane through an ellipsoid cuts its ellipse', () => {
    const r = { x: 0.05, y: 0.07, z: 0.06 };
    const head = { field: ellipsoid(r), bounds: { min: { x: -0.1, y: -0.1, z: -0.1 }, max: { x: 0.1, y: 0.1, z: 0.1 } } };
    const { u, v, segments } = headSection(head, { axis: 'x', at: 0 }, { res: 120 });
    expect([u, v]).toEqual(['y', 'z']);
    expect(segments.length).toBeGreaterThan(60);
    for (const [a, b] of segments) expect(Math.abs(Math.hypot(a / r.y, b / r.z) - 1)).toBeLessThan(0.02);
  });
});

describe('the head, read off its field', () => {
  const male = headMeasures(headFieldOf({ pole: DIMORPH.male.head }));
  it('finds every point but the alae, and reads the same twice', () => {
    for (const [k, p] of Object.entries(male.points)) if (!k.startsWith('al')) expect(p, k).not.toBeNull();
    expect(headMeasures(headFieldOf({ pole: DIMORPH.male.head }))).toEqual(male);
  });
  it('a knob that widens the jaw widens its caliper', () => {
    const wide = headMeasures(headFieldOf({ pole: DIMORPH.male.head, knobs: { jawWidth: 1.3 } }));
    expect(wide.mm['go-go']).toBeGreaterThan(male.mm['go-go']);
    expect(wide.mm['g-op']).toBe(male.mm['g-op']);
  });
  it('millimetres are stature units at 1.8 m', () => {
    expect(MM).toBe(1800);
  });
});
