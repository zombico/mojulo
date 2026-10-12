import { describe, it, expect } from 'vitest';
import { GENRES, QUICK_GENRE, suggestGenres, readIntent, cubeOfWorld, intentReport } from './intent.js';
import { CONCERNS, concernsOf } from './concerns.js';
import { QUICK_GOALS } from './quick.js';
import { FIXTURES } from '../cosmos/fixtures.js';
import { capabilityRegistry } from '../cosmos/registry.js';
import { reviewParts } from './review.js';

// WHAT GAME IT IS: a world says its game as a cosmos cube; a genre is a preset to start from; each cube value raises
// what it asks of the world (concerns), so the levels can be laid for it.

const world = (extra = {}) => ({ id: 'w', levels: { one: { walk: { nodes: { path: { trail: {} } } } } }, ...extra });

describe('the genres and the suggestion', () => {
  it('every cosmos probe is a genre, with the words a brief uses for it; every quick goal with a genre names a real one', () => {
    expect(Object.keys(GENRES)).toEqual(FIXTURES.map((f) => f.id));
    for (const [id, g] of Object.entries(GENRES)) expect(g.words.length, id).toBeGreaterThan(2);
    for (const [goal, id] of Object.entries(QUICK_GENRE)) { expect(QUICK_GOALS[goal], goal).toBeTruthy(); expect(GENRES[id], id).toBeTruthy(); }
  });
  it('a brief\'s words suggest the genres they point at, most first; words for none suggest none', () => {
    expect(suggestGenres('A gritty shooter: rifles, cover and scarce ammo in a ruined valley')[0]).toMatchObject({ id: 'shooter', matched: ['shooter', 'cover', 'ammo'] });
    expect(suggestGenres('a cosy farming game where you plant crops and harvest before the seasons turn').map((g) => g.id)[0]).toBe('farming');
    expect(suggestGenres('race your car through the checkpoints')[0].id).toBe('racing');
    expect(suggestGenres('a quiet painting of a lighthouse')).toEqual([]);
  });
});

describe('reading an intent', () => {
  it('says what is wrong', () => {
    expect(() => readIntent('shooter')).toThrow(/is \{ from\?/);
    expect(() => readIntent({ from: 'golf' })).toThrow(/from is a genre: dungeon-crawler/);
    expect(() => readIntent({ cube: { space: { camera: 'drone' } } })).toThrow(/space.camera has no value 'drone'/);
    expect(() => readIntent({ genre: 'shooter' })).toThrow(/genre is not part of an intent/);
    expect(() => readIntent({ why: 'fun' })).toThrow(/names a genre/);
  });
  it('a world that writes a bad intent is refused when read', async () => {
    const { readGameworld } = await import('./world.js');
    expect(() => readGameworld(world({ intent: { from: 'golf' } }))).toThrow(/intent.from is a genre/);
    expect(() => readGameworld(world({ intent: { from: 'shooter' } }))).not.toThrow();
  });
});

describe('the cube a world is', () => {
  it('its genre\'s cube, what its own settings imply, then its intent\'s own values', () => {
    const C = cubeOfWorld(world({ camera: 'third-person', intent: { from: 'shooter', cube: { mind: { motivation: 'guard' } } } }));
    expect(C.from).toBe('shooter');
    expect(C.cube.space.camera).toBe('third-person');
    expect(C.cube.power.combat).toEqual(['ranged']);
    expect(C.cube.mind.motivation).toBe('guard');
    expect(C.said).toEqual(['mind.motivation']);
  });
  it('a quick game is its goal\'s genre; a ride is a vehicle, a run is runs', () => {
    expect(cubeOfWorld(world({ quick: { goal: 'farm' } })).from).toBe('farming');
    const R = cubeOfWorld(world({ quick: { goal: 'race', ride: 'car', run: 3 } }));
    expect([R.from, R.cube.soul.hero, R.cube.time.progression]).toEqual(['racing', 'vehicle', 'runs']);
  });
  it('a world that says nothing is the cube its settings imply (possibly none)', () => {
    expect(cubeOfWorld(world()).cube).toEqual({});
    expect(cubeOfWorld(world({ topology: 'interconnected' })).cube).toEqual({ space: { topology: 'interconnected' } });
  });
});

describe('the concerns', () => {
  it('every concern is raised by values the cube knows, and every genre raises at least one', () => {
    const reg = capabilityRegistry();
    for (const c of CONCERNS) for (const k of c.when) {
      const [fs, v] = k.split('='), [f, s] = fs.split('.');
      expect(reg[f]?.[s]?.values?.[v], `${c.id}: ${k}`).toBeTruthy();
    }
    for (const f of FIXTURES) expect(concernsOf(f.cube).length, f.id).toBeGreaterThan(0);
  });
  it('raised by value, not by genre: a farm with guns asks what both ask', () => {
    const farm = FIXTURES.find((f) => f.id === 'farming').cube;
    const armed = { ...farm, power: { ...farm.power, combat: ['ranged'] } };
    const ids = concernsOf(armed).map((c) => c.id);
    expect(ids).toContain('fields');
    expect(ids).toContain('cover');
    expect(concernsOf(farm).map((c) => c.id)).not.toContain('cover');
  });
});

describe('the readout and the review', () => {
  it('the report: the cube read, its verdict and concerns; a world that wrote none gets its brief\'s suggestions', () => {
    const R = intentReport(world({ brief: 'a farming game: plant, harvest, sell' }));
    expect(R).toMatchObject({ from: null, written: false, verdict: 'makeable', concerns: [] });
    expect(R.suggest[0].id).toBe('farming');
    const S = intentReport(world({ intent: { from: 'shooter' } }));
    expect(S.written).toBe(true);
    expect(S.suggest).toBeUndefined();
    expect(S.concerns.map((c) => c.id)).toContain('cover');
    expect(S.concerns[0]).not.toHaveProperty('asks');
  });
  it('a written intent is the book\'s first part; a world without one has no such part', () => {
    expect(reviewParts(world({ intent: { from: 'racing' } }))[0]).toMatchObject({ id: 'intent', content: { from: 'racing', concerns: ['circuit', 'drivable'] } });
    expect(reviewParts(world()).map((p) => p.id)).not.toContain('intent');
  });
});

describe('the bible shows it', () => {
  it('what game it is, and what each concern asks, laid or asked only; a world that says nothing shows nothing', async () => {
    const { gameworldBibleHtml } = await import('./bible-html.js');
    const html = gameworldBibleHtml(world({ intent: { from: 'shooter', why: 'tense firefights' } }));
    expect(html).toContain('id="intent"');
    expect(html).toContain('Starts from <b>First-person shooter</b>');
    expect(html).toContain('“tense firefights”');
    expect(html).toMatch(/<b>Cover and sightlines<\/b>[^<]*<span class="muted">\(laid by the world; raised by power.combat=ranged\)/);
    expect(html).toMatch(/<b>Lines of sight to break<\/b>[^<]*<span class="muted">\(asked, not yet laid/);
    expect(gameworldBibleHtml(world())).not.toContain('id="intent"');
  }, 120_000);
});
