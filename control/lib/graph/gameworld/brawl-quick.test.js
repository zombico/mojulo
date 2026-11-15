// A WORLD THAT IS A BRAWLER (quick goal `brawl`, quick.js; runner.js): its players made as a fight's are, its streets
// its levels (each a brawl level with its waves and the hosted level's contract), the game in the play shell.
import { describe, it, expect } from 'vitest';
import { quickWorld, brawlStreets, defaultWaves, defaultThings, defaultScenes, BRAWL_SCENES, brawlSetup, brawlGuns, QUICK_GUNS, brawlCrowd, crowdTypeOf, BRAWL_STREET, BRAWL_FACTION, QUICK_GOALS } from './quick.js';
import { runSteps } from './runner.js';
import { brawlPreset } from '../brawl/brawl-levels.js';
import { GENRES } from '../egocube/setting.js';
import { readFlow } from '../game/flow.js';
import { readScenes } from '../brawl/brawl-scenes.js';
import { CROWD_TYPES } from '../brawl/brawl-crowd.js';
import { GRUNT_STYLES } from '../cosmos/packs/comic-hero/grunts.js';

const ME = { archetype: 'hero', style: 'all-rounder' };
const world = (quick) => quickWorld({ id: 'w', name: 'Brawl', quick: { goal: 'brawl', ...quick } });

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
