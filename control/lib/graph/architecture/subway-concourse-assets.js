/**
 * subway-concourse-assets — STRUCTURED doodads for the mezzanine, built from the
 * workbench part vocabulary (buildSlab rounded-rect extrudes + buildLeg turned
 * lathes) rather than crude boxes. Each builder returns a workbench manifest
 * ({ kind:'workbench', units:'m', extrudes, lathes }); the caller bakes it with the
 * scene's own light via workbenchAssetFaces, so props shade like the rest of the
 * world and compose at meter scale (the subway world is metric — a figure is 1.74m).
 *
 * Authored axis-aligned in WORLD coords at the passed (x,y,z) base, with `facing`
 * (N|S|E|W = which way the FRONT detail points) placing the asymmetric bits — so no
 * rotate/relight dance is needed (every box is lit correctly by the fixed key).
 */

import { buildSlab, buildLeg } from './room-parts.js';
import { workbenchAssetFaces } from '../worlds/workbench.js';

const VEC = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] };
const isXAxis = (facing) => facing === 'E' || facing === 'W';
/** width/depth of a FRONT feature: `wide` runs across the face, `thin` through it. */
const faceDims = (facing, wide, thin) => (isXAxis(facing) ? { w: thin, d: wide } : { w: wide, d: thin });

const PAL = {
  tvmBody: '#49515a', tvmPlinth: '#373d44', tvmScreen: '#0f151b', tvmReader: '#8a9298',
  benchSeat: '#6b7178', benchLeg: '#474d54', benchBack: '#5d636a',
  binBody: '#3f444b', binRim: '#2b2e33',
  kioskBase: '#3c444d', kioskGlass: '#9fb6c4', kioskCounter: '#5d6b73', kioskRoof: '#474f57', kioskPost: '#2f353c',
  totemPost: '#2b3036',
};
const wb = (extrudes, lathes) => ({ kind: 'workbench', units: 'm', extrudes, lathes: lathes || [] });

/** A ticket-vending machine: plinth + cabinet + a raked dark screen + a brand bar + card reader. */
export function buildTicketMachine({ x, y, z = 0, facing = 'S', line = '#2f6fb0' } = {}) {
  const d = VEC[facing], f = 0.21;
  const fx = x + d[0] * f, fy = y + d[1] * f;
  const screen = faceDims(facing, 0.42, 0.06), brand = faceDims(facing, 0.5, 0.05), reader = faceDims(facing, 0.16, 0.1);
  return wb([
    buildSlab({ x, y, z0: z, z1: z + 0.1, w: 0.66, d: 0.54, r: 0.02, tint: PAL.tvmPlinth }),
    buildSlab({ x, y, z0: z + 0.1, z1: z + 1.5, w: 0.6, d: 0.48, r: 0.05, tint: PAL.tvmBody }),
    buildSlab({ x: fx, y: fy, z0: z + 0.92, z1: z + 1.34, ...screen, r: 0.02, tint: PAL.tvmScreen }),
    buildSlab({ x: fx, y: fy, z0: z + 1.4, z1: z + 1.48, ...brand, r: 0.02, tint: line }),
    buildSlab({ x: fx, y: fy, z0: z + 0.66, z1: z + 0.82, ...reader, r: 0.02, tint: PAL.tvmReader }),
  ]);
}

/** A platform bench: a slat seat on two end blocks, with a low backrest behind. */
export function buildBench({ x, y, z = 0, facing = 'N', len = 1.6 } = {}) {
  const d = VEC[facing], ax = isXAxis(facing);
  const seat = faceDims(facing, len, 0.46);
  const legW = ax ? 0.4 : 0.14, legD = ax ? 0.14 : 0.4;
  const off = (len / 2) - 0.18;
  const lx = ax ? 0 : off, ly = ax ? off : 0;
  const back = { x: x - d[0] * 0.18, y: y - d[1] * 0.18 };
  const backDims = faceDims(facing, len, 0.08);
  return wb([
    buildSlab({ x, y, z0: z + 0.4, z1: z + 0.46, ...seat, r: 0.03, tint: PAL.benchSeat }),
    buildSlab({ x: x - lx, y: y - ly, z0: z, z1: z + 0.4, w: legW, d: legD, r: 0.02, tint: PAL.benchLeg }),
    buildSlab({ x: x + lx, y: y + ly, z0: z, z1: z + 0.4, w: legW, d: legD, r: 0.02, tint: PAL.benchLeg }),
    buildSlab({ x: back.x, y: back.y, z0: z + 0.46, z1: z + 0.92, ...backDims, r: 0.02, tint: PAL.benchBack }),
  ]);
}

/** A waste bin: a turned tapered body with a darker rim. */
export function buildWasteBin({ x, y, z = 0 } = {}) {
  return wb([], [
    buildLeg({ top: [x, y, z + 0.86], foot: [x, y, z], topRadius: 0.23, footRadius: 0.19, samples: 16, tint: PAL.binBody }),
    buildLeg({ top: [x, y, z + 0.95], foot: [x, y, z + 0.84], topRadius: 0.25, footRadius: 0.25, samples: 16, tint: PAL.binRim }),
  ]);
}

/** An attendant / information booth — the commanding-position anchor over the fare line.
 *  Base + four corner posts + glazed back/sides + a service counter on the FRONT + a roof
 *  and an "i" sign totem above it. The most assembled of the props (one structured manifest). */
export function buildInfoKiosk({ x, y, z = 0, facing = 'S', w = 2.2, d = 1.7, line = '#2f6fb0' } = {}) {
  const dir = VEC[facing], hx = w / 2, hy = d / 2;
  const post = (px, py) => buildSlab({ x: px, y: py, z0: z + 0.15, z1: z + 2.3, w: 0.12, d: 0.12, r: 0.02, tint: PAL.kioskPost });
  const back = { x: x - dir[0] * (hy - 0.06), y: y - dir[1] * (hy - 0.06) };
  const front = { x: x + dir[0] * (hy - 0.05), y: y + dir[1] * (hy - 0.05) };
  const wallDims = faceDims(facing, w - 0.1, 0.06), counterDims = faceDims(facing, w - 0.3, 0.22);
  return wb([
    buildSlab({ x, y, z0: z, z1: z + 0.16, w, d, r: 0.04, tint: PAL.kioskBase }),
    post(x - hx + 0.08, y - hy + 0.08), post(x + hx - 0.08, y - hy + 0.08),
    post(x - hx + 0.08, y + hy - 0.08), post(x + hx - 0.08, y + hy - 0.08),
    buildSlab({ x: back.x, y: back.y, z0: z + 0.16, z1: z + 2.3, ...wallDims, r: 0.01, tint: PAL.kioskGlass }),
    buildSlab({ x: front.x, y: front.y, z0: z + 0.9, z1: z + 1.06, ...counterDims, r: 0.02, tint: PAL.kioskCounter }),
    buildSlab({ x, y, z0: z + 2.3, z1: z + 2.46, w: w + 0.16, d: d + 0.16, r: 0.05, tint: PAL.kioskRoof }),
    buildSlab({ x: x + dir[0] * 0.2, y: y + dir[1] * 0.2, z0: z + 2.46, z1: z + 3.05, ...faceDims(facing, 0.7, 0.06), r: 0.03, tint: line }),
  ]);
}

/** A wayfinding totem: a slim post carrying a coloured directional sign panel. */
export function buildSignTotem({ x, y, z = 0, facing = 'S', line = '#2f6fb0', h = 2.6 } = {}) {
  const panel = faceDims(facing, 1.1, 0.07);
  return wb([
    buildSlab({ x, y, z0: z, z1: z + h, w: 0.16, d: 0.16, r: 0.03, tint: PAL.totemPost }),
    buildSlab({ x, y, z0: z + h - 0.8, z1: z + h, ...panel, r: 0.04, tint: line }),
  ]);
}

// ── WALL FURNISHINGS — mounted up a wall, thin along the wall normal (`facing`) ──
/** A vertical wall panel: `widthAlongWall` across the wall, z0..z1 tall, `depth` proud. */
function wallPanelSlab({ x, y, z0, z1, facing, widthAlongWall, depth, r = 0.02, tint }) {
  const ax = isXAxis(facing);
  return buildSlab({ x, y, z0, z1, w: ax ? depth : widthAlongWall, d: ax ? widthAlongWall : depth, r, tint });
}

/** A framed advertising POSTER mounted on a wall (frame + a coloured sheet proud of it). */
export function buildPoster({ x, y, z = 0, facing = 'W', w = 1.0, h = 1.5, tint = '#b8452f' } = {}) {
  const d = VEC[facing];
  return wb([
    wallPanelSlab({ x, y, z0: z, z1: z + h, facing, widthAlongWall: w + 0.12, depth: 0.1, tint: '#23262b' }),
    wallPanelSlab({ x: x + d[0] * 0.05, y: y + d[1] * 0.05, z0: z + 0.07, z1: z + h - 0.07, facing, widthAlongWall: w, depth: 0.12, tint }),
  ]);
}

/** A framed SYSTEM/ROUTE MAP on a wall: light backing + crossing route lines + station dots. */
export function buildWallMap({ x, y, z = 0, facing = 'W', w = 2.4, h = 1.7, line = '#2f6fb0', cross = '#d2362f' } = {}) {
  const d = VEC[facing];
  const proud = (k) => ({ x: x + d[0] * k, y: y + d[1] * k });
  const along = (off) => (isXAxis(facing) ? { x, y: y + off } : { x: x + off, y });
  const midZ = z + h * 0.52;
  const bg = proud(0.05), hr = proud(0.12), vr = proud(0.12);
  const ext = [
    wallPanelSlab({ x, y, z0: z, z1: z + h, facing, widthAlongWall: w + 0.14, depth: 0.1, tint: '#262a2f' }),                 // frame
    wallPanelSlab({ x: bg.x, y: bg.y, z0: z + 0.07, z1: z + h - 0.07, facing, widthAlongWall: w, depth: 0.12, tint: '#eef1f3' }), // backing
    wallPanelSlab({ x: hr.x, y: hr.y, z0: midZ - 0.045, z1: midZ + 0.045, facing, widthAlongWall: w * 0.8, depth: 0.16, tint: line }),  // horizontal route
    wallPanelSlab({ x: vr.x, y: vr.y, z0: z + h * 0.2, z1: z + h * 0.82, facing, widthAlongWall: 0.09, depth: 0.16, tint: cross }),     // vertical route
  ];
  for (const off of [-w * 0.3, -w * 0.08, w * 0.14, w * 0.33]) {     // station dots along the horizontal route
    const a = along(off);
    ext.push(wallPanelSlab({ x: a.x + d[0] * 0.15, y: a.y + d[1] * 0.15, z0: midZ - 0.05, z1: midZ + 0.05, facing, widthAlongWall: 0.1, depth: 0.05, r: 0.05, tint: '#1b1e22' }));
  }
  return wb(ext);
}

/** Bake a list of placed doodads → world faces under the scene light. Each entry is
 *  { build, ...args }; build is one of the builders above. */
export function concourseAssetFaces(items, light) {
  const out = [];
  for (const it of items) {
    const { build, ...args } = it;
    for (const f of workbenchAssetFaces(build(args), { light })) out.push(f);
  }
  return out;
}
