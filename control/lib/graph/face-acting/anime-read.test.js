// anime-read: a take read as anime draws it. The concepts: deterministic; every frame one drawing per layer, each of its
// layer; every layer held on twos but a spoken closure; kuchipaku (every m, b and p shut, a vowel its own shape); the
// emotions reach their drawings (anger's brows and lids and its shout, happiness's smile and smiling eyes, surprise's raised brows and
// wide lids, sadness's worried brows, a thought's turned gaze); a smiling or squinting lid draws its own narrowing, so it
// never rides a partial closure; lowered to the four channels; a STEP track keyed half a
// frame early, its recording carried.
import { describe, it, expect } from 'vitest';
import { perform } from './perform.js';
import { animeRead, lowerFrame, animePerformanceTrack, KUCHIPAKU, HOLD } from './anime-read.js';
import { DRAWINGS } from '../polygonizer/anime-drawings.js';
import { faceKnots, FACE_TARGETS, FACE_FPS, drawTarget } from '../polygonizer/anime-face-rig.js';

const LINE = { beats: [{ at: 0, face: 'neutral', say: 'Maybe we should move before the moon is up.' }], seed: 3 };
const ACTED = { beats: [{ at: 0, face: 'anger', onset: 'posed' }, { at: 1.2, face: 'happiness' }, { at: 2.4, face: 'surprise', onset: 'posed' }, { at: 3.4, face: 'sadness', state: 'thinking' }], seconds: 5, seed: 5 };
const layersOf = (F) => [['brows', F.brows.L], ['brows', F.brows.R], ['lids', F.lids.L], ['lids', F.lids.R], ['gaze', F.gaze], ['mouth', F.mouth]];
const runs = (xs) => { const out = []; for (const x of xs) { if (out.length && out.at(-1)[0] === x) out.at(-1)[1]++; else out.push([x, 1]); } return out; };

describe('a take read as drawings', () => {
  const said = perform(LINE), acted = perform(ACTED);
  it('is deterministic, a drawing per layer every frame, each of its layer', () => {
    expect(animeRead(acted)).toEqual(animeRead(acted));
    const { fps, frames } = animeRead(acted);
    expect(fps).toBe(FACE_FPS); expect(frames.length).toBe(Math.floor(acted.seconds * fps) + 1);
    for (const F of frames) for (const [layer, name] of layersOf(F)) expect(DRAWINGS[name]?.layer, `${layer} ${name}`).toBe(layer);
  });
  it('holds every layer on twos, but a spoken closure', () => {
    for (const take of [said, acted]) {
      const { frames } = animeRead(take);
      for (const pick of [(F) => F.brows.L, (F) => F.lids.R, (F) => F.gaze, (F) => `${F.mouth}|${F.mouthSide ?? ''}`]) {
        const R = runs(frames.map(pick));
        for (const [x, k] of R.slice(1, -1)) if (!x.startsWith('mouth.shut')) expect(k, x).toBeGreaterThanOrEqual(HOLD);
      }
    }
  });
  it('speaks in kuchipaku: every m, b and p shut, a vowel its own shape', () => {
    const { frames } = animeRead(said), ph = said.events.lines[0].phonemes, at = (q) => frames[Math.round((q.t + q.dur / 2) * FACE_FPS)];
    const closures = ph.filter((q) => ['M', 'B', 'P'].includes(q.p.replace(/\d$/, '')));
    expect(closures.length).toBeGreaterThan(3);
    for (const q of closures) expect(at(q).mouth, `${q.p} at ${q.t}`).toBe('mouth.shut');
    // (most vowels on their own shape: a vowel shorter than the hold may give way to its neighbour)
    const vowels = ph.filter((q) => KUCHIPAKU[q.p.replace(/\d$/, '')] && !['M', 'B', 'P', 'sil'].includes(q.p.replace(/\d$/, '')));
    expect(vowels.filter((q) => at(q).mouth === KUCHIPAKU[q.p.replace(/\d$/, '')]).length / vowels.length).toBeGreaterThan(0.6);
  });
  it('lets the smiling and squinting lids draw their own narrowing: while one is drawn, the eye\'s closure is the blink\'s alone', () => {
    // (a take held on one face, built by hand so the read alone is tested: a raised cheek, a tightened lid, and the lid
    // tightened under a scowl, whose angry lid draws no narrowing of its own, so the squint's closure stays on it)
    const held = (curves) => { const n = 31; return { seconds: 1, fps: 30, frames: n, curves: Object.fromEntries(Object.entries(curves).map(([k, v]) => [k, Array(n).fill(v)])) }; };
    const mid = (curves) => animeRead(held(curves)).frames[15];
    for (const [curves, lid] of [[{ AU6: 0.8 }, 'lids.smile'], [{ AU7: 0.8 }, 'lids.squint']]) {
      const F = mid(curves);
      for (const s of ['L', 'R']) { expect(F.lids[s]).toBe(lid); expect(F[`eye${s}`], lid).toBe(0); }
      // (a blink over it is the blink's own closure)
      expect(mid({ ...curves, AU45: 0.7 }).eyeL).toBeCloseTo(0.7, 6);
    }
    const scowl = mid({ AU4: 0.8, AU7: 0.8 });
    expect(scowl.lids.L).toBe('lids.angry'); expect(scowl.eyeL).toBeGreaterThan(0);
  });
  it('draws each emotion: anger, happiness, surprise, sadness, a thought\'s turned gaze', () => {
    const { frames } = animeRead(acted), at = (t) => frames[Math.round(t * FACE_FPS)];
    expect(at(0.9).brows.L).toBe('brows.angry'); expect(at(0.9).lids.L).toBe('lids.angry');
    expect(at(2.1).mouth).toBe('mouth.smile'); expect(at(2.1).lids.L).toBe('lids.smile');
    expect(at(3.2).brows.R).toBe('brows.raised'); expect(at(3.2).lids.R).toBe('lids.wide');
    expect(at(4.6).brows.L).toBe('brows.worried');
    expect(frames.slice(Math.round(3.6 * FACE_FPS)).some((F) => F.gaze !== 'gaze.ahead')).toBe(true);
  });
  it('draws a smile on an open jaw as the open smile (its top lip held, the bottom dropped), not a vowel', () => {
    // (a laugh: happiness's take with the jaw dropped through it)
    const happy = perform({ seconds: 1.2, beats: [{ at: 0, face: 'happiness', onset: 'posed' }] });
    const laugh = { ...happy, curves: { ...happy.curves, AU26: Array.from({ length: happy.frames }, () => 0.8) } };
    const { frames } = animeRead(laugh), at = (t) => frames[Math.round(t * FACE_FPS)];
    expect(at(0.8).mouth).toBe('mouth.beam');
    expect(DRAWINGS['mouth.beam'].words.mouth.up).toBe(0);
  });
  it('lowers to the four channels', () => {
    expect(lowerFrame({ eyeL: 0, eyeR: 1, brows: { L: 'brows.angry', R: 'brows.angry' }, lids: { L: 'lids.angry', R: 'lids.open' }, mouth: 'mouth.a', smile: 0 }))
      .toEqual({ eyeL: 0.12, eyeR: 1, smile: 0, open: 0.8, brow: 1 });
  });
  it('drawn, a spoken vowel is the whole mouth: no smile under it, the smile kept off the vowels; lowered, it rides them', () => {
    const K = faceKnots({}), vowels = ['mouth.a', 'mouth.i', 'mouth.u', 'mouth.e', 'mouth.o'], K7 = { ...K, targets: [...FACE_TARGETS, ...vowels.map((v) => drawTarget(v))] };
    const happy = perform({ beats: [{ at: 0, face: 'happiness', say: 'Maybe we should move before the moon is up.' }], seed: 4 }), s = FACE_TARGETS.indexOf('smile');
    const drawn = animePerformanceTrack(happy, K7, { sevenG: true }), on = (w) => vowels.some((v) => w[K7.targets.indexOf(drawTarget(v))] > 0);
    expect(drawn.w.some(on)).toBe(true);
    for (const w of drawn.w) if (on(w)) expect(w[s]).toBe(0);
    expect(drawn.w.some((w) => !on(w) && w[s] > 0)).toBe(true);
    expect(animePerformanceTrack(happy, K, { sevenG: false }).w.some((w) => w[s] > 0 && w[FACE_TARGETS.indexOf('mouthOpen')] > 0)).toBe(true);
  });
  it('plays as a STEP track keyed half a frame early, its recording carried', () => {
    const K = faceKnots({}), K7 = { ...K, targets: [...FACE_TARGETS, drawTarget('mouth.a'), drawTarget('brows.angry', 'L'), drawTarget('brows.angry', 'R')] };
    const P = { beats: [{ at: 0.2, face: 'anger', say: { recording: 'aaaaaaaaaaaaaaaa', seconds: 0.8, timing: 'engine', phonemes: [{ p: 'AA1', t: 0.1, dur: 0.3 }] } }], seconds: 2, seed: 2 };
    for (const sevenG of [false, true]) {
      const T = animePerformanceTrack(perform(P), sevenG ? K7 : K, { sevenG });
      expect(T.interp).toBe('STEP'); expect(T.t[0]).toBe(0); expect(T.t.at(-1)).toBe(2);
      for (let i = 1; i < T.t.length - 1; i++) { expect(T.t[i]).toBeGreaterThan(T.t[i - 1]); expect(Math.abs(T.t[i] * FACE_FPS + 0.5 - Math.round(T.t[i] * FACE_FPS + 0.5))).toBeLessThan(1e-4); }
      for (const w of T.w) expect(w).toHaveLength((sevenG ? K7 : K).targets.length);
      expect(T.audio).toEqual([{ at: 0.2, recording: 'aaaaaaaaaaaaaaaa' }]);
      // (7G draws the a; lowered, the open channel)
      const j = sevenG ? K7.targets.indexOf(drawTarget('mouth.a')) : FACE_TARGETS.indexOf('mouthOpen');
      expect(T.w.some((w) => w[j] > 0.5)).toBe(true);
    }
  });
});
