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
 *   the FABRIC     every closed part built as what it is (fabric.js): a floor's path in its material, a ceiling's
 *                  cornice, a wall quoined, a doorway arched, a hole framed, a ledge in its material, a tower slit, the
 *                  box crowned and founded
 *   the RUNNER     a carpet down a ring's floors where its look has one, cut round the holes and the gates in them
 *   the LAMPS      one a bay, on its back (a torch, a sconce of candles, a cold lamp) or on its floor (a brazier), drawn
 *                  lit, each flame haloed (GLOW: the page's glow sprites)
 *   the PIERS      at each cell's edge a pier standing out of the wall (a half-column on its base under a capital the
 *                  vault's ribs spring from, or a chamfered pier), slender shafts flanking each bay's piece up to the ribs,
 *                  and the near layer's columns drawn round
 *   the LIGHT      baked at every corner of every face (a gradient across it, never one tone a block): darkened to its
 *                  ring's `dark`, and warmed by each lamp within its `reach` in the lamp's colour, falling off with
 *                  distance; a face turned toward a lamp (a column's near side, a block's domed edge, a top) takes more
 *                  of it and one turned away less; what stands out of the wall (a pier, a case, a statue, a gallery)
 *                  casts its shadow from each lamp, raking across the wall, and darkens the wall close round it; the
 *                  wall darkens under its ceiling: pools in the dark, the relief drawn by the light
 *   the DUST       hanging in the closed rooms, lit where the lamps are (MOTES: the page's motes)
 *
 *   dressBox(B, theme) → { faces, lamps: [{ at: [x, s, z], colour, kind, room, reach }], plan: { <room>: { order, focals,
 *                  near, through, open } }, sizes: { <part>: [least, most] }, fabric (fabric.js buildFabric's), motes?, glow }   B: scene.js boxOf's
 *                  (layout, greybox); sizes the drawn parts' measures (backdrop.js SCALE)
 *   LAMP_REACH, ASHLAR, RELIEF, WAINSCOT, MOTES, GLOW
 *
 * Pure: the same box and theme make the same faces.
 */
import { r5, hexRgb, rgbHex } from '../../era/geom.js';
import { BOX_THEMES, lookOf, roomLook } from './themes.js';
import { FLOOR, CEIL, boxCameraOf } from './rooms.js';
import { composeRoom, drawPiece, diceOf, measure, archOf } from './backdrop.js';
import { buildFabric } from './fabric.js';

export const LAMP_REACH = 8;
/** a back wall's ashlar: its blocks' lengths and its courses' heights (m), each course its own height and each block its
 * own length (seeded), so the wall is laid stone, never a grid; each block lit domed (its lamp side light, its far side
 * dark: PILLOW) */
export const ASHLAR = Object.freeze({ long: Object.freeze([0.9, 1.7]), courses: Object.freeze([0.55, 0.7, 0.85]) });
/** THE WALLS a back is laid in (a look's `wall`): each its blocks' lengths and its courses' heights (m), how far a block's
 * stone strays from the next (`vary`) and the joint left between them (`gap`: none, plaster's, a smooth face lit as one) */
export const WALLS = Object.freeze({
  ashlar: Object.freeze({ ...ASHLAR, vary: 0.2, gap: 0.05 }),
  brick: Object.freeze({ long: Object.freeze([0.66, 0.78]), courses: Object.freeze([0.36, 0.4]), vary: 0.3, gap: 0.045 }),
  rock: Object.freeze({ long: Object.freeze([1.0, 2.4]), courses: Object.freeze([0.7, 1.0, 1.3]), vary: 0.45, gap: 0.09 }),
  plaster: Object.freeze({ long: Object.freeze([1.2, 1.2]), courses: Object.freeze([1.0]), vary: 0.05, gap: 0 }),
});
/** THE LIGHT'S RELIEF: how domed a block is lit, how far a turned face takes a lamp's light toward it or from it, how
 * much of a lamp a shadow lets through, and how far out from the wall a lamp's flame stands (m) */
export const RELIEF = Object.freeze({ pillow: 0.5, turn: 1.5, shadow: 0.1, flame: 0.5 });
/** a wainscot's panel along the floor (m): wide, so the band behind the play stays calm (backdrop.js calm-play) */
export const WAINSCOT = 4.8;
/** the dust in the closed rooms (the page's motes) and the flames' halos (the page's glow sprites) */
export const MOTES = Object.freeze({ count: 2400, color: Object.freeze([1, 0.84, 0.6]), size: 0.035, drift: 0.22 });
export const GLOW = Object.freeze({ scale: 0.3, opacity: 0.8 });
/** THE NIGHT'S DEPTH (docs/side-scroll-backgrounds.md): stars by the square metre of sky (thicker up it), the moonlit cloud
 * wisps, the far mountains and the forest ridge in front of the towers' feet, each a step darker toward the eye; the
 * moon's halo in rings */
export const NIGHT = Object.freeze({ stars: 0.03, star: Object.freeze([0.1, 0.16]), cloud: Object.freeze({ every: [9, 20], w: [12, 26], h: [0.8, 1.7] }), mountains: Object.freeze([1.2, 5]), ridge: Object.freeze([0.2, 1.6]), halo: Object.freeze([[1.18, 0.2], [1.4, 0.12], [1.7, 0.06]]) });
/** MOONLIGHT through a window: the glass shows the night (the moon's side pale at its foot, the dark at its head) and
 * a shaft falls from it to the floor away from the moon, `slant` metres along for each metre down, at `alpha` */
export const MOONBEAM = Object.freeze({ slant: 0.42, alpha: 0.075, colour: '#b9c6ff', glass: Object.freeze({ foot: 0.24, head: 0.5 }) });
/** STAINED GLASS's panes and the light it lets in (a chapel's): the coloured moonbeam is one of its panes' colours */
export const STAINED = Object.freeze(['#c0303c', '#2c5cc4', '#e0aa30', '#3a9a5a', '#8a40b0', '#e06a2a']);
/** THE LIVE FLAMES (the page's flames channel): each painted flame drawn as an ember `core` of its size, the live flame
 * over it `grow` times its size; and THE MOTION (channels/ambient.js) of what moves behind the play */
export const LIVE = Object.freeze({ core: 0.5, grow: 1.3 });
export const MOTION = Object.freeze({
  'box:stars': Object.freeze({ depth: 0.7, beat: 3.4, spread: 1.7 }),
  'box:clouds': Object.freeze({ amp: [0, 5, 0.3], period: 95, spread: 0.03 }),
  'box:beam': Object.freeze({ depth: 0.45, beat: 13, spread: 0.05 }),
  'box:ghost': Object.freeze({ depth: 0.3, beat: 2.7, spread: 0.6 }),
  'box:brew': Object.freeze({ amp: [0, 0, 0.03], period: 1.4, spread: 3.1, depth: 0.35, beat: 1.8 }),
});
const HALF = 1.5, BACK = -3, NEAR_X = -2.3, NEAR_SHADE = 0.55, SKY_X = -14, TOWER_X = -12, MOON_X = -10, PARAPET_X = -2.2, SKY_BAND = 4;
const STAR_X = SKY_X + 0.6, MOUNT_X = SKY_X + 1.0, CLOUD_X = SKY_X + 1.4, RIDGE_X = TOWER_X + 0.6, BEAM_X = BACK + 0.55;
const SHADOW = 0.62, WARM = 1.5;
/** a wall shaft's corbel, over her head (m above its floor) */
const SHAFT_FOOT = 2.75;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const N = { px: [1, 0, 0], top: [0, 0, 1], ny: [0, -1, 0], py: [0, 1, 0] };
const quad = (out, corners, n, fill, group, extra) => {
  const [a, b, c] = corners, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const w = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  out.push({ corners: (dot(w, n) < 0 ? [...corners].reverse() : corners).map((p) => p.map(r5)), normal: n, fill, group, ...(extra || {}) });
};
const face = (out, x, s0, s1, z0, z1, fill, group, extra) => { if (s1 - s0 > 1e-4 && z1 - z0 > 1e-4) quad(out, [[x, s0, z0], [x, s1, z0], [x, s1, z1], [x, s0, z1]], N.px, fill, group, extra); };
// a flame: pointed, its tip up (the page halos one with a glow marker: its first four corners its middle)
// (and its LIVE twin on the page's flames channel, `live`: the painted flame kept as its ember, the live one over it)
const flame = (out, x, s, w, z0, z1, fill, extra, live) => {
  if (live) { live.push({ at: [x + 0.05, s, z0].map(r5), w: r5(2 * w * LIVE.grow), h: r5((z1 - z0) * LIVE.grow), color: hexRgb(fill).map(r5) }); z1 = z0 + (z1 - z0) * LIVE.core; w *= LIVE.core + 0.2; }
  out.push({ corners: [[s - w, z0], [s + w, z0], [s + w, z0 + (z1 - z0) * 0.55], [s, z1], [s - w, z0 + (z1 - z0) * 0.55]].map(([a, b]) => [x, a, b].map(r5)), normal: N.px, fill, group: 'box:flame', ...(extra || {}) });
};
const poly = (out, x, pts, fill, group, extra) => out.push({ corners: pts.map(([s, z]) => [x, s, z].map(r5)), normal: N.px, fill, group, ...(extra || {}) });
const bar = (out, x, a, b, w, fill, group = 'box:dress', extra) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * (w / 2), nz = (dx / l) * (w / 2); poly(out, x, [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]], fill, group, extra); };
const mix = (a, b, k) => rgbHex(hexRgb(a).map((v, i) => v + (hexRgb(b)[i] - v) * k));
const shade = (hex, k) => rgbHex(hexRgb(hex).map((v) => Math.min(1, v * k)));
/** a shaft drawn round: `n` strips across [s - r, s + r], each turned to its side, so a lamp lights its near side and
 * leaves its far side in shadow */
function roundShaft(out, x, s, r, z0, z1, fill, pc, n = 5) {
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / n, b = a + Math.PI / n;
    // (its middle strip the shaft's detail, the rest its light: a column is one thing to the eye, however it is shaded)
    face(out, x, s + r * Math.sin(a), s + r * Math.sin(b), z0, z1, fill, k === Math.floor(n / 2) ? 'box:dress' : 'box:relief', { tilt: [r5(Math.sin((a + b) / 2)), 0], pc });
  }
}
/** a pier at `c` from its floor to the top of its storey: its base, its shaft (a half-column or a chamfered pier), its
 * capital at `cap` (where the vault's ribs spring) and its respond above to the ceiling; its block in the light `occ` */
function pier(out, occ, c, floor, cap, z1, kind, L, pc) {
  const x = BACK + 0.05, r = 0.42, st = mix(L.stone, L.back, 0.25);
  face(out, x, c - r * 1.35, c + r * 1.35, floor, floor + 0.75, shade(st, 0.85), 'box:dress', { pillow: RELIEF.pillow, pc });
  face(out, x + 0.005, c - r * 1.2, c + r * 1.2, floor + 0.75, floor + 0.95, shade(st, 0.95), 'box:dress', { tilt: [0, 0.6], pc });
  if (kind === 'round') roundShaft(out, x, c, r, floor + 0.95, cap, st, pc);
  else {
    face(out, x, c - r, c - r * 0.6, floor + 0.95, cap, st, 'box:relief', { tilt: [-0.7, 0], pc });
    face(out, x, c - r * 0.6, c + r * 0.6, floor + 0.95, cap, st, 'box:dress', { pillow: 0.25, pc });
    face(out, x, c + r * 0.6, c + r, floor + 0.95, cap, st, 'box:relief', { tilt: [0.7, 0], pc });
  }
  poly(out, x + 0.005, [[c - r, cap], [c + r, cap], [c + r * 1.5, cap + 0.4], [c - r * 1.5, cap + 0.4]], shade(st, 0.95), 'box:dress', { tilt: [0, -0.45], pc });
  face(out, x + 0.01, c - r * 1.7, c + r * 1.7, cap + 0.4, cap + 0.6, shade(L.top, 0.85), 'box:dress', { tilt: [0, 0.6], pc });
  if (z1 > cap + 0.6) face(out, x, c - r * 0.8, c + r * 0.8, cap + 0.6, z1, shade(st, 0.85), 'box:dress', { pillow: 0.3, pc });
  occ.push({ pc, x0: BACK, x1: BACK + 0.45, s0: c - r * 1.2, s1: c + r * 1.2, z0: floor, z1 });
}

/** The box dressed in its theme. */
export function dressBox(B, theme) {
  const T = typeof theme === 'string' ? BOX_THEMES[theme] : theme, { layout: L, greybox: G } = B, W = G.screen.width, H = G.screen.height;
  const rings = L.rings.length, [cols, rows] = L.box, faces = [], lamps = [], night = [], flames = [], live = [], beams = [];
  const look = (ring) => lookOf(T, ring, rings), ringOf = new Map(L.rooms.map((r) => [r.id, r.ring]));
  // (a room's own look: its LOCALE over its ring's, themes.js roomLook; its corridors counted in its ring's walk order)
  // (each room's order among its ring's rooms of its kind, in the walk: the turn a look's list of locales is dealt by)
  const corridorAt = new Map(), seenCorr = new Map();
  for (const r of [...L.rooms].sort((a, b) => a.walk - b.walk)) { const key = `${r.ring}:${r.kind}`, k = seenCorr.get(key) ?? 0; corridorAt.set(r.id, k); seenCorr.set(key, k + 1); }
  const lookRoom = new Map(L.rooms.map((r) => [r.id, roomLook(T, r, rings, corridorAt.get(r.id) ?? 0)]));
  const cellRoom = new Map(L.rooms.flatMap((r) => r.cells.map((c) => [`${c[0]},${c[1]}`, r.id])));
  const lookAt = (s, z) => lookRoom.get(cellRoom.get(`${Math.floor(s / W)},${Math.floor(z / H)}`)) ?? look(0), spins = {};
  const cellRing = new Map(L.rooms.flatMap((r) => r.cells.map((c) => [`${c[0]},${c[1]}`, r.ring])));
  const ringAt = (s, z) => cellRing.get(`${Math.floor(s / W)},${Math.floor(z / H)}`) ?? 0;
  const anyOpen = L.rooms.some((r) => look(r.ring).open);
  // THE NIGHT: the sky in bands by height, the moon, the far towers (behind every open ring; a closed ring's wall hides it)
  if (anyOpen) {
    const dist = boxCameraOf(B.stature).dist, k = (W / 2) * (-SKY_X / dist) + W, top = rows * H + k, bot = -k;
    // (the bands meet edge to edge, never lapped: the page lifts a face that laps another on its plane a step toward the
    // eye, and a stack of lapped bands climbs, its top in front of the towers, the clouds and the stars)
    for (let z = Math.floor(bot / SKY_BAND) * SKY_BAND; z < top; z += SKY_BAND) face(night, SKY_X, -k * 2, cols * W + k * 2, z, z + SKY_BAND, mix(T.night.horizon, T.night.zenith, Math.min(1, Math.max(0, z / (rows * H)))), 'box:night');
    // (the moon in the frame of the box's top far corner: placed where the camera there sees it on the sky, by its parallax,
    // a little up and in from the frame's middle)
    const M = T.night.moon, par = (dist - MOON_X) / dist, cs = (cols - 0.5) * W, cz = (rows - 0.5) * H;
    const ms = cs - 0.2 * W * par, mz = cz + 0.24 * H * par, mr = M.r * par;
    // (the moon well in front of the sky, its halo just behind it, each a fan of triangles: the page draws a face of a few
    // corners, not a sixteen-sided one, and lays the sky's bands over what stands close behind them)
    const disc = (x, r, fill) => { for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8, b = ((i + 1) * Math.PI) / 8; poly(night, x, [[ms, mz], [ms + r * Math.cos(a), mz + r * Math.sin(a)], [ms + r * Math.cos(b), mz + r * Math.sin(b)]], fill, 'box:night'); } };
    disc(MOON_X, mr, M.colour);
    NIGHT.halo.forEach(([r, a], i) => disc(MOON_X - 0.4 - 0.2 * i, mr * r, mix(mix(T.night.horizon, T.night.zenith, Math.min(1, mz / (rows * H))), M.colour, a)));
    // (the far towers: the castle's own skyline beyond its walls, tall and thin, their roofs pointed)
    // (low on the horizon, slim and spaced, a little darker than the sky behind them: a skyline, never a curtain)
    for (let i = 0, s = -W * 0.5; s < cols * W + W * 0.5; i++) {
      const w = 2.5 + ((i * 7) % 4) * 0.6, h = 4 + ((i * 37) % 11), roof = w * 1.6;
      poly(night, TOWER_X, [[s, -k], [s + w, -k], [s + w, h], [s + w / 2, h + roof], [s, h]], T.night.towers, 'box:night');
      if (i % 3 === 1) face(night, TOWER_X + 0.02, s + w * 0.4, s + w * 0.6, h - 3, h - 1.8, '#d9a35a', 'box:night');   // (a lit window)
      s += w + 9 + ((i * 13) % 11);
    }
    // (THE NIGHT'S DEPTH: stars over the sky, thicker up it and none on the moon; long wisps of cloud lit on their moon
    // side; far mountains a step lighter than the towers and a forest ridge before their feet a step darker: the night
    // recedes by value, toward the horizon's glow)
    const nd = diceOf('night'), skyAt = (z) => mix(T.night.horizon, T.night.zenith, Math.min(1, Math.max(0, z / (rows * H))));
    const s0n = -k * 1.5, s1n = cols * W + k * 1.5, nStars = Math.round((s1n - s0n) * (top - bot) * NIGHT.stars);
    for (let i = 0; i < nStars; i++) {
      const s = s0n + nd() * (s1n - s0n), z = bot + nd() * (top - bot), b = nd(), r = NIGHT.star[0] + NIGHT.star[1] * b * b;
      if (Math.hypot(s - ms, z - mz) < mr * 3.2) continue;
      const fill = mix(skyAt(z), nd() < 0.2 ? '#ffe7c2' : '#e6ecff', 0.55 + 0.45 * b);
      poly(night, STAR_X, [[s - r, z], [s, z - r], [s + r, z], [s, z + r]], fill, 'box:stars');
      if (b > 0.88) { bar(night, STAR_X + 0.01, [s - r * 3, z], [s + r * 3, z], r * 0.35, fill, 'box:stars'); bar(night, STAR_X + 0.01, [s, z - r * 3], [s, z + r * 3], r * 0.35, fill, 'box:stars'); }
    }
    const Cn = NIGHT.cloud, M0 = T.night.moon.colour;
    // (a CLOUD: a flat-bottomed bank, puffs along its top lit on the moon's side, its underside in the night's shade;
    // each part a convex shape a step nearer than the last so none laps another on its plane)
    const cloud = (x, s, z, w, h, sky, k = 1) => {
      const lens = (dx, cs, cz, rw, rh, fill) => poly(night, x + dx, Array.from({ length: 14 }, (_, q) => { const a = (q / 14) * 2 * Math.PI; return [cs + rw * Math.cos(a), cz + rh * Math.sin(a) * (Math.sin(a) > 0 ? 1 : 0.4)]; }), fill, 'box:clouds');
      lens(0, s, z, w / 2, h, mix(sky, M0, 0.2 * k));
      const nd2 = diceOf(`cloud:${Math.round(s)}:${Math.round(z)}`);
      for (let q = 0; q < 3; q++) { const u = (q - 1) * 0.28 + (nd2() - 0.5) * 0.1, r = w * (0.13 + 0.07 * nd2()); lens(0.02 + 0.01 * q, s + u * w, z + h * 0.55, r, r * 0.7, mix(sky, M0, (0.32 + 0.08 * q) * k)); }
      lens(0.06, s + w * 0.08, z + h * 0.9, w * 0.32, h * 0.22, mix(sky, M0, 0.55 * k));
    };
    for (let s = s0n, i = 0; s < s1n; i++) {
      s += Cn.every[0] + nd() * (Cn.every[1] - Cn.every[0]);
      const w = Cn.w[0] + nd() * (Cn.w[1] - Cn.w[0]), h = Cn.h[0] + nd() * (Cn.h[1] - Cn.h[0]), z = 3 + nd() * (top - 3), sky = skyAt(z);
      cloud(CLOUD_X, s, z, w, h, sky);
    }
    // (and a bank crossing the moon, in front of it: the moonlight through the cloud)
    cloud(MOON_X + 0.5, ms - mr * 0.4, mz - mr * 0.55, mr * 3.6, mr * 0.45, skyAt(mz), 1.4);
    const ridge = (x, [lo, hi], fill, every, seed) => { const d = diceOf(seed), pts = [[s0n, bot]]; for (let s = s0n; s <= s1n; s += every) pts.push([s, lo + d() * (hi - lo)]); pts.push([s1n, bot]); for (let q = 1; q < pts.length - 2; q++) poly(night, x, [[pts[q][0], bot], [pts[q + 1][0], bot], [pts[q + 1][0], pts[q + 1][1]], [pts[q][0], pts[q][1]]], fill, 'box:night'); };
    ridge(MOUNT_X, NIGHT.mountains, mix(T.night.horizon, T.night.towers, 0.45), 9, 'mountains');
    ridge(RIDGE_X, NIGHT.ridge, shade(T.night.towers, 0.72), 2.2, 'ridge');
  }
  // THE BACKS, a room at a time, a cell at a time (backdrop.js: the backdrop's craft)
  const plan = {}, sizes = {}, occ = [];
  measure(sizes, 'block.w', ASHLAR.long[0] - 0.05); measure(sizes, 'block.w', ASHLAR.long[1] - 0.05);
  for (const h of ASHLAR.courses) measure(sizes, 'block.h', h - 0.05);
  for (const r of L.rooms) {
    const Lk = lookRoom.get(r.id), [c, rr, w, h] = r.rect, C = composeRoom(r, Lk), dice = diceOf(r.id), Wl = WALLS[Lk.wall ?? 'ashlar'];
    const P = plan[r.id] = { order: C.order, focals: 0, near: false, through: !!Lk.open, open: !!Lk.open, ...(Lk.locale ? { locale: Lk.locale } : {}) };
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
        // (1) THE WALL: laid in its WALLS' masonry (ashlar unsaid; a chapel's plaster, a clock tower's brick, the
        // catacombs' rock) in courses, each course its own height (the same along the row, seeded by its height in the
        // box) and each block its own length and stone, lit domed; its joints breaking bond course to course
        for (let z = z0; z < z1 - 1e-3;) {
          const n = Math.round(z / 0.05), ch = Wl.courses[Math.floor(diceOf(`course:${n}`)() * Wl.courses.length)];
          const zt = Math.min(z1, z + ch);
          for (let s = s0 - dice() * Wl.long[0]; s < s1 - 1e-3;) {
            const len = Wl.long[0] + dice() * (Wl.long[1] - Wl.long[0]), a = Math.max(s0, s), b = Math.min(s1, s + len);
            if (b - a > 0.1) face(faces, BACK, a, b - Wl.gap, z, zt - Wl.gap, shade(Lk.back, 1 - Wl.vary / 2 + dice() * Wl.vary), 'box:back', { pillow: Wl.gap ? RELIEF.pillow : 0.15 });
            s += len;
          }
          z = zt;
        }
        // (plaster wears its age: a few cracks; rock its seams)
        if (Lk.wall === 'plaster') for (let k = 0; k < 3; k++) { let p = [s0 + 1.5 + dice() * (W - 3), top - dice() * 2]; for (let q = 0; q < 3; q++) { const nx = [p[0] + (dice() - 0.5) * 1.2, p[1] - 0.5 - dice() * 0.7]; bar(faces, BACK + 0.012, p, nx, 0.035, shade(Lk.back, 0.6), 'box:dress'); p = nx; } }
        face(faces, BACK - 0.01, s0, s1, z0, z1, shade(Lk.back, 0.55), 'box:joint');   // (the mortar behind the blocks)
        // (structure: a pier at the cell's edge, a plinth or a wainscot along its floor, cobwebs in its top corners)
        if (Lk.pier) pier(faces, occ, s0 + 0.45, floor, top - 2.9, z1, Lk.pier, Lk, `pier:${c + i},${rr + j}`);
        else face(faces, BACK + 0.01, s0, s0 + 0.9, z0, z1, shade(Lk.back, 0.72), 'box:dress');
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
            // (a rib drawn moulded: its upper edge catching the light, its soffit under it in shade)
            for (const sp of [a + 0.5, a + W / 2 - 0.5]) { bar(faces, BACK + 0.02, [sp, z - 2.6], boss, 0.24, shade(Lk.top, 0.62), 'box:relief', { tilt: [0, -0.5] }); bar(faces, BACK + 0.025, [sp, z - 2.6 + 0.09], [boss[0], boss[1] + 0.09], 0.1, shade(Lk.top, 0.85), 'box:dress', { tilt: [0, 0.6] }); }
            face(faces, BACK + 0.03, boss[0] - 0.25, boss[0] + 0.25, z - 0.5, z - 0.05, Lk.trim, 'box:dress');
            if (!(Lk.pier && b === 0)) face(faces, BACK + 0.02, a + 0.2, a + 0.9, z - 2.9, z - 2.4, shade(Lk.top, 0.7), 'box:dress', { tilt: [0, -0.4] });   // (a corbel)
          } else if (Lk.ceiling === 'beams') {
            face(faces, BACK + 0.02, a, a + W / 2, z - 0.7, z - 0.1, '#3a2a1e', 'box:dress');
            bar(faces, BACK + 0.03, [a + 0.6, z - 2.2], [a + 1.8, z - 0.7], 0.2, '#33251a');
          }
        }
        // (4) THE BAYS by the wall's rhythm, the focal piece in its bay
        for (const b of [0, 1]) {
          const at = { s: s0 + W * (b ? 0.75 : 0.25), floor, top, x: BACK + 0.04 }, letter = C.order[(i * 2 + b) % C.order.length];
          const f0 = faces.length, o0 = occ.length, pc = `piece:${c + i},${rr + j},${b}`;
          const isFocal = j === 0 && i === C.focal.cell && b === C.focal.bay && P.focals === 0, drawn = isFocal ? Lk.focal : Lk.bays[letter === 'B' ? 1 : 0];
          if (isFocal) { drawPiece(faces, Lk.focal, { ...at, focal: true, spins, live }, Lk, dice, sizes, occ); P.focals++; }
          else drawPiece(faces, drawn, { ...at, spins, live }, Lk, dice, sizes, occ);
          for (let k = f0; k < faces.length; k++) faces[k].pc = pc;
          // (MOONLIGHT through an arched window: its glass shows the night, and a shaft falls from it to the floor, away
          // from the moon; it breathes as cloud passes the moon)
          if (drawn === 'arch') {
            const { aw, a0, a1 } = archOf(at), head = a1 + aw * 0.85, run = (head - floor) * MOONBEAM.slant;
            for (let k = f0; k < faces.length; k++) if (faces[k].group === 'box:glass') faces[k].sky = [a0, head];
            beams.push({ corners: [[BEAM_X, at.s - aw / 2, head - 0.4], [BEAM_X, at.s + aw / 2, head - 0.4], [BEAM_X, at.s + aw / 2 - run, floor + 0.04], [BEAM_X, at.s - aw / 2 - run, floor + 0.04]].map((q) => q.map(r5)), normal: N.px, fill: MOONBEAM.colour, alpha: MOONBEAM.alpha, group: 'box:beam' });
          }
          // (through STAINED glass the moonlight falls coloured: a shaft in one of its panes' colours)
          if (drawn === 'stained') {
            const { a0, a1 } = archOf(at), head = a1 + 1.6, run = (head - floor) * MOONBEAM.slant, cw = 1.0, col = mix(STAINED[Math.floor(diceOf(`beam:${pc}`)() * STAINED.length)], '#ffffff', 0.35);
            beams.push({ corners: [[BEAM_X, at.s - cw, head - 0.4], [BEAM_X, at.s + cw, head - 0.4], [BEAM_X, at.s + cw - run, floor + 0.04], [BEAM_X, at.s - cw - run, floor + 0.04]].map((q) => q.map(r5)), normal: N.px, fill: col, alpha: MOONBEAM.alpha * 1.2, group: 'box:beam' });
          }
          for (let k = o0; k < occ.length; k++) occ[k] = { ...occ[k], pc, x0: BACK, x1: BACK + occ[k].d };
          // (the bay's shafts: slender, either side of its piece, springing from carved corbels over her head (the band
          // she moves in kept calm) and rising to the vault's ribs)
          if (Lk.shafts && Lk.ceiling === 'vault') for (const d of [-2.45, 2.45]) {
            const ss = at.s + d, rib = top - 2.6 + 2.4 * (1 - Math.abs(d) / (W / 4 - 0.5)) - 0.15, spc = `shaft:${c + i},${rr + j},${b},${d}`, st = mix(Lk.stone, Lk.back, 0.25), cb = floor + SHAFT_FOOT;
            poly(faces, BACK + 0.05, [[ss - 0.3, cb + 0.35], [ss + 0.3, cb + 0.35], [ss + 0.12, cb - 0.25], [ss - 0.12, cb - 0.25]], shade(st, 0.85), 'box:dress', { tilt: [0, -0.5], pc: spc });
            roundShaft(faces, BACK + 0.05, ss, 0.16, cb + 0.35, rib - 0.3, st, spc, 3);
            poly(faces, BACK + 0.055, [[ss - 0.16, rib - 0.3], [ss + 0.16, rib - 0.3], [ss + 0.3, rib], [ss - 0.3, rib]], shade(Lk.top, 0.8), 'box:dress', { tilt: [0, -0.4], pc: spc });
            occ.push({ pc: spc, x0: BACK, x1: BACK + 0.2, s0: ss - 0.16, s1: ss + 0.16, z0: cb - 0.25, z1: rib });
          }
          if (['arch', 'stained'].includes(drawn) || (isFocal && Lk.focal === 'rose')) P.through = true;
          // (a lancet: a slit of moonlit glass high over the bay's piece, where the wall has no window)
          if (Lk.lancets && !(j === 0 && i === C.focal.cell && b === C.focal.bay)) { const ls = at.s, l1 = top - 1.0, l0 = l1 - 2.2; face(faces, BACK + 0.03, ls - 0.45, ls + 0.45, l0 - 0.15, l1, Lk.trim, 'box:dress'); poly(faces, BACK + 0.04, [[ls - 0.3, l0], [ls + 0.3, l0], [ls + 0.3, l1 - 0.5], [ls, l1 - 0.1], [ls - 0.3, l1 - 0.5]], '#5a6f9e', 'box:glass', { sky: [l0, l1] }); P.through = true; }
        }
        // (5) THE NEAR LAYER: between the lane and the wall, at the bays' meeting
        if (Lk.near === 'column') {
          const x = NEAR_X, cs = mid;
          // (the near layer stands between the lane and the light: half a silhouette, never brighter than the lane)
          const st = shade(Lk.stone, NEAR_SHADE), npc = `near:${c + i},${rr + j}`;
          face(faces, x, cs - 0.75, cs + 0.75, floor, floor + 0.6, shade(st, 0.85), 'box:dress', { pillow: RELIEF.pillow, pc: npc });
          face(faces, x + 0.005, cs - 0.62, cs + 0.62, floor + 0.6, floor + 0.8, shade(st, 0.95), 'box:dress', { tilt: [0, 0.6], pc: npc });
          roundShaft(faces, x, cs, 0.5, floor + 0.8, top - 1.2, st, npc, 7);
          poly(faces, x + 0.005, [[cs - 0.5, top - 1.2], [cs + 0.5, top - 1.2], [cs + 0.8, top - 0.8], [cs - 0.8, top - 0.8]], shade(st, 0.95), 'box:dress', { tilt: [0, -0.45], pc: npc });
          face(faces, x, cs - 0.85, cs + 0.85, top - 0.8, top, shade(Lk.top, NEAR_SHADE), 'box:dress', { tilt: [0, 0.3], pc: npc });
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
        // (its light where its flame stands, out from the wall on its bracket)
        lamps.push({ at: [kind === 'brazier' ? NEAR_X + 0.1 : Lk.open ? lx : BACK + RELIEF.flame, ls, lz], colour: Lk.lamp.colour, kind, room: r.id, reach: Lk.lamp.reach });
        const glow = { glow: `0 0 6px 2px ${Lk.lamp.colour}` };
        if (kind === 'torch') { face(faces, lx, ls - 0.12, ls + 0.12, lz - 1.1, lz - 0.1, '#2a2420', 'box:lamp'); flame(flames, lx + 0.02, ls, 0.22, lz - 0.1, lz + 0.6, Lk.lamp.colour, glow, live); }
        if (kind === 'candles') { face(faces, lx, ls - 0.04, ls + 0.04, lz - 0.6, lz - 0.2, Lk.trim, 'box:lamp'); face(faces, lx, ls - 0.32, ls + 0.32, lz - 0.24, lz - 0.18, Lk.trim, 'box:lamp'); measure(sizes, 'candle.h', 0.24); for (const d of [-0.26, 0, 0.26]) { face(faces, lx + 0.01, ls + d - 0.035, ls + d + 0.035, lz - 0.18, lz + (d ? 0.0 : 0.06), '#e8dcc0', 'box:lamp'); flame(flames, lx + 0.02, ls + d, 0.045, lz + (d ? 0.0 : 0.06), lz + (d ? 0.16 : 0.24), Lk.lamp.colour, d ? {} : glow, live); } }
        if (kind === 'ghost') { face(faces, lx, ls - 0.35, ls + 0.35, lz - 0.45, lz + 0.35, shade(Lk.trim, 0.8), 'box:lamp'); face(flames, lx + 0.02, ls - 0.22, ls + 0.22, lz - 0.3, lz + 0.2, Lk.lamp.colour, 'box:flame', glow); face(flames, lx + 0.025, ls - 0.14, ls + 0.14, lz - 0.22, lz + 0.12, mix(Lk.lamp.colour, '#ffffff', 0.5), 'box:ghost'); }
        if (kind === 'brazier') { const bx = NEAR_X + 0.1; face(faces, bx, ls - 0.1, ls + 0.1, floor, lz - 0.3, '#2a2022', 'box:lamp'); face(faces, bx, ls - 0.42, ls + 0.42, lz - 0.38, lz, '#3a2a26', 'box:lamp'); flame(flames, bx + 0.02, ls, 0.32, lz, lz + 0.65, Lk.lamp.colour, glow, live); }
      }
    }
  }
  // THE FABRIC: every closed part built as what it is (fabric.js): its paths, its walls quoined, its doorways arched,
  // its ledges in their material, its towers slit, the box crowned and founded
  const fabric = buildFabric(faces, { greybox: G, layout: L, theme: T, lookRoom, cols, rows, sizes });
  // THE RUNNER: down the floors of a ring whose look has one, cut round every hole and every gate in them
  // (a gate in a floor stands in its hole: the holes are every cut)
  const cuts = G.holes.map((h) => ({ s0: h.s0 - 0.2, s1: h.s1 + 0.2, z: h.z }));
  for (const r of L.rooms) {
    const Lk = lookRoom.get(r.id);
    if (!Lk.carpet) continue;
    const [c, rr, w] = r.rect, z = rr * H + FLOOR, s0 = c * W + 1.2, s1 = (c + w) * W - 1.2;
    const here = cuts.filter((q) => Math.abs(q.z - rr * H) < 1e-3 && q.s1 > s0 && q.s0 < s1).sort((a, b) => a.s0 - b.s0);
    let at = s0;
    for (const q of [...here, { s0: s1, s1 }]) {
      if (q.s0 - at > 0.5) quad(faces, [[-0.9, at, z + 0.025], [0.9, at, z + 0.025], [0.9, q.s0, z + 0.025], [-0.9, q.s0, z + 0.025]], N.top, Lk.carpet, 'box:runner');
      at = Math.max(at, q.s1);
    }
  }
  // THE LIGHT, baked at every corner: each into its ring's shadow, then warmed by the lamps near it, turned faces taking
  // more or less, what stands out of the wall casting its shadow and darkening the wall close round it
  const byCell = new Map(), occCell = new Map();
  for (const l of lamps) { const k = `${Math.floor(l.at[1] / W)},${Math.floor(l.at[2] / H)}`; (byCell.get(k) ?? byCell.set(k, []).get(k)).push(l); }
  for (const o of occ) for (let a = Math.floor(o.s0 / W); a <= Math.floor(o.s1 / W); a++) for (let b = Math.floor(o.z0 / H); b <= Math.floor(o.z1 / H); b++) { const k = `${a},${b}`; (occCell.get(k) ?? occCell.set(k, []).get(k)).push(o); }
  const around = (m, cs, cz) => { const o = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const v of m.get(`${cs + i},${cz + j}`) ?? []) o.push(v); return o; };
  // (a lamp hidden from a point by a block standing out of the wall: the segment between them through the block)
  const hides = (p, l, o) => {
    let t0 = 0, t1 = 1;
    for (const [a, b, lo, hi] of [[p[0], l[0], o.x0, o.x1], [p[1], l[1], o.s0, o.s1], [p[2], l[2], o.z0, o.z1]]) {
      const d = b - a;
      if (Math.abs(d) < 1e-9) { if (a < lo || a > hi) return false; continue; }
      let u = (lo - a) / d, v = (hi - a) / d;
      if (u > v) [u, v] = [v, u];
      t0 = Math.max(t0, u); t1 = Math.min(t1, v);
      if (t0 > t1) return false;
    }
    return t1 > 1e-3 && t0 < 1 - 1e-3;
  };
  const shine = (p, f, tilt, base, ls, os) => {
    const cz = Math.floor(p[2] / H), top = cz * H + H - CEIL, Lk = lookAt(p[1], p[2]);
    // (close round what stands out of the wall the dark gathers; and under the ceiling)
    let ao = 1;
    for (const o of os) {
      if (o.pc === f.pc || o.x1 <= p[0] + 0.02) continue;
      const dist = Math.hypot(Math.max(o.s0 - p[1], 0, p[1] - o.s1), Math.max(o.z0 - p[2], 0, p[2] - o.z1)), R = Math.min(1.1, 0.3 + (o.x1 - p[0]) * 1.2);
      if (dist < R) ao = Math.min(ao, 0.5 + 0.5 * (dist / R));
    }
    if (f.group === 'box:back' || f.group === 'box:joint') ao *= 0.68 + 0.32 * Math.min(1, Math.max(0, (top - p[2]) / 2.2));
    const tz = tilt ? tilt[1] : f.normal[2] > 0.5 ? 0.4 : 0, amb = (Lk.dark ?? SHADOW) * (1 + 0.3 * tz) * ao, add = [0, 0, 0];
    for (const l of ls) {
      const d = Math.hypot(p[1] - l.at[1], p[2] - l.at[2], (p[0] - l.at[0]) * 0.5), R = l.reach || LAMP_REACH;
      if (d >= R) continue;
      let k = (1 - d / R) ** 2 * WARM * Math.sqrt(ao);
      if (tilt) { const vs = l.at[1] - p[1], vz = l.at[2] - p[2], vl = Math.hypot(vs, vz) || 1; k *= Math.min(2.5, Math.max(0.08, 1 + RELIEF.turn * (tilt[0] * vs + tilt[1] * vz) / vl)); }
      if (os.some((o) => o.pc !== f.pc && hides(p, l.at, o))) k *= RELIEF.shadow;
      const c = hexRgb(l.colour);
      for (let q = 0; q < 3; q++) add[q] += k * c[q];
    }
    return base.map((v, q) => Math.min(1, v * (amb + add[q])));
  };
  const lit = (f) => {
    const n = f.corners.length, cx = f.corners.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n, a[2] + p[2] / n], [0, 0, 0]);
    const cs = Math.floor(cx[1] / W), cz = Math.floor(cx[2] / H), ls = around(byCell, cs, cz), os = around(occCell, cs, cz), base = hexRgb(f.fill);
    const { tilt, pillow, pc, sky, ...rest } = f;
    // (stained glass is lit from behind, by the night: it keeps its colours, a step brighter where a lamp is near)
    if (f.group === 'box:stained' || f.group === 'box:brew') return rest;
    let hs = 0, hz = 0;
    if (pillow) for (const p of f.corners) { hs = Math.max(hs, Math.abs(p[1] - cx[1])); hz = Math.max(hz, Math.abs(p[2] - cx[2])); }
    let cols = f.corners.map((p) => shine(p, f, tilt ?? (pillow ? [pillow * (p[1] - cx[1]) / (hs || 1), pillow * (p[2] - cx[2]) / (hz || 1)] : null), base, ls, os));
    // (a window's glass shows the night: pale on the moon's side at its foot, the dark at its head, a little of the room's
    // lamplight on it)
    if (sky) { const G0 = MOONBEAM.glass; cols = f.corners.map((p, q) => { const t = Math.max(0, Math.min(1, (p[2] - sky[0]) / (sky[1] - sky[0] || 1))), want = hexRgb(mix(mix(f.fill, T.night.moon.colour, G0.foot), mix(f.fill, T.night.zenith, G0.head), t)); return want.map((v, c) => Math.min(1, 0.78 * v + 0.22 * cols[q][c])); }); }
    const mean = [0, 1, 2].map((q) => cols.reduce((a, c) => a + c[q], 0) / n);
    return { ...rest, fill: rgbHex(mean), cornerFills: cols.map(rgbHex) };
  };
  // (7) DUST hanging in the light of the closed rooms (the page's motes), lit by every lamp near it
  const closed = L.rooms.filter((r) => !look(r.ring).open);
  const motes = closed.length ? { count: MOTES.count, boxes: closed.map((r) => [-2.9, r.rect[0] * W, r.rect[1] * H + FLOOR, 1.2, (r.rect[0] + r.rect[2]) * W, (r.rect[1] + r.rect[3]) * H - CEIL].map(r5)),
    lights: lamps.filter((l) => !look(ringOf.get(l.room)).open).map((l) => [l.at[0], l.at[1], l.at[2], (l.reach || LAMP_REACH) * 0.8].map(r5)), color: MOTES.color, size: MOTES.size, drift: MOTES.drift } : null;
  // (what moves behind the play: the stars twinkle, the clouds drift, the moonbeams breathe, the cold lamps pulse)
  const all = [...night, ...faces.map(lit), ...flames, ...beams], groups = new Set(all.map((f) => f.group));
  // (and the gears turn, the clocks' hands go round, the orreries' arms: each its own group about its own hub)
  const ambient = { groups: { ...Object.fromEntries(Object.entries(MOTION).filter(([g]) => groups.has(g))), ...Object.fromEntries(Object.entries(spins).filter(([g]) => groups.has(g))) } };
  return { faces: all, lamps, plan, sizes, fabric, ...(motes ? { motes } : {}), glow: GLOW, ...(live.length ? { live } : {}), ...(Object.keys(ambient.groups).length ? { ambient } : {}) };
}
