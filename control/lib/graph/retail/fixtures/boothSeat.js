import { box } from '../store-box.js';
import {
  assetFaces, buildBanquette, buildCafeChair,
} from '../../polygonizer/floorplan-building-assets.js';

export default {
  name: 'boothSeat',
  decl: { shape: 'run', depth: 4.6, height: 3.6, wallBacked: true, merch: false, tall: false, clearance: 2 },
  build(p) {
    const out = [];
    const bake = (frag) => assetFaces(frag, { light: p.light });

    // Run length and depth of the fixture footprint
    const runLen = p.along === 'x' ? p.x1 - p.x0 : p.y1 - p.y0;
    const depth = p.along === 'x' ? p.y1 - p.y0 : p.x1 - p.x0;

    // Determine which side the wall is on
    let wallSide;
    if (p.along === 'x') {
      wallSide = p.face === '-y' ? '+y' : '-y';
    } else {
      wallSide = p.face === '+x' ? '-x' : p.face === '-x' ? '+x' : '-y';
    }

    // Banquette against the wall: runs the full run length
    const banquetteW = runLen - 0.2;
    const banquetteD = 1.7; // Fixed depth, positioned against wall

    let banquetteX = (p.x0 + p.x1) / 2;
    let banquetteY = (p.y0 + p.y1) / 2;

    if (p.along === 'x') {
      // Position banquette near the wall (toward +y, away from customer at -y)
      banquetteY = p.y1 - banquetteD / 2 - 0.15;
    } else {
      // Along y: position based on which wall
      if (p.face === '+x') {
        banquetteX = p.x1 - banquetteD / 2 - 0.15;
      } else {
        banquetteX = p.x0 + banquetteD / 2 + 0.15;
      }
    }

    out.push(...bake(buildBanquette({
      x: banquetteX,
      y: banquetteY,
      z: p.z,
      w: banquetteW,
      d: banquetteD,
      h: 3.3,
      along: p.along,
      wallSide,
      cushion: p.tint || '#7d4a40',
    })));

    // Rectangular table top (70% of run length, ~2.2 ft wide) with pedestals
    const tableLen = runLen * 0.7;
    const tableW = 2.2;
    const tableTopH = 0.12;
    const tableH = 2.45;

    let tableX = (p.x0 + p.x1) / 2;
    let tableY = (p.y0 + p.y1) / 2;

    if (p.along === 'x') {
      // Position table in the middle-front area between customer and banquette
      const availableDepth = depth - banquetteD - 0.4;
      tableY = p.y0 + availableDepth / 2 + 0.3;
    } else {
      // Along y: table offset perpendicular to run
      const availableDepth = depth - banquetteD - 0.4;
      if (p.face === '+x') {
        tableX = p.x0 + availableDepth / 2 + 0.3;
      } else {
        tableX = p.x1 - availableDepth / 2 - 0.3;
      }
    }

    // Table top (rectangular box) — along x, top is tableLen×tableW; along y, top is tableW×tableLen
    if (p.along === 'x') {
      box(out, tableX - tableLen / 2, tableX + tableLen / 2, tableY - tableW / 2, tableY + tableW / 2, p.z + tableH - tableTopH, p.z + tableH, '#6f5740', p.light);
    } else {
      box(out, tableX - tableW / 2, tableX + tableW / 2, tableY - tableLen / 2, tableY + tableLen / 2, p.z + tableH - tableTopH, p.z + tableH, '#6f5740', p.light);
    }

    // Pedestals: two legs under the table top
    const pedestalW = 0.16;
    const pedestalD = 0.16;
    const legSpacing = p.along === 'x' ? tableLen * 0.35 : tableLen * 0.35;

    // First pedestal
    if (p.along === 'x') {
      box(out, tableX - legSpacing - pedestalW / 2, tableX - legSpacing + pedestalW / 2, tableY - pedestalD / 2, tableY + pedestalD / 2, p.z, p.z + tableH - tableTopH, '#3a3d42', p.light);
      box(out, tableX + legSpacing - pedestalW / 2, tableX + legSpacing + pedestalW / 2, tableY - pedestalD / 2, tableY + pedestalD / 2, p.z, p.z + tableH - tableTopH, '#3a3d42', p.light);
    } else {
      box(out, tableX - pedestalD / 2, tableX + pedestalD / 2, tableY - legSpacing - pedestalW / 2, tableY - legSpacing + pedestalW / 2, p.z, p.z + tableH - tableTopH, '#3a3d42', p.light);
      box(out, tableX - pedestalD / 2, tableX + pedestalD / 2, tableY + legSpacing - pedestalW / 2, tableY + legSpacing + pedestalW / 2, p.z, p.z + tableH - tableTopH, '#3a3d42', p.light);
    }

    // Optional: add a loose chair on the open side
    // The chair must face the table, so its back is toward the open side (away from the wall)
    if (p.along === 'x') {
      // When along='x' and face='-y': open side is at -y, so chair back faces -y
      const chairY = p.y0 + 0.6;
      out.push(...bake(buildCafeChair({
        x: (p.x0 + p.x1) / 2,
        y: chairY,
        z: p.z,
        w: 1.5,
        d: 1.5,
        h: 2.9,
        back: '-y', // Back faces open side (toward customer), so chair faces table
      })));
    } else {
      // Along y: chair on the open side facing the table
      if (p.face === '+x') {
        // Open side is at +x, so chair back faces +x
        const chairX = p.x1 - 0.6;
        out.push(...bake(buildCafeChair({
          x: chairX,
          y: (p.y0 + p.y1) / 2,
          z: p.z,
          w: 1.5,
          d: 1.5,
          h: 2.9,
          back: '+x', // Back faces open side, so chair faces table
        })));
      } else {
        // face='-x': open side is at -x, so chair back faces -x
        const chairX = p.x0 + 0.6;
        out.push(...bake(buildCafeChair({
          x: chairX,
          y: (p.y0 + p.y1) / 2,
          z: p.z,
          w: 1.5,
          d: 1.5,
          h: 2.9,
          back: '-x', // Back faces open side, so chair faces table
        })));
      }
    }

    return out;
  },
};
