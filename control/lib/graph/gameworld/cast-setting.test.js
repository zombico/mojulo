// cast-setting.test.js — a game's setting read off what it declares, and the quick figures it names none of rolled in it.
process.env.SQLITE_PATH = ':memory:';
import { describe, it, expect } from 'vitest';
import { settingOfGame, quickFigure, QUICK_FIGURES, ERA_OF_KIT, CLOTHES_RAMPS } from './cast-setting.js';
import { readGameworld } from './world.js';
import { quickWorld, quickRacers } from './quick.js';
import { runSteps } from './runner.js';
import { KITLESS_ERAS } from '../egocube/plan.js';
import { validateHeroSpec } from '@/lib/mcp/tools/layered.js';

const world = (quick, style) => quickWorld({ id: 'w', quick, ...(style ? { style } : {}) });
const read = (W) => readGameworld(W);
// one kit per era the procedure treats apart, chosen from the table: a rustic world, and one with no gear built yet
const RUSTIC = Object.keys(ERA_OF_KIT).find((k) => ERA_OF_KIT[k] === 'rustic' && k !== 'isekai-meadow');
// (a kit a quick game's trail is laid on: the jungle lays its own)
const KITLESS = 'alien-night';
const lawsOf = (steps) => steps.flatMap((s) => s.laws ?? []).filter((l) => l.concern === 'cast');

describe("a game's setting", () => {
  it('reads its tradition, era, genre and colours off the game', () => {
    const W = world({ goal: 'farm' }, { kit: RUSTIC });
    const S = settingOfGame(read(W), W.quick);
    expect(S).toMatchObject({ tradition: 'anime', era: 'rustic', genre: 'farm' });   // a written kit is banded: anime
    expect(S.ramps.length).toBeGreaterThan(1);
    expect(S.ramps.every((r) => CLOTHES_RAMPS.includes(r.name))).toBe(true);
    // a book's direction names the tradition over the world's pole
    expect(settingOfGame({ ...read(W), characters: { direction: { tradition: 'western' } } }).tradition).toBe('western');
    // what the game does not say is left out
    expect(settingOfGame({})).toEqual({});
  });

  it('stands up each figure it names none of, rolled in it, in a body the hero door takes', () => {
    const W = world({ goal: 'defend' }, { kit: RUSTIC }), G = read(W);
    for (const key of Object.keys(QUICK_FIGURES)) {
      const F = quickFigure(G, W.quick, key);
      expect(validateHeroSpec(F.spec)).toEqual([]);
      expect(F).toMatchObject({ toon: { light: true }, spec: { head: 'anime', outfit: { type: 'outfit' } } });
    }
    // the play's facet is kept: a farmhand does not fight
    expect(quickFigure(G, W.quick, 'farmhand').sheet.reads.join(' ')).toMatch(/non-combatant/);
  });

  it('in a world with no gear of its era, leaves the hands empty and says so', () => {
    expect(KITLESS_ERAS).toContain(ERA_OF_KIT[KITLESS]);
    const W = world({ goal: 'sneak' }, { kit: KITLESS });
    const guard = runSteps(W, { ref: 'q' }).find((s) => s.key === 'guard');
    expect(guard.order.spec.gear).toBeUndefined();
    const law = lawsOf(runSteps(W, { ref: 'q' })).find((l) => l.law === 'setting');
    expect(law.holds).toBe(false);
    expect(law.says).toMatch(/no .* weapon yet/);
    expect(runSteps(world({ goal: 'sneak' }, { kit: RUSTIC }), { ref: 'q' }).find((s) => s.key === 'guard').order.spec.gear).toEqual(QUICK_FIGURES.guard.gear);
  });

  it('rolls a role as a pool of its own people: a rank in one uniform, each a face of its own; folk each their own', () => {
    const steps = runSteps(world({ goal: 'sneak', guards: 4 }, { kit: RUSTIC }), { ref: 'q' });
    const guards = steps.filter((s) => /^guard(-\d)?$/.test(s.key));
    expect(guards.map((s) => s.key)).toEqual(['guard', 'guard-2', 'guard-3']);   // never more than the pool
    const [a, ...rest] = guards.map((s) => s.order.spec);
    for (const b of rest) {
      expect(b.outfit).toEqual(a.outfit);
      expect([b.palette.Top, b.palette.Bottom]).toEqual([a.palette.Top, a.palette.Bottom]);
      expect(b.gear).toEqual(a.gear);
    }
    expect(new Set(guards.map((s) => JSON.stringify([s.order.spec.palette.Skin, s.order.spec.cast, s.order.spec.hair]))).size).toBeGreaterThan(1);
    // the level's guards cycle over the pool
    const level = steps.find((s) => s.key.startsWith('level-'));
    expect(new Set(JSON.stringify(level.order).match(/"heroRef":"[^"]+guard[^"]*"/g)).size).toBe(3);
    // farmhands are each their own: no uniform
    const folk = runSteps(world({ goal: 'farm', folk: 2 }, { kit: RUSTIC }), { ref: 'q' }).filter((s) => s.key.startsWith('farmhand'));
    expect(folk).toHaveLength(2);
    expect(folk[0].order.spec.palette.Top === folk[1].order.spec.palette.Top && folk[0].order.spec.palette.Bottom === folk[1].order.spec.palette.Bottom).toBe(false);
  });

  it("a game's own figure is minted as given", () => {
    const own = { cast: 'female', palette: { Top: '#123456' } };
    const steps = runSteps(world({ goal: 'sneak', guard: own }), { ref: 'q' });
    expect(steps.find((s) => s.key === 'guard').order.spec).toEqual(own);
    expect(lawsOf(steps)).toEqual([]);
  });

  it("a deathmatch's bots get a body", () => {
    const steps = runSteps(world({ goal: 'deathmatch' }), { ref: 'q' });
    expect(steps.find((s) => s.key === 'foe')?.order.mint).toMatchObject({ kind: 'layered', via: 'hero' });
  });

  it('an adopted hero drawn in another tradition is kept, and the readout says so', () => {
    const W = world({ goal: 'reach', hero: { ref: 'mine' } });
    const law = lawsOf(runSteps(W, { ref: 'q', lookup: { heroSpec: { cast: 'male' } } })).find((l) => l.law === 'tradition');
    expect(law).toMatchObject({ holds: false, says: expect.stringMatching(/drawn western; the game is anime/) });
    expect(lawsOf(runSteps(W, { ref: 'q', lookup: { heroSpec: { cast: 'male', head: 'anime' } } }))).toEqual([]);
  });

  it("a race's field is rolled in the game's setting, and resolves the same through its recipe", () => {
    const W = world({ goal: 'race', racers: 3 }), S = settingOfGame(read(W), W.quick);
    const F = quickRacers(W.quick, 1, S);
    expect(F.field.every((r) => r.spec.setting?.genre === 'race')).toBe(true);
    expect(quickRacers(W.quick, 1).field.every((r) => r.spec.setting === undefined)).toBe(true);
  });
});
