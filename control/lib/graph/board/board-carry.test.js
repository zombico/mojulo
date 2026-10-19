import { describe, it, expect } from 'vitest';
import { buildBoardCarry, boardCarryUnits, boardCarryGain, boardCarryChanges, boardCarryDraw } from './board-carry.js';
import { BOARD_CLASSES } from './board-battle.js';
import { readRpg } from '../playscape/rpg/rpg.js';
import { buildRpg, rpgInit, rpgSave, rpgStart, rpgRound, rpgTargets, rpgStatsOf, rpgLoad } from '../playscape/rpg/kernel.js';

const RK = buildRpg();
const roster = (saved) => Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, { stats: v }]));
const sansLife = (s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'hp' && k !== 'mp'));

describe('the party carried through a board battle', () => {
  it('gains as the party battles gain: the same xp and class points give the same levels, ranks, points and skills', () => {
    for (const foe of ['slime', 'drake']) {
      const cfg = readRpg({ rpg: { party: [{ id: 'ayla', class: 'fighter', bonus: { atk: 999, hp: 999, spd: 99 } }], encounters: [{ id: 'e', foes: [foe] }], rules: { turns: 'timeline' } } });
      const R = rpgInit(cfg), before = rpgSave(cfg, R), vars = {};
      rpgStart(cfg, R, 'e', vars);
      for (let k = 0; k < 20 && R.b && R.b.phase === 'command'; k++) {
        const who = R.b.turn;
        rpgRound(cfg, R, { [who]: { act: 'attack', target: rpgTargets(cfg, R, { act: 'attack' })[0].id } }, vars);
      }
      expect(R.b.phase, foe).toBe('won');
      const F = cfg.foes[foe], theirs = rpgSave(cfg, R), ours = boardCarryGain(RK, cfg, before, ['ayla'], F.xp, F.cp);
      expect(sansLife(ours.ayla), foe).toEqual(sansLife(theirs.ayla));
      expect(theirs.ayla.lv).toBeGreaterThanOrEqual(1);
    }
    // and leaves the member at full HP and MP after it
    const cfg = readRpg({ rpg: { party: [{ id: 'bram', class: 'mage' }] } }), R = rpgInit(cfg), saved = rpgSave(cfg, R);
    const after = boardCarryGain(RK, cfg, saved, ['bram'], 500, 0), L = rpgInit(cfg);
    rpgLoad(cfg, L, roster(after), {});
    expect([after.bram.hp, after.bram.mp]).toEqual([rpgStatsOf(cfg, L, 'bram').hp, rpgStatsOf(cfg, L, 'bram').mp]);
  });

  it('stands each member as its numbers say: level, class (and its legs), skills, at full HP; others as they were', () => {
    const cfg = readRpg({ rpg: { party: [{ id: 'bram', class: 'mage', classes: ['mage', 'cleric'] }, { id: 'cass', class: 'cleric' }] } });
    const R = rpgInit(cfg), saved = rpgSave(cfg, R);
    saved.bram.lv = 6; saved.bram['cls.mage'] = 0; saved.bram['cls.cleric'] = 1; saved.bram['cp.cleric'] = 0; saved.bram.hp = 1;
    const units = [{ id: 'bram', side: 'party', class: 'mage', move: 3, jump: 2, skills: ['fire'] }, { id: 'g', side: 'foe', hp: 22 }];
    const out = boardCarryUnits(RK, cfg, units, roster(saved), BOARD_CLASSES);
    const L = rpgInit(cfg);
    rpgLoad(cfg, L, roster(saved), {});
    const S = rpgStatsOf(cfg, L, 'bram');
    expect(out[0]).toMatchObject({ class: 'cleric', hp: S.hp, hpMax: S.hp, mag: S.mag, move: BOARD_CLASSES.cleric.move });
    expect(out[0].skills).toContain('heal');
    expect(out[1]).toBe(units[1]);
    expect(boardCarryUnits(RK, cfg, units, null, BOARD_CLASSES)).toEqual(units);
  });

  it('says only the numbers that moved, and runs alone from its source', () => {
    expect(boardCarryChanges({ a: { lv: 1, xp: 0, 'skill.x': 1 } }, { a: { lv: 2, xp: 30 } })).toEqual([{ id: 'a', stat: 'lv', value: 2 }, { id: 'a', stat: 'xp', value: 30 }, { id: 'a', stat: 'skill.x', value: 0 }]);
    const page = new Function(`return (${buildBoardCarry.toString()})();`)();
    const cfg = readRpg({ rpg: { party: [{ id: 'a', class: 'monk' }] } }), saved = rpgSave(cfg, rpgInit(cfg));
    expect(page.gain(RK, cfg, saved, ['a'], 40, 3)).toEqual(boardCarryGain(RK, cfg, saved, ['a'], 40, 3));
  });

  it('draws a pack scaled to the party: its mean level less one, give or take one; the same numbers the same pack', () => {
    const cfg = readRpg({ rpg: { party: [{ id: 'a', class: 'fighter' }, { id: 'b', class: 'mage' }] } });
    const at = (lv, xp) => roster({ a: { lv, xp }, b: { lv, xp } });
    const picks = (lv) => new Set(Array.from({ length: 24 }, (_, xp) => boardCarryDraw(cfg, at(lv, xp * 7), 8, 'seed')));
    for (const lv of [1, 4, 8]) for (const t of picks(lv)) expect(Math.abs(t - Math.min(7, lv - 1))).toBeLessThanOrEqual(1);
    expect(picks(4).size).toBeGreaterThan(1);
    expect([...picks(1)].every((t) => t <= 1)).toBe(true);
    expect([...picks(20)].every((t) => t === 7)).toBe(true);
    expect(boardCarryDraw(cfg, at(4, 30), 8, 's')).toBe(boardCarryDraw(cfg, at(4, 30), 8, 's'));
    // no roster: the levels the book gives
    expect(boardCarryDraw(cfg, null, 8, 's')).toBeLessThanOrEqual(1);
  });
});
