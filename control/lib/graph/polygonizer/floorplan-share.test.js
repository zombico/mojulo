/**
 * Share-based furniture sizing (room-realism.plan.md, phase 1).
 *
 * `furnishScale: 'share'` re-derives each arranged piece's size from its planner
 * preset share of the ACTUAL floor, clamped to a real-world band, and drops the
 * lowest-priority pieces when the packed area passes the archetype's packing
 * target. 'feet' (the default) is the legacy path — its pins live in
 * floorplan-furnish.char.test.js. The kitchen run stays in feet in every mode.
 */
import assert from 'node:assert';
import { createHash } from 'node:crypto';
import { test } from 'vitest';
import { furnishElements, makeSizer, FURNITURE_BANDS, FURNISH_PRIORITY } from './floorplan-glyphs.js';
import { ROOM_SCENE_ELEMENT_PRESETS } from './room-scene-elements.js';
import { structurizeFloorplan } from './floorplan-structure.js';

const SIZES = [[11.2, 11.2], [19.2, 23.2], [29.2, 29.2]];      // 12×12, 20×24, 30×30 interiors
const floorPieces = (els) => els.filter((e) => !e.surface || e.surface === 'floor');
const feet = (e, w, h) => [e.w * w, e.h * h];
const packed = (els, w, h) => floorPieces(els).filter((e) => e.type !== 'rug').reduce((s, e) => s + e.w * w * e.h * h, 0);

test('feet mode returns the arranger feet untouched; share mode is a different size only', () => {
  const sz = makeSizer({ w: 19.2, h: 23.2, scale: 'feet' });
  assert.deepEqual(sz('armchair', 2.5, 2.5), [2.5, 2.5]);
  assert.deepEqual(sz('nothing-banded', 1.1, 2.2), [1.1, 2.2]);
  for (const [w, h] of SIZES) {
    const a = furnishElements('L', 7, { w, h, scale: 'feet' });
    const b = furnishElements('L', 7, { w, h, scale: 'share' });
    const WALL = new Set(['media-unit', 'bookshelf', 'rack-shelf', 'bed', 'nightstand', 'sideboard', 'dresser']);   // may snap to a wall
    for (const e of b) {
      const tol = WALL.has(e.type) ? 0.25 : 0.08;
      const twin = a.find((x) => x.type === e.type && x.facing === e.facing && Math.abs(x.anchor[0] - e.anchor[0]) < tol);
      assert.ok(twin, `${e.type} keeps its arranger placement`);
    }
  }
});

test('every share-sized piece sits inside its band; unclamped pieces hit the preset share', () => {
  for (const glyph of ['L', 'B', 'D', 'O']) {
    for (const [w, h] of SIZES) {
      for (const e of floorPieces(furnishElements(glyph, 7, { w, h, scale: 'share' }))) {
        const band = FURNITURE_BANDS[e.type];
        if (!band) continue;
        const [fw, fd] = feet(e, w, h);
        const long = Math.max(fw, fd), short = Math.min(fw, fd);
        assert.ok(long >= band.long[0] - 1e-6 && long <= band.long[1] + 1e-6, `${glyph} ${w}×${h} ${e.type} long ${long}`);
        assert.ok(short >= band.short[0] - 1e-6 && short <= band.short[1] + 1e-6, `${glyph} ${w}×${h} ${e.type} short ${short}`);
        const atEdge = [band.long, band.short].some(([lo, hi]) => Math.abs(long - lo) < 1e-6 || Math.abs(long - hi) < 1e-6 || Math.abs(short - lo) < 1e-6 || Math.abs(short - hi) < 1e-6);
        const preset = ROOM_SCENE_ELEMENT_PRESETS[e.type];
        if (!atEdge && preset) {
          const share = (fw * fd) / (w * h);
          assert.ok(Math.abs(share - preset.areaShare) <= preset.areaShare * 0.2, `${glyph} ${w}×${h} ${e.type} share ${share.toFixed(3)} vs ${preset.areaShare}`);
        }
      }
    }
  }
});

test('pieces grow with the room and never shrink back', () => {
  for (const glyph of ['L', 'B', 'D', 'O']) {
    let prev = null;
    for (const [w, h] of SIZES) {
      const cur = new Map(floorPieces(furnishElements(glyph, 7, { w, h, scale: 'share' })).map((e) => [e.type + (e.facing || ''), feet(e, w, h)]));
      if (prev) for (const [k, [pw, pd]] of prev) { const c = cur.get(k); if (c) assert.ok(c[0] * c[1] >= pw * pd - 1e-6, `${glyph} ${k} monotone`); }
      prev = cur;
    }
  }
});

test('budget: a 12×12 lounge keeps both armchairs, a 9½×10 one drops bookshelf then a chair, never the sofa', () => {
  const twelve = furnishElements('L', 7, { w: 11.2, h: 11.2, scale: 'share' });
  assert.equal(twelve.filter((e) => e.type === 'armchair').length, 2);
  assert.ok(twelve.some((e) => e.type === 'sofa'));
  const small = furnishElements('L', 7, { w: 8.6, h: 9.4, scale: 'share' });
  assert.ok(!small.some((e) => e.type === 'bookshelf'), 'bookshelf is the first to go');
  assert.equal(small.filter((e) => e.type === 'armchair').length, 1, 'one chair survives');
  assert.ok(small.some((e) => e.type === 'sofa') && small.some((e) => e.type === 'table'), 'seating group survives');
  assert.ok(packed(small, 8.6, 9.4) / (8.6 * 9.4) <= 0.30 * 1.4 + 1e-6, 'packed within the slackened target');
  assert.equal(FURNISH_PRIORITY.L[0], 'sofa');
});

test('share mode keeps every footprint inside the room', () => {
  for (const glyph of ['L', 'B', 'D', 'O']) {
    for (const [w, h] of SIZES) {
      for (const e of floorPieces(furnishElements(glyph, 7, { w, h, scale: 'share' }))) {
        assert.ok(e.anchor[0] - e.w / 2 >= -1e-6 && e.anchor[0] + e.w / 2 <= 1 + 1e-6, `${glyph} ${e.type} u`);
        assert.ok(e.anchor[1] - e.h / 2 >= -1e-6 && e.anchor[1] + e.h / 2 <= 1 + 1e-6, `${glyph} ${e.type} v`);
      }
    }
  }
});

test('bedroom never gets a twin bed; the kitchen run is feet in every mode', () => {
  const [w, h] = [11.2, 11.2];
  const bed = furnishElements('B', 7, { w, h, scale: 'share' }).find((e) => e.type === 'bed');
  assert.ok(Math.min(bed.w * w, bed.h * h) >= 4.6, 'at least a full-size bed');
  assert.deepEqual(furnishElements('K', 7, { w: 14, h: 12, scale: 'share' }), furnishElements('K', 7, { w: 14, h: 12, scale: 'feet' }));
});

test('the knob: legacy default is feet; a one-cell furnished plan defaults to share; explicit wins', () => {
  const cell = { width: 24, height: 28, rooms: [{ x: 2, y: 2, w: 20, h: 24, glyph: 'L' }], doors: [{ x: 12, y: 26, room: 0, edge: 'S' }] };
  const sha = (s) => createHash('sha256').update(JSON.stringify(s.faces)).digest('hex');
  const shareFaces = sha(structurizeFloorplan(cell, { furnish: true }));
  const feetFaces = sha(structurizeFloorplan(cell, { furnish: true, furnishScale: 'feet' }));
  const explicit = sha(structurizeFloorplan(cell, { furnish: true, furnishScale: 'share' }));
  assert.equal(shareFaces, explicit, 'one-cell default is share');
  assert.notEqual(shareFaces, feetFaces, 'feet path is distinguishable');
  const two = { width: 30, height: 12, rooms: [{ x: 0, y: 0, w: 15, h: 12, glyph: 'L' }, { x: 15, y: 0, w: 15, h: 12, glyph: 'B' }], doors: [{ x: 15, y: 6, room: 1, edge: 'W' }] };
  assert.equal(sha(structurizeFloorplan(two, { furnish: true })), sha(structurizeFloorplan(two, { furnish: true, furnishScale: 'feet' })), 'multi-cell stays feet');
});

test('share mode snaps wall pieces to their wall; centre pieces stay put', () => {
  const [w, h] = [19.2, 23.2];
  const L = furnishElements('L', 7, { w, h, scale: 'share' });
  const media = L.find((e) => e.type === 'media-unit'), shelf = L.find((e) => e.type === 'bookshelf'), sofa = L.find((e) => e.type === 'sofa');
  assert.ok(Math.abs(media.anchor[1] - (media.h / 2 + 0.004)) < 1e-9, 'media unit touches the back wall');
  assert.ok(Math.abs(shelf.anchor[0] - (shelf.w / 2 + 0.004)) < 1e-9, 'bookcase touches the side wall');
  assert.ok(Math.abs(sofa.anchor[1] - 0.72) < 0.05, 'the sofa keeps its mid-room anchor');
  const B = furnishElements('B', 7, { w, h, scale: 'share' });
  const bed = B.find((e) => e.type === 'bed'), ns = B.find((e) => e.type === 'nightstand');
  assert.ok(Math.abs(bed.anchor[1] - (bed.h / 2 + 0.004)) < 1e-9, 'headboard against the back wall');
  assert.ok(Math.abs(ns.anchor[1] - (ns.h / 2 + 0.004)) < 1e-9, 'nightstand against the same wall');
  const feet = furnishElements('L', 7, { w, h, scale: 'feet' });
  assert.ok(Math.abs(feet.find((e) => e.type === 'media-unit').anchor[1] - 0.07) < 1e-9, 'feet mode never snaps');
});
