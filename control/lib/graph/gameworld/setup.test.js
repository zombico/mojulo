import { describe, it, expect } from 'vitest';
import { readSetup, setupPicks, withSetup, DIFFICULTY_TIERS } from './setup.js';
import { worldFlow, flowStoryboard } from './game-flow.js';
import { readGameworld } from './world.js';
import { readFlow } from '../game/flow.js';
import { chaptersOfPath } from './chapters.js';
import { gameworldCards } from './gameworld-cards.js';
import { AI_DIFFICULTY } from '../worlds/controllable-world.js';
import { runSteps, MEADOWMARK_HERO } from './index.js';

// A GAME'S SET-UP: what the player chooses before a level loads, said once on the gameworld and lowered into every
// level's turn. Read and taught; its picks made; asked on each level step of the flow the world plays; shown in the
// storyboard; the flow chapter's.
const WORLD = (more = {}) => ({ id: 'w', seed: 8, levels: { gate: { walk: { nodes: { path: { trail: true } } } } }, ...more });

describe('a game\'s set-up', () => {
  it('its difficulty is the engine\'s tiers, in default words or the game\'s own', () => {
    expect(Object.keys(DIFFICULTY_TIERS)).toEqual(Object.keys(AI_DIFFICULTY));
    expect(readSetup({ difficulty: true })).toEqual([]);
    const [p] = setupPicks({ difficulty: true });
    expect(p).toMatchObject({ id: 'difficulty', ask: 'Choose a difficulty' });
    expect(p.from.options.map((o) => o.id)).toEqual(['easy', 'medium', 'max']);
    expect(p.from.options[1]).toEqual({ id: 'medium', ...DIFFICULTY_TIERS.medium });
    const own = setupPicks({ difficulty: { ask: 'How cruel?', options: ['easy', { id: 'max', name: 'Merciless' }] } })[0];
    expect(own.ask).toBe('How cruel?');
    expect(own.from.options).toEqual([{ id: 'easy', ...DIFFICULTY_TIERS.easy }, { id: 'max', name: 'Merciless', about: DIFFICULTY_TIERS.max.about }]);
  });
  it('each fault is taught', () => {
    const bad = (s) => readSetup(s).join('\n');
    expect(bad('hard')).toMatch(/what the player chooses before a level loads/);
    expect(bad({})).toMatch(/asks something/);
    expect(bad({ loadout: true })).toMatch(/a set-up takes difficulty, picks/);
    expect(bad({ difficulty: { options: ['easy', 'brutal'] } })).toMatch(/the engine's tiers, each once: easy, medium, max/);
    expect(bad({ difficulty: { options: ['easy'] } })).toMatch(/two or more/);
    expect(bad({ picks: [{ id: 'squad', from: { slice: 'party' }, seats: 2 }] })).toMatch(/setup\.picks\[0\]\.seats: a pick takes/);
    expect(bad({ difficulty: true, picks: [{ id: 'difficulty', from: { options: ['a', 'b'] } }] })).toMatch(/the set-up's own pick/);
  });
  it('is asked on every level step that asks nothing of its own, the difficulty first', () => {
    const squad = { id: 'squad', from: { slice: 'party' }, max: 2 }, mine = [{ id: 'kit', from: { options: ['bow', 'blade'] } }];
    const flow = { start: 'a', steps: { a: { kind: 'level', level: 'gate', on: { won: 'b' } }, b: { kind: 'level', level: 'gate', on: { won: 'a' }, picks: mine }, t: { kind: 'screen', screen: 'title', on: { play: 'a' } } } };
    const F = withSetup(flow, { difficulty: true, picks: [squad] });
    expect(F.steps.a.picks.map((p) => p.id)).toEqual(['difficulty', 'squad']);
    expect(F.steps.b.picks).toBe(mine);
    expect(F.steps.t).toBe(flow.steps.t);
    expect(withSetup(flow, undefined)).toBe(flow);
  });
  it('a world says it, is taught its faults, and plays the default flow with it; the storyboard says what each level asks', () => {
    expect(() => readGameworld(WORLD({ setup: { difficulty: 'hard' } }))).toThrow(/gameworld: setup\.difficulty is true/);
    const G = readGameworld(WORLD({ setup: { difficulty: true } }));
    expect(G.setup).toEqual({ difficulty: true });
    const F = worldFlow(G);
    expect(F.source).toBe('default');
    expect(readFlow(F.flow, { levels: G.ids })).toEqual([]);
    const level = flowStoryboard(F.flow).find((r) => r.kind === 'level');
    expect(level.asks).toEqual(['difficulty']);
    // a world that says none says no flow for it
    expect(worldFlow(readGameworld(WORLD()))).toBe(null);
  });
  it('the run hands the game its flow with the set-up on its level steps; a world with none hands the game it did', () => {
    const game = (w) => runSteps(w, { ref: 'gw' }).find((s) => s.key === 'game').order;
    const made = game({ ...MEADOWMARK_HERO, setup: { difficulty: true } }), plain = game(MEADOWMARK_HERO);
    const levelSteps = Object.values(made.flow.steps).filter((s) => s.kind === 'level');
    expect(levelSteps.length).toBeGreaterThan(0);
    for (const s of levelSteps) expect(s.picks.map((p) => p.id)).toEqual(['difficulty']);
    const { flow: _f, ...rest } = made;
    // (but for the flow, and the flow the plain world had if any, the same order)
    expect({ ...rest, ...(plain.flow ? { flow: plain.flow } : {}) }).toEqual(plain);
  });
  it('is the flow chapter\'s, and its card teaches it', () => {
    expect(chaptersOfPath('/setup').map((c) => c.id)).toContain('flow');
    expect(gameworldCards().get('gameworld-flow').body).toMatch(/setup: \{ difficulty\?: true \| \{ ask\?, hint\?, options\?: \[easy \| medium \| max/);
  });
});
