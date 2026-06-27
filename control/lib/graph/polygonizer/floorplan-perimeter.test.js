import { describe, expect, it } from 'vitest';

import {
  computeLot, buildPerimeter, buildDriveway, buildCarport, buildShed, buildFences, subtractIntervals,
  buildGarage, buildSplitMirrorPerimeter, resolvePerimeterOpts, LOT_STYLES,
  interlockSurface, buildShrub, buildGardenBed,
  PERIMETER_DEFAULTS,
} from './floorplan-perimeter.js';
import { structurizeSplitMirror, structurizeFloorplan } from './floorplan-structure.js';
import { ROOF_STYLES } from '../roof.js';

const fp = { x0: 6, x1: 46, y0: 6, y1: 36 };   // a ~40×30 ft house footprint (feet)

const allCorners = (faces) => faces.flatMap((f) => f.corners);
const bounds = (faces) => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, y, z] of allCorners(faces)) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  return { x0, x1, y0, y1, z0, z1 };
};

describe('computeLot', () => {
  it('encloses the footprint with the configured setbacks; street on -y', () => {
    const lot = computeLot(fp);
    expect(lot.x0).toBe(fp.x0 - PERIMETER_DEFAULTS.sideYard);
    expect(lot.x1).toBe(fp.x1 + PERIMETER_DEFAULTS.sideYard);
    expect(lot.y0).toBe(fp.y0 - PERIMETER_DEFAULTS.frontSetback);   // street is closer in -y
    expect(lot.y1).toBe(fp.y1 + PERIMETER_DEFAULTS.backYard);        // deep back yard in +y
    expect(lot.street).toBe('-y');
    // front yard shallower than back yard
    expect(fp.y0 - lot.y0).toBeLessThan(lot.y1 - fp.y1);
  });
});

describe('buildDriveway', () => {
  it('runs up the +x side from the street to the house front, clear of the house', () => {
    const lot = computeLot(fp);
    const { rect } = buildDriveway(lot, fp, 0, { ...PERIMETER_DEFAULTS });
    expect(rect.x0).toBeGreaterThanOrEqual(fp.x1);     // on the +x side, not under the house
    expect(rect.x1).toBeLessThanOrEqual(lot.x1);        // inside the lot
    expect(rect.y0).toBe(lot.y0);                       // meets the street
    expect(rect.y1).toBe(fp.y0);                        // reaches the house front
  });
});

describe('buildCarport', () => {
  it('roofs the driveway head at clear height with posts to grade', () => {
    const o = { ...PERIMETER_DEFAULTS };
    const lot = computeLot(fp);
    const { rect } = buildDriveway(lot, fp, 0, o);
    const { faces } = buildCarport(rect, fp, 0, o);
    const b = bounds(faces);
    expect(b.z0).toBeCloseTo(0, 5);                          // slab + posts start at grade
    expect(b.z1).toBeGreaterThanOrEqual(o.carportClear);     // roof above clear height
  });
});

describe('buildShed', () => {
  it('sits inside the back of the lot with a gable above the walls', () => {
    const o = { ...PERIMETER_DEFAULTS };
    const lot = computeLot(fp);
    const { rect, faces } = buildShed(lot, fp, 0, o);
    expect(rect.x0).toBeGreaterThanOrEqual(lot.x0);
    expect(rect.y1).toBeLessThanOrEqual(lot.y1);
    expect(rect.y0).toBeGreaterThan(fp.y1);                  // out in the back yard, not on the house
    expect(bounds(faces).z1).toBeGreaterThan(o.shedWallH);   // ridge rises above the eave
  });
});

describe('subtractIntervals', () => {
  it('cuts gaps out of a span, dropping slivers', () => {
    const segs = subtractIntervals(0, 100, [[20, 30], [60, 70]]);
    expect(segs).toEqual([[0, 20], [30, 60], [70, 100]]);
    // a gap covering the whole span leaves nothing
    expect(subtractIntervals(0, 10, [[-5, 15]])).toEqual([]);
  });
});

describe('buildFences', () => {
  it('leaves a front-line gap where the driveway meets the street', () => {
    const o = { ...PERIMETER_DEFAULTS };
    const lot = computeLot(fp);
    const driveRect = buildDriveway(lot, fp, 0, o).rect;
    const driveCx = (driveRect.x0 + driveRect.x1) / 2;
    const front = buildFences(lot, 0, o, { driveRect }).filter((f) => f.group === 'perimeter:fence-front');
    expect(front.length).toBeGreaterThan(0);
    // no front-fence face spans the driveway centre — the opening is clear
    const spansDrive = front.some((f) => {
      const xs = f.corners.map((c) => c[0]);
      return Math.min(...xs) < driveCx && driveCx < Math.max(...xs);
    });
    expect(spansDrive).toBe(false);
    // and with no driveway, the front line IS continuous across that x
    const solid = buildFences(lot, 0, o, {}).filter((f) => f.group === 'perimeter:fence-front');
    const covered = solid.some((f) => {
      const xs = f.corners.map((c) => c[0]);
      return Math.min(...xs) < driveCx && driveCx < Math.max(...xs);
    });
    expect(covered).toBe(true);
  });
});

describe('buildPerimeter', () => {
  it('returns the lot, every feature rect, and faces that stay on the lot', () => {
    const { faces, lot, driveRect, carportRect, shedRect, pathRect, patioRect } = buildPerimeter(fp, 0);
    expect(lot).toBeTruthy();
    for (const r of [driveRect, carportRect, shedRect, pathRect, patioRect]) expect(r).toBeTruthy();
    const b = bounds(faces);
    const tol = 1.0;   // fence posts straddle the line; carport eaves overhang slightly
    expect(b.x0).toBeGreaterThanOrEqual(lot.x0 - tol);
    expect(b.x1).toBeLessThanOrEqual(lot.x1 + tol);
    expect(b.y0).toBeGreaterThanOrEqual(lot.y0 - tol);
    expect(b.y1).toBeLessThanOrEqual(lot.y1 + tol);
    expect(b.z0).toBeCloseTo(0, 5);                  // everything sits on grade
  });

  it('honours per-feature opt-outs', () => {
    const full = buildPerimeter(fp, 0);
    const noCarport = buildPerimeter(fp, 0, { carport: false, shed: false });
    expect(noCarport.carportRect).toBeNull();
    expect(noCarport.shedRect).toBeNull();
    expect(noCarport.faces.length).toBeLessThan(full.faces.length);
  });

  it('swaps the carport for an enclosed garage when asked', () => {
    const carport = buildPerimeter(fp, 0);
    const garage = buildPerimeter(fp, 0, { garage: true });
    expect(carport.garageRect).toBeNull();
    expect(carport.carportRect).toBeTruthy();
    expect(garage.garageRect).toBeTruthy();
    expect(garage.carportRect).toBeNull();
  });
});

describe('lot styles', () => {
  it('compact tightens every setback vs suburban (less yard)', () => {
    const suburban = computeLot(fp);
    const compact = computeLot(fp, { lotStyle: 'compact' });
    expect(compact.x1 - compact.x0).toBeLessThan(suburban.x1 - suburban.x0);
    expect(compact.y1 - compact.y0).toBeLessThan(suburban.y1 - suburban.y0);
  });

  it('explicit opts still win over the preset', () => {
    expect(resolvePerimeterOpts({ lotStyle: 'compact', sideYard: 99 }).sideYard).toBe(99);
    expect(resolvePerimeterOpts({ lotStyle: 'compact' }).sideYard).toBe(LOT_STYLES.compact.sideYard);
  });
});

describe('landscaping', () => {
  const o = { ...PERIMETER_DEFAULTS };
  const rect = { x0: 0, x1: 10, y0: 0, y1: 24 };

  it('interlock pavers tile the surface and stay within the rect', () => {
    const faces = interlockSurface(rect, 0, o);
    expect(faces.length).toBeGreaterThan(50);          // base + a grid of pavers
    for (const f of faces) for (const [x, y] of f.corners) {
      expect(x).toBeGreaterThanOrEqual(rect.x0 - 1e-6);
      expect(x).toBeLessThanOrEqual(rect.x1 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(rect.y0 - 1e-6);
      expect(y).toBeLessThanOrEqual(rect.y1 + 1e-6);
    }
  });

  it('a shrub is a rounded mound with an apex above grade', () => {
    const faces = buildShrub(5, 5, 0, o, { r: 1.2, h: 2 });
    const zMax = Math.max(...faces.flatMap((f) => f.corners.map((c) => c[2])));
    expect(zMax).toBeCloseTo(2, 5);
  });

  it('a garden bed has soil, a curb, and planting', () => {
    const faces = buildGardenBed({ x0: 0, x1: 9, y0: 0, y1: 7 }, 0, o);
    expect(faces.length).toBeGreaterThan(10);          // soil + 4 curbs + plants
    const groups = new Set(faces.map((f) => f.group));
    expect(groups.has('perimeter:garden')).toBe(true);
  });

  it('landscape + interlock both add geometry to a lot', () => {
    const plain = buildPerimeter({ x0: 6, x1: 46, y0: 6, y1: 36 }, 0);
    const lush = buildPerimeter({ x0: 6, x1: 46, y0: 6, y1: 36 }, 0, { landscape: true, interlock: true });
    expect(lush.faces.length).toBeGreaterThan(plain.faces.length * 2);
  });
});

describe('roof catalog (from the town spike)', () => {
  const fp = { seed: 7, width: 46, height: 34 };

  it('every roof style builds a roofed house that rises above the walls', () => {
    for (const style of Object.keys(ROOF_STYLES)) {
      const s = structurizeFloorplan(fp, { view: 'exterior', roof: style, facadeDecor: true });
      const topZ = Math.max(...s.faces.flatMap((f) => f.corners.map((c) => c[2])));
      expect(topZ, `roof '${style}'`).toBeGreaterThan(s.baseZ + 8);   // roof caps at/above the wall top
    }
  });

  it('the split-mirror accepts a roof style from the catalog', () => {
    const gambrel = structurizeSplitMirror({ seed: 7 }, { roof: 'farmhouse', facadeStyle: 'siding' });
    const hip = structurizeSplitMirror({ seed: 7 }, { roof: 'bungalow', facadeStyle: 'siding' });
    const top = (s) => Math.max(...s.faces.flatMap((f) => f.corners.map((c) => c[2])));
    expect(top(gambrel)).toBeGreaterThan(top(hip));   // the gambrel rises higher than the hip
  });
});

describe('buildGarage', () => {
  it('encloses the bay with a door on the facing side and a gable above', () => {
    const o = { ...PERIMETER_DEFAULTS, light: undefined };
    const rect = { x0: 0, x1: 11, y0: 0, y1: 20 };
    const { faces } = buildGarage(rect, 0, o, { facing: '-y' });
    const zs = faces.flatMap((f) => f.corners.map((c) => c[2]));
    expect(Math.max(...zs)).toBeGreaterThan(o.garageWallH);    // gable ridge above the walls
    // a door panel sits just proud of the -y face (y < 0)
    const proud = faces.some((f) => f.corners.every((c) => c[1] <= 0.001) && f.corners.some((c) => c[1] < -0.05));
    expect(proud).toBe(true);
  });
});

describe('split-mirror duplex', () => {
  it('places two mirror houses on a split lot with outer front garages', () => {
    const s = structurizeSplitMirror({ seed: 7, unitWidth: 24, depth: 50 });
    expect(s.houses).toHaveLength(2);
    // footprints are mirror images about the split line
    const [A, B] = s.houses.map((h) => h.footprint);
    expect(A.x1 - s.splitX).toBeCloseTo(s.splitX - B.x0, 5);
    expect(s.splitX - A.x0).toBeCloseTo(B.x1 - s.splitX, 5);
    // garages on the outer sides (A: -x, B: +x)
    expect(s.perimeter.units.map((u) => u.outerSide)).toEqual(['-x', '+x']);
    // both footprints sit inside the shared lot
    expect(A.x0).toBeGreaterThanOrEqual(s.lot.x0);
    expect(B.x1).toBeLessThanOrEqual(s.lot.x1);
  });

  it('builds front-loaded garages that meet the street via an apron', () => {
    const s = structurizeSplitMirror({ seed: 3 });
    for (const u of s.perimeter.units) {
      expect(u.garageRect.y0).toBeGreaterThanOrEqual(s.lot.y0);   // garage inside the lot
      expect(u.apronRect.y0).toBe(s.lot.y0);                       // apron reaches the street
      expect(u.apronRect.y1).toBeCloseTo(u.garageRect.y0, 5);      // apron meets the garage door
    }
  });

  it('cutaway view furnishes the interior and drops the roof (house, not town shell)', () => {
    const ext = structurizeSplitMirror({ seed: 7 }, { facadeStyle: 'tofu' });
    const cut = structurizeSplitMirror({ seed: 7 }, { facadeStyle: 'tofu', view: 'cutaway' });
    expect(cut.view).toBe('cutaway');
    expect(cut.furnished).toBe(true);
    expect(cut.faces.length).toBeGreaterThan(ext.faces.length * 3);   // interior + furniture
    // open top: nothing rises above the wall height (no roof)
    const topZ = Math.max(...cut.faces.flatMap((f) => f.corners.map((c) => c[2])));
    expect(topZ).toBeLessThanOrEqual(cut.wallHeight + 0.1);
    // the lot still renders under the furnished house (interior + exterior together)
    expect(cut.perimeter.units.length).toBe(2);
  });

  it('stacks storeys into a taller duplex', () => {
    const one = structurizeSplitMirror({ seed: 7 });
    const two = structurizeSplitMirror({ seed: 7, storeys: 2 });
    expect(two.storeys).toBe(2);
    const top = (s) => Math.max(...s.faces.flatMap((f) => f.corners.map((c) => c[2])));
    expect(top(two)).toBeGreaterThan(top(one) + 6);          // a second storey of height
  });

  it('forwards landscape + interlock to the shared lot', () => {
    const bare = structurizeSplitMirror({ seed: 7 });
    const lush = structurizeSplitMirror({ seed: 7 }, { landscape: true, interlock: true });
    expect(lush.faces.length).toBeGreaterThan(bare.faces.length);
  });

  it('tofu style raises the storeys and caps with a flat deck', () => {
    const gable = structurizeSplitMirror({ seed: 7 });
    const tofu = structurizeSplitMirror({ seed: 7 }, { facadeStyle: 'tofu' });
    expect(tofu.style).toBe('tofu');
    expect(tofu.wallHeight).toBeGreaterThan(gable.wallHeight);     // high-ceiling modern read
    // flat-deck roof tops out near the wall height (no tall pitched ridge above it)
    const roofZ = Math.max(...tofu.faces.flatMap((f) => f.corners.map((c) => c[2])));
    expect(roofZ).toBeLessThan(tofu.wallHeight + 4);
  });
});
