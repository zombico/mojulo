import { describe, expect, it } from 'vitest';

import { createWorld, stepWorld } from './controllable-world.js';

// The moves a power gives (gameworld TRAVERSAL_MOVES): the platform rule's `airJumps` (a jump in the air, reset on the
// ground) and `glideFall` (a held jump slows the fall). Absent, the rule jumps and falls as it did (the trace pins).
const FLAT = { ground: () => 0 };
const hero = (rule, z = 0) => createWorld({ entities: [{ id: 'hero', pilotable: true, rule: { type: 'platform', ...rule }, transform: { pos: [0, 0, z], heading: 0 } }] });
const step = (w, input, n = 1) => { for (let i = 0; i < n; i++) stepWorld(w, input, 1 / 60, FLAT); return w.byId.hero; };
// a jump from the ground, held; at the top a second press (a fresh edge), still held; the highest point reached
function jumpTwice(rule, presses = 1) {
  const w = hero(rule);
  step(w, {}, 5);
  step(w, { jump: true, jumpHeld: true });
  let e = step(w, { jumpHeld: true }, 1), top = 0;
  while (e.vel[2] > 0.5) { e = step(w, { jumpHeld: true }); top = Math.max(top, e.transform.pos[2]); }
  for (let p = 0; p < presses; p++) { e = step(w, { jump: true, jumpHeld: true }); for (let i = 0; i < 20; i++) { e = step(w, { jumpHeld: true }); top = Math.max(top, e.transform.pos[2]); } }
  return { w, top, e };
}

describe('airJumps: the double jump', () => {
  it('a press in the air launches again, so the jump climbs higher; without the knob it does not', () => {
    const one = jumpTwice({}), two = jumpTwice({ airJumps: 1 });
    expect(two.top).toBeGreaterThan(one.top + 0.5);
    expect(two.e.airJumpsUsed).toBe(1);
  });

  it('spends no more than it has, and the count comes back on the ground', () => {
    const b = jumpTwice({ airJumps: 1 }, 1);
    let e = step(b.w, {}, 10);
    const v0 = e.vel[2];
    e = step(b.w, { jump: true, jumpHeld: true });        // a second air press finds none left: gravity alone
    expect(e.vel[2]).toBeLessThan(v0);
    expect(e.airJumpsUsed).toBe(1);
    for (let i = 0; i < 300 && !e.grounded; i++) e = step(b.w, {});
    expect(e.grounded).toBe(true);
    e = step(b.w, {});
    expect(e.airJumpsUsed).toBe(0);
  });

  it('launches at airJumpMult of the jump speed', () => {
    const { w } = jumpTwice({ airJumps: 1, jumpSpeed: 10, airJumpMult: 0.5 }, 0);
    let e = step(w, { jumpHeld: true });
    e = step(w, { jump: true, jumpHeld: true });
    // the launch frame: set to 5, then one frame of rise gravity
    expect(e.vel[2]).toBeCloseTo(5 - 20 / 60, 6);
  });
});

describe('glideFall: the glide', () => {
  const fall = (rule, held) => { const w = hero(rule, 40); let e; for (let i = 0; i < 60; i++) e = step(w, held ? { jumpHeld: true } : {}); return e; };
  it('a held jump caps the fall at its speed; let go, the fall is as before', () => {
    expect(fall({ glideFall: 2.5 }, true).vel[2]).toBeCloseTo(-2.5, 9);
    expect(fall({ glideFall: 2.5 }, false).vel[2]).toBe(fall({}, false).vel[2]);
    expect(fall({}, true).vel[2]).toBeLessThan(-10);      // no knob: holding jump changes nothing
  });
});
