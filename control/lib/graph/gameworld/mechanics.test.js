import { describe, it, expect } from 'vitest';
import { readMechanics, resolveMechanics, mechanicsOrders, resolveBook, readGameworld, gameworldBibleHtml, characterParts, MEADOWMARK, MEADOWMARK_HERO, IDIOMS, SCALE, EPOCH_LEVEL } from './index.js';
import { readStats } from '../playscape/stats/stats.js';
import { lowerPlay } from '../playscape/ui/direction.js';
import { readPart } from '../playscape/ui/parts.js';

const bad = (m, re) => expect(() => readMechanics(m)).toThrow(re);
const hero = MEADOWMARK_HERO.characters.hero;
const withActions = (actions, mechanics = {}, adornment = hero.adornment) => ({ ...MEADOWMARK_HERO, mechanics, characters: { ...MEADOWMARK_HERO.characters, hero: { ...hero, actions, adornment } } });
const idiom = (name, more = {}) => withActions({ idiom: name, powers: hero.actions.powers, progression: hero.actions.progression }, more);
const book = (w) => resolveBook(w);
const lowers = (play) => lowerPlay({ kind: 'controllable', play: { ...play, ui: undefined } });

describe('the game\'s systems', () => {
  it('says what is wrong', () => {
    bad([], /mechanics is \{ stats\?, scale\?, hud\?, ui\?, gear\? \}/);
    bad({ numbers: {} }, /numbers is not part of the mechanics/);
    bad({ scale: { hp: -1 } }, /scale.hp is a number above 0/);
    bad({ scale: { curve: 0.5 } }, /scale.curve is a number above 0, 1 or more/);
    bad({ scale: { luck: 2 } }, /scale.luck is not a dial/);
    bad({ hud: 'big' }, /hud is 'derive'/);
    bad({ hud: [{ part: 'nope' }] }, /parts:/);
    bad({ ui: 3 }, /ui is 'propose', 'auto'/);
    bad({ gear: { lance: {} } }, /gear.lance: not a class of gear/);
    bad({ gear: { staff: { by: [1, 2] } } }, /gear.staff.by is three numbers/);
    expect(() => readGameworld({ ...MEADOWMARK, mechanics: { numbers: 1 } })).toThrow(/numbers is not part of the mechanics/);
  });

  it('a world without mechanics has none: no parts content, and the world bible is unchanged', () => {
    const { mechanics, ...without } = MEADOWMARK_HERO;
    expect(book(without).mechanics).toBeNull();
    expect(characterParts(without).find((p) => p.id === 'mechanics:stats').content).toBeNull();
    expect(gameworldBibleHtml({ ...MEADOWMARK, mechanics: null })).toBe(gameworldBibleHtml(MEADOWMARK));
    // with mechanics, the world bible's open Mechanics card is dropped
    expect(gameworldBibleHtml(MEADOWMARK)).toMatch(/<h3>Mechanics<\/h3>/);
    expect(gameworldBibleHtml({ ...MEADOWMARK, mechanics: {} })).not.toMatch(/<h3>Mechanics<\/h3>/);
  });

  it('the example (metroidvania-like): the stages are epochs by level, the powers free nodes found in the world, the staff a tier per stage', () => {
    const M = book({ ...MEADOWMARK_HERO, mechanics: {} }).mechanics, S = M.play.stats;
    expect(S.epochs).toEqual([{ id: 'early' }, { id: 'mid', level: EPOCH_LEVEL.mid }, { id: 'late', level: EPOCH_LEVEL.late }]);
    expect(S.tree.filter((n) => !n.gives)).toEqual([{ id: 'gust-step', epoch: 'early' }, { id: 'wind-orb', epoch: 'mid' }, { id: 'cyclone', epoch: 'late' }]);
    expect(S.tree.find((n) => n.id === 'staff-mid')).toEqual({ id: 'staff-mid', epoch: 'mid', requires: { has: 'staff-early' }, gives: { raise: { power: 3 } } });
    expect(S.stats.map((x) => x.id)).toEqual(['hp', 'power', 'guard']);
    expect(S.bodies).toEqual({ hpMax: 'hp' });
    expect(M.open).toEqual([]);
    expect(M.reasons.join('\n')).toMatch(/wind-orb \(mid\): found in the world/);
    expect(() => readStats({ stats: S })).not.toThrow();
  });

  it('every idiom derives stats the kernel reads and a play block that lowers; every power is on the tree and every stage an epoch', () => {
    for (const name of Object.keys(IDIOMS)) {
      const M = book(idiom(name)).mechanics, S = M.play.stats;
      expect(() => readStats({ stats: S }), name).not.toThrow();
      expect(() => lowers(M.play), name).not.toThrow();
      for (const p of hero.actions.powers) expect(S.tree.some((n) => n.id === p.id), `${name} ${p.id}`).toBe(true);
      expect(S.epochs.map((e) => e.id), name).toEqual(['early', 'mid', 'late']);
      expect(M.open, name).toEqual([]);
    }
  });

  it('each system gains its powers its own way', () => {
    const S = (name) => book(idiom(name)).mechanics.play.stats;
    // shonen-like: bought with points, a resource the powers spend, each form after the first raising power
    const sh = S('shonen-like');
    expect(sh.tree.find((n) => n.id === 'wind-orb').cost).toEqual({ points: SCALE.cost * 2 });
    expect(sh.resources.map((r) => r.id)).toEqual(['ki', 'points']);
    expect(sh.level.at).toEqual({ 5: { raise: { power: 5 } }, 10: { raise: { power: 5 } } });
    expect(sh.level.each.grant).toEqual({ points: SCALE.cost });
    // soulslike: learned powers, the gear and the upgrades offered for coin
    const so = S('soulslike');
    expect(so.tree.find((n) => n.id === 'wind-orb').cost).toBeUndefined();
    expect(so.offers.map((o) => o.id)).toEqual(['staff-early', 'staff-mid', 'staff-late', 'vigor', 'might']);
    expect(so.offers.find((o) => o.id === 'staff-mid')).toMatchObject({ cost: { coin: 20 }, requires: { all: [{ epoch: 'mid' }, { has: 'staff-early' }] }, max: 1 });
    // action-adventure-like: a power is opened by the item that serves it; what the body carries needs none
    const aa = S('action-adventure-like');
    expect(aa.tree.find((n) => n.id === 'wind-orb').requires).toEqual({ has: 'staff-early' });
    expect(aa.tree.find((n) => n.id === 'gust-step').requires).toBeUndefined();
  });

  it('how each power is used is carried as data: what it spends, and how hard an attack lands by stage', () => {
    const M = book(idiom('shonen-like')).mechanics;
    expect(M.powers.find((p) => p.id === 'wind-orb')).toEqual({ id: 'wind-orb', spends: { ki: 20 }, hurt: { stat: 'power', per: 1.2 } });
    expect(M.powers.find((p) => p.id === 'gust-step')).toEqual({ id: 'gust-step', spends: { ki: 10 } });
  });

  it('the dials scale the derivation; the creator\'s numbers lay over it by id and key, ledgered; the kernel judges them', () => {
    const scaled = book({ ...MEADOWMARK_HERO, mechanics: { scale: { hp: 200, curve: 2 } } }).mechanics.play.stats;
    expect(scaled.stats[0]).toEqual({ id: 'hp', base: 200, min: 1 });
    expect(scaled.level.xp).toEqual({ base: 100, growth: 2 });
    const M = book({ ...MEADOWMARK_HERO, mechanics: { stats: { stats: [{ id: 'hp', base: 60 }, { id: 'luck', base: 1 }], level: { max: 20 } } } }).mechanics;
    expect(M.play.stats.stats.find((x) => x.id === 'hp')).toEqual({ id: 'hp', base: 60 });
    expect(M.play.stats.stats.find((x) => x.id === 'luck')).toEqual({ id: 'luck', base: 1 });
    expect(M.play.stats.level.max).toBe(20);
    expect(M.ledger).toEqual([
      { scope: 'mechanics', at: 'mechanics.stats.stats.hp', key: 'hp', world: 'derived', local: 'own' },
      { scope: 'mechanics', at: 'mechanics.stats.stats.luck', key: 'luck', world: 'none', local: 'own' },
      { scope: 'mechanics', at: 'mechanics.stats.level.max', key: 'max', world: 10, local: 20 },
    ]);
    expect(() => book({ ...MEADOWMARK_HERO, mechanics: { stats: { tree: [{ id: 'x', epoch: 'never' }] } } })).toThrow(/mechanics: the stats, with the creator's own laid over: .*'never' is no epoch/);
  });

  it('the gear a class raises can be the creator\'s', () => {
    const S = book({ ...MEADOWMARK_HERO, mechanics: { gear: { staff: { stat: 'guard', by: [1, 1, 1] } } } }).mechanics.play.stats;
    expect(S.tree.find((n) => n.id === 'staff-late').gives).toEqual({ raise: { guard: 1 } });
  });

  it('the HUD: hp, the resource and the level, banners on each level and epoch, a status page; none, or the creator\'s own', () => {
    const M = book(idiom('shonen-like')).mechanics;
    expect(M.play.parts.map((p) => p.id)).toEqual(['hp', 'ki', 'level']);
    M.play.parts.forEach((p, i) => expect(() => readPart(p, i)).not.toThrow());
    expect(M.play.cues.map((c) => c.id)).toEqual(['level-up', 'epoch-mid', 'epoch-late']);
    expect(M.play.menus[0]).toMatchObject({ id: 'status', kind: 'list' });
    expect(M.play.ui).toBe('propose');
    const L = lowers(M.play);
    expect(L.hud.length).toBeGreaterThanOrEqual(3);
    expect(L.stats).toBeTruthy();
    const none = book({ ...MEADOWMARK_HERO, mechanics: { hud: false, ui: 'auto' } }).mechanics.play;
    expect(none).not.toHaveProperty('parts');
    expect(none.ui).toBe('auto');
    const own = [{ part: 'readout', variant: 'bar', bind: { var: 'player.power' }, at: 'top-right', label: 'POW', max: 50 }];
    expect(book({ ...MEADOWMARK_HERO, mechanics: { hud: own } }).mechanics.play.parts).toEqual(own);
  });

  it('orders: a playable world with the hero and the play block', () => {
    const B = book({ ...MEADOWMARK_HERO, mechanics: {} }), O = mechanicsOrders(B.G, B.mechanics);
    expect(O).toMatchObject({ tool: 'create_sketch', part: 'mechanics:stats', args: { title: 'Meadowmark · systems', manifest: { kind: 'controllable', play: B.mechanics.play } } });
    expect(O.args.manifest.figures.hero).toMatchObject({ heroRef: '<ref of the hero mint>' });
    expect(mechanicsOrders(B.G, null)).toBeNull();
  });

  it('pure: the same world, the same systems', () => {
    const w = idiom('shonen-like');
    expect(JSON.stringify(resolveMechanics(readGameworld(w), book(w)))).toBe(JSON.stringify(book(w).mechanics));
  });
});
