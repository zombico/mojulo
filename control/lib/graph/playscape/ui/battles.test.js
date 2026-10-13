import { describe, it, expect } from 'vitest';
import { readBattle, battleCues, battleMenus, withBattle } from './battles.js';

const play = { battle: { hero: { atk: 3 }, foes: [{ who: 'wolf', at: [10, 2], name: 'Grey wolf', hp: 5, atk: 2 }] } };

describe('battles: turn-based fights from cues and a menu', () => {
  it('a menu per foe (its hp and yours, attack, guard, flee) and the cues of a turn', () => {
    const [m] = battleMenus(play);
    expect(m).toMatchObject({ id: 'battle-wolf', kind: 'talk', title: 'Battle · Grey wolf', lines: ['Grey wolf: {foe-hp-wolf} hp', 'You: {hp} hp'] });
    expect(m.choices.map((c) => c.say)).toEqual(['Attack', 'Guard', 'Flee']);
    const cues = battleCues(play), id = (k) => cues.find((c) => c.id === k);
    expect(id('battle-meet-wolf')).toMatchObject({ when: { enter: { at: [10, 2], r: 2.2 } }, if: [{ var: 'foe-hp-wolf', gt: 0 }, { var: 'battle', eq: 0 }] });
    expect(id('battle-hit-wolf').then[0]).toEqual({ add: 'foe-hp-wolf', by: -3, min: 0 });
    expect(id('battle-answer-g-wolf').then[0]).toEqual({ add: 'hp', by: -1, min: 0 });
    expect(withBattle({}).cues).toBeUndefined();
  });
  it('says what is wrong', () => {
    expect(() => readBattle({ battle: { foes: [] } })).toThrow(/foes: \[/);
    expect(() => readBattle({ battle: { foes: [{ who: 'wolf' }] } })).toThrow(/where it stands/);
    expect(() => readBattle({ battle: { foes: [{ who: 'wolf', at: [0, 0], hp: -1 }] } })).toThrow(/above 0/);
  });
});
