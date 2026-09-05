/**
 * One-cell furnished plan defaults (room-realism.plan.md, phase 0).
 *
 * "Make me a living room" is an explicit single furnished cell. Every wall is
 * envelope there, so the house-tuned opt-ins left it a windowless, doorless box
 * and silently dropped the authored door. A one-cell furnished plan now defaults
 * windows on, floor finish 'auto', and cuts its authored door as the entrance
 * (or auto-cuts one when none is authored). Explicit keys still win.
 */
import assert from 'node:assert';
import { test } from 'vitest';
import { structurizeFloorplan } from './floorplan-structure.js';

// the reference render: sk_lkypzdim4y (seed 7, 20×24 L, door on the south wall)
const ONE_CELL = {
  width: 24, height: 28,
  rooms: [{ x: 2, y: 2, w: 20, h: 24, glyph: 'L' }],
  doors: [{ x: 12, y: 26, room: 0, edge: 'S' }],
};
const openings = (s) => s.wallGraph.runs.flatMap((r) => r.openings.map((op) => ({ ...op, orientation: r.orientation, at: r.at })));
const doorsOf = (s) => openings(s).filter((op) => op.sill === 0);
const windowsOf = (s) => openings(s).filter((op) => op.sill > 0);
const floorSkin = (s) => s.faces.filter((f) => f.group === 'floor:skin');

test('one-cell furnished plan: authored envelope door is cut as the entrance', () => {
  const s = structurizeFloorplan(ONE_CELL, { furnish: true });
  const doors = doorsOf(s);
  assert.equal(doors.length, 1, 'exactly one door cut');
  assert.equal(doors[0].entry, true);
  assert.equal(doors[0].exterior, true);
  assert.equal(doors[0].orientation, 'h');
  assert.ok(Math.abs(doors[0].at - 26) < 0.01, 'on the authored south wall line');
  assert.ok(doors[0].a < 12 && doors[0].b > 12, 'centred on the authored x');
  // the promoted door rides in plan.doors for downstream passes; the input is untouched
  assert.equal(s.plan.doors[0].entry, true);
  assert.equal(ONE_CELL.doors[0].entry, undefined, 'input manifest not mutated');
});

test('one-cell furnished plan: windows default on, floor finish defaults to auto', () => {
  const s = structurizeFloorplan(ONE_CELL, { furnish: true });
  assert.ok(windowsOf(s).length >= 4, `perimeter windows on every wall (got ${windowsOf(s).length})`);
  assert.ok(floorSkin(s).length > 0, 'floorboards over the slab');
});

test('one-cell furnished plan with no authored door: an entry door is auto-cut', () => {
  const s = structurizeFloorplan({ ...ONE_CELL, doors: [] }, { furnish: true });
  assert.equal(doorsOf(s).length, 1);
  assert.ok(s.wallGraph.entryDoor, 'publishes the auto-cut entry record');
  assert.equal(s.wallGraph.entryDoor.entry, true);
});

test('explicit keys still win over the one-cell defaults', () => {
  const s = structurizeFloorplan(ONE_CELL, { furnish: true, windows: false, floorStyle: 'plain' });
  assert.equal(windowsOf(s).length, 0, 'windows:false respected');
  assert.equal(floorSkin(s).length, 0, "floorStyle:'plain' respected");
  const t = structurizeFloorplan({ ...ONE_CELL, doors: [{ ...ONE_CELL.doors[0], entry: false }] }, { furnish: true });
  assert.equal(doorsOf(t).length, 0, 'door with entry:false is left to the exterior-door rule');
  const u = structurizeFloorplan({ ...ONE_CELL, doors: [] }, { furnish: true, entryDoor: false });
  assert.equal(doorsOf(u).length, 0, 'entryDoor:false blocks the auto-cut');
});

test('one-cell defaults do not fire without furnish, nor on multi-cell or generated plans', () => {
  const bare = structurizeFloorplan(ONE_CELL, {});
  assert.equal(openings(bare).length, 0, 'unfurnished one-cell keeps the opt-in posture');
  assert.equal(floorSkin(bare).length, 0);
  const two = structurizeFloorplan({
    width: 30, height: 12,
    rooms: [{ x: 0, y: 0, w: 15, h: 12, glyph: 'L' }, { x: 15, y: 0, w: 15, h: 12, glyph: 'B' }],
    doors: [{ x: 15, y: 6, room: 1, edge: 'W' }],
  }, { furnish: true });
  assert.equal(windowsOf(two).length, 0, 'multi-cell explicit plan: no default windows');
  assert.equal(floorSkin(two).length, 0);
  const gen = structurizeFloorplan({ seed: 7, width: 46, height: 34 }, { furnish: true });
  assert.equal(windowsOf(gen).length, 0, 'generated plan: no default windows');
});

// ── phase 4: surfaces ─────────────────────────────────────────────────────────
import { assembleFloorWorldScene, assembleFloorplanScene } from './floorplan-structure.js';

test('one-cell surfaces: baseboard + painted walls on, plaster on the swath, explicit off wins', () => {
  // a baseboard course is the only vertical face spanning exactly floor → floor + 0.5
  const zs = (f) => f.corners.map((p) => p[2]);
  const isBaseboard = (f) => !f.group && Math.min(...zs(f)) === 0 && Math.abs(Math.max(...zs(f)) - 0.5) < 1e-9 && new Set(zs(f)).size === 2;
  const s = structurizeFloorplan(ONE_CELL, { furnish: true });
  const swaths = s.faces.filter((f) => f.material);
  assert.ok(swaths.length >= 4, `a painted swath per wall run (got ${swaths.length})`);
  assert.ok(swaths.every((f) => f.material.kind === 'plaster' && f.material.lit === false), 'plaster, keeping the room light');
  assert.ok(s.faces.filter(isBaseboard).length >= 4, 'a baseboard course per wall run');
  assert.ok(!s.faces.some((f) => f.group === 'shell:ceiling'), 'no ceiling in the CSS / still tier');
  const off = structurizeFloorplan(ONE_CELL, { furnish: true, wallDecor: false });
  assert.equal(off.faces.filter(isBaseboard).length + off.faces.filter((f) => f.material).length, 0, 'wallDecor:false opts out');
  const bare = structurizeFloorplan(ONE_CELL, { furnish: true, wallMaterial: null });
  assert.ok(bare.faces.filter(isBaseboard).length >= 4 && !bare.faces.some((f) => f.material), 'wallMaterial:null keeps paint, drops the material');
  const gen = structurizeFloorplan({ seed: 7, width: 46, height: 34 }, { furnish: true });
  assert.equal(gen.faces.filter(isBaseboard).length, 0, 'generated plans keep wallDecor opt-in');
});

test('one-cell ceiling: on in the walk tier, off in the still, explicit wins', () => {
  const m = { ...ONE_CELL, furnish: true, view: 'cutaway' };
  const world = assembleFloorWorldScene(m, { ...m });
  assert.ok(world.faces.some((f) => f.group === 'shell:ceiling'), 'walk tier ceiling');
  const still = assembleFloorplanScene(m, { ...m });
  assert.ok(!still.faces.some((f) => f.group === 'shell:ceiling'), 'still tier open');
  const explicit = assembleFloorWorldScene(m, { ...m, ceilings: false });
  assert.ok(!explicit.faces.some((f) => f.group === 'shell:ceiling'), 'ceilings:false wins in the walk tier');
});

test('one-cell floor carries the oak tile into the World and its exports; explicit null opts out; houses untouched', () => {
  const s = structurizeFloorplan(ONE_CELL, { furnish: true });
  const base = s.faces.find((f) => f.group === 'floor:skin' && f.texture);
  assert.ok(base, 'the floor base plane is textured');
  assert.equal(base.texture, 'wood-oak');
  assert.equal(base.textureLit, true);
  assert.equal(base.uv.length, 4);
  assert.ok(base.uv.every(([u, v]) => Number.isFinite(u) && Number.isFinite(v)));
  const m = { ...ONE_CELL, furnish: true, view: 'cutaway' };
  const world = assembleFloorWorldScene(m, { ...m });
  assert.ok(typeof world.textures['wood-oak'] === 'string' && world.textures['wood-oak'].startsWith('data:image/png'), 'the tile rides in the payload textures');
  const bare = structurizeFloorplan(ONE_CELL, { furnish: true, floorTexture: null });
  assert.ok(!bare.faces.some((f) => f.texture), 'floorTexture:null keeps the flat finish');
  const marble = structurizeFloorplan(ONE_CELL, { furnish: true, floorStyle: 'marble' });
  assert.equal(marble.faces.find((f) => f.group === 'floor:skin' && f.texture).texture, 'marble-carrara');
  const house = structurizeFloorplan({ seed: 7, width: 46, height: 34 }, { furnish: true, floorStyle: 'auto' });
  assert.ok(!house.faces.some((f) => f.texture), 'generated plans keep floorTexture opt-in');
});
