// THE QUEST OPEN WORLD: its reader over a geocity's regions, and its principles, the WCD's opposite pole. One small metro
// (a shore, the beyond on its land edges), its quests and locks placed by hand.
import { describe, it, expect } from 'vitest';
import { readQow, qowLaws, cutsOf, QOW_PRINCIPLES } from './qow.js';

const map = { geocity: { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2] }, seed: 2 };
const Q = readQow({ map });
const law = (q, id) => q.laws.find((l) => l.law === id);
const ids = Q.regions.map((r) => r.id);

describe('a quest open world', () => {
  it('reads its regions off a geocity, spawns in the core, sees by its landmarks, streams by its rings', () => {
    expect(Q.regions.length).toBeGreaterThan(8);
    expect(Q.regions.find((r) => r.id === Q.spawn).builds).toBe('core');
    expect(Q.landmarks[0].name).toBe('the core');
    for (const id of ids) expect(Q.stream.rings[id]).toContain(id);
    expect(Object.keys(QOW_PRINCIPLES).sort()).toEqual(Q.laws.map((l) => l.law).sort());
    expect(law(Q, 'open').holds && law(Q, 'sideways').holds && law(Q, 'seen').holds).toBe(true);
  });

  it('refuses what is malformed by name', () => {
    expect(() => readQow({ map, roads: 1 })).toThrow(/'roads' is not a setting/);
    expect(() => readQow({ map, spawn: 'Z9' })).toThrow(/spawn 'Z9' is not a region/);
    expect(() => readQow({ map, locks: [{ region: ids[1] }] })).toThrow(/gate is/);
    expect(() => readQow({ map, quests: [{ id: 'q', at: ids[0], after: ['nope'] }] })).toThrow(/which is no quest/);
    expect(() => readQow({ map, level: 'tower' }, { levels: ['town'] })).toThrow(/not one of the world's levels/);
  });

  it('advises when a lock shuts the way on: a region reached only through it, a main quest behind it', () => {
    // a corner region's two neighbours locked: the corner is reached only through a lock
    const nbrs = (id) => Q.edges.filter((e) => e.a === id || e.b === id).map((e) => (e.a === id ? e.b : e.a));
    const corner = Q.regions.find((r) => r.id !== Q.spawn && nbrs(r.id).length === 2 && !nbrs(r.id).includes(Q.spawn));
    const round = nbrs(corner.id);
    const L = readQow({ map, locks: round.map((region) => ({ region, gate: { clearance: 2 } })), quests: [{ id: 'heist', at: round[0], kind: 'main' }] });
    expect(law(L, 'open').holds).toBe(false);
    expect(law(L, 'unforced').holds).toBe(false);
  });

  it('advises against quests as one corridor, and quests all in one ring', () => {
    const core = Q.regions.filter((r) => r.ring === 'core').map((r) => r.id);
    const chain = readQow({ map, quests: [{ id: 'a', at: core[0] }, { id: 'b', at: core[0], after: ['a'] }, { id: 'c', at: core[0], after: ['b'] }] });
    expect(law(chain, 'unforced').holds).toBe(false);
    expect(law(chain, 'spread').holds).toBe(false);
    const far = Q.regions.find((r) => r.ring === 'outskirts').id;
    expect(law(readQow({ map, quests: [{ id: 'a', at: core[0] }, { id: 'b', at: far }] }), 'spread').holds).toBe(true);
  });

  it('finds the cut vertices of a graph', () => {
    expect(cutsOf(['a', 'b', 'c', 'd'], [{ a: 'a', b: 'b' }, { a: 'b', b: 'c' }, { a: 'c', b: 'a' }, { a: 'c', b: 'd' }])).toEqual(['c']);
    expect(cutsOf(['a', 'b', 'c'], [{ a: 'a', b: 'b' }, { a: 'b', b: 'c' }, { a: 'c', b: 'a' }])).toEqual([]);
    expect(qowLaws({ ...Q, landmarks: [] }).find((l) => l.law === 'seen').holds).toBe(false);
  });
});
