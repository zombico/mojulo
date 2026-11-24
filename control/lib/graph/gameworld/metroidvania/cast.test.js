import { describe, it, expect, beforeAll } from 'vitest';
import { boxOf } from './scene.js';
import { boxPlaced, boxEnds, castLaws, CAST_LAWS } from './cast.js';
import { vampireSonata, VAMPIRE_SONATA_FOES } from './vampire-sonata.js';

const from = Object.keys(VAMPIRE_SONATA_FOES), bestiary = VAMPIRE_SONATA_FOES;
let B, P;
beforeAll(() => { B = boxOf({ kind: 'geocube', show: 'metroidvania', metroidvania: vampireSonata(), stature: 1.63 }); P = boxPlaced(B.layout, B.greybox, from, { bestiary }); });
const lost = (placed) => castLaws(B.layout, B.greybox, placed, { bestiary }).filter((l) => !l.holds).map((l) => l.id);
const room = (id) => B.layout.rooms.find((r) => r.id === id);

describe('the box\'s foes', () => {
  it('haunts each room with its region\'s foes: walkers on a corridor\'s floor, a flyer in a shaft, none where she rests', () => {
    expect(P.length).toBeGreaterThan(20);
    for (const p of P) expect(B.layout.rings[room(p.room).ring].foes).toContain(p.eid);
    expect(P.filter((p) => room(p.room).kind === 'shaft' && bestiary[p.eid].class === 'swooper').length).toBeGreaterThan(0);
    expect(P.some((p) => room(p.room).save || room(p.room).boss || room(p.room).mapRoom)).toBe(false);
    // (the ends the foe cast reads: its placements, its spawn, the lane's rail)
    const E = boxEnds(B.layout, B.greybox, from, { spawn: [0, 1, 1], bestiary });
    expect(E.placed.length).toBe(P.length);
    expect(E.rail.length).toBeCloseTo(B.layout.box[0] * B.greybox.screen.width, 2);
    expect(boxPlaced(B.layout, B.greybox, from, { bestiary })).toEqual(P);
  });

  it('holds the cast to its laws, and says a foe where she rests, one at a doorway, a crowd between saves', () => {
    expect(castLaws(B.layout, B.greybox, P, { bestiary }).map((l) => l.id)).toEqual([...CAST_LAWS]);
    expect(lost(P)).toEqual([]);
    const save = B.layout.rooms.find((r) => r.save);
    expect(lost([...P, { id: 'x', eid: 'rat', at: [0, save.rect[0] * B.greybox.screen.width + 7, 1], heading: 0, room: save.id }])).toContain('quiet-rooms');
    // (a foe moved over a hole in its own room's floor)
    const W = B.greybox.screen.width, H = B.greybox.screen.height;
    const over = P.map((p) => ({ p, q: B.greybox.holes.find((h) => Math.abs(h.z - room(p.room).rect[1] * H) < 1e-3 && h.s0 >= room(p.room).rect[0] * W && h.s1 <= (room(p.room).rect[0] + room(p.room).rect[2]) * W) })).find((x) => x.q && room(x.p.room).kind !== 'shaft');
    expect(lost(P.map((p) => (p === over.p ? { ...p, at: [0, (over.q.s0 + over.q.s1) / 2, p.at[2]] } : p)))).toContain('stand-clear');
    const crowd = Array.from({ length: 30 }, (_, k) => ({ id: `c${k}`, eid: 'rat', at: [0, 0, 0], heading: 0, room: P[0].room }));
    expect(lost([...P, ...crowd])).toContain('between-saves');
  });
});
