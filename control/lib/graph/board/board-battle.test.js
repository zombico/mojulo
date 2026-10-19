import { describe, it, expect } from 'vitest';
import { readBoardBattle, skillShape, BOARD_CLASSES } from './board-battle.js';
import { boardOf, boardStart, boardApply, boardLegal, boardParse, boardUsable, boardItems } from './board-kernel.js';
import { readRpg } from '../playscape/rpg/rpg.js';
import { rpgInit, rpgStart, rpgRound, rpgTargets, rpgStatsOf } from '../playscape/rpg/kernel.js';

const flat = (cols, rows) => boardOf(Array.from({ length: rows }, () => Array(cols).fill(0)));
// it is `who`'s turn now, the dice where the test wants them
const turnOf = (S, who, r) => ({ ...S, r: r ?? S.r, turn: { who, moved: false, acted: false } });

// the party battles' own blow: their kernel on its timeline, `who` waiting its turn (the others guarding), the dice
// set to `r` just before it acts. → its first beat on the target
function rpgBlow(rpgSpec, who, pick, r) {
  const cfg = readRpg({ rpg: { ...rpgSpec, rules: { turns: 'timeline' } } }), R = rpgInit(cfg), vars = {};
  rpgStart(cfg, R, 'board', vars);
  for (let k = 0; k < 40 && R.b.turn !== who; k++) rpgRound(cfg, R, { [R.b.turn]: { act: 'guard' } }, vars);
  R.b.r = r;
  const target = rpgTargets(cfg, R, pick)[0].id;
  return rpgRound(cfg, R, { [who]: { ...pick, target } }, vars).find((b) => b.by === who && (b.kind === 'hurt' || b.kind === 'miss'));
}

describe('a board battle read from the party battles\' book', () => {
  it('stands the party in its classes, at its level, in its gear, with the legs its class gives', () => {
    const { units, rpg } = readBoardBattle({ party: [{ id: 'ayla', class: 'fighter', at: 'A1' }, { id: 'bram', class: 'mage', level: 3, at: 'B1', skills: ['blizzard'] }], foes: [{ id: 'g', foe: 'goblin', at: 'D4' }] });
    const R = rpgInit(rpg), bram = units.find((u) => u.id === 'bram');
    const S = rpgStatsOf(rpg, R, 'bram');
    expect([bram.hpMax, bram.mpMax, bram.atk, bram.def, bram.mag, bram.spd]).toEqual([S.hp, S.mp, S.atk, S.def, S.mag, S.spd]);
    expect([bram.move, bram.jump]).toEqual([BOARD_CLASSES.mage.move, BOARD_CLASSES.mage.jump]);
    expect(bram.skills).toEqual(['fire', 'blizzard']);
    const g = units.find((u) => u.id === 'g');
    expect([g.hp, g.atk, g.side, g.move]).toEqual([22, 9, 'foe', 4]);
  });

  it('shapes a skill by what it is: a blow the next spot, a spell four, a mending three, many an area, self its own spot', () => {
    const { cfg } = readBoardBattle({ party: [{ id: 'a', class: 'cleric', at: 'A1', skills: ['power-strike', 'fire', 'heal-all', 'raise', 'cleave'] }], foes: [{ id: 'g', foe: 'goblin', at: 'D4' }] });
    const shape = (k) => { const { min, max, area } = cfg.skills[k]; return [min, max, area]; };
    expect(shape('power-strike')).toEqual([1, 1, 0]);
    expect(shape('fire')).toEqual([1, 4, 0]);
    expect(shape('heal')).toEqual([0, 3, 0]);
    expect(shape('raise')).toEqual([1, 3, 0]);
    expect(shape('cleave')).toEqual([1, 1, 1]);
    expect(shape('heal-all')).toEqual([0, 0, 2]);
    expect(skillShape({ target: 'self' })).toMatchObject({ min: 0, max: 0 });
  });

  it('strikes as the party battles strike: the same dice give the same miss, crit and damage, a blow and a spell', () => {
    const blow = (r) => {
      const { cfg, units } = readBoardBattle({ party: [{ id: 'ayla', class: 'fighter', at: 'A1' }], foes: [{ id: 'g', foe: 'goblin', at: 'A2', face: 's' }] });
      const B = flat(2, 2), S = turnOf(boardStart(B, cfg, units), 'ayla', r);
      return boardApply(B, cfg, S, { kind: 'act', skill: 'attack', at: boardParse(B, 'A2') }).beats.find((b) => b.by === 'ayla');
    };
    const spell = (r) => {
      const { cfg, units } = readBoardBattle({ party: [{ id: 'bram', class: 'mage', at: 'A1' }], foes: [{ id: 'w', foe: 'wisp', at: 'A3', face: 's' }] });
      const B = flat(2, 3), S = turnOf(boardStart(B, cfg, units), 'bram', r);
      return boardApply(B, cfg, S, { kind: 'act', skill: 'fire', at: boardParse(B, 'A3') }).beats.find((b) => b.by === 'bram');
    };
    for (let r = 1; r <= 60; r++) {
      const a = rpgBlow({ party: [{ id: 'ayla', class: 'fighter' }], encounters: [{ id: 'board', foes: ['goblin'] }] }, 'ayla', { act: 'attack' }, r * 7919);
      const b = blow(r * 7919);
      expect([b.kind, b.amount, !!b.crit], `attack, dice ${r}`).toEqual([a.kind, a.amount, !!a.crit]);
      const c = rpgBlow({ party: [{ id: 'bram', class: 'mage' }], encounters: [{ id: 'board', foes: ['wisp'] }] }, 'bram', { act: 'skill', skill: 'fire' }, r * 104729);
      const d = spell(r * 104729);
      expect([d.kind, d.amount, d.mul], `fire on a wisp, dice ${r}`).toEqual([c.kind, c.amount, c.mul]);
    }
  });

  it('puts a sleeper\'s turn to an ending only, and a blow wakes it', () => {
    const { cfg, units } = readBoardBattle({ party: [{ id: 'a', class: 'fighter', at: 'A1' }], foes: [{ id: 'g', foe: 'goblin', at: 'A2' }] });
    const B = flat(3, 3);
    let S = boardStart(B, cfg, units);
    S.u.g.st.sleep = 2;
    expect(boardLegal(B, cfg, turnOf(S, 'g')).every((x) => x.kind === 'end')).toBe(true);
    for (let r = 1; r < 40; r++) {
      const out = boardApply(B, cfg, turnOf(S, 'a', r), { kind: 'act', skill: 'attack', at: boardParse(B, 'A2') });
      if (out.beats.some((b) => b.kind === 'hurt')) { expect(out.S.u.g.st.sleep).toBe(0); return; }
    }
    throw new Error('no blow landed');
  });

  it('bites with poison as the poisoned one\'s turn ends, and silences what costs MP', () => {
    const { cfg, units } = readBoardBattle({ party: [{ id: 'm', class: 'mage', at: 'A1' }], foes: [{ id: 'g', foe: 'goblin', at: 'C3' }] });
    const B = flat(3, 3), S = boardStart(B, cfg, units);
    S.u.m.st.poison = 1;
    const out = boardApply(B, cfg, turnOf(S, 'm'), { kind: 'end', face: 'n' });
    expect(out.S.u.m.hp).toBe(S.u.m.hp - Math.floor(S.u.m.hpMax / 10));
    expect(out.beats).toContainEqual(expect.objectContaining({ kind: 'hurt', target: 'm', poison: true }));
    expect(boardUsable(cfg, S, 'm')).toEqual(['attack', 'fire']);
    S.u.m.st.silence = 2;
    expect(boardUsable(cfg, S, 'm')).toEqual(['attack']);
  });

  it('lets a buff raise the blow, until it wears off over the unit\'s own turns', () => {
    const { cfg, units } = readBoardBattle({ party: [{ id: 'a', class: 'fighter', at: 'A1', skills: ['berserk'] }], foes: [{ id: 'g', foe: 'golem', at: 'A2', face: 's' }] });
    const B = flat(2, 2), S = boardStart(B, cfg, units), hit = (T) => boardApply(B, cfg, turnOf(T, 'a', 99), { kind: 'act', skill: 'attack', at: boardParse(B, 'A2') }).beats.find((b) => b.kind === 'hurt').amount;
    const plain = hit(S);
    const up = boardApply(B, cfg, turnOf(S, 'a'), { kind: 'act', skill: 'berserk', at: boardParse(B, 'A1') }).S;
    expect(up.u.a.buffs).toEqual([{ stat: 'atk', pct: 0.6, rounds: 4 }]);
    expect(hit(up)).toBeGreaterThan(plain);
    let T = up;
    for (let k = 0; k < 4; k++) T = boardApply(B, cfg, turnOf(T, 'a'), { kind: 'end', face: 'n' }).S;
    expect(T.u.a.buffs).toEqual([]);
  });

  it('raises a fallen ally where it fell, while nobody stands there, and spends the bag\'s items', () => {
    const { cfg, units } = readBoardBattle({ party: [{ id: 'c', class: 'cleric', at: 'A1', skills: ['raise'], level: 4 }, { id: 'f', class: 'fighter', at: 'A3' }], foes: [{ id: 'g', foe: 'goblin', at: 'C3' }], bag: { potion: 1 } });
    const B = flat(3, 3), S = boardStart(B, cfg, units);
    S.u.f.hp = 0;
    const raise = { kind: 'act', skill: 'raise', at: boardParse(B, 'A3') };
    expect(boardLegal(B, cfg, turnOf(S, 'c'))).toContainEqual(raise);
    const up = boardApply(B, cfg, turnOf(S, 'c'), raise);
    expect(up.S.u.f.hp).toBe(Math.ceil(S.u.f.hpMax / 4));
    expect(up.beats).toContainEqual(expect.objectContaining({ kind: 'revive', target: 'f' }));
    const W = turnOf(S, 'c');
    W.u = { ...S.u, g: { ...S.u.g, at: boardParse(B, 'A3') } };
    expect(boardLegal(B, cfg, W)).not.toContainEqual(raise);
    S.u.f.hp = 5;
    expect(boardItems(cfg, S, 'c')).toEqual(['potion']);
    const drank = boardApply(B, cfg, turnOf(S, 'c'), { kind: 'act', item: 'potion', at: boardParse(B, 'A1') });
    expect(drank.S.bag.party.potion).toBe(0);
    expect(boardItems(cfg, drank.S, 'c')).toEqual([]);
  });

  it('fields a guest on the party\'s team: never struck by its friends, never a foe to their minds', () => {
    const { cfg, units } = readBoardBattle({ party: [{ id: 'm', class: 'mage', at: 'B2', skills: ['firestorm'], level: 6 }], guests: [{ id: 'npc', class: 'knight', at: 'C3' }], foes: [{ id: 'g', foe: 'goblin', at: 'D3' }] });
    expect(units.find((u) => u.id === 'npc').side).toBe('guest');
    const B = flat(5, 5), S = boardStart(B, cfg, units);
    // the storm round C3 takes in the goblin at D3, never the guest standing in it
    const storm = boardLegal(B, cfg, turnOf(S, 'm')).find((a) => a.skill === 'firestorm' && a.at === boardParse(B, 'C3'));
    expect(storm).toBeTruthy();
    const out = boardApply(B, cfg, turnOf(S, 'm'), storm);
    expect(out.beats.filter((b) => b.kind === 'hurt' || b.kind === 'miss').map((b) => b.target)).toEqual(['g']);
  });

  it('ends by its rules: a leader down, the hero down, a battle survived; the team that wins takes the spoils', () => {
    const base = { party: [{ id: 'hero', class: 'fighter', at: 'A1', level: 9 }, { id: 'b', class: 'mage', at: 'B1' }], foes: [{ id: 'boss', foe: 'bandit', at: 'A2' }, { id: 'g', foe: 'goblin', at: 'E5' }] };
    const B = flat(5, 5);
    const strike = (rules, who, at, hp) => {
      const { cfg, units } = readBoardBattle({ ...base, rules });
      const S = boardStart(B, cfg, units);
      S.u[at === 'A2' ? 'boss' : 'hero'].hp = 1;
      for (let r = 1; r < 40; r++) {
        const out = boardApply(B, cfg, turnOf(S, who, r), { kind: 'act', skill: 'attack', at: boardParse(B, at) });
        if (out.beats.some((x) => x.kind === 'ko')) return out;
      }
      throw new Error('no blow landed');
    };
    const won = strike({ win: { leader: 'boss' } }, 'hero', 'A2');
    expect(won.S.over).toEqual({ winner: 'party', reason: 'leader' });
    expect(won.S.spoils).toMatchObject({ xp: 10, gold: 18, cp: 1 });
    const lost = strike({ lose: { leader: 'hero' } }, 'boss', 'A1');
    expect(lost.S.over).toEqual({ winner: 'foe', reason: 'leader' });
    expect(lost.S.spoils).toBeUndefined();
    const { cfg, units } = readBoardBattle({ ...base, rules: { win: { survive: 2 } } });
    let S = boardStart(B, cfg, units);
    while (!S.over) S = boardApply(B, cfg, S, { kind: 'end', face: 'n' }).S;
    expect([S.over, S.n]).toEqual([{ winner: 'party', reason: 'survived' }, 2]);
  });

  it('counts a fallen unit down under permadeath, lost for good at the count\'s end; without it, waits forever', () => {
    const spec = (rules) => readBoardBattle({ party: [{ id: 'c', class: 'cleric', at: 'A1', skills: ['raise'], level: 4 }, { id: 'f', class: 'fighter', at: 'A3' }], foes: [{ id: 'g', foe: 'golem', at: 'E5' }], rules });
    const B = flat(5, 5), raise = { kind: 'act', skill: 'raise', at: boardParse(B, 'A3') };
    const after = (rules, turns) => {
      const { cfg, units } = spec(rules);
      let S = boardStart(B, cfg, units), beats = [];
      S.u.f.hp = 0;
      if (rules.permadeath) S.u.f.down = rules.permadeath;
      for (let k = 0; k < turns; k++) { const out = boardApply(B, cfg, S, { kind: 'end', face: 'n' }); S = out.S; beats.push(...out.beats); }
      return { S, beats, cfg };
    };
    const kept = after({}, 30);
    expect(kept.S.u.f.lost).toBeUndefined();
    const lost = after({ permadeath: 3 }, 30);
    expect(lost.beats.filter((b) => b.target === 'f').map((b) => b.kind)).toEqual(['count', 'count', 'count', 'lost']);
    expect(lost.S.u.f.lost).toBe(true);
    const T = { ...lost.S, turn: { who: 'c', moved: false, acted: false } };
    expect(boardLegal(B, lost.cfg, T)).not.toContainEqual(raise);
  });

  it('deploys the party when the battle names its spots, no more of it than its cap', () => {
    const r = readBoardBattle({ party: [{ id: 'a', class: 'fighter' }, { id: 'b', class: 'mage' }, { id: 'c', class: 'cleric' }], cap: 2, deploy: ['A1:B1'], foes: [{ id: 'g', foe: 'goblin', at: 'D4' }] });
    expect(r.units.filter((u) => u.side === 'party').map((u) => [u.id, u.at])).toEqual([['a', undefined], ['b', undefined]]);
    expect([r.deploy, r.cap]).toEqual([['A1:B1'], 2]);
  });

  it('refuses what it cannot field, saying why', () => {
    expect(() => readBoardBattle({ party: [], foes: [] })).toThrow(/party is \[/);
    expect(() => readBoardBattle({ party: [{ id: 'a', class: 'fighter' }], foes: [{ id: 'g', foe: 'goblin', at: 'A2' }] })).toThrow(/needs a spot to stand on/);
    expect(() => readBoardBattle({ party: [{ id: 'a', class: 'fighter', at: 'A1' }], foes: [{ id: 'a', foe: 'goblin', at: 'A2' }] })).toThrow(/two units are 'a'/);
    expect(() => readBoardBattle({ party: [{ id: 'a', class: 'fighter', at: 'A1' }], foes: [{ id: 'g', foe: 'goblin', at: 'A2' }], board: { skills: { fire: { reach: 3 } } } })).toThrow(/board.skills.fire.reach is not a shape setting/);
    expect(() => readBoardBattle({ party: [{ id: 'a', class: 'fighter', at: 'A1' }], foes: [{ id: 'g', foe: 'goblin', at: 'A2' }], bag: { elixir: 1 } })).toThrow(/bag: 'elixir' is no item/);
    expect(() => readBoardBattle({ party: [{ id: 'a', class: 'fighter', at: 'A1' }], foes: [{ id: 'g', foe: 'goblin', at: 'A2' }], rules: { win: { leader: 'z' } } })).toThrow(/names 'z', who is not in this battle/);
    expect(() => readBoardBattle({ party: [{ id: 'a', class: 'fighter', at: 'A1' }], foes: [{ id: 'g', foe: 'goblin', at: 'A2' }], rules: { permadeath: 20 } })).toThrow(/permadeath is the turns/);
  });
});
