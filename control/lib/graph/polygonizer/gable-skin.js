/**
 * GABLE SKIN (houseLook 2): the wall a pitched roof closes above the top storey is the same wall as the storeys below
 * it, so it wears their facade: brick or stone carried up in its bond, render as one plane, boards and siding run to the
 * rake. Its sloped edges are finished as the roof style says (architecture/roof.js `verge`):
 *
 *   (absent)   a verge band down the rake: the trim's barge board, a masonry coping laid flush
 *   coping     the masonry raised a little past the slates and capped (a Dutch street gable)
 *   parapet    the party wall carried up through the roof and coped (a London terrace), and with `stack`, the
 *              chimney stack on the party wall at the ridge, its pots on top
 *
 * and with `loft` a loft window in each gable, with `hoist` the hoist beam over the street gable's. Drawn on the wall's
 * outward plane, proud in staggered lifts as the facade skins are (floorplan-structure.js brickFacade and its siblings).
 *
 *   gableSkinFaces(corners, spec, { inner, light, roof, street }) → faces
 *     corners  the gable polygon (world, a vertical plane), as roof.js hands it
 *     spec     { facade, body, joint, unit:[w,h], board, trim, coping, t, courseZ }: the facade's own tints (gableSkinSpec)
 *     street   true: this gable faces the street (the hoist beam's)
 */
import { faceCard } from '../architecture/roof.js';
import { shadeHex, scaleHex } from './vexar.js';

const JT = 0.05;           // a mortar joint (ft), as the brick facade draws it
const VERGE = 0.45, COPE = 0.28, PARAPET = 1.1, RAISE = 0.3;
const POT = '#a8603e';

export function gableSkinFaces(corners, spec, { inner, light, roof = {}, street = false }) {
  const along = Math.abs(corners[0][0] - corners[1][0]) < 1e-6 && Math.abs(corners[0][0] - corners[2][0]) < 1e-6 ? 1 : 0;
  const across = 1 - along, at = corners[0][across], side = at >= inner[across] ? 1 : -1;
  const N = across === 0 ? [side, 0, 0] : [0, side, 0];
  const tHalf = spec.t / 2;
  // a point on the wall: `a` along it, `out` past its outward face (negative: back into the wall), `z` up
  const P = (a, out, z) => { const p = [0, 0, z]; p[along] = a; p[across] = at + side * (tHalf + out); return p; };
  const poly = corners.map((c) => [c[along], c[2]]);
  const faces = [];
  const emit = (pts, color, n = N, group = 'facade:skin') => faces.push({ ...faceCard(pts), fill: shadeHex(color, n, light), doubleSided: true, outNormal: n, group });
  const rect = (a0, a1, z0, z1, color, lift) => { if (a1 - a0 > 0.02 && z1 - z0 > 0.02) emit([P(a0, lift, z0), P(a1, lift, z0), P(a1, lift, z1), P(a0, lift, z1)], color); };
  // the polygon's span at a height, and its top over a point along it
  const cuts = (k, v) => {
    const hits = [];
    for (let i = 0; i < poly.length; i += 1) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      if ((p[k] - v) * (q[k] - v) > 0 || p[k] === q[k]) continue;
      const u = (v - p[k]) / (q[k] - p[k]); hits.push(p[1 - k] + u * (q[1 - k] - p[1 - k]));
    }
    return hits;
  };
  const spanAt = (z) => { const h = cuts(1, z); return h.length ? [Math.min(...h), Math.max(...h)] : null; };
  const topAt = (a) => { const h = cuts(0, a); return h.length ? Math.max(...h) : -Infinity; };
  // a band from z0 to z1 kept inside the polygon (its narrower end's span)
  const band = (z0, z1, color, lift, inset = 0) => {
    const s0 = spanAt(z0), s1 = spanAt(z1);
    if (s0 && s1) rect(Math.max(s0[0], s1[0]) + inset, Math.min(s0[1], s1[1]) - inset, z0, z1, color, lift);
  };
  const zs = poly.map((p) => p[1]), zLo = Math.min(...zs), zHi = Math.max(...zs);
  const as = poly.map((p) => p[0]), aLo = Math.min(...as), aHi = Math.max(...as);

  // ── the wall ──
  const f = spec.facade;
  if (f === 'brick' || f === 'stone') {
    emit(poly.map(([a, z]) => P(a, 0.03, z)), spec.body);
    const [bw, ch] = spec.unit;
    // the courses carried on from the storey below: its bond's own heights and its half-brick shift
    let ci = Math.ceil((zLo - spec.courseZ) / ch - 1e-6);
    for (let z = spec.courseZ + ci * ch; z < zHi - ch * 0.4; z += ch, ci += 1) {
      band(z, z + JT, spec.joint, 0.045);
      const s = spanAt(z + ch); if (!s) continue;
      const phase = ci % 2 ? bw / 2 : 0;
      for (let x = Math.floor((s[0] - phase) / bw) * bw + phase; x <= s[1]; x += bw) if (x > s[0] && x + JT < s[1]) rect(x, x + JT, z + JT, Math.min(z + ch, topAt(x), topAt(x + JT)), spec.joint, 0.045);
    }
  } else if (f === 'boards' || f === 'metal') {
    // boards (or sheet) run to the rake, each cut square at its lower corner; the joint behind fills the rest
    emit(poly.map(([a, z]) => P(a, 0.03, z)), spec.joint);
    const bw = spec.unit[0], gap = 0.035;
    for (let a = Math.floor(aLo / bw) * bw, i = 0; a < aHi; a += bw, i += 1) {
      const a0 = Math.max(aLo, a + gap / 2), a1 = Math.min(aHi, a + bw - gap / 2);
      if (a1 > a0) rect(a0, a1, zLo, Math.min(topAt(a0), topAt(a1)), scaleHex(spec.body, i % 2 ? 0.94 : 1), 0.045);
    }
  } else if (f === 'siding') {
    emit(poly.map(([a, z]) => P(a, 0.03, z)), spec.body);
    for (let z = zLo; z < zHi - 0.3; z += 0.62) {
      band(z, z + 0.08, scaleHex(spec.body, 0.78), 0.044);
      band(z + 0.08, z + 0.62 * 0.78, spec.body, 0.032);
    }
  } else {
    emit(poly.map(([a, z]) => P(a, 0.03, z)), spec.body);   // render, tofu: one plane
  }

  // ── the loft window (and the hoist beam over the street gable's) ──
  if (roof.loft) {
    const w = 3, h = 4.5, sill = zLo + 2.5, mid = (aLo + aHi) / 2;
    const s = spanAt(sill + h + 1.5);
    if (s && s[0] < mid - w / 2 - 1 && s[1] > mid + w / 2 + 1) {
      const fw = 0.3;
      rect(mid - w / 2 - fw, mid + w / 2 + fw, sill - fw, sill + h + fw, spec.trim, 0.06);   // the frame
      rect(mid - w / 2, mid + w / 2, sill, sill + h, '#2a3036', 0.075);                      // the glass
      rect(mid - fw / 4, mid + fw / 4, sill, sill + h, spec.trim, 0.085);                    // the mullion
      rect(mid - w / 2, mid + w / 2, sill + h * 0.62, sill + h * 0.62 + fw / 2, spec.trim, 0.085);   // the transom
      rect(mid - w / 2 - fw * 1.6, mid + w / 2 + fw * 1.6, sill + h + fw, sill + h + fw * 2.2, spec.coping, 0.08);   // the head
      if (roof.hoist && street) {
        // the beam out of the gable's head, its hook block hanging off it
        const zb = Math.min(zHi - 1.2, sill + h + 2.2), hb = 0.4;
        box(faces, (o) => P(mid - hb / 2, o, zb), (o) => P(mid + hb / 2, o, zb + hb), -0.2, 2.6, spec.trim, light);
        box(faces, (o) => P(mid - 0.12, o, zb - 0.9), (o) => P(mid + 0.12, o, zb), 2.2, 2.45, '#3a3430', light);
      }
    }
  }

  // ── the verge ──
  const kind = roof.verge ?? 'band';
  const coping = spec.coping, masonry = f === 'brick' || f === 'stone';
  for (let i = 0; i < poly.length; i += 1) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    if (Math.abs(p[1] - q[1]) < 1e-6 || Math.abs(p[0] - q[0]) < 1e-6) continue;   // the eave line and plumb edges
    const [lo, hi] = p[1] < q[1] ? [p, q] : [q, p];
    const strip = (d0, d1, out, color, n = N) => emit([P(lo[0], out, lo[1] + d0), P(hi[0], out, hi[1] + d0), P(hi[0], out, hi[1] + d1), P(lo[0], out, lo[1] + d1)], color, n);
    if (kind === 'band') { strip(-VERGE, 0.02, 0.07, masonry ? coping : spec.trim); continue; }
    const up = kind === 'parapet' ? PARAPET : RAISE;
    // the wall carried past the slope (its face, and its back over the roof), then its coping proud of both faces and
    // its sloped top
    strip(0, up, 0.03, spec.body);
    if (masonry) for (let z = spec.unit[1]; z + 0.2 < up; z += spec.unit[1]) strip(z, z + JT, 0.045, spec.joint);
    strip(0, up, -spec.t - 0.03, spec.body, N.map((v) => -v));
    const out = 0.12, inn = -spec.t - 0.12;
    strip(up, up + COPE, out, coping);
    strip(up, up + COPE, inn, coping, N.map((v) => -v));
    emit([P(lo[0], out, lo[1] + up + COPE), P(hi[0], out, hi[1] + up + COPE), P(hi[0], inn, hi[1] + up + COPE), P(lo[0], inn, lo[1] + up + COPE)], scaleHex(coping, 1.05), [0, 0, 1]);
  }

  // ── the chimney stack on the party wall at the ridge ──
  if (roof.stack && kind === 'parapet') {
    const apex = poly.reduce((m, p) => (p[1] > m[1] ? p : m), poly[0]);
    const hw = 1.9, z0 = apex[1] - hw * Math.max(0.5, roof.pitch ?? 0.75) - 0.5, z1 = apex[1] + 3.6, back = -spec.t - 1.4;
    const at0 = (o) => P(apex[0] - hw, o, z0), at1 = (o) => P(apex[0] + hw, o, z1);
    // (proud of the gable's own courses, so its bond and theirs never share a plane)
    box(faces, at0, at1, back, 0.05, spec.body, light);
    if (masonry) for (let z = z0 + spec.unit[1]; z < z1 - 0.6; z += spec.unit[1]) rect(apex[0] - hw, apex[0] + hw, z, z + JT, spec.joint, 0.065);
    box(faces, (o) => P(apex[0] - hw - 0.2, o, z1 - 0.7), (o) => P(apex[0] + hw + 0.2, o, z1 - 0.35), back - 0.2, 0.23, coping, light);   // the oversailing course
    box(faces, (o) => P(apex[0] - hw, o, z1), (o) => P(apex[0] + hw, o, z1 + 0.2), back, 0.03, coping, light);                          // the cap
    const mo = (back + 0.03) / 2;
    for (const k of [-1.15, 0, 1.15]) box(faces, (o) => P(apex[0] + k - 0.27, o, z1 + 0.2), (o) => P(apex[0] + k + 0.27, o, z1 + 1.5), mo - 0.27, mo + 0.27, POT, light);
  }
  return faces;
}

// a box between two wall points (`lo(out)` its low corner, `hi(out)` its high one) from `o0` to `o1` out of the wall
function box(faces, lo, hi, o0, o1, color, light) {
  const A = lo(o0), B = hi(o1);
  const x0 = Math.min(A[0], B[0]), x1 = Math.max(A[0], B[0]), y0 = Math.min(A[1], B[1]), y1 = Math.max(A[1], B[1]), z0 = A[2], z1 = B[2];
  const q = [
    [[[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]],
    [[[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]],
    [[[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]],
    [[[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], [-1, 0, 0]],
    [[[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]],
  ];
  for (const [corners, n] of q) faces.push({ corners, fill: shadeHex(color, n, light), doubleSided: true, outNormal: n, group: 'facade:skin' });
}
