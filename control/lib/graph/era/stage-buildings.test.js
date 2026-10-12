// stage-buildings — game buildings standing in open ground, walked into as terrain. The laws: a building stands in
// the pocket it names (or the next), its door to the trail, its floor over the land under it; the land's growth is
// cleared from its footprint; it carries its inside (the room kit's rooms, a way out through its entry), its outside
// (walls, a roof per room over the vault) and a stoop down to the land; its colliders join the stage's, cut at the
// door; its anchor names its door, rooms, goal and the route in; and a stage without buildings is untouched.

import { describe, it, expect } from 'vitest';
import { assembleStageScene, planStage } from './stage.js';

const TRAIL = { kind: 'stage', kit: 'isekai-meadow', trail: true };
const plain = assembleStageScene(TRAIL);
const inn = assembleStageScene({ ...TRAIL, buildings: [{ use: 'tavern', seed: 2, goal: true }] });
const A = inn.anchors.find((a) => a.kind === 'building');
const pocket = plain.anchors.find((a) => a.id === 'pocket-1');
const within = (p, b) => p[0] >= b.min[0] - 1e-6 && p[0] <= b.max[0] + 1e-6 && p[1] >= b.min[1] - 1e-6 && p[1] <= b.max[1] + 1e-6;

describe('a building in open ground', () => {
  it('stands on the flattest land beside the trail, its door to the trail, its floor level with the land at its door', () => {
    expect(A).toMatchObject({ id: 'building-tavern-1', use: 'tavern', enter: 'walk', entry: 'taproom', goal: 'cellar', language: 'timber-hall', isGoal: true });
    const B = inn.buildings[0];
    expect(B.rough).toBe(0);                    // no cliff under it
    expect(B.into).toBeLessThan(1.5);           // not cut deep into a slope
    // the door faces the trail: the nearest beat lies ahead of it
    const beats = plain.anchors.filter((a) => a.kind === 'beat'), near = beats.reduce((m, b) => (!m || Math.hypot(b.at[0] - A.at[0], b.at[1] - A.at[1]) < Math.hypot(m.at[0] - A.at[0], m.at[1] - A.at[1]) ? b : m), null);
    expect(A.N[0] * (near.at[0] - A.at[0]) + A.N[1] * (near.at[1] - A.at[1])).toBeGreaterThan(0);
    // walked in level: the floor within a step of the land at the door, and no land left standing inside a room
    const doorLand = plain.faces.filter((x) => /:(ground|trail)$/.test(x.group) && x.corners.some((c) => Math.hypot(c[0] - A.at[0], c[1] - A.at[1]) < 1.2)).flatMap((x) => x.corners.map((c) => c[2]));
    expect(A.floor - Math.max(...doorLand)).toBeLessThan(0.45);
    const mid = (f) => [0, 1].map((k) => f.corners.reduce((a, c) => a + c[k], 0) / f.corners.length);
    expect(inn.faces.filter((x) => /:(ground|cliff|lip|scree)$/.test(x.group) && A.rooms.some((r) => within(mid(x), r.box))).length).toBe(0);
  });

  it('a pocket named is kept: the building stands in it, its door to its mouth', () => {
    const P = assembleStageScene({ ...TRAIL, buildings: [{ use: 'shop', at: 'pocket-1' }] }).anchors.find((a) => a.kind === 'building');
    expect(P.at.slice(0, 2)).toEqual([pocket.at[0], pocket.at[1]].map((v) => Math.round(v * 1e5) / 1e5));
    expect(P.N[0] * (pocket.mouth[0] - pocket.at[0]) + P.N[1] * (pocket.mouth[1] - pocket.at[1])).toBeGreaterThan(0);
  });

  it("clears the land's growth from its footprint and adds its inside, outside and stoop", () => {
    const grown = (p) => p.faces.filter((f) => /:(wood|crown|rock|grass)$/.test(f.group) && A.rooms.some((r) => within(f.corners[0], r.box))).length;
    expect(grown(inn)).toBe(0);
    const g = (k) => inn.faces.filter((f) => f.group === k).length;
    for (const k of ['building:wall', 'building:roof', 'building:stoop', 'stage:floor', 'stage:wall']) expect(g(k), k).toBeGreaterThan(0);
    // every roof stands over the highest thing inside its room
    const roofLow = Math.min(...inn.faces.filter((f) => f.group === 'building:roof').flatMap((f) => f.corners.map((c) => c[2])));
    expect(roofLow).toBeGreaterThan(A.floor + 3);
  });

  it("its colliders join the stage's (the door left open), and its route runs from the land to the goal room", () => {
    expect(inn.colliders.length).toBeGreaterThan(plain.colliders.length + 10);
    const door = [A.at[0], A.at[1], A.floor + 1];
    const blocked = inn.colliders.some((c) => door[0] > c.min[0] + 0.05 && door[0] < c.max[0] - 0.05 && door[1] > c.min[1] + 0.05 && door[1] < c.max[1] - 0.05 && door[2] > c.min[2] && door[2] < c.max[2]);
    expect(blocked).toBe(false);
    expect(A.rooms.some((r) => within(A.route[0], r.box))).toBe(false);   // the route starts out on the land
    expect(within(A.goalAt, A.rooms.find((r) => r.id === 'cellar').box)).toBe(true);
  });

  it('stands where it is told, turned as it is told; and says what is wrong', () => {
    const at = assembleStageScene({ ...TRAIL, buildings: [{ use: 'shop', at: { x: 20, y: 50, facing: '+y' } }] }).anchors.find((a) => a.kind === 'building');
    expect(at.at.slice(0, 2)).toEqual([20, 50]);
    expect(at.N).toEqual([0, 1, 0]);
    expect(() => assembleStageScene({ ...TRAIL, buildings: [{ use: 'shop', at: 'pocket-9' }] })).toThrow(/not a pocket/);
    expect(() => assembleStageScene({ ...TRAIL, buildings: [{ use: 'shop', at: { x: 1, y: 1 } }] })).toThrow(/facing/);
    expect(() => assembleStageScene({ kind: 'stage', kit: 'gothic-stone', rooms: [{ id: 'a', x: 0, y: 0, w: 6, d: 6, h: 4 }], buildings: [{ use: 'shop' }] })).toThrow(/open ground/);
  });

  it('a stage without buildings is the stage as it was', () => {
    expect(JSON.stringify(assembleStageScene(TRAIL))).toBe(JSON.stringify(plain));
    expect(plain.anchors.some((a) => a.kind === 'building')).toBe(false);
  });
});

describe('a way out of a room', () => {
  it('cuts a doorway in an outside wall; refuses a side that is not one', () => {
    const P = planStage({ kind: 'stage', kit: 'gothic-stone', rooms: [{ id: 'a', x: 0, y: 0, w: 8, d: 6, h: 4 }], ways: [{ room: 'a', side: '-y' }] });
    expect(P.ways[0]).toMatchObject({ room: 'a', side: '-y', lo: 3, hi: 5 });
    expect(P.rooms[0].openings['-y']).toHaveLength(1);
    expect(() => planStage({ kind: 'stage', kit: 'gothic-stone', rooms: [{ id: 'a', x: 0, y: 0, w: 8, d: 6, h: 4 }], ways: [{ room: 'a', side: 'up' }] })).toThrow(/side/);
  });
});

describe("a town's street", () => {
  const street = assembleStageScene({ ...TRAIL, town: { houses: 5, enter: 1 } });
  it("stands the town's first houses beside the trail: the focus walked into, the rest as the town draws them", () => {
    expect(street.buildings.map((b) => b.use)).toEqual(['hall', 'shop', 'shop', 'shop', 'shop']);
    expect(street.buildings[0]).toMatchObject({ entry: 'porch', goal: 'dais' });
    expect(street.buildings.slice(1).every((b) => b.house)).toBe(true);
    const houses = street.anchors.filter((a) => a.kind === 'house');
    expect(houses).toHaveLength(4);
    // each house a collider, none overlapping another building's
    const boxes = houses.map((h) => h.box);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      expect(a.min[0] < b.max[0] && b.min[0] < a.max[0] && a.min[1] < b.max[1] && b.min[1] < a.max[1]).toBe(false);
    }
    expect(street.faces.some((f) => f.group === 'town:wall')).toBe(true);
    expect(street.faces.some((f) => f.group === 'town:plinth')).toBe(true);
  });
  it('the same street on the same seed; another seed, another street; and says what is wrong', () => {
    expect(JSON.stringify(assembleStageScene({ ...TRAIL, town: { houses: 5, enter: 1 } }).anchors)).toBe(JSON.stringify(street.anchors));
    expect(() => assembleStageScene({ ...TRAIL, town: { houses: 5, lanes: 2 } })).toThrow(/not a setting/);
    expect(() => assembleStageScene({ kind: 'stage', kit: 'trail-valley', trail: true, town: {} })).toThrow(/indexed for the outdoor kits/);
  });
  it('goal: the first house walked into holds the level\'s end', () => {
    const g = assembleStageScene({ ...TRAIL, town: { houses: 3, enter: 1, goal: true } });
    expect(g.anchors.find((a) => a.kind === 'building')).toMatchObject({ isGoal: true, goal: 'dais' });
  });
});

describe('planned before anything grows', () => {
  // every footprint (a building's rooms, a house's box), and every corner of every tree, rock and arrangement face
  const feet = (p) => [...p.anchors.filter((a) => a.kind === 'building').flatMap((a) => a.rooms.map((r) => r.box)), ...p.anchors.filter((a) => a.kind === 'house').map((a) => a.box)];
  const growth = /:(wood|crown|rock|hat|tree|bough|ikebana)$/;
  for (const [name, m] of [['the meadow tavern', { ...TRAIL, buildings: [{ use: 'tavern', seed: 2 }] }], ['the meadow street', { ...TRAIL, town: { houses: 5, enter: 1 } }], ['the valley inn', { kind: 'stage', kit: 'trail-valley', trail: true, buildings: [{ use: 'tavern', seed: 2 }] }]]) {
    it(`${name}: no tree, rock or arrangement stands in a footprint, and the land round it still grows`, () => {
      const p = assembleStageScene(m), F = feet(p);
      expect(F.length).toBeGreaterThan(0);
      const inside = p.faces.filter((f) => growth.test(f.group) && f.corners.some((c) => F.some((B) => within(c, B))));
      expect(inside.map((f) => f.group)).toEqual([]);
      expect(p.faces.filter((f) => growth.test(f.group)).length).toBeGreaterThan(100);
    }, 120_000);
  }
});
