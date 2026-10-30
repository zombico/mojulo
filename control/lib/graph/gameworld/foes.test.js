// A gameworld's foes: the bestiary read at once, a level's foes stood on its trail beats, the hero made hittable where
// they stand, and nothing laid where none is named. Placement is tested on a stage's own ends (its beats), the runner on
// the hero sample: a bestiary alone mints nothing, a level that stands foes mints one beast per entry it fields.
import { describe, it, expect } from 'vitest';
import { readBestiary, readLevelFoes, foePlacements, hostileCast, withFoeHits, withFoeWin, fieldedIds, stompOf, SWARM, ROOM_FOES } from './foes.js';
import { GRUNT_STYLES } from '../cosmos/packs/comic-hero/grunts.js';
import { FEELS } from './feel/cards.js';
import { MADE_KEY } from './made.js';
import { settingOfGame } from './cast-setting.js';
import { readGameworld, runSteps, MEADOWMARK_HERO } from './index.js';
import { LEVEL_GOAL } from './quick.js';
import { FOE_CLASSES } from '../foes/index.js';
import { MOVES } from '../foes/vocab.js';
import { resolveFoe } from '../foes/resolve.js';
import { strikeWindow } from '../fauna/behavior/strike.js';
import { peopleRollOf } from './foes.js';
import { rollEgocube } from '../egocube/egocube.js';
import { PEOPLE } from '../foes/people.js';

const CLASSES = Object.values(FOE_CLASSES);
const SOLO = CLASSES.find((c) => !MOVES[c.move].group);
const PACK = CLASSES.find((c) => !!MOVES[c.move].group);
const BEATS = [{ beat: 'trailhead', at: [0, 0, 0] }, { beat: 'reveal', at: [10, 0, 0] }, { beat: 'pocket', at: [20, 0, 0] }, { beat: 'exit', at: [30, 0, 0] }];
const ENDS = { spawn: [0, 0, 0], exit: [30, 0, 0], beats: BEATS };
const walk = { walk: { nodes: { a: { trail: {} } } } };
const world = (foes, levelFoes) => readGameworld({ id: 'w', levels: { one: { ...walk, ...(levelFoes !== undefined ? { foes: levelFoes } : {}) } }, ...(foes ? { foes } : {}) });
const lv0 = Object.keys(MEADOWMARK_HERO.levels)[0];
const heroWith = (foes, levelFoes) => ({ ...MEADOWMARK_HERO, ...(foes ? { foes } : {}), levels: { ...MEADOWMARK_HERO.levels, [lv0]: { ...MEADOWMARK_HERO.levels[lv0], ...(levelFoes !== undefined ? { foes: levelFoes } : {}) } } });

describe('the bestiary', () => {
  it('reads each entry at once, refusing a word or a skin that does not fit, naming it', () => {
    expect(readBestiary({ a: { class: SOLO.id, rank: 'elite' } })).toEqual({ a: { class: SOLO.id, rank: 'elite' } });
    expect(() => readBestiary({ a: { class: 'dragon' } })).toThrow(/foes\.a: no class 'dragon'/);
    expect(() => readBestiary({ a: { class: SOLO.id, colour: 'red' } })).toThrow(/foes\.a\.colour is not a foe setting/);
    expect(() => readBestiary({ a: { class: SOLO.id, skin: { species: 'salmon' } } })).toThrow(/foes\.a: a .* does not fit a salmon/);
    expect(() => readBestiary({})).toThrow(/at least one/);
  });
  it('a level\'s foes name the bestiary, stand on a walk, and never in a quick game', () => {
    const B = { a: { class: SOLO.id } };
    expect(readLevelFoes(true, B, 'levels.one')).toEqual({ from: ['a'] });
    expect(readLevelFoes(true, null, 'levels.one').from).toEqual(Object.keys(FOE_CLASSES));
    expect(() => readLevelFoes({ from: ['b'] }, B, 'levels.one')).toThrow(/'b' is not in the bestiary/);
    expect(() => readLevelFoes({ count: 0 }, B, 'levels.one')).toThrow(/count is a whole number/);
    expect(() => readGameworld({ id: 'w', levels: { one: { runner: true, foes: true } } })).toThrow(/stand on a walk/);
    expect(() => readGameworld({ id: 'w', quick: { goal: 'reach' }, levels: { one: { ...walk } }, foes: B })).toThrow(/quick game's foes/);
    // (a building's rooms take them; a building made by ref is played as it was made)
    expect(() => readGameworld({ id: 'w', levels: { one: { building: { use: 'office' }, foes: true } }, foes: B })).not.toThrow();
    expect(() => readGameworld({ id: 'w', levels: { one: { building: { ref: 'sk-house' }, foes: true } }, foes: B })).toThrow(/made by ref/);
  });
});

describe('a stage\'s foes', () => {
  it('one on each free beat, the trailhead and the exit clear, cycling the bestiary', () => {
    const G = world({ a: { class: SOLO.id }, b: { class: SOLO.id, rank: 'elite' } }, true);
    const P = foePlacements(G, 'one', ENDS);
    expect(P.map((p) => [p.eid, p.at[0]])).toEqual([['a', 10], ['b', 20]]);
    expect(foePlacements(G, 'one', { ...ENDS, beats: [BEATS[0], BEATS[3]] })).toEqual([]);
  });
  it('a building stands a few through its rooms, spread from the way in to the goal; a count stands that many', () => {
    const rooms = Array.from({ length: ROOM_FOES * 4 }, (_, k) => ({ beat: `room-${k}`, at: [k * 5, 0, 0] }));
    const IN = { spawn: [-5, 0, 0], exit: [rooms.length * 5, 0, 0], beats: rooms, use: 'office' };
    const G = world({ a: { class: SOLO.id } }, true), P = foePlacements(G, 'one', IN);
    expect(P.length).toBe(ROOM_FOES);
    expect(P[0].at[0]).toBeGreaterThan(0);
    expect(P[P.length - 1].at[0]).toBeGreaterThan(rooms.length * 5 * 0.75);
    expect(foePlacements(world({ a: { class: SOLO.id } }, { count: 2 }), 'one', IN).length).toBe(2);
    // (a trail's beats, as before: one on each)
    expect(foePlacements(G, 'one', { ...IN, use: undefined }).length).toBe(rooms.length);
  });
  it('a count past the beats stands the rest round them; a pack stands its members as one group', () => {
    const G = world({ s: { class: PACK.id } }, { count: 3 });
    const P = foePlacements(G, 'one', ENDS);
    expect(P.length).toBe(3 * SWARM);
    const groups = new Set(P.map((p) => p.group));
    expect(groups.size).toBe(3);
    expect(new Set(P.map((p) => p.id)).size).toBe(P.length);
  });
  it('stands each as its class resolves, hittable on its grown body, and the hero hittable beside them', () => {
    const G = world({ a: { class: SOLO.id, rank: 'boss' } }, true);
    const X = hostileCast(G, 'one', ENDS, { refs: { a: 'w-foes-a' } });
    const f = resolveFoe({ class: SOLO.id, rank: 'boss' });
    const e = X.entities[0];
    expect(e).toMatchObject({ id: 'foe-a-1', team: 'foes', body: { type: 'figure-rig', figure: 'foe-a', hittable: true, hp: f.toll.hp } });
    expect(e.rule.mind).toEqual(f.entity.rule.mind);
    expect(X.figures['foe-a'].heroRef).toBe('w-foes-a');
    expect(X.pilot.body.hittable).toBe(true);
    // its hp bar shows only while the hero targets it, clear of its body (the World page's foe bars)
    expect(e.body.hpBar).toBe('target');
    // a hero with legs stomps them, by the action lab's platformer card when its world's feel does not stomp
    expect(X.pilot.rule.stomp).toEqual(stompOf(G));
    expect(stompOf(G)).toMatchObject({ low: FEELS.platformer.land.low, mercy: FEELS.platformer.hit.mercy / 60 });
    expect(hostileCast(G, 'one', ENDS, { refs: { a: 'w-foes-a' }, hero: false }).pilot.rule).toBeUndefined();
    expect(e.rule.foe ?? null).toEqual(f.entity.rule.foe ?? null);
    expect(hostileCast(world(null, undefined), 'one', ENDS, { refs: {} })).toBeNull();
  });
  it('a foe with a blade is drawn: its slot names its own figure (the World page draws a loadout body by its slots)', () => {
    const BLADE = CLASSES.find((c) => resolveFoe({ class: c.id }).entity.rule.loadout);
    const X = hostileCast(world({ a: { class: BLADE.id } }, true), 'one', ENDS, { refs: { a: 'w-foes-a' } });
    for (const e of X.entities) for (const slot of e.rule.loadout) expect(slot.figure).toBe(e.body.figure);
  });
  it('a foe with a blade swings on its body\'s own strike, and its hit lands on the blow\'s frames', () => {
    const BLADE = CLASSES.find((c) => resolveFoe({ class: c.id }).strike);
    const f = resolveFoe({ class: BLADE.id }), X = hostileCast(world({ a: { class: BLADE.id } }, true), 'one', ENDS, { refs: { a: 'w-foes-a' } });
    expect(f.strike).toEqual(f.attack.timing);
    expect(X.entities[0].rule.loadout[0].strikeContact).toEqual(strikeWindow(f.attack.timing));
    expect(X.figures['foe-a'].moves).toMatchObject({ swing_neutral: 'strike', swing_forward: 'strike' });
  });
  it('the hero\'s hp takes their hits: the goal\'s own hp, else one laid before its terminal', () => {
    const exit = { kind: 'reach-exit', at: [0, 0, 0] };
    expect(withFoeHits([exit])).toEqual([{ kind: 'fail-on-death', startHp: LEVEL_GOAL.hp, hits: LEVEL_GOAL.hit }, exit]);
    const own = { kind: 'fail-on-death', startHp: LEVEL_GOAL.hp };
    expect(withFoeHits([own, exit])).toEqual([{ ...own, hits: LEVEL_GOAL.hit }, exit]);
    const hit = { ...own, hits: 5 };
    expect(withFoeHits([hit, exit])).toEqual([hit, exit]);
  });
});

describe('the run', () => {
  const prints = (steps) => Object.fromEntries(steps.map((s) => [s.key, s.print]));
  it('a bestiary no level stands mints nothing and moves no print', () => {
    const W = heroWith({ a: { class: SOLO.id } });
    expect(fieldedIds(readGameworld(W))).toEqual([]);
    expect(prints(runSteps(W, { ref: 'gw' }))).toEqual(prints(runSteps(MEADOWMARK_HERO, { ref: 'gw' })));
  });
  it('a level that stands foes mints one beast per entry, grown by its skin, and its stages stand them', () => {
    const skin = { species: SOLO.standIn, ooze: 'dire' };
    const W = heroWith({ a: { class: SOLO.id, skin } }, true);
    const steps = runSteps(W, { ref: 'gw' });
    const beast = steps.find((s) => s.key === 'foes-a');
    expect(beast.ref).toBe('gw-foes-a');
    // (the run's record keeps it: made.js)
    expect(MADE_KEY.test(beast.key)).toBe(true);
    // in its world's look: the world's setting, and its coat in the world's colours where the world has ramps
    expect(beast.order.animal.setting).toEqual(settingOfGame(readGameworld(W)));
    if (beast.order.animal.setting.ramps?.length) expect(beast.order.animal.coat).toBe('world');
    expect(beast.order.animal).toMatchObject(skin);
    const stood = steps.filter((s) => s.key.startsWith(`level-${lv0}-`)).map((s) => s.order.manifest).filter((m) => m.entities.some((e) => e.team === 'foes'));
    expect(stood.length).toBeGreaterThan(0);
    for (const m of stood) expect(m.game.mechanics.find((x) => x.kind === 'fail-on-death').hits).toBe(LEVEL_GOAL.hit);
    // the other levels are as they were
    const plain = prints(runSteps(MEADOWMARK_HERO, { ref: 'gw' }));
    for (const s of steps.filter((x) => x.key.startsWith('level-') && !x.key.startsWith(`level-${lv0}-`))) expect(s.print).toBe(plain[s.key]);
  });
  it('a blade\'s beast is minted with its strike at its attack\'s timing; a toucher\'s motion is its words, as before', () => {
    const BLADE = CLASSES.find((c) => resolveFoe({ class: c.id }).strike), TOUCH = CLASSES.find((c) => !resolveFoe({ class: c.id }).strike);
    const steps = runSteps(heroWith({ a: { class: BLADE.id }, b: { class: TOUCH.id } }, true), { ref: 'gw' });
    const a = steps.find((s) => s.key === 'foes-a').order.animal, b = steps.find((s) => s.key === 'foes-b').order.animal;
    expect(a.motion.strike).toEqual(resolveFoe({ class: BLADE.id }).attack.timing);
    expect(a).not.toHaveProperty('strike');
    expect(Array.isArray(b.motion)).toBe(true);
  });
  it('a person or a people is rolled in the world\'s setting and made by the character loop, its moves on it', () => {
    const W = heroWith({ a: { class: SOLO.id, skin: { people: 'orcish' } } }, true);
    const steps = runSteps(W, { ref: 'gw' }), sheet = steps.find((x) => x.key === 'foes-a-sheet'), made = steps.find((x) => x.key === 'foes-a');
    expect(MADE_KEY.test(sheet.key)).toBe(true);
    expect(sheet.order.manifest).toMatchObject({ kind: 'egocube', moves: true, roll: { facets: { ancestry: 'orcish' }, setting: settingOfGame(readGameworld(W)) } });
    expect(made.order).toEqual({ egocube: sheet.ref, title: made.order.title });
    expect(made.order.animal).toBeUndefined();
  });
  it('a people plays its own moves on the field, below the hero door as on the tiered body, at a person\'s body', () => {
    // (a people whose roll falls below the hero door, and one above it: chosen by rolling, not by name)
    const doorOf = (people) => rollEgocube(peopleRollOf(readGameworld(world({ a: { class: SOLO.id, skin: { people } } }, true)), 'a', { class: SOLO.id, skin: { people } })).ancestry.door;
    const below = PEOPLE.find((x) => doorOf(x) === 'creature'), above = PEOPLE.find((x) => doorOf(x) === 'hero');
    for (const people of [above, below]) {
      const G = world({ a: { class: SOLO.id, skin: { people } } }, true), X = hostileCast(G, 'one', ENDS, { refs: { a: 'w-foes-a' } });
      const fig = X.figures['foe-a'], e = X.entities[0];
      expect(fig.heroRef).toBe('w-foes-a');
      expect(fig.moves).toMatchObject({ topple: expect.any(String), swing_neutral: expect.any(String) });
      // (a beast-kin below the door stands on the tiered body, egocube/plan.js beastOnTiered: a person's library, as above it)
      expect(fig.library).toBeTruthy(); expect(fig.walker).toBeUndefined();
      expect(e.rule.collideHeight).toBeGreaterThan(1.5);
      expect(e.body.vanish).toBeTruthy();
    }
  });
  it('a person dressed as a crew\'s is made through the hero door in its faction\'s dress, reactions on it, on the library', () => {
    const faction = Object.keys(GRUNT_STYLES)[0], F = GRUNT_STYLES[faction], kind = Object.keys(F.kinds)[0];
    const skin = { people: 'human', dress: { faction, kind } };
    const steps = runSteps(heroWith({ a: { class: SOLO.id, skin } }, true), { ref: 'gw' }), made = steps.find((x) => x.key === 'foes-a');
    expect(steps.some((x) => x.key === 'foes-a-sheet')).toBe(false);
    expect(made.order.mint).toMatchObject({ kind: 'layered', via: 'hero', spec: { outfit: { type: 'outfit', style: F.kinds[kind].dress(made.order.mint.spec.pole ?? 'male', 'tiered').style } } });
    expect(made.order.mint.spec.motion).toBeTruthy();
    expect(made.order.mint.spec.geocube).toBeUndefined();
    const X = hostileCast(world({ a: { class: SOLO.id, skin } }, true), 'one', ENDS, { refs: { a: 'w-foes-a' } });
    expect(X.figures['foe-a']).toMatchObject({ heroRef: 'w-foes-a', library: expect.any(String) });
    // (layer 0 carries it across a mode swap: dressed, defeated into a people's roll on the same stick figure; the
    // death is the last mode's)
    const chain = world({ a: { class: SOLO.id, skin, becomes: 'b' }, b: { class: SOLO.id, skin: { people: 'skeleton' } } }, { from: ['a'] });
    const Y = hostileCast(chain, 'one', ENDS, { refs: { a: 'w-foes-a', b: 'w-foes-b' } }), body = Y.entities[0].body;
    expect(body.modes.map((m) => m.figure)).toEqual(['foe-a', 'foe-b']);
    expect(Y.figures['foe-a'].library).toBe(Y.figures['foe-b'].library);
    expect(body.vanish.die).toBe(hostileCast(world({ b: { class: SOLO.id, skin: { people: 'skeleton' } } }, true), 'one', ENDS, { refs: { b: 'w-foes-b' } }).entities[0].body.vanish.die);
    // (only a person is dressed, and its dress names its build: its pole alone is its own)
    expect(() => readBestiary({ a: { class: SOLO.id, skin: { people: 'orcish', dress: { faction } } } })).toThrow(/only a person is dressed/);
    expect(() => readBestiary({ a: { class: SOLO.id, skin: { people: 'human', facets: { build: 'brute' }, dress: { faction } } } })).toThrow(/names only its pole/);
    expect(() => readBestiary({ a: { class: SOLO.id, skin: { people: 'human', dress: { faction, kind: 'astronaut' } } } })).toThrow(/has no 'astronaut'/);
  });
  it('a building level stands its foes in its rooms: the walker takes their hits, and a clear is won by their fall', () => {
    const W = { id: 'w', mode: 'autonomous', foes: { a: { class: SOLO.id } }, levels: { hq: { building: { use: 'office' }, foes: { from: ['a'], count: 2, win: 'clear' } } } };
    const level = runSteps(W, { ref: 'gw' }).find((x) => x.key.startsWith('level-hq')), M = level.order.manifest;
    expect(M.entities.filter((e) => e.team === 'foes').length).toBe(2);
    expect(M.entities[0].body.hittable).toBe(true);
    expect(M.level.mechanics.map((m) => m.kind)).toEqual(expect.arrayContaining(['fail-on-death', 'defeat-all']));
    expect(M.level.exit).toBe(false);
  });
  it('a model made elsewhere is made by no step: it stands on its own ref, a person on the library at its height', () => {
    const skin = { meshRef: 'sk-model', height: 2.2 };
    const steps = runSteps(heroWith({ a: { class: SOLO.id, skin } }, true), { ref: 'gw' });
    expect(steps.some((s) => s.key.startsWith('foes-a'))).toBe(false);
    const X = hostileCast(world({ a: { class: SOLO.id, skin } }, true), 'one', ENDS, { refs: { a: 'sk-model' } });
    const fig = X.figures['foe-a'], e = X.entities[0];
    expect(fig).toMatchObject({ modelRef: 'sk-model', height: resolveFoe({ class: SOLO.id, skin }).measured.height, library: expect.any(String) });
    expect(e.body.egg.cz * 2).toBeCloseTo(2.2 * resolveFoe({ class: SOLO.id, skin }).scale, 3);
    expect(() => readBestiary({ a: { class: SOLO.id, skin: { meshRef: 'sk-model', species: 'wolf' } } })).toThrow(/no key 'species' beside meshRef/);
    expect(() => readBestiary({ a: { class: SOLO.id, skin: { meshRef: 'sk-model', height: 40 } } })).toThrow(/height is the metres it stands/);
  });
  it('a summoner stands its summons asleep beside it, made by their own entry, called by its rule; refused by name', () => {
    const W = { boss: { class: 'summoner', summons: { foe: 'bones', count: 2, bound: false } }, bones: { class: SOLO.id } };
    const G = world(W, { from: ['boss'] });
    expect(fieldedIds(G)).toEqual(['boss', 'bones']);
    const X = hostileCast(G, 'one', ENDS, { refs: { boss: 'w-foes-boss', bones: 'w-foes-bones' } });
    const m = X.entities.find((e) => e.id === 'foe-boss-1'), s = X.entities.filter((e) => e.rule.summoned && e.rule.summoned.by === m.id);
    expect(m.rule.summon).toMatchObject({ ids: ['foe-boss-1-s1', 'foe-boss-1-s2'], at: 2 });
    expect(s.map((e) => [e.id, e.dormant, e.rule.summoned.bound])).toEqual([['foe-boss-1-s1', true, false], ['foe-boss-1-s2', true, false]]);
    expect(X.entities.find((e) => e.id === 'foe-boss-1-s1').body.figure).toBe('foe-bones');
    expect(X.figures['foe-bones'].heroRef).toBe('w-foes-bones');
    expect(() => readBestiary({ boss: { class: 'summoner' } })).toThrow(/a summoner names what it calls/);
    expect(() => readBestiary({ a: { class: SOLO.id, summons: { foe: 'a' } } })).toThrow(/only a summoner calls/);
    expect(() => readBestiary({ boss: { class: 'summoner', summons: { foe: 'boss' } } })).toThrow(/another foe of the bestiary/);
    expect(() => readBestiary({ b: { class: 'summoner', summons: { foe: 'c' } }, c: { class: 'summoner', summons: { foe: 'b' } } })).toThrow(/does not call a summoner/);
  });
  it('every body an entry stands wears one figure, the entry\'s: the page builds each its own rig from one pack', () => {
    const X = hostileCast(world({ a: { class: SOLO.id } }, { count: 3 }), 'one', ENDS, { refs: { a: 'w-foes-a' } });
    expect(X.entities.filter((e) => e.team === 'foes').map((e) => e.body.figure)).toEqual(['foe-a', 'foe-a', 'foe-a']);
    expect(Object.keys(X.figures)).toEqual(['foe-a']);
  });
  it('a foe that becomes another is defeated through its modes: each a figure, its health and its class; the last dies', () => {
    const BEAST = CLASSES.find((c) => resolveFoe({ class: c.id }).entity.rule.speed);
    const W = { knight: { class: SOLO.id, becomes: 'bones' }, bones: { class: BEAST.id, vanish: { die: 'dismantle' } } };
    const G = world(W, { from: ['knight'], count: 1, win: 'clear' });
    expect(fieldedIds(G)).toEqual(['knight', 'bones']);
    const X = hostileCast(G, 'one', ENDS, { refs: { knight: 'w-foes-knight', bones: 'w-foes-bones' } });
    const e = X.entities.find((x) => x.id === 'foe-knight-1');
    expect(e.body.modes.map((m) => m.figure)).toEqual(['foe-knight', 'foe-bones']);
    expect(e.body.modes[1]).toMatchObject({ hp: resolveFoe({ class: BEAST.id }).toll.hp, rule: { speed: resolveFoe({ class: BEAST.id }).entity.rule.speed } });
    expect(X.figures['foe-bones']).toBeTruthy();
    expect(e.body.vanish.die).toBe('dismantle');   // (only the last dies: its death is the last's)
    expect(withFoeWin(G, 'one', ENDS, [{ kind: 'reach-exit', at: ENDS.exit }])[0].count).toBe(1);
    expect(() => readBestiary({ a: { class: SOLO.id, becomes: 'b' }, b: { class: SOLO.id, becomes: 'a' } })).toThrow(/modes loop back/);
    expect(() => readBestiary({ a: { class: SOLO.id, becomes: 'a' } })).toThrow(/becomes is the foe of the bestiary it becomes/);
  });
  it('a pair stands its partner beside it, each naming the other with the same rows; fielded, counted, refused by name', () => {
    const W = { scylla: { class: SOLO.id, pair: { foe: 'charybdis', down: 'revive', swap: 0.4 } }, charybdis: { class: SOLO.id } };
    const G = world(W, { from: ['scylla'], count: 1, win: 'clear' });
    expect(fieldedIds(G)).toEqual(['scylla', 'charybdis']);
    const X = hostileCast(G, 'one', ENDS, { refs: { scylla: 'w-foes-scylla', charybdis: 'w-foes-charybdis' } });
    const a = X.entities.find((e) => e.id === 'foe-scylla-1'), b = X.entities.find((e) => e.id === 'foe-scylla-1-p');
    expect(a.rule.pair).toEqual({ with: b.id, cover: true, down: 'revive', swap: 0.4, back: 6 });
    expect(b.rule.pair).toEqual({ ...a.rule.pair, with: a.id });
    expect(b.body.figure).toBe('foe-charybdis');
    expect(X.figures['foe-charybdis'].heroRef).toBe('w-foes-charybdis');
    expect(withFoeWin(G, 'one', ENDS, [{ kind: 'reach-exit', at: ENDS.exit }])).toEqual([{ kind: 'defeat-all', who: 'foe-*', count: 2, label: 'Down' }]);
    expect(() => readBestiary({ a: { class: SOLO.id, pair: { foe: 'a' } } })).toThrow(/another foe of the bestiary/);
    expect(() => readBestiary({ a: { class: SOLO.id, pair: { foe: 'b' } }, b: { class: SOLO.id, pair: { foe: 'a' } } })).toThrow(/has a relation of its own/);
    expect(() => readBestiary({ a: { class: SOLO.id, pair: { foe: 'b', down: 'flee' } }, b: { class: SOLO.id } })).toThrow(/down is what one does when the other falls/);
  });
  it('a stage won by clearing it ends when every foe on it falls, a summoner\'s summons counted; else by its exit', () => {
    const W = { boss: { class: 'summoner', summons: { foe: 'bones', count: 2 } }, bones: { class: SOLO.id } };
    const mech = [{ kind: 'fail-on-death', startHp: 20 }, { kind: 'reach-exit', at: ENDS.exit, radius: 2.5 }];
    const G = world(W, { from: ['boss'], count: 1, win: 'clear' });
    expect(withFoeWin(G, 'one', ENDS, mech)).toEqual([mech[0], { kind: 'defeat-all', who: 'foe-*', count: 3, label: 'Down' }]);
    expect(withFoeWin(world(W, { from: ['boss'], count: 1 }), 'one', ENDS, mech)).toEqual(mech);
    expect(() => world(W, { from: ['boss'], win: 'all' })).toThrow(/win is how the stage is won: exit .* or clear/);
  });
  it('a level its foes stand on is re-made when an entry changes (its cast is not in its args), one without as before', () => {
    const print = (foes, levelFoes) => runSteps(heroWith(foes, levelFoes), { ref: 'gw' }).filter((s) => s.key.startsWith('level-')).map((s) => s.print);
    const a = { class: SOLO.id }, b = { class: SOLO.id, vanish: { die: 'cleave' } };
    expect(print({ a }, true)).not.toEqual(print({ a: b }, true));
    expect(print({ a })).toEqual(print({ a: b }));
  });
  it('a battle\'s beast foe may be grown, and its figure is minted with what grows it', () => {
    const W = { ...MEADOWMARK_HERO, battles: { foe: { species: 'wolf', ooze: 'dire' } } };
    const step = runSteps(W, { ref: 'gw' }).find((s) => s.key === 'foe');
    expect(step.order.animal).toMatchObject({ species: 'wolf', ooze: 'dire' });
    expect(() => readGameworld({ ...MEADOWMARK_HERO, battles: { foe: { species: 'wolf', ooze: 'plaid' } } })).toThrow(/unknown ooze "plaid"/);
  });
});
