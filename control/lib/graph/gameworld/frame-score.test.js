// THE FRAMES' SCORE (frame-score.js): two loops in one band, each a valid beats composition that loops, the explore loop
// slower and sparer than the combat one; a frame level plays them, changed by the tension of its fight.
import { describe, expect, it } from 'vitest';
import { FRAME_SCORE, frameScore } from './frame-score.js';
import { validateBeatsManifest } from '../beats/beats-manifest.js';

describe('the frames\' score', () => {
  it('is two loops in one band, valid, the explore loop slower and sparer than the combat one', () => {
    for (const k of ['explore', 'combat']) {
      const r = validateBeatsManifest(FRAME_SCORE[k]);
      expect(r.errors ?? []).toEqual([]);
      expect(FRAME_SCORE[k].loop).toBe(true);
    }
    const { explore: E, combat: C } = FRAME_SCORE, notes = (M) => M.parts.reduce((n, p) => n + (p.events?.length ?? 0), 0);
    expect(E.bpm).toBeLessThan(C.bpm);
    expect(notes(E)).toBeLessThan(notes(C));
    // (one band: the kit and the bass the same instruments in both)
    const inst = (M, name) => M.parts.find((p) => p.name === name).instrument;
    expect(inst(E, 'kit')).toBe(inst(C, 'kit'));
    expect(inst(E, 'bass')).toBe(inst(C, 'bass'));
  });

  it('a frame level plays it: the explore loop its soundtrack, the combat loop its fight, the tension its change', () => {
    const S = frameScore();
    expect(S.soundtrack).toBe(FRAME_SCORE.explore);
    expect(S.combat).toBe(FRAME_SCORE.combat);
    expect(Object.values(S.tension.on).every((w) => w > 0 && w <= 1)).toBe(true);
  });
});
