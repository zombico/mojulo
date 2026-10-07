/**
 * Sound for the destruction primitives: a cue timeline, never audio. Every style's cues exist in the default foley
 * (a valid beats-sfx manifest), and a caller can rename, re-gain or silence any mark's cue.
 */
import { describe, expect, it } from 'vitest';

import { validateBeatsManifest } from '../../beats/beats-manifest.js';
import { resolveObject } from '../objects/index.js';
import { cleave } from './cleave.js';
import { collapse } from './collapse.js';
import { slicing, CUT_STYLES, CUT_STYLE_IDS } from './interceptors.js';
import { DESTRUCT_SFX, DESTRUCT_CUE_IDS, collapseSounds } from './sounds.js';

const door = () => resolveObject({ entry: 'door', variant: 'single', skin: 'plank', fit: { width: 1.4, height: 2.6 } });

describe('the default foley', () => {
  it('is a valid beats-sfx manifest the World page\'s audio channel plays', () => {
    const v = validateBeatsManifest(DESTRUCT_SFX);
    expect(v.errors).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it('defines every cue a style names', () => {
    for (const st of CUT_STYLE_IDS) for (const cue of Object.values(CUT_STYLES[st].sounds)) expect(DESTRUCT_CUE_IDS).toContain(cue);
  });
});

describe('the cut sounds', () => {
  const o = door(), slice = cleave(o, { pattern: 'slice', count: 2, seed: 5 });

  it('every style answers with a timeline inside the cut, each cue a default one', () => {
    for (const st of CUT_STYLE_IDS) {
      const s = slicing(slice, o, { style: st, origin: [0.2, -0.6, 1.2] });
      expect(s.sounds.length).toBeGreaterThan(0);
      s.sounds.forEach((c, i) => { expect(DESTRUCT_CUE_IDS).toContain(c.cue); expect(c.t).toBeGreaterThanOrEqual(0); expect(c.t).toBeLessThanOrEqual(s.seconds); expect(c.gain).toBeLessThanOrEqual(1); if (i) expect(c.t).toBeGreaterThanOrEqual(s.sounds[i - 1].t); });
    }
  });

  it('each style sounds like itself: a laser hums per beam, an anime cut sings once when the beat breaks, an impact booms first', () => {
    const l = slicing(slice, o, { style: 'laser' });
    expect(l.sounds.filter((c) => c.cue === 'laser-hum')).toHaveLength(l.strokes.length);
    const a = slicing(slice, o, { style: 'anime' });
    expect(a.sounds.filter((c) => c.mark === 'score')).toHaveLength(1);
    expect(a.sounds.find((c) => c.cue === 'shing').t).toBeCloseTo(a.elements.find((e) => e.kind === 'flash').birth, 5);
    const im = slicing(slice, o, { style: 'impact', origin: [0.2, -0.6, 1.2] });
    expect(im.sounds[0]).toMatchObject({ t: 0, mark: expect.stringMatching(/ring|flash/) });
  });

  it('a caller injects its own cue, re-gains one, or silences a mark', () => {
    const s = slicing(slice, o, { style: 'laser', sounds: { beam: 'my-laser', spark: false, score: { cue: 'sizzle', gain: 0.3 } } });
    expect(s.sounds.filter((c) => c.mark === 'beam').every((c) => c.cue === 'my-laser')).toBe(true);
    expect(s.sounds.some((c) => c.mark === 'spark')).toBe(false);
    expect(s.sounds.filter((c) => c.mark === 'score').every((c) => c.gain <= 0.3)).toBe(true);
  });

  it('sparks are thinned to a texture: far fewer cues than sparks', () => {
    const s = slicing(slice, o, { style: 'laser' });
    expect(s.sounds.filter((c) => c.mark === 'spark').length).toBeLessThan(s.elements.filter((e) => e.kind === 'spark').length / 3);
  });
});

describe('the collapse sounds', () => {
  it('the parting, then the landings: thuds for the heavy, clacks for the light, louder for faster', () => {
    const o = door(), c = cleave(o, { pattern: 'grid', cell: 0.45 }), run = collapse(c.chunks, { mode: 'explode', delay: 0.3 });
    expect(run.hits.length).toBeGreaterThan(0);
    const cues = collapseSounds(run);
    expect(cues[0]).toMatchObject({ mark: 'part', cue: 'whoosh', t: 0.3 });
    expect(cues.some((x) => x.cue === 'thud' || x.cue === 'clack')).toBe(true);
    const fast = run.hits.reduce((a, h) => (h.speed > a.speed ? h : a)), slow = run.hits.reduce((a, h) => (h.speed < a.speed ? h : a));
    const g = (h) => cues.find((x) => x.t === h.t && x.at && x.at.join() === h.at.join())?.gain ?? 0;
    expect(g(fast)).toBeGreaterThanOrEqual(g(slow));
    expect(collapseSounds(run, { sounds: { hit: 'rubble', light: false } }).every((x) => x.cue !== 'clack')).toBe(true);
  });
});
