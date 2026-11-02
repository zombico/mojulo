// the actor's body: gestures solved on the rig, placed on the read's clock, the stand living between them; read law by law
import { describe, it, expect } from 'vitest';
import { validateRig, rigNodesAt } from '../polygonizer/station-loft-rig.js';
import { landmark, liteOf } from '../polygonizer/hero-grip.js';
import { GESTURE_PRESETS } from '../polygonizer/hero-gesture.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { GESTURES, GESTURE_NAMES, strokeOf, armsOf } from './gestures.js';
import { actBody, poseAt, actClip, GAP, LEAD } from './body.js';
import { flatten, unflatten, SPEED } from './tracks.js';
import { bodyLaws } from './readings.js';
import { STYLES, STYLE_NAMES } from './style.js';
import { actRead } from './interpret.js';
import { BASELINE } from './baseline.js';

// (the smallest rig with hands: a stylised hero's, expanded in milliseconds; the realistic one is the dailies')
const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'female' }) }).recipe.rig);
const STAND = GESTURE_PRESETS.relaxed.female;
// (one gesture of each kind, chosen from the library: one hand, both hands, the head alone, the trunk)
const kind = (f) => GESTURE_NAMES.find(f);
const ONE = kind((w) => armsOf(w).length === 1), BOTH = kind((w) => armsOf(w).length === 2), HEAD = kind((w) => !GESTURES[w].arms && !GESTURES[w].spine && GESTURES[w].head), TRUNK = kind((w) => GESTURES[w].spine);
// (a pose at the stand: the stand's channels its own, any other the rest's 0)
const expectStand = (pose) => { const S = flatten(STAND).num; for (const [p, v] of Object.entries(flatten(pose).num)) expect(v, p).toBeCloseTo(S[p] ?? 0, 3); };
const readOf = (body, seconds = 6, words = []) => ({ seconds, body, lines: [{ at: 0.5, end: seconds - 0.5, text: '', words }] });

describe('the gestures', () => {
  it('place the hand where the words say on the rig it plays on, the arm within its range', () => {
    for (const w of [ONE, BOTH]) {
      const S = strokeOf(R, w, 'R', STAND);
      for (const [side, a] of Object.entries(S.arms)) { expect(a.err, `${w} ${side}`).toBeLessThan(0.01); expect(S.channels[`elbow${side}`]).toBeLessThanOrEqual(150); }
    }
  });

  it('a one-handed gesture done with the left hand is the right\'s, mirrored', () => {
    const r = strokeOf(R, ONE, 'R', STAND), l = strokeOf(R, ONE, 'L', STAND);
    const n = rigNodesAt(liteOf(R), { ...STAND, ...r.channels }).nodes, m = rigNodesAt(liteOf(R), { ...STAND, ...l.channels }).nodes;
    const mid = landmark(n, 'chest')[0];
    expect(Math.abs((n.wristR[0] - mid) + (m.wristL[0] - mid))).toBeLessThan(0.05);
    expect(Math.abs(n.wristR[2] - m.wristL[2])).toBeLessThan(0.05);
  });

  it('the head and the trunk gestures move only their channels', () => {
    expect(Object.keys(strokeOf(R, HEAD, 'R', STAND).channels)).toEqual(['head']);
    expect(Object.keys(strokeOf(R, TRUNK, 'R', STAND).channels).sort()).toEqual(Object.keys({ ...GESTURES[TRUNK].spine && { spine: 1 }, ...GESTURES[TRUNK].head && { head: 1 } }).sort());
  });
});

describe('the body take', () => {
  it('is deterministic, and stands in its stand where nothing moves it', () => {
    const read = readOf([{ t: 2, gesture: ONE, cause: 'stress' }]);
    const a = actBody(read, { R, base: STAND }), b = actBody(read, { R, base: STAND });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const still = actBody(readOf([]), { R, base: STAND, style: { from: STYLE_NAMES[0], body: { idle: 0 } } });
    expectStand(poseAt(still, 3));
  });

  it('strikes each gesture LEAD before its cue, then lets go to the stand', () => {
    const B = actBody(readOf([{ t: 2.5, gesture: ONE, cause: 'stress' }], 6), { R, base: STAND, style: { from: STYLE_NAMES[0], body: { idle: 0 } } });
    const [g] = B.gestures;
    expect(g.apex).toBeCloseTo(2.5 - LEAD, 6);
    expect(g.start).toBeLessThan(g.apex);
    expect(g.end).toBeGreaterThan(g.apex);
    expectStand(poseAt(B, 5.9));
  });

  it('drops a gesture whose apex comes within GAP of the last on the same limbs; chains one that starts before it lets go', () => {
    // (two-handed: two one-handed gestures may fall to different hands, which is no clash)
    const near = actBody(readOf([{ t: 2, gesture: BOTH, cause: 'stress' }, { t: 2 + GAP / 2, gesture: BOTH, cause: 'stress' }]), { R, base: STAND });
    expect(near.gestures).toHaveLength(1);
    expect(near.dropped[0].why).toMatch(/within/);
    const chained = actBody(readOf([{ t: 2, gesture: HEAD, cause: 'stress' }, { t: 2 + GAP + 0.1, gesture: HEAD, cause: 'stress' }]), { R, base: STAND });
    expect(chained.gestures).toHaveLength(2);
    expect(chained.gestures[1].chained).toBe(true);
  });

  it('a one-shot clip at 30 keys a second, its pose the take\'s', () => {
    const B = actBody(readOf([{ t: 2, gesture: BOTH, cause: 'line' }], 4), { R, base: STAND }), fn = actClip(B);
    expect(fn.once).toBe(true);
    expect(fn.keys).toBe(Math.round(4 * 30) + 1);
    expect(fn(0.5)).toEqual(poseAt(B, 2));
  });

  it('pose words survive the round trip through the channels', () => {
    expect(unflatten(flatten(STAND).num, flatten(STAND).words)).toEqual(JSON.parse(JSON.stringify({ ...STAND })));
  });
});

describe('the body laws on the styles', () => {
  // (the baseline speech in the busiest and the stillest style that gestures, chosen by their cards)
  const gesturing = STYLE_NAMES.filter((n) => STYLES[n].gesture.vocab.length);
  const busy = [...gesturing].sort((a, b) => (STYLES[b].gesture.line + STYLES[b].gesture.stress) - (STYLES[a].gesture.line + STYLES[a].gesture.stress))[0];
  const still = [...STYLE_NAMES].sort((a, b) => STYLES[b].body.stillness - STYLES[a].body.stillness)[0];
  const play = (style) => { const read = actRead({ ...BASELINE.solo, style }); return { read, body: actBody(read, { R, base: STAND, style }) }; };

  it('every arm gesture\'s joints arrive in turn; strokes land in their window; no joint over its speed or out of its range', () => {
    for (const style of [busy, ...gesturing.filter((n) => n !== busy).slice(0, 1)]) {
      const { read, body } = play(style), L = bodyLaws(body, read);
      if (L.overlap.reads) expect(L.overlap.reads.inOrder, style).toBeGreaterThanOrEqual(0.5);
      if (L.stroke.reads) expect(L.stroke.reads.inWindow, style).toBe(1);
      expect(L.possible.reads.over, style).toEqual([]);
      for (const [j, v] of Object.entries(L.possible.reads.fastest)) expect(v, `${style} ${j}`).toBeLessThanOrEqual(SPEED[j]);
    }
  });

  it('two uses of one gesture are never copies', () => {
    const { read, body } = play(busy), V = bodyLaws(body, read).variation;
    if (V.reads) expect(V.reads.least).toBeGreaterThan(0.5);
  });

  it('the stillest style holds still longer than the busiest', () => {
    const a = play(still), b = play(busy);
    expect(bodyLaws(a.body, a.read).weight.reads.stillest).toBeGreaterThan(bodyLaws(b.body, b.read).weight.reads.stillest);
  });
});
