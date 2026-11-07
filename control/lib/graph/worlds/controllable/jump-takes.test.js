import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '@/lib/graph/worlds/controllable-world';
import { feelRule } from '@/lib/graph/gameworld/feel/lower.js';
import { controllableChannelScript } from '@/lib/graph/scene/channels/controllable/index.js';

// THE TAKES (rules-platform.js, opt-in `takes`, a feel's `takes: true`): the hero's own jumps played on the runtime's
// flight. The state names the jump (from standing, out of the run, in the air), the phase walks its clip: the gather over
// the wind-up, the air over the flight (never backwards, a cut jump included), the landing over the card's frames. Absent
// `takes` → the held leap, as before. One template per shape of card: one with no gather and an air jump (the mascot
// platformer), one with a gather (the first template whose card commits before the take-off).

const DT = 1 / 60;
const FLAT = { ground: () => 0 };
const mk = (rule) => createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, ...rule }, transform: { pos: [0, 0, 0], heading: 0 } }] });
const step = (w, input, world = FLAT) => { stepWorld(w, input, DT, world); const e = w.byId.p; return { state: e.locomotion, phase: e.gaitPhase, grounded: e.grounded, vz: e.vel[2], z: e.transform.pos[2] }; };
const settle = (w, n = 10, input = {}) => { for (let i = 0; i < n; i++) step(w, input); };
// a press on frame 0, the button held `hold` frames, then let go; `n` frames in all
const jump = (w, { n = 120, hold = 60, input = {} } = {}) => Array.from({ length: n }, (_, f) => step(w, { ...input, jump: f === 0, jumpHeld: f < hold }));

const giuseppe = feelRule({ pole: 'jumping-giuseppe', takes: true });

describe('the takes: the hero\'s own jumps on the flight', () => {
  it('absent, a jump holds the library\'s leap and keeps no take', () => {
    const w = mk(feelRule('jumping-giuseppe')); settle(w);
    const fr = jump(w, { n: 20 });
    expect(fr.filter((x) => !x.grounded).every((x) => x.state === 'leap')).toBe(true);
    expect(w.byId.p.take).toBeUndefined();
  });

  it('a standing jump plays its air forward through the flight, the apex at its middle, then lands on the card\'s frames', () => {
    const K = giuseppe.takes, w = mk(giuseppe); settle(w);
    const fr = jump(w);
    const air = fr.filter((x) => !x.grounded);
    expect(new Set(air.map((x) => x.state))).toEqual(new Set(['jump_up']));
    // the air's phase stays inside the clip's air and never runs backwards
    expect(air.every((x) => x.phase >= K.up[0] - 1e-9 && x.phase < K.up[1])).toBe(true);
    expect(air.every((x, i) => !i || x.phase >= air[i - 1].phase - 1e-12)).toBe(true);
    // the apex (the highest frame) plays the air's middle
    const top = air.reduce((a, b) => (b.z > a.z ? b : a));
    expect(top.phase).toBeCloseTo((K.up[0] + K.up[1]) / 2, 1);
    // down: the landing's part of the clip for the card's frames, then the take lets go
    const down = fr.findIndex((x, i) => i > 0 && x.grounded && !fr[i - 1].grounded);
    const landing = fr.slice(down).filter((x) => x.state === 'jump_up');
    expect(landing.length).toBe(Math.round(K.land / DT));
    expect(landing.every((x) => x.phase >= K.up[1] && x.phase < 1)).toBe(true);
    expect(fr.at(-1).state).not.toBe('jump_up');
  });

  it('a jump out of the run plays the jump forward, and the run picks its cycle up where it left it', () => {
    const w = mk(giuseppe); settle(w, 40, { forward: 1 });
    const before = w.byId.p.gaitPhase;
    const fr = jump(w, { n: 90, input: { forward: 1 } });
    expect(fr.filter((x) => !x.grounded).every((x) => x.state === 'jump_fwd')).toBe(true);
    const back = fr.findIndex((x, i) => i > 0 && x.state === 'forward' && fr[i - 1].state === 'jump_fwd');
    expect(back).toBeGreaterThan(0);
    expect(fr[back].phase - before).toBeLessThan(0.2);   // the cycle resumed, a frame's run past the take-off's phase
  });

  it('a jump cut short carries its clip on from where it was, never skipping back', () => {
    const w = mk(giuseppe); settle(w);
    const fr = jump(w, { hold: 3 }), air = fr.filter((x) => !x.grounded);
    expect(air.every((x, i) => !i || x.phase >= air[i - 1].phase - 1e-12)).toBe(true);
    // no frame leaps more than the clip's air in a few frames: the cut rescales the rise
    const K = giuseppe.takes.up, most = Math.max(...air.slice(1).map((x, i) => x.phase - air[i].phase));
    expect(most).toBeLessThan((K[1] - K[0]) * 0.15);
  });

  it('an air jump plays the double jump from its kick', () => {
    const K = giuseppe.takes.air, w = mk(giuseppe); settle(w);
    const fr = Array.from({ length: 90 }, (_, f) => step(w, { jump: f === 0 || f === 20, jumpHeld: true }));
    const second = fr.slice(20).filter((x) => !x.grounded);
    expect(second[0].state).toBe('jump_air');
    expect(second.every((x) => x.state === 'jump_air' && x.phase >= K[0] - 1e-9 && x.phase < K[1])).toBe(true);
  });

  it('walking off an edge plays the standing take\'s fall', () => {
    const K = giuseppe.takes.up, w = mk(giuseppe), LEDGE = { ground: (p) => (p[0] < 1 ? 0 : -3) };
    for (let i = 0; i < 10; i++) stepWorld(w, {}, DT, LEDGE);
    const fr = Array.from({ length: 60 }, () => { stepWorld(w, { forward: 1 }, DT, LEDGE); const e = w.byId.p; return { state: e.locomotion, phase: e.gaitPhase, grounded: e.grounded }; });
    const fall = fr.filter((x) => !x.grounded);
    expect(fall.length).toBeGreaterThan(0);
    expect(fall.every((x) => x.state === 'jump_up' && x.phase >= (K[0] + K[1]) / 2 - 1e-9)).toBe(true);
  });

  it('a card that gathers plays the take\'s gather over the wind-up, then its air', () => {
    const rule = { ...giuseppe, jumpWindup: 0.1 }, K = rule.takes.up, w = mk(rule); settle(w);
    const fr = jump(w, { n: 30 });
    const gather = fr.filter((x) => x.grounded && x.state === 'jump_up' && x.phase < K[0]);
    expect(gather.length).toBeGreaterThan(2);
    expect(gather.every((x, i) => !i || x.phase >= gather[i - 1].phase)).toBe(true);
    expect(fr.filter((x) => !x.grounded).every((x) => x.state === 'jump_up' && x.phase >= K[0] - 1e-9)).toBe(true);
  });

  it('the look: the flight stretches with the speed, none at the apex, the landing squashes and springs back; no squash, no shape', () => {
    const Q = giuseppe.takes.squash, w = mk(giuseppe); settle(w);
    expect(Q).toBeGreaterThan(0);
    const fr = Array.from({ length: 120 }, (_, f) => { stepWorld(w, { jump: f === 0, jumpHeld: f < 60 }, DT, FLAT); const e = w.byId.p; return { sq: e.squash, grounded: e.grounded, vz: e.vel[2] }; });
    const air = fr.filter((x) => !x.grounded);
    expect(air[0].sq[1]).toBeCloseTo(1 + 0.5 * Q, 2);                                    // the take-off: the most stretch
    expect(Math.min(...air.map((x) => (x.sq ? x.sq[1] : 1)))).toBeGreaterThanOrEqual(1);  // the air never squashes
    for (const x of fr.filter((y) => y.sq)) expect(x.sq[0] * x.sq[0] * x.sq[1]).toBeCloseTo(1, 9);   // the volume kept
    const down = fr.findIndex((x, i) => i > 0 && x.grounded && !fr[i - 1].grounded);
    expect(fr[down].sq[1]).toBeCloseTo(1 - Q, 6);                                        // the landing: the most squash
    expect(fr.at(-1).sq).toBeNull();                                                      // then its own shape
    const flat = mk(feelRule('jumping-giuseppe')); settle(flat); jump(flat, { n: 30 });
    expect(flat.byId.p.squash).toBeUndefined();
  });

  it('the renderer\'s squash is emitted only for a page whose rule carries one', () => {
    const ent = (rule) => [{ id: 'h', pilotable: true, rule: { type: 'platform', ...rule }, body: { type: 'figure-rig', figure: 'h' }, transform: { pos: [0, 0, 0], heading: 0 } }];
    const fig = { h: { rig: true, clips: {} } };
    const plain = controllableChannelScript(ent(feelRule('jumping-giuseppe')), null, fig), squashed = controllableChannelScript(ent(giuseppe), null, fig);
    expect(plain).not.toContain('userData.s0');
    expect(squashed).toContain('userData.s0');
  });
});
