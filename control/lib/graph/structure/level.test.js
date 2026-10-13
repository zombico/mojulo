// structure/level — a building as a game level, read from the building. The laws: the spawn stands inside the entry
// room, at its floor; the goal stands in the goal room at its floor (eye height for the zone); 'top' is the deepest
// room on the highest storey a flight reaches; the route climbs every storey between, flight by flight; colliders
// leave every door open; the level is lowered on read and never changes a building that does not ask; and an office
// is a building like the others.

import { describe, it, expect } from 'vitest';
import { readStructure } from './read.js';
import { buildingLevel, goalRoom, withBuildingLevel, wallColliders, asksLevel, stageLevel } from './level.js';

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
      if (room.storey > 0) expect(L.route.length).toBeGreaterThan(0);
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

describe('a room-kit stage as a level', () => {
  const GOTHIC = { kind: 'stage', kit: 'gothic-stone', rooms: [{ id: 'nave', x: 0, y: 0, w: 12, d: 20, h: 9 }, { id: 'gallery', x: 12, y: 6, w: 10, d: 8, h: 5 }, { id: 'passage', x: 22, y: 8, w: 10, d: 4, h: 4 },
    { id: 'charnel', x: 32, y: 2, w: 10, d: 16, h: 6 }, { id: 'chapel', x: 26, y: 18, w: 16, d: 8, h: 5 }, { id: 'sepulchre', x: 14, y: 18, w: 12, d: 12, h: 7 }],
  links: [{ from: 'nave', to: 'gallery' }, { from: 'gallery', to: 'passage' }, { from: 'passage', to: 'charnel' }, { from: 'charnel', to: 'chapel' }, { from: 'chapel', to: 'sepulchre' }] };
  const box = (r) => ({ rect: { x: r.x, y: r.y, w: r.w, h: r.d } });

  it("'deepest' is the room most doorways from the spawn, and the route passes every doorway on the way", () => {
    const L = stageLevel(GOTHIC);
    expect(L.error).toBeUndefined();
    expect(L.goal.room).toBe('sepulchre');
    expect(L.route).toHaveLength(2 * 5 - 1);
    // every waypoint stands in a room, never in a wall
    for (const p of L.route) expect(GOTHIC.rooms.some((r) => inside(p, box(r))), String(p)).toBe(true);
    expect(inside(L.spawn, box(GOTHIC.rooms[0]))).toBe(true);
  });

  it('a goal by room id, a start by room id, and a room no doorway reaches said', () => {
    expect(stageLevel(GOTHIC, { goal: 'passage' }).route).toHaveLength(3);
    expect(stageLevel(GOTHIC, { goal: 'nave', from: 'charnel' }).route).toHaveLength(5);
    expect(stageLevel(GOTHIC, { goal: 'vault' }).error).toMatch(/names no room/);
    const cut = { ...GOTHIC, links: GOTHIC.links.slice(0, 2) };
    expect(stageLevel(cut, { goal: 'chapel' }).error).toMatch(/no doorway leads/);
  });

  it('lowered on read: the game channel, a walker the walls stop, and the stage keeps its own colliders', () => {
    const m = { ...GOTHIC, level: {} };
    const lowered = withBuildingLevel(m, 'lv_crypt');
    expect(lowered.game.mechanics[0]).toMatchObject({ kind: 'reach-exit', planar: false, at: [25.4, 22, 1.7] });   // a step through the chapel's doorway
    expect(lowered.entities[0].rule).toMatchObject({ type: 'walk', eye: 1.7, collideRadius: 0.3 });
    expect(lowered.colliders).toBeUndefined();
    expect(withBuildingLevel(GOTHIC, 'lv_crypt')).toBe(GOTHIC);
  });
});

describe('an inside entered by its door', () => {
  const m = { kind: 'stage', kit: 'gothic-stone', program: { use: 'tavern', seed: 2 }, level: { door: 'out' } };
  it('its way out is a door: a door end drawn in the way in, its mechanic, and the walker standing in from it', () => {
    const L = withBuildingLevel(m, 'lv_in');
    const d = L.game.mechanics.find((x) => x.kind === 'door');
    expect(d).toMatchObject({ id: 'out', heading: 1.57 });
    expect(L.doors).toEqual([expect.objectContaining({ id: 'out', at: expect.objectContaining({ side: '-y' }), to: { map: 'outside', door: 'out' } })]);
    expect(L.entities[0].transform.pos.slice(0, 2)).toEqual(d.spawn.slice(0, 2));
    expect(L.game.mechanics.at(-1).kind).toBe('reach-exit');   // its goal room still ends it
  });
});

describe('a building entered by a door from another level', () => {
  it('takes level.door: a door zone inside its entry, a walker standing in past it, its goal still its end', () => {
    const m = withBuildingLevel({ ...OFFICE, level: { door: 'out' } }, 'lv_in');
    const door = m.game.mechanics.find((x) => x.kind === 'door'), exit = m.game.mechanics.find((x) => x.kind === 'reach-exit');
    expect(door).toMatchObject({ id: 'out', radius: 2 });
    expect(exit).toBeTruthy();
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    expect(d(door.spawn, door.at)).toBeGreaterThan(door.radius);
    expect(d(m.entities[0].transform.pos, door.at)).toBeGreaterThan(door.radius);
  });
});
