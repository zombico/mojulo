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
 *   a LEDGE         by the room's look (`ledge`: LEDGES): a slab of stones chamfered under, a timber platform of boards
 *                   on a beam strapped in iron and hung on rods from what is over it, an iron catwalk grated on a truss; a
 *                   climb's piece against a wall (a switchback's step, a flight's landing) on a corbel out of it; a
 *                   stair's step a stone block reaching past the step below, the flight one mass (climbs.js)
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
/** ROCK laid on a face (a planet's, a look's `fabric: 'rock'`): the rock's own beds, each chunk its own length and height
 * and shade, its corners knocked so no two meet square, the dark of the crack `under` them */
function rockFace(out, x, s0, s1, z0, z1, { fill, under, d, group = 'box:stone', bed = [0.6, 1.3], long = [0.9, 2.6], vary = 0.3 }) {
  if (s1 - s0 < 0.05 || z1 - z0 < 0.05) return;
  face(out, x - 0.004, s0, s1, z0, z1, under, 'box:mortar');
  for (let za = z0, k = 0; za < z1 - 1e-3; k++) {
    const zb = Math.min(z1, za + bed[0] + d() * (bed[1] - bed[0])), top = z1 - zb < bed[0] * 0.5 ? z1 : zb, g = 0.05;
    for (let a = s0 - d() * long[0]; a < s1 - 1e-3;) {
      const b = a + long[0] + d() * (long[1] - long[0]), aa = Math.max(s0, a) + (a > s0 ? g : 0), bb = Math.min(s1, b) - (b < s1 ? g : 0);
      if (bb - aa > 0.12) { const j = Math.min(0.22, (bb - aa) * 0.2, (top - za) * 0.25); poly(out, x, [[aa + j * d(), za + g], [bb - j * d(), za + g], [bb, za + (top - za) * 0.5], [bb - j * d(), top - g], [aa + j * d(), top - g], [aa, za + (top - za) * 0.45]], shade(fill, 1 - vary / 2 + d() * vary), group, { pillow: 0.5 }); }
      a = b;
    }
    za = top;
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
      if (Lk.fabric === 'rock') {
        // (a planet's floor: no course laid, the rock's own beds under its worn top, a drip of the cave here and there)
        rockFace(out, F, s.s0, s.s1, s.z0, z, { fill: st, under, d });
        for (let a = s.s0 + 1 + d() * 3; a < s.s1 - 0.5; a += 3 + d() * 5) poly(out, F2, [[a - 0.25, z], [a + 0.25, z], [a + 0.02, z - 0.5 - d() * 0.6]], shade(st, 0.7), 'box:stone');
        ends(out, s.s0, s.s1, s.z0, s.z1, st);
        paths.push({ room: s.room, path: Lk.path ?? 'flags', top: pathTop, face: st });
        built.push({ i: s.i, as: `path:${Lk.path ?? 'flags'}` });
        continue;
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
      if (Lk.fabric === 'rock') {
        // A ROOF OF ROCK: the beds over her, stalactites hung from their foot in unlike lengths (the crust's, at the box's
        // top, under the planet's sky)
        rockFace(out, F, s.s0, s.s1, s.z0, s.z1, { fill: st, under, d, bed: [0.3, 0.6] });
        for (let a = inner[0] + 0.3 + d(); a < inner[1] - 0.3; a += 0.7 + d() * 1.6) { const len = 0.2 + d() * d() * 1.1, w = 0.12 + len * 0.15; poly(out, F2, [[a - w, s.z0 + 0.02], [a + w, s.z0 + 0.02], [a + 0.02, s.z0 - len]], shade(st, 0.78 + d() * 0.2), 'box:stone', { tilt: [0, -0.6] }); }
        built.push({ i: s.i, as: open && near(s.z1, boxTop) ? 'crust' : 'rock-roof' });
      } else if (open && !near(s.z1, boxTop)) {
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
    } else if (s.role === 'wall' || s.role === 'pier' || (s.role === 'niche' && tall > 1)) {
      if (Lk.fabric === 'rock') {
        // A WALL OF ROCK: its beds stacked, no course and no plinth; on the box's edge a shaft's wall cracked through each
        // storey, a fissure of the deeper glow where a castle's tower has its slit
        const mid = (s.s0 + s.s1) / 2;
        rockFace(out, F, s.s0, s.s1, s.z0, s.z1, { fill: st, under, d, long: [Math.min(0.9, s.s1 - s.s0), Math.max(1.2, s.s1 - s.s0)] });
        if (r.kind === 'shaft' && (near(s.s0, 0) || near(s.s1, boxEnd))) for (let k = r.rect[1]; k < r.rect[1] + r.rect[3]; k++) {
          const zc = k * H + FLOOR + FABRIC.slit.at, S = FABRIC.slit;
          if (zc - S.h / 2 < s.z0 + 0.3 || zc + S.h / 2 > s.z1 - 0.3) continue;
          poly(out, F3, [[mid - 0.06, zc - S.h / 2], [mid + 0.1, zc - S.h * 0.15], [mid + 0.03, zc + S.h / 2], [mid - 0.1, zc + S.h * 0.1]], Lk.glass ?? nightIn, 'box:slit');
          slits[r.id] = (slits[r.id] ?? 0) + 1;
        }
        ends(out, s.s0, s.s1, s.z0, s.z1, st);
        built.push({ i: s.i, as: s.role === 'pier' ? 'pier' : r.kind === 'shaft' ? 'rock-wall' : 'rock' });
        continue;
      }
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
      built.push({ i: s.i, as: s.role === 'pier' ? 'pier' : r.kind === 'shaft' ? 'tower-wall' : 'wall' });
    } else if (s.role === 'stair' || s.role === 'landing') {
      // A CLIMB'S STRUCTURE (climbs.js): a walked step, its tread lit and its nosing proud; a great step, two courses of
      // stone coped; a landing coped, on a corbel out of the wall or the pier it is built from; where the room stands on
      // the castle's rock, what rises from its floor is the rock, its top facets lit
      const rock = s.terrain || Lk.fabric === 'rock', body = rock ? mix(mix(st, '#4a4038', 0.55), T.night.towers, 0.15) : mix(st, Lk.top, 0.18), cap = rock ? mix(body, Lk.top, 0.35) : Lk.top;
      const great = s.piece === 'great', step = s.role === 'stair' && !great;
      top(out, s.z1, -HALF, HALF, s.s0, s.s1, step && Lk.path === 'boards' ? mix(WOOD.top, Lk.top, 0.6) : cap, 'box:ledge');
      face(out, F - 0.004, s.s0, s.s1, s.z0, s.z1, under, 'box:mortar');
      if (rock) {
        // (a boulder: its face in two or three convex chunks, its top facet lit)
        const k = Math.max(1, Math.round((s.s1 - s.s0) / 1.6)), w = (s.s1 - s.s0) / k;
        for (let q = 0; q < k; q++) { const a = s.s0 + q * w, b = a + w, j = 0.12 + d() * 0.2; poly(out, F, [[a, s.z0], [b, s.z0], [b, s.z1 - j], [a + w * 0.6, s.z1], [a, s.z1 - j * 0.6]], shade(body, 0.82 + d() * 0.3), 'box:ledge', { pillow: 0.5 }); }
        face(out, F2, s.s0, s.s1, s.z1 - 0.1, s.z1, cap, 'box:ledge', { tilt: [0, 0.8] });
      } else if (step) {
        // (a flight reads as one stepped mass: every step's face one stone, coursed across the flight at one height)
        face(out, F, s.s0, s.s1, s.z0, s.z1 - 0.07, shade(body, 0.9), 'box:ledge', { pillow: 0.12 });
        for (let zc = Math.ceil((s.z0 + 0.2) / 0.9) * 0.9; zc < s.z1 - 0.2; zc += 0.9) face(out, F + 0.004, s.s0, s.s1, zc - 0.025, zc + 0.025, under, 'box:ledge');
        face(out, F2, s.s0 - 0.03, s.s1 + 0.03, s.z1 - 0.07, s.z1, cap, 'box:ledge', { tilt: [0, 0.5] });
      } else {
        const ht = s.z1 - s.z0 - FABRIC.tread, n = Math.max(1, Math.round(ht / 0.45));
        stones(out, F, s.s0, s.s1, s.z0, s.z1 - FABRIC.tread, { course: ht / n, long: [0.9, 1.6], fill: body, under, d, sizes, group: 'box:ledge' });
        face(out, F2, s.s0, s.s1, s.z1 - FABRIC.tread, s.z1, cap, 'box:ledge', { tilt: [0, 0.45] });
        // (a landing built out from a wall or the pier: its corbel under it, into what it is built from)
        if (s.role === 'landing' && s.z0 > r.rect[1] * H + FLOOR + 0.3) {
          const pier = r.rect[2] === 2 && s.piece === 'pier' ? rs0 + W : null;
          const at = pier != null ? (Math.abs(s.s0 - pier) < Math.abs(s.s1 - pier) ? s.s0 : s.s1) : s.s0 - rs0 < rs1 - s.s1 ? s.s0 : s.s1, dir = at === s.s0 ? 1 : -1;
          poly(out, F, [[at, s.z0], [at + dir * 1.2, s.z0], [at, s.z0 - 1.3]], shade(body, 0.78), 'box:ledge', { tilt: [0, -0.6] });
        }
      }
      ends(out, s.s0, s.s1, s.z0, s.z1, rock ? body : st);
      built.push({ i: s.i, as: rock ? 'rock' : great ? 'great-step' : s.role === 'stair' ? 'step' : `landing:${s.piece ?? 'plain'}` });
    } else {
      // A LEDGE by its look's material (a niche's shelf is stone)
      const kind = s.role === 'niche' ? 'stone' : LEDGES[Lk.ledge] ? Lk.ledge : 'stone';
      // (wall-side pieces of a climb, a switchback's step or a flight's landing, stand on a corbel out of the wall)
      const wallSide = s.piece === 'step' || s.piece === 'landing' ? (s.s1 > rs1 - WALL - 0.4 ? 1 : s.s0 < rs0 + WALL + 0.4 ? -1 : 0) : 0;
      if (wallSide && kind !== 'iron') {
        const w = wallSide > 0 ? rs1 - WALL : rs0 + WALL, c = wallSide > 0 ? w - 0.7 : w + 0.7;
        poly(out, F, [[Math.min(w, c), s.z0], [Math.max(w, c), s.z0], [w, s.z0 - 0.9]], shade(st, 0.8), 'box:ledge', { tilt: [0, -0.6] });
      }
      if (s.piece === 'stair') {
        // A STAIR's step: a stone block from its tread down past the step below, so the flight reads as one mass, its
        // tread lit and its nosing proud
        const deep = 0.75;
        top(out, s.z1, -HALF, HALF, s.s0, s.s1, Lk.top, 'box:ledge');
        face(out, F, s.s0, s.s1, s.z1 - deep, s.z1 - 0.08, shade(mix(st, Lk.top, 0.25), 0.88 + d() * 0.16), 'box:ledge', { pillow: 0.2 });
        face(out, F2, s.s0 - 0.03, s.s1, s.z1 - 0.08, s.z1, Lk.top, 'box:ledge', { tilt: [0, 0.5] });
        built.push({ i: s.i, as: 'ledge:stair' });
        continue;
      }
      if (kind === 'timber') {
        const beamTop = s.z1 - 0.1;
        top(out, s.z1, -HALF, HALF, s.s0, s.s1, WOOD.beam, 'box:mortar');
        for (let k = 0; k < 5; k++) top(out, s.z1 + 0.006, -HALF + k * 0.6 + 0.02, -HALF + (k + 1) * 0.6 - 0.02, s.s0, s.s1, shade(mix(WOOD.top, Lk.top, 0.15), 0.9 + d() * 0.2), 'box:ledge');
        face(out, F, s.s0, s.s1, beamTop, s.z1, mix(WOOD.top, Lk.top, 0.1), 'box:ledge', { tilt: [0, 0.4] });
        face(out, F, s.s0, s.s1, s.z0, beamTop, WOOD.face, 'box:ledge', { pillow: 0.25 });
        const ns = Math.max(2, Math.round((s.s1 - s.s0) / 2.2) + 1);
        for (let q = 0; q < ns; q++) { const a = s.s0 + 0.35 + (q * (s.s1 - s.s0 - 0.82)) / (ns - 1); face(out, F2, a, a + 0.12, s.z0, s.z1, IRON.dark, 'box:ledge'); face(out, F3, a + 0.03, a + 0.09, s.z0 + 0.12, s.z0 + 0.18, IRON.light, 'box:ledge'); }
        // (hung on two rods behind the lane, from what is over it)
        const up = over(s, s.z1);
        const nr = Math.max(2, Math.round((s.s1 - s.s0) / 4) + 1);
        for (let q = 0; q < nr; q++) { const a = s.s0 + 0.4 + (q * (s.s1 - s.s0 - 0.8)) / (nr - 1); face(out, -HALF - 0.12, a - 0.03, a + 0.03, s.z1, up, IRON.dark, 'box:ledge'); }
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
      } else if (Lk.fabric === 'rock') {
        // (a shelf of rock out of the cave: its top lit, its face in chunks, tapering under to a point it grew from)
        top(out, s.z1, -HALF, HALF, s.s0, s.s1, Lk.top, 'box:ledge');
        face(out, F, s.s0, s.s1, s.z1 - FABRIC.tread, s.z1, Lk.top, 'box:ledge', { tilt: [0, 0.4] });
        const k = Math.max(1, Math.round((s.s1 - s.s0) / 1.4)), w = (s.s1 - s.s0) / k;
        for (let q = 0; q < k; q++) { const a = s.s0 + q * w; poly(out, F, [[a, s.z1 - FABRIC.tread], [a + w, s.z1 - FABRIC.tread], [a + w * (0.75 + d() * 0.2), s.z0 - 0.15 - d() * 0.3], [a + w * (0.1 + d() * 0.2), s.z0 + 0.05]], shade(mix(st, Lk.top, 0.3), 0.85 + d() * 0.25), 'box:ledge', { pillow: 0.5 }); }
        built.push({ i: s.i, as: s.role === 'niche' ? 'niche' : 'ledge:stone' });
      } else {
        // (a slab of two stones, coped, chamfered under)
        const stl = mix(st, Lk.top, 0.35), nst = Math.max(2, Math.round((s.s1 - s.s0) / 1.4)), cuts = Array.from({ length: nst - 1 }, (_, q) => s.s0 + ((q + 1) * (s.s1 - s.s0)) / nst + (d() - 0.5) * 0.3);
        top(out, s.z1, -HALF, HALF, s.s0, s.s1, Lk.top, 'box:ledge');
        face(out, F - 0.004, s.s0, s.s1, s.z0, s.z1, under, 'box:mortar');
        face(out, F, s.s0, s.s1, s.z1 - FABRIC.tread, s.z1, Lk.top, 'box:ledge', { tilt: [0, 0.4] });
        for (const [a, b] of [s.s0, ...cuts].map((x, q, all) => [q ? x + 0.02 : x, q < all.length - 1 ? all[q + 1] - 0.02 : s.s1])) face(out, F, a, b, s.z0 + 0.08, s.z1 - FABRIC.tread, shade(stl, 0.9 + d() * 0.18), 'box:ledge', { pillow: 0.35 });
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
    { id: 'entry', s: entry.rect[0] * W + WALL / 2, a: WALL / 2, z0: entry.rect[1] * H + FLOOR, z1: entry.rect[1] * H + FLOOR + door, room: entry.id },
    // (and a tower's pier's archways, made as a doorway is)
    ...(G.arches ?? []).map((w, k) => ({ id: `arch:${w.room}:${k}`, s: w.s, a: w.a, z0: w.z0, z1: w.z1, room: w.room }))];
  const lookAt = (s, z) => { const r = L.rooms.find((q) => s >= q.rect[0] * W - 1e-3 && s <= (q.rect[0] + q.rect[2]) * W + 1e-3 && z >= q.rect[1] * H && z <= (q.rect[1] + q.rect[3]) * H); return lookRoom.get((r ?? L.rooms[0]).id); };
  for (const w of ways) {
    const Lk0 = lookAt(w.s - 0.01, w.z0 + 1);
    if (Lk0.fabric === 'rock') {
      // (a CAVE MOUTH: rough rocks round its head where a castle springs its arch, the far rock's dark seen through it)
      const st = Lk0.stone, dd = diceOf(`mouth:${w.id}`);
      for (let q = 0; q < 5; q++) { const a = w.s - w.a - 0.35 + (q * (2 * w.a + 0.7)) / 5, b = a + (2 * w.a + 0.7) / 5 + 0.06, hz = w.z1 - 0.15 - (q === 0 || q === 4 ? 0.5 : q === 2 ? -0.1 : 0.15) - dd() * 0.2; poly(out, F3, [[a, hz], [b, hz + 0.05], [b - 0.05, w.z1 + 0.3 + dd() * 0.25], [a + 0.08, w.z1 + 0.35]], shade(mix(st, Lk0.top, 0.25), 0.85 + dd() * 0.2), 'box:stone', { pillow: 0.5 }); }
      top(out, w.z0 + 0.014, -HALF, HALF, w.s - w.a, w.s + w.a, mix(Lk0.top, st, 0.4));
      face(out, -HALF - 0.02, w.s - w.a - 0.2, w.s + w.a + 0.2, w.z0, w.z1 + 0.4, shade(st, 0.35), 'box:mortar');
      doorways.push({ id: w.id, arch: true, reveal: true, mouth: true });
      continue;
    }
    const Lk = Lk0, st = Lk.stone, rise = Math.min(A.rise, w.a), R = (w.a * w.a + rise * rise) / (2 * rise), cz = w.z1 - R, p0 = Math.asin(Math.min(1, w.a / R));
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
  // LADDERS (climbs.js): two rails and their rungs, behind her on the lane, from the landing at the foot up past the head
  for (const l of G.ladders ?? []) {
    // (on a planet, the explorer's own: a ladder of metal bolted to the rock)
    const metal = lookAt(l.s, l.z0 + 0.5).fabric === 'rock', x = -0.45, wood = metal ? IRON.light : shade(WOOD.face, 1.25), rails = [l.s - 0.32, l.s + 0.32];
    for (const rs of rails) face(out, x, rs - 0.05, rs + 0.05, l.z0, l.z1 + 1.1, wood, 'box:ledge', { pillow: 0.3 });
    for (let z = l.z0 + 0.3; z < l.z1 + 1.0; z += 0.3) face(out, x + 0.006, rails[0], rails[1], z - 0.035, z + 0.035, shade(wood, 0.9), 'box:ledge');
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
  if (L0.fabric === 'rock') {
    // (a planet's crust: no crown but the ground's own skyline, crags and spires of rock along the top, a boulder here and
    // there, the same crag under the box)
    const dk = diceOf('crust');
    rockFace(out, F, -0.6, boxEnd + 0.6, boxTop, boxTop + 0.9, { fill: cst, under: shade(cst, 0.5), d: dk, bed: [0.9, 0.9] });
    for (let a = -0.6; a < boxEnd + 0.6;) { const w = 1.5 + dk() * 4, h = 0.6 + dk() * dk() * 4.5, pk = a + w * (0.3 + dk() * 0.4); poly(out, F2, [[a, boxTop + 0.85], [a + w, boxTop + 0.85], [a + w * 0.8, boxTop + 0.85 + h * 0.5], [pk, boxTop + 0.85 + h], [a + w * 0.15, boxTop + 0.85 + h * 0.4]], shade(mix(cst, T.night.towers, 0.3), 0.8 + dk() * 0.3), 'box:stone', { pillow: 0.5 }); a += w * 0.75; }
  } else {
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
  }
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
