// A gameworld's `grade`: the look over every frame of its levels (scene/channels/grade.js), laid on every level as
// `grade`; 'auto' takes its juice register's; a world that writes none is the world it was.

import { describe, it, expect } from 'vitest';
import { readGameworld, MEADOWMARK } from './index.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { gradeOfGame, gradeSuggestion, GRADE_OF_REGISTER } from './grade.js';
import { GRADE_PRESETS } from '../scene/channels/grade.js';
import { JUICE_REGISTER_IDS } from '../scene/juice-style.js';

const order = (W) => { const G = readGameworld(W), st = gameStages(W)[0]; return stageLevelOrder(G, st, { ref: 'lv_0', heroRef: 'gw-hero' }).args.manifest; };

describe('a gameworld\'s grade', () => {
  it('reads with the world, and teaches on a word it does not know', () => {
    expect(readGameworld({ ...MEADOWMARK, grade: 'noir' }).grade).toBe('noir');
    expect(readGameworld(MEADOWMARK).grade).toBeUndefined();
    expect(() => readGameworld({ ...MEADOWMARK, grade: 'sepia' })).toThrow(/film.*'auto'/s);
  });

  it('lays nothing on a world that writes none, or false; the same level with its grade on one that does', () => {
    const plain = order(MEADOWMARK), off = order({ ...MEADOWMARK, grade: false }), on = order({ ...MEADOWMARK, grade: { from: 'film', grain: 0.3 } });
    expect(plain.grade).toBeUndefined();
    expect(JSON.stringify(off)).toBe(JSON.stringify(plain));
    expect(on.grade).toEqual({ ...GRADE_PRESETS.film, grain: 0.3 });
    const { grade: _g, ...rest } = on;
    expect(JSON.stringify(rest)).toBe(JSON.stringify(plain));
  });

  it('\'auto\' takes the register\'s own, every register graded', () => {
    expect(Object.keys(GRADE_OF_REGISTER).sort()).toEqual([...JUICE_REGISTER_IDS].sort());
    for (const register of JUICE_REGISTER_IDS) {
      const G = readGameworld({ ...MEADOWMARK, juice: { register }, grade: 'auto' });
      expect(gradeOfGame(G)).toMatchObject({ grade: GRADE_PRESETS[GRADE_OF_REGISTER[register]], from: 'register' });
    }
    expect(gradeSuggestion(readGameworld(MEADOWMARK))).toMatchObject({ from: 'register' });
    expect(gradeSuggestion(readGameworld({ ...MEADOWMARK, grade: 'noir' }))).toBeNull();
  });
});
