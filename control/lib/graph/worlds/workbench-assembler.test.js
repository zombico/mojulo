import { describe, expect, it } from 'vitest';

import { planAssembler, lowerAssemblerFaces, assembleAssemblerScene } from './workbench-assembler.js';

// one spindle = a narrow lathe, authored standing at the origin (z 0..6).
const spindle = () => ({
  lathes: [{
    axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 6 },
    profile: [{ t: 0, radius: 0.5 }, { t: 0.5, radius: 0.9 }, { t: 1, radius: 0.5 }], tint: '#c79a4b',
  }],
});

const xRange = (faces) => {
  const xs = faces.flatMap((f) => f.corners.map((c) => c[0]));
  return [Math.min(...xs), Math.max(...xs)];
};
const zRange = (faces) => {
  const zs = faces.flatMap((f) => f.corners.map((c) => c[2]));
  return [Math.min(...zs), Math.max(...zs)];
};

describe('planAssembler — placement readout', () => {
  it('reports item count, total placements (after repeat), and per-part placement', () => {
    const { stats } = planAssembler({
      kind: 'assembler',
      items: [
        { source: spindle(), at: [0, 0, 0], repeat: { count: 5, step: [4, 0, 0] } },
        { source: spindle(), at: [-6, 0, 6], flip: 'z' },
      ],
    });
    expect(stats.items).toBe(2);
    expect(stats.placements).toBe(6);            // 5 repeated + 1
    expect(stats.parts[0].copies).toBe(5);
    expect(stats.parts[1].flip).toBe('z');
    expect(stats.faces).toBeGreaterThan(0);
  });

  it('rejects an empty items array', () => {
    expect(() => planAssembler({ kind: 'assembler', items: [] })).toThrow(/at least one item/);
  });

  it('rejects an item whose source has no renderable monomer', () => {
    expect(() => planAssembler({ kind: 'assembler', items: [{ source: { lathes: [] } }] })).toThrow(/no renderable part/);
  });

  it('warns when the assembly sits off the measured grid', () => {
    const { stats } = planAssembler({ kind: 'assembler', items: [{ source: spindle(), at: [0, 0, 5] }] });
    expect(stats.warnings.some((w) => /floats/.test(w))).toBe(true);
  });
});

describe('lowerAssemblerFaces — the placing moves', () => {
  it('REPOSITION (at) shifts the whole part into shared space', () => {
    const here = lowerAssemblerFaces({ kind: 'assembler', items: [{ source: spindle(), at: [0, 0, 0] }] });
    const there = lowerAssemblerFaces({ kind: 'assembler', items: [{ source: spindle(), at: [10, 0, 0] }] });
    const [hMin] = xRange(here);
    const [tMin] = xRange(there);
    expect(tMin - hMin).toBeCloseTo(10, 5);
  });

  it('REPEAT arrays the same part along a step vector (one spindle → a banister)', () => {
    const faces = lowerAssemblerFaces({
      kind: 'assembler',
      items: [{ source: spindle(), at: [0, 0, 0], repeat: { count: 5, step: [4, 0, 0] } }],
    });
    const [min, max] = xRange(faces);
    expect(min).toBeCloseTo(-0.9, 1);            // first spindle, radius 0.9
    expect(max).toBeCloseTo(16.9, 1);            // 5th copy at x=16 + radius 0.9
  });

  it('FLIP z mirrors the part (peg → spindle)', () => {
    // a 0..6 part flipped on z then placed at z=6 lands back in 0..6, but inverted.
    const faces = lowerAssemblerFaces({ kind: 'assembler', items: [{ source: spindle(), at: [0, 0, 6], flip: 'z' }] });
    const [min, max] = zRange(faces);
    expect(min).toBeCloseTo(0, 5);
    expect(max).toBeCloseTo(6, 5);
  });

  it('FLIP relights the part so shading tracks the new orientation', () => {
    const plain = lowerAssemblerFaces({ kind: 'assembler', items: [{ source: spindle(), at: [0, 0, 0] }] }).map((f) => f.fill);
    const flipped = lowerAssemblerFaces({ kind: 'assembler', items: [{ source: spindle(), at: [0, 0, 0], flip: 'z' }] }).map((f) => f.fill);
    expect(plain.length).toBe(flipped.length);
    expect(plain.some((c, i) => c !== flipped[i])).toBe(true);   // lighting is not stale
  });

  it('ROTATE 90° on x lays the part on its side (height becomes depth)', () => {
    const upright = lowerAssemblerFaces({ kind: 'assembler', items: [{ source: spindle() }] });
    const laid = lowerAssemblerFaces({ kind: 'assembler', items: [{ source: spindle(), rotate: [90, 0, 0] }] });
    const [uzMin, uzMax] = zRange(upright);
    const [lzMin, lzMax] = zRange(laid);
    expect(uzMax - uzMin).toBeCloseTo(6, 1);      // upright: 6 tall
    expect(lzMax - lzMin).toBeCloseTo(1.8, 1);    // laid down: only the spindle diameter tall
  });

  it('SCALE uniformly grows the part', () => {
    const base = lowerAssemblerFaces({ kind: 'assembler', items: [{ source: spindle() }] });
    const big = lowerAssemblerFaces({ kind: 'assembler', items: [{ source: spindle(), scale: 2 }] });
    const [, bzMax] = zRange(base);
    const [, gzMax] = zRange(big);
    expect(gzMax).toBeCloseTo(bzMax * 2, 5);
  });
});

describe('gravity seating — on / gap / id', () => {
  // a wheel-like part: a flat disk authored in the xy-plane (z -1..1), rim reaches radius ~6.
  const wheel = () => ({
    sweeps: [{ path: Array.from({ length: 25 }, (_, i) => { const a = (i / 24) * 2 * Math.PI; return [6 * Math.cos(a), 6 * Math.sin(a), 0]; }), radius: 0.5, sides: 8, tint: '#888' }],
  });

  it("on:'ground' auto-drops a part so its lowest point rests at z=0", () => {
    const faces = lowerAssemblerFaces({ kind: 'assembler', items: [{ source: spindle(), on: 'ground' }] });
    const [zmin] = zRange(faces);
    expect(zmin).toBeCloseTo(0, 5);
  });

  it("on:'ground' computes the lift from the POST-ROTATE bounds (a wheel stood upright seats at its radius)", () => {
    // rotate the flat wheel upright; its rim now spans z ≈ -6.5..6.5 before seating.
    const { stats } = planAssembler({ kind: 'assembler', items: [{ source: wheel(), rotate: [90, 0, 0], on: 'ground' }] });
    const faces = lowerAssemblerFaces({ kind: 'assembler', items: [{ source: wheel(), rotate: [90, 0, 0], on: 'ground' }] });
    const [zmin] = zRange(faces);
    expect(zmin).toBeCloseTo(0, 4);                       // seated on the floor, no hand-computed lift
    expect(stats.parts[0].baseZ).toBeCloseTo(0, 1);
    expect(stats.parts[0].topZ).toBeGreaterThan(12);      // ~ full diameter tall (≈13)
    expect(stats.parts[0].on).toBe('ground');
  });

  it('on:<id> rests a part on top of an earlier one; gap lifts it', () => {
    const { stats } = planAssembler({
      kind: 'assembler',
      items: [
        { source: spindle(), id: 'base', on: 'ground' },          // 0..6
        { source: spindle(), on: 'base', gap: 1 },                 // rests on base top (6) + gap 1 → 7..13
      ],
    });
    expect(stats.parts[0].topZ).toBeCloseTo(6, 1);
    expect(stats.parts[1].baseZ).toBeCloseTo(7, 1);
    expect(stats.parts[1].topZ).toBeCloseTo(13, 1);
  });

  it('superposition (absolute at z, no on) is reported as such', () => {
    const { stats } = planAssembler({ kind: 'assembler', items: [{ source: spindle(), at: [0, 0, 10] }] });
    expect(stats.parts[0].placement).toBe('superposition');
    expect(stats.parts[0].baseZ).toBeCloseTo(10, 1);
  });

  it('rejects on referencing a forward / unknown part', () => {
    expect(() => planAssembler({
      kind: 'assembler',
      items: [
        { source: spindle(), on: 'later' },                       // 'later' not yet defined
        { source: spindle(), id: 'later', on: 'ground' },
      ],
    })).toThrow(/EARLIER item/);
  });
});

describe('assembleAssemblerScene — rides the workbench studio vantage', () => {
  it('produces the shared scene payload (faces + cameras + grid)', () => {
    const scene = assembleAssemblerScene({
      kind: 'assembler',
      items: [{ source: spindle(), at: [0, 0, 0], repeat: { count: 3, step: [3, 0, 0] } }],
    });
    expect(scene.faces.length).toBeGreaterThan(0);
    expect(scene.cameras.length).toBeGreaterThan(0);   // turntable shots
    expect(scene.title).toBe('mojulo assembler');
  });
});
