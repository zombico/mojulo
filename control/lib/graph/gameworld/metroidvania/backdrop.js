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
export const DETAIL_GROUPS = Object.freeze(['box:dress', 'box:glass', 'box:lamp', 'box:flame', 'box:stained', 'box:brew', 'box:lava', 'box:water', 'box:sway', 'box:glowpod']);
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
  flasks: 'a shelf of potions, each glowing in its bottle',
  rack: 'a rack of spears and swords, a shield hung on it',
  cell: 'a prison cell let into the wall, its iron bars before the dark, straw on its floor',
  shackles: 'manacles on their chains, hung from rings in the wall at a body\'s reach',
  mirror: 'a tall mirror in a gilt frame, the hall\'s candlelight caught in its glass',
  antlers: 'a stag\'s antlers on their shield, mounted high',
  chart: 'a chart of the stars on its roundel, its constellations joined',
  // (a planet's, XenoJager's: the same bays, its rock and its life)
  boulders: 'boulders fallen against the cave wall, heaped as they came to rest, the smaller on the larger',
  crystals: 'a cluster of crystals grown out of the rock, each glowing in its own colour',
  fungus: 'a stand of giant fungi on their stalks, their caps\' gills lit from under',
  tendrils: 'tendrils of the planet\'s growing hung from a crack high in the rock, swaying, their tips lit',
  waterfall: 'water falling from a crack in the rock into its pool, its spray at the foot',
  lavafall: 'lava pouring from a vent high in the rock, glowing, its crust cooling at the edges',
  ruin: 'a carved pillar of a people before, broken and leaning, its glyphs worn',
  pods: 'a cluster of egg pods stuck to the rock in their slime, each pulsing',
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
  cauldron: 'the alchemist\'s cauldron on its fire, its brew glowing and bubbling',
  armour: 'a suit of armour on its stand, a halberd in its hand',
  gibbet: 'an iron cage hung on its chain from the roof, its bars and its bones',
  chandelier: 'a great chandelier hung from the roof, tier on tier of candles burning',
  hearth: 'a great hearth, its stone hood and mantel, logs burning in it, the house\'s crest over it',
  telescope: 'a brass telescope on its mount, aimed up at a window of night',
  lander: 'the explorer\'s lander on its legs on the rim, its hatch open, its beacon blinking',
  bloom: 'a great bloom of the planet, a flower the size of a house, its petals lit and breathing',
  fossil: 'the fossil of something vast set in the rock: its spine, its ribs and its skull',
  monolith: 'a monolith of the people before, carved and glowing in its seams',
  beacon: 'the station\'s beacon: a mast of the explorer\'s own, its lamp lit, its panel showing',
  nest: 'the nest of the thing below: a mound of rock and slime, its pods round it, its heart glowing',
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
  'bar.pitch': Object.freeze([0.18, 0.4]), 'cell.h': Object.freeze([2.4, 3.6]), 'mirror.h': Object.freeze([2.0, 3.6]), 'hearth.h': Object.freeze([2.2, 3.4]),
  // (a planet's: a boulder she could hide behind, a crystal her arm's length to her height, a fungus over her head)
  'boulder.r': Object.freeze([0.9, 2.2]), 'crystal.l': Object.freeze([0.8, 2.6]), 'fungus.h': Object.freeze([1.4, 5.0]), 'pillar.h': Object.freeze([2.5, 6.0]),
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
export function drawPiece(out, id, { s, floor, top, x, focal = false, spins, live }, L, dice, sizes, occ) {
  const at = { spins, live };
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
  } else if (id === 'flasks') {
    // (a shelf of potions at a bottle's size: two boards on brackets, the bottles on them glowing in their colours)
    const z0 = floor + 3.0, potions = ['#7cff6a', '#ff5ad0', '#5ad8ff', '#ffc84a', '#b07cff'];
    for (const [k, zb] of [[0, z0], [1, z0 + 1.0]]) {
      rect(out, x, s - 1.4, s + 1.4, zb - 0.08, zb, trim);
      for (const d of [-1.2, 1.2]) poly(out, x, [[s + d - 0.1, zb - 0.08], [s + d + 0.1, zb - 0.08], [s + d, zb - 0.4]], shade(trim, 0.8));
      for (let b = 0; b < 5; b++) {
        const bs = s - 1.15 + b * 0.57 + (dice() - 0.5) * 0.1, bh = 0.24 + dice() * 0.18, bw = 0.09 + dice() * 0.06, c = potions[(b + k * 2) % potions.length];
        rect(out, x + 0.01, bs - bw, bs + bw, zb, zb + bh, c, 'box:brew');
        rect(out, x + 0.01, bs - 0.03, bs + 0.03, zb + bh, zb + bh + 0.12, shade(c, 0.7), 'box:brew');
        measure(sizes, 'candle.h', bh);
      }
    }
    proud(s - 1.4, s + 1.4, z0 - 0.08, z0 + 1.0, 0.3);
  } else if (id === 'cauldron') {
    // (the cauldron at a cauldron's size on its legs over its fire, its brew glowing and bubbling, live fire under it)
    const r = 0.85, cz = floor + 0.55 + r * 0.7, brew = '#7cff6a';
    for (const d of [-0.6, 0.6]) bar(out, x, [s + d, floor], [s + d * 0.8, cz - 0.3], 0.1, '#1e1a1a');
    ring(out, x + 0.01, s, cz, r, 14, '#22201f');
    rect(out, x + 0.015, s - r * 1.05, s + r * 1.05, cz + r * 0.55, cz + r * 0.72, '#2e2a28');   // (its rim)
    rect(out, x + 0.02, s - r * 0.95, s + r * 0.95, cz + r * 0.72, cz + r * 0.86, brew, 'box:brew');   // (its brew)
    for (let k = 0; k < 4; k++) ring(out, x + 0.025, s - r * 0.6 + k * r * 0.4, cz + r * (0.95 + 0.18 * dice()), 0.07 + 0.06 * dice(), 8, '#c8ffb8', 'box:brew');
    if (at.live) at.live.push({ at: [x + 0.06, s, floor + 0.02].map((v) => Math.round(v * 1e5) / 1e5), w: 1.1, h: 0.75, color: [1, 0.6, 0.25] });
    // (its hood over the fire and the flue up the wall, an alembic's coils and the herbs hung drying beside it)
    const hz = cz + r + 1.4;
    poly(out, x - 0.01, [[s - 1.5, hz], [s + 1.5, hz], [s + 0.45, hz + 1.3], [s - 0.45, hz + 1.3]], shade(L.stone, 0.75));
    rect(out, x - 0.01, s - 1.55, s + 1.55, hz - 0.15, hz, trim);
    rect(out, x - 0.015, s - 0.4, s + 0.4, hz + 1.3, Math.max(hz + 2, top - 0.3), shade(L.stone, 0.68));
    for (let k = 0; k < 3; k++) { const ks = s - 2.6 + k * 0.42, kz = hz + 0.4 + (k % 2) * 0.3; bar(out, x + 0.01, [ks, kz + 1.0], [ks, kz + 0.5], 0.03, '#5a4a30'); poly(out, x + 0.012, [[ks - 0.16, kz + 0.5], [ks + 0.16, kz + 0.5], [ks + 0.05, kz - 0.1], [ks - 0.05, kz - 0.1]], ['#5a7a3a', '#7a8a3a', '#6a5a2a'][k]); }
    ring(out, x + 0.01, s + 2.3, hz + 0.9, 0.35, 10, '#b07a3a');
    for (let k = 0; k < 3; k++) bar(out, x + 0.012, [s + 2.3 + 0.2, hz + 0.9 - k * 0.3], [s + 2.3 + 0.55, hz + 0.75 - k * 0.3], 0.05, '#c08a4a');
    proud(s - r, s + r, cz - r, cz + r, 0.8);
  } else if (id === 'rack') {
    // (a weapon rack at its size: two posts and its rails, spears standing in it, two swords and a shield hung on it)
    const z0 = floor + 2.9, z1 = z0 + 2.2, iron = shade(L.top, 1.05);
    for (const d of [-1.3, 1.3]) rect(out, x, s + d - 0.07, s + d + 0.07, z0, z1, trim);
    for (const zr of [z0 + 0.3, z1 - 0.25]) rect(out, x + 0.005, s - 1.4, s + 1.4, zr - 0.05, zr + 0.05, shade(trim, 0.85));
    for (const d of [-0.9, -0.55]) { bar(out, x + 0.01, [s + d, z0], [s + d, z1 + 0.5], 0.05, '#5a4030'); poly(out, x + 0.015, [[s + d - 0.07, z1 + 0.5], [s + d + 0.07, z1 + 0.5], [s + d, z1 + 0.78]], iron); }
    for (const d of [0.15, 0.45]) { bar(out, x + 0.01, [s + d, z0 + 0.2], [s + d, z0 + 1.3], 0.07, iron); rect(out, x + 0.015, s + d - 0.13, s + d + 0.13, z0 + 1.3, z0 + 1.35, trim); rect(out, x + 0.015, s + d - 0.03, s + d + 0.03, z0 + 1.35, z0 + 1.55, '#3a2a1e'); }
    measure(sizes, 'sword.l', 1.35);
    poly(out, x + 0.02, [[s + 0.75, z1 - 0.35], [s + 1.25, z1 - 0.35], [s + 1.25, z1 - 0.95], [s + 1.0, z1 - 1.25], [s + 0.75, z1 - 0.95]], L.carpet || '#6a1420');
    measure(sizes, 'shield.h', 0.9);
    proud(s - 1.4, s + 1.4, z0, z1, 0.25);
  } else if (id === 'armour') {
    // (a suit of armour at a man's size on its stand: greaves, a cuirass, pauldrons, a helm and its visor, a halberd)
    const st = shade(L.top, 1.1), dk = shade(L.top, 0.7), b = floor + 0.35, u = 1.85 / 8;
    rect(out, x, s - 0.7, s + 0.7, floor, b, shade(L.stone, 0.8));
    for (const d of [-0.18, 0.18]) rect(out, x + 0.01, s + d - 0.11, s + d + 0.11, b, b + 3.6 * u, d < 0 ? st : dk);
    poly(out, x + 0.015, [[s - 0.34, b + 3.6 * u], [s + 0.34, b + 3.6 * u], [s + 0.42, b + 6.2 * u], [s - 0.42, b + 6.2 * u]], st);
    for (const d of [-1, 1]) { ring(out, x + 0.02, s + d * 0.48, b + 6.0 * u, 0.17, 8, dk); rect(out, x + 0.018, s + d * 0.48 - 0.08, s + d * 0.48 + 0.08, b + 3.6 * u, b + 5.9 * u, d < 0 ? st : dk); }
    ring(out, x + 0.02, s, b + 7.0 * u, 0.19, 10, st);
    rect(out, x + 0.025, s - 0.12, s + 0.12, b + 6.95 * u, b + 7.05 * u, '#141414');   // (its visor's slit)
    bar(out, x + 0.03, [s + 0.62, floor], [s + 0.62, b + 9.2 * u], 0.06, '#4a3424');
    poly(out, x + 0.035, [[s + 0.62, b + 8.2 * u], [s + 0.95, b + 8.5 * u], [s + 0.95, b + 9.0 * u], [s + 0.62, b + 9.2 * u]], st);
    measure(sizes, 'figure.h', 8 * u);
    proud(s - 0.5, s + 0.5, b, b + 7.4 * u, 0.4);
  } else if (id === 'cell') {
    // (a cell at a body's size let into the wall: its arch over the dark inside, iron bars a hand apart, a crossbar, its
    // hinges, straw on its floor; the bars few, so the band she moves in stays calm)
    const w = 2.4, h = 3.0, z0 = floor, z1 = z0 + h, iron = '#2a2a30';
    poly(out, x, [[s - w / 2 - 0.3, z0], [s + w / 2 + 0.3, z0], [s + w / 2 + 0.3, z1], [s, z1 + 0.9], [s - w / 2 - 0.3, z1]], shade(L.stone, 0.7));
    poly(out, x + 0.005, [[s - w / 2, z0], [s + w / 2, z0], [s + w / 2, z1 - 0.1], [s, z1 + 0.55], [s - w / 2, z1 - 0.1]], '#0e0b0d');
    rect(out, x + 0.008, s - w / 2, s + w / 2, z0, z0 + 0.3, '#5a4a2a');   // (straw)
    const pitch = w / 7;
    for (let k = 1; k < 7; k++) rect(out, x + 0.012, s - w / 2 + k * pitch - 0.035, s - w / 2 + k * pitch + 0.035, z0, z1, iron);
    // (and over it, chains hung from the roof on their hooks: the dungeon's dark gathered high, its floor quiet)
    for (const d of [-1.6, 1.4]) { for (let z = top, k = 0; z > top - 2.8; z -= 0.35, k++) rect(out, x + 0.004, s + d - (k % 2 ? 0.035 : 0.08), s + d + (k % 2 ? 0.035 : 0.08), z - 0.32, z, iron); poly(out, x + 0.005, [[s + d - 0.12, top - 2.85], [s + d + 0.12, top - 2.85], [s + d, top - 3.15]], iron); }
    rect(out, x + 0.014, s - w / 2, s + w / 2, z0 + h * 0.62, z0 + h * 0.62 + 0.08, iron);
    for (const zh of [z0 + 0.5, z1 - 0.6]) rect(out, x + 0.016, s - w / 2 - 0.08, s - w / 2 + 0.18, zh, zh + 0.16, '#4a4a50');
    measure(sizes, 'bar.pitch', pitch); measure(sizes, 'cell.h', h);
    proud(s - w / 2, s + w / 2, z0, z1, 0.15);
  } else if (id === 'shackles') {
    // (two manacles on their chains from rings in the wall, at a hanging body's reach over her head)
    const rz = floor + 3.4, iron = '#3a3a40';
    for (const d of [-0.7, 0.7]) {
      ring(out, x, s + d, rz, 0.14, 8, iron);
      for (let k = 0; k < 5; k++) rect(out, x + 0.005, s + d - (k % 2 ? 0.04 : 0.07), s + d + (k % 2 ? 0.04 : 0.07), rz - 0.2 - k * 0.18, rz - 0.06 - k * 0.18, iron);
      ring(out, x + 0.01, s + d, rz - 1.2, 0.16, 8, '#4a4a52'); ring(out, x + 0.012, s + d, rz - 1.2, 0.09, 8, shade(L.back, 0.6));
    }
    rect(out, x + 0.004, s - 0.9, s + 0.9, rz + 0.25, rz + 0.33, shade(L.stone, 0.85));
    proud(s - 0.9, s + 0.9, rz - 1.4, rz + 0.2, 0.1);
  } else if (id === 'mirror') {
    // (a tall mirror in a gilt frame, a man's height and more, the candlelight a sheen across its glass, hung over the
    // band she moves in)
    const w = 1.5, z0 = floor + 2.6, h = Math.min(3.2, top - z0 - 1.0), z1 = z0 + h, gilt = '#c8a050';
    poly(out, x, [[s - w / 2 - 0.22, z0 - 0.22], [s + w / 2 + 0.22, z0 - 0.22], [s + w / 2 + 0.22, z1], [s, z1 + 0.6], [s - w / 2 - 0.22, z1]], gilt);
    poly(out, x + 0.01, [[s - w / 2, z0], [s + w / 2, z0], [s + w / 2, z1 - 0.05], [s, z1 + 0.35], [s - w / 2, z1 - 0.05]], mix(L.glass || '#8aa0c0', '#d8e0f0', 0.35), 'box:glass', { sky: [z0, z1] });
    bar(out, x + 0.02, [s - w / 2 + 0.2, z0 + 0.4], [s + w / 2 - 0.3, z0 + h * 0.75], 0.14, mix('#ffffff', L.glass || '#8aa0c0', 0.3));
    ring(out, x + 0.02, s, z1 + 0.62, 0.2, 8, gilt);
    measure(sizes, 'mirror.h', h);
    proud(s - w / 2 - 0.22, s + w / 2 + 0.22, z0 - 0.22, z1 + 0.6, 0.1);
  } else if (id === 'antlers') {
    // (a stag's antlers on their shield, high on the wall)
    const z = Math.min(top - 1.6, floor + 5.6), bone = '#d8c8a8';
    poly(out, x, [[s - 0.35, z - 0.5], [s + 0.35, z - 0.5], [s + 0.35, z + 0.1], [s, z + 0.35], [s - 0.35, z + 0.1]], trim);
    for (const d of [-1, 1]) {
      bar(out, x + 0.01, [s + d * 0.15, z], [s + d * 1.0, z + 0.9], 0.08, bone);
      for (const t of [0.35, 0.6, 0.85]) bar(out, x + 0.012, [s + d * (0.15 + 0.85 * t), z + 0.9 * t], [s + d * (0.15 + 0.85 * t - 0.1), z + 0.9 * t + 0.4], 0.06, bone);
    }
    proud(s - 1.0, s + 1.0, z - 0.5, z + 1.3, 0.2);
  } else if (id === 'chart') {
    // (a chart of the stars on its roundel: its rim, its stars and the lines between them)
    const z = Math.min(top - 2.2, floor + 5.2), r = 1.1, ink = '#1a2040', star = '#f0e6c0';
    ring(out, x, s, z, r + 0.12, 16, trim); ring(out, x + 0.005, s, z, r, 16, ink);
    const d = diceOf(`chart:${Math.round(s * 10)}`), pts = Array.from({ length: 7 }, () => { const a = d() * 2 * Math.PI, q = 0.25 + d() * 0.6; return [s + r * q * Math.cos(a), z + r * q * Math.sin(a)]; });
    for (let k = 1; k < 5; k++) bar(out, x + 0.01, pts[k - 1], pts[k], 0.025, shade(star, 0.6));
    for (const p of pts) ring(out, x + 0.015, p[0], p[1], 0.06, 5, star);
    proud(s - r, s + r, z - r, z + r, 0.08);
  } else if (id === 'gibbet') {
    // (an iron cage hung on its chain from the roof, a body's size, its bars round its bones, swinging a little)
    const cz = Math.max(floor + 4.0, Math.min(top - 3.5, floor + 6.0)), w = 1.1, h = 2.0, iron = '#2e2c30';
    for (let z = top, k = 0; z > cz + h / 2 + 0.6; z -= 0.4, k++) rect(out, x, s - (k % 2 ? 0.05 : 0.11), s + (k % 2 ? 0.05 : 0.11), z - 0.36, z, iron);
    poly(out, x + 0.005, [[s - w / 2, cz + h / 2], [s + w / 2, cz + h / 2], [s + 0.12, cz + h / 2 + 0.6], [s - 0.12, cz + h / 2 + 0.6]], iron);
    rect(out, x + 0.004, s - w / 2, s + w / 2, cz - h / 2, cz + h / 2, shade(L.back, 0.45));
    for (const d of [-0.25, 0.25]) { ring(out, x + 0.006, s + d * 0.4, cz + 0.55, 0.16, 8, '#cfc3a8'); }
    bar(out, x + 0.007, [s, cz + 0.4], [s, cz - 0.6], 0.12, '#cfc3a8');
    for (let k = 0; k <= 4; k++) rect(out, x + 0.01, s - w / 2 + (k * w) / 4 - 0.03, s - w / 2 + (k * w) / 4 + 0.03, cz - h / 2, cz + h / 2, iron);
    for (const zz of [cz - h / 2, cz, cz + h / 2 - 0.06]) rect(out, x + 0.012, s - w / 2, s + w / 2, zz, zz + 0.07, iron);
    measure(sizes, 'figure.h', 1.7);
    proud(s - w / 2, s + w / 2, cz - h / 2, cz + h / 2, 0.6);
  } else if (id === 'chandelier') {
    // (a great chandelier hung on its chain from the roof: a gilt ring of arms, a tier over it, a candle on each arm
    // burning live)
    const cz = Math.max(floor + 5.0, Math.min(top - 2.4, floor + 7.0)), gilt = '#d0a850', r = 2.0;
    bar(out, x, [s, top], [s, cz + 1.1], 0.07, shade(gilt, 0.7));
    rect(out, x + 0.005, s - r, s + r, cz - 0.12, cz + 0.06, gilt);
    rect(out, x + 0.006, s - r * 0.55, s + r * 0.55, cz + 0.75, cz + 0.88, gilt);
    poly(out, x + 0.004, [[s - 0.3, cz - 0.12], [s + 0.3, cz - 0.12], [s, cz - 0.7]], gilt);
    bar(out, x + 0.005, [s, cz], [s, cz + 1.1], 0.12, gilt);
    for (const [arm, zz] of [[[-r, -r * 0.5, 0, r * 0.5, r], cz + 0.06], [[-r * 0.55, 0, r * 0.55], cz + 0.88]]) for (const d of arm) {
      rect(out, x + 0.01, s + d - 0.045, s + d + 0.045, zz, zz + 0.24, '#efe4cc');
      measure(sizes, 'candle.h', 0.24);
      if (at.live) at.live.push({ at: [x + 0.06, s + d, zz + 0.24].map((v) => Math.round(v * 1e5) / 1e5), w: 0.12, h: 0.26, color: [1, 0.8, 0.5] });
      else poly(out, x + 0.02, [[s + d - 0.05, zz + 0.24], [s + d + 0.05, zz + 0.24], [s + d, zz + 0.45]], '#ffd890', 'box:flame');
    }
    proud(s - r, s + r, cz - 0.7, cz + 1.1, 1.2);
  } else if (id === 'hearth') {
    // (a great hearth a body and a half high: its jambs and its stone hood, the mantel over it, logs burning in it (live
    // fire), the house's crest over the mantel)
    const w = 3.6, h = 2.8, z0 = floor, z1 = z0 + h, st = shade(L.stone, 0.95);
    for (const d of [-1, 1]) rect(out, x, s + d * (w / 2) - (d > 0 ? 0.5 : 0), s + d * (w / 2) + (d > 0 ? 0 : 0.5), z0, z1, st);
    rect(out, x + 0.002, s - w / 2 + 0.5, s + w / 2 - 0.5, z0, z1 - 0.2, '#120a08');
    rect(out, x, s - w / 2 - 0.35, s + w / 2 + 0.35, z1, z1 + 0.25, trim);   // (the mantel)
    poly(out, x - 0.004, [[s - w / 2, z1 + 0.25], [s + w / 2, z1 + 0.25], [s + 0.9, z1 + 2.4], [s - 0.9, z1 + 2.4]], shade(st, 0.88));
    rect(out, x - 0.006, s - 0.9, s + 0.9, z1 + 2.4, Math.max(z1 + 3, top - 0.2), shade(st, 0.82));
    for (const d of [-0.5, 0.1, 0.55]) bar(out, x + 0.006, [s + d - 0.4, z0 + 0.2], [s + d + 0.4, z0 + 0.35], 0.18, '#4a2e1e');
    if (at.live) at.live.push({ at: [x + 0.08, s, z0 + 0.3].map((v) => Math.round(v * 1e5) / 1e5), w: 1.8, h: 1.0, color: [1, 0.55, 0.2] });
    else poly(out, x + 0.01, [[s - 0.8, z0 + 0.3], [s + 0.8, z0 + 0.3], [s, z0 + 1.4]], '#ff8a3a', 'box:flame');
    poly(out, x + 0.01, [[s - 0.5, z1 + 0.6], [s + 0.5, z1 + 0.6], [s + 0.5, z1 + 1.4], [s, z1 + 1.7], [s - 0.5, z1 + 1.4]], L.carpet || '#7a1a26');
    rect(out, x + 0.012, s - 0.06, s + 0.06, z1 + 0.7, z1 + 1.5, trim);
    measure(sizes, 'hearth.h', h);
    proud(s - w / 2 - 0.35, s + w / 2 + 0.35, z1, z1 + 0.25, 0.4);
  } else if (id === 'telescope') {
    // (a brass telescope on its mount, its tube a man's height and more, aimed up at a window of night over it)
    const brass = '#c8a050', mz = floor + 1.5, len = 3.4, ang = 0.85, tip = [s + len * Math.cos(ang) * 0.5, mz + len * Math.sin(ang)];
    for (const d of [-0.6, 0.6]) bar(out, x, [s + d, floor], [s, mz], 0.08, shade(trim, 0.8));
    bar(out, x + 0.01, [s - len * Math.cos(ang) * 0.5, mz - 0.2], tip, 0.34, brass);
    bar(out, x + 0.012, [s - len * Math.cos(ang) * 0.5, mz - 0.2], [s - len * Math.cos(ang) * 0.5 + 0.4 * Math.cos(ang), mz - 0.2 + 0.4 * Math.sin(ang)], 0.4, shade(brass, 0.8));
    ring(out, x + 0.015, s, mz, 0.16, 8, shade(brass, 0.7));
    // (its window: a round of night it is aimed at, high over it)
    const wz = Math.min(top - 1.4, tip[1] + 1.6), ws = tip[0] + 0.6;
    ring(out, x - 0.01, ws, wz, 1.05, 14, trim);
    ring(out, x - 0.005, ws, wz, 0.9, 14, '#1c2448', 'box:glass');
    for (let k = 0; k < 5; k++) ring(out, x, ws - 0.5 + ((k * 37) % 10) / 10, wz - 0.4 + ((k * 53) % 8) / 10, 0.04, 4, '#f0ecd8', 'box:glass');
    measure(sizes, 'figure.h', 1.5);
    proud(s - 1.2, s + 1.6, floor, tip[1], 0.5);
  } else if (id === 'boulders') {
    // (boulders heaped against the wall as they came to rest: a big one on the floor, smaller ones on and beside it)
    const rock = (cs, cz, r, k) => poly(out, x + 0.002 * k, Array.from({ length: 7 }, (_, q) => { const a = (q / 7) * 2 * Math.PI, w = 0.8 + dice() * 0.35; return [cs + r * w * Math.cos(a), Math.max(floor, cz + r * w * 0.82 * Math.sin(a))]; }), shade(L.stone, 0.72 + dice() * 0.3), 'box:dress', { pillow: 0.6 });
    const R = 1.3 + dice() * 0.6;
    rock(s, floor + R * 0.7, R, 0); rock(s - R * 1.3, floor + 0.55, 0.65, 1); rock(s + R * 0.35, floor + R * 1.5, R * 0.5, 2);
    measure(sizes, 'boulder.r', R);
    proud(s - R * 1.8, s + R * 1.6, floor, floor + R * 2, 0.8);
  } else if (id === 'crystals') {
    // (a cluster of crystals out of the rock, each a long hexagon's face, lit in the cave's glass)
    const g = L.glass || '#8affe0', z0 = Math.min(top - 4, floor + 3.8 + dice() * 3);
    poly(out, x, [[s - 1.2, z0 - 0.3], [s + 1.3, z0 - 0.4], [s + 0.9, z0 + 0.4], [s - 1.0, z0 + 0.3]], shade(L.stone, 0.6), 'box:dress', { pillow: 0.5 });
    for (const [d, len, tilt] of [[0, 2.4, 0.05], [-0.6, 1.5, -0.45], [0.55, 1.8, 0.4], [-0.25, 1.0, -0.2], [0.95, 1.0, 0.75]]) {
      const w = 0.16 + len * 0.06, ax = Math.sin(tilt), az = Math.cos(tilt), b = [s + d, z0], t = [b[0] + ax * len, b[1] + az * len];
      poly(out, x + 0.006, [[b[0] - w * az, b[1] + w * ax], [b[0] + w * az, b[1] - w * ax], [t[0] + w * az - ax * 0.3, t[1] - w * ax - az * 0.3], t, [t[0] - w * az - ax * 0.3, t[1] + w * ax - az * 0.3]], mix(g, '#ffffff', 0.1 * (d > 0)), 'box:glowpod');
      measure(sizes, 'crystal.l', len);
    }
    proud(s - 1.2, s + 1.4, z0 - 0.4, z0 + 2.4, 0.5);
  } else if (id === 'fungus') {
    // (a stand of giant fungi: three stalks of a body's height and over, their caps' gills lit from under)
    const g = L.glass || '#7affa8';
    for (const [d, h, r] of [[0, Math.min(top - floor - 2.4, 3.0 + dice() * 0.6), 1.1], [-1.2, 1.6 + dice() * 0.5, 0.65]]) {
      // (a stalk thick as a trunk, swelling at its foot; a cap domed over its lit gills)
      const sw = 0.22 + r * 0.22, tip = s + d + (dice() - 0.5) * 0.3, stalk = shade(mix(L.stone, '#d8d0b0', 0.55), 0.85);
      poly(out, x + 0.002, [[s + d - sw * 1.6, floor], [s + d + sw * 1.6, floor], [tip + sw * 0.8, floor + h], [tip - sw * 0.8, floor + h]], stalk, 'box:dress', { pillow: 0.4 });
      poly(out, x + 0.006, [[tip - r * 1.1, floor + h], [tip + r * 1.1, floor + h], [tip + r * 0.95, floor + h + r * 0.4], [tip + r * 0.55, floor + h + r * 0.8], [tip, floor + h + r * 0.92], [tip - r * 0.55, floor + h + r * 0.8], [tip - r * 0.95, floor + h + r * 0.4]], shade(mix(L.stone, '#8a4a7a', 0.6), 1.2), 'box:dress', { pillow: 0.5 });
      // (the tall one's gills lit; the small one's dark under its cap, so the band she runs in stays calm)
      if (d === 0) poly(out, x + 0.008, [[tip - r, floor + h + 0.02], [tip + r, floor + h + 0.02], [tip + sw, floor + h - 0.22], [tip - sw, floor + h - 0.22]], g, 'box:glowpod');
      measure(sizes, 'fungus.h', h + r * 0.92);
    }
    proud(s - 1.8, s + 1.6, floor + 1, floor + 4, 0.6);
  } else if (id === 'tendrils') {
    // (tendrils hung from a crack high in the rock, swaying, each lit at its tip)
    const z = Math.min(top - 0.6, floor + 8.5), g = L.glass || '#7affa8';
    poly(out, x, [[s - 1.0, z], [s + 1.1, z + 0.1], [s + 0.6, z + 0.4], [s - 0.7, z + 0.35]], shade(L.back, 0.4), 'box:dress');
    for (let k = 0; k < 5; k++) {
      const d = -0.8 + k * 0.4 + (dice() - 0.5) * 0.2, len = 2.2 + dice() * 3.2;
      let a = [s + d, z];
      for (let q = 1; q <= 4; q++) { const b = [s + d + Math.sin(q * 1.3 + k) * 0.25, z - (len * q) / 4]; bar(out, x + 0.005, a, b, 0.09 - q * 0.012, shade(mix(L.stone, '#3a6a4a', 0.6), 0.9), 'box:sway'); a = b; }
      ring(out, x + 0.01, a[0], a[1], 0.1, 6, g, 'box:glowpod');
    }
    proud(s - 1, s + 1.1, z - 4, z, 0.2);
  } else if (id === 'waterfall' || id === 'lavafall') {
    // (water or lava falling from a crack high in the rock to its pool on the floor; the lava glows and crusts at its edges,
    // the water sprays)
    const lava = id === 'lavafall', z1 = Math.min(top - 0.8, floor + (focal ? 9.5 : 7.5)), w = focal ? 1.6 : 1.0;
    const flow = lava ? '#ff7a2a' : (L.glass ? mix(L.glass, '#ffffff', 0.25) : '#9ad8ff'), edge = lava ? '#5a1a10' : shade(flow, 0.7);
    const g = lava ? 'box:lava' : 'box:water';
    // (the crack it pours from: a dark mouth in a lip of rock jutting from the wall)
    poly(out, x, [[s - w - 0.9, z1 - 0.1], [s + w + 0.8, z1 - 0.2], [s + w * 0.9, z1 + 0.7], [s - w * 0.3, z1 + 0.9], [s - w - 0.6, z1 + 0.5]], shade(L.stone, 0.75), 'box:dress', { pillow: 0.5 });
    poly(out, x + 0.002, [[s - w * 0.6, z1 - 0.1], [s + w * 0.6, z1 - 0.1], [s + w * 0.4, z1 + 0.25], [s - w * 0.4, z1 + 0.25]], shade(L.back, 0.25), 'box:dress');
    // (its sheet narrow at the lip, fanning as it falls, its edges wavering: a band at a time down to its pool)
    const n = 6, half = (k) => (w / 2) * (0.6 + 0.5 * (k / n)) * (1 + 0.12 * Math.sin(k * 2.1 + s));
    for (let k = 0; k < n; k++) {
      const za = z1 - ((z1 - floor - 0.3) * k) / n, zb = z1 - ((z1 - floor - 0.3) * (k + 1)) / n, ha = half(k), hb = half(k + 1);
      poly(out, x + 0.004, [[s - ha, za], [s + ha, za], [s + hb, zb], [s - hb, zb]], flow, g);
      for (const d of [-1, 1]) poly(out, x + 0.006, [[s + d * ha, za], [s + d * (ha - 0.1), za], [s + d * (hb - 0.1), zb], [s + d * hb, zb]], edge, g);
      bar(out, x + 0.007, [s - ha * 0.3 + 0.1 * Math.sin(k), za], [s - hb * 0.25 + 0.1 * Math.sin(k + 1), zb], 0.07, mix(flow, '#ffffff', 0.45), g);
      bar(out, x + 0.007, [s + ha * 0.4, za], [s + hb * 0.45, zb], 0.05, mix(flow, '#ffffff', 0.3), g);
    }
    poly(out, x + 0.005, [[s - w * 1.8, floor], [s + w * 1.8, floor], [s + w * 1.3, floor + 0.35], [s - w * 1.3, floor + 0.35]], flow, g);
    if (lava) for (const d of [-1, 1]) poly(out, x + 0.008, [[s + d * w * 1.8, floor], [s + d * w * 1.1, floor], [s + d * w * 1.2, floor + 0.3]], '#2a100c', 'box:dress');
    else for (const d of [-0.9, 0.9]) ring(out, x + 0.008, s + d * w, floor + 0.55, 0.22, 6, mix(flow, '#ffffff', 0.5), g);
    proud(s - w, s + w, floor, z1, 0.15);
  } else if (id === 'ruin') {
    // (a carved pillar of a people before, broken and leaning, its glyphs worn, its capital fallen at its foot)
    const h = Math.min(top - floor - 1.5, 4.2 + dice() * 1.1), w = 0.9, lean = 0.12, g = L.glass || '#6affd0';
    const at0 = (z) => s + (z - floor) * lean;
    poly(out, x, [[s - w / 2, floor], [s + w / 2, floor], [at0(floor + h) + w / 2, floor + h - 0.3], [at0(floor + h) - w / 2, floor + h]], shade(L.trim, 0.9), 'box:dress', { pillow: 0.4 });
    for (let k = 1; k < 5; k++) { const z = floor + (h * k) / 5; rect(out, x + 0.005, at0(z) - 0.18, at0(z) + 0.18, z - 0.14, z + 0.14, shade(g, 0.55), 'box:glowpod'); }
    poly(out, x + 0.004, [[s + 0.9, floor], [s + 2.0, floor], [s + 2.1, floor + 0.55], [s + 0.8, floor + 0.65]], shade(L.trim, 0.75), 'box:dress');
    measure(sizes, 'pillar.h', h);
    proud(s - w / 2, at0(floor + h) + w / 2, floor, floor + h, 0.4);
  } else if (id === 'pods') {
    // (egg pods stuck to the rock in their slime, each pulsing)
    const z = Math.min(top - 2.4, floor + 4.6 + dice() * 2), g = L.lamp?.colour || '#ff6a8a';
    poly(out, x, [[s - 1.5, z - 1.0], [s + 1.4, z - 1.1], [s + 1.6, z + 0.9], [s - 1.3, z + 1.1]], shade(mix(L.back, '#4a2a3a', 0.5), 0.9), 'box:dress', { pillow: 0.4 });
    for (const [d, dz, r] of [[0, 0, 0.5], [-0.85, -0.35, 0.36], [0.8, -0.4, 0.4], [-0.4, 0.7, 0.3], [0.55, 0.62, 0.28]]) {
      ring(out, x + 0.005, s + d, z + dz, r, 9, shade(mix(L.stone, '#7a4a5a', 0.5), 1.05));
      ring(out, x + 0.008, s + d, z + dz, r * 0.6, 7, mix(g, '#000000', 0.25), 'box:glowpod');
    }
    proud(s - 1.5, s + 1.6, z - 1.1, z + 1.1, 0.4);
  } else if (id === 'lander') {
    // (the explorer's lander on the rim: a hull on three legs, its hatch lit, a ramp down, its beacon blinking)
    const hull = '#c8ccd4', z0 = floor + 1.4, w = 3.4, h = 2.2;
    for (const d of [-1, 0, 1]) bar(out, x, [s + d * w * 0.4, z0 + 0.2], [s + d * w * 0.62, floor], 0.12, shade(hull, 0.55));
    poly(out, x + 0.004, [[s - w / 2, z0], [s + w / 2, z0], [s + w * 0.36, z0 + h], [s - w * 0.36, z0 + h]], hull, 'box:dress');
    poly(out, x + 0.006, [[s - w * 0.36, z0 + h], [s + w * 0.36, z0 + h], [s + w * 0.12, z0 + h + 0.8], [s - w * 0.12, z0 + h + 0.8]], shade(hull, 0.85), 'box:dress');
    rect(out, x + 0.008, s - w / 2, s + w / 2, z0 + 0.5, z0 + 0.65, '#d86a2a');
    rect(out, x + 0.009, s - 0.4, s + 0.4, z0 + 0.15, z0 + 1.35, '#ffe0a0', 'box:glowpod');
    poly(out, x + 0.01, [[s - 0.4, z0 + 0.15], [s + 0.4, z0 + 0.15], [s + 1.0, floor], [s + 0.2, floor]], shade(hull, 0.7), 'box:dress');
    ring(out, x + 0.012, s, z0 + h + 1.0, 0.16, 6, '#ff4040', 'box:glowpod');
    bar(out, x + 0.009, [s, z0 + h + 0.8], [s, z0 + h + 0.9], 0.05, shade(hull, 0.5));
    measure(sizes, 'figure.h', 1.7);
    proud(s - w / 2, s + w / 2, z0, z0 + h, 1.0);
  } else if (id === 'bloom') {
    // (a great bloom of the planet on its stalk, the size of a house, its petals lit and breathing)
    const cz = Math.min(top - 3, floor + 5.6), g = L.glass || '#3affa0', r = 2.4;
    bar(out, x, [s - 0.5, floor], [s, cz], 0.35, shade(mix(L.stone, '#3a6a4a', 0.6), 0.9));
    for (const [d, side] of [[0.4, -1], [0.55, 1]]) poly(out, x + 0.002, [[s + side * 0.1, floor + (cz - floor) * d], [s + side * 1.6, floor + (cz - floor) * d + 0.6], [s + side * 0.9, floor + (cz - floor) * d + 0.2]], shade(mix(L.stone, '#3a6a4a', 0.7), 1), 'box:sway');
    for (let k = 0; k < 7; k++) { const a = (k / 7) * 2 * Math.PI; poly(out, x + 0.005, [[s, cz], [s + r * Math.cos(a - 0.28), cz + r * Math.sin(a - 0.28)], [s + r * 1.1 * Math.cos(a), cz + r * 1.1 * Math.sin(a)], [s + r * Math.cos(a + 0.28), cz + r * Math.sin(a + 0.28)]], mix('#c84a8a', g, k % 2 ? 0.2 : 0), 'box:dress'); }
    ring(out, x + 0.01, s, cz, 0.7, 10, g, 'box:glowpod');
    proud(s - r * 0.4, s + r * 0.4, cz - r * 0.4, cz + r * 0.4, 0.4);
  } else if (id === 'fossil') {
    // (the fossil of something vast set in the rock: its spine in an arc, its ribs off it, its skull at one end)
    const bone = mix(L.top, '#e8dcc0', 0.4), cz = Math.min(top - 3, floor + 4.5), R = 4.0;
    poly(out, x - 0.004, [[s - R - 0.6, cz - 1.8], [s + R + 0.6, cz - 1.6], [s + R + 0.4, cz + 2.2], [s - R - 0.4, cz + 2.0]], shade(L.back, 0.75), 'box:dress', { pillow: 0.3 });
    let a = null;
    for (let k = 0; k <= 10; k++) { const t = -1 + k / 5, p = [s + t * R, cz + Math.cos(t * 1.2) * 1.2]; if (a) bar(out, x, a, p, 0.22, bone); if (k > 1 && k < 9) bar(out, x + 0.002, p, [p[0] + 0.15, p[1] - 1.1 - Math.cos(t) * 0.4], 0.09, shade(bone, 0.85)); a = p; }
    poly(out, x + 0.004, [[s + R, cz + 0.2], [s + R + 1.4, cz + 0.6], [s + R + 1.2, cz + 1.3], [s + R - 0.2, cz + 1.0]], bone, 'box:dress');
    ring(out, x + 0.006, s + R + 0.6, cz + 0.85, 0.16, 6, shade(L.back, 0.4));
    measure(sizes, 'figure.h', 3.0);
    proud(s - R, s + R + 1.4, cz - 1.5, cz + 1.4, 0.15);
  } else if (id === 'monolith') {
    // (a monolith of the people before: a slab twice her height, carved, glowing in its seams)
    const g = L.glass || '#c08aff', h = Math.min(top - floor - 1.5, 4.6), w = 1.6;
    poly(out, x, [[s - w / 2, floor], [s + w / 2, floor], [s + w * 0.42, floor + h], [s, floor + h + 0.4], [s - w * 0.42, floor + h]], shade(L.trim, 0.8), 'box:dress', { pillow: 0.3 });
    // (its seams carved in its upper half, over her head, the glyphs a people read standing)
    for (let k = 0; k < 3; k++) { const z = floor + h * 0.5 + k * (h * 0.4) / 3; rect(out, x + 0.004, s - w * 0.3, s + w * 0.3, z, z + 0.07, g, 'box:glowpod'); rect(out, x + 0.004, s - 0.04, s + 0.04, z, z + (h * 0.4) / 3 - 0.15, shade(g, 0.7), 'box:glowpod'); }
    ring(out, x + 0.006, s, floor + h - 0.4, 0.22, 8, g, 'box:glowpod');
    measure(sizes, 'pillar.h', h);
    proud(s - w / 2, s + w / 2, floor, floor + h, 0.4);
  } else if (id === 'beacon') {
    // (the station: a mast of the explorer's own on a pad, its lamp lit, its panel showing; the save is kept here)
    const metal = '#8a94a4', h = 4.2;
    rect(out, x, s - 1.6, s + 1.6, floor, floor + 0.3, shade(metal, 0.7));
    bar(out, x + 0.004, [s, floor + 0.3], [s, floor + h], 0.24, metal);
    for (const d of [-1, 1]) bar(out, x + 0.003, [s + d * 1.2, floor + 0.3], [s, floor + h * 0.6], 0.07, shade(metal, 0.8));
    rect(out, x + 0.006, s + 0.4, s + 1.4, floor + 1.0, floor + 1.8, '#1a2a3a');
    rect(out, x + 0.008, s + 0.5, s + 1.3, floor + 1.1, floor + 1.7, L.lamp?.colour || '#a0e8ff', 'box:glowpod');
    ring(out, x + 0.01, s, floor + h + 0.2, 0.3, 10, L.lamp?.colour || '#a0e8ff', 'box:glowpod');
    measure(sizes, 'figure.h', 1.7);
    proud(s - 1.6, s + 1.6, floor, floor + 0.3, 0.6);
  } else if (id === 'nest') {
    // (the nest of the thing below: a mound of rock and slime, its pods round it, its heart glowing)
    const g = L.lamp?.colour || '#ff6a8a', h = Math.min(top - floor - 2, 5.5), w = 4.4;
    poly(out, x, [[s - w / 2, floor], [s + w / 2, floor], [s + w * 0.3, floor + h * 0.8], [s, floor + h], [s - w * 0.35, floor + h * 0.75]], shade(mix(L.stone, '#4a2a3a', 0.5), 0.85), 'box:dress', { pillow: 0.5 });
    ring(out, x + 0.005, s, floor + h * 0.62, 0.8, 10, shade(g, 0.6), 'box:glowpod');
    ring(out, x + 0.008, s, floor + h * 0.62, 0.45, 8, g, 'box:glowpod');
    for (const [d, z, r] of [[-1.6, 0.4, 0.4], [1.5, 0.35, 0.42], [-0.7, h * 0.78, 0.32], [0.8, h * 0.84, 0.3]]) { ring(out, x + 0.01, s + d, floor + z, r, 8, shade(mix(L.stone, '#7a4a5a', 0.5), 1.05)); ring(out, x + 0.012, s + d, floor + z, r * 0.55, 6, mix(g, '#000000', 0.3), 'box:glowpod'); }
    proud(s - w / 2, s + w / 2, floor, floor + h, 0.9);
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
