// The moves a hero STARTS with (characters.hero.actions.moves: the wall, the swinger's line; actions.js HERO_MOVES), in
// every level it plays: on its platform rule, its clips falling back for their states, F on its legend; and in a building
// level, under its rooms' ceilings, laid as colliders, so a climb ends there and a line lands on one. A warehouse (a
// barn's great floor, 30 × 20 × 12 m) and a crypt, a progressive chain of rooms; a world without moves is unchanged.
import { describe, it, expect } from 'vitest';
import { readGameworld, MEADOWMARK, MEADOWMARK_HERO } from './index.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { HERO_MOVES } from './actions.js';
import { TRAVERSAL_FALLBACK } from '../playscape/player.js';
import { assembleStageScene } from '../era/stage.js';
import { createWorld, stepWorld } from '../worlds/controllable-world.js';

const hero = (moves) => ({ ...MEADOWMARK_HERO.characters, hero: { ...MEADOWMARK_HERO.characters.hero, actions: { ...(MEADOWMARK_HERO.characters.hero.actions ?? {}), ...(moves ? { moves } : {}) } } });
const world = (building, moves) => ({ ...MEADOWMARK, characters: hero(moves), levels: { ...MEADOWMARK.levels, inside: { name: 'Inside', building } } });
const WAREHOUSE = { use: 'barn', seed: 1, rooms: { floor: { w: 30, d: 20, h: 12 } } };
const order = (W) => { const G = readGameworld(W), st = gameStages(W).find((s) => s.level === 'inside'); return stageLevelOrder(G, st, { ref: 'lv_in', heroRef: 'gw-hero' }); };

describe('a hero\'s starting moves', () => {
  it('are read as a list of the moves there are, each once', () => {
    expect(() => readGameworld(world(WAREHOUSE, ['wall', 'swinger']))).not.toThrow();
    expect(() => readGameworld(world(WAREHOUSE, ['fly']))).toThrow(/moves is a list of the moves the hero starts with/);
    expect(() => readGameworld(world(WAREHOUSE, ['wall', 'wall']))).toThrow(/each once/);
  });

  it('ride its platform rule in a building, its clips falling back, F on its legend; a hero without them is as it was', () => {
    const m = order(world(WAREHOUSE, ['wall', 'swinger'])).args.manifest, h = m.entities[0];
    expect(h.rule).toMatchObject({ type: 'platform', ...HERO_MOVES.wall.rule, ...HERO_MOVES.swinger.rule });
    const clips = m.figures.hero.clips;
    for (const state of Object.keys(TRAVERSAL_FALLBACK)) expect(clips[state], state).toBeTruthy();
    expect(JSON.stringify(m.events)).toContain('F  swing');
    expect(m.ceilings).toBe(true);
    const plain = order(world(WAREHOUSE)).args.manifest;
    expect(plain.entities[0].rule.wall).toBeUndefined();
    expect(plain.ceilings).toBeUndefined();
    expect(plain.figures.hero.clips.wall_crawl).toBeUndefined();
  });
});

describe('indoors: a warehouse and a crypt under their ceilings', () => {
  const m = order(world(WAREHOUSE, ['wall', 'swinger'])).args.manifest;
  const scene = assembleStageScene(m);
  it('lays each room\'s ceiling as a collider over its walls, the great floor\'s at its 12 m', () => {
    const ceilings = scene.colliders.filter((c) => c.of.startsWith('ceiling:'));
    expect(ceilings.length).toBeGreaterThan(0);
    expect(ceilings.some((c) => Math.abs(c.min[2] - 12) < 0.01)).toBe(true);
    expect(assembleStageScene({ ...m, ceilings: undefined }).colliders.some((c) => c.of.startsWith('ceiling:'))).toBe(false);
  });

  it('is swung in: the line goes up to the great floor\'s ceiling', () => {
    const floor = scene.colliders.find((c) => c.of.startsWith('ceiling:') && Math.abs(c.min[2] - 12) < 0.01);
    const cx = (floor.min[0] + floor.max[0]) / 2, y0 = floor.min[1] + 3;
    const w = createWorld({ entities: [{ ...m.entities[0], transform: { pos: [cx, y0, 3], heading: Math.PI / 2 } }], colliders: scene.colliders });
    stepWorld(w, { boost: 1 }, 1 / 60, { ground: () => 0 });
    expect(w.byId.hero.swinging).toBeTruthy();
    expect(w.byId.hero.swinging.anchor[2]).toBeGreaterThan(8);
  });

  it('a crypt, a dungeon of rooms one after another, is played with them too; a tower\'s stair rooms stay open overhead', () => {
    const crypt = order(world({ use: 'crypt', seed: 2 }, ['wall'])).args.manifest;
    expect(crypt.entities[0].rule.wall).toBe(true);
    expect(assembleStageScene(crypt).colliders.some((c) => c.of.startsWith('ceiling:'))).toBe(true);
    // the tower's flights rise out of its stair room and its landing: those two stay open, every other room is roofed
    const tower = order(world({ use: 'tower', seed: 1 }, ['wall'])).args.manifest, T = assembleStageScene(tower);
    const roofed = new Set(T.colliders.filter((c) => c.of.startsWith('ceiling:')).map((c) => c.of.slice('ceiling:'.length).split('@')[0]));
    expect([...roofed].sort()).toEqual(['base', 'guard', 'lookout', 'top']);
  });
});
