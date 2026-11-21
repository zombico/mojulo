import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';

// THE DIVE ON A BUTTON (dive.js): one press takes the rule's dodge; the body covers its ground and waits its cooldown.

const E = composeLive();
const hooks = { ground: () => 0 };
const world = (dive = { jump: false }) => E.createWorld({
  camera: { rule: 'follow', target: 'p' },
  entities: [{ id: 'p', pilotable: true, rule: { type: 'platform', speed: 5, eye: 0, jumpSpeed: 6, dodge: true, dodgeDur: 0.8, dodgeSpeed: 9.5, dodgeCooldown: 1, dodgeBoostCost: 0, ...(dive ? { dive } : {}) }, body: { type: 'mesh' }, transform: { pos: [0, 0, 0], heading: 0 } }],
});
const run = (w, input, n = 1) => { let top = 0; for (let k = 0; k < n; k++) { E.stepWorld(w, input, 1 / 60, hooks); top = Math.max(top, w.byId.p.transform.pos[2]); } return top; };

describe('the dive on a button', () => {
  it('is emitted only into a world that asks for it', () => {
    expect(emissionSource({})).not.toContain('stepWithDive');
    expect(emissionSource({ dive: true })).toContain('stepWithDive');
  });
  it('one press dives: the body covers the dodge\'s ground standing still, and a body without it does not', () => {
    const w = world(); run(w, {}, 5); run(w, { dive: 1 }, 2);
    expect(w.byId.p.dodgeT).not.toBeNull();
    run(w, {}, 60);
    const far = Math.hypot(w.byId.p.transform.pos[0], w.byId.p.transform.pos[1]);
    expect(far).toBeGreaterThan(4);
    expect(far).toBeLessThan(5.5);
    const b = world(null); run(b, {}, 5); run(b, { dive: 1 }, 2); run(b, {}, 60);
    expect(Math.hypot(b.byId.p.transform.pos[0], b.byId.p.transform.pos[1])).toBeLessThan(0.01);
  });
  it('another waits a second from the first, however the button is pressed', () => {
    const w = world(); run(w, {}, 5); run(w, { dive: 1 }, 2); run(w, {}, 50);     // the dive done (0.8 s)
    expect(w.byId.p.dodgeT).toBeNull();
    run(w, { dive: 1 }, 2); run(w, {}, 2);
    expect(w.byId.p.dodgeT).toBeNull();                                           // inside the second: refused
    run(w, {}, 70); run(w, { dive: 1 }, 2);                                       // past the second
    expect(w.byId.p.dodgeT).not.toBeNull();
  });
  it('`jump: false`: the jump does nothing', () => {
    const w = world(); run(w, {}, 5);
    expect(run(w, { jump: 1, jumpHeld: 1 }, 30)).toBeLessThan(0.01);
    const b = world({}); run(b, {}, 5);
    expect(run(b, { jump: 1, jumpHeld: 1 }, 30)).toBeGreaterThan(0.2);
  });
});

// (the page: a dive whose rule says `blink: false` is invincible and drawn whole; every other i-frame still shimmers, and a
// page whose rules ask nothing keeps its line as it was)
import { controllableChannelScript } from '../../scene/channels/controllable/index.js';
describe('the dive drawn whole', () => {
  const cam = { rule: 'follow', target: 'p' }, ent = (dive) => [{ id: 'p', pilotable: true, rule: { type: 'platform', dodge: true, dive }, body: { type: 'mesh' }, transform: { pos: [0, 0, 0], heading: 0 } }];
  it('no flicker through a dive that says so; the shimmer line untouched where none does', () => {
    const steady = controllableChannelScript(ent({ jump: false, blink: false }), cam, {}), plain = controllableChannelScript(ent({ jump: false }), cam, {});
    expect(steady).toContain('e.invincible && !(e.dodgeT != null && e.rule && e.rule.dive && e.rule.dive.blink === false)');
    expect(plain).not.toContain('dive.blink === false');
    expect(plain).toMatch(/\n  if \(e\.invincible\) \{/);
  });
});
