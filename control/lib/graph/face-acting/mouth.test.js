// mouth: who owns the mouth while a line is spoken. A line over an emote's loop: the driver's units over the face's,
// the face's closing units let go, its brows and eyes kept as the loop plays round; the ownership in the rig's names.
import { describe, it, expect } from 'vitest';
import { MOUTH, speakOver } from './mouth.js';
import { FACE_EMOTES, FACE_EMOTE_NAMES, emoteTake } from './emotes.js';
import { auOf, FACS_UNITS } from './facs.js';
import { mouthTargets, performanceTrack } from '../polygonizer/relational-face-rig.js';

// (an emote holding a closing unit the line lets go, and an upper-face unit the line must leave alone)
const E = FACE_EMOTE_NAMES.find((k) => { const ks = Object.keys(FACE_EMOTES[k].face).map((x) => auOf(x)[0]); return ks.some((a) => MOUTH.released.includes(a) && !MOUTH.driver.includes(a)) && ks.some((a) => FACS_UNITS[a].region === 'upper'); });

describe('mouth: a line laid over any face, the face keeping all but the articulation', () => {
  it('speaks over an emote\'s loop, played round as long as the line needs', () => {
    const loop = emoteTake({ emote: E, seconds: 2 }), T = speakOver(loop, 'Well, maybe we could wait a little longer for them.', { at: 0.5 });
    expect(T.loop).toBeUndefined();
    expect(T.frames).toBeGreaterThan(loop.frames);
    expect(T.events.lines).toHaveLength(1);
    for (const u of ['AU26', 'AU25']) expect(Math.max(...T.curves[u])).toBeGreaterThan(0.2);
    // (the upper face as the loop played round; the gaze too)
    const N = loop.frames - 1, up = Object.keys(loop.curves).find((k) => FACS_UNITS[auOf(k)[0]].region === 'upper');
    for (let i = 0; i < T.frames; i += 7) { expect(T.curves[up][i]).toBe(loop.curves[up][i % N]); expect(T.gaze.yaw[i]).toBe(loop.gaze.yaw[i % N]); }
    // (a closing unit the face held, let go mid-line)
    const closing = Object.keys(loop.curves).find((k) => MOUTH.released.includes(auOf(k)[0]) && !MOUTH.driver.includes(auOf(k)[0]));
    const mid = Math.round((0.5 + T.events.lines[0].seconds / 2) * T.fps);
    expect(T.curves[closing][mid]).toBeLessThan(loop.curves[closing][mid % N] * (1 - MOUTH.release * 0.9));
    expect(performanceTrack(T).w).toHaveLength(Math.floor((T.frames - 1) / 2) + 1);
  });

  it('says the ownership in the rig\'s target names, for an engine\'s runtime lip-sync', () => {
    const M = mouthTargets();
    expect(M.driver).toEqual(expect.arrayContaining(['jawOpen', 'lipsPart', 'pucker', 'funnel']));
    expect(M.rounded.targets).toEqual(expect.arrayContaining(['smileLeft', 'smileRight']));
    expect(M.rounded.by).toEqual(['pucker', 'funnel']);
    expect(M.released.targets).toEqual(expect.arrayContaining(['chinRaise', 'press']));
    expect(M.driver.some((t) => /^(brow|blink|eye|cheek)/.test(t))).toBe(false);
  });
});
