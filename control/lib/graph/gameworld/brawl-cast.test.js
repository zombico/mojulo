import { describe, it, expect } from 'vitest';
import { brawlPlay, brawlCast, brawlBodies, withBodies, readBrawlWaves, BRAWL_PLAYS, brawlStreet, readStreet, withStreetBodies, STREET } from './brawl-cast.js';
import { readBelt } from '../brawl/brawl-belt.js';
import { readLevelStreet, streetFoeIds, streetLevel, STREET_UNSAID } from './brawl-cast.js';
import { readGameworld } from './world.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { fieldedIds } from './foes.js';
import { readWaves } from '../brawl/brawl-crowd.js';
import { FOE_CLASSES } from '../foes/index.js';
import { CROWD_TYPES } from '../brawl/brawl-crowd.js';
import { practiceOf } from '../brawl/brawl-practice.js';
import { brawlPreset } from '../brawl/brawl-levels.js';
import { brawlYardData } from '../brawl/brawl-page.js';
import { solveFighter } from '../versus/versus-solver.js';

// A BRAWL'S CAST: the street's crowd is the game's own bestiary. A wave is written by role or foe id; each foe fights
// as what it is (its class a crowd type, its rank over it); a foe skinned as a person is drawn in its own body.
const G = { foes: {
  goon: { class: 'walker', skin: { people: 'goblin' } },
  slinger: { class: 'hunter', skin: { people: 'goblin' } },
  hound: { class: 'charger' },
  warlord: { class: 'brute', rank: 'boss', skin: { people: 'orc' } },
} };

describe('a brawl\'s cast', () => {
  it('every foe class has a play, and each is a crowd type the street knows', () => {
    for (const c of Object.keys(FOE_CLASSES)) expect(CROWD_TYPES[BRAWL_PLAYS[c]], c).toBeDefined();
  });

  it('a foe fights as what it is: its class, its rank over it; on a run & gun everyone carries a gun', () => {
    expect(brawlPlay(G.foes.goon)).toBe('thug');
    expect(brawlPlay({ class: 'walker', rank: 'elite' })).toBe('charger');
    expect(brawlPlay(G.foes.warlord)).toBe('heavy');
    expect(brawlPlay(G.foes.slinger)).toBe('gunner');
    for (const e of Object.values(G.foes)) expect(CROWD_TYPES[brawlPlay(e, { gun: true })].gun, e.class).toBeDefined();
    expect(brawlPlay(G.foes.warlord, { gun: true })).toBe('bazooka');
  });

  it('waves are written by role or by foe id, read against the bestiary; a word it does not hold is refused', () => {
    const C = brawlCast(G, [{ grunt: 2 }, { foes: { hound: 1, shooter: 1 }, formation: 'pincer', name: 'the yard' }, { boss: 1 }]);
    expect(C.foes).toEqual(['goon', 'hound', 'slinger', 'warlord']);
    expect(C.waves[0].crowd).toEqual([{ type: 'thug', n: 2, foe: 'goon' }]);
    expect(C.waves[1]).toMatchObject({ formation: 'pincer', name: 'the yard', crowd: [{ type: 'charger', n: 1, foe: 'hound' }, { type: 'gunner', n: 1, foe: 'slinger' }] });
    expect(C.waves[2].crowd[0]).toMatchObject({ type: 'heavy', foe: 'warlord' });
    expect(() => brawlCast(G, [{ nobody: 1 }])).toThrow(/a role .* or one of the bestiary/);
    expect(() => readBrawlWaves([{ grunt: 9 }])).toThrow(/1 to 8/);
    // (the creator's own play for a foe wins over the read)
    expect(brawlCast(G, [{ grunt: 1 }], { plays: { goon: 'knife' } }).waves[0].crowd[0].type).toBe('knife');
    expect(() => brawlCast(G, [{ grunt: 1 }], { plays: { goon: 'dragon' } })).toThrow(/plays\.goon/);
  });

  it('a person has a body on the street; a beast is said to be drawn as a figure, never dropped', () => {
    const C = brawlCast(G, [{ grunt: 1, hound: 1 }]);
    expect(brawlBodies(G, C)).toEqual({ goon: true, hound: false });
    expect(C.says).toHaveLength(1);
    expect(C.says[0]).toMatch(/^hound is drawn as a jointed figure/);
    expect(withBodies(C.waves, { goon: 2 })[0].crowd).toEqual([{ type: 'thug', n: 1, roster: 2 }, { type: 'charger', n: 1 }]);
  });

  it('the page draws a wave\'s bodies from the roster it names; a brawl with no cast is as it was', () => {
    const { belt } = brawlPreset('yard');
    const recipe = { ...solveFighter({ id: 'hero', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' };
    const room = (crowd) => practiceOf({ belt, players: [{ recipe }], dummies: [], waves: [{ crowd }], loop: false });
    expect(room([{ type: 'thug', n: 2, roster: 1 }, { type: 'heavy', n: 1 }]).yard.cast).toEqual([1, 1, null]);
    expect(room([{ type: 'thug', n: 2 }]).yard.cast).toBeUndefined();
    const block = (crowd, playable) => ({ belt, practice: { roster: [{ archetype: 'all-rounder' }, { archetype: 'grappler' }], players: [0], dummies: [], waves: [{ crowd }], ...(playable ? { playable } : {}) } });
    expect(brawlYardData(block([{ type: 'thug', n: 1, roster: 1 }], 1))).toMatchObject({ playable: 1 });
    expect(brawlYardData(block([{ type: 'thug', n: 1 }])).playable).toBeUndefined();
    expect(() => brawlYardData(block([{ type: 'thug', n: 1, roster: 5 }]))).toThrow(/the roster holds 2/);
  });
});

// THE STREET: the level design's page. A free first screen, then its stops (each held until its wave falls), then its
// boss's screen; the waves are the cast's, and what the design leaves thin is said, never refused.
describe('a brawl\'s street', () => {
  const street = { stops: [{ wave: { grunt: 2 }, name: 'the alley mouth' }, { wave: { grunt: 2, shooter: 1 }, length: 20 }], boss: { foe: 'warlord', with: { grunt: 1 }, hp: 900 } };
  it('is a free screen, a held screen a stop, and the boss\'s last: a belt and waves the street\'s sim takes', () => {
    const S = brawlStreet(G, street);
    expect(S.screens).toEqual([{ length: STREET.open }, { length: STREET.stop, gate: true }, { length: 20, gate: true }, { length: STREET.stop, boss: true }]);
    expect(S.waves.map((w) => w.screen)).toEqual([1, 2, 3]);
    expect(S.waves[0]).toMatchObject({ name: 'the alley mouth', crowd: [{ type: 'thug', n: 2, foe: 'goon' }] });
    expect(S.waves[2]).toMatchObject({ crowd: [{ type: 'thug', n: 1, foe: 'goon' }], boss: { foe: 'warlord', hp: 900 } });
    expect(S.boss).toBe('warlord');
    expect(S.foes).toEqual(['goon', 'slinger', 'warlord']);
    // (the sim reads them: its gates hold a wave each, its boss stands on the boss's screen)
    const belt = readBelt({ at: [0, 0], heading: 0, depth: [-2.5, 2.5], angle: 'classic', screens: S.screens }, 'belt');
    const page = withStreetBodies(S.waves, { goon: 1, warlord: 3 }).map((w) => (w.boss ? { ...w, boss: { ...w.boss, recipe: { id: 'w', archetype: 'grappler' } } } : w));
    expect(page[0].crowd).toEqual([{ type: 'thug', n: 2, roster: 1 }]);
    expect(page[2].boss).toMatchObject({ fighter: 3, hp: 900 });
    expect(() => readWaves(page.map(({ name: _n, ...w }) => w), belt)).not.toThrow();
  });

  it('a boss by its role; a boss with no body is stood in by a fighter, and said', () => {
    expect(brawlStreet(G, { stops: [{ wave: { grunt: 1 } }], boss: 'boss' }).boss).toBe('warlord');
    const S = brawlStreet(G, { stops: [{ wave: { grunt: 1 } }], boss: 'hound' });
    expect(S.says.some((x) => /^hound is drawn as a jointed figure/.test(x))).toBe(true);
    expect(withStreetBodies(S.waves, { goon: 1 })[1].boss).toMatchObject({ archetype: 'grappler', name: 'hound' });
  });

  it('a boss\'s stages: how many (each a level harder) or each written, who a stage calls cast as a wave is', () => {
    const counted = brawlStreet(G, { stops: [{ wave: { grunt: 1 } }], boss: { foe: 'warlord', cpu: 'novice', stages: 3 } }).waves.at(-1);
    expect(counted.boss.stages).toEqual([{ cpu: 'novice' }, { cpu: 'regular' }, { cpu: 'veteran' }]);
    const written = brawlStreet(G, { stops: [{ wave: { grunt: 1 } }], boss: { foe: 'warlord', with: { grunt: 1 }, stages: [{}, { at: 0.5, name: 'Enraged', calls: { goon: 2, shooter: 1 } }] } }).waves.at(-1);
    expect(written.boss.stages).toEqual([{}, { at: 0.5, name: 'Enraged' }]);
    expect(written.crowd).toEqual([{ type: 'thug', n: 1, foe: 'goon' }, { type: 'thug', n: 2, foe: 'goon', stage: 1 }, { type: 'gunner', n: 1, foe: 'slinger', stage: 1 }]);
    // (the page takes them: the called bodies keep their stage and their bodies)
    expect(withStreetBodies([written], { goon: 1 })[0].crowd[1]).toEqual({ type: 'thug', n: 2, stage: 1, roster: 1 });
    expect(() => readStreet({ stops: [{ wave: { grunt: 1 } }], boss: { foe: 'boss', stages: 1 } })).toThrow(/2 to 5/);
    expect(() => readStreet({ stops: [{ wave: { grunt: 1 } }], boss: { foe: 'boss', stages: [{ calls: { grunt: 1 } }, {}] } })).toThrow(/its first stage calls none/);
    expect(() => readStreet({ stops: [{ wave: { grunt: 1 } }], boss: { foe: 'boss', stages: [{}, { hp: 3 }] } })).toThrow(/not a stage's word/);
  });

  it('advises, never refuses: a street with no boss, a stop that meets fewer than the one before', () => {
    const S = brawlStreet(G, { stops: [{ wave: { grunt: 3 } }, { wave: { grunt: 1 } }] });
    expect(S.boss).toBeNull();
    expect(S.screens).toHaveLength(3);
    expect(S.says).toEqual(expect.arrayContaining([expect.stringMatching(/names no boss/), expect.stringMatching(/stop 2 meets 1, fewer than the 3 before it/)]));
  });

  it('its words are checked: its stops, its lengths, its boss', () => {
    expect(() => readStreet({ stops: [] })).toThrow(/stops is where the street holds/);
    expect(() => readStreet({ stops: [{ wave: { grunt: 1 }, length: 2 }] })).toThrow(/8 to 48 m/);
    expect(() => readStreet({ stops: [{ wave: { grunt: 1 } }], boss: { hp: 5 } })).toThrow(/street\.boss is/);
    expect(() => brawlStreet(G, { stops: [{ wave: { grunt: 1 } }], boss: 'nobody' })).toThrow(/street\.boss: a role/);
  });
});

// A STREET AS A LEVEL of a designed game: a level says it is a street, the world's bestiary is its crowd, the game's
// hero and its made foes its bodies; the run makes it as it makes any level.
describe('a street as a level of a designed game', () => {
  const street = { stops: [{ wave: { grunt: 2 } }, { wave: { grunt: 3 } }], boss: 'warlord' };
  const W = { id: 'row', name: 'Row', mode: 'autonomous', foes: G.foes, levels: { row: { name: 'The Row', street } } };

  it('the level\'s own words sit beside the design: its kit, its lives, its guns', () => {
    // (the falls unsaid are the tuning card's to give, brawl/brawl-tunings.js: the level reads none)
    expect(readLevelStreet(street)).toMatchObject({ kit: STREET.kit, lives: null, guns: null, tuning: null });
    expect(readLevelStreet({ ...street, kit: 'gothic-stone', lives: 5, guns: ['spread'] })).toMatchObject({ kit: 'gothic-stone', lives: 5, guns: ['spread'], design: street });
    expect(() => readLevelStreet({ ...street, kit: 'nowhere' })).toThrow(/street\.kit/);
    expect(() => readLevelStreet({ ...street, lives: 0 })).toThrow(/street\.lives/);
  });

  it('the world reads it: the street alone on its level, its stops read against the bestiary', () => {
    const R = readGameworld(W);
    expect(R.levels.row.street).toEqual(street);
    expect(() => readGameworld({ ...W, levels: { row: { street, walk: { nodes: { a: { trail: {} } } } } } })).toThrow(/a street level is the street alone/);
    expect(() => readGameworld({ ...W, levels: { row: { street: { stops: [{ wave: { nobody: 1 } }] } } } })).toThrow(/levels\.row/);
    // (its foes are fielded: each one a figure the run makes)
    expect(streetFoeIds(R)).toEqual(['goon', 'warlord']);
    expect(fieldedIds(R)).toEqual(expect.arrayContaining(['goon', 'warlord']));
  });

  it('is one stage, and its level is laid on the game\'s hero and its made foes', () => {
    const R = readGameworld(W), stages = gameStages(R);
    expect(stages).toHaveLength(1);
    expect(stages[0]).toMatchObject({ level: 'row', section: 'street', manifest: { kind: 'stage', game: { produces: { results: ['success', 'fail'] } } } });
    const L = stageLevelOrder(R, stages[0], { ref: 'gw-level-row-0', heroRef: 'gw-hero', foeRefs: { goon: 'gw-foes-goon', warlord: 'gw-foes-warlord' } });
    const P = L.args.manifest.brawl.practice;
    expect(L.args.manifest.game.levelRef).toBe('gw-level-row-0');
    expect(P.roster).toEqual([{ id: 'hero', hero: { ref: 'gw-hero' } }, { id: 'foe-goon', name: 'goon', hero: { ref: 'gw-foes-goon' } }, { id: 'foe-warlord', name: 'warlord', hero: { ref: 'gw-foes-warlord' } }]);
    expect(P).toMatchObject({ playable: 1, players: [0], stakes: STREET.lives });
    expect(P.street.waves.at(-1).boss).toMatchObject({ fighter: 2 });
    expect(L.laws[0]).toMatchObject({ concern: 'cast', law: 'street', holds: true });
  });

  it('up to four play: the hero and the cast who join take the seats; a seat nobody fills is a stand-in, said', () => {
    const party = [{ id: 'ally', ref: 'gw-cast-ally', name: 'Ally' }, { id: 'kid', ref: 'gw-cast-kid' }];
    const three = streetLevel(G, { ...street, players: 3 }, { heroRef: 'gw-hero', party }).manifest.brawl.practice;
    expect(three.roster.slice(0, 3)).toEqual([{ id: 'hero', hero: { ref: 'gw-hero' } }, { id: 'ally', name: 'Ally', hero: { ref: 'gw-cast-ally' } }, { id: 'kid', name: 'kid', hero: { ref: 'gw-cast-kid' } }]);
    expect(three).toMatchObject({ players: [0, 1, 2], playable: 3 });
    // (one plays from the start, the others who have bodies can drop in)
    expect(streetLevel(G, street, { heroRef: 'gw-hero', party }).manifest.brawl.practice).toMatchObject({ players: [0], playable: 3 });
    const four = streetLevel(G, { ...street, players: 4 }, { heroRef: 'gw-hero', party });
    expect(four.manifest.brawl.practice.roster[3]).toMatchObject({ id: 'stand-in-4', archetype: 'grappler' });
    expect(four.manifest.brawl.practice).toMatchObject({ players: [0, 1, 2, 3], playable: 4 });
    expect(four.laws[0].says).toMatch(/1 of its 4 seats is a stand-in fighter/);
    // (the foes' bodies come after every seat)
    const withFoes = streetLevel(G, { ...street, players: 2 }, { heroRef: 'gw-hero', foeRefs: { goon: 'r1', warlord: 'r2' } }).manifest.brawl.practice;
    expect(withFoes.roster.map((r) => r.id)).toEqual(['hero', 'stand-in-2', 'foe-goon', 'foe-warlord']);
    expect(withFoes.street.waves[0].crowd[0].roster).toBe(2);
    expect(() => readLevelStreet({ ...street, players: 5 })).toThrow(/1 to 4/);
    // (a street runs across the screen: a game made for an upright one is told, and built all the same)
    expect(streetLevel({ ...G, screen: 'phone' }, street, { heroRef: 'gw-hero' }).laws.find((l) => l.concern === 'screen')).toMatchObject({ holds: false, says: expect.stringMatching(/upright/) });
    expect(streetLevel({ ...G, screen: 'screen' }, street, { heroRef: 'gw-hero' }).laws.find((l) => l.concern === 'screen')).toBeUndefined();
  });

  it('a world with no hero yet is played by a stand-in, and said; a run & gun by its intent or its guns', () => {
    const S = streetLevel(G, street, { foeRefs: { goon: 'r1', warlord: 'r2' } });
    expect(S.manifest.brawl.practice.roster[0]).toEqual({ id: 'stand-in-1', name: 'P1', archetype: 'all-rounder' });
    expect(S.laws[0]).toMatchObject({ holds: false, says: expect.stringMatching(/stand-in fighter/) });
    expect(S.manifest.brawl.practice.range).toBeUndefined();
    expect(streetLevel({ ...G, intent: { from: 'run-and-gun' } }, street, {}).manifest.brawl.practice.range).toEqual({});
    expect(streetLevel(G, { ...street, guns: ['spread'] }, {}).manifest.brawl.practice.range).toEqual({ guns: ['spread'] });
  });
});

// A STREET ON A PLACE OF ITS OWN (`ground`, the fold of the sideways level into the street): the design's stops laid
// along a town's street, a stage or a blockout, with what stands on it and how it arrives.
describe('a street level on a ground', () => {
  const lay = { layThings: (play, belt) => [{ kind: play === 'gun' ? 'cover' : 'box', what: play === 'gun' ? 'sandbags' : 'barrel', at: belt.screens[1].from + 2 }], layScenes: (belt, name) => ({ arrive: [{ title: name ?? 'x', secs: 1 }] }) };
  const ground = { kind: 'greybox', preset: 'street', belt: { rise: [[0, 0], [10, 0], [14, 1]] } };
  it('is read: a place in a kit\'s stead, its screens the street\'s; true or no stops is the street unsaid', () => {
    expect(readLevelStreet(true).design).toEqual({ ...STREET_UNSAID });
    expect(readLevelStreet({ ground }).design.stops).toHaveLength(STREET_UNSAID.stops.length);
    expect(readLevelStreet({ ground, stops: [{ wave: { grunt: 1 } }] })).toMatchObject({ ground, things: null, scenes: null });
    expect(() => readLevelStreet({ ground, kit: 'island-plaza' })).toThrow(/no `kit` beside it/);
    expect(() => readLevelStreet({ ground: { kind: 'town', screens: [{ length: 10 }] } })).toThrow(/its screens are the street's stops/);
    expect(() => readLevelStreet({ ground: { kind: 'moon' } })).toThrow(/kind is one of/);
    expect(() => readLevelStreet({ scenes: 3 })).toThrow(/scenes/);
  });
  it('is laid on its ground: the stops its screens, its bends kept, its play\'s things and the starter\'s scenes unless said', () => {
    const words = { ground, stops: [{ wave: { grunt: 1 } }, { wave: { grunt: 2 } }] };
    const M = streetLevel({}, words, { title: 'Dock', ...lay }).manifest, P = M.brawl.practice;
    expect(M.kind).toBe('greybox');
    expect(M.brawl.belt.screens.map((s) => !!s.gate)).toEqual([false, true, true]);
    expect(M.brawl.belt.rise).toBeTruthy();
    expect(P.things).toHaveLength(1);
    expect(P.street.scenes.arrive[0].title).toBe('Dock');
    // (its own, kept; none, laid none; a kit's street as it was: nothing laid)
    const own = streetLevel({}, { ...words, things: [], scenes: false }, lay).manifest.brawl.practice;
    expect(own.things).toEqual([]);
    expect(own.street.scenes).toBeUndefined();
    const kit = streetLevel({}, { stops: words.stops }, lay).manifest.brawl.practice;
    expect(kit.things).toBeUndefined();
    expect(kit.street.scenes).toBeUndefined();
    // (a run & gun's: its play's things)
    expect(streetLevel({}, { ...words, guns: true }, lay).manifest.brawl.practice.things[0].kind).toBe('cover');
  });
});

// THE FOE SHELF'S IDIOMS ON A DESIGNED STREET (docs/foes.md, relations and modes): the bestiary's summoner calls its own
// `summons` entry, a boss's `pair` stands beside it, and each entry it `becomes` is a form it is defeated into; each of
// them a foe of the bestiary with a body of its own, read by the street's mind
describe('a designed street plays the bestiary\'s idioms', () => {
  const I = { foes: {
    imp: { class: 'walker', skin: { people: 'goblin' } },
    witch: { class: 'summoner', skin: { people: 'goblin' }, summons: { foe: 'imp', count: 2 } },
    king: { class: 'brute', rank: 'boss', skin: { people: 'orc' }, becomes: 'kingBare', pair: { foe: 'queen' } },
    kingBare: { class: 'charger', rank: 'boss', skin: { people: 'orc' } },
    queen: { class: 'guard', rank: 'boss', skin: { people: 'orc' } },
  } };
  const S = brawlStreet(I, { stops: [{ wave: { imp: 2 } }, { wave: { witch: 1, imp: 1 } }], boss: 'king' });
  it('a summoner plays as the street\'s summoner, calling its own summons entry, bound unless the entry says', () => {
    expect(BRAWL_PLAYS.summoner).toBe('caster');
    const caller = S.waves[1].crowd.find((c) => c.foe === 'witch');
    expect(caller).toMatchObject({ type: 'caster', summons: { foe: 'imp', type: brawlPlay(I.foes.imp), n: 2, bound: true } });
  });
  it('a boss\'s pair stands beside it and each entry it becomes is an act\'s form; each is a foe the street draws', () => {
    const B = S.waves.at(-1).boss;
    expect(B.pair).toEqual({ foe: 'queen', down: 'enrage' });
    expect(B.stages.map((st) => st.form?.foe ?? null)).toEqual([null, 'kingBare']);
    for (const id of ['imp', 'witch', 'king', 'kingBare', 'queen']) expect(S.foes).toContain(id);
  });
  it('laid as a level, the yard reads every idiom by its bodies, drawn in the order the street makes them', () => {
    const L = streetLevel(I, { stops: [{ wave: { imp: 2 } }, { wave: { witch: 1, imp: 1 } }], boss: 'king' }, {});
    const Y = brawlYardData(L.manifest.brawl);
    const W = Y.street.waves.at(-1);
    expect(W.boss.pair.recipe).toBeTruthy();
    expect(W.boss.stages[1].form.archetype).toBeTruthy();
    // (who each body is drawn as, in the order the street makes them: the summoner, then its pool, three times its
    // number, each its summons' body; here both drawn as the stand-ins' one roster entry, the wave's plain imp after
    // them drawn as none)
    const B = structuredClone(L.manifest.brawl), w1 = B.practice.street.waves[1];
    w1.crowd = w1.crowd.map((c) => (c.summons ? { ...c, roster: 0, summons: { ...c.summons, roster: 0 } } : c));
    const cast = brawlYardData(B).street.castAt, at = cast.indexOf(0);
    expect(cast.slice(at, at + 7)).toEqual(Array(7).fill(0));
    expect(cast[at + 7]).toBe(null);
  });
});
