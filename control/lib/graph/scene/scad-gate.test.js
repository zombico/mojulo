import { describe, expect, it } from 'vitest';

import { findOpenscad, measureStl, compareScadGate, OPENSCAD_CANDIDATES } from './scad-gate.js';
import { facesToStl } from './scene-stl.js';

// openscad-leg.plan.md phase 3 — the gate's PURE half.
//
// OpenSCAD is not installed on this host, so nothing here spawns it. What these tests close
// is everything that does not need it: the search order, the STL measurement (round-tripped
// through mojulo's OWN writer, so the numbers have a known ground truth), and the verdict.
// The end-to-end check — render a transpiled file and compare it to what export_model
// declared — needs the binary and is unrun.

/** A closed axis-aligned box as six outward quads, each CCW seen from outside. */
function box(ox, oy, oz, sx, sy, sz) {
  const p = (x, y, z) => [ox + x * sx, oy + y * sy, oz + z * sz];
  const q = (...corners) => ({ corners });
  return [
    q(p(0, 0, 0), p(0, 1, 0), p(1, 1, 0), p(1, 0, 0)),
    q(p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)),
    q(p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1)),
    q(p(0, 1, 0), p(0, 1, 1), p(1, 1, 1), p(1, 1, 0)),
    q(p(0, 0, 0), p(0, 0, 1), p(0, 1, 1), p(0, 1, 0)),
    q(p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1)),
  ];
}

describe('scad-gate — finding the binary', () => {
  it('the env var wins over everything', () => {
    const hit = findOpenscad({ env: { MOJULO_OPENSCAD: '/opt/my/openscad' }, which: () => '/usr/bin/openscad', exists: () => true });
    expect(hit).toEqual({ id: 'custom', bin: '/opt/my/openscad' });
  });

  it('falls back to PATH, then to the app bundle, in that order', () => {
    expect(findOpenscad({ which: (n) => (n === 'openscad' ? '/usr/local/bin/openscad' : null) }))
      .toEqual({ id: 'openscad', bin: '/usr/local/bin/openscad' });
    const app = OPENSCAD_CANDIDATES[0].apps[0];
    expect(findOpenscad({ exists: (p) => p === app })).toEqual({ id: 'openscad', bin: app });
  });

  it('returns null when there is nothing to find — absence is never an error here', () => {
    expect(findOpenscad()).toBe(null);
    expect(findOpenscad({ env: {}, which: () => null, exists: () => false })).toBe(null);
  });
});

describe('scad-gate — measuring what OpenSCAD rendered', () => {
  // Ground truth: mojulo writes the STL, so the box's size and volume are known exactly.
  const written = facesToStl({ faces: box(0, 0, 0, 2, 3, 4) }, { scale: 1, generator: 'test' });

  it('reads a BINARY stl and recovers the bounding box', () => {
    const m = measureStl(written.bytes);
    expect(m.bounds.size.map((v) => Math.round(v * 1000) / 1000)).toEqual([2, 3, 4]);
    expect(m.triangles).toBe(12);
  });

  it('recovers the enclosed VOLUME by the divergence theorem', () => {
    const m = measureStl(written.bytes);
    expect(m.volume).toBeCloseTo(24, 4);          // 2 × 3 × 4
  });

  it('reads an ASCII stl too — OpenSCAD writes either depending on version and flags', () => {
    const ascii = [
      'solid test',
      'facet normal 0 0 1',
      '  outer loop',
      '    vertex 0 0 0',
      '    vertex 5 0 0',
      '    vertex 0 7 0',
      '  endloop',
      'endfacet',
      'endsolid test',
    ].join('\n');
    const m = measureStl(Buffer.from(ascii, 'utf8'));
    expect(m.triangles).toBe(1);
    expect(m.bounds.size).toEqual([5, 7, 0]);
  });

  it('returns null rather than throwing on empty or unreadable bytes', () => {
    expect(measureStl(Buffer.alloc(0))).toBe(null);
    expect(measureStl(Buffer.from('not an stl at all', 'utf8'))).toBe(null);
    expect(measureStl(null)).toBe(null);
  });
});

describe('scad-gate — the verdict', () => {
  const measured = measureStl(facesToStl({ faces: box(0, 0, 0, 20, 30, 40) }, { scale: 1, generator: 'test' }).bytes);

  it('agrees when the render matches what mojulo declared', () => {
    const v = compareScadGate({ declared: { size_mm: [20, 30, 40] }, measured });
    expect(v.agrees).toBe(true);
    expect(v.size.agrees).toBe(true);
    expect(v.size.axes.every((a) => a.delta === 0)).toBe(true);
  });

  it('CATCHES the units class of error, which is the one that bites a print leg', () => {
    // the recipe was cm and something forgot the ×10
    const v = compareScadGate({ declared: { size_mm: [2, 3, 4] }, measured });
    expect(v.agrees).toBe(false);
    expect(v.size.agrees).toBe(false);
    expect(v.size.axes[0]).toMatchObject({ axis: 'x', declared: 2, measured: 20, delta: 18 });
  });

  it('compares volume when one was declared, and says why when none was', () => {
    const withVol = compareScadGate({ declared: { size_mm: [20, 30, 40], volume_mm3: 24000 }, measured });
    expect(withVol.volume.agrees).toBe(true);
    expect(withVol.agrees).toBe(true);

    const off = compareScadGate({ declared: { size_mm: [20, 30, 40], volume_mm3: 18000 }, measured });
    expect(off.volume.agrees).toBe(false);
    expect(off.agrees).toBe(false);

    const none = compareScadGate({ declared: { size_mm: [20, 30, 40] }, measured });
    expect(none.volume).toBe(null);
    expect(none.volume_reason).toContain('no declared volume');
  });

  it('DECISION 4: never compares triangle counts, and says so in the stamp', () => {
    const v = compareScadGate({ declared: { size_mm: [20, 30, 40] }, measured });
    expect(v.triangles_compared).toBe(false);
    expect(v.triangles_note).toContain('deliberately NOT compared');
    // a wildly different tessellation of the SAME solid still agrees
    const coarse = { ...measured, triangles: 3 };
    expect(compareScadGate({ declared: { size_mm: [20, 30, 40] }, measured: coarse }).agrees).toBe(true);
  });

  it('accepts a caller-supplied tolerance — a BAKED part sits up to about half a grid cell in', () => {
    const declared = { size_mm: [20.4, 30, 40] };
    expect(compareScadGate({ declared, measured }).agrees).toBe(false);
    expect(compareScadGate({ declared, measured, tolerance_mm: 0.5 }).agrees).toBe(true);
  });

  it('reports rather than throws when there is nothing to compare', () => {
    expect(compareScadGate({ declared: { size_mm: [1, 1, 1] }, measured: null }).agrees).toBe(false);
    expect(compareScadGate({ declared: {}, measured }).size.reason).toContain('nothing declared');
  });
});
