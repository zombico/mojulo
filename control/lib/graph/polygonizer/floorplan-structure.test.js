import assert from 'node:assert';
import { test } from 'vitest';
import {
  buildWallGraph, placeOpenings, wallRunFaces, extrudeWalls,
  structurizeFloorplan, STRUCTURAL_GLYPHS,
  houseMeru, structurizeHouse, groundDatumFaces, LEVEL_ROLES, storeyLevels,
  buildStairFlight, placeStairs, STAIR_DEFAULTS, assembleHouseWorldScene, FLOORPLAN_METERS_PER_UNIT,
} from './floorplan-structure.js';

// A minimal hand-built footprint: two rooms separated by a hall, tiling a
// 30×10 rectangle. Shared edges are exact so the wall graph dedups them.
//   roomA [0,0..12,10] | hall [12,0..18,10] | roomB [18,0..30,10]
const TWO_ROOM = [
  { x: 0, y: 0, w: 12, h: 10, kind: 'room', glyph: 'L' },
  { x: 12, y: 0, w: 6, h: 10, kind: 'hall', glyph: 'H' },
  { x: 18, y: 0, w: 12, h: 10, kind: 'room', glyph: 'B' },
];

test('structural glyph alphabet is distinct from room archetypes', () => {
  assert.ok(STRUCTURAL_GLYPHS['▓'], 'has a perimeter glyph');
  assert.equal(STRUCTURAL_GLYPHS['▓'].role, 'exterior-wall');
  assert.equal(STRUCTURAL_GLYPHS['═'].role, 'interior-wall');
  assert.equal(STRUCTURAL_GLYPHS['║'].role, 'interior-wall');
});

test('buildWallGraph dedups shared edges into single interior partitions', () => {
  const g = buildWallGraph(TWO_ROOM);
  // the two internal vertical lines (x=12 and x=18) are each shared by a room and
  // the hall → exactly one interior run apiece, not two abutting walls.
  const interiorV = g.runs.filter((r) => r.orientation === 'v' && r.interior);
  assert.equal(interiorV.length, 2, 'two shared vertical partitions');
  assert.ok(interiorV.every((r) => r.glyph === '║'));
  // no interior run is duplicated on the same line
  const lines = interiorV.map((r) => Math.round(r.at));
  assert.deepEqual([...lines].sort((a, b) => a - b), [12, 18]);
});

test('every perimeter run borders one cell, every interior run two', () => {
  const g = buildWallGraph(TWO_ROOM);
  for (const r of g.runs) {
    if (r.interior) {
      assert.equal(r.exteriorSide, null, 'interior run has no exterior side');
      assert.ok(r.glyph === '═' || r.glyph === '║');
    } else {
      assert.ok(r.exteriorSide === 1 || r.exteriorSide === -1, 'perimeter run faces outward');
      assert.equal(r.glyph, '▓');
    }
  }
  // outer boundary: top (y=0) and bottom (y=10) full-width perimeter runs exist
  const perimH = g.runs.filter((r) => r.orientation === 'h' && !r.interior);
  assert.ok(perimH.some((r) => Math.round(r.at) === 0));
  assert.ok(perimH.some((r) => Math.round(r.at) === 10));
});

test('footprint is the union bounding box', () => {
  const g = buildWallGraph(TWO_ROOM);
  assert.deepEqual(g.footprint, { x0: 0, x1: 30, y0: 0, y1: 10 });
});

test('a perimeter wall emits an outward-facing exterior face', () => {
  const g = buildWallGraph(TWO_ROOM);
  // the bottom edge (y=0): cells are above (+y), so exterior faces -y (outward)
  const south = g.runs.find((r) => r.orientation === 'h' && !r.interior && Math.round(r.at) === 0);
  assert.ok(south, 'south perimeter run exists');
  const faces = wallRunFaces(south, { light: undefined });
  // at least one face has a -y outward normal: its quad lies on the y=at-t/2 plane
  const hasOutward = faces.some((f) => f.corners.every((c) => c[1] < 0));
  assert.ok(hasOutward, 'perimeter wall has a face on the outward (−y) side');
});

test('an interior partition emits no exterior-only mass beyond its two rooms', () => {
  const g = buildWallGraph(TWO_ROOM);
  const part = g.runs.find((r) => r.interior && r.orientation === 'v');
  const faces = wallRunFaces(part, {});
  // a partition is a thin slab straddling its line: faces exist on both sides,
  // and the run is classified interior (no exterior skin claimed).
  assert.ok(faces.length >= 4);
  assert.equal(part.exteriorSide, null);
});

test('a door splits its run into piers + a lintel and shows jambs', () => {
  const g = buildWallGraph(TWO_ROOM);
  // door on roomA's east edge (x=12) at mid-height → cuts the x=12 partition
  placeOpenings(g, [{ x: 12, y: 5, edge: 'E' }], { doorWidth: 4, doorHeight: 7, wallHeight: 10 });
  const run = g.runs.find((r) => r.orientation === 'v' && Math.round(r.at) === 12 && r.interior);
  assert.equal(run.openings.length, 1, 'door registered on the x=12 partition');
  const noDoor = wallRunFaces(g.runs.find((r) => r.orientation === 'v' && Math.round(r.at) === 18 && r.interior), { wallHeight: 10 });
  const withDoor = wallRunFaces(run, { wallHeight: 10 });
  // the cut run yields MORE boxes (two piers + lintel) than the solid one (one box)
  assert.ok(withDoor.length > noDoor.length, 'doorway split adds pier/lintel faces');
  // the lintel exists: some face sits entirely above the door height (z>7)
  assert.ok(withDoor.some((f) => f.corners.every((c) => c[2] >= 7 - 1e-6)));
  // a gap exists at floor level inside the opening: no face spans the door center low down
  const lowAtCenter = withDoor.filter((f) => f.corners.some((c) => c[2] < 1 && Math.abs(c[1] - 5) < 1));
  assert.ok(lowAtCenter.length < withDoor.length, 'doorway is open at the floor');
});

test('windows only open on perimeter runs when enabled', () => {
  const g = buildWallGraph(TWO_ROOM);
  placeOpenings(g, [], { windows: true, windowWidth: 4 });
  const interiorWithOpening = g.runs.filter((r) => r.interior && r.openings.length);
  assert.equal(interiorWithOpening.length, 0, 'no windows cut into interior partitions');
  const perimWithOpening = g.runs.filter((r) => !r.interior && r.openings.length);
  assert.ok(perimWithOpening.length > 0, 'windows land on perimeter walls');
});

test('entryDoor cuts one exterior opening into the house envelope', () => {
  const g = buildWallGraph(TWO_ROOM);
  placeOpenings(g, [], { entryDoor: true, doorWidth: 3.2, doorHeight: 7 });
  const entryRuns = g.runs.filter((r) => !r.interior && r.openings.some((op) => op.entry));
  assert.equal(entryRuns.length, 1, 'one perimeter run receives the front door');
  const op = entryRuns[0].openings.find((o) => o.entry);
  assert.equal(op.sill, 0, 'entry starts at the floor');
  assert.equal(op.top, 7, 'entry uses the door head height');
  assert.ok(op.doorSwing === 1 || op.doorSwing === -1, 'entry swings toward the exterior side');
});

test('entryDoor and centred windows do not overlap on the same exterior run', () => {
  const g = buildWallGraph(TWO_ROOM);
  placeOpenings(g, [], { entryDoor: true, windows: true, doorWidth: 4, windowWidth: 4 });
  for (const run of g.runs) {
    const sorted = (run.openings || []).slice().sort((a, b) => a.a - b.a);
    for (let i = 1; i < sorted.length; i += 1) {
      assert.ok(sorted[i].a >= sorted[i - 1].b - 1e-6, 'openings do not overlap');
    }
  }
});

test('facadeDecor adds proud exterior skin faces without replacing wall mass', () => {
  const g = buildWallGraph(TWO_ROOM);
  const south = g.runs.find((r) => r.orientation === 'h' && !r.interior && Math.round(r.at) === 0);
  const plain = wallRunFaces(south, { wallHeight: 10 });
  const decorated = wallRunFaces(south, { wallHeight: 10, facadeDecor: true });
  assert.ok(decorated.length > plain.length, 'decorated facade adds siding/trim faces');
  assert.ok(decorated.some((f) => f.group === 'facade:skin'), 'facade skin group emitted');
});

test('xrayWalls keeps entry assemblies solid while caging structural envelope', () => {
  const g = buildWallGraph(TWO_ROOM);
  placeOpenings(g, [], { entryDoor: true });
  const entryRun = g.runs.find((r) => !r.interior && r.openings.some((op) => op.entry));
  const faces = wallRunFaces(entryRun, { wallHeight: 10, xrayWalls: true, entryDoor: true });
  assert.ok(faces.some((f) => f.wireframe), 'structural exterior faces are caged');
  assert.ok(faces.some((f) => !f.wireframe && f.group !== 'shell:exterior'), 'entry assembly remains solid');
});

test('structurizeFloorplan from a seed yields walls, a floor, and a classified graph', () => {
  const s = structurizeFloorplan({ seed: 7, width: 80, height: 56 });
  assert.ok(s.plan.rooms.length > 1, 'generator produced multiple rooms');
  assert.ok(s.wallGraph.runs.length > 0, 'wall graph has runs');
  assert.ok(s.wallGraph.runs.some((r) => r.interior), 'has interior partitions (rooms relate)');
  assert.ok(s.wallGraph.runs.some((r) => !r.interior), 'has exterior envelope');
  assert.ok(s.faces.length > 0, 'baked faces emitted');
  // every face is a 4-corner xyz quad with a fill
  for (const f of s.faces) {
    assert.equal(f.corners.length, 4);
    assert.ok(f.corners.every((c) => c.length === 3 && c.every(Number.isFinite)));
    assert.ok(typeof f.fill === 'string' && f.fill.startsWith('#'));
  }
});

test('extrudeWalls is deterministic for a fixed graph', () => {
  const g1 = buildWallGraph(TWO_ROOM);
  const g2 = buildWallGraph(TWO_ROOM);
  assert.equal(extrudeWalls(g1).length, extrudeWalls(g2).length);
});

// ── the meru: vertical ruler + stacked levels ────────────────────────────────
test('houseMeru places storeys flush along the axis', () => {
  const m = houseMeru({ wallHeight: 10, floorDrop: 2, groundZ: 0 });
  assert.equal(m.storeyPitch, 12);
  assert.equal(m.baseZ(0), 0);          // ground floor at the datum
  assert.equal(m.baseZ(1), 12);         // second floor one pitch up
  assert.equal(m.baseZ(-1), -12);       // basement one pitch down
  // a level's floor sits flush on the level below's ceiling
  assert.equal(m.baseZ(1) - m.wallHeight, m.baseZ(0) + 2, 'second floor sits on ground ceiling + slab');
});

test('a baseZ lifts a floorplan to its level height', () => {
  const ground = structurizeFloorplan({ seed: 3, width: 60, height: 44 }, { wallHeight: 10, floorDrop: 2, baseZ: 0 });
  const upper = structurizeFloorplan({ seed: 3, width: 60, height: 44 }, { wallHeight: 10, floorDrop: 2, baseZ: 12 });
  const zMax = (faces) => Math.max(...faces.flatMap((f) => f.corners.map((c) => c[2])));
  const zMin = (faces) => Math.min(...faces.flatMap((f) => f.corners.map((c) => c[2])));
  assert.ok(Math.abs(zMin(ground.faces) - -2) < 1e-6, 'ground floor slab bottom at −floorDrop');
  assert.ok(Math.abs(zMin(upper.faces) - 10) < 1e-6, 'upper floor slab bottom on the ground ceiling');
  assert.ok(zMax(upper.faces) > zMax(ground.faces), 'upper level sits above ground');
});

test('structurizeHouse stacks basement/ground/second from reused glyphs', () => {
  const house = structurizeHouse({
    width: 70, height: 50, seed: 5,
    levels: [{ role: 'basement' }, { role: 'ground' }, { role: 'second' }],
  });
  assert.equal(house.levels.length, 3);
  assert.deepEqual(house.levels.map((l) => l.index), [-1, 0, 1]);
  // each level was generated through the same glyph machinery
  for (const l of house.levels) {
    assert.ok(l.structure.plan.rooms.length > 0, `${l.role} has rooms`);
    assert.ok(l.structure.wallGraph.runs.some((r) => r.glyph === '▓'), `${l.role} has envelope`);
  }
  // the basement sits below the ground datum, the second floor above it
  const basement = house.levels.find((l) => l.index === -1);
  const second = house.levels.find((l) => l.index === 1);
  assert.ok(basement.baseZ < 0, 'basement below ground');
  assert.ok(second.baseZ > 0, 'second floor above ground');
});

test('LEVEL_ROLES maps roles onto meru indices', () => {
  assert.equal(LEVEL_ROLES.basement, -1);
  assert.equal(LEVEL_ROLES.ground, 0);
  assert.equal(LEVEL_ROLES.second, 1);
});

// ── the stairs primitive + the open slot it cuts ────────────────────────────
test('buildStairFlight climbs exactly from baseZ to baseZ+totalRise', () => {
  const f = buildStairFlight({ anchor: [0, 0], direction: '+x', width: 8, going: 2, riser: 1, baseZ: 0, totalRise: 12, treadTint: '#aaa', riserTint: '#888', rails: false });
  assert.equal(f.steps, 12, 'totalRise/riser steps');
  assert.equal(f.rise, 1, 'rise lands flush');
  const zTop = Math.max(...f.faces.flatMap((s) => s.corners.map((c) => c[2])));
  const zBot = Math.min(...f.faces.flatMap((s) => s.corners.map((c) => c[2])));
  assert.ok(Math.abs(zTop - 12) < 1e-6, 'top tread reaches the upper floor');
  assert.ok(Math.abs(zBot - 0) < 1e-6, 'bottom sits on the lower floor');
  assert.equal(f.topZ, 12);
});

test('stair steps rise monotonically (a real flight, not a ramp)', () => {
  const f = buildStairFlight({ anchor: [0, 0], direction: '+x', width: 6, going: 2, riser: 1, baseZ: 0, totalRise: 6, treadTint: '#aaa', riserTint: '#888', rails: false });
  // the per-step tread tops are distinct increasing heights
  const treadTops = [...new Set(f.faces.map((s) => Math.max(...s.corners.map((c) => c[2]))).filter((z) => z > 0))].sort((a, b) => a - b);
  assert.deepEqual(treadTops, [1, 2, 3, 4, 5, 6]);
});

test('placeStairs returns a slot inside the footprint near the wall', () => {
  const meru = houseMeru({ wallHeight: 12, floorDrop: 2 });
  const fp = { x0: 2, x1: 110, y0: 2, y1: 72 };
  const st = placeStairs(fp, meru, { from: 0, to: 1 }, {});
  assert.equal(st.fromIndex, 0);
  assert.equal(st.toIndex, 1);
  // slot sits within the footprint and is offset off the wall (not at the very edge)
  assert.ok(st.slot.x0 >= fp.x0 && st.slot.x1 <= fp.x1 && st.slot.y0 >= fp.y0 && st.slot.y1 <= fp.y1, 'slot within footprint');
  assert.ok(st.slot.y0 > fp.y0, 'tucked just inside the wall, not on it');
});

test('a stair cuts an open slot through the destination floor slab', () => {
  const solid = structurizeHouse({ width: 110, height: 72, seed: 5, levels: [{ role: 'ground' }, { role: 'second' }] });
  const withStair = structurizeHouse({ width: 110, height: 72, seed: 5, stairs: { from: 0, to: 1 }, levels: [{ role: 'ground' }, { role: 'second' }] });
  assert.equal(withStair.stairs.length, 1, 'one stair placed');
  const second = withStair.levels.find((l) => l.index === 1);
  assert.equal(second.structure.slabHoles.length, 1, 'second floor slab has the stair void');
  // the holed slab is built from MORE rects (border strips) than the solid one,
  // so the second floor genuinely has an opening, and stair faces were added.
  const solidSecond = solid.levels.find((l) => l.index === 1);
  assert.ok(withStair.faces.length > solid.faces.length, 'stair flight + slot edges add faces');
  // the slot lies over the ground-floor volume the flight climbs through
  const st = withStair.stairs[0];
  assert.ok(st.slot.x1 > st.slot.x0 && st.slot.y1 > st.slot.y0, 'slot is a real rectangle');
  assert.ok(solidSecond.structure.slabHoles.length === 0, 'baseline second floor is a solid slab');
});

test('ground datum is a z=0 helper line, not terrain', () => {
  const house = structurizeHouse({ width: 60, height: 40, seed: 2, levels: [{ role: 'ground' }, { role: 'second' }] });
  const faces = groundDatumFaces(house.footprint, house.meru, { axisZ0: -5, axisZ1: 30 });
  // the frame lies entirely in the ground plane (z == groundZ)
  const frame = faces.filter((f) => f.corners.every((c) => Math.abs(c[2] - house.meru.groundZ) < 1e-6));
  assert.ok(frame.length >= 4, 'four ground-plane helper-line quads');
  assert.ok(frame.every((f) => f.glow), 'helper line glows so it reads as a datum, not mass');
  // it is a thin outline around — not a filled slab over — the footprint (terrain stays out)
  const coversInterior = faces.some((f) => {
    const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]);
    return (Math.max(...xs) - Math.min(...xs)) > (house.footprint.x1 - house.footprint.x0) * 0.9
      && (Math.max(...ys) - Math.min(...ys)) > (house.footprint.y1 - house.footprint.y0) * 0.9
      && Math.abs(f.corners[0][2] - house.meru.groundZ) < 1e-6;
  });
  assert.ok(!coversInterior, 'no filled ground plane — only a helper outline');
});

// ── assembleHouseWorldScene: the stack as ONE World scene (paris-t4-stack) ───────────────
// The `floorplan` kind routes a `levels[]` manifest here. Two explicit levels of different
// footprint (a set-back upper floor) must land at their own floor z, share one payload shape
// with the single-floor scene, and pull apart under `explode`.
const STACK = {
  width: 30, height: 20,
  levels: [
    { index: 0, height: 12, rooms: [{ x: 0, y: 0, w: 30, h: 20, glyph: 'L' }], doors: [] },
    { index: 1, height: 8, rooms: [{ x: 2, y: 4, w: 26, h: 16, glyph: 'B' }], doors: [] },
  ],
};

test('assembleHouseWorldScene returns the floor-scene shape with every level at its own z', () => {
  const scene = assembleHouseWorldScene(STACK, { ...STACK, view: 'cutaway', walk: true });   // the kind passes walk
  assert.ok(Array.isArray(scene.faces) && scene.faces.length > 0, 'faces');
  assert.ok(scene.cameras.length >= 2, 'cameras framed over the stack');
  assert.ok(scene.walk, 'cutaway is walkable');
  assert.equal(scene.metersPerUnit, FLOORPLAN_METERS_PER_UNIT, 'feet, like the single floor');
  const zs = scene.faces.flatMap((f) => f.corners.map((c) => c[2]));
  // ground storey 12 ft + slab 1.1 → the upper floor's walls top out at 13.1 + 8 = 21.1
  assert.ok(Math.max(...zs) > 21 && Math.max(...zs) < 22.5, `stack top ${Math.max(...zs)}`);
  // the upper level's set-back envelope leaves faces at x=2 above the ground storey
  const upperWest = scene.faces.some((f) => f.corners.every((c) => Math.abs(c[0] - 2) < 0.6 && c[2] > 13));
  assert.ok(upperWest, 'set-back upper footprint extrudes its own envelope');
});

test('assembleHouseWorldScene: explode lifts the upper level, exterior never explodes', () => {
  const flush = assembleHouseWorldScene(STACK, { ...STACK, view: 'cutaway' });
  const apart = assembleHouseWorldScene(STACK, { ...STACK, view: 'cutaway', explode: 6 });
  const top = (sc) => Math.max(...sc.faces.flatMap((f) => f.corners.map((c) => c[2])));
  assert.ok(Math.abs(top(apart) - top(flush) - 6) < 1e-6, 'upper level shifted by the gap');
  const ext = assembleHouseWorldScene(STACK, { ...STACK, view: 'exterior', explode: 6 });
  assert.equal(ext.walk, false, 'exterior is an orbit, not a walk');
  // exterior adds a roof over the top footprint, so its top is above the flush cutaway's walls
  assert.ok(top(ext) > top(flush), 'exterior is capped, not exploded');
});

test('structurizeHouse: explicit per-level rooms with anchored stairs (no program stair zone) build and cut the slab', () => {
  const house = structurizeHouse({
    width: 30, height: 20,
    stairs: [{ from: 0, to: 1, anchor: [3, 3], direction: '+x', switchback: true, width: 3 }],
    levels: [
      { index: 0, height: 12, rooms: [{ x: 0, y: 0, w: 30, h: 20, glyph: 'L' }], doors: [] },
      { index: 1, height: 8, rooms: [{ x: 0, y: 0, w: 30, h: 20, glyph: 'B' }], doors: [] },
    ],
  });
  assert.equal(house.stairs.length, 1, 'the anchored flight was placed');
  assert.deepEqual(house.stairs[0].anchor, [3, 3], 'explicit anchor honoured (no program zone to seat in)');
  const upper = house.levels.find((l) => l.index === 1);
  assert.equal(upper.structure.slabHoles.length, 1, 'the upper slab opens for the stair');
});

test('structurizeHouse: a set-back upper storey gets a terrace deck over the storey below; a straight stack adds none', () => {
  const lvl = (index, height, x, y, w, h, glyph) => ({ index, height, rooms: [{ x, y, w, h, glyph }], doors: [] });
  const setBack = structurizeHouse({ width: 30, height: 20, levels: [lvl(0, 12, 0, 0, 30, 20, 'L'), lvl(1, 8, 2, 6, 26, 14, 'B')] });
  const terrace = setBack.faces.filter((f) => f.group === 'terrace');
  assert.ok(terrace.length > 0, 'deck + rail faces exist');
  const upper = setBack.levels.find((l) => l.index === 1);
  // the deck is the upper slab continued: it spans floorDrop below the upper floor z
  const deckTop = terrace.filter((f) => f.corners.every((c) => Math.abs(c[2] - upper.baseZ) < 1e-6));
  assert.ok(deckTop.length > 0, 'deck top at the upper floor level');
  assert.ok(deckTop.some((f) => f.corners.every((c) => c[1] <= 6 + 1e-6)), 'the street strip (y < 6) is decked');
  assert.ok(upper.structure.faces.includes(terrace[0]), 'the deck rides the upper level (exploded reads lift it)');
  const straight = structurizeHouse({ width: 30, height: 20, levels: [lvl(0, 12, 0, 0, 30, 20, 'L'), lvl(1, 8, 0, 0, 30, 20, 'B')] });
  assert.equal(straight.faces.filter((f) => f.group === 'terrace').length, 0, 'identical footprints add nothing');
});

// ── storeyLevels: the `storeys: N` shorthand lowered to the levels[] stack ─────────────
test('storeyLevels: absent, 1, or an authored levels[] stack lowers to nothing (byte-identical path)', () => {
  assert.equal(storeyLevels({ seed: 7 }), null);
  assert.equal(storeyLevels({ seed: 7, storeys: 1 }), null);
  assert.equal(storeyLevels({ seed: 7, storeys: 2, levels: [{ role: 'ground' }] }), null);
  assert.equal(storeyLevels({ seed: 7, storeys: 'two' }), null);
});

test('storeyLevels: N storeys → N indexed levels with roles and a stair between each pair', () => {
  const two = storeyLevels({ seed: 7, storeys: 2 });
  assert.deepEqual(two.levels, [{ index: 0, role: 'ground' }, { index: 1, role: 'second' }]);
  assert.deepEqual(two.stairs, [{ from: 0, to: 1 }]);
  const four = storeyLevels({ seed: 7, floors: 4 });
  assert.deepEqual(four.levels.map((l) => l.role), ['ground', 'second', 'third', 'upper']);
  assert.deepEqual(four.stairs, [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }]);
  // an authored `stairs` wins over the generated run
  assert.equal(storeyLevels({ seed: 7, storeys: 3, stairs: false }).stairs, false);
});

test('a storeys:2 floorplan structurizes as a two-level house with one stair', () => {
  const m = { width: 40, height: 32, seed: 5, storeys: 2 };
  const house = structurizeHouse({ ...m, ...storeyLevels(m) }, m);
  assert.deepEqual(house.levels.map((l) => l.index), [0, 1]);
  assert.ok(house.levels[1].baseZ > house.levels[0].baseZ);
  assert.equal(house.stairs.length, 1);
});
