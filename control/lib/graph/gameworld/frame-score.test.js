// THE FRAMES' SCORE (frame-score.js): two loops, each a valid beats composition that loops, the explore loop slower and
// sparer than the combat one, the explore loop's bass kept under it, recorded where it has twins and the combat loop a
// techno machine; a frame level plays them, changed by the tension of its fight.
import { describe, expect, it } from 'vitest';
import { FRAME_SCORE, frameScore } from './frame-score.js';
import { validateBeatsManifest } from '../beats/beats-manifest.js';
import { resolveInstrument } from '../beats/instruments.js';
import { RECORDED_TWINS } from '../beats/audio-patches.js';

const patchOf = (p) => p.patch || resolveInstrument(p.instrument, {}).patch;

describe('the frames\' score', () => {
  it('is two loops, valid, the explore loop slower and sparer than the combat one', () => {
    for (const k of ['explore', 'combat']) {
      const r = validateBeatsManifest(FRAME_SCORE[k]);
      expect(r.errors ?? []).toEqual([]);
      expect(FRAME_SCORE[k].loop).toBe(true);
    }
    const { explore: E, combat: C } = FRAME_SCORE, notes = (M) => M.parts.reduce((n, p) => n + (p.events?.length ?? 0), 0);
    expect(E.bpm).toBeLessThan(C.bpm);
    expect(notes(E)).toBeLessThan(notes(C));
  });

  it('the explore loop\'s bass sits under it: trimmed, filtered dark, no note struck hard', () => {
    const B = FRAME_SCORE.explore.parts.find((p) => p.name === 'bass');
    expect(B.trim).toBeLessThanOrEqual(-6);
    expect(B.chain.find((c) => c.type === 'filter').freq).toBeLessThanOrEqual(600);
    expect(Math.max(...B.events.map((e) => e[3]))).toBeLessThanOrEqual(0.45);
  });

  it('the explore loop is recorded where it has twins; the combat loop is a techno machine, synthesized', () => {
    expect(FRAME_SCORE.explore.recorded).toBe(true);
    expect(FRAME_SCORE.explore.parts.some((p) => RECORDED_TWINS[patchOf(p)])).toBe(true);
    const C = FRAME_SCORE.combat;
    expect(C.recorded).toBeUndefined();
    expect(patchOf(C.parts.find((p) => p.name === 'kit'))).toMatch(/^drumMachine/);
    expect(C.parts.map((p) => p.groove?.[0]?.style).filter(Boolean)).toContain('four-floor');
  });

  it('a frame level plays it: the explore loop its soundtrack, the combat loop its fight, the tension its change', () => {
    const S = frameScore();
    expect(S.soundtrack).toBe(FRAME_SCORE.explore);
    expect(S.combat).toBe(FRAME_SCORE.combat);
    expect(Object.values(S.tension.on).every((w) => w > 0 && w <= 1)).toBe(true);
  });
});
