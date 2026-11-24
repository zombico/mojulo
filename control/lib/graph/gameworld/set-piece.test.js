// A set piece: a run the camera directs, its beats on marks, its prompts at the beats the stick cannot do; lowered onto
// the chase line, the prompts and the level's cues; its laws advise
import { describe, it, expect } from 'vitest';
import { lowerSetPiece, setPieceLaws, SET_PIECE } from './set-piece.js';
import { readCues } from '../playscape/ui/cues.js';

const roofs = {
  id: 'roofs', line: [[0, 0], [40, 0], [40, 40]], half: 2, z: 7,
  cams: [{ at: 0, frame: 'chase' }, { at: 10, frame: 'lead', fov: 70 }, { at: 42, frame: 'profile', cut: true }],
  beats: [{ at: 30, id: 'bridge', do: [{ collapse: 'bridge' }, { shake: 0.8 }] }],
  prompts: [{ at: 18, id: 'grab', says: 'Grab', slow: 0.3, then: { say: 'Made it', as: 'toast' } }, { at: 55, id: 'climb', kind: 'mash', count: 5, says: 'Climb' }],
};

describe('a set piece', () => {
  it('lowers to a chase line with its marks and its camera, its prompts, its cues and its slowed prompt\'s moment', () => {
    const L = lowerSetPiece(roofs);
    expect(L.chase.lines[0]).toMatchObject({ id: 'roofs', half: 2, cams: [{ s: 0, frame: 'chase' }, { s: 10, frame: 'lead', fov: 70 }, { s: 42, frame: 'profile', cut: true }] });
    expect(L.chase.lines[0].marks).toEqual([{ at: 18, id: 'prompt-grab' }, { at: 30, id: 'bridge' }, { at: 55, id: 'prompt-climb' }]);
    // a miss puts the hero back on the line before it, at the set piece's height
    expect(L.prompts.find((p) => p.id === 'grab').back).toEqual([18 - SET_PIECE.back, 0, 7]);
    expect(L.prompts.find((p) => p.id === 'climb').back).toEqual([40, 55 - 40 - SET_PIECE.back, 7]);
    expect(L.cues.map((c) => [c.when.on, c.then])).toEqual([
      ['chase:roofs:bridge', [{ collapse: 'bridge' }, { shake: 0.8 }]],
      ['chase:roofs:prompt-grab', { prompt: 'grab' }],
      ['chase:roofs:prompt-climb', { prompt: 'climb' }],
      ['prompt:grab:hit', { say: 'Made it', as: 'toast' }],
    ]);
    expect(() => readCues({ cues: L.cues })).not.toThrow();   // the level's own cues read them
    expect(L.tempo.moments).toEqual([{ on: 'prompt:grab', scale: 0.3, hold: 1.7, ramp: 0.12 }]);
  });

  it('advises by its laws: on the line, directed, few, readable', () => {
    expect(setPieceLaws(roofs).every((l) => l.ok)).toBe(true);
    const bad = { ...roofs, cams: [{ at: 4, frame: 'chase' }], prompts: [{ at: 18, id: 'a' }, { at: 22, id: 'b' }, { at: 120, id: 'c' }] };
    const laws = Object.fromEntries(setPieceLaws(bad).map((l) => [l.law, l]));
    expect(laws['on the line']).toMatchObject({ ok: false });
    expect(laws['on the line'].says).toMatch(/prompt c at 120 m/);
    expect(laws.directed.says).toMatch(/first keyed at 4 m/);
    expect(laws.few.says).toMatch(/^b within 15 m/);
    expect(laws.readable.says).toMatch(/^b comes before/);
  });

  it('teaches on what it does not take', () => {
    expect(() => lowerSetPiece({ ...roofs, id: 'Roofs!' })).toThrow(/lower-case/);
    expect(() => lowerSetPiece({ ...roofs, cams: [] })).toThrow(/cams/);
    expect(() => lowerSetPiece({ ...roofs, cams: [{ at: 0, frame: 'dutch' }] })).toThrow(/frame is/);
    expect(() => lowerSetPiece({ ...roofs, prompts: [{ at: 10, window: 0.2 }] })).toThrow(/fair/);
  });
});
