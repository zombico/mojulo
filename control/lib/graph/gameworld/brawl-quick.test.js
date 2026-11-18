// A WORLD THAT IS A BRAWLER (quick goal `brawl`, quick.js; runner.js): its players made as a fight's are, its streets
// its levels (each a brawl level with its waves and the hosted level's contract), the game in the play shell.
import { describe, it, expect } from 'vitest';
import { quickWorld, HERO_CAMPAIGN, DRONE_STATURE, brawlStreets, defaultWaves, defaultThings, defaultScenes, BRAWL_SCENES, brawlSetup, brawlGuns, QUICK_GUNS, brawlCrowd, brawlBody, crowdTypeOf, BRAWL_STREET, BRAWL_FACTION, QUICK_GOALS, readHeroes, HERO_TEAM, HERO_ARMY, HERO_VILLAINS } from './quick.js';
import { POWER_IDS } from '../brawl/brawl-powers.js';
import { TUNINGS } from '../brawl/brawl-tunings.js';
import { runSteps } from './runner.js';
import { egocubeCreate, rollStored } from '../egocube/kind.js';
import { validateHeroSpec } from '../../mcp/tools/layered.js';
import { brawlPreset } from '../brawl/brawl-levels.js';
import { GENRES } from '../egocube/setting.js';
import { readFlow } from '../game/flow.js';
import { readScenes } from '../brawl/brawl-scenes.js';
import { CROWD_TYPES } from '../brawl/brawl-crowd.js';
import { VILLAINS, LIEUTENANT_KINDS } from '../brawl/brawl-villains.js';
import { GRUNT_STYLES } from '../cosmos/packs/comic-hero/grunts.js';

const ME = { archetype: 'hero', style: 'all-rounder' };
const world = (quick) => quickWorld({ id: 'w', name: 'Brawl', quick: { goal: 'brawl', ...quick } });
const quickWorldOf = (quick, over) => quickWorld({ id: 'w', name: 'Brawl', ...over, quick: { goal: 'brawl', ...quick } });

describe('the goal, read', () => {
  it('is a quick goal with a genre its players are rolled in', () => { expect(QUICK_GOALS.brawl).toBeTruthy(); expect(GENRES.brawl).toBeTruthy(); });
  it('takes a roster and streets; another goal\'s words are refused, and a street\'s fault is said', () => {
    expect(() => world({ roster: [ME] })).not.toThrow();
    expect(() => world({ arenas: [{ id: 'a' }] })).toThrow(/fight goal|brawl takes/);
    expect(() => quickWorld({ id: 'w', quick: { goal: 'reach', streets: [BRAWL_STREET] } })).toThrow(/brawl goal/);
    expect(() => world({ streets: [{ id: 's', waves: [{ screen: 9, crowd: [{ type: 'thug', n: 1 }] }] }] })).toThrow(/screen of the belt/);
    expect(() => world({ play: 'kart' })).toThrow(/play is/);
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
  it('unsaid, things stand on it to be broken: two a held screen, in the band, some holding food; its own are kept', () => {
    const belt = brawlPreset('street').belt, T = defaultThings(belt);
    expect(T.length).toBe(2 * belt.screens.filter((s) => s.gate || s.boss).length);
    for (const t of T) { expect(t.kind).toBe('box'); expect(t.n).toBeGreaterThanOrEqual(belt.depth[0]); expect(t.n).toBeLessThanOrEqual(belt.depth[1]); }
    expect(T.some((t) => t.holds?.kind === 'food')).toBe(true);
    const [own] = brawlStreets({ goal: 'brawl', streets: [{ id: 's', things: [] }] });
    expect(own.manifest.brawl.street.things).toEqual([]);
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
    const crowd = brawlCrowd({ goal: 'brawl' }, 1).members.map((m) => `foes-${m.id}`);
    expect(keys).toEqual(['fighter-fighter-1-sheet', 'fighter-fighter-1', ...crowd, 'level-street-street', 'game']);
  });
  it('the street\'s roster is the characters made; the game runs the streets in the play shell, in a look', () => {
    const street = steps.find((s) => s.key === 'level-street-street').order.manifest.brawl.street;
    expect(street.roster[0].hero.ref).toBe(steps.find((s) => s.key === 'fighter-fighter-1').ref);
    // (its crowd drawn as the characters made for it: the rest the thug's, the boss its own; only the first plays)
    expect(street.players).toEqual([0]);
    expect(street.cast['*'].length).toBeGreaterThan(1);            // (a wave is not one face)
    expect(street.roster[street.cast.boss[0]].hero.ref).toBe(steps.find((s) => s.key === 'foes-crowd-boss').ref);
  });
  it('is made for a wide screen unless it says another: a side view is not for an upright phone', () => {
    expect(world({}).screen).toBe('screen');
    expect(world({ screen: 'tablet' }).screen).toBe('tablet');
    expect(steps.find((s) => s.key === 'game').order.screen).toBe('screen');
  });
  it('its look: the western register unless it names one, every body a muscular one under the western head, the heavies hulking', () => {
    expect(world({}).quick.register).toBe('western');
    expect(world({ register: 'anime' }).quick.register).toBe('anime');
    const specs = Object.fromEntries(steps.filter((s) => /^(fighter|foes)-/.test(s.key) && !s.key.endsWith('-sheet')).map((s) => [s.key, s.order.spec]));
    for (const sp of Object.values(specs)) { expect(sp.head).toBe('landmark'); expect(sp.muscleShirt).toEqual({ definition: 1 }); expect(['toji', 'mizuki', 'armstrong', 'kale']).toContain(sp.animeBody); }
    expect(['armstrong', 'kale']).toContain(specs['foes-crowd-boss'].animeBody);
    expect(['toji', 'mizuki']).toContain(specs['fighter-fighter-1'].animeBody);
    const game = steps.find((s) => s.key === 'game').order;
    expect(game).toMatchObject({ shell: 'play', levels: [{ ref: steps.find((s) => s.key === 'level-street-street').ref }] });
    expect(game.ui.theme).toBeTruthy();
    expect(game.engine).toBeUndefined();
  });
});

describe('its crowd, a crew of the comic pack\'s', () => {
  // (one faction per distinct shape: the default, one whose grunts shoot, one whose grunts carry blades and staves)
  const shoots = Object.keys(GRUNT_STYLES).find((f) => brawlCrowd({ crowd: f }, 1).members.every((m) => m.as === 'boss' || CROWD_TYPES[m.as].gun));
  const armed = Object.keys(GRUNT_STYLES).find((f) => brawlCrowd({ crowd: f }, 1).members.some((m) => m.as === 'staff'));
  it('unsaid, the street gang: a grunt of each of its kinds in one colourway, and its boss', () => {
    const C = brawlCrowd({ goal: 'brawl' }, 1), S = GRUNT_STYLES[BRAWL_FACTION];
    expect(C.faction).toBe(BRAWL_FACTION);
    expect(new Set(C.members.map((m) => m.grunt.kind))).toEqual(new Set(Object.keys(S.kinds)));
    expect(new Set(C.members.map((m) => m.grunt.colourway))).toEqual(new Set([C.colourway]));
    expect(C.members.filter((m) => m.as === 'boss')).toHaveLength(1);
    expect(brawlCrowd({ goal: 'brawl' }, 1)).toEqual(C);                       // (seeded: the same crew again)
  });
  it('a grunt fights as what it carries, and is minted by the hero door out of the pack\'s light', () => {
    for (const m of brawlCrowd({ crowd: armed }, 1).members) {
      if (m.as !== 'boss') { expect(m.as).toBe(crowdTypeOf(m.grunt)); expect(CROWD_TYPES[m.as]).toBeTruthy(); }
      expect(m.mint).toMatchObject({ kind: 'layered', via: 'hero' });
      expect(m.mint.spec.geocube).toBeUndefined();
      expect(m.mint.spec.outfit).toBeTruthy();
      // (a blade is the street's to draw; only a gun stays in the hand)
      if (m.as === 'boss' || !CROWD_TYPES[m.as].gun) expect(m.mint.spec.gear).toBeUndefined();
    }
  });
  it('a street\'s waves are drawn from how its crew fights, no more than two of a wave shooting', () => {
    const belt = brawlPreset('street').belt;
    for (const f of [shoots, armed].filter(Boolean)) {
      const types = brawlCrowd({ crowd: f }, 1).members.filter((m) => m.as !== 'boss').map((m) => m.as), W = defaultWaves(belt, types);
      for (const w of W) {
        expect(w.crowd.filter((c) => CROWD_TYPES[c.type].gun).reduce((n, c) => n + c.n, 0)).toBeLessThanOrEqual(2);
        for (const c of w.crowd) expect(c.type === 'thug' || types.includes(c.type)).toBe(true);
      }
    }
  });
  it('is said by name or with its words; another faction, colourway or goal is refused', () => {
    expect(world({ crowd: armed }).quick.crowd).toBe(armed);
    const way = Object.keys(GRUNT_STYLES[armed].colourways)[1];
    expect(brawlCrowd({ crowd: { faction: armed, colourway: way, size: 2 } }, 1)).toMatchObject({ colourway: way, members: { length: 3 } });
    expect(() => world({ crowd: 'nobody' })).toThrow(/no faction/);
    expect(() => world({ crowd: { faction: armed, colourway: 'nope' } })).toThrow(/wears/);
    expect(() => quickWorld({ id: 'w', quick: { goal: 'reach', crowd: armed } })).toThrow(/brawl goal/);
  });
  it('the street it holds wears its colour: a town street\'s dress in the colourway\'s trim, unless the street says its own', () => {
    const C = brawlCrowd({ goal: 'brawl' }, 1), steps = runSteps(world({ roster: [ME] }), { ref: 'gw' });
    expect(C.colour).toMatch(/^#[0-9a-f]{6}$/i);
    expect(steps.find((s) => s.key === 'level-street-street').order.manifest.brawl.dress.colour).toBe(C.colour.toLowerCase());
    const [own] = brawlStreets({ goal: 'brawl', streets: [{ id: 's', level: { kind: 'town', dress: { colour: '#123456' } } }] }, { colour: C.colour });
    expect(own.manifest.brawl.dress.colour).toBe('#123456');
    const [bare] = brawlStreets({ goal: 'brawl', streets: [{ id: 's', level: { kind: 'town', dress: false } }] }, { colour: C.colour });
    expect(bare.manifest.brawl.dress).toBeUndefined();
  });
  it('the run casts it: every type a wave names is drawn by a grunt of the crew', () => {
    const steps = runSteps(world({ roster: [ME], crowd: armed }), { ref: 'gw' });
    const street = steps.find((s) => s.key === 'level-street-street').order.manifest.brawl.street;
    for (const w of street.waves) for (const c of w.crowd) expect(street.cast[c.type] ?? street.cast['*']).toBeTruthy();
    for (const k of Object.values(street.cast).flat()) expect(street.roster[k].hero.ref).toMatch(/foes-crowd-/);
  });
});

describe('each street a turn: the shell stitches the streets', () => {
  const TWO = [ME, { archetype: 'explorer', style: 'rushdown' }];
  const gameOf = (quick, more = {}) => runSteps(quickWorld({ id: 'w', name: 'Brawl', quick: { goal: 'brawl', ...quick }, ...more }), { ref: 'gw' });
  it('the game\'s flow asks the set-up before every street: how hard, once; who plays, each time, from the roster\'s players', () => {
    const steps = gameOf({ roster: TWO, streets: [{ id: 'a', level: { kind: 'greybox', preset: 'street' } }, { id: 'b', level: { kind: 'greybox', preset: 'street' } }] });
    const game = steps.find((s) => s.key === 'game').order, levels = Object.values(game.flow.steps).filter((s) => s.kind === 'level');
    expect(readFlow(game.flow, game)).toEqual([]);
    expect(levels.length).toBeGreaterThan(0);
    for (const L of levels) {
      expect(L.picks.map((p) => p.id)).toEqual(['difficulty', 'fighter']);
      expect(L.picks[0].keep).toBe('game'); expect(L.picks[1].keep).toBeUndefined();
      // (the pick is the roster entry's id, the one the street's page holds: never a crowd's)
      const street = steps.find((s) => s.key === 'level-street-a').order.manifest.brawl.street, ids = L.picks[1].from.options.map((o) => o.id);
      expect(ids).toEqual(street.roster.slice(0, 2).map((r) => r.id));
    }
  });
  it('one to play: no fighter asked; a world\'s own set-up is kept, the fighter added unless it asks one', () => {
    expect(brawlSetup(undefined, [{ id: 'fighter-1', name: 'A' }])).toEqual({ difficulty: true });
    const two = [{ id: 'fighter-1', name: 'A' }, { id: 'fighter-2', name: 'B', about: 'rushdown' }];
    expect(brawlSetup({ difficulty: { keep: 'level' } }, two).picks.map((p) => p.id)).toEqual(['fighter']);
    expect(brawlSetup({ picks: [{ id: 'fighter', from: { options: ['fighter-2'] } }] }, two).picks).toHaveLength(1);
    const game = gameOf({ roster: TWO }, { setup: { difficulty: { ask: 'How rough?' } } }).find((s) => s.key === 'game').order;
    expect(Object.values(game.flow.steps).find((s) => s.kind === 'level').picks[0].ask).toBe('How rough?');
  });
});

describe('a street\'s scenes in its turn', () => {
  const gameOf = (quick) => runSteps(quickWorld({ id: 'w', name: 'Brawl', quick: { goal: 'brawl', roster: [ME], ...quick } }), { ref: 'gw' });
  it('unsaid, a street arrives and leaves: its name and who holds it, the camera brought to the player; read against its belt', () => {
    const belt = brawlPreset('street').belt, S = defaultScenes(belt, { name: 'Dock Road', holder: 'the punks' });
    expect(Object.keys(S)).toEqual([BRAWL_SCENES.start, BRAWL_SCENES.end]);
    expect(() => readScenes(S, belt)).not.toThrow();
    expect(S.arrive.find((b) => b.title)).toMatchObject({ title: 'Dock Road', sub: 'held by the punks' });
    const pan = S.arrive.find((b) => b.pan).pan;
    expect(pan[1]).toBeLessThan(pan[0]);                       // (from the way on, back to where the player stands)
  });
  it('the game calls them: arrive as play starts on every street, leave once it is won; a street\'s own are kept, false plays none', () => {
    const steps = gameOf({ streets: [{ id: 'a', level: { kind: 'greybox', preset: 'street' } }, { id: 'b', level: { kind: 'greybox', preset: 'street' }, scenes: { arrive: [{ say: 'Mine.', who: 'Boss' }] } }] });
    const game = steps.find((s) => s.key === 'game').order, L = Object.values(game.flow.steps).find((s) => s.kind === 'level');
    expect(readFlow(game.flow, game)).toEqual([]);
    expect(L.start).toEqual({ scene: 'arrive', once: false }); expect(L.end).toEqual({ scene: 'leave', when: 'won' });
    const street = (id) => steps.find((s) => s.key === `level-street-${id}`).order.manifest.brawl.street;
    expect(street('a').scenes.arrive.find((b) => b.sub).sub).toMatch(/held by the /);
    expect(street('b').scenes).toEqual({ arrive: [{ say: 'Mine.', who: 'Boss' }] });
    const none = gameOf({ streets: [{ id: 'a', level: { kind: 'greybox', preset: 'street' }, scenes: false }] });
    expect(none.find((s) => s.key === 'level-street-a').order.manifest.brawl.street.scenes).toBeUndefined();
    expect(Object.values(none.find((s) => s.key === 'game').order.flow.steps).find((s) => s.kind === 'level').start).toBeUndefined();
  });
});

describe('a brawl played as a run & gun (brawl/brawl-play.js)', () => {
  const level = { kind: 'greybox', preset: 'street' };
  it('its streets say their play, their guns and the play\'s own waves and things; a street may say its own play', () => {
    const [G, B] = brawlStreets({ goal: 'brawl', play: 'gun', streets: [{ id: 'a', level }, { id: 'b', level, play: 'brawl' }] }).map((s) => s.manifest.brawl.street);
    expect(G).toMatchObject({ play: 'gun', guns: [...QUICK_GUNS] });
    expect(G.waves.every((w) => w.crowd.some((c) => CROWD_TYPES[c.type].gun))).toBe(true);
    expect(G.things.some((t) => t.kind === 'cover')).toBe(true);
    expect(G.things.some((t) => t.holds?.kind === 'gun')).toBe(true);
    expect(B.play).toBeUndefined();
    expect(B.things.some((t) => t.kind === 'cover')).toBe(false);
    // (a street's own waves and things are kept under either play)
    const [own] = brawlStreets({ goal: 'brawl', play: 'gun', streets: [{ id: 'a', level, things: [], guns: ['rocket'], grenades: 0 }] });
    expect(own.manifest.brawl.street).toMatchObject({ things: [], guns: ['rocket'], grenades: 0 });
  });
  it('its turn asks the gun to start with, where there is more than one; a brawl\'s asks none', () => {
    const streets = brawlStreets({ goal: 'brawl', play: 'gun', streets: [{ id: 'a', level }] });
    expect(brawlSetup(undefined, [], brawlGuns(streets)).picks.map((p) => p.id)).toEqual(['gun']);
    expect(brawlSetup(undefined, [], brawlGuns(streets)).picks[0].from.options.map((o) => o.id)).toEqual([...QUICK_GUNS]);
    expect(brawlSetup(undefined, [], ['rocket']).picks).toBeUndefined();
    expect(brawlGuns(brawlStreets({ goal: 'brawl', streets: [{ id: 'a', level }] }))).toEqual([]);
  });
});

// A HEROES BRAWL (`heroes`, the superhero beat-em-up): the comic pack's team, each with a power, against an army and the
// pack's villain, its streets tuned as the heroes card says.
describe('a heroes brawl', () => {
  const H = world({ heroes: true }), steps = runSteps(H, { ref: 'gw' });
  const street = steps.find((s) => s.key === 'level-street-street').order.manifest.brawl.street;
  const lair = steps.find((s) => s.key === 'level-street-lair').order.manifest.brawl.street;
  it('is read: a team of 1 to 4 of the pack\'s cast, each a power; one of the pack\'s villains; never with guns', () => {
    expect(readHeroes(true)).toMatchObject({ team: HERO_TEAM.map((t) => ({ member: t.member, power: t.power })), villain: { member: 'mastermind', power: HERO_VILLAINS.mastermind } });
    expect(readHeroes({ team: [POWER_IDS[1]] }).team[0]).toMatchObject({ member: HERO_TEAM[0].member, power: POWER_IDS[1] });
    expect(() => world({ heroes: { team: ['telekinesis'] } })).toThrow(/power/);
    expect(() => world({ heroes: { team: [{ member: 'nobody' }] } })).toThrow(/member/);
    expect(() => world({ heroes: { villain: 'sidekick' } })).toThrow(/villain/);
    expect(() => world({ heroes: true, play: 'gun' })).toThrow(/not played with guns/);
  });
  it('its team rolled from the members\' sheets, each roster seat carrying its power; the crowd carries none', () => {
    const heroes = street.roster.filter((r) => r.power);
    expect(heroes.map((r) => r.power)).toEqual(HERO_TEAM.map((t) => t.power));
    for (const [k, r] of heroes.entries()) expect(r.hero.ref).toBe(steps.find((s) => s.key === `fighter-hero-${k + 1}`).ref);
    const sheet = steps.find((s) => s.key === 'fighter-hero-1-sheet').order.manifest.roll;
    expect(sheet.facets).toMatchObject({ archetype: 'hero' });
  });
  it('an army that falls fast and drops in, the pack\'s villain at the end of the last street with a power of its own, in stages', () => {
    const crowd = brawlCrowd({ goal: 'brawl', heroes: true }, 1);
    expect(crowd.faction).toBe(HERO_ARMY);
    expect(crowd.members.find((m) => m.as === 'villain')).toMatchObject({ name: 'The mastermind', mint: { via: 'hero' } });
    expect(crowd.members.filter((m) => m.as === 'boss')).toHaveLength(1);
    expect(street.tuning).toBe('heroes');
    const boss = lair.waves.find((w) => w.boss).boss;
    expect(boss.recipe.name).toBe('The mastermind');
    expect(Object.values(boss.recipe.specials).every((sp) => sp.id === `power.${HERO_VILLAINS.mastermind}`)).toBe(true);
    expect(boss.plays).toContain('special.neutral');
    expect(boss.stages.length).toBeGreaterThan(1);
    expect(new Set(street.waves.flatMap((w) => w.crowd.map((c) => c.entrance ?? 'walk')))).toEqual(new Set(TUNINGS.heroes.entrances));
  });
  // LEVEL 1 AND BEYOND: a campaign of streets climbing to the villain, the whole game between its front's first screen and
  // its end card
  it('is a campaign: the city street, the works and the lair, each opened by the one before; the army\'s boss on the way, the villain last', () => {
    const game = steps.find((s) => s.key === 'game').order;
    expect(game.levels.map((l) => l.title)).toEqual(HERO_CAMPAIGN.map((c) => c.name));
    expect(game.levels[0].gate).toBeUndefined();
    for (let i = 1; i < game.levels.length; i++) expect(game.levels[i].gate).toEqual({ completed: game.levels[i - 1].ref });
    const firstBoss = street.waves.find((w) => w.boss).boss;
    expect(firstBoss.recipe.specials?.neutral?.id).not.toBe(`power.${HERO_VILLAINS.mastermind}`);
    const villainAt = steps.find((s) => s.key === 'foes-crowd-villain'), bossAt = steps.find((s) => s.key === 'foes-crowd-boss');
    expect(street.roster[street.cast.boss[0]].hero.ref).toBe(bossAt.ref);
    expect(lair.roster[lair.cast.boss[0]].hero.ref).toBe(villainAt.ref);
    expect(lair.cast.villain).toBeUndefined();
    // (the army comes a body stronger on the last street)
    const most = (st) => Math.max(...st.waves.flatMap((w) => w.crowd.map((c) => c.n)));
    expect(most(lair)).toBeGreaterThanOrEqual(most(street));
    expect(lair.scenes.arrive.find((b) => b.title).sub).toMatch(/The mastermind/);
  });
  it('every member of its army, the army\'s boss, the villain and a pair\'s second, is a spec the hero door takes', () => {
    // (a grunt whose gesture swings the gear the brawler's body leaves off keeps no such gesture: a shadow clan's staff)
    for (const villain of ['mastermind', 'rival']) for (const m of brawlCrowd({ goal: 'brawl', heroes: { villain } }, 1).members) if (m.mint) expect(validateHeroSpec(m.mint.spec), `${villain}: ${m.id}`).toEqual([]);
  });
  it('its villain is a supervillain of the shelf (the member\'s kind unless said, a design over it); lieutenants hold the streets on the way', () => {
    const lairOf = (heroes) => { const W = runSteps(world({ heroes }), { ref: 'gw' }); return { W, lair: W.find((s) => s.key === 'level-street-lair').order.manifest.brawl.street }; };
    // (the mastermind a summoner: its summons on its boss)
    expect(lair.waves.find((w) => w.boss).boss.summons).toMatchObject({ type: 'drone' });
    // (its drones drawn as their own body, smaller and in another colourway, never a wave's rank and file)
    const droneAt = steps.find((s) => s.key === 'foes-crowd-drone');
    expect(droneAt.order.spec.tune.stature).toBe(DRONE_STATURE);
    expect(lair.roster[lair.cast.drone[0]].hero.ref).toBe(droneAt.ref);
    expect(lair.cast['*']).not.toContain(lair.cast.drone[0]);
    expect(lair.waves.flatMap((w) => w.crowd).some((c) => c.type === 'drone')).toBe(false);
    // (the twins: a pair, its second its own character, the last street drawing both)
    const T = lairOf({ villain: { member: 'rival', name: 'Castor' } });
    const pairBoss = T.lair.waves.find((w) => w.boss).boss;
    expect(pairBoss.pair.name).toBe("Castor's twin");
    const second = T.W.find((s) => s.key === 'foes-crowd-villain-2');
    expect(second).toBeTruthy();
    expect(T.lair.cast.boss.map((k) => T.lair.roster[k].hero.ref)).toEqual([T.W.find((s) => s.key === 'foes-crowd-villain').ref, second.ref]);
    // (a kind named and designed: the person's words over its row, read before anything is made)
    const D = lairOf({ villain: { member: 'brute', kind: 'warlord', design: { hp: 700, stages: [{}, { at: 0.5, calls: { blaster: 3 } }] } } });
    expect(D.lair.waves.find((w) => w.boss).crowd.filter((c) => c.stage === 1)).toEqual([{ type: 'blaster', n: 3, stage: 1 }]);
    expect(() => world({ heroes: { villain: { kind: 'overlord' } } })).toThrow(/kind is one of/);
    expect(() => world({ heroes: { villain: { design: { summons: { type: 'caster' } } } } })).toThrow(/does not summon/);
    // (the streets on the way end on lieutenants, the shelf's, in turn)
    const bossName = (st) => st.waves.find((w) => w.boss).boss.recipe.name;
    expect(bossName(street)).toBe(VILLAINS[LIEUTENANT_KINDS[0]].name);
    expect(bossName(steps.find((s) => s.key === 'level-street-works').order.manifest.brawl.street)).toBe(VILLAINS[LIEUTENANT_KINDS[1]].name);
  });
  it('plays from the arcade\'s first screen to its end: attract, title, the streets, the end card once the villain falls, the roll', () => {
    const game = steps.find((s) => s.key === 'game').order, F = game.flow.steps;
    expect(game.front).toMatchObject({ press: true, end: { text: expect.stringMatching(/The mastermind/) } });
    expect(game.front.credits.roll.map((r) => r.role)).toEqual(['The heroes', 'The villain']);
    expect(F.attract.on.press).toBe('title');
    expect(F.title.on.play).toBe('$first');
    expect(F.play.on.won[0]).toEqual({ when: 'complete', go: 'end' });
    expect(F.end.on.done).toBe('credits');
    expect(readFlow(game.flow, { levels: game.levels.map((l) => l.ref) })).toBeTruthy();
    // (its own streets are its own; a world's own front wins)
    const own = runSteps(world({ heroes: true, streets: [{ id: 'one' }] }), { ref: 'gw' }).find((s) => s.key === 'game').order;
    expect(own.levels).toHaveLength(1);
    const fronted = runSteps(quickWorldOf({ heroes: true }, { front: { tagline: 'theirs' } }), { ref: 'gw' }).find((s) => s.key === 'game').order;
    expect(fronted.front).toEqual({ tagline: 'theirs' });
  });
  it('another brawl is as it was: no power, no tuning, the street gang\'s boss', () => {
    const plain = runSteps(world({}), { ref: 'gw' }).find((s) => s.key === 'level-street-street').order.manifest.brawl.street;
    expect(plain.tuning).toBeUndefined();
    expect(plain.roster.some((r) => r.power)).toBe(false);
  });
});

// A HEROES BRAWL OF THE PERSON'S OWN: heroes said in their words (or made already), powers designed, a villain chosen.
describe('a heroes brawl designed', () => {
  const OWN = { name: 'Nova Girl', brief: 'a teenage astronomer who caught a falling star', build: 'lithe', age: 'youth', pole: 'female', power: { kind: 'beam', name: 'Starfall', beam: 'laser', strength: 120 } };
  const MADE = { hero: { ref: 'made-hero' }, name: 'Ironside', power: 'might' };
  const H = world({ heroes: { team: [OWN, MADE], villain: { member: 'brute', power: { kind: 'nova', name: 'Quake' }, name: 'Gravel King' } } });
  const steps = runSteps(H, { ref: 'gw' });
  const street = steps.find((s) => s.key === 'level-street-street').order.manifest.brawl.street;
  it('the person\'s own hero is rolled from their words alone, not a pack member\'s sheet; one already made is used as made', () => {
    const roll = steps.find((s) => s.key === 'fighter-hero-1-sheet').order.manifest.roll;
    expect(roll).toMatchObject({ brief: OWN.brief, facets: { build: 'lithe', age: 'youth', pole: 'female' } });
    expect(roll.facets.archetype).toBeUndefined();
    expect(steps.some((s) => s.key === 'fighter-hero-2-sheet')).toBe(false);
    expect(street.roster.slice(0, 2).map((r) => [r.name, r.hero.ref === 'made-hero'])).toEqual([['Nova Girl', false], ['Ironside', true]]);
  });
  it('each seat carries its designed power, the set-up\'s pick says it, and the villain is the one chosen with its own', () => {
    expect(street.roster[0].power).toEqual(OWN.power);
    const setup = steps.find((s) => s.key === 'game').order.flow;
    expect(JSON.stringify(setup)).toContain('Starfall (beam)');
    const boss = steps.find((s) => s.key === 'level-street-lair').order.manifest.brawl.street.waves.find((w) => w.boss).boss;
    expect(boss.recipe.name).toBe('Gravel King');
    expect(boss.recipe.specials.neutral.id).toBe('power.nova');
    expect(brawlCrowd({ goal: 'brawl', heroes: { villain: 'brute' } }, 1).members.find((m) => m.as === 'villain').name).toBe('The brute');
  });
  it('a hero described with long hair and a cape is made with them, over its sheet; one made already keeps its own look', () => {
    const W = runSteps(world({ heroes: { team: [{ brief: 'a weather witch with long white hair down to her waist and a flowing cape', pole: 'female', power: 'gale' }, { brief: 'a courier', look: { hair: 'buzz' } }] } }), { ref: 'gw' });
    const one = W.find((s) => s.key === 'fighter-hero-1').order.spec, two = W.find((s) => s.key === 'fighter-hero-2').order.spec;
    expect(one.hair).toEqual(['long', { length: 2 }]);
    expect(one.outfit.pieces.find((p) => p.kind === 'cloak')).toEqual({ kind: 'cloak', hem: 'ankle' });
    expect(two.hair).toBe('buzz');
    expect(two.outfit).toBeUndefined();
    // (a hero no one described the look of is the brawler's body over its sheet, as before)
    expect(steps.find((s) => s.key === 'fighter-hero-1').order.spec.hair).toBeUndefined();
    expect(() => world({ heroes: { team: [{ hero: { ref: 'x' }, look: { hair: 'bob' } }] } })).toThrow(/already made/);
    expect(() => world({ heroes: { team: [{ brief: 'b', look: { hair: 'mohawk' } }] } })).toThrow(/team\[0\]\.look\.hair/);
  });
  it('a hero and the villain take the hero door\'s own words (create_character\'s spec) over their sheets; a villain made already is drawn as made', () => {
    const SPEC = { hair: ['braid', { length: 1.4 }], headgear: 'circlet', palette: { Hair: '#eeeeee' } };
    const W = runSteps(world({ heroes: { team: [{ brief: 'a witch with short black hair', pole: 'female', spec: SPEC }], villain: { member: 'brute', look: { cape: 'ankle' }, spec: { expression: 'smile' } } } }), { ref: 'gw' });
    const one = W.find((s) => s.key === 'fighter-hero-1').order.spec;
    // (its own words win over the look its brief gave, and over the brawler's body; the brawler's body under them)
    expect(one).toMatchObject(SPEC);
    expect(one.animeBody).toBeTruthy();
    const boss = W.find((s) => s.key === 'foes-crowd-villain').order.spec;
    expect(boss.expression).toBe('smile');
    expect(boss.outfit.pieces.some((p) => p.kind === 'cloak')).toBe(true);
    const made = runSteps(world({ heroes: { villain: { hero: { ref: 'my-villain' }, name: 'Umbra', power: 'nova' } } }), { ref: 'gw' });
    expect(made.some((s) => s.key === 'foes-crowd-villain')).toBe(false);
    const street = made.find((s) => s.key === 'level-street-lair').order.manifest.brawl.street;
    expect(street.roster.find((r) => r.id === 'crowd-villain')).toMatchObject({ name: 'Umbra', hero: { ref: 'my-villain' } });
    expect(street.roster[street.cast.boss[0]].hero.ref).toBe('my-villain');
    expect(() => world({ heroes: { team: [{ brief: 'b', spec: 'tall' }] } })).toThrow(/hero door's words/);
    expect(() => world({ heroes: { team: [{ hero: { ref: 'x' }, spec: { hair: 'bob' } }] } })).toThrow(/already made/);
    expect(() => world({ heroes: { villain: { hero: { ref: 'x' }, member: 'brute' } } })).toThrow(/already made/);
  });
  it('its words are read before anything is made; a power far from its kind\'s measure is advised on the game', () => {
    expect(() => world({ heroes: { team: [{ hero: { ref: 'x' }, brief: 'b' }] } })).toThrow(/already made/);
    expect(() => world({ heroes: { team: [{ brief: 'b', build: 'enormous' }] } })).toThrow(/build/);
    expect(() => world({ heroes: { team: [{ power: { kind: 'storm', pierce: 2 } }] } })).toThrow(/throws no round/);
    expect(() => world({ heroes: { villain: { member: 'brute', mood: 'grim' } } })).toThrow(/villain's word/);
    expect(steps.find((s) => s.key === 'game').laws).toBeUndefined();
    const heavy = runSteps(world({ heroes: { team: [{ power: { kind: 'beam', strength: 200, stock: 9 } }] } }), { ref: 'gw' }).find((s) => s.key === 'game');
    expect(heavy.laws[0]).toMatchObject({ concern: 'balance', law: 'power', holds: false });
  });
});

// AN ANIME BRAWL: its fighters rolled in the anime tradition keep the anime head on the brawler's body, so the hero door
// takes them (the western head refuses the anime head's hair, face and expression)
describe('an anime brawl', () => {
  it('its fighters keep the anime head the sheet was rolled for, and the hero door takes them; a western one keeps the western', () => {
    const roll = (tradition) => egocubeCreate(rollStored({ kind: 'egocube', roll: { brief: 'a courier who outran lightning', facets: { pole: 'male' }, seed: 3, setting: { tradition } } }));
    for (const [tradition, head] of [['anime', 'anime'], ['western', 'landmark']]) {
      const C = roll(tradition), spec = { ...C.create.spec, ...brawlBody(C) };
      expect(spec.head, tradition).toBe(head);
      expect(validateHeroSpec(spec), tradition).toEqual([]);
    }
    const steps = runSteps(world({ register: 'anime', roster: [ME] }), { ref: 'gw' });
    expect(steps.find((s) => s.key === 'fighter-fighter-1').order.spec.head).toBe('anime');
  });
});
