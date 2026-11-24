import { describe, it, expect } from 'vitest';
import { composeLive, emissionSource } from './compose.js';

// THE LEDGE: a lip the hands take, hung from, shimmied along, pulled up over, leapt between, dropped from
const CW = composeLive();
const DT = 1 / 60;
// the camera faces the wall (+y): the stick's up is into it, its right along the wall's +x
CW.RULES.__faceWall = (e) => { e.camYaw = Math.PI / 2; };
// a block 10 m long, its south face at y = 0, its top at 5 m; a ledge stone jutting from the face 1.8 m above its lip
const BLOCK = { min: [0, 0, 0], max: [10, 4, 5] }, STONE = { min: [0, -0.3, 6.5], max: [10, 0, 6.8] };
const ground = (cs) => ({ ground: (p) => { let z = 0; for (const c of cs) if (p[0] >= c.min[0] && p[0] <= c.max[0] && p[1] >= c.min[1] && p[1] <= c.max[1] && c.max[2] <= p[2] + 0.6 && c.max[2] > z) z = c.max[2]; return z; } });
const world = (colliders = [BLOCK], at = [5, -0.6, 3.5]) => {
  const w = CW.createWorld({ entities: [{ id: 'h', pilotable: true, rule: { type: 'platform', eye: 0, speed: 5, collideRadius: 0.3, ledge: true }, transform: { pos: at, heading: Math.PI / 2 } }], camera: { rule: '__faceWall' }, colliders });
  w.pilotId = 'h';
  return w;
};
const run = (w, n, input = {}, cs = [BLOCK]) => { for (let i = 0; i < n; i++) CW.stepWorld(w, typeof input === 'function' ? input(i) : input, DT, ground(cs)); return w; };

describe('the ledge', () => {
  it('absent adds nothing: no emitted source, no hold taken', () => {
    expect(emissionSource({})).not.toContain('ledge:catch');
    expect(emissionSource({ ledge: true })).toContain('ledge:catch');
    const w = CW.createWorld({ entities: [{ id: 'h', pilotable: true, rule: { type: 'platform', eye: 0 }, transform: { pos: [5, -0.6, 3.5], heading: 0 } }], colliders: [BLOCK] });
    w.pilotId = 'h';
    run(w, 60);
    expect(w.byId.h.ledge ?? null).toBeNull();
  });

  it('a fall past a lip catches it and hangs there, the hands at the lip', () => {
    const w = run(world(), 60), h = w.byId.h;
    expect(h.ledge).toBeTruthy();
    expect(h.transform.pos[2]).toBeCloseTo(5 - 1.9, 5);
    expect(h.transform.pos[1]).toBeLessThan(0);              // outside the face
    expect(h.locomotion).toBe('hang');
    expect(h.moving).toBe(true);                               // (held still, the hang is played, never the idle)
  });

  it('shimmies along it with the stick, as the camera reads it', () => {
    const w = run(world(), 60), x0 = w.byId.h.transform.pos[0];
    run(w, 60, { strafe: 1 });
    expect(w.byId.h.transform.pos[0] - x0).toBeCloseTo(1.4, 1);
    expect(w.byId.h.locomotion).toBe('shimmy');
  });

  it('jump pulls it up over the lip onto the top', () => {
    const w = run(world(), 60);
    run(w, 2, (i) => ({ jump: i === 0 ? 1 : 0 }));
    run(w, 60);
    const h = w.byId.h;
    expect(h.ledge).toBeNull();
    expect(h.transform.pos[2]).toBeCloseTo(5, 1);
    expect(h.transform.pos[1]).toBeGreaterThan(0.3);           // on the top
  });

  it('jump up to a ledge stone above leaps to it', () => {
    const cs = [BLOCK, STONE], w = run(world(cs), 60, {}, cs);
    run(w, 2, (i) => ({ jump: i === 0 ? 1 : 0, forward: 1 }), cs);
    run(w, 40, {}, cs);
    expect(w.byId.h.ledge).toBeTruthy();
    expect(w.byId.h.transform.pos[2]).toBeCloseTo(6.8 - 1.9, 3);
  });

  it('held away it drops; away and jump it kicks off', () => {
    const d = run(world(), 60);
    run(d, 30, { forward: -1 });
    expect(d.byId.h.ledge).toBeNull();
    const k = run(world(), 60);
    run(k, 1, { forward: -1, jump: 1 });
    expect(k.byId.h.ledge).toBeNull();
    expect(k.byId.h.vel[1]).toBeLessThan(-1);                  // off the face, away from it
  });

  it('the bus hears a catch and a pull', () => {
    const w = world(), events = [];
    let prev = null;
    for (let i = 0; i < 160; i++) { CW.stepWorld(w, { jump: i === 70 ? 1 : 0 }, DT, ground([BLOCK])); const f = CW.castFacts(w, prev); prev = f.prev; events.push(...f.events.filter((x) => x.type.startsWith('ledge:')).map((x) => x.type)); }
    expect(events).toEqual(['ledge:catch', 'ledge:pull']);
  });
});
