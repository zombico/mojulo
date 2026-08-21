import { describe, expect, it } from 'vitest';

import { validateDiagramManifest, EDGE_HEADS } from './diagram-core.js';

// P0 edge-notation (diagram-patterns-spike.plan.md): typed head/tail markers +
// dashed on edges, and head/tail on line/polyline marks. This locks the enum +
// type checks; render behavior is covered by the binding test + the spike.
const withEdge = (edge) => ({
  title: 'notation',
  viewBox: { width: 400, height: 200 },
  stations: [
    { id: 'a', kind: 'input', label: 'A', x: 20, y: 60, w: 120, h: 80 },
    { id: 'b', kind: 'mcp_tool', label: 'B', x: 260, y: 60, w: 120, h: 80 },
  ],
  edges: [edge],
});

const withMark = (mark) => ({
  title: 'notation',
  viewBox: { width: 400, height: 200 },
  marks: [mark],
});

describe('P0 edge-notation validation', () => {
  it('accepts a plain edge (back-compat, no notation)', () => {
    expect(validateDiagramManifest(withEdge({ from: 'a', to: 'b' })).ok).toBe(true);
  });

  it('accepts every documented head kind on an edge', () => {
    for (const head of EDGE_HEADS) {
      expect(validateDiagramManifest(withEdge({ from: 'a', to: 'b', head })).ok).toBe(true);
    }
  });

  it('accepts head + tail + dashed together', () => {
    const r = validateDiagramManifest(
      withEdge({ from: 'a', to: 'b', head: 'crowsfoot-many', tail: 'crowsfoot-one', dashed: true }),
    );
    expect(r.ok).toBe(true);
  });

  it('accepts a self-edge (from === to) — the loopback case', () => {
    expect(validateDiagramManifest(withEdge({ from: 'a', to: 'a', head: 'arrow' })).ok).toBe(true);
  });

  it('rejects an unknown head on an edge', () => {
    const r = validateDiagramManifest(withEdge({ from: 'a', to: 'b', head: 'harpoon' }));
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/head must be one of/);
  });

  it('rejects a non-boolean dashed', () => {
    const r = validateDiagramManifest(withEdge({ from: 'a', to: 'b', dashed: 'yes' }));
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/dashed must be a boolean/);
  });

  it('accepts head/tail on line and polyline marks', () => {
    expect(validateDiagramManifest(withMark({ kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0, head: 'dot', tail: 'arrow' })).ok).toBe(true);
    expect(
      validateDiagramManifest(withMark({ kind: 'polyline', points: [[0, 0], [10, 0], [10, 10]], head: 'triangle-open' })).ok,
    ).toBe(true);
  });

  it('rejects an unknown head on a line mark', () => {
    const r = validateDiagramManifest(withMark({ kind: 'line', x1: 0, y1: 0, x2: 10, y2: 0, head: 'squiggle' }));
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/head must be one of/);
  });

  // P3 vocab: entity-box divider + endpoint multiplicity labels.
  it('accepts station.divider (boolean) and rejects a non-boolean', () => {
    const withStation = (extra) => ({
      title: 'x',
      viewBox: { width: 100, height: 100 },
      stations: [{ id: 'a', kind: 'db_row', label: 'A', x: 0, y: 0, w: 50, h: 50, ...extra }],
    });
    expect(validateDiagramManifest(withStation({ divider: true })).ok).toBe(true);
    const r = validateDiagramManifest(withStation({ divider: 'yes' }));
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/divider must be a boolean/);
  });

  it('accepts edge fromLabel/toLabel and rejects non-strings', () => {
    expect(validateDiagramManifest(withEdge({ from: 'a', to: 'b', fromLabel: '1', toLabel: '0..*' })).ok).toBe(true);
    const r = validateDiagramManifest(withEdge({ from: 'a', to: 'b', fromLabel: 7 }));
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/fromLabel must be a string/);
  });
});
