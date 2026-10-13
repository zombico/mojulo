// structure/read: the building as tagged data, read from the recipe. The laws: pure, adds nothing to the world, one
// tag per element and object that agrees everywhere it appears, and the numbers are the kernels' own.

import { describe, it, expect } from 'vitest';
import { readStructure } from './read.js';
import { structurizeHouse, structurizeFloorplan, storeyLevels } from '../polygonizer/floorplan-structure.js';
import { buildElementModel, deriveSchedules, scoreHouse } from '../polygonizer/floorplan-bim.js';
import { roomNumber, storeyNumber, objectCode, tagObjectTypes } from './tags.js';

const HOUSES = {
  room: { kind: 'floorplan', title: 'h', width: 24, height: 28, rooms: [{ x: 2, y: 2, w: 20, h: 24, glyph: 'L' }], furnish: true, view: 'cutaway', seed: 7 },
  seeded: { kind: 'floorplan', title: 'h', seed: 7, furnish: true, furnishing: 'composed' },
  storeys: { kind: 'floorplan', title: 'h', seed: 5, storeys: 2, roof: 'gable', furnish: true },
  framed: { kind: 'floorplan', title: 'h', seed: 5, levels: [{ index: 0 }], windows: true, framing: { system: 'platform', stage: 'rough-in' }, roof: { covering: { type: 'slate' } } },
  items: {
    kind: 'floorplan', title: 'h', width: 24, height: 28,
    rooms: [{ x: 2, y: 2, w: 20, h: 24, glyph: 'L', items: [{ type: 'sofa', wall: 'N' }, { ref: 'sk_chair', at: [0.5, 0.6], size: [2, 2] }] }],
    view: 'cutaway', seed: 7,
  },
};

const reads = Object.fromEntries(Object.entries(HOUSES).map(([k, m]) => [k, readStructure(m)]));

describe('readStructure — the recipe read as a building', () => {
  it('is null for a manifest that is not a building', () => {
    expect(readStructure({ kind: 'condo-complex' })).toBeNull();
    expect(readStructure(null)).toBeNull();
  });

  it('is pure: the same manifest reads the same', () => {
    for (const [k, m] of Object.entries(HOUSES)) expect(JSON.stringify(readStructure(m)), k).toBe(JSON.stringify(reads[k]));
  });

  it('adds nothing to the world: the collectors leave the faces byte-identical', () => {
    const faces = (m, extra) => {
      const stack = storeyLevels(m);
      const s = Array.isArray(m.levels) || stack
        ? structurizeHouse(stack ? { ...m, ...stack } : m, { ...m, ...extra })
        : structurizeFloorplan(m, { ...m, ...extra });
      return JSON.stringify(s.faces);
    };
    for (const [k, m] of Object.entries(HOUSES)) {
      expect(faces(m, { _objects: [], _spans: {} }), k).toBe(faces(m, {}));
    }
  });

  it("reads the kernels' own numbers: the grade, the schedules", () => {
    const m = HOUSES.storeys;
    const house = structurizeHouse({ ...m, ...storeyLevels(m) }, { ...m, walk: false, _model: true });
    const model = buildElementModel(house, m);
    expect(reads.storeys.grade).toEqual(scoreHouse(model));
    expect(reads.storeys.schedules.egress).toEqual(deriveSchedules(model).egress);
  });
});

describe('tags — one per element and object, agreeing everywhere', () => {
  it('numbers rooms by storey as a set does (101 …, 201 …) and uniquely', () => {
    const r = reads.storeys;
    const tags = r.rooms.map((x) => x.tag);
    expect(new Set(tags).size).toBe(tags.length);
    for (const room of r.rooms) expect(room.tag.startsWith(storeyNumber(room.storey))).toBe(true);
    expect(tags).toContain('101');
    expect(tags).toContain('201');
    expect(roomNumber(-1, 0)).toBe('B101');
  });

  it('tags each door by the room it serves, uniquely, and that room is one it opens into', () => {
    for (const [k, r] of Object.entries(reads)) {
      const tags = r.elements.doors.map((d) => d.tag);
      expect(new Set(tags).size, k).toBe(tags.length);
      for (const d of r.elements.doors) {
        expect(d.connects, `${k} ${d.tag}`).toContain(d.serves);
        expect(d.tag.startsWith(d.serves), `${k} ${d.tag}`).toBe(true);
      }
    }
  });

  it('cross-links agree: a room names walls, doors, windows and objects that name it back', () => {
    for (const [k, r] of Object.entries(reads)) {
      const walls = new Map(r.elements.walls.map((w) => [w.tag, w]));
      const doors = new Map(r.elements.doors.map((d) => [d.tag, d]));
      const windows = new Map(r.elements.windows.map((w) => [w.mark, w]));
      const pieces = new Map(r.objects.pieces.map((p) => [p.mark, p]));
      for (const room of r.rooms) {
        for (const t of room.walls) expect(walls.get(t).bounds, `${k} ${room.tag} ${t}`).toContain(room.tag);
        for (const t of room.doors) expect(doors.get(t).connects, `${k} ${room.tag} ${t}`).toContain(room.tag);
        for (const t of room.windows) expect(windows.get(t).connects, `${k} ${room.tag} ${t}`).toContain(room.tag);
        for (const t of room.objects) expect(pieces.get(t).room, `${k} ${room.tag} ${t}`).toBe(room.tag);
      }
      for (const w of r.elements.windows) expect(walls.has(w.host), k).toBe(true);
    }
  });

  it('room areas equal the space schedule', () => {
    for (const r of Object.values(reads)) {
      const byArea = r.schedules.spaceSchedule.map((s) => s.area).sort((a, b) => a - b);
      expect(r.rooms.map((x) => x.area).sort((a, b) => a - b)).toEqual(byArea);
    }
  });

  it('windows of one nominal size and sill (to the inch) are one type', () => {
    const r = reads.framed;
    const keys = r.elements.windowTypes.map((t) => `${t.widthIn}x${t.heightIn}@${t.sillIn}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(r.elements.windowTypes.reduce((a, t) => a + t.count, 0)).toBe(r.elements.windows.length);
  });

  it('a resize that keeps the reading order keeps every tag', () => {
    const wider = { ...HOUSES.room, width: 26, rooms: [{ ...HOUSES.room.rooms[0], w: 22 }] };
    const a = reads.room, b = readStructure(wider);
    expect(b.rooms.map((x) => x.tag)).toEqual(a.rooms.map((x) => x.tag));
    expect(b.elements.doors.map((x) => x.tag)).toEqual(a.elements.doors.map((x) => x.tag));
    expect(b.objects.types.map((x) => x.tag)).toEqual(a.objects.types.map((x) => x.tag));
  });

  it('object types follow the FF&E form CODE-n, a ref piece is RF', () => {
    expect(objectCode('sofa')).toBe('SO');
    expect(objectCode('x')).toBe('XX');
    const t = tagObjectTypes([{ key: 'chair|a', code: 'CH' }, { key: 'chair|b', code: 'CH' }, { key: 'sofa|', code: 'SO' }]);
    expect([...t.values()]).toEqual(['CH-1', 'CH-2', 'SO-1']);
    const r = reads.items;
    const ref = r.objects.pieces.find((p) => p.source === 'ref');
    expect(ref).toMatchObject({ ref: 'sk_chair', room: '101' });
    expect(ref.tag).toMatch(/^RF-\d+$/);
    expect(r.objects.pieces.some((p) => p.source === 'item' && p.type === 'sofa')).toBe(true);
  });
});

describe('construction — read when the house is framed', () => {
  it('a framed house carries its report, schedules, checks and the span checks the world drops', () => {
    const c = reads.framed.construction;
    expect(c.report.system).toBe('platform');
    expect(Object.keys(c.schedules).sort()).toEqual(['cutList', 'panel', 'sheets', 'takeoff']);
    expect(Object.keys(c.spans).length).toBeGreaterThan(0);
    for (const rows of Object.values(c.spans)) for (const row of rows) expect(row).toHaveProperty('ok');
  });

  it('an unframed house has no construction', () => {
    expect(reads.storeys.construction).toBeUndefined();
    expect(reads.storeys.elements.roof.planes.length).toBeGreaterThan(0);
  });
});
