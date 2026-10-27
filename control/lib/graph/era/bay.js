/**
 * The BAY shell: a modern room whose structure is its ornament (the bay kits, era/stage.js: military, utility,
 * science). Read from the principles of a striking interior, each a part of the shell:
 *
 *   rhythm    the room's bays (`kit.bay`) set everything: pilasters at the bay lines, a light strip on each, beams across
 *             the short span at the same lines, the lamps between them, the floor's joints on the same grid
 *   layers    every solid wall a BASE (a kick band standing proud), a FIELD, a CROWN (a band standing proud under the
 *             roof); a doorway framed (jambs and a head, a lamp over it), the layers broken round it
 *   the map   the floor ZONED: a field, a band of grating round it at the walls' feet, a hazard line between them, lamps
 *             inset at the band's edge on the bay lines; a big room a PAD marked in its middle
 *   light     many small sources on the rhythm (strips on the pilasters, inset lamps, lamps hung between the beams, or
 *             a low room's strips across its ceiling): seats (`fixture: 'strip' | 'highbay' | 'inset' | 'lamp'`), baked
 *   overhead  something hangs: a tall room's beams, ducts and lamps; a taller one's bridge crane (rails on corbels down
 *             both long walls, a girder across in hazard paint, a trolley, cables to a hook block); a low room's pipes
 *   two scales a tall room's catwalk along a long wall (a grating deck on brackets, a railing, a stair up to it): a
 *             person's height beside the room's
 *
 *   bayRoom(out, r, ri, kit, surf) → { seats, bays, structure }   faces into `out`; `surf(part)` the stage's surface
 *             maker; the parts a bay kit lays: floor, band, hazard, base, wall, crown, column, trim, ceiling, soffit,
 *             beam, duct, grate. `structure` says what was built where (the beams, the crane, the catwalk) for the
 *             dressing and the laws
 *
 * Pure: the dice are the room's (`hash3` on its index). Visual only: the catwalk and the stair are not walked yet.
 */
import { P, r5, panel, box, wallBox, quad, onWall, solidSpans, openingU } from './geom.js';
import { hash3 } from './dirt.js';
import { tube, tubeAB, lit, wallFrameOf } from './lab.js';

const Z = [0, 0, 1], DOWN = [0, 0, -1];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
// a decal's lift off the floor (a painted line, an inset lamp): over the floor, never fighting it
const LIFT = 0.004;

export function bayRoom(out, r, ri, kit, surf) {
  const B = kit.B, h = r.h, seats = [], bays = [];
  const w = r.x1 - r.x0, d = r.y1 - r.y0, alongY = d >= w, span = alongY ? w : d, run = alongY ? d : w;
  // (s across the short span, l down the long run)
  const at = (s, l, z) => (alongY ? [s, l, z] : [l, s, z]);
  const s0 = alongY ? r.x0 : r.y0, s1 = alongY ? r.x1 : r.y1, l0 = alongY ? r.y0 : r.x0, l1 = alongY ? r.y1 : r.x1;
  const tall = h >= B.highbay.min, beamD = tall ? clamp(span * B.beam.perSpan, B.beam.min, B.beam.max) : 0;
  const nRun = Math.max(1, Math.round(run / kit.bay)), runLines = [...Array(nRun + 1)].map((_, k) => l0 + (run * k) / nRun);
  const structure = { alongY, tall, beamD, beams: tall ? runLines.slice(1, -1) : [], lamps: [], layers: [] };

  // ── the floor: the field, the band of grating at the walls' feet, the hazard line, the inset lamps, a pad ──
  const F0 = surf('floor', ri), world = (sf) => ({ ...sf, uvOf: (p) => [p[0] / sf.scale, p[1] / sf.scale] });
  const banded = span >= B.floor.minSpan, bw = banded ? B.floor.band : 0, hw = banded ? B.floor.hazard : 0;
  const inner = (e) => [r.x0 + e, r.y0 + e, r.x1 - e, r.y1 - e];
  const rect = (x0, y0, x1, y1, z, sf, n = Z) => panel(out, [x0, y0, z], [1, 0, 0], x1 - x0, [0, 1, 0], y1 - y0, n, world(sf), sf.cell);
  // (a ring of four strips between two insets)
  const ring = (e0, e1, z, sf) => { const [a0, b0, a1, b1] = inner(e0), [c0, d0, c1, d1] = inner(e1); rect(a0, b0, a1, d0, z, sf); rect(a0, d1, a1, b1, z, sf); rect(a0, d0, c0, d1, z, sf); rect(c1, d0, a1, d1, z, sf); };
  const [fx0, fy0, fx1, fy1] = inner(bw + hw);
  rect(fx0, fy0, fx1, fy1, 0, F0);
  if (banded) { ring(0, bw, 0, surf('band')); ring(bw, bw + hw, 0, surf('hazard')); }
  // the inset lamps: on the band's inner edge, at the run's bay lines, both long sides
  if (banded) for (const l of runLines.slice(1, -1)) for (const s of [s0 + bw + hw / 2, s1 - bw - hw / 2]) {
    const c = at(s, l, LIFT), I = B.inset, hx = alongY ? I.w / 2 : I.l / 2, hy = alongY ? I.l / 2 : I.w / 2;
    out.push(lit([[c[0] - hx, c[1] - hy, LIFT], [c[0] + hx, c[1] - hy, LIFT], [c[0] + hx, c[1] + hy, LIFT], [c[0] - hx, c[1] + hy, LIFT]], Z, I.fill, 'stage:lamp', `0 0 8px 3px ${I.color}`, 2));
    seats.push({ at: P([c[0], c[1], 0.12]), n: Z, color: I.color, intensity: I.intensity, radius: I.radius, fixture: 'inset' });
  }
  // a big room's pad: a hazard outline round its middle (a maintenance bay, a landing mark)
  if (span >= B.pad.minSpan && run >= B.pad.minSpan) {
    const ps = span * B.pad.share / 2, pl = Math.min(run * B.pad.share, span * B.pad.share * 1.4) / 2, sc = (s0 + s1) / 2, lc = (l0 + l1) / 2, t = B.pad.line;
    const [x0, y0] = at(sc - ps, lc - pl, 0), [x1, y1] = at(sc + ps, lc + pl, 0), hz = surf('hazard');
    rect(x0, y0, x1, y0 + t, LIFT, hz); rect(x0, y1 - t, x1, y1, LIFT, hz); rect(x0, y0 + t, x0 + t, y1 - t, LIFT, hz); rect(x1 - t, y0 + t, x1, y1 - t, LIFT, hz);
    structure.pad = { at: at(sc, lc, 0), half: alongY ? [ps, pl] : [pl, ps] };
  }

  // ── the walls, bay by bay: the layers, the pilasters and their strips, the doorways framed ──
  const sides = ['-y', '+x', '+y', '-x'].filter((s) => !r.open.includes(s));
  const base = surf('base', ri), field = surf('wall', ri), crown = surf('crown'), col = surf('column'), hz = surf('hazard');
  const Ba = B.base, Cr = B.crown, Pl = B.pilaster, Dr = B.door;
  const zc1 = h - beamD, zc0 = zc1 - Cr.h;
  for (const s of sides) {
    const F = wallFrameOf(r, s), cuts = r.openings[s].map((op) => [...openingU(F, op), op.top]).sort((p, q) => p[0] - q[0]);
    const n = Math.max(1, Math.round(F.len / kit.bay)), lines = [...Array(n + 1)].map((_, k) => (F.len * k) / n);
    // the layers, broken round each doorway and its frame
    const framed = cuts.map(([c0, c1, top]) => [c0 - Dr.frame, c1 + Dr.frame, top + Dr.frame]);
    const solid = solidSpans(F.len, framed.map(([a, b]) => [a, b]));
    for (const [a, b] of solid) {
      wallBox(out, F, a, b, 0, Ba.h, Ba.out, base, base.cell, true);
      panel(out, onWall(F, a, 0, Ba.h), F.U, b - a, Z, zc0 - Ba.h, F.N, field, field.cell);
    }
    // over each doorway the field from its frame's head up to the crown; the crown itself unbroken where it clears them
    for (const [a, b, top] of framed) if (top < zc0) panel(out, onWall(F, a, 0, top), F.U, b - a, Z, zc0 - top, F.N, field, field.cell);
    for (const [a, b] of solidSpans(F.len, framed.filter(([, , top]) => top > zc0 - 0.05).map(([a, b]) => [a, b]))) wallBox(out, F, a, b, zc0, zc1, Cr.out, crown, crown.cell, true);
    if (zc1 < h) panel(out, onWall(F, 0, 0, zc1), F.U, F.len, Z, h - zc1, F.N, field, field.cell);
    structure.layers.push({ side: s, bands: [Ba.h, zc0, zc1].filter((z, i, a) => i === 0 || z > a[i - 1] + 1e-6).length + 1 });
    // each doorway: jambs and a head standing proud, the head in hazard paint, a lamp over it
    for (const [c0, c1, top] of cuts) {
      wallBox(out, F, c0 - Dr.frame, c0, 0, top, Dr.out, col, col.cell);
      wallBox(out, F, c1, c1 + Dr.frame, 0, top, Dr.out, col, col.cell);
      wallBox(out, F, c0 - Dr.frame, c1 + Dr.frame, top, top + Dr.frame, Dr.out, hz, 1);
      const mid = (c0 + c1) / 2, lz = top + Dr.frame + 0.25;
      if (lz + 0.2 < zc0) {
        out.push(lit([onWall(F, mid - 0.2, Dr.out + 0.02, lz), onWall(F, mid + 0.2, Dr.out + 0.02, lz), onWall(F, mid + 0.2, Dr.out + 0.02, lz + 0.12), onWall(F, mid - 0.2, Dr.out + 0.02, lz + 0.12)], F.N, Dr.lamp, 'stage:lamp', `0 0 10px 4px ${Dr.lamp}`, 3));
        seats.push({ at: P(onWall(F, mid, Dr.out + 0.4, lz)), n: F.N, color: Dr.lamp, intensity: Dr.intensity, radius: Dr.radius, fixture: 'lamp' });
      }
    }
    // the pilasters at the bay lines (none at a doorway's frame), a light strip down each one's face
    for (let k = 0; k <= n; k++) {
      const u = lines[k], pw = Pl.w / 2;
      if (framed.some(([a, b]) => u > a - pw - 0.1 && u < b + pw + 0.1)) continue;
      wallBox(out, F, Math.max(0, u - pw), Math.min(F.len, u + pw), 0, h, Pl.out, col, col.cell, k === 0 || k === n);
      if (k === 0 || k === n) continue;
      const S = Pl.strip, z0 = S.z0, z1 = Math.min(zc0 - 0.4, S.z0 + S.len), sw = S.w / 2;
      if (z1 - z0 < 0.6) continue;
      out.push(lit([onWall(F, u - sw, Pl.out + 0.004, z0), onWall(F, u + sw, Pl.out + 0.004, z0), onWall(F, u + sw, Pl.out + 0.004, z1), onWall(F, u - sw, Pl.out + 0.004, z1)], F.N, S.fill, 'stage:lamp', `0 0 12px 4px ${S.color}`, 2.5));
      if ((k - 1) % S.every === 0) seats.push({ at: P(onWall(F, u, Pl.out + 0.35, (z0 + z1) / 2)), n: F.N, color: S.color, intensity: S.intensity, radius: S.radius, fixture: 'strip' });
    }
    bays.push(...lines.slice(0, -1).map((u0, k) => ({ F, side: s, k, u0, u1: lines[k + 1] })));
  }

  // ── the roof: a tall room's deck, beams, ducts and lamps hung between; a low room's soffit and strips ──
  const steel = surf('trim');
  if (tall) {
    const deck = surf('ceiling');
    panel(out, [r.x0, r.y0, h], [1, 0, 0], w, [0, 1, 0], d, DOWN, deck, deck.cell);
    const bm = surf('beam'), Bm = B.beam;
    for (const c of structure.beams) {
      // (an I: the bottom flange, the web, the top flange; at() maps the span's ends to x or y, so the box is normalised)
      const ib = (z0, z1, t, sf) => { const a = at(s0, c - t, z0), b = at(s1, c + t, z1); box(out, [Math.min(a[0], b[0]), Math.min(a[1], b[1]), z0], [Math.max(a[0], b[0]), Math.max(a[1], b[1]), z1], sf, sf.cell, alongY ? ['-x', '+x'] : ['-y', '+y']); };
      ib(h - beamD, h - beamD + Bm.flange, Bm.w / 2, bm);
      ib(h - beamD + Bm.flange, h - Bm.flange, Bm.web / 2, bm);
      ib(h - Bm.flange, h, Bm.w / 2, bm);
    }
    const D = B.duct, zD = h - beamD - D.r - D.gap;
    for (const f of D.at) tube(out, at(s0 + span * f, l0, zD), at(s0 + span * f, l1, zD), D.r, D.sides, surf('duct'));
    // the lamps: hung between the beams in rows across the span, each a stem, a housing and its lens
    const Hb = B.highbay, rows = span > Hb.twoRows ? [0.3, 0.7] : [0.5], mids = [l0, ...structure.beams, l1], zL = h - beamD - Hb.drop;
    for (let k = 0; k + 1 < mids.length; k++) for (const f of rows) {
      const c = at(s0 + span * f, (mids[k] + mids[k + 1]) / 2, zL), R = Hb.r;
      box(out, [c[0] - 0.02, c[1] - 0.02, zL + Hb.h], [c[0] + 0.02, c[1] + 0.02, h], steel, 1, ['-z', '+z']);
      tubeAB(out, [c[0], c[1], zL], [c[0], c[1], zL + Hb.h], R, 8, surf('duct'));
      out.push(lit([[c[0] - R * 0.7, c[1] - R * 0.7, zL - 0.005], [c[0] - R * 0.7, c[1] + R * 0.7, zL - 0.005], [c[0] + R * 0.7, c[1] + R * 0.7, zL - 0.005], [c[0] + R * 0.7, c[1] - R * 0.7, zL - 0.005]], DOWN, Hb.fill, 'stage:lamp', `0 0 16px 6px ${Hb.color}`, 3));
      seats.push({ at: P([c[0], c[1], zL - 0.3]), n: DOWN, color: Hb.color, intensity: Hb.intensity, radius: Hb.radius, fixture: 'highbay' });
      structure.lamps.push(P(c));
    }
  } else {
    const sof = surf('soffit');
    panel(out, [r.x0, r.y0, h], [1, 0, 0], w, [0, 1, 0], d, DOWN, sof, sof.cell);
    // strips across the span at each bay's middle, in a housing standing down from the soffit
    const St = B.ceilingStrip, mids = runLines.slice(0, -1).map((l, k) => (l + runLines[k + 1]) / 2), half = (span * St.share) / 2, sc = (s0 + s1) / 2;
    for (const l of mids) {
      const a = at(sc - half, l - St.w, h - St.h), b = at(sc + half, l + St.w, h);
      box(out, [Math.min(a[0], b[0]), Math.min(a[1], b[1]), h - St.h], [Math.max(a[0], b[0]), Math.max(a[1], b[1]), h], steel, 1, ['+z']);
      const q = (ds, dl) => at(sc + ds, l + dl, h - St.h - 0.004);
      out.push(lit([q(-half + 0.04, -St.w + 0.03), q(-half + 0.04, St.w - 0.03), q(half - 0.04, St.w - 0.03), q(half - 0.04, -St.w + 0.03)], DOWN, St.fill, 'stage:lamp', `0 0 12px 4px ${St.color}`, 2.5));
      seats.push({ at: P(at(sc, l, h - St.h - 0.3)), n: DOWN, color: St.color, intensity: St.intensity, radius: St.radius, fixture: 'strip' });
    }
    // services run along a low room's ceiling at one wall: a pair of pipes, so even a passage has something overhead
    const Pp = B.pipes, side = s1 - Pp.off;
    Pp.r.forEach((pr, i) => tube(out, at(side - i * Pp.gap, l0, h - Pp.drop - i * 0.04), at(side - i * Pp.gap, l1, h - Pp.drop - i * 0.04), pr, 8, surf('duct')));
    structure.pipes = Pp.r.length;
  }

  // ── a taller room's bridge crane ──
  const Cn = B.crane;
  if (tall && h >= Cn.min && span >= Cn.minSpan) {
    const zR = h - beamD - Cn.below, off = Pl.out + Cn.rail.w / 2 + 0.05, rails = [s0 + off, s1 - off];
    for (const sr of rails) {
      const a = at(sr - Cn.rail.w / 2, l0, zR - Cn.rail.h), b = at(sr + Cn.rail.w / 2, l1, zR);
      box(out, [Math.min(a[0], b[0]), Math.min(a[1], b[1]), zR - Cn.rail.h], [Math.max(a[0], b[0]), Math.max(a[1], b[1]), zR], steel, steel.cell, alongY ? ['-y', '+y'] : ['-x', '+x']);
      // a corbel under the rail at each bay line, back to the pilaster
      for (const l of runLines.slice(1, -1)) {
        const wall = sr < (s0 + s1) / 2 ? s0 : s1, p = at(Math.min(wall, sr), l - 0.15, zR - Cn.rail.h - 0.6), q = at(Math.max(wall, sr), l + 0.15, zR - Cn.rail.h);
        box(out, [Math.min(p[0], q[0]), Math.min(p[1], q[1]), zR - Cn.rail.h - 0.6], [Math.max(p[0], q[0]), Math.max(p[1], q[1]), zR - Cn.rail.h], col, col.cell);
      }
    }
    // the girder across, its trucks on the rails, a trolley on it, two cables down to the hook block
    const lg = l0 + run * (0.3 + 0.4 * hash3(ri, 7, 4401)), G = Cn.girder, zG = zR + 0.05;
    const gb = at(rails[0], lg - G.w / 2, zG), ge = at(rails[1], lg + G.w / 2, zG + G.h);
    box(out, [Math.min(gb[0], ge[0]), Math.min(gb[1], ge[1]), zG], [Math.max(gb[0], ge[0]), Math.max(gb[1], ge[1]), zG + G.h], hz, 1);
    for (const sr of rails) { const a = at(sr - 0.35, lg - G.w, zG - 0.05), b = at(sr + 0.35, lg + G.w, zG + G.h + 0.15); box(out, [Math.min(a[0], b[0]), Math.min(a[1], b[1]), zG - 0.05], [Math.max(a[0], b[0]), Math.max(a[1], b[1]), zG + G.h + 0.15], steel, 1); }
    const st = s0 + span * (0.35 + 0.3 * hash3(ri, 9, 4403)), tc = at(st, lg, zG + G.h), Hk = Cn.hook, zH = Math.max(Hk.least, h * Hk.share);
    box(out, [tc[0] - 0.6, tc[1] - 0.6, zG + G.h], [tc[0] + 0.6, tc[1] + 0.6, zG + G.h + 0.5], col, 1);
    for (const sg of [-0.18, 0.18]) { const cp = at(st + sg, lg, 0); box(out, [cp[0] - 0.015, cp[1] - 0.015, zH + Hk.h], [cp[0] + 0.015, cp[1] + 0.015, zG], steel, 1, ['-z', '+z']); }
    box(out, [tc[0] - 0.3, tc[1] - 0.22, zH], [tc[0] + 0.3, tc[1] + 0.22, zH + Hk.h], hz, 1);
    box(out, [tc[0] - 0.05, tc[1] - 0.05, zH - 0.45], [tc[0] + 0.05, tc[1] + 0.05, zH], steel, 1, ['+z']);
    structure.crane = { girder: lg, hook: P([tc[0], tc[1], zH]) };
  }

  // ── a tall room's catwalk along a long wall, a stair up to it ──
  const Cw = B.catwalk, longSides = sides.filter((s) => (alongY ? s === '-x' || s === '+x' : s === '-y' || s === '+y'));
  if (tall && h >= Cw.min && longSides.length) {
    // (the long wall with the fewest doorways)
    const s = longSides.sort((p, q) => r.openings[p].length - r.openings[q].length || (p < q ? -1 : 1))[0], F = wallFrameOf(r, s);
    const cz = Cw.z, o0 = Pl.out, o1 = Pl.out + Cw.d, going = Cw.going, nSteps = Math.ceil(cz / Cw.rise), sLen = nSteps * going;
    const cuts = r.openings[s].map((op) => openingU(F, op));
    const startU = 0.6, landU = startU + sLen, endU = F.len - 0.6;
    if (endU - landU > 4 && !cuts.some(([c0]) => c0 < landU + 1)) {
      const gr = surf('grate'), steelS = steel;
      // (a box between two offsets off the wall, two places along it and two heights: wallBox runs from the wall itself)
      const slab = (u0, u1, o0x, o1x, z0, z1, sf) => { const a = onWall(F, u0, o0x, z0), b = onWall(F, u1, o1x, z1); box(out, [Math.min(a[0], b[0]), Math.min(a[1], b[1]), z0], [Math.max(a[0], b[0]), Math.max(a[1], b[1]), z1], sf, sf.cell ?? 1); };
      // the deck: grating on top, a steel fascia round it, brackets back to the wall at the bay lines
      const top = (u0, u1, z, o0x, o1x) => quad(out, [onWall(F, u0, o0x, z), onWall(F, u1, o0x, z), onWall(F, u1, o1x, z), onWall(F, u0, o1x, z)], Z, gr, null, null, [[0, 0], [(u1 - u0) / gr.scale, 0], [(u1 - u0) / gr.scale, (o1x - o0x) / gr.scale], [0, (o1x - o0x) / gr.scale]]);
      top(landU, endU, cz, o0, o1);
      wallBox(out, F, landU, endU, cz - Cw.fascia, cz - 0.005, o1, steelS, steelS.cell);
      const n = Math.max(1, Math.round(F.len / kit.bay));
      for (let k = 1; k < n; k++) {
        const u = (F.len * k) / n; if (u < landU || u > endU) continue;
        tubeAB(out, onWall(F, u, 0.05, cz - 1.6), onWall(F, u, o1 - 0.1, cz - Cw.fascia), 0.05, 6, steelS);
      }
      // the railing at the deck's front edge: posts, a top and a mid rail, a toe board
      const rail = (u0, u1, off, z0) => {
        const np = Math.max(1, Math.round((u1 - u0) / Cw.post));
        for (let i = 0; i <= np; i++) { const u = u0 + ((u1 - u0) * i) / np; slab(u - 0.03, u + 0.03, off - 0.06, off, z0, z0 + Cw.rail, steelS); }
        for (const zr of [Cw.rail, Cw.rail / 2]) tubeAB(out, onWall(F, u0, off - 0.03, z0 + zr), onWall(F, u1, off - 0.03, z0 + zr), 0.025, 6, steelS);
      };
      rail(landU, endU, o1, cz);
      slab(landU, endU, o1 - 0.025, o1, cz, cz + 0.12, hz);
      // the stair: treads rising toward the deck along the wall, a stringer each side, a rail on the open side
      const riseH = cz / nSteps;
      for (let i = 0; i < nSteps; i++) {
        const u = startU + i * going, z = (i + 1) * riseH;
        quad(out, [onWall(F, u, o0, z), onWall(F, u + going, o0, z), onWall(F, u + going, o1, z), onWall(F, u, o1, z)], Z, gr, null, null, [[0, 0], [going / gr.scale, 0], [going / gr.scale, Cw.d / gr.scale], [0, Cw.d / gr.scale]]);
      }
      for (const off of [o0 + 0.03, o1 - 0.03]) tubeAB(out, onWall(F, startU, off, 0.05), onWall(F, landU, off, cz - 0.05), 0.06, 6, steelS);
      tubeAB(out, onWall(F, startU, o1 - 0.03, Cw.rail), onWall(F, landU, o1 - 0.03, cz + Cw.rail), 0.025, 6, steelS);
      structure.catwalk = { side: s, z: cz, from: r5(landU), to: r5(endU), stair: [r5(startU), r5(landU)] };
    }
  }
  return { seats, bays, structure };
}
