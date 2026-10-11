// The fitted bathroom. The laws, over a sweep of rooms: every fixture stands inside the room and on its wall, none
// overlaps another, the water closet and the basin keep 21 in clear in front of them, the tub is chosen when the room
// holds it, and a room too small for a full bathroom names what it left out.

import { describe, it, expect } from 'vitest';
import { arrangeBathroom } from './bathroom.js';
import { FIXTURES } from './fixtures.js';

const rects = (els, W, D) => els.filter((e) => e.fixture).map((e) => ({ id: e.fixture, facing: e.facing, x0: (e.anchor[0] - e.w / 2) * W, x1: (e.anchor[0] + e.w / 2) * W, y0: (e.anchor[1] - e.h / 2) * D, y1: (e.anchor[1] + e.h / 2) * D, wall: !!FIXTURES[e.fixture].wall }));
// in the arranger's frame a fixture's front: on the back wall (N) toward +y, on the left wall (E) +x, the right (W) −x
const frontZone = (r, d) => (r.facing === 'E' ? { x0: r.x1, x1: r.x1 + d, y0: r.y0, y1: r.y1 } : r.facing === 'W' ? { x0: r.x0 - d, x1: r.x0, y0: r.y0, y1: r.y1 } : { x0: r.x0, x1: r.x1, y0: r.y1, y1: r.y1 + d });
const overlap = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1e-6 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 1e-6;
const ROOMS = [];
for (let W = 5; W <= 18; W += 0.5) for (let D = 5; D <= 13; D += 0.5) ROOMS.push([W, D]);

describe('arrangeBathroom', () => {
  it('keeps every fixture inside the room, on a wall, apart from the others, with clearance before the WC and basin', () => {
    for (const [W, D] of ROOMS) {
      const els = arrangeBathroom({ w: W, h: D }), rs = rects(els, W, D), floor = rs.filter((r) => !r.wall);
      for (const r of rs) {
        expect(r.x0 >= -1e-6 && r.x1 <= W + 1e-6 && r.y0 >= -1e-6 && r.y1 <= D + 1e-6, `${W}x${D} ${r.id} inside`).toBe(true);
        expect(Math.min(r.x0, r.y0, W - r.x1) < 1e-6, `${W}x${D} ${r.id} on a wall`).toBe(true);
      }
      for (let i = 0; i < floor.length; i++) for (let j = i + 1; j < floor.length; j++) expect(overlap(floor[i], floor[j]), `${W}x${D} ${floor[i].id}/${floor[j].id}`).toBe(false);
      for (const r of floor.filter((x) => ['wc', 'vanity', 'double-vanity'].includes(x.id))) {
        const zone = frontZone(r, FIXTURES[r.id].front / 304.8);
        expect(zone.x0 >= -1e-6 && zone.x1 <= W + 1e-6 && zone.y1 <= D + 1e-6, `${W}x${D} ${r.id} clearance in the room`).toBe(true);
        for (const o of floor) if (o !== r) expect(overlap(zone, o), `${W}x${D} ${o.id} in front of ${r.id}`).toBe(false);
      }
    }
  });

  it('chooses a tub when the room holds one, else a shower, and names what a small room leaves out', () => {
    expect(arrangeBathroom({ w: 9, h: 11 }).layout).toBe('tub');                 // the cottage's bathroom
    expect(arrangeBathroom({ w: 8, h: 5.2 }).layout).toBe('tub');                // a 5 × 8 with the door on the long wall
    expect(arrangeBathroom({ w: 5.2, h: 7.2 }).layout).toBe('tub-back');            // a 5 × 7½, the door on the short wall
    expect(arrangeBathroom({ w: 8, h: 4.8 }).layout).toBe('pair');                  // too shallow for a tub's length
    const big = arrangeBathroom({ w: 17, h: 12 });
    expect(big.map((e) => e.fixture).filter(Boolean)).toEqual(expect.arrayContaining(['bathtub', 'wc', 'double-vanity', 'shower', 'towel-rail']));
    expect(big.dropped).toEqual([]);
    const tiny = arrangeBathroom({ w: 5, h: 5 });
    expect(tiny.layout).toBe('pair');
    expect(tiny.dropped).toEqual(['bathtub or shower']);
    expect(arrangeBathroom({ w: 3, h: 4 }).dropped).toEqual(['wc', 'basin', 'bathtub or shower']);
  });

  it('is the same layout for the same room', () => {
    expect(JSON.stringify(arrangeBathroom({ w: 11, h: 9 }))).toBe(JSON.stringify(arrangeBathroom({ w: 11, h: 9 })));
  });
});
