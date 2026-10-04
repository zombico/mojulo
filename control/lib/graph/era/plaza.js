/**
 * PLAZA — an exterior stage: an open-air room whose walls are HOUSE FRONTS. Each bay of a side is one house with its
 * own height (storeys), its own stucco colour, a stone base band, an arched door, windows per storey with stone
 * surrounds, a projecting eave and a terracotta roof pitched back away from the square; some carry a balcony. The
 * stepped skyline, the eaves and the balconies are what the sun bake (sun.js) throws shadows from.
 *
 *   plazaWall(out, F, ctx) → house fronts along wall frame F; returns nothing (faces go to `out`)
 *
 * Every face is a textured quad lit and dirtied by the stage; window glass is a dark self-lit pane (the room behind).
 */
import { hash3 } from './dirt.js';
import { add, mul, P, onWall, panel, quad, wallBox } from './geom.js';
import { archedOpening } from './gothic.js';

const Z = [0, 0, 1];
const hexToTint = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 212);   // over the stucco tile's ~212 base

/**
 * Houses along F. `ctx`: { kit, seed, surf(part, variant, tint?) }. kit.house: { storey, storeys:[min,max], palette,
 * base, door, window, eave, roof, balcony }.
 */
export function plazaWall(out, F, { kit, seed, surf }) {
  const H = kit.house, n = Math.max(1, Math.round(F.len / kit.bay));
  const heights = [];
  for (let k = 0; k < n; k++) {
    const st = H.storeys[0] + Math.floor(hash3(seed, k, 401) * (H.storeys[1] - H.storeys[0] + 1));
    heights.push(st * H.storey + H.parapet);
  }
  for (let k = 0; k < n; k++) {
    const first = out.length;
    const u0 = (F.len * k) / n, u1 = (F.len * (k + 1)) / n, top = heights[k];
    const colour = H.palette[Math.floor(hash3(seed, k, 409) * H.palette.length)];
    const wallS = { ...surf('wall', k), tint: hexToTint(colour) }, baseS = surf('base', k), trimS = surf('trim'), roofS = surf('roof');
    const glass = { fill: H.window.glass, group: 'stage:glass' };
    const storeys = Math.round((top - H.parapet) / H.storey);
    // the stone base band (the stuff between pavement and stucco)
    wallBox(out, F, u0, u1, 0, H.base.h, H.base.out, baseS, baseS.cell);
    // ground storey: the door, centred, round-headed
    const mid = (u0 + u1) / 2, dw = H.door.w / 2;
    archedOpening(out, F, { u0, u1, z0: H.base.h, z1: H.storey, a: mid - dw, b: mid + dw, zs: H.door.h - dw, H: dw * 1.02, seg: 6, depth: H.door.depth, ring: 0.18, ringOut: 0.08 }, { wall: wallS, trim: trimS }, { glass: { fill: H.door.dark, group: 'stage:glass' } });
    // upper storeys: one or two windows each, in sub-bays
    const perStorey = (u1 - u0) > 5 ? 2 : 1;
    for (let s = 1; s < storeys; s++) {
      const z0 = s * H.storey, z1 = (s + 1) * H.storey, sill = z0 + H.window.sill;
      panel(out, onWall(F, u0, 0, z0), F.U, u1 - u0, Z, H.window.sill, F.N, wallS, wallS.cell);
      for (let w = 0; w < perStorey; w++) {
        const s0 = u0 + ((u1 - u0) * w) / perStorey, s1 = u0 + ((u1 - u0) * (w + 1)) / perStorey, c = (s0 + s1) / 2, hw = H.window.w / 2;
        const round = hash3(seed * 7 + k, s, 419) < 0.5;
        archedOpening(out, F, { u0: s0, u1: s1, z0: sill, z1, a: c - hw, b: c + hw, zs: sill + H.window.h - (round ? hw : 0), H: round ? hw * 1.02 : 0, seg: 6, depth: H.window.depth, ring: 0.14, ringOut: 0.06 }, { wall: wallS, trim: trimS }, { glass });
        // a sill that projects: it throws a thin shadow down the wall
        wallBox(out, F, c - hw - 0.15, c + hw + 0.15, sill - 0.12, sill, 0.22, trimS, trimS.cell);
      }
      // a balcony on the first floor of some houses: a slab and a rail of posts
      if (s === 1 && hash3(seed, k, 421) < H.balcony.chance) {
        const b0 = mid - H.balcony.w / 2, b1 = mid + H.balcony.w / 2, bz = z0 + 0.05;
        wallBox(out, F, b0, b1, bz - 0.18, bz, H.balcony.out, trimS, trimS.cell);
        const posts = Math.round(H.balcony.w / 0.35);
        for (let i = 0; i <= posts; i++) {
          const pu = b0 + 0.05 + ((b1 - b0 - 0.1) * i) / posts;
          const p0 = onWall(F, pu - 0.03, H.balcony.out - 0.1, bz), p1 = onWall(F, pu + 0.03, H.balcony.out - 0.04, bz + 0.95);
          const mn = [Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), bz], mx = [Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1]), bz + 0.95];
          out.push(...railPost(mn, mx, H.balcony.iron));
        }
        wallBox(out, F, b0, b1, bz + 0.95, bz + 1.02, H.balcony.out - 0.02, { ...trimS, tint: [0.35, 0.33, 0.32] }, 1);
      }
    }
    // the band above the top storey, the eave, the roof
    panel(out, onWall(F, u0, 0, storeys * H.storey), F.U, u1 - u0, Z, top - storeys * H.storey, F.N, wallS, wallS.cell);
    wallBox(out, F, u0, u1, top - H.eave.h, top, H.eave.out, trimS, trimS.cell);
    const e0 = onWall(F, u0, H.eave.out, top), e1 = onWall(F, u1, H.eave.out, top);
    const r0 = onWall(F, u0, -H.roof.depth, top + H.roof.rise), r1 = onWall(F, u1, -H.roof.depth, top + H.roof.rise);
    const slope = Math.hypot(H.roof.depth + H.eave.out, H.roof.rise), rn = P(add(mul(F.N, H.roof.rise / slope), mul(Z, (H.roof.depth + H.eave.out) / slope)));
    const along = (u) => u / roofS.scale;
    quad(out, [e0, e1, r1, r0], rn, roofS, null, null, [[along(u0), 0], [along(u1), 0], [along(u1), slope / roofS.scale], [along(u0), slope / roofS.scale]]);
    // party walls: where this house stands taller than its neighbour, its side shows above the neighbour's roof
    for (const [side, u, nb] of [[-1, u0, heights[k - 1]], [1, u1, heights[k + 1]]]) {
      if (nb === undefined || nb >= top) continue;
      const sn = P(mul(F.U, side));
      quad(out, [onWall(F, u, 0, nb), onWall(F, u, -H.roof.depth, nb), onWall(F, u, -H.roof.depth, top), onWall(F, u, 0, top)], sn, wallS, F.N, Z);
      quad(out, [onWall(F, u, H.eave.out, top), onWall(F, u, -H.roof.depth, top), onWall(F, u, -H.roof.depth, top + H.roof.rise), onWall(F, u, -H.roof.depth, top + H.roof.rise)], sn, wallS, F.N, Z);
    }
    // the house's stucco streaks hang from under its own eave (dirt.js reads `top`)
    for (let i = first; i < out.length; i++) if (out[i].group === 'stage:wall') out[i].top = top - H.eave.h;
  }
}

/** A plain iron post (untextured, tinted like the shell so the bake lights it). */
function railPost(mn, mx, tone) {
  const [x0, y0, z0] = mn, [x1, y1, z1] = mx, t = [1, 3, 5].map((i) => parseInt(tone.slice(i, i + 2), 16) / 255);
  const f = (corners, n) => ({ corners: corners.map(P), normal: n, outNormal: n, tint: t, group: 'stage:fixture' });
  return [
    f([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]),
    f([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]),
    f([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], [-1, 0, 0]),
    f([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]),
  ];
}
