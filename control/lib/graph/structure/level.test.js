// structure/level — a building as a game level, read from the building. The laws: the spawn stands inside the entry
// room, at its floor; the goal stands in the goal room at its floor (eye height for the zone); 'top' is the deepest
// room on the highest storey a flight reaches; the route climbs every storey between, flight by flight; colliders
// leave every door open; the level is lowered on read and never changes a building that does not ask; and an office
// is a building like the others.

import { describe, it, expect } from 'vitest';
import { readStructure } from './read.js';
import { buildingLevel, goalRoom, withBuildingLevel, wallColliders, asksLevel } from './level.js';

const OFFICE = { kind: 'office', title: 'Tower', storeys: 3 };
const HOUSE = { kind: 'floorplan', title: 'Home', seed: 21, storeys: 2, furnish: true, windows: true };
const STORE = { kind: 'store', title: 'Shop', card: 'apparel' };
const reads = { office: readStructure(OFFICE), house: readStructure(HOUSE), store: readStructure(STORE) };
const plan = ([x, y]) => [x, -y];   // these three are built through the reflection (world y = −plan y)
const inside = (p, r) => p[0] >= r.rect.x && p[0] <= r.rect.x + r.rect.w && p[1] >= r.rect.y && p[1] <= r.rect.y + r.rect.h;

describe('the level a building makes', () => {
  for (const [k, r] of Object.entries(reads)) {
    it(`${k}: a spawn inside the room its entry opens into, at the ground floor`, () => {
      const L = buildingLevel(r);
      expect(L.error).toBeUndefined();
      const door = r.elements.doors.find((d) => d.tag === L.door);
      expect(door.exterior).toBe(true);
      expect(inside(plan(L.spawn), r.rooms.find((x) => x.tag === door.serves))).toBe(true);
      expect(L.spawn[2]).toBe(0);
    });

    it(`${k}: a goal in its room at that room's floor, the route climbing to it`, () => {
      const L = buildingLevel(r);
      const room = r.rooms.find((x) => x.tag === L.goal.room);
      expect(inside(plan(L.goal.at), room)).toBe(true);
      expect(L.goal.at[2]).toBe(r.storeys.find((s) => s.index === room.storey).baseZ);
      expect(L.route.length > 0).toBe(room.storey > 0);
    });
  }

  it("'top' is the deepest room on the highest storey a flight reaches, not the room you start in", () => {
    expect(goalRoom(reads.office).storey).toBe(2);
    expect(goalRoom(reads.office).role).toBe('openOffice');
    const L = buildingLevel(reads.store);
    expect(L.goal.room).not.toBe(reads.store.elements.doors.find((d) => d.tag === L.door).serves);
    expect(goalRoom(reads.house, '101').tag).toBe('101');
    expect(buildingLevel(reads.house, { goal: '999' }).error).toMatch(/names no room/);
  });

  it('a campus whose upper floors no flight reaches keeps its goal on the ground', () => {
    const L = buildingLevel(readStructure({ kind: 'school-complex', seed: 1 }));
    expect(L.error).toBeUndefined();
    expect(L.goal.at[2]).toBe(0);
  });

  it('colliders stand on every wall and leave every door open', () => {
    const r = reads.house, cs = wallColliders(r, plan);
    expect(cs.length).toBeGreaterThan(r.elements.walls.length - 1);
    for (const d of r.elements.doors) {
      const p = plan([d.at.x, d.at.y]), z = r.storeys.find((s) => s.index === d.storey).baseZ + 1;
      const blocked = cs.some((c) => p[0] > c.min[0] + 0.05 && p[0] < c.max[0] - 0.05 && p[1] > c.min[1] + 0.05 && p[1] < c.max[1] - 0.05 && z > c.min[2] && z < c.max[2]);
      expect(blocked, d.tag).toBe(false);
    }
  });
});

describe('lowered on read, from a field', () => {
  it('a building that asks gets its game channel, walker, camera and colliders; one that does not is untouched', () => {
    const m = { ...OFFICE, level: { goal: 'top' } };
    expect(asksLevel(m)).toBe(true);
    const lowered = withBuildingLevel(m, 'lv_x', reads.office);
    expect(lowered.game.levelRef).toBe('lv_x');
    expect(lowered.game.mechanics[0]).toMatchObject({ kind: 'reach-exit', planar: false });
    expect(lowered.game.mechanics[0].via.length).toBeGreaterThan(3);
    expect(lowered.entities[0].rule.type).toBe('walk');
    expect(lowered.colliders.length).toBeGreaterThan(0);
    expect(withBuildingLevel(OFFICE, 'lv_x')).toBe(OFFICE);
    const own = { ...m, game: { levelRef: 'mine' } };
    expect(withBuildingLevel(own, 'lv_x')).toBe(own);   // a recipe that writes its own game channel keeps it
  });
});
