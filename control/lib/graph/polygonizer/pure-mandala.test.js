/**
 * Tests for the meru-standardized element mandala unit scale.
 *
 * Covers:
 *   - resolveMeruUnitScale: declared > sceneExtent > viewBox default.
 *   - withGeneratedElementMandala: every element shares the same
 *     unitScale; per-element camera.unitScale overrides are ignored.
 *   - worldBudget = bounds / meruUnitScale is attached per element.
 *   - Identical local sizes in two elements with different bounds
 *     render at identical pixel sizes (the whole point of the change).
 *   - collectElementMandalaOverflows: declared-claim overflow + mark
 *     overflow on xyz/sizeXYZ.
 *   - validateElementMandalaOverflows: 'allow' (default), 'attribute',
 *     'reject' policies.
 *   - validateMetamandalaUnitScale: positive number, sceneExtent
 *     consistency, boundaryPolicy enum.
 */

import { describe, it, expect } from 'vitest';

import {
  MERU_UNIT_SCALE_DEFAULT_WORLD_SPAN,
  collectElementMandalaOverflows,
  projectMandalaPoint,
  projectTwoPoint,
  projectTwoPointLerpBlend,
  projectTwoPointPinhole,
  resolveCameraBasis,
  resolveCameraPrimitiveWorld,
  resolveMeruUnitScale,
  resolveRoomBasisWorld,
  validateCameraWorldFraming,
  validateElementMandalaOverflows,
  validateMetamandalaUnitScale,
  validateProjectTwoPointPinhole,
  withGeneratedElementMandala,
  withResolvedWorldCamera,
} from './pure-mandala.js';
import {
  validateConstellationGrid,
  withConstellationGrid,
  withResolvedChildRegionsWorld,
} from './constellation.js';

function twoElementManifest({ meru, mandalaA, mandalaB, marks = [] } = {}) {
  return {
    viewBox: { width: 720, height: 480 },
    polygonizer: {
      ...(meru ? { metamandala: meru } : {}),
      elements: [
        { role: 'tabletop', importance: 'primary', mandala: mandalaA || { width: 8, length: 6 } },
        { role: 'shelf',    importance: 'primary', mandala: mandalaB || { width: 4, length: 3 } },
      ],
      constellation: {
        kind: 'cca-constellation-grid',
        nodes: [
          {
            role: 'tabletop',
            anchor: [180, 240],
            bounds: { x: 60, y: 160, width: 240, height: 160 },
            cca: { lengthAxis: 'E-W', heightAxis: 'Zenith-Nadir' },
          },
          {
            role: 'shelf',
            anchor: [540, 240],
            bounds: { x: 420, y: 200, width: 120, height: 80 },
            cca: { lengthAxis: 'E-W', heightAxis: 'Zenith-Nadir' },
          },
        ],
      },
    },
    marks,
  };
}

describe('resolveMeruUnitScale — the scene-wide ruler', () => {
  it('uses viewBox.width / 36 as the back-compat default', () => {
    const manifest = { viewBox: { width: 720, height: 480 } };
    expect(resolveMeruUnitScale(manifest)).toBeCloseTo(720 / MERU_UNIT_SCALE_DEFAULT_WORLD_SPAN, 6);
  });

  it('honors an explicit metamandala.unitScale declaration', () => {
    const manifest = {
      viewBox: { width: 720, height: 480 },
      polygonizer: { metamandala: { unitScale: 30 } },
    };
    expect(resolveMeruUnitScale(manifest)).toBe(30);
  });

  it('derives from sceneExtent.width when unitScale is not declared', () => {
    const manifest = {
      viewBox: { width: 720, height: 480 },
      polygonizer: { metamandala: { sceneExtent: { width: 24 } } },
    };
    expect(resolveMeruUnitScale(manifest)).toBe(30);
  });

  it('accepts the future-facing "meru" alias', () => {
    const manifest = {
      viewBox: { width: 720, height: 480 },
      polygonizer: { meru: { unitScale: 18 } },
    };
    expect(resolveMeruUnitScale(manifest)).toBe(18);
  });
});

describe('withGeneratedElementMandala — shared meru unit scale', () => {
  it('attaches the same unitScale to every element mandala', () => {
    const manifest = withGeneratedElementMandala(
      twoElementManifest({ meru: { unitScale: 20 } }),
    );
    const elements = manifest.polygonizer.elementMandala.elements;
    expect(elements).toHaveLength(2);
    expect(manifest.polygonizer.elementMandala.unitScale).toBe(20);
    expect(elements[0].topDown.camera.unitScale).toBe(20);
    expect(elements[1].topDown.camera.unitScale).toBe(20);
    expect(elements[0].topDown.camera.unitScaleSource).toBe('meru');
  });

  it('renders identical local sizes at identical pixel sizes across elements', () => {
    const manifest = withGeneratedElementMandala(
      twoElementManifest({ meru: { unitScale: 20 } }),
    );
    const [a, b] = manifest.polygonizer.elementMandala.elements;
    // Same local point in each element's frame → same pixel offset from origin.
    const aPoint = projectMandalaPoint(a.topDown, { x: 3, y: 0, z: 0 });
    const bPoint = projectMandalaPoint(b.topDown, { x: 3, y: 0, z: 0 });
    const aOffset = aPoint[0] - a.topDown.camera.screenOrigin[0];
    const bOffset = bPoint[0] - b.topDown.camera.screenOrigin[0];
    expect(aOffset).toBe(bOffset);
    expect(aOffset).toBe(60); // 3 world units × 20 px/unit
  });

  it('attaches worldBudget = bounds / unitScale per element', () => {
    const manifest = withGeneratedElementMandala(
      twoElementManifest({ meru: { unitScale: 20 } }),
    );
    const [a, b] = manifest.polygonizer.elementMandala.elements;
    expect(a.worldBudget).toEqual({ width: 12, length: 8 });   // 240/20, 160/20
    expect(b.worldBudget).toEqual({ width: 6, length: 4 });    // 120/20, 80/20
  });

  it('records claimOverflow when declared mandala extent exceeds the budget', () => {
    // shelf bounds afford 6 × 4 world units, but it claims a 10 × 8 mandala
    const manifest = withGeneratedElementMandala(
      twoElementManifest({
        meru: { unitScale: 20 },
        mandalaB: { width: 10, length: 8 },
      }),
    );
    const shelf = manifest.polygonizer.elementMandala.elements[1];
    expect(shelf.claimOverflow).toEqual({
      widthUnits: 4,
      lengthUnits: 4,
      axis: 'width',
    });
  });

  it('ignores per-element camera.unitScale overrides and surfaces them on the elementMandala', () => {
    const baseManifest = twoElementManifest({ meru: { unitScale: 20 } });
    baseManifest.polygonizer.elements[0].mandala = {
      width: 8, length: 6, camera: { unitScale: 99 },
    };
    const manifest = withGeneratedElementMandala(baseManifest);
    const [a] = manifest.polygonizer.elementMandala.elements;
    expect(a.topDown.camera.unitScale).toBe(20);
    expect(manifest.polygonizer.elementMandala.ignoredCameraUnitScales).toEqual([
      { role: 'tabletop', declared: 99 },
    ]);
  });
});

describe('collectElementMandalaOverflows', () => {
  it('reports declared-mandala-claim overflows from withGeneratedElementMandala', () => {
    const manifest = withGeneratedElementMandala(
      twoElementManifest({
        meru: { unitScale: 20 },
        mandalaB: { width: 10, length: 8 },
      }),
    );
    const overflows = collectElementMandalaOverflows(manifest);
    expect(overflows).toContainEqual(expect.objectContaining({
      kind: 'declared-mandala-claim',
      elementRole: 'shelf',
      axis: 'x',
      overflowUnits: 4,
    }));
  });

  it('reports mark overflow when xyz + sizeXYZ exceeds the budget', () => {
    // tabletop budget: 12 × 8. A mark at xyz=(4, 0, 0) of size 6×2×2
    // reaches xMax = 4 + 3 = 7, but budget half-width is 6 → overflow of 1.
    const manifest = withGeneratedElementMandala(
      twoElementManifest({
        meru: { unitScale: 20 },
        marks: [
          {
            kind: 'solid',
            role: 'plate',
            mandalaRole: 'tabletop',
            xyz: [4, 0, 0],
            sizeXYZ: [6, 2, 2],
          },
        ],
      }),
    );
    const overflows = collectElementMandalaOverflows(manifest);
    const markOverflow = overflows.find((o) => o.kind === 'mark-overflow');
    expect(markOverflow).toBeDefined();
    expect(markOverflow.elementRole).toBe('tabletop');
    expect(markOverflow.axis).toBe('x');
    expect(markOverflow.overflowUnits).toBe(1);
    expect(markOverflow.intoBudget).toEqual({ width: 12, length: 8 });
  });
});

describe('validateElementMandalaOverflows — boundaryPolicy', () => {
  function withOverflow(policy) {
    const base = twoElementManifest({
      meru: { unitScale: 20, ...(policy ? { boundaryPolicy: policy } : {}) },
      mandalaB: { width: 10, length: 8 },
    });
    return withGeneratedElementMandala(base);
  }

  it('returns zero errors under the default "allow" policy', () => {
    const report = validateElementMandalaOverflows(withOverflow());
    expect(report.errors).toEqual([]);
    expect(report.policy).toBe('allow');
    expect(report.overflows.length).toBeGreaterThan(0);
  });

  it('still returns zero errors under "attribute" but surfaces overflows for meru consumers', () => {
    const report = validateElementMandalaOverflows(withOverflow('attribute'));
    expect(report.errors).toEqual([]);
    expect(report.policy).toBe('attribute');
    expect(report.overflows.length).toBeGreaterThan(0);
  });

  it('returns mint errors under "reject"', () => {
    const report = validateElementMandalaOverflows(withOverflow('reject'));
    expect(report.policy).toBe('reject');
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors[0]).toContain("exceeds budget");
  });
});

describe('withResolvedChildRegionsWorld — meru-seeded parent → child carving', () => {
  function bookcaseManifest({ childRegionWorld } = {}) {
    return {
      viewBox: { width: 720, height: 480 },
      polygonizer: {
        metamandala: { unitScale: 20 },
        elements: [
          { role: 'bookcase', importance: 'primary', mandala: { width: 12, length: 1 } },
          { role: 'shelf-1', importance: 'secondary', mandala: { width: 11, length: 1 } },
        ],
        constellation: {
          kind: 'cca-constellation-grid',
          nodes: [
            {
              role: 'bookcase',
              anchor: [180, 200],
              bounds: { x: 60, y: 80, width: 240, height: 240 },
              cca: { lengthAxis: 'E-W', heightAxis: 'Zenith-Nadir' },
              ...(childRegionWorld ? { childRegionWorld } : {}),
            },
            {
              role: 'shelf-1',
              parent: 'bookcase',
              anchor: [180, 200],
              bounds: { x: 80, y: 160, width: 200, height: 40 },
              cca: { lengthAxis: 'E-W', heightAxis: 'Zenith-Nadir' },
            },
          ],
        },
      },
      marks: [],
    };
  }

  it('passes through nodes without childRegionWorld', () => {
    const manifest = bookcaseManifest();
    const resolved = withResolvedChildRegionsWorld(manifest);
    expect(resolved).toBe(manifest); // identity when nothing to resolve
  });

  it('resolves childRegionWorld into pixel childRegion via the shared unitScale', () => {
    const manifest = bookcaseManifest({ childRegionWorld: { width: 10, length: 6 } });
    const resolved = withResolvedChildRegionsWorld(manifest);
    const bookcase = resolved.polygonizer.constellation.nodes.find((n) => n.role === 'bookcase');
    expect(bookcase.childRegionSource).toBe('meru-world');
    // bookcase center: x = 180, y = 200. width = 10 × 20 = 200, length = 6 × 20 = 120.
    expect(bookcase.childRegion).toEqual({ x: 80, y: 140, width: 200, height: 120 });
  });

  it('honors offsetX / offsetY in world units', () => {
    const manifest = bookcaseManifest({
      childRegionWorld: { width: 4, length: 4, offsetX: 2, offsetY: -1 },
    });
    const resolved = withResolvedChildRegionsWorld(manifest);
    const bookcase = resolved.polygonizer.constellation.nodes.find((n) => n.role === 'bookcase');
    // center shifted by (2, -1) world units = (40, -20) px from bounds center (180, 200) → (220, 180).
    // childRegion is width × length = 80 × 80, centered at (220, 180) → x=180, y=140.
    expect(bookcase.childRegion).toEqual({ x: 180, y: 140, width: 80, height: 80 });
  });

  it('keeps a pre-existing pixel childRegion for audit when the world declaration wins', () => {
    const manifest = bookcaseManifest({ childRegionWorld: { width: 10, length: 6 } });
    manifest.polygonizer.constellation.nodes[0].childRegion = { x: 999, y: 999, width: 1, height: 1 };
    const resolved = withResolvedChildRegionsWorld(manifest);
    const bookcase = resolved.polygonizer.constellation.nodes.find((n) => n.role === 'bookcase');
    expect(bookcase.childRegionSource).toBe('meru-world');
    expect(bookcase.childRegionPixelDeclared).toEqual({ x: 999, y: 999, width: 1, height: 1 });
    expect(bookcase.childRegion).not.toEqual({ x: 999, y: 999, width: 1, height: 1 });
  });

  it('is composed inside withConstellationGrid so the validator pipeline sees resolved childRegions', () => {
    const manifest = bookcaseManifest({ childRegionWorld: { width: 10, length: 6 } });
    const wired = withConstellationGrid(manifest);
    const bookcase = wired.polygonizer.constellation.nodes.find((n) => n.role === 'bookcase');
    expect(bookcase.childRegion).toEqual({ x: 80, y: 140, width: 200, height: 120 });
  });

  it('rejects malformed childRegionWorld via validateConstellationGrid', () => {
    const manifest = bookcaseManifest({ childRegionWorld: { width: -2, length: 6 } });
    const errors = validateConstellationGrid(manifest);
    expect(errors.some((e) => e.includes('childRegionWorld.width must be a positive number'))).toBe(true);
  });
});

describe('resolveRoomBasisWorld — meru-aligned room dimensions', () => {
  it('passes through when no worldExtent is declared', () => {
    const manifest = { viewBox: { width: 720 } };
    const basis = { xRange: [-18, 18], yRange: [-28, 8] };
    expect(resolveRoomBasisWorld(manifest, basis)).toBe(basis);
  });

  it('derives xRange/yRange/verticalUnit from worldExtent at the meru ruler', () => {
    const manifest = {
      viewBox: { width: 720, height: 480 },
      polygonizer: { metamandala: { unitScale: 30 } },
    };
    const basis = { worldExtent: { width: 16, depth: 12, height: 8 } };
    const resolved = resolveRoomBasisWorld(manifest, basis);
    expect(resolved.xRange).toEqual([0, 16]);
    expect(resolved.yRange).toEqual([0, 12]);
    expect(resolved.frontY).toBe(12);
    expect(resolved.backY).toBe(0);
    expect(resolved.verticalUnit).toBe(30);
    expect(resolved.worldExtentSource).toBe('meru');
  });

  it('reads worldExtent from meru.roomExtent as a fallback', () => {
    const manifest = {
      viewBox: { width: 720 },
      polygonizer: { metamandala: { unitScale: 20, roomExtent: { width: 16, depth: 12 } } },
    };
    const resolved = resolveRoomBasisWorld(manifest, {});
    expect(resolved.xRange).toEqual([0, 16]);
    expect(resolved.yRange).toEqual([0, 12]);
    expect(resolved.verticalUnit).toBe(20);
  });

  it('lets explicit pixel fields override the world-derived defaults', () => {
    const manifest = {
      viewBox: { width: 720 },
      polygonizer: { metamandala: { unitScale: 30 } },
    };
    const basis = {
      worldExtent: { width: 16, depth: 12 },
      depthReach: 0.62,
      frontLeft: [123, 456],
    };
    const resolved = resolveRoomBasisWorld(manifest, basis);
    expect(resolved.depthReach).toBe(0.62);
    expect(resolved.frontLeft).toEqual([123, 456]);
    expect(resolved.xRange).toEqual([0, 16]);
  });
});

describe('resolveCameraPrimitiveWorld — world-coord vanishing points', () => {
  function manifestAt(viewBox = { width: 800, height: 600 }) {
    return { viewBox };
  }

  it('passes through when no worldFraming is declared', () => {
    const camera = { kind: 'two-point', vanishingPoints: { left: [-200, 300], right: [1000, 300] } };
    expect(resolveCameraPrimitiveWorld(manifestAt(), camera)).toBe(camera);
  });

  it('puts both VPs on the horizon line at viewBox.height / 2 for a horizontal look', () => {
    const camera = {
      kind: 'two-point',
      worldFraming: {
        cameraPosition: [-5, 18, 5.5],
        lookAt: [8, 6, 5.5],
        horizontalFov: 60,
      },
    };
    const resolved = resolveCameraPrimitiveWorld(manifestAt({ width: 800, height: 600 }), camera);
    expect(resolved.worldFramingResolved).toBe(true);
    expect(resolved.horizonY).toBe(300);
    expect(resolved.vanishingPoints.left[1]).toBe(300);
    expect(resolved.vanishingPoints.right[1]).toBe(300);
  });

  it('orders VPs so vanishingPoints.left is left of vanishingPoints.right', () => {
    const camera = {
      kind: 'two-point',
      worldFraming: { cameraPosition: [8, 16, 5.5], lookAt: [8, 6, 5.5] },
    };
    const resolved = resolveCameraPrimitiveWorld(manifestAt(), camera);
    expect(resolved.vanishingPoints.left[0]).toBeLessThanOrEqual(resolved.vanishingPoints.right[0]);
  });

  it('shifts horizonY toward the top of the screen when the camera looks downward', () => {
    // Looking down: the horizon line on the picture moves UP (toward
    // smaller screen y) because the visible horizon recedes off the top
    // of the field of view, and what fills the picture is the floor.
    const horizontal = resolveCameraPrimitiveWorld(manifestAt(), {
      kind: 'two-point',
      worldFraming: { cameraPosition: [-5, 18, 5.5], lookAt: [8, 6, 5.5] },
    });
    const lookingDown = resolveCameraPrimitiveWorld(manifestAt(), {
      kind: 'two-point',
      worldFraming: { cameraPosition: [-5, 18, 8], lookAt: [8, 6, 1] },
    });
    expect(lookingDown.horizonY).toBeLessThan(horizontal.horizonY);
  });

  it('honors explicit vanishingPoints over world-derived defaults', () => {
    const camera = {
      kind: 'two-point',
      vanishingPoints: { left: [-100, 250], right: [900, 250] },
      worldFraming: { cameraPosition: [-5, 18, 5.5], lookAt: [8, 6, 5.5] },
    };
    const resolved = resolveCameraPrimitiveWorld(manifestAt(), camera);
    expect(resolved.vanishingPoints.left).toEqual([-100, 250]);
    expect(resolved.vanishingPoints.right).toEqual([900, 250]);
  });
});

describe('withResolvedWorldCamera — manifest-level integration', () => {
  it('attaches resolved vanishingPoints and roomBasis to the manifest cameraPrimitive', () => {
    const manifest = {
      viewBox: { width: 800, height: 600 },
      polygonizer: { metamandala: { unitScale: 30 } },
      cameraPrimitive: {
        kind: 'two-point',
        roomBasis: { worldExtent: { width: 16, depth: 12, height: 8 } },
        worldFraming: { cameraPosition: [-5, 18, 5.5], lookAt: [8, 6, 5.5], horizontalFov: 60 },
      },
    };
    const resolved = withResolvedWorldCamera(manifest);
    expect(resolved.cameraPrimitive.worldFramingResolved).toBe(true);
    expect(resolved.cameraPrimitive.roomBasis.xRange).toEqual([0, 16]);
    expect(resolved.cameraPrimitive.roomBasis.verticalUnit).toBe(30);
    expect(resolved.cameraPrimitive.roomBasis.frontLeft).toHaveLength(2);
    expect(resolved.cameraPrimitive.roomBasis.frontRight).toHaveLength(2);
    expect(resolved.cameraPrimitive.vanishingPoints.left[1]).toBe(300);
  });

  it('is idempotent', () => {
    const manifest = {
      viewBox: { width: 800, height: 600 },
      polygonizer: { metamandala: { unitScale: 30 } },
      cameraPrimitive: {
        kind: 'two-point',
        worldFraming: { cameraPosition: [-5, 18, 5.5], lookAt: [8, 6, 5.5] },
      },
    };
    const once = withResolvedWorldCamera(manifest);
    const twice = withResolvedWorldCamera(once);
    expect(twice).toBe(once);
  });

  it('round-trips through projectTwoPoint — a corner-view camera projects the room center inside the picture', () => {
    // Corner-view camera at the front-left, looking diagonally toward
    // the back-center. Picks vpLeft / vpRight on opposite sides so the
    // lerp-blend projection inside projectTwoPoint converges sensibly.
    const manifest = {
      viewBox: { width: 800, height: 600 },
      polygonizer: { metamandala: { unitScale: 30 } },
      cameraPrimitive: {
        kind: 'two-point',
        roomBasis: { worldExtent: { width: 16, depth: 12, height: 8 } },
        worldFraming: { cameraPosition: [-5, 17, 5.5], lookAt: [8, 6, 5.5], horizontalFov: 60 },
      },
    };
    const resolved = withResolvedWorldCamera(manifest);
    const camera = resolved.cameraPrimitive;
    const projected = projectTwoPoint([8, 6, 0], camera, camera.roomBasis);
    // The projected center-of-back-wall should land inside the picture
    // (0..800 horizontal, 0..600 vertical). The lerp-blend projection
    // doesn't give exact pinhole math; we just check it's on-canvas.
    expect(projected[0]).toBeGreaterThan(0);
    expect(projected[0]).toBeLessThan(800);
    expect(projected[1]).toBeGreaterThan(0);
    expect(projected[1]).toBeLessThan(600);
  });
});

describe('projectTwoPoint — pinhole worldFraming branch', () => {
  const roomBasis = {
    worldExtent: { width: 16, depth: 12, height: 8 },
    xRange: [0, 16],
    yRange: [0, 12],
    frontY: 12,
    backY: 0,
    verticalUnit: 30,
  };
  const camera = {
    kind: 'two-point',
    viewBox: { width: 800, height: 600 },
    worldFraming: {
      cameraPosition: [-7, 20, 5.5],
      lookAt: [8, 6, 4],
      horizontalFov: 80,
    },
  };

  it('resolves an orthonormal camera basis', () => {
    const basis = resolveCameraBasis(camera, roomBasis);
    expect(basis).toBeTruthy();
    const len = (v) => Math.hypot(v[0], v[1], v[2]);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(len(basis.forward)).toBeCloseTo(1, 6);
    expect(len(basis.right)).toBeCloseTo(1, 6);
    expect(len(basis.up)).toBeCloseTo(1, 6);
    expect(dot(basis.forward, basis.right)).toBeCloseTo(0, 6);
    expect(dot(basis.forward, basis.up)).toBeCloseTo(0, 6);
    expect(dot(basis.right, basis.up)).toBeCloseTo(0, 6);
  });

  it('projects the lookAt point to picture center', () => {
    const projected = projectTwoPointPinhole(camera.worldFraming.lookAt, camera, roomBasis);
    expect(projected[0]).toBeCloseTo(400, 3);
    expect(projected[1]).toBeCloseTo(300, 3);
  });

  it('keeps legacy cameras on the byte-identical lerp-blend path', () => {
    const legacyCamera = {
      kind: 'two-point',
      vanishingPoints: { left: [-200, 250], right: [1000, 250] },
      verticalAxis: [0, -1],
    };
    const legacyRoom = {
      xRange: [-18, 18],
      yRange: [-28, 8],
      frontLeft: [210, 510],
      depthReach: 0.46,
    };
    const point = [4, -12, 3];
    expect(projectTwoPoint(point, legacyCamera, legacyRoom))
      .toEqual(projectTwoPointLerpBlend(point, legacyCamera, legacyRoom));
  });

  it('contains all corners for a sensible eye-level room camera', () => {
    for (const x of [0, 16]) {
      for (const y of [0, 12]) {
        for (const z of [0, 8]) {
          const [px, py] = projectTwoPoint([x, y, z], camera, roomBasis);
          expect(px).toBeGreaterThanOrEqual(0);
          expect(px).toBeLessThanOrEqual(800);
          expect(py).toBeGreaterThanOrEqual(0);
          expect(py).toBeLessThanOrEqual(600);
        }
      }
    }
  });
});

describe('validateCameraWorldFraming', () => {
  it('passes when neither worldFraming nor worldExtent is declared', () => {
    expect(validateCameraWorldFraming({})).toEqual([]);
  });

  it('rejects negative worldExtent dimensions', () => {
    const errors = validateCameraWorldFraming({
      cameraPrimitive: { roomBasis: { worldExtent: { width: -1, depth: 12 } } },
    });
    expect(errors.some((e) => e.includes('worldExtent.width'))).toBe(true);
  });

  it('flags mismatches between meru.sceneExtent and roomBasis.worldExtent', () => {
    const errors = validateCameraWorldFraming({
      polygonizer: { metamandala: { sceneExtent: { width: 30 } } },
      cameraPrimitive: { roomBasis: { worldExtent: { width: 16, depth: 12 } } },
    });
    expect(errors.some((e) => e.includes('sceneExtent.width must agree with roomBasis.worldExtent.width'))).toBe(true);
  });

  it('rejects out-of-range horizontalFov', () => {
    const errors = validateCameraWorldFraming({
      cameraPrimitive: {
        worldFraming: { cameraPosition: [0, 0, 0], lookAt: [1, 1, 1], horizontalFov: 5 },
      },
    });
    expect(errors.some((e) => e.includes('horizontalFov'))).toBe(true);
  });

  it('rejects malformed cameraPosition / lookAt', () => {
    const errors = validateCameraWorldFraming({
      cameraPrimitive: { worldFraming: { cameraPosition: 'oops', lookAt: [1, 1, 1] } },
    });
    expect(errors.some((e) => e.includes('cameraPosition'))).toBe(true);
  });

  it('rejects a pinhole camera whose lookAt equals cameraPosition', () => {
    const errors = validateCameraWorldFraming({
      cameraPrimitive: { worldFraming: { cameraPosition: [1, 1, 1], lookAt: [1, 1, 1] } },
    });
    expect(errors.some((e) => e.includes('lookAt must differ'))).toBe(true);
  });
});

describe('validateProjectTwoPointPinhole', () => {
  it('rejects pictureCenter outside the viewBox', () => {
    const errors = validateProjectTwoPointPinhole({
      viewBox: { width: 800, height: 600 },
      worldFraming: {
        cameraPosition: [0, 12, 5],
        lookAt: [8, 6, 4],
        pictureCenter: [900, 300],
      },
    }, { xRange: [0, 16], yRange: [0, 12], worldExtent: { height: 8 } });
    expect(errors.some((e) => e.includes('pictureCenter'))).toBe(true);
  });
});

describe('validateMetamandalaUnitScale', () => {
  it('passes when no metamandala is declared', () => {
    expect(validateMetamandalaUnitScale({ viewBox: { width: 720 } })).toEqual([]);
  });

  it('rejects non-positive unitScale', () => {
    const errors = validateMetamandalaUnitScale({
      viewBox: { width: 720 },
      polygonizer: { metamandala: { unitScale: -1 } },
    });
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('unitScale must be a positive number');
  });

  it('rejects an unknown boundaryPolicy', () => {
    const errors = validateMetamandalaUnitScale({
      viewBox: { width: 720 },
      polygonizer: { metamandala: { boundaryPolicy: 'panic' } },
    });
    expect(errors[0]).toContain('boundaryPolicy');
  });

  it('rejects unitScale that disagrees with sceneExtent.width', () => {
    const errors = validateMetamandalaUnitScale({
      viewBox: { width: 720 },
      polygonizer: { metamandala: { unitScale: 10, sceneExtent: { width: 36 } } },
    });
    // 720 / 36 = 20, but declared 10 → inconsistency
    expect(errors[0]).toContain('must equal viewBox.width / sceneExtent.width');
  });

  it('accepts unitScale that agrees with sceneExtent.width', () => {
    expect(
      validateMetamandalaUnitScale({
        viewBox: { width: 720 },
        polygonizer: { metamandala: { unitScale: 20, sceneExtent: { width: 36 } } },
      }),
    ).toEqual([]);
  });
});
