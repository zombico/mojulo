import { describe, expect, it } from 'vitest';

import { createState, simulate, normalizeBody } from './worlds/physics-sim.js';

const vlen = (v) => Math.hypot(v[0], v[1], v[2]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('tether constraint (the interactive pendulum)', () => {
  it('derives the rod length from the rest gap when not given', () => {
    const b = normalizeBody({ collider: 'sphere', position: [2, 0, 5], anchor: [0, 0, 5] });
    expect(b.tether).toBeCloseTo(2, 6);
    expect(b.anchor).toEqual([0, 0, 5]);
  });

  it('a tethered ball swings like a pendulum: stays on the rod, passes the bottom, rises the far side', () => {
    // anchor above-left, ball released horizontally to the right at the same height → swings down+over.
    const s = createState({ gravity: [0, 0, -9.8], bodies: [{ id: 'p', collider: 'sphere', position: [2, 0, 8], radius: 0.3, anchor: [0, 0, 8] }] });
    const anchor = [0, 0, 8];
    let minZ = Infinity; let maxLenErr = 0; let reachedFarSide = false;
    for (let i = 0; i < 240; i++) {
      simulate(s, 1 / 120, 1);
      const p = s.bodies[0].position;
      minZ = Math.min(minZ, p[2]);
      maxLenErr = Math.max(maxLenErr, Math.abs(dist(p, anchor) - 2));
      if (p[0] < -0.5) reachedFarSide = true;   // swung past the bottom to the other side
    }
    expect(maxLenErr).toBeLessThan(1e-6);        // rigid rod: the constraint holds every step
    expect(minZ).toBeLessThan(6.5);              // it dropped well below the release height
    expect(reachedFarSide).toBe(true);           // and swung up the opposite side (energy ~conserved)
  });

  it("Newton's cradle momentum transfer: an end ball strikes a touching row, the FAR ball ejects", () => {
    // 4 tethered balls in a row, just touching (spacing = 2r), hanging from anchors directly above.
    const r = 0.5; const z = 8; const top = z + 3;
    const bodies = [];
    for (let i = 0; i < 4; i++) {
      const x = i * 2 * r;
      bodies.push({ id: 'c-' + i, collider: 'sphere', position: [x, 0, z], radius: r, restitution: 1, friction: 0, anchor: [x, 0, top] });
    }
    bodies[0].velocity = [4, 0, 0];   // rig the left end ball inward (a direction) — this is the "pull"
    const s = createState({ gravity: [0, 0, -9.8], bodies });
    simulate(s, 1 / 120, 120);        // 1s: the pulse travels the chain and the far ball swings out
    const v = s.bodies.map((b) => vlen(b.velocity));
    // the far ball (index 3) carries the most speed; the struck end ball (0) has given most of it up.
    expect(v[3]).toBeGreaterThan(v[0]);
    expect(v[3]).toBeGreaterThan(v[1]);
    expect(v[3]).toBeGreaterThan(v[2]);
  });
});
