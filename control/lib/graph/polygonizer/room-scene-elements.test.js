import { describe, expect, it } from 'vitest';

import {
  projectRoomSceneElements,
  projectRoomHeightManjis,
  resolveRoomSceneElementPlan,
  resolveRoomSurfaces,
  roomSceneElementDiagnostics,
  walkRoomSceneElements,
} from './room-scene-elements.js';

const ROOM_BASIS = {
  worldExtent: { width: 16, depth: 12, height: 8 },
  xRange: [0, 16],
  yRange: [0, 12],
};

const CAMERA = {
  kind: 'two-point',
  viewBox: { width: 800, height: 600 },
  worldFraming: {
    cameraPosition: [18, 18, 7],
    lookAt: [8, 5, 2.2],
    horizontalFov: 62,
    pictureCenter: [400, 330],
  },
};

describe('room scene element planner', () => {
  it('resolves canonical room surfaces from world extents', () => {
    const surfaces = resolveRoomSurfaces(ROOM_BASIS);

    expect(surfaces.byId.get('floor')).toMatchObject({
      id: 'floor',
      width: 16,
      height: 12,
      area: 192,
    });
    expect(surfaces.byId.get('back')).toBe(surfaces.byId.get('backWall'));
    expect(surfaces.byId.get('rightWall')).toMatchObject({
      origin: [16, 0, 0],
      width: 12,
      height: 8,
    });
  });

  it('turns preset room elements into normalized surface bands and world quads', () => {
    const plan = resolveRoomSceneElementPlan({
      role: 'quiet-room',
      elements: [
        { id: 'morning-window', type: 'window', anchor: { u: 0.65, v: 0.62 } },
        { id: 'center-rug', type: 'rug', anchor: [0.5, 0.48] },
        { id: 'reading-chair', type: 'chair', surface: 'leftWall', anchor: [0.32, 0.28], areaShare: 0.04 },
      ],
    }, ROOM_BASIS);

    expect(plan.elements).toHaveLength(3);
    expect(plan.elements[0]).toMatchObject({
      id: 'morning-window',
      surface: 'backWall',
      motif: 'window-light',
      provenance: { kind: 'roomSceneElement', surface: 'backWall' },
    });
    expect(plan.elements[1].surface).toBe('floor');
    expect(plan.elements[1].worldArea).toBeCloseTo(0.18 * 192, 3);
    expect(plan.elements[2].worldCorners[0][0]).toBe(0);
    expect(plan.elements[2].worldCorners[0][2]).toBeGreaterThanOrEqual(0);
  });

  it('clamps element bands to their support surface instead of overflowing', () => {
    const plan = resolveRoomSceneElementPlan({
      elements: [
        { id: 'edge-picture', type: 'picture', surface: 'backWall', anchor: [0.98, 0.95], w: 0.25, h: 0.2 },
      ],
    }, ROOM_BASIS);

    const cell = plan.elements[0];
    expect(cell.uBand[1]).toBe(1);
    expect(cell.vBand[1]).toBe(1);
    expect(cell.uBand[0]).toBeCloseTo(0.75);
    expect(cell.vBand[0]).toBeCloseTo(0.8);
  });

  it('reports per-surface area budgets for downstream selection', () => {
    const plan = resolveRoomSceneElementPlan({
      elements: [
        { type: 'rug', areaShare: 0.2 },
        { type: 'table', areaShare: 0.05 },
        { type: 'window', areaShare: 0.1 },
      ],
    }, ROOM_BASIS);
    const diagnostics = roomSceneElementDiagnostics(plan);

    expect(diagnostics.elementsPlanned).toBe(3);
    expect(diagnostics.surfaceBudgets.floor).toMatchObject({ count: 2, areaShare: 0.25 });
    expect(diagnostics.surfaceBudgets.backWall).toMatchObject({ count: 1, areaShare: 0.1 });
    expect(diagnostics.warnings).toEqual([]);
  });

  it('projects each resolved element through the shared room camera', () => {
    const plan = resolveRoomSceneElementPlan({
      elements: [
        { id: 'window', type: 'window', anchor: [0.58, 0.6] },
        { id: 'rug', type: 'rug', anchor: [0.5, 0.55] },
      ],
      roomBasis: ROOM_BASIS,
    }, ROOM_BASIS);
    const projected = projectRoomSceneElements(plan, CAMERA);

    expect(projected).toHaveLength(2);
    for (const element of projected) {
      expect(element.projectedCorners).toHaveLength(4);
      for (const point of element.projectedCorners) {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
        expect(Number.isFinite(point.depthT)).toBe(true);
      }
    }
    expect(walkRoomSceneElements(plan)).toHaveLength(2);
  });

  it('pins height manjis with top planes and deterministic elevation supports', () => {
    const plan = resolveRoomSceneElementPlan({
      elements: [
        { id: 'work-table', type: 'table', anchor: [0.5, 0.5], areaShare: 0.05 },
        { id: 'flat-rug', type: 'rug', anchor: [0.5, 0.55], areaShare: 0.12 },
        { id: 'wall-window', type: 'window', anchor: [0.62, 0.58] },
      ],
    }, ROOM_BASIS);

    const table = plan.elements.find((element) => element.id === 'work-table');
    const rug = plan.elements.find((element) => element.id === 'flat-rug');
    const window = plan.elements.find((element) => element.id === 'wall-window');

    expect(table.heightManji).toMatchObject({
      kind: 'heightManji',
      planeRole: 'table-plane',
      supportPattern: 'four-corner',
      heightWorld: 0.76,
    });
    expect(table.heightManji.supports).toHaveLength(4);
    expect(table.heightManji.topPlane.corners[0][2]).toBeCloseTo(0.76);
    expect(rug.heightManji.supports).toHaveLength(0);
    expect(rug.heightManji.planeRole).toBe('floor-skin');
    expect(window.heightManji.supports).toHaveLength(0);
    expect(window.heightManji.basePlane.surface).toBe('backWall');
  });

  it('projects height manjis separately from surface footprint cells', () => {
    const plan = resolveRoomSceneElementPlan({
      elements: [
        { id: 'work-table', type: 'table', anchor: [0.5, 0.5], areaShare: 0.05 },
      ],
    }, ROOM_BASIS);
    const projected = projectRoomHeightManjis(plan, CAMERA);

    expect(projected).toHaveLength(1);
    expect(projected[0].projectedBasePlane).toHaveLength(4);
    expect(projected[0].projectedTopPlane).toHaveLength(4);
    expect(projected[0].projectedSupports).toHaveLength(4);
    for (const support of projected[0].projectedSupports) {
      expect(Number.isFinite(support.projectedBottom.x)).toBe(true);
      expect(Number.isFinite(support.projectedTop.y)).toBe(true);
    }
  });
});
