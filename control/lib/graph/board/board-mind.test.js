import { describe, it, expect } from 'vitest';
import { buildBoard, boardOf, boardStart, boardApply, boardLegal, boardParse } from './board-kernel.js';
import { buildBoardMind, boardMindPlan } from './board-mind.js';
import { readBoardBattle } from './board-battle.js';
import { layBoard } from './board-lay.js';

const K = buildBoard();
const flat = (cols, rows) => boardOf(Array.from({ length: rows }, () => Array(cols).fill(0)));
const turnOf = (S, who) => ({ ...S, turn: { who, moved: false, acted: false } });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// a turn played as planned, planned again whenever a step is no longer legal (an act changed the board)
function playTurn(B, cfg, S) {
  const who = S.turn.who;
  let plan = boardMindPlan(B, cfg, S, K);
  for (let k = 0; k < 6 && S.turn && S.turn.who === who && !S.over; k++) {
    if (!plan.length || !boardLegal(B, cfg, S).some((a) => same(a, plan[0]))) plan = boardMindPlan(B, cfg, S, K);
    S = boardApply(B, cfg, S, plan.shift()).S;
    if (plan.length === 0) break;
  }
  return S;
}

describe('the board mind: a unit the player does not move, playing its turn', () => {
  it('plans only legal steps, the same plan for the same state, and runs alone from its source', () => {
    const { cfg, units } = readBoardBattle({ party: [{ id: 'a', class: 'fighter', at: 'A1' }], foes: [{ id: 'g', foe: 'goblin', at: 'D4' }, { id: 'w', foe: 'wolf', at: 'C4' }] });
    const B = flat(5, 5), S = boardStart(B, cfg, units), plan = boardMindPlan(B, cfg, S, K);
    expect(plan.at(-1).kind).toBe('end');
    expect(boardMindPlan(B, cfg, S, K)).toEqual(plan);
    const page = new Function(`return (${buildBoardMind.toString()})();`)();
    expect(page.plan(K, B, cfg, S)).toEqual(plan);
    let T = S;
    for (const step of plan) { expect(boardLegal(B, cfg, T)).toContainEqual(step); T = boardApply(B, cfg, T, step).S; }
  });

  it('strikes a foe in reach, walks toward one out of reach, and mends a hurt friend before striking', () => {
    const { cfg, units } = readBoardBattle({ party: [{ id: 'a', class: 'fighter', at: 'A1' }, { id: 'c', class: 'cleric', at: 'A3' }], foes: [{ id: 'g', foe: 'goblin', at: 'B1' }, { id: 'far', foe: 'goblin', at: 'G7' }] });
    const B = flat(7, 7), S = boardStart(B, cfg, units);
    expect(boardMindPlan(B, cfg, turnOf(S, 'a'), K).some((x) => x.kind === 'act' && x.at === boardParse(B, 'B1'))).toBe(true);
    const lone = boardMindPlan(B, cfg, turnOf(S, 'far'), K);
    expect(lone[0].kind).toBe('move');
    const d = (i, j) => Math.abs((i % 7) - (j % 7)) + Math.abs(Math.floor(i / 7) - Math.floor(j / 7));
    expect(d(lone[0].to, S.u.a.at)).toBeLessThan(d(S.u.far.at, S.u.a.at));
    S.u.a.hp = 6;
    expect(boardMindPlan(B, cfg, turnOf(S, 'c'), K)).toContainEqual(expect.objectContaining({ kind: 'act', skill: 'heal', at: S.u.a.at }));
  });

  it('fights a battle to its end: mind against mind on a diorama, one side always left standing', () => {
    for (const seed of ['fft-1', 'fft-2', 'fft-3']) {
      const { board: B } = layBoard({ seed, relief: 0.3, cols: 8, rows: 8 });
      const { cfg, units } = readBoardBattle({ seed,
        party: [{ id: 'ayla', class: 'fighter', at: 'B1' }, { id: 'bram', class: 'mage', at: 'C1', level: 2 }, { id: 'cass', class: 'cleric', at: 'D1' }],
        foes: [{ id: 'g1', foe: 'goblin', at: 'B8' }, { id: 'w1', foe: 'wolf', at: 'D8' }, { id: 's1', foe: 'shaman', at: 'F8' }] });
      let S = boardStart(B, cfg, units);
      for (let k = 0; k < 400 && !S.over; k++) S = playTurn(B, cfg, S);
      expect(S.over, seed).toMatchObject({ reason: 'fallen' });
    }
  });
});
