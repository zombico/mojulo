// A gameworld level that is a building: `building: { use }` in place of `walk`, laid by its civilization's language
// from its program, entered at its way in and played to its goal room; or `building: { ref }`, a building already
// made, played as it was made. The laws: it reads and refuses like any level setting; its civilization speaks; the
// runner makes it (with the hero piloting when there is one) or, by ref, makes nothing and plays the ref; the bible
// and the graph draw it; and a world without one is unchanged.

import { describe, it, expect } from 'vitest';
import { readGameworld, resolveLevel, runSteps, MEADOWMARK, MEADOWMARK_HERO } from './index.js';
import { gameStages, stageLevelOrder, buildingStage } from './levels.js';
import { gameworldBibleHtml } from './bible-html.js';
import { gameworldGraph } from './graph.js';
import { withBuildingLevel } from '../structure/level.js';

const withInn = (W, building = { use: 'tavern', seed: 2 }) => ({ ...W, levels: { ...W.levels, 'the-inn': { name: 'The inn', building } } });

describe('a building level reads like any level', () => {
  it('a use or a ref, never a walk beside it, never a town in it', () => {
    expect(() => readGameworld(withInn(MEADOWMARK))).not.toThrow();
    expect(() => readGameworld(withInn(MEADOWMARK, { ref: 'sk_tower', goal: 'top' }))).not.toThrow();
    expect(() => readGameworld(withInn(MEADOWMARK, { use: 'casino' }))).toThrow(/tavern/);
    expect(() => readGameworld(withInn(MEADOWMARK, { use: 'tavern', ref: 'x' }))).toThrow(/one of them/);
    expect(() => readGameworld(withInn(MEADOWMARK, { ref: 'x', seed: 2 }))).toThrow(/as it was made/);
    expect(() => readGameworld(withInn(MEADOWMARK, { use: 'tavern', kit: 'isekai-meadow' }))).toThrow(/not a room kit/);
    expect(() => readGameworld(withInn(MEADOWMARK, { use: 'tavern', civilization: 'elves' }))).toThrow(/not a civilization/);
    const both = { ...MEADOWMARK, levels: { ...MEADOWMARK.levels, inn: { building: { use: 'tavern' }, walk: { nodes: { a: { trail: true } } } } } };
    expect(() => readGameworld(both)).toThrow(/a walk or a building/);
  });

  it("its civilization speaks: the level's own, its anchor (or its kit's) carried to the program", () => {
    const R = resolveLevel(withInn(MEADOWMARK), 'the-inn');
    expect(R.level).toBeNull();
    expect(R.building).toMatchObject({ use: 'tavern', seed: 2, civilization: R.style.civilization });
    expect(R.building.anchor).toBe('timber-hall');   // the meadow kit's own language (STRUCTURE_RAILS)
    const shellers = { ...withInn(MEADOWMARK, { use: 'tavern', civilization: 'shellers' }), civilizations: { ...MEADOWMARK.civilizations, shellers: { anchor: 'shell' } } };
    const S = resolveLevel(shellers, 'the-inn');
    expect(S.building.anchor).toBe('shell');
    expect(buildingStage(S.building)).toMatchObject({ kind: 'stage', kit: 'research-lab', program: { use: 'tavern', civilization: 'shell' } });
  });
});

describe('the runner makes it', () => {
  it('one stage, a create_sketch the level plays: without a hero its first-person walker, with one the hero at the way in', () => {
    const W = withInn(MEADOWMARK), G = readGameworld(W);
    const st = gameStages(W).find((s) => s.level === 'the-inn');
    expect(st).toMatchObject({ node: 'building', section: 'building', index: 0 });
    const plain = stageLevelOrder(G, st, { ref: 'lv_inn' });
    expect(plain.args.manifest).toMatchObject({ kind: 'stage', program: { use: 'tavern' }, level: {} });
    const lowered = withBuildingLevel(plain.args.manifest, 'lv_inn');
    expect(lowered.game.mechanics[0].kind).toBe('reach-exit');
    expect(lowered.entities[0].rule.type).toBe('walk');
    const hero = stageLevelOrder(G, st, { ref: 'lv_inn', heroRef: 'gw-hero' });
    expect(hero.args.manifest.entities[0].id).toBe('hero');
    expect(hero.args.manifest.entities[0].transform.pos).toEqual(plain.ends.spawn);
    // lowered, the hero keeps the controls: the game channel is added, the pilot is not replaced
    const h = withBuildingLevel(hero.args.manifest, 'lv_inn');
    expect(h.entities[0].id).toBe('hero');
    expect(h.game.levelRef).toBe('lv_inn');
  });

  it("in the run: the inn a level step the hero pilots; a building by ref no step, its ref the game's level", () => {
    const S = runSteps(withInn(MEADOWMARK_HERO), { ref: 'gw' });
    const inn = S.find((s) => s.key === 'level-the-inn-0');
    expect(inn.order.manifest.program.use).toBe('tavern');
    expect(S.at(-1).order.levels.map((l) => l.ref)).toContain('gw-level-the-inn-0');
    const R = runSteps(withInn(MEADOWMARK_HERO, { ref: 'sk_tower' }), { ref: 'gw' });
    expect(R.some((s) => s.key === 'level-the-inn-0')).toBe(false);
    expect(R.at(-1).order.levels.map((l) => l.ref)).toContain('sk_tower');
  });

  it('a world without a building level runs the same steps', () => {
    expect(JSON.stringify(runSteps(MEADOWMARK_HERO, { ref: 'gw' }).map((s) => [s.key, s.print]))).toBe(JSON.stringify(runSteps(MEADOWMARK_HERO, { ref: 'gw' }).map((s) => [s.key, s.print])));
    expect(gameStages(MEADOWMARK).some((s) => s.section === 'building')).toBe(false);
  });
});

describe('the bible and the graph draw it', () => {
  it('the bible shows its plan; the graph gives it one section, built by its civilization', () => {
    const W = withInn(MEADOWMARK);
    const html = gameworldBibleHtml(W);
    expect(html).toContain('aria-label="tavern plan"');
    const g = gameworldGraph(W);
    expect(g.nodes.find((n) => n.id === 'section:the-inn/building')).toMatchObject({ kind: 'section', section: 'building' });
    expect(gameworldBibleHtml(withInn(MEADOWMARK, { ref: 'sk_tower' }))).toContain('the building sk_tower, as made');
  });
});
