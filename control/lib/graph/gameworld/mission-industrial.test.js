// AN INDUSTRIAL LEVEL (mission-industrial.js), planned: nothing is resolved here. One world a procedure (a feel template
// that shoots), the default yard. The concepts: its words are read on rails; the place's recipe is the geocube's own,
// the design's pieces written as its yard's words in the plan's metres, inside the yard; the mission's places are on the
// land, inside the yard's own ground, the way out at the building's door; its tasks are proved on the bus; it is a
// level's form, staged and ordered as one, and refuses what does not go beside it. The level whole is the e2e tier's.
import { describe, expect, it } from 'vitest';
import { readIndustrial, industrialPlan, industrialManifest, INDUSTRIAL, SEAT } from './mission-industrial.js';
import { proveMission } from './mission-proof.js';
import { readGameworld } from './world.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { TEMPLATE_LOADOUTS } from './loadout.js';
import { POLES } from './feel/cards.js';
import { PROGRAM_IDS, PROGRAMS } from '../era/programs.js';
import { ERAS } from '../era/eras.js';

const SHOOTER = Object.keys(TEMPLATE_LOADOUTS).find((id) => TEMPLATE_LOADOUTS[id].weapons.every((w) => typeof w === 'string') && !POLES[id].demo.includes('attack'));
const world = (L) => ({ id: 'ind', name: 'Ind', seed: 1, feel: SHOOTER, start: 'yard', levels: { yard: { name: 'The yard', ...L } } });
const FLAT = PROGRAM_IDS.find((u) => PROGRAMS[u].shape === 'core' && !PROGRAMS[u].annex);

describe('an industrial level, read', () => {
  it('is what it is when it names nothing, and takes each word on its rail', () => {
    expect(readIndustrial(true)).toEqual({ ...INDUSTRIAL });
    expect(readIndustrial({ walker: false, weather: false, hour: 'noon', depth: 24 })).toMatchObject({ walker: null, weather: false, hour: 'noon', depth: 24 });
    expect(() => readIndustrial({ use: FLAT })).toThrow(/a building with a hall/);
    expect(() => readIndustrial({ depth: 20 })).toThrow(/18 to 36 m in 3s/);
    expect(() => readIndustrial({ hour: 'teatime' })).toThrow(/hour is a number/);
    expect(() => readIndustrial({ weather: 'soup' })).toThrow(/the air over it/);
    expect(() => readIndustrial({ moat: true })).toThrow(/not an industrial level's word/);
  });
});

describe('an industrial level, planned', () => {
  const G = readGameworld(world({ industrial: true })), P = industrialPlan(G, readIndustrial(true), { seed: 1 }), Y = P.recipe.buildings[0].yard, [bx0, by0, bx1] = P.seat.bounds;
  it('is the geocube\'s own recipe, the design\'s pieces its yard\'s words in the plan\'s metres, inside the yard', () => {
    expect(P.recipe.kind).toBe('geocube');
    expect(ERAS[P.recipe.cube.era].surface).toBe('form');
    expect(P.recipe).toMatchObject({ hour: INDUSTRIAL.hour, weather: INDUSTRIAL.weather });
    expect(P.recipe.buildings[0].at).toEqual({ x: SEAT.x, y: SEAT.y, facing: SEAT.facing, floor: SEAT.floor });
    expect(Y).toMatchObject({ depth: INDUSTRIAL.depth, fence: true });
    expect(Y.stacks.length).toBe(P.design.pieces.filter((p) => p.kind !== 'barrier').length);
    expect(Y.barriers.length).toBe(P.design.pieces.filter((p) => p.kind === 'barrier').length);
    expect(Y.masts.length).toBe(P.design.lights.length);
    // (every piece before the building's front, between the apron's sides, inside its depth)
    for (const p of [...Y.stacks.map((s) => s.at), ...Y.barriers.map((b) => b.at), ...Y.masts]) {
      expect(p[0]).toBeGreaterThan(bx0 - P.seat.side); expect(p[0]).toBeLessThan(bx1 + P.seat.side);
      expect(p[1]).toBeLessThan(by0); expect(p[1]).toBeGreaterThan(by0 - INDUSTRIAL.depth);
    }
    expect(P.recipe.parked).toHaveLength(1);
    expect(P.recipe.parked[0]).toMatchObject({ vehicle: INDUSTRIAL.walker });
    // (with no walker nothing is parked and the design is the yard's alone; a dry day asks for no weather)
    const bare = industrialPlan(G, readIndustrial({ walker: false, weather: false }), { seed: 1 });
    expect(bare.recipe.parked).toBeUndefined();
    expect(bare.recipe.weather).toBeUndefined();
    expect(bare.design.fixed).toEqual([]);
  }, 240000);
  it('lays the mission on the land inside the yard, the way out at the building\'s door, and proves its tasks', () => {
    const M = P.mission, inYard = (p) => { const [x, y] = P.seat.toPlan(p); return x > bx0 - P.seat.side && x < bx1 + P.seat.side && y < by0 + 0.5 && y > by0 - INDUSTRIAL.depth; };
    const places = [M.anchors.spawn, M.anchors.exit, ...M.sections.flatMap((S) => [S.entry, ...S.foes.map((f) => f.at), ...S.drops.map((d) => d.at)])];
    expect(places.length).toBeGreaterThan(8);
    for (const p of places) { expect(inYard(p), `${p}`).toBe(true); expect(p[2]).toBe(SEAT.floor); }
    // (the way out stands before the door: within two cells of it along the front, at the building's wall)
    const exit = P.seat.toPlan(M.anchors.exit);
    expect(Math.abs(exit[0] - P.seat.doorPlan[0])).toBeLessThan(6);
    expect(by0 - exit[1]).toBeLessThan(3.5);
    expect(M.on).toBe('building');
    expect(M.frame.floors).toEqual([SEAT.floor]);
    const m = industrialManifest(G, P);
    expect(m.entities.filter((e) => e.team === 'foes').every((e) => e.dormant)).toBe(true);
    expect(proveMission(m)).toMatchObject({ proved: true, done: M.sections.map((S) => S.id) });
    expect(P.laws.filter((l) => !l.holds).every((l) => l.law.startsWith('map:'))).toBe(true);
    expect(industrialPlan(G, readIndustrial(true), { seed: 1 }).recipe).toEqual(P.recipe);
  }, 240000);
});

describe('an industrial level, a level\'s form', () => {
  it('is one stage and one order: the place\'s recipe with the mission\'s cast on it, named for its level', () => {
    const W = world({ industrial: true }), G = readGameworld(W), st = gameStages(W)[0], O = stageLevelOrder(G, st, { ref: 'ind-level-yard-0', heroRef: null }), m = O.args.manifest;
    expect([st.section, st.node, m.kind]).toEqual(['industrial', 'yard', 'geocube']);
    expect(m.game.levelRef).toBe('ind-level-yard-0');
    expect(m.mission.tasks.length).toBe(st.mission.mission.sections.length);
    expect(O.ends.spawn).toEqual(st.mission.mission.anchors.spawn);
    expect(O.laws.every((l) => l.concern === 'mission')).toBe(true);
  }, 240000);
  it('refuses what does not go beside it, a mission that names a map, and a world with no gun', () => {
    expect(() => readGameworld(world({ industrial: true, walk: { nodes: { a: { trail: true } } } }))).toThrow(/its yard and its mission alone/);
    expect(() => readGameworld(world({ industrial: true, mission: { map: true } }))).toThrow(/the yard is the map/);
    expect(() => readGameworld({ ...world({ industrial: true }), feel: undefined })).toThrow(/the guns the world carries/);
    expect(() => readGameworld(world({ industrial: { use: FLAT } }))).toThrow(/a building with a hall/);
  });
});
