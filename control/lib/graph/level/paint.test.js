import { describe, it, expect } from 'vitest';
import { readLevel } from './graph.js';
import { sequentialLevel } from './sequential.js';
import { pickTerrain, readGeocube, geocubeTerrains } from '../era/geocube.js';
import { assembleStageScene } from '../era/stage.js';
import { resolveLevel } from '../gameworld/world.js';
import { MEADOWMARK } from '../gameworld/examples.js';

// A level painted by a geocube (graph.js `geocube`): the cube's outside laid once on every section that names no kit,
// on one of its terrains, picked two ways: the level asks, its heartbeat says what it was made for, the cube offers.
const CUBE = { from: 'gothic-night', outside: { terrain: 'moor', terrains: { shore: { reads: 'A cold beach under the walls', base: 'isekai-sakura', colour: { sand: '#6a6660', grass: '#47604f' } } } } };
const LEVEL = (more = {}) => ({ seed: 2, geocube: CUBE, nodes: { path: { trail: { run: 12 } }, top: { meru: true } }, ...more });

describe('the terrains, both ways', () => {
  it('a cube offers its own terrain first, then its others', () => {
    expect(geocubeTerrains(readGeocube(CUBE)).map((t) => [t.name, t.own])).toEqual([['moor', true], ['shore', false]]);
    expect(geocubeTerrains(readGeocube('gothic-night')).map((t) => t.name)).toEqual(['default']);
  });

  it('the level\'s ask wins; else the heartbeat\'s terrain if the cube has it; else the cube\'s own, the wish kept', () => {
    const c = readGeocube(CUBE);
    expect(pickTerrain(c, 'moor', 'shore')).toMatchObject({ name: 'moor', from: 'level' });
    expect(pickTerrain(c, undefined, 'shore')).toMatchObject({ name: 'shore', from: 'heartbeat' });
    expect(pickTerrain(c, undefined, 'tundra')).toMatchObject({ name: 'moor', from: 'cube', wanted: 'tundra', offered: ['moor', 'shore'] });
    expect(() => pickTerrain(c, 'tundra')).toThrow(/terrain 'tundra' is not one of gothic-night-variant's \(terrains: moor, shore\)/);
    expect(() => readGeocube({ from: 'gothic-night', outside: { terrains: { default: {} } } })).toThrow(/not the cube's own/);
  });
});

describe('a painted level', () => {
  it('every section without a kit carries the cube and the terrain; one with its own kit keeps it', () => {
    const L = sequentialLevel(LEVEL({ ground: { heartbeat: { from: 'ascent', terrain: 'shore' } } }));
    expect(L.paint).toMatchObject({ geocube: 'gothic-night-variant', terrain: 'shore', from: 'heartbeat', nodes: ['path', 'top'] });
    expect(L.stages[0].manifest).toMatchObject({ geocube: { id: 'gothic-night-variant' }, terrain: { hint: 'shore' } });
    expect(L.stages[0].manifest.kit).toBeUndefined();
    const own = sequentialLevel(LEVEL({ nodes: { path: { trail: { run: 12 }, kit: 'isekai-meadow' } } }));
    expect(own.paint.nodes).toEqual([]);
    expect(own.stages[0].manifest).toMatchObject({ kit: 'isekai-meadow' });
    expect(own.stages[0].manifest.geocube).toBeUndefined();
    expect(() => sequentialLevel(LEVEL({ terrain: 'tundra' }))).toThrow(/not one of/);
    expect(() => readLevel({ nodes: { a: { trail: true } }, terrain: 'shore' })).toThrow(/name the level's geocube/);
  });

  it('a painted trail is drawn in the terrain\'s look and says what it got; the climb takes the cube\'s land', () => {
    const L = sequentialLevel(LEVEL({ terrain: 'shore' }));
    const P = assembleStageScene(L.stages[0].manifest);
    expect(P.painted).toEqual({ geocube: 'gothic-night-variant', terrain: 'shore', from: 'level', offered: ['moor', 'shore'] });
    expect(P.faces.length).toBeGreaterThan(100);
    const own = assembleStageScene(sequentialLevel(LEVEL()).stages[0].manifest);
    expect(own.painted).toMatchObject({ terrain: 'moor', from: 'cube' });
    // two terrains, two looks: the ground's colours differ
    const fills = (p) => new Set(p.faces.filter((f) => typeof f.fill === 'string').map((f) => f.fill));
    expect([...fills(P)].join()).not.toBe([...fills(own)].join());
    expect(assembleStageScene(L.stages[1].manifest).painted).toMatchObject({ terrain: 'shore' });
  });

  it('a gameworld level is painted from its style', () => {
    const W = { ...MEADOWMARK, levels: { ...MEADOWMARK.levels, 'meadow-ascent': { ...MEADOWMARK.levels['meadow-ascent'], style: { geocube: CUBE, terrain: 'shore' } } } };
    const lv = resolveLevel(W, 'meadow-ascent').level;
    expect(sequentialLevel(lv).paint).toMatchObject({ terrain: 'shore', from: 'level', nodes: ['trailhead', 'approach', 'lookout'] });
  });
});
