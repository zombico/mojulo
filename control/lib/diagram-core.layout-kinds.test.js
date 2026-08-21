import { describe, expect, it } from 'vitest';

import { expandGantt, expandSwimlanes, expandBoundaries, lowerDiagramKinds, validateDiagramManifest } from './diagram-core.js';

// P5 gantt + P2 swimlanes lowerings (diagram-patterns-spike.plan.md): pure,
// deterministic value→coordinate expanders that emit plain marks (gantt) or band
// marks + pinned stations (swimlanes). No-op unless their trigger is present.

const GANTT = {
  kind: 'gantt',
  title: 'G',
  scale: { start: 0, end: 6, unit: 'wk' },
  tasks: [
    { label: 'A', start: 0, end: 2 },
    { label: 'B', start: 2, end: 5 },
  ],
};

const SWIM = {
  title: 'S',
  lanes: [
    { id: 'u', label: 'User' },
    { id: 's', label: 'System' },
  ],
  stations: [
    { id: 'a', kind: 'input', label: 'Ask', lane: 'u', col: 0 },
    { id: 'b', kind: 'mcp_tool', label: 'Do', lane: 's', col: 1 },
  ],
  edges: [{ from: 'a', to: 'b' }],
};

describe('expandGantt', () => {
  it('is a no-op for a non-gantt manifest', () => {
    const m = { title: 'x', viewBox: { width: 10, height: 10 }, marks: [{ kind: 'rect', x: 0, y: 0, w: 1, h: 1 }] };
    expect(expandGantt(m)).toBe(m);
  });

  it('lowers to a valid diagram with a bar per task', () => {
    const out = expandGantt(GANTT);
    expect(validateDiagramManifest(out).ok).toBe(true);
    const bars = out.marks.filter((m) => m.kind === 'rect');
    expect(bars).toHaveLength(2);
  });

  it('maps the value domain onto x monotonically', () => {
    const out = expandGantt(GANTT);
    const [a, b] = out.marks.filter((m) => m.kind === 'rect');
    expect(b.x).toBeGreaterThan(a.x); // task B starts later than A
    expect(a.w).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(expandGantt(GANTT))).toBe(JSON.stringify(expandGantt(GANTT)));
  });

  it('rejects an inverted scale and an empty task list', () => {
    expect(() => expandGantt({ kind: 'gantt', title: 'x', scale: { start: 5, end: 1 }, tasks: [{ label: 't', start: 0, end: 1 }] })).toThrow(/scale.end must be greater/);
    expect(() => expandGantt({ kind: 'gantt', title: 'x', scale: { start: 0, end: 6 }, tasks: [] })).toThrow(/tasks must be a non-empty array/);
  });
});

describe('expandSwimlanes', () => {
  it('is a no-op with no lanes[]', () => {
    const m = { title: 'x', viewBox: { width: 10, height: 10 }, stations: [{ id: 'a', kind: 'input', label: 'A', x: 0, y: 0, w: 5, h: 5 }] };
    expect(expandSwimlanes(m)).toBe(m);
  });

  it('emits a band per lane (behind, z:-1) and pins laned stations', () => {
    const out = expandSwimlanes(SWIM);
    expect(validateDiagramManifest(out).ok).toBe(true);
    const bands = out.marks.filter((m) => m.kind === 'rect' && m.z === -1);
    expect(bands).toHaveLength(2);
    // Every station now carries concrete coords, and `lane`/`col` are consumed.
    for (const s of out.stations) {
      expect(Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.w) && Number.isFinite(s.h)).toBe(true);
      expect(s.lane).toBeUndefined();
    }
    // Station in lane 1 sits lower than the station in lane 0.
    const [a, b] = out.stations;
    expect(b.y).toBeGreaterThan(a.y);
  });

  it('rejects a station referencing an unknown lane', () => {
    expect(() =>
      expandSwimlanes({ title: 'x', lanes: [{ id: 'u', label: 'U' }], stations: [{ id: 'a', kind: 'input', label: 'A', lane: 'zzz' }] }),
    ).toThrow(/does not match any lane id/);
  });
});

describe('expandBoundaries (P4 containment)', () => {
  const BASE = {
    title: 'C',
    viewBox: { width: 400, height: 300 },
    stations: [
      { id: 'a', kind: 'mcp_tool', label: 'A', x: 40, y: 40, w: 100, h: 50 },
      { id: 'b', kind: 'db_row', label: 'B', x: 200, y: 120, w: 100, h: 50 },
      { id: 'out', kind: 'input', label: 'Out', x: 40, y: 220, w: 100, h: 50 },
    ],
    edges: [{ from: 'out', to: 'a' }],
  };

  it('is a no-op with no boundaries[]', () => {
    expect(expandBoundaries(BASE)).toBe(BASE);
  });

  it('appends a dashed rect + label that wraps its members (behind, z:-2)', () => {
    const out = expandBoundaries({ ...BASE, boundaries: [{ label: 'Plane', contains: ['a', 'b'] }] });
    expect(validateDiagramManifest(out).ok).toBe(true);
    const box = out.marks.find((m) => m.kind === 'rect' && m.z === -2);
    expect(box).toBeTruthy();
    expect(box.dash).toBeTruthy();
    // Wraps members a (x40..140,y40..90) and b (x200..300,y120..170) + padding.
    expect(box.x).toBeLessThan(40);
    expect(box.y).toBeLessThan(40);
    expect(box.x + box.w).toBeGreaterThan(300);
    expect(box.y + box.h).toBeGreaterThan(170);
    expect(out.marks.some((m) => m.kind === 'text' && m.value === 'Plane' && m.z === -2)).toBe(true);
  });

  it('rejects a boundary referencing an unknown / unplaced member', () => {
    expect(() => expandBoundaries({ ...BASE, boundaries: [{ contains: ['zzz'] }] })).toThrow(/does not match any station/);
    expect(() => expandBoundaries({ ...BASE, boundaries: [{ contains: [] }] })).toThrow(/non-empty array/);
  });

  it('runs after coords resolve — a lane-pinned member wraps correctly', () => {
    // swimlanes pin coords first, then boundaries wrap by resolved coords.
    const lowered = expandSwimlanes({
      title: 'x',
      lanes: [{ id: 'u', label: 'U' }, { id: 's', label: 'S' }],
      stations: [
        { id: 'p', kind: 'input', label: 'P', lane: 'u', col: 0 },
        { id: 'q', kind: 'mcp_tool', label: 'Q', lane: 's', col: 1 },
      ],
    });
    const out = expandBoundaries({ ...lowered, boundaries: [{ label: 'grp', contains: ['p', 'q'] }] });
    expect(out.marks.some((m) => m.kind === 'rect' && m.z === -2)).toBe(true);
  });
});

describe('lowerDiagramKinds', () => {
  it('routes each kind and no-ops a plain diagram', () => {
    const plain = { title: 'x', viewBox: { width: 10, height: 10 }, stations: [{ id: 'a', kind: 'input', label: 'A', x: 0, y: 0, w: 5, h: 5 }] };
    expect(lowerDiagramKinds(plain)).toBe(plain);
    expect(validateDiagramManifest(lowerDiagramKinds(GANTT)).ok).toBe(true);
    expect(validateDiagramManifest(lowerDiagramKinds(SWIM)).ok).toBe(true);
  });
});
