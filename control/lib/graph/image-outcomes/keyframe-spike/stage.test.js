// The STAGE depth kernel (scene-staging.plan.md, Axis 1). Proves the S0 claim —
// one factor k(d)=dRef/d governs scale, floor-y, and parallax — on synthetic
// layers, no plate. The worked numbers are the plan's table (832×1216 frame,
// horizonY=500): bush d0.6, Nera d1.0 span859 footY1037, Lio d2.0 span430 footY768.5.
import { describe, it, expect } from 'vitest';
import {
  makeStage, depthFactor, scaleAt, footY, parallax,
  placeActor, drawBox, placeBand, depthSort, headroomOk, soleInBand, groundShadow,
} from './stage.js';

const STAGE = makeStage({ unit: 859, dRef: 1, horizonY: 500, groundYRef: 1037 });
// k1/k2 clip native anchors (832×1216, cx 416, ground 1037, span 859)
const CLIP = { width: 832, height: 1216, cx: 416, groundY: 1037, span: 859 };

describe('makeStage', () => {
  it('rejects a horizon at or below the ground line', () => {
    expect(() => makeStage({ horizonY: 1037, groundYRef: 1037 })).toThrow();
    expect(() => makeStage({ horizonY: 1100, groundYRef: 1037 })).toThrow();
  });
  it('rejects a non-positive dRef', () => {
    expect(() => makeStage({ dRef: 0, horizonY: 500, groundYRef: 1037 })).toThrow();
  });
});

describe('the one factor k(d) = dRef/d', () => {
  it('k = 1 at the reference depth, halves at twice the depth', () => {
    expect(depthFactor(1, STAGE)).toBe(1);
    expect(depthFactor(2, STAGE)).toBe(0.5);
  });
  it('scale AND parallax are the same factor', () => {
    for (const d of [0.6, 1, 2, 3]) {
      expect(scaleAt(d, STAGE)).toBe(depthFactor(d, STAGE));
      expect(parallax(d, STAGE)).toBe(depthFactor(d, STAGE));
    }
  });
  it('footY sits on the ground line at dRef and rises toward the horizon with depth', () => {
    expect(footY(1, STAGE)).toBe(1037);
    expect(footY(2, STAGE)).toBeCloseTo(768.5, 5);
    expect(footY(1e9, STAGE)).toBeCloseTo(500, 3); // → horizonY as d→∞
  });
  it('rejects a non-positive depth', () => {
    expect(() => depthFactor(0, STAGE)).toThrow();
  });
});

describe('placeActor — the plan worked numbers', () => {
  it('Nera at d=1: native span, soles on the ground line, no camera', () => {
    const p = placeActor({ markX: 1500, depth: 1 }, {}, STAGE);
    expect(p.span).toBe(859);
    expect(p.footSx).toBe(1500);
    expect(p.footSy).toBe(1037);
  });
  it('Lio upstage at d=2: half span, higher in frame', () => {
    const p = placeActor({ markX: 1800, depth: 2 }, {}, STAGE);
    expect(p.span).toBe(429.5);
    expect(p.footSy).toBeCloseTo(768.5, 5);
  });
  it('a 300px reference pan shifts layers by their parallax (bush 500 / Nera 300 / Lio 150)', () => {
    const cam = { camX: 300 };
    const bush = placeActor({ markX: 0, depth: 0.6 }, cam, STAGE);
    const nera = placeActor({ markX: 0, depth: 1 }, cam, STAGE);
    const lio = placeActor({ markX: 0, depth: 2 }, cam, STAGE);
    expect(-bush.footSx).toBeCloseTo(500, 5);
    expect(-nera.footSx).toBeCloseTo(300, 5);
    expect(-lio.footSx).toBeCloseTo(150, 5);
  });
  it('lens zoom scales span, and pans then zooms about the center', () => {
    const C = { x: 400, y: 600 };
    const p = placeActor({ markX: 100, depth: 1 }, { camX: 50, zoom: 2 }, STAGE, C);
    expect(p.span).toBe(1718);                      // 859 * 2
    // pan first: sx = markX - camX*k = 50; then zoom about center: 400 + (50-400)*2
    expect(p.footSx).toBe(400 + (50 - 400) * 2);
  });

  it('push/pull scales about the frame center (a point AT center is fixed)', () => {
    const C = { x: 400, y: 600 };
    // an actor whose sole point sits exactly at center stays put under any zoom
    const atCenter = placeActor({ markX: 400, depth: 1 }, { camX: 0, zoom: 1.6 }, makeStage({ unit: 859, dRef: 1, horizonY: 500, groundYRef: 600 }), C);
    expect(atCenter.footSx).toBe(400);
    expect(atCenter.footSy).toBeCloseTo(600, 5);
    // pulling back (zoom 1.6 → 1.0) shrinks a bigger span toward that center
    const wide = placeActor({ markX: 100, depth: 1 }, { camX: 0, zoom: 1.0 }, STAGE, C);
    const tight = placeActor({ markX: 100, depth: 1 }, { camX: 0, zoom: 1.6 }, STAGE, C);
    expect(tight.span).toBeGreaterThan(wide.span);
    expect(Math.abs(tight.footSx - C.x)).toBeGreaterThan(Math.abs(wide.footSx - C.x));
  });
});

describe('drawBox — clip raster anchoring', () => {
  it('a d=2 actor draws at half raster size with soles on footSy', () => {
    const p = placeActor({ markX: 1800, depth: 2 }, {}, STAGE);
    const b = drawBox(p, CLIP);
    expect(b.scale).toBe(0.5);
    expect(b.width).toBe(416);
    // the clip's own ground pixel (1037) lands on footSy
    expect(b.top + CLIP.groundY * b.scale).toBeCloseTo(p.footSy, 5);
    // the clip's own center-x (416) lands on footSx
    expect(b.left + CLIP.cx * b.scale).toBeCloseTo(p.footSx, 5);
  });
});

describe('placeBand — parallax only, no scale', () => {
  it('a background band drifts by its parallax and is not resized by depth', () => {
    const b = placeBand({ originX: 0, originY: 0, depth: 4 }, { camX: 400 }, STAGE);
    expect(b.left).toBeCloseTo(-400 * 0.25, 5); // parallax 0.25, no k on size
    expect(b.scale).toBe(1);
  });
  it('a foreground occluder band whips past faster than the plate', () => {
    const cam = { camX: 300 };
    const fg = placeBand({ depth: 0.6 }, cam, STAGE);
    const bg = placeBand({ depth: 1 }, cam, STAGE);
    expect(Math.abs(fg.left)).toBeGreaterThan(Math.abs(bg.left));
    expect(fg.left).toBeCloseTo(-500, 5);
  });
});

describe('depthSort — painter far→near', () => {
  it('orders far layers first so nearer layers draw last', () => {
    const sorted = depthSort([{ depth: 1 }, { depth: 4 }, { depth: 0.6 }, { depth: 2 }]);
    expect(sorted.map((l) => l.depth)).toEqual([4, 2, 1, 0.6]);
  });
});

describe('validator teeth', () => {
  it('headroom passes when the plate covers the fastest band excursion, fails otherwise', () => {
    // fastest band k=1.667 (bush d0.6), camX up to 300 → needs 832 + 500 = 1332
    expect(headroomOk({ plateWidth: 3072, frameWidth: 832, maxCamX: 300, maxParallax: 1.667 })).toBe(true);
    expect(headroomOk({ plateWidth: 1000, frameWidth: 832, maxCamX: 300, maxParallax: 1.667 })).toBe(false);
  });
  it('soleInBand refuses a placement whose sole line leaves the floor range', () => {
    expect(soleInBand(1, STAGE, [500, 1216])).toBe(true);   // footY 1037, in range
    expect(soleInBand(0.4, STAGE, [500, 1216])).toBe(false); // footY 1842.5, below plate
  });
});

describe('groundShadow — contact AO pool', () => {
  it('centers on the sole point, is a flat ellipse, and shrinks with depth like the actor', () => {
    const near = groundShadow(placeActor({ markX: 400, depth: 1 }, {}, STAGE));
    const far = groundShadow(placeActor({ markX: 400, depth: 2 }, {}, STAGE));
    expect(near.cx).toBe(400);
    expect(near.cy).toBe(1037);
    expect(near.ry).toBeLessThan(near.rx);          // flat pool, not a circle
    expect(far.rx).toBeCloseTo(near.rx * 0.5, 5);   // half depth-scale → half the pool
  });
});

describe('purity', () => {
  it('is fully deterministic (no Date/Math.random): identical inputs → identical placement', () => {
    const call = () => placeActor({ markX: 777, depth: 1.37 }, { camX: 42, camY: 9, zoom: 1.1 }, STAGE);
    expect(JSON.stringify(call())).toBe(JSON.stringify(call()));
  });
});
