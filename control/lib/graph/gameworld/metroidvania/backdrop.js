/**
 * THE BACKDROP'S CRAFT (docs/metroidvania-map.md "The backdrop's craft"): in a side view the back wall does the work a
 * dungeon's walls do in 3D. What the eye reads in a room behind the lane, said as principles and measured as laws:
 *
 *   1  the back is the wall          a closed room's back is built, never painted flat: ashlar courses, a plinth along
 *                                    the floor, its structure at the bays (a pillar between cells, a vault or beams
 *                                    under the ceiling)
 *   2  detail by the EYE SEGMENT     a screen is EYE.across × EYE.up eye segments (a glance's worth of wall); every
 *                                    segment of a closed room holds DETAIL.min to DETAIL.max pieces of detail (faces of
 *                                    dress, each counted in every segment it covers), so none reads as a void and none
 *                                    as noise
 *   3  calm behind the play          the band the hero moves in (the lowest of a storey's segments) holds less detail
 *                                    than the bands above it: what she fights reads against it
 *   4  structure, dressing, story    bays dressed by the wall's rhythm (A and B, never three alike, never a pair
 *                                    repeated: era/wall-rhythm.js), and ONE focal piece a room, larger than a bay's,
 *                                    the thing the room is remembered by (a portrait, a statue, a coat of arms)
 *   5  three depths                  the near layer between the lane and the wall (a column, a hanging chain), the wall,
 *                                    and through it (a window's moonlit glass, the night over an open ring)
 *   6  light is pools in the dark    a dark mood: where no lamp reaches the wall falls to its ring's `dark`; light only
 *                                    from sources seen (a sconce, a brazier, a cold lamp, a torch), each a pool that
 *                                    falls off within its `reach`, its relief drawn by the light (a column lit round on
 *                                    its lamp's side, a block domed, what stands out casting its shadow across the wall
 *                                    and the dark gathered round it); measured, the share of a storey's wall lit above
 *                                    its dark (the wall's darker tenth) is POOLS.lit, and a pool's heart stands
 *                                    POOLS.contrast times that dark
 *   7  every flame glows             a flame is haloed (the page's glow sprites) and dust hangs in its light (motes)
 *   8  the lane reads                the tops she stands on are lighter than the wall behind them
 *   9  a kit, a composition          a ring's rooms draw on one kit (its look's bays, ceiling, near layer, focal piece);
 *                                    each room composed by a seeded hand from its own id, so neighbours differ
 *  10  she is the measure            a wall is read against the body on the lane: what a hand holds or a body uses keeps
 *                                    its true size (a book, a sword, a shield, a candle, a ladder's rung, a stone block),
 *                                    a figure is life-size to heroic and never colossal, and furniture stands on its
 *                                    floor; only the architecture (a window, a vault, a column, a banner's cloth) is as
 *                                    big as the hall. A tall hall is filled with more things at their size, never with
 *                                    the same things blown up, and a focal piece is made by its place, frame and light.
 *                                    SCALE says each part's sizes for a body of REF_STATURE, held to hers
 *
 *   EYE, DETAIL, POOLS, SCALE, REF_STATURE, BAY_PIECES, FOCAL_PIECES, DETAIL_GROUPS, BACKDROP_LAWS
 *   measure(sizes, part, v)            notes a drawn part's size ('book.h': its height) in a dress's sizes
 *   composeRoom(room, look, { cellsAcross }) → { order: 'ABBA…', focal: { cell, bay } }   the room's bays by the wall's rhythm
 *                                    (seeded by its id), and where its focal piece stands
 *   drawPiece(out, id, at, look, dice, sizes?, occ?)   a piece on the back at a bay: `at` { s, floor, top, x, focal? }
 *                                    (the bay's middle, the storey's floor and the underside of its ceiling, the wall's
 *                                    plane, whether it is the room's focal piece), its parts' sizes noted in `sizes`, what
 *                                    of it stands out of the wall in `occ` ({ s0, s1, z0, z1, d }: d metres out)
 *   backdropLaws(B, D, theme) → [{ id, holds, says, rooms? }]   measured on the box (B: scene.js boxOf's) and its dress
 *                                    (D: dress.js dressBox's faces and plan)
 *
 * Pure: a room's composition from its id, a piece's from its dice.
 */
import { rhythmFaults, wallRhythm } from '../../era/wall-rhythm.js';
import { r5, hexRgb, rgbHex } from '../../era/geom.js';
import { mulberry32 } from '../../city/plan/dice.js';

/** a screen in eye segments: four across, three up (a glance's worth of wall: about two of her heights each way) */
export const EYE = Object.freeze({ across: 4, up: 3 });
/** the detail a closed room's eye segment holds, in faces of dress: none is a void (no glance finds a bare wall), more
 * than `max` is noise */
export const DETAIL = Object.freeze({ min: 1, max: 60 });
/** the pools of light: the share of a storey's wall lit above its dark, and a pool's heart against the dark between */
export const POOLS = Object.freeze({ lit: Object.freeze([0.15, 0.7]), contrast: 2.5 });
/** what counts as detail: the dress's own faces, not the wall's blocks nor the closed parts */
export const DETAIL_GROUPS = Object.freeze(['box:dress', 'box:glass', 'box:lamp', 'box:flame', 'box:stained']);
// (a piece that turns is its own group, `box:turn:<id>`, so the page spins it about its hub; it is detail all the same)
const isDetail = (g) => DETAIL_GROUPS.includes(g) || (typeof g === 'string' && g.startsWith('box:turn:'));
export const BAY_PIECES = Object.freeze({
  arch: 'a pointed window of moonlit glass, its frame and its mullion',
  shelf: 'a library case standing on its floor: a cupboard base, boards of books at their size, a ladder',
  niche: 'a recessed arch and the statue standing in it',
  banner: 'a hanging banner on its rod, edged and striped in its trim',
  arms: 'a coat of arms: a shield and two blades crossed behind it',
  ivy: 'cracked stone, ivy grown over it',
  merlons: 'a parapet\'s teeth against the sky',
  stained: 'a lancet of stained glass, its panes in their colours, lit from behind by the night',
  gears: 'a clock\'s gears turning in the wall, meshed, each the other way from the one it drives',
  skulls: 'a niche of skulls stacked in their rows, the catacombs\' dead',
});
export const FOCAL_PIECES = Object.freeze({
  portrait: 'a great portrait in a gilt frame: the lord of the castle, looking down',
  statue: 'a broken statue on its plinth, its rubble at its foot',
  arms: 'the house\'s arms on a carved cartouche over the room, its blades still a sword\'s length',
  gargoyle: 'a gargoyle crouched on the parapet against the sky',
  rose: 'a rose window high in the chapel\'s wall, its petals of coloured glass round a heart of gold',
  clockface: 'the great clock\'s face over the room, its hands going round',
  sarcophagus: 'a stone coffin on its plinth, its lord carved lying on the lid',
  throne: 'the lord\'s throne on its dais under a canopy, its back a spire',
  orrery: 'an orrery hung under the roof, its worlds turning round a golden sun',
});
export const BACKDROP_LAWS = Object.freeze(['eye-detail', 'calm-play', 'bay-rhythm', 'focal', 'depths', 'pools', 'lane-reads', 'scale']);
/** the body SCALE's sizes are said for, in metres; a smaller or larger hero scales them */
export const REF_STATURE = 1.7;
/** (10) what keeps its true size, each part's measure [least, most] in metres for a body of REF_STATURE */
export const SCALE = Object.freeze({
  'book.h': Object.freeze([0.18, 0.45]), 'board.pitch': Object.freeze([0.3, 0.55]), 'case.lift': Object.freeze([0, 0.05]), 'case.h': Object.freeze([1.8, 4.2]),
  'rung.pitch': Object.freeze([0.25, 0.4]), 'sword.l': Object.freeze([0.8, 1.6]), 'shield.h': Object.freeze([0.5, 1.4]), 'face.w': Object.freeze([0.12, 0.4]),
  'figure.h': Object.freeze([1.5, 3.2]), 'gargoyle.h': Object.freeze([0.5, 1.8]), 'candle.h': Object.freeze([0.1, 0.45]), 'block.w': Object.freeze([0.5, 1.8]),
  'block.h': Object.freeze([0.3, 0.9]),
});
/** note a drawn part's size: the least and the most of each kept */
export const measure = (sizes, part, v) => { if (!sizes) return; const o = sizes[part]; sizes[part] = o ? [Math.min(o[0], v), Math.max(o[1], v)] : [v, v]; };

const N = Object.freeze({ px: [1, 0, 0] });
const poly = (out, x, pts, fill, group = 'box:dress', extra) => out.push({ corners: pts.map(([s, z]) => [x, s, z].map(r5)), normal: N.px, fill, group, ...(extra || {}) });
const rect = (out, x, s0, s1, z0, z1, fill, group = 'box:dress', extra) => { if (s1 - s0 > 1e-4 && z1 - z0 > 1e-4) poly(out, x, [[s0, z0], [s1, z0], [s1, z1], [s0, z1]], fill, group, extra); };
// a bar from one point to another, `w` wide: a rib, a blade, a crack
const bar = (out, x, a, b, w, fill, group) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * (w / 2), nz = (dx / l) * (w / 2); poly(out, x, [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]], fill, group); };
/** stained glass's panes */
const STAINED_PANES = ['#c0303c', '#2c5cc4', '#e0aa30', '#3a9a5a', '#8a40b0', '#2c8cc4'];
const shade = (hex, k) => rgbHex(hexRgb(hex).map((v) => Math.min(1, v * k)));
const mix = (a, b, k) => rgbHex(hexRgb(a).map((v, i) => v + (hexRgb(b)[i] - v) * k));
const seedOf = (id) => { let h = 2166136261; for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619); return h >>> 0; };
export const diceOf = (id) => mulberry32(seedOf(String(id)));

/** A room's composition: its bays by the wall's rhythm, seeded by its id, and the cell and bay its focal piece takes. */
export function composeRoom(room, look, { cellsAcross = room.rect[2] } = {}) {
  const dice = diceOf(room.id), n = cellsAcross * 2;
  const order = wallRhythm(n, { kinds: look.bays[0] === look.bays[1] ? 1 : 2, pick: dice() });
  const cells = room.rect[2] * room.rect[3];
  // (the focal piece: off the middle, at a third of the room, in its lowest storey)
  const cell = Math.min(room.rect[2] - 1, Math.floor(room.rect[2] / 3)), bay = room.rect[2] === 1 ? Math.floor(dice() * 2) : (dice() < 0.5 ? 0 : 1);
  return { order: Array.isArray(order) ? order.join('') : String(order), focal: { cell, bay }, cells };
}

/** An arched window's measures at a bay: its width, its sill's line and where its arch springs (the pointed head rises
 * `aw * 0.85` over it). */
export const archOf = ({ floor, top }) => { const aw = 3.2; return { aw, a0: floor + 2.6, a1: Math.min(top - aw * 0.85 - 0.9, floor + 8.5) }; };

/** A piece on the back at a bay, at its true size (10). */
export function drawPiece(out, id, { s, floor, top, x, focal = false, spins }, L, dice, sizes, occ) {
  const at = { spins };
  const trim = L.trim, dark = shade(L.back, 0.55), mid = (floor + top) / 2;
  // (what stands out of the wall, `d` metres: it casts its shadow from each lamp, dress.js)
  const proud = (s0, s1, z0, z1, d) => { if (occ) occ.push({ s0, s1, z0, z1, d }); };
  if (id === 'arch') {
    const { aw, a0, a1 } = archOf({ floor, top });
    poly(out, x, [[s - aw / 2 - 0.35, a0 - 0.35], [s + aw / 2 + 0.35, a0 - 0.35], [s + aw / 2 + 0.35, a1], [s, a1 + aw * 0.85 + 0.45], [s - aw / 2 - 0.35, a1]], trim);
    poly(out, x + 0.01, [[s - aw / 2, a0], [s + aw / 2, a0], [s + aw / 2, a1], [s, a1 + aw * 0.85], [s - aw / 2, a1]], L.glass || '#4b5f86', 'box:glass');
    rect(out, x + 0.02, s - 0.06, s + 0.06, a0, a1 + aw * 0.8, trim);
    rect(out, x + 0.02, s - aw / 2, s + aw / 2, (a0 + a1) / 2 - 0.05, (a0 + a1) / 2 + 0.05, trim);   // (its transom)
    rect(out, x + 0.02, s - aw / 2 - 0.5, s + aw / 2 + 0.5, a0 - 0.55, a0 - 0.3, shade(L.top, 0.8));   // (its sill)
    proud(s - aw / 2 - 0.5, s + aw / 2 + 0.5, a0 - 0.55, a0 - 0.3, 0.25);
  } else if (id === 'shelf') {
    // (a library wall at the size of its books: a case on the floor, twice her height, a cupboard base under boards a
    // book's height apart; in a hall tall enough, a gallery over it and a second case on the gallery; a ladder between)
    const w = 2.2, z0 = floor, spines = ['#5a1c22', '#2f3f2a', '#4a3520', '#262c46', '#6b4e2a', '#3a2433'];
    const lower = caseOf(out, x, s, w, z0, Math.min(top - 1.2, z0 + 3.45), 1.05, trim, dark, spines, dice, sizes, true);
    proud(s - w / 2 - 0.22, s + w / 2 + 0.22, z0, lower + 0.3, 0.45);
    let l1 = lower - 0.1;
    if (top - z0 > 8.2) {
      // (the gallery: its floor on brackets, its rail, the upper case standing on it)
      const gz = z0 + 4.0, gw = w / 2 + 0.7;
      rect(out, x + 0.07, s - gw, s + gw, gz - 0.2, gz, shade(trim, 0.9));
      for (const d of [-gw + 0.2, gw - 0.2]) poly(out, x + 0.07, [[s + d - 0.15, gz - 0.2], [s + d + 0.15, gz - 0.2], [s + d, gz - 0.75]], shade(trim, 0.75));
      const upper = caseOf(out, x, s, w, gz, Math.min(top - 1.0, gz + 3.0), 0, trim, dark, spines, dice, sizes, !!L.calm);
      proud(s - gw, s + gw, gz - 0.2, gz, 1.0); proud(s - w / 2 - 0.22, s + w / 2 + 0.22, gz, upper + 0.3, 0.45);
      rect(out, x + 0.08, s - gw, s + gw, gz + 0.95, gz + 1.02, shade(trim, 0.85));   // (its rail)
      for (let b = s - gw + 0.1; b <= s + gw - 0.05; b += 0.6) rect(out, x + 0.08, b - 0.025, b + 0.025, gz, gz + 0.95, shade(trim, 0.8));
      l1 = gz + 0.95;
    }
    // (the ladder, its rungs a step apart, from the floor to the gallery's rail or the case's top)
    const ls = s + w / 2 - 0.45, rung = 0.32;
    for (const d of [-0.2, 0.2]) bar(out, x + 0.09, [ls + d - 0.12, z0], [ls + d, l1], 0.05, shade(trim, 0.7));
    for (let z = z0 + rung; z < l1 - 0.1; z += rung) { const k = (z - z0) / (l1 - z0); rect(out, x + 0.1, ls - 0.32 + k * 0.12, ls + 0.08 + k * 0.12, z - 0.02, z + 0.02, shade(trim, 0.7)); }
    measure(sizes, 'rung.pitch', rung);
  } else if (id === 'niche') {
    // (a statue in a niche at life and a little more, high in the wall over her head, on its corbelled ledge)
    const fig = 2.1, w = 1.5, z0 = floor + 2.9, z1 = z0 + fig + 0.35;
    poly(out, x, [[s - w / 2 - 0.25, z0 - 0.3], [s + w / 2 + 0.25, z0 - 0.3], [s + w / 2 + 0.25, z1], [s, z1 + w * 0.6 + 0.25], [s - w / 2 - 0.25, z1]], trim);
    poly(out, x + 0.01, [[s - w / 2, z0], [s + w / 2, z0], [s + w / 2, z1], [s, z1 + w * 0.6], [s - w / 2, z1]], shade(L.back, 0.4));
    rect(out, x + 0.01, s - w / 2 - 0.35, s + w / 2 + 0.35, z0 - 0.42, z0 - 0.3, shade(L.top, 0.85));   // (its ledge)
    poly(out, x + 0.01, [[s - 0.4, z0 - 0.42], [s + 0.4, z0 - 0.42], [s, z0 - 1.0]], shade(L.top, 0.75));   // (its corbel)
    figure(out, x + 0.02, s, z0, fig, mix(L.stone, '#d8d2c4', 0.35), sizes);
    proud(s - 0.4, s + 0.4, z0, z0 + fig, 0.3); proud(s - w / 2 - 0.35, s + w / 2 + 0.35, z0 - 0.42, z0 - 0.3, 0.3);
  } else if (id === 'banner') {
    const b1 = top - 0.9, b0 = Math.max(floor + 3, b1 - 6.4), c = L.carpet || '#6a1420';
    rect(out, x, s - 1.4, s + 1.4, b1, b1 + 0.15, trim);
    poly(out, x + 0.01, [[s - 1, b1], [s + 1, b1], [s + 1, b0], [s, b0 - 0.9], [s - 1, b0]], c);
    rect(out, x + 0.02, s - 1, s + 1, b1 - 0.2, b1, trim);
    rect(out, x + 0.02, s - 0.12, s + 0.12, b0 + 0.8, b1 - 0.6, trim);
    rect(out, x + 0.02, s - 0.6, s + 0.6, (b0 + b1) / 2 - 0.06, (b0 + b1) / 2 + 0.06, trim);
    proud(s - 1, s + 1, b0, b1, 0.06);
  } else if (id === 'arms') {
    // (a shield at a shield's size, two swords at a sword's crossed behind it; the focal arms on a carved cartouche)
    const cz = mid + 0.8, sh = focal ? 1.25 : 1.0, sw = sh * 0.8, blade = 1.25;
    if (focal) {
      const cw = 3.2, ch = 3.4;
      poly(out, x - 0.01, [[s - cw / 2, cz - ch * 0.42], [s + cw / 2, cz - ch * 0.42], [s + cw / 2 + 0.3, cz + ch * 0.3], [s, cz + ch * 0.58], [s - cw / 2 - 0.3, cz + ch * 0.3]], shade(L.stone, 0.9));
      poly(out, x - 0.005, [[s - cw / 2 + 0.25, cz - ch * 0.36], [s + cw / 2 - 0.25, cz - ch * 0.36], [s + cw / 2, cz + ch * 0.27], [s, cz + ch * 0.5], [s - cw / 2, cz + ch * 0.27]], L.carpet || '#6a1420');
    }
    const d = blade / 2 / Math.SQRT2;
    for (const k of [-1, 1]) {
      bar(out, x, [s - k * d, cz - d], [s + k * d, cz + d], 0.07, shade(L.top, 1.1));
      bar(out, x + 0.005, [s - k * d - k * 0.12, cz - d - 0.12], [s - k * d, cz - d], 0.05, '#3a2a1e');   // (its grip)
      bar(out, x + 0.005, [s - k * d - 0.12, cz - d + k * 0.12], [s - k * d + 0.12, cz - d - k * 0.12], 0.04, trim);   // (its guard)
    }
    measure(sizes, 'sword.l', blade + 0.17);
    poly(out, x + 0.01, [[s - sw / 2, cz + sh / 2], [s + sw / 2, cz + sh / 2], [s + sw / 2, cz - sh * 0.1], [s, cz - sh / 2], [s - sw / 2, cz - sh * 0.1]], trim);
    poly(out, x + 0.02, [[s - sw / 2 + 0.08, cz + sh / 2 - 0.08], [s + sw / 2 - 0.08, cz + sh / 2 - 0.08], [s + sw / 2 - 0.08, cz - sh * 0.1], [s, cz - sh / 2 + 0.1], [s - sw / 2 + 0.08, cz - sh * 0.1]], L.carpet || '#6a1420');
    rect(out, x + 0.03, s - 0.05, s + 0.05, cz - sh * 0.35, cz + sh * 0.4, trim);
    measure(sizes, 'shield.h', sh);
    proud(s - sw / 2, s + sw / 2, cz - sh / 2, cz + sh / 2, 0.15);
  } else if (id === 'ivy') {
    const leaf = ['#2f4a2a', '#3c5a32', '#26402a'];
    let p = [s - 1.6 + dice() * 0.8, top - 0.8];
    for (let k = 0; k < 4; k++) { const q = [p[0] + (dice() - 0.4) * 1.6, p[1] - 1.1 - dice() * 0.8]; bar(out, x, p, q, 0.07, shade(L.back, 0.45)); p = q; }
    for (let k = 0; k < 14; k++) {
      const ls = s - 2.2 + dice() * 4.4, lz = top - 0.6 - dice() * (top - floor) * 0.55, r = 0.18 + dice() * 0.2;
      poly(out, x + 0.02, [[ls - r, lz], [ls, lz + r], [ls + r, lz], [ls, lz - r]], leaf[Math.floor(dice() * leaf.length)]);
    }
  } else if (id === 'portrait') {
    // (the lord painted to the waist at a little over life, hung over her head: his face a face's size, his frame gilt)
    const w = 2.0, z0 = floor + 3.1, z1 = Math.min(top - 0.9, z0 + 2.7), f = 1.3, fc = (z0 + z1) / 2 + 0.35;
    rect(out, x, s - w / 2 - 0.28, s + w / 2 + 0.28, z0 - 0.28, z1 + 0.28, '#b08a3e');
    rect(out, x + 0.01, s - w / 2, s + w / 2, z0, z1, '#1c1418');
    rect(out, x + 0.02, s - w / 2 + 0.12, s + w / 2 - 0.12, z0 + 0.12, z1 - 0.12, '#2d1e26');
    // (his coat from the frame's foot to his collar, his hair round his face, his eyes)
    poly(out, x + 0.03, [[s - 0.62 * f, z0 + 0.12], [s + 0.62 * f, z0 + 0.12], [s + 0.5 * f, fc - 0.32 * f], [s + 0.12, fc - 0.2 * f], [s - 0.12, fc - 0.2 * f], [s - 0.5 * f, fc - 0.32 * f]], '#3a1420');
    poly(out, x + 0.035, [[s - 0.09, fc - 0.24 * f], [s + 0.09, fc - 0.24 * f], [s, fc - 0.05 * f]], '#cdbfae');   // (his stock)
    poly(out, x + 0.03, [[s - 0.17 * f, fc - 0.22 * f], [s + 0.17 * f, fc - 0.22 * f], [s + 0.15 * f, fc + 0.13 * f], [s, fc + 0.2 * f], [s - 0.15 * f, fc + 0.13 * f]], '#1a1014');
    poly(out, x + 0.04, [[s - 0.09 * f, fc - 0.12 * f], [s + 0.09 * f, fc - 0.12 * f], [s + 0.1 * f, fc + 0.06 * f], [s, fc + 0.12 * f], [s - 0.1 * f, fc + 0.06 * f]], '#d8c4b6');
    for (const e of [-0.04, 0.04]) rect(out, x + 0.05, s + e * f - 0.018, s + e * f + 0.018, fc + 0.02 * f, fc + 0.04 * f, '#2a0a10');
    measure(sizes, 'face.w', 0.2 * f);
    proud(s - w / 2 - 0.28, s + w / 2 + 0.28, z0 - 0.28, z1 + 0.28, 0.12);
    rect(out, x + 0.04, s - 0.3, s + 0.3, z0 - 0.24, z0 - 0.08, '#d0a95a');   // (its name, a plate on the frame)
  } else if (id === 'statue') {
    // (a broken statue at heroic size on its plinth, its rubble at its foot)
    const stone = mix(L.stone, '#cfcac0', 0.22), p = 1.0;
    rect(out, x, s - 0.9, s + 0.9, floor, floor + p - 0.15, shade(stone, 0.75));
    rect(out, x + 0.01, s - 1.05, s + 1.05, floor + p - 0.15, floor + p, shade(stone, 0.9));
    figure(out, x + 0.02, s, floor + p, 2.6, stone, sizes, true);
    proud(s - 1.05, s + 1.05, floor, floor + p, 0.6); proud(s - 0.45, s + 0.45, floor + p, floor + p + 2.6, 0.5);
    for (const [ds, w] of [[-1.5, 0.35], [1.3, 0.28], [1.7, 0.18]]) poly(out, x + 0.03, [[s + ds - w, floor], [s + ds + w, floor], [s + ds + w * 0.4, floor + w * 0.9]], shade(stone, 0.85));
  } else if (id === 'gargoyle') {
    // (a gargoyle a crouching beast's size on the parapet's coping)
    const g = shade(L.stone, 0.7), b = floor + 2.2, k = 0.5;
    poly(out, x, [[s - 0.9 * k, b], [s + 0.9 * k, b], [s + 0.7 * k, b + 1.2 * k], [s - 0.6 * k, b + 1.3 * k]], g);
    poly(out, x, [[s - 0.6 * k, b + 1.1 * k], [s - 2.2 * k, b + 2.4 * k], [s - 0.4 * k, b + 1.9 * k]], g);
    poly(out, x, [[s + 0.5 * k, b + 1.1 * k], [s + 2 * k, b + 2.3 * k], [s + 0.3 * k, b + 1.9 * k]], g);
    poly(out, x + 0.01, [[s + 0.4 * k, b + 1.2 * k], [s + 1.1 * k, b + 1.4 * k], [s + 1.2 * k, b + 1.9 * k], [s + 0.5 * k, b + 1.9 * k]], g);
    poly(out, x + 0.01, [[s + 0.6 * k, b + 1.9 * k], [s + 0.75 * k, b + 2.35 * k], [s + 0.9 * k, b + 1.9 * k]], g);
    measure(sizes, 'gargoyle.h', 2.4 * k);
  } else if (id === 'stained') {
    // (a lancet of coloured glass: its stone frame, its panes in rows under a pointed head, its leading between)
    const { a0, a1 } = archOf({ floor, top }), aw = 1.9, head = a1 + 1.6, cols = 2, rows = 5, ph = (a1 - a0) / rows;
    poly(out, x, [[s - aw / 2 - 0.3, a0 - 0.3], [s + aw / 2 + 0.3, a0 - 0.3], [s + aw / 2 + 0.3, a1], [s, head + 0.35], [s - aw / 2 - 0.3, a1]], trim);
    poly(out, x + 0.005, [[s - aw / 2, a0], [s + aw / 2, a0], [s + aw / 2, a1], [s, head], [s - aw / 2, a1]], '#1a1620');   // (its leading)
    const pane = (k) => STAINED_PANES[(Math.floor(dice() * STAINED_PANES.length) + k) % STAINED_PANES.length];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) rect(out, x + 0.01, s - aw / 2 + 0.06 + (c * aw) / cols, s - aw / 2 + ((c + 1) * aw) / cols - 0.06, a0 + r * ph + 0.06, a0 + (r + 1) * ph - 0.06, pane(r + c), 'box:stained');
    poly(out, x + 0.01, [[s - aw / 2 + 0.08, a1 + 0.06], [s + aw / 2 - 0.08, a1 + 0.06], [s, head - 0.12]], '#f0c040', 'box:stained');
    rect(out, x + 0.02, s - aw / 2 - 0.45, s + aw / 2 + 0.45, a0 - 0.5, a0 - 0.3, shade(L.top, 0.8));   // (its sill)
    proud(s - aw / 2 - 0.45, s + aw / 2 + 0.45, a0 - 0.5, a0 - 0.3, 0.25);
  } else if (id === 'rose') {
    // (a rose window high over the altar: a stone ring, petals of coloured glass round a heart of gold)
    const cz = Math.min(top - 3.2, floor + 7.4), R = 2.4;
    ring(out, x, s, cz, R + 0.35, 24, trim);
    ring(out, x + 0.005, s, cz, R, 24, '#1a1620');
    for (let k = 0; k < 12; k++) {
      const a0 = (k / 12) * 2 * Math.PI, a1 = ((k + 0.82) / 12) * 2 * Math.PI, ri = R * 0.48, ro = R * 0.94;
      poly(out, x + 0.01, [[s + ri * Math.cos(a0), cz + ri * Math.sin(a0)], [s + ro * Math.cos(a0), cz + ro * Math.sin(a0)], [s + ro * Math.cos(a1), cz + ro * Math.sin(a1)], [s + ri * Math.cos(a1), cz + ri * Math.sin(a1)]], STAINED_PANES[k % STAINED_PANES.length], 'box:stained');
    }
    ring(out, x + 0.015, s, cz, R * 0.42, 12, '#e8b838', 'box:stained');
    ring(out, x + 0.02, s, cz, R * 0.2, 8, '#c0303c', 'box:stained');
    // (an altar under it, its cloth and two candlesticks)
    rect(out, x + 0.02, s - 1.3, s + 1.3, floor, floor + 1.05, shade(L.stone, 0.8));
    rect(out, x + 0.03, s - 1.4, s + 1.4, floor + 1.05, floor + 1.15, shade(L.top, 0.9));
    rect(out, x + 0.035, s - 0.5, s + 0.5, floor + 0.3, floor + 1.05, L.carpet || '#3c2c66');
    proud(s - 1.4, s + 1.4, floor, floor + 1.15, 0.7);
  } else if (id === 'gears') {
    // (three gears meshed in the wall, each turning the other way from the one that drives it, the small ones faster)
    const base = floor + 3.4, set = [[s - 1.2, base + 1.7, 1.25], [s + 0.85, base + 0.75, 0.72], [s + 0.55, base + 3.35, 0.82]];
    set.forEach(([gs, gz, r], k) => gear(out, x + 0.02 + 0.01 * k, gs, gz, r, k % 2 ? 1 : -1, shade(trim, 0.75 + 0.1 * k), at.spins, `${Math.round(gs * 100)}:${Math.round(gz * 100)}`));
    proud(s - 2.5, s + 1.6, base - 0.2, base + 4.2, 0.12);
  } else if (id === 'clockface') {
    // (the great clock's face: its rim, its dial, its hours, its hands going round, the minute's a turn a minute)
    const cz = Math.min(top - 3.4, floor + 7.0), R = 2.6;
    ring(out, x, s, cz, R + 0.3, 28, trim);
    ring(out, x + 0.005, s, cz, R, 28, '#e8dcc0');
    for (let k = 0; k < 12; k++) { const a = (k / 12) * 2 * Math.PI, q = k % 3 ? 0.07 : 0.13, l0 = R * (k % 3 ? 0.84 : 0.78); bar(out, x + 0.01, [s + l0 * Math.sin(a), cz + l0 * Math.cos(a)], [s + R * 0.92 * Math.sin(a), cz + R * 0.92 * Math.cos(a)], q * 1.6, '#2a2220'); }
    const id0 = `clock:${Math.round(s * 100)}:${Math.round(cz * 100)}`, hand = (g, len, w, rate) => { poly(out, x + 0.02, [[s - w, cz - 0.3], [s + w, cz - 0.3], [s + w * 0.5, cz + len], [s - w * 0.5, cz + len]], '#1c1614', g); if (at.spins) at.spins[g] = { spin: { at: [Math.round(s * 1000) / 1000, Math.round(cz * 1000) / 1000], rate } }; };
    hand(`box:turn:${id0}:h`, R * 0.55, 0.12, -0.012);
    hand(`box:turn:${id0}:m`, R * 0.86, 0.08, -0.105);
    ring(out, x + 0.03, s, cz, 0.16, 8, trim);
    proud(s - R - 0.3, s + R + 0.3, cz - R - 0.3, cz + R + 0.3, 0.2);
  } else if (id === 'skulls') {
    // (a niche cut in the rock, skulls stacked in it at their size, two rows of them)
    const w = 2.6, z0 = floor + 2.7, z1 = z0 + 1.7, bone = '#cfc4a8', sk = 0.22;
    rect(out, x, s - w / 2 - 0.2, s + w / 2 + 0.2, z0 - 0.2, z1 + 0.2, shade(L.back, 0.75));
    rect(out, x + 0.005, s - w / 2, s + w / 2, z0, z1, shade(L.back, 0.3));
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
      const cs = s - w / 2 + 0.33 + c * 0.64 + (r ? 0.16 : 0), cz = z0 + 0.42 + r * 0.72;
      ring(out, x + 0.01, cs, cz, sk, 8, shade(bone, 0.85 + dice() * 0.2));
      for (const e of [-0.08, 0.08]) rect(out, x + 0.02, cs + e - 0.045, cs + e + 0.045, cz - 0.02, cz + 0.06, '#1a1410');
    }
    measure(sizes, 'face.w', sk * 2 * 0.7);
    proud(s - w / 2 - 0.2, s + w / 2 + 0.2, z0 - 0.2, z0, 0.2);
  } else if (id === 'sarcophagus') {
    // (a stone coffin on its plinth, its lord carved lying on the lid, hands folded on a sword)
    const st = mix(L.stone, '#d8d0c0', 0.25), b0 = floor, b1 = floor + 0.35, c1 = b1 + 1.0, len = 2.6;
    rect(out, x, s - len / 2 - 0.3, s + len / 2 + 0.3, b0, b1, shade(st, 0.7));
    rect(out, x + 0.01, s - len / 2, s + len / 2, b1, c1, shade(st, 0.85));
    for (const d of [-0.8, 0, 0.8]) rect(out, x + 0.015, s + d - 0.3, s + d + 0.3, b1 + 0.2, c1 - 0.2, shade(st, 0.72));   // (its panels)
    rect(out, x + 0.02, s - len / 2 - 0.1, s + len / 2 + 0.1, c1, c1 + 0.18, st);   // (its lid)
    poly(out, x + 0.03, [[s - len / 2 + 0.25, c1 + 0.18], [s + len / 2 - 0.55, c1 + 0.18], [s + len / 2 - 0.65, c1 + 0.42], [s - len / 2 + 0.35, c1 + 0.38]], shade(st, 1.08));   // (the lord, lying)
    ring(out, x + 0.035, s + len / 2 - 0.42, c1 + 0.38, 0.17, 8, shade(st, 1.1));   // (his head)
    measure(sizes, 'figure.h', len - 0.4);
    proud(s - len / 2 - 0.3, s + len / 2 + 0.3, b0, c1 + 0.4, 0.6);
  } else if (id === 'throne') {
    // (the lord's throne on its dais of three steps, its back a spire in his colours, a canopy over it, drapes either side)
    const c = L.carpet || '#9a1222', st = shade(L.stone, 0.9);
    rect(out, x, s - 2.4, s + 2.4, floor, floor + 0.45, shade(st, 0.9));   // (its dais)
    const seat = floor + 0.45 + 0.5, back = seat + 2.6;
    poly(out, x + 0.04, [[s - 0.85, seat], [s + 0.85, seat], [s + 0.85, back - 0.6], [s, back + 0.5], [s - 0.85, back - 0.6]], trim);
    poly(out, x + 0.045, [[s - 0.65, seat + 0.1], [s + 0.65, seat + 0.1], [s + 0.65, back - 0.7], [s, back + 0.15], [s - 0.65, back - 0.7]], c);
    rect(out, x + 0.05, s - 1.0, s + 1.0, seat - 0.5, seat, shade(trim, 0.8));   // (its seat)
    for (const d of [-1, 1]) rect(out, x + 0.055, s + d * 0.95 - 0.12, s + d * 0.95 + 0.12, seat - 0.5, seat + 0.55, trim);   // (its arms)
    const ct = Math.min(top - 0.8, back + 2.2);
    rect(out, x + 0.02, s - 2.2, s + 2.2, ct - 0.5, ct, trim);   // (the canopy's pelmet)
    for (const d of [-1, 1]) poly(out, x + 0.015, [[s + d * 2.2, ct - 0.5], [s + d * 1.5, ct - 0.5], [s + d * 1.9, ct - 3.2], [s + d * 2.35, ct - 3.0]], shade(c, 0.85));
    // (his crest over the canopy: a shield in his colours under a crown)
    const cr = ct + 0.9;
    poly(out, x + 0.02, [[s - 0.55, cr + 0.55], [s + 0.55, cr + 0.55], [s + 0.55, cr - 0.1], [s, cr - 0.6], [s - 0.55, cr - 0.1]], trim);
    poly(out, x + 0.025, [[s - 0.42, cr + 0.45], [s + 0.42, cr + 0.45], [s + 0.42, cr - 0.08], [s, cr - 0.46], [s - 0.42, cr - 0.08]], c);
    poly(out, x + 0.02, [[s - 0.5, cr + 0.6], [s + 0.5, cr + 0.6], [s + 0.5, cr + 0.95], [s + 0.25, cr + 0.75], [s, cr + 1.0], [s - 0.25, cr + 0.75], [s - 0.5, cr + 0.95]], trim);
    measure(sizes, 'figure.h', 2.0);
    proud(s - 2.4, s + 2.4, floor, floor + 0.45, 0.8); proud(s - 1.0, s + 1.0, seat - 0.5, back, 0.5);
  } else if (id === 'orrery') {
    // (an orrery hung from the roof: a golden sun, three worlds each on its arm turning round it at its own pace)
    const cz = Math.min(top - 3.6, floor + 6.8), gold = '#e0b040';
    bar(out, x + 0.01, [s, top], [s, cz + 0.4], 0.08, shade(trim, 0.8));
    ring(out, x + 0.02, s, cz, 0.42, 10, gold);
    [[1.2, '#5a8ad0', 0.32, 0.18], [2.0, '#c0603a', 0.26, -0.12], [2.8, '#7ab070', 0.36, 0.08]].forEach(([r, col, pr, rate], k) => {
      const g = `box:turn:orrery:${Math.round(s * 100)}:${Math.round(cz * 100)}:${k}`;
      bar(out, x + 0.03 + 0.01 * k, [s, cz], [s + r, cz], 0.05, shade(gold, 0.8), g);
      ring(out, x + 0.035 + 0.01 * k, s + r, cz, pr, 8, col, g);
      if (at.spins) at.spins[g] = { spin: { at: [Math.round(s * 1000) / 1000, Math.round(cz * 1000) / 1000], rate } };
    });
    proud(s - 0.45, s + 0.45, cz - 0.45, cz + 0.45, 0.4);
  }
}

/** a disc of `n` sides */
function ring(out, x, s, z, r, n, fill, group = 'box:dress') { poly(out, x, Array.from({ length: n }, (_, k) => { const a = (k / n) * 2 * Math.PI; return [s + r * Math.cos(a), z + r * Math.sin(a)]; }), fill, group); }
/** a gear: its body, its teeth, its hub and its spokes, one group the page turns about its hub (`sense` its way round) */
function gear(out, x, s, z, r, sense, fill, spins, key) {
  const g = `box:turn:gear:${key}`, teeth = Math.max(8, Math.round(r * 9));
  ring(out, x, s, z, r * 0.86, teeth, fill, g);
  for (let k = 0; k < teeth; k++) { const a = (k / teeth) * 2 * Math.PI, h = Math.PI / teeth * 0.55, ri = r * 0.84, ro = r; poly(out, x - 0.002, [[s + ri * Math.cos(a - h), z + ri * Math.sin(a - h)], [s + ro * Math.cos(a - h * 0.7), z + ro * Math.sin(a - h * 0.7)], [s + ro * Math.cos(a + h * 0.7), z + ro * Math.sin(a + h * 0.7)], [s + ri * Math.cos(a + h), z + ri * Math.sin(a + h)]], fill, g); }
  ring(out, x + 0.005, s, z, r * 0.62, teeth, shade(fill, 0.6), g);
  for (let k = 0; k < 4; k++) { const a = (k / 4) * 2 * Math.PI + 0.4; bar(out, x + 0.01, [s, z], [s + r * 0.6 * Math.cos(a), z + r * 0.6 * Math.sin(a)], r * 0.14, fill, g); }
  ring(out, x + 0.015, s, z, r * 0.16, 8, shade(fill, 1.2), g);
  if (spins) spins[g] = { spin: { at: [Math.round(s * 1000) / 1000, Math.round(z * 1000) / 1000], rate: (sense * 0.32) / r } };
}

/** a case of books from `z0` to `z1`, its `base` a cupboard; the books in runs of their spines, a set bound alike to a
 * board when `sets` (calm: one tone a run, long runs), else volumes of every binding; returns its top */
function caseOf(out, x, s, w, z0, z1, base, trim, dark, spines, dice, sizes, sets) {
  const pitch = 0.4, half = [[s - w / 2, s - 0.04], [s + 0.04, s + w / 2]];
  rect(out, x, s - w / 2 - 0.1, s + w / 2 + 0.1, z0, z1 + 0.12, trim);
  rect(out, x + 0.01, s - w / 2 - 0.22, s + w / 2 + 0.22, z1 + 0.12, z1 + 0.3, shade(trim, 1.12));   // (its cornice)
  rect(out, x + 0.01, s - w / 2, s + w / 2, z0 + base, z1, dark);
  if (base) {
    rect(out, x + 0.01, s - w / 2, s + w / 2, z0 + 0.08, z0 + base - 0.06, shade(trim, 0.78));   // (its cupboard)
    rect(out, x + 0.02, s - 0.025, s + 0.025, z0 + 0.14, z0 + base - 0.12, shade(trim, 0.55));
  }
  rect(out, x + 0.02, s - 0.04, s + 0.04, z0 + base, z1, trim);   // (its middle stile)
  measure(sizes, 'case.lift', 0); measure(sizes, 'case.h', z1 + 0.3 - z0); measure(sizes, 'board.pitch', pitch);
  for (let zb = z0 + base + 0.04; zb + pitch <= z1 + 1e-6; zb += pitch) {
    rect(out, x + 0.02, s - w / 2, s + w / 2, zb - 0.04, zb, trim);
    for (const [a, b] of half) {
      const set = spines[Math.floor(dice() * spines.length)];
      for (let t = a + 0.03; t < b - 0.12;) {
        const rw = Math.min(b - 0.03 - t, sets ? 0.4 + dice() * 0.4 : 0.16 + dice() * 0.3), bh = sets ? 0.27 : 0.2 + dice() * 0.13;
        if (!sets && dice() < 0.14) {   // (a gap where books were taken, one leaning into it)
          const gw = 0.12 + dice() * 0.12;
          bar(out, x + 0.03, [t + 0.03, zb + 0.01], [t + gw - 0.02, zb + bh * 0.92], 0.05, spines[Math.floor(dice() * spines.length)]);
          measure(sizes, 'book.h', Math.hypot(gw - 0.05, bh * 0.92));
          t += gw; continue;
        }
        rect(out, x + 0.03, t, t + rw - 0.02, zb, zb + bh, sets ? shade(set, 0.9 + dice() * 0.2) : spines[Math.floor(dice() * spines.length)]);
        measure(sizes, 'book.h', bh);
        t += rw;
      }
    }
  }
  return z1;
}

/** a standing figure in stone, `h` tall from its feet at (s, z): legs in its robe, its body, its head; broken, its
 * raised arm's hand gone */
function figure(out, x, s, z, h, stone, sizes, broken = false) {
  const u = h / 8;   // (a head: eight heads a figure)
  poly(out, x, [[s - 1.1 * u, z], [s + 1.1 * u, z], [s + 0.9 * u, z + 4.4 * u], [s - 0.9 * u, z + 4.4 * u]], shade(stone, 0.92));   // (its robe)
  poly(out, x, [[s - 1.1 * u, z + 4.4 * u], [s + 1.1 * u, z + 4.4 * u], [s + 1.2 * u, z + 6.6 * u], [s - 1.2 * u, z + 6.6 * u]], stone);   // (its body)
  rect(out, x + 0.005, s - 0.3 * u, s + 0.3 * u, z + 6.6 * u, z + 7.0 * u, shade(stone, 0.85));
  poly(out, x + 0.01, [[s - 0.45 * u, z + 7.0 * u], [s + 0.45 * u, z + 7.0 * u], [s + 0.45 * u, z + 7.7 * u], [s, z + 8 * u], [s - 0.45 * u, z + 7.7 * u]], stone);
  bar(out, x + 0.01, [s - 1.1 * u, z + 6.3 * u], [s - 1.4 * u, z + 4.2 * u], 0.5 * u, shade(stone, 0.95));
  if (broken) bar(out, x + 0.01, [s + 1.1 * u, z + 6.3 * u], [s + 2 * u, z + 7.6 * u], 0.5 * u, shade(stone, 0.95));
  else bar(out, x + 0.01, [s + 1.1 * u, z + 6.3 * u], [s + 1.3 * u, z + 4.3 * u], 0.5 * u, shade(stone, 0.95));
  measure(sizes, 'figure.h', h);
}

const lum = (hex) => { const c = hexRgb(hex).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const centre = (f) => { const n = f.corners.length; return f.corners.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n, a[2] + p[2] / n], [0, 0, 0]); };

/** The backdrop's laws, measured on the box and its dress. */
export function backdropLaws(B, D) {
  const { layout: L, greybox: G } = B, W = G.screen.width, H = G.screen.height, out = [];
  const law = (id, holds, says, rooms) => out.push({ id, holds: !!holds, says, ...(rooms && rooms.length ? { rooms: [...new Set(rooms)] } : {}) });
  const closed = L.rooms.filter((r) => !D.plan[r.id]?.open);
  // count the dress's faces by eye segment, a cell at a time
  const seg = new Map(), cellOf = (s, z) => `${Math.floor(s / W)},${Math.floor(z / H)}`;
  // (a piece counts in every eye segment it covers: a plinth along a whole cell is seen in every glance along it)
  const sw = W / EYE.across, sh = H / EYE.up;
  for (const f of D.faces) {
    if (!isDetail(f.group)) continue;
    const ss = f.corners.map((p) => p[1]), zs = f.corners.map((p) => p[2]);
    const i0 = Math.floor(Math.min(...ss) / sw + 1e-6), i1 = Math.floor(Math.max(...ss) / sw - 1e-6), j0 = Math.floor(Math.min(...zs) / sh + 1e-6), j1 = Math.floor(Math.max(...zs) / sh - 1e-6);
    for (let gi = i0; gi <= Math.max(i0, i1); gi++) for (let gj = j0; gj <= Math.max(j0, j1); gj++) {
      const cs = Math.floor(gi / EYE.across), cz = Math.floor(gj / EYE.up), k = `${cs},${cz}`;
      const a = seg.get(k) ?? seg.set(k, Array.from({ length: EYE.up }, () => Array(EYE.across).fill(0))).get(k);
      a[gj - cz * EYE.up][gi - cs * EYE.across]++;
    }
  }
  // (2) every eye segment of a closed room's cell holds its detail within the bounds
  const bare = [], busy = [];
  for (const r of closed) for (const c of r.cells) {
    const a = seg.get(`${c[0]},${c[1]}`) ?? Array.from({ length: EYE.up }, () => Array(EYE.across).fill(0));
    const flat = a.flat();
    if (Math.min(...flat) < DETAIL.min) bare.push(r.id);
    if (Math.max(...flat) > DETAIL.max) busy.push(r.id);
  }
  law('eye-detail', !bare.length && !busy.length, bare.length || busy.length ? [bare.length ? `an eye segment bare in ${[...new Set(bare)].join(', ')}` : '', busy.length ? `an eye segment past ${DETAIL.max} pieces in ${[...new Set(busy)].join(', ')}` : ''].filter(Boolean).join('; ') : `every eye segment of every closed room holds ${DETAIL.min} to ${DETAIL.max} pieces of detail (${EYE.across} × ${EYE.up} a screen)`, [...bare, ...busy]);
  // (3) calm behind the play: the play band no busier than the bands above it
  const loud = [];
  for (const r of closed) for (const c of r.cells) {
    const a = seg.get(`${c[0]},${c[1]}`);
    if (!a) continue;
    const low = a[0].reduce((x, y) => x + y, 0), above = a.slice(1).flat().reduce((x, y) => x + y, 0) / (EYE.up - 1);
    if (low > above) loud.push(r.id);
  }
  law('calm-play', !loud.length, loud.length ? `the play band busier than the wall above it in ${[...new Set(loud)].join(', ')}` : 'behind the play the wall is calmer than above it in every closed room', loud);
  // (4) the bays by the wall's rhythm, and a focal piece a room
  const broken = Object.entries(D.plan).filter(([, p]) => p.order && rhythmFaults(p.order).length).map(([id]) => id);
  law('bay-rhythm', !broken.length, broken.length ? `bays out of rhythm in ${broken.join(', ')}` : 'every room\'s bays keep the wall\'s rhythm: never three alike, never a pair repeated', broken);
  const unfocused = L.rooms.filter((r) => (D.plan[r.id]?.focals ?? 0) !== 1).map((r) => r.id);
  law('focal', !unfocused.length, unfocused.length ? `${unfocused.length} room${unfocused.length === 1 ? '' : 's'} without one focal piece: ${unfocused.slice(0, 6).join(', ')}${unfocused.length > 6 ? '…' : ''}` : 'every room holds one focal piece', unfocused);
  // (5) three depths: the near layer, the wall, and through it (glass, or the night)
  const shallow = closed.filter((r) => !(D.plan[r.id]?.near && D.plan[r.id]?.through)).map((r) => r.id);
  law('depths', !shallow.length, shallow.length ? `${shallow.length} closed room${shallow.length === 1 ? '' : 's'} short of three depths: ${shallow.slice(0, 6).join(', ')}${shallow.length > 6 ? '…' : ''}` : 'every closed room shows the near layer, the wall and something through it', shallow);
  // (6) pools in the dark: a storey's wall lit in part, its pools' hearts well above the dark
  const flat = [], washed = [];
  const backs = D.faces.filter((f) => f.group === 'box:back');
  for (const r of closed) for (const c of r.cells) {
    const mine = backs.filter((f) => { const p = centre(f); return Math.floor(p[1] / W) === c[0] && Math.floor(p[2] / H) === c[1]; });
    if (!mine.length) continue;
    // (its dark the wall's darker tenth: the corners the dark gathers in, under a ceiling and round a pier, fall below it)
    const ls = mine.map((f) => lum(f.fill)).sort((a, b) => a - b), lo = ls[Math.floor(0.1 * (ls.length - 1))], hi = ls.at(-1), share = ls.filter((v) => v > lo * 1.6).length / ls.length;
    if (hi < lo * POOLS.contrast) flat.push(r.id);
    else if (share < POOLS.lit[0] || share > POOLS.lit[1]) washed.push(r.id);
  }
  law('pools', !flat.length && !washed.length, flat.length || washed.length ? [flat.length ? `no pool stands ${POOLS.contrast} times its dark in ${[...new Set(flat)].join(', ')}` : '', washed.length ? `lit outside ${POOLS.lit.join('–')} of its wall in ${[...new Set(washed)].join(', ')}` : ''].filter(Boolean).join('; ') : `light in pools: every storey's wall lit ${POOLS.lit[0] * 100}–${POOLS.lit[1] * 100}% above its dark, each pool ${POOLS.contrast} times the dark between`, [...flat, ...washed]);
  // (8) the lane reads: the tops she stands on lighter than the wall behind them
  const sunk = [];
  const tops = D.faces.filter((f) => (f.group === 'box:stone' || f.group === 'box:ledge') && f.normal[2] > 0.5);
  for (const r of closed) {
    const [c, rr, w, h] = r.rect, inRoom = (p) => p[1] >= c * W && p[1] <= (c + w) * W && p[2] >= rr * H && p[2] <= (rr + h) * H;
    const T = tops.filter((f) => inRoom(centre(f))), K = backs.filter((f) => inRoom(centre(f)));
    if (!T.length || !K.length) continue;
    const t = T.reduce((a, f) => a + lum(f.fill), 0) / T.length, k = K.reduce((a, f) => a + lum(f.fill), 0) / K.length;
    if (t <= k) sunk.push(r.id);
  }
  law('lane-reads', !sunk.length, sunk.length ? `the tops sink into the wall behind them in ${sunk.join(', ')}` : 'in every closed room the tops she stands on are lighter than the wall behind them', sunk);
  // (10) she is the measure: every part that keeps its size within SCALE's, at her stature
  const k = (G.hero?.stature ?? REF_STATURE) / REF_STATURE, off = [];
  for (const [part, [lo, hi]] of Object.entries(D.sizes ?? {})) {
    const want = SCALE[part];
    if (want && (lo < want[0] * k - 1e-3 || hi > want[1] * k + 1e-3)) off.push(`a ${part.replace('.', "'s ")} of ${Math.round((hi > want[1] * k ? hi : lo) * 100) / 100} m (${Math.round(want[0] * k * 100) / 100}–${Math.round(want[1] * k * 100) / 100})`);
  }
  law('scale', D.sizes && !off.length, !D.sizes ? 'no part measured' : off.length ? `out of her scale: ${off.join('; ')}` : `${Object.keys(D.sizes).length} kinds of part at their true size against a body of ${Math.round(k * REF_STATURE * 100) / 100} m`);
  return out;
}
