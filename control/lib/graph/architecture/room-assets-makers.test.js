/**
 * The pieces that make a room (room-realism.plan.md, phase 2).
 *
 * Every maker builds a workbench manifest that plans to faces and sits on the
 * grid; the registry resolves the new ids and aliases WITHOUT claiming the bare
 * arranger type names (so a feet-mode plan keeps its box-nets); share mode
 * attaches the meshes and the planner now carries `asset` through to the
 * renderer; a rotated layout stamps the facing an unfaced asset needs.
 */
import { describe, expect, it } from 'vitest';

import { planWorkbench } from '../worlds/workbench.js';
import { ROOM_FURNITURE_ASSETS, getRoomFurnitureAsset, roomFurnitureAssetFaces } from './room-assets.js';
import * as M from './room-assets-makers.js';
import { furnishElements, orientElementsToDoor, SHARE_ASSETS } from '../polygonizer/floorplan-glyphs.js';
import { resolveRoomSceneElementPlan } from '../polygonizer/room-scene-elements.js';

const floorElement = (w, d, h, extra = {}) => ({
  ...extra,
  heightManji: {
    basePlane: { corners: [[-w / 2, -d / 2, 0], [w / 2, -d / 2, 0], [w / 2, d / 2, 0], [-w / 2, d / 2, 0]] },
    heightWorld: h,
  },
});

const MAKERS = {
  'club-armchair': [M.buildClubArmchairWorkbenchManifest, { w: 3.2, d: 3.2, h: 2.6 }],
  'coffee-table': [M.buildCoffeeTableWorkbenchManifest, { w: 4.5, d: 2.4, h: 1.4 }],
  'media-console': [M.buildMediaConsoleWorkbenchManifest, { w: 7, d: 1.8, h: 2.2 }],
  bookcase: [M.buildBookcaseWorkbenchManifest, { w: 3.5, d: 1.3, h: 6 }],
  'platform-bed': [M.buildPlatformBedWorkbenchManifest, { w: 6, d: 7, h: 1.8 }],
  'bedside-table': [M.buildNightstandWorkbenchManifest, { w: 2, d: 1.7, h: 2.2 }],
  'low-dresser': [M.buildLowDresserWorkbenchManifest, { w: 5.5, d: 1.9, h: 3.2 }],
  'sideboard-cabinet': [M.buildSideboardWorkbenchManifest, { w: 6.5, d: 1.9, h: 3 }],
  'plank-dining-table': [M.buildDiningTableWorkbenchManifest, { w: 7, d: 3.8, h: 2.4 }],
  'bordered-rug': [M.buildBorderedRugWorkbenchManifest, { w: 10, d: 7, h: 0.06 }],
};

describe('room-assets-makers', () => {
  it('every maker plans to faces, seated on the grid, at any footprint the room hands over', () => {
    for (const [id, [build, dims]] of Object.entries(MAKERS)) {
      for (const scale of [dims, { w: dims.w * 0.6, d: dims.d * 0.6, h: dims.h * 0.8 }, { w: dims.w * 1.4, d: dims.d * 1.3, h: dims.h }]) {
        const manifest = build(scale);
        expect(manifest.kind).toBe('workbench');
        const { stats } = planWorkbench(manifest);
        expect(stats.faces, `${id} faces`).toBeGreaterThan(0);
        expect(stats.warnings, `${id} should sit on the grid`).toBeUndefined();
      }
    }
  });

  it('is deterministic — the same dims give the same manifest (the bookcase hashes its books)', () => {
    for (const [build, dims] of Object.values(MAKERS)) {
      expect(JSON.stringify(build(dims))).toBe(JSON.stringify(build(dims)));
    }
    const a = M.buildBookcaseWorkbenchManifest({ w: 3, d: 1.2, h: 6 });
    const b = M.buildBookcaseWorkbenchManifest({ w: 3, d: 1.2, h: 7.5 });
    expect(a.extrudes.length).toBeGreaterThan(20);              // shelves + books, not a box
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('every part stays inside its footprint in x/y and on or above the floor', () => {
    for (const [id, [build, dims]] of Object.entries(MAKERS)) {
      const m = build(dims);
      const parts = [...(m.extrudes || []), ...(m.lathes || [])];
      for (const p of parts) {
        for (const a of [p.axisFrom, p.axisTo]) {
          expect(Math.abs(a.x), `${id} x`).toBeLessThanOrEqual(dims.w * 0.56 + 0.1);
          expect(Math.abs(a.y), `${id} y`).toBeLessThanOrEqual(dims.d * 0.56 + 0.1);
          expect(a.z, `${id} z`).toBeGreaterThanOrEqual(-1e-9);
        }
      }
    }
  });

  it('the bed keeps its headboard at the back (−y) and pillows at the head', () => {
    const m = M.buildPlatformBedWorkbenchManifest({ w: 6, d: 7, h: 1.8 });
    const tallest = m.extrudes.reduce((t, p) => (p.axisTo.z > t.axisTo.z ? p : t));
    expect(tallest.axisFrom.y).toBeLessThan(-3);               // headboard hugs the back edge
    const pillows = m.extrudes.filter((p) => p.tint === '#f4f1ea');
    expect(pillows.length).toBe(2);
    for (const p of pillows) expect(p.axisFrom.y).toBeLessThan(0);
  });
});

describe('registry wiring', () => {
  it('resolves the new ids and aliases, and never the bare arranger type names', () => {
    for (const id of Object.keys(MAKERS)) expect(getRoomFurnitureAsset(id)?.id).toBe(id);
    expect(getRoomFurnitureAsset('credenza')?.id).toBe('sideboard-cabinet');
    expect(getRoomFurnitureAsset('chest-of-drawers')?.id).toBe('low-dresser');
    expect(getRoomFurnitureAsset('area-rug')?.id).toBe('bordered-rug');
    for (const type of ['armchair', 'table', 'media-unit', 'bookshelf', 'rug', 'bed', 'nightstand', 'dresser', 'sideboard', 'dining-table', 'ladder-chair']) {
      expect(getRoomFurnitureAsset(type), `${type} must stay a box-net in feet mode`).toBeNull();
    }
  });

  it('every maker is registered local and builds from the footprint; the rug casts no contact shadow', () => {
    for (const id of Object.keys(MAKERS)) {
      const asset = ROOM_FURNITURE_ASSETS[id];
      expect(asset.local).toBe(true);
      const hit = roomFurnitureAssetFaces(floorElement(4, 2, 2, { asset: id }));
      expect(hit?.asset.id).toBe(id);
      expect(hit.faces.length).toBeGreaterThan(0);
      expect(hit.faces.every((f) => f.group === `asset:${id}`)).toBe(true);
      if (id === 'bordered-rug') expect(hit.contactFootprint).toBeNull();
      else expect(hit.contactFootprint?.height).toBe(2);
    }
  });

  it('share mode attaches the meshes; feet mode does not', () => {
    const share = furnishElements('L', 7, { w: 19.2, h: 23.2, scale: 'share' });
    const feet = furnishElements('L', 7, { w: 19.2, h: 23.2, scale: 'feet' });
    for (const e of share) if (SHARE_ASSETS[e.type]) expect(e.asset).toBe(SHARE_ASSETS[e.type]);
    for (const e of feet) if (e.type !== 'sofa') expect(e.asset).toBeUndefined();
    expect(feet.find((e) => e.type === 'sofa').asset).toBe('modern-couch');   // authored since day one
  });

  it('the planner carries `asset` through to the resolved element (the fix that lets meshes dispatch)', () => {
    const basis = { worldExtent: { width: 19.2, depth: 23.2, height: 10 }, xRange: [0, 19.2], yRange: [0, 23.2], zRange: [0, 10] };
    const plan = resolveRoomSceneElementPlan({ elements: furnishElements('L', 7, { w: 19.2, h: 23.2, scale: 'share' }), roomBasis: basis });
    const armchair = plan.elements.find((e) => e.type === 'armchair');
    expect(armchair.asset).toBe('club-armchair');
    expect(roomFurnitureAssetFaces(armchair)?.asset.id).toBe('club-armchair');
    expect(plan.elements.find((e) => e.type === 'sofa').asset).toBe('modern-couch');
  });

  it('a rotated layout stamps the facing an unfaced asset needs, in share mode only', () => {
    const els = furnishElements('B', 7, { w: 19.2, h: 23.2, scale: 'share' });
    const north = orientElementsToDoor(els, 'N', 19.2, 23.2, { assetFacing: true });
    expect(north.find((e) => e.type === 'bed').facing).toBe('S');
    const plain = orientElementsToDoor(els, 'N', 19.2, 23.2);
    expect(plain.find((e) => e.type === 'bed').facing).toBeUndefined();
    const south = orientElementsToDoor(els, 'S', 19.2, 23.2, { assetFacing: true });
    expect(south.find((e) => e.type === 'bed').facing).toBeUndefined();
  });
});
