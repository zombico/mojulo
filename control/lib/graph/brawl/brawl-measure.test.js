import { describe, it, expect } from 'vitest';
import { measureStreet, measureMap, fightLaws, tieredStreet, MEASURE_BOTS, MEASURE_BOT_IDS, MEASURE_TIERS, FIGHT_LAWS, FIGHT_LIMITS } from './brawl-measure.js';
import { STREET_DIFFICULTY } from './brawl-street-read.js';
import { PLAY_IDS } from './brawl-play.js';
import { readBelt } from './brawl-belt.js';
import { solveFighter } from '../versus/versus-solver.js';

// the smallest map that is one: a way in, one held screen
const belt = readBelt({ at: [0, 0], heading: 0, screens: [{ length: 10 }, { length: 12, gate: true }] });
const me = { recipe: { ...solveFighter({ id: 'me', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' }, style: 'all-rounder' };
const brawl = (over = {}) => ({ belt, players: [me], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 1 }] }], ...over });
const gun = (over = {}) => brawl({ gunner: { guns: ['machine-gun'], grenades: 2 }, waves: [{ screen: 0, crowd: [{ type: 'rifleman', n: 1 }] }, { screen: 1, crowd: [{ type: 'rifleman', n: 1 }, { type: 'thug', n: 1 }] }], ...over });

describe('the measure\'s bots', () => {
  it('each plays every play type, and the tiers are the street\'s', () => {
    for (const id of MEASURE_BOT_IDS) for (const play of PLAY_IDS) expect(typeof MEASURE_BOTS[id][play], `${id}.${play}`).toBe('function');
    expect(MEASURE_TIERS).toEqual(Object.keys(STREET_DIFFICULTY));
    expect(() => measureStreet(brawl(), { bot: 'wizard' })).toThrow(/measured with/);
    expect(() => tieredStreet(brawl(), 'nightmare')).toThrow(/measured at/);
  });
  it('a tier lays its crowd\'s rules and its boss\'s mind on the street, as the page does', () => {
    expect(tieredStreet(brawl(), 'easy').crowd).toEqual({ ...STREET_DIFFICULTY.easy.crowd });
    const boss = { recipe: me.recipe, cpu: 'regular' }, T = tieredStreet(brawl({ waves: [{ screen: 1, crowd: [], boss }] }), 'max');
    expect(T.waves[0].boss.cpu).not.toBe('regular');
  });
});

describe('a street measured', () => {
  it('a brawl: the floor player fells one thug on easy; the run says how each wave went', () => {
    const r = measureStreet(brawl(), { bot: 'masher', tier: 'easy', takes: 1, secs: 90 });
    expect(r).toMatchObject({ bot: 'masher', tier: 'easy', play: 'brawl', result: 'won', takes: 1, won: 1 });
    expect(r.waves).toHaveLength(1);
    expect(r.waves[0]).toMatchObject({ screen: 1, held: true, felled: 1, of: 1, reached: true });
    expect(r.waves[0].seconds).toBeGreaterThan(0);
    expect(r.health).toBeGreaterThan(0);
    expect(r.rounds).toBeUndefined();
  });
  it('a run & gun: its rounds are counted, and an open screen\'s wave is in the run', () => {
    const r = measureStreet(gun(), { bot: 'careful', tier: 'easy', takes: 1, secs: 120 });
    expect(r.play).toBe('gun');
    expect(r.result).toBe('won');
    expect(r.waves.map((w) => w.held)).toEqual([false, true]);
    expect(r.rounds.fired).toBeGreaterThan(0);
    expect(r.rounds.landed).toBeGreaterThan(0);
  });
  it('measures the same twice, and takes the middle of its takes', () => {
    const a = measureStreet(brawl(), { takes: 3, secs: 90 }), b = measureStreet(brawl(), { takes: 3, secs: 90 });
    expect(a).toEqual(b);
    expect(a.takes).toBe(3);
    expect(a.won).toBeLessThanOrEqual(3);
    expect(() => measureStreet(brawl(), { takes: 0 })).toThrow(/takes/);
  });
  it('a wave no player can beat is lost, and said: the run ends where it fell', () => {
    // (a player a blow or two fells, against a crowd)
    const frail = { ...me, recipe: { ...me.recipe, hp: 60 } };
    const r = measureStreet(brawl({ players: [frail], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 6 }, { type: 'knife', n: 6 }] }] }), { bot: 'masher', tier: 'max', takes: 1, secs: 240 });
    expect(r.result).toBe('lost');
    expect(r.health).toBe(0);
    expect(r.waves[0].felled).toBeLessThan(r.waves[0].of);
  });
});

describe('the fight laws', () => {
  const run = (bot, tier, over = {}) => ({ bot, tier, takes: 1, won: 1, result: 'won', seconds: 60, health: 0.6, at: 30, waves: [{ screen: 1, held: true, seconds: 20, lost: 0.1, felled: 2, of: 2, reached: true }, { screen: 2, held: true, seconds: 30, lost: 0.3, felled: 3, of: 3, reached: true }], ...over });
  const all = (over = {}) => [run('masher', 'easy', over['masher/easy']), run('careful', 'medium', over['careful/medium']), run('careful', 'max', over['careful/max'])];
  const lost = (runs) => fightLaws(runs).filter((l) => !l.ok).map((l) => l.id);
  it('every law is said, and a fair map holds them all', () => {
    const L = fightLaws(all());
    expect(L.map((l) => l.id).sort()).toEqual(Object.keys(FIGHT_LAWS).sort());
    expect(L.every((l) => l.ok && l.says === FIGHT_LAWS[l.id])).toBe(true);
  });
  it('each law is lost by what it names, with advice that names the wave', () => {
    expect(lost(all({ 'masher/easy': { result: 'lost', health: 0 } }))).toEqual(['easy-is-won']);
    expect(lost(all({ 'careful/medium': { health: FIGHT_LIMITS.kept - 0.05 } }))).toEqual(['care-is-rewarded']);
    expect(lost(all({ 'careful/max': { result: 'lost' } }))).toEqual(['max-can-be-won']);
    const spike = all({ 'careful/medium': { waves: [{ screen: 1, held: true, seconds: 20, lost: 0.1, felled: 2, of: 2, reached: true }, { screen: 2, held: true, seconds: 30, lost: FIGHT_LIMITS.spike + 0.1, felled: 3, of: 3, reached: true }] } });
    expect(lost(spike)).toEqual(['no-spike']);
    expect(fightLaws(spike).find((l) => l.id === 'no-spike').advice).toMatch(/screen 3/);
    const slog = all({ 'careful/medium': { waves: [{ screen: 1, held: true, seconds: FIGHT_LIMITS.slog + 5, lost: 0.1, felled: 2, of: 2, reached: true }] } });
    expect(lost(slog)).toEqual(['no-slog']);
    const steep = all({ 'careful/medium': { waves: [{ screen: 1, held: true, seconds: 20, lost: 0.4, felled: 2, of: 2, reached: true }, { screen: 2, held: true, seconds: 30, lost: 0.1, felled: 3, of: 3, reached: true }] } });
    expect(lost(steep)).toEqual(['it-opens-gently']);
    expect(lost(all({ 'careful/max': { result: 'timeout' } }))).toEqual(['max-can-be-won', 'it-ends']);
  });
  it('a law with no run to read it off is not said', () => {
    expect(fightLaws([run('masher', 'easy')]).map((l) => l.id)).toEqual(['easy-is-won', 'it-ends']);
    expect(fightLaws([])).toEqual([]);
  });
  it('a map measured is its runs and the laws read off them', () => {
    const M = measureMap(brawl(), { takes: 1, secs: 90, bots: ['masher'], tiers: ['easy'] });
    expect(M.runs).toHaveLength(1);
    expect(M.laws.find((l) => l.id === 'easy-is-won').ok).toBe(true);
  });
});
