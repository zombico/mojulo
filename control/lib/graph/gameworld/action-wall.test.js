import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld } from '../worlds/controllable-world.js';
import { playerWorld } from '../playscape/player.js';
import { actionWall } from './levels.js';

// AN ACTION HERO'S WALL (gameworld/levels.js actionWall): walking into a wall never climbs it, a jump at it takes hold;
// and nothing climbs a box marked `hold: false` (a map's edge, a tree's trunk: level/grid-scene.js, era/isekai.js).
const WALL = { min: [3, -5, 0], max: [3.6, 5, 6] };
const mk = (rule, wall = WALL) => {
  const m = playerWorld({ hero: { cast: 'female' }, id: 'p', rule });
  const w = createWorld({ entities: m.entities, colliders: [wall] });
  const p = w.byId.p; p.transform.pos = [0, 0, 0]; p.transform.heading = 0;
  return w;
};
const run = (w, n, input) => { for (let i = 0; i < n; i++) stepWorld(w, typeof input === 'function' ? input(i) : input, 1 / 60, { ground: () => 0 }); return w.byId.p; };

describe('an action hero at a wall', () => {
  it('asks a jump first: its wall dials keep their own, the ground word set false; a hero with no wall gets none', () => {
    expect(actionWall({ wall: true })).toEqual({ wall: { ground: false } });
    expect(actionWall({ wall: { speed: 2 } })).toEqual({ wall: { speed: 2, ground: false } });
    expect(actionWall({})).toEqual({});
  });

  it('walks into a wall and stays on the ground; jumps at it and takes hold', () => {
    const walked = run(mk({ wall: true, ...actionWall({ wall: true }) }), 120, { forward: 1 });
    expect(walked.walling).toBeFalsy();
    expect(walked.transform.pos[2]).toBeCloseTo(0, 3);
    expect(walked.transform.pos[0]).toBeLessThan(WALL.min[0]);
    const jumped = run(mk({ wall: true, ...actionWall({ wall: true }) }), 80, (i) => ({ forward: 1, jump: i === 20 ? 1 : 0, jumpHeld: i >= 20 && i < 40 ? 1 : 0 }));
    expect(jumped.walling).toBeTruthy();
    // (the city stalker's wall, taken from the ground, as it was)
    expect(run(mk({ wall: true }), 120, { forward: 1 }).transform.pos[2]).toBeGreaterThan(1);
  });

  it('never takes hold from a step off a lip beside the wall: only from a leap', () => {
    // (the land drops a metre half a metre short of the wall: the body falls past it, never having jumped)
    const lip = (W) => { for (let i = 0; i < 120; i++) stepWorld(W, { forward: 1 }, 1 / 60, { ground: (p) => (p[0] < 2.4 ? 1 : 0) }); return W.byId.p; };
    const W = mk({ wall: true, ...actionWall({ wall: true }) }); W.byId.p.transform.pos = [0, 0, 1];
    const h = lip(W);
    expect(h.walling).toBeFalsy();
    expect(h.transform.pos[2]).toBeCloseTo(0, 3);
  });

  it('never takes hold of a box marked hold: false, walked or jumped at', () => {
    const edge = { ...WALL, hold: false };
    expect(run(mk({ wall: true }, edge), 120, { forward: 1 }).transform.pos[2]).toBeCloseTo(0, 3);
    expect(run(mk({ wall: true, ...actionWall({ wall: true }) }, edge), 120, (i) => ({ forward: 1, jump: i === 20 ? 1 : 0, jumpHeld: i >= 20 && i < 40 ? 1 : 0 })).walling).toBeFalsy();
  });
});
