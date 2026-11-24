/**
 * THE BOX, DRESSED (docs/metroidvania-map.md "The castle"): a box's greybox laid over with its theme (themes.js), ring by
 * ring, as faces: what each ring is made of, what stands on its back, what lights it, and the night over its open rings.
 * The play is the greybox's: nothing here is a collider, and what is stood on is only what the greybox stands on (a
 * runner down a floor is cut round every hole in it, so a drop is never carpeted over).
 *
 *   the BACK       an open ring's the night: the sky in bands by height (one colour at one height across every room, so
 *                  rooms meet without a seam), the moon, the castle's far towers, and a parapet's merlons standing behind
 *                  the walk; a closed ring's composed by the backdrop's craft (backdrop.js): an ashlar wall (each block its
 *                  own stone, so a lamp's pool lands on it), a wainscot and its rail, a pillar between cells, its ceiling's
 *                  vault or beams, cobwebs in its top corners, its bays by the wall's rhythm and one focal piece a room,
 *                  the near layer (a column, a chain) between the lane and the wall
 *   the STONE      every closed part in its ring's stone, its top coped in `top`; a wall's face coursed (its mortar every
 *                  COURSE up), a floor's and a ceiling's jointed (every JOINT across, the courses breaking bond)
 *   the RUNNER     a carpet down a ring's floors where its look has one, cut round the holes and the gates in them
 *   the LAMPS      one a bay, on its back (a torch, a sconce of candles, a cold lamp) or on its floor (a brazier), drawn
 *                  lit, each flame haloed (GLOW: the page's glow sprites)
 *   the LIGHT      baked: every face but the night's and the flames' darkened to its ring's `dark`, and warmed by each
 *                  lamp within its `reach` in the lamp's colour, falling off with distance: pools in the dark
 *   the DUST       hanging in the closed rooms, lit where the lamps are (MOTES: the page's motes)
 *
 *   dressBox(B, theme) → { faces, lamps: [{ at: [x, s, z], colour, kind, room, reach }], plan: { <room>: { order, focals,
 *                  near, through, open } }, sizes: { <part>: [least, most] }, motes?, glow }   B: scene.js boxOf's
 *                  (layout, greybox); sizes the drawn parts' measures (backdrop.js SCALE)
 *   COURSE, JOINT, LAMP_REACH, ASHLAR, WAINSCOT, MOTES, GLOW
 *
 * Pure: the same box and theme make the same faces.
 */
import { r5, hexRgb, rgbHex } from '../../era/geom.js';
import { BOX_THEMES, lookOf } from './themes.js';
import { FLOOR, CEIL, boxCameraOf } from './rooms.js';
import { composeRoom, drawPiece, diceOf, measure } from './backdrop.js';

export const COURSE = 0.8, JOINT = 1.6, LAMP_REACH = 8;
/** a back wall's ashlar block, [wide, high] (m): small enough that a lamp's pool is drawn on it, block by block */
export const ASHLAR = Object.freeze([1.6, 0.8]);
/** a wainscot's panel along the floor (m): wide, so the band behind the play stays calm (backdrop.js calm-play) */
export const WAINSCOT = 4.8;
/** the dust in the closed rooms (the page's motes) and the flames' halos (the page's glow sprites) */
export const MOTES = Object.freeze({ count: 2400, color: Object.freeze([1, 0.84, 0.6]), size: 0.035, drift: 0.22 });
export const GLOW = Object.freeze({ scale: 0.3, opacity: 0.8 });
const HALF = 1.5, BACK = -3, NEAR_X = -2.3, NEAR_SHADE = 0.55, LIT = 0.14, SKY_X = -14, TOWER_X = -12, MOON_X = -10, PARAPET_X = -2.2, SKY_BAND = 4;
const SHADOW = 0.62, WARM = 1.5;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const N = { px: [1, 0, 0], top: [0, 0, 1], ny: [0, -1, 0], py: [0, 1, 0] };
const quad = (out, corners, n, fill, group, extra) => {
  const [a, b, c] = corners, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  out.push({ corners: (dot(w, n) < 0 ? [...corners].reverse() : corners).map((p) => p.map(r5)), normal: n, fill, group, ...(extra || {}) });
};
const face = (out, x, s0, s1, z0, z1, fill, group, extra) => { if (s1 - s0 > 1e-4 && z1 - z0 > 1e-4) quad(out, [[x, s0, z0], [x, s1, z0], [x, s1, z1], [x, s0, z1]], N.px, fill, group, extra); };
// a flame: pointed, its tip up (the page halos one with a glow marker: its first four corners its middle)
const flame = (out, x, s, w, z0, z1, fill, extra) => out.push({ corners: [[s - w, z0], [s + w, z0], [s + w, z0 + (z1 - z0) * 0.55], [s, z1], [s - w, z0 + (z1 - z0) * 0.55]].map(([a, b]) => [x, a, b].map(r5)), normal: N.px, fill, group: 'box:flame', ...(extra || {}) });
const poly = (out, x, pts, fill, group, extra) => out.push({ corners: pts.map(([s, z]) => [x, s, z].map(r5)), normal: N.px, fill, group, ...(extra || {}) });
const bar = (out, x, a, b, w, fill, group = 'box:dress') => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * (w / 2), nz = (dx / l) * (w / 2); poly(out, x, [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]], fill, group); };
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
  const cellRing = new Map(L.rooms.flatMap((r) => r.cells.map((c) => [`${c[0]},${c[1]}`, r.ring])));
  const ringAt = (s, z) => cellRing.get(`${Math.floor(s / W)},${Math.floor(z / H)}`) ?? 0;
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
  // THE BACKS, a room at a time, a cell at a time (backdrop.js: the backdrop's craft)
  const plan = {}, sizes = {};
  measure(sizes, 'block.w', ASHLAR[0] - 0.05); measure(sizes, 'block.h', ASHLAR[1] - 0.05);
  for (const r of L.rooms) {
    const Lk = look(r.ring), [c, rr, w, h] = r.rect, C = composeRoom(r, Lk), dice = diceOf(r.id);
    const P = plan[r.id] = { order: C.order, focals: 0, near: false, through: !!Lk.open, open: !!Lk.open };
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
      const s0 = (c + i) * W, s1 = s0 + W, z0 = (rr + j) * H, z1 = z0 + H, floor = z0 + FLOOR, top = z1 - CEIL, mid = (s0 + s1) / 2;
      if (Lk.open) {
        // (an open cell: a parapet behind the walk at its floor, merlons along its top; the night beyond)
        if (j === 0) {
          face(faces, PARAPET_X, s0, s1, z0, floor + 1.3, Lk.stone, 'box:parapet');
          face(faces, PARAPET_X + 0.01, s0, s1, floor + 1.15, floor + 1.3, Lk.top, 'box:parapet');
          for (let s = s0 + 0.6; s < s1 - 1; s += 2.2) face(faces, PARAPET_X, s, s + 1.2, floor + 1.3, floor + 2.2, Lk.stone, 'box:dress');
          if (i === C.focal.cell) { drawPiece(faces, Lk.focal, { s: s0 + W * (C.focal.bay ? 0.75 : 0.25), floor, top, x: PARAPET_X + 0.02, focal: true }, Lk, dice, sizes); P.focals++; }
        }
      } else {
        // (1) THE WALL: ashlar in courses, each block its own stone, its joints breaking bond course to course
        for (let k = 0, z = z0; z < z1 - 1e-3; k++, z += ASHLAR[1]) {
          for (let s = s0 - (k % 2 ? ASHLAR[0] / 2 : 0); s < s1 - 1e-3; s += ASHLAR[0]) {
            const a = Math.max(s0, s), b = Math.min(s1, s + ASHLAR[0]);
            face(faces, BACK, a, b - 0.05, z, Math.min(z1, z + ASHLAR[1]) - 0.05, shade(Lk.back, 0.94 + dice() * 0.12), 'box:back');
          }
        }
        face(faces, BACK - 0.01, s0, s1, z0, z1, shade(Lk.back, 0.6), 'box:joint');   // (the mortar behind the blocks)
        // (structure: a pillar at the cell's edge, a plinth or a wainscot along its floor, cobwebs in its top corners)
        face(faces, BACK + 0.01, s0, s0 + 0.9, z0, z1, shade(Lk.back, 0.72), 'box:dress');
        // (its floor's dado on the room's floor alone; a storey over it marked by a string course at its line)
        if (j > 0) face(faces, BACK + 0.015, s0 + 0.9, s1, z0 + 0.2, z0 + 0.5, shade(Lk.stone, 0.7), 'box:dress');
        else if (Lk.dado === 'wainscot') {
          for (let s = s0 + 0.9, n = 0; s < s1 - 0.5; s += WAINSCOT, n++) face(faces, BACK + 0.015, s, Math.min(s1, s + WAINSCOT) - 0.1, floor, floor + 1.4, shade(Lk.trim, n % 2 ? 0.55 : 0.6), 'box:dress');
          face(faces, BACK + 0.02, s0, s1, floor + 1.4, floor + 1.55, shade(Lk.trim, 0.8), 'box:dress');   // (its rail)
        } else face(faces, BACK + 0.015, s0 + 0.9, s1, floor, floor + 0.7, shade(Lk.stone, 0.62), 'box:dress');   // (a plain plinth)
        for (const [cs, dir] of [[s0 + 0.9, 1], [s1, -1]]) poly(faces, BACK + 0.02, [[cs, top], [cs + dir * (0.9 + dice() * 0.8), top], [cs, top - 0.8 - dice() * 0.7]], '#6d6a6e', 'box:dress');
        // (the ceiling's structure, a bay at a time)
        for (const b of [0, 1]) {
          const a = s0 + b * W / 2, z = top;
          if (Lk.ceiling === 'vault') {
            const boss = [a + W / 4, z - 0.2];
            bar(faces, BACK + 0.02, [a + 0.5, z - 2.6], boss, 0.22, shade(Lk.top, 0.75)); bar(faces, BACK + 0.02, [a + W / 2 - 0.5, z - 2.6], boss, 0.22, shade(Lk.top, 0.75));
            face(faces, BACK + 0.03, boss[0] - 0.25, boss[0] + 0.25, z - 0.5, z - 0.05, Lk.trim, 'box:dress');
            face(faces, BACK + 0.02, a + 0.2, a + 0.9, z - 2.9, z - 2.4, shade(Lk.top, 0.7), 'box:dress');   // (a corbel)
          } else if (Lk.ceiling === 'beams') {
            face(faces, BACK + 0.02, a, a + W / 2, z - 0.7, z - 0.1, '#3a2a1e', 'box:dress');
            bar(faces, BACK + 0.03, [a + 0.6, z - 2.2], [a + 1.8, z - 0.7], 0.2, '#33251a');
          }
        }
        // (4) THE BAYS by the wall's rhythm, the focal piece in its bay
        for (const b of [0, 1]) {
          const at = { s: s0 + W * (b ? 0.75 : 0.25), floor, top, x: BACK + 0.04 }, letter = C.order[(i * 2 + b) % C.order.length];
          if (j === 0 && i === C.focal.cell && b === C.focal.bay && P.focals === 0) { drawPiece(faces, Lk.focal, { ...at, focal: true }, Lk, dice, sizes); P.focals++; }
          else drawPiece(faces, Lk.bays[letter === 'B' ? 1 : 0], at, Lk, dice, sizes);
          if ((letter === 'A' ? Lk.bays[0] : Lk.bays[1]) === 'arch') P.through = true;
          // (a lancet: a slit of moonlit glass high over the bay's piece, where the wall has no window)
          if (Lk.lancets && !(j === 0 && i === C.focal.cell && b === C.focal.bay)) { const ls = at.s, l1 = top - 1.0, l0 = l1 - 2.2; face(faces, BACK + 0.03, ls - 0.45, ls + 0.45, l0 - 0.15, l1, Lk.trim, 'box:dress'); poly(faces, BACK + 0.04, [[ls - 0.3, l0], [ls + 0.3, l0], [ls + 0.3, l1 - 0.5], [ls, l1 - 0.1], [ls - 0.3, l1 - 0.5]], '#5a6f9e', 'box:glass'); P.through = true; }
        }
        // (5) THE NEAR LAYER: between the lane and the wall, at the bays' meeting
        if (Lk.near === 'column') {
          const x = NEAR_X, cs = mid;
          // (the near layer stands between the lane and the light: half a silhouette, never brighter than the lane)
          const st = shade(Lk.stone, NEAR_SHADE);
          face(faces, x, cs - 0.75, cs + 0.75, floor, floor + 0.6, shade(st, 0.85), 'box:dress');
          face(faces, x, cs - 0.5, cs + 0.5, floor + 0.6, top - 0.8, st, 'box:dress');
          face(faces, x, cs - 0.8, cs + 0.8, top - 0.8, top, shade(Lk.top, NEAR_SHADE), 'box:dress');
          P.near = true;
        } else if (Lk.near === 'chain') {
          for (let z = top, k = 0; z > top - 4.2; z -= 0.45, k++) face(faces, NEAR_X, mid - (k % 2 ? 0.06 : 0.14), mid + (k % 2 ? 0.06 : 0.14), z - 0.4, z, '#3e3b3a', 'box:dress');
          poly(faces, NEAR_X, [[mid - 0.3, top - 4.3], [mid + 0.3, top - 4.3], [mid, top - 4.8]], '#3e3b3a', 'box:dress');
          P.near = true;
        }
      }
      // THE LAMPS: one a bay, left of its piece (a brazier on the floor; on an open ring, a torch on the parapet)
      for (const b of Lk.open ? [0] : [0, 1]) {
        // (a brazier stands on the room's floor; a storey above it is lit by torches on its wall)
        const kind = Lk.lamp.kind === 'brazier' && j > 0 ? 'torch' : Lk.lamp.kind, ls = Lk.open ? mid : s0 + W * (b ? 0.75 : 0.25) - 3.4, lz = kind === 'brazier' ? floor + 1.1 : floor + 3.6;
        const lx = Lk.open ? PARAPET_X + 0.05 : BACK + 0.06;
        if (Lk.open && j !== 0) continue;
        lamps.push({ at: [lx, ls, lz], colour: Lk.lamp.colour, kind, room: r.id, reach: Lk.lamp.reach });
        const glow = { glow: `0 0 6px 2px ${Lk.lamp.colour}` };
        if (kind === 'torch') { face(faces, lx, ls - 0.12, ls + 0.12, lz - 1.1, lz - 0.1, '#2a2420', 'box:lamp'); flame(flames, lx + 0.02, ls, 0.22, lz - 0.1, lz + 0.6, Lk.lamp.colour, glow); }
        if (kind === 'candles') { face(faces, lx, ls - 0.04, ls + 0.04, lz - 0.6, lz - 0.2, Lk.trim, 'box:lamp'); face(faces, lx, ls - 0.32, ls + 0.32, lz - 0.24, lz - 0.18, Lk.trim, 'box:lamp'); measure(sizes, 'candle.h', 0.24); for (const d of [-0.26, 0, 0.26]) { face(faces, lx + 0.01, ls + d - 0.035, ls + d + 0.035, lz - 0.18, lz + (d ? 0.0 : 0.06), '#e8dcc0', 'box:lamp'); flame(flames, lx + 0.02, ls + d, 0.045, lz + (d ? 0.0 : 0.06), lz + (d ? 0.16 : 0.24), Lk.lamp.colour, d ? {} : glow); } }
        if (kind === 'ghost') { face(faces, lx, ls - 0.35, ls + 0.35, lz - 0.45, lz + 0.35, shade(Lk.trim, 0.8), 'box:lamp'); face(flames, lx + 0.02, ls - 0.22, ls + 0.22, lz - 0.3, lz + 0.2, Lk.lamp.colour, 'box:flame', glow); }
        if (kind === 'brazier') { const bx = NEAR_X + 0.1; face(faces, bx, ls - 0.1, ls + 0.1, floor, lz - 0.3, '#2a2022', 'box:lamp'); face(faces, bx, ls - 0.42, ls + 0.42, lz - 0.38, lz, '#3a2a26', 'box:lamp'); flame(flames, bx + 0.02, ls, 0.32, lz, lz + 0.65, Lk.lamp.colour, glow); }
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
      const d = Math.hypot(cx[1] - l.at[1], cx[2] - l.at[2], (cx[0] - l.at[0]) * 0.5), R = l.reach || LAMP_REACH;
      if (d >= R) continue;
      const k = (1 - d / R) ** 2 * WARM, c = hexRgb(l.colour);
      for (let q = 0; q < 3; q++) add[q] += k * c[q];
    }
    // (6) its ring's dark where no lamp reaches: the room's own look (a cell is a ring's), the tops a little above it
    const Lk = look(ringAt(cx[1], cx[2])), base = hexRgb(f.fill), top = f.normal[2] > 0.5 ? 1.12 : 1;
    return { ...f, fill: rgbHex(base.map((v, q) => Math.min(1, v * ((Lk.dark ?? SHADOW) * top + add[q])))) };
  };
  // (7) DUST hanging in the light of the closed rooms (the page's motes), lit by every lamp near it
  const closed = L.rooms.filter((r) => !look(r.ring).open);
  const motes = closed.length ? { count: MOTES.count, boxes: closed.map((r) => [-2.9, r.rect[0] * W, r.rect[1] * H + FLOOR, 1.2, (r.rect[0] + r.rect[2]) * W, (r.rect[1] + r.rect[3]) * H - CEIL].map(r5)),
    lights: lamps.filter((l) => !look(ringOf.get(l.room)).open).map((l) => [l.at[0], l.at[1], l.at[2], (l.reach || LAMP_REACH) * 0.8].map(r5)), color: MOTES.color, size: MOTES.size, drift: MOTES.drift } : null;
  return { faces: [...night, ...faces.map(lit), ...flames], lamps, plan, sizes, ...(motes ? { motes } : {}), glow: GLOW };
}
