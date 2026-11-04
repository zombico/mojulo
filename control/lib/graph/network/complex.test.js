// A COMPLEX (a stage recipe's `complex`, network/complex.js): buildings of the core shape on one yard, each with a
// basement, placed by where they stand or beside each other (slid to face one another across the gap), joined below
// grade by passages of one section, the yard laid round them and each wearing its outside; the gate: every passage
// walked from one building's front door, down its stair, through the passage, up the other's stair and out of its
// front door, and back, by the page's ground probe over the payload's own faces and boxes.
import { describe, it, expect } from 'vitest';
import { assembleStageScene } from '../era/stage.js';
import { readComplex } from './complex.js';
import { walker } from './walk-gate.js';

const BASE = { buildings: [
  { id: 'command', use: 'command', at: [0, 0] },
  { id: 'barracks', use: 'barracks', at: { beside: 'command', side: '+x' } },
  { id: 'med', use: 'med-bay', at: { beside: 'command', side: '-x' } },
] };

describe('a complex of buildings joined below grade', () => {
  const P = assembleStageScene({ kind: 'stage', complex: BASE }, {});
  const byId = new Map(P.anchors.map((a) => [a.id, a])), tunnels = P.anchors.filter((a) => a.kind === 'tunnel'), law = (id) => P.complex.laws.find((l) => l.law === id);

  it('joins every building from its basement, held to the network\'s laws', () => {
    expect(P.complex.buildings.map((b) => b.id)).toEqual(['command', 'barracks', 'med']);
    expect(tunnels.length).toBe(2);
    for (const id of ['complex-reached', 'complex-cover', 'complex-grade', 'complex-run']) expect(law(id).ok).toBe(true);
    expect(P.complex.section).toBe('service');
    // (a building beside another slid to face it: its passage straight across the gap)
    expect(P.complex.passages.every((t) => t.kind === 'straight')).toBe(true);
    for (const name of ['site', 'door-command', 'tunnel', 'basement']) expect(P.cameras.some((c) => c.name === name)).toBe(true);
  });

  it('stands each building\'s storey 1 at the yard, its basement under it, and wears its outside: its facade, its glass, its roof', () => {
    for (const b of P.anchors.filter((a) => a.kind === 'building')) {
      expect(b.rooms.find((r) => r.id === 'lobby').box.min[2]).toBeCloseTo(0, 5);
      expect(b.rooms.find((r) => r.id === 'concourse').box.min[2]).toBeCloseTo(-b.rise, 5);
    }
    for (const g of ['complex:yard', 'complex:facade', 'complex:glass', 'complex:roof']) expect(P.faces.some((f) => f.group === g)).toBe(true);
    // (no yard under a building's ground floor: its lobby's floor is the ground there)
    const lobby = byId.get('building-command').rooms.find((r) => r.id === 'lobby').box;
    expect(P.faces.some((f) => f.group === 'complex:yard' && f.corners.every(([x, y]) => x > lobby.min[0] && x < lobby.max[0] && y > lobby.min[1] && y < lobby.max[1]))).toBe(false);
  });

  it('is walked through each passage from one front door to the other\'s, and back: no step over a riser, no wall, no gap, no box', () => {
    const walk = walker(P);
    for (const t of tunnels) {
      const id = t.id.slice('tunnel-'.length), A = byId.get(t.from), B = byId.get(t.to);
      const way = [...A.down, ...A.ports.find((p) => p.id === id).reach.slice(1), ...t.line.slice(1), ...B.ports.find((p) => p.id === id).reach.slice().reverse().slice(1), ...B.down.slice().reverse().slice(1)];
      for (const pts of [way, way.slice().reverse()]) {
        const r = walk(pts);
        expect({ id, steepest: r.steepest <= 0.36, crossed: r.crossed, gaps: r.gaps, boxes: r.boxes }).toEqual({ id, steepest: true, crossed: [], gaps: [], boxes: [] });
        expect(r.end).toBeCloseTo(0, 1);
      }
    }
  });
});

describe('a complex composed', () => {
  it('joins only the pairs its links name, in the section it names, wearing that section\'s finish', () => {
    const P = assembleStageScene({ kind: 'stage', complex: { ...BASE, buildings: BASE.buildings.slice(0, 2), network: { section: 'passage', links: [['command', 'barracks']] } } }, {});
    expect(P.complex.passages.map((t) => t.id)).toEqual(['command-barracks']);
    expect(P.complex.section).toBe('passage');
    expect(P.faces.some((f) => f.group === 'complex:tunnel-glass')).toBe(true);
    const none = assembleStageScene({ kind: 'stage', complex: { ...BASE, buildings: BASE.buildings.slice(0, 2), network: { links: [] } } }, {});
    expect(none.complex.passages).toEqual([]);
    expect(none.complex.laws.find((l) => l.law === 'complex-reached').ok).toBe(false);
  });

  it('refuses what it cannot build, by name', () => {
    expect(() => readComplex({ buildings: [] })).toThrow(/at least one building/);
    expect(() => readComplex({ buildings: [{ id: 'a', use: 'command', at: [0, 0] }], roads: 1 })).toThrow(/'roads' is not a setting/);
    expect(() => readComplex({ buildings: [{ id: 'a', use: 'command', at: { beside: 'b', side: '+x' } }] })).toThrow(/beside 'b'/);
    expect(() => readComplex({ buildings: [{ id: 'a', use: 'command', at: [0, 0] }], network: { links: [['a', 'z']] } })).toThrow(/network.links/);
    expect(() => assembleStageScene({ kind: 'stage', complex: { buildings: [{ id: 'a', use: 'command', at: [0, 0] }, { id: 'b', use: 'barracks', at: [3, 3] }] } }, {})).toThrow(/stand on each other/);
  });
});
