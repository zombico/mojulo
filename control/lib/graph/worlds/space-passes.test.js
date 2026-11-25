import { describe, expect, it } from 'vitest';

import { createWorld, stepWorld } from './controllable-world.js';

// ── a space mind that flies passes (mind.js `rule.passes`) ───────────────────────────────────────────────────────────
// A fighter never hovers: it flies down its nose at its speed, runs in on its target, breaks off near it, extends away and
// turns back in for another pass, its nose turning at its own rate. Deterministic.

const DT = 1 / 30;
const world = (rule = {}) => createWorld({
  entities: [
    { id: 'p', pilotable: true, team: 'a', rule: { type: 'static' }, body: { type: 'mesh', hittable: true, hp: 9999, radius: 5, egg: { a: 5, c: 3, cz: 0 } }, transform: { pos: [0, 0, 0] } },
    { id: 'f', team: 'b', rule: { type: 'ai', space: true, passes: true, target: 'enemy', speed: 80, turn: 1.4, standoff: 200, fireArc: 6, burst: 0.4, pause: 1.4, sightRange: 5000, eye: 0, ...rule },
      weapon: { fireClass: 'lob', auto: true, rof: 3, damage: 1, range: 1000, lobAngle: 0, projectileSpeed: 900, projectileGravity: 0, projRadius: 1.5, fuse: 2, noGround: true, passTeam: true, eye: 0 },
      body: { type: 'mesh', hittable: true, hp: 3, radius: 5, egg: { a: 5, c: 3, cz: 0 } }, transform: { pos: [1200, 0, 0], heading: Math.PI } },
  ],
});

describe('a fighter flying passes', () => {
  it('never stops: runs in, breaks off near its target, extends away and comes back for more', () => {
    const w = world(), f = w.byId.f, d = [], speeds = [];
    for (let i = 0; i < 30 * 60; i++) {
      const q = f.transform.pos.slice();
      stepWorld(w, {}, DT, { ground: () => null });
      speeds.push(Math.hypot(f.transform.pos[0] - q[0], f.transform.pos[1] - q[1], f.transform.pos[2] - q[2]) / DT);
      d.push(Math.hypot(...f.transform.pos));
    }
    expect(Math.min(...speeds.slice(30))).toBeGreaterThan(79);          // it never hovers
    // its passes: in close, out past its extend, in again, more than once
    let passes = 0, inClose = false;
    for (const x of d) { if (!inClose && x < 100) { inClose = true; passes++; } else if (inClose && x > 450) inClose = false; }
    expect(passes).toBeGreaterThanOrEqual(3);
    expect(Math.min(...d)).toBeGreaterThan(5);                            // it breaks before it rams
  });

  it('fires on its runs in, not as it extends', () => {
    const w = world(), f = w.byId.f;
    let firedOut = 0, firedIn = 0;
    for (let i = 0; i < 30 * 40; i++) { stepWorld(w, {}, DT, { ground: () => null }); if (f.aiFire) { if (f.passState === 'extend') firedOut++; else firedIn++; } }
    expect(firedIn).toBeGreaterThan(0);
    expect(firedOut).toBe(0);
  });

  it('is deterministic', () => {
    const go = () => { const w = world(); for (let i = 0; i < 900; i++) stepWorld(w, {}, DT, { ground: () => null }); return w.byId.f.transform.pos; };
    expect(go()).toEqual(go());
  });
});
