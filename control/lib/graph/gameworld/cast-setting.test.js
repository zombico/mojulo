// cast-setting.test.js — a game's setting read off what it declares, and the quick figures it names none of rolled in it.
process.env.SQLITE_PATH = ':memory:';
import { describe, it, expect } from 'vitest';
import { settingOfGame, quickFigure, QUICK_FIGURES, ERA_OF_KIT, CLOTHES_RAMPS } from './cast-setting.js';
import { readGameworld } from './world.js';
import { quickWorld, quickRacers } from './quick.js';
import { runSteps } from './runner.js';
import { KIT_ERAS } from '../egocube/plan.js';
import { readSetting, tuningOf, leanOf } from '../egocube/setting.js';
import { rollEgocube } from '../egocube/egocube.js';
import { ERA_LOOKS } from '../egocube/outfit.js';
import { FIREARM_ITEMS } from '../equipment/firearm.js';
import { validateHeroSpec } from '@/lib/mcp/tools/layered.js';

const world = (quick, style) => quickWorld({ id: 'w', quick, ...(style ? { style } : {}) });
const read = (W) => readGameworld(W);
// one kit per era the procedure treats apart, chosen from the table: a rustic world, and a future one (its era's kit)
const RUSTIC = Object.keys(ERA_OF_KIT).find((k) => ERA_OF_KIT[k] === 'rustic' && k !== 'isekai-meadow');
// (a kit a quick game's trail is laid on: the jungle lays its own)
const FUTURE = 'alien-night';
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
      // (a role with a kit of its own, the athlete, wears it whatever the world's underlayer: on the authored body, painted)
      expect(F).toMatchObject({ toon: { light: true }, spec: { head: 'anime', ...(QUICK_FIGURES[key].kit ? { detail: 'swimsuit', paint: QUICK_FIGURES[key].kit.paint } : { outfit: { type: 'outfit' } }) } });
    }
    // the play's facet is kept: a farmhand does not fight
    expect(quickFigure(G, W.quick, 'farmhand').sheet.reads.join(' ')).toMatch(/non-combatant/);
  });

  it('arms and kits a modern or future world\'s people in its era: its firearms in its card, its role\'s pieces over the underlayer', () => {
    expect(KIT_ERAS).toContain(ERA_OF_KIT[FUTURE]);
    const W = world({ goal: 'sneak' }, { kit: FUTURE });
    const guard = runSteps(W, { ref: 'q' }).find((s) => s.key === 'guard');
    expect(guard.order.spec.gear).toEqual(QUICK_FIGURES.guard.era.future);
    expect(Object.values(guard.order.spec.gear).every((g) => FIREARM_ITEMS.includes(g.item) && g.style === 'future')).toBe(true);
    // dressed as its rolled look (the era's wardrobe, not the kit's underlayer)
    expect(Object.values(ERA_LOOKS.future).map((L) => L.style)).toContain(guard.order.spec.outfit.style);
    expect(validateHeroSpec(guard.order.spec)).toEqual([]);
    const law = lawsOf(runSteps(W, { ref: 'q' })).find((l) => l.law === 'setting');
    expect(law.says ?? '').not.toMatch(/yet/);
    // a rustic world keeps the myth's
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

describe('the setting read right, and the fighters rolled in it', () => {
  it('a palette or a look on a kit keeps the stock kit\'s era and pole; the clothes take the recoloured ramps', () => {
    for (const kit of Object.keys(ERA_OF_KIT).filter((k) => ['isekai-sakura', 'alien-night', 'isekai-bamboo'].includes(k))) {
      const own = settingOfGame(read(world({ goal: 'reach' }, { kit })));
      const painted = settingOfGame(read(world({ goal: 'reach' }, { kit, palette: { seed: 5 } })));
      expect(painted).toMatchObject({ era: own.era, tradition: own.tradition });
      expect(painted.ramps).not.toEqual(own.ramps);
      const worded = settingOfGame(read(world({ goal: 'reach' }, { kit, look: { intent: 'rust red rocks and pale grass' } })));
      expect(worded).toMatchObject({ era: own.era, tradition: own.tradition });
    }
  });

  it('the fight genre: a fighter is always a person, never a bystander or a child', () => {
    const S = readSetting({ genre: 'fight' });
    for (let seed = 1; seed <= 200; seed++) expect(tuningOf(S, seed, `fighter-${seed}`)).toBe('person');
    const lean = leanOf(S, 'person');
    expect(lean.role['non-combatant']).toBe(0);
    expect(lean.age.child).toBe(0);
  });

  it('a fight game\'s fighters are rolled in its setting; a roster\'s named facets win', () => {
    for (const kit of ['isekai-sakura', 'alien-night']) {
      const W = world({ goal: 'fight', roster: ['hero', { id: 'bear', role: 'frontline', build: 'brute', style: 'grappler' }] }, { kit });
      const setting = settingOfGame(read(W), W.quick), sheets = runSteps(W, { ref: 'gw' }).filter((s) => s.key.endsWith('-sheet'));
      expect(setting).toMatchObject({ genre: 'fight', era: ERA_OF_KIT[kit] });
      for (const s of sheets) expect(s.order.manifest.roll.setting).toEqual(setting);
      const bear = rollEgocube(sheets[1].order.manifest.roll);
      expect(bear.facets).toMatchObject({ role: 'frontline', build: 'brute' });
      expect(bear.ancestry.door).toBe('hero');
    }
    // every default fighter over many worlds rolls a person in its setting (the runner throws on any other body)
    for (let seed = 1; seed <= 40; seed++) {
      const steps = runSteps({ ...world({ goal: 'fight' }, { kit: 'alien-night' }), seed }, { ref: `gw${seed}` });
      for (const s of steps.filter((x) => x.key.endsWith('-sheet'))) expect(rollEgocube(s.order.manifest.roll).ancestry.door).toBe('hero');
    }
  });
});
