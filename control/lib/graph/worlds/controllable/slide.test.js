import { describe, it, expect } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { readSlides } from './slide.js';

// THE SLIDE: a slope from a crest, a body taken by it, down it gathering speed, steered across it, bumped by a boulder,
// flung off by a jump, gone off its foot level at its speed
const CW = composeLive();
const DT = 1 / 60;
// the camera faces down the slope (+x): the stick's up is down it, its right the slope's right (−y)
CW.RULES.__downSlope = (e) => { e.camYaw = 0; };
// a crest 10 m up to x 0; the slope down 10 m to x 28; a flat foot beyond at 0
const SLOPE = { id: 's', a: [0, 0, 10], b: [28, 0, 0], half: 3 };
const CREST = { min: [-6, -3, 0], max: [0, 3, 10] };
const ground = (cs) => ({ ground: (p) => { let z = 0; for (const c of cs) if (p[0] >= c.min[0] && p[0] <= c.max[0] && p[1] >= c.min[1] && p[1] <= c.max[1] && c.max[2] <= p[2] + 0.6 && c.max[2] > z) z = c.max[2]; return z; } });
const world = (colliders = [CREST], extra = {}) => {
  const w = CW.createWorld({ entities: [{ id: 'h', pilotable: true, rule: { type: 'platform', eye: 0, speed: 6, jumpSpeed: 7, collideRadius: 0.3, ...extra }, transform: { pos: [-2, 0, 10], heading: 0 } }],
    camera: { rule: '__downSlope' }, colliders, slides: [SLOPE] });
  w.pilotId = 'h';
  return w;
};
const run = (w, n, input = {}, cs = [CREST]) => { for (let i = 0; i < n; i++) CW.stepWorld(w, typeof input === 'function' ? input(i, w) : input, DT, ground(cs)); return w; };

describe('the slide', () => {
  it('reads its slopes and teaches on one it cannot take; absent adds nothing', () => {
    expect(readSlides([SLOPE])).toEqual([SLOPE]);
    expect(() => readSlides([{ id: 'x', a: [0, 0, 0], b: [10, 0, 5] }])).toThrow(/foot is below its top/);
    expect(() => readSlides([{ id: 'x', a: [0, 0, 30], b: [5, 0, 0] }])).toThrow(/70°/);
    expect(emissionSource({})).not.toContain("registerBodyOwner('slide'");
    expect(emissionSource({ slide: true })).toContain("registerBodyOwner('slide'");
    const w = CW.createWorld({ entities: [{ id: 'h', pilotable: true, rule: { type: 'platform', eye: 0 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    expect(w.slides).toBeUndefined();
  });

  it('takes a body run onto it and slides it down, faster and faster, on its surface', () => {
    const w = world(), speeds = [];
    run(w, 200, (i, W) => { if (W.byId.h.slide) speeds.push(W.byId.h.slide.v); return { forward: 1 }; });
    expect(speeds.length).toBeGreaterThan(30);
    expect(speeds[speeds.length - 1]).toBeGreaterThan(speeds[0] + 4);      // gathering speed
    expect(Math.max(...speeds)).toBeLessThanOrEqual(14);                    // to its top
  });

  it('holds the body on its surface, faced down it, playing the slide', () => {
    const w = run(world(), 70, { forward: 1 }), h = w.byId.h;
    expect(h.slide).toBeTruthy();
    const x = h.transform.pos[0];
    expect(h.transform.pos[2]).toBeCloseTo(10 - (10 * x) / 28, 5);
    expect(h.transform.heading).toBeCloseTo(0, 5);
    expect([h.locomotion, h.grounded]).toEqual(['slide', true]);
  });

  it('is steered across by the stick, never past its edge', () => {
    const w = run(world(), 60, { forward: 1 });
    const y0 = w.byId.h.transform.pos[1];
    run(w, 30, { strafe: 1 });                                               // right, as the camera reads it: −y
    expect(w.byId.h.transform.pos[1]).toBeLessThan(y0 - 1);
    // (pressed against its edge for as long as it holds the body: never past it)
    let held = 0;
    run(w, 200, (i, W) => { if (W.byId.h.slide) { held++; expect(W.byId.h.transform.pos[1]).toBeGreaterThanOrEqual(-3 + 0.3 - 1e-9); } return { strafe: 1 }; });
    expect(held).toBeGreaterThan(20);
  });

  it('goes off its foot level, at the speed it reached', () => {
    const w = world();
    let off = null;
    run(w, 400, (i, W) => { const h = W.byId.h; if (!off && W._was && !h.slide) off = h.vel.slice(); W._was = !!h.slide; return { forward: 1 }; });
    expect(off).toBeTruthy();
    expect(off[2]).toBe(0);
    expect(off[0]).toBeGreaterThan(8);
  });

  it('a jump flings it off, up and on', () => {
    const w = run(world(), 70, { forward: 1 });
    run(w, 1, { forward: 1, jump: 1, jumpHeld: 1 });
    const h = w.byId.h;
    expect(h.slide).toBeNull();
    expect(h.vel[2]).toBeGreaterThan(4);
    expect(h.vel[0]).toBeGreaterThan(3);
  });

  it('a boulder in its way bumps it aside and slows it; the bus hears it', () => {
    const rock = { min: [13.5, -0.6, 4.5], max: [14.5, 0.6, 6.5] }, cs = [CREST, rock], w = world(cs), events = [];
    let prev = null, v0 = 0;
    for (let i = 0; i < 300; i++) {
      const h = w.byId.h;
      if (h.slide && h.transform.pos[0] < 13) v0 = h.slide.v;
      CW.stepWorld(w, { forward: 1 }, DT, ground(cs));
      const f = CW.castFacts(w, prev); prev = f.prev; events.push(...f.events.filter((e) => e.type.startsWith('slide:')).map((e) => e.type));
      if (w.byId.h.slide && Math.abs(w.byId.h.transform.pos[0] - 14) < 0.3) expect(Math.abs(w.byId.h.transform.pos[1])).toBeGreaterThanOrEqual(0.6 + 0.3 - 1e-9);
    }
    expect(events.slice(0, 3)).toEqual(['slide:s:start', 'slide:s:bump', 'slide:s:end']);
    expect(v0).toBeGreaterThan(3);
  });
});
