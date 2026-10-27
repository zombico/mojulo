// A gameworld's foes: the bestiary read at once, a level's foes stood on its trail beats, the hero made hittable where
// they stand, and nothing laid where none is named. Placement is tested on a stage's own ends (its beats), the runner on
// the hero sample: a bestiary alone mints nothing, a level that stands foes mints one beast per entry it fields.
import { describe, it, expect } from 'vitest';
import { readBestiary, readLevelFoes, foePlacements, hostileCast, withFoeHits, fieldedIds, stompOf, SWARM } from './foes.js';
import { FEELS } from './feel/cards.js';
import { readGameworld, runSteps, MEADOWMARK_HERO } from './index.js';
import { LEVEL_GOAL } from './quick.js';
import { FOE_CLASSES } from '../foes/index.js';
import { MOVES } from '../foes/vocab.js';
import { resolveFoe } from '../foes/resolve.js';

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
  });
});

describe('a stage\'s foes', () => {
  it('one on each free beat, the trailhead and the exit clear, cycling the bestiary', () => {
    const G = world({ a: { class: SOLO.id }, b: { class: SOLO.id, rank: 'elite' } }, true);
    const P = foePlacements(G, 'one', ENDS);
    expect(P.map((p) => [p.eid, p.at[0]])).toEqual([['a', 10], ['b', 20]]);
    expect(foePlacements(G, 'one', { ...ENDS, beats: [BEATS[0], BEATS[3]] })).toEqual([]);
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
    expect(e).toMatchObject({ id: 'foe-a-1', team: 'foes', body: { type: 'figure-rig', figure: 'foe-a-1', hittable: true, hp: f.toll.hp } });
    expect(e.rule.mind).toEqual(f.entity.rule.mind);
    expect(X.figures['foe-a-1'].heroRef).toBe('w-foes-a');
    expect(X.pilot.body.hittable).toBe(true);
    // a hero with legs stomps them, by the action lab's platformer card when its world's feel does not stomp
    expect(X.pilot.rule.stomp).toEqual(stompOf(G));
    expect(stompOf(G)).toMatchObject({ low: FEELS.platformer.land.low, mercy: FEELS.platformer.hit.mercy / 60 });
    expect(hostileCast(G, 'one', ENDS, { refs: { a: 'w-foes-a' }, hero: false }).pilot.rule).toBeUndefined();
    expect(e.rule.foe ?? null).toEqual(f.entity.rule.foe ?? null);
    expect(hostileCast(world(null, undefined), 'one', ENDS, { refs: {} })).toBeNull();
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
    expect(beast.order.animal).toMatchObject(skin);
    const stood = steps.filter((s) => s.key.startsWith(`level-${lv0}-`)).map((s) => s.order.manifest).filter((m) => m.entities.some((e) => e.team === 'foes'));
    expect(stood.length).toBeGreaterThan(0);
    for (const m of stood) expect(m.game.mechanics.find((x) => x.kind === 'fail-on-death').hits).toBe(LEVEL_GOAL.hit);
    // the other levels are as they were
    const plain = prints(runSteps(MEADOWMARK_HERO, { ref: 'gw' }));
    for (const s of steps.filter((x) => x.key.startsWith('level-') && !x.key.startsWith(`level-${lv0}-`))) expect(s.print).toBe(plain[s.key]);
  });
  it('a battle\'s beast foe may be grown, and its figure is minted with what grows it', () => {
    const W = { ...MEADOWMARK_HERO, battles: { foe: { species: 'wolf', ooze: 'dire' } } };
    const step = runSteps(W, { ref: 'gw' }).find((s) => s.key === 'foe');
    expect(step.order.animal).toMatchObject({ species: 'wolf', ooze: 'dire' });
    expect(() => readGameworld({ ...MEADOWMARK_HERO, battles: { foe: { species: 'wolf', ooze: 'plaid' } } })).toThrow(/unknown ooze "plaid"/);
  });
});
