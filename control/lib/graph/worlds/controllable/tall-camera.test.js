import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '@/lib/graph/worlds/controllable-world';

// A TALL ROOM (rules-basic.js follow `tall`): standing in a room over `from` metres, the chase stands back and up and
// its look lifts, by how far the ceiling rises, never over it; out of the tall rooms, or absent, the chase as it was.

const DT = 1 / 60;
const FLAT = { ground: () => 0 };
// a low room (6 m) from x 0 to 20 and a tall one (18 m), 30 m square, from x 20 to 50
const ROOMS = [[20, -15, 50, 15, 18]];
const mk = (tall) => createWorld({ entities: [{ id: 'h', pilotable: true, rule: { type: 'platform', eye: 0, speed: 6, move: 'camera' }, transform: { pos: [5, 0, 0], heading: 0 } }],
  camera: { rule: 'follow', target: 'h', dist: 8, height: 3, lookH: 1.1, lead: 1.5, steer: 'orbit', ...(tall === undefined ? {} : { tall }) } });
const settle = (w, n = 600) => { for (let f = 0; f < n; f++) stepWorld(w, {}, DT, FLAT); return w; };
const frame = (w) => { const c = w.camera, h = w.byId.h.transform.pos; return { back: Math.hypot(c.transform.pos[0] - h[0], c.transform.pos[1] - h[1]), up: c.transform.pos[2], look: c.lookAt[2] }; };

describe('the chase in a tall room', () => {
  it('stands back and up, and looks higher, only in the tall room; a chase that asks none is as it was', () => {
    const plain = frame(settle(mk())), low = frame(settle(mk({ rooms: ROOMS })));
    expect(low.back).toBeCloseTo(plain.back, 6); expect(low.up).toBeCloseTo(plain.up, 6); expect(low.look).toBeCloseTo(plain.look, 6);
    const w = mk({ rooms: ROOMS });
    w.byId.h.transform.pos = [30, 0, 0];
    const tall = frame(settle(w));
    expect(tall.back).toBeGreaterThan(plain.back * 1.4);
    expect(tall.up).toBeGreaterThan(plain.up + 2);
    expect(tall.look).toBeGreaterThan(plain.look + 1);
  });

  it('a room a little over the threshold pulls back a little; the camera never rises through the ceiling', () => {
    const at = (rooms) => { const w = mk({ rooms, rise: 30 }); w.byId.h.transform.pos = [30, 0, 0]; return frame(settle(w)); };
    const some = at([[20, -10, 40, 10, 9]]), full = at([[20, -10, 40, 10, 18]]);
    expect(some.back).toBeLessThan(full.back);
    expect(some.up).toBeLessThanOrEqual(8 + 1e-6);
    expect(full.up).toBeLessThanOrEqual(17 + 1e-6);
  });

  it('a tall room too narrow to stand back in keeps the chase\'s distance and height, and only looks up', () => {
    const w = mk({ rooms: [[20, -6, 40, 6, 18]] }); w.byId.h.transform.pos = [30, 0, 0];
    const plain = frame(settle(mk())), narrow = frame(settle(w));
    expect(narrow.back).toBeCloseTo(plain.back, 1);
    expect(narrow.up).toBeCloseTo(plain.up, 1);
    expect(narrow.look).toBeGreaterThan(plain.look + 1);
  });
});
