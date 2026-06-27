/**
 * room-assets — workbench-authored room furniture.
 *
 * These are richer silhouettes than the box-net furniture cards. The room planner still owns
 * placement; an asset receives the resolved floor footprint and emits workbench faces in the same
 * world coordinate frame as the room.
 */

import { workbenchAssetFaces } from './workbench.js';
import { buildLeg, buildSlab } from './room-parts.js';

const mix = (a, b, t) => a + (b - a) * t;

export function buildModernCouchWorkbenchManifest({ x = 0, y = 0, z = 0, w = 3.6, d = 1.32, h = 0.82, title } = {}) {
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const y0 = y - d / 2;
  const y1 = y + d / 2;
  const z0 = z;
  const cx = (x0 + x1) / 2;
  const legH = Math.min(0.22, Math.max(0.14, h * 0.27));
  const seatH = Math.max(0.20, h * 0.33);
  const backH = Math.max(0.68, h * 0.98);
  const armH = Math.max(seatH + 0.18, h * 0.72);
  const seatZ0 = z0 + legH;
  const seatZ1 = seatZ0 + seatH;
  const seatZTop = seatZ0 + seatH * 0.67;
  const pad = Math.min(w, d) * 0.045;
  const cushionGap = Math.max(0.025, w * 0.012);
  const armW = Math.min(w * 0.115, 0.28);
  const backD = Math.min(d * 0.16, 0.26);
  const seatD = Math.max(0.08, d - backD - pad * 1.8);
  const seatY = y0 + backD + seatD / 2 + pad * 0.35;
  const legTopR = Math.min(w, d) * 0.026;
  const legBotR = legTopR * 0.58;
  const legLean = Math.min(w, d) * 0.09;
  const leather = '#a85f2f';
  const leatherDark = '#78401f';
  const leatherLight = '#c57a43';
  const cover = '#b66b38';
  const coverLight = '#c87d45';
  const coverDark = '#87451f';
  const shadow = '#3b2116';
  const leg = (x, y, sx, sy, tint = '#5a2f1c') => buildLeg({
    foot: [x + sx * legLean, y + sy * legLean, z0],
    top: [x, y, seatZ0 + 0.02],
    footRadius: legBotR,
    topRadius: legTopR,
    tint,
  });
  const cushion = (x, width, tint) => ({
    axisFrom: { x, y: seatY, z: seatZ0 },
    axisTo: { x, y: seatY, z: seatZTop },
    profile: { rect: { w: Math.max(0.05, width), h: seatD, r: Math.min(0.10, d * 0.09) } },
    tint,
    cornerSamples: 6,
  });
  const backCushion = (x, width, tint) => ({
    axisFrom: { x, y: y0 + backD / 2, z: seatZ0 + 0.03 },
    axisTo: { x, y: y0 + backD / 2, z: z0 + backH },
    profile: { rect: { w: Math.max(0.05, width), h: backD, r: Math.min(0.10, backD * 0.45) } },
    tint,
    cornerSamples: 6,
  });
  const cushionCover = (x, width, tint = coverLight) => ({
    axisFrom: { x, y: seatY, z: seatZ0 - 0.016 },
    axisTo: { x, y: seatY, z: seatZTop + 0.036 },
    profile: { rect: { w: Math.max(0.05, width + cushionGap * 0.7), h: seatD + pad * 0.65, r: Math.min(0.13, d * 0.11) } },
    tint,
    cornerSamples: 8,
  });
  const topCover = (x, y, z, tw, td, tint = coverLight) => ({
    axisFrom: { x, y, z },
    axisTo: { x, y, z: z + 0.014 },
    profile: { rect: { w: tw, h: td, r: Math.min(0.055, Math.min(tw, td) * 0.18) } },
    tint,
    cornerSamples: 4,
  });
  const seatDeckCover = (x, width, tint = coverLight) => topCover(
    x,
    (y0 + backD + y1) / 2,
    seatZTop + 0.054,
    Math.max(0.05, width + cushionGap * 0.85),
    Math.max(0.05, y1 - (y0 + backD) + pad * 0.18),
    tint,
  );
  const backCover = (x, width, tint = cover) => ({
    axisFrom: { x, y: y0 + backD / 2, z: seatZ0 + 0.005 },
    axisTo: { x, y: y0 + backD / 2, z: z0 + backH + 0.024 },
    profile: { rect: { w: Math.max(0.05, width + cushionGap * 0.7), h: backD + pad * 0.42, r: Math.min(0.12, backD * 0.56) } },
    tint,
    cornerSamples: 8,
  });
  const armCover = (x, tint = cover) => ({
    axisFrom: { x, y: (y0 + y1) / 2, z: seatZ0 - 0.018 },
    axisTo: { x, y: (y0 + y1) / 2, z: z0 + armH + 0.03 },
    profile: { rect: { w: armW + pad * 0.55, h: Math.max(0.05, d - pad * 0.52), r: Math.min(0.10, armW * 0.58) } },
    tint,
    cornerSamples: 8,
  });
  const skirt = (x, y, w, h, tint = coverDark) => ({
    axisFrom: { x, y, z: z0 + legH * 0.64 },
    axisTo: { x, y, z: z0 + legH * 1.02 },
    profile: { rect: { w, h, r: Math.min(0.018, Math.min(w, h) * 0.32) } },
    tint,
    cornerSamples: 2,
  });
  const line = (x, y, zA, zB, tint = leatherDark, wiggle = 0.018) => ({
    path: [[x, y, zA], [x + wiggle, y + 0.006, (zA + zB) / 2], [x - wiggle * 0.45, y, zB]],
    radius: Math.max(0.004, Math.min(w, d) * 0.004),
    sides: 5,
    tint,
    caps: true,
  });
  const seatWidth = (w - armW * 2 - cushionGap * 3) / 2;
  const leftSeatX = x0 + armW + cushionGap + seatWidth / 2;
  const rightSeatX = x1 - armW - cushionGap - seatWidth / 2;
  const wrinkleXs = [
    leftSeatX - seatWidth * 0.20, leftSeatX + seatWidth * 0.12,
    rightSeatX - seatWidth * 0.14, rightSeatX + seatWidth * 0.20,
  ];
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    viewBox: { width: 1280, height: 860 },
    extrudes: [
      cushion(leftSeatX, seatWidth, leatherLight),
      cushion(rightSeatX, seatWidth, leatherLight),
      backCushion(leftSeatX, seatWidth, leather),
      backCushion(rightSeatX, seatWidth, leather),
      {
        axisFrom: { x: x0 + armW / 2, y: (y0 + y1) / 2, z: seatZ0 },
        axisTo: { x: x0 + armW / 2, y: (y0 + y1) / 2, z: z0 + armH },
        profile: { rect: { w: armW, h: Math.max(0.05, d - pad), r: Math.min(0.08, armW * 0.45) } },
        tint: leather,
        cornerSamples: 6,
      },
      {
        axisFrom: { x: x1 - armW / 2, y: (y0 + y1) / 2, z: seatZ0 },
        axisTo: { x: x1 - armW / 2, y: (y0 + y1) / 2, z: z0 + armH },
        profile: { rect: { w: armW, h: Math.max(0.05, d - pad), r: Math.min(0.08, armW * 0.45) } },
        tint: leather,
        cornerSamples: 6,
      },
      {
        axisFrom: { x: cx, y: (y0 + y1) / 2, z: z0 + legH * 0.76 },
        axisTo: { x: cx, y: (y0 + y1) / 2, z: z0 + legH * 0.93 },
        profile: { rect: { w: w - pad * 0.6, h: Math.max(0.05, d - pad * 0.8), r: 0.02 } },
        tint: shadow,
        cornerSamples: 2,
      },
      cushionCover(leftSeatX, seatWidth, coverLight),
      cushionCover(rightSeatX, seatWidth, coverLight),
      seatDeckCover(leftSeatX, seatWidth, '#d08a4d'),
      seatDeckCover(rightSeatX, seatWidth, '#d08a4d'),
      backCover(leftSeatX, seatWidth, cover),
      backCover(rightSeatX, seatWidth, cover),
      armCover(x0 + armW / 2, cover),
      armCover(x1 - armW / 2, cover),
      topCover(x0 + armW / 2, (y0 + y1) / 2, z0 + armH + 0.032, armW + pad * 0.40, Math.max(0.05, d - pad * 0.42), coverLight),
      topCover(x1 - armW / 2, (y0 + y1) / 2, z0 + armH + 0.032, armW + pad * 0.40, Math.max(0.05, d - pad * 0.42), coverLight),
      skirt(cx, y1 + pad * 0.16, Math.max(0.05, w - pad * 0.25), 0.072, coverDark),
      skirt(cx, y0 + backD * 0.18, Math.max(0.05, w - pad * 0.80), 0.052, leatherDark),
      skirt(x0 + armW / 2, (y0 + y1) / 2, armW + pad * 0.34, Math.max(0.05, d - pad * 0.62), coverDark),
      skirt(x1 - armW / 2, (y0 + y1) / 2, armW + pad * 0.34, Math.max(0.05, d - pad * 0.62), coverDark),
      {
        axisFrom: { x: cx, y: y1 - pad * 0.9, z: seatZ0 + seatH * 0.24 },
        axisTo: { x: cx, y: y1 - pad * 0.9, z: seatZ0 + seatH * 0.31 },
        profile: { rect: { w: Math.max(0.04, w - armW * 2 - pad), h: 0.018, r: 0.004 } },
        tint: leatherDark,
        cornerSamples: 2,
      },
      {
        axisFrom: { x: cx, y: y0 + backD + 0.015, z: seatZ0 },
        axisTo: { x: cx, y: y0 + backD + 0.015, z: z0 + backH * 0.98 },
        profile: { rect: { w: 0.026, h: 0.025, r: 0.004 } },
        tint: shadow,
        cornerSamples: 2,
      },
    ],
    lathes: [
      leg(mix(x0, x1, 0.08), mix(y0, y1, 0.86), -1, 1),
      leg(mix(x0, x1, 0.92), mix(y0, y1, 0.86), 1, 1),
      leg(mix(x0, x1, 0.50), mix(y0, y1, 0.82), 0, 1, '#17120f'),
      leg(mix(x0, x1, 0.12), mix(y0, y1, 0.20), -0.6, -0.7),
      leg(mix(x0, x1, 0.88), mix(y0, y1, 0.20), 0.6, -0.7),
    ],
    sweeps: [
      ...wrinkleXs.flatMap((x, i) => [
        line(x, y0 + backD + 0.024, seatZ0 + 0.26, z0 + backH - 0.12, i % 2 ? leatherDark : leatherLight, i % 2 ? -0.014 : 0.018),
        line(x + seatWidth * 0.05, y1 - pad * 1.1, seatZTop + 0.014, seatZTop + 0.07, leatherDark, 0.012),
      ]),
    ],
  };
}

/**
 * Dining / side chair — seating family keystone (room-assets.plan.md, build order #3). The couch's
 * seat-plane pattern at chair scale: four tapered turned legs, a rounded seat slab, two raked back
 * posts, and a top rail + mid slat between them. Authored from the shared `buildLeg` / `buildSlab`
 * parts. `h` is the TOTAL height (top of the back); the seat surface sits at ~half that.
 */
export function buildDiningChairWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.46, d = 0.5, h = 0.92, title } = {}) {
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const y0 = y - d / 2;   // back edge (faces the wall, as on the couch)
  const y1 = y + d / 2;   // front edge (where you sit)
  const z0 = z;

  const seatTopZ = z0 + Math.min(0.48, h * 0.5);   // ergonomic seat surface height
  const seatThick = Math.min(0.06, h * 0.07);
  const m = Math.min(w, d);

  const legTopR = m * 0.08;                          // widened ~2.5× — substantial turned legs, not spindles
  const legBotR = legTopR * 0.72;                    // gentler taper so the foot stays chunky
  const legInsetX = w * 0.13;
  const legInsetY = d * 0.13;
  const splay = m * 0.16;                            // rake the feet down-and-out for a longer, grounded leg

  const postW = w * 0.085;                           // back-post cross section
  const postD = d * 0.085;
  const rakeBack = d * 0.12;                          // back leans away from the sitter as it rises
  const postCY = y0 + postD / 2 + d * 0.02;
  const postCX = (sx) => x + sx * (w / 2 - postW / 2 - w * 0.02);

  const wood = '#8a5a32';
  const woodDark = '#6e4524';
  const woodLight = '#9c6a3c';
  const woodSeat = '#a4733f';

  const leg = (sx, sy) => buildLeg({
    foot: [x + sx * (w / 2 - legInsetX) + sx * splay, y + sy * (d / 2 - legInsetY) + sy * splay, z0],
    top: [x + sx * (w / 2 - legInsetX), y + sy * (d / 2 - legInsetY), seatTopZ - seatThick * 0.5],  // tucked into the seat underside — no poke-through above the seat
    footRadius: legBotR,
    topRadius: legTopR,
    tint: sy < 0 ? woodDark : wood,                  // front legs catch a touch more light
  });

  const post = (sx) => buildSlab({
    x: postCX(sx),
    y: postCY,
    z0: seatTopZ - seatThick,
    z1: z0 + h,
    to: [postCX(sx), postCY - rakeBack],
    w: postW,
    d: postD,
    r: postW * 0.32,
    tint: wood,
  });

  const backWidth = Math.abs(postCX(1) - postCX(-1)) + postW * 0.6;
  const backCX = x;
  const backTopZ = z0 + h;
  // a back cross-member centred at world height `zc`, raked to follow the posts (so it stays flush
  // against them). Pass the centre directly so the top rail can sit flush with the back top.
  const backRail = (zc, thick, tint) => {
    const frac = (zc - seatTopZ) / (backTopZ - seatTopZ);
    const yc = postCY - rakeBack * frac;
    return buildSlab({ x: backCX, y: yc, z0: zc - thick / 2, z1: zc + thick / 2, w: backWidth, d: postD * 0.7, r: postD * 0.2, tint });
  };
  const topThick = seatThick * 1.1;
  const midThick = seatThick * 0.85;

  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    viewBox: { width: 900, height: 900 },
    lathes: [
      leg(-1, 1), leg(1, 1),     // back legs
      leg(-1, -1), leg(1, -1),   // front legs
    ],
    extrudes: [
      // seat slab
      buildSlab({
        x, y: y + d * 0.02, z0: seatTopZ - seatThick, z1: seatTopZ,
        w: w * 0.96, d: d * 0.9, r: Math.min(0.04, m * 0.08), tint: woodSeat,
      }),
      post(-1), post(1),
      backRail(backTopZ - topThick / 2, topThick, woodLight),               // top rail, flush with back top
      backRail(seatTopZ + (backTopZ - seatTopZ) * 0.42, midThick, wood),    // mid slat
    ],
  };
}

// Table / desk families — local frame, centered x/y, z=0 at floor, front=+y.
const DESK = {
  top: '#9a6a3d', edge: '#6f4728', leg: '#5a3a22', dark: '#2d2925',
  metal: '#6f777c', shelf: '#7c5331', drawer: '#8b5f38',
};

function buildTableLegSet({ x = 0, y = 0, z = 0, w, d, topZ, topRadius, footRadius, inset = 0.10, tint = DESK.leg } = {}) {
  const ix = Math.max(0.04, Math.min(w * 0.22, inset));
  const iy = Math.max(0.04, Math.min(d * 0.22, inset));
  return [-1, 1].flatMap((sx) => [-1, 1].map((sy) => buildLeg({
    foot: [x + sx * (w / 2 - ix), y + sy * (d / 2 - iy), z],
    top: [x + sx * (w / 2 - ix * 0.9), y + sy * (d / 2 - iy * 0.9), topZ],
    topRadius,
    footRadius,
    tint,
  })));
}

function tableAprons({ x = 0, y = 0, z, w, d, thick, drop, tint = DESK.edge } = {}) {
  return [
    buildSlab({ x, y: y + d / 2 - thick / 2, z0: z - drop, z1: z, w: w, d: thick, r: 0.008, tint, cornerSamples: 2 }),
    buildSlab({ x, y: y - d / 2 + thick / 2, z0: z - drop, z1: z, w: w, d: thick, r: 0.008, tint, cornerSamples: 2 }),
    buildSlab({ x: x - w / 2 + thick / 2, y, z0: z - drop, z1: z, w: thick, d: d, r: 0.008, tint, cornerSamples: 2 }),
    buildSlab({ x: x + w / 2 - thick / 2, y, z0: z - drop, z1: z, w: thick, d: d, r: 0.008, tint, cornerSamples: 2 }),
  ];
}

export function buildStudyTableWorkbenchManifest({ x = 0, y = 0, z = 0, w = 1.15, d = 0.62, h = 0.76, title } = {}) {
  const topT = Math.max(0.045, h * 0.075);
  const topZ = z + h - topT;
  const r = Math.min(w, d) * 0.022;
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    lathes: buildTableLegSet({ x, y, z, w, d, topZ, topRadius: r, footRadius: r * 0.72, inset: Math.min(w, d) * 0.13 }),
    extrudes: [
      buildSlab({ x, y, z0: topZ, z1: z + h, w, d, r: Math.min(0.035, d * 0.06), tint: DESK.top, cornerSamples: 5 }),
      ...tableAprons({ x, y, z: topZ, w, d, thick: Math.min(0.07, d * 0.12), drop: Math.min(0.11, h * 0.16) }),
      buildSlab({ x, y: y - d * 0.36, z0: z + h * 0.36, z1: z + h * 0.52, w: w * 0.52, d: d * 0.055, r: 0.006, tint: DESK.drawer, cornerSamples: 2 }),
      buildSlab({ x, y: y - d * 0.39, z0: z + h * 0.41, z1: z + h * 0.45, w: w * 0.22, d: d * 0.035, r: 0.004, tint: DESK.metal, cornerSamples: 2 }),
    ],
  };
}

export function buildStandingDeskWorkbenchManifest({ x = 0, y = 0, z = 0, w = 1.2, d = 0.66, h = 1.10, title } = {}) {
  const topT = Math.max(0.050, h * 0.05);
  const topZ = z + h - topT;
  const footBarZ = z + h * 0.16;
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    extrudes: [
      buildSlab({ x, y, z0: topZ, z1: z + h, w, d, r: Math.min(0.035, d * 0.06), tint: '#8d643e', cornerSamples: 5 }),
      buildSlab({ x: x - w * 0.36, y, z0: z, z1: topZ, w: w * 0.075, d: d * 0.72, r: 0.014, tint: DESK.metal, cornerSamples: 3 }),
      buildSlab({ x: x + w * 0.36, y, z0: z, z1: topZ, w: w * 0.075, d: d * 0.72, r: 0.014, tint: DESK.metal, cornerSamples: 3 }),
      buildSlab({ x, y, z0: footBarZ, z1: footBarZ + h * 0.035, w: w * 0.82, d: d * 0.055, r: 0.010, tint: DESK.dark, cornerSamples: 2 }),
      buildSlab({ x, y: y - d * 0.43, z0: topZ - h * 0.11, z1: topZ - h * 0.07, w: w * 0.62, d: d * 0.055, r: 0.006, tint: DESK.dark, cornerSamples: 2 }),
    ],
  };
}

export function buildComputerTableWorkbenchManifest({ x = 0, y = 0, z = 0, w = 1.35, d = 0.72, h = 0.78, title } = {}) {
  const topT = Math.max(0.045, h * 0.07);
  const topZ = z + h - topT;
  const r = Math.min(w, d) * 0.019;
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    lathes: buildTableLegSet({ x, y, z, w, d, topZ, topRadius: r, footRadius: r * 0.76, inset: Math.min(w, d) * 0.12, tint: DESK.metal }),
    extrudes: [
      buildSlab({ x, y, z0: topZ, z1: z + h, w, d, r: Math.min(0.03, d * 0.045), tint: '#78604a', cornerSamples: 4 }),
      ...tableAprons({ x, y, z: topZ, w, d, thick: Math.min(0.06, d * 0.08), drop: Math.min(0.09, h * 0.12), tint: DESK.dark }),
      buildSlab({ x, y: y - d * 0.31, z0: z + h + 0.055, z1: z + h + 0.095, w: w * 0.54, d: d * 0.20, r: 0.014, tint: DESK.shelf, cornerSamples: 3 }),
      buildSlab({ x: x - w * 0.20, y: y - d * 0.31, z0: z + h, z1: z + h + 0.06, w: w * 0.035, d: d * 0.15, r: 0.004, tint: DESK.dark, cornerSamples: 2 }),
      buildSlab({ x: x + w * 0.20, y: y - d * 0.31, z0: z + h, z1: z + h + 0.06, w: w * 0.035, d: d * 0.15, r: 0.004, tint: DESK.dark, cornerSamples: 2 }),
      buildSlab({ x, y: y + d * 0.37, z0: z + h * 0.48, z1: z + h * 0.52, w: w * 0.62, d: d * 0.045, r: 0.004, tint: '#33373b', cornerSamples: 2 }),
    ],
  };
}

export function buildLTableWorkbenchManifest({ x = 0, y = 0, z = 0, w = 1.45, d = 1.10, h = 0.76, title } = {}) {
  const topT = Math.max(0.045, h * 0.07);
  const topZ = z + h - topT;
  const longD = d * 0.46;
  const returnW = w * 0.45;
  const returnD = d;
  const legR = Math.min(w, d) * 0.018;
  const leg = (lx, ly) => buildLeg({
    foot: [x + lx, y + ly, z],
    top: [x + lx, y + ly, topZ],
    topRadius: legR,
    footRadius: legR * 0.72,
    tint: DESK.leg,
  });
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    lathes: [
      leg(-w * 0.43, -longD * 0.32), leg(w * 0.43, -longD * 0.32), leg(w * 0.43, longD * 0.32),
      leg(-returnW * 0.36, d * 0.42), leg(returnW * 0.36, d * 0.42), leg(-returnW * 0.36, -d * 0.42),
    ],
    extrudes: [
      buildSlab({ x, y: y - d * 0.17, z0: topZ, z1: z + h, w, d: longD, r: 0.025, tint: DESK.top, cornerSamples: 4 }),
      buildSlab({ x: x - w * 0.275, y, z0: topZ + topT * 0.08, z1: z + h + topT * 0.08, w: returnW, d: returnD, r: 0.025, tint: '#a37445', cornerSamples: 4 }),
      buildSlab({ x: x - w * 0.275, y: y + d * 0.05, z0: topZ - h * 0.12, z1: topZ - h * 0.08, w: returnW * 0.86, d: d * 0.05, r: 0.006, tint: DESK.edge, cornerSamples: 2 }),
      buildSlab({ x: x + w * 0.20, y: y - d * 0.39, z0: topZ - h * 0.12, z1: topZ - h * 0.08, w: w * 0.50, d: d * 0.045, r: 0.006, tint: DESK.edge, cornerSamples: 2 }),
    ],
  };
}

// ── Kitchen units — workbench assets authored in a CANONICAL LOCAL frame: centered
// in x,y; z runs 0..h up; FRONT = +y. The wall-run packer orients each unit via its
// footprint basis (see the `local` branch of roomFurnitureAssetFaces), so the SAME
// unit faces +y on the back wall and +x on a side wall — no per-axis manifest rotation
// (which would scramble extrude profile frames). All dims in metres.
const KIT = {
  cab: '#dcd6c8', door: '#d2ccbd', counter: '#ece9e3', kick: '#2a2620',
  // counter: polished marble slab — a cool off-white stone, lighter/cooler than the cream
  // cabinet so the worktop reads as stone (matches the floor-finish marble family).
  steel: '#aab0b4', steelDk: '#7f868a', black: '#26292e', cooktop: '#1f2226', knob: '#3a3e44',
};
const kbox = (x0, y0, z0, x1, y1, z1, profile, tint) => ({ axisFrom: { x: x0, y: y0, z: z0 }, axisTo: { x: x1, y: y1, z: z1 }, profile, tint });
const krect = (w, h, r) => ({ rect: r ? { w, h, r } : { w, h } });

function kitchenBaseCabExtrudes(w, d, h, { counter = true } = {}) {
  const fy = d / 2, dw = w / 2 - 0.03, dz0 = 0.12, dz1 = h - 0.10, dzc = (dz0 + dz1) / 2, dh = dz1 - dz0;
  const parts = [
    kbox(0, 0, 0, 0, 0, 0.09, krect(w - 0.08, d - 0.08), KIT.kick),                 // toe kick (recessed)
    kbox(0, 0, 0.09, 0, 0, h - 0.04, krect(w, d), KIT.cab),                          // carcass
    kbox(-w / 4, fy, dzc, -w / 4, fy + 0.02, dzc, krect(dw, dh, 0.01), KIT.door),    // door L
    kbox(w / 4, fy, dzc, w / 4, fy + 0.02, dzc, krect(dw, dh, 0.01), KIT.door),      // door R
    kbox(-0.03, fy + 0.02, 0.62, -0.03, fy + 0.03, 0.62, krect(0.02, 0.14), KIT.steel), // handle L
    kbox(0.03, fy + 0.02, 0.62, 0.03, fy + 0.03, 0.62, krect(0.02, 0.14), KIT.steel),   // handle R
  ];
  if (counter) parts.push(kbox(0, 0, h - 0.04, 0, 0, h, krect(w + 0.04, d + 0.04, 0.01), KIT.counter));
  return parts;
}

export function buildKitchenBaseCounter({ w = 0.8, d = 0.6, h = 0.9 } = {}) {
  return { kind: 'workbench', units: 'm', extrudes: kitchenBaseCabExtrudes(w, d, h) };
}

export function buildKitchenSinkUnit({ w = 0.84, d = 0.6, h = 0.9 } = {}) {
  const fy = d / 2, bw = Math.min(0.5, w * 0.6), bd = Math.min(0.34, d * 0.58);
  return {
    kind: 'workbench', units: 'm',
    extrudes: [
      ...kitchenBaseCabExtrudes(w, d, h, { counter: false }),
      // counter as 4 strips around the basin opening
      kbox(0, -d / 2 + 0.07, h - 0.04, 0, -d / 2 + 0.07, h, krect(w + 0.04, 0.14), KIT.counter),
      kbox(0, d / 2 - 0.07, h - 0.04, 0, d / 2 - 0.07, h, krect(w + 0.04, 0.14), KIT.counter),
      kbox(-w / 2 + 0.09, 0, h - 0.04, -w / 2 + 0.09, 0, h, krect(0.18, d + 0.02), KIT.counter),
      kbox(w / 2 - 0.09, 0, h - 0.04, w / 2 - 0.09, 0, h, krect(0.18, d + 0.02), KIT.counter),
      // recessed steel basin
      { ...kbox(0, 0, h - 0.16, 0, 0, h, krect(bw, bd, 0.03), KIT.steel), wallThickness: 0.03, openFace: 'to', innerTint: KIT.steelDk },
    ],
    sweeps: [
      { path: [[0, -0.18, h], [0, -0.18, h + 0.26], [0, -0.10, h + 0.30], [0, 0.04, h + 0.26], [0, 0.06, h + 0.18]], radius: 0.015, tint: KIT.steel },
    ],
  };
}

export function buildKitchenStove({ w = 0.76, d = 0.6, h = 0.9 } = {}) {
  const ct = h - 0.06, fy = d / 2;
  const burner = (bx, by, r) => ({ axisFrom: { x: bx, y: by, z: h }, axisTo: { x: bx, y: by, z: h + 0.015 }, profile: [{ t: 0, radius: r }, { t: 1, radius: r }], tint: '#15171a' });
  const knob = (kx2) => ({ axisFrom: { x: kx2, y: fy + 0.03, z: ct + 0.025 }, axisTo: { x: kx2, y: fy + 0.04, z: ct + 0.025 }, profile: [{ t: 0, radius: 0.022 }, { t: 1, radius: 0.022 }], tint: KIT.knob });
  return {
    kind: 'workbench', units: 'm',
    extrudes: [
      kbox(0, 0, 0, 0, 0, ct, krect(w, d), KIT.steel),                               // body
      kbox(0, 0, ct, 0, 0, h, krect(w + 0.02, d + 0.02, 0.01), KIT.cooktop),         // cooktop slab
      kbox(0, fy, 0.40, 0, fy + 0.02, 0.40, krect(w - 0.10, ct - 0.28, 0.01), KIT.black), // oven door
      kbox(0, fy + 0.01, ct, 0, fy + 0.03, ct, krect(w - 0.06, 0.08), '#1b1d20'),    // control panel
    ],
    lathes: [
      burner(-0.17, -0.14, 0.09), burner(0.17, -0.14, 0.09), burner(-0.17, 0.15, 0.08), burner(0.17, 0.15, 0.08),
      knob(-0.26), knob(-0.09), knob(0.09), knob(0.26),
    ],
    sweeps: [
      { path: [[-w / 2 + 0.10, fy + 0.03, ct - 0.12], [w / 2 - 0.10, fy + 0.03, ct - 0.12]], radius: 0.013, tint: KIT.steel }, // oven handle
    ],
  };
}

export function buildKitchenFridge({ w = 0.72, d = 0.7, h = 1.82 } = {}) {
  const fy = d / 2, split = h * 0.62;
  return {
    kind: 'workbench', units: 'm',
    extrudes: [
      kbox(0, 0, 0, 0, 0, h, krect(w, d, 0.02), KIT.steel),                          // body
      kbox(0, fy, (split + h) / 2, 0, fy + 0.02, (split + h) / 2, krect(w - 0.06, h - split - 0.04, 0.01), '#b6bcc0'), // fridge door (upper)
      kbox(0, fy, split / 2 + 0.03, 0, fy + 0.02, split / 2 + 0.03, krect(w - 0.06, split - 0.06, 0.01), '#b6bcc0'),  // freezer door (lower)
    ],
    sweeps: [
      { path: [[w / 2 - 0.10, fy + 0.02, (split + h) / 2 - 0.18], [w / 2 - 0.10, fy + 0.02, (split + h) / 2 + 0.18]], radius: 0.015, tint: KIT.steelDk },
      { path: [[w / 2 - 0.10, fy + 0.02, split / 2 - 0.18], [w / 2 - 0.10, fy + 0.02, split / 2 + 0.18]], radius: 0.015, tint: KIT.steelDk },
    ],
  };
}

export function buildKitchenUpperCupboard({ w = 0.8, d = 0.35, h = 0.7 } = {}) {
  const fy = d / 2, dw = w / 2 - 0.04;
  return {
    kind: 'workbench', units: 'm',
    extrudes: [
      kbox(0, 0, 0, 0, 0, h, krect(w, d), KIT.cab),                                  // carcass
      kbox(-w / 4, fy, h / 2, -w / 4, fy + 0.015, h / 2, krect(dw, h - 0.06, 0.01), KIT.door), // door L
      kbox(w / 4, fy, h / 2, w / 4, fy + 0.015, h / 2, krect(dw, h - 0.06, 0.01), KIT.door),   // door R
      kbox(-0.03, fy + 0.015, 0.10, -0.03, fy + 0.025, 0.10, krect(0.02, 0.12), KIT.steel),    // handle L
      kbox(0.03, fy + 0.015, 0.10, 0.03, fy + 0.025, 0.10, krect(0.02, 0.12), KIT.steel),      // handle R
    ],
  };
}

// Tabletop props — authored in a local frame centered on their allotted table footprint; z=0 is the
// table surface. These stay deliberately cheap (lathe/extrude/sweep) so a room can dress several
// tables without blowing the face budget.
const TOP = {
  porcelain: '#f0eadc', porcelainDk: '#cfc7b5', ceramic: '#d9e2df', clay: '#b9754c',
  glass: '#b9d8dc', water: '#83aeb8', linen: '#d8c7a8', linenDk: '#b49a78',
  steel: '#b8bdc0', steelDk: '#7f878a', wood: '#805533', leaf: '#3f7a48', flower: '#d46b83',
  paper: '#ece4d2', paperDk: '#c8bea8', cover: '#425a68', coverDk: '#263945',
  device: '#2c3035', deviceDk: '#17191d', key: '#393f45', screen: '#182735',
  rubber: '#202429', graphite: '#2f3438', yellow: '#d0a447',
};
const zlathe = (x, y, z, h, profile, tint, extra = {}) => ({
  axisFrom: { x, y, z },
  axisTo: { x, y, z: z + Math.max(0.001, h) },
  profile,
  tint,
  samples: extra.samples ?? 28,
  crossSections: extra.crossSections ?? Math.max(3, profile.length - 1),
  ...(extra.harmonics ? { harmonics: extra.harmonics } : {}),
});
const topSlab = (x, y, z, w, d, h, tint, r = 0.01) => buildSlab({
  x, y, z0: z, z1: z + Math.max(0.004, h), w, d, r, tint, cornerSamples: 4,
});

export function buildTabletopPlateWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.28, d = w, h = 0.035, title } = {}) {
  const r = Math.min(w, d) / 2;
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    lathes: [
      zlathe(x, y, z, h, [
        { t: 0, radius: r * 0.86 },
        { t: 0.20, radius: r * 0.98 },
        { t: 0.54, radius: r },
        { t: 0.78, radius: r * 0.90 },
        { t: 1, radius: r * 0.46 },
      ], TOP.porcelain, { crossSections: 5 }),
      zlathe(x, y, z + h * 0.72, h * 0.12, [
        { t: 0, radius: r * 0.52 },
        { t: 1, radius: r * 0.53 },
      ], TOP.porcelainDk, { samples: 28, crossSections: 2 }),
    ],
  };
}

export function buildTabletopBowlWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.26, d = w, h = 0.13, title } = {}) {
  const r = Math.min(w, d) / 2;
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    lathes: [
      zlathe(x, y, z, h, [
        { t: 0, radius: r * 0.38 },
        { t: 0.18, radius: r * 0.66 },
        { t: 0.55, radius: r * 0.95 },
        { t: 0.88, radius: r },
        { t: 1, radius: r * 0.92 },
      ], TOP.ceramic, { crossSections: 5 }),
      zlathe(x, y, z + h * 0.82, h * 0.035, [
        { t: 0, radius: r * 0.72 },
        { t: 1, radius: r * 0.74 },
      ], '#6f7473', { samples: 28, crossSections: 2 }),
    ],
  };
}

export function buildTabletopCupWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.11, d = w, h = 0.11, title } = {}) {
  const r = Math.min(w, d) / 2;
  const handleX = x + r * 0.9;
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    lathes: [
      zlathe(x, y, z, h, [
        { t: 0, radius: r * 0.78 },
        { t: 0.10, radius: r * 0.88 },
        { t: 0.76, radius: r * 0.94 },
        { t: 1, radius: r },
      ], TOP.porcelain, { crossSections: 5 }),
      zlathe(x, y, z + h * 0.86, h * 0.025, [
        { t: 0, radius: r * 0.68 },
        { t: 1, radius: r * 0.70 },
      ], '#5d4638', { samples: 24, crossSections: 2 }),
    ],
    sweeps: [
      {
        path: [
          [handleX, y, z + h * 0.74],
          [x + r * 1.55, y, z + h * 0.68],
          [x + r * 1.58, y, z + h * 0.42],
          [handleX, y, z + h * 0.34],
        ],
        radius: Math.max(0.006, r * 0.11),
        sides: 8,
        tint: TOP.porcelain,
        caps: false,
      },
    ],
  };
}

export function buildTabletopVaseWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.16, d = w, h = 0.36, title } = {}) {
  const r = Math.min(w, d) / 2;
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    lathes: [
      zlathe(x, y, z, h, [
        { t: 0, radius: r * 0.44 },
        { t: 0.12, radius: r * 0.62 },
        { t: 0.36, radius: r },
        { t: 0.66, radius: r * 0.70 },
        { t: 0.88, radius: r * 0.36 },
        { t: 1, radius: r * 0.44 },
      ], TOP.clay, { crossSections: 8, harmonics: [{ n: 6, amplitude: r * 0.045 }] }),
      zlathe(x, y, z + h * 0.91, h * 0.035, [
        { t: 0, radius: r * 0.32 },
        { t: 1, radius: r * 0.33 },
      ], '#5d3a2b', { samples: 24, crossSections: 2 }),
    ],
    sweeps: [
      { path: [[x - r * 0.16, y, z + h * 0.94], [x - r * 0.20, y + r * 0.12, z + h * 1.18]], radius: r * 0.045, sides: 5, tint: TOP.leaf },
      { path: [[x + r * 0.10, y, z + h * 0.94], [x + r * 0.16, y - r * 0.10, z + h * 1.12]], radius: r * 0.04, sides: 5, tint: TOP.leaf },
    ],
  };
}

export function buildTabletopNapkinWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.34, d = 0.24, h = 0.018, title } = {}) {
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    extrudes: [
      topSlab(x, y, z, w, d, h, TOP.linen, Math.min(w, d) * 0.05),
      topSlab(x - w * 0.18, y, z + h * 0.74, w * 0.035, d * 0.94, h * 0.45, TOP.linenDk, 0.004),
      topSlab(x + w * 0.18, y, z + h * 0.78, w * 0.025, d * 0.90, h * 0.35, '#ead9ba', 0.004),
    ],
  };
}

export function buildTabletopCutleryWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.34, d = 0.20, h = 0.024, title } = {}) {
  const forkX = x - w * 0.22;
  const knifeX = x + w * 0.18;
  const spoonX = x + w * 0.36;
  const r = Math.max(0.004, Math.min(w, d) * 0.018);
  const stem = (cx, y0, y1) => ({ path: [[cx, y0, z + r], [cx, y1, z + r]], radius: r, sides: 6, tint: TOP.steel, caps: true });
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    extrudes: [
      topSlab(forkX, y + d * 0.31, z, w * 0.13, d * 0.18, h, TOP.steel, 0.006),
      topSlab(knifeX, y + d * 0.02, z, w * 0.075, d * 0.78, h * 0.86, TOP.steelDk, 0.010),
      topSlab(spoonX, y + d * 0.31, z, w * 0.14, d * 0.22, h, TOP.steel, 0.020),
    ],
    sweeps: [
      stem(forkX, y - d * 0.40, y + d * 0.22),
      stem(spoonX, y - d * 0.40, y + d * 0.22),
      { path: [[forkX - w * 0.045, y + d * 0.35, z + h], [forkX - w * 0.045, y + d * 0.50, z + h]], radius: r * 0.55, sides: 5, tint: TOP.steel, caps: true },
      { path: [[forkX, y + d * 0.35, z + h], [forkX, y + d * 0.51, z + h]], radius: r * 0.55, sides: 5, tint: TOP.steel, caps: true },
      { path: [[forkX + w * 0.045, y + d * 0.35, z + h], [forkX + w * 0.045, y + d * 0.50, z + h]], radius: r * 0.55, sides: 5, tint: TOP.steel, caps: true },
    ],
  };
}

export function buildTabletopPlaceSettingWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.72, d = 0.46, h = 0.18, title } = {}) {
  const plate = buildTabletopPlateWorkbenchManifest({ x, y, z, w: Math.min(w, d) * 0.52, d: Math.min(w, d) * 0.52, h: h * 0.18 });
  const cup = buildTabletopCupWorkbenchManifest({ x: x + w * 0.26, y: y - d * 0.18, z, w: Math.min(w, d) * 0.17, h: h * 0.58 });
  const bowl = buildTabletopBowlWorkbenchManifest({ x: x - w * 0.12, y: y + d * 0.14, z, w: Math.min(w, d) * 0.26, h: h * 0.48 });
  const napkin = buildTabletopNapkinWorkbenchManifest({ x: x - w * 0.34, y, z, w: w * 0.20, d: d * 0.62, h: h * 0.08 });
  const cutlery = buildTabletopCutleryWorkbenchManifest({ x: x + w * 0.26, y: y + d * 0.18, z, w: w * 0.32, d: d * 0.38, h: h * 0.09 });
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    lathes: [...(plate.lathes || []), ...(cup.lathes || []), ...(bowl.lathes || [])],
    extrudes: [...(napkin.extrudes || []), ...(cutlery.extrudes || [])],
    sweeps: [...(cup.sweeps || []), ...(cutlery.sweeps || [])],
  };
}

export function buildTabletopNotebookWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.30, d = 0.22, h = 0.035, title } = {}) {
  const pageH = Math.max(0.006, h * 0.20);
  const coverH = Math.max(0.006, h * 0.28);
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    extrudes: [
      topSlab(x, y, z, w, d, coverH, TOP.coverDk, 0.012),
      topSlab(x + w * 0.018, y, z + coverH * 0.75, w * 0.92, d * 0.94, pageH, TOP.paper, 0.006),
      topSlab(x - w * 0.08, y, z + coverH + pageH * 0.76, w * 0.43, d * 0.92, pageH, TOP.paper, 0.005),
      topSlab(x + w * 0.14, y, z + coverH + pageH * 0.88, w * 0.43, d * 0.90, pageH, '#f5eedf', 0.005),
      topSlab(x, y - d * 0.47, z + h * 0.22, w * 0.88, d * 0.035, h * 0.25, TOP.paperDk, 0.003),
    ],
    sweeps: [
      { path: [[x - w * 0.02, y - d * 0.44, z + h * 0.94], [x - w * 0.02, y + d * 0.44, z + h * 0.94]], radius: Math.max(0.003, w * 0.012), sides: 5, tint: TOP.steelDk },
    ],
  };
}

export function buildTabletopLaptopWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.36, d = 0.25, h = 0.20, title } = {}) {
  const baseH = Math.max(0.014, h * 0.08);
  const screenH = Math.max(0.12, h * 0.74);
  const screenT = Math.max(0.010, d * 0.045);
  const hingeY = y - d * 0.43;
  const screenZ = z + baseH + screenH / 2;
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    extrudes: [
      topSlab(x, y, z, w, d, baseH, TOP.device, 0.012),
      topSlab(x, y + d * 0.03, z + baseH * 0.82, w * 0.72, d * 0.36, baseH * 0.42, '#22282e', 0.006),
      {
        axisFrom: { x, y: hingeY, z: screenZ },
        axisTo: { x, y: hingeY - screenT, z: screenZ + h * 0.06 },
        profile: { rect: { w: w * 0.94, h: screenH, r: 0.014 } },
        tint: TOP.deviceDk,
        cornerSamples: 4,
      },
      {
        axisFrom: { x, y: hingeY - screenT * 1.06, z: screenZ + h * 0.02 },
        axisTo: { x, y: hingeY - screenT * 1.18, z: screenZ + h * 0.04 },
        profile: { rect: { w: w * 0.80, h: screenH * 0.74, r: 0.008 } },
        tint: TOP.screen,
        cornerSamples: 3,
      },
    ],
    sweeps: [
      { path: [[x - w * 0.42, hingeY, z + baseH], [x + w * 0.42, hingeY, z + baseH]], radius: Math.max(0.004, w * 0.012), sides: 6, tint: TOP.steelDk },
    ],
  };
}

export function buildTabletopKeyboardWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.36, d = 0.12, h = 0.030, title } = {}) {
  const keys = [];
  const cols = 10;
  const rows = 3;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      keys.push(topSlab(
        x - w * 0.405 + col * (w * 0.09),
        y - d * 0.25 + row * (d * 0.24),
        z + h * 0.48,
        w * 0.055,
        d * 0.12,
        h * 0.30,
        TOP.key,
        0.003,
      ));
    }
  }
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    extrudes: [
      topSlab(x, y, z, w, d, h * 0.58, TOP.device, 0.012),
      ...keys,
      topSlab(x, y + d * 0.34, z + h * 0.48, w * 0.42, d * 0.11, h * 0.28, '#4b535a', 0.004),
    ],
  };
}

export function buildTabletopPencilHolderWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.12, d = w, h = 0.22, title } = {}) {
  const r = Math.min(w, d) / 2;
  const pencil = (dx, dy, tint, tilt = 0.0) => ({
    axisFrom: { x: x + dx, y: y + dy, z: z + h * 0.42 },
    axisTo: { x: x + dx + tilt, y: y + dy - tilt * 0.4, z: z + h * 1.18 },
    profile: [{ t: 0, radius: r * 0.055 }, { t: 0.86, radius: r * 0.055 }, { t: 1, radius: 0 }],
    tint,
    samples: 8,
    crossSections: 4,
  });
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    lathes: [
      zlathe(x, y, z, h * 0.62, [
        { t: 0, radius: r * 0.72 },
        { t: 0.12, radius: r * 0.88 },
        { t: 0.90, radius: r },
        { t: 1, radius: r * 0.96 },
      ], TOP.cover, { samples: 24, crossSections: 4 }),
      zlathe(x, y, z + h * 0.55, h * 0.035, [
        { t: 0, radius: r * 0.64 },
        { t: 1, radius: r * 0.66 },
      ], TOP.deviceDk, { samples: 20, crossSections: 2 }),
      pencil(-r * 0.22, r * 0.04, TOP.yellow, -r * 0.10),
      pencil(r * 0.16, -r * 0.10, '#8a4f3a', r * 0.08),
      pencil(r * 0.02, r * 0.18, TOP.graphite, 0),
    ],
  };
}

export function buildTabletopMouseWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.12, d = 0.075, h = 0.038, title } = {}) {
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    extrudes: [
      topSlab(x, y, z, w, d, h, TOP.rubber, Math.min(w, d) * 0.34),
      topSlab(x, y - d * 0.12, z + h * 0.72, w * 0.035, d * 0.38, h * 0.28, TOP.deviceDk, 0.003),
      topSlab(x - w * 0.16, y + d * 0.10, z + h * 0.76, w * 0.26, d * 0.30, h * 0.22, '#2c3238', 0.006),
      topSlab(x + w * 0.16, y + d * 0.10, z + h * 0.76, w * 0.26, d * 0.30, h * 0.22, '#2c3238', 0.006),
    ],
  };
}

export function buildTabletopDeskSetupWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.88, d = 0.54, h = 0.24, title } = {}) {
  const laptop = buildTabletopLaptopWorkbenchManifest({ x: x - w * 0.12, y: y - d * 0.10, z, w: w * 0.44, d: d * 0.42, h: h * 0.86 });
  const keyboard = buildTabletopKeyboardWorkbenchManifest({ x: x - w * 0.14, y: y + d * 0.23, z, w: w * 0.38, d: d * 0.19, h: h * 0.12 });
  const mouse = buildTabletopMouseWorkbenchManifest({ x: x + w * 0.24, y: y + d * 0.23, z, w: w * 0.13, d: d * 0.13, h: h * 0.14 });
  const notebook = buildTabletopNotebookWorkbenchManifest({ x: x - w * 0.38, y: y + d * 0.04, z, w: w * 0.24, d: d * 0.34, h: h * 0.13 });
  const holder = buildTabletopPencilHolderWorkbenchManifest({ x: x + w * 0.34, y: y - d * 0.18, z, w: w * 0.12, h: h * 0.72 });
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    lathes: [...(holder.lathes || [])],
    extrudes: [
      ...(laptop.extrudes || []), ...(keyboard.extrudes || []), ...(mouse.extrudes || []), ...(notebook.extrudes || []), ...(holder.extrudes || []),
    ],
    sweeps: [...(laptop.sweeps || []), ...(notebook.sweeps || []), ...(holder.sweeps || [])],
  };
}

export function buildTabletopDesktopTowerWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.18, d = 0.36, h = 0.48, title } = {}) {
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    extrudes: [
      topSlab(x, y, z, w, d, h, TOP.device, 0.018),
      topSlab(x, y + d * 0.51, z + h * 0.52, w * 0.82, d * 0.045, h * 0.72, TOP.deviceDk, 0.006),
      topSlab(x, y + d * 0.54, z + h * 0.78, w * 0.36, d * 0.030, h * 0.10, '#4b535a', 0.004),
      topSlab(x - w * 0.22, y + d * 0.54, z + h * 0.18, w * 0.18, d * 0.026, h * 0.08, '#5d6770', 0.003),
      topSlab(x + w * 0.22, y + d * 0.54, z + h * 0.18, w * 0.18, d * 0.026, h * 0.08, '#5d6770', 0.003),
    ],
    lathes: [
      zlathe(x + w * 0.28, y + d * 0.56, z + h * 0.80, h * 0.012, [
        { t: 0, radius: w * 0.045 },
        { t: 1, radius: w * 0.045 },
      ], '#7da3a8', { samples: 16, crossSections: 2 }),
    ],
  };
}

export function buildTabletopEyeglassesWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.18, d = 0.07, h = 0.026, sunglasses = false, title } = {}) {
  const lensTint = sunglasses ? '#262b30' : TOP.glass;
  const frameTint = sunglasses ? '#17191d' : TOP.steelDk;
  const lensW = w * 0.30;
  const lensD = d * 0.62;
  const lensX = w * 0.22;
  const r = Math.max(0.003, w * 0.018);
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    extrudes: [
      topSlab(x - lensX, y, z, lensW, lensD, h * 0.28, lensTint, lensD * 0.22),
      topSlab(x + lensX, y, z, lensW, lensD, h * 0.28, lensTint, lensD * 0.22),
    ],
    sweeps: [
      { path: [[x - lensX * 0.36, y, z + r], [x + lensX * 0.36, y, z + r]], radius: r, sides: 6, tint: frameTint, caps: true },
      { path: [[x - lensX - lensW * 0.50, y, z + r], [x - w * 0.58, y - d * 0.50, z + r * 0.8], [x - w * 0.62, y - d * 1.10, z]], radius: r, sides: 6, tint: frameTint, caps: true },
      { path: [[x + lensX + lensW * 0.50, y, z + r], [x + w * 0.58, y - d * 0.50, z + r * 0.8], [x + w * 0.62, y - d * 1.10, z]], radius: r, sides: 6, tint: frameTint, caps: true },
      { path: [[x - lensX - lensW * 0.48, y, z + r], [x - lensX, y + lensD * 0.48, z + r], [x - lensX + lensW * 0.48, y, z + r]], radius: r * 0.75, sides: 5, tint: frameTint, caps: true },
      { path: [[x + lensX - lensW * 0.48, y, z + r], [x + lensX, y + lensD * 0.48, z + r], [x + lensX + lensW * 0.48, y, z + r]], radius: r * 0.75, sides: 5, tint: frameTint, caps: true },
    ],
  };
}

export function buildTabletopWaterBottleWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.08, d = w, h = 0.28, title } = {}) {
  const r = Math.min(w, d) / 2;
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    lathes: [
      zlathe(x, y, z, h, [
        { t: 0, radius: r * 0.72 },
        { t: 0.08, radius: r * 0.94 },
        { t: 0.64, radius: r },
        { t: 0.78, radius: r * 0.62 },
        { t: 0.92, radius: r * 0.42 },
        { t: 1, radius: r * 0.46 },
      ], TOP.water, { crossSections: 7, samples: 28 }),
      zlathe(x, y, z + h * 0.90, h * 0.07, [
        { t: 0, radius: r * 0.48 },
        { t: 1, radius: r * 0.50 },
      ], TOP.deviceDk, { crossSections: 2, samples: 20 }),
    ],
  };
}

export function buildTabletopWineGlassWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.09, d = w, h = 0.20, title } = {}) {
  const r = Math.min(w, d) / 2;
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    lathes: [
      zlathe(x, y, z, h, [
        { t: 0, radius: r * 0.70 },
        { t: 0.04, radius: r * 0.82 },
        { t: 0.16, radius: r * 0.18 },
        { t: 0.46, radius: r * 0.16 },
        { t: 0.56, radius: r * 0.40 },
        { t: 0.72, radius: r * 0.76 },
        { t: 0.92, radius: r },
        { t: 1, radius: r * 0.88 },
      ], '#d8eef0', { crossSections: 8, samples: 32 }),
      zlathe(x, y, z + h * 0.66, h * 0.16, [
        { t: 0, radius: r * 0.56 },
        { t: 1, radius: r * 0.62 },
      ], '#7b2634', { crossSections: 2, samples: 28 }),
    ],
  };
}

export function buildTabletopPaperStackWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.28, d = 0.20, h = 0.050, title } = {}) {
  const sheets = [];
  const count = 7;
  for (let i = 0; i < count; i += 1) {
    sheets.push(topSlab(
      x + (i % 3 - 1) * w * 0.012,
      y + ((i * 2) % 5 - 2) * d * 0.008,
      z + i * (h / count),
      w * (1 - i * 0.006),
      d * (1 - i * 0.004),
      h / count,
      i % 2 ? '#f5eedf' : TOP.paper,
      0.004,
    ));
  }
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    extrudes: sheets,
  };
}

export function buildTabletopMailStackWorkbenchManifest({ x = 0, y = 0, z = 0, w = 0.26, d = 0.13, h = 0.055, title } = {}) {
  const mail = [];
  const tints = ['#efe4d0', '#d8e0e5', '#f4eddc', '#e2d6c2', '#f7f1e4'];
  for (let i = 0; i < 6; i += 1) {
    const off = i - 2.5;
    mail.push(topSlab(
      x + off * w * 0.018,
      y + (i % 2 ? d * 0.025 : -d * 0.018),
      z + i * (h / 6),
      w * (0.98 - i * 0.015),
      d * (0.96 - i * 0.010),
      h / 6,
      tints[i % tints.length],
      0.005,
    ));
    if (i % 2 === 0) {
      mail.push(topSlab(x + off * w * 0.018, y + d * 0.10, z + (i + 0.5) * (h / 6), w * 0.72, d * 0.018, h / 10, TOP.paperDk, 0.002));
    }
  }
  return {
    kind: 'workbench',
    ...(title ? { title } : {}),
    units: 'm',
    extrudes: mail,
  };
}

// local-frame asset → manifest sized to the element footprint (w,d,h); the `local`
// transform in roomFurnitureAssetFaces orients it to the footprint basis.
function footprintDims(el) {
  const b = el.heightManji.basePlane.corners;
  return {
    w: Math.hypot(b[1][0] - b[0][0], b[1][1] - b[0][1]),
    d: Math.hypot(b[3][0] - b[0][0], b[3][1] - b[0][1]),
    h: el.heightManji.heightWorld,
  };
}

function rectangularChairManifest(el) {
  const base = el.heightManji.basePlane.corners;
  const w = Math.hypot(base[1][0] - base[0][0], base[1][1] - base[0][1], base[1][2] - base[0][2]);
  const d = Math.hypot(base[3][0] - base[0][0], base[3][1] - base[0][1], base[3][2] - base[0][2]);
  const cx = base.reduce((sum, p) => sum + p[0], 0) / base.length;
  const cy = base.reduce((sum, p) => sum + p[1], 0) / base.length;
  return buildDiningChairWorkbenchManifest({
    x: cx,
    y: cy,
    z: base[0][2],
    w,
    d,
    h: el.heightManji.heightWorld,
  });
}

function rectangularModernCouchManifest(el) {
  const base = el.heightManji.basePlane.corners;
  const w = Math.hypot(base[1][0] - base[0][0], base[1][1] - base[0][1], base[1][2] - base[0][2]);
  const d = Math.hypot(base[3][0] - base[0][0], base[3][1] - base[0][1], base[3][2] - base[0][2]);
  const cx = base.reduce((sum, p) => sum + p[0], 0) / base.length;
  const cy = base.reduce((sum, p) => sum + p[1], 0) / base.length;
  return buildModernCouchWorkbenchManifest({
    x: cx,
    y: cy,
    z: base[0][2],
    w,
    d,
    h: el.heightManji.heightWorld,
  });
}

export const ROOM_FURNITURE_ASSETS = {
  chair: {
    id: 'chair',
    class: 'room-furniture',
    aliases: ['dining-chair', 'side-chair', 'chair.dining', 'wood-chair'],
    tags: {
      rooms: ['dining', 'kitchen', 'office', 'living-room', 'bedroom'],
      roles: ['seat', 'chair'],
      styles: ['modern', 'wood', 'mid-century'],
      materials: ['wood'],
      mood: ['warm', 'domestic', 'clean'],
      placement: ['floor'],
    },
    buildManifest: rectangularChairManifest,
  },
  'modern-couch': {
    id: 'modern-couch',
    class: 'room-furniture',
    aliases: ['rectangular-modern-couch', 'modern-sofa', 'sofa.modern-rectangular'],
    tags: {
      rooms: ['living-room', 'lounge', 'office', 'bedroom'],
      roles: ['seat', 'sofa'],
      styles: ['modern', 'rectangular', 'mid-century'],
      materials: ['leather', 'wood'],
      mood: ['warm', 'domestic', 'clean'],
      placement: ['floor', 'wall-hugging', 'center-safe'],
    },
    buildManifest: rectangularModernCouchManifest,
  },
  'study-table': {
    id: 'study-table', class: 'room-furniture', local: true,
    aliases: ['study-desk', 'writing-table', 'writing-desk'],
    tags: { rooms: ['office', 'study', 'bedroom', 'classroom'], roles: ['table', 'desk'], planeRole: ['table-plane'], placement: ['floor', 'wall-hugging'], materials: ['wood'] },
    buildManifest: (el) => buildStudyTableWorkbenchManifest(footprintDims(el)),
  },
  'standing-desk': {
    id: 'standing-desk', class: 'room-furniture', local: true,
    aliases: ['standing-table', 'stand-desk', 'adjustable-desk'],
    tags: { rooms: ['office', 'study', 'bedroom'], roles: ['table', 'desk'], planeRole: ['table-plane'], placement: ['floor', 'wall-hugging'], materials: ['wood', 'metal'] },
    buildManifest: (el) => buildStandingDeskWorkbenchManifest(footprintDims(el)),
  },
  'computer-table': {
    id: 'computer-table', class: 'room-furniture', local: true,
    aliases: ['computer-desk', 'pc-table', 'computer-workstation'],
    tags: { rooms: ['office', 'study', 'bedroom', 'classroom'], roles: ['table', 'desk', 'computer'], planeRole: ['table-plane'], placement: ['floor', 'wall-hugging'], materials: ['wood', 'metal'] },
    buildManifest: (el) => buildComputerTableWorkbenchManifest(footprintDims(el)),
  },
  'l-table': {
    id: 'l-table', class: 'room-furniture', local: true,
    aliases: ['l-desk', 'corner-desk', 'l-shaped-table', 'l-shaped-desk'],
    tags: { rooms: ['office', 'study', 'bedroom'], roles: ['table', 'desk', 'corner-workstation'], planeRole: ['table-plane'], placement: ['floor', 'corner', 'wall-hugging'], materials: ['wood'] },
    buildManifest: (el) => buildLTableWorkbenchManifest(footprintDims(el)),
  },
  // Kitchen units — `local: true` (authored centered/front-+y; oriented by footprint).
  'kitchen-counter': {
    id: 'kitchen-counter', class: 'room-furniture', local: true,
    aliases: ['base-counter', 'counter', 'base-cabinet'],
    tags: { rooms: ['kitchen'], roles: ['counter', 'storage'], placement: ['floor', 'wall-hugging'] },
    buildManifest: (el) => buildKitchenBaseCounter(footprintDims(el)),
  },
  'kitchen-sink': {
    id: 'kitchen-sink', class: 'room-furniture', local: true,
    aliases: ['sink', 'sink-unit'],
    tags: { rooms: ['kitchen'], roles: ['sink', 'counter'], placement: ['floor', 'wall-hugging'] },
    buildManifest: (el) => buildKitchenSinkUnit(footprintDims(el)),
  },
  'kitchen-stove': {
    id: 'kitchen-stove', class: 'room-furniture', local: true,
    aliases: ['stove', 'range', 'oven', 'cooktop'],
    tags: { rooms: ['kitchen'], roles: ['stove', 'appliance'], placement: ['floor', 'wall-hugging'] },
    buildManifest: (el) => buildKitchenStove(footprintDims(el)),
  },
  'kitchen-fridge': {
    id: 'kitchen-fridge', class: 'room-furniture', local: true,
    aliases: ['fridge', 'refrigerator'],
    tags: { rooms: ['kitchen'], roles: ['fridge', 'appliance'], placement: ['floor', 'wall-hugging', 'corner'] },
    buildManifest: (el) => buildKitchenFridge(footprintDims(el)),
  },
  'kitchen-upper': {
    id: 'kitchen-upper', class: 'room-furniture', local: true,
    aliases: ['upper-cupboard', 'wall-cabinet', 'upper-cabinet'],
    tags: { rooms: ['kitchen'], roles: ['storage'], placement: ['wall-mounted'] },
    buildManifest: (el) => buildKitchenUpperCupboard(footprintDims(el)),
  },
  plate: {
    id: 'plate', class: 'room-tabletop', local: true,
    aliases: ['dish', 'dinner-plate', 'table-plate'],
    tags: { rooms: ['dining', 'kitchen', 'living-room'], roles: ['tabletop', 'dish', 'place-setting'], planeRole: ['table-plane'], placement: ['surface-top'], materials: ['ceramic'] },
    buildManifest: (el) => buildTabletopPlateWorkbenchManifest(footprintDims(el)),
  },
  bowl: {
    id: 'bowl', class: 'room-tabletop', local: true,
    aliases: ['fruit-bowl', 'table-bowl', 'serving-bowl'],
    tags: { rooms: ['dining', 'kitchen', 'living-room'], roles: ['tabletop', 'vessel'], planeRole: ['table-plane'], placement: ['surface-top'], materials: ['ceramic'] },
    buildManifest: (el) => buildTabletopBowlWorkbenchManifest(footprintDims(el)),
  },
  cup: {
    id: 'cup', class: 'room-tabletop', local: true,
    aliases: ['mug', 'coffee-cup', 'teacup', 'table-cup'],
    tags: { rooms: ['dining', 'kitchen', 'office', 'living-room'], roles: ['tabletop', 'vessel'], planeRole: ['table-plane'], placement: ['surface-top'], materials: ['ceramic'] },
    buildManifest: (el) => buildTabletopCupWorkbenchManifest(footprintDims(el)),
  },
  vase: {
    id: 'vase', class: 'room-tabletop', local: true,
    aliases: ['flower-vase', 'table-vase', 'decor-vase'],
    tags: { rooms: ['dining', 'kitchen', 'living-room', 'bedroom'], roles: ['tabletop', 'vessel', 'decor'], planeRole: ['table-plane'], placement: ['surface-top'], materials: ['ceramic', 'plant'] },
    buildManifest: (el) => buildTabletopVaseWorkbenchManifest(footprintDims(el)),
  },
  napkin: {
    id: 'napkin', class: 'room-tabletop', local: true,
    aliases: ['folded-napkin', 'linen-napkin', 'table-linen'],
    tags: { rooms: ['dining', 'kitchen'], roles: ['tabletop', 'soft-goods', 'place-setting'], planeRole: ['table-plane'], placement: ['surface-top'], materials: ['linen'] },
    buildManifest: (el) => buildTabletopNapkinWorkbenchManifest(footprintDims(el)),
  },
  cutlery: {
    id: 'cutlery', class: 'room-tabletop', local: true,
    aliases: ['silverware', 'flatware', 'fork-knife-spoon'],
    tags: { rooms: ['dining', 'kitchen'], roles: ['tabletop', 'place-setting', 'utensil'], planeRole: ['table-plane'], placement: ['surface-top'], materials: ['steel'] },
    buildManifest: (el) => buildTabletopCutleryWorkbenchManifest(footprintDims(el)),
  },
  'place-setting': {
    id: 'place-setting', class: 'room-tabletop', local: true,
    aliases: ['table-setting', 'dinner-setting', 'tabletop-setting'],
    tags: { rooms: ['dining', 'kitchen'], roles: ['tabletop', 'place-setting', 'dish', 'vessel', 'utensil'], planeRole: ['table-plane'], placement: ['surface-top'], materials: ['ceramic', 'linen', 'steel'] },
    buildManifest: (el) => buildTabletopPlaceSettingWorkbenchManifest(footprintDims(el)),
  },
  notebook: {
    id: 'notebook', class: 'room-tabletop', local: true,
    aliases: ['journal', 'notepad', 'paper-notebook', 'desk-notebook'],
    tags: { rooms: ['office', 'study', 'bedroom', 'classroom'], roles: ['tabletop', 'desk-object', 'paper'], planeRole: ['table-plane'], placement: ['surface-top'], materials: ['paper', 'card'] },
    buildManifest: (el) => buildTabletopNotebookWorkbenchManifest(footprintDims(el)),
  },
  laptop: {
    id: 'laptop', class: 'room-tabletop', local: true,
    aliases: ['computer', 'notebook-computer', 'desk-laptop'],
    tags: { rooms: ['office', 'study', 'bedroom', 'classroom'], roles: ['tabletop', 'desk-object', 'computer'], planeRole: ['table-plane'], placement: ['surface-top'], materials: ['metal', 'glass'] },
    buildManifest: (el) => buildTabletopLaptopWorkbenchManifest(footprintDims(el)),
  },
  keyboard: {
    id: 'keyboard', class: 'room-tabletop', local: true,
    aliases: ['computer-keyboard', 'desk-keyboard'],
    tags: { rooms: ['office', 'study', 'bedroom', 'classroom'], roles: ['tabletop', 'desk-object', 'computer-accessory'], planeRole: ['table-plane'], placement: ['surface-top'], materials: ['plastic'] },
    buildManifest: (el) => buildTabletopKeyboardWorkbenchManifest(footprintDims(el)),
  },
  'pencil-holder': {
    id: 'pencil-holder', class: 'room-tabletop', local: true,
    aliases: ['pencil-cup', 'pen-cup', 'pen-holder', 'desk-cup'],
    tags: { rooms: ['office', 'study', 'bedroom', 'classroom'], roles: ['tabletop', 'desk-object', 'vessel'], planeRole: ['table-plane'], placement: ['surface-top'], materials: ['ceramic', 'wood', 'graphite'] },
    buildManifest: (el) => buildTabletopPencilHolderWorkbenchManifest(footprintDims(el)),
  },
  mouse: {
    id: 'mouse', class: 'room-tabletop', local: true,
    aliases: ['computer-mouse', 'desk-mouse'],
    tags: { rooms: ['office', 'study', 'bedroom', 'classroom'], roles: ['tabletop', 'desk-object', 'computer-accessory'], planeRole: ['table-plane'], placement: ['surface-top'], materials: ['plastic'] },
    buildManifest: (el) => buildTabletopMouseWorkbenchManifest(footprintDims(el)),
  },
  'desk-setup': {
    id: 'desk-setup', class: 'room-tabletop', local: true,
    aliases: ['workspace-set', 'desktop-setup', 'study-desk-props'],
    tags: { rooms: ['office', 'study', 'bedroom', 'classroom'], roles: ['tabletop', 'desk-object', 'computer', 'paper'], planeRole: ['table-plane'], placement: ['surface-top'], materials: ['metal', 'paper', 'plastic'] },
    buildManifest: (el) => buildTabletopDeskSetupWorkbenchManifest(footprintDims(el)),
  },
  'desktop-tower': {
    id: 'desktop-tower', class: 'room-tabletop', local: true,
    aliases: ['computer-tower', 'pc-tower', 'desktop-computer-tower'],
    tags: { rooms: ['office', 'study', 'bedroom', 'classroom'], roles: ['tabletop', 'desk-object', 'computer'], planeRole: ['table-plane'], placement: ['surface-top', 'floor'], materials: ['metal', 'plastic'] },
    buildManifest: (el) => buildTabletopDesktopTowerWorkbenchManifest(footprintDims(el)),
  },
  eyeglasses: {
    id: 'eyeglasses', class: 'room-tabletop', local: true,
    aliases: ['glasses', 'spectacles', 'reading-glasses'],
    tags: { rooms: ['office', 'study', 'bedroom', 'living-room'], roles: ['tabletop', 'personal-object'], planeRole: ['table-plane'], placement: ['surface-top'], materials: ['glass', 'metal'] },
    buildManifest: (el) => buildTabletopEyeglassesWorkbenchManifest(footprintDims(el)),
  },
  sunglasses: {
    id: 'sunglasses', class: 'room-tabletop', local: true,
    aliases: ['sun-glasses', 'dark-glasses'],
    tags: { rooms: ['office', 'study', 'bedroom', 'living-room'], roles: ['tabletop', 'personal-object'], planeRole: ['table-plane'], placement: ['surface-top'], materials: ['glass', 'plastic'] },
    buildManifest: (el) => buildTabletopEyeglassesWorkbenchManifest({ ...footprintDims(el), sunglasses: true }),
  },
  'water-bottle': {
    id: 'water-bottle', class: 'room-tabletop', local: true,
    aliases: ['bottle', 'drinking-bottle', 'reusable-bottle'],
    tags: { rooms: ['dining', 'kitchen', 'office', 'study', 'bedroom'], roles: ['tabletop', 'vessel'], planeRole: ['table-plane'], placement: ['surface-top'], materials: ['glass', 'plastic', 'water'] },
    buildManifest: (el) => buildTabletopWaterBottleWorkbenchManifest(footprintDims(el)),
  },
  'wine-glass': {
    id: 'wine-glass', class: 'room-tabletop', local: true,
    aliases: ['goblet', 'stemmed-glass', 'wineglass'],
    tags: { rooms: ['dining', 'kitchen', 'living-room'], roles: ['tabletop', 'vessel', 'drinkware'], planeRole: ['table-plane'], placement: ['surface-top'], materials: ['glass'] },
    buildManifest: (el) => buildTabletopWineGlassWorkbenchManifest(footprintDims(el)),
  },
  'paper-stack': {
    id: 'paper-stack', class: 'room-tabletop', local: true,
    aliases: ['stack-of-paper', 'papers', 'document-stack'],
    tags: { rooms: ['office', 'study', 'bedroom', 'classroom'], roles: ['tabletop', 'desk-object', 'paper'], planeRole: ['table-plane'], placement: ['surface-top'], materials: ['paper'] },
    buildManifest: (el) => buildTabletopPaperStackWorkbenchManifest(footprintDims(el)),
  },
  'mail-stack': {
    id: 'mail-stack', class: 'room-tabletop', local: true,
    aliases: ['stack-of-mail', 'mail', 'letters', 'envelope-stack'],
    tags: { rooms: ['office', 'study', 'kitchen', 'entry'], roles: ['tabletop', 'desk-object', 'paper', 'mail'], planeRole: ['table-plane'], placement: ['surface-top'], materials: ['paper'] },
    buildManifest: (el) => buildTabletopMailStackWorkbenchManifest(footprintDims(el)),
  },
};

const ALIAS_TO_ID = new Map(Object.values(ROOM_FURNITURE_ASSETS).flatMap((asset) => [
  [asset.id, asset.id],
  ...(asset.aliases || []).map((alias) => [alias, asset.id]),
]));

export function getRoomFurnitureAsset(id) {
  const key = ALIAS_TO_ID.get(String(id || '').trim());
  return key ? ROOM_FURNITURE_ASSETS[key] : null;
}

// Map a canonical local frame (centered x,y; z up from 0; front +y) onto an element's
// footprint: lx runs along the width edge (b-a)̂, ly along the depth edge (d-a)̂ which
// the wall-run packer aims INTO the room, lz stays world-up off the footprint base z.
function localToFootprint(corners) {
  const [a, b, , d] = corners;
  const ux = b[0] - a[0], uy = b[1] - a[1]; const ul = Math.hypot(ux, uy) || 1;
  const vx = d[0] - a[0], vy = d[1] - a[1]; const vl = Math.hypot(vx, vy) || 1;
  const uhx = ux / ul, uhy = uy / ul, vhx = vx / vl, vhy = vy / vl;
  const cx = (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4;
  const cy = (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4;
  const z0 = a[2];
  return ([lx, ly, lz]) => [cx + lx * uhx + ly * vhx, cy + lx * uhy + ly * vhy, z0 + lz];
}

export function roomFurnitureAssetFaces(element, { light } = {}) {
  const asset = getRoomFurnitureAsset(element.asset || element.assetRef || element.type);
  if (!asset) return null;
  let faces = workbenchAssetFaces(asset.buildManifest(element), { light });
  if (asset.local) {
    const place = localToFootprint(element.heightManji.basePlane.corners);
    faces = faces.map((face) => ({ ...face, corners: face.corners.map(place) }));
  }
  return {
    asset,
    faces: faces.map((face) => ({ ...face, group: `asset:${asset.id}` })),
    contactFootprint: { corners: element.heightManji.basePlane.corners, height: element.heightManji.heightWorld },
  };
}
