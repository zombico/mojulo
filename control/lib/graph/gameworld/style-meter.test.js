// A GAME'S STYLE METER (style-meter.js): read on the world, laid on its levels where it is asked for, nothing where not.
import { describe, it, expect } from 'vitest';
import { readStyleMeter, styleMeterOfGame, styleMeterSuggestion, levelRankOf, vitalsOf, PAR, STYLISH, VITALS_LOOKS, HALO_FULL } from './style-meter.js';
import { MEADOWMARK_HERO, readGameworld } from './index.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { layTasks, tasksCast } from './tasks.js';
import { actionFirstLevel } from './action-first-level.js';
import { POLE_IDS } from './feel/cards.js';
import { GAMEWORLD_KEYS } from './world.js';

const OTHER = POLE_IDS.find((id) => !STYLISH.includes(id));

describe('a game\'s style meter', () => {
  it('is the stylish template\'s on auto, the world\'s own where written, none where not', () => {
    expect(GAMEWORLD_KEYS).toContain('styleMeter');
    expect(styleMeterOfGame({ feel: STYLISH[0], styleMeter: 'auto' })).toMatchObject({ styleMeter: {}, from: 'feel' });
    expect(styleMeterOfGame({ feel: OTHER, styleMeter: 'auto' })).toBeNull();
    expect(styleMeterOfGame({ feel: OTHER, styleMeter: true })).toMatchObject({ styleMeter: {}, from: 'operator' });
    expect(styleMeterOfGame({ feel: OTHER, styleMeter: { tiers: ['dull', 'keen'], step: 50 } }).styleMeter.step).toBe(50);
    for (const none of [undefined, null, false]) expect(styleMeterOfGame({ feel: STYLISH[0], styleMeter: none })).toBeNull();
  });
  it('is offered to a stylish game that writes none, and says what it takes', () => {
    expect(styleMeterSuggestion({ feel: STYLISH[0] })).toMatchObject({ suggest: 'auto' });
    expect(styleMeterSuggestion({ feel: OTHER })).toBeNull();
    expect(styleMeterSuggestion({ feel: STYLISH[0], styleMeter: false })).toBeNull();
    for (const [bad, says] of [['loud', /is 'auto'/], [{ ranks: [] }, /has no 'ranks'/], [{ tiers: ['one'] }, /tiers is/], [{ repeat: 2 }, /repeat is/], [{ gain: { taunt: 5 } }, /not a gain/], [{ step: -1 }, /step is/]]) expect(() => readStyleMeter(bad), JSON.stringify(bad)).toThrow(says);
  });
  it('a level of a game that carries the meter shows it on its HUD and is ranked on its results, its par counted from its tasks', () => {
    const A = actionFirstLevel(), { start: _s, links: _l, ...base } = MEADOWMARK_HERO;
    const world = (more) => readGameworld({ ...base, id: 'ranked', feel: STYLISH[0], arsenal: 'auto', foes: A.foes, fights: A.fights, levels: { citadel: A.level }, ...more });
    const made = (G) => { const st = gameStages(G).find((x) => x.level === 'citadel'), L = layTasks(G, 'citadel', st); return { L, m: stageLevelOrder(G, st, { ref: 'lv', heroRef: 'gw-hero', goal: () => [{ ...L.mechanic, audit: L.audits[0] }], extra: () => tasksCast(G, 'citadel', st, { refs: {}, hero: true }) }).args.manifest }; };
    const G = world({ styleMeter: 'auto' }), { L, m } = made(G);
    const foes = L.laid.flatMap((t) => t.placed.flat()).length;
    expect(levelRankOf(G, 'citadel')).toEqual({ par: PAR.task * L.laid.length + PAR.foe * foes });
    expect(m.level.rank).toEqual(levelRankOf(G, 'citadel'));   // (a building's game is made from its `level`)
    expect(m.manaHud).toMatchObject({ rows: 'events', style: true });
    expect(m.manaHud.vitals).toEqual(vitalsOf(G));
    expect(m.styleMeter.vitals).toBeUndefined();   // (the HUD's, kept off the page's meter)
    // (the way on: an arrow to each task's ring in turn, named by the gauntlet's arm)
    expect(m.manaHud.ways).toEqual({ var: '__wg_tasks_arm', at: L.mechanic.arenas.map((x) => x.enter.at) });
    // (a game with no meter: no rank, and its HUD as it was)
    const plain = made(world({})).m;
    expect(plain.level.rank).toBeUndefined();
    expect(plain.manaHud).toBeUndefined();
    expect(levelRankOf(world({}), 'citadel')).toBeNull();
  }, 120000);
  it('the vitals: the stylish template lays a Halo Meter, drawn with the health in a look, at their lengths at the game\'s end', () => {
    expect(styleMeterOfGame({ feel: STYLISH[0], styleMeter: 'auto' }).styleMeter.halo).toEqual({});
    expect(vitalsOf({ feel: STYLISH[0], styleMeter: 'auto' })).toEqual({ look: VITALS_LOOKS[0], full: { halo: HALO_FULL } });
    const own = { feel: STYLISH[0], styleMeter: { halo: { stocks: 2 }, vitals: { look: VITALS_LOOKS[1], hp: 300, halo: 8 } } };
    expect(vitalsOf(own)).toEqual({ look: VITALS_LOOKS[1], full: { hp: 300, halo: 8 } });
    expect(vitalsOf({ feel: STYLISH[0] })).toBeNull();
    expect(() => readStyleMeter({ vitals: { look: 'bold' } })).toThrow(/vitals.look/);
    expect(() => readStyleMeter({ halo: { stocks: 0 } })).toThrow(/halo.stocks/);
  });
});
