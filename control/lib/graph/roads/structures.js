/**
 * structures — what crosses OVER the roadway, sized from a clearance target rather than a lift
 * constant: an overpass carrying a crossing arterial, and an overhead sign gantry.
 *
 * Every structure records its SOFFITS (the downward faces a tall load could strike) so the census
 * measures clearance from the drawn undersides down to the drawn pavement: MTO's 5.0 m minimum
 * over a freeway, plus a resurfacing allowance, is an input here and a measured output there.
 *
 * Overpass anatomy (MTO practice, see the plan's reference sheet): precast girders 1.6 m deep at
 * ~3.3 m centres, a 0.225 m slab + 0.09 m wearing surface, parapet walls, pier walls standing in the
 * median and separation walls' lines, integral pier caps (flush with the girder soffit), abutments
 * past the clear zone, and approaches on fill at ≤ 5 %.
 */

import { face, faceOut, texFace, boxFaces } from './road-faces.js';

export const OVERPASS = {
  clearance: 5.15,          // 5.0 m MTO minimum + 0.15 m resurfacing allowance
  girderDepth: 1.6, slab: 0.315, girders: 6, girderW: 0.9,
  lanes: 4, laneW: 3.5, sidewalk: 2.0, curb: 0.5, parapet: 0.5, parapetH: 1.07,
  clearZone: 12, approachGrade: 0.05,
};
export const GANTRY = { clearance: 5.4, truss: 1.0, signH: 3.6, signW: 6.2 };

const C = { concrete: '#cdc9bf', girder: '#bdb9ae', deck: '#c4c6c8', walk: '#c9c6bd', fill: '#e9e6d6', steel: '#a7abad', green: '#1f6b43', white: '#eceae3', yellow: '#dcb431' };

/** The max pavement z over a highway footprint [s0, s1] × all paved d, both directions. */
function pavementMax({ alignment, P, paved }, s0, s1) {
  let z = -Infinity;
  for (let s = s0; s <= s1 + 1e-9; s += 1) {
    const st = alignment.at(s);
    for (const D of [1, -1]) for (let d = 0; d <= paved + 1e-9; d += 0.5) z = Math.max(z, P(st, D, d)[2]);
  }
  return z;
}

/**
 * An overpass carrying a straight crossing road at right angles over the highway at station `s`.
 * Returns { faces, structure } — `structure.soffits` are the downward faces the census reads.
 */
export function overpass(ctx, { id = 'overpass-1', s, clearance = OVERPASS.clearance } = {}) {
  const { alignment, section, P, paved } = ctx;
  const O = OVERPASS;
  const st = alignment.at(s);
  const halfW = O.lanes * O.laneW / 2 + O.curb + O.sidewalk + O.parapet;     // deck half-width (along s)
  const zPav = pavementMax(ctx, s - halfW - 1, s + halfW + 1);
  const zU = zPav + clearance, zGirderTop = zU + O.girderDepth, zTop = zGirderTop + O.slab;
  const uAb = paved + O.clearZone;                                            // abutment offset
  // the crossing road's frame: u across the highway (left-positive, as the frame's offset), v along it
  const nx = -Math.sin(st.heading), ny = Math.cos(st.heading), tx = Math.cos(st.heading), ty = Math.sin(st.heading);
  const W = (u, v, z) => [st.x + nx * u + tx * v, st.y + ny * u + ty * v, z];
  const faces = [], soffits = [];
  const box = (u0, u1, v0, v1, z0, z1, hex, tag = null) => {
    const q = (u, v, z) => W(u, v, z);
    const top = [q(u0, v0, z1), q(u1, v0, z1), q(u1, v1, z1), q(u0, v1, z1)];
    const bot = [q(u0, v0, z0), q(u0, v1, z0), q(u1, v1, z0), q(u1, v0, z0)];
    const mid = W((u0 + u1) / 2, (v0 + v1) / 2, 0);
    faces.push(face(top, hex));
    const b = { ...face(bot, hex, { keepWinding: true }) };
    faces.push(b);
    if (tag) soffits.push({ corners: b.corners, tag });
    for (const [a0, a1] of [[[u0, v0], [u1, v0]], [[u1, v0], [u1, v1]], [[u1, v1], [u0, v1]], [[u0, v1], [u0, v0]]]) {
      faces.push(faceOut([q(a0[0], a0[1], z0), q(a1[0], a1[1], z0), q(a1[0], a1[1], z1), q(a0[0], a0[1], z1)], hex, mid));
    }
  };
  // supports along u: the median (u = 0), each separation wall's line, the two abutments
  const sep = section.bands.find((b) => b.wall === 'separation');
  const supports = [0, ...(sep ? [(sep.d0 + sep.d1) / 2, -(sep.d0 + sep.d1) / 2] : [])].sort((a, b) => a - b);
  const bearings = [-uAb, ...supports, uAb];
  // girders: `girders` lines across the deck width, one span between each pair of bearings
  const gw = O.girderW, spacing = (2 * halfW - 2 * O.parapet) / O.girders;
  for (let g = 0; g < O.girders; g++) {
    const v = -halfW + O.parapet + spacing * (g + 0.5);
    for (let i = 0; i < bearings.length - 1; i++) box(bearings[i], bearings[i + 1], v - gw / 2, v + gw / 2, zU, zGirderTop, C.girder, 'girder');
  }
  // slab + wearing surface over the whole deck; its soffit between girders is higher than theirs
  box(-uAb - 1, uAb + 1, -halfW, halfW, zGirderTop, zTop, C.concrete, 'slab');
  // integral pier caps (flush with the girder soffit) + pier walls in the wall lines, down to grade
  const wallT = section.bands[0].w * 2;
  for (const u of supports) {
    box(u - 0.9, u + 0.9, -halfW + 0.3, halfW - 0.3, zU, zGirderTop, C.concrete, 'cap');
    const D = u > 0 ? -1 : 1, d = Math.abs(u);
    const zBase = Math.min(P(st, D, d - wallT / 2)[2], P(st, D, d + wallT / 2)[2]) - 0.05;
    box(u - wallT / 2, u + wallT / 2, -halfW + 1.2, halfW - 1.2, zBase, zU, C.concrete);
  }
  // abutment walls, down into the ground
  const zG = Math.min(P(st, 1, paved)[2], P(st, -1, paved)[2]) - 0.25;
  for (const sg of [-1, 1]) box(sg * uAb - (sg > 0 ? 0 : 1.2), sg * uAb + (sg > 0 ? 1.2 : 0), -halfW, halfW, zG - 2, zGirderTop, C.concrete);
  // deck surface: parapets, sidewalks, the carriageway with a double yellow centre and lane lines
  const roadFaces = (u0, u1, zAt) => {
    const segs = Math.max(1, Math.ceil((u1 - u0) / 10));
    for (let k = 0; k < segs; k++) {
      const a = u0 + (u1 - u0) * k / segs, b = u0 + (u1 - u0) * (k + 1) / segs, za = zAt(a), zb = zAt(b);
      const carr = O.lanes * O.laneW / 2;
      const q = (u, v, z) => W(u, v, z);
      faces.push(texFace([q(a, -carr, za), q(b, -carr, zb), q(b, carr, zb), q(a, carr, za)], C.deck, 'asphalt-aged', [[a / 2.5, -carr / 2.5], [b / 2.5, -carr / 2.5], [b / 2.5, carr / 2.5], [a / 2.5, carr / 2.5]]));
      for (const sg of [-1, 1]) {
        const v0 = sg * carr, v1 = sg * (carr + O.curb + O.sidewalk);
        faces.push(face([q(a, v0, za + 0.15), q(b, v0, zb + 0.15), q(b, v1, zb + 0.15), q(a, v1, za + 0.15)], C.walk));
        faces.push(faceOut([q(a, v0, za), q(b, v0, zb), q(b, v0, zb + 0.15), q(a, v0, za + 0.15)], C.walk, W((a + b) / 2, sg * (carr + 3), 0)));
        // parapet
        const p0 = sg * (halfW - O.parapet), p1 = sg * halfW, mid = W((a + b) / 2, sg * (halfW - O.parapet / 2), 0);
        faces.push(faceOut([q(a, p0, za), q(b, p0, zb), q(b, p0, zb + O.parapetH), q(a, p0, za + O.parapetH)], C.concrete, mid));
        faces.push(faceOut([q(a, p1, za - O.slab - 0.2), q(b, p1, zb - O.slab - 0.2), q(b, p1, zb + O.parapetH), q(a, p1, za + O.parapetH)], C.concrete, mid));
        faces.push(face([q(a, p0, za + O.parapetH), q(b, p0, zb + O.parapetH), q(b, p1, zb + O.parapetH), q(a, p1, za + O.parapetH)], C.concrete));
        // lane line (broken 3/6 is overkill at this length: solid lane lines read as an urban bridge) + double yellow
        const lz = 0.012;
        for (const v of [sg * O.laneW]) faces.push(face([q(a, v - 0.05, za + lz), q(b, v - 0.05, zb + lz), q(b, v + 0.05, zb + lz), q(a, v + 0.05, za + lz)], C.white));
        const vy = sg * 0.12;
        faces.push(face([q(a, vy - 0.05, za + lz), q(b, vy - 0.05, zb + lz), q(b, vy + 0.05, zb + lz), q(a, vy + 0.05, za + lz)], C.yellow));
      }
    }
  };
  roadFaces(-uAb - 1, uAb + 1, () => zTop);
  // approaches on fill at ≤ 5 %, then at grade; side slopes 1:2 down to the ground
  const rampL = (zTop - zG) / O.approachGrade;
  for (const sg of [-1, 1]) {
    const u0 = sg * (uAb + 1), u1 = sg * (uAb + 1 + rampL), u2 = sg * (uAb + 1 + rampL + 250);
    const zAt = (u) => { const t = Math.min(1, Math.abs(u - u0) / rampL); return zTop + (zG + 0.3 - zTop) * t; };
    const [a, b] = sg < 0 ? [u1, u0] : [u0, u1];
    roadFaces(a, b, zAt);
    const [c2, d2] = sg < 0 ? [u2, u1] : [u1, u2];
    roadFaces(c2, d2, () => zG + 0.3);
    // fill slopes under the ramp
    const segs = Math.ceil(rampL / 10);
    for (let k = 0; k < segs; k++) {
      const ua = u0 + (u1 - u0) * k / segs, ub = u0 + (u1 - u0) * (k + 1) / segs, za = zAt(ua), zb = zAt(ub);
      for (const sv of [-1, 1]) {
        const e = sv * halfW, ta = sv * (halfW + 2 * (za - zG)), tb = sv * (halfW + 2 * (zb - zG));
        const quad = [W(ua, e, za + 0.14), W(ub, e, zb + 0.14), W(ub, tb, zG - 0.3), W(ua, ta, zG - 0.3)];
        faces.push(texFace(quad, C.fill, 'grass-dry', quad.map((p) => [p[0] / 4, p[1] / 4])));
      }
    }
  }
  return {
    faces,
    structure: {
      id, kind: 'overpass', s, span: [-uAb, uAb], deckHalfWidth: halfW, clearanceTarget: clearance,
      pavementMax: zPav, underside: zU, deckTop: zTop, bearings, soffits,
      footprint: { s0: s - halfW, s1: s + halfW },
    },
  };
}

/**
 * An overhead sign gantry over direction D at station `s`: posts on the median wall, the separation
 * wall and past the outer shoulder; a box truss; guide signs hung with their bottom edge at
 * `clearance` over the highest pavement below.
 */
export function gantry(ctx, { id = 'gantry-1', s, D = 1, clearance = GANTRY.clearance } = {}) {
  const { alignment, section, P, paved } = ctx;
  const G = GANTRY;
  const st = alignment.at(s);
  const zPav = pavementMax({ ...ctx }, s - 1, s + 1);
  const zB = zPav + clearance;                                   // sign bottom
  const zT = zB + G.signH - G.truss;                             // truss bottom (signs hang in front)
  const faces = [], soffits = [];
  const sep = section.bands.find((b) => b.wall === 'separation');
  const posts = [0.2, ...(sep ? [(sep.d0 + sep.d1) / 2] : []), paved + 1.2];
  for (const d of posts) {
    const p = P(st, D, d); p[2] = Math.min(p[2], P(st, D, Math.max(0, d - 0.4))[2]) + (d < paved ? 1.07 : -0.2);
    faces.push(...boxFaces(p, [0.6, 0.6, zT + G.truss - p[2]], st.heading, C.steel));
  }
  // truss: a box spanning post to post
  const a = P(st, D, 0.2), b = P(st, D, paved + 1.2);
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, zT];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  faces.push(...boxFaces(mid, [G.truss, len, G.truss], st.heading, C.steel));
  soffits.push({ tag: 'truss', corners: boxFaces(mid, [G.truss, len, G.truss], st.heading, C.steel).at(-1).corners });
  // guide signs: centred over lane groups, facing oncoming traffic (−D along s)
  const lanes = section.bands.filter((b) => b.kind === 'lane');
  const groups = [];
  for (const rw of ['express', 'collector']) {
    const ls = lanes.filter((l) => l.roadway === rw);
    if (!ls.length) continue;
    const d0 = ls[0].d0, d1 = ls[ls.length - 1].d1;
    const n = Math.max(1, Math.round((d1 - d0) / 8));
    for (let k = 0; k < n; k++) groups.push(d0 + (d1 - d0) * (k + 0.5) / n);
  }
  const face3 = (dc, w, h, z0, ds, hex) => {
    const sa = s - D * ds;
    const st2 = alignment.at(sa);
    const c = [P(st2, D, dc - w / 2), P(st2, D, dc + w / 2)];
    const corners = [[c[0][0], c[0][1], z0], [c[1][0], c[1][1], z0], [c[1][0], c[1][1], z0 + h], [c[0][0], c[0][1], z0 + h]];
    // face oncoming traffic: the normal points away from a point downstream of the sign
    return faceOut(corners, hex, [st2.x + Math.cos(st2.heading) * D * 10, st2.y + Math.sin(st2.heading) * D * 10]);
  };
  for (const dc of groups) {
    const back = face3(dc, G.signW, G.signH, zB, 0.6, C.white);
    faces.push(back);
    soffits.push({ tag: 'sign', corners: [back.corners[0], back.corners[1], back.corners[1], back.corners[0]], z: zB });
    faces.push(face3(dc, G.signW - 0.24, G.signH - 0.24, zB + 0.12, 0.62, C.green));
    for (const [w, z] of [[G.signW * 0.62, 2.35], [G.signW * 0.44, 1.55], [G.signW * 0.3, 0.75]]) faces.push(face3(dc, w, 0.34, zB + z, 0.64, C.white));
  }
  return { faces, structure: { id, kind: 'gantry', s, D, clearanceTarget: clearance, pavementMax: zPav, signBottom: zB, soffits, footprint: { s0: s - 1.2, s1: s + 1.2 } } };
}

/**
 * Measured clearance: over a lattice of the pavement under a structure's footprint, the lowest
 * soffit above each point minus the pavement's z there. Soffit heights come from the drawn faces
 * (plane through their corners); pavement from the drawn frame.
 */
export function measureClearance(ctx, structure) {
  const { alignment, P, paved } = ctx;
  const quads = structure.soffits.filter((q) => q.tag !== 'sign').map((q) => {
    const c = q.corners, xs = c.map((p) => p[0]), ys = c.map((p) => p[1]);
    return { c, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys), z: Math.min(...c.map((p) => p[2])) };
  });
  const signs = structure.soffits.filter((q) => q.tag === 'sign');
  const inside = (c, x, y) => {
    let ok = true;
    for (let i = 0; i < c.length; i++) {
      const a = c[i], b = c[(i + 1) % c.length];
      const cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
      if (i === 0) ok = cr; else if (Math.sign(cr) !== Math.sign(ok) && Math.abs(cr) > 1e-9) return false;
    }
    return true;
  };
  let min = Infinity, at = null;
  const { s0, s1 } = structure.footprint;
  for (let s = s0; s <= s1 + 1e-9; s += 0.5) {
    const st = alignment.at(s);
    for (const D of [1, -1]) for (let d = 0.4; d <= paved + 1e-9; d += 0.5) {
      const p = P(st, D, d);
      for (const q of quads) {
        if (p[0] < q.minX || p[0] > q.maxX || p[1] < q.minY || p[1] > q.maxY || !inside(q.c, p[0], p[1])) continue;
        const cl = q.z - p[2];
        if (cl > 0 && cl < min) { min = cl; at = { s, D, d }; }
      }
    }
  }
  // sign faces are vertical: their bottom edge over the pavement under it
  for (const sg of signs) {
    const [a, b] = sg.corners;
    for (let t = 0; t <= 1; t += 0.05) {
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      // nearest pavement point: project onto the alignment at the structure's station
      const st = alignment.at(structure.s), nx = -Math.sin(st.heading), ny = Math.cos(st.heading);
      const off = (x - st.x) * nx + (y - st.y) * ny, D = off < 0 ? 1 : -1, d = Math.abs(off);
      if (d > paved) continue;
      const cl = sg.z - P(st, D, d)[2];
      if (cl < min) { min = cl; at = { s: structure.s, D, d }; }
    }
  }
  return { clearanceMin: min, at };
}
