/**
 * The BAY shell: a modern room whose structure is its ornament (the bay kits, era/stage.js: military, utility,
 * science). Read from the principles of a striking interior, each a part of the shell:
 *
 *   rhythm    the room's bays (`kit.bay`) set everything: pilasters at the bay lines, a light strip on each, the roof's
 *             members across the short span at the same lines, the lamps between them, the floor's joints on its grid
 *   layers    every solid wall a BASE (a kick band standing proud), a FIELD, a CROWN (a band standing proud under the
 *             roof); a doorway framed (jambs and a head in the SECONDARY paint, a signal lamp over it, a hazard stripe
 *             on the floor at its threshold), the layers broken round it; a braced register crosses its end bays
 *   the map   the floor ZONED: a field, a band of grating round it at the walls' feet, a hazard line between them, lamps
 *             inset at the band's edge on the bay lines; a big room a PAD marked in its middle
 *   roof      a tall room's ROOF SYSTEM (`B.roofs`, by the room's dice): `beams` (I-beams), `truss` (open-web trusses, a
 *             Warren web), `vault` (an arched barrel on ribs, tie rods at the spring, the end walls' gables), `sawtooth`
 *             (north lights: a glazed face to each tooth glowing as daylight), `coffer` (a concrete waffle, a lamp in
 *             each other coffer); a low room a soffit (`soffit`, by its dice) with strips across it and services along it
 *   light     many small sources on the rhythm: strips on the pilasters, inset lamps, lamps hung from the roof, and the
 *             SECONDARY light, its own colour (a cove washing up the wall from the crown, the doorway's signal lamp, a
 *             downlight under a catwalk): seats (`fixture`: strip, highbay, inset, lamp, cove, down, daylight)
 *   overhead  something hangs: the roof's members, ducts and lamps; a taller room's bridge crane (rails on corbels down
 *             both long walls, a girder across in the secondary paint, a stripe across its top at each end, cables to a
 *             hook block, where the register takes one: `B.craned`); a low room's services
 *   two scales a tall room's catwalk along its long wall: a person's height beside the room's
 *   services the wiring a building runs on, shown: an electrical box every few bays with its conduit to the crown, a
 *             breaker panel by each doorway, cables slung from hooks under a tall room's crown and under a catwalk's deck,
 *             and in a low room one soffit panel out, hanging from its edge, the plenum's dark over it and the wiring
 *             sagging down through it
 *   colour    a register's SECONDARY paint on the door frames, the railings, the girder, the pilasters' foot band and one
 *             of the services; the hazard stripe only where it lies flat (the floor's edges, the pad, a threshold, a
 *             stair's nosings, the top of a girder's ends)
 *
 * WALKWAYS are walked (the page walks on the real geometry: a ray down from the eye for the floor, rays at the eye and
 * the shin for walls: channels/walk.js), so a catwalk keeps rules: it is railed on every edge over a drop but its
 * ENTRIES; it is always entered by a stair at its near end, and a long one also by a stair coming in square to it through
 * a gap in its front railing at its far end; an entry is at least `Cw.entry` wide; every railing carries a perforated
 * INFILL from just over the deck to the top rail, so it stops a walker at any height the walk's rays cast; a stair
 * carries a BANISTER down its open side along its pitch (where a walker may go under it is a game's pathing, not the
 * stair's), its foot open onto a clear landing at least `Cw.landing` deep; the deck shows no
 * face where a stair arrives (the shin's ray would stop the climb).
 *
 *   bayRoom(out, r, ri, kit, surf) → { seats, bays, structure }   faces into `out`; `surf(part)` the stage's surface
 *             maker. `structure` says what was built where (the roof, the beams, the crane, the walkways and their
 *             entries) for the dressing and the laws (bayLaws)
 *   bayLaws(rooms, faces, kit) → [{ law, ok, value, want }]   the shell's principles measured on what was built
 *
 * Pure: the dice are the room's (`hash3` on its index).
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
  const bbox = (p, q, sf, omit = []) => box(out, [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.min(p[2], q[2])], [Math.max(p[0], q[0]), Math.max(p[1], q[1]), Math.max(p[2], q[2])], sf, sf.cell ?? 1, omit);
  const dice = (k) => hash3(ri, k, 4501);
  // a surface the register offers alternates for: this room's by its dice
  const pick = (part) => { const o = B.options && B.options[part]; return o ? o[Math.floor(dice(part.length * 13 + part.charCodeAt(0)) * o.length) % o.length] : part; };
  // (an alternate is laid in its role's group: the laws, the tone's keeps and the dressing read a surface by its role)
  const S = (part) => ({ ...surf(pick(part), ri), group: `stage:${part}` });
  const tall = h >= B.highbay.min, nRun = Math.max(1, Math.round(run / kit.bay)), runLines = [...Array(nRun + 1)].map((_, k) => l0 + (run * k) / nRun);
  const inner = runLines.slice(1, -1), mids = runLines.slice(0, -1).map((l, k) => (l + runLines[k + 1]) / 2);
  // the roof system: by the register's list and the room's dice, where the room can hold it
  const fits = { beams: true, truss: true, coffer: true, vault: span >= 8, sawtooth: nRun >= 2 };
  const roofs = (B.roofs || ['beams']).filter((k) => fits[k]);
  const roof = tall ? roofs[Math.floor(dice(3) * roofs.length) % roofs.length] : 'soffit';
  const depth = roof === 'beams' ? clamp(span * B.beam.perSpan, B.beam.min, B.beam.max) : roof === 'truss' ? clamp(span * B.truss.perSpan, B.truss.min, B.truss.max) : roof === 'coffer' ? B.coffer.rib : 0;
  const rise = roof === 'vault' ? Math.min(span * B.vault.rise, h - B.vault.least) : 0, tooth = roof === 'sawtooth' ? Math.min(B.sawtooth.h, (run / nRun) * 0.45) : 0;
  // where the walls end (a vault springs, a sawtooth's teeth begin) and the crown's band under the roof
  const wallTop = h - rise - tooth, zc1 = wallTop - depth, zc0 = zc1 - B.crown.h;
  const structure = { alongY, tall, roof, depth: r5(depth), beams: ['beams', 'truss'].includes(roof) ? inner : [], lamps: [], layers: [], walkways: [], surfaces: Object.fromEntries(Object.keys(B.options || {}).map((k) => [k, pick(k)])) };
  const steel = surf('trim'), paint = surf('paint'), hz = surf('hazard');
  const L = B.light;
  const hang = (s, l, zTop, zL, Hb) => {
    const c = at(s, l, zL), R = Hb.r;
    bbox([c[0] - 0.02, c[1] - 0.02, zL + Hb.h], [c[0] + 0.02, c[1] + 0.02, zTop], steel, ['-z', '+z']);
    tubeAB(out, [c[0], c[1], zL], [c[0], c[1], zL + Hb.h], R, 8, surf('duct'));
    out.push(lit([[c[0] - R * 0.7, c[1] - R * 0.7, zL - 0.005], [c[0] - R * 0.7, c[1] + R * 0.7, zL - 0.005], [c[0] + R * 0.7, c[1] + R * 0.7, zL - 0.005], [c[0] + R * 0.7, c[1] - R * 0.7, zL - 0.005]], DOWN, Hb.fill, 'stage:lamp', `0 0 16px 6px ${Hb.color}`, 3));
    seats.push({ at: P([c[0], c[1], zL - 0.3]), n: DOWN, color: Hb.color, intensity: Hb.intensity, radius: Hb.radius, fixture: 'highbay' });
    structure.lamps.push(P(c));
  };

  // ── the floor: the field, the band of grating at the walls' feet, the hazard line, the inset lamps, a pad ──
  const F0 = S('floor'), world = (sf) => ({ ...sf, uvOf: (p) => [p[0] / sf.scale, p[1] / sf.scale] });
  const banded = span >= B.floor.minSpan, bw = banded ? B.floor.band : 0, hw = banded ? B.floor.hazard : 0;
  const ins = (e) => [r.x0 + e, r.y0 + e, r.x1 - e, r.y1 - e];
  const rect = (x0, y0, x1, y1, z, sf, n = Z) => panel(out, [x0, y0, z], [1, 0, 0], x1 - x0, [0, 1, 0], y1 - y0, n, world(sf), sf.cell);
  const ring = (e0, e1, z, sf) => { const [a0, b0, a1, b1] = ins(e0), [c0, d0, c1, d1] = ins(e1); rect(a0, b0, a1, d0, z, sf); rect(a0, d1, a1, b1, z, sf); rect(a0, d0, c0, d1, z, sf); rect(c1, d0, a1, d1, z, sf); };
  const [fx0, fy0, fx1, fy1] = ins(bw + hw);
  rect(fx0, fy0, fx1, fy1, 0, F0);
  if (banded) { ring(0, bw, 0, surf('band')); ring(bw, bw + hw, 0, hz); }
  if (banded) for (const l of inner) for (const s of [s0 + bw + hw / 2, s1 - bw - hw / 2]) {
    const c = at(s, l, LIFT), I = { ...B.inset, ...L.inset }, hx = alongY ? I.w / 2 : I.l / 2, hy = alongY ? I.l / 2 : I.w / 2;
    out.push(lit([[c[0] - hx, c[1] - hy, LIFT], [c[0] + hx, c[1] - hy, LIFT], [c[0] + hx, c[1] + hy, LIFT], [c[0] - hx, c[1] + hy, LIFT]], Z, I.fill, 'stage:lamp', `0 0 8px 3px ${I.color}`, 2));
    seats.push({ at: P([c[0], c[1], 0.12]), n: Z, color: I.color, intensity: I.intensity, radius: I.radius, fixture: 'inset' });
  }
  if (span >= B.pad.minSpan && run >= B.pad.minSpan) {
    const ps = span * B.pad.share / 2, pl = Math.min(run * B.pad.share, span * B.pad.share * 1.4) / 2, sc = (s0 + s1) / 2, lc = (l0 + l1) / 2, t = B.pad.line;
    const [x0, y0] = at(sc - ps, lc - pl, 0), [x1, y1] = at(sc + ps, lc + pl, 0);
    rect(x0, y0, x1, y0 + t, LIFT, hz); rect(x0, y1 - t, x1, y1, LIFT, hz); rect(x0, y0 + t, x0 + t, y1 - t, LIFT, hz); rect(x1 - t, y0 + t, x1, y1 - t, LIFT, hz);
    structure.pad = { at: at(sc, lc, 0), half: alongY ? [ps, pl] : [pl, ps] };
  }

  // ── the walls, bay by bay: the layers, the pilasters and their strips, the doorways framed, the coves ──
  const sides = ['-y', '+x', '+y', '-x'].filter((s) => !r.open.includes(s)), isLong = (s) => (alongY ? s === '-x' || s === '+x' : s === '-y' || s === '+y');
  const base = S('base'), field = S('wall'), crown = surf('crown'), col = surf('column');
  const Ba = B.base, Cr = B.crown, Pl = B.pilaster, Dr = B.door;
  for (const s of sides) {
    const F = wallFrameOf(r, s), cuts = r.openings[s].map((op) => [...openingU(F, op), op.top]).sort((p, q) => p[0] - q[0]);
    const n = Math.max(1, Math.round(F.len / kit.bay)), lines = [...Array(n + 1)].map((_, k) => (F.len * k) / n);
    const framed = cuts.map(([c0, c1, top]) => [c0 - Dr.frame, c1 + Dr.frame, top + Dr.frame]);
    for (const [a, b] of solidSpans(F.len, framed.map(([a, b]) => [a, b]))) {
      wallBox(out, F, a, b, 0, Ba.h, Ba.out, base, base.cell, true);
      panel(out, onWall(F, a, 0, Ba.h), F.U, b - a, Z, zc0 - Ba.h, F.N, field, field.cell);
    }
    for (const [a, b, top] of framed) if (top < zc0) panel(out, onWall(F, a, 0, top), F.U, b - a, Z, zc0 - top, F.N, field, field.cell);
    for (const [a, b] of solidSpans(F.len, framed.filter(([, , top]) => top > zc0 - 0.05).map(([a, b]) => [a, b]))) wallBox(out, F, a, b, zc0, zc1, Cr.out, crown, crown.cell, true);
    if (zc1 < wallTop) panel(out, onWall(F, 0, 0, zc1), F.U, F.len, Z, wallTop - zc1, F.N, field, field.cell);
    // over the walls' top: a vault's gables on the end walls, a sawtooth's teeth on the long ones (the far end wall up
    // to the last tooth's crest)
    if (rise > 0 && !isLong(s)) gable(out, F, s, wallTop, rise, field);
    if (tooth > 0 && isLong(s)) for (let k = 0; k < nRun; k++) {
      const ua = uOfL(F, runLines[k]), ub = uOfL(F, runLines[k + 1]), hi = ub > ua ? ub : ua, lo = ub > ua ? ua : ub, crest = ub;
      tri(out, onWall(F, lo, 0, wallTop), onWall(F, hi, 0, wallTop), onWall(F, crest, 0, h), F.N, field);
    }
    if (tooth > 0 && s === (alongY ? '+y' : '+x')) panel(out, onWall(F, 0, 0, wallTop), F.U, F.len, Z, tooth, F.N, field, field.cell);
    structure.layers.push({ side: s, bands: [Ba.h, zc0, zc1].filter((z, i, a) => i === 0 || z > a[i - 1] + 1e-6).length + 1 });
    // each doorway: jambs and a head in the secondary paint, a signal lamp over it, a hazard stripe on the floor at it
    for (const [c0, c1, top] of cuts) {
      wallBox(out, F, c0 - Dr.frame, c0, 0, top, Dr.out, paint, paint.cell);
      wallBox(out, F, c1, c1 + Dr.frame, 0, top, Dr.out, paint, paint.cell);
      wallBox(out, F, c0 - Dr.frame, c1 + Dr.frame, top, top + Dr.frame, Dr.out, paint, paint.cell, true);
      quad(out, [onWall(F, c0 - Dr.frame, 0, LIFT * 2), onWall(F, c1 + Dr.frame, 0, LIFT * 2), onWall(F, c1 + Dr.frame, Dr.sill, LIFT * 2), onWall(F, c0 - Dr.frame, Dr.sill, LIFT * 2)], Z, hz, null, null,
        [[0, 0], [(c1 - c0 + 2 * Dr.frame) / hz.scale, 0], [(c1 - c0 + 2 * Dr.frame) / hz.scale, Dr.sill / hz.scale], [0, Dr.sill / hz.scale]]);
      const mid = (c0 + c1) / 2, lz = top + Dr.frame + 0.25, Ld = L.door;
      if (lz + 0.2 < zc0) {
        out.push(lit([onWall(F, mid - 0.2, Dr.out + 0.02, lz), onWall(F, mid + 0.2, Dr.out + 0.02, lz), onWall(F, mid + 0.2, Dr.out + 0.02, lz + 0.12), onWall(F, mid - 0.2, Dr.out + 0.02, lz + 0.12)], F.N, Ld.fill, 'stage:lamp', `0 0 10px 4px ${Ld.color}`, 3));
        seats.push({ at: P(onWall(F, mid, Dr.out + 0.4, lz)), n: F.N, color: Ld.color, intensity: Ld.intensity, radius: Ld.radius, fixture: 'lamp' });
      }
    }
    // the pilasters at the bay lines (none at a doorway's frame): a light strip down each one's face, a foot band painted
    for (let k = 0; k <= n; k++) {
      const u = lines[k], pw = Pl.w / 2;
      if (framed.some(([a, b]) => u > a - pw - 0.1 && u < b + pw + 0.1)) continue;
      wallBox(out, F, Math.max(0, u - pw), Math.min(F.len, u + pw), 0, wallTop, Pl.out, col, col.cell, k === 0 || k === n);
      wallBox(out, F, Math.max(0, u - pw - 0.012), Math.min(F.len, u + pw + 0.012), 0, Pl.foot, Pl.out + 0.012, paint, 1, k === 0 || k === n);
      if (k === 0 || k === n) continue;
      const St = L.strip, z0 = Pl.strip.z0, z1 = Math.min(zc0 - 0.4, z0 + Pl.strip.len), sw = Pl.strip.w / 2;
      if (z1 - z0 < 0.6) continue;
      out.push(lit([onWall(F, u - sw, Pl.out + 0.004, z0), onWall(F, u + sw, Pl.out + 0.004, z0), onWall(F, u + sw, Pl.out + 0.004, z1), onWall(F, u - sw, Pl.out + 0.004, z1)], F.N, St.fill, 'stage:lamp', `0 0 12px 4px ${St.color}`, 2.5));
      if ((k - 1) % Pl.strip.every === 0) seats.push({ at: P(onWall(F, u, Pl.out + 0.35, (z0 + z1) / 2)), n: F.N, color: St.color, intensity: St.intensity, radius: St.radius, fixture: 'strip' });
    }
    // a braced register crosses each end bay of a long wall (where no doorway is)
    if (B.braced && isLong(s) && n >= 3) for (const k of [0, n - 1]) {
      const u0 = lines[k] + Pl.w / 2, u1 = lines[k + 1] - Pl.w / 2;
      if (framed.some(([a, b]) => b > u0 && a < u1)) continue;
      for (const [ua, ub] of [[u0, u1], [u1, u0]]) tubeAB(out, onWall(F, ua, B.brace.off, Ba.h), onWall(F, ub, B.brace.off, zc0), B.brace.r, 6, paint);
      structure.braced = (structure.braced || 0) + 1;
    }
    // the cove: in a tall room, the secondary light along the crown's top on the long walls, washing up the wall
    if (tall && isLong(s)) for (let k = 0; k < n; k++) {
      if (k % B.cove.every) continue;
      const a = lines[k] + Pl.w / 2 + 0.2, b = lines[k + 1] - Pl.w / 2 - 0.2, Co = L.cove;
      if (b - a < 1 || framed.some(([fa, fb, top]) => fb > a && fa < b && top > zc0 - 0.05)) continue;
      out.push(lit([onWall(F, a, Cr.out * 0.4, zc1 + 0.003), onWall(F, b, Cr.out * 0.4, zc1 + 0.003), onWall(F, b, Cr.out * 0.4 + 0.07, zc1 + 0.003), onWall(F, a, Cr.out * 0.4 + 0.07, zc1 + 0.003)], Z, Co.fill, 'stage:lamp', `0 0 12px 5px ${Co.color}`, 2.5));
      seats.push({ at: P(onWall(F, (a + b) / 2, Cr.out + 0.3, zc1 + 0.45)), n: Z, color: Co.color, intensity: Co.intensity, radius: Co.radius, fixture: 'cove' });
    }
    // the services on the wall: an electrical box every few bays with its conduit up to the crown, a breaker panel by
    // each doorway with its conduits, and in a tall room cables slung along under the crown from hooks at the pilasters
    const Sv = B.services, cab = S('cabinet'), cable = surf('cable');
    const clear = (a, b) => lines.every((u) => b < u - Pl.w / 2 - 0.05 || a > u + Pl.w / 2 + 0.05) && framed.every(([fa, fb]) => b < fa - 0.2 || a > fb + 0.2) && a > 0.3 && b < F.len - 0.3;
    const indicator = (u, z, off) => out.push(lit([onWall(F, u - 0.03, off + 0.002, z), onWall(F, u + 0.03, off + 0.002, z), onWall(F, u + 0.03, off + 0.002, z + 0.03), onWall(F, u - 0.03, off + 0.002, z + 0.03)], F.N, Sv.indicator, 'stage:lamp', null, 2));
    if (isLong(s)) for (let k = 0; k < n; k += Sv.every) {
      const X = Sv.box, u = lines[k] + Pl.w / 2 + X.inset;
      if (!clear(u, u + X.w) || X.z + X.h > zc0 - 0.3) continue;
      wallBox(out, F, u, u + X.w, X.z, X.z + X.h, X.d, cab, 1);
      indicator(u + X.w * 0.8, X.z + X.h * 0.8, X.d);
      tubeAB(out, onWall(F, u + X.w / 2, Sv.conduit.off, X.z + X.h), onWall(F, u + X.w / 2, Sv.conduit.off, zc0), Sv.conduit.r, 6, steel);
      structure.services = (structure.services || 0) + 1;
    }
    for (const [c0, c1, top] of cuts) {
      const Q = Sv.panel, u = c1 + Dr.frame + Q.gap;
      if (!clear(u, u + Q.w) || Q.z + Q.h > zc0 - 0.3) continue;
      wallBox(out, F, u, u + Q.w, Q.z, Q.z + Q.h, Q.d, cab, 1);
      // (its door: a seam standing a hair proud, a handle, the lamps of its breakers)
      wallBox(out, F, u + 0.03, u + Q.w - 0.03, Q.z + 0.03, Q.z + Q.h - 0.03, Q.d + 0.012, cab, 1);
      wallBox(out, F, u + Q.w - 0.1, u + Q.w - 0.07, Q.z + Q.h * 0.45, Q.z + Q.h * 0.6, Q.d + 0.04, steel, 1);
      for (let i = 0; i < 3; i++) indicator(u + 0.12 + i * 0.08, Q.z + Q.h - 0.12, Q.d + 0.012);
      for (let i = 0; i < 3; i++) tubeAB(out, onWall(F, u + Q.w * (0.25 + 0.25 * i), Sv.conduit.off, Q.z + Q.h), onWall(F, u + Q.w * (0.25 + 0.25 * i), Sv.conduit.off, zc0), Sv.conduit.r, 6, steel);
      structure.services = (structure.services || 0) + 1;
      void top;
    }
    if (tall && isLong(s)) {
      const zh = zc0 - Sv.hook.drop, off = Cr.out + 0.1;
      for (let k = 0; k < n; k++) {
        const a = lines[k] + Pl.w / 2, b = lines[k + 1] - Pl.w / 2;
        if (framed.some(([fa, fb, top]) => fb > a && fa < b && top > zh - 0.6)) continue;
        Sv.cables.forEach((cr, i) => sagCable(out, onWall(F, a, off + i * 0.05, zh), onWall(F, b, off + i * 0.05, zh), Sv.sag + 0.08 * i, cr, i % 2 ? cable : surf('services')));
      }
    }
    bays.push(...lines.slice(0, -1).map((u0, k) => ({ F, side: s, k, u0, u1: lines[k + 1] })));
  }

  // ── the roof ──
  const beamS = surf('beam');
  if (roof === 'soffit') {
    const sof = S('soffit'), Ho = B.services.hole;
    // one panel out (in a bay by the dice, off the strips' line): the soffit laid round its hole, the plenum's dark over
    // it, the panel hanging from one edge, the wiring sagging down through it
    const hl = mids[Math.floor(dice(21) * mids.length) % mids.length] + (run / nRun) * 0.25, hs = s0 + span * 0.72;
    const [hx0, hy0] = at(hs - Ho.w / 2, hl - Ho.l / 2, 0), [hx1, hy1] = at(hs + Ho.w / 2, hl + Ho.l / 2, 0), X0 = Math.min(hx0, hx1), X1 = Math.max(hx0, hx1), Y0 = Math.min(hy0, hy1), Y1 = Math.max(hy0, hy1);
    const sofRect = (x0, y0, x1, y1) => panel(out, [x0, y0, h], [1, 0, 0], x1 - x0, [0, 1, 0], y1 - y0, DOWN, sof, sof.cell);
    sofRect(r.x0, r.y0, r.x1, Y0); sofRect(r.x0, Y1, r.x1, r.y1); sofRect(r.x0, Y0, X0, Y1); sofRect(X1, Y0, r.x1, Y1);
    const dark = { key: null, scale: 1, tint: B.services.plenum, group: 'stage:plenum' }, zp = h + Ho.plenum, z0uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
    quad(out, [[X0, Y0, zp], [X1, Y0, zp], [X1, Y1, zp], [X0, Y1, zp]], DOWN, dark, null, null, z0uv);
    quad(out, [[X0, Y0, h], [X1, Y0, h], [X1, Y0, zp], [X0, Y0, zp]], [0, 1, 0], dark, null, null, z0uv);
    quad(out, [[X0, Y1, h], [X1, Y1, h], [X1, Y1, zp], [X0, Y1, zp]], [0, -1, 0], dark, null, null, z0uv);
    quad(out, [[X0, Y0, h], [X0, Y1, h], [X0, Y1, zp], [X0, Y0, zp]], [1, 0, 0], dark, null, null, z0uv);
    quad(out, [[X1, Y0, h], [X1, Y1, h], [X1, Y1, zp], [X1, Y0, zp]], [-1, 0, 0], dark, null, null, z0uv);
    const tilt = Ho.hang, dh = Ho.w * Math.cos(tilt), dz = Ho.w * Math.sin(tilt), hinge = (lv) => at(hs - Ho.w / 2, lv, h - 0.01), free = (lv) => at(hs - Ho.w / 2 + dh, lv, h - 0.01 - dz);
    quad(out, [hinge(hl - Ho.l / 2), hinge(hl + Ho.l / 2), free(hl + Ho.l / 2), free(hl - Ho.l / 2)], alongY ? [Math.sin(tilt), 0, -Math.cos(tilt)] : [0, Math.sin(tilt), -Math.cos(tilt)], sof, null, null, [[0, 0], [Ho.l / sof.scale, 0], [Ho.l / sof.scale, Ho.w / sof.scale], [0, Ho.w / sof.scale]]);
    B.services.cables.forEach((cr, i) => sagCable(out, at(hs - Ho.w * 0.3 + i * 0.12, hl - Ho.l * 0.6, h + Ho.plenum * 0.6), at(hs - Ho.w * 0.1 + i * 0.1, hl + Ho.l * 0.6, h + Ho.plenum * 0.5), Ho.droop + 0.15 * i, cr, i % 2 ? surf('cable') : surf('services'), 8));
    structure.openPanel = P([(X0 + X1) / 2, (Y0 + Y1) / 2, h]);
    const St = B.ceilingStrip, Ls = L.ceilingStrip, half = (span * St.share) / 2, sc = (s0 + s1) / 2;
    for (const l of mids) {
      bbox(at(sc - half, l - St.w, h - St.h), at(sc + half, l + St.w, h), steel, ['+z']);
      const q = (ds, dl) => at(sc + ds, l + dl, h - St.h - 0.004);
      out.push(lit([q(-half + 0.04, -St.w + 0.03), q(-half + 0.04, St.w - 0.03), q(half - 0.04, St.w - 0.03), q(half - 0.04, -St.w + 0.03)], DOWN, Ls.fill, 'stage:lamp', `0 0 12px 4px ${Ls.color}`, 2.5));
      seats.push({ at: P(at(sc, l, h - St.h - 0.3)), n: DOWN, color: Ls.color, intensity: Ls.intensity, radius: Ls.radius, fixture: 'strip' });
    }
    // services along a low room's ceiling at one wall: one in the secondary paint, one in the services' own colour
    const Pp = B.pipes, side = s1 - Pp.off, sfs = [paint, surf('services')];
    Pp.r.forEach((pr, i) => tube(out, at(side - i * Pp.gap, l0, h - Pp.drop - i * 0.04), at(side - i * Pp.gap, l1, h - Pp.drop - i * 0.04), pr, 8, sfs[i % 2]));
    structure.pipes = Pp.r.length;
  } else if (roof === 'beams' || roof === 'truss') {
    const deck = S('ceiling');
    panel(out, [r.x0, r.y0, h], [1, 0, 0], w, [0, 1, 0], d, DOWN, deck, deck.cell);
    for (const c of inner) {
      if (roof === 'beams') {
        const Bm = B.beam, ib = (z0, z1, t) => bbox(at(s0, c - t, z0), at(s1, c + t, z1), beamS, alongY ? ['-x', '+x'] : ['-y', '+y']);
        ib(h - depth, h - depth + Bm.flange, Bm.w / 2); ib(h - depth + Bm.flange, h - Bm.flange, Bm.web / 2); ib(h - Bm.flange, h, Bm.w / 2);
      } else {
        // the truss: a top and a bottom chord, a Warren web of diagonals between them, a vertical at each panel point
        const T = B.truss, m = Math.max(2, Math.round(span / depth)), zb = h - depth, chord = (z0, z1) => bbox(at(s0, c - T.w / 2, z0), at(s1, c + T.w / 2, z1), beamS, alongY ? ['-x', '+x'] : ['-y', '+y']);
        chord(h - T.chord, h); chord(zb, zb + T.chord);
        for (let j = 0; j < m; j++) {
          const sa = s0 + (span * j) / m, sb = s0 + (span * (j + 1)) / m;
          tubeAB(out, at(sa, c, j % 2 ? h - T.chord : zb + T.chord), at(sb, c, j % 2 ? zb + T.chord : h - T.chord), T.r, 6, beamS);
          if (j) tubeAB(out, at(sa, c, zb + T.chord), at(sa, c, h - T.chord), T.r * 0.7, 6, beamS);
        }
      }
    }
    const D = B.duct, zD = h - depth - D.r - D.gap;
    for (const f of D.at) tube(out, at(s0 + span * f, l0, zD), at(s0 + span * f, l1, zD), D.r, D.sides, surf('duct'));
    const rows = span > L.highbay.twoRows ? [0.3, 0.7] : [0.5];
    for (const lm of mids) for (const f of rows) hang(s0 + span * f, lm, h, h - depth - L.highbay.drop, L.highbay);
  } else if (roof === 'vault') {
    // the barrel: corrugated panels round the arch down the run, a rib at each bay line, a tie rod across at the spring
    const V = B.vault, N = V.seg, zs = wallTop, deck = S('ceiling');
    const arch = (t) => [s0 + span * t, zs + rise * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2))];
    for (let i = 0; i < N; i++) {
      // (the barrel's face looks down into the room: its tangent across the span turned a right angle down)
      const [sa, za] = arch(i / N), [sb, zb] = arch((i + 1) / N), ds = sb - sa, dz = zb - za, len = Math.hypot(ds, dz);
      quad(out, [at(sa, l0, za), at(sa, l1, za), at(sb, l1, zb), at(sb, l0, zb)], alongY ? [dz / len, 0, -ds / len] : [0, dz / len, -ds / len], deck, null, null, [[0, 0], [run / deck.scale, 0], [run / deck.scale, len / deck.scale], [0, len / deck.scale]]);
      for (const c of inner) tubeAB(out, at(sa, c, za - V.rib), at(sb, c, zb - V.rib), V.rib, 6, beamS);
    }
    for (const c of inner) tubeAB(out, at(s0, c, zs), at(s1, c, zs), V.tie, 6, steel);
    const rows = span > L.highbay.twoRows ? [0.3, 0.7] : [0.5];
    for (const lm of mids) for (const f of rows) { const [, za] = arch(f); hang(s0 + span * f, lm, za - V.rib, za - V.rib - L.highbay.drop, L.highbay); }
  } else if (roof === 'sawtooth') {
    // the teeth: a roof slope rising down the run, a glazed face falling back at each crest (the north light), a beam
    // across under each crest
    const deck = S('ceiling'), lo = h - tooth, Dl = L.daylight;
    for (let k = 0; k < nRun; k++) {
      // (the slope rises down the run: its underside looks down and on along the run, to the next tooth's glass)
      const la = runLines[k], lb = runLines[k + 1], len = Math.hypot(lb - la, tooth);
      quad(out, [at(s0, la, lo), at(s1, la, lo), at(s1, lb, h), at(s0, lb, h)], alongY ? [0, tooth / len, -(lb - la) / len] : [tooth / len, 0, -(lb - la) / len], deck, null, null, [[0, 0], [span / deck.scale, 0], [span / deck.scale, len / deck.scale], [0, len / deck.scale]]);
      if (k + 1 < nRun) {
        // the north light: glazing falling from the crest to the next tooth's foot, the daylight coming in through it
        const g = [at(s0, lb, h - 0.02), at(s1, lb, h - 0.02), at(s1, lb, lo + 0.02), at(s0, lb, lo + 0.02)], gn = alongY ? [0, 1, 0] : [1, 0, 0];
        out.push(lit(g, gn, Dl.fill, 'stage:glass', null, 1.2));
        seats.push({ at: P(at((s0 + s1) / 2, lb + 0.8, lo + tooth / 2)), n: gn, color: Dl.color, intensity: Dl.intensity, radius: Dl.radius, fixture: 'daylight' });
        bbox(at(s0, lb - 0.2, lo - B.sawtooth.beam), at(s1, lb + 0.2, lo), beamS, alongY ? ['-x', '+x'] : ['-y', '+y']);
      }
    }
    const rows = span > L.highbay.twoRows ? [0.3, 0.7] : [0.5];
    // (each lamp hung from the slope over it, at the slope's height there)
    for (const [k, lm] of mids.entries()) for (const f of rows) hang(s0 + span * f, lm, lo + tooth * ((lm - runLines[k]) / (runLines[k + 1] - runLines[k])), lo - L.highbay.drop, L.highbay);
  } else if (roof === 'coffer') {
    // the waffle: a concrete slab, ribs both ways on a half bay, a lamp set in each other coffer
    const Cf = B.coffer, slab = surf('concrete'), ns = Math.max(2, Math.round(span / Cf.cell)), nl = Math.max(2, Math.round(run / Cf.cell));
    panel(out, [r.x0, r.y0, h], [1, 0, 0], w, [0, 1, 0], d, DOWN, slab, slab.cell);
    for (let i = 1; i < ns; i++) { const s = s0 + (span * i) / ns; bbox(at(s - Cf.w / 2, l0, h - depth), at(s + Cf.w / 2, l1, h), slab, alongY ? ['-y', '+y'] : ['-x', '+x']); }
    for (let j = 1; j < nl; j++) { const l = l0 + (run * j) / nl; bbox(at(s0, l - Cf.w / 2, h - depth), at(s1, l + Cf.w / 2, h), slab, alongY ? ['-x', '+x'] : ['-y', '+y']); }
    const Lc = L.coffer;
    for (let i = 0; i < ns; i++) for (let j = 0; j < nl; j++) {
      if ((i + j) % 2) continue;
      const sc = s0 + (span * (i + 0.5)) / ns, lc = l0 + (run * (j + 0.5)) / nl, hs = Cf.lamp / 2, q = (ds, dl) => at(sc + ds, lc + dl, h - 0.01);
      out.push(lit([q(-hs, -hs), q(-hs, hs), q(hs, hs), q(hs, -hs)], DOWN, Lc.fill, 'stage:lamp', `0 0 14px 5px ${Lc.color}`, 2.5));
      if ((i % 2 === 0) && (j % 2 === 0)) seats.push({ at: P(at(sc, lc, h - 0.5)), n: DOWN, color: Lc.color, intensity: Lc.intensity, radius: Lc.radius, fixture: 'highbay' });
      structure.lamps.push(P(at(sc, lc, h - 0.01)));
    }
  }

  // ── a taller room's bridge crane ──
  const Cn = B.crane;
  if (B.craned !== false && tall && h >= Cn.min && span >= Cn.minSpan && zc1 - Cn.below > 5) {
    const zR = zc1 - Cn.below, off = Pl.out + Cn.rail.w / 2 + 0.05, rails = [s0 + off, s1 - off];
    for (const sr of rails) {
      bbox(at(sr - Cn.rail.w / 2, l0, zR - Cn.rail.h), at(sr + Cn.rail.w / 2, l1, zR), steel, alongY ? ['-y', '+y'] : ['-x', '+x']);
      for (const l of inner) { const wall = sr < (s0 + s1) / 2 ? s0 : s1; bbox(at(wall, l - 0.15, zR - Cn.rail.h - 0.6), at(sr, l + 0.15, zR - Cn.rail.h), col); }
    }
    const lg = l0 + run * (0.3 + 0.4 * dice(7)), G = Cn.girder, zG = zR + 0.05;
    bbox(at(rails[0], lg - G.w / 2, zG), at(rails[1], lg + G.w / 2, zG + G.h), paint);
    // (the end trucks on the rails, in the structure's own steel; a striped band only across the girder's top at each
    // end, where it lies flat)
    for (const sr of rails) {
      bbox(at(sr - 0.35, lg - G.w, zG - 0.05), at(sr + 0.35, lg + G.w, zG + G.h + 0.15), col);
      const inward = sr < (s0 + s1) / 2 ? 1 : -1;
      bbox(at(sr + inward * 0.35, lg - G.w / 2, zG + G.h), at(sr + inward * 1.35, lg + G.w / 2, zG + G.h + 0.01), hz);
    }
    const st = s0 + span * (0.35 + 0.3 * dice(9)), tc = at(st, lg, zG + G.h), Hk = Cn.hook, zH = Math.max(Hk.least, h * Hk.share);
    bbox([tc[0] - 0.6, tc[1] - 0.6, zG + G.h], [tc[0] + 0.6, tc[1] + 0.6, zG + G.h + 0.5], col);
    for (const sg of [-0.18, 0.18]) { const cp = at(st + sg, lg, 0); bbox([cp[0] - 0.015, cp[1] - 0.015, zH + Hk.h], [cp[0] + 0.015, cp[1] + 0.015, zG], steel, ['-z', '+z']); }
    bbox([tc[0] - 0.3, tc[1] - 0.22, zH], [tc[0] + 0.3, tc[1] + 0.22, zH + Hk.h], paint);
    bbox([tc[0] - 0.05, tc[1] - 0.05, zH - 0.45], [tc[0] + 0.05, tc[1] + 0.05, zH], steel, ['+z']);
    structure.crane = { girder: lg, hook: P([tc[0], tc[1], zH]) };
  }

  // ── a tall room's catwalk: railed but at its entries, entered by a stair, a long one by a second ──
  const Cw = B.catwalk, longSides = sides.filter(isLong);
  if (tall && wallTop >= Cw.min && longSides.length) {
    const s = [...longSides].sort((p, q) => r.openings[p].length - r.openings[q].length || (p < q ? -1 : 1))[0], F = wallFrameOf(r, s);
    const cz = Cw.z, o0 = Pl.out, o1 = Pl.out + Cw.d, going = Cw.going, nSteps = Math.ceil(cz / Cw.rise), riseH = cz / nSteps, sLen = nSteps * going;
    // (the near stair's foot a clear landing off the end wall, so a walker comes to it square: `Cw.landing`)
    const cuts = r.openings[s].map((op) => openingU(F, op)), startU = Cw.landing, landU = startU + sLen, endU = F.len - 0.6;
    if (endU - landU > 4 && !cuts.some(([c0]) => c0 < landU + 1)) {
      const gr = surf('grate'), infill = surf('infill');
      const flat = (pts, sf, uw, vw) => quad(out, pts, Z, sf, null, null, [[0, 0], [uw / sf.scale, 0], [uw / sf.scale, vw / sf.scale], [0, vw / sf.scale]]);
      const slab = (u0, u1, oa, ob, z0, z1, sf, omit = []) => bbox(onWall(F, u0, oa, z0), onWall(F, u1, ob, z1), sf, omit);
      // (an infill panel standing in a plane: from `a` to `b` along the ground, from za to zb up at each end)
      const sheet = (pa, pb, za0, za1, zb0, zb1, nrm) => quad(out, [[pa[0], pa[1], za0], [pb[0], pb[1], zb0], [pb[0], pb[1], zb1], [pa[0], pa[1], za1]], nrm, infill, null, null,
        [[0, 0], [Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) / infill.scale, 0], [Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) / infill.scale, (zb1 - zb0) / infill.scale], [0, (za1 - za0) / infill.scale]]);
      // the deck, its fascia (no face at the stair's head), brackets at the bay lines
      flat([onWall(F, landU, o0, cz), onWall(F, endU, o0, cz), onWall(F, endU, o1, cz), onWall(F, landU, o1, cz)], gr, endU - landU, Cw.d);
      wallBox(out, F, landU, endU, cz - Cw.fascia, cz - 0.005, o1, steel, steel.cell, true);
      const nb = Math.max(1, Math.round(F.len / kit.bay));
      for (let k = 1; k < nb; k++) { const u = (F.len * k) / nb; if (u > landU && u < endU) tubeAB(out, onWall(F, u, 0.05, cz - 1.6), onWall(F, u, o1 - 0.1, cz - Cw.fascia), 0.05, 6, steel); }
      // a long walkway's second entry: a stair coming in square to it through its front railing at its far end
      const second = endU - landU >= Cw.twoStairs && s1 - s0 - o1 - sLen >= Cw.clear;
      const gapA = endU - 0.8 - Cw.width, gapB = endU - 0.8;
      // a railing run along the deck's front edge (posts, the top and the mid rail in the secondary paint, the infill,
      // a toe board): broken at the gap
      const rail = (u0, u1) => {
        if (u1 - u0 < 0.1) return;
        const np = Math.max(1, Math.round((u1 - u0) / Cw.post));
        for (let i = 0; i <= np; i++) { const u = u0 + ((u1 - u0) * i) / np; slab(u - 0.03, u + 0.03, o1 - 0.06, o1, cz, cz + Cw.rail, steel); }
        for (const zr of [Cw.rail, Cw.rail / 2]) tubeAB(out, onWall(F, u0, o1 - 0.03, cz + zr), onWall(F, u1, o1 - 0.03, cz + zr), 0.03, 6, paint);
        const a = onWall(F, u0, o1 - 0.03, 0), b = onWall(F, u1, o1 - 0.03, 0);
        sheet(a, b, cz + Cw.infill[0], cz + Cw.infill[1], cz + Cw.infill[0], cz + Cw.infill[1], F.N);
        slab(u0, u1, o1 - 0.025, o1, cz, cz + 0.12, paint);
      };
      if (second) { rail(landU, gapA); rail(gapB, endU); } else rail(landU, endU);
      // the far end over a drop: railed across, unless the second stair comes in there (it comes in at the front)
      const across = (u) => {
        for (const o of [o0 + 0.03, (o0 + o1) / 2, o1 - 0.03]) slab(u - 0.03, u + 0.03, o - 0.03, o + 0.03, cz, cz + Cw.rail, steel);
        for (const zr of [Cw.rail, Cw.rail / 2]) tubeAB(out, onWall(F, u, o0, cz + zr), onWall(F, u, o1, cz + zr), 0.03, 6, paint);
        sheet(onWall(F, u, o0, 0), onWall(F, u, o1, 0), cz + Cw.infill[0], cz + Cw.infill[1], cz + Cw.infill[0], cz + Cw.infill[1], F.U);
      };
      across(endU);
      // a banister along a stair's pitch: posts on the treads, a handrail and a mid rail in the secondary paint, the infill
      // between them from the treads up; under the stair left open (where a walker may go is the game's pathing)
      const banister = (pa, pb, za, zb) => {
        const np = Math.max(1, Math.round(Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) / Cw.post));
        for (let i = 0; i <= np; i++) { const t = i / np, x = pa[0] + (pb[0] - pa[0]) * t, y = pa[1] + (pb[1] - pa[1]) * t, z = za + (zb - za) * t; bbox([x - 0.03, y - 0.03, z], [x + 0.03, y + 0.03, z + Cw.rail], steel); }
        for (const zr of [Cw.rail, Cw.rail / 2]) tubeAB(out, [pa[0], pa[1], za + zr], [pb[0], pb[1], zb + zr], 0.03, 6, paint);
        sheet(pa, pb, za + Cw.infill[0], za + Cw.infill[1], zb + Cw.infill[0], zb + Cw.infill[1], [pb[1] - pa[1], pa[0] - pb[0], 0].map((v) => v / Math.hypot(pb[0] - pa[0], pb[1] - pa[1])));
      };
      // the near stair: treads rising along the wall to the deck's near end, a nosing striped on each, a banister down
      // its open side; its foot open
      for (let i = 0; i < nSteps; i++) {
        const u = startU + i * going, z = (i + 1) * riseH;
        flat([onWall(F, u, o0, z), onWall(F, u + going, o0, z), onWall(F, u + going, o1, z), onWall(F, u, o1, z)], gr, going, Cw.d);
        flat([onWall(F, u, o0, z + LIFT), onWall(F, u + Cw.nosing, o0, z + LIFT), onWall(F, u + Cw.nosing, o1, z + LIFT), onWall(F, u, o1, z + LIFT)], hz, Cw.nosing, Cw.d);
      }
      banister(onWall(F, startU, o1 - 0.03, 0), onWall(F, landU, o1 - 0.03, 0), riseH, cz);
      const entries = [{ by: 'stair', at: 'near', width: r5(Cw.d), landing: r5(startU) }];
      // the second stair: square to the wall, from the floor out in the room up to the gap
      if (second) {
        const ua = gapA, ub = gapB, oOut = o1 + sLen;
        for (let i = 0; i < nSteps; i++) {
          const oa = oOut - (i + 1) * going, ob = oOut - i * going, z = (i + 1) * riseH;
          flat([onWall(F, ua, oa, z), onWall(F, ub, oa, z), onWall(F, ub, ob, z), onWall(F, ua, ob, z)], gr, ub - ua, going);
          flat([onWall(F, ua, ob - Cw.nosing, z + LIFT), onWall(F, ub, ob - Cw.nosing, z + LIFT), onWall(F, ub, ob, z + LIFT), onWall(F, ua, ob, z + LIFT)], hz, ub - ua, Cw.nosing);
        }
        for (const u of [ua + 0.03, ub - 0.03]) banister(onWall(F, u, oOut, 0), onWall(F, u, o1, 0), riseH, cz);
        entries.push({ by: 'stair', at: 'front', width: r5(ub - ua), landing: r5(s1 - s0 - oOut) });
      }
      // cable bundles slung under the deck from bracket to bracket
      const brackets = [landU, ...[...Array(nb - 1)].map((_, k) => (F.len * (k + 1)) / nb).filter((u) => u > landU && u < endU), endU];
      for (let k = 0; k + 1 < brackets.length; k++) B.services.cables.slice(0, 2).forEach((cr, i) => sagCable(out, onWall(F, brackets[k], o0 + 0.25 + i * 0.12, cz - Cw.fascia - 0.03), onWall(F, brackets[k + 1], o0 + 0.25 + i * 0.12, cz - Cw.fascia - 0.03), B.services.sag + 0.1 * i, cr, i % 2 ? surf('cable') : surf('services')));
      // downlights under the deck between its brackets, in the secondary light
      const Ld = L.down;
      for (let u = landU + 1.5; u < endU - 1; u += Cw.downEvery) {
        const q = (du, o) => onWall(F, u + du, o, cz - Cw.fascia - 0.006);
        out.push(lit([q(-0.15, (o0 + o1) / 2 - 0.15), q(0.15, (o0 + o1) / 2 - 0.15), q(0.15, (o0 + o1) / 2 + 0.15), q(-0.15, (o0 + o1) / 2 + 0.15)], DOWN, Ld.fill, 'stage:lamp', `0 0 10px 4px ${Ld.color}`, 2.5));
        seats.push({ at: P(onWall(F, u, (o0 + o1) / 2, cz - Cw.fascia - 0.3)), n: DOWN, color: Ld.color, intensity: Ld.intensity, radius: Ld.radius, fixture: 'down' });
      }
      structure.walkways.push({ side: s, z: cz, deck: [r5(landU), r5(endU)], d: Cw.d, entries,
        railed: { front: true, far: true, near: false }, infill: Cw.infill, stairs: [[r5(startU), r5(landU)], ...(second ? [[r5(gapA), r5(gapB)]] : [])] });
    }
  }
  return { seats, bays, structure };
}

// a cable sagging from a to b by `sag` at its middle (a parabola: a slack cable's catenary, near enough), in n lengths
function sagCable(out, a, b, sag, r, sf, n = 6) {
  let prev = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t - 4 * sag * t * (1 - t)];
    tubeAB(out, prev, p, r, 5, sf); prev = p;
  }
}
// a long wall's u for a run line l (the wall frame runs along the run)
function uOfL(F, l) { return Math.abs(F.U[0]) > 0.5 ? (l - F.o[0]) * F.U[0] : (l - F.o[1]) * F.U[1]; }
// a triangle as a quad with its last corner doubled (the mesh and the bake take quads), its uv the wall's
function tri(out, a, b, c, n, sf) {
  const uvOf = (p) => [r5((p[0] + p[1]) / sf.scale), r5(p[2] / sf.scale)];
  out.push({ corners: [a, b, c, c].map(P), normal: n.map(r5), outNormal: n.map(r5), texture: sf.key, textureLit: true, uv: [a, b, c, c].map(uvOf), tint: sf.tint, group: sf.group });
}
// an end wall's gable up to a vault's arch: strips from the spring to the arch, segment by segment
function gable(out, F, side, zs, rise, sf) {
  const N = 12;
  for (let i = 0; i < N; i++) {
    const ta = i / N, tb = (i + 1) / N, za = zs + rise * Math.sqrt(Math.max(0, 1 - (2 * ta - 1) ** 2)), zb = zs + rise * Math.sqrt(Math.max(0, 1 - (2 * tb - 1) ** 2));
    const ua = F.len * ta, ub = F.len * tb;
    quad(out, [onWall(F, ua, 0, zs), onWall(F, ub, 0, zs), onWall(F, ub, 0, zb), onWall(F, ua, 0, za)], F.N, sf, null, null,
      [[ua / sf.scale, zs / sf.scale], [ub / sf.scale, zs / sf.scale], [ub / sf.scale, zb / sf.scale], [ua / sf.scale, za / sf.scale]]);
  }
}

const area = (f) => { const c = f.corners, a = [c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]], b = [c[c.length - 1][0] - c[0][0], c[c.length - 1][1] - c[0][1], c[c.length - 1][2] - c[0][2]]; return Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]); };

/** The shell's principles measured on what was built: each law { law, ok, value, want }. Advice, never a refusal. */
export function bayLaws(rooms, faces, kit) {
  const out = [], law = (id, ok, value, want) => out.push({ law: id, ok, value, want });
  const B = kit.B, Cw = B.catwalk;
  const layered = rooms.flatMap((R) => R.layers.filter((l) => l.bands < 3).map((l) => `${R.r.id}:${l.side}`));
  law('layers', layered.length === 0, layered.join(', ') || 'every solid wall', 'every solid wall a base, a field and a crown');
  const bare = rooms.filter((R) => (R.tall ? !R.lamps.length : !R.pipes)).map((R) => R.r.id);
  law('overhead', bare.length === 0, bare.join(', ') || 'every room', 'something hangs in every room: a tall one\'s roof and lamps, a low one\'s services');
  const lone = rooms.filter((R) => R.r.h >= B.crane.min && !R.walkways.length).map((R) => R.r.id);
  law('two-scales', lone.length === 0, lone.join(', ') || 'every tall room', `a room ${B.crane.min} m and taller holds a person's walkway beside its own height`);
  const ways = rooms.flatMap((R) => R.walkways.map((W) => ({ ...W, room: R.r.id })));
  const shut = ways.filter((W) => !W.entries.length || W.entries.some((e) => e.width < Cw.entry || e.landing < Cw.landing - 1e-6)).map((W) => W.room);
  law('walkway-entries', shut.length === 0, shut.join(', ') || `${ways.length} walkway${ways.length === 1 ? '' : 's'}, ${ways.reduce((s, W) => s + W.entries.length, 0)} entries`, `every walkway entered by a stair, each entry at least ${Cw.entry} m wide, its foot on a landing at least ${Cw.landing} m deep`);
  const open = ways.filter((W) => !(W.railed.front && W.railed.far) || W.infill[0] > Cw.shin[0] || W.infill[1] < Cw.shin[1]).map((W) => W.room);
  law('banisters-block', open.length === 0, open.join(', ') || 'every edge over a drop', `railed on every edge over a drop but its entries, the infill from ${Cw.shin[0]} to ${Cw.shin[1]} m over the deck at least`);
  const long = ways.filter((W) => W.deck[1] - W.deck[0] >= Cw.twoStairs && W.entries.length < 2).map((W) => W.room);
  law('two-ways-in', long.length === 0, long.join(', ') || 'ok', `a walkway ${Cw.twoStairs} m and longer entered at both ends`);
  // the accent rationed: the hazard stripe's share of the floor and walls
  let hzA = 0, all = 0;
  for (const f of faces) {
    if (!f.corners || f.corners.length < 3 || (f.group !== 'stage:hazard' && !['stage:floor', 'stage:band', 'stage:wall', 'stage:base', 'stage:crown', 'stage:column'].includes(f.group) && f.texture !== 'lab:hazard')) continue;
    const a = area(f);
    all += a;
    if (f.group === 'stage:hazard' || f.texture === 'lab:hazard') hzA += a;
  }
  const share = all ? hzA / all : 0;
  law('accent', share <= B.accent, `${(share * 100).toFixed(1)} %`, `the hazard stripe at most ${(B.accent * 100).toFixed(0)} % of the floor and walls`);
  return out;
}
