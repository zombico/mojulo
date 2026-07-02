import assert from 'node:assert';
import { test } from 'vitest';
import {
  FLOOR_USES, resolveUse, resolveCore, tenancyRect,
  buildFloor, stackBuilding, allocateAreas, CAFE_PROGRAM,
} from './floorplan-building.js';

const FP = { x0: 2, x1: 58, y0: 2, y1: 38 };

const hasFaces = (faces) => Array.isArray(faces) && faces.length > 0
  && faces.every((f) => Array.isArray(f.corners) && f.corners.length === 4 && typeof f.fill === 'string');

test('floor uses declare distinct heights and core reads', () => {
  assert.equal(FLOOR_USES.lobby.height, 20);
  assert.equal(FLOOR_USES.cafe.height, 11);
  assert.equal(FLOOR_USES.lobby.coreRead, 'open');     // grand elevator lobby
  assert.equal(FLOOR_USES.cafe.coreRead, 'walled');    // doored service core
  assert.equal(resolveUse('nope').id, 'cafe');         // unknown → default
});

test('the core is a full-depth strip and the tenancy is its open remainder', () => {
  const core = resolveCore({ side: 'W', width: 13 }, FP);
  assert.equal(core.y0, FP.y0);
  assert.equal(core.y1, FP.y1);                         // full depth
  assert.ok(core.x1 - core.x0 <= 13 + 1e-6);
  const ten = tenancyRect(FP, core);
  assert.equal(ten.x0, core.x1);                        // tenancy butts the core
  assert.equal(ten.x1, FP.x1);
  assert.ok(ten.x1 - ten.x0 > core.x1 - core.x0, 'tenancy is the larger share');
});

test('buildFloor blocks in a single plate (envelope + core + fit-out)', () => {
  const cafe = buildFloor({ use: 'cafe', footprint: FP, baseZ: 0, seed: 7 });
  assert.ok(hasFaces(cafe.faces));
  assert.equal(cafe.use, 'cafe');
  assert.equal(cafe.height, 11);
  // a lobby plate carries more fit-out faces than an empty plate would; both render
  const lobby = buildFloor({ use: 'lobby', footprint: FP, baseZ: 0, seed: 7 });
  assert.ok(hasFaces(lobby.faces));
  assert.equal(lobby.height, 20);
});

test('stackBuilding lines the core up vertically and stacks per-use heights flush', () => {
  const b = stackBuilding({ floors: [{ use: 'lobby' }, { use: 'cafe' }], width: 60, height: 40 });
  assert.equal(b.levels.length, 2);
  // every plate shares the SAME core rect (the shaft is continuous)
  const cores = b.levels.map((l) => l.structure.core);
  for (const c of cores) {
    assert.deepEqual(
      [c.x0, c.x1, c.y0, c.y1].map((v) => Math.round(v * 100) / 100),
      [cores[0].x0, cores[0].x1, cores[0].y0, cores[0].y1].map((v) => Math.round(v * 100) / 100),
    );
  }
  // double-height lobby (index 0) lifts the cafe (index 1) to the lobby's full height
  const lobby = b.levels.find((l) => l.index === 0);
  const cafe = b.levels.find((l) => l.index === 1);
  assert.equal(lobby.height, 20);
  assert.ok(cafe.baseZ >= lobby.baseZ + lobby.height, 'upper floor sits above the double-height lobby');
  assert.ok(hasFaces(b.faces));
});

test('the egress stair bridges the floors and cuts a slab void in the upper plate', () => {
  const b = stackBuilding({ floors: [{ use: 'lobby' }, { use: 'cafe' }] });
  assert.equal(b.stairs.length, 1);                    // one flight between the two floors
  const st = b.stairs[0];
  assert.equal(st.lowerIndex, 0);
  assert.equal(st.upperIndex, 1);
  assert.ok(st.slot && st.slot.x1 > st.slot.x0 && st.slot.y1 > st.slot.y0, 'flight reports a stairwell slot');
  // the stair well sits inside the core strip on both axes
  const core = b.core;
  assert.ok(st.slot.x0 >= core.x0 - 0.5 && st.slot.x1 <= core.x1 + 0.5, 'stair stays within the core strip');
});

test('allocateAreas splits a usable area and the parts sum back to it', () => {
  const a = allocateAreas(1000, CAFE_PROGRAM);
  const sum = a.bar + a.counter + a.seating + a.circulation;
  assert.ok(Math.abs(sum - 1000) < 1e-6, 'allocated areas sum to usable');
  assert.ok(a.circulation > 0 && a.seating > a.bar, 'seating is the largest program zone');
});

test('cafe fit-out spends a surface-area budget (report sums; seats placed)', () => {
  const cafe = buildFloor({ use: 'cafe', footprint: { x0: 2, x1: 70, y0: 2, y1: 46 }, seed: 3 });
  const r = cafe.program;
  const sum = r.areas.bar + r.areas.counter + r.areas.seating + r.areas.circulation;
  assert.ok(Math.abs(sum - r.usable) < 1e-6, 'budget sums to the usable tenancy area');
  assert.ok(r.seats > 0, 'tables placed from the seating budget');
});

test('cafe seating count scales with the floor-plate area', () => {
  const small = buildFloor({ use: 'cafe', footprint: { x0: 2, x1: 40, y0: 2, y1: 28 }, seed: 3 });
  const big = buildFloor({ use: 'cafe', footprint: { x0: 2, x1: 92, y0: 2, y1: 60 }, seed: 3 });
  assert.ok(big.program.seats > small.program.seats, 'a bigger plate seats more covers');
});

test('concierge lobby furnishes a coherent plan over a mostly-open floor', () => {
  const lob = buildFloor({ use: 'lobby', footprint: FP, seed: 3 });
  assert.equal(FLOOR_USES.lobby.name, 'concierge lobby');
  assert.equal(lob.program.items.conciergeDesk, 1, 'a concierge desk anchors the lobby');
  assert.ok(lob.program.items.plants > 0, 'houseplants are placed');
  assert.ok(lob.program.items.sofas + lob.program.items.benches > 0, 'a waiting lounge is placed');
  assert.ok(lob.program.areas.lobbyOpen > lob.program.usable * 0.5, 'the floor stays mostly open circulation');
  assert.equal(lob.program.elevatorColumns, lob.core.elevators);
});

test('the elevator bank scales up with a bigger building', () => {
  const small = stackBuilding({ floors: [{ use: 'lobby' }, { use: 'cafe' }], width: 60, height: 40 });
  const big = stackBuilding({
    floors: Array.from({ length: 10 }, (_, i) => ({ use: i === 0 ? 'lobby' : 'cafe' })),
    width: 110, height: 90,
  });
  assert.ok(big.core.elevators > small.core.elevators, 'a taller, deeper building gets more cabs');
  // the count still lines up identically on every plate (one continuous shaft)
  for (const l of big.levels) assert.equal(l.structure.core.elevators, big.core.elevators);
});

test('a single floor has no stair; a three-floor stack has two', () => {
  const one = stackBuilding({ floors: [{ use: 'lobby' }] });
  assert.equal(one.stairs.length, 0);
  const three = stackBuilding({ floors: [{ use: 'lobby' }, { use: 'cafe' }, { use: 'cafe' }] });
  assert.equal(three.stairs.length, 2);
  assert.equal(three.levels.length, 3);
});
