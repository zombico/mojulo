import assert from 'node:assert';
import { test } from 'vitest';
import { buildRestaurant } from './floorplan-restaurant.js';

const hasFaces = (faces) => Array.isArray(faces) && faces.length > 0
  && faces.every((f) => Array.isArray(f.corners) && f.corners.length === 4 && typeof f.fill === 'string');

test('a restaurant is one ground floor: dining in front, kitchen + restrooms across the back', () => {
  const r = buildRestaurant({ width: 48, height: 64, seed: 5 });
  assert.ok(hasFaces(r.faces));
  assert.equal(r.baseZ, 0);                              // ground level
  const { dining, kitchen, restroom } = r.rooms;
  // kitchen + restroom sit behind the dining room (greater y)
  assert.ok(kitchen.y >= dining.y + dining.h - 1e-6, 'kitchen is behind the dining room');
  assert.ok(restroom.y >= dining.y + dining.h - 1e-6, 'restrooms are behind the dining room');
  // the three cells tile the footprint width across the back
  assert.ok(Math.abs((kitchen.w + restroom.w) - dining.w) < 1e-6, 'kitchen + restroom span the dining width');
});

test('the kitchen gets real reserved floor area', () => {
  const r = buildRestaurant({ width: 48, height: 64, seed: 5 });
  const k = r.rooms.kitchen;
  assert.ok(k.w * k.h > 200, 'kitchen has a substantial reserved footprint');
});

test('the dining room spends its surface-area budget on seating that scales with size', () => {
  const small = buildRestaurant({ width: 36, height: 48, seed: 5 });
  const big = buildRestaurant({ width: 60, height: 84, seed: 5 });
  assert.ok(small.program.seats > 0);
  assert.ok(big.program.seats > small.program.seats, 'a bigger dining room seats more covers');
  const a = small.program.areas;
  assert.ok(Math.abs((a.bar + a.counter + a.seating + a.circulation) - small.program.usable) < 1e-6, 'budget sums to the usable dining area');
});

test('kitchen depth is configurable', () => {
  const shallow = buildRestaurant({ width: 48, height: 64, kitchenDepth: 12, seed: 1 });
  const deep = buildRestaurant({ width: 48, height: 64, kitchenDepth: 22, seed: 1 });
  assert.ok(deep.rooms.kitchen.h > shallow.rooms.kitchen.h, 'a deeper kitchen reserves more back-of-house');
  assert.ok(deep.rooms.dining.h < shallow.rooms.dining.h, '...at the dining room\'s expense');
});
