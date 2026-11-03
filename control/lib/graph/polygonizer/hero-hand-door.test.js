// hands at the hero door: a hand shape or a digit given joint by joint in a stand or a clip, solved on the hero's own
// rig (hero-digits.js withHandShapes, at expandLayeredManifest); the hand words keep their meaning and a hero naming
// neither is untouched; both hands take a shape, the left the right's mirror; a clip mixing a word and a shape blends
// joint by joint; the door refuses an unknown shape or key by name; the SERVO STAMP (layered.js servoStamp) names a key
// that turns a joint past its stop and is absent when none does; a bend word reads as the rig bends it.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt, layeredClip } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest, validateHeroSpec, servoStamp } from '../../mcp/tools/layered.js';
import { explicitHand, withHandShapes, HAND_SHAPE_WORDS } from './hero-digits.js';
import { servoRead } from './hero-servo.js';

const expand = (h) => expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord(h) });
const SPEC = { cast: 'male', form: 'realistic', gesture: { fingersR: 'craneBeak', fingersL: 'craneBeak' },
  clips: { show: [{ fingersR: 'fist' }, { fingersR: 'pinch' }, { fingersR: { index: { mcp: 0, pip: 0, dip: 0 }, thumb: { cmc: 30, toPalm: 15 } } }] } };
const M = expand(SPEC), R = validateRig(M.recipe.rig);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('hands at the door', () => {
  it('the door takes a shape and a digit joint by joint, refuses an unknown one by name, and keeps the hand words', () => {
    expect(validateHeroSpec(SPEC)).toEqual([]);
    expect(validateHeroSpec({ ...SPEC, gesture: { fingersR: 'jazzHands' } }).join()).toMatch(/a hand shape \(craneBeak/);
    expect(validateHeroSpec({ ...SPEC, gesture: { fingersR: { index: { bend: 3 } } } }).join()).toMatch(/fingersR/);
    for (const w of ['fist', 'point', 'grip']) expect(HAND_SHAPE_WORDS, w).not.toContain(w);
  }, 300000);

  it('a stand’s and a clip’s shape is solved on this hero’s rig; a hero naming none is untouched', () => {
    expect(M.recipe.clips.gesture[0].fingersR).toEqual(explicitHand(R, 'R', 'craneBeak'));
    expect(M.recipe.clips.show[0].fingersR).toEqual(explicitHand(R, 'R', 'fist'));   // (the word, written out, poses as the word)
    const a = rigNodesAt(R, { support: 'none', fingersR: 'fist' }).nodes, b = rigNodesAt(R, { support: 'none', fingersR: M.recipe.clips.show[0].fingersR }).nodes;
    for (const k of ['thumbTipR', 'indexTipR', 'littleTipR']) expect(dist(a[k], b[k]), k).toBe(0);
    const plain = expand({ cast: 'female', form: 'realistic', gesture: 'guard' });
    expect(withHandShapes(plain.recipe)).toBe(plain.recipe);
    expect(JSON.stringify(plain.recipe.clips)).not.toMatch(/toPalm/);
  }, 300000);

  it('both hands take a shape, the left the right’s mirror', () => {
    const n = rigNodesAt(R, { support: 'none', ...M.recipe.clips.gesture[0] }).nodes;
    for (const d of ['thumb', 'index', 'little']) {
      const r = n[`${d}TipR`], l = n[`${d}TipL`];
      expect(dist([-r[0], r[1], r[2]], l), d).toBeLessThan(0.001);
    }
  }, 300000);

  it('a clip mixing a word and a shape blends joint by joint, the thumb’s second axis carried', () => {
    const fn = layeredClip(M.recipe.clips.show, R), k = M.recipe.clips.show;
    const mid = fn(1 / 6).fingersR.thumb, a = k[0].fingersR.thumb.toPalm, b = k[1].fingersR.thumb.toPalm;
    expect(mid.toPalm).toBeGreaterThanOrEqual(Math.min(a, b) - 1e-9); expect(mid.toPalm).toBeLessThanOrEqual(Math.max(a, b) + 1e-9);
    expect(a).not.toBe(b);
  }, 300000);

  it('the servo stamp names a key past a stop, and says nothing when none is', () => {
    const st = servoStamp(R, { across: [{ shR: { yaw: 90 } }], easy: [{ elbowR: 'half' }] });
    expect(st.past.some((p) => p.clip === 'across' && p.side === 'R' && p.joint === 'shoulder.swing')).toBe(true);
    expect(st.past.some((p) => p.clip === 'easy')).toBe(false);
    expect(servoStamp(R, { easy: [{ elbowR: 'half' }, { fingersR: 'claw' }] })).toBeNull();
    // (a bend word reads as the rig bends it)
    expect(servoRead(R, { elbowR: 'half' }).R.elbow.value).toBe(75);
  }, 300000);
});
