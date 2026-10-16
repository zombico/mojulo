import { describe, it, expect } from 'vitest';
import { composeGameworld, runSteps, readGameworld, fingerprint, MEADOWMARK, MEADOWMARK_HERO } from './index.js';
import { LEVEL_GOAL } from './quick.js';
import { composeMechanics } from '../game/mechanics.js';
import { readBattle } from '../playscape/ui/battles.js';
import { withBuildingLevel } from '../structure/level.js';

const levelSteps = (S) => S.filter((s) => s.key.startsWith('level-'));
// a made level's game channel as it plays (a building's is lowered from its `level` on every read)
const gameOf = (s) => (s.order.manifest.game ? s.order.manifest : withBuildingLevel(s.order.manifest, s.ref)).game;
const kinds = (s) => gameOf(s).mechanics.map((m) => m.kind);
// every level's mechanics compose against the game's own store (the slices they need are there, one success terminal)
const composes = (S) => {
  const store = S.find((s) => s.key === 'game').order.store;
  for (const s of levelSteps(S)) expect(() => composeMechanics(gameOf(s).mechanics, { storeSchema: store, player: s.order.manifest.entities?.[0]?.id ?? 'player' })).not.toThrow();
};

describe('composed goals: what a level is played for, read from the prompt', () => {
  it('relics to collect, a boss at the end and health: the brief says what each word decided, and the levels carry them', () => {
    const prompt = 'a haunted forest with relics to collect, a boss at the end, and health';
    const w = composeGameworld({ prompt, seed: 1 });
    expect(composeGameworld({ prompt, seed: 1 })).toEqual(w);
    const read = Object.fromEntries(w.brief.read.map((r) => [r.word, r.decides]));
    expect(read).toMatchObject({ relics: ['goal.collect'], collect: ['goal.collect'], boss: ['goal.boss'], health: ['goal.health'] });
    for (const word of ['relics', 'collect', 'boss', 'health']) expect(w.brief.unread).not.toContain(word);
    const ids = Object.keys(w.levels), last = ids.at(-1);
    expect(w.brief.goal).toEqual({ collect: 'relic', boss: last, health: true });
    // the relics and the health on every level, the boss on the last
    for (const id of ids) expect(w.levels[id].goal).toEqual({ collect: 'relic', health: true, ...(id === last ? { boss: true } : {}) });

    const S = runSteps(w, { ref: 'gw' });
    expect(fingerprint(S)).toBe(fingerprint(runSteps(w, { ref: 'gw' })));
    // the boss's figure is made first, through the hero door (a foe rolled in the game's setting)
    expect(S[0]).toMatchObject({ key: 'foe', ref: 'gw-foe', ready: true, order: { motion: null, mint: { via: 'hero' } } });
    const L = levelSteps(S);
    for (const s of L) {
      const M = gameOf(s).mechanics;
      // health: hp on the HUD (a hit's cost named), the level lost at none
      expect(M).toContainEqual({ kind: 'fail-on-death', startHp: LEVEL_GOAL.hp, hits: LEVEL_GOAL.hit });
      expect(M).toContainEqual({ kind: 'bag', slice: 'bag' });
      // the relics lie on the trail's beats (a climb has none)
      const C = M.find((m) => m.kind === 'collect');
      if (s.order.manifest.trail) expect(C.pickups.length).toBeGreaterThan(0);
      if (C) expect(C.pickups.every((p) => p.item === 'relic')).toBe(true);
      // the bag on I
      expect(s.order.manifest.play.menus).toContainEqual({ id: 'bag', kind: 'inventory', title: 'Bag' });
    }
    // the boss stands at the end of the last level's last stage: its fall ends the level, in place of the exit
    const end = L.filter((s) => s.key.startsWith(`level-${last}-`)).at(-1);
    for (const s of L) expect(kinds(s).includes('win-when')).toBe(s === end);
    expect(kinds(end)).not.toContain('reach-exit');
    expect(gameOf(end).mechanics.find((m) => m.kind === 'win-when')).toEqual({ kind: 'win-when', when: { var: 'won', gte: 1 }, event: 'battles:won' });
    const boss = end.order.manifest.entities.find((e) => e.id === 'boss');
    expect(end.order.manifest.figures.boss.heroRef).toBe('gw-foe');
    expect(readBattle(end.order.manifest.play).foes).toEqual([{ who: 'boss', at: boss.transform.pos.slice(0, 2), name: 'The boss', hp: LEVEL_GOAL.boss.hp, atk: LEVEL_GOAL.boss.atk }]);
    for (const s of L.filter((x) => x !== end)) expect(kinds(s)).toContain('reach-exit');
    // the game carries the bag the relics go into
    expect(S.at(-1).order.store.slices).toContainEqual({ name: 'bag', kind: 'inventory' });
    composes(S);
    // a fight fought by attacks alone is won with hp to spare
    const turns = Math.ceil(LEVEL_GOAL.boss.hp / 2);
    expect(LEVEL_GOAL.hp - (turns - 1) * LEVEL_GOAL.boss.atk).toBeGreaterThan(0);
  }, 300000);

  it('a prompt with no goal words lays the world as before: the same world, the same orders, byte for byte', () => {
    // (prints taken before levels could carry a goal)
    const w = composeGameworld({ prompt: 'a haunted forest of misty hills', seed: 2 });
    expect(w.brief.goal).toBeUndefined();
    expect(Object.values(w.levels).every((l) => l.goal === undefined)).toBe(true);
    expect(fingerprint(w)).toBe('31e98788');
    // (the game order now asks for the audit, its levels being reach-exit (first-frame checks, runner.js): the orders
    // without that one flag are the print taken before levels could carry a goal)
    const orders = runSteps(w, { ref: 'gw' }).map((s) => s.order);
    expect(orders.at(-1).auto_audit).toBe(true);
    const unaudited = (os) => os.map((o) => (o && 'auto_audit' in o ? (({ auto_audit: _a, ...x }) => x)(o) : o));
    expect(fingerprint(unaudited(orders))).toBe('7617ee3d');
    expect(fingerprint(unaudited(runSteps({ ...MEADOWMARK, mode: 'autonomous', review: undefined }, { ref: 'gw' }).map((s) => s.order)))).toBe('c42f5e2b');
    expect(fingerprint(unaudited(runSteps(MEADOWMARK_HERO, { ref: 'gw' }).map((s) => s.order)))).toBe('35dcc6ea');
  }, 300000);

  it('a dungeon is indoors: building levels in a room kit, the goals laid in their rooms, made by the run', () => {
    const w = composeGameworld({ prompt: 'a dungeon crawler through haunted crypts with relics and a boss', seed: 1 });
    const read = Object.fromEntries(w.brief.read.map((r) => [r.word, r.decides]));
    expect(read).toMatchObject({ dungeon: ['building'], crypts: ['building', 'geocube'], relics: ['goal.collect'], boss: ['goal.boss'] });
    const ids = Object.keys(w.levels);
    expect(w.brief.indoors).toEqual({ use: 'crypt', kit: 'gothic-stone', levels: ids });
    for (const id of ids) {
      expect(w.levels[id].building).toEqual({ use: 'crypt', kit: 'gothic-stone' });
      expect(w.levels[id].walk).toBeUndefined();
      expect(w.levels[id].goal).toEqual({ collect: 'relic', ...(id === ids.at(-1) ? { boss: true } : {}) });
    }
    const S = runSteps(w, { ref: 'gw' }), L = levelSteps(S);
    expect(S.map((s) => s.key)).toEqual(['foe', ...ids.map((id) => `level-${id}-0`), 'game']);
    for (const s of L) {
      expect(s.order.manifest).toMatchObject({ kind: 'stage', kit: 'gothic-stone', program: { use: 'crypt' } });
      const C = gameOf(s).mechanics.find((m) => m.kind === 'collect');
      // the relics lie in the rooms between the way in and the tomb
      expect(C.pickups.length).toBeGreaterThan(0);
      expect(C.pickups.every((p) => p.item === 'relic')).toBe(true);
    }
    // the boss in the last crypt's tomb, beside the level's own walker: its fall ends it, the tomb no longer the exit
    const end = L.at(-1);
    expect(kinds(end)).toEqual(['collect', 'bag', 'fail-on-death', 'win-when']);
    expect(end.order.manifest.level.exit).toBe(false);
    expect(end.order.manifest.entities.map((e) => [e.id, !!e.pilotable])).toEqual([['player', true], ['boss', false]]);
    expect(withBuildingLevel(end.order.manifest, end.ref).entities.map((e) => e.id)).toEqual(['player', 'boss']);
    expect(readBattle(end.order.manifest.play).foes[0].who).toBe('boss');
    for (const s of L.slice(0, -1)) expect(kinds(s)).toEqual(['collect', 'bag', 'reach-exit']);
    composes(S);
    // named ground outside: the first level is that ground, the way in; a temple is a temple in a nave
    const T = composeGameworld({ prompt: 'a dark forest above a temple tomb', seed: 1 }), tids = Object.keys(T.levels);
    expect(T.levels[tids[0]].walk).toBeDefined();
    expect(tids.slice(1).map((id) => T.levels[id].building)).toEqual(tids.slice(1).map(() => ({ use: 'temple', kit: 'catacomb' })));
    expect(T.brief.read.find((r) => r.word === 'temple').decides).toContain('building.use');
  }, 300000);

  it('a level goal is a level setting: read, refused where it cannot be laid; a booked world plays it too', () => {
    const lv = (goal, extra = {}) => ({ ...MEADOWMARK, levels: { ...MEADOWMARK.levels, 'meadow-ascent': { ...MEADOWMARK.levels['meadow-ascent'], goal } }, ...extra });
    expect(readGameworld(lv({ collect: 'coin', boss: true, health: true })).levels['meadow-ascent'].goal).toEqual({ collect: 'coin', boss: true, health: true });
    expect(() => readGameworld(lv({}))).toThrow(/at least one/);
    expect(() => readGameworld(lv({ treasure: true }))).toThrow(/not a level goal \(collect, boss, health\)/);
    expect(() => readGameworld(lv({ collect: 'Big Gems' }))).toThrow(/one lower-case word/);
    expect(() => readGameworld(lv({ boss: 2 }))).toThrow(/boss is true/);
    // a book's world: its hero fights the boss, the goal's play beside the systems' own
    const W = { ...MEADOWMARK_HERO, levels: { ...MEADOWMARK_HERO.levels, 'meadow-ascent': { ...MEADOWMARK_HERO.levels['meadow-ascent'], goal: { collect: 'coin', boss: true } } } };
    const S = runSteps(W, { ref: 'gw' });
    expect(S.map((s) => s.key)).toContain('foe');
    const A = levelSteps(S).filter((s) => s.key.startsWith('level-meadow-ascent-'));
    expect(A.every((s) => kinds(s).includes('collect') || !s.order.manifest.trail)).toBe(true);
    expect(kinds(A.at(-1))).toContain('win-when');
    const sys = S.find((s) => s.key === 'systems'), own = sys.order.manifest?.play?.menus ?? [];
    for (const m of own) expect(A[0].order.manifest.play.menus).toContainEqual(m);
    // the other level is as it was
    const before = levelSteps(runSteps(MEADOWMARK_HERO, { ref: 'gw' })).filter((s) => s.key.startsWith('level-shell-shore-'));
    expect(levelSteps(S).filter((s) => s.key.startsWith('level-shell-shore-')).map((s) => s.print)).toEqual(before.map((s) => s.print));
  }, 300000);
});
