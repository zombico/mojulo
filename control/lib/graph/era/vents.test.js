import { describe, it, expect } from 'vitest';
import { readVents } from './vents.js';
import { planStage, assembleStageScene } from './stage.js';
import { withProgram } from './programs.js';
import { footprintOf } from './compose-dress.js';
import { buildingStage } from '../gameworld/levels.js';
import { sneakRoutes } from '../gameworld/stealth-routes.js';
import { composeLive } from '../worlds/controllable/compose.js';

// VENTS (vents.js): a duct behind each row of rooms off a corridor, through a hole in each wall they share, under a lid
// a body lying passes beneath; a hatch into each room. One building of rooms in rows stands for the procedure.

const B = { use: 'cell-block', seed: 1, scale: 1.5 };
const planOf = (o) => planStage(withProgram(buildingStage({ ...B, ...o })));

describe('vents', () => {
  it('a program\'s vents are read, their dials checked; absent, none are laid', () => {
    expect(readVents(true)).toMatchObject({ depth: 1.3, clear: 0.75, rooms: 2 });
    expect(readVents(undefined)).toBeNull();
    expect(() => readVents({ grilles: 3 })).toThrow(/not a setting/);
    expect(() => readVents({ clear: 0.4 })).toThrow(/body lying is 0.45/);
    expect(planOf({}).vents).toBeUndefined();
  });

  it('a duct runs behind a row of rooms, a hole through each wall they share in both rooms, a hatch into each, nothing laid on it', () => {
    const P = planOf({ vents: true }), [d] = P.vents.ducts;
    expect(d.rooms.length).toBeGreaterThanOrEqual(2);
    expect(d.segments.map((s) => s.room)).toEqual(d.rooms);
    const byId = new Map(P.rooms.map((r) => [r.id, r]));
    for (let k = 0; k + 1 < d.rooms.length; k++) {
      const holes = P.vents.holes.filter((h) => h.room === d.rooms[k] || h.room === d.rooms[k + 1]);
      for (const h of holes) expect(byId.get(h.room).openings[h.side].some((o) => o.vent && o.top === h.top)).toBe(true);
    }
    for (const s of d.segments) {
      expect(s.parts.find((p) => p.part === 'lid').min[2]).toBeGreaterThanOrEqual(0.55);
      const on = P.props.filter((it) => it.room === s.room && !it.wall && (() => { const f = footprintOf(it); return f.min[0] < s.strip.max[0] && f.max[0] > s.strip.min[0] && f.min[1] < s.strip.max[1] && f.max[1] > s.strip.min[1]; })());
      expect(on.map((it) => it.id), s.room).toEqual([]);
    }
  });

  it('in the runtime a body lying crawls in at a hatch and along to the next room, and cannot stand under the lid; one standing does not get in', () => {
    const S = assembleStageScene(buildingStage({ ...B, vents: true })), d = S.vents[0], [s0, s1] = d.segments;
    const E = composeLive(), hooks = { ground: () => 0 }, side = s0.hatch.side, k = side.startsWith('+') ? 1 : -1, X = side.endsWith('x');
    const heading = X ? (k > 0 ? Math.PI : 0) : k > 0 ? -Math.PI / 2 : Math.PI / 2;
    const at = X ? [s0.hatch.at[0] + k * 0.6, s0.hatch.at[1], 0] : [s0.hatch.at[0], s0.hatch.at[1] + k * 0.6, 0];
    const world = () => E.createWorld({ colliders: S.colliders, camera: { rule: 'follow', target: 'p' }, entities: [{ id: 'p', pilotable: true, rule: { type: 'platform', speed: 5.8, eye: 0, collideRadius: 0.3, collideHeight: 1.7, stance: { crouch: {}, prone: {} } }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: at.slice(), heading } }] });
    const inStrip = (p, s) => p[0] > s.strip.min[0] - 0.05 && p[0] < s.strip.max[0] + 0.05 && p[1] > s.strip.min[1] - 0.05 && p[1] < s.strip.max[1] + 0.05;
    const w = world(), p = w.byId.p, run = (input, n) => { for (let i = 0; i < n; i++) E.stepWorld(w, input, 1 / 60, hooks); };
    run({ crouch: 1 }, 40); run({}, 5);
    expect(p.prone).toBe(true);
    run({ forward: 1 }, 150);
    expect(inStrip(p.transform.pos, s0)).toBe(true);
    run({ crouch: 1 }, 3); run({}, 5); run({ crouch: 1 }, 40); run({}, 5);
    expect(p.prone).toBe(true);
    const c1 = [(s1.strip.min[0] + s1.strip.max[0]) / 2, (s1.strip.min[1] + s1.strip.max[1]) / 2];
    p.transform.heading = Math.atan2(c1[1] - p.transform.pos[1], c1[0] - p.transform.pos[0]);
    run({ forward: 1 }, 60 * 14);
    expect(inStrip(p.transform.pos, s1)).toBe(true);
    const u = world(), q = u.byId.q ?? u.byId.p;
    for (let i = 0; i < 150; i++) E.stepWorld(u, { forward: 1 }, 1 / 60, hooks);
    expect(inStrip(q.transform.pos, s0)).toBe(false);
  });

  it('the route search passes a crawl space lying only: a wall with a hole a body lying fits through', () => {
    const wall = [{ min: [4, -6, 0], max: [4.4, -0.7, 3] }, { min: [4, 0.7, 0], max: [4.4, 6, 3] }, { min: [4, -0.7, 0.75], max: [4.4, 0.7, 3] }];
    const R = sneakRoutes({ bounds: [0, -6, 8, 6], boxes: wall, watchers: [], start: [1, 0], goal: [7, 0], goalRadius: 1, seconds: 60, cell: 0.5 });
    expect(R.sneak).toBeTruthy();
    expect(R.sneak.crawl).toBeGreaterThan(0);
    expect(R.direct).toBeNull();
  });
});
