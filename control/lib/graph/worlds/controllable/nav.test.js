import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';

// PATHFINDING (nav.js): a walk grid from the colliders, A* over it, a string pull; the mind walks it when
// `rule.mind.pathing: 'navmesh'` and its line to the goal is blocked.

const E = composeLive();
const hooks = { ground: () => 0 };
// a U-shaped pocket open to the west (-x): the hunter starts inside it, the target waits east of its back wall
const U = [
  { min: [10, -20, 0], max: [14, 20, 30] },     // the back wall (east)
  { min: [-20, 16, 0], max: [14, 20, 30] },     // north arm
  { min: [-20, -20, 0], max: [14, -16, 30] },   // south arm
];
const body = (hp = 100) => ({ type: 'mesh', hittable: true, hp, radius: 1 });
const gun = { fireClass: 'sight', magazine: 99, cooldown: 0.1, damage: 1, range: 200 };
const hunt = (pathing) => E.createWorld({
  colliders: U,
  entities: [
    { id: 'p', rule: { type: 'walk', speed: 0 }, pilotable: true, body: body(), transform: { pos: [40, 0, 0], heading: 0 } },
    { id: 'm', rule: { type: 'ai', speed: 8, turn: 4, standoff: 10, collideRadius: 1.5, collideHeight: 20, eye: 0, mind: { motivation: 'hunt', aggressiveness: 'bold', ...(pathing ? { pathing } : {}) } }, weapon: { ...gun }, body: body(), transform: { pos: [0, 0, 0], heading: 0 } },
  ],
});
const run = (w, n) => { let fired = 0; for (let i = 0; i < n; i++) { E.stepWorld(w, {}, 1 / 60, hooks); fired += w.byId.m.aiFire || 0; } return fired; };

describe('nav: the grid and the path', () => {
  it('a clear line needs no corners; a wall in the way gets a path round it; a sealed goal gets none', () => {
    const w = { colliders: U };
    expect(E.navPath(w, [-40, 0], [-30, 0], { radius: 1.5 })).toEqual([]);
    const path = E.navPath(w, [0, 0], [40, 0], { radius: 1.5 });
    expect(path.length).toBeGreaterThan(1);
    expect(path[path.length - 1]).toEqual([40, 0]);
    for (const [x, y] of path) for (const c of U) expect(x > c.min[0] - 1.5 && x < c.max[0] + 1.5 && y > c.min[1] - 1.5 && y < c.max[1] + 1.5, `${x},${y}`).toBe(false);
    expect(path.some(([x]) => x < -20)).toBe(true);   // it leaves by the open mouth
    const box = { colliders: [{ min: [-10, -10, 0], max: [10, -8, 30] }, { min: [-10, 8, 0], max: [10, 10, 30] }, { min: [-10, -10, 0], max: [-8, 10, 30] }, { min: [8, -10, 0], max: [10, 10, 30] }] };
    expect(E.navPath(box, [0, 0], [40, 0], { radius: 1 })).toBeNull();
  });

  it('is deterministic, and walks under a raised slab', () => {
    const a = E.navPath({ colliders: U }, [0, 0], [40, 0], { radius: 1.5 });
    const b = E.navPath({ colliders: U }, [0, 0], [40, 0], { radius: 1.5 });
    expect(b).toEqual(a);
    const roof = { colliders: [{ min: [10, -20, 25], max: [14, 20, 30] }] };
    expect(E.navPath(roof, [0, 0], [40, 0], { radius: 1.5, height: 20 })).toEqual([]);
  });

  it('rebuilds the grid when the colliders change', () => {
    const w = { colliders: [...U] };
    expect(E.navPath(w, [0, 0], [40, 0], { radius: 1.5 }).length).toBeGreaterThan(0);
    w.colliders.splice(0, 1);   // the back wall breaks
    expect(E.navPath(w, [0, 0], [40, 0], { radius: 1.5 })).toEqual([]);
  });
});

describe('nav: a mind walks the path', () => {
  it('a hunter in a pocket goes round its wall and reaches its target; without navmesh it presses the wall', () => {
    const lost = hunt(null);
    run(lost, 60 * 10);
    expect(lost.byId.m.transform.pos[0]).toBeLessThan(14);         // still behind the back wall
    const w = hunt('navmesh');
    run(w, 60 * 14);
    const m = w.byId.m;
    expect(Math.hypot(m.transform.pos[0] - 40, m.transform.pos[1])).toBeLessThan(25);   // came round to it
    expect(run(w, 120)).toBeGreaterThan(0);                                              // and, with a line, shoots
  });

  it('holds fire while it has no line, and the walk is the same every run', () => {
    const a = hunt('navmesh'), b = hunt('navmesh');
    expect(run(a, 60)).toBe(0);
    run(b, 60);
    expect(b.byId.m.transform.pos).toEqual(a.byId.m.transform.pos);
  });

  it('a guard with navmesh returns to its post round a wall', () => {
    const w = E.createWorld({
      colliders: U,
      entities: [
        { id: 'p', rule: { type: 'walk', speed: 0 }, pilotable: true, body: body(), transform: { pos: [200, 0, 0], heading: 0 } },
        { id: 'm', rule: { type: 'ai', speed: 6, turn: 4, post: [0, 0, 0], guardRadius: 20, collideRadius: 1.5, collideHeight: 20, eye: 0, mind: { motivation: 'guard', aggressiveness: 'bold', pathing: 'navmesh' } }, weapon: { ...gun }, body: body(), transform: { pos: [30, 0, 0], heading: 0 } },
      ],
    });
    run(w, 60 * 20);
    expect(Math.hypot(w.byId.m.transform.pos[0], w.byId.m.transform.pos[1])).toBeLessThan(2);
  });
});
