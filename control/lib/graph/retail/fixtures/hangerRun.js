import { box } from '../store-box.js';

export default {
  name: 'hangerRun',
  decl: { shape: 'run', depth: 1.9, height: 7.8, wallBacked: true, merch: true, tall: true, clearance: 3 },
  build(p) {
    const out = [], L = p.light;
    const along = p.along === 'y';
    const [a0, a1] = along ? [p.y0, p.y1] : [p.x0, p.x1];
    const [t0, t1] = along ? [p.x0, p.x1] : [p.y0, p.y1];

    // Determine wall position and customer-facing direction
    const isWallAtMax = (along && p.face === '-x') || (!along && p.face === '-y');
    const [wallSide, customerSide] = isWallAtMax ? [t1, t0] : [t0, t1];

    // Back panel (slatwall) at the wall
    const panelThick = 0.08;
    const panelBack = wallSide > customerSide ? wallSide - panelThick : wallSide + panelThick;
    const [panelMin, panelMax] = wallSide > customerSide
      ? [panelBack, wallSide]
      : [wallSide, panelBack];

    if (along) {
      box(out, panelMin, panelMax, a0, a1, p.z, p.z + 7.5, '#a89484', L);  // slatwall color
    } else {
      box(out, a0, a1, panelMin, panelMax, p.z, p.z + 7.5, '#a89484', L);
    }

    // Two hang-bars with hanging garments and spacing
    const upperBarZ = p.z + 5.2;
    const lowerBarZ = p.z + 2.8;
    const barDiameter = 0.06;
    const barColor = '#3a3d42';  // metal

    // Hang-bar helper: creates bar rod and garments below it
    const addHangBar = (barZ, dropMax) => {
      // Bar rod - positioned close to wall, projecting toward customer
      const rodThick = barDiameter;
      const rodDepth = Math.abs(customerSide - wallSide) * 0.5;  // projects halfway into footprint
      const rodAtWall = wallSide - panelThick;
      const rodAwayFromWall = wallSide > customerSide
        ? rodAtWall - rodDepth  // wall at high value, rod extends downward
        : rodAtWall + rodDepth; // wall at low value, rod extends upward
      const [rodMin, rodMax] = wallSide > customerSide
        ? [rodAwayFromWall, rodAtWall]
        : [rodAtWall, rodAwayFromWall];

      if (along) {
        box(out, rodMin - rodThick / 2, rodMin + rodThick / 2, a0, a1, barZ, barZ + rodThick, barColor, L);
      } else {
        box(out, a0, a1, rodMin - rodThick / 2, rodMin + rodThick / 2, barZ, barZ + rodThick, barColor, L);
      }

      // Hanging garments along the bar
      const garmentWidth = 0.08;
      const [gymMin, gymMax] = wallSide > customerSide
        ? [rodAwayFromWall + 0.05, rodAtWall - 0.05]
        : [rodAtWall + 0.05, rodAwayFromWall - 0.05];

      for (let s = a0 + 0.3; s < a1 - 0.3; s += 0.28) {
        const drop = 0.8 + p.rng() * dropMax;
        const gx0 = s - garmentWidth / 2;
        const gx1 = s + garmentWidth / 2;
        const [gy0, gy1] = gymMin < gymMax ? [gymMin, gymMax] : [gymMax, gymMin];
        const gz0 = barZ - drop;
        const gz1 = barZ - 0.05;

        if (along) {
          box(out, gy0, gy1, gx0, gx1, gz0, gz1, p.merch(), L);
        } else {
          box(out, gx0, gx1, gy0, gy1, gz0, gz1, p.merch(), L);
        }
      }
    };

    addHangBar(upperBarZ, 1.2);  // upper bar, max 1.2 ft drop variation
    addHangBar(lowerBarZ, 1.5);  // lower bar, max 1.5 ft drop variation

    // Top shelf with folded stacks above upper bar
    const shelfZ = p.z + 6.8;
    const shelfDepth = Math.abs(customerSide - wallSide) * 0.5;
    const shelfAtWall = wallSide - panelThick;
    const shelfAwayFromWall = wallSide > customerSide
      ? shelfAtWall - shelfDepth
      : shelfAtWall + shelfDepth;
    const [shelfMin, shelfMax] = wallSide > customerSide
      ? [shelfAwayFromWall, shelfAtWall]
      : [shelfAtWall, shelfAwayFromWall];

    if (along) {
      box(out, shelfMin, shelfMax, a0, a1, shelfZ, shelfZ + 0.1, '#8a7a6a', L);  // shelf
    } else {
      box(out, a0, a1, shelfMin, shelfMax, shelfZ, shelfZ + 0.1, '#8a7a6a', L);
    }

    // Folded stack boxes on shelf
    const [stackMinY, stackMaxY] = wallSide > customerSide
      ? [shelfAwayFromWall + 0.05, shelfAtWall - 0.05]
      : [shelfAtWall + 0.05, shelfAwayFromWall - 0.05];

    for (let s = a0 + 0.4; s < a1 - 0.3; s += 0.5) {
      const stackW = 0.28;
      const stackH = 0.25 + p.rng() * 0.15;
      const sx0 = s - stackW / 2;
      const sx1 = s + stackW / 2;
      const [sy0, sy1] = stackMinY < stackMaxY ? [stackMinY, stackMaxY] : [stackMaxY, stackMinY];
      const sz0 = shelfZ + 0.1;
      const sz1 = sz0 + stackH;

      if (along) {
        box(out, sy0, sy1, sx0, sx1, sz0, sz1, p.merch(), L);
      } else {
        box(out, sx0, sx1, sy0, sy1, sz0, sz1, p.merch(), L);
      }
    }

    return out;
  }
};
