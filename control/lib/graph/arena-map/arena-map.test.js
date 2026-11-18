// THE ARENA MAP (lib/graph/arena-map): a fighting map as blocks on a grid, its principles as measured laws, and a
// generator that grows a template under them. One case a procedure, on the smallest map that shows it: a hand-built box
// for each thing a ramp or a ladder may run into; a line across a wall, a low wall, a floor; a drop; one template for
// the generator. The concepts: a way that runs into something is no way, and says what it ran into; sight is stopped by
// what stands in it; a drop is one way; every template is sound as written; growing never holds the laws worse; the
// same seed grows the same map.
import { describe, expect, it } from 'vitest';

import { blank, seal, indexMap, sees, distances, key, mapLaws, kitOf, growArenaMap, mapAscii, mapPieces, PRINCIPLES, LAW_IDS, TEMPLATES, TEMPLATE_IDS, BLOCKS, CELL, RISE, SLOPE } from './index.js';
import { missionBrief } from '../mission/index.js';
import { TEMPLATE_LOADOUTS } from '../gameworld/loadout.js';

// a box with a floor over its west end: a ledge to climb to
const ledge = (more = {}) => { const M = blank(6, 3, 2); M.floors.push([0, 0, 1], [0, 1, 1], [0, 2, 1]); return seal({ ...M, ...more }); };
const faults = (M, kind) => indexMap(M).connectors.filter((c) => c.kind === kind).flatMap((c) => c.faults);
const RAMP = { at: [2, 1, 0], dir: [-1, 0], run: 2 }, LADDER = { at: [1, 1, 0], dir: [-1, 0] };

describe('the blocks and the principles', () => {
  it('are closed tables: every law has its group, its why and what it asks', () => {
    expect(Object.keys(BLOCKS)).toEqual(expect.arrayContaining(['floor', 'wall', 'low-wall', 'solid', 'ramp', 'ladder']));
    for (const id of LAW_IDS) expect(PRINCIPLES[id]).toMatchObject({ group: expect.stringMatching(/^(structure|access|sight|economy)$/), why: expect.any(String), asks: expect.any(String) });
    expect(mapLaws(blank(4, 4, 1)).laws.map((l) => l.law)).toEqual(LAW_IDS);
  });
  it('size a map from the kit: a brief\'s run and the bands its guns are for', () => {
    const shooter = Object.keys(TEMPLATE_LOADOUTS).find((id) => TEMPLATE_LOADOUTS[id].weapons.every((w) => typeof w === 'string'));
    const B = missionBrief({ feel: shooter }), K = kitOf(B);
    expect(K.run).toBe(B.run);
    expect(K.bands).toEqual(Object.keys(B.serves).filter((b) => B.serves[b]));
    expect(K.longest).toBeGreaterThan(K.want);
  });
});

describe('a ramp', () => {
  it('with its landings, its opening and its line clear joins two levels, walked both ways', () => {
    const M = ledge({ ramps: [RAMP] }), I = indexMap(M);
    expect(faults(M, 'ramp')).toEqual([]);
    expect(distances(I, key(5, 1, 0)).has(key(0, 1, 1))).toBe(true);
    expect(distances(I, key(0, 1, 1)).has(key(5, 1, 0))).toBe(true);
    expect(RISE / (RAMP.run * CELL)).toBeLessThanOrEqual(SLOPE);
  });
  it('says what it runs into: a wall, the floor above, a mass, a missing landing, a slope too steep', () => {
    const wall = ledge({ ramps: [RAMP] }); wall.walls.push({ at: [2, 1, 0], side: 'e', kind: 'full' });
    expect(faults(wall, 'ramp').join()).toMatch(/runs into a wall/);
    const head = ledge({ ramps: [RAMP] }); head.walls.push({ at: [0, 1, 1], side: 'e', kind: 'full' });
    expect(faults(head, 'ramp').join()).toMatch(/a head into a wall of the level above/);
    const over = ledge({ ramps: [RAMP] }); over.floors.push([1, 1, 1]);
    expect(faults(over, 'ramp').join()).toMatch(/runs into the floor above/);
    const mass = ledge({ ramps: [RAMP] }); mass.solids.push([2, 1, 0]);
    expect(faults(mass, 'ramp').join()).toMatch(/runs into a mass/);
    expect(faults(ledge({ ramps: [{ at: [4, 1, 0], dir: [1, 0], run: 2 }] }), 'ramp').join()).toMatch(/no landing at its head|runs out of the map/);
    expect(faults(ledge({ ramps: [{ at: [1, 1, 0], dir: [-1, 0], run: 1 }] }), 'ramp').join()).toMatch(/too steep/);
    // a ramp that runs into something joins nothing
    expect(distances(indexMap(wall), key(5, 1, 0)).has(key(0, 1, 1))).toBe(false);
    expect(mapLaws(wall).laws.find((l) => l.law === 'ramps').holds).toBe(false);
  });
});

describe('a ladder', () => {
  it('with its foot, its shaft and its ledge clear joins two levels', () => {
    const M = ledge({ ladders: [LADDER] });
    expect(faults(M, 'ladder')).toEqual([]);
    expect(distances(indexMap(M), key(5, 1, 0)).has(key(0, 1, 1))).toBe(true);
  });
  it('says what it runs into: the floor above, a wall along its ledge, no ledge at all', () => {
    const over = ledge({ ladders: [LADDER] }); over.floors.push([1, 1, 1]);
    expect(faults(over, 'ladder').join()).toMatch(/climbs into the floor above/);
    const wall = ledge({ ladders: [LADDER] }); wall.walls.push({ at: [0, 1, 1], side: 'e', kind: 'low' });
    expect(faults(wall, 'ladder').join()).toMatch(/climbs into a wall along its ledge/);
    expect(faults(ledge({ ladders: [{ at: [4, 1, 0], dir: [1, 0] }] }), 'ladder').join()).toMatch(/no ledge to step onto/);
    expect(faults(blank(3, 3, 1) && { ...blank(3, 3, 1), ladders: [{ at: [1, 1, 0], dir: [1, 0] }] }, 'ladder').join()).toMatch(/climbs out of the map/);
  });
});

describe('a drop', () => {
  it('is one way: down off an open edge, never up; an edge over nothing is a fault until it is railed', () => {
    const M = ledge(), I = indexMap(M);
    expect(distances(I, key(0, 1, 1)).has(key(1, 1, 0))).toBe(true);
    expect(distances(I, key(1, 1, 0)).has(key(0, 1, 1))).toBe(false);
    const pit = ledge(); pit.solids.push([1, 1, 0]);
    expect(indexMap(pit).dropFaults.join()).toMatch(/over nothing to land on/);
    pit.walls.push({ at: [0, 1, 1], side: 'e', kind: 'low' });
    expect(indexMap(pit).dropFaults).toEqual([]);
  });
});

describe('sight', () => {
  it('is stopped by a wall and a mass, passes over a low wall, and passes between levels only where no floor lies', () => {
    const open = blank(6, 3, 1), I0 = indexMap(open);
    expect(sees(I0, [0, 1, 0], [5, 1, 0])).toBe(true);
    const walled = blank(6, 3, 1); for (let j = 0; j < 3; j++) walled.walls.push({ at: [2, j, 0], side: 'e', kind: 'full' });
    expect(sees(indexMap(walled), [0, 1, 0], [5, 1, 0])).toBe(false);
    const low = blank(6, 3, 1); for (let j = 0; j < 3; j++) low.walls.push({ at: [2, j, 0], side: 'e', kind: 'low' });
    expect(sees(indexMap(low), [0, 1, 0], [5, 1, 0])).toBe(true);
    const mass = blank(6, 3, 1); mass.solids.push([3, 1, 0]);
    expect(sees(indexMap(mass), [0, 1, 0], [5, 1, 0])).toBe(false);
    // from a ledge down into the open floor, and not through the ledge's own floor to what is under it
    const L = indexMap(ledge());
    expect(sees(L, [0, 1, 1], [4, 1, 0])).toBe(true);
    expect(sees(L, [0, 1, 1], [0, 1, 0])).toBe(false);
  });
});

describe('the templates', () => {
  it('are sound as written: bounded, joined, every ramp and ladder clear', () => {
    // (one template a shape of circulation; each is its own builder, so each is read)
    for (const id of TEMPLATE_IDS) {
      const R = mapLaws(TEMPLATES[id].build()), by = Object.fromEntries(R.laws.map((l) => [l.law, l]));
      for (const law of ['bounded', 'connected', 'ramps', 'ladders']) expect([id, law, by[law].says, by[law].holds]).toEqual([id, law, by[law].says, true]);
    }
  });
});

describe('a map grown under the laws', () => {
  // (the smallest template: the generator is one procedure whatever it starts from)
  const small = TEMPLATE_IDS.reduce((m, id) => (TEMPLATES[id].build().floors.length < TEMPLATES[m].build().floors.length ? id : m));
  const G = growArenaMap({ template: small, seed: 5, passes: 40 });
  it('never holds the laws worse than its template, and keeps its ways sound', () => {
    expect(G.held).toBeGreaterThanOrEqual(mapLaws(TEMPLATES[small].build()).held);
    expect(G.laws.find((l) => l.law === 'ramps').holds && G.laws.find((l) => l.law === 'ladders').holds).toBe(true);
    expect(G.passes.kept).toBeGreaterThan(0);
  });
  it('is the same map from the same seed, another from another, and not its template', () => {
    expect(growArenaMap({ template: small, seed: 5, passes: 40 }).map).toEqual(G.map);
    expect(growArenaMap({ template: small, seed: 6, passes: 40 }).map).not.toEqual(G.map);
    expect(G.map).not.toEqual(TEMPLATES[small].build());
    expect(() => growArenaMap({ template: 'maze' })).toThrow(/template is one of/);
  });
  it('left to run, holds every law: the repairs mend what the laws name', () => {
    const done = growArenaMap({ template: small, seed: 5 });
    expect(done.laws.filter((l) => !l.holds).map((l) => `${l.law}: ${l.says}`)).toEqual([]);
    expect(done.complete).toBe(true);
    expect(done.passes.ran).toBeLessThan(done.passes.asked);
    // and a law not held names what a repair mends: a line to break, an edge to rail, a floor no ramp reaches
    const open = mapLaws(TEMPLATES[small].build());
    expect(open.mend).toMatchObject({ lines: expect.any(Array), rails: expect.any(Array), unwalked: expect.any(Array) });
    expect(open.mend.lines.length + open.mend.rails.length + open.mend.unwalked.length).toBeGreaterThan(0);
  });
  it('is drawn a level at a time and listed as blocks in metres', () => {
    expect(mapAscii(G.map, G.furnished).split('level ').length - 1).toBe(G.map.nz);
    const P = mapPieces(G.map);
    expect(P.filter((p) => p.form === 'floor').length).toBe(G.map.floors.length);
    expect(P.every((p) => BLOCKS[p.form] && p.at.every(Number.isFinite))).toBe(true);
  });
}, 120000);
