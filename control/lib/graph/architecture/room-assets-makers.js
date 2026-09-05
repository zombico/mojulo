/**
 * room-assets-makers — the pieces that MAKE a room (room-realism.plan.md, phase 2).
 *
 * Workbench-authored meshes for the furniture that was still a flat box-net in a
 * furnished floorplan: the armchair, coffee table, media console (with its TV), the
 * bookcase (with books), the bed (frame + mattress + duvet + pillows + headboard),
 * the nightstand (with a lamp), the dresser, the sideboard, the dining table, and the
 * rug (a bordered field, not a slab).
 *
 * Every builder authors a CANONICAL LOCAL frame — centred in x,y; z runs 0..h up;
 * BACK at −y, FRONT at +y — and is registered `local: true` in room-assets.js, so the
 * planner's footprint basis orients it (a back-wall piece faces into the room; a
 * `facing` piece is spun by the planner). Dims are whatever the room hands over
 * (feet in a floorplan), so every proportion is relative to w/d/h with only tiny
 * absolute floors. No dice anywhere: the bookcase's books come from an integer hash
 * of (bay, slot), byte-identical on every render.
 */

import { buildLeg, buildSlab } from './room-parts.js';

// a vertical rounded-rect prism — the workhorse. Thin cornerSamples keep face counts sane.
const box = (x, y, z0, z1, w, d, tint, r = 0, cornerSamples = 2) => buildSlab({ x, y, z0, z1, w, d, r, tint, cornerSamples });

// four tapered legs inset from the footprint corners, foot on z, top tucked under `topZ`
function legSet({ w, d, z = 0, topZ, inset, topR, footR, tint }) {
  const ix = Math.max(0.03, Math.min(w * 0.2, inset));
  const iy = Math.max(0.03, Math.min(d * 0.2, inset));
  return [-1, 1].flatMap((sx) => [-1, 1].map((sy) => buildLeg({
    foot: [sx * (w / 2 - ix), sy * (d / 2 - iy), z],
    top: [sx * (w / 2 - ix * 0.9), sy * (d / 2 - iy * 0.9), topZ],
    topRadius: topR,
    footRadius: footR,
    tint,
  })));
}

// deterministic unit hash of small integers — the bookcase's "random" books
function hash01(a, b, k = 0) {
  let x = (Math.imul(a + 1, 374761393) + Math.imul(b + 1, 668265263) + Math.imul(k + 1, 1274126177)) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

const WOOD = { top: '#9a6a3d', body: '#8a5a32', dark: '#6e4524', light: '#a37445', walnut: '#5e3d26', leg: '#5a3a22', black: '#2b2724', handle: '#b9b2a4' };

const manifest = (title, parts) => ({ kind: 'workbench', ...(title ? { title } : {}), units: 'm', ...parts });

/** Club armchair — a low, deep seat between two solid arms under a padded back. */
export function buildClubArmchairWorkbenchManifest({ w = 2.8, d = 2.8, h = 2.6, title } = {}) {
  const m = Math.min(w, d);
  const legH = h * 0.09;
  const seatTop = h * 0.42;
  const armTop = h * 0.64;
  const backD = d * 0.22;
  const armW = w * 0.17;
  const fabric = '#6b7f8e', fabricDk = '#55677a', fabricLt = '#7d91a0';
  const innerW = w - armW * 2 - m * 0.02;
  const y0 = -d / 2;
  return manifest(title, {
    lathes: legSet({ w, d, topZ: legH + h * 0.02, inset: m * 0.1, topR: m * 0.035, footR: m * 0.026, tint: WOOD.leg }),
    extrudes: [
      box(0, 0, legH, seatTop * 0.78, w * 0.82, d * 0.80, fabricDk, m * 0.04, 3),                     // seat deck (inset so legs read)
      box(0, backD * 0.35, seatTop * 0.78, seatTop, innerW, d - backD - m * 0.06, fabricLt, m * 0.07, 5),   // seat cushion
      box(-(w / 2 - armW / 2), 0, legH, armTop, armW, d * 0.96, fabric, armW * 0.3, 4),               // arms
      box(w / 2 - armW / 2, 0, legH, armTop, armW, d * 0.96, fabric, armW * 0.3, 4),
      box(0, y0 + backD / 2, legH, h, w * 0.97, backD, fabric, backD * 0.3, 4),                       // back
      box(0, y0 + backD + backD * 0.28, seatTop, h * 0.92, innerW, backD * 0.56, fabricLt, backD * 0.25, 5),   // back cushion
    ],
  });
}

/** Coffee table — a rounded plank top over a lower shelf on four tapered legs, a book stack on top. */
export function buildCoffeeTableWorkbenchManifest({ w = 4, d = 2.2, h = 1.4, title } = {}) {
  const m = Math.min(w, d);
  const topT = Math.max(0.03, h * 0.09);
  const topZ = h - topT;
  return manifest(title, {
    lathes: legSet({ w, d, topZ, inset: m * 0.12, topR: m * 0.035, footR: m * 0.026, tint: WOOD.leg }),
    extrudes: [
      box(0, 0, topZ, h, w, d, WOOD.top, m * 0.08, 5),                                                // top
      box(0, 0, h * 0.30, h * 0.30 + topT * 0.7, w * 0.84, d * 0.78, WOOD.dark, m * 0.04, 3),         // shelf
      box(-w * 0.22, d * 0.05, h, h + topT * 0.9, w * 0.2, d * 0.28, '#4a5a7a', 0.004),               // book stack
      box(-w * 0.22, d * 0.05, h + topT * 0.9, h + topT * 1.7, w * 0.18, d * 0.26, '#a9473d', 0.004),
    ],
  });
}

/** Media console — a low cabinet with two doors around an open shelf, a TV standing on it. */
export function buildMediaConsoleWorkbenchManifest({ w = 6, d = 1.8, h = 2.2, title } = {}) {
  const fy = d / 2;
  const bodyZ0 = h * 0.1;
  const tvW = Math.min(w * 0.62, h * 2.4);
  const tvH = tvW * 0.56;
  const tvZ0 = h + h * 0.06;
  return manifest(title, {
    extrudes: [
      box(0, 0, 0, bodyZ0, w * 0.92, d * 0.86, WOOD.black),                                           // plinth (recessed)
      box(0, 0, bodyZ0, h * 0.96, w, d, WOOD.walnut, 0.01),                                           // carcass
      box(0, 0, h * 0.96, h, w + d * 0.04, d + d * 0.04, WOOD.light, 0.01),                          // top
      box(-w * 0.31, fy + 0.012, h * 0.18, h * 0.9, w * 0.34, 0.03, WOOD.body, 0.006),                // door L
      box(w * 0.31, fy + 0.012, h * 0.18, h * 0.9, w * 0.34, 0.03, WOOD.body, 0.006),                 // door R
      box(0, fy - d * 0.05, h * 0.18, h * 0.9, w * 0.26, d * 0.1, '#1f1b18'),                        // open shelf recess
      box(0, fy - d * 0.02, h * 0.5, h * 0.53, w * 0.25, d * 0.06, WOOD.dark),                       // shelf inside the recess
      box(-w * 0.16, fy + 0.03, h * 0.5, h * 0.62, w * 0.012, 0.02, WOOD.handle),                    // handles
      box(w * 0.16, fy + 0.03, h * 0.5, h * 0.62, w * 0.012, 0.02, WOOD.handle),
      box(0, -d * 0.12, h, tvZ0, w * 0.12, d * 0.3, WOOD.black, 0.004),                              // TV foot
      box(0, -d * 0.12, tvZ0, tvZ0 + tvH, tvW, Math.max(0.03, d * 0.03), '#2b2e33', 0.004),          // bezel
      box(0, -d * 0.12 + d * 0.02, tvZ0 + tvH * 0.05, tvZ0 + tvH * 0.95, tvW * 0.95, Math.max(0.03, d * 0.03), '#12161c', 0.002),   // screen
    ],
  });
}

/** Bookcase — sides, back, bays of shelves, and rows of books that read from across the room. */
export function buildBookcaseWorkbenchManifest({ w = 3, d = 1.2, h = 6, title } = {}) {
  const sideT = Math.max(0.05, w * 0.05);
  const shelfT = Math.max(0.035, h * 0.012);
  const y0 = -d / 2;
  const bays = Math.max(3, Math.min(5, Math.round(h / 1.35)));
  const plinth = h * 0.05;
  const bayH = (h - plinth - shelfT * (bays + 1)) / bays;
  const bayW = w - sideT * 2;
  const palette = ['#7a3b2e', '#3f5a7d', '#8b7a3c', '#4d6b4a', '#a04a3a', '#2e3e55', '#b08a4f', '#6c4d7a', '#5c5c5c', '#c1b28f'];
  const parts = [
    box(0, y0 + 0.03, 0, h, w, 0.06, WOOD.dark),                                                     // back panel
    box(-(w / 2 - sideT / 2), 0, 0, h, sideT, d, WOOD.body),                                          // sides
    box(w / 2 - sideT / 2, 0, 0, h, sideT, d, WOOD.body),
    box(0, 0, 0, plinth, bayW, d * 0.9, WOOD.dark),                                                   // plinth
    box(0, 0, h - shelfT, h, w, d, WOOD.body),                                                        // top
  ];
  for (let b = 0; b < bays; b += 1) {
    const zShelf = plinth + b * (bayH + shelfT);
    parts.push(box(0, 0, zShelf, zShelf + shelfT, bayW, d * 0.96, WOOD.light));                     // shelf
    // books: fill the bay left → right with hashed widths / heights / spines, an occasional gap
    let x = -bayW / 2 + bayW * 0.04;
    const right = bayW / 2 - bayW * 0.04;
    for (let s = 0; s < 14 && x < right; s += 1) {
      const bw = bayW * (0.055 + 0.05 * hash01(b, s, 1));
      if (x + bw > right) break;
      if (hash01(b, s, 4) < 0.12 && s > 0) { x += bw * 0.9; continue; }                              // a gap on the shelf
      const bh = bayH * (0.5 + 0.38 * hash01(b, s, 2));
      const tint = palette[Math.floor(hash01(b, s, 3) * palette.length) % palette.length];
      parts.push(box(x + bw / 2, -d * 0.08, zShelf + shelfT, zShelf + shelfT + bh, bw * 0.92, d * 0.62, tint));
      x += bw;
    }
  }
  return manifest(title, { extrudes: parts });
}

/** Platform bed — frame on block feet, mattress, a duvet over the foot two-thirds, pillows, headboard. */
export function buildPlatformBedWorkbenchManifest({ w = 5, d = 6.7, h = 1.8, title } = {}) {
  const m = Math.min(w, d);
  const y0 = -d / 2;
  const frameZ0 = h * 0.18;
  const frameZ1 = h * 0.45;
  const mattZ1 = h * 0.8;
  const duvetZ1 = h * 0.93;
  const mattress = '#e9e4d8', duvet = '#8a9bb0', duvetLt = '#a3b2c4', pillow = '#f4f1ea';
  const pillows = w >= 4.2
    ? [box(-w * 0.24, y0 + d * 0.16, mattZ1, duvetZ1, w * 0.4, d * 0.13, pillow, m * 0.03, 4), box(w * 0.24, y0 + d * 0.16, mattZ1, duvetZ1, w * 0.4, d * 0.13, pillow, m * 0.03, 4)]
    : [box(0, y0 + d * 0.16, mattZ1, duvetZ1, w * 0.7, d * 0.13, pillow, m * 0.03, 4)];
  return manifest(title, {
    extrudes: [
      box(-(w / 2 - w * 0.08), -(d / 2 - d * 0.06), 0, frameZ0, w * 0.08, d * 0.06, WOOD.black),    // block feet
      box(w / 2 - w * 0.08, -(d / 2 - d * 0.06), 0, frameZ0, w * 0.08, d * 0.06, WOOD.black),
      box(-(w / 2 - w * 0.08), d / 2 - d * 0.06, 0, frameZ0, w * 0.08, d * 0.06, WOOD.black),
      box(w / 2 - w * 0.08, d / 2 - d * 0.06, 0, frameZ0, w * 0.08, d * 0.06, WOOD.black),
      box(0, 0, frameZ0, frameZ1, w, d, WOOD.walnut, m * 0.015, 3),                                   // frame
      box(0, d * 0.015, frameZ1, mattZ1, w * 0.94, d * 0.92, mattress, m * 0.03, 4),                  // mattress
      box(0, d * 0.16, mattZ1, duvetZ1, w * 0.98, d * 0.62, duvet, m * 0.03, 4),                      // duvet
      box(0, -d * 0.15, mattZ1, duvetZ1 + h * 0.02, w * 0.98, d * 0.07, duvetLt, m * 0.02, 3),        // folded edge
      ...pillows,
      box(0, y0 + 0.06, frameZ0, h * 1.9, w * 1.02, Math.max(0.06, d * 0.02), WOOD.dark, 0.02, 3),    // headboard
    ],
  });
}

/** Nightstand — a one-drawer cabinet on short legs with a lamp on top. */
export function buildNightstandWorkbenchManifest({ w = 1.8, d = 1.6, h = 2.2, title } = {}) {
  const m = Math.min(w, d);
  const legH = h * 0.08;
  const cabZ1 = h * 0.56;
  const fy = d / 2;
  const shade = '#efe6cf';
  return manifest(title, {
    lathes: [
      ...legSet({ w, d, topZ: legH + 0.01, inset: m * 0.1, topR: m * 0.035, footR: m * 0.028, tint: WOOD.leg }),
      buildLeg({ foot: [0, -d * 0.05, cabZ1], top: [0, -d * 0.05, cabZ1 + h * 0.05], footRadius: m * 0.14, topRadius: m * 0.05, tint: WOOD.black }),   // lamp base
      buildLeg({ foot: [0, -d * 0.05, cabZ1 + h * 0.05], top: [0, -d * 0.05, cabZ1 + h * 0.26], footRadius: m * 0.02, topRadius: m * 0.02, tint: WOOD.handle }),   // stem
      buildLeg({ foot: [0, -d * 0.05, cabZ1 + h * 0.24], top: [0, -d * 0.05, h], footRadius: m * 0.19, topRadius: m * 0.13, samples: 10, tint: shade }),   // shade
    ],
    extrudes: [
      box(0, 0, legH, cabZ1 - h * 0.02, w, d, WOOD.body, 0.01),                                       // carcass
      box(0, 0, cabZ1 - h * 0.02, cabZ1, w + m * 0.04, d + m * 0.04, WOOD.light, 0.01),               // top
      box(0, fy + 0.012, legH + h * 0.1, cabZ1 - h * 0.1, w * 0.82, 0.03, WOOD.top, 0.006),           // drawer front
      box(0, fy + 0.03, legH + h * 0.28, legH + h * 0.32, w * 0.3, 0.02, WOOD.handle),                // pull
    ],
  });
}

/** Low dresser — a plinth-based chest with two rows of three drawers. */
export function buildLowDresserWorkbenchManifest({ w = 5, d = 1.8, h = 3.2, title } = {}) {
  const fy = d / 2;
  const plinth = h * 0.07;
  const rows = 2, cols = 3;
  const dz0 = plinth + h * 0.05, dz1 = h * 0.94;
  const rowH = (dz1 - dz0) / rows;
  const colW = w * 0.94 / cols;
  const drawers = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cx = -w * 0.47 + colW * (c + 0.5);
      const z0 = dz0 + r * rowH + rowH * 0.06, z1 = dz0 + (r + 1) * rowH - rowH * 0.06;
      drawers.push(box(cx, fy + 0.012, z0, z1, colW * 0.9, 0.03, WOOD.light, 0.006));
      drawers.push(box(cx, fy + 0.03, (z0 + z1) / 2 - h * 0.015, (z0 + z1) / 2 + h * 0.015, colW * 0.34, 0.02, WOOD.handle));
    }
  }
  return manifest(title, {
    extrudes: [
      box(0, 0, 0, plinth, w * 0.94, d * 0.9, WOOD.black),                                            // plinth
      box(0, 0, plinth, h * 0.97, w, d, WOOD.body, 0.01),                                             // carcass
      box(0, 0, h * 0.97, h, w + d * 0.04, d + d * 0.04, WOOD.top, 0.01),                            // top
      ...drawers,
    ],
  });
}

/** Sideboard — a long cabinet on tapered legs: two doors flanking a stack of drawers. */
export function buildSideboardWorkbenchManifest({ w = 6, d = 1.8, h = 3, title } = {}) {
  const m = Math.min(w, d);
  const fy = d / 2;
  const legH = h * 0.16;
  const bodyZ1 = h * 0.96;
  const doorW = w * 0.3, midW = w * 0.3;
  const dz0 = legH + h * 0.06, dz1 = bodyZ1 - h * 0.06;
  const drawerH = (dz1 - dz0) / 3;
  return manifest(title, {
    lathes: legSet({ w, d, topZ: legH + 0.01, inset: m * 0.12, topR: m * 0.04, footR: m * 0.028, tint: WOOD.black }),
    extrudes: [
      box(0, 0, legH, bodyZ1, w, d, WOOD.walnut, 0.01),                                               // carcass
      box(0, 0, bodyZ1, h, w + d * 0.04, d + d * 0.04, WOOD.light, 0.01),                            // top
      box(-(midW / 2 + doorW / 2), fy + 0.012, dz0, dz1, doorW * 0.94, 0.03, WOOD.body, 0.006),       // door L
      box(midW / 2 + doorW / 2, fy + 0.012, dz0, dz1, doorW * 0.94, 0.03, WOOD.body, 0.006),          // door R
      ...[0, 1, 2].map((i) => box(0, fy + 0.012, dz0 + i * drawerH + drawerH * 0.06, dz0 + (i + 1) * drawerH - drawerH * 0.06, midW * 0.94, 0.03, WOOD.body, 0.006)),
      ...[0, 1, 2].map((i) => box(0, fy + 0.03, dz0 + (i + 0.5) * drawerH - h * 0.012, dz0 + (i + 0.5) * drawerH + h * 0.012, midW * 0.3, 0.02, WOOD.handle)),
      box(-(midW / 2 + doorW * 0.15), fy + 0.03, (dz0 + dz1) / 2 - h * 0.05, (dz0 + dz1) / 2 + h * 0.05, w * 0.012, 0.02, WOOD.handle),   // door pulls
      box(midW / 2 + doorW * 0.15, fy + 0.03, (dz0 + dz1) / 2 - h * 0.05, (dz0 + dz1) / 2 + h * 0.05, w * 0.012, 0.02, WOOD.handle),
    ],
  });
}

/** Dining table — a thick plank top on aprons over four tapered legs. */
export function buildDiningTableWorkbenchManifest({ w = 6, d = 3.5, h = 2.4, title } = {}) {
  const m = Math.min(w, d);
  const topT = Math.max(0.04, h * 0.06);
  const topZ = h - topT;
  const apronT = Math.max(0.04, d * 0.04);
  const apronDrop = h * 0.12;
  return manifest(title, {
    lathes: legSet({ w, d, topZ, inset: m * 0.1, topR: m * 0.04, footR: m * 0.028, tint: WOOD.leg }),
    extrudes: [
      box(0, 0, topZ, h, w, d, WOOD.top, m * 0.04, 4),                                                // top
      box(0, d / 2 - apronT / 2 - m * 0.08, topZ - apronDrop, topZ, w * 0.82, apronT, WOOD.dark),      // aprons
      box(0, -(d / 2 - apronT / 2 - m * 0.08), topZ - apronDrop, topZ, w * 0.82, apronT, WOOD.dark),
      box(w / 2 - apronT / 2 - m * 0.08, 0, topZ - apronDrop, topZ, apronT, d * 0.8, WOOD.dark),
      box(-(w / 2 - apronT / 2 - m * 0.08), 0, topZ - apronDrop, topZ, apronT, d * 0.8, WOOD.dark),
    ],
  });
}

/** Floor lamp — a weighted disc, a thin pole, a drum shade. Practical interior light as geometry. */
export function buildFloorLampWorkbenchManifest({ w = 1.1, d = 1.1, h = 5.4, title } = {}) {
  const m = Math.min(w, d);
  const poleR = Math.max(0.03, m * 0.045);
  const baseH = h * 0.04;
  const shadeZ0 = h * 0.78;
  const shadeZ1 = h * 0.98;
  const shadeR = m * 0.42;
  const brass = '#c4a574', dark = '#2b2724', shade = '#f0e6c8', shadeIn = '#fff6d6';
  const cyl = (z0, z1, radius, tint, samples = 12) => ({
    axisFrom: { x: 0, y: 0, z: z0 }, axisTo: { x: 0, y: 0, z: z1 },
    profile: [{ t: 0, radius }, { t: 1, radius }], tint, samples,
  });
  return manifest(title, {
    lathes: [
      cyl(0, baseH, m * 0.38, dark, 12),
      cyl(baseH, shadeZ0, poleR, brass, 8),
      cyl(shadeZ0, shadeZ1, shadeR, shade, 14),
      cyl(shadeZ0 + (shadeZ1 - shadeZ0) * 0.15, shadeZ1 - (shadeZ1 - shadeZ0) * 0.12, shadeR * 0.82, shadeIn, 12),
    ],
  });
}

/** Bordered rug — a pile field inside a darker border with a centre medallion; a plane, not a slab. */
export function buildBorderedRugWorkbenchManifest({ w = 10, d = 7, h = 0.06, title } = {}) {
  const border = '#5e3128', field = '#8a4a3c', accent = '#b8836a';
  return manifest(title, {
    extrudes: [
      box(0, 0, 0, h * 0.7, w, d, border, 0.01),                                                      // border (full)
      box(0, 0, 0, h * 0.9, w * 0.86, d * 0.82, field, 0.01),                                         // field
      box(0, 0, 0, h, w * 0.5, d * 0.44, accent, 0.01),                                               // medallion
      box(0, 0, 0, h * 1.05, w * 0.26, d * 0.2, field, 0.01),                                         // medallion core
    ],
  });
}
