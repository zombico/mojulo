/**
 * THE CASTLE'S FABRIC (docs/metroidvania-map.md "The castle's fabric"): the box's closed parts built as what each one is,
 * where the greybox only says where they stand. The backdrop's craft (backdrop.js) dresses what is behind the play; this
 * builds what the play stands on, runs into and passes through, which the play's camera frames on every screen: the floor
 * along its foot, the ceiling along its head, a wall at each side, the ledges between.
 *
 *   a PATH          a floor's top laid in its material by the room's look (`path`: PATHS): flagstones, boards, a checker
 *                   of tiles, the rock's own beds; each stone or board its own length and its own shade, over the mortar
 *                   between them; its front a lit tread, a string course under it (a board floor's beam), coursed stone
 *                   below; the path lighter than the slab's face, so the walk reads first
 *   a CEILING       a cornice along its foot and a corbel table hanging under it; out under the sky a timber hoarding (a
 *                   covered wall-walk); at the box's top, machicolations (the crown's parapet on its corbels)
 *   a WALL          quoined: each course one stone or two, alternately, a plinth at its foot and an impost under the
 *                   ceiling; a string course at every storey it rises through (a shaft's walls are a tower's)
 *   a TOWER         a shaft's wall on the box's edge: an arrow slit each storey, a sliver of the night in it
 *   a DOORWAY       made, never a bare gap: a segmental arch in its head (voussoirs and a keystone, the spandrels filling
 *                   its corners), a threshold across its foot, and the passage's far reveal seen through it; the box's
 *                   entry the same, its gate
 *   a HOLE          framed: rim stones either side of it through the slab, the slab's far reveal seen through the cut
 *   a LEDGE         by the room's look (`ledge`: LEDGES): a slab of two stones chamfered under, a timber platform of boards
 *                   on a beam strapped in iron and hung on rods from what is over it, an iron catwalk grated on a truss
 *   the WEATHER     out under the sky the stone wears: moss along its treads and down its joints, damp streaking its
 *                   face; inside it is clean
 *   the CROWN       along the box's top: a parapet and its merlons, a bartizan every few screens, a tower over each top
 *                   corner under a conical roof (seen in the castle's whole view, never from the play's frame)
 *   the FOUNDATION  under the box: a battered plinth on a crag of rock
 *
 *   buildFabric(out, { greybox, layout, theme, lookRoom, cols, rows }) → { built, doorways, holes, slits, paths, crown,
 *                   foundation }: its faces pushed onto `out` (lit by the dress's light like any other), and what it built
 *                   for the laws: each solid's index and kind, each doorway's and hole's making, each tower's slits, each
 *                   floor's path and face
 *   fabricLaws(B, fabric) → [{ id, holds, says, rooms? }]   built · doorways-made · holes-framed · paths-read ·
 *                   towers-slit · crowned
 *   PATHS, LEDGES, WOOD, IRON, MOSS, FABRIC
 *
 * Pure: the same box and theme make the same faces. Nothing here is a collider: what is stood on is the greybox's.
 */
import { r5, hexRgb, rgbHex } from '../../era/geom.js';
import { diceOf, measure } from './backdrop.js';
import { FLOOR, CEIL, WALL } from './rooms.js';

/** THE PATHS a floor is laid in (a look's `path`): its pieces' lengths along the walk, its rows across it, how far a
 * piece's shade strays from the next */
export const PATHS = Object.freeze({
  flags: Object.freeze({ says: 'flagstones in two rows across the walk, each its own length and stone', long: Object.freeze([0.9, 1.7]), rows: 2, vary: 0.16 }),
  boards: Object.freeze({ says: 'boards along the walk on a beam, their butts staggered', long: Object.freeze([1.8, 3.4]), rows: 6, vary: 0.2, wood: true }),
  tiles: Object.freeze({ says: 'tiles in a checker of two tones', long: Object.freeze([0.75, 0.75]), rows: 4, vary: 0.04, checker: true }),
  rock: Object.freeze({ says: "the rock's own beds, worn smooth where she walks", long: Object.freeze([0.7, 2.4]), rows: 3, vary: 0.32 }),
});
/** THE LEDGES a room's stair is built of (a look's `ledge`) */
export const LEDGES = Object.freeze({
  stone: 'a slab of two stones, chamfered under, coped in the look\'s top',
  timber: 'a platform of boards on a beam, strapped in iron, hung on rods from what is over it',
  iron: 'a grated catwalk, its rail riveted, on a truss',
});
/** timber's and iron's own colours (a stone's are its look's) */
export const WOOD = Object.freeze({ top: '#a4825a', face: '#523a26', beam: '#3e2c1e' });
export const IRON = Object.freeze({ dark: '#34363e', light: '#9a9ea8' });
export const MOSS = '#5a7040';
/** THE FABRIC'S MEASURES (m): the tread's lit edge, a string course, the corbel table (every, wide, hanging), a quoin's
 * course, a wall's plinth and impost, an arrow slit (wide, tall, its middle above the storey's floor), a doorway's arch
 * (its rise in the head, its ring of voussoirs), the joint between pieces; and how much lighter a path is than its slab's
 * face (`pathReads`, as a ratio of their luminance) */
export const FABRIC = Object.freeze({
  tread: 0.14, string: 0.16, corbel: Object.freeze({ every: 1.3, w: 0.34, hang: 0.34 }), quoin: 0.8, plinth: 0.9, impost: 0.3,
  slit: Object.freeze({ w: 0.12, h: 1.5, at: 4.2 }), arch: Object.freeze({ rise: 0.6, ring: 0.42 }), gap: 0.04, pathReads: 1.2,
});

const HALF = 1.5, BACK = -3, F = HALF + 0.008, F2 = HALF + 0.016, F3 = HALF + 0.024;
const N = { px: [1, 0, 0], top: [0, 0, 1], ny: [0, -1, 0], py: [0, 1, 0], nx: [-1, 0, 0] };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const quad = (out, corners, n, fill, group, extra) => {
  const [a, b, c] = corners, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  out.push({ corners: (dot(w, n) < 0 ? [...corners].reverse() : corners).map((p) => p.map(r5)), normal: n, fill, group, ...(extra || {}) });
};
const face = (out, x, s0, s1, z0, z1, fill, group = 'box:stone', extra) => { if (s1 - s0 > 1e-4 && z1 - z0 > 1e-4) quad(out, [[x, s0, z0], [x, s1, z0], [x, s1, z1], [x, s0, z1]], N.px, fill, group, extra); };
const top = (out, z, x0, x1, s0, s1, fill, group = 'box:stone') => { if (s1 - s0 > 1e-4 && x1 - x0 > 1e-4) quad(out, [[x0, s0, z], [x1, s0, z], [x1, s1, z], [x0, s1, z]], N.top, fill, group); };
const poly = (out, x, pts, fill, group = 'box:stone', extra) => out.push({ corners: pts.map(([s, z]) => [x, s, z].map(r5)), normal: N.px, fill, group, ...(extra || {}) });
const bar = (out, x, a, b, w, fill, group = 'box:stone', extra) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * (w / 2), nz = (dx / l) * (w / 2); poly(out, x, [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]], fill, group, extra); };
const mix = (a, b, k) => rgbHex(hexRgb(a).map((v, i) => v + (hexRgb(b)[i] - v) * k));
const shade = (hex, k) => rgbHex(hexRgb(hex).map((v) => Math.min(1, v * k)));
const lum = (hex) => { const c = hexRgb(hex).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const near = (a, b) => Math.abs(a - b) < 1e-3;

/** stones laid on a face between s0 and s1, z0 and z1: `n` courses (or as many as `course` m fit), each stone its own
 * length in `long` and its own shade of `fill`, the courses breaking bond, the mortar `under` them */
function stones(out, x, s0, s1, z0, z1, { course, long, fill, under, vary = 0.14, d, group = 'box:stone', sizes, gap = FABRIC.gap }) {
  if (s1 - s0 < 0.05 || z1 - z0 < 0.05) return;
  face(out, x - 0.004, s0, s1, z0, z1, under, 'box:mortar');
  const n = Math.max(1, Math.round((z1 - z0) / course)), dz = (z1 - z0) / n;
  measure(sizes, 'block.h', dz - gap);
  for (let k = 0; k < n; k++) {
    const za = z0 + k * dz, zb = za + dz;
    for (let s = s0 - (k % 2 ? long[0] / 2 : 0) - d() * 0.3; s < s1 - 1e-3;) {
      const len = long[0] + d() * (long[1] - long[0]), a = Math.max(s0, s), b = Math.min(s1, s + len);
      if (b - a > 0.08) face(out, x, a + (a > s0 ? gap / 2 : 0), b - (b < s1 ? gap / 2 : 0), za + (k ? gap / 2 : 0), zb - (k < n - 1 ? gap / 2 : 0), shade(fill, 1 - vary / 2 + d() * vary), group, { pillow: 0.35 });
      s += len;
    }
  }
}
/** a solid's ends, turned to either side */
function ends(out, s0, s1, z0, z1, fill) {
  for (const [s, n] of [[s0, N.ny], [s1, N.py]]) quad(out, [[-HALF, s, z0], [HALF, s, z0], [HALF, s, z1], [-HALF, s, z1]], n, shade(fill, 0.78), 'box:stone');
}

/** The box's closed parts built as what each one is (see the header). */
export function buildFabric(out, { greybox: G, layout: L, theme: T, lookRoom, cols, rows, sizes }) {
  const W = G.screen.width, H = G.screen.height, boxTop = rows * H, boxEnd = cols * W, room = new Map(L.rooms.map((r) => [r.id, r]));
  const built = [], doorways = [], holes = [], slits = {}, paths = [];
  const nightIn = mix(T.night.horizon, T.night.moon.colour, 0.25);
  const solids = G.solids.map((s, i) => ({ ...s, i }));
  // (what stands over a point: the lowest solid above it in its room, for a hung ledge's rods)
  const over = (s, z) => {
    const r = room.get(s.room), ceil = (r.rect[1] + r.rect[3]) * H - CEIL;
    let best = ceil;
    for (const o of solids) if (o.room === s.room && o !== s && (o.role === 'ledge' || o.role === 'niche') && o.z0 > z + 0.5 && o.z0 < best && o.s0 < s.s1 - 0.3 && o.s1 > s.s0 + 0.3) best = o.z0;
    return best;
  };
  // (the WEATHER out under the sky: moss along a tread, a streak down from its joints)
  const weather = (s0, s1, zt, Lk, d, depth) => {
    for (let s = s0 + 0.4 + d() * 2; s < s1 - 0.6; s += 1.6 + d() * 3.6) {
      const w = 0.3 + d() * 0.6, m = mix(MOSS, Lk.stone, 0.25 + d() * 0.3);
      poly(out, F3, [[s, zt], [s + w, zt], [s + w * 0.8, zt - 0.12 - d() * 0.12], [s + w * 0.3, zt - 0.08 - d() * 0.1]], m, 'box:stone');
      if (d() < 0.45) face(out, F2, s + w * 0.4, s + w * 0.4 + 0.08 + d() * 0.1, zt - depth * (0.4 + d() * 0.6), zt - 0.1, shade(Lk.stone, 0.72), 'box:stone');
    }
  };

  for (const s of solids) {
    const Lk = lookRoom.get(s.room), r = room.get(s.room), d = diceOf(`fabric:${s.i}`), open = !!Lk.open;
    const st = Lk.stone, under = shade(Lk.mortar ?? shade(st, 0.5), 0.9), tall = s.z1 - s.z0;
    const rs0 = r.rect[0] * W, rs1 = (r.rect[0] + r.rect[2]) * W;
    if (s.role === 'floor') {
      // A PATH: its top in its material, its front a tread, a string course (or a beam) and coursed stone
      const P = PATHS[Lk.path] ?? PATHS.flags, wood = !!P.wood;
      const pathTop = wood ? mix(WOOD.top, Lk.top, 0.6) : P.checker ? mix(Lk.top, '#ffffff', 0.08) : Lk.path === 'rock' ? mix(Lk.top, st, 0.3) : Lk.top;
      const tone2 = P.checker ? shade(mix(Lk.top, Lk.trim, 0.35), 0.74) : null;
      top(out, s.z1, -HALF, HALF, s.s0, s.s1, wood ? WOOD.beam : under, 'box:mortar');
      const rowW = (2 * HALF) / P.rows;
      for (let k = 0; k < P.rows; k++) {
        const x0 = -HALF + k * rowW, x1 = x0 + rowW;
        for (let a = s.s0 - d() * P.long[0] * (P.checker ? 0 : 1), n = 0; a < s.s1 - 1e-3; n++) {
          const len = P.checker ? P.long[0] : P.long[0] + d() * (P.long[1] - P.long[0]), b = a + len, aa = Math.max(s.s0, a), bb = Math.min(s.s1, b);
          const fill = P.checker ? ((n + k) % 2 ? tone2 : pathTop) : shade(pathTop, 1 - P.vary / 2 + d() * P.vary);
          if (bb - aa > 0.06) top(out, s.z1 + 0.006, x0 + FABRIC.gap / 2, x1 - FABRIC.gap / 2, aa + (aa > s.s0 ? FABRIC.gap / 2 : 0), bb - (bb < s.s1 ? FABRIC.gap / 2 : 0), fill);
          a = b;
        }
      }
      let z = s.z1 - FABRIC.tread;
      face(out, F, s.s0, s.s1, z, s.z1, wood ? mix(WOOD.top, Lk.top, 0.1) : Lk.top, 'box:stone', { tilt: [0, 0.4] });
      if (wood) {
        // (a board floor's beam under its boards, strapped in iron)
        face(out, F, s.s0, s.s1, z - 0.3, z, WOOD.beam);
        for (let a = s.s0 + 1.2 + d() * 1.2; a < s.s1 - 0.4; a += 2.4) face(out, F2, a, a + 0.12, z - 0.3, z, IRON.dark);
        z -= 0.3;
      }
      face(out, F2, s.s0, s.s1, z - FABRIC.string, z, Lk.trim, 'box:stone', { tilt: [0, 0.5] });
      face(out, F, s.s0, s.s1, z - FABRIC.string - 0.05, z - FABRIC.string, shade(st, 0.45));
      z -= FABRIC.string + 0.05;
      stones(out, F, s.s0, s.s1, s.z0, z, { course: 0.6, long: Lk.path === 'rock' ? [0.8, 2.2] : [0.9, 1.7], fill: st, under, d, sizes, vary: Lk.path === 'rock' ? 0.3 : 0.14 });
      if (open) weather(s.s0, s.s1, s.z1 - FABRIC.tread, Lk, d, z - s.z0);
      ends(out, s.s0, s.s1, s.z0, s.z1, st);
      paths.push({ room: s.room, path: Lk.path ?? 'flags', top: pathTop, face: st });
      built.push({ i: s.i, as: `path:${Lk.path ?? 'flags'}` });
    } else if (s.role === 'ceiling') {
      const inner = [Math.max(s.s0, rs0 + WALL), Math.min(s.s1, rs1 - WALL)];
      if (open && !near(s.z1, boxTop)) {
        // A HOARDING: the covered wall-walk's timber, its boards standing, a beam along their foot, rafters' ends over it
        face(out, F - 0.004, s.s0, s.s1, s.z0, s.z1, WOOD.beam, 'box:mortar');
        for (let a = s.s0, k = 0; a < s.s1 - 1e-3; k++) { const b = Math.min(s.s1, a + 0.5); face(out, F, a + 0.02, b - 0.02, s.z0 + 0.16, s.z1, shade(WOOD.face, k % 2 ? 0.92 : 1.06 + d() * 0.08), 'box:stone', { pillow: 0.2 }); a = b; }
        face(out, F2, s.s0, s.s1, s.z0, s.z0 + 0.16, WOOD.beam, 'box:stone', { tilt: [0, -0.6] });
        for (let a = inner[0] + 0.6; a < inner[1] - 0.3; a += 1.8) face(out, F3, a, a + 0.18, s.z1 - 0.22, s.z1 - 0.04, shade(WOOD.face, 0.7));
        built.push({ i: s.i, as: 'hoarding' });
      } else {
        // A CORNICE: the slab's stone, a moulding along its foot, the corbel table hanging under it (machicolations deep
        // under the box's crown)
        const crown = open && near(s.z1, boxTop), C = FABRIC.corbel, hang = crown ? C.hang * 1.7 : C.hang;
        stones(out, F, s.s0, s.s1, s.z0 + 0.22, s.z1, { course: 0.4, long: [0.9, 1.7], fill: st, under, d, sizes });
        face(out, F2, s.s0, s.s1, s.z0 + 0.1, s.z0 + 0.22, mix(st, Lk.top, 0.4), 'box:stone', { tilt: [0, -0.5] });
        face(out, F, s.s0, s.s1, s.z0, s.z0 + 0.1, shade(st, 0.7), 'box:stone', { tilt: [0, -0.8] });
        for (let a = inner[0] + 0.5; a < inner[1] - 0.5; a += C.every) {
          poly(out, F, [[a - C.w / 2, s.z0], [a + C.w / 2, s.z0], [a + C.w * 0.3, s.z0 - hang * 0.55], [a + C.w * 0.15, s.z0 - hang], [a - C.w * 0.15, s.z0 - hang], [a - C.w * 0.3, s.z0 - hang * 0.55]], shade(st, 0.88), 'box:stone', { tilt: [0, -0.7] });
          if (crown && a + C.every < inner[1] - 0.5) face(out, F - 0.006, a + C.w / 2, a + C.every - C.w / 2, s.z0 - 0.05, s.z0 + 0.1, shade(st, 0.3));
        }
        built.push({ i: s.i, as: crown ? 'machicolations' : 'cornice' });
      }
      ends(out, s.s0, s.s1, s.z0, s.z1, st);
    } else if (s.role === 'wall' || (s.role === 'niche' && tall > 1)) {
      // A WALL quoined: each course one stone or two, a plinth at its foot, an impost under the ceiling, a string course
      // at every storey it rises through
      face(out, F - 0.004, s.s0, s.s1, s.z0, s.z1, under, 'box:mortar');
      const n = Math.max(1, Math.ceil(tall / FABRIC.quoin - 0.25)), dz = tall / n, g = FABRIC.gap / 2, mid = (s.s0 + s.s1) / 2;
      if (n > 1) measure(sizes, 'block.h', dz - FABRIC.gap); measure(sizes, 'block.w', s.s1 - s.s0 - FABRIC.gap);
      for (let k = 0; k < n; k++) {
        const za = s.z0 + k * dz + g, zb = s.z0 + (k + 1) * dz - g, at = mid + (d() - 0.5) * 0.16;
        if (k % 2) { face(out, F, s.s0 + g, at - g, za, zb, shade(st, 0.9 + d() * 0.2), 'box:stone', { pillow: 0.35 }); face(out, F, at + g, s.s1 - g, za, zb, shade(st, 0.9 + d() * 0.2), 'box:stone', { pillow: 0.35 }); }
        else face(out, F, s.s0 + g, s.s1 - g, za, zb, shade(st, 0.92 + d() * 0.18), 'box:stone', { pillow: 0.35 });
      }
      const onFloor = near((s.z0 - FLOOR) / H, Math.round((s.z0 - FLOOR) / H)), underCeil = near((s.z1 + CEIL) / H, Math.round((s.z1 + CEIL) / H));
      if (onFloor && tall > FABRIC.plinth + 1) {
        face(out, F2, s.s0, s.s1, s.z0, s.z0 + FABRIC.plinth, shade(st, 0.82), 'box:stone', { pillow: 0.3 });
        face(out, F3, s.s0, s.s1, s.z0 + FABRIC.plinth, s.z0 + FABRIC.plinth + 0.1, mix(st, Lk.top, 0.5), 'box:stone', { tilt: [0, 0.6] });
      }
      if (underCeil && tall > FABRIC.impost + 1) {
        face(out, F2, s.s0, s.s1, s.z1 - FABRIC.impost, s.z1, mix(st, Lk.trim, 0.35), 'box:stone', { tilt: [0, -0.5] });
        face(out, F2, s.s0, s.s1, s.z1 - FABRIC.impost - 0.06, s.z1 - FABRIC.impost, shade(st, 0.5));
      }
      for (let k = Math.ceil((s.z0 + 0.6) / H); k * H + 0.5 < s.z1 - 0.6; k++) face(out, F2, s.s0, s.s1, k * H + 0.2, k * H + 0.5, mix(st, Lk.top, 0.3), 'box:stone', { tilt: [0, 0.5] });
      // A TOWER: a shaft's wall on the box's edge, an arrow slit each storey, the night in it
      if (r.kind === 'shaft' && (near(s.s0, 0) || near(s.s1, boxEnd))) {
        for (let k = r.rect[1]; k < r.rect[1] + r.rect[3]; k++) {
          const zc = k * H + FLOOR + FABRIC.slit.at, S = FABRIC.slit;
          if (zc - S.h / 2 < s.z0 + 0.3 || zc + S.h / 2 > s.z1 - 0.3) continue;
          face(out, F2, mid - 0.22, mid + 0.22, zc - S.h / 2 - 0.25, zc + S.h / 2 + 0.25, mix(st, Lk.top, 0.35), 'box:stone', { pillow: 0.3 });
          poly(out, F3, [[mid - S.w / 2, zc - S.h / 2], [mid + S.w / 2, zc - S.h / 2], [mid + S.w / 2, zc + S.h / 2 - 0.1], [mid, zc + S.h / 2], [mid - S.w / 2, zc + S.h / 2 - 0.1]], open ? nightIn : '#16121a', 'box:slit');
          slits[r.id] = (slits[r.id] ?? 0) + 1;
        }
      }
      if (open) weather(s.s0, s.s1, s.z0 + FABRIC.plinth + 0.1, Lk, d, 0.6);
      ends(out, s.s0, s.s1, s.z0, s.z1, st);
      built.push({ i: s.i, as: r.kind === 'shaft' ? 'tower-wall' : 'wall' });
    } else {
      // A LEDGE by its look's material (a niche's shelf is stone)
      const kind = s.role === 'niche' ? 'stone' : LEDGES[Lk.ledge] ? Lk.ledge : 'stone';
      if (kind === 'timber') {
        const beamTop = s.z1 - 0.1;
        top(out, s.z1, -HALF, HALF, s.s0, s.s1, WOOD.beam, 'box:mortar');
        for (let k = 0; k < 5; k++) top(out, s.z1 + 0.006, -HALF + k * 0.6 + 0.02, -HALF + (k + 1) * 0.6 - 0.02, s.s0, s.s1, shade(mix(WOOD.top, Lk.top, 0.15), 0.9 + d() * 0.2), 'box:ledge');
        face(out, F, s.s0, s.s1, beamTop, s.z1, mix(WOOD.top, Lk.top, 0.1), 'box:ledge', { tilt: [0, 0.4] });
        face(out, F, s.s0, s.s1, s.z0, beamTop, WOOD.face, 'box:ledge', { pillow: 0.25 });
        for (const a of [s.s0 + 0.35, s.s1 - 0.47]) { face(out, F2, a, a + 0.12, s.z0, s.z1, IRON.dark, 'box:ledge'); face(out, F3, a + 0.03, a + 0.09, s.z0 + 0.12, s.z0 + 0.18, IRON.light, 'box:ledge'); }
        // (hung on two rods behind the lane, from what is over it)
        const up = over(s, s.z1);
        for (const a of [s.s0 + 0.4, s.s1 - 0.4]) face(out, -HALF - 0.12, a - 0.03, a + 0.03, s.z1, up, IRON.dark, 'box:ledge');
        built.push({ i: s.i, as: 'ledge:timber' });
      } else if (kind === 'iron') {
        top(out, s.z1, -HALF, HALF, s.s0, s.s1, IRON.dark, 'box:mortar');
        for (let a = s.s0 + 0.05; a < s.s1 - 0.1; a += 0.22) top(out, s.z1 + 0.006, -HALF, HALF, a, a + 0.12, mix(IRON.light, Lk.top, 0.2), 'box:ledge');
        face(out, F, s.s0, s.s1, s.z1 - 0.12, s.z1, IRON.light, 'box:ledge', { tilt: [0, 0.4] });
        face(out, F, s.s0, s.s1, s.z0, s.z1 - 0.12, IRON.dark, 'box:ledge');
        for (let a = s.s0 + 0.2; a < s.s1 - 0.1; a += 0.42) face(out, F2, a, a + 0.06, s.z0 + 0.12, s.z0 + 0.18, IRON.light, 'box:ledge');
        // (its truss, a zigzag of bars under it)
        for (let a = s.s0 + 0.1; a < s.s1 - 0.7; a += 1.2) {
          bar(out, F, [a, s.z0], [a + 0.6, s.z0 - 0.34], 0.05, IRON.dark, 'box:ledge');
          bar(out, F, [a + 0.6, s.z0 - 0.34], [Math.min(s.s1 - 0.1, a + 1.2), s.z0], 0.05, IRON.dark, 'box:ledge');
        }
        face(out, F, s.s0 + 0.1, s.s1 - 0.1, s.z0 - 0.38, s.z0 - 0.32, IRON.dark, 'box:ledge');
        built.push({ i: s.i, as: 'ledge:iron' });
      } else {
        // (a slab of two stones, coped, chamfered under)
        const stl = mix(st, Lk.top, 0.35), cut = (s.s0 + s.s1) / 2 + (d() - 0.5) * 0.6;
        top(out, s.z1, -HALF, HALF, s.s0, s.s1, Lk.top, 'box:ledge');
        face(out, F - 0.004, s.s0, s.s1, s.z0, s.z1, under, 'box:mortar');
        face(out, F, s.s0, s.s1, s.z1 - FABRIC.tread, s.z1, Lk.top, 'box:ledge', { tilt: [0, 0.4] });
        for (const [a, b] of [[s.s0, cut - 0.02], [cut + 0.02, s.s1]]) face(out, F, a, b, s.z0 + 0.08, s.z1 - FABRIC.tread, shade(stl, 0.9 + d() * 0.18), 'box:ledge', { pillow: 0.35 });
        poly(out, F, [[s.s0, s.z0 + 0.08], [s.s1, s.z0 + 0.08], [s.s1 - 0.08, s.z0], [s.s0 + 0.08, s.z0]], shade(stl, 0.6), 'box:ledge', { tilt: [0, -0.8] });
        if (open && d() < 0.6) weather(s.s0, s.s1, s.z1 - FABRIC.tread, Lk, d, 0.2);
        built.push({ i: s.i, as: s.role === 'niche' ? 'niche' : 'ledge:stone' });
      }
      ends(out, s.s0, s.s1, s.z0, s.z1, kind === 'stone' ? st : kind === 'iron' ? IRON.dark : WOOD.face);
    }
  }

  // DOORWAYS made: a segmental arch in the head, a threshold, the passage's far reveal; and the box's entry, its gate
  const A = FABRIC.arch, entry = room.get(L.entry.room), door = G.door ?? 4.3;
  const ways = [...G.doorways.map((w) => ({ id: w.door, s: w.s, a: WALL, z0: w.z0, z1: w.z1, room: null })),
    { id: 'entry', s: entry.rect[0] * W + WALL / 2, a: WALL / 2, z0: entry.rect[1] * H + FLOOR, z1: entry.rect[1] * H + FLOOR + door, room: entry.id }];
  const lookAt = (s, z) => { const r = L.rooms.find((q) => s >= q.rect[0] * W - 1e-3 && s <= (q.rect[0] + q.rect[2]) * W + 1e-3 && z >= q.rect[1] * H && z <= (q.rect[1] + q.rect[3]) * H); return lookRoom.get((r ?? L.rooms[0]).id); };
  for (const w of ways) {
    const Lk = lookAt(w.s - 0.01, w.z0 + 1), st = Lk.stone, rise = Math.min(A.rise, w.a), R = (w.a * w.a + rise * rise) / (2 * rise), cz = w.z1 - R, p0 = Math.asin(Math.min(1, w.a / R));
    const arc = (rad, n) => Array.from({ length: n + 1 }, (_, q) => { const p = -p0 + (2 * p0 * q) / n; return [w.s + rad * Math.sin(p), cz + rad * Math.cos(p)]; });
    // (its spandrels: the head's corners filled in fans from each top corner to the crown, each part convex)
    const sp = arc(R, 10);
    for (const [corner, from] of [[[w.s - w.a, w.z1], 0], [[w.s + w.a, w.z1], 5]]) for (let q = from; q < from + 5; q++) poly(out, F2, [corner, sp[q], sp[q + 1]], shade(st, 0.86), 'box:stone');
    // (its voussoirs, each a wedge, the keystone at the crown proud and lit)
    const inn = arc(R, 9), ext = arc(R + A.ring, 9), key = arc(R + A.ring + 0.16, 9);
    for (let q = 0; q < 9; q++) {
      const k = q === 4, tilt = { tilt: [Math.sin(-p0 + (2 * p0 * (q + 0.5)) / 9) * 0.6, 0.5] };
      poly(out, F3, [inn[q], inn[q + 1], (k ? key : ext)[q + 1], (k ? key : ext)[q]], k ? mix(st, Lk.top, 0.55) : shade(mix(st, Lk.top, 0.2), 0.92 + 0.12 * (q % 2)), 'box:stone', tilt);
    }
    // (the threshold across its foot, and the passage's far reveal seen through it, in shadow)
    top(out, w.z0 + 0.014, -HALF, HALF, w.s - w.a, w.s + w.a, mix(Lk.top, Lk.trim, 0.3));
    face(out, -HALF - 0.02, w.s - w.a - 0.2, w.s + w.a + 0.2, w.z0, w.z1 + 0.4, shade(st, 0.42), 'box:mortar');
    for (let z = w.z0, k = 0; z < w.z1 + 0.4 - 0.1; z += FABRIC.quoin, k++) face(out, -HALF - 0.01, w.s - w.a - 0.2 + (k % 2 ? 0.3 : 0), w.s + w.a + 0.2 - (k % 2 ? 0 : 0.3), z + 0.02, Math.min(w.z1 + 0.4, z + FABRIC.quoin) - 0.02, shade(st, 0.55 + 0.05 * (k % 3)), 'box:stone');
    doorways.push({ id: w.id, arch: true, reveal: true });
  }
  // HOLES framed: rim stones either side through the slab, the slab's far reveal through the cut
  for (const h of G.holes) {
    const Lk = lookAt((h.s0 + h.s1) / 2, h.z + 0.5), st = Lk.stone, z0 = h.z - CEIL, z1 = h.z + FLOOR;
    for (const [a, b] of [[h.s0 - 0.5, h.s0], [h.s1, h.s1 + 0.5]]) {
      face(out, F3, a, b, z0, h.z - 0.02, mix(st, Lk.top, 0.3), 'box:stone', { pillow: 0.3 });
      face(out, F3, a, b, h.z + 0.02, z1 - FABRIC.tread, mix(st, Lk.top, 0.4), 'box:stone', { pillow: 0.3 });
    }
    face(out, -HALF - 0.02, h.s0 - 0.2, h.s1 + 0.2, z0, z1, shade(st, 0.4), 'box:mortar');
    face(out, -HALF - 0.01, h.s0 - 0.2, h.s1 + 0.2, h.z - 0.08, h.z + 0.08, shade(st, 0.6), 'box:stone');
    holes.push({ id: h.door, framed: true });
  }

  // THE CROWN along the box's top: a parapet and its merlons, a bartizan every third screen, a tower over each top corner
  const L0 = lookRoom.get(L.rooms.find((r) => r.ring === 0)?.id) ?? lookRoom.values().next().value, cst = L0.stone, roof = mix(T.night.towers, '#6a7090', 0.35);
  stones(out, F, -0.6, boxEnd + 0.6, boxTop, boxTop + 1.2, { course: 0.6, long: [0.9, 1.7], fill: cst, under: shade(cst, 0.5), d: diceOf('crown'), sizes });
  for (let a = 0.4; a < boxEnd - 1; a += 2.4) { face(out, F, a, a + 1.3, boxTop + 1.2, boxTop + 2.3, shade(cst, 0.95)); face(out, F2, a, a + 1.3, boxTop + 2.2, boxTop + 2.3, L0.top); }
  const turret = (c, w, z0, h, rh) => {
    poly(out, F2, [[c - w * 0.3, z0 - 1.2], [c + w * 0.3, z0 - 1.2], [c + w / 2, z0], [c - w / 2, z0]], shade(cst, 0.8), 'box:stone', { tilt: [0, -0.6] });
    stones(out, F2, c - w / 2, c + w / 2, z0, z0 + h, { course: 0.7, long: [0.8, 1.4], fill: cst, under: shade(cst, 0.5), d: diceOf(`turret:${c}`), sizes });
    face(out, F3, c - 0.08, c + 0.08, z0 + h * 0.4, z0 + h * 0.4 + 1.2, '#16121a', 'box:slit');
    poly(out, F3, [[c - w / 2 - 0.4, z0 + h], [c + w / 2 + 0.4, z0 + h], [c, z0 + h + rh]], roof, 'box:stone');
  };
  for (let k = 1; k < cols - 1; k += 3) turret((k + 0.5) * W, 2.6, boxTop + 1.2, 3.4, 3.6);
  for (const c of [W * 0.5, boxEnd - W * 0.5]) turret(c, 8, boxTop, 9, 9);
  // THE FOUNDATION: a battered plinth on a crag of rock
  poly(out, F, [[-0.9, -1.6], [boxEnd + 0.9, -1.6], [boxEnd, 0], [0, 0]], shade(cst, 0.8), 'box:stone', { tilt: [0, 0.4] });
  // (the crag: boulders a step behind the plinth, each dark in its body, its top facet lit by the moon, jagged and unlike)
  const dc = diceOf('crag'), rock = mix(mix(cst, T.night.towers, 0.45), '#3a332c', 0.3), lit = mix(rock, T.night.moon.colour, 0.5);
  for (let a = -8, k = 0; a < boxEnd + 8; k++) {
    const w = 3 + dc() * 7, lo = -9 - dc() * 9, hi = -1.4 - dc() * 1.8 - (k % 3 === 2 ? 2.5 : 0), peak = a + w * (0.25 + dc() * 0.5), x = F - 0.02 - (k % 2) * 0.01;
    const L0p = [a - 0.4, hi - 0.8 - dc() * 1.6], R0p = [a + w + 0.4, hi - 0.6 - dc() * 1.8], P0 = [peak, hi];
    poly(out, x, [[a - 0.2, lo], [a + w + 0.2, lo], R0p, P0, L0p], shade(rock, 0.75 + dc() * 0.35), 'box:stone', { pillow: 0.6 });
    poly(out, x + 0.005, [L0p, P0, [peak + (R0p[0] - peak) * 0.4, hi - 0.35], [a + (peak - a) * 0.3, L0p[1] + 0.05]], shade(lit, 0.9 + dc() * 0.2), 'box:stone', { tilt: [0, 0.8] });
    a += w * (0.7 + dc() * 0.25);
  }
  return { built, doorways, holes, slits, paths, crown: true, foundation: true };
}

/** The fabric's laws (see the header), measured on what it built. */
export function fabricLaws(B, fab) {
  const { layout: L, greybox: G } = B, out = [];
  const law = (id, holds, says, rooms) => out.push({ id, holds: !!holds, says, ...(rooms && rooms.length ? { rooms: [...new Set(rooms)] } : {}) });
  const done = new Set(fab.built.map((b) => b.i)), bare = G.solids.map((s, i) => [s, i]).filter(([, i]) => !done.has(i)).map(([s]) => s.room);
  law('built', !bare.length, bare.length ? `${bare.length} solid${bare.length === 1 ? '' : 's'} left as a block: ${[...new Set(bare)].slice(0, 6).join(', ')}` : `every one of ${G.solids.length} solids built as its role (${[...new Set(fab.built.map((b) => b.as.split(':')[0]))].join(', ')})`, bare);
  const made = new Set(fab.doorways.filter((w) => w.arch && w.reveal).map((w) => w.id)), unmade = [...G.doorways.map((w) => w.door), 'entry'].filter((id) => !made.has(id));
  law('doorways-made', !unmade.length, unmade.length ? `doorways left bare: ${unmade.join(', ')}` : `every doorway (${G.doorways.length} and the entry) arched in its head, its threshold laid and its passage's reveal seen through it`);
  const framed = new Set(fab.holes.filter((h) => h.framed).map((h) => h.id)), raw = G.holes.map((h) => h.door).filter((id) => !framed.has(id));
  law('holes-framed', !raw.length, raw.length ? `holes left raw: ${raw.join(', ')}` : `every hole (${G.holes.length}) framed through its slab`);
  const dull = fab.paths.filter((p) => (lum(p.top) + 0.05) / (lum(p.face) + 0.05) < FABRIC.pathReads).map((p) => p.room);
  law('paths-read', !dull.length, dull.length ? `paths no lighter than their slab in ${[...new Set(dull)].join(', ')}` : `every path ${FABRIC.pathReads} times as light as its slab's face, so the walk reads first`, dull);
  const cols = L.box[0], towers = L.rooms.filter((r) => r.kind === 'shaft' && (r.rect[0] === 0 || r.rect[0] + r.rect[2] === cols));
  const blind = towers.filter((r) => (fab.slits[r.id] ?? 0) < r.rect[3]).map((r) => r.id);
  law('towers-slit', !blind.length, blind.length ? `towers short of a slit a storey: ${blind.join(', ')}` : `every tower on the box's edge (${towers.length}) slit each storey`, blind);
  law('crowned', fab.crown && fab.foundation, fab.crown && fab.foundation ? 'the box crowned along its top (parapet, bartizans, corner towers) and founded on its crag' : 'the box stands uncrowned or unfounded');
  return out;
}
