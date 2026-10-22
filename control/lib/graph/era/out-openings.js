/**
 * THE OPENINGS AS ARCHITECTURE — a light and a door built rather than marked: what a building language's `light` and
 * `door` elements say beyond their size and head (era/out-anchor-elements.js), laid on a wall frame (`W`: `at(u, z, d)`
 * a point u along the wall, z up, d proud of it; `n` its outward normal) by `speak` (era/out-anchor-structure.js).
 *
 *   a light's   frame      a surround standing `frame` proud of the wall round the light's shape (open at its foot
 *                          when a sill takes it), its returns the reveal, so the glass reads as set back in a depth
 *               glazing    bars over the glass: 'lattice' (leaded diamonds), 'sash' (two sashes of small panes and a
 *                          meeting rail), 'casement' (a mullion and a transom), 'plate' (one pane), 'none'
 *               trim       the surface group the frame and bars are painted in, at `trimValue`
 *   a door's    leaf       'boards' (upright, their joints), 'panels' (raised, two columns), 'glazed' (its upper half
 *                          glass in small panes)
 *               surround   'frame' (a band round it and its fanlight), 'pilasters' (one each side and an entablature
 *                          over), 'hood' (a canopy on two brackets)
 *               fanlight   'rect' (a glazed transom over the head), 'arch' (a half-round with radial bars)
 *               steps      risers up to the threshold (the floor; they stand below it, out from the wall)
 *   shutters    form       'boards' or 'louvred': leaves standing out of the wall, their boards or slats marked
 *
 *   surround(out, W, pts, w, d, part, value, extra, { open })   a band round a polygon's edges, its face and returns
 *   wallBox(out, W, u0, u1, z0, z1, d0, d1, part, value, extra) a box on the wall: its face, its top and its ends
 *   lightDress(out, W, light, spec, ctx)                         a light's frame and glazing
 *   doorDress(out, W, door, spec, ctx) → { top }                 a door's leaf, fanlight, surround and steps
 *   shutterDress(out, W, u0, u1, z0, z1, form, value, extra)     a shutter leaf with depth
 *
 * Pure: no dice (a household's draws are the language's; these follow from what the language says).
 */
import { geometry as G } from './out-structures.js';

const { face, r3 } = G;
const tangentOf = (W) => { const a = W.at(0, 0, 0), b = W.at(1, 0, 0); return [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; };
// a direction in the wall's (u, z) plane, in the world
const dir3 = (W, du, dz) => { const t = tangentOf(W); return [t[0] * du, t[1] * du, dz]; };
const RISE = 0.16, TREAD = 0.32;

/**
 * A band round a polygon's edges ([u, z] counter-clockwise, its first edge its foot), `w` wide, its face `d` proud of
 * the wall, its inner return (the reveal) and its outer return. `open`: the foot left to a sill (or a threshold), the
 * jambs running straight down.
 */
export function surround(out, W, pts, w, d, part, value, extra = {}, { open = true } = {}) {
  const n = pts.length, edges = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], du = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(du, dz) || 1;
    edges.push({ a, b, nu: dz / l, nz: -du / l });
  }
  const used = edges.map((_, i) => !(open && i === 0));
  // each vertex pushed out along its mitre (a vertex at an open foot only along its jamb)
  const outer = pts.map((p, i) => {
    const e1 = edges[(i - 1 + n) % n], e2 = edges[i], u1 = used[(i - 1 + n) % n], u2 = used[i];
    const [mu, mz] = u1 && u2 ? (() => { const s = 1 + e1.nu * e2.nu + e1.nz * e2.nz; return s < 0.2 ? [e2.nu, e2.nz] : [(e1.nu + e2.nu) / s, (e1.nz + e2.nz) / s]; })() : u1 ? [e1.nu, e1.nz] : [e2.nu, e2.nz];
    return [p[0] + mu * w, p[1] + mz * w];
  });
  for (let i = 0; i < n; i++) {
    if (!used[i]) continue;
    const { a, b, nu, nz } = edges[i], A = outer[i], B = outer[(i + 1) % n];
    face(out, [W.at(a[0], a[1], d), W.at(b[0], b[1], d), W.at(B[0], B[1], d), W.at(A[0], A[1], d)], W.n, part, value, extra);
    face(out, [W.at(a[0], a[1], 0), W.at(b[0], b[1], 0), W.at(b[0], b[1], d), W.at(a[0], a[1], d)], dir3(W, -nu, -nz), part, r3(value * 0.82), extra);
    face(out, [W.at(A[0], A[1], 0), W.at(B[0], B[1], 0), W.at(B[0], B[1], d), W.at(A[0], A[1], d)], dir3(W, nu, nz), part, r3(value * 0.9), extra);
  }
}

/** A box standing on the wall: u0–u1, z0–z1, from d0 to d1 proud; its face, its top and its two ends (its foot unseen). */
export function wallBox(out, W, u0, u1, z0, z1, d0, d1, part, value, extra = {}, { top = true, ends = true, bottom = false } = {}) {
  face(out, [W.at(u0, z0, d1), W.at(u1, z0, d1), W.at(u1, z1, d1), W.at(u0, z1, d1)], W.n, part, value, extra);
  if (top) face(out, [W.at(u0, z1, d0), W.at(u1, z1, d0), W.at(u1, z1, d1), W.at(u0, z1, d1)], [0, 0, 1], part, r3(Math.min(1, value * 1.1)), extra);
  if (bottom) face(out, [W.at(u0, z0, d0), W.at(u1, z0, d0), W.at(u1, z0, d1), W.at(u0, z0, d1)], [0, 0, -1], part, r3(value * 0.7), extra);
  if (ends) {
    face(out, [W.at(u0, z0, d0), W.at(u0, z1, d0), W.at(u0, z1, d1), W.at(u0, z0, d1)], dir3(W, -1, 0), part, r3(value * 0.86), extra);
    face(out, [W.at(u1, z0, d0), W.at(u1, z1, d0), W.at(u1, z1, d1), W.at(u1, z0, d1)], dir3(W, 1, 0), part, r3(value * 0.86), extra);
  }
}

// a bar along a segment of the wall's plane, `bw` wide, `d` proud: one face
function bar(out, W, [ua, za], [ub, zb], bw, d, part, value, extra) {
  const l = Math.hypot(ub - ua, zb - za);
  if (l < 1e-3) return;
  const pu = (-(zb - za) / l) * (bw / 2), pz = ((ub - ua) / l) * (bw / 2);
  face(out, [W.at(ua - pu, za - pz, d), W.at(ub - pu, zb - pz, d), W.at(ub + pu, zb + pz, d), W.at(ua + pu, za + pz, d)], W.n, part, value, extra);
}
// the clear of a light: where its top is at u (a rect's head, an arch's curve over its spring)
const topAt = (L, u) => (L.kind === 'arch' ? L.z0 + L.hh - L.w / 2 + Math.sqrt(Math.max(0, (L.w / 2) ** 2 - (u - L.uc) ** 2)) : L.z0 + L.hh);
const spanAt = (L, z) => {
  const spring = L.z0 + L.hh - L.w / 2;
  if (L.kind !== 'arch' || z <= spring) return [L.uc - L.w / 2, L.uc + L.w / 2];
  const h = Math.sqrt(Math.max(0, (L.w / 2) ** 2 - (z - spring) ** 2));
  return [L.uc - h, L.uc + h];
};

/** Bars over a light's glass, by its glazing: { kind: 'rect' | 'arch', uc, z0, w, hh } in the wall's (u, z). */
function glaze(out, W, L, glazing, d, value, extra, part = 'glazing') {
  const u0 = L.uc - L.w / 2, u1 = L.uc + L.w / 2, spring = L.kind === 'arch' ? L.z0 + L.hh - L.w / 2 : L.z0 + L.hh;
  const vert = (u, bw, from = L.z0) => bar(out, W, [u, from], [u, topAt(L, u) - 0.01], bw, d, part, value, extra);
  const horz = (z, bw) => { const [a, b] = spanAt(L, z); if (b - a > 0.05) bar(out, W, [a, z], [b, z], bw, d, part, value, extra); };
  if (glazing === 'casement') {
    // a mullion where the light is wide enough for two leaves, a transom under the head (under the spring of an arch)
    if (L.w >= 0.7) vert(L.uc, 0.06);
    horz(r3(Math.min(L.z0 + L.hh * 0.72, spring - 0.04)), 0.06);
  } else if (glazing === 'sash') {
    // two sashes, the meeting rail at half height, each of small panes: three across a wide light, two a narrow one
    const cols = L.w >= 1.05 ? 3 : 2, mid = r3(L.z0 + (spring - L.z0) * 0.5), rows = Math.max(1, Math.round((mid - L.z0) / 0.34));
    horz(mid, 0.07);
    for (let k = 1; k < cols; k++) vert(r3(u0 + (L.w * k) / cols), 0.03);
    for (let k = 1; k < rows; k++) { horz(r3(L.z0 + ((mid - L.z0) * k) / rows), 0.03); horz(r3(mid + ((spring - mid) * k) / rows), 0.03); }
    // an arched head's panes: radial bars from the spring's centre
    if (L.kind === 'arch') for (let k = 1; k < 4; k++) { const a = (Math.PI * k) / 4; bar(out, W, [L.uc, spring], [L.uc + (L.w / 2 - 0.01) * Math.cos(a), spring + (L.w / 2 - 0.01) * Math.sin(a)], 0.03, d, part, value, extra); }
  } else if (glazing === 'lattice') {
    // leaded diamonds: cames at ±60° from the level, a hand apart, clipped to the light (an arch's head left plain)
    const s = 0.2, top = spring, k = Math.tan((Math.PI * 60) / 180);
    for (const sg of [1, -1]) {
      for (let c = -(top - L.z0) * 1.2; c < L.w + (top - L.z0) * 1.2; c += s) {
        // the line u = u0 + c + sg (z - z0) / k, clipped to u0–u1 (where it crosses each) and z0–top
        const uz = (z) => u0 + c + (sg * (z - L.z0)) / k, zAt = (uu) => L.z0 + sg * k * (uu - u0 - c);
        const za = Math.max(L.z0, Math.min(zAt(u0), zAt(u1))), zb = Math.min(top, Math.max(zAt(u0), zAt(u1)));
        if (zb - za > 0.03) bar(out, W, [uz(za), za], [uz(zb), zb], 0.014, d, part, value, extra);
      }
    }
  }
}

/**
 * A light's frame and glazing: `light` { kind: 'rect' | 'arch', uc, z0, w, hh, pts } (its shape's points), `spec` the
 * language's opening ({ frame, glazing, trim, trimValue }), `ctx` { sill: a sill takes the foot, extra }.
 */
export function lightDress(out, W, light, spec, { sill = false, extra = {} } = {}) {
  const group = spec.trim ?? 'str:paint', value = spec.trimValue ?? 0.85, ex = { ...extra, group };
  if (spec.frame) surround(out, W, light.pts, r3(Math.max(0.06, spec.frame * 0.9)), spec.frame, 'surround', value, ex, { open: sill });
  if (spec.glazing && spec.glazing !== 'none' && spec.glazing !== 'plate') glaze(out, W, light, spec.glazing, 0.045, spec.glazing === 'lattice' ? r3(value * 0.45) : value, ex);
}

/**
 * A door's leaf, fanlight, surround and steps: `door` { kind: 'rect' | 'door-arch', uc, w, h, pts, room } (room: the
 * height the storey leaves over it), `spec` the language's entry, `ctx` { value (the leaf's), group (the leaf's), trim,
 * trimValue, stone, stoneValue, glass, glassValue, arc, extra }. → { top: how high the doorway stands with its fanlight }.
 */
export function doorDress(out, W, door, spec, ctx) {
  const { uc, w, h } = door, u0 = uc - w / 2, u1 = uc + w / 2, ex = ctx.extra ?? {}, leafV = ctx.value ?? 0.3;
  const trim = { ...ex, group: ctx.trim ?? 'str:paint' }, trimV = ctx.trimValue ?? 0.85, stone = { ...ex, group: ctx.stone ?? 'str:stone' }, stoneV = ctx.stoneValue ?? 0.6;
  const glass = { ...ex, group: ctx.glass ?? 'str:opening' }, glassV = ctx.glassValue ?? 0.04, leaf = { ...ex, group: ctx.group ?? 'str:timber' };
  const arched = door.kind === 'door-arch', spring = arched ? h - w / 2 : h;
  // ── the leaf ──
  if (spec.leaf === 'boards') {
    for (let u = u0 + 0.14; u < u1 - 0.07; u += 0.14) bar(out, W, [u, 0.02], [u, topAt({ kind: arched ? 'arch' : 'rect', uc, z0: 0, w, hh: h }, u) - 0.02], 0.014, 0.036, 'joint', r3(leafV * 0.55), leaf);
  } else if (spec.leaf === 'panels' || spec.leaf === 'glazed') {
    // stiles and rails a tenth of a metre; two columns of panels, the top tall, the middle short, the bottom
    const m = 0.11, cw = (w - 3 * m) / 2, top = spring - m, rows = spec.leaf === 'glazed' ? [[0.12, 0.42]] : [[0.12, 0.38], [0.46, 0.58], [0.66, 1]];
    for (const [a, b] of rows) for (const c of [0, 1]) {
      const pu0 = u0 + m + c * (cw + m), z0 = r3(m + (top - m) * a), z1 = r3(m + (top - m) * b - (b < 1 ? 0.06 : 0));
      if (z1 - z0 > 0.1 && cw > 0.1) wallBox(out, W, r3(pu0), r3(pu0 + cw), z0, z1, 0.03, 0.055, 'panel', r3(Math.min(1, leafV * 1.15)), leaf, { bottom: true });
    }
    if (spec.leaf === 'glazed') {
      const L = { kind: 'rect', uc, z0: r3(m + (top - m) * 0.5), w: r3(w - 2 * m), hh: r3(top - m - (top - m) * 0.5 + m * 0.5) };
      face(out, [W.at(L.uc - L.w / 2, L.z0, 0.035), W.at(L.uc + L.w / 2, L.z0, 0.035), W.at(L.uc + L.w / 2, L.z0 + L.hh, 0.035), W.at(L.uc - L.w / 2, L.z0 + L.hh, 0.035)], W.n, 'glass', glassV, glass);
      glaze(out, W, L, 'casement', 0.045, leafV, leaf);
    }
  }
  // ── the fanlight: over a square head, a glazed transom; over any, a half-round with radial bars ──
  let top = h;
  const room = door.room ?? 0.6;
  if (spec.fanlight === 'rect' && room > 0.3) {
    const fh = r3(Math.min(0.42, room - 0.12)), L = { kind: 'rect', uc, z0: h + 0.06, w, hh: fh };
    face(out, [W.at(u0, h, 0.03), W.at(u1, h, 0.03), W.at(u1, h + 0.06 + fh, 0.03), W.at(u0, h + 0.06 + fh, 0.03)], W.n, 'transom', trimV, trim);
    face(out, [W.at(u0 + 0.04, L.z0, 0.035), W.at(u1 - 0.04, L.z0, 0.035), W.at(u1 - 0.04, L.z0 + fh - 0.04, 0.035), W.at(u0 + 0.04, L.z0 + fh - 0.04, 0.035)], W.n, 'glass', glassV, glass);
    for (let k = 1; k < 4; k++) bar(out, W, [u0 + (w * k) / 4, L.z0], [u0 + (w * k) / 4, L.z0 + fh - 0.04], 0.03, 0.045, 'glazing', trimV, trim);
    top = r3(h + 0.06 + fh);
  } else if (spec.fanlight === 'arch' && !arched && room > 0.3) {
    // a half-round where the storey has room for it, else a segment of one (its rise what the storey leaves)
    const r = w / 2, rise = r3(Math.min(r, room - 0.1)), seg = Math.max(5, ctx.arc ?? 5) + 2, z0 = h + 0.05;
    const arcPts = Array.from({ length: seg + 1 }, (_, k) => { const a = (Math.PI * k) / seg; return [uc + r * Math.cos(a), z0 + rise * Math.sin(a)]; });
    face(out, [[u1, z0], ...arcPts.slice(1, -1), [u0, z0]].map(([u, z]) => W.at(u, z, 0.035)), W.n, 'glass', glassV, glass);
    bar(out, W, [u0, h + 0.03], [u1, h + 0.03], 0.06, 0.045, 'glazing', trimV, trim);
    for (let k = 1; k < 5; k++) { const a = (Math.PI * k) / 5; bar(out, W, [uc, z0], [uc + (r - 0.02) * Math.cos(a), z0 + (rise - 0.02) * Math.sin(a)], 0.025, 0.045, 'glazing', trimV, trim); }
    door.pts = [[u0, 0], [u1, 0], [u1, z0], ...arcPts.slice(1, -1), [u0, z0]];
    top = r3(z0 + rise);
  } else if (spec.fanlight === 'rect' || spec.fanlight === 'arch') top = h;
  const pts = top > h && spec.fanlight === 'rect' ? [[u0, 0], [u1, 0], [u1, top], [u0, top]] : door.pts;
  // ── the surround ──
  if (spec.surround === 'frame') surround(out, W, pts, 0.12, 0.08, 'surround', trimV, trim);
  else if (spec.surround === 'pilasters') {
    const pw = 0.24, gap = 0.08, pl = r3(u0 - gap - pw), pr = r3(u1 + gap);
    surround(out, W, pts, 0.07, 0.05, 'surround', trimV, trim);
    wallBox(out, W, pl, r3(pl + pw), 0, top, 0, 0.1, 'pilaster', stoneV, stone);
    wallBox(out, W, pr, r3(pr + pw), 0, top, 0, 0.1, 'pilaster', stoneV, stone);
    wallBox(out, W, r3(pl - 0.06), r3(pr + pw + 0.06), top, r3(top + 0.26), 0, 0.15, 'entablature', stoneV, stone, { bottom: true });
    wallBox(out, W, r3(pl - 0.12), r3(pr + pw + 0.12), r3(top + 0.26), r3(top + 0.32), 0, 0.22, 'entablature', r3(Math.min(1, stoneV * 1.1)), stone, { bottom: true });
    top = r3(top + 0.32);
  } else if (spec.surround === 'hood') {
    surround(out, W, pts, 0.08, 0.05, 'surround', trimV, trim);
    const hu0 = r3(u0 - 0.35), hu1 = r3(u1 + 0.35), hz = r3(top + 0.14);
    wallBox(out, W, hu0, hu1, hz, r3(hz + 0.1), 0, 0.72, 'hood', stoneV, stone, { bottom: true });
    for (const bu of [hu0 + 0.06, hu1 - 0.14]) wallBox(out, W, r3(bu), r3(bu + 0.08), r3(hz - 0.42), hz, 0, 0.5, 'bracket', stoneV, stone, { bottom: true });
    top = r3(hz + 0.1);
  }
  // ── the steps: up to the threshold, out from the wall, each a tread deeper ──
  const k = Math.round(spec.steps ?? 0);
  for (let j = 0; j < k; j++) wallBox(out, W, r3(u0 - 0.3), r3(u1 + 0.3), r3(-(j + 1) * RISE), r3(-j * RISE), 0, r3((j + 1) * TREAD), 'step', stoneV, stone);
  return { top };
}
/** How far a door's steps lift its floor over the land. */
export const stepsLift = (steps) => r3(Math.round(steps ?? 0) * RISE);

/** A shutter leaf u0–u1, z0–z1, standing out of the wall, its boards or its slats marked. */
export function shutterDress(out, W, u0, u1, z0, z1, form, value, extra) {
  wallBox(out, W, u0, u1, z0, z1, 0.03, 0.07, 'shutter', value, extra, { bottom: true });
  if (form === 'louvred') for (let z = z0 + 0.1; z < z1 - 0.06; z += 0.075) bar(out, W, [u0 + 0.05, z], [u1 - 0.05, z], 0.022, 0.075, 'shutter', r3(value * 0.62), extra);
  else for (let u = u0 + 0.12; u < u1 - 0.05; u += 0.12) bar(out, W, [u, z0 + 0.03], [u, z1 - 0.03], 0.012, 0.075, 'shutter', r3(value * 0.62), extra);
}
