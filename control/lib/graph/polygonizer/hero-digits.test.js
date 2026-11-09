// hero-digits — octopus boxer on a real hero rig (the realistic form): the hand's forward kinematics is the rig's own;
// a digit's pad reaches a point within its servos; a power grasp closes every phalanx onto a haft round its own size,
// and a thinner haft closes the hand further; a shape is solved by each of its procedures (a joint set, a reach to a
// point, a reach onto another digit kept clear of the rest, a close onto the palm, a close onto a haft) and plays in the
// rig as it was solved; the fist's fingers land near the `fist` word, whose own thumb runs through the fingers where the
// shape's keeps clear; words and aliases resolve, unknown ones throw; the same solve gives the same hand.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt, digitPose, HAND_POSES } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { handRead } from './hero-servo.js';
import { handBox, digitGeometry, reachDigit, grasp, inPalm, handShape, poleError, capsuleClear, HAND_SHAPES, DIGITS, FINGERS } from './hero-digits.js';
import { HAND_SHAPE_ALIASES, HAND_SHAPE_POLES } from './hand-shape-words.js';

const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'male', form: 'realistic' }) }).recipe.rig);
const box = handBox(R, 'R');
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const inRange = (rd) => Object.entries(rd).filter(([, v]) => !v.inRange).map(([k, v]) => `${k} ${v.value}`);
/** the nearest a digit's phalanges come to the other digits' (m) */
const clearOf = (fingers, d) => { const mine = digitGeometry(R, box, d, fingers[d]).capsules; let m = Infinity; for (const o of DIGITS) if (o !== d) for (const c of digitGeometry(R, box, o, fingers[o]).capsules) for (const k of mine) m = Math.min(m, capsuleClear(k, c)); return m; };

describe('octopus boxer', () => {
  it('the hand’s forward kinematics is the rig’s own, to the bit', () => {
    const v = { mcp: 30, pip: 50, spread: 10 }, full = rigNodesAt(R, { support: 'none', fingersR: { index: v } }).nodes, P = digitPose(R, 'R', 'index', v);
    for (const [j, p] of Object.entries(P.joints)) expect(dist(p, full[j]), j).toBe(0);
  }, 120000);

  it('a digit’s pad reaches a point before the hand, within its servos', () => {
    const at = box.at(1.4 * box.palmLen, 0.4 * box.breadth, 0.045), r = reachDigit(R, box, 'index', { at, contact: 'pad' });
    expect(r.err).toBeLessThan(0.001); expect(r.past).toEqual([]);
    const t = reachDigit(R, box, 'thumb', { at, contact: 'tip' });
    expect(t.err).toBeLessThan(0.002); expect(t.past).toEqual([]);
  }, 120000);

  it('a power grasp closes every phalanx onto a haft round its own size; a thinner one closes the hand further', () => {
    const closed = {};
    for (const r of [0.015, 0.035]) {
      const g = grasp(R, box, 'power', inPalm(box, 'cylinder', r));
      for (const d of DIGITS) for (const gap of g.digits[d].gaps) { expect(gap, `${r} ${d}`).toBeGreaterThan(-0.0005); expect(gap, `${r} ${d}`).toBeLessThan(0.0025); }
      const rd = handRead(R, rigNodesAt(R, { support: 'none', fingersR: g.fingers }).nodes, 'R');
      for (const d of DIGITS) expect(inRange(rd[d]), `${r} ${d}`).toEqual([]);
      closed[r] = FINGERS.reduce((s, d) => s + rd[d].mcp.value + rd[d].pip.value + rd[d].dip.value, 0);
    }
    expect(closed[0.015]).toBeGreaterThan(closed[0.035] + 40);
  }, 120000);

  it('a shape by each of its procedures, played in the rig as solved', () => {
    // a joint set: the claw's middle and last joints as set
    const claw = handShape(R, 'R', 'claw'), rc = handRead(R, rigNodesAt(R, { support: 'none', fingersR: claw.fingers }).nodes, 'R');
    expect(claw.name).toBe('tigerClaw');
    for (const d of FINGERS) { expect(rc[d].pip.value, d).toBeCloseTo(85, 0); expect(rc[d].dip.value, d).toBeCloseTo(65, 0); }
    // a reach to a point and onto another digit: the pinch's index tip, the thumb's on it
    const pinch = handShape(R, 'R', 'pinch');
    expect(pinch.digits.index.err).toBeLessThan(0.001); expect(pinch.digits.thumb.err).toBeLessThan(0.003); expect(pinch.past).toEqual([]);
    const n = rigNodesAt(R, { support: 'none', fingersR: pinch.fingers }).nodes;
    expect(dist(n.indexTipR, digitGeometry(R, box, 'index', pinch.fingers.index).chain[3])).toBeLessThan(1e-9);
    // closing onto the palm, and a reach kept clear of the folded fingers: the fist
    const fist = handShape(R, 'R', 'fist');
    for (const d of FINGERS) expect(fist.digits[d].gaps.at(-1), d).toBeLessThan(0.0025);
    expect(fist.digits.thumb.err).toBeLessThan(0.002); expect(fist.past).toEqual([]);
    expect(clearOf(fist.fingers, 'thumb'), 'the thumb clear of the fingers, within a skin’s give (3 mm; the word’s is 16 mm in)').toBeGreaterThan(-0.003);
  }, 240000);

  it('the fist’s fingers land near the `fist` word, whose own thumb runs through the fingers', () => {
    const fist = handShape(R, 'R', 'fist'), pe = poleError(R, 'R', fist);
    for (const d of FINGERS) expect(pe.tips[d], d).toBeLessThan(0.02);
    const word = Object.fromEntries(DIGITS.map((d) => [d, HAND_POSES.fist[d]]));
    expect(clearOf(word, 'thumb'), 'the word’s thumb pressed into the fingers').toBeLessThan(-0.01);
    expect(clearOf(fist.fingers, 'thumb')).toBeGreaterThan(-0.003);
  }, 240000);

  it('the door’s word list (hand-shape-words.js) is the shapes’ own: every name, every alias, the poles the hand words', () => {
    expect(Object.fromEntries(Object.entries(HAND_SHAPES).map(([k, s]) => [k, [...s.alias]]))).toEqual(Object.fromEntries(Object.entries(HAND_SHAPE_ALIASES).map(([k, a]) => [k, [...a]])));
    expect(Object.entries(HAND_SHAPES).filter(([, s]) => s.pole).map(([k]) => k).sort()).toEqual([...HAND_SHAPE_POLES].sort());
    for (const p of HAND_SHAPE_POLES) expect(Object.keys(HAND_POSES)).toContain(p);
  });

  it('words and aliases resolve, an unknown one throws, and the same solve gives the same hand', () => {
    for (const [name, s] of Object.entries(HAND_SHAPES)) for (const a of s.alias) expect(handShape(R, 'R', a).name, a).toBe(name);
    expect(() => handShape(R, 'R', 'jazzHands')).toThrow(/no hand shape 'jazzHands'/);
    expect(JSON.stringify(handShape(R, 'R', 'ok').fingers)).toBe(JSON.stringify(handShape(R, 'R', 'ok').fingers));
  }, 240000);
});
