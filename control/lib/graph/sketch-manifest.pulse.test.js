import { describe, expect, it } from 'vitest';

import { validateSketchManifest, PULSE_DIRS } from './sketch-manifest.js';

// A minimal two-station flow; `edge` is dropped in as the single edge so each
// case exercises only the pulse branch.
const withEdge = (edge) => ({
  title: 'ping',
  viewBox: { width: 400, height: 200 },
  stations: [
    { id: 'a', kind: 'input', label: 'A', x: 20, y: 60, w: 120, h: 80 },
    { id: 'b', kind: 'mcp_tool', label: 'B', x: 260, y: 60, w: 120, h: 80 },
  ],
  edges: [edge],
});

describe('edge.pulse validation', () => {
  it('accepts an edge with no pulse (back-compat)', () => {
    expect(validateSketchManifest(withEdge({ from: 'a', to: 'b' })).ok).toBe(true);
  });

  it('accepts a fully-specified pulse', () => {
    const r = validateSketchManifest(
      withEdge({ from: 'a', to: 'b', pulse: { count: 3, period: 1.5, size: 5, color: '#5eead4', dir: 'pingpong' } }),
    );
    expect(r.ok).toBe(true);
  });

  it('accepts an empty pulse object (renderer fills every default)', () => {
    expect(validateSketchManifest(withEdge({ from: 'a', to: 'b', pulse: {} })).ok).toBe(true);
  });

  it('accepts every documented direction', () => {
    for (const dir of PULSE_DIRS) {
      expect(validateSketchManifest(withEdge({ from: 'a', to: 'b', pulse: { dir } })).ok).toBe(true);
    }
  });

  it('rejects a non-object pulse', () => {
    const r = validateSketchManifest(withEdge({ from: 'a', to: 'b', pulse: 7 }));
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/pulse must be an object/);
  });

  it('rejects an out-of-range count', () => {
    expect(validateSketchManifest(withEdge({ from: 'a', to: 'b', pulse: { count: 0 } })).ok).toBe(false);
    expect(validateSketchManifest(withEdge({ from: 'a', to: 'b', pulse: { count: 99 } })).ok).toBe(false);
  });

  it('rejects a non-positive period or size', () => {
    expect(validateSketchManifest(withEdge({ from: 'a', to: 'b', pulse: { period: 0 } })).ok).toBe(false);
    expect(validateSketchManifest(withEdge({ from: 'a', to: 'b', pulse: { size: -1 } })).ok).toBe(false);
  });

  it('rejects an unknown direction', () => {
    const r = validateSketchManifest(withEdge({ from: 'a', to: 'b', pulse: { dir: 'sideways' } }));
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/dir must be one of/);
  });
});
