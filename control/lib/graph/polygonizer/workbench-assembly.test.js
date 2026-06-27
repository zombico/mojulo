import { describe, expect, it } from 'vitest';

import { lowerAssembly } from './workbench-assembly.js';

const lathe = (extra = {}) => ({ kind: 'lathe', height: 2, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }], ...extra });

describe('lowerAssembly — vertical stacking', () => {
  it('auto-stacks parts flush, threading a running z (first part on the ground)', () => {
    const { lathes } = lowerAssembly({ parts: [lathe({ height: 2 }), lathe({ height: 9 }), lathe({ height: 4 })] });
    expect(lathes).toHaveLength(3);
    expect(lathes[0].axisFrom.z).toBe(0);
    expect(lathes[0].axisTo.z).toBe(2);
    expect(lathes[1].axisFrom.z).toBe(2);   // seats on the foot's top
    expect(lathes[1].axisTo.z).toBe(11);
    expect(lathes[2].axisFrom.z).toBe(11);  // seats on the stem's top
    expect(lathes[2].axisTo.z).toBe(15);
  });

  it('emits {x,y,z} axis endpoints on the stack axis by default', () => {
    const { lathes } = lowerAssembly({ parts: [lathe()] });
    expect(lathes[0].axisFrom).toEqual({ x: 0, y: 0, z: 0 });
    expect(lathes[0].axisTo).toEqual({ x: 0, y: 0, z: 2 });
  });

  it('a `gap` lifts a part above its support', () => {
    const { lathes } = lowerAssembly({ parts: [lathe({ height: 2 }), lathe({ height: 3, gap: 0.5 })] });
    expect(lathes[1].axisFrom.z).toBe(2.5);
    expect(lathes[1].axisTo.z).toBe(5.5);
  });

  it('an `offset` shifts a part off the stack axis in x/y (still seated at the running z)', () => {
    const { lathes } = lowerAssembly({ parts: [lathe(), lathe({ offset: [3, -1] })] });
    expect(lathes[1].axisFrom).toEqual({ x: 3, y: -1, z: 2 });
    expect(lathes[1].axisTo).toEqual({ x: 3, y: -1, z: 4 });
  });

  it('`on` targets an earlier part by id (branching off a shared support)', () => {
    const { lathes } = lowerAssembly({ parts: [
      lathe({ id: 'base', height: 1 }),
      lathe({ height: 5 }),                  // on base → 1..6
      lathe({ on: 'base', height: 2 }),      // back to base top → 1..3
    ] });
    expect(lathes[1].axisFrom.z).toBe(1);
    expect(lathes[2].axisFrom.z).toBe(1);
    expect(lathes[2].axisTo.z).toBe(3);
  });

  it("`on:'ground'` reseats a part at z=0 regardless of order", () => {
    const { lathes } = lowerAssembly({ parts: [lathe({ height: 4 }), lathe({ on: 'ground', height: 2 })] });
    expect(lathes[1].axisFrom.z).toBe(0);
    expect(lathes[1].axisTo.z).toBe(2);
  });

  it('passes monomer fields through and strips assembly-only keys', () => {
    const { lathes } = lowerAssembly({ parts: [lathe({ tint: '#c79a4b', harmonics: [{ n: 8, amplitude: 0.1 }] })] });
    expect(lathes[0].tint).toBe('#c79a4b');
    expect(lathes[0].harmonics).toEqual([{ n: 8, amplitude: 0.1 }]);
    expect(lathes[0]).not.toHaveProperty('kind');
    expect(lathes[0]).not.toHaveProperty('height');
    expect(lathes[0]).not.toHaveProperty('on');
  });

  it('routes extrude parts to the extrudes array, lathes to lathes', () => {
    const { lathes, extrudes } = lowerAssembly({ parts: [
      lathe({ height: 2 }),
      { kind: 'extrude', height: 3, profile: { rect: { w: 4, h: 4 } } },
    ] });
    expect(lathes).toHaveLength(1);
    expect(extrudes).toHaveLength(1);
    expect(extrudes[0].axisFrom.z).toBe(2);   // the extrude stacks on the lathe
    expect(extrudes[0].axisTo.z).toBe(5);
    expect(extrudes[0].profile).toEqual({ rect: { w: 4, h: 4 } });
  });
});

describe('lowerAssembly — replication (radial / mirror)', () => {
  const pos = (m) => ({ x: m.axisFrom.x, y: m.axisFrom.y });
  const round = (n) => (Math.round(n * 1e4) / 1e4) || 0;   // `|| 0` collapses -0 → 0 for toEqual

  it('`radial` places N copies evenly around a circle at the stacked z', () => {
    const { lathes } = lowerAssembly({ parts: [lathe({ height: 5, radial: { count: 4, radius: 10 } })] });
    expect(lathes).toHaveLength(4);
    // all at the same z range
    expect(lathes.every((m) => m.axisFrom.z === 0 && m.axisTo.z === 5)).toBe(true);
    // 4 copies at 0°, 90°, 180°, 270°
    const xy = lathes.map((m) => [round(m.axisFrom.x), round(m.axisFrom.y)]);
    expect(xy).toEqual([[10, 0], [0, 10], [-10, 0], [0, -10]]);
  });

  it('`radial.startAngle` rotates the ring and `center` offsets it', () => {
    const { lathes } = lowerAssembly({ parts: [lathe({ radial: { count: 2, radius: 4, startAngle: 90, center: [1, 1] } })] });
    expect(lathes.map((m) => [round(m.axisFrom.x), round(m.axisFrom.y)])).toEqual([[1, 5], [1, -3]]);
  });

  it("a replicated part still contributes ONE top-of-stack z (a seat seats on the legs' top)", () => {
    const { lathes } = lowerAssembly({ parts: [
      { id: 'legs', kind: 'lathe', height: 40, profile: [{ t: 0, radius: 1.5 }, { t: 1, radius: 1.5 }], radial: { count: 4, radius: 15 } },
      { kind: 'lathe', height: 3, profile: [{ t: 0, radius: 18 }, { t: 1, radius: 18 }], on: 'legs' },  // seat, centered
    ] });
    expect(lathes).toHaveLength(5);                 // 4 legs + 1 seat
    const seat = lathes[4];
    expect(seat.axisFrom).toEqual({ x: 0, y: 0, z: 40 });   // seats on the legs' top, centered
    expect(seat.axisTo.z).toBe(43);
  });

  it("`mirror:'xy'` reflects the offset into 4 corner copies (rectangular legs)", () => {
    const { extrudes } = lowerAssembly({ parts: [
      { kind: 'extrude', height: 30, profile: { rect: { w: 2, h: 2 } }, offset: [12, 9], mirror: 'xy' },
    ] });
    expect(extrudes).toHaveLength(4);
    const xy = extrudes.map((m) => [m.axisFrom.x, m.axisFrom.y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    expect(xy).toEqual([[-12, -9], [-12, 9], [12, -9], [12, 9]]);
  });

  it("`mirror:'x'` makes a left/right pair", () => {
    const { lathes } = lowerAssembly({ parts: [lathe({ offset: [5, 0], mirror: 'x' })] });
    expect(lathes.map((m) => pos(m))).toEqual([{ x: 5, y: 0 }, { x: -5, y: 0 }]);
  });

  it('dedupes coincident copies (mirror across a zero offset → one part)', () => {
    const { lathes } = lowerAssembly({ parts: [lathe({ offset: [0, 0], mirror: 'xy' })] });
    expect(lathes).toHaveLength(1);
  });

  it('rejects radial + mirror on the same part', () => {
    expect(() => lowerAssembly({ parts: [lathe({ radial: { count: 2, radius: 1 }, mirror: 'x' })] })).toThrow(/either `radial` or `mirror`/);
  });

  it('rejects a bad radial count / radius and a bad mirror axis', () => {
    expect(() => lowerAssembly({ parts: [lathe({ radial: { count: 0, radius: 1 } })] })).toThrow(/count.*integer >= 1/);
    expect(() => lowerAssembly({ parts: [lathe({ radial: { count: 3, radius: -1 } })] })).toThrow(/radius.*>= 0/);
    expect(() => lowerAssembly({ parts: [lathe({ mirror: 'z' })] })).toThrow(/mirror.*'x', 'y', or 'xy'/);
  });
});

describe('lowerAssembly — validation', () => {
  it('rejects an empty / missing parts array', () => {
    expect(() => lowerAssembly({})).toThrow(/non-empty `parts`/);
    expect(() => lowerAssembly({ parts: [] })).toThrow(/non-empty `parts`/);
  });

  it('rejects a non-positive height', () => {
    expect(() => lowerAssembly({ parts: [lathe({ height: 0 })] })).toThrow(/height` must be a positive/);
    expect(() => lowerAssembly({ parts: [lathe({ height: undefined })] })).toThrow(/height` must be a positive/);
  });

  it('rejects an unknown kind', () => {
    expect(() => lowerAssembly({ parts: [{ kind: 'sweep', height: 2, profile: [] }] })).toThrow(/'lathe' or 'extrude'/);
  });

  it('rejects a lathe with no radius profile', () => {
    expect(() => lowerAssembly({ parts: [{ kind: 'lathe', height: 2 }] })).toThrow(/radius `profile`/);
  });

  it('rejects `on` pointing at a part not yet declared', () => {
    expect(() => lowerAssembly({ parts: [lathe({ on: 'missing' })] })).toThrow(/no earlier part/);
  });
});
