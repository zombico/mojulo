import { describe, it, expect } from 'vitest';
import { compileCheck, planError, stepSeconds, STEP_SECONDS } from './design-game-check.js';
import { runSteps, MEADOWMARK_HERO } from '@/lib/graph/gameworld/index';
import { quickWorld } from '@/lib/graph/gameworld/quick.js';
import { composeGameworld } from '@/lib/graph/gameworld/compose.js';

// The pre-compile check (machine gate, advice): a run's plan read order by order as each door would read it, before
// anything is made. One plan per procedure that lays its own orders (the book with a hero, a world from words, a
// quick game's figures), each checked clean; then each kind of refusal planted in an otherwise sound plan.

const AUTO = { ...MEADOWMARK_HERO, mode: 'autonomous', review: undefined };
const plans = {
  book: runSteps(AUTO, { ref: 'gw' }),
  words: runSteps(composeGameworld({ prompt: 'a dungeon crawler through haunted crypts with relics and a boss', seed: 1 }), { ref: 'gw' }),
  sneak: runSteps(quickWorld({ id: 'q', quick: { goal: 'sneak' } }), { ref: 'gw' }),
};
const makeAll = (S) => Object.fromEntries(S.map((s) => [s.key, 'make']));
const edit = (S, key, f) => S.map((s) => (s.key === key ? f(structuredClone(s)) : s));

describe('the pre-compile check', () => {
  it('a sound plan is ready: nothing blocks, every order as its door would take it', () => {
    for (const [n, S] of Object.entries(plans)) {
      const c = compileCheck(S, { actions: makeAll(S) });
      expect(c, n).toMatchObject({ gate: 'machine', ready: true, steps: S.length, make: S.length, waiting: 0 });
      expect(c.blockers, n).toBeUndefined();
    }
  });

  it('says each refusal the run would meet, on the chapter it belongs to, and refuses nothing itself', () => {
    const S = plans.book;
    const level = S.find((s) => s.key.startsWith('level-')).key;
    // a hero-door order the door would refuse (its cast is no cast)
    const hero = compileCheck(edit(S, 'hero', (s) => { s.order.mint.spec.cast = 'no-such-cast'; return s; }));
    expect(hero.ready).toBe(false);
    expect(hero.blockers[0]).toMatchObject({ chapter: 'hero', step: 'hero', says: expect.stringMatching(/^the hero door would refuse: .*no-such-cast/) });
    // a level standing a body nothing draws
    const body = compileCheck(edit(S, level, (s) => { s.order.manifest.entities = [...(s.order.manifest.entities ?? []), { id: 'ghost', body: { type: 'nothing-draws-this' } }]; return s; }));
    expect(body.blockers).toEqual([expect.objectContaining({ chapter: 'levels', step: level, says: expect.stringMatching(/world door would refuse: entity 'ghost'/) })]);
    // a level that names a sketch no step makes and none is stored
    const ref = compileCheck(edit(S, level, (s) => { s.order.manifest.figures = { ...s.order.manifest.figures, hero: { heroRef: 'gw-nobody' } }; return s; }));
    expect(ref.blockers).toEqual([expect.objectContaining({ chapter: 'levels', says: "names 'gw-nobody', which no step makes and no sketch is" })]);
    // ... unless it is stored
    expect(compileCheck(edit(S, level, (s) => { s.order.manifest.figures = { ...s.order.manifest.figures, hero: { heroRef: 'gw-nobody' } }; return s; }), { row: (r) => (r === 'gw-nobody' ? { ref: r, manifest: {} } : null) }).ready).toBe(true);
    // the game create_game would refuse: a level of it the plan does not make
    const game = compileCheck(edit(S, 'game', (s) => { s.order.levels = [...s.order.levels, { ref: 'gw-lost-level' }]; return s; }));
    expect(game.blockers.some((b) => b.chapter === 'build' && b.step === 'game' && /create_game would refuse: .*gw-lost-level/.test(b.says))).toBe(true);
    // an adopted hero with no row
    const adopted = runSteps({ ...AUTO, characters: { ...AUTO.characters, hero: { ...AUTO.characters.hero, ref: 'nobody-here' } } }, { ref: 'gw' });
    expect(compileCheck(adopted).blockers).toEqual([expect.objectContaining({ chapter: 'hero', step: 'hero', says: expect.stringMatching(/adopted hero 'nobody-here' is no sketch/) })]);
  });

  it('a plan the reader refuses is said on the chapter its field is', () => {
    expect(planError('gameworld: feel.pole is one of a, b')).toEqual({ chapter: 'feel', says: 'gameworld: feel.pole is one of a, b' });
    expect(planError('gameworld: characters.hero.looks.hair is …').chapter).toBe('hero');
    expect(planError('something else').chapter).toBe('intent');
  });

  it('prices the build left (made now and waiting on approvals), divided by the run\'s budget; nothing left, nothing priced', () => {
    const S = plans.sneak;
    const all = S.reduce((n, s) => n + stepSeconds(s.key), 0);
    expect(compileCheck(S, { actions: makeAll(S), budgetMs: 1000 }).estimate).toEqual({ seconds: Math.round(all), calls: Math.ceil(all) });
    const waiting = compileCheck(S, { actions: Object.fromEntries(S.map((s) => [s.key, 'waiting'])), budgetMs: 0 });
    expect(waiting).toMatchObject({ make: 0, waiting: S.length, estimate: { seconds: Math.round(all), calls: 1 } });
    expect(compileCheck(S, { actions: Object.fromEntries(S.map((s) => [s.key, 'keep'])) }).estimate).toEqual({ seconds: 0, calls: 0 });
    // a walk is the costly step, a level next, a figure next
    expect(stepSeconds('audit-level-a-0')).toBe(STEP_SECONDS.walk);
    expect(stepSeconds('level-a-0')).toBeGreaterThan(stepSeconds('hero'));
    expect(stepSeconds('guard-2')).toBe(STEP_SECONDS.figure);
  });
});
