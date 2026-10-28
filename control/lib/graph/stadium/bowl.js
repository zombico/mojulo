/**
 * THE BOWL — an arena's seating as one round form: a ring that follows a SUPERELLIPSE round the field (2 an ellipse,
 * higher a rounded rectangle), raked in steps up and out from a pitch wall, a concourse with a band of glass boxes, an
 * upper tier above it, the outer wall carrying a facade, and a roof over the whole ring. Every part is polygons: a
 * crowd is a mosaic painted on the treads (seat colour and the colours people wear, in blocks a seat or two wide),
 * never figures, so a full house costs nothing past the steps it sits on.
 *
 *   bowlFaces(B, { centre, half, light, look }) → { faces, lamps, top, outer, roofZ, reach }
 *     centre [x, y] and half [hx, hy]: the field the bowl wraps; the ring is sized so the field's corners sit inside
 *     it, and starts `gap` beyond
 *     B: { shape, segs, gap, tiers: [{ rows, tread, rise }], concourse, boxes, roof, facade, crowd, colours, open,
 *          apron, screens, landmark, seed }
 *       shape    the superellipse's exponent (2 round … 6 nearly square)
 *       tiers    one or two: each its rows, the tread (m) and the rise (m) of a row
 *       roof     'none' | 'canopy' (a cantilever over the stands, a truss at its edge) | 'ring' (the canopy hung from
 *                masts outside the ring by stays) | 'dome' (ribs arching over the field to an open eye)
 *       facade   'none' | 'glass' | 'brick' | 'metal' (the outer wall's card, architecture/facade-card.js, between
 *                pilasters) | 'arches' (storeys of arcades and cornices: an amphitheatre's)
 *       open     the sides left open (n, e, s, w): the ring stops there, its ends capped
 *       apron    the ground between the field and the pitch wall: a colour, or 'track' (a running track's lanes)
 *       screens  0..2 video boards on the rim at the ends;  landmark 'none' | 'cauldron' | 'arch'
 *       crowd    0..1 the share of seats taken (the mosaic's)
 *       colours  { seat, crowd: [..], concrete, wall, boards, glass, roof, rib, accent, apron, glow?, screen }
 *     look: 'shaded' (Lambert under the roadway's noon) | 'anime' (two bands) | 'voxel' (two bands, fewer segments)
 *     ground: false draws no infield, apron or plaza (a track's venue stands on the track's own ground)
 *
 * Every face is wound to the side it is seen from (the field's side inside, the street's outside, the roof from
 * below), so the hour's relight (roads/race-mood.js) reads it as it is lit here.
 *
 * Pure and seeded; the same words are the same bowl.
 */
import { litFactor, scaleHex } from '../polygonizer/vexar.js';
import { buildFacadeCard } from '../architecture/facade-card.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const normalOf = (c) => unit(cross(sub(c[1], c[0]), sub(c[c.length - 1], c[0])));

function dice(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The superellipse's point at angle t, the axes grown by `o` (an offset ring), at height z. */
export function ringPoint(centre, half, shape, o, t, z = 0) {
  const c = Math.cos(t), s = Math.sin(t), e = 2 / shape;
  return [r3(centre[0] + Math.max(0, half[0] + o) * Math.sign(c) * Math.abs(c) ** e), r3(centre[1] + Math.max(0, half[1] + o) * Math.sign(s) * Math.abs(s) ** e), r3(z)];
}
/** The side of the ring an angle looks out of. */
const sideOf = (t) => { const c = Math.cos(t), s = Math.sin(t); return Math.abs(c) >= Math.abs(s) ? (c > 0 ? 'e' : 'w') : (s > 0 ? 'n' : 's'); };

export function bowlFaces(B, { centre, half: field, light, look = 'shaded', infield = (corners) => ({ corners, fill: '#5d8f45' }), ground = true }) {
  const C = B.colours, roll = dice((B.seed ?? 1) * 7919 + 29), faces = [], lamps = [];
  // (the ring through the field's corners: a superellipse of exponent p holds the rectangle at 2^(1/p) its half)
  const grow = 2 ** (1 / B.shape), half = [field[0] * grow, field[1] * grow];
  const segs = look === 'voxel' ? Math.min(B.segs, 32) : B.segs, T = (k) => (2 * Math.PI * k) / segs;
  const P = (o, k, z) => ringPoint(centre, half, B.shape, o, T(k), z);
  const on = Array.from({ length: segs }, (_, k) => !(B.open ?? []).includes(sideOf(T(k + 0.5))));
  // a face wound to the side it is seen from, and lit by that normal: 'in' (up and toward the field), 'out' (up and
  // toward the street), 'under' (down: a roof seen from the stands), or a point it faces
  const shade = (hex, n) => { const k = litFactor(n, light); return scaleHex(hex, look === 'shaded' ? k : k >= 0.78 ? 1 : 0.74); };
  const quad = (corners, hex, side = 'in', extra = {}) => {
    const mid = corners.reduce((s, p) => [s[0] + p[0] / corners.length, s[1] + p[1] / corners.length, s[2] + p[2] / corners.length], [0, 0, 0]);
    const toC = unit([centre[0] - mid[0], centre[1] - mid[1], 0]);
    const want = Array.isArray(side) ? sub(side, mid) : side === 'in' ? [toC[0], toC[1], 0.5] : side === 'out' ? [-toC[0], -toC[1], 0.5] : [toC[0] * 0.3, toC[1] * 0.3, -1];
    let n = normalOf(corners);
    if (dot(n, want) < 0) { corners = [...corners].reverse(); n = n.map((v) => -v); }
    faces.push({ corners, fill: extra.glow ? hex : shade(hex, n), ...extra });
    return n;
  };
  // a quad between two rings (o0, z0) → (o1, z1) over segment k, split into `n` pieces along the ring
  const band = (k, o0, z0, o1, z1, hexOf, n = 1, side = 'in', extra = {}) => {
    for (let j = 0; j < n; j++) {
      const t0 = k + j / n, t1 = k + (j + 1) / n;
      quad([P(o0, t0, z0), P(o0, t1, z0), P(o1, t1, z1), P(o1, t0, z1)], typeof hexOf === 'function' ? hexOf(j) : hexOf, side, extra);
    }
  };
  const each = (fn) => { for (let k = 0; k < segs; k++) if (on[k]) fn(k); };
  const gap = B.gap, profile = [];   // profile: the bowl's section, [o0, o1, z] steps (an open end's cap)

  // the infield: the ring through the field's corners, in the field's own surface (a kite a segment from the middle,
  // never under the field: one surface, no faces fighting for the same ground); the apron out to the pitch wall, a
  // running track's lanes when asked; the plaza round the outside
  const G = -0.2, mid0 = [centre[0], centre[1], G];   // (under the floor a game's page paints its own on: clear of it at any depth precision)
  // (each segment's wedge cut across in rings: no triangle tens of metres long under a game's floor)
  const L = (p, f) => [r3(mid0[0] + (p[0] - mid0[0]) * f), r3(mid0[1] + (p[1] - mid0[1]) * f), G], cuts = [0, 0.3, 0.55, 0.75, 0.9, 1];
  for (let k = 0; k < segs && ground; k++) {
    const a = P(0, k, G), b = P(0, k + 1, G);
    for (let i = 0; i + 1 < cuts.length; i++) faces.push(infield(i === 0 ? [mid0, L(a, cuts[1]), L(b, cuts[1]), mid0] : [L(a, cuts[i]), L(a, cuts[i + 1]), L(b, cuts[i + 1]), L(b, cuts[i])]));
  }
  for (let k = 0; k < segs && ground; k++) {
    if (B.apron !== 'track') { band(k, 0, G, gap, G, C.apron); continue; }
    const lanes = 8, w = (gap - 1.6) / lanes;
    band(k, 0, G, 0.6, G, C.apron); band(k, gap - 0.4, G, gap, G, C.apron);
    for (let i = 0; i < lanes; i++) { band(k, 0.6 + i * w, G, 0.66 + i * w, G, '#f1ede4'); band(k, 0.66 + i * w, G, 0.6 + (i + 1) * w, G, C.track); }
    band(k, gap - 1.06, G, gap - 1, G, '#f1ede4');
  }
  // the pitch wall: a ring of boards at the field's edge
  const wallH = 1.1;
  each((k) => band(k, gap, 0, gap, wallH, k % 2 ? C.boards : scaleHex(C.boards, 0.82)));
  profile.push([gap - 0.3, gap, wallH]);
  // the tiers: each row a tread (the crowd's mosaic on it) and a riser; aisles (vomitories) every few segments
  let o = gap, z = wallH, top = z;
  const seatOf = () => (roll() < B.crowd ? C.crowd[Math.floor(roll() * C.crowd.length)] : C.seat);
  const pieces = look === 'voxel' ? 2 : 4;
  B.tiers.forEach((tier, ti) => {
    if (ti > 0) {
      // the concourse between the tiers: a walkway, then a band of glass boxes under the upper tier's front
      each((k) => {
        band(k, o, z, o + B.concourse, z, C.concrete);
        band(k, o + B.concourse, z, o + B.concourse, z + B.boxes, C.glass, 1, 'in', { glow: !!C.glow && k % 2 === 0 });
      });
      profile.push([o, o + B.concourse, z]);
      o += B.concourse; z += B.boxes;
      each((k) => band(k, o, z, o + 0.6, z, C.accent));   // the upper tier's lip
      profile.push([o, o + 0.6, z]);
      o += 0.6;
    }
    for (let r = 0; r < tier.rows; r += 2) {
      const step = Math.min(2, tier.rows - r), d = tier.tread * step, h = tier.rise * step;
      each((k) => {
        const aisle = ti === 0 && k % 6 === 0 && r < tier.rows * 0.6;
        band(k, o, z, o, z + h, aisle ? scaleHex(C.concrete, 0.6) : scaleHex(C.seat, 0.62));            // the riser
        band(k, o, z + h, o + d, z + h, aisle ? scaleHex(C.concrete, 0.8) : seatOf, aisle ? 1 : pieces);  // the tread
      });
      profile.push([o, o + d, z + h]);
      o += d; z += h;
    }
    top = z;
  });
  // the back: a parapet at the top, and the outer wall down to the ground carrying its facade
  const outer = o + 1.2, wallTop = top + 1.2;
  each((k) => {
    band(k, o, top, o, wallTop, C.wall);
    band(k, o, wallTop, outer, wallTop, C.concrete);
  });
  profile.push([o, outer, wallTop]);
  each((k) => {
    const a = P(outer, k, 0), b = P(outer, k + 1, 0), c = P(outer, k + 1, wallTop), d = P(outer, k, wallTop);
    if (B.facade === 'arches') { arcade(k, a, b, d); return; }
    if (B.facade !== 'none') {
      const floors = Math.max(2, Math.round(wallTop / 4.2)), bays = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3.5));
      const card = buildFacadeCard(B.facade === 'brick' ? { material: 'brick', glass: C.glass, rhythm: 'punched' } : B.facade === 'metal' ? { material: 'metal', metal: { metal: 'aluminium', finish: 'brushed' }, rhythm: 'banded' } : { material: 'glass', glass: C.glass, frame: C.wall, rhythm: 'curtain', glassVar: 1 }, floors, bays);
      const n = quad([a, b, c, d], C.wall, 'out');
      faces[faces.length - 1] = { ...faces[faces.length - 1], card, lit: r3(litFactor(n, light)) };
    } else quad([a, b, c, d], C.wall, 'out');
    // a pilaster every few segments: a rib standing proud of the wall, up past its top
    if (k % 4 === 0) {
      const p0 = P(outer, k, 0), p1 = P(outer + 1.1, k, 0), hT = wallTop + 1.4;
      const tan = unit(sub(P(outer, k + 0.2, 0), p0)).map((v) => v * 0.6);
      const q0 = [p0[0] + tan[0], p0[1] + tan[1], 0], q1 = [p1[0] + tan[0], p1[1] + tan[1], 0];
      const up = (p) => [p[0], p[1], r3(hT)];
      quad([p1, q1, up(q1), up(p1)], C.rib, 'out');
      quad([p0, p1, up(p1), up(p0)], C.rib, P(outer, k - 1, 2));
      quad([q1, q0, up(q0), up(q1)], C.rib, P(outer, k + 1, 2));
      quad([up(p0), up(p1), up(q1), up(q0)], C.rib, 'out');
    }
  });

  // the plaza: paving round the outside, out past the pilasters and the masts
  if (ground) for (let k = 0; k < segs; k++) band(k, outer, G, outer + 14, G, scaleHex(C.concrete, 0.92), 1, 'out');
  // an amphitheatre's wall: storeys of arches between piers, a cornice over each, an attic of square windows on top
  function arcade(k, a, b, d) {
    const H = d[2], storeys = Math.max(2, Math.min(4, Math.round(H / 7))), sH = H / storeys;
    const nOut = unit(cross(sub(b, a), [0, 0, 1])).map((v) => v * 0.06);
    const toward = (p) => [p[0] + nOut[0] * 50, p[1] + nOut[1] * 50, p[2]];
    const at = (u, h) => { const p = lerp(a, b, u); return [r3(p[0] + nOut[0]), r3(p[1] + nOut[1]), r3(h)]; };
    quad([a, b, [b[0], b[1], H], [a[0], a[1], H]], C.wall, 'out');
    const dark = scaleHex(C.wall, 0.3);
    for (let s = 0; s < storeys; s++) {
      const z0 = s * sH, attic = s === storeys - 1 && storeys > 2;
      if (attic) { const w = 0.16; quad([at(0.5 - w, z0 + sH * 0.35), at(0.5 + w, z0 + sH * 0.35), at(0.5 + w, z0 + sH * 0.62), at(0.5 - w, z0 + sH * 0.62)], dark, toward(at(0.5, z0))); continue; }
      // the opening: a rectangle up to the springing, a half round over it in four slices
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), w = 0.31, r = w * L, crown = z0 + sH * 0.86, spring = Math.max(z0 + 0.6, crown - r);
      quad([at(0.5 - w, z0 + (s === 0 ? 0 : 0.5)), at(0.5 + w, z0 + (s === 0 ? 0 : 0.5)), at(0.5 + w, spring), at(0.5 - w, spring)], dark, toward(at(0.5, z0)));
      for (let i = 0; i < 4; i++) {
        const f0 = (i * Math.PI) / 8, f1 = ((i + 1) * Math.PI) / 8, rise = crown - spring;
        quad([at(0.5 - w * Math.cos(f0), spring + rise * Math.sin(f0)), at(0.5 + w * Math.cos(f0), spring + rise * Math.sin(f0)), at(0.5 + w * Math.cos(f1), spring + rise * Math.sin(f1)), at(0.5 - w * Math.cos(f1), spring + rise * Math.sin(f1))], dark, toward(at(0.5, z0)));
      }
      // the cornice: a ledge standing out over the storey
      band(k, outer, z0 + sH, outer + 0.5, z0 + sH, scaleHex(C.wall, 0.9), 1, 'out');
    }
  }

  // an open end: the bowl's section closing the ring where it stops
  for (let k = 0; k < segs; k++) {
    const prev = on[(k + segs - 1) % segs];
    if (on[k] === prev) continue;
    const face = P(gap, on[k] ? k - 1 : k + 1, 2);
    for (const [o0, o1, zz] of profile) quad([P(o0, k, 0), P(o1, k, 0), P(o1, k, zz), P(o0, k, zz)], C.concrete, face);
  }

  // the roof
  const roofZ = top + 4.5, inner = gap + (outer - gap) * 0.45;
  let reach = outer;
  if (B.roof === 'canopy' || B.roof === 'ring') {
    // a cantilever from the outer wall in over the stands (a shade over half their depth and more), its edge a truss
    each((k) => {
      band(k, outer + 0.5, roofZ, inner, roofZ - 1.6, C.roof);   // (lit from above: a membrane reads light from below)
      band(k, inner, roofZ - 1.6, inner, roofZ - 2.6, C.rib);                                  // the truss's face
      band(k, inner, roofZ - 2.6, inner + 1.4, roofZ - 2.4, scaleHex(C.rib, 0.7), 1, 'under'); // its underside chord
      band(k, outer, wallTop, outer + 0.5, roofZ, scaleHex(C.wall, 0.8), 1, 'out');            // louvres up to the roof
      if (k % 4 === 2) {
        // a rafter over the roof, along the fall
        const a = P(outer + 0.5, k, roofZ + 0.05), b = P(inner, k, roofZ - 1.55), w = unit(sub(P(outer, k + 0.15, 0), P(outer, k, 0))).map((v) => v * 0.5);
        quad([a, b, [b[0] + w[0], b[1] + w[1], r3(b[2] + 0.6)], [a[0] + w[0], a[1] + w[1], r3(a[2] + 0.9)]], C.rib, 'out');
      }
    });
    if (B.roof === 'ring') {
      // masts outside the ring every eighth of the way round, and stays from their heads to the canopy's edge
      const mastH = roofZ + 22;
      for (let m = 0; m < 8; m++) {
        const k = (m * segs) / 8 + segs / 16;
        if (!on[Math.floor(k) % segs]) continue;
        const base = P(outer + 6, k, 0), head = [base[0], base[1], r3(mastH)], w = unit(sub(P(outer + 6, k + 0.3, 0), base)).map((v) => v * 0.8);
        quad([base, [r3(base[0] + w[0]), r3(base[1] + w[1]), 0], [r3(head[0] + w[0] * 0.5), r3(head[1] + w[1] * 0.5), head[2]], head], C.rib, 'in');
        for (const dk of [-1.5, 0, 1.5]) {
          const at = P(inner, k + dk, roofZ - 1.6);
          quad([head, [r3(head[0] + 0.15), head[1], head[2]], [r3(at[0] + 0.15), at[1], at[2]], at], scaleHex(C.rib, 0.9), 'in');
        }
      }
      reach = outer + 7;
    }
  } else if (B.roof === 'dome') {
    // ribs from the top of the wall arching over the field to an open eye, and rings across them
    const span = Math.max(half[0], half[1]), H = span * 0.6 + top, eye = 0.2, nRibs = Math.floor(segs / 3), nRings = 6;
    const domeAt = (k, f) => { const oo = (outer + 0.5) - (outer + 0.5 + Math.min(half[0], half[1]) * (1 - eye)) * Math.sin((f * Math.PI) / 2); const p = P(oo, k, 0); return [p[0], p[1], r3(wallTop + (H - wallTop) * Math.sin(f * Math.PI / 2 + 0.0001) ** 0.6)]; };
    const lit = C.glow ? { glow: true } : {};
    for (let i = 0; i < nRibs; i++) {
      const k = i * 3, w = unit(sub(P(outer, k + 0.25, 0), P(outer, k, 0))).map((v) => v * 0.45);
      for (let j = 0; j < 10; j++) {
        const a = domeAt(k, j / 10), b = domeAt(k, (j + 1) / 10);
        quad([a, b, [r3(b[0] + w[0]), r3(b[1] + w[1]), b[2]], [r3(a[0] + w[0]), r3(a[1] + w[1]), a[2]]], C.glow ?? C.rib, 'under', lit);
      }
    }
    for (let j = 1; j <= nRings; j++) {
      const f = j / (nRings + 1);
      for (let k = 0; k < segs; k++) {
        const a = domeAt(k, f), b = domeAt(k + 1, f);
        quad([a, b, [b[0], b[1], r3(b[2] + 0.35)], [a[0], a[1], r3(a[2] + 0.35)]], C.glow ?? C.rib, 'under', lit);
      }
    }
    // the eye's ring, lit
    for (let k = 0; k < segs; k++) { const a = domeAt(k, 1), b = domeAt(k + 1, 1); quad([a, b, [b[0], b[1], r3(b[2] + 0.8)], [a[0], a[1], r3(a[2] + 0.8)]], C.accent, 'under', { glow: true }); }
  }

  // the screens: video boards standing on the rim at the ends, faced to the field
  const rimZ = B.roof === 'canopy' || B.roof === 'ring' ? roofZ + 0.6 : wallTop + 0.6;
  for (let i = 0; i < (B.screens ?? 0); i++) {
    const k = i === 0 ? segs / 4 : (3 * segs) / 4;
    if (!on[Math.floor(k) % segs]) continue;
    const c0 = P(outer - 1, k, rimZ), tan = unit(sub(P(outer - 1, k + 0.5, 0), P(outer - 1, k - 0.5, 0)));
    const W = Math.min(34, Math.max(10, field[0] * 0.55)), Hs = W * 0.4, inward = unit([centre[0] - c0[0], centre[1] - c0[1], 0]);
    const pt = (u, h, d = 0) => [r3(c0[0] + tan[0] * u + inward[0] * d), r3(c0[1] + tan[1] * u + inward[1] * d), r3(rimZ + h)];
    const facing = [centre[0], centre[1], rimZ];
    for (const u of [-W * 0.3, W * 0.3]) quad([pt(u - 0.4, -rimZ), pt(u + 0.4, -rimZ), pt(u + 0.4, 1.5), pt(u - 0.4, 1.5)], C.rib, facing);
    quad([pt(-W / 2 - 0.6, 1.2), pt(W / 2 + 0.6, 1.2), pt(W / 2 + 0.6, Hs + 2.4), pt(-W / 2 - 0.6, Hs + 2.4)], '#16191e', facing);
    quad([pt(-W / 2, 1.8, 0.08), pt(W / 2, 1.8, 0.08), pt(W / 2, 1.8 + Hs * 0.7, 0.08), pt(-W / 2, 1.8 + Hs * 0.7, 0.08)], C.screen, facing, { glow: true });
    quad([pt(-W / 2, 1.8 + Hs * 0.74, 0.08), pt(W / 2, 1.8 + Hs * 0.74, 0.08), pt(W / 2, 1.8 + Hs, 0.08), pt(-W / 2, 1.8 + Hs, 0.08)], C.accent, facing, { glow: true });
  }

  // the landmark: the games' cauldron on its pylon, or an arch sprung over the far stand
  if (B.landmark === 'cauldron') {
    const k = segs * 0.2, base = P(outer + 5, k, 0), Hp = top + 14, facing = [centre[0], centre[1], Hp];
    const ring = (r, z) => Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return [r3(base[0] + Math.cos(a) * r), r3(base[1] + Math.sin(a) * r), r3(z)]; });
    const foot = ring(2.4, 0), head = ring(1.1, Hp), lip = ring(3.6, Hp + 3.2);
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      quad([foot[i], foot[j], head[j], head[i]], C.rib, 'out');
      quad([head[i], head[j], lip[j], lip[i]], C.accent, 'out');
    }
    const flame = (r, h, hex) => { for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) { const dx = Math.cos(a) * r, dy = Math.sin(a) * r; quad([[r3(base[0] - dx), r3(base[1] - dy), r3(Hp + 2.6)], [r3(base[0] + dx), r3(base[1] + dy), r3(Hp + 2.6)], [r3(base[0] + dx * 0.2), r3(base[1] + dy * 0.2), r3(Hp + 2.6 + h)], [r3(base[0] - dx * 0.2), r3(base[1] - dy * 0.2), r3(Hp + 2.6 + h)]], hex, facing, { glow: true }); } };
    flame(2.8, 6.5, '#ff8a26'); flame(1.6, 4.2, '#ffd65a');
    lamps.push({ at: [base[0], base[1], r3(Hp + 5)], rgb: [255, 170, 80], intensity: 1.2, reach: 40, hex: '#ffaa50' });
    reach = Math.max(reach, outer + 9);
  } else if (B.landmark === 'arch') {
    // a parabola in a plane across the bowl behind the far stand, its feet outside the ring
    const yA = centre[1] + half[1] + gap + (outer - gap) * 0.55, xA = half[0] + outer + 10, Ha = top + Math.max(half[0], half[1]) * 0.85, n = 28, w = 1.3;
    const at = (s, dx, dz) => [r3(centre[0] - xA + 2 * xA * s + dx), r3(yA), r3(Ha * 4 * s * (1 - s) + dz)];
    for (let i = 0; i < n; i++) {
      const s0 = i / n, s1 = (i + 1) / n;
      // (a box section: two sides and the top and the belly, the side planes offset across the arch's plane)
      const side = (dy) => { const a = at(s0, 0, 0), b = at(s1, 0, 0); return [[a[0], r3(a[1] + dy), r3(a[2] - w)], [b[0], r3(b[1] + dy), r3(b[2] - w)], [b[0], r3(b[1] + dy), r3(b[2] + w)], [a[0], r3(a[1] + dy), r3(a[2] + w)]]; };
      quad(side(-w), C.rib, [centre[0], centre[1] - 100, Ha]);
      quad(side(w), C.rib, [centre[0], centre[1] + 100, Ha]);
      const lid = (dz, face) => { const a = at(s0, 0, dz), b = at(s1, 0, dz); quad([[a[0], r3(a[1] - w), a[2]], [b[0], r3(b[1] - w), b[2]], [b[0], r3(b[1] + w), b[2]], [a[0], r3(a[1] + w), a[2]]], C.rib, face); };
      lid(w, [at((s0 + s1) / 2, 0, 0)[0], yA, Ha * 4]); lid(-w, [at((s0 + s1) / 2, 0, 0)[0], yA, -Ha * 4]);
    }
    reach = Math.max(reach, xA - half[0] + 2);
  }
  return { faces, lamps, top, outer, inner, roofZ, wallTop, reach, half };
}
