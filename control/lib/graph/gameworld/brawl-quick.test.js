// A WORLD THAT IS A BRAWLER (quick goal `brawl`, quick.js; runner.js): its players made as a fight's are, its streets
// its levels (each a brawl level with its waves and the hosted level's contract), the game in the play shell.
import { describe, it, expect } from 'vitest';
import { quickWorld, brawlStreets, defaultWaves, BRAWL_STREET, QUICK_GOALS } from './quick.js';
import { runSteps } from './runner.js';
import { brawlPreset } from '../brawl/brawl-levels.js';
import { GENRES } from '../egocube/setting.js';

const ME = { archetype: 'hero', style: 'all-rounder' };
const world = (quick) => quickWorld({ id: 'w', name: 'Brawl', quick: { goal: 'brawl', ...quick } });

describe('the goal, read', () => {
  it('is a quick goal with a genre its players are rolled in', () => { expect(QUICK_GOALS.brawl).toBeTruthy(); expect(GENRES.brawl).toBeTruthy(); });
  it('takes a roster and streets; another goal\'s words are refused, and a street\'s fault is said', () => {
    expect(() => world({ roster: [ME] })).not.toThrow();
    expect(() => world({ arenas: [{ id: 'a' }] })).toThrow(/fight goal|brawl takes/);
    expect(() => quickWorld({ id: 'w', quick: { goal: 'reach', streets: [BRAWL_STREET] } })).toThrow(/brawl goal/);
    expect(() => world({ streets: [{ id: 's', waves: [{ screen: 0, crowd: [{ type: 'thug', n: 1 }] }] }] })).toThrow(/not held/);
    expect(() => world({ camera: 'top-down' })).toThrow(/side/);
  });
});

describe('its streets', () => {
  it('unsaid: one greybox street, a crowd a held screen growing, a boss on the boss\'s screen', () => {
    const belt = brawlPreset('street').belt, W = defaultWaves(belt);
    const held = belt.screens.map((s, i) => (s.gate || s.boss ? i : -1)).filter((i) => i >= 0);
    expect(W.map((w) => w.screen)).toEqual(held);
    const sizes = W.filter((w) => !w.boss).map((w) => w.crowd.reduce((n, c) => n + c.n, 0));
    for (let k = 1; k < sizes.length; k++) expect(sizes[k]).toBeGreaterThan(sizes[k - 1]);
    expect(W[W.length - 1].boss).toBeTruthy();
  });
  it('each is a level the shell can host: the street on its brawl block, the level\'s contract beside it', () => {
    const [S] = brawlStreets({ goal: 'brawl' }, { title: 'Brawl' });
    expect(S.manifest.brawl.street.waves.length).toBeGreaterThan(0);
    expect(S.manifest.game).toMatchObject({ levelRef: 'street', produces: { results: ['success', 'fail'] } });
  });
});

describe('the run', () => {
  const steps = runSteps(world({ roster: [ME] }), { ref: 'gw' }), keys = steps.map((s) => s.key);
  it('makes each player a character, then each street, then the game', () => {
    expect(keys).toEqual(['fighter-fighter-1-sheet', 'fighter-fighter-1', 'level-street-street', 'game']);
  });
  it('the street\'s roster is the characters made; the game runs the streets in the play shell, in a look', () => {
    const street = steps.find((s) => s.key === 'level-street-street').order.manifest.brawl.street;
    expect(street.roster[0].hero.ref).toBe(steps.find((s) => s.key === 'fighter-fighter-1').ref);
    const game = steps.find((s) => s.key === 'game').order;
    expect(game).toMatchObject({ shell: 'play', levels: [{ ref: steps.find((s) => s.key === 'level-street-street').ref }] });
    expect(game.ui.theme).toBeTruthy();
    expect(game.engine).toBeUndefined();
  });
});
