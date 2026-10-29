// emotes: the face's held states as loops. Concepts on one card per procedure, chosen in code (a regard that
// re-fixates and one that holds still, a card with stirs): the loop is seamless, the face asymmetric and mirrorable,
// the eyes on the law (parallel, at the far point), the take the rig keys.
import { describe, it, expect } from 'vitest';
import { FACE_EMOTES, FACE_EMOTE_NAMES, emoteTake, emoteErrors } from './emotes.js';
import { auOf, facsActions } from './facs.js';
import { gazeFaults, eyeTurns } from './gaze.js';
import { performanceTrack, eyesOfWeights, RELATIONAL_FACE_TARGETS } from '../polygonizer/relational-face-rig.js';

const pick = (test) => FACE_EMOTE_NAMES.find((k) => test(FACE_EMOTES[k]));
const REFIX = pick((c) => c.eyes.refix && !c.stirs), STILL = pick((c) => !c.eyes.refix), STIRS = pick((c) => c.stirs?.length);
const SIDED = pick((c) => Object.keys(c.face).some((k) => /[LR]$/.test(k)));

describe('emotes: the face\'s held states, general, never cross-eyed', () => {
  it('cards say what they are and hold a face the head can make, each asymmetric (a side its own)', () => {
    expect([REFIX, STILL, STIRS, SIDED].every(Boolean)).toBe(true);
    const C = FACE_EMOTES[SIDED];
    expect(C.words.length).toBeGreaterThan(0);
    expect(C.reads).toMatch(/\w/);
    expect(facsActions(C.face).gaps).toEqual({});
    const L = Object.keys(C.face).filter((k) => auOf(k)[1] === 'L').map((k) => `${auOf(k)[0]}:${C.face[k]}`).sort();
    const R = Object.keys(C.face).filter((k) => auOf(k)[1] === 'R').map((k) => `${auOf(k)[0]}:${C.face[k]}`).sort();
    expect(L).not.toEqual(R);
  });

  it('loops seamlessly: the last frame is the first, every curve and the gaze', () => {
    for (const e of [REFIX, STILL, STIRS]) {
      const T = emoteTake({ emote: e, seed: 7 });
      expect(T.loop).toBe(true);
      expect(T.frames).toBe(Math.round(T.seconds * T.fps) + 1);
      for (const c of Object.values(T.curves)) expect(c.at(-1)).toBe(c[0]);
      expect(T.gaze.yaw.at(-1)).toBe(T.gaze.yaw[0]);
      expect(T.gaze.pitch.at(-1)).toBe(T.gaze.pitch[0]);
    }
  });

  it('lives: the held units move a little, the eyes blink at the card\'s rate, the stirs come and go', () => {
    const T = emoteTake({ emote: STIRS, seconds: 30 }), C = FACE_EMOTES[STIRS];
    const [k, v] = Object.entries(C.face)[0], c = T.curves[k];
    expect(Math.max(...c) - Math.min(...c)).toBeGreaterThan(0);
    expect(T.events.blinks.length).toBeGreaterThan(0);
    expect(T.events.blinks.length).toBeLessThan(C.blink.rate * 0.5 * 2);
    expect(T.events.stirs.length).toBeGreaterThan(1);
    expect(Math.max(...T.curves.AU45)).toBe(1);
    expect(v).toBeGreaterThan(0);
  });

  it('looks at nothing: the eyes on the law every frame, parallel (the far point), drifting and re-fixating near home', () => {
    for (const e of [REFIX, STILL]) {
      const T = emoteTake(e), K = performanceTrack(T), C = FACE_EMOTES[e];
      const look = RELATIONAL_FACE_TARGETS.map((n, j) => [n, j]).filter(([n]) => n.startsWith('eyeLook'));
      for (const row of K.w) {
        const E = eyesOfWeights(Object.fromEntries(look.map(([n, j]) => [n, row[j]])));
        expect(gazeFaults(E)).toEqual([]);
        expect(E.L.yaw).toBeCloseTo(E.R.yaw, 4);
      }
      const reach = C.eyes.drift + (C.eyes.refix ? C.eyes.refix.reach[1] : 0) + 0.01;
      for (let i = 0; i < T.frames; i++) expect(Math.hypot(T.gaze.yaw[i] - C.eyes.yaw, T.gaze.pitch[i] - C.eyes.pitch)).toBeLessThan(reach * Math.SQRT2);
      expect(eyeTurns(T.gaze.yaw[0], T.gaze.pitch[0]).L).toEqual(eyeTurns(T.gaze.yaw[0], T.gaze.pitch[0]).R);
    }
    expect(emoteTake(REFIX).events.saccades.length).toBeGreaterThan(0);
    expect(emoteTake(STILL).events.saccades).toEqual([]);
  });

  it('mirrors: the sides swapped and the regard to the other side, the rest as it was', () => {
    const A = emoteTake(SIDED), B = emoteTake({ emote: SIDED, mirror: true });
    for (const [k, c] of Object.entries(A.curves)) {
      const [au, s] = auOf(k), m = s === 'L' ? `${au}R` : s === 'R' ? `${au}L` : k;
      expect(B.curves[m]).toBeDefined();
      expect(Math.max(...B.curves[m])).toBeCloseTo(Math.max(...c), 1);
    }
    if (FACE_EMOTES[SIDED].eyes.yaw) expect(Math.sign(B.gaze.yaw[0])).toBe(-Math.sign(A.gaze.yaw[0]));
  });

  it('is seeded and scales by its intensity; a bad spec is refused by name', () => {
    expect(emoteTake({ emote: REFIX, seed: 3 })).toEqual(emoteTake({ emote: REFIX, seed: 3 }));
    expect(emoteTake({ emote: REFIX, seed: 3 })).not.toEqual(emoteTake({ emote: REFIX, seed: 4 }));
    const [k] = Object.keys(FACE_EMOTES[REFIX].face).filter((x) => auOf(x)[0] !== 'AU45');
    const half = emoteTake({ emote: REFIX, intensity: 0.5 }), whole = emoteTake(REFIX);
    expect(Math.max(...half.curves[k])).toBeLessThan(Math.max(...whole.curves[k]));
    expect(emoteErrors('sulking')[0]).toMatch(/not an emote/);
    expect(emoteErrors({ emote: REFIX, intensity: 3, mirror: 'yes', seconds: 1 })).toHaveLength(3);
    expect(() => emoteTake('sulking')).toThrow(/not an emote/);
  });
});
