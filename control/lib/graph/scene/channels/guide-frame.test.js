// A frame's lessons on the guide (gameworld/frame-goal.js FRAME_LESSONS): each kept up until the frame does it, read off
// its own state (a boost held, a quick boost, the climb, a slot's rounds, the sight locked), and a group that waits for
// its task (`when`) hidden until the objectives reach it. Run against a stub page: the script's own clock and frames.
import { describe, expect, it } from 'vitest';
import { guideScript } from './guide.js';
import { readFrameLessons, FRAME_LESSON_TASK } from '../../gameworld/frame-goal.js';

function page(guide) {
  const el = () => ({ className: '', innerHTML: '', textContent: '', style: {}, appendChild() {} });
  let now = 0, frame = null;
  const P = { id: 'p', pilotable: true, transform: { pos: [0, 0, 0], heading: 0 }, rule: { type: 'frame', slots: { armR: { st: { shots: 0 } }, backL: { st: { shots: 0 } } } }, v: [0, 0, 0] };
  const W = { pilotId: 'p', byId: { p: P }, entities: [P] };
  const win = { __mojCtrl: { world: W }, __mojBus: { state: { vars: { [FRAME_LESSON_TASK]: 0 } } } };
  const doc = { createElement: el, head: { appendChild() {} }, body: el() };
  new Function('window', 'document', 'performance', 'requestAnimationFrame', guideScript(guide))(win, doc, { now: () => now }, (f) => { frame = f; });
  // (a step: the clock on by dt seconds, the frame drawn)
  const step = (dt = 0.05, n = 1) => { for (let i = 0; i < n; i++) { now += dt * 1000; const f = frame; frame = null; f(); } };
  return { P, win, step, at: () => win.__mojGuide.lesson(), showing: () => win.__mojGuide.showing() };
}

describe('a frame\'s lessons', () => {
  const lessons = readFrameLessons([{ teach: ['boost', 'quick-boost', 'climb'] }, { teach: ['right-hand', 'left-shoulder', 'lock'], at: 2 }], 3);
  const guide = { steps: [], lessons, done: '' };

  it('each is kept up until the frame does it, read off its own state', () => {
    const G = page(guide);
    G.step(0.05, 60);
    expect(G.at()).toBe(0);                      // (three seconds, no boost: still the boost)
    G.P.boosting = true; G.step(0.05, 40); G.P.boosting = false;
    expect(G.at()).toBe(1);
    G.step(0.05, 40);
    expect(G.at()).toBe(1);                      // (no quick boost yet)
    G.P.qbT = 0.2; G.step(0.05, 30); G.P.qbT = 0;
    expect(G.at()).toBe(2);
    G.P.ascending = true; G.step(0.05, 40); G.P.ascending = false;
    expect(G.at()).toBe(3);
  });

  it('a group that waits for its task shows nothing until the objectives reach it, then is done by its slot\'s rounds and the lock', () => {
    const G = page(guide);
    G.P.boosting = true; G.step(0.05, 40); G.P.boosting = false; G.P.qbT = 0.2; G.step(0.05, 30); G.P.qbT = 0; G.P.ascending = true; G.step(0.05, 40); G.P.ascending = false;
    G.step(0.05, 400);
    expect(G.at()).toBe(3);
    expect(G.showing()).toBe('way');             // (waiting: nothing of it shown, however long)
    G.win.__mojBus.state.vars[FRAME_LESSON_TASK] = 1;
    G.step(0.05, 40);
    expect(G.at()).toBe(3);                      // (its right hand not fired yet)
    G.P.rule.slots.armR.st.shots = 3; G.step(0.05, 30);
    expect(G.at()).toBe(4);
    G.P.rule.slots.backL.st.shots = 1; G.step(0.05, 30);
    expect(G.at()).toBe(5);
    G.P.locked = true; G.step(0.05, 30);
    expect(G.win.__mojGuide.showing()).not.toBe('keys');
  });

  it('a word it does not teach, or a task it has not, is refused by name', () => {
    expect(() => readFrameLessons([{ teach: ['fly'] }], 2)).toThrow(/'fly'/);
    expect(() => readFrameLessons([{ teach: ['boost'], at: 3 }], 2)).toThrow(/at is the task \(1 to 2\)/);
  });
});
