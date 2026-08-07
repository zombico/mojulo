import assert from 'node:assert';
import { test } from 'vitest';
import { furnishUnit, furnishApartment } from './condo-unit-fitout.js';

// a representative unit off an x-axis hall: 15ft wide, 23ft deep, WC in the a0/back corner
const unit = (alongCenter, seed = 1) => furnishUnit({
  axis: 'x', alongCenter, a0: alongCenter - 7.5, a1: alongCenter + 7.5,
  cInner: 6, cOuter: 29, wcSide: alongCenter - 7.5 + 5.5, wcFront: 23,
  baseZ: 0, height: 12, seed,
}, {});

const wellFormed = (faces) => faces.length > 0 && faces.every((f) => Array.isArray(f.corners) && f.corners.length === 4 && typeof f.fill === 'string');

test('a unit fit-out bakes well-formed faces with a chosen archetype', () => {
  const { faces, archetype } = unit(0);
  assert.ok(wellFormed(faces), 'furniture bakes to shaded quads');
  assert.ok(['studio', 'one-bed', 'loft'].includes(archetype), `got ${archetype}`);
});

test('deterministic: same position + seed ⇒ byte-identical fit-out', () => {
  const a = unit(12, 7), b = unit(12, 7);
  assert.equal(a.archetype, b.archetype);
  assert.equal(JSON.stringify(a.faces), JSON.stringify(b.faces));
});

test('fractal variety: neighbouring units differ (different archetypes across a run)', () => {
  const kinds = new Set();
  let differ = 0;
  let prev = null;
  for (let i = 0; i < 20; i += 1) {
    const u = unit(i * 15);          // units spaced down the hall
    kinds.add(u.archetype);
    if (prev && JSON.stringify(prev.faces) !== JSON.stringify(u.faces)) differ += 1;
    prev = u;
  }
  assert.ok(kinds.size >= 2, `expected varied archetypes, saw ${[...kinds].join(',')}`);
  assert.ok(differ >= 15, `expected most neighbours to differ, only ${differ}/19 did`);
});

test('shifting the scene seed re-rolls the whole concourse', () => {
  const a = unit(30, 1), b = unit(30, 999);
  // a different scene seed generally lands a different draw for the same position
  assert.notEqual(JSON.stringify(a.faces), JSON.stringify(b.faces));
});

test('a unit too small to furnish returns empty, not a throw', () => {
  const { faces } = furnishUnit({ axis: 'x', alongCenter: 0, a0: -1.5, a1: 1.5, cInner: 0, cOuter: 3, wcSide: 0, wcFront: 2, baseZ: 0, height: 12, seed: 1 }, {});
  assert.ok(Array.isArray(faces));
});

const apt = (bedrooms, len, axis = 'x', seed = 5) => (axis === 'x'
  ? furnishApartment({ rect: { x0: 0, x1: len, y0: 0, y1: 20 }, bedrooms, axis, entryCoord: 0, windowCoord: 20, baseZ: 0, height: 10, seed })
  : furnishApartment({ rect: { x0: 0, x1: 20, y0: 0, y1: len }, bedrooms, axis, entryCoord: 0, windowCoord: 20, baseZ: 0, height: 10, seed }));

test('furnishApartment lays a 1BR and a 2BR; the extra bedroom adds geometry', () => {
  const a1 = apt(1, 22), a2 = apt(2, 32);
  assert.equal(a1.kind, '1br');
  assert.equal(a2.kind, '2br');
  assert.ok(wellFormed(a1.faces) && wellFormed(a2.faces), 'both bake shaded quads');
  assert.ok(a2.faces.length > a1.faces.length, 'a 2BR has more geometry than a 1BR');
});

test('furnishApartment is deterministic and works on both hall orientations', () => {
  assert.equal(JSON.stringify(apt(2, 32).faces), JSON.stringify(apt(2, 32).faces));
  assert.ok(wellFormed(apt(2, 32, 'y').faces), 'a y-axis building also lays out');
});

test('furnishApartment on a too-small rect returns empty, not a throw', () => {
  const { faces } = apt(1, 10);
  assert.ok(Array.isArray(faces) && faces.length === 0);
});
