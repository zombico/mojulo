// How a body takes what happens to it: the sim records what it reacts to (where a blow landed, how hard, what kind),
// and the reactions turn that into timed clips that read the hit, go further when it is heavier or a counter, come
// home by the end of the stun, fall by what put the body in the air, and get up from the floor through a knee.
import { describe, it, expect } from 'vitest';
import { compileFighter } from './versus-compile.js';
import { newVersus, stepVersus } from './versus-core.js';
import { solveFighter } from './versus-solver.js';
import { BTN } from './versus-input.js';
import { POSES } from './versus-library.js';
import { rigJoints, versusBody } from './versus-rig.js';
import { reactionPose, clipAt, DOWN_CLIP, RISE_CLIP, HIT_PEAKS } from './versus-react.js';

const Z = { x: 0, y: 0, b: 0 };
const K = compileFighter(solveFighter({ id: 'kata', archetype: 'all-rounder', signature: ['grab'] }).recipe);
const body = versusBody();

/** One fighter does `pad` once at close range; → the defender's rx after the first contact, and the run's states. */
function strike(pad, { d = 700, frames = 60 } = {}) {
  const ctx = { fighters: [K, K] };
  let s = newVersus(ctx, { rules: { intro: 1 } });
  s = stepVersus(s, [Z, Z], ctx);
  s.p[0].x = -Math.round(d / 2); s.p[1].x = Math.round(d / 2);
  const seen = [];
  for (let k = 0; k < frames; k++) {
    s = stepVersus(s, [k === 0 ? pad : (pad.hold ? { ...pad, b: 0 } : Z), Z], ctx);
    if (s.p[1].rx) seen.push({ st: s.p[1].st, ...s.p[1].rx });
  }
  return seen;
}
const base = (p) => ({ st: 'stand', sf: 0, stun: 0, low: 0, y: 0, ko: 0, rx: 0, ...p });
const lead = (pose) => rigJoints(body, pose);

describe('versus: the sim records what a body reacts to', () => {
  it('where a blow lands and what kind it is: a high jab, a low sweep, a launcher, a throw', () => {
    expect(strike({ x: 0, y: 0, b: BTN.L })[0]).toMatchObject({ k: 'hit', h: 0 });
    expect(strike({ x: 0, y: -1, b: BTN.H, hold: true })[0]).toMatchObject({ k: 'sweep', h: 2 });
    const grabbed = strike({ x: 0, y: 0, b: BTN.T }, { d: 500 });
    expect(grabbed[0]).toMatchObject({ st: 'thrown', k: 'grab' });
    expect(grabbed.some((r) => r.st === 'fall' && r.k === 'throw')).toBe(true);
  });
});

describe('versus: the reactions read the hit', () => {
  const at = (rx, t, extra = {}) => reactionPose(base({ st: 'hit', sf: Math.round(t * 20), stun: 20 - Math.round(t * 20), rx, ...extra }));
  it('a high blow snaps the head back, a body blow folds the trunk, a low one buckles the lead knee', () => {
    const high = at({ k: 'hit', h: 0, w: 1 }, 0.15), body_ = at({ k: 'hit', h: 1, w: 1 }, 0.15), low = at({ k: 'hit', h: 2, w: 1 }, 0.15);
    expect(high.head).toBeLessThan(POSES.guard.head - 25);
    expect(body_.torso).toBeGreaterThan(POSES.guard.torso + 20);
    expect(low.legF[0] - low.legF[1]).toBeGreaterThan(POSES.guard.legF[0] - POSES.guard.legF[1] + 30);   // the knee folds
    expect(lead(low).pelvis[1]).toBeLessThan(lead(POSES.guard).pelvis[1]);   // and the hips drop
  });

  it('a heavier blow carries further, a counter further still and holds longer; every one comes home by the end', () => {
    const peak = (w, c = 0, t = 0.15) => -at({ k: 'hit', h: 0, w, c }, t).head;
    expect(peak(0)).toBeLessThan(peak(1));
    expect(peak(1)).toBeLessThan(peak(2));
    expect(peak(1, 1)).toBeGreaterThan(peak(1));
    expect(peak(1, 1, 0.5)).toBeGreaterThan(peak(1, 0, 0.5));
    for (const h of [0, 1, 2]) expect(at({ k: 'hit', h, w: 2, c: 1 }, 1)).toEqual(expect.objectContaining({ torso: POSES.guard.torso, head: POSES.guard.head }));
    expect(reactionPose(base({ st: 'hit', low: 1, sf: 20, stun: 0, rx: { k: 'hit', h: 1, w: 1 } })).torso).toBe(POSES.crouch.torso);
  });

  it('a broken guard is blown open then sways, a block rocks back and settles into the guard', () => {
    const crush = (t) => reactionPose(base({ st: 'hit', sf: Math.round(t * 40), stun: 40 - Math.round(t * 40), rx: { k: 'crush', h: 1, w: 2 } }));
    expect(crush(0.05).armF[0]).toBeGreaterThan(90);
    expect(Math.sign(crush(0.35).twist)).not.toBe(Math.sign(crush(0.55).twist));
    const block = (t) => reactionPose(base({ st: 'block', sf: Math.round(t * 10), stun: 10 - Math.round(t * 10), rx: { k: 'block', h: 1, w: 1 } }));
    expect(block(0).torso).toBeLessThan(POSES.blockHigh.torso);
    expect(block(0.5).torso).toBeCloseTo(POSES.blockHigh.torso, 6);
  });
});

describe('versus: falling, down and up', () => {
  const fall = (k, sf) => reactionPose(base({ st: 'fall', sf, y: 500, rx: { k, h: 1, w: 2 } }));
  it('falls by what put the body in the air: a launch tumbles further than a knockdown, a sweep goes over fastest, a throw turns it over', () => {
    expect(fall('launch', 30).pitch).toBeLessThan(fall('down', 30).pitch + 1);
    expect(fall('sweep', 6).pitch).toBeLessThan(fall('down', 6).pitch);
    expect(fall('throw', 40).pitch).toBeLessThan(fall('down', 40).pitch - 30);   // turned over onto its back
    for (const k of ['launch', 'down', 'sweep', 'air', 'throw', 'blown']) expect(fall(k, 10).air, k).toBe(true);
    expect(fall('sweep', 4).legF[0]).toBeGreaterThan(80);   // the legs taken out from under it
  });

  it('lands with a slam and a bounce, lies on its back, then rolls to a knee; rises from that knee to the guard', () => {
    const down = (t) => clipAt(DOWN_CLIP, t);
    expect(down(0.1).pitch).toBeLessThan(down(0.2).pitch);   // the slam, then the bounce up
    expect(down(0.5)).toMatchObject({ lie: true, pitch: -90 });
    expect(rigJoints(body, down(0.5)).head[1]).toBeLessThan(body.height * 0.25);   // lying: the head near the floor
    expect(down(1)).toEqual(expect.objectContaining({ torso: RISE_CLIP[0][1].torso }));
    expect(clipAt(RISE_CLIP, 1)).toMatchObject(POSES.guard);
    const rising = reactionPose(base({ st: 'rise', sf: 5 }), { rise: 10 });
    expect(rising.torso).toBeGreaterThan(POSES.guard.torso);
  });

  it('every reacting state has a pose, and every other state none', () => {
    for (const st of ['hit', 'block', 'fall', 'ko', 'down', 'rise', 'tech', 'thrown']) expect(reactionPose(base({ st, rx: { k: 'hit', h: 1, w: 1 } })), st).toBeTruthy();
    for (const st of ['stand', 'crouch', 'walkF', 'air', 'move', 'win']) expect(reactionPose(base({ st })), st).toBeNull();
    expect(Object.keys(HIT_PEAKS)).toEqual(['high', 'body', 'low', 'crouch']);
  });
});
