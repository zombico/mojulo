/**
 * Placed room items — the operator's own pieces in a floorplan room (`rooms[i].items`):
 * a `type` bakes as a room piece, a `ref` rides out as a placement record the World resolves
 * and fits (world-scene.js). Machine gate: where an item lands, which way it faces, that the
 * generated furniture yields its footprint, and that a ref resolves, fits, and refuses a loop.
 */
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, expect, it } from 'vitest';

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene.js';
import {
  roomItemPlacements, placeItemFaces, structurizeFloorplan, assembleFloorWorldScene, assembleHouseWorldScene, FLOORPLAN_DEFAULTS,
} from './floorplan-structure.js';
import { furnishUnit } from '../architecture/condo-unit-fitout.js';
import { planFractalCondoComplex, assembleFractalCondoScene } from '../architecture/fractal-condo.js';

const ROOM = { x: 0, y: 0, w: 18, h: 16, glyph: 'L' };
const PAD = Math.max(FLOORPLAN_DEFAULTS.wallThickness, 0.4);

// every face corner's bound, over the faces a predicate keeps
function bounds(faces) {
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const f of faces) for (const [x, y, z] of f.corners) {
    b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y);
    b.z0 = Math.min(b.z0, z); b.z1 = Math.max(b.z1, z);
  }
  return b;
}
const byGroup = (faces, name) => faces.filter((f) => typeof f.group === 'string' && f.group.endsWith(`:${name}`));

// A seat's occupant faces AWAY from its backrest (its tallest geometry): footprint centre −
// the centroid of the top 20% of its vertices.
function facingOf(faces) {
  const b = bounds(faces);
  let tx = 0, ty = 0, n = 0;
  for (const f of faces) for (const c of f.corners) if (c[2] > b.z0 + (b.z1 - b.z0) * 0.8) { tx += c[0]; ty += c[1]; n += 1; }
  const v = [(b.x0 + b.x1) / 2 - tx / n, (b.y0 + b.y1) / 2 - ty / n];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l];
}
const COMPASS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };   // the walls' letters: N is the y0 wall

describe('placement', () => {
  it('a wall item backs onto that wall, faces into the room, and sits `at` along it', () => {
    const [p] = roomItemPlacements({ ...ROOM, items: [{ type: 'bookshelf', wall: 'N', at: 0.25, size: [4, 1.5] }] });
    expect(p.facing).toBe('S');
    expect(p.rect.y0).toBeCloseTo(PAD, 6);                        // touching the N wall's inner face
    expect(p.rect.y1 - p.rect.y0).toBeCloseTo(1.5, 6);
    expect((p.rect.x0 + p.rect.x1) / 2).toBeCloseTo(PAD + 0.25 * (ROOM.w - 2 * PAD), 6);
  });

  it('an E/W wall item lays its width along that wall', () => {
    const [p] = roomItemPlacements({ ...ROOM, items: [{ type: 'sideboard', wall: 'E', at: 0.5, size: [5, 1.5] }] });
    expect(p.facing).toBe('W');
    expect(p.rect.x1).toBeCloseTo(ROOM.w - PAD, 6);
    expect(p.rect.x1 - p.rect.x0).toBeCloseTo(1.5, 6);
    expect(p.rect.y1 - p.rect.y0).toBeCloseTo(5, 6);
  });

  it('an item stays inside the walls, whatever `at` says', () => {
    const [p] = roomItemPlacements({ ...ROOM, items: [{ type: 'table', at: [1.4, -0.3], size: [4, 3] }] });
    expect(p.rect.x1).toBeLessThanOrEqual(ROOM.w - PAD + 1e-9);
    expect(p.rect.y0).toBeGreaterThanOrEqual(PAD - 1e-9);
  });

  it('entries without a type or ref are skipped; no items means no placements', () => {
    expect(roomItemPlacements({ ...ROOM, items: [{}, null, { at: [0.5, 0.5] }] })).toEqual([]);
    expect(roomItemPlacements(ROOM)).toEqual([]);
  });
});

describe('type items bake into the house', () => {
  it('a library piece, an asset id and an unknown name all render inside their footprint', () => {
    const items = [
      { type: 'bookshelf', wall: 'N', at: 0.2, name: 'shelf' },
      { type: 'bookcase', wall: 'W', name: 'case' },                          // an asset id
      { type: 'piano', at: [0.6, 0.6], size: [5, 2.5], height: 4, name: 'piano' },   // no preset: a plain box
    ];
    const s = structurizeFloorplan({ rooms: [{ ...ROOM, items }] }, {});   // unfurnished: the items still render
    const placed = roomItemPlacements({ ...ROOM, items });
    for (const p of placed) {
      const faces = s.faces.filter((f) => f.corners.every(([x, y, z]) => z > 0.01
        && x >= p.rect.x0 - 1e-6 && x <= p.rect.x1 + 1e-6 && y >= p.rect.y0 - 1e-6 && y <= p.rect.y1 + 1e-6));
      expect(faces.length, p.name).toBeGreaterThan(0);
    }
    const piano = placed.find((p) => p.name === 'piano');
    const inPiano = s.faces.filter((f) => f.corners.every(([x, y]) => x >= piano.rect.x0 - 1e-6 && x <= piano.rect.x1 + 1e-6 && y >= piano.rect.y0 - 1e-6 && y <= piano.rect.y1 + 1e-6));
    expect(bounds(inPiano).z1).toBeCloseTo(4, 1);
    expect(byGroup(s.faces, 'case').length).toBeGreaterThan(0);          // the mesh asset, grouped by the item's name
    expect(s.faces.filter((f) => f.group === 'item:piano')).toHaveLength(inPiano.length);   // a box-net piece takes item:<name>
  });

  for (const facing of ['N', 'S', 'E', 'W']) {
    it(`an armchair placed facing ${facing} faces ${facing}`, () => {
      const s = structurizeFloorplan({ rooms: [{ ...ROOM, items: [{ type: 'armchair', at: [0.5, 0.5], facing, name: 'seat' }] }] }, {});
      const f = facingOf(byGroup(s.faces, 'seat'));
      const want = COMPASS[facing];
      expect(f[0] * want[0] + f[1] * want[1]).toBeGreaterThan(0.7);
    });
  }

  it('the generated furniture yields the footprint (rugs stay under it)', () => {
    const items = [{ type: 'piano', at: [0.5, 0.5], size: [6, 4], height: 4, name: 'piano' }];
    const [p] = roomItemPlacements({ ...ROOM, items });
    const inset = 0.05;
    const standsIn = (f) => f.group !== 'floor:skin' && !(f.group || '').includes('rug')
      && ((c) => c[2] > 0.2 && c[0] > p.rect.x0 + inset && c[0] < p.rect.x1 - inset && c[1] > p.rect.y0 + inset && c[1] < p.rect.y1 - inset)(
        [0, 1, 2].map((k) => f.corners.reduce((a, q) => a + q[k], 0) / f.corners.length));   // the face's centroid
    // the item's own faces: the same house unfurnished (walls and floor never stand in the rect)
    const own = new Set(structurizeFloorplan({ rooms: [{ ...ROOM, items }] }, {}).faces.filter(standsIn).map((f) => JSON.stringify(f.corners)));
    expect(own.size).toBeGreaterThan(0);
    // without the item, the lounge's own furniture stands there (the test is not vacuous) …
    expect(structurizeFloorplan({ rooms: [ROOM] }, { furnish: true }).faces.filter(standsIn).length).toBeGreaterThan(0);
    // … and with it, a piece whose footprint the item claims is dropped, not squeezed
    const s = structurizeFloorplan({ rooms: [{ ...ROOM, items }] }, { furnish: true });
    expect(s.faces.filter(standsIn).filter((f) => !own.has(JSON.stringify(f.corners)))).toEqual([]);
  });
});

const MUG = {
    kind: 'workbench', units: 'cm',
    lathes: [{ axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 9 }, profile: [{ t: 0, radius: 3.6 }, { t: 1, radius: 4 }], tint: '#b8342c' }],
    sweeps: [{ path: [[3.8, 0, 2.2], [6.2, 0, 3.2], [6.6, 0, 5.2], [3.8, 0, 7.4]], radius: 0.6, tint: '#b8342c' }],   // the handle, on +x
};
SketchRepository.create({ ref: 'sk_item_mug', title: 'mug', manifest: MUG });

describe('ref items', () => {
  it('placeItemFaces fits uniformly, stands on the floor, and turns the +y front to its facing', () => {
    // a 10 × 4 × 2 slab with a marker on its +x end
    const box = [{ corners: [[-5, -2, 0], [5, -2, 0], [5, 2, 0], [-5, 2, 0]] }, { corners: [[-5, -2, 2], [5, -2, 2], [5, 2, 2], [-5, 2, 2]] }];
    const marker = { corners: [[5, -1, 1], [5, 1, 1], [5, 1, 2], [5, -1, 2]], group: 'm' };
    const out = placeItemFaces([...box, marker], { name: 'slab', center: [10, 20], z: 3, size: [2, 2], facing: 'S' });
    const b = bounds(out);
    expect(b.x1 - b.x0).toBeCloseTo(2, 6);                          // k = min(2/10, 2/4) = 0.2
    expect(b.y1 - b.y0).toBeCloseTo(0.8, 6);
    expect(b.z0).toBeCloseTo(3, 6);
    expect((b.x0 + b.x1) / 2).toBeCloseTo(10, 6);
    expect(out.every((f) => f.group === 'item:slab')).toBe(true);
    // facing E turns local +y onto +x, so the +x marker lands on −y
    const e = placeItemFaces([...box, marker], { name: 'slab', center: [0, 0], z: 0, size: [2, 2], facing: 'E' });
    expect(bounds([e[2]]).y1).toBeLessThan(0);
    // `turn` spins the piece before it is fitted: 90° stands the slab's long side along y
    const t = bounds(placeItemFaces(box, { name: 'slab', center: [0, 0], z: 0, size: [2, 2], facing: 'S', turn: 90 }));
    expect(t.y1 - t.y0).toBeCloseTo(2, 6);
    expect(t.x1 - t.x0).toBeCloseTo(0.8, 6);
  });

  it('a house carries a ref item as a placement record; the World resolves and fits it', async () => {
    const manifest = {
      kind: 'floorplan',
      rooms: [{ ...ROOM, items: [{ ref: 'sk_item_mug', wall: 'E', at: 0.5, size: [2, 2], height: 3, name: 'mug' }] }],
    };
    const direct = assembleFloorWorldScene(manifest, {});
    expect(direct.itemRefs).toHaveLength(1);
    expect(direct.itemRefs[0]).toMatchObject({ ref: 'sk_item_mug', facing: 'W', z: 0 });

    const { payload } = await resolveWorldScene({ manifest, title: null, ref: 'sk_item_house' });
    expect(payload.itemRefs).toBeUndefined();
    const mug = payload.faces.filter((f) => f.group === 'item:mug');
    expect(mug.length).toBeGreaterThan(0);
    const b = bounds(mug);
    const [p] = roomItemPlacements(manifest.rooms[0]);
    expect(b.x0).toBeGreaterThanOrEqual(p.rect.x0 - 1e-6);
    expect(b.x1).toBeLessThanOrEqual(p.rect.x1 + 1e-6);
    expect(b.y0).toBeGreaterThanOrEqual(p.rect.y0 - 1e-6);
    expect(b.y1).toBeLessThanOrEqual(p.rect.y1 + 1e-6);
    expect(b.z0).toBeCloseTo(0, 6);
    expect(b.z1).toBeLessThanOrEqual(3 + 1e-6);
    // facing W turns local +y onto −x, so the +x handle swings round to +y
    const handle = mug.filter((f) => f.corners.every((c) => c[1] > (b.y0 + b.y1) / 2 + 0.3 * (b.y1 - b.y0) / 2));
    expect(handle.length).toBeGreaterThan(0);
  });

  it('an unknown ref and a ref that places itself refuse', async () => {
    const ghost = { kind: 'floorplan', rooms: [{ ...ROOM, items: [{ ref: 'sk_item_ghost', name: 'g' }] }] };
    await expect(resolveWorldScene({ manifest: ghost, title: null, ref: 'sk_item_a' })).rejects.toThrow(/not a stored sketch/);
    const loop = { kind: 'floorplan', rooms: [{ ...ROOM, items: [{ ref: 'sk_item_loop', name: 'self' }] }] };
    SketchRepository.create({ ref: 'sk_item_loop', title: 'loop', manifest: loop });
    await expect(resolveWorldScene(SketchRepository.getByRef('sk_item_loop'))).rejects.toThrow(/places itself/);
  });

  it('a stacked house carries each storey’s ref items at that storey, explode and all', () => {
    const item = { ref: 'sk_item_mug', at: [0.5, 0.5], name: 'upstairs' };
    const input = {
      kind: 'floorplan', stairs: false,
      levels: [{ index: 0, rooms: [ROOM] }, { index: 1, rooms: [{ ...ROOM, items: [item] }] }],
    };
    const flat = assembleHouseWorldScene(input, { view: 'cutaway' });
    expect(flat.itemRefs).toHaveLength(1);
    expect(flat.itemRefs[0].z).toBeGreaterThan(5);
    const exploded = assembleHouseWorldScene(input, { view: 'cutaway', explode: 20 });
    expect(exploded.itemRefs[0].z).toBeCloseTo(flat.itemRefs[0].z + 20, 6);
  });

  it('a room without items adds no key to the payload', () => {
    expect('itemRefs' in assembleFloorWorldScene({ rooms: [ROOM] }, {})).toBe(false);
  });
});

// ── condo units: the same grammar in the unit's words (back / front / washroom / entry) ──
// a unit on the +y side of an x hall: back wall +y (S), hall glass −y (N), washroom −x, entry +x
const UNIT_S = { axis: 'x', alongCenter: 0, a0: -9, a1: 9, cInner: 0, cOuter: 13, wcSide: -4.5, wcFront: 7, baseZ: 0, height: 12, seed: 3, id: 'hall-t:u0' };
// a unit on the −x side of a y hall: back wall −x (W), hall glass +x (E), washroom −y, entry +y
const UNIT_W = { axis: 'y', alongCenter: 0, a0: -9, a1: 9, cInner: 0, cOuter: -13, wcSide: -4.5, wcFront: -7, baseZ: 0, height: 12, seed: 3, id: 'hall-t:u1' };
const centroid = (f) => [0, 1, 2].map((k) => f.corners.reduce((a, q) => a + q[k], 0) / f.corners.length);

describe('condo unit items', () => {
  it('a back-wall piece backs the window wall and faces the hall, whichever side the unit is on', () => {
    for (const [u, back, hall] of [[UNIT_S, (b) => b.y1, [0, -1]], [UNIT_W, (b) => -b.x0, [1, 0]]]) {
      const fit = furnishUnit({ ...u, items: [{ type: 'armchair', wall: 'back', at: 0.7, name: 'seat' }] });
      const seat = byGroup(fit.faces, 'seat');
      expect(seat.length).toBeGreaterThan(0);
      expect(back(bounds(seat))).toBeCloseTo(13 - 0.4, 1);            // against the back wall's inner face
      const f = facingOf(seat);
      expect(f[0] * hall[0] + f[1] * hall[1]).toBeGreaterThan(0.7);
    }
  });

  it('`washroom` / `entry` name the side walls, and `at` runs washroom → entry, glass → back', () => {
    const fit = furnishUnit({ ...UNIT_W, items: [
      { type: 'bookshelf', wall: 'entry', at: 0.5, size: [3, 1.2], name: 'shelf' },
      { type: 'piano', at: [0.2, 0.3], size: [4, 2], height: 4, name: 'piano' },
    ] });
    const shelf = bounds(byGroup(fit.faces, 'shelf'));
    expect(shelf.y1).toBeCloseTo(9 - 0.4, 1);                           // the entry side is +y here
    const piano = bounds(fit.faces.filter((f) => f.group === 'item:piano'));
    const cy = (piano.y0 + piano.y1) / 2, cx = (piano.x0 + piano.x1) / 2;
    expect(cy).toBeLessThan(0);                                          // u 0.2: toward the washroom (−y)
    expect(cx).toBeLessThan(0); expect(cx).toBeGreaterThan(-6);          // v 0.3: nearer the glass (x 0) than the back (x −13)
  });

  it('the fit-out yields the footprint', () => {
    const items = [{ type: 'piano', at: [0.6, 0.5], size: [8, 7], height: 4, name: 'piano' }];
    const piano = bounds(furnishUnit({ ...UNIT_S, items }).faces.filter((f) => f.group === 'item:piano'));
    const standsIn = (f) => { const [x, y, z] = centroid(f); return z > 0.2 && x > piano.x0 + 0.05 && x < piano.x1 - 0.05 && y > piano.y0 + 0.05 && y < piano.y1 - 0.05; };
    expect(furnishUnit(UNIT_S).faces.filter(standsIn).length).toBeGreaterThan(0);   // not vacuous
    const fit = furnishUnit({ ...UNIT_S, items });
    expect(fit.faces.filter(standsIn).filter((f) => f.group !== 'item:piano')).toEqual([]);
  });

  it('a unit with no items is the same bytes', () => {
    expect(JSON.stringify(furnishUnit({ ...UNIT_S, items: [] }))).toBe(JSON.stringify(furnishUnit(UNIT_S)));
  });

  it('unitItems is keyed by the plan’s unit ids; an unknown id names the real ones', () => {
    const plan = planFractalCondoComplex({ seed: 4 });
    const id = plan.concourses[0].units[0].id;
    expect(id).toMatch(/^hall-[a-z]+:u0$/);
    expect(() => planFractalCondoComplex({ seed: 4, unitItems: { 'hall-q:u9': [] } })).toThrow(new RegExp(`no unit 'hall-q:u9'.*${id}`));
    expect('unitItems' in plan).toBe(false);
  });

  it('a condo carries its ref items to the World, which resolves and fits them in the unit', async () => {
    const id = planFractalCondoComplex({ seed: 4 }).concourses[0].units[0].id;
    const manifest = { kind: 'condo-complex', seed: 4, unitItems: { [id]: [{ ref: 'sk_item_mug', wall: 'back', size: [2, 2], height: 3, name: 'mug' }, { type: 'armchair', name: 'seat' }] } };
    const direct = assembleFractalCondoScene(manifest, {});
    expect(direct.itemRefs).toHaveLength(1);
    expect(byGroup(direct.faces, 'seat').length).toBeGreaterThan(0);
    const { payload } = await resolveWorldScene({ manifest, title: null, ref: 'sk_item_condo' });
    expect(payload.itemRefs).toBeUndefined();
    const mug = bounds(payload.faces.filter((f) => f.group === 'item:mug'));
    expect(mug.z1 - mug.z0).toBeLessThanOrEqual(3 + 1e-6);
    expect(Math.max(mug.x1 - mug.x0, mug.y1 - mug.y0)).toBeLessThanOrEqual(2 + 1e-6);
    expect('itemRefs' in assembleFractalCondoScene({ seed: 4 }, {})).toBe(false);
  });
});
