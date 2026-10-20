// THE REACH (reach.js, the city stalker's progression): which surfaces a hero's moves carry it to. Each law on a few
// boxes, held to the engine's own runs where it claims a move: the wall climbs what the solver says it climbs, the
// swinger crosses the gap the solver says it crosses; and what each move opens, which a map's gates are made of.
import { describe, it, expect } from 'vitest';
import { reachOf, reachUpgrades, surfacesOf, surfaceAt } from './reach.js';
import { createWorld, stepWorld } from '../worlds/controllable-world.js';

const BASE = { type: 'platform', collideRadius: 0.35, collideHeight: 1.7 };
const LOW = { min: [5, -3, 0], max: [8, 3, 1], of: 'low' }, TOWER = { min: [12, -5, 0], max: [20, 5, 20], of: 'tower' };
const groundOf = (boxes, floor = 0) => ({ ground: (p) => boxes.reduce((g, b) => (p[0] >= b.min[0] && p[0] <= b.max[0] && p[1] >= b.min[1] && p[1] <= b.max[1] && b.max[2] <= p[2] + 1e-6 ? Math.max(g ?? -Infinity, b.max[2]) : g), floor) });

describe('the reach: surfaces and the moves between them', () => {
  it('stands on the ground and on box tops with room, not on a lidded top, a narrow one or a level\'s edge', () => {
    const lidded = [{ min: [0, 0, 0], max: [4, 4, 3], of: 'under' }, { min: [0, 0, 3], max: [4, 4, 6], of: 'over' }];
    const ids = surfacesOf({ colliders: [...lidded, { min: [9, 0, 0], max: [9.4, 0.4, 2], of: 'post' }, { ...TOWER, hold: false }] }, BASE).map((s) => s.id);
    expect(ids).toEqual(['ground:0', 'over']);
    expect(surfaceAt(surfacesOf({ colliders: [TOWER] }, BASE), [15, 0, 20]).id).toBe('tower');
  });

  it('walks and jumps onto what a jump clears; the wall takes it up the tower; that is what the wall opens', () => {
    const level = { colliders: [LOW, TOWER] };
    expect([...reachOf(level, BASE).reached].sort()).toEqual(['ground:0', 'low']);
    const climbed = reachOf(level, { ...BASE, wall: true });
    expect(climbed.reached.has('tower')).toBe(true);
    expect(climbed.via.get('tower').move).toBe('wall');
    expect(reachUpgrades(level, BASE, { wall: { wall: true }, 'double-jump': { airJumps: 1 } })).toEqual({ wall: ['tower'], 'double-jump': [] });
  });

  it('is held to the engine: the tower the wall reaches, the hero climbs onto', () => {
    const w = createWorld({ entities: [{ id: 'hero', pilotable: true, rule: { ...BASE, wall: true }, transform: { pos: [10, 0, 0], heading: 0 } }], colliders: [TOWER] });
    const h = w.byId.hero;
    for (let i = 0; i < 60 * 12 && !(h.walled && h.walled.end === 'top'); i++) stepWorld(w, { forward: 1 }, 1 / 60, groundOf([TOWER]));
    expect(surfaceAt(surfacesOf({ colliders: [TOWER] }, BASE), h.transform.pos).id).toBe('tower');
  });

  it('climbs a face of stacked boxes as one, to its top; never up into a lid', () => {
    const stack = [{ min: [12, -5, 0], max: [20, 5, 6], of: 'base' }, { min: [12, -5, 6], max: [20, 5, 18], of: 'shaft' }];
    expect(reachOf({ colliders: stack }, { ...BASE, wall: true }).reached.has('shaft')).toBe(true);
    // a room's wall under its ceiling: no top to stand on, so the wall reaches nothing past the floor
    const room = [{ min: [0, 0, 0], max: [0.5, 20, 6] }, { min: [-1, -1, 6], max: [21, 21, 6.3], of: 'ceiling' }];
    expect([...reachOf({ colliders: room, start: [10, 10, 0] }, { ...BASE, wall: true }).reached]).toEqual(['ground:0']);
  });
});

describe('the reach across a gap: the swinger', () => {
  // two roofs 30 m up over no ground, 20 m apart, a tower beyond the far one to cast to
  const A = { min: [0, -5, 0], max: [10, 5, 30], of: 'a' }, B = { min: [30, -5, 0], max: [40, 5, 30], of: 'b' }, T = { min: [45, -10, 0], max: [55, 10, 80], of: 'tower' };
  const level = { colliders: [A, B, T], grounds: [], start: [9, 0, 30] };
  it('crosses with the line where a jump does not, and that is what the line opens', () => {
    expect(reachOf(level, BASE).reached.has('b')).toBe(false);
    const swung = reachOf(level, { ...BASE, gear: 'swinger' });
    expect(swung.reached.has('b')).toBe(true);
    expect(swung.via.get('b').move).toBe('swing');
    expect(reachUpgrades(level, BASE, { swinger: { gear: 'swinger' } }).swinger).toContain('b');
  });
  it('is held to the engine: the hero jumps off the near roof, swings across and lets go over the far one, landing on it', () => {
    const w = createWorld({ entities: [{ id: 'hero', pilotable: true, rule: { ...BASE, gear: 'swinger' }, transform: { pos: [8, 0, 30], heading: 0 } }], colliders: [A, B, T] });
    const h = w.byId.hero, G = groundOf([A, B, T], null);
    stepWorld(w, { forward: 1, jump: 1, jumpHeld: 1 }, 1 / 60, G);
    for (let i = 0; i < 20; i++) stepWorld(w, { forward: 1, jumpHeld: 1 }, 1 / 60, G);
    // let go early, low in the arc: the swing's speed carries the rest of the way onto the far roof
    for (let i = 0; i < 600 && h.transform.pos[0] < 25; i++) stepWorld(w, { boost: 1, forward: 1 }, 1 / 60, G);
    for (let i = 0; i < 240 && !h.grounded; i++) stepWorld(w, { forward: 0.3 }, 1 / 60, G);
    expect(h.grounded).toBe(true);
    expect(surfaceAt(surfacesOf(level, BASE), h.transform.pos).id).toBe('b');
  });
  it('lifts no higher than the engine does: a street swing, pumped and let go, rises past the law\'s jump-and-clearance', () => {
    const canyon = [{ min: [0, 6, 0], max: [400, 14, 80] }, { min: [0, -14, 0], max: [400, -6, 80] }];
    const w = createWorld({ entities: [{ id: 'hero', pilotable: true, rule: { ...BASE, gear: 'swinger', jumpSpeed: 6.5 }, transform: { pos: [5, 0, 0], heading: 0 } }], colliders: canyon });
    const h = w.byId.hero, G = { ground: () => 0 }, go = (input, n) => { for (let i = 0; i < n; i++) stepWorld(w, input, 1 / 60, G); };
    go({ forward: 1 }, 30); go({ forward: 1, jump: 1, jumpHeld: 1 }, 1); go({ forward: 1, jumpHeld: 1 }, 12);
    let peak = 0;
    for (let i = 0; i < 160; i++) { go({ boost: 1, forward: 1 }, 1); peak = Math.max(peak, h.transform.pos[2]); }
    const hJump = 6.5 ** 2 / (2 * 20), law = hJump + 3;
    expect(peak).toBeGreaterThan(law);
    // so a 4 m roof by the street is the line's, a 9 m one is not (that is the wall's)
    const roofs = { colliders: [...canyon, { min: [20, 2, 0], max: [30, 5.9, 4], of: 'four' }, { min: [40, 2, 0], max: [50, 5.9, 9], of: 'nine' }] };
    const R = reachOf(roofs, { ...BASE, gear: 'swinger', jumpSpeed: 6.5 }).reached;
    expect([R.has('four'), R.has('nine')]).toEqual([true, false]);
  });
});
