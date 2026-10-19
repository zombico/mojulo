import { describe, it, expect } from 'vitest';
import { bookEpochs, epochDraw, epochDots, skirmishStages } from './board-levels.js';
import { readBattles, PACKS } from './battles.js';

// the smallest book that shows the procedure: three levels, two stages each, the first stage of each a battle
const stages = ['vale', 'vale', 'fort', 'fort', 'peak', 'peak'].map((level, i) => ({ level, node: `n${i % 2}`, index: i % 2 }));
const plan = stages.map((_, i) => (i % 2 === 0 ? [PACKS[i / 2]] : []));

describe('a tactics book\'s epochs', () => {
  it('are each of the book\'s levels its own, unless the book cuts them into chapters', () => {
    expect(bookEpochs({ battles: { on: 'board' } }, stages)).toEqual([{ name: 'Vale', at: [0, 1] }, { name: 'Fort', at: [2, 3] }, { name: 'Peak', at: [4, 5] }]);
    const G = { battles: { on: 'board', board: { epochs: [{ name: 'The Rising', levels: ['vale', 'fort'] }, { levels: ['peak'] }] } } };
    expect(bookEpochs(G, stages)).toEqual([{ name: 'The Rising', at: [0, 1, 2, 3] }, { name: 'Chapter 2', at: [4, 5] }]);
  });

  it('give an epoch\'s skirmish only the packs met by the epoch\'s end, two at least: a later epoch\'s harder', () => {
    const G = { battles: { on: 'board' } };
    expect(epochDraw(G, stages, plan, [0, 1])).toEqual(PACKS.slice(0, 2));
    expect(epochDraw(G, stages, plan, [4, 5])).toEqual(PACKS.slice(0, 3));
  });

  it('dot an epoch\'s stages in story order, a skirmish after its area\'s first battle, the story going on past it', () => {
    const at = [0, 1, 2, 3], sk = skirmishStages(at.map((i) => stages[i]), at.map((i) => plan[i]));
    expect(sk).toEqual([0, 2]);
    const dots = epochDots(at.map((i) => stages[i]), at.map((i) => `r${i}`), at.map((i) => plan[i]), { 0: 'w0', 2: 'w2' });
    expect(dots.map((d) => [d.id, d.kind, d.gate ?? null])).toEqual([
      ['vale-0', 'battle', null], ['vale-skirmish', 'skirmish', 'vale-0'], ['vale-1', 'story', 'vale-0'],
      ['fort-0', 'battle', 'vale-1'], ['fort-skirmish', 'skirmish', 'fort-0'], ['fort-1', 'story', 'fort-0'],
    ]);
  });

  it('refuses epochs that do not hold the book\'s levels once each, in order', () => {
    const ids = ['vale', 'fort', 'peak'], on = (epochs) => () => readBattles({ on: 'board', board: { epochs } }, null, ids);
    expect(on([{ levels: ['vale', 'fort'] }, { levels: ['peak'] }])).not.toThrow();
    expect(on([{ levels: ['vale'] }, { levels: ['peak'] }])).toThrow(/every level once, in the book's order \(vale, fort, peak\); they hold vale, peak/);
    expect(on([{ levels: ['fort', 'vale', 'peak'] }])).toThrow(/every level once, in the book's order/);
    expect(on([{ levels: ['vale', 'fort', 'peak'], when: 1 }])).toThrow(/epochs\[0\].when is not part of an epoch/);
    expect(on([])).toThrow(/cut into chapters/);
    expect(() => readBattles({ on: 'board', board: { talk: { portrait: 1 } } })).toThrow(/board.talk is \{ bubble\?, portrait\? \}/);
    expect(() => readBattles({ on: 'board', board: { talk: { portrait: true } } })).not.toThrow();
  });
});
