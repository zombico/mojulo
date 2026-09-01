import { describe, it, expect } from 'vitest';
import {
  resolveSceneCamera, depthAtRow, rowAtDepth, verticalUnitAt,
  bandArea, equalAreaBands, foreshorteningRatio,
} from './scene-camera.js';
import { lowerSceneCage } from './index.js';

// A frontal street canyon, read off a 1280x720 frame: horizon at mid-frame, the
// street running to a single point, ground readable from the bottom edge up to
// a little short of the horizon.
const CANYON = {
  camera: { form: 'one-point', vanishingPoint: [640, 360], horizonY: 360 },
  roomBasis: { frontLeft: [180, 720], frontRight: [1100, 720], farRow: 400 },
};

describe('scene-camera — one-point is the photographic case', () => {
  it('resolves a single vanishing point without needing a second', () => {
    const cam = resolveSceneCamera(CANYON);
    expect(cam.form).toBe('one-point');
    expect(cam.horizonY).toBe(360);
    expect(cam.grounded).toBe(false); // relative, and says so
  });

  it('infers one-point when only one point was measured', () => {
    const cam = resolveSceneCamera({ camera: { vanishingPoint: [640, 360] }, roomBasis: { frontLeft: [180, 720] } });
    expect(cam.form).toBe('one-point');
  });

  it('rejects a two-point claim whose points coincide — that IS one-point', () => {
    expect(() => resolveSceneCamera({
      camera: { form: 'two-point', vanishingPoints: { left: [640, 360], right: [640, 360] }, horizonY: 360 },
      roomBasis: { frontLeft: [180, 720] },
    })).toThrow(/coincide/);
  });

  it('refuses a near row above the horizon rather than emitting a confident wrong depth', () => {
    expect(() => resolveSceneCamera({ camera: CANYON.camera, roomBasis: { frontLeft: [180, 200], farRow: 400 } }))
      .toThrow(/BELOW the horizon/);
  });
});

describe('scene-camera — the depth mapping the budget rests on', () => {
  const cam = resolveSceneCamera(CANYON);

  it('is 1/(row - horizon), anchored at the near row', () => {
    expect(depthAtRow(cam, 720)).toBeCloseTo(1, 6);        // the anchor itself
    expect(depthAtRow(cam, 540)).toBeCloseTo(2, 6);        // half as far below → twice as deep
    expect(depthAtRow(cam, 400)).toBeCloseTo(9, 6);
  });

  it('returns null at and above the horizon instead of a huge number', () => {
    expect(depthAtRow(cam, 360)).toBeNull();
    expect(depthAtRow(cam, 200)).toBeNull();
  });

  it('round-trips through rowAtDepth', () => {
    for (const y of [720, 600, 480, 420]) expect(rowAtDepth(cam, depthAtRow(cam, y))).toBeCloseTo(y, 6);
  });

  it('makes the vertical scale depth-dependent — one verticalUnit is only true for one row', () => {
    expect(verticalUnitAt(cam, 1, 60)).toBeCloseTo(60, 6);
    expect(verticalUnitAt(cam, 3, 60)).toBeCloseTo(20, 6);
  });
});

describe('scene-camera — equal AREA is nothing like equal pixels', () => {
  const cam = resolveSceneCamera(CANYON);
  const bands = equalAreaBands(cam, { count: 5, farRow: 400 });

  it('splits the ground into equal-area bands', () => {
    expect(bands).toHaveLength(5);
    for (const b of bands) expect(b.areaShare).toBeCloseTo(0.2, 6);
    expect(bands[0].depthFrom).toBeCloseTo(1, 3);
    expect(bands[4].depthTo).toBeCloseTo(9, 3);
  });

  it('shows the far band costing a small fraction of the pixels the near one does', () => {
    expect(bands[0].pixelShare).toBeGreaterThan(0.5);   // the nearest fifth of the ground eats most of the frame
    expect(bands[4].pixelShare).toBeLessThan(0.05);     // the last fifth is a sliver
    expect(foreshorteningRatio(bands)).toBeGreaterThan(20);
  });

  it('refuses to guess where the read stops', () => {
    expect(() => equalAreaBands(cam, { count: 5 })).toThrow(/farRow/);
    expect(() => equalAreaBands(cam, { count: 5, farRow: 300 })).toThrow(/between the horizon/);
  });

  it('bandArea is linear in depth for a constant-width corridor', () => {
    const a = bandArea(cam, 720, 540, 10);   // depth 1 -> 2
    const b = bandArea(cam, 540, 480, 10);   // depth 2 -> 3
    expect(a).toBeCloseTo(10, 6);
    expect(b).toBeCloseTo(10, 6);
  });

  it('grounds absolutely when a known width is supplied', () => {
    const cam2 = resolveSceneCamera({ ...CANYON,
      roomBasis: { ...CANYON.roomBasis, scaleAnchor: { kind: 'width', pixels: 920, world: 30 } } });
    expect(cam2.grounded).toBe(true);
    expect(cam2.worldWidth).toBe(30);
  });
});

describe('scene cage — the one-point drawing', () => {
  it('runs both corridor edges to the single point and rules the depth bands', () => {
    const m = lowerSceneCage({ ...CANYON, roomBasis: { ...CANYON.roomBasis, bands: 5 } }, 'canyon');
    const texts = m.marks.filter((k) => k.kind === 'text').map((k) => k.value);
    expect(texts).toContain('VP');
    expect(texts.filter((t) => /% area in .*% px/.test(t))).toHaveLength(5);
    expect(texts.some((t) => /far band holds .*x the ground per pixel/.test(t))).toBe(true);
  });

  it('mirrors the far corridor edge about the VP, not by the old 600px guess', () => {
    // frontRight omitted. One-point: the recession point IS the station point, so
    // 180 mirrors to 1100. The old path had no single-VP case and added 600 → 780.
    const m = lowerSceneCage({ camera: { vanishingPoint: [640, 360], horizonY: 360 }, roomBasis: { frontLeft: [180, 720] } }, 'c');
    const rays = m.marks.filter((k) => k.kind === 'line' && k.stroke === '#e67e22');
    const originsX = rays.map((r) => Math.round(r.x1 - (m.viewBox.width - 1196) / 2)).sort((a, b) => a - b);
    expect(rays).toHaveLength(2);
    // both rays converge on the same point (the single VP)
    expect(Math.round(rays[0].x2)).toBe(Math.round(rays[1].x2));
    // and they start 920px apart — 180 and 1100, mirrored about x=640
    expect(Math.abs(rays[1].x1 - rays[0].x1)).toBeCloseTo(920, 0);
    expect(originsX.length).toBe(2);
  });

  it('still lowers a genuine two-point read unchanged', () => {
    const m = lowerSceneCage({
      camera: { vanishingPoints: { left: [-220, 245], right: [1180, 245] }, horizonY: 245 },
      roomBasis: { frontLeft: [210, 510], frontRight: [750, 510] },
    }, 'room');
    const texts = m.marks.filter((k) => k.kind === 'text').map((k) => k.value);
    expect(texts).toEqual(expect.arrayContaining(['VP-L', 'VP-R', 'horizon']));
  });
});
