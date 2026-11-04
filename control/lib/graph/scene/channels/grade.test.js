// THE GRADE: the page's compositing stage on the frame pass; words and dials read, compiled in only when asked, laid
// after the far's softening where that is asked too, and absent from every page that asks for none
import { describe, it, expect } from 'vitest';
import { readGrade, GRADE_PRESETS, GRADE_DIALS, GRADE_DIAL_NAMES } from './grade.js';
import { framePassScript } from './frame-pass.js';

describe('the grade', () => {
  it('reads a word, dials, and a word with dials changed; refuses what it cannot grade, naming what it takes', () => {
    expect(readGrade(null)).toBeNull();
    expect(readGrade('noir')).toEqual(GRADE_PRESETS.noir);
    expect(readGrade({ from: 'film', grain: 0.4 })).toEqual({ ...GRADE_PRESETS.film, grain: 0.4 });
    expect(readGrade({ vignette: 0.5, bars: 0.1 })).toEqual({ vignette: 0.5, bars: 0.1 });
    expect(() => readGrade('sepia')).toThrow(/film/);
    expect(() => readGrade({ blur: 1 })).toThrow(/not a dial/);
    expect(() => readGrade({ saturation: 3 })).toThrow(/0 to 2/);
    // every preset's dials are dials within their range
    for (const P of Object.values(GRADE_PRESETS)) for (const [k, v] of Object.entries(P)) { expect(GRADE_DIAL_NAMES).toContain(k); expect(v).toBeGreaterThanOrEqual(GRADE_DIALS[k][1]); expect(v).toBeLessThanOrEqual(GRADE_DIALS[k][2]); }
  });

  it('the frame pass carries it only when asked: alone without the far\'s taps, after the softening where that is asked', () => {
    expect(framePassScript({})).toBe('');
    const alone = framePassScript({ grade: readGrade('film') });
    expect(alone).toContain('gradeFrame');
    expect(alone).toContain('__mojGrade');
    expect(alone).not.toContain('float rad(');
    const both = framePassScript({ soften: 2, grade: readGrade('noir') });
    expect(both).toContain('vec4 softened( vec2 vUv )');
    expect(both).toContain('return softened( uv )');
    // the softening alone keeps every byte it had
    const soft = framePassScript({ soften: 2 });
    expect(soft).not.toContain('gradeFrame');
    expect(soft).not.toContain('__mojGrade');
    expect(framePassScript({ soften: 2, grade: null })).toBe(soft);
  });

  it('a World page without a grade is the page it was; one with a grade carries the pass', async () => {
    const { emitThreeWorld } = await import('../scene-three.js');
    const floor = { corners: [[-5, -5, 0], [5, -5, 0], [5, 5, 0], [-5, 5, 0]], fill: '#c03020' };
    const plain = emitThreeWorld({ faces: [floor] });
    expect(emitThreeWorld({ faces: [floor], grade: null })).toBe(plain);
    expect(plain).not.toContain('__mojGrade');
    expect(emitThreeWorld({ faces: [floor], grade: readGrade('noir') })).toContain('__mojGrade');
  });
});
