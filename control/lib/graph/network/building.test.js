// A BUILDING AS A NODE (network/building.js) and the BASEMENT under it (era/program-core.js `basement`): a building of
// the core shape laid with a storey under its ground one (the ground plate's twin, a concourse under its lobby, its stair
// up from the basement), set into a site with its storey 1 at the ground, and joined to another across a yard by a
// passage leaving its basement; walked from one front door down into its basement, along the passage, up the other's
// stair and out of its front door, and back. One case a procedure (chosen from the catalog): an annex's, a building on
// storeys, a building of one storey.
import { describe, it, expect } from 'vitest';
import { withProgram, planProgram, PROGRAMS, PROGRAM_IDS } from '../era/programs.js';
import { planStage } from '../era/stage.js';
import { buildingFit, buildingNode } from './building.js';
import { networkEdges, pathOf } from './edges.js';
import { passageOf } from './passage.js';
import { readSection } from './sections.js';
import { walker } from './walk-gate.js';
import { groundLess } from '../geocity/podium.js';

const core = PROGRAM_IDS.filter((u) => PROGRAMS[u].shape === 'core');
// (a building whose basement has a wall facing out on a side of its plan: its front -y)
const faces = (u, side) => withProgram({ kind: 'stage', program: { use: u, basement: true } })._program.under.ports.some((p) => p.side === side);
const cases = {
  annex: core.find((u) => PROGRAMS[u].annex?.ways?.length),
  storeys: core.find((u) => !PROGRAMS[u].annex && PROGRAMS[u].core.storeys > 1 && faces(u, '-x')),
  single: core.find((u) => PROGRAMS[u].core.storeys === 1 && !PROGRAMS[u].annex && faces(u, '+x')),
};

describe('a basement under a building of the core shape', () => {
  it('is its ground plate\'s twin room for room, every storey above lifted one, its stair up from its core', () => {
    for (const use of Object.values(cases)) {
      const m = withProgram({ kind: 'stage', program: { use, basement: true } }), PI = planStage(m);
      const at = (s) => m.rooms.filter((r) => (r.storey ?? 0) === s);
      expect(at(0).length).toBe(at(1).length);
      expect(at(0).some((r) => r.id === 'concourse')).toBe(true);
      expect(at(1).some((r) => r.id === 'lobby')).toBe(true);
      expect(PI.storeys.length).toBe(PROGRAMS[use].core.storeys + 1);
      expect(PI.stairs.some((s) => s.lower === 'core-0' && s.upper === 'core-1')).toBe(true);
      // (each ground room stands over a basement room of its own plan)
      for (const r of at(1)) expect(at(0).some((b) => b.x === r.x && b.y === r.y && b.w === r.w && b.d === r.d)).toBe(true);
    }
  });

  it('names the basement\'s walls that face out as its ports: none with a room against it', () => {
    for (const use of Object.values(cases)) {
      const m = withProgram({ kind: 'stage', program: { use, basement: true } }), base = m.rooms.filter((r) => !r.storey);
      expect(m._program.under.ports.length).toBeGreaterThan(1);
      for (const p of m._program.under.ports) {
        const r = base.find((x) => x.id === p.room), line = p.side === '-y' ? r.y : p.side === '+y' ? r.y + r.d : p.side === '-x' ? r.x : r.x + r.w;
        const against = base.filter((o) => o !== r && Math.abs((p.side === '-y' ? o.y + o.d : p.side === '+y' ? o.y : p.side === '-x' ? o.x + o.w : o.x) - line) < 1e-6
          && (p.side.endsWith('y') ? o.x < r.x + r.w && o.x + o.w > r.x : o.y < r.y + r.d && o.y + o.d > r.y));
        expect(against).toEqual([]);
      }
    }
    // (an annex's undercroft is one where its annex has its own ways out)
    expect(withProgram({ kind: 'stage', program: { use: cases.annex, basement: true } })._program.under.ports.some((p) => p.room.endsWith('-under'))).toBe(true);
  });

  it('is absent unless asked, and only a building of the core shape takes one', () => {
    const plain = planProgram({ use: cases.storeys });
    expect(plain.rooms.some((r) => r.id === 'concourse')).toBe(false);
    expect(plain.under).toBeUndefined();
    const house = PROGRAM_IDS.find((u) => PROGRAMS[u].shape !== 'core');
    expect(() => planProgram({ use: house, basement: true })).toThrow(/'basement' is not a setting/);
    expect(() => planProgram({ use: cases.single, basement: 'yes' })).toThrow(/basement is true/);
  });
});

describe('two buildings joined across a yard by a passage from their basements', () => {
  const sec = readSection('service'), padZ = 10;
  const A = buildingFit({ use: cases.single }, { id: 'A', at: [0, 0], facing: '-y', door: sec.door });
  const B0 = buildingFit({ use: cases.storeys }, { id: 'B', at: [0, 0], facing: '-y', door: sec.door });
  const B = buildingFit({ use: cases.storeys }, { id: 'B', at: [A.footprint[2] + 20 - B0.footprint[0], 0], facing: '-y', door: sec.door });
  const edges = networkEdges([A.node, B.node], { section: sec, blocks: [A.footprint, B.footprint] });
  const portsOf = (id) => edges.flatMap((e) => (e.a === id ? [{ id: `${e.a}-${e.b}`, room: e.roomA, side: e.sideA, u: e.uA, width: e.doorA }] : e.b === id ? [{ id: `${e.a}-${e.b}`, room: e.roomB, side: e.sideB, u: e.uB, width: e.doorB }] : []));
  const NA = buildingNode(A, { padZ, ports: portsOf('A') }), NB = buildingNode(B, { padZ, ports: portsOf('B') });
  const over = (x, y) => ({ z: padZ, under: [A.footprint, B.footprint].some((R) => x >= R[0] && x <= R[2] && y >= R[1] && y <= R[3]) ? 'slab' : 'ground' });
  const end = (q) => { const ax = q.side.endsWith('y') ? 0 : 1, P = (u) => { const p = [0, 0]; p[ax] = u; p[1 - ax] = q.plane; return p; }; return { z0: q.z0, lo: P(q.lo), hi: P(q.hi), top: q.top, plane: q.plane }; };

  it('stands each with its storey 1 at the ground at its door and its basement under it, joined by one passage', () => {
    expect(edges).toHaveLength(1);
    for (const N of [NA, NB]) {
      expect(N.rooms.find((r) => r.id === 'lobby').box.min[2]).toBeCloseTo(padZ, 5);
      expect(N.rooms.find((r) => r.id === 'concourse').box.min[2]).toBeCloseTo(padZ - N.rise, 5);
      expect(N.ports).toHaveLength(1);
      expect(N.ports[0].z0).toBeCloseTo(padZ - N.rise, 5);
    }
    expect(NA.door.at).toEqual([0, 0, padZ]);
  });

  it('is walked from one front door, down, along the passage, up and out of the other\'s, and back: no step over a riser, no wall, no gap, no box', () => {
    const e = edges[0], pa = end(NA.ports[0]), pb = end(NB.ports[0]);
    const T = passageOf({ id: 'A-B', path: pathOf(e, pa, pb), a: pa, b: pb, section: sec, over, look: { light: 0.45 } });
    expect(T.cover).toBeGreaterThanOrEqual(sec.cover);
    expect(T.findings).toEqual([]);
    let ground = [{ corners: [[-200, -200, padZ], [400, -200, padZ], [400, 200, padZ], [-200, 200, padZ]], normal: [0, 0, 1], group: 'ground', fill: '#777777' }];
    for (const R of [A.footprint, B.footprint]) ground = ground.flatMap((f) => groundLess(f, R));
    const payload = { faces: [...ground, ...NA.faces, ...NB.faces, ...T.faces], colliders: [...NA.colliders, ...NB.colliders, ...T.colliders] };
    const way = [...NA.down, ...NA.ports[0].reach.slice(1), ...T.line.slice(1), ...NB.ports[0].reach.slice().reverse().slice(1), ...NB.down.slice().reverse().slice(1)];
    for (const pts of [way, way.slice().reverse()]) {
      const r = walker(payload)(pts);
      expect({ steepest: r.steepest <= 0.36, crossed: r.crossed, gaps: r.gaps, boxes: r.boxes }).toEqual({ steepest: true, crossed: [], gaps: [], boxes: [] });
      expect(r.end).toBeCloseTo(padZ, 1);
    }
  });

  it('turns with the way it faces, and refuses a building of another shape', () => {
    const E = buildingFit({ use: cases.single }, { id: 'E', at: [5, 5], facing: '+x', door: sec.door });
    expect(E.N).toEqual([1, 0]);
    expect(E.footprint[2]).toBeLessThanOrEqual(5 + 1e-6);
    const house = PROGRAM_IDS.find((u) => PROGRAMS[u].shape !== 'core');
    expect(() => buildingFit({ use: house }, { id: 'H', at: [0, 0] })).toThrow();
  });
});
