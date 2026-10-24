import { describe, it, expect } from 'vitest';
import { GENRES, QUICK_GENRE, suggestGenres, readIntent, cubeOfWorld, intentReport, quickGenre } from './intent.js';
import { CONCERNS, concernsOf } from './concerns.js';
import { QUICK_GOALS, quickWorld } from './quick.js';
import { composeGameworld } from './compose.js';
import { CRAFT } from '../skyscape/eye.js';
import { FIXTURES } from '../cosmos/fixtures.js';
import { capabilityRegistry } from '../cosmos/registry.js';
import { dryRun } from '../cosmos/cosmos.js';
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
    expect(suggestGenres('a superhero who swings between skyscrapers and fights on the rooftops at night')[0].id).toBe('city-stalker');
    // flight's three: a sim, a space shooter, air combat
    expect(suggestGenres('a trench run in a starfighter: blow up the exhaust port of the battle station')[0].id).toBe('space-shooter');
    expect(suggestGenres('a dogfight between fighter jets over the mountains, shoot down the enemy planes')[0].id).toBe('air-combat');
    expect(suggestGenres('fly a glider through ring gates and land on the runway')[0].id).toBe('flight-sim');
    // a fighter's words are not a fighter jet's
    expect(suggestGenres('a street fighter style fighting game: a roster of four, special moves and combos')[0].id).toBe('versus-fighter');
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
  it('a race against rivals is a kart race, on a loop; a track named is the level\'s form', () => {
    const K = cubeOfWorld(world({ quick: { goal: 'race', ride: 'coupe', rivals: 3 } }));
    expect([K.from, K.cube.space.levelForm, K.cube.power.rules]).toEqual(['kart-racer', 'circuit', ['drive', 'racer', 'follow']]);
    expect(cubeOfWorld(world({ quick: { goal: 'race', ride: 'coupe', rivals: 3, track: 'trail' } })).cube.space.levelForm).toBe('trail');
    expect(cubeOfWorld(world({ quick: { goal: 'race', track: 'loop' } })).cube.space.levelForm).toBe('circuit');
    expect(concernsOf(K.cube).map((c) => c.id)).toEqual(expect.arrayContaining(['circuit', 'loop', 'drivable']));
    expect(suggestGenres('a kart racer against rivals round a track')[0].id).toBe('kart-racer');
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
    expect(html).toMatch(/<b>Landmarks at eye level<\/b>[^<]*<span class="muted">\(asked, not yet laid/);
    expect(gameworldBibleHtml(world())).not.toContain('id="intent"');
  }, 120_000);
});

describe('a dogfight\'s genre', () => {
  it('is a space shooter with a space craft, air combat with an atmosphere one, a flight sim when it only flies', () => {
    expect(cubeOfWorld({ quick: { goal: 'shoot', craft: 'fighter' } }).from).toBe('space-shooter');
    expect(cubeOfWorld({ quick: { goal: 'shoot', craft: 'jet' } }).from).toBe('air-combat');
    expect(cubeOfWorld({ quick: { goal: 'fly', craft: 'jet' } }).from).toBe('flight-sim');
    expect(cubeOfWorld({ quick: { goal: 'shoot' } }).from).toBe('shooter');
  });
});

// A TARGET: the engine the game is meant for. Advice only: the readout says what of the cube that engine does not carry,
// as the export's own marks say; nothing is refused or rewritten, and dropping the target drops the advice.
describe('a target', () => {
  // the genres whose cube Roblox carries whole, and those it loses values from (chosen from the catalog, not listed)
  const lossOf = (id) => dryRunOf(id).engines.roblox.lost.length;
  const dryRunOf = (id) => dryRun(cubeOfWorld(world({ intent: { from: id } })).cube);
  const losing = Object.keys(GENRES).find((id) => lossOf(id) > 0);

  it('is an engine with marks, alone or beside a genre; another is refused, naming the engines it can be', () => {
    expect(readIntent({ target: 'roblox' })).toMatchObject({ target: 'roblox', from: null });
    expect(readIntent({ from: losing, target: 'godot' }).target).toBe('godot');
    expect(() => readIntent({ target: 'unity' })).toThrow(/target is an engine.*roblox/);
  });

  it('names what the engine does not carry and what it carries in part, from the same marks the export reads', () => {
    const r = intentReport(world({ intent: { from: losing, target: 'roblox' } }));
    const read = dryRunOf(losing).engines.roblox;
    expect(r.target).toMatchObject({ engine: 'roblox', carries: false, lost: read.lost.map((x) => `${x.facet}.${x.setting}=${x.value}`), partly: read.approximated.map((x) => `${x.facet}.${x.setting}=${x.value}`) });
    expect(r.target.says).toMatch(/do not carry to Roblox.*the choice is the creator's/);
  });

  it('rewrites nothing: the cube is the same with it and without, and without it there is no advice', () => {
    const plain = world({ intent: { from: losing } }), aimed = world({ intent: { from: losing, target: 'roblox' } });
    expect(cubeOfWorld(aimed).cube).toEqual(cubeOfWorld(plain).cube);
    expect(intentReport(plain).target).toBeUndefined();
    expect(intentReport(aimed).verdict).toBe(intentReport(plain).verdict);
  });
});

describe('the intent written on the quick and compose paths', () => {
  // the cube read without the written intent: what the world implied before it was written
  const unwritten = ({ intent: _, ...w }) => cubeOfWorld(w);

  it('a quick game writes the genre its cube is read from, one case per way a goal names it, and the cube is unchanged', () => {
    const craft = (space) => Object.keys(CRAFT).find((k) => !!CRAFT[k].space === space);
    const cases = [
      { goal: Object.keys(QUICK_GENRE)[0] },                            // a goal's own genre
      { goal: 'race', ride: 'coupe', rivals: 3, roadway: 'kart-sprint' }, // rivals make it a kart race
      { goal: 'shoot', craft: craft(true) },                            // a craft makes it a dogfight, in space
      { goal: 'shoot', craft: craft(false) },                           // or in the air
    ];
    for (const q of cases) {
      const W = quickWorld({ id: 'q', quick: q }), genre = quickGenre(W.quick);
      expect(genre, q.goal).toBeTruthy();
      expect(W.intent, q.goal).toEqual({ from: genre });
      expect(cubeOfWorld(W), q.goal).toEqual(unwritten(W));
      expect(intentReport(W).written).toBe(true);
    }
    expect(new Set(cases.map((q) => quickGenre(quickWorld({ id: 'q', quick: q }).quick))).size).toBe(cases.length);
  });

  it('a quick goal with no genre writes none, and an intent the caller wrote is kept as written', () => {
    const bare = Object.keys(QUICK_GOALS).find((g) => !QUICK_GENRE[g] && !['runner', 'fight', 'fly'].includes(g));
    expect(quickWorld({ id: 'q', quick: { goal: bare } }).intent).toBeUndefined();
    const own = { from: 'dungeon-crawler', why: 'mine' };
    expect(quickWorld({ id: 'q', intent: own, quick: { goal: Object.keys(QUICK_GENRE)[0] } }).intent).toEqual(own);
  });

  it('a quick goal patched to read as another genre keeps the written one, and the readout says so', () => {
    const W = quickWorld({ id: 'q', quick: { goal: 'race', ride: 'coupe' } }), patched = { ...W, quick: { ...W.quick, rivals: 3 } };
    expect(intentReport(W).drift).toBeUndefined();
    expect(cubeOfWorld(patched).from).toBe(W.intent.from);
    expect(intentReport(patched).drift).toEqual({ written: W.intent.from, goal: quickGenre(patched.quick) });
  });

  it('a composed world writes the genre its words name clearly, and says which words did', () => {
    const W = composeGameworld({ prompt: 'a dungeon crawler through crypt rooms full of loot', seed: 1 });
    expect(W.intent).toEqual({ from: 'dungeon-crawler' });
    for (const w of ['dungeon', 'crawler', 'loot']) expect(W.brief.read.find((r) => r.word === w)?.decides, w).toContain('intent.from=dungeon-crawler');
    expect(W.brief.unread).not.toContain('crawler');
    expect(composeGameworld({ prompt: 'a dungeon crawler through crypt rooms full of loot', seed: 1 })).toEqual(W);
    expect(reviewParts(W).map((p) => p.id)[0]).toBe('intent');
  });

  it('one word, a tie or no genre words write none: the creator is asked instead', () => {
    for (const prompt of ['misty hills with towers', 'a quiet valley of rolling hills']) {
      const W = composeGameworld({ prompt, seed: 1 });
      expect(W.intent, prompt).toBeUndefined();
    }
    const [a, b] = suggestGenres('stealth guards and a race with cars');
    expect(a.matched.length).toBe(b.matched.length);
    expect(composeGameworld({ prompt: 'stealth guards and a race with cars', seed: 1 }).intent).toBeUndefined();
  });
});
