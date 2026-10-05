/**
 * The LAB shell (Doom 3's research labs): a tall room whose structure shows. Floor ≠ walls ≠ ceiling, with stuff
 * between each:
 *
 *   floor     vinyl tile (lab:vct) in a field, a darker band round the edge, a rubber skirting at the walls
 *   walls     steel I-columns at the bay lines carry the roof; between them a steel kick band, a field of painted
 *             panels (lab:panel), a service band (a shelf of steel carrying the cables), and up in the clerestory a row
 *             of observation windows into a control gallery, glowing cool; plain board above
 *   ceiling   the corrugated deck (lab:deck) high up; steel trusses across the short span from column to column;
 *             under them ducts and a cable tray down the long span, and troffers hung on chains (the light)
 *   portal    on the dressing's portal side, a blast door: an opening with chamfered top corners, the leaves set back
 *             in it, a steel surround painted in hazard stripes, a red status lamp over it
 *
 * Every piece of structure is placed from the room's bays, so the columns, trusses, windows and lights line up. Lights
 * go out as seats (`fixture: 'troffer'`, `'window'`, `'lamp'`), baked by the stage.
 */
import { add, mul, P, r5, hexRgb, panel, box, wallBox, quad, onWall, solidSpans, openingU } from './geom.js';
import { archedOpening } from './gothic.js';

const Z = [0, 0, 1];

/** A tube from a to b (horizontal, along x or y), radius r, `sides` faces, its uv running along its length. */
export function tube(out, a, b, r, sides, surf) {
  const along = b[0] !== a[0] ? 0 : 1, len = Math.abs(b[along] - a[along]), s = Math.sign(b[along] - a[along]) || 1;
  for (let k = 0; k < sides; k++) {
    const t0 = (2 * Math.PI * k) / sides, t1 = (2 * Math.PI * (k + 1)) / sides, tm = (t0 + t1) / 2;
    const off = (t) => (along === 0 ? [0, Math.cos(t) * r, Math.sin(t) * r] : [Math.cos(t) * r, 0, Math.sin(t) * r]);
    const n = along === 0 ? [0, Math.cos(tm), Math.sin(tm)] : [Math.cos(tm), 0, Math.sin(tm)];
    const c = [add(a, off(t0)), add(a, off(t1)), add(b, off(t1)), add(b, off(t0))];
    const u0 = (t0 * r) / surf.scale, u1 = (t1 * r) / surf.scale;
    quad(out, s > 0 ? c : [c[1], c[0], c[3], c[2]], n.map(r5), surf, null, null, s > 0 ? [[u0, 0], [u1, 0], [u1, len / surf.scale], [u0, len / surf.scale]] : [[u1, 0], [u0, 0], [u0, len / surf.scale], [u1, len / surf.scale]]);
  }
}

/** A self-lit face (a lamp's diffuser, a status lamp): its own fill, emissive in the GLB, a halo when `glow`. */
const lit = (corners, n, fill, group, glow = null, strength = 3) => ({ corners: corners.map(P), normal: n, outNormal: n, fill, group, emissive: hexRgb(fill), emissiveStrength: strength, ...(glow ? { glow } : {}) });

/** A troffer hung on two chains: a steel housing, a glowing diffuser under it. `c` its centre, long along `ax`. */
export function troffer(out, c, ax, T, top, surf) {
  const [x, y, z] = c, L = T.len / 2, W = T.w / 2, hx = ax === 0 ? L : W, hy = ax === 0 ? W : L;
  box(out, [x - hx, y - hy, z], [x + hx, y + hy, z + T.h], surf.housing, 1, []);
  out.push(lit([[x - hx + 0.03, y - hy + 0.03, z - 0.005], [x - hx + 0.03, y + hy - 0.03, z - 0.005], [x + hx - 0.03, y + hy - 0.03, z - 0.005], [x + hx - 0.03, y - hy + 0.03, z - 0.005]], [0, 0, -1], T.diffuser, 'stage:lamp', `0 0 14px 5px ${T.color}`, 2.5));
  for (const sg of [-0.7, 0.7]) {
    const cx = x + (ax === 0 ? sg * L : 0), cy = y + (ax === 0 ? 0 : sg * L);
    box(out, [cx - 0.012, cy - 0.012, z + T.h], [cx + 0.012, cy + 0.012, top], surf.chain, 1, ['-z', '+z']);
  }
}

/**
 * One lab room into `out`. r: the room; kit: the lab kit; surf(part, variant): the stage's surface maker.
 * → seats (lights), bays (the dressing's: { F, side, k, u0, u1, portal? }), and `structure` (the trusses' and ducts'
 * lines, for the dressing to hang things from).
 */
export function labRoom(out, r, ri, kit, surf) {
  const seats = [], bays = [], h = r.h, L = kit.lab, Pt = kit.dress && kit.dress.portal;
  const w = r.x1 - r.x0, d = r.y1 - r.y0, alongY = d >= w;
  // ── the floor: the field, the band round it, the skirting ──
  const fl = surf('floor', ri), band = { ...surf('floor', ri), tint: L.band.tint }, sk = L.skirt, bw = L.band.w;
  const world = (s) => ({ ...s, uvOf: (p) => [p[0] / s.scale, p[1] / s.scale] });
  panel(out, [r.x0 + bw, r.y0 + bw, 0], [1, 0, 0], w - 2 * bw, [0, 1, 0], d - 2 * bw, Z, world(fl), fl.cell);
  for (const [o, A, a, B, b] of [[[r.x0, r.y0, 0], [1, 0, 0], w, [0, 1, 0], bw], [[r.x0, r.y1 - bw, 0], [1, 0, 0], w, [0, 1, 0], bw],
    [[r.x0, r.y0 + bw, 0], [1, 0, 0], bw, [0, 1, 0], d - 2 * bw], [[r.x1 - bw, r.y0 + bw, 0], [1, 0, 0], bw, [0, 1, 0], d - 2 * bw]]) panel(out, o, A, a, B, b, Z, world(band), band.cell);
  // ── the deck ──
  const deck = surf('ceiling', ri);
  panel(out, [r.x0, r.y0, h], [1, 0, 0], w, [0, 1, 0], d, [0, 0, -1], deck, deck.cell);
  // ── the walls, bay by bay ──
  const sides = ['-y', '+x', '+y', '-x'].filter((s) => !r.open.includes(s));
  const kick = surf('kick'), field = surf('wall', ri), upper = surf('upper'), trim = surf('trim'), col = surf('column');
  const glass = { fill: L.window.glass, emissive: hexRgb(L.window.glass), emissiveStrength: 1.2, group: 'stage:glass' };
  for (const s of sides) {
    const F = wallFrameOf(r, s), cuts = r.openings[s].map((op) => [...openingU(F, op), op.top]).sort((p, q) => p[0] - q[0]);
    const isPortal = Pt && Pt.side === s && !cuts.length && F.len > Pt.width + 4;
    const n = Math.max(1, Math.round(F.len / kit.bay));
    const lines = isPortal ? portalLines(F.len, Pt.width + 2 * Pt.surround, kit.bay) : [...Array(n + 1)].map((_, k) => (F.len * k) / n);
    for (let k = 0; k + 1 < lines.length; k++) {
      const u0 = lines[k], u1 = lines[k + 1], cw = L.column.w / 2, a = u0 + (k === 0 ? 0 : cw), b = u1 - (k + 2 === lines.length ? 0 : cw);
      const inCut = cuts.filter(([c0, c1]) => c1 > u0 && c0 < u1);
      if (isPortal && u0 < F.len / 2 && u1 > F.len / 2) { blastDoor(out, F, u0, u1, h, Pt, { kick, field, upper, trim }, seats); bays.push({ F, side: s, k, u0, u1, portal: true }); continue; }
      if (inCut.length) { plainWall(out, F, u0, u1, h, inCut, field); bays.push({ F, side: s, k, u0, u1 }); continue; }
      // the kick band, the panel field, the service band
      wallBox(out, F, a, b, 0, L.kick.h, L.kick.out, kick, kick.cell, true);
      panel(out, onWall(F, a, 0, L.kick.h), F.U, b - a, Z, L.field.top - L.kick.h, F.N, field, field.cell);
      wallBox(out, F, a, b, L.field.top, L.field.top + L.service.h, L.service.out, trim, trim.cell, true);
      const above = L.field.top + L.service.h, Wn = L.window, ww = Math.min(Wn.w, b - a - 2 * Wn.margin);
      if (h - above > Wn.sill + Wn.h + 0.8 && ww > 1) {
        // the clerestory: an observation window into the control gallery, glowing cool, a light seat in front of it
        const mid = (a + b) / 2, sill = above + Wn.sill;
        panel(out, onWall(F, a, 0, above), F.U, b - a, Z, Wn.sill, F.N, upper, upper.cell);
        archedOpening(out, F, { u0: a, u1: b, z0: sill, z1: h, a: mid - ww / 2, b: mid + ww / 2, zs: sill + Wn.h, H: 0, seg: 1, depth: Wn.depth, ring: Wn.ring, ringOut: Wn.ringOut }, { wall: upper, trim }, { glass });
        seats.push({ at: P(onWall(F, mid, Wn.light.off, sill + Wn.h / 2)), n: F.N, color: Wn.light.color, intensity: Wn.light.intensity, radius: Wn.light.radius, fixture: 'window' });
      } else panel(out, onWall(F, a, 0, above), F.U, b - a, Z, h - above, F.N, upper, upper.cell);
      bays.push({ F, side: s, k, u0, u1, a, b });
    }
    // the steel columns at the bay lines (not at a portal's surround, which is its own)
    for (let k = 0; k < lines.length; k++) {
      const u = lines[k], cw = L.column.w / 2;
      if (cuts.some(([c0, c1]) => u > c0 - cw - 0.2 && u < c1 + cw + 0.2)) continue;
      if (isPortal && Math.abs(u - F.len / 2) < (Pt.width / 2 + Pt.surround + 0.01)) continue;
      wallBox(out, F, Math.max(0, u - cw), Math.min(F.len, u + cw), 0, h, L.column.out, col, col.cell, k === 0 || k === lines.length - 1);
    }
    // the skirting, broken at the openings
    for (const [sa, sb] of solidSpans(F.len, cuts.map(([c0, c1]) => [c0, c1]), 0.05)) wallBox(out, F, sa, sb, 0, sk.h, sk.out, surf('skirt'), 1, true);
  }
  // ── the roof structure: trusses across the short span at the bay lines, ducts and a tray down the long one ──
  const span = alongY ? w : d, run = alongY ? d : w, nT = Math.max(1, Math.round(run / kit.bay)), T = L.truss, steel = surf('trim');
  const trusses = [];
  for (let k = 1; k < nT; k++) {
    const c = (alongY ? r.y0 : r.x0) + (run * k) / nT;
    trusses.push(c);
    const span0 = alongY ? r.x0 : r.y0, span1 = alongY ? r.x1 : r.y1;
    const bx = (lo, hi, z0, z1, t) => box(out, alongY ? [span0, c - t, z0] : [c - t, span0, z0], alongY ? [span1, c + t, z1] : [c + t, span1, z1], steel, steel.cell, alongY ? ['-x', '+x'] : ['-y', '+y']);
    bx(span0, span1, h - T.depth, h - T.depth + T.flange, T.w / 2);          // bottom flange
    bx(span0, span1, h - T.depth + T.flange, h - T.flange, T.web / 2);       // web
    bx(span0, span1, h - T.flange, h, T.w / 2);                               // top flange
  }
  const at = (s, l, z) => (alongY ? [s, l, z] : [l, s, z]);
  const s0 = alongY ? r.x0 : r.y0, l0 = alongY ? r.y0 : r.x0, l1 = alongY ? r.y1 : r.x1;
  const D = L.duct, zD = h - T.depth - D.r - D.gap, ducts = D.at.map((f) => s0 + span * f);
  for (const sd of ducts) {
    tube(out, at(sd, l0, zD), at(sd, l1, zD), D.r, D.sides, surf('duct'));
    for (const c of trusses) box(out, at(sd - 0.015, c - 0.015, zD + D.r), at(sd + 0.015, c + 0.015, h - T.depth), steel, 1, ['-z', '+z']);   // a hanger at each truss
  }
  const Tr = L.tray, st = s0 + span * Tr.at, zT = h - T.depth - Tr.drop;
  box(out, at(st - Tr.w / 2, l0, zT), at(st + Tr.w / 2, l1, zT + 0.03), steel, steel.cell, alongY ? ['-y', '+y'] : ['-x', '+x']);
  for (const sg of [-1, 1]) box(out, at(st + sg * Tr.w / 2 - 0.01, l0, zT), at(st + sg * Tr.w / 2 + 0.01, l1, zT + Tr.side), steel, 1, alongY ? ['-y', '+y'] : ['-x', '+x']);
  Tr.cables.forEach((cr, i) => { const cs = st - Tr.w / 2 + (Tr.w * (i + 1)) / (Tr.cables.length + 1); box(out, at(cs - cr, l0, zT + 0.03), at(cs + cr, l1, zT + 0.03 + 2 * cr), surf('cable'), 2, alongY ? ['-y', '+y'] : ['-x', '+x']); });
  // ── the light: troffers hung between the trusses, in rows down the long span ──
  const Tf = L.troffer, rows = Tf.rows.map((f) => s0 + span * f), zL = h - T.depth - Tf.drop, mids = [l0, ...trusses, l1];
  for (let k = 0; k + 1 < mids.length; k++) {
    const lm = (mids[k] + mids[k + 1]) / 2;
    for (const sr of rows) {
      const c = at(sr, lm, zL);
      troffer(out, c, alongY ? 1 : 0, Tf, h - T.depth, { housing: surf('housing'), chain: steel });
      seats.push({ at: P([c[0], c[1], c[2] - 0.15]), n: [0, 0, -1], color: Tf.color, intensity: Tf.intensity, radius: Tf.radius, fixture: 'troffer' });
    }
  }
  return { seats, bays, structure: { trusses, ducts, zD, tray: { at: st, z: zT }, alongY, troffers: zL } };
}

const wallFrameOf = (r, s) => {
  if (s === '-y') return { o: [r.x0, r.y0, 0], U: [1, 0, 0], N: [0, 1, 0], len: r.x1 - r.x0, coord: (p) => p[0], start: r.x0 };
  if (s === '+y') return { o: [r.x1, r.y1, 0], U: [-1, 0, 0], N: [0, -1, 0], len: r.x1 - r.x0, coord: (p) => p[0], start: r.x1 };
  if (s === '-x') return { o: [r.x0, r.y1, 0], U: [0, -1, 0], N: [1, 0, 0], len: r.y1 - r.y0, coord: (p) => p[1], start: r.y1 };
  return { o: [r.x1, r.y0, 0], U: [0, 1, 0], N: [-1, 0, 0], len: r.y1 - r.y0, coord: (p) => p[1], start: r.y0 };
};
// bay lines with the portal's bay (`pw` wide) in the middle, the rest in even bays either side
function portalLines(len, pw, bay) {
  const side = (len - pw) / 2, n = Math.max(1, Math.round(side / bay)), out = [];
  for (let k = 0; k <= n; k++) out.push((side * k) / n);
  for (let k = 0; k <= n; k++) out.push(side + pw + (side * k) / n);
  return out;
}
// a wall with an opening through it: solid spans full height, a lintel over the opening
function plainWall(out, F, u0, u1, h, cuts, sf) {
  const inBay = cuts.map(([a, b, top]) => [Math.max(a, u0) - u0, Math.min(b, u1) - u0, top]);
  for (const [a, b] of solidSpans(u1 - u0, inBay)) panel(out, onWall(F, u0 + a, 0, 0), F.U, b - a, Z, h, F.N, sf, sf.cell);
  for (const [a, b, top] of inBay) panel(out, onWall(F, u0 + a, 0, top), F.U, b - a, Z, h - top, F.N, sf, sf.cell);
}

/** The blast door: an opening `width` × `height` with its top corners chamfered, leaves set back `depth`, a hazard
 *  surround standing proud, a red status lamp over it (a seat). */
function blastDoor(out, F, u0, u1, h, Pt, sf, seats) {
  const mid = (u0 + u1) / 2, a = mid - Pt.width / 2, b = mid + Pt.width / 2, H = Pt.height, c = Pt.chamfer, D = Pt.depth, S = Pt.surround;
  const W = (u, z, off = 0) => onWall(F, u, off, z), N = F.N, back = mul(F.N, -1);
  const hz = { key: 'lab:hazard', scale: Pt.stripe, tint: [1, 1, 1], group: 'stage:portal', cell: 1 };
  // the wall round it: either side full height, the band over it, and the chamfers' corners
  panel(out, W(u0, 0), F.U, a - u0, Z, h, N, sf.field, sf.field.cell);
  panel(out, W(b, 0), F.U, u1 - b, Z, h, N, sf.field, sf.field.cell);
  panel(out, W(a, H), F.U, b - a, Z, h - H, N, sf.upper, sf.upper.cell);
  // (a triangle as a quad with its last corner doubled: the mesh and the bake take quads)
  const tri = (p, q, s) => ({ corners: [p, q, s, s].map(P), normal: N, outNormal: N, texture: sf.field.key, textureLit: true, uv: [p, q, s, s].map((x) => [r5((x[0] * F.U[0] + x[1] * F.U[1]) / sf.field.scale), r5(x[2] / sf.field.scale)]), tint: sf.field.tint, group: sf.field.group });
  out.push(tri(W(a, H - c), W(a + c, H), W(a, H)), tri(W(b - c, H), W(b, H - c), W(b, H)));
  // the reveals through to the leaves: jambs, the chamfers, the head
  const outline = [[a, 0], [a, H - c], [a + c, H], [b - c, H], [b, H - c], [b, 0]];
  for (let i = 0; i + 1 < outline.length; i++) {
    const [ua, za] = outline[i], [ub, zb] = outline[i + 1], du = ub - ua, dz = zb - za, l = Math.hypot(du, dz);
    const inward = [F.U[0] * (dz / l) + 0, F.U[1] * (dz / l), -du / l];   // perpendicular to the edge, into the opening
    quad(out, [W(ua, za), W(ub, zb), W(ub, zb, -D), W(ua, za, -D)], inward.map((v) => r5(v) + 0), { ...hz, key: 'hull-plate-dark', scale: 1.5 }, null, null, [[0, 0], [l / 1.5, 0], [l / 1.5, D / 1.5], [0, D / 1.5]]);
  }
  // the leaves: two, meeting in the middle, a hazard band across their foot, a seam where they meet
  const leaf = { key: 'hull-plate', scale: 1.4, tint: Pt.leafTint, group: 'stage:door', cell: 1 };
  // each leaf's outline follows the opening's chamfer at its outer top corner
  const poly = (pts, surf) => out.push({ corners: pts.map((q) => P(W(q[0], q[1], -D))), normal: N, outNormal: N, texture: surf.key, textureLit: true, uv: pts.map((q) => [r5(q[0] / surf.scale), r5(q[1] / surf.scale)]), tint: surf.tint, group: surf.group });
  // (as quads: a rectangle to the middle, and the chamfered strip at the outer edge)
  poly([[a + c, Pt.band], [mid - 0.01, Pt.band], [mid - 0.01, H], [a + c, H]], leaf);
  poly([[a, Pt.band], [a + c, Pt.band], [a + c, H], [a, H - c]], leaf);
  poly([[mid + 0.01, Pt.band], [b - c, Pt.band], [b - c, H], [mid + 0.01, H]], leaf);
  poly([[b - c, Pt.band], [b, Pt.band], [b, H - c], [b - c, H]], leaf);
  for (const [la, lb] of [[a, mid - 0.01], [mid + 0.01, b]]) poly([[la, 0], [lb, 0], [lb, Pt.band], [la, Pt.band]], hz);
  // the surround: a hazard-striped frame standing proud round the opening (jambs and head), the status lamp over it
  wallBox(out, F, a - S, a, 0, H + S, Pt.out, hz, 1);
  wallBox(out, F, b, b + S, 0, H + S, Pt.out, hz, 1);
  wallBox(out, F, a, b, H, H + S, Pt.out, hz, 1, true);
  const lz = H + S + 0.35, lw = 0.22;
  out.push(lit([W(mid - lw, lz, 0.12), W(mid + lw, lz, 0.12), W(mid + lw, lz + 0.18, 0.12), W(mid - lw, lz + 0.18, 0.12)], N, Pt.lamp, 'stage:lamp', `0 0 10px 4px ${Pt.lamp}`, 3));
  wallBox(out, F, mid - lw - 0.04, mid + lw + 0.04, lz - 0.04, lz + 0.22, 0.1, { key: null, scale: 1, tint: [0.3, 0.3, 0.32], group: 'stage:fixture' }, 1);
  seats.push({ at: P(W(mid, lz + 0.1, 0.5)), n: N, color: Pt.lamp, intensity: Pt.lampLight.intensity, radius: Pt.lampLight.radius, fixture: 'lamp' });
}
