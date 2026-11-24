/**
 * THE BOX, DRESSED (docs/metroidvania-map.md "The castle"): a box's greybox laid over with its theme (themes.js), ring by
 * ring, as faces: what each ring is made of, what stands on its back, what lights it, and the night over its open rings.
 * The play is the greybox's: nothing here is a collider, and what is stood on is only what the greybox stands on (a
 * runner down a floor is cut round every hole in it, so a drop is never carpeted over).
 *
 *   the BACK       an open ring's the night: the sky in bands by height (one colour at one height across every room, so
 *                  rooms meet without a seam), the moon, the castle's far towers, and a parapet's merlons standing behind
 *                  the walk; a closed ring's a wall in its `back`, a pillar between its cells, its motif a cell at a time
 *                  (a pointed window of moonlit glass, or a banner)
 *   the STONE      every closed part in its ring's stone, its top coped in `top`; a wall's face coursed (its mortar every
 *                  COURSE up), a floor's and a ceiling's jointed (every JOINT across, the courses breaking bond)
 *   the RUNNER     a carpet down a ring's floors where its look has one, cut round the holes and the gates in them
 *   the LAMPS      one a cell, on its back (a torch, a candelabrum, a cold lamp) or on its floor (a brazier), drawn lit
 *   the LIGHT      baked: every face but the night's and the flames' darkened toward the ring's shadow, and warmed by each
 *                  lamp within LAMP_REACH of it in the lamp's colour, falling off with distance
 *
 *   dressBox(B, theme) → { faces, lamps: [{ at: [x, s, z], colour, kind, room }] }   B: scene.js boxOf's (layout, greybox)
 *   COURSE, JOINT, LAMP_REACH
 *
 * Pure: the same box and theme make the same faces.
 */
import { r5, hexRgb, rgbHex } from '../../era/geom.js';
import { BOX_THEMES, lookOf } from './themes.js';
import { FLOOR, CEIL, boxCameraOf } from './rooms.js';

export const COURSE = 0.8, JOINT = 1.6, LAMP_REACH = 8;
const HALF = 1.5, BACK = -3, LIT = 0.14, SKY_X = -14, TOWER_X = -12, MOON_X = -10, PARAPET_X = -2.2, SKY_BAND = 4;
const SHADOW = 0.62, WARM = 1.15;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const N = { px: [1, 0, 0], top: [0, 0, 1], ny: [0, -1, 0], py: [0, 1, 0] };
const quad = (out, corners, n, fill, group, extra) => {
  const [a, b, c] = corners, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  out.push({ corners: (dot(w, n) < 0 ? [...corners].reverse() : corners).map((p) => p.map(r5)), normal: n, fill, group, ...(extra || {}) });
};
const face = (out, x, s0, s1, z0, z1, fill, group, extra) => { if (s1 - s0 > 1e-4 && z1 - z0 > 1e-4) quad(out, [[x, s0, z0], [x, s1, z0], [x, s1, z1], [x, s0, z1]], N.px, fill, group, extra); };
const poly = (out, x, pts, fill, group, extra) => out.push({ corners: pts.map(([s, z]) => [x, s, z].map(r5)), normal: N.px, fill, group, ...(extra || {}) });
const mix = (a, b, k) => rgbHex(hexRgb(a).map((v, i) => v + (hexRgb(b)[i] - v) * k));
const shade = (hex, k) => rgbHex(hexRgb(hex).map((v) => Math.min(1, v * k)));
function block(out, s0, s1, z0, z1, L, group) {
  face(out, HALF, s0, s1, z0, Math.max(z0, z1 - LIT), L.stone, group);
  face(out, HALF, s0, s1, Math.max(z0, z1 - LIT), z1, L.top, group);
  quad(out, [[-HALF, s0, z1], [HALF, s0, z1], [HALF, s1, z1], [-HALF, s1, z1]], N.top, L.top, group);
  for (const [s, n] of [[s0, N.ny], [s1, N.py]]) quad(out, [[-HALF, s, z0], [HALF, s, z0], [HALF, s, z1], [-HALF, s, z1]], n, shade(L.stone, 0.78), group);
}
// a solid's face coursed: its mortar every COURSE up a tall face; a low one (a floor, a ceiling, a ledge) jointed across,
// each course's joints half a block on from the last's
function masonry(out, s0, s1, z0, z1, L, group) {
  const x = HALF + 0.01, h = z1 - z0 - LIT;
  if (h <= 0.3) return;
  if (h > 1.6) { for (let z = z0 + COURSE; z < z0 + h - 0.1; z += COURSE) face(out, x, s0, s1, z - 0.03, z + 0.03, L.mortar, group); return; }
  const rows = Math.max(1, Math.round(h / COURSE)), dz = h / rows;
  for (let k = 0; k < rows; k++) {
    const za = z0 + k * dz, zb = za + dz;
    if (k) face(out, x, s0, s1, za - 0.03, za + 0.03, L.mortar, group);
    for (let s = s0 + (k % 2 ? JOINT / 2 : JOINT); s < s1 - 0.2; s += JOINT) face(out, x, s - 0.03, s + 0.03, za, zb, L.mortar, group);
  }
}

/** The box dressed in its theme. */
export function dressBox(B, theme) {
  const T = typeof theme === 'string' ? BOX_THEMES[theme] : theme, { layout: L, greybox: G } = B, W = G.screen.width, H = G.screen.height;
  const rings = L.rings.length, [cols, rows] = L.box, faces = [], lamps = [], night = [], flames = [];
  const look = (ring) => lookOf(T, ring, rings), ringOf = new Map(L.rooms.map((r) => [r.id, r.ring]));
  const anyOpen = L.rooms.some((r) => look(r.ring).open);
  // THE NIGHT: the sky in bands by height, the moon, the far towers (behind every open ring; a closed ring's wall hides it)
  if (anyOpen) {
    const dist = boxCameraOf(B.stature).dist, k = (W / 2) * (-SKY_X / dist) + W, top = rows * H + k, bot = -k;
    for (let z = Math.floor(bot / SKY_BAND) * SKY_BAND; z < top; z += SKY_BAND) face(night, SKY_X, -k * 2, cols * W + k * 2, z, z + SKY_BAND + 0.01, mix(T.night.horizon, T.night.zenith, Math.min(1, Math.max(0, z / (rows * H)))), 'box:night');
    // (the moon in the frame of the box's top far corner: placed where the camera there sees it on the sky, by its parallax,
    // a little up and in from the frame's middle)
    const M = T.night.moon, par = (dist - MOON_X) / dist, cs = (cols - 0.5) * W, cz = (rows - 0.5) * H;
    const ms = cs - 0.2 * W * par, mz = cz + 0.24 * H * par, mr = M.r * par;
    // (the moon well in front of the sky, its halo just behind it, each a fan of triangles: the page draws a face of a few
    // corners, not a sixteen-sided one, and lays the sky's bands over what stands close behind them)
    const disc = (x, r, fill) => { for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8, b = ((i + 1) * Math.PI) / 8; poly(night, x, [[ms, mz], [ms + r * Math.cos(a), mz + r * Math.sin(a)], [ms + r * Math.cos(b), mz + r * Math.sin(b)]], fill, 'box:night'); } };
    disc(MOON_X, mr, M.colour);
    disc(MOON_X - 0.4, mr * 1.3, mix(T.night.horizon, M.colour, 0.16));
    // (the far towers: the castle's own skyline beyond its walls, tall and thin, their roofs pointed)
    // (low on the horizon, slim and spaced, a little darker than the sky behind them: a skyline, never a curtain)
    for (let i = 0, s = -W * 0.5; s < cols * W + W * 0.5; i++) {
      const w = 2.5 + ((i * 7) % 4) * 0.6, h = 4 + ((i * 37) % 11), roof = w * 1.6;
      poly(night, TOWER_X, [[s, -k], [s + w, -k], [s + w, h], [s + w / 2, h + roof], [s, h]], T.night.towers, 'box:night');
      if (i % 3 === 1) face(night, TOWER_X + 0.02, s + w * 0.4, s + w * 0.6, h - 3, h - 1.8, '#d9a35a', 'box:night');   // (a lit window)
      s += w + 9 + ((i * 13) % 11);
    }
  }
  // THE BACKS, a room at a time, a cell at a time
  for (const r of L.rooms) {
    const Lk = look(r.ring), [c, rr, w, h] = r.rect;
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
      const s0 = (c + i) * W, s1 = s0 + W, z0 = (rr + j) * H, z1 = z0 + H, floor = z0 + FLOOR, mid = (s0 + s1) / 2;
      if (Lk.open) {
        // (an open cell: a parapet behind the walk at its floor, merlons along its top; the night beyond)
        if (j === 0) {
          face(faces, PARAPET_X, s0, s1, z0, floor + 1.3, Lk.stone, 'box:parapet');
          face(faces, PARAPET_X + 0.01, s0, s1, floor + 1.15, floor + 1.3, Lk.top, 'box:parapet');
          for (let s = s0 + 0.6; s < s1 - 1; s += 2.2) face(faces, PARAPET_X, s, s + 1.2, floor + 1.3, floor + 2.2, Lk.stone, 'box:parapet');
        }
      } else {
        face(faces, BACK, s0, s1, z0, z1, Lk.back, 'box:back');
        face(faces, BACK + 0.01, s0, s0 + 0.9, z0, z1, shade(Lk.back, 0.78), 'box:back');   // (a pillar between cells)
        if (Lk.motif === 'arches') {
          // (a window as tall as the wall allows, its point under the ceiling: a room is a screen high, the hero's frame)
          const aw = 3.2, a0 = floor + 2.6, a1 = Math.min(z1 - CEIL - aw * 0.85 - 0.9, floor + 8.5);
          for (const at of [mid - W * 0.22, mid + W * 0.22]) {
            poly(faces, BACK + 0.02, [[at - aw / 2 - 0.35, a0 - 0.35], [at + aw / 2 + 0.35, a0 - 0.35], [at + aw / 2 + 0.35, a1], [at, a1 + aw * 0.85 + 0.45], [at - aw / 2 - 0.35, a1]], Lk.trim, 'box:back');
            poly(faces, BACK + 0.03, [[at - aw / 2, a0], [at + aw / 2, a0], [at + aw / 2, a1], [at, a1 + aw * 0.85], [at - aw / 2, a1]], Lk.glass, 'box:glass');
            face(faces, BACK + 0.04, at - 0.06, at + 0.06, a0, a1 + aw * 0.8, Lk.trim, 'box:back');   // (its mullion)
          }
        } else if (Lk.motif === 'banners') {
          for (const at of [mid - W * 0.25, mid + W * 0.25]) {
            const b1 = z1 - CEIL - 0.8, b0 = Math.max(floor + 3, b1 - 7);
            poly(faces, BACK + 0.02, [[at - 1, b1], [at + 1, b1], [at + 1, b0], [at, b0 - 0.9], [at - 1, b0]], Lk.carpet, 'box:back');
            face(faces, BACK + 0.03, at - 1, at + 1, b1 - 0.18, b1, Lk.trim, 'box:back');
            face(faces, BACK + 0.03, at - 0.12, at + 0.12, b0 + 1, b1 - 1, Lk.trim, 'box:back');
          }
        }
      }
      // THE LAMPS: one a cell on its back (a brazier on its floor)
      const kind = Lk.lamp.kind, ls = mid + (Lk.open ? 0 : -W * 0.02), lz = kind === 'brazier' ? floor + 1.1 : floor + 3.6;
      const lx = Lk.open ? PARAPET_X + 0.05 : BACK + 0.05;
      if (j === 0 || kind !== 'brazier') {
        lamps.push({ at: [lx, ls, lz], colour: Lk.lamp.colour, kind, room: r.id });
        if (kind === 'torch') { face(faces, lx, ls - 0.12, ls + 0.12, lz - 1.1, lz - 0.1, '#2a2420', 'box:lamp'); face(flames, lx + 0.02, ls - 0.22, ls + 0.22, lz - 0.1, lz + 0.5, Lk.lamp.colour, 'box:flame'); }
        if (kind === 'candles') { face(faces, lx, ls - 0.08, ls + 0.08, lz - 1.6, lz - 0.2, Lk.trim, 'box:lamp'); face(faces, lx, ls - 0.9, ls + 0.9, lz - 0.3, lz - 0.2, Lk.trim, 'box:lamp'); for (const d of [-0.8, 0, 0.8]) face(flames, lx + 0.02, ls + d - 0.08, ls + d + 0.08, lz - 0.2, lz + 0.15, Lk.lamp.colour, 'box:flame'); }
        if (kind === 'ghost') { face(faces, lx, ls - 0.35, ls + 0.35, lz - 0.45, lz + 0.35, shade(Lk.trim, 0.8), 'box:lamp'); face(flames, lx + 0.02, ls - 0.22, ls + 0.22, lz - 0.3, lz + 0.2, Lk.lamp.colour, 'box:flame'); }
        if (kind === 'brazier') { const bx = BACK + 0.6; face(faces, bx, ls - 0.15, ls + 0.15, floor, lz - 0.3, '#2a2022', 'box:lamp'); face(faces, bx, ls - 0.6, ls + 0.6, lz - 0.4, lz, '#3a2a26', 'box:lamp'); face(flames, bx + 0.02, ls - 0.5, ls + 0.5, lz, lz + 0.7, Lk.lamp.colour, 'box:flame'); }
      }
    }
  }
  // THE STONE: every closed part in its ring's stone, coped, coursed or jointed
  for (const s of G.solids) {
    const Lk = look(ringOf.get(s.room) ?? 0), low = s.role === 'ledge' || s.role === 'lip';
    const own = low ? { ...Lk, stone: mix(Lk.stone, Lk.top, 0.35) } : Lk;
    block(faces, s.s0, s.s1, s.z0, s.z1, own, low ? 'box:ledge' : 'box:stone');
    if (!low) masonry(faces, s.s0, s.s1, s.z0, s.z1, own, 'box:stone');
    // (a trim band under every floor's lip toward the room)
    if (s.role === 'floor' && s.z1 - s.z0 > 0.5) face(faces, HALF + 0.015, s.s0, s.s1, s.z1 - LIT - 0.18, s.z1 - LIT, Lk.trim, 'box:stone');
  }
  // THE RUNNER: down the floors of a ring whose look has one, cut round every hole and every gate in them
  // (a gate in a floor stands in its hole: the holes are every cut)
  const cuts = G.holes.map((h) => ({ s0: h.s0 - 0.2, s1: h.s1 + 0.2, z: h.z }));
  for (const r of L.rooms) {
    const Lk = look(r.ring);
    if (!Lk.carpet) continue;
    const [c, rr, w] = r.rect, z = rr * H + FLOOR, s0 = c * W + 1.2, s1 = (c + w) * W - 1.2;
    const here = cuts.filter((q) => Math.abs(q.z - rr * H) < 1e-3 && q.s1 > s0 && q.s0 < s1).sort((a, b) => a.s0 - b.s0);
    let at = s0;
    for (const q of [...here, { s0: s1, s1 }]) {
      if (q.s0 - at > 0.5) quad(faces, [[-0.9, at, z + 0.02], [0.9, at, z + 0.02], [0.9, q.s0, z + 0.02], [-0.9, q.s0, z + 0.02]], N.top, Lk.carpet, 'box:runner');
      at = Math.max(at, q.s1);
    }
  }
  // THE LIGHT, baked: each face into its ring's shadow, then warmed by the lamps near it
  const byCell = new Map();
  for (const l of lamps) { const k = `${Math.floor(l.at[1] / W)},${Math.floor(l.at[2] / H)}`; (byCell.get(k) ?? byCell.set(k, []).get(k)).push(l); }
  const lit = (f) => {
    const n = f.corners.length, cx = f.corners.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n, a[2] + p[2] / n], [0, 0, 0]);
    const cs = Math.floor(cx[1] / W), cz = Math.floor(cx[2] / H), add = [0, 0, 0];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const l of byCell.get(`${cs + i},${cz + j}`) ?? []) {
      const d = Math.hypot(cx[1] - l.at[1], cx[2] - l.at[2], (cx[0] - l.at[0]) * 0.5);
      if (d >= LAMP_REACH) continue;
      const k = (1 - d / LAMP_REACH) ** 2 * WARM, c = hexRgb(l.colour);
      for (let q = 0; q < 3; q++) add[q] += k * c[q];
    }
    const base = hexRgb(f.fill), top = f.normal[2] > 0.5 ? 1.12 : 1;
    return { ...f, fill: rgbHex(base.map((v, q) => Math.min(1, v * (SHADOW * top + add[q])))) };
  };
  return { faces: [...night, ...faces.map(lit), ...flames], lamps };
}
