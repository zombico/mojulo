/**
 * Furniture audit — the machine gate for the fixes the 2026-09-26 interior audit asked for
 * (CHANGELOG "Furniture audit"). Each test measures one thing a walk camera saw wrong: a room
 * with no door, a chair with no legs, chairs dropped from a pass-through dining room, a bookcase
 * facing its wall, a door leaf standing out in a kitchen aisle, an entry and a storage room made
 * of blank slabs, a prop box on the table. The eyes gate (the audit cameras) is the operator's.
 */
import { describe, expect, it } from 'vitest';

import { buildWallGraph, connectPlan, placeOpenings, structurizeFloorplan, FLOORPLAN_DEFAULTS } from './floorplan-structure.js';
import { furnishElements, orientElementsToDoor, nearestWallOf, ASSET_FACING_IN } from './floorplan-glyphs.js';
import { buildDiningChairWorkbenchManifest } from '../architecture/room-assets.js';

const groups = (faces) => {
  const out = new Map();
  for (const f of faces) {
    if (!f.group) continue;
    const g = out.get(f.group) || { n: 0, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z1: -Infinity };
    g.n += 1;
    for (const c of f.corners) { g.x0 = Math.min(g.x0, c[0]); g.x1 = Math.max(g.x1, c[0]); g.y0 = Math.min(g.y0, c[1]); g.y1 = Math.max(g.y1, c[1]); g.z1 = Math.max(g.z1, c[2]); }
    out.set(f.group, g);
  }
  return out;
};

// the audited house: an authored 44 × 30 plan, a hall spine, only two doors authored (L↔D, D↔K)
const LAKEHOUSE = {
  width: 44, height: 30,
  rooms: [
    { x: 2, y: 2, w: 22, h: 11, glyph: 'L' }, { x: 24, y: 2, w: 10, h: 11, glyph: 'D' }, { x: 34, y: 2, w: 8, h: 11, glyph: 'K' },
    { x: 2, y: 17, w: 14, h: 11, glyph: 'B' }, { x: 16, y: 17, w: 10, h: 11, glyph: 'O' }, { x: 26, y: 17, w: 8, h: 11, glyph: 'E' }, { x: 34, y: 17, w: 8, h: 11, glyph: 'S' },
  ],
  halls: [{ x: 2, y: 13, w: 40, h: 4 }],
  doors: [{ x: 24, y: 7.5, edge: 'W', width: 3 }, { x: 34, y: 7.5, edge: 'W', width: 3 }],
  seed: 809,
};
const SHARE = { furnish: true, furnishScale: 'share', windows: true, entryDoor: true };

describe('every room gets a way in (connectPlan)', () => {
  it('doors every cell the authored doors leave sealed, halls first', () => {
    const doors = connectPlan(LAKEHOUSE);
    const auto = doors.filter((d) => d.auto);
    expect(doors.slice(0, 2)).toEqual(LAKEHOUSE.doors);                 // the authored doors come through untouched
    // the entry doors onto the hall; every other cell is reached — B, O, S and L through the hall,
    // D and K through the authored L↔D↔K doors (no second door is cut where one already serves)
    expect(auto.map((d) => d.room).sort()).toEqual([0, 3, 4, 5, 6]);
    expect(auto.every((d) => d.y === 17 || d.y === 13)).toBe(true);    // all on the hall's walls
    expect(auto.every((d) => d.width === FLOORPLAN_DEFAULTS.doorWidth)).toBe(true);
  });

  it('a plan whose rooms are all reachable gets no door', () => {
    const plan = { rooms: [{ x: 0, y: 0, w: 12, h: 12, glyph: 'L' }, { x: 12, y: 0, w: 12, h: 12, glyph: 'B' }], doors: [{ x: 12, y: 6, edge: 'W' }] };
    expect(connectPlan(plan)).toEqual(plan.doors);
  });

  it('a short wall is doored near its corner so the open leaf can lie beside the jamb', () => {
    const doors = connectPlan(LAKEHOUSE);
    const entry = doors.find((d) => d.auto && d.room === 5);          // E is 8 ft wide: the leaf cannot park off a mid-wall door
    expect(entry.x).toBeLessThan(30);
    const lounge = doors.find((d) => d.auto && d.room === 0);         // L is 22 ft wide: mid-wall
    expect(lounge.x).toBe(13);
    const cells = [...LAKEHOUSE.rooms.map((r) => ({ ...r, kind: 'room' })), ...LAKEHOUSE.halls.map((h) => ({ ...h, kind: 'hall', glyph: 'H' }))];
    const graph = buildWallGraph(cells, FLOORPLAN_DEFAULTS);
    placeOpenings(graph, doors, FLOORPLAN_DEFAULTS);
    const ops = graph.runs.flatMap((r) => r.openings.filter((op) => op.kind === 'hinged'));
    expect(ops.length).toBe(doors.length);
    expect(ops.every((op) => op.park)).toBe(true);                    // every interior leaf parks
  });

  it('the structurizer wires the auto doors into the furnish pass (command position, approaches)', () => {
    const s = structurizeFloorplan(LAKEHOUSE, SHARE);
    expect(s.plan.doors.some((d) => d.auto)).toBe(true);
    const g = groups(s.faces);
    // the office desk backs the far (S) wall and faces its hall door, instead of the door wall
    const desk = [...g.entries()].find(([k]) => /^asset:(standing-desk|computer-table|study-table)/.test(k))[1];
    expect(desk.y0).toBeGreaterThan(24);
    // the bed's headboard is on the far wall too (the bed spans up to the S wall)
    expect(g.get('asset:platform-bed').y1).toBeGreaterThan(26);
  });
});

describe('chairs', () => {
  it('the dining chair seats at half its height in any unit (no metre cap)', () => {
    // the seat slab is the tallest extrude that stays under 0.55 h (the posts and rails rise to h)
    const seatTop = (h) => Math.max(...buildDiningChairWorkbenchManifest({ h }).extrudes.map((e) => e.axisTo.z).filter((z) => z <= h * 0.55));
    expect(seatTop(0.92)).toBeCloseTo(0.46, 6);                       // metres: as before
    expect(seatTop(2.9)).toBeCloseTo(1.45, 6);                        // feet: an 18 in seat, not 0.48 ft
  });

  it('a pass-through dining room keeps its chairs; its sideboard moves off the doored wall', () => {
    const s = structurizeFloorplan(LAKEHOUSE, SHARE);
    const g = groups(s.faces);
    const chairs = [...g.keys()].filter((k) => k.startsWith('asset:chair'));
    expect(chairs.length).toBeGreaterThan(0);
    const chair = g.get(chairs[0]);
    expect(chair.z1).toBeGreaterThan(2.5);                            // a full-height chair, not a footstool
    // the D sideboard: the E wall carries the kitchen door, so it lands on a door-free wall
    const sb = [...g.entries()].filter(([k]) => k.startsWith('asset:sideboard-cabinet')).map(([, v]) => v).find((v) => v.x0 > 24 && v.x1 < 34);
    expect(sb).toBeTruthy();
    expect(sb.y0).toBeLessThan(3);                                    // against the N (window) wall
  });

  it('the office chair is a real chair in share mode', () => {
    const els = furnishElements('O', 3, { w: 9, h: 10, scale: 'share' });
    expect(els.find((e) => e.type === 'computer-chair')?.asset).toBe('chair');
    const feet = furnishElements('O', 3, { w: 9, h: 10 });
    expect(feet.find((e) => e.type === 'computer-chair')?.asset).toBeUndefined();
  });
});

describe('wall pieces', () => {
  it('an unfaced wall asset faces the room off the wall it stands on', () => {
    const els = [
      { type: 'bookshelf', asset: 'bookcase', anchor: [0.05, 0.5], w: 0.1, h: 0.3, heightWorld: 6 },     // W wall
      { type: 'media-unit', asset: 'media-console', anchor: [0.5, 0.05], w: 0.4, h: 0.1, heightWorld: 2.2 },   // N wall
      { type: 'table', asset: 'coffee-table', anchor: [0.5, 0.5], w: 0.2, h: 0.2, heightWorld: 1.4 },    // the middle: the back-wall default
    ];
    const out = orientElementsToDoor(els, 'S', 12, 12, { assetFacing: true });
    expect(out[0].facing).toBe(ASSET_FACING_IN.W);
    expect(out[1].facing).toBe(ASSET_FACING_IN.N);
    expect(out[2].facing).toBe('N');
    expect(nearestWallOf(els[2], 12, 12)).toBeNull();
  });

  it('tall storage keeps off a windowed wall', () => {
    const s = structurizeFloorplan(LAKEHOUSE, SHARE);
    const g = groups(s.faces);
    // the storage room's shelving (S: x 34–42, y 17–28; windows on its E and S walls) sits on an interior wall
    const shelf = [...g.entries()].find(([k]) => k.startsWith('asset:utility-shelf'))[1];
    expect(shelf.x0).toBeLessThan(36);                                // the W wall, shared with the entry
    expect(shelf.x1 - shelf.x0).toBeLessThan(shelf.y1 - shelf.y0);    // running along it
  });
});

describe('the open leaf', () => {
  it('parks flat against the wall beside its jamb, with a handle; a leaf with no wall keeps the 90° swing', () => {
    const cells = [{ x: 0, y: 0, w: 20, h: 12, kind: 'room', glyph: 'L' }, { x: 20, y: 0, w: 8, h: 12, kind: 'room', glyph: 'B' }, { x: 0, y: 12, w: 28, h: 4, kind: 'hall', glyph: 'H' }];
    const graph = buildWallGraph(cells, FLOORPLAN_DEFAULTS);
    placeOpenings(graph, [{ x: 10, y: 12, edge: 'S' }, { x: 24, y: 12, edge: 'S' }], FLOORPLAN_DEFAULTS);
    const [long, short] = graph.runs.flatMap((r) => r.openings).sort((a, b) => a.a - b.a);
    expect(long.park).toBeTruthy();
    expect(long.park.rect.y1).toBeLessThan(12);                       // on the lounge side of the hall wall (the leaf swings into the room)
    expect(long.park.rect.y1 - long.park.rect.y0).toBeLessThan(1);   // a strip along the wall (leaf + swing room), not a slab across the room
    expect(short.park).toBeNull();                                     // an 8 ft room doored mid-wall: no wall to lie on
  });

  it('the parked leaf is geometry the furnish pass keeps clear of', () => {
    const s = structurizeFloorplan(LAKEHOUSE, SHARE);
    const g = groups(s.faces);
    // the entry bench stands on a side wall, not through the hall door's parked leaf on the N wall
    const bench = g.get('asset:entry-bench:main');
    expect(bench).toBeTruthy();
    expect(bench.y0).toBeGreaterThan(19);
  });
});

describe('entry and storage in share mode', () => {
  it('place real pieces where the flat fills placed fractions', () => {
    const entry = furnishElements('E', 1, { w: 7, h: 10, scale: 'share' });
    expect(entry.find((e) => e.type === 'bench')?.asset).toBe('entry-bench');
    expect(entry.filter((e) => e.surface).map((e) => e.surface).sort()).toEqual(['leftWall', 'rightWall']);
    const storage = furnishElements('S', 1, { w: 7, h: 10, scale: 'share' });
    expect(storage.filter((e) => e.asset === 'utility-shelf').length).toBeGreaterThan(0);
    expect(storage.find((e) => e.type === 'cabinet')?.asset).toBe('sideboard-cabinet');
    // feet mode: the flat fills, byte-for-byte the legacy elements (no asset on any of them)
    expect(furnishElements('E', 1, { w: 7, h: 10 }).every((e) => !e.asset)).toBe(true);
    expect(furnishElements('S', 1, { w: 7, h: 10 }).every((e) => !e.asset)).toBe(true);
  });

  it('a share-mode table carries its tabletop meshes, a feet-mode one the prop boxes', () => {
    const share = groups(structurizeFloorplan(LAKEHOUSE, SHARE).faces);
    expect([...share.keys()].some((k) => k === 'asset:water-bottle' || k === 'asset:place-setting')).toBe(true);
    const feet = groups(structurizeFloorplan(LAKEHOUSE, { ...SHARE, furnishScale: 'feet' }).faces);
    expect([...feet.keys()].some((k) => k === 'asset:water-bottle' || k === 'asset:place-setting')).toBe(false);
  });
});
